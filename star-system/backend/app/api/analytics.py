from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select
import csv, io, json
from datetime import datetime
from app.core.database import get_session
from app.models.models import Teacher, TrainingRecord, STAR_MODULES
from app.services.gap_score import compute_all_regions, compute_region_gap

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/summary")
def get_summary(session: Session = Depends(get_session)):
    total   = session.exec(select(Teacher)).all()
    trained_ids = set(
        r.teacher_id for r in session.exec(select(TrainingRecord)).all() if r.teacher_id
    )
    trained = [t for t in total if t.id in trained_ids]
    gap_scores = compute_all_regions(session)
    return {
        "total_teachers":        len(total),
        "trained_teachers":      len(trained),
        "untrained_teachers":    len(total) - len(trained),
        "training_coverage_pct": round(len(trained) / len(total) * 100, 1) if total else 0,
        "regions_with_data":     len(set(t.region for t in total)),
        "high_gap_regions":      sum(1 for g in gap_scores if g["gap_level"] == "high"),
        "total_training_records": len(session.exec(select(TrainingRecord)).all()),
        "star_modules":          STAR_MODULES,
    }


@router.get("/regions")
def get_regions(session: Session = Depends(get_session)):
    return compute_all_regions(session)


@router.get("/regions/{region}")
def get_region_detail(region: str, session: Session = Depends(get_session)):
    gap = compute_region_gap(region, session)
    teachers = session.exec(select(Teacher).where(Teacher.region == region)).all()

    subject_counts: dict = {}
    for t in teachers:
        for s in json.loads(t.subject_specializations or "[]"):
            subject_counts[s] = subject_counts.get(s, 0) + 1

    module_counts: dict = {}
    for t in teachers:
        for tr in session.exec(
            select(TrainingRecord).where(TrainingRecord.teacher_id == t.id)
        ).all():
            module_counts[tr.module_name] = module_counts.get(tr.module_name, 0) + 1

    return {**gap, "subject_breakdown": subject_counts, "module_uptake": module_counts}


@router.get("/export/csv")
def export_csv(region: str = None, session: Session = Depends(get_session)):
    q = select(Teacher)
    if region:
        q = q.where(Teacher.region == region)
    teachers = session.exec(q).all()
    trained_ids = set(
        r.teacher_id for r in session.exec(select(TrainingRecord)).all() if r.teacher_id
    )
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Full Name", "Region", "Division", "School",
        "Position", "Years Experience", "Highest Qualification",
        "Subject Specializations", "Is Trained", "Source", "Data Confidence",
    ])
    for t in teachers:
        specs = ", ".join(json.loads(t.subject_specializations or "[]"))
        writer.writerow([
            t.id, t.full_name, t.region, t.division or "", t.school_name or "",
            t.position or "", t.years_experience or "", t.highest_qualification or "",
            specs, t.id in trained_ids, t.source, t.data_confidence,
        ])
    output.seek(0)
    filename = f"star_teachers_{region or 'all'}_{datetime.utcnow().strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )