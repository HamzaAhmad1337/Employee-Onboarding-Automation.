from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.core.security import create_access_token, hash_password, verify_password
from app.models.models import Role, User
from app.schemas.schemas import LoginRequest, Token, UserCreate, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    # First user in the system may self-register as hr_admin (bootstrap).
    # All subsequent registrations require an existing hr_admin to create the account.
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    any_user_exists = db.query(User).first() is not None
    if any_user_exists and payload.role == Role.HR_ADMIN:
        raise HTTPException(
            status_code=403,
            detail="hr_admin accounts must be created by an existing hr_admin",
        )

    user = User(
        email=payload.email,
        full_name=payload.full_name,
        role=payload.role,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")
    token = create_access_token(subject=user.email, role=user.role.value)
    return Token(access_token=token, user=user)


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user_as_admin(
    payload: UserCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_roles(Role.HR_ADMIN)),
):
    """HR admins create accounts for managers, IT staff, and new hires."""
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=payload.email,
        full_name=payload.full_name,
        role=payload.role,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
