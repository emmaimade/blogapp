from fastapi import Request
from jose import JWTError, jwt
from sqlmodel import Session, select
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.audit import add_audit_log
from app.core.config import ALGORITHM, SECRET_KEY
from app.core.db import engine
from app.models import User


class AuditLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        if request.method in {"POST", "PATCH", "PUT", "DELETE"}:
            self._record_request_action(request, response.status_code)

        return response

    def _record_request_action(self, request: Request, status_code: int) -> None:
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
        auth_header = request.headers.get("authorization", "")
        if not auth_header.lower().startswith("bearer "):
            return None

        token = auth_header.split(" ", 1)[1].strip()
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            username = payload.get("sub")
        except JWTError:
            return None

        if not username:
            return None

        return session.exec(select(User).where(User.username == username)).first()
