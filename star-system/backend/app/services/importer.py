from __future__ import annotations
import json, io
from datetime import datetime
from typing import Any
import pandas as pd
from rapidfuzz import fuzz
from sqlmodel import Session, select
from app.models.models import (
    Teacher, TrainingRecord, ImportLog,
    normalize_region, normalize_subject, STAR_MODULES,
)

SF7_COLUMN_MAP = {
    "name":                    ["teacher name", "name", "full name", "teacher"],
    "region":                  ["region", "region name"],
    "division":                ["division", "division name", "sdo"],
    "school_name":             ["school", "school name", "school/center"],
    "position":                ["position", "designation", "item"],
    "subject_specializations": ["subject", "subject area", "specialization", "subjects taught"],
    "grade_levels_taught":     ["grade level", "grade", "year level"],
    "school_type":             ["type", "school type", "classification"],
    "training_attended":       ["inset", "tpd", "training", "star training"],
}

STAR_LOG_COLUMN_MAP = {
    "name":               ["participant name", "name", "attendee", "full name"],
    "region":             ["region", "region name"],
    "partner_university": ["university", "partner university", "tei", "venue"],
    "module_name":        ["module", "module name", "training", "program"],
    "year":               ["year", "date", "sy", "school year"],
    "school_name":        ["school", "school name"],
    "division":           ["division", "sdo"],
}


def _find_column(df: pd.DataFrame, candidates: list[str]) -> str | None:
    normalized = {c.lower().strip(): c for c in df.columns}
    for c in candidates:
        if c.lower() in normalized:
            return normalized[c.lower()]
    return None


def _safe(val: Any) -> str | None:
    if pd.isna(val) if not isinstance(val, str) else not val:
        return None
    return str(val).strip()


def _parse_year(val: Any) -> int | None:
    if val is None:
        return None
    for part in str(val).strip().replace("SY", "").split("-"):
        part = part.strip()
        if part.isdigit() and len(part) == 4:
            return int(part)
    return None


def _read_file(file_bytes: bytes, filename: str) -> pd.DataFrame:
    if filename.endswith(".csv"):
        return pd.read_csv(io.BytesIO(file_bytes), dtype=str, keep_default_na=False)
    return pd.read_excel(io.BytesIO(file_bytes), dtype=str, keep_default_na=False)


def _find_existing(name: str, region: str, session: Session) -> Teacher | None:
    candidates = session.exec(select(Teacher).where(Teacher.region == region)).all()
    best, best_score = None, 0
    for t in candidates:
        score = fuzz.token_sort_ratio(name.lower(), t.full_name.lower())
        if score > best_score:
            best_score, best = score, t
    return best if best_score >= 85 else None


def _match_module(raw: str) -> str | None:
    if not raw:
        return None
    best, best_score = None, 0
    for module in STAR_MODULES:
        score = fuzz.partial_ratio(raw.lower(), module.lower())
        if score > best_score:
            best_score, best = score, module
    return best if best_score >= 60 else None


def import_sf7(file_bytes: bytes, filename: str, session: Session) -> ImportLog:
    df = _read_file(file_bytes, filename)
    log = ImportLog(filename=filename, source_type="sf7",
                    rows_parsed=len(df), created_at=datetime.utcnow())
    imported, flagged = 0, 0

    for _, row in df.iterrows():
        name = _safe(row.get(_find_column(df, SF7_COLUMN_MAP["name"]) or ""))
        if not name:
            flagged += 1
            continue
        region_raw = _safe(row.get(_find_column(df, SF7_COLUMN_MAP["region"]) or "", ""))
        region  = normalize_region(region_raw or "")
        subj_raw = _safe(row.get(_find_column(df, SF7_COLUMN_MAP["subject_specializations"]) or "", ""))
        subjects = [normalize_subject(s.strip()) for s in (subj_raw or "").split(",") if s.strip()]

        teacher = _find_existing(name, region, session) or Teacher(created_at=datetime.utcnow())
        teacher.full_name  = name
        teacher.region     = region
        teacher.division   = _safe(row.get(_find_column(df, SF7_COLUMN_MAP["division"]) or "", ""))
        teacher.school_name = _safe(row.get(_find_column(df, SF7_COLUMN_MAP["school_name"]) or "", ""))
        teacher.position   = _safe(row.get(_find_column(df, SF7_COLUMN_MAP["position"]) or "", ""))
        teacher.subject_specializations = json.dumps(subjects) if subjects else None
        teacher.source     = "sf7"
        teacher.data_confidence = 0.85
        teacher.updated_at = datetime.utcnow()
        session.add(teacher)
        imported += 1

    session.commit()
    log.rows_imported, log.rows_flagged = imported, flagged
    session.add(log)
    session.commit()
    return log


def import_star_log(file_bytes: bytes, filename: str, session: Session) -> ImportLog:
    df = _read_file(file_bytes, filename)
    log = ImportLog(filename=filename, source_type="star-log",
                    rows_parsed=len(df), created_at=datetime.utcnow())
    imported, flagged = 0, 0

    for _, row in df.iterrows():
        name = _safe(row.get(_find_column(df, STAR_LOG_COLUMN_MAP["name"]) or ""))
        if not name:
            flagged += 1
            continue
        region_raw = _safe(row.get(_find_column(df, STAR_LOG_COLUMN_MAP["region"]) or "", ""))
        region = normalize_region(region_raw or "")
        module_raw = _safe(row.get(_find_column(df, STAR_LOG_COLUMN_MAP["module_name"]) or "", ""))
        module_name = _match_module(module_raw or "")
        year = _parse_year(row.get(_find_column(df, STAR_LOG_COLUMN_MAP["year"]) or ""))
        partner = _safe(row.get(_find_column(df, STAR_LOG_COLUMN_MAP["partner_university"]) or "", ""))

        teacher = _find_existing(name, region, session)
        if not teacher:
            teacher = Teacher(
                full_name=name, region=region,
                division=_safe(row.get(_find_column(df, STAR_LOG_COLUMN_MAP["division"]) or "", "")),
                school_name=_safe(row.get(_find_column(df, STAR_LOG_COLUMN_MAP["school_name"]) or "", "")),
                source="star-log", data_confidence=0.7,
                created_at=datetime.utcnow(), updated_at=datetime.utcnow(),
            )
            session.add(teacher)
            session.flush()

        session.add(TrainingRecord(
            teacher_id=teacher.id,
            module_name=module_name or module_raw or "Unknown",
            year=year,
            school_year=f"{year}-{year+1}" if year else None,
            partner_university=partner,
            region=region,
            source="star-log",
            data_confidence=0.8,
        ))
        imported += 1

    session.commit()
    log.rows_imported, log.rows_flagged = imported, flagged
    session.add(log)
    session.commit()
    return log