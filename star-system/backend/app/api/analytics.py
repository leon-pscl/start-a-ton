"""
Analytics API Routes

This module provides REST endpoints for gap analysis and reporting:
- Summary statistics for the entire system
- Regional gap scores and breakdowns
- Detailed region-level analysis with subject/module breakdowns
- CSV export functionality

Gap scores measure the training needs of each region based on:
- Distance: How far teachers are from training centers
- Coverage: Percentage of teachers who haven't received training
- Mismatch: Teachers teaching subjects they're not specialized in
- Recency: Teachers whose last training was 3+ years ago
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select
import csv, io, json
from datetime import datetime
from pydantic import BaseModel
from app.core.database import get_session
from app.models.models import Teacher, TrainingRecord, STAR_MODULES
from app.services.gap_score import compute_all_regions, compute_region_gap, compute_province_gaps, compute_city_gaps, compute_subject_shortage
from app.services.recommendation import rank_interventions
from app.services.reporting import generate_executive_pdf
from app.services.intelligence import (
    build_teacher_intelligence,
    build_region_intelligence,
    build_school_intelligence,
    build_division_intelligence,
    build_system_intelligence,
    suggest_reassignment_matches,
    simulate_training_impact,
)

# Create router with /analytics prefix
router = APIRouter(prefix="/analytics", tags=["analytics"])


# ---------------------------------------------------------------------------
# Request/Response Models
# ---------------------------------------------------------------------------

class CalamityStatusUpdate(BaseModel):
    """Request body for updating a region's calamity status."""
    critical_status: str  # "normal", "calamity", or "emergency"
    critical_reason: str


# ---------------------------------------------------------------------------
# Summary Statistics Endpoint
# ---------------------------------------------------------------------------

@router.get("/summary")
def get_summary(session: Session = Depends(get_session)):
    """
    Get system-wide summary statistics.

    Returns aggregate counts and key metrics for the dashboard:
    - Total teacher count
    - Trained vs untrained counts
    - Training coverage percentage
    - Number of regions with data
    - Count of high-gap regions (priority areas)
    - Total training records
    - List of STAR modules

    Used by the Dashboard component for the summary cards.
    """
    system = build_system_intelligence(session)

    return {
        "total_teachers": system["total_teachers"],
        "trained_teachers": system["trained_teachers"],
        "untrained_teachers": system["untrained_teachers"],
        "training_coverage_pct": system["training_coverage_pct"],
        "regions_with_data": system["regions_with_data"],
        "high_gap_regions": system["high_gap_regions"],
        "total_training_records": system["total_training_records"],
        "star_modules": system["star_modules"],
        "competency_distribution": system["competency_distribution"],
        "out_of_field_pct": system["out_of_field_pct"],
        "at_risk_schools": system["at_risk_schools"],
        "average_competency_score": system["average_competency_score"],
        "training_recency_gap_pct": system["training_recency_gap_pct"],
        "critical_school_regions": system["critical_school_regions"],
        "high_impact_interventions": system["high_impact_interventions"],
    }


# ---------------------------------------------------------------------------
# Regional Gap Analysis Endpoints
# ---------------------------------------------------------------------------

@router.get("/regions")
def get_regions(session: Session = Depends(get_session)):
    """
    Get gap analysis for all regions.

    Returns a list of all regions sorted by gap score (highest first).
    Each region entry includes:
    - Total teacher count
    - Trained/untrained breakdown
    - Gap score (0-1, higher = more need)
    - Gap level (low/moderate/high)
    - Component scores for the four factors
    - Critical status (calamity/emergency flags)

    Used by the Regions page to display the map and table.
    Now includes impact scoring and recommendations.
    """
    from app.models.models import RegionStatus

    results = compute_all_regions(session)
    ranked = rank_interventions(results)

    # Load calamity statuses for all regions
    statuses = session.exec(select(RegionStatus)).all()
    status_map = {s.region: s for s in statuses}

    # Merge status into each region
    for region in ranked:
        status = status_map.get(region["region"])
        if status and status.critical_status != "normal":
            region["critical_status"] = status.critical_status
            region["critical_reason"] = status.critical_reason

    return ranked


@router.get("/regions/{region}")
def get_region_detail(region: str, session: Session = Depends(get_session)):
    """
    Get detailed analysis for a single region.

    In addition to gap scores, includes:
    - Subject breakdown: Teacher count per subject specialization
    - Module uptake: How many teachers have completed each STAR module
    - Critical status (calamity/emergency flags)

    This data powers the region detail panel when clicking a region on the map.
    """
    from app.models.models import RegionStatus

    # Get gap scores and region intelligence
    gap = compute_region_gap(region, session)
    intelligence = build_region_intelligence(session, region)

    # Get calamity status
    status = session.exec(select(RegionStatus).where(RegionStatus.region == region)).first()
    if status and status.critical_status != "normal":
        gap["critical_status"] = status.critical_status
        gap["critical_reason"] = status.critical_reason

    # Get all teachers in this region
    teachers = session.exec(select(Teacher).where(Teacher.region == region)).all()

    # Count teachers by subject specialization
    subject_counts: dict = {}
    for t in teachers:
        for s in json.loads(t.subject_specializations or "[]"):
            subject_counts[s] = subject_counts.get(s, 0) + 1

    # Count training records by module
    module_counts: dict = {}
    for t in teachers:
        for tr in session.exec(
            select(TrainingRecord).where(TrainingRecord.teacher_id == t.id)
        ).all():
            module_counts[tr.module_name] = module_counts.get(tr.module_name, 0) + 1

    return {
        **gap,
        **{k: intelligence[k] for k in (
            "out_of_field_rate",
            "avg_competency_score",
            "training_recency_gap_pct",
            "competency_distribution",
            "at_risk_schools",
            "schools",
        )},
        "subject_breakdown": subject_counts,
        "module_uptake": module_counts,
    }


@router.get("/schools")
def get_schools(
    region: str = None,
    city: str = None,
    division: str = None,
    school: str = None,
    session: Session = Depends(get_session),
):
    """
    Return school-level intelligence ranked by priority.

    When region is provided, results are filtered to that region.
    """
    teachers = session.exec(select(Teacher)).all()
    if region:
        teachers = [teacher for teacher in teachers if teacher.region == region]
    if city:
        teachers = [teacher for teacher in teachers if (teacher.city or "") == city]
    if division:
        teachers = [teacher for teacher in teachers if (teacher.division or "") == division]
    if school:
        teachers = [teacher for teacher in teachers if (teacher.school_name or "") == school]

    training_records = session.exec(select(TrainingRecord)).all()
    teacher_trainings = {}
    for training in training_records:
        if training.teacher_id:
            teacher_trainings.setdefault(training.teacher_id, []).append(training)

    return build_school_intelligence(teachers, teacher_trainings)


@router.get("/divisions")
def get_divisions(
    region: str = None,
    city: str = None,
    division: str = None,
    session: Session = Depends(get_session),
):
    """
    Return School Division Office level intelligence with school + teacher breakdowns.

    Optional filters:
    - region
    - city
    - division (exact match)
    """
    teachers = session.exec(select(Teacher)).all()
    if region:
        teachers = [teacher for teacher in teachers if teacher.region == region]
    if city:
        teachers = [teacher for teacher in teachers if teacher.city == city]
    if division:
        teachers = [teacher for teacher in teachers if (teacher.division or "") == division]

    training_records = session.exec(select(TrainingRecord)).all()
    teacher_trainings = {}
    for training in training_records:
        if training.teacher_id:
            teacher_trainings.setdefault(training.teacher_id, []).append(training)

    return build_division_intelligence(teachers, teacher_trainings)


@router.get("/regional-insights")
def get_regional_insights(session: Session = Depends(get_session)):
    """
    Return region-level actionable insights.

    Includes:
    - Core regional gap metrics
    - Out-of-field and competency indicators
    - School aggregation and priority counts
    - Top subject training gaps per region
    """
    regions = compute_all_regions(session)
    shortage = compute_subject_shortage(session)
    matrix = shortage.get("matrix", {})

    insights = []
    for region_gap in regions:
        region_name = region_gap["region"]
        intelligence = build_region_intelligence(session, region_name)
        schools = intelligence.get("schools", [])

        subject_gaps = []
        for subject, per_region in matrix.items():
            count = per_region.get(region_name, 0)
            if count > 0:
                subject_gaps.append({"subject": subject, "count": count})
        subject_gaps.sort(key=lambda item: (-item["count"], item["subject"]))

        critical = sum(1 for school in schools if school.get("priority_level") == "Critical")
        moderate = sum(1 for school in schools if school.get("priority_level") == "Moderate")

        insights.append({
            "region": region_name,
            "gap_score": region_gap.get("gap_score", 0),
            "gap_level": region_gap.get("gap_level", "low"),
            "total_teachers": intelligence.get("total_teachers", 0),
            "trained_teachers": intelligence.get("trained_teachers", 0),
            "training_coverage_pct": round(
                (intelligence.get("trained_teachers", 0) / max(intelligence.get("total_teachers", 1), 1)) * 100,
                1,
            ) if intelligence.get("total_teachers", 0) else 0.0,
            "out_of_field_pct": intelligence.get("out_of_field_rate", 0),
            "avg_competency_score": intelligence.get("avg_competency_score", 0),
            "training_recency_gap_pct": intelligence.get("training_recency_gap_pct", 0),
            "school_count": len(schools),
            "critical_schools": critical,
            "moderate_schools": moderate,
            "at_risk_schools": intelligence.get("at_risk_schools", 0),
            "top_subject_gaps": subject_gaps[:5],
        })

    return insights


# ---------------------------------------------------------------------------
# CSV Export Endpoint
# ---------------------------------------------------------------------------

@router.get("/export/csv")
def export_csv(region: str = None, session: Session = Depends(get_session)):
    """
    Export teacher data as CSV file.

    Generates a CSV with key teacher fields for offline analysis or reporting.
    Optionally filtered by region.

    Args:
        region: Optional region filter (exports all regions if not provided)

    Returns:
        StreamingResponse: CSV file download
    """
    # Build query with optional region filter
    q = select(Teacher)
    if region:
        q = q.where(Teacher.region == region)
    teachers = session.exec(q).all()

    # Get trained status for each teacher
    trained_ids = set(
        r.teacher_id for r in session.exec(select(TrainingRecord)).all() if r.teacher_id
    )
    teacher_trainings = {}
    for training in session.exec(select(TrainingRecord)).all():
        if training.teacher_id:
            teacher_trainings.setdefault(training.teacher_id, []).append(training)

    # Generate CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)

    # Write header row
    writer.writerow([
        "ID", "Full Name", "Region", "Province", "City", "Division", "School",
        "Position", "Years Experience", "Highest Qualification", "Degree Program", "Primary Specialization",
        "Subject Specializations", "Grade Levels Taught", "Is Trained", "Competency Score", "Competency Level",
        "Out of Field", "Recommended Action", "Last Training Year", "Preferred Relocation Type", "Source", "Data Confidence",
    ])

    # Write data rows
    for t in teachers:
        specs = ", ".join(json.loads(t.subject_specializations or "[]"))
        grades = ", ".join(json.loads(t.grade_levels_taught or "[]"))
        intelligence = build_teacher_intelligence(t, teacher_trainings.get(t.id, []))
        writer.writerow([
            t.id, t.full_name, t.region, t.province or "", t.city or "", t.division or "", t.school_name or "",
            t.position or "", t.years_experience or "", t.highest_qualification or "", t.degree_program or "", t.primary_specialization or "",
            specs, grades, t.id in trained_ids, intelligence["competency_score"], intelligence["competency_level"], intelligence["is_out_of_field"],
            intelligence["recommended_action"], intelligence["last_training_year"] or "", t.preferred_relocation_type or "", t.source, t.data_confidence,
        ])

    output.seek(0)

    # Generate filename with region and date
    filename = f"star_teachers_{region or 'all'}_{datetime.utcnow().strftime('%Y%m%d')}.csv"

    # Return as downloadable file
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )

@router.get("/export/pdf")
def export_pdf(session: Session = Depends(get_session)):
    """
    Export detailed PDF executive summary.

    Generates a stakeholder-ready report with:
    - National overview
    - Priority visualizations (charts)
    - Regional intervention mapping
    - Strategic policy recommendations
    """
    import os
    from fastapi import HTTPException

    try:
        results = compute_all_regions(session)
        ranked = rank_interventions(results)

        pdf_path = generate_executive_pdf(ranked)

        with open(pdf_path, "rb") as f:
            pdf_data = f.read()

        # Clean up temp file
        try:
            os.remove(pdf_path)
        except:
            pass

        filename = f"star_executive_summary_{datetime.now().strftime('%Y%m%d')}.pdf"

        return StreamingResponse(
            io.BytesIO(pdf_data),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")
    
@router.get("/subject-shortage")
def get_subject_shortage(session: Session = Depends(get_session)):
    """
    Get subject shortage (mismatch) matrix across all regions.

    Returns which subjects are most commonly being taught outside
    teacher specialization, per region. Cells show the count of
    out-of-specialization teachers per subject per region.

    Used to render the cross-regional subject shortage heatmap.
    """
    return compute_subject_shortage(session)


@router.get("/provinces")
def get_provinces(session: Session = Depends(get_session)):
    return compute_province_gaps(session)


@router.get("/cities")
def get_cities(session: Session = Depends(get_session)):
    return compute_city_gaps(session)


@router.post("/simulate")
def simulate(training_count: int = 10, uplift: int = 12, session: Session = Depends(get_session)):
    """Optional what-if analysis for training impact."""
    return simulate_training_impact(session, teachers_to_train=training_count, uplift=uplift)


@router.get("/reassignments")
def reassignments(limit: int = 15, session: Session = Depends(get_session)):
    """Optional relocation suggestions matched to high-need schools."""
    return suggest_reassignment_matches(session, limit=limit)


# ---------------------------------------------------------------------------
# Calamity Status Management
# ---------------------------------------------------------------------------

@router.post("/regions/{region}/status")
def update_region_status(
    region: str,
    update: CalamityStatusUpdate,
    session: Session = Depends(get_session),
):
    """
    Update a region's calamity/critical status.

    This allows Program Officers to flag regions affected by natural calamities,
    which affects their priority scoring and visual indicators in the UI.

    Args:
        region: Region name to update
        update: CalamityStatusUpdate with critical_status and critical_reason

    Returns:
        Updated region gap analysis with new status

    Raises:
        HTTPException: If region not found or invalid status
    """
    from app.services.gap_score import compute_region_gap
    from app.models.models import RegionStatus

    # Validate status value
    valid_statuses = ["normal", "calamity", "emergency"]
    if update.critical_status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
        )

    # Verify region has data
    teachers = session.exec(select(Teacher).where(Teacher.region == region)).all()
    if not teachers:
        raise HTTPException(status_code=404, detail=f"Region '{region}' not found or has no teacher data")

    # Find existing status or create new one
    existing = session.exec(select(RegionStatus).where(RegionStatus.region == region)).first()

    if existing:
        # Update existing record
        existing.critical_status = update.critical_status
        existing.critical_reason = update.critical_reason
        existing.updated_at = datetime.utcnow()
        if update.critical_status == "normal":
            existing.resolved_at = datetime.utcnow()
        session.add(existing)
        session.commit()
    else:
        # Create new status record
        status = RegionStatus(
            region=region,
            critical_status=update.critical_status,
            critical_reason=update.critical_reason,
            declared_at=datetime.utcnow(),
        )
        session.add(status)
        session.commit()

    gap = compute_region_gap(region, session)

    return {
        **gap,
        "critical_status": update.critical_status,
        "critical_reason": update.critical_reason,
    }