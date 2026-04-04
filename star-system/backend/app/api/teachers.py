from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from typing import Optional
import json
from datetime import datetime
from app.core.database import get_session
from app.models.models import Teacher, TeacherCreate, TrainingRecord

router = APIRouter(prefix="/teachers", tags=["teachers"])


def _parse_list(val):
    if not val:
        return []
    try:
        return json.loads(val)
    except Exception:
        return [val]


@router.get("")
def list_teachers(
    region:  Optional[str]  = Query(None),
    subject: Optional[str]  = Query(None),
    trained: Optional[bool] = Query(None),
    limit:   int            = Query(100, le=500),
    offset:  int            = 0,
    session: Session        = Depends(get_session),
):
    q = select(Teacher)
    if region:
        q = q.where(Teacher.region == region)
    teachers = session.exec(q.offset(offset).limit(limit)).all()

    trained_ids = set(
        r.teacher_id for r in session.exec(select(TrainingRecord)).all() if r.teacher_id
    )

    result = []
    for t in teachers:
        specs = _parse_list(t.subject_specializations)
        if subject and subject not in specs:
            continue
        is_trained = t.id in trained_ids
        if trained is not None and is_trained != trained:
            continue
        training_count = sum(
            1 for r in session.exec(
                select(TrainingRecord).where(TrainingRecord.teacher_id == t.id)
            ).all()
        )
        result.append({
            **t.dict(),
            "subject_specializations":  specs,
            "grade_levels_taught":      _parse_list(t.grade_levels_taught),
            "low_confidence_subjects":  _parse_list(t.low_confidence_subjects),
            "unapplied_modules":        _parse_list(t.unapplied_modules),
            "is_trained":               is_trained,
            "training_count":           training_count,
        })
    return result


@router.get("/{teacher_id}")
def get_teacher(teacher_id: str, session: Session = Depends(get_session)):
    teacher = session.get(Teacher, teacher_id)
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    trainings = session.exec(
        select(TrainingRecord).where(TrainingRecord.teacher_id == teacher_id)
    ).all()
    return {
        **teacher.dict(),
        "subject_specializations": _parse_list(teacher.subject_specializations),
        "grade_levels_taught":     _parse_list(teacher.grade_levels_taught),
        "low_confidence_subjects": _parse_list(teacher.low_confidence_subjects),
        "unapplied_modules":       _parse_list(teacher.unapplied_modules),
        "trainings":               [t.dict() for t in trainings],
    }


@router.post("", status_code=201)
def register_teacher(payload: TeacherCreate, session: Session = Depends(get_session)):
    now = datetime.utcnow()
    teacher = Teacher(
        full_name=payload.full_name,
        region=payload.region,
        division=payload.division,
        school_name=payload.school_name,
        school_type=payload.school_type,
        position=payload.position,
        years_experience=payload.years_experience,
        highest_qualification=payload.highest_qualification,
        subject_specializations=json.dumps(payload.subject_specializations or []),
        grade_levels_taught=json.dumps(payload.grade_levels_taught or []),
        low_confidence_subjects=json.dumps(payload.low_confidence_subjects or []),
        unapplied_modules=json.dumps(payload.unapplied_modules or []),
        distance_to_training=payload.distance_to_training,
        preferred_format=payload.preferred_format,
        source="self-registry",
        data_confidence=1.0,
        created_at=now,
        updated_at=now,
    )
    session.add(teacher)
    session.flush()
    for module_name in (payload.trainings_attended or []):
        session.add(TrainingRecord(
            teacher_id=teacher.id,
            module_name=module_name,
            source="self-registry",
            data_confidence=1.0,
        ))
    session.commit()
    session.refresh(teacher)
    return {"id": teacher.id, "full_name": teacher.full_name, "region": teacher.region}