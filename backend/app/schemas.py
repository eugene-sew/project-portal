from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional, List, Dict

# Auth Schemas
class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str

# Payment Schemas
class PaymentResponse(BaseModel):
    id: int
    project_id: str
    reference: str
    status: str
    amount_paid: Optional[float] = None
    paid_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

class InitializePaymentResponse(BaseModel):
    authorization_url: str
    reference: str
    access_code: str

# Project Schemas
class ProjectBase(BaseModel):
    client_name: str = Field(..., min_length=2, max_length=100)
    client_email: EmailStr
    project_name: str = Field(..., min_length=2, max_length=255)
    amount: float = Field(..., gt=0)
    currency: str = Field("GHS", min_length=3, max_length=10)
    initial_paid_amount: float = Field(0.0, ge=0)
    description: Optional[str] = None

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(BaseModel):
    client_name: Optional[str] = None
    client_email: Optional[EmailStr] = None
    project_name: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    initial_paid_amount: Optional[float] = None

class ProjectResponse(ProjectBase):
    id: str
    status: str
    total_paid: float = 0.0
    remaining_balance: float = 0.0
    created_at: datetime
    updated_at: datetime
    payments: List[PaymentResponse] = []

    class Config:
        from_attributes = True

# Dashboard / Stats Schemas
class CurrencyStat(BaseModel):
    total_amount: float
    paid_amount: float
    pending_amount: float

class DashboardStats(BaseModel):
    total_projects: int
    total_paid: int
    total_pending: int
    by_currency: Dict[str, CurrencyStat]
