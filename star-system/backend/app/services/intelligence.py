"""
Decision intelligence helpers for the STAR system.

This module turns teacher and training records into explainable scores,
recommendations, and school/region/system level summaries.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime
import json
from typing import Any, Iterable

from sqlmodel import Session, select

from app.models.models import (
    CANONICAL_REGIONS,
    STAR_MODULES,
    Teacher,
    TrainingRecord,
    normalize_region,
    normalize_subject,
)
from app.services.gap_score import compute_all_regions


VALID_SUBJECTS = {
    "General Science",
    "Biology",
    "Chemistry",
    "Physics",
    "Earth Science",
    "Mathematics",
    "Statistics",
}

SUBJECT_TO_MODULE = {
    "Mathematics": "Teaching Mathematics through Problem Solving",
    "Statistics": "Teaching Mathematics through Problem Solving",
    "General Science": "Inquiry-based Approach for Teaching Science",
    "Biology": "Inquiry-based Approach for Teaching Science",
    "Chemistry": "Inquiry-based Approach for Teaching Science",
    "Physics": "Inquiry-based Approach for Teaching Science",
    "Earth Science": "Inquiry-based Approach for Teaching Science",
}

DEGREE_HINTS = {
    "mathematics": "Mathematics",
    "biology": "Biology",
    "chemistry": "Chemistry",
    "physics": "Physics",
    "earth science": "Earth Science",
    "general science": "General Science",
    "science": "General Science",
    "statistics": "Statistics",
}


def _parse_list(value: str | None) -> list[str]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, list) else [str(parsed)]
    except Exception:
        return [value]


def _dedupe(values: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        if not value:
            continue
        if value not in seen:
            seen.add(value)
            result.append(value)
    return result


def _current_year() -> int:
    return datetime.utcnow().year


def infer_primary_specialization(degree_program: str | None, subject_specializations: list[str]) -> str | None:
    degree_lower = (degree_program or "").lower()
    for hint, subject in DEGREE_HINTS.items():
        if hint in degree_lower:
            return subject
    if subject_specializations:
        return subject_specializations[0]
    return None


def infer_degree_program(subject_specializations: list[str], primary_specialization: str | None) -> str | None:
    if primary_specialization:
        if primary_specialization == "General Science":
            return "BSEd General Science"
        return f"BSEd {primary_specialization}"
    if subject_specializations:
        first = subject_specializations[0]
        return f"BSEd {first}"
    return None


def normalize_region_list(regions: Iterable[str]) -> list[str]:
    return _dedupe(
        region for region in (normalize_region(region) for region in regions) if region and region != "Unknown"
    )


def derive_relocation_type(regions: list[str], current_region: str | None = None) -> str:
    if not regions:
        return "same region"
    if current_region and len(regions) == 1 and regions[0] == current_region:
        return "same region"
    if len(regions) <= 3:
        return "nearby"
    return "nationwide"


def build_teacher_payload(payload: dict[str, Any], default_region: str | None = None) -> dict[str, Any]:
    subject_specializations = [normalize_subject(s) for s in (payload.get("subject_specializations") or []) if s]
    subjects_currently_teaching = [normalize_subject(s) for s in (payload.get("subjects_currently_teaching") or []) if s]
    primary_specialization = payload.get("primary_specialization") or infer_primary_specialization(
        payload.get("degree_program"), subject_specializations
    )
    degree_program = payload.get("degree_program") or infer_degree_program(subject_specializations, primary_specialization)
    graduation_year = payload.get("graduation_year")
    if graduation_year is not None:
        try:
            graduation_year = int(graduation_year)
        except (TypeError, ValueError):
            graduation_year = None
    preferred_regions = normalize_region_list(payload.get("preferred_relocation_regions") or [])
    preferred_type = payload.get("preferred_relocation_type") or derive_relocation_type(preferred_regions, default_region)
    trainings_attended = [module for module in (payload.get("trainings_attended") or []) if module]
    last_training_year = payload.get("last_training_year")
    if last_training_year is None and trainings_attended:
        last_training_year = _current_year()

    return {
        **payload,
        "degree_program": degree_program,
        "primary_specialization": primary_specialization,
        "graduation_year": graduation_year,
        "subject_specializations": subject_specializations,
        "subjects_currently_teaching": subjects_currently_teaching,
        "preferred_relocation_regions": preferred_regions,
        "preferred_relocation_type": preferred_type,
        "trainings_attended": trainings_attended,
        "last_training_year": last_training_year,
    }


def teacher_training_year(trainings: list[TrainingRecord], stored_year: int | None = None) -> int | None:
    if stored_year:
        return stored_year
    years = [tr.year for tr in trainings if tr.year]
    return max(years) if years else None


def recommended_modules_from_gaps(
    out_of_field_subjects: list[str],
    low_confidence_subjects: list[str],
    degree_program: str | None,
    recency_years: int | None,
) -> list[str]:
    modules: list[str] = []

    for subject in out_of_field_subjects + low_confidence_subjects:
        module = SUBJECT_TO_MODULE.get(subject)
        if module:
            modules.append(module)

    if recency_years is None or recency_years >= 3:
        modules.append("Designing Assessment Activities for Blended Learning")

    if degree_program and not modules:
        if "math" in degree_program.lower():
            modules.append("Teaching Mathematics through Problem Solving")
        elif any(keyword in degree_program.lower() for keyword in ("science", "biology", "chemistry", "physics", "earth")):
            modules.append("Inquiry-based Approach for Teaching Science")

    if not modules:
        modules.append("Interdisciplinary Contextualization")

    return [module for module in _dedupe(modules) if module in STAR_MODULES]


def compute_school_fit_score(
    subject_specializations: list[str],
    subjects_currently_teaching: list[str],
    years_experience: int | None,
    training_recency_years: int | None,
    primary_specialization: str | None,
) -> tuple[int, str, str, dict[str, float]]:
    """Compute a school-facing match score based on specialization and experience."""
    teaching_subjects = [subject for subject in subjects_currently_teaching if subject]
    specializations = [subject for subject in subject_specializations if subject]
    aligned_subjects = [
        subject for subject in teaching_subjects
        if subject in specializations or subject == primary_specialization
    ]

    if teaching_subjects:
        alignment_ratio = len(aligned_subjects) / len(teaching_subjects)
        specialization_presence = 1.0 if aligned_subjects else 0.0
    else:
        alignment_ratio = 0.5 if specializations else 0.0
        specialization_presence = 1.0 if specializations else 0.0

    experience_factor = min((years_experience or 0) / 10.0, 1.0)
    recency_bonus = 0.0
    if training_recency_years is not None:
        if training_recency_years <= 2:
            recency_bonus = 1.0
        elif training_recency_years <= 4:
            recency_bonus = 0.5

    score = 40 + (35 * alignment_ratio) + (15 * specialization_presence) + (10 * experience_factor) + (5 * recency_bonus)
    if teaching_subjects and not aligned_subjects:
        score -= 10

    score = max(0, min(99, round(score)))

    if score >= 90:
        band = "Very aligned"
    elif score >= 70:
        band = "Aligned"
    elif score >= 50:
        band = "Partial"
    else:
        band = "Needs review"

    if aligned_subjects and len(aligned_subjects) == len(teaching_subjects):
        summary = "All current subjects match the teacher's specialization."
    elif aligned_subjects:
        summary = "Some current subjects match specialization; the profile is still acceptable for the school." 
    elif teaching_subjects:
        summary = "Current teaching load is outside the teacher's specialization and needs review."
    else:
        summary = "Current teaching load is not available, so the score relies on specialization and experience."

    breakdown = {
        "specialization_alignment": round(alignment_ratio * 100, 1),
        "specialization_presence": round(specialization_presence * 100, 1),
        "experience": round(experience_factor * 100, 1),
        "training_recency": round(recency_bonus * 100, 1),
    }

    return score, band, summary, breakdown


def determine_recommended_action(
    is_out_of_field: bool,
    competency_level: str,
    training_recency_years: int | None,
) -> str:
    """Return a single, explainable action label per teacher."""
    if is_out_of_field and competency_level == "low":
        return "Certification"
    if is_out_of_field:
        return "Reassignment"
    if competency_level == "low":
        return "Upskilling"
    if training_recency_years is None or training_recency_years >= 3:
        return "Upskilling"
    return "Maintain"


def build_teacher_intelligence(teacher: Teacher, trainings: list[TrainingRecord] | None = None) -> dict[str, Any]:
    trainings = trainings or []
    subject_specializations = _parse_list(teacher.subject_specializations)
    subjects_currently_teaching = _parse_list(teacher.subjects_currently_teaching)
    low_confidence_subjects = _parse_list(teacher.low_confidence_subjects)
    preferred_regions = _parse_list(teacher.preferred_relocation_regions)

    primary_specialization = teacher.primary_specialization or infer_primary_specialization(
        teacher.degree_program, subject_specializations
    )
    degree_program = teacher.degree_program or infer_degree_program(subject_specializations, primary_specialization)
    graduation_year = teacher.graduation_year
    last_training_year = teacher_training_year(trainings, teacher.last_training_year)
    recency_years = _current_year() - last_training_year if last_training_year else None
    out_of_field_subjects = [subject for subject in subjects_currently_teaching if subject not in subject_specializations]

    alignment_score = 0.5 if not subjects_currently_teaching or not subject_specializations else max(
        0.0, 1.0 - (len(out_of_field_subjects) / max(len(subjects_currently_teaching), 1))
    )
    experience_score = min((teacher.years_experience or 0) / 20.0, 1.0)
    if recency_years is None:
        recency_score = 0.0
    elif recency_years <= 1:
        recency_score = 1.0
    elif recency_years <= 2:
        recency_score = 0.85
    elif recency_years <= 3:
        recency_score = 0.65
    elif recency_years <= 5:
        recency_score = 0.35
    else:
        recency_score = 0.15

    if degree_program and primary_specialization:
        degree_fit_score = 1.0 if primary_specialization.lower() in degree_program.lower() else 0.65
    else:
        degree_fit_score = 0.5

    competency_score = round(
        100 * (
            0.45 * alignment_score
            + 0.25 * experience_score
            + 0.20 * recency_score
            + 0.10 * degree_fit_score
        )
    )
    if competency_score >= 75:
        competency_level = "high"
    elif competency_score >= 50:
        competency_level = "medium"
    else:
        competency_level = "low"

    recommended_modules = recommended_modules_from_gaps(
        out_of_field_subjects=out_of_field_subjects,
        low_confidence_subjects=low_confidence_subjects,
        degree_program=degree_program,
        recency_years=recency_years,
    )

    identified_gaps: list[str] = []
    recommendations: list[str] = []
    auto_tags: list[str] = []

    if out_of_field_subjects:
        identified_gaps.append(f"Out-of-field teaching: {', '.join(out_of_field_subjects)}")
        recommendations.append("Reassign classes toward the teacher's specialization or add certification support.")
        auto_tags.append("out-of-field")

    if recency_years is None:
        identified_gaps.append("Missing training history")
        recommendations.append("Collect training history and assign a baseline STAR module.")
        auto_tags.append("missing-training-data")
    elif recency_years >= 3:
        identified_gaps.append(f"Training recency gap: last training {recency_years} year{'s' if recency_years != 1 else ''} ago")
        recommendations.append("Prioritize refresher training within the next cycle.")

    if (teacher.years_experience or 0) >= 15 and competency_score < 70:
        identified_gaps.append("Experienced but under-specialized")
        recommendations.append("Use targeted upskilling to convert experience into specialization depth.")

    if not recommendations:
        recommendations.append("Maintain current performance and assign an advanced STAR module for stretch growth.")

    recommended_action = determine_recommended_action(
        is_out_of_field=bool(out_of_field_subjects),
        competency_level=competency_level,
        training_recency_years=recency_years,
    )

    school_fit_score, school_fit_band, school_fit_summary, school_fit_breakdown = compute_school_fit_score(
        subject_specializations=subject_specializations,
        subjects_currently_teaching=subjects_currently_teaching,
        years_experience=teacher.years_experience,
        training_recency_years=recency_years,
        primary_specialization=primary_specialization,
    )

    validation_issues = []
    invalid_specs = [subject for subject in subject_specializations if subject not in VALID_SUBJECTS]
    invalid_teaching = [subject for subject in subjects_currently_teaching if subject not in VALID_SUBJECTS]
    if invalid_specs:
        validation_issues.append(f"Invalid specializations: {', '.join(invalid_specs)}")
    if invalid_teaching:
        validation_issues.append(f"Invalid subjects taught: {', '.join(invalid_teaching)}")
    if not subject_specializations:
        validation_issues.append("Specialization missing")

    return {
        "teacher_id": teacher.id,
        "teacher_name": teacher.full_name,
        "region": teacher.region,
        "degree_program": degree_program,
        "primary_specialization": primary_specialization,
        "graduation_year": graduation_year,
        "preferred_relocation_regions": preferred_regions,
        "preferred_relocation_type": teacher.preferred_relocation_type or derive_relocation_type(preferred_regions, teacher.region),
        "last_training_year": last_training_year,
        "training_count": len(trainings),
        "is_out_of_field": bool(out_of_field_subjects),
        "out_of_field_subjects": out_of_field_subjects,
        "competency_score": competency_score,
        "competency_level": competency_level,
        "competency_breakdown": {
            "specialization_alignment": round(alignment_score * 100, 1),
            "experience": round(experience_score * 100, 1),
            "training_recency": round(recency_score * 100, 1),
            "degree_fit": round(degree_fit_score * 100, 1),
        },
        "school_fit_score": school_fit_score,
        "school_fit_band": school_fit_band,
        "school_fit_summary": school_fit_summary,
        "school_fit_breakdown": school_fit_breakdown,
        "training_recency_years": recency_years,
        "identified_gaps": identified_gaps,
        "recommendations": recommendations,
        "recommended_modules": recommended_modules,
        "recommended_action": recommended_action,
        "auto_tags": auto_tags,
        "validation_issues": validation_issues,
        "subject_specializations": subject_specializations,
        "subjects_currently_teaching": subjects_currently_teaching,
        "low_confidence_subjects": low_confidence_subjects,
        "training_history": [
            {
                "module_name": tr.module_name,
                "year": tr.year,
                "partner_university": tr.partner_university,
                "region": tr.region,
            }
            for tr in trainings
        ],
        "teaching_profile": {
            "subject_specializations": subject_specializations,
            "subjects_currently_teaching": subjects_currently_teaching,
            "low_confidence_subjects": low_confidence_subjects,
        },
    }


def _school_key(teacher: Teacher) -> tuple[str, str, str, str]:
    school_name = teacher.school_name or teacher.division or "Unknown school"
    return (
        teacher.region or "Unknown",
        teacher.province or "",
        teacher.city or "",
        school_name,
    )


def _priority_class(score: float) -> str:
    if score >= 70:
        return "Critical"
    if score >= 40:
        return "Moderate"
    return "Low"


def build_school_intelligence(teachers: list[Teacher], teacher_trainings: dict[str, list[TrainingRecord]] | None = None) -> list[dict[str, Any]]:
    teacher_trainings = teacher_trainings or {}
    grouped: dict[tuple[str, str, str, str], list[Teacher]] = defaultdict(list)
    for teacher in teachers:
        grouped[_school_key(teacher)].append(teacher)

    results: list[dict[str, Any]] = []
    for (region, province, city, school_name), school_teachers in grouped.items():
        profiles = [
            build_teacher_intelligence(teacher, teacher_trainings.get(teacher.id, []))
            for teacher in school_teachers
        ]
        total_teachers = len(school_teachers)
        total_students = sum(teacher.student_count or 0 for teacher in school_teachers)
        avg_students = round(total_students / total_teachers, 1) if total_teachers else 0.0
        avg_competency = round(sum(profile["competency_score"] for profile in profiles) / total_teachers, 1) if total_teachers else 0.0
        out_of_field = sum(1 for profile in profiles if profile["is_out_of_field"])
        trained = sum(1 for profile in profiles if profile["last_training_year"] is not None)
        competency_distribution = Counter(profile["competency_level"] for profile in profiles)
        recency_gap = sum(
            1
            for profile in profiles
            if profile["training_recency_years"] is None or profile["training_recency_years"] >= 3
        )

        low_competency_ratio = competency_distribution["low"] / total_teachers if total_teachers else 0.0
        out_of_field_rate = out_of_field / total_teachers if total_teachers else 0.0
        training_coverage = trained / total_teachers if total_teachers else 0.0
        student_load = min(avg_students / 45.0, 1.0)
        priority_score = round(
            100 * (
                0.35 * (1 - avg_competency / 100.0)
                + 0.25 * out_of_field_rate
                + 0.20 * (1 - training_coverage)
                + 0.20 * student_load
            ),
            1,
        )
        priority_level = _priority_class(priority_score)

        module_counts = Counter()
        need_counts = Counter()
        for profile in profiles:
            for module in profile["recommended_modules"]:
                module_counts[module] += 1
            if profile["is_out_of_field"]:
                need_counts["specialization alignment"] += 1
            if profile["competency_level"] == "low":
                need_counts["upskilling"] += 1
            if profile["training_recency_years"] is None or profile["training_recency_years"] >= 3:
                need_counts["refresher"] += 1

        recommendations: list[str] = []
        if need_counts["specialization alignment"]:
            count = need_counts["specialization alignment"]
            recommendations.append(f"{count} teacher{'s' if count != 1 else ''} require subject-specialization alignment")
        if need_counts["upskilling"]:
            count = need_counts["upskilling"]
            recommendations.append(f"{count} teacher{'s' if count != 1 else ''} need upskilling support")
        if need_counts["refresher"]:
            count = need_counts["refresher"]
            recommendations.append(f"{count} teacher{'s' if count != 1 else ''} need refresher training")
        if not recommendations:
            recommendations.append("Maintain current coverage and extend advanced STAR modules")

        top_modules = [module for module, _ in module_counts.most_common(3)]

        results.append({
            "region": region,
            "province": province,
            "city": city,
            "school_name": school_name,
            "total_teachers": total_teachers,
            "teachers_needing_training": need_counts["upskilling"] + need_counts["refresher"],
            "trained_teachers": trained,
            "untrained_teachers": total_teachers - trained,
            "training_coverage_pct": round(training_coverage * 100, 1),
            "out_of_field_teachers": out_of_field,
            "out_of_field_rate": round(out_of_field_rate * 100, 1),
            "avg_competency_score": avg_competency,
            "competency_distribution": {
                "low": competency_distribution["low"],
                "medium": competency_distribution["medium"],
                "high": competency_distribution["high"],
            },
            "avg_student_ratio": avg_students,
            "training_recency_gap_pct": round((recency_gap / total_teachers) * 100, 1) if total_teachers else 0.0,
            "priority_score": priority_score,
            "priority_level": priority_level,
            "at_risk": priority_level == "Critical" or avg_competency < 55 or training_coverage < 0.5,
            "module_recommendations": top_modules,
            "training_needs": [
                {
                    "type": need.replace("_", " ").title(),
                    "count": count,
                }
                for need, count in need_counts.items()
                if count
            ],
            "recommendations": recommendations,
            "teachers": profiles,
        })

    return sorted(results, key=lambda item: (-item["priority_score"], item["school_name"]))


def build_division_intelligence(
    teachers: list[Teacher],
    teacher_trainings: dict[str, list[TrainingRecord]] | None = None,
) -> list[dict[str, Any]]:
    """Aggregate school and teacher intelligence at School Division Office level."""
    teacher_trainings = teacher_trainings or {}
    grouped: dict[tuple[str, str, str, str], list[Teacher]] = defaultdict(list)
    for teacher in teachers:
        key = (
            teacher.region or "Unknown",
            teacher.province or "",
            teacher.city or "",
            teacher.division or f"{teacher.city or 'Unknown city'} Division Office",
        )
        grouped[key].append(teacher)

    school_intelligence = build_school_intelligence(teachers, teacher_trainings)
    results: list[dict[str, Any]] = []

    for (region, province, city, division_name), division_teachers in grouped.items():
        profiles = [
            build_teacher_intelligence(teacher, teacher_trainings.get(teacher.id, []))
            for teacher in division_teachers
        ]
        total_teachers = len(division_teachers)
        trained = sum(1 for profile in profiles if profile["last_training_year"] is not None)
        out_of_field_count = sum(1 for profile in profiles if profile["is_out_of_field"])
        avg_competency = round(
            sum(profile["competency_score"] for profile in profiles) / total_teachers,
            1,
        ) if total_teachers else 0.0

        action_counts = Counter(profile.get("recommended_action", "Upskilling") for profile in profiles)
        teachers_needing_training = action_counts.get("Upskilling", 0) + action_counts.get("Certification", 0)

        module_counts = Counter()
        for profile in profiles:
            for module in profile.get("recommended_modules", []):
                module_counts[module] += 1

        division_schools = [
            school
            for school in school_intelligence
            if school["region"] == region and school["province"] == province and school["city"] == city
        ]

        results.append({
            "region": region,
            "province": province,
            "city": city,
            "division": division_name,
            "total_teachers": total_teachers,
            "teachers_needing_training": teachers_needing_training,
            "school_count": len({teacher.school_name or "Unknown school" for teacher in division_teachers}),
            "training_coverage_pct": round((trained / total_teachers) * 100, 1) if total_teachers else 0.0,
            "out_of_field_rate": round((out_of_field_count / total_teachers) * 100, 1) if total_teachers else 0.0,
            "avg_competency_score": avg_competency,
            "action_summary": {
                "upskilling": action_counts.get("Upskilling", 0),
                "certification": action_counts.get("Certification", 0),
                "reassignment": action_counts.get("Reassignment", 0),
                "maintain": action_counts.get("Maintain", 0),
            },
            "top_module_needs": [
                {"module": module, "count": count}
                for module, count in module_counts.most_common(5)
            ],
            "schools": sorted(division_schools, key=lambda item: -item["teachers_needing_training"] if "teachers_needing_training" in item else -item["priority_score"]),
            "teacher_profiles": sorted(
                profiles,
                key=lambda profile: (profile["recommended_action"] != "Certification", profile["competency_score"]),
            ),
        })

    return sorted(results, key=lambda item: (-item["teachers_needing_training"], item["division"]))


def build_region_intelligence(session: Session, region: str) -> dict[str, Any]:
    teachers = session.exec(select(Teacher).where(Teacher.region == region)).all()
    training_records = session.exec(select(TrainingRecord)).all()
    teacher_trainings: dict[str, list[TrainingRecord]] = defaultdict(list)
    for training in training_records:
        if training.teacher_id:
            teacher_trainings[training.teacher_id].append(training)

    school_intelligence = build_school_intelligence(teachers, teacher_trainings)
    teacher_profiles = [
        build_teacher_intelligence(teacher, teacher_trainings.get(teacher.id, []))
        for teacher in teachers
    ]
    total_teachers = len(teachers)
    out_of_field_count = sum(1 for profile in teacher_profiles if profile["is_out_of_field"])
    competency_distribution = Counter(profile["competency_level"] for profile in teacher_profiles)
    trained = sum(1 for profile in teacher_profiles if profile["last_training_year"] is not None)
    avg_competency = round(sum(profile["competency_score"] for profile in teacher_profiles) / total_teachers, 1) if total_teachers else 0.0
    recency_gap = sum(
        1 for profile in teacher_profiles if profile["training_recency_years"] is None or profile["training_recency_years"] >= 3
    )
    at_risk_schools = sum(1 for school in school_intelligence if school["at_risk"])

    return {
        "region": region,
        "total_teachers": total_teachers,
        "trained_teachers": trained,
        "untrained_teachers": total_teachers - trained,
        "out_of_field_rate": round((out_of_field_count / total_teachers) * 100, 1) if total_teachers else 0.0,
        "avg_competency_score": avg_competency,
        "training_recency_gap_pct": round((recency_gap / total_teachers) * 100, 1) if total_teachers else 0.0,
        "competency_distribution": {
            "low": competency_distribution["low"],
            "medium": competency_distribution["medium"],
            "high": competency_distribution["high"],
        },
        "at_risk_schools": at_risk_schools,
        "schools": school_intelligence,
        "teacher_profiles": teacher_profiles,
    }


def build_system_intelligence(session: Session) -> dict[str, Any]:
    teachers = session.exec(select(Teacher)).all()
    trainings = session.exec(select(TrainingRecord)).all()

    teacher_trainings: dict[str, list[TrainingRecord]] = defaultdict(list)
    for training in trainings:
        if training.teacher_id:
            teacher_trainings[training.teacher_id].append(training)

    teacher_profiles = [
        build_teacher_intelligence(teacher, teacher_trainings.get(teacher.id, []))
        for teacher in teachers
    ]
    school_intelligence = build_school_intelligence(teachers, teacher_trainings)

    competency_distribution = Counter(profile["competency_level"] for profile in teacher_profiles)
    out_of_field_count = sum(1 for profile in teacher_profiles if profile["is_out_of_field"])
    trained_count = sum(1 for profile in teacher_profiles if profile["last_training_year"] is not None)
    avg_competency = round(sum(profile["competency_score"] for profile in teacher_profiles) / len(teacher_profiles), 1) if teacher_profiles else 0.0
    recency_gap = sum(
        1 for profile in teacher_profiles if profile["training_recency_years"] is None or profile["training_recency_years"] >= 3
    )
    at_risk_schools = sum(1 for school in school_intelligence if school["at_risk"])

    top_interventions = []
    for school in school_intelligence[:5]:
        reasons = []
        if school["out_of_field_rate"] >= 30:
            reasons.append("high mismatch")
        if school["training_coverage_pct"] < 50:
            reasons.append("low training coverage")
        if school["avg_student_ratio"] >= 35:
            reasons.append("high student load")
        if not reasons:
            reasons.append("moderate concern")

        top_interventions.append({
            "school_name": school["school_name"],
            "region": school["region"],
            "total_teachers": school["total_teachers"],
            "training_coverage_pct": school["training_coverage_pct"],
            "out_of_field_rate": school["out_of_field_rate"],
            "avg_student_ratio": school["avg_student_ratio"],
            "priority_level": school["priority_level"],
            "priority_score": school["priority_score"],
            "reason": ", ".join(reasons),
            "recommendations": school["recommendations"],
        })

    region_gaps = compute_all_regions(session)

    return {
        "total_teachers": len(teachers),
        "trained_teachers": trained_count,
        "untrained_teachers": len(teachers) - trained_count,
        "training_coverage_pct": round((trained_count / len(teachers)) * 100, 1) if teachers else 0.0,
        "regions_with_data": len({teacher.region for teacher in teachers if teacher.region}),
        "high_gap_regions": sum(1 for region in region_gaps if region["gap_level"] == "high"),
        "critical_school_regions": len({school["region"] for school in school_intelligence if school["priority_level"] == "Critical"}),
        "total_training_records": len(trainings),
        "star_modules": STAR_MODULES,
        "competency_distribution": {
            "low": competency_distribution["low"],
            "medium": competency_distribution["medium"],
            "high": competency_distribution["high"],
        },
        "out_of_field_pct": round((out_of_field_count / len(teachers)) * 100, 1) if teachers else 0.0,
        "at_risk_schools": at_risk_schools,
        "average_competency_score": avg_competency,
        "training_recency_gap_pct": round((recency_gap / len(teachers)) * 100, 1) if teachers else 0.0,
        "high_impact_interventions": top_interventions,
        "schools": school_intelligence[:15],
        "teacher_profiles": teacher_profiles,
    }


def suggest_reassignment_matches(session: Session, limit: int = 15) -> list[dict[str, Any]]:
    teachers = session.exec(select(Teacher)).all()
    teacher_trainings: dict[str, list[TrainingRecord]] = defaultdict(list)
    for training in session.exec(select(TrainingRecord)).all():
        if training.teacher_id:
            teacher_trainings[training.teacher_id].append(training)

    school_intelligence = build_school_intelligence(teachers, teacher_trainings)
    critical_schools = [school for school in school_intelligence if school["priority_level"] == "Critical"]
    matches: list[dict[str, Any]] = []

    for teacher in teachers:
        profile = build_teacher_intelligence(teacher, teacher_trainings.get(teacher.id, []))
        preferred_regions = set(profile["preferred_relocation_regions"])
        if not preferred_regions and profile["preferred_relocation_type"] == "same region":
            preferred_regions = {teacher.region}

        for school in critical_schools:
            if preferred_regions and school["region"] not in preferred_regions and profile["preferred_relocation_type"] != "nationwide":
                continue
            fit_score = 0
            if profile["primary_specialization"] and school["module_recommendations"]:
                if SUBJECT_TO_MODULE.get(profile["primary_specialization"]) in school["module_recommendations"]:
                    fit_score += 40
            fit_score += min(profile["competency_score"], 100) * 0.3
            fit_score += 20 if school["priority_level"] == "Critical" else 10
            matches.append({
                "teacher_id": teacher.id,
                "teacher_name": teacher.full_name,
                "current_region": teacher.region,
                "target_school": school["school_name"],
                "target_region": school["region"],
                "fit_score": round(fit_score, 1),
                "reason": ", ".join(profile["recommendations"][:2]),
            })

    return sorted(matches, key=lambda item: -item["fit_score"])[:limit]


def simulate_training_impact(session: Session, teachers_to_train: int = 10, uplift: int = 12) -> dict[str, Any]:
    teachers = session.exec(select(Teacher)).all()
    teacher_trainings: dict[str, list[TrainingRecord]] = defaultdict(list)
    for training in session.exec(select(TrainingRecord)).all():
        if training.teacher_id:
            teacher_trainings[training.teacher_id].append(training)

    profiles = [
        build_teacher_intelligence(teacher, teacher_trainings.get(teacher.id, []))
        for teacher in teachers
    ]
    ranked = sorted(profiles, key=lambda profile: (profile["competency_score"], profile["training_recency_years"] or 99))
    selected = ranked[: max(0, teachers_to_train)]
    projected_scores = [min(100, profile["competency_score"] + uplift) for profile in selected]
    baseline_avg = round(sum(profile["competency_score"] for profile in profiles) / len(profiles), 1) if profiles else 0.0
    projected_avg = round(
        (sum(profile["competency_score"] for profile in profiles) - sum(profile["competency_score"] for profile in selected) + sum(projected_scores))
        / len(profiles),
        1,
    ) if profiles else 0.0

    return {
        "teachers_simulated": len(selected),
        "uplift_per_teacher": uplift,
        "baseline_average_competency": baseline_avg,
        "projected_average_competency": projected_avg,
        "improvement": round(projected_avg - baseline_avg, 1),
        "selected_teachers": [
            {
                "teacher_id": profile.get("teacher_id"),
                "teacher_name": profile.get("teacher_name"),
                "current_score": profile["competency_score"],
                "projected_score": min(100, profile["competency_score"] + uplift),
            }
            for profile in selected
        ],
    }