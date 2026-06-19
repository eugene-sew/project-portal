import requests
import logging
from app.config import settings

logger = logging.getLogger(__name__)

def send_payment_notification(client_name: str, project_name: str, amount: float, currency: str, reference: str) -> bool:
    """
    Sends an email notification to the admin when a project payment is received.
    """
    is_mock = settings.RESEND_API_KEY.startswith("re_mock") or not settings.RESEND_API_KEY
    symbol_map = { 'NGN': '₦', 'USD': '$', 'GHS': 'GH₵', 'EUR': '€', 'GBP': '£' }
    symbol = symbol_map.get(currency.upper(), currency)
    formatted_amount = f"{symbol}{amount:,.2f}"

    subject = f"🎉 Payment Received: {project_name}"
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Payment Received</title>
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                background-color: #f8fafc;
                margin: 0;
                padding: 40px 20px;
                color: #0f172a;
            }}
            .container {{
                max-width: 580px;
                background: #ffffff;
                border: 1px solid #e2e8f0;
                border-radius: 12px;
                padding: 32px;
                margin: 0 auto;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
            }}
            .header {{
                text-align: center;
                margin-bottom: 28px;
            }}
            .icon {{
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 48px;
                height: 48px;
                border-radius: 50%;
                background: rgba(16, 185, 129, 0.08);
                color: #10b981;
                font-size: 24px;
                margin-bottom: 12px;
            }}
            h1 {{
                font-size: 20px;
                font-weight: 700;
                margin: 0;
                color: #0f172a;
            }}
            .amount {{
                font-size: 28px;
                font-weight: 800;
                text-align: center;
                color: #10b981;
                margin: 20px 0;
            }}
            .details-table {{
                width: 100%;
                border-collapse: collapse;
                margin-top: 24px;
                border-top: 1px solid #e2e8f0;
            }}
            .details-table td {{
                padding: 12px 0;
                border-bottom: 1px solid #f1f5f9;
                font-size: 14px;
            }}
            .label {{
                color: #64748b;
                font-weight: 500;
            }}
            .value {{
                text-align: right;
                font-weight: 600;
                color: #0f172a;
            }}
            .footer {{
                text-align: center;
                font-size: 12px;
                color: #94a3b8;
                margin-top: 32px;
                border-top: 1px solid #e2e8f0;
                padding-top: 20px;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="icon">✓</div>
                <h1>Payment Confirmed</h1>
                <p style="color: #64748b; font-size: 14px; margin-top: 4px;">A client has successfully settled their project invoice.</p>
            </div>
            
            <div class="amount">{formatted_amount}</div>
            
            <table class="details-table">
                <tr>
                    <td class="label">Project</td>
                    <td class="value">{project_name}</td>
                </tr>
                <tr>
                    <td class="label">Client Name</td>
                    <td class="value">{client_name}</td>
                </tr>
                <tr>
                    <td class="label">Reference</td>
                    <td class="value" style="font-family: monospace;">{reference}</td>
                </tr>
                <tr>
                    <td class="label">Payment Status</td>
                    <td class="value"><span style="color: #10b981;">SUCCESS</span></td>
                </tr>
                <tr>
                    <td class="label">Gateway</td>
                    <td class="value">Paystack Checkout</td>
                </tr>
            </table>
            
            <div class="footer">
                This is an automated payment confirmation sent from your Projects Invoicing Portal.
            </div>
        </div>
    </body>
    </html>
    """

    if is_mock:
        logger.warning("EMAIL NOTIFICATION (MOCK MODE):")
        logger.warning(f"From: {settings.RESEND_FROM_EMAIL}")
        logger.warning(f"To: {settings.ADMIN_NOTIFICATION_EMAIL}")
        logger.warning(f"Subject: {subject}")
        logger.warning(f"HTML Content:\n{html_content}")
        return True

    # Real Resend API Request
    url = "https://api.resend.com/emails"
    headers = {
        "Authorization": f"Bearer {settings.RESEND_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "from": settings.RESEND_FROM_EMAIL,
        "to": [settings.ADMIN_NOTIFICATION_EMAIL],
        "subject": subject,
        "html": html_content
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        res_json = response.json()
        if response.status_code in [200, 201] and "id" in res_json:
            logger.info(f"Email sent successfully via Resend. ID: {res_json['id']}")
            return True
        logger.error(f"Resend API call failed: {res_json}")
        return False
    except requests.exceptions.RequestException as e:
        logger.error(f"Network error connecting to Resend: {e}")
        return False


def send_admin_credentials(to_email: str, username: str, password: str) -> bool:
    is_mock = settings.RESEND_API_KEY.startswith("re_mock") or not settings.RESEND_API_KEY
    subject = "🔑 Your Projects Portal Admin Credentials"
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Admin Credentials</title>
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                background-color: #f8fafc;
                margin: 0;
                padding: 40px 20px;
                color: #0f172a;
            }}
            .container {{
                max-width: 500px;
                background: #ffffff;
                border: 1px solid #e2e8f0;
                border-radius: 12px;
                padding: 32px;
                margin: 0 auto;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
            }}
            h1 {{
                font-size: 20px;
                font-weight: 700;
                color: #0f172a;
                margin-bottom: 8px;
            }}
            .credentials-box {{
                background: #f1f5f9;
                border-radius: 8px;
                padding: 20px;
                margin: 24px 0;
                border: 1px solid #e2e8f0;
            }}
            .credential-row {{
                display: flex;
                justify-content: space-between;
                padding: 8px 0;
                font-size: 15px;
            }}
            .label {{
                color: #64748b;
                font-weight: 500;
            }}
            .value {{
                font-weight: 700;
                font-family: monospace;
                color: #0f172a;
            }}
            .footer {{
                text-align: center;
                font-size: 12px;
                color: #94a3b8;
                margin-top: 32px;
                border-top: 1px solid #e2e8f0;
                padding-top: 20px;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Admin Access Created</h1>
            <p style="color: #64748b; font-size: 14px;">The Projects payment tracker backend has successfully initialized your administrative account.</p>
            
            <div class="credentials-box">
                <div class="credential-row">
                    <span class="label">Portal URL:</span>
                    <span class="value" style="font-family: inherit;">http://localhost:5173/admin/login</span>
                </div>
                <div class="credential-row">
                    <span class="label">Username:</span>
                    <span class="value">{username}</span>
                </div>
                <div class="credential-row">
                    <span class="label">Generated Password:</span>
                    <span class="value" style="color: #10b981;">{password}</span>
                </div>
            </div>
            
            <p style="font-size: 13px; color: #ef4444; font-weight: 500;">Please log in and modify your password in the database for maximum security.</p>
            
            <div class="footer">
                Projects Invoicing Portal • Automated System Setup
            </div>
        </div>
    </body>
    </html>
    """

    if is_mock:
        logger.warning("EMAIL NOTIFICATION (MOCK MODE - ADMIN CREDENTIALS):")
        logger.warning(f"From: {settings.RESEND_FROM_EMAIL}")
        logger.warning(f"To: {to_email}")
        logger.warning(f"Subject: {subject}")
        logger.warning(f"HTML Content:\n{html_content}")
        return True

    # Real Resend API Request
    url = "https://api.resend.com/emails"
    headers = {
        "Authorization": f"Bearer {settings.RESEND_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "from": settings.RESEND_FROM_EMAIL,
        "to": [to_email],
        "subject": subject,
        "html": html_content
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        res_json = response.json()
        if response.status_code in [200, 201] and "id" in res_json:
            logger.info(f"Admin credentials email sent successfully via Resend. ID: {res_json['id']}")
            return True
        logger.error(f"Resend API call failed: {res_json}")
        return False
    except requests.exceptions.RequestException as e:
        logger.error(f"Network error connecting to Resend: {e}")
        return False
