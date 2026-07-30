from datetime import datetime

from pydantic import BaseModel, EmailStr, ConfigDict, Field

from app.models.models import Role, TaskStatus


class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: Role


class UserCreate(UserBase):
    password: str = Field(min_length=8)


class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    is_active: bool


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TaskDefinitionIn(BaseModel):
    title: str
    description: str | None = None
    assigned_role: Role
    due_offset_days: int = 0
    order: int = 0


class TaskDefinitionOut(TaskDefinitionIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


class TemplateCreate(BaseModel):
    name: str
    department: str | None = None
    task_definitions: list[TaskDefinitionIn] = []


class TemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    department: str | None
    task_definitions: list[TaskDefinitionOut] = []


class EmployeeCreate(BaseModel):
    full_name: str
    email: EmailStr
    job_title: str | None = None
    department: str | None = None
    start_date: datetime
    template_id: int | None = None
    manager_id: int | None = None


class EmployeeUpdate(BaseModel):
    full_name: str | None = None
    job_title: str | None = None
    department: str | None = None
    start_date: datetime | None = None
    manager_id: int | None = None


class UserUpdate(BaseModel):
    is_active: bool | None = None
    role: Role | None = None


class OnboardingTaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    description: str | None
    assigned_role: Role
    status: TaskStatus
    due_date: datetime | None
    completed_at: datetime | None
    order: int


class TaskStatusUpdate(BaseModel):
    status: TaskStatus


class EmployeeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    full_name: str
    email: EmailStr
    job_title: str | None
    department: str | None
    start_date: datetime
    manager_id: int | None
    tasks: list[OnboardingTaskOut] = []


class EmployeeProgress(BaseModel):
    employee_id: int
    full_name: str
    total_tasks: int
    completed_tasks: int
    percent_complete: float


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    employee_id: int
    name: str
    signed: bool
    uploaded_at: datetime


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    message: str
    read: bool
    created_at: datetime
