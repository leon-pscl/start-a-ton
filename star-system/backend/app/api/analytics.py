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

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select
import csv, io, json
from datetime import datetime
from app.core.database import get_session
from app.models.models import Teacher, TrainingRecord, STAR_MODULES
from app.services.gap_score import compute_all_regions, compute_region_gap, compute_province_gaps, compute_city_gaps, compute_subject_shortage
from app.services.recommendation import rank_interventions
from app.services.reporting import generate_executive_pdf

# Create router with /analytics prefix
router = APIRouter(prefix="/analytics", tags=["analytics"])


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
    # Count all teachers
    total = session.exec(select(Teacher)).all()

    # Get all trained teacher IDs by checking training records
    trained_ids = set(
        r.teacher_id for r in session.exec(select(TrainingRecord)).all() if r.teacher_id
    )
    trained = [t for t in total if t.id in trained_ids]

    # Compute gap scores for all regions
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

    Used by the Regions page to display the map and table.
    Now includes impact scoring and recommendations.
    """
    results = compute_all_regions(session)
    return rank_interventions(results)


@router.get("/regions/{region}")
def get_region_detail(region: str, session: Session = Depends(get_session)):
    """
    Get detailed analysis for a single region.

    In addition to gap scores, includes:
    - Subject breakdown: Teacher count per subject specialization
    - Module uptake: How many teachers have completed each STAR module

    This data powers the region detail panel when clicking a region on the map.
    """
    # Get gap scores
    gap = compute_region_gap(region, session)

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

    return {**gap, "subject_breakdown": subject_counts, "module_uptake": module_counts}


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

    # Generate CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)

    # Write header row
    writer.writerow([
        "ID", "Full Name", "Region", "Province", "City", "Division", "School",
        "Position", "Years Experience", "Highest Qualification",
        "Subject Specializations", "Grade Levels Taught", "Is Trained", "Source", "Data Confidence",
    ])

    # Write data rows
    for t in teachers:
        specs = ", ".join(json.loads(t.subject_specializations or "[]"))
        grades = ", ".join(json.loads(t.grade_levels_taught or "[]"))
        writer.writerow([
            t.id, t.full_name, t.region, t.province or "", t.city or "", t.division or "", t.school_name or "",
            t.position or "", t.years_experience or "", t.highest_qualification or "",
            specs, grades, t.id in trained_ids, t.source, t.data_confidence,
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
    results = compute_all_regions(session)
    ranked = rank_interventions(results)
    
    pdf_path = generate_executive_pdf(ranked)
    
    with open(pdf_path, "rb") as f:
        pdf_data = f.read()
    
    # Cleanup tmp file? (In production use a background task or unique names)
    # os.remove(pdf_path) 
    
    filename = f"star_executive_summary_{datetime.now().strftime('%Y%m%d')}.pdf"
    
    return StreamingResponse(
        io.BytesIO(pdf_data),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
    
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