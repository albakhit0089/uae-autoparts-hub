import hashlib
import secrets
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_db
from .models import Supplier, User

bearer = HTTPBearer(auto_error=False)


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except ValueError:
        return False


def create_token(user: User) -> str:
    s = get_settings()
    now = datetime.now(timezone.utc)
    payload = {"sub": user.id, "role": user.role, "iat": now, "exp": now + timedelta(minutes=s.jwt_ttl_minutes)}
    return jwt.encode(payload, s.jwt_secret, algorithm="HS256")


def hash_api_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


def new_api_key() -> str:
    return "uaeph_" + secrets.token_urlsafe(32)


def optional_user(creds: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)) -> User | None:
    if not creds:
        return None
    try:
        payload = jwt.decode(creds.credentials, get_settings().jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired, please log in again")
    user = db.get(User, payload.get("sub"))
    if not user or user.deleted_at:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account not found")
    return user


def current_user(user: User | None = Depends(optional_user)) -> User:
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Please log in first")
    return user


def require_role(*roles: str):
    def dep(user: User = Depends(current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have permission for this action")
        return user

    return dep


def current_supplier(user: User = Depends(require_role("supplier")), db: Session = Depends(get_db)) -> Supplier:
    sup = db.query(Supplier).filter(Supplier.owner_id == user.id).first()
    if not sup:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Supplier profile not found")
    if sup.status == "suspended":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This supplier account is suspended")
    return sup


def supplier_from_api_key(request: Request, db: Session = Depends(get_db)) -> Supplier:
    key = request.headers.get("x-api-key")
    if not key:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing X-API-Key header")
    sup = db.query(Supplier).filter(Supplier.api_key_hash == hash_api_key(key)).first()
    if not sup or sup.status != "approved":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid API key or supplier not approved")
    return sup


class RateLimiter:
    """In-process sliding-window limiter keyed by client IP + path group.

    Suitable for a single instance; use Redis (or the hosting provider's edge
    rate limiting) when running multiple replicas.
    """

    def __init__(self) -> None:
        self.hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str, limit: int, window: float = 60.0) -> bool:
        now = time.monotonic()
        q = self.hits[key]
        while q and now - q[0] > window:
            q.popleft()
        if len(q) >= limit:
            return False
        q.append(now)
        return True


limiter = RateLimiter()


def rate_limit(group: str, limit: int):
    def dep(request: Request) -> None:
        ip = request.client.host if request.client else "unknown"
        if not limiter.check(f"{group}:{ip}", limit):
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many requests, please slow down")

    return dep


def ip_hash(request: Request) -> str:
    ip = request.client.host if request.client else "unknown"
    return hashlib.sha256(f"{get_settings().jwt_secret}:{ip}".encode()).hexdigest()[:24]
