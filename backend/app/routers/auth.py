from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.core.security import create_access_token, hash_password, verify_password
from app.models.models import Employee, Role, User
from app.schemas.schemas import LoginRequest, Token, UserCreate, UserOut, UserUpdate

router = APIRouter(prefix="/auth", tags=["auth"])

MAX_FAILED_LOGIN_ATTEMPTS = 5
LOCKOUT_MINUTES = 15


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    """Bootstrap-only: creates the very first hr_admin account. Once any account
    exists, self-registration is closed entirely — every other account (manager,
    it, new_hire, or additional hr_admins) must be created by an existing
    hr_admin via POST /auth/users, which requires an authenticated bearer token.
    Open self-registration for arbitrary roles would let anyone grant themselves
    the "it" role and read every employee's onboarding data.
    """
    if db.query(User).first() is not None:
        raise HTTPException(
            status_code=403,
            detail="Registration is closed. Ask an hr_admin to create your account.",
        )

    user = User(
        email=payload.email,
        full_name=payload.full_name,
        role=Role.HR_ADMIN,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()

    # Run the hash even on a missing user so response timing doesn't reveal
    # whether the email exists (hash_password/verify_password cost is what
    # makes login brute-forceable slow in the first place).
    if user is None:
        verify_password(payload.password, hash_password("dummy-password"))
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    if user.locked_until is not None and user.locked_until > datetime.utcnow():
        raise HTTPException(
            status_code=403,
            detail=f"Account temporarily locked due to repeated failed logins. "
            f"Try again after {user.locked_until.isoformat()}Z.",
        )

    if not verify_password(payload.password, user.hashed_password):
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= MAX_FAILED_LOGIN_ATTEMPTS:
            user.locked_until = datetime.utcnow() + timedelta(minutes=LOCKOUT_MINUTES)
            user.failed_login_attempts = 0
        db.commit()
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")

    user.failed_login_attempts = 0
    user.locked_until = None
    db.commit()

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
    """HR admins create accounts for managers, IT staff, and new hires.

    When the new account is a new_hire, it is auto-linked to the Employee
    onboarding record with the matching email (if one exists), so the new
    hire can actually see their own tasks and progress after logging in.
    """
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
    db.flush()

    if payload.role == Role.NEW_HIRE:
        employee = db.query(Employee).filter(Employee.email == payload.email).first()
        if employee is not None:
            employee.user_id = user.id

    db.commit()
    db.refresh(user)
    return user


@router.get("/users", response_model=list[UserOut])
def list_users(
    role: Role | None = None,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_roles(Role.HR_ADMIN)),
):
    """Used by HR to populate role pickers (e.g. choosing a manager for a new hire)."""
    query = db.query(User)
    if role is not None:
        query = query.filter(User.role == role)
    return query.all()


@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles(Role.HR_ADMIN)),
):
    """Deactivate/reactivate an account or change its role (offboarding, role
    changes). An hr_admin cannot deactivate or demote their own account -
    otherwise the last admin could lock themselves out with no way back in.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == admin.id:
        if payload.is_active is False:
            raise HTTPException(status_code=400, detail="You cannot deactivate your own account")
        if payload.role is not None and payload.role != Role.HR_ADMIN:
            raise HTTPException(status_code=400, detail="You cannot demote your own account")

    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.role is not None:
        user.role = payload.role

    db.commit()
    db.refresh(user)
    return user
