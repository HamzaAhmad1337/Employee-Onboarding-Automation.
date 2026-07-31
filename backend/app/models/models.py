import enum
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class Role(str, enum.Enum):
    HR_ADMIN = "hr_admin"
    MANAGER = "manager"
    IT = "it"
    NEW_HIRE = "new_hire"


class TaskStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    BLOCKED = "blocked"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(Role), nullable=False, default=Role.NEW_HIRE)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)
    failed_login_attempts = Column(Integer, nullable=False, default=0)
    locked_until = Column(DateTime, nullable=True)

    employee_profile = relationship(
        "Employee", back_populates="user", uselist=False, foreign_keys="Employee.user_id"
    )


class OnboardingTemplate(Base):
    __tablename__ = "onboarding_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    department = Column(String, nullable=True)
    created_at = Column(DateTime, default=utcnow)

    task_definitions = relationship(
        "TaskDefinition", back_populates="template", cascade="all, delete-orphan"
    )


class TaskDefinition(Base):
    """A reusable task blueprint inside a template (e.g. 'Provision laptop', role=IT)."""

    __tablename__ = "task_definitions"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("onboarding_templates.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    assigned_role = Column(Enum(Role), nullable=False)
    due_offset_days = Column(Integer, default=0)  # days from onboarding start date
    order = Column(Integer, default=0)

    template = relationship("OnboardingTemplate", back_populates="task_definitions")


class Employee(Base):
    """The onboarding record for a new hire, distinct from their User login."""

    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=True)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    template_id = Column(Integer, ForeignKey("onboarding_templates.id"), nullable=True)
    full_name = Column(String, nullable=False)
    email = Column(String, nullable=False, unique=True)
    job_title = Column(String, nullable=True)
    department = Column(String, nullable=True)
    start_date = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=utcnow)

    user = relationship("User", back_populates="employee_profile", foreign_keys=[user_id])
    manager = relationship("User", foreign_keys=[manager_id])
    tasks = relationship("OnboardingTask", back_populates="employee", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="employee", cascade="all, delete-orphan")


class OnboardingTask(Base):
    """A concrete task instance assigned to an employee's onboarding, derived from a TaskDefinition."""

    __tablename__ = "onboarding_tasks"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    assigned_role = Column(Enum(Role), nullable=False)
    status = Column(Enum(TaskStatus), default=TaskStatus.PENDING, nullable=False)
    due_date = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    order = Column(Integer, default=0)

    employee = relationship("Employee", back_populates="tasks")

    @property
    def is_overdue(self) -> bool:
        if self.due_date is None or self.status == TaskStatus.DONE:
            return False
        # due_date round-trips through SQLite as a naive UTC datetime, so
        # compare against naive UTC "now" rather than an aware datetime -
        # mixing the two raises TypeError.
        return self.due_date < datetime.now(timezone.utc).replace(tzinfo=None)


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    signed = Column(Boolean, default=False)
    uploaded_at = Column(DateTime, default=utcnow)

    employee = relationship("Employee", back_populates="documents")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message = Column(String, nullable=False)
    read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow)
