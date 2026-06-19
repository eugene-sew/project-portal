import hmac
import hashlib
import json
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from jose import JWTError, jwt

from app.config import settings
from app.database import engine, Base, get_db
from app.models import Project, Payment, AdminUser
from app.schemas import (
    LoginRequest, TokenResponse, ProjectCreate, ProjectUpdate,
    ProjectResponse, PaymentResponse, InitializePaymentResponse,
    DashboardStats, CurrencyStat
)
from app.paystack import paystack_client
from app.email import send_payment_notification, send_admin_credentials

# Initialize DB Tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.PROJECT_NAME)

# CORS configuration to allow local frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Hashing & Authentication
import bcrypt
import secrets
from app.database import SessionLocal

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def seed_admin_user():
    db = SessionLocal()
    try:
        admin_count = db.query(AdminUser).count()
        if admin_count == 0:
            # Generate a secure random password on first run/deployment
            generated_password = secrets.token_urlsafe(12)
            hashed_pwd = get_password_hash(generated_password)
            
            admin_user = AdminUser(
                username="admin",
                email="eugenesew4@gmail.com",
                hashed_password=hashed_pwd
            )
            db.add(admin_user)
            db.commit()
            
            # Dispatch credentials to admin email via Resend
            try:
                send_admin_credentials(
                    to_email="eugenesew4@gmail.com",
                    username="admin",
                    password=generated_password
                )
                logger.info("Admin credentials created and notification sent.")
            except Exception as email_err:
                logger.error(f"Failed to send admin credentials email: {email_err}")
    finally:
        db.close()

@app.on_event("startup")
def startup_event():
    seed_admin_user()

# Authentication Utilities
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt

def get_current_admin(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    admin = db.query(AdminUser).filter(AdminUser.username == username).first()
    if admin is None:
        raise credentials_exception
    return username

# --- ROUTES ---

# 1. Admin Authentication
@app.post("/api/auth/login", response_model=TokenResponse)
def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    admin = db.query(AdminUser).filter(AdminUser.username == login_data.username).first()
    if admin and verify_password(login_data.password, admin.hashed_password):
        access_token = create_access_token(data={"sub": admin.username})
        return {"access_token": access_token, "token_type": "bearer"}
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect username or password",
        headers={"WWW-Authenticate": "Bearer"},
    )

# 2. Admin Dashboard Stats
@app.get("/api/admin/stats", response_model=DashboardStats)
def get_dashboard_stats(db: Session = Depends(get_db), current_user: str = Depends(get_current_admin)):
    projects = db.query(Project).all()
    
    total_projects = len(projects)
    total_paid = sum(1 for p in projects if p.status == "paid")
    total_pending = sum(1 for p in projects if p.status == "pending")
    
    by_currency = {}
    for p in projects:
        if p.currency not in by_currency:
            by_currency[p.currency] = CurrencyStat(total_amount=0.0, paid_amount=0.0, pending_amount=0.0)
        
        stat = by_currency[p.currency]
        stat.total_amount += p.amount
        if p.status == "paid":
            stat.paid_amount += p.amount
        elif p.status == "pending":
            stat.pending_amount += p.amount
            
    return {
        "total_projects": total_projects,
        "total_paid": total_paid,
        "total_pending": total_pending,
        "by_currency": by_currency
    }

# 3. Admin Get All Projects
@app.get("/api/admin/projects", response_model=List[ProjectResponse])
def get_all_projects(db: Session = Depends(get_db), current_user: str = Depends(get_current_admin)):
    projects = db.query(Project).order_by(Project.created_at.desc()).all()
    return projects

# 3.5 Admin Get All Payments
@app.get("/api/admin/payments")
def get_all_payments(db: Session = Depends(get_db), current_user: str = Depends(get_current_admin)):
    results = db.query(Payment, Project).join(Project, Payment.project_id == Project.id).order_by(Payment.created_at.desc()).all()
    
    payments_list = []
    for payment, project in results:
        payments_list.append({
            "id": payment.id,
            "project_id": payment.project_id,
            "project_name": project.project_name,
            "client_name": project.client_name,
            "reference": payment.reference,
            "status": payment.status,
            "amount_paid": payment.amount_paid if payment.amount_paid is not None else project.amount,
            "currency": project.currency,
            "paid_at": payment.paid_at,
            "created_at": payment.created_at
        })
    return payments_list


# 4. Admin Create Project
@app.post("/api/admin/projects", response_model=ProjectResponse)
def create_project(project_in: ProjectCreate, db: Session = Depends(get_db), current_user: str = Depends(get_current_admin)):
    db_project = Project(
        client_name=project_in.client_name,
        client_email=project_in.client_email,
        project_name=project_in.project_name,
        amount=project_in.amount,
        currency=project_in.currency.upper(),
        description=project_in.description,
        status="pending"
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project

# 5. Admin Get Single Project
@app.get("/api/admin/projects/{project_id}", response_model=ProjectResponse)
def get_project_admin(project_id: str, db: Session = Depends(get_db), current_user: str = Depends(get_current_admin)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

# 6. Admin Update Project
@app.put("/api/admin/projects/{project_id}", response_model=ProjectResponse)
def update_project(project_id: str, project_in: ProjectUpdate, db: Session = Depends(get_db), current_user: str = Depends(get_current_admin)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    update_data = project_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "currency" and value:
            value = value.upper()
        setattr(project, field, value)
        
    db.commit()
    db.refresh(project)
    return project

# 7. Admin Delete Project
@app.delete("/api/admin/projects/{project_id}")
def delete_project(project_id: str, db: Session = Depends(get_db), current_user: str = Depends(get_current_admin)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(project)
    db.commit()
    return {"detail": "Project deleted successfully"}


# --- PUBLIC / CLIENT ROUTES ---

# 8. Public Get Single Project (Client view)
@app.get("/api/projects/{project_id}", response_model=ProjectResponse)
def get_project_public(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

# 9. Public Pay Project (Initializes Paystack payment link)
@app.post("/api/projects/{project_id}/pay", response_model=InitializePaymentResponse)
def pay_project(project_id: str, request_data: dict, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if project.status == "paid":
        raise HTTPException(status_code=400, detail="Project has already been paid for.")
        
    # Get callback URL from frontend request
    callback_url = request_data.get("callback_url")
    if not callback_url:
        raise HTTPException(status_code=400, detail="callback_url is required")
        
    # Paystack amount is in cents/kobo
    amount_in_kobo = int(project.amount * 100)
    
    # Generate unique transaction reference
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    reference = f"proj_{project.id[:8]}_{timestamp}"
    
    try:
        paystack_response = paystack_client.initialize_transaction(
            email=project.client_email,
            amount_in_kobo=amount_in_kobo,
            reference=reference,
            callback_url=callback_url,
            currency=project.currency
        )
        
        # Log this pending payment in database
        payment = Payment(
            project_id=project.id,
            reference=reference,
            status="pending"
        )
        db.add(payment)
        db.commit()
        
        return {
            "authorization_url": paystack_response["data"]["authorization_url"],
            "reference": reference,
            "access_code": paystack_response["data"]["access_code"]
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# 10. Public Verify Payment (Triggered after Paystack callback or manually)
@app.post("/api/projects/verify/{reference}", response_model=ProjectResponse)
def verify_payment(reference: str, db: Session = Depends(get_db)):
    payment = db.query(Payment).filter(Payment.reference == reference).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment record not found")
        
    project = db.query(Project).filter(Project.id == payment.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Associated project not found")
        
    # If project is already marked paid, just return it
    if project.status == "paid" and payment.status == "success":
        return project
        
    try:
        verification_data = paystack_client.verify_transaction(reference)
        data = verification_data.get("data", {})
        
        if data.get("status") == "success":
            # Update Payment
            payment.status = "success"
            payment.amount_paid = data.get("amount", 0) / 100.0  # Convert back from kobo
            payment.paystack_response = json.dumps(data)
            
            # Extract paid_at timestamp if provided
            paid_at_str = data.get("paid_at")
            if paid_at_str:
                try:
                    payment.paid_at = datetime.fromisoformat(paid_at_str.replace("Z", "+00:00"))
                except Exception:
                    payment.paid_at = datetime.utcnow()
            else:
                payment.paid_at = datetime.utcnow()
                
            # Update Project
            project.status = "paid"
            
            db.commit()
            db.refresh(project)
            
            # Send email notification to admin (safe wrapper)
            try:
                send_payment_notification(
                    client_name=project.client_name,
                    project_name=project.project_name,
                    amount=project.amount,
                    currency=project.currency,
                    reference=reference
                )
            except Exception as email_err:
                logger.error(f"Failed to send payment notification email: {email_err}")
                
            return project
        else:
            # Payment failed on Paystack
            payment.status = "failed"
            payment.paystack_response = json.dumps(data)
            project.status = "failed"
            db.commit()
            db.refresh(project)
            return project
            
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# 11. Paystack Webhook Handler
@app.post("/api/paystack/webhook")
async def paystack_webhook(
    request: Request,
    x_paystack_signature: str = Header(None, alias="x-paystack-signature"),
    db: Session = Depends(get_db)
):
    body = await request.body()
    
    # Verify Webhook signature if not in mock mode
    if not settings.PAYSTACK_SECRET_KEY.startswith("sk_test_mock"):
        if not x_paystack_signature:
            raise HTTPException(status_code=400, detail="Signature header missing")
            
        computed_signature = hmac.new(
            settings.PAYSTACK_SECRET_KEY.encode('utf-8'),
            body,
            hashlib.sha512
        ).hexdigest()
        
        if not hmac.compare_digest(computed_signature, x_paystack_signature):
            raise HTTPException(status_code=401, detail="Invalid signature")

    # Process payload
    try:
        payload = json.loads(body)
        event = payload.get("event")
        data = payload.get("data", {})
        
        if event == "charge.success":
            reference = data.get("reference")
            payment = db.query(Payment).filter(Payment.reference == reference).first()
            if payment:
                project = db.query(Project).filter(Project.id == payment.project_id).first()
                if project and project.status != "paid":
                    # Update Payment
                    payment.status = "success"
                    payment.amount_paid = data.get("amount", 0) / 100.0
                    payment.paystack_response = json.dumps(data)
                    
                    paid_at_str = data.get("paid_at")
                    if paid_at_str:
                        try:
                            payment.paid_at = datetime.fromisoformat(paid_at_str.replace("Z", "+00:00"))
                        except Exception:
                            payment.paid_at = datetime.utcnow()
                    else:
                        payment.paid_at = datetime.utcnow()
                        
                    # Update Project
                    project.status = "paid"
                    db.commit()
                    
                    # Send email notification to admin (safe wrapper)
                    try:
                        send_payment_notification(
                            client_name=project.client_name,
                            project_name=project.project_name,
                            amount=project.amount,
                            currency=project.currency,
                            reference=reference
                        )
                    except Exception as email_err:
                        logger.error(f"Failed to send payment notification email: {email_err}")
                    
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Webhook parsing error: {str(e)}")
