from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlmodel import Session, select
from app.core.database import get_session
from app.models.models import ImportLog
from app.services.importer import import_sf7, import_star_log

router = APIRouter(prefix="/import", tags=["import"])


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    source_type: str = Form(...),
    session: Session = Depends(get_session),
):
    if source_type not in ("sf7", "star-log"):
        raise HTTPException(400, "source_type must be 'sf7' or 'star-log'")
    if not any(file.filename.endswith(e) for e in (".csv", ".xlsx", ".xls")):
        raise HTTPException(400, "Only CSV or Excel files are accepted")

    contents = await file.read()
    log = import_sf7(contents, file.filename, session) \
          if source_type == "sf7" \
          else import_star_log(contents, file.filename, session)

    return {
        "filename":      log.filename,
        "source_type":   log.source_type,
        "rows_parsed":   log.rows_parsed,
        "rows_imported": log.rows_imported,
        "rows_flagged":  log.rows_flagged,
    }


@router.get("/logs")
def get_import_logs(session: Session = Depends(get_session)):
    logs = session.exec(select(ImportLog).order_by(ImportLog.created_at.desc())).all()
    return [l.dict() for l in logs]