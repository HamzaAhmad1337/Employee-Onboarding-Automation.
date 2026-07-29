from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.models import (
    Employee,
    Notification,
    OnboardingTask,
    OnboardingTemplate,
    Role,
    TaskStatus,
    User,
)
from app.schemas.schemas import EmployeeCreate, EmployeeOut, EmployeeProgress, TaskStatusUpdate

router = APIRouter(prefix="/employees", tags=["employees"])


def _notify(db: Session, user_id: int | None, message: str):
    if user_id is None:
        return
    db.add(Notification(user_id=user_id, message=message))


@router.post("", response_model=EmployeeOut, status_code=201)
def create_employee(
    payload: EmployeeCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles(Role.HR_ADMIN)),
):
    if db.query(Employee).filter(Employee.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Employee with this email already exists")

    if payload.manager_id is not None:
        manager = db.query(User).filter(User.id == payload.manager_id, User.role == Role.MANAGER).first()
        if not manager:
            raise HTTPException(status_code=400, detail="manager_id does not reference a manager")

    linked_user = (
        db.query(User).filter(User.email == payload.email, User.role == Role.NEW_HIRE).first()
    )

    employee = Employee(
        full_name=payload.full_name,
        email=payload.email,
        job_title=payload.job_title,
        department=payload.department,
        start_date=payload.start_date,
        manager_id=payload.manager_id,
        template_id=payload.template_id,
        user_id=linked_user.id if linked_user else None,
    )
    db.add(employee)
    db.flush()

    if payload.template_id is not None:
        template = (
            db.query(OnboardingTemplate)
            .options(joinedload(OnboardingTemplate.task_definitions))
            .filter(OnboardingTemplate.id == payload.template_id)
            .first()
        )
        if not template:
            raise HTTPException(status_code=400, detail="Template not found")
        for td in template.task_definitions:
            db.add(
                OnboardingTask(
                    employee_id=employee.id,
                    title=td.title,
                    description=td.description,
                    assigned_role=td.assigned_role,
                    due_date=payload.start_date + timedelta(days=td.due_offset_days),
                    order=td.order,
                )
            )

    _notify(db, payload.manager_id, f"New hire {employee.full_name} added to your team.")
    db.commit()
    db.refresh(employee)
    return employee


@router.get("", response_model=list[EmployeeOut])
def list_employees(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Employee).options(joinedload(Employee.tasks))
    if current_user.role == Role.HR_ADMIN:
        return query.all()
    if current_user.role == Role.MANAGER:
        return query.filter(Employee.manager_id == current_user.id).all()
    if current_user.role == Role.IT:
        # IT sees any employee that has at least one task assigned to IT
        return (
            query.join(OnboardingTask)
            .filter(OnboardingTask.assigned_role == Role.IT)
            .distinct()
            .all()
        )
    # new_hire: only their own record
    return query.filter(Employee.user_id == current_user.id).all()


def _get_employee_or_404(db: Session, employee_id: int) -> Employee:
    employee = (
        db.query(Employee)
        .options(joinedload(Employee.tasks))
        .filter(Employee.id == employee_id)
        .first()
    )
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return employee


def _assert_can_view_employee(employee: Employee, user: User):
    if user.role == Role.HR_ADMIN:
        return
    if user.role == Role.MANAGER and employee.manager_id == user.id:
        return
    if user.role == Role.IT and any(t.assigned_role == Role.IT for t in employee.tasks):
        return
    if user.role == Role.NEW_HIRE and employee.user_id == user.id:
        return
    raise HTTPException(status_code=403, detail="Not authorized to view this employee")


@router.get("/{employee_id}", response_model=EmployeeOut)
def get_employee(
    employee_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    employee = _get_employee_or_404(db, employee_id)
    _assert_can_view_employee(employee, current_user)
    return employee


@router.get("/{employee_id}/progress", response_model=EmployeeProgress)
def get_progress(
    employee_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    employee = _get_employee_or_404(db, employee_id)
    _assert_can_view_employee(employee, current_user)
    total = len(employee.tasks)
    completed = sum(1 for t in employee.tasks if t.status == TaskStatus.DONE)
    percent = (completed / total * 100) if total else 0.0
    return EmployeeProgress(
        employee_id=employee.id,
        full_name=employee.full_name,
        total_tasks=total,
        completed_tasks=completed,
        percent_complete=round(percent, 1),
    )


@router.patch("/{employee_id}/tasks/{task_id}", response_model=EmployeeOut)
def update_task_status(
    employee_id: int,
    task_id: int,
    payload: TaskStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    employee = _get_employee_or_404(db, employee_id)
    _assert_can_view_employee(employee, current_user)

    task = next((t for t in employee.tasks if t.id == task_id), None)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if current_user.role not in (Role.HR_ADMIN,) and current_user.role != task.assigned_role:
        raise HTTPException(
            status_code=403, detail="Only the assigned role (or HR admin) can update this task"
        )

    task.status = payload.status
    task.completed_at = datetime.now(timezone.utc) if payload.status == TaskStatus.DONE else None

    if payload.status == TaskStatus.DONE and employee.manager_id:
        _notify(db, employee.manager_id, f"Task '{task.title}' completed for {employee.full_name}.")

    db.commit()
    db.refresh(employee)
    return employee
