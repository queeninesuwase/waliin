from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    session_cookie_name: str = "__Host-waliin_session"
    session_idle_minutes: int = 15
    session_max_hours: int = 8
    redis_url: str = ""
    redis_tls_verify: bool = True
    mfa_encryption_key: str = ""
    mfa_issuer: str = "Waliin"

    frontend_base_url: str = ""
    dashboard_base_url: str = ""
    email_logo_url: str = ""

    email_backend: str = "smtp"
    email_from: str = "Waliin <no-reply@waliin.local>"
    smtp_host: str = ""
    smtp_port: int = 1025
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = False


settings = Settings()
