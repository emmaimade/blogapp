from fastapi import Request
from jose import JWTError, jwt
from sqlmodel import Session, select
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.audit import add_audit_log
from app.core.config import ALGORITHM, SECRET_KEY
from app.core.db import engine
from app.core.security import extract_bearer_token
from app.models import User


class AuditLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        if request.method in {"POST", "PATCH", "PUT", "DELETE"}:
            self._record_request_action(request, response.status_code)

        return response

    def _record_request_action(self, request: Request, status_code: int) -> None:
        if getattr(request.state, "audit_logged", False):
            # A router already wrote a specific, correctly-scoped audit log
            # for this request — skip the generic http.* fallback.
            return

        try:
            with Session(engine) as session:
                actor = self._get_actor(request, session)
                add_audit_log(
                    session,
                    action=f"http.{request.method.lower()}",
                    resource_type="http_request",
                    actor=actor,
                    details={
                        "path": request.url.path,
                        "status_code": status_code,
                    },
                    request=request,
                )
                session.commit()
        except Exception:
            # Audit logging should never make the primary request fail.
            return

    def _get_actor(self, request: Request, session: Session) -> User | None:
        token = extract_bearer_token(request)
        if not token:
            return None

        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            username = payload.get("sub")
        except JWTError:
            return None

        if not username:
            return None

        return session.exec(select(User).where(User.username == username)).first()
