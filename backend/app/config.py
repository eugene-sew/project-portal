import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    # App Settings
    PROJECT_NAME: str = "Projects Payment Tracker"
    DATABASE_URL: str = "sqlite:///./projects.db"
    
    # Paystack Configuration
    PAYSTACK_SECRET_KEY: str = "sk_test_mock_secret_key_please_replace"
    
    # Admin Credentials
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "admin123"  # In production, use a strong password
    
    # JWT Authentication
    JWT_SECRET: str = "supersecretjwtkeyforprojectspaymenttracker"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # Resend Email Configuration
    RESEND_API_KEY: str = "re_mock_key"
    RESEND_FROM_EMAIL: str = "Projects Portal <onboarding@resend.dev>"
    ADMIN_NOTIFICATION_EMAIL: str = "admin@example.com"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
