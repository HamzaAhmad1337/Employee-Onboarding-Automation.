import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.models import Document, Employee, Role, User
from app.routers.employees import _assert_can_view_employee, _get_employee_or_404
from app.schemas.schemas import DocumentOut

router = APIRouter(prefix="/employees/{employee_id}/documents", tags=["documents"])

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".docx"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


@router.post("", response_model=DocumentOut, status_code=201)
async def upload_document(
    employee_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    employee = _get_employee_or_404(db, employee_id)
    _assert_can_view_employee(employee, current_user)

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type '{ext}' is not allowed")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File exceeds 10MB limit")

    safe_name = f"{uuid.uuid4().hex}{ext}"
    dest_path = os.path.join(UPLOAD_DIR, safe_name)
    with open(dest_path, "wb") as f:
        f.write(contents)

    doc = Document(
        employee_id=employee.id,
        name=file.filename,
        file_path=dest_path,
        uploaded_by_id=current_user.id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.get("", response_model=list[DocumentOut])
def list_documents(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    employee = _get_employee_or_404(db, employee_id)
    _assert_can_view_employee(employee, current_user)
    return db.query(Document).filter(Document.employee_id == employee_id).all()


@router.get("/{document_id}/download")
def download_document(
    employee_id: int,
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    employee = _get_employee_or_404(db, employee_id)
    _assert_can_view_employee(employee, current_user)

    doc = (
        db.query(Document)
        .filter(Document.id == document_id, Document.employee_id == employee_id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not os.path.isfile(doc.file_path):
        raise HTTPException(status_code=404, detail="File is missing from storage")

    return FileResponse(doc.file_path, filename=doc.name)
