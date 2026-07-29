from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import require_roles
from app.models.models import OnboardingTemplate, Role, TaskDefinition, User
from app.schemas.schemas import TemplateCreate, TemplateOut

router = APIRouter(prefix="/templates", tags=["templates"])


@router.post("", response_model=TemplateOut, status_code=201)
def create_template(
    payload: TemplateCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_roles(Role.HR_ADMIN)),
):
    template = OnboardingTemplate(name=payload.name, department=payload.department)
    db.add(template)
    db.flush()

    for td in payload.task_definitions:
        db.add(TaskDefinition(template_id=template.id, **td.model_dump()))

    db.commit()
    db.refresh(template)
    return template


@router.get("", response_model=list[TemplateOut])
def list_templates(
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles(Role.HR_ADMIN, Role.MANAGER)),
):
    return (
        db.query(OnboardingTemplate)
        .options(joinedload(OnboardingTemplate.task_definitions))
        .all()
    )


@router.get("/{template_id}", response_model=TemplateOut)
def get_template(
    template_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles(Role.HR_ADMIN, Role.MANAGER)),
):
    template = (
        db.query(OnboardingTemplate)
        .options(joinedload(OnboardingTemplate.task_definitions))
        .filter(OnboardingTemplate.id == template_id)
        .first()
    )
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.delete("/{template_id}", status_code=204)
def delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_roles(Role.HR_ADMIN)),
):
    template = db.query(OnboardingTemplate).filter(OnboardingTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    db.delete(template)
    db.commit()
