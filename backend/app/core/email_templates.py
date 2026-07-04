from app.core.config import settings

def get_verification_template(user_name: str, raw_token: str) -> str:
    """Generates the HTML onboarding email verification template."""
    public_site_url = getattr(settings, "PUBLIC_SITE_URL", None) or getattr(settings, "FRONTEND_URL", "")
    verification_url = f"{public_site_url}/verify-email?token={raw_token}"
    
    return f"""
    <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937; line-height: 1.6; background-color: #f9fafb; margin: 0; padding: 40px 0;">
            <div style="max-width: 540px; margin: 0 auto; background-color: #ffffff; padding: 32px; border-radius: 8px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <h2 style="font-size: 24px; font-weight: 700; color: #111827; margin-top: 0; margin-bottom: 16px;">Welcome, {user_name}!</h2>
                <p style="margin-bottom: 24px; color: #4b5563;">Before you can begin setting up and configuring your new blog workspace, please quickly verify your email address by clicking the button below:</p>
                <div style="margin: 32px 0; text-align: center;">
                    <a href="{verification_url}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; display: inline-block;">Verify Email Address</a>
                </div>
                <p style="font-size: 14px; color: #6b7280; margin-bottom: 0;">This verification link will expire in 24 hours. If you did not create this account, you can safely ignore this message.</p>
            </div>
        </body>
    </html>
    """

def get_password_reset_template(user_name: str, raw_token: str) -> str:
    """Generates the HTML password recovery template."""
    reset_url = f"{settings.ADMIN_STUDIO_URL}/admin/reset-password?token={raw_token}"
    
    return f"""
    <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937; line-height: 1.6; background-color: #f9fafb; margin: 0; padding: 40px 0;">
            <div style="max-width: 540px; margin: 0 auto; background-color: #ffffff; padding: 32px; border-radius: 8px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <h2 style="font-size: 24px; font-weight: 700; color: #111827; margin-top: 0; margin-bottom: 16px;">Password Reset Request</h2>
                <p style="margin-bottom: 24px; color: #4b5563;">Hi {user_name}, we received a request to update your account password. Click the button below to define a new password credential:</p>
                <div style="margin: 32px 0; text-align: center;">
                    <a href="{reset_url}" style="background-color: #dc2626; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; display: inline-block;">Reset Password</a>
                </div>
                <p style="font-size: 14px; color: #6b7280; margin-bottom: 20px;">This security link will automatically expire in 24 hours.</p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
                <p style="font-size: 12px; color: #9ca3af; margin-bottom: 0;">If you did not request a password update, no actions are required; your current credentials remain securely intact.</p>
            </div>
        </body>
    </html>
    """