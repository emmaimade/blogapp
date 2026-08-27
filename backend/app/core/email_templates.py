from app.core.config import settings

BRAND_NAME = "Inko"
LOGO_URL = getattr(settings, "PUBLIC_LOGO_URL", None) or "https://inko.blog/static/email/inko-logo.png"


def _base_email(preheader: str, heading: str, body_html: str, cta_label: str, cta_url: str, cta_color: str, footer_note: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <title>{heading}</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <span style="display:none; font-size:1px; color:#f9fafb; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">
      {preheader}
    </span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb; padding:40px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="540" cellpadding="0" cellspacing="0" style="max-width:540px; width:100%; background-color:#ffffff; border-radius:8px; border:1px solid #e5e7eb;">
            <tr>
              <td style="padding:28px 32px 0 32px;">
                <img src="{LOGO_URL}" alt="{BRAND_NAME}" width="32" height="32" style="display:block; border:0;" />
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 32px 32px; color:#1f2937; line-height:1.6;">
                <h2 style="font-size:22px; font-weight:700; color:#111827; margin:0 0 16px 0;">{heading}</h2>
                {body_html}
                <div style="margin:28px 0; text-align:center;">
                  <a href="{cta_url}" style="background-color:{cta_color}; color:#ffffff; padding:12px 28px; text-decoration:none; border-radius:6px; font-weight:600; font-size:15px; display:inline-block;">{cta_label}</a>
                </div>
                <p style="font-size:13px; color:#6b7280; margin:0 0 4px 0;">If the button doesn't work, copy and paste this link:</p>
                <p style="font-size:12px; color:#9ca3af; word-break:break-all; margin:0;">{cta_url}</p>
                <hr style="border:none; border-top:1px solid #e5e7eb; margin:24px 0;" />
                <p style="font-size:12px; color:#9ca3af; margin:0;">{footer_note}</p>
              </td>
            </tr>
          </table>
          <p style="font-size:11px; color:#9ca3af; margin:16px 0 0 0;">&copy; {BRAND_NAME}. This is an automated message, please don't reply.</p>
        </td>
      </tr>
    </table>
  </body>
</html>"""


def get_verification_template(user_name: str, raw_token: str) -> str:
    public_site_url = getattr(settings, "PUBLIC_SITE_URL", None) or getattr(settings, "FRONTEND_URL", "")
    verification_url = f"{public_site_url}/verify-email?token={raw_token}"
    body = f"""<p style="margin:0 0 24px 0; color:#4b5563;">
        Before you can begin setting up your new blog workspace, please verify your email address.
    </p>"""
    return _base_email(
        preheader=f"Verify your email to finish setting up your {BRAND_NAME} workspace.",
        heading=f"Welcome, {user_name}!",
        body_html=body,
        cta_label="Verify Email Address",
        cta_url=verification_url,
        cta_color="#2563eb",
        footer_note="This verification link will expire in 24 hours. If you did not create this account, you can safely ignore this message.",
    )


def get_password_reset_template(user_name: str, raw_token: str) -> str:
    admin_url = getattr(settings, "ADMIN_STUDIO_URL", None) or ""
    reset_url = f"{admin_url}/admin/reset-password?token={raw_token}"
    body = f"""<p style="margin:0 0 24px 0; color:#4b5563;">
        Hi {user_name}, we received a request to reset your account password.
    </p>"""
    return _base_email(
        preheader="Reset your password — this link expires in 24 hours.",
        heading="Password Reset Request",
        body_html=body,
        cta_label="Reset Password",
        cta_url=reset_url,
        cta_color="#dc2626",
        footer_note="If you did not request a password update, no action is required — your current credentials remain secure.",
    )

def get_verification_template_text(user_name: str, raw_token: str) -> str:
    public_site_url = getattr(settings, "PUBLIC_SITE_URL", None) or getattr(settings, "FRONTEND_URL", "")
    verification_url = f"{public_site_url}/verify-email?token={raw_token}"
    return (
        f"Welcome, {user_name}!\n\n"
        f"Before you can begin setting up your new blog workspace, please verify your email address:\n"
        f"{verification_url}\n\n"
        f"This link expires in 24 hours. If you did not create this account, you can safely ignore this message."
    )


def get_password_reset_template_text(user_name: str, raw_token: str) -> str:
    admin_url = getattr(settings, "ADMIN_STUDIO_URL", None) or ""
    reset_url = f"{admin_url}/admin/reset-password?token={raw_token}"
    return (
        f"Hi {user_name}, we received a request to reset your account password.\n\n"
        f"Reset it here: {reset_url}\n\n"
        f"This link expires in 24 hours. If you did not request this, no action is required."
    )

def get_email_verified_template(user_name: str) -> str:
    dashboard_url = getattr(settings, "ADMIN_STUDIO_URL", None) or ""
    body = f"""<p style="margin:0 0 24px 0; color:#4b5563;">
        Hi {user_name}, your email address has been successfully verified. You're all set to finish setting up your workspace.
    </p>"""
    return _base_email(
        preheader="Your email has been verified — you're ready to go.",
        heading="Email Verified!",
        body_html=body,
        cta_label="Go to Your Workspace",
        cta_url=dashboard_url,
        cta_color="#16a34a",
        footer_note="You're receiving this because your email was just verified on Inko.",
    )


def get_email_verified_template_text(user_name: str) -> str:
    dashboard_url = getattr(settings, "ADMIN_STUDIO_URL", None) or ""
    return (
        f"Hi {user_name},\n\n"
        f"Your email address has been successfully verified. You're all set to finish setting up your workspace:\n"
        f"{dashboard_url}\n"
    )


def get_password_changed_template(user_name: str) -> str:
    forgot_password_url = f"{getattr(settings, 'ADMIN_STUDIO_URL', '')}/admin/forgot-password"
    body = f"""<p style="margin:0 0 24px 0; color:#4b5563;">
        Hi {user_name}, this is a confirmation that your account password was just changed.
    </p>
    <p style="margin:0 0 24px 0; color:#4b5563;">
        If you made this change, no further action is needed.
    </p>"""
    return _base_email(
        preheader="Your password was just changed.",
        heading="Password Changed",
        body_html=body,
        cta_label="Reset Password Now",
        cta_url=forgot_password_url,
        cta_color="#dc2626",
        footer_note="If you did not make this change, reset your password immediately using the button above.",
    )


def get_password_changed_template_text(user_name: str) -> str:
    forgot_password_url = f"{getattr(settings, 'ADMIN_STUDIO_URL', '')}/admin/forgot-password"
    return (
        f"Hi {user_name},\n\n"
        f"This is a confirmation that your account password was just changed.\n\n"
        f"If you did not make this change, reset your password immediately:\n"
        f"{forgot_password_url}\n"
    )


def get_temporary_password_issued_template(user_name: str) -> str:
    login_url = getattr(settings, "ADMIN_STUDIO_URL", None) or ""
    body = f"""<p style="margin:0 0 24px 0; color:#4b5563;">
        Hi {user_name}, an administrator has issued a temporary password for your account. You'll be asked to set a new password the next time you log in.
    </p>"""
    return _base_email(
        preheader="A temporary password has been set on your account.",
        heading="Temporary Password Issued",
        body_html=body,
        cta_label="Go to Login",
        cta_url=login_url,
        cta_color="#7c3aed",
        footer_note="If you weren't expecting this, contact your workspace administrator or support immediately.",
    )


def get_temporary_password_issued_template_text(user_name: str) -> str:
    login_url = getattr(settings, "ADMIN_STUDIO_URL", None) or ""
    return (
        f"Hi {user_name},\n\n"
        f"An administrator has issued a temporary password for your account. You'll be asked to set a new password the next time you log in.\n\n"
        f"Log in here: {login_url}\n\n"
        f"If you weren't expecting this, contact your workspace administrator or support immediately."
    )


def get_account_deleted_template(user_name: str) -> str:
    support_email = getattr(settings, "SUPPORT_EMAIL", None) or settings.EMAILS_FROM_EMAIL
    body = f"""<p style="margin:0 0 24px 0; color:#4b5563;">
        Hi {user_name}, your account has been deleted.
    </p>
    <p style="margin:0 0 24px 0; color:#4b5563;">
        Your data will be permanently and irreversibly erased in <strong>30 days</strong>. If this wasn't you, or you'd like to recover your account before then, please contact us as soon as possible.
    </p>"""
    return _base_email(
        preheader="Your account has been deleted — 30 days to recover it.",
        heading="Account Deleted",
        body_html=body,
        cta_label="Contact Support",
        cta_url=f"mailto:{support_email}",
        cta_color="#dc2626",
        footer_note="If you deleted your account intentionally, no further action is needed — it will be permanently erased automatically after the 30-day window.",
    )


def get_account_deleted_template_text(user_name: str) -> str:
    support_email = getattr(settings, "SUPPORT_EMAIL", None) or settings.EMAILS_FROM_EMAIL
    return (
        f"Hi {user_name},\n\n"
        f"Your account has been deleted. Your data will be permanently and irreversibly erased in 30 days.\n\n"
        f"If this wasn't you, or you'd like to recover your account before then, contact us immediately: {support_email}\n\n"
        f"If you deleted your account intentionally, no further action is needed."
    )


def get_account_permanently_deleted_template(user_name: str) -> str:
    body = f"""<p style="margin:0 0 24px 0; color:#4b5563;">
        Hi {user_name}, this confirms that your account and all associated data have been permanently deleted, as scheduled 30 days ago.
    </p>
    <p style="margin:0 0 24px 0; color:#4b5563;">
        This action cannot be undone.
    </p>"""
    return _base_email(
        preheader="Your account has been permanently deleted.",
        heading="Account Permanently Deleted",
        body_html=body,
        cta_label="Visit Inko",
        cta_url=getattr(settings, "PUBLIC_SITE_URL", None) or "",
        cta_color="#6b7280",
        footer_note="Thank you for having used Inko. If you'd like to use our service again in the future, you're welcome to create a new account anytime.",
    )


def get_account_permanently_deleted_template_text(user_name: str) -> str:
    return (
        f"Hi {user_name},\n\n"
        f"This confirms that your account and all associated data have been permanently deleted, as scheduled 30 days ago.\n\n"
        f"This action cannot be undone.\n\n"
        f"Thank you for having used Inko."
    )


def get_new_support_ticket_admin_template(admin_name: str, requester_email: str, subject: str, message_preview: str) -> str:
    dashboard_url = f"{getattr(settings, 'ADMIN_STUDIO_URL', '')}/admin/superadmin/support"
    preview = (message_preview[:200] + "…") if len(message_preview) > 200 else message_preview
    body = f"""<p style="margin:0 0 16px 0; color:#4b5563;">
        Hi {admin_name}, a new support ticket was submitted by <strong>{requester_email}</strong>:
    </p>
    <p style="margin:0 0 8px 0; color:#111827; font-weight:600;">{subject}</p>
    <p style="margin:0 0 24px 0; color:#6b7280; font-style:italic;">"{preview}"</p>"""
    return _base_email(
        preheader=f"New support ticket: {subject}",
        heading="New Support Ticket",
        body_html=body,
        cta_label="View Ticket",
        cta_url=dashboard_url,
        cta_color="#7c3aed",
        footer_note="You're receiving this because you're a platform administrator on Inko.",
    )


def get_new_support_ticket_admin_template_text(admin_name: str, requester_email: str, subject: str, message_preview: str) -> str:
    dashboard_url = f"{getattr(settings, 'ADMIN_STUDIO_URL', '')}/admin/superadmin/support"
    return (
        f"Hi {admin_name},\n\n"
        f"A new support ticket was submitted by {requester_email}:\n\n"
        f"{subject}\n\"{message_preview}\"\n\n"
        f"View it here: {dashboard_url}"
    )


def get_blog_invitation_template(inviter_name: str, blog_name: str, role: str, invite_url: str) -> str:
    body = f"""<p style="margin:0 0 24px 0; color:#4b5563;">
        {inviter_name} has invited you to join <strong>{blog_name}</strong> on {BRAND_NAME} as a{'n' if role.lower().startswith(('a', 'e', 'i', 'o', 'u')) else ''} <strong>{role}</strong>.
    </p>"""
    return _base_email(
        preheader=f"{inviter_name} invited you to join {blog_name} on {BRAND_NAME}.",
        heading="You've been invited!",
        body_html=body,
        cta_label="Accept Invitation",
        cta_url=invite_url,
        cta_color="#7c3aed",
        footer_note="This invitation expires in 7 days. If you weren't expecting this, you can safely ignore this email.",
    )


def get_blog_invitation_template_text(inviter_name: str, blog_name: str, role: str, invite_url: str) -> str:
    return (
        f"{inviter_name} has invited you to join {blog_name} on {BRAND_NAME} as a {role}.\n\n"
        f"Accept the invitation here:\n{invite_url}\n\n"
        f"This invitation expires in 7 days. If you weren't expecting this, you can safely ignore this email."
    )


def get_contact_message_template(
    recipient_label: str,
    sender_name: str,
    sender_email: str,
    subject: str,
    message: str,
    company: str = None,
) -> str:
    company_line = f'<p style="margin:0 0 8px 0; color:#6b7280;">Company: {company}</p>' if company else ""
    body = f"""<p style="margin:0 0 16px 0; color:#4b5563;">
        New message from <strong>{sender_name}</strong> ({sender_email}) via the {recipient_label} contact form:
    </p>
    {company_line}
    <p style="margin:0 0 8px 0; color:#111827; font-weight:600;">{subject}</p>
    <p style="margin:0 0 24px 0; color:#374151; white-space:pre-line;">{message}</p>"""
    return _base_email(
        preheader=f"New contact message: {subject}",
        heading="New Contact Message",
        body_html=body,
        cta_label="Reply by Email",
        cta_url=f"mailto:{sender_email}",
        cta_color="#7c3aed",
        footer_note=f"You're receiving this because you're listed as the contact recipient for {recipient_label}.",
    )


def get_contact_message_template_text(
    recipient_label: str,
    sender_name: str,
    sender_email: str,
    subject: str,
    message: str,
    company: str = None,
) -> str:
    company_line = f"Company: {company}\n" if company else ""
    return (
        f"New message from {sender_name} ({sender_email}) via the {recipient_label} contact form:\n\n"
        f"{company_line}"
        f"{subject}\n\n{message}\n\n"
        f"Reply to: {sender_email}"
    )