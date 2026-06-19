import requests
from typing import Dict, Any, Optional
from app.config import settings
import logging

logger = logging.getLogger(__name__)

class PaystackClient:
    def __init__(self):
        self.secret_key = settings.PAYSTACK_SECRET_KEY
        self.base_url = "https://api.paystack.co"
        self.is_mock = self.secret_key.startswith("sk_test_mock") or not self.secret_key

    def get_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.secret_key}",
            "Content-Type": "application/json"
        }

    def initialize_transaction(self, email: str, amount_in_kobo: int, reference: str, callback_url: str, currency: str = "NGN") -> Dict[str, Any]:
        """
        Initializes a transaction on Paystack.
        Amount must be in kobo (or cents, i.e. major unit * 100).
        """
        if self.is_mock:
            logger.warning("PAYSTACK: Using mock transaction initialization.")
            # Dynamically resolve origin from callback_url for production staging deployments
            origin = "http://localhost:5173"
            if callback_url and "://" in callback_url:
                parts = callback_url.split("/")
                origin = "/".join(parts[:3]) # e.g. "https://projects.eugenedev.cloud"
            
            # Point to a mock payment page on the frontend
            mock_auth_url = (
                f"{origin}/mock-pay?"
                f"reference={reference}&"
                f"amount={amount_in_kobo / 100}&"
                f"email={email}&"
                f"currency={currency}&"
                f"callback={callback_url}"
            )
            return {
                "status": True,
                "data": {
                    "authorization_url": mock_auth_url,
                    "reference": reference,
                    "access_code": f"mock_access_{reference}"
                }
            }

        url = f"{self.base_url}/transaction/initialize"
        payload = {
            "email": email,
            "amount": amount_in_kobo,
            "reference": reference,
            "callback_url": callback_url,
            "currency": currency
        }
        
        try:
            response = requests.post(url, json=payload, headers=self.get_headers(), timeout=10)
            res_json = response.json()
            if response.status_code == 200 and res_json.get("status"):
                return res_json
            
            # If Paystack fails (e.g. invalid currency, invalid keys), raise exception
            logger.error(f"Paystack initialization failed: {res_json}")
            raise Exception(res_json.get("message", "Paystack initialization failed"))
        except requests.exceptions.RequestException as e:
            logger.error(f"Paystack API network error: {e}")
            raise Exception("Network error connecting to Paystack payment gateway.")

    def verify_transaction(self, reference: str) -> Dict[str, Any]:
        """
        Verifies a transaction using the Paystack reference.
        """
        if self.is_mock or reference.startswith("mock_"):
            logger.warning(f"PAYSTACK: Using mock transaction verification for reference: {reference}")
            # Mock verification succeeds if reference exists
            return {
                "status": True,
                "message": "Verification successful",
                "data": {
                    "id": 123456,
                    "domain": "test",
                    "status": "success",
                    "reference": reference,
                    "amount": 10000, # dummy amount in kobo, actual verification overrides this with DB amount
                    "gateway_response": "Successful mock payment",
                    "paid_at": "2026-06-19T08:00:00.000Z",
                    "channel": "card",
                    "currency": "NGN"
                }
            }

        url = f"{self.base_url}/transaction/verify/{reference}"
        try:
            response = requests.get(url, headers=self.get_headers(), timeout=10)
            res_json = response.json()
            if response.status_code == 200 and res_json.get("status"):
                return res_json
            logger.error(f"Paystack verification failed: {res_json}")
            raise Exception(res_json.get("message", "Paystack verification failed"))
        except requests.exceptions.RequestException as e:
            logger.error(f"Paystack API network error: {e}")
            raise Exception("Network error connecting to Paystack payment gateway.")

paystack_client = PaystackClient()
