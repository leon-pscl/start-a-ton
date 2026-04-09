"""
Intelligent Recommendation Engine for STAR System

This module provides the logic for the "Explicit Recommendation Layer."
It transforms regional gap analysis data into natural language insights
and uses prescriptive analytics to rank interventions by potential impact.
"""

from typing import List, Dict, Any
from app.models.models import STAR_MODULES

# Thresholds for triggering specific recommendations
THRESHOLDS = {
    "coverage": 0.50,   # High percentage of untrained teachers
    "mismatch": 0.40,   # High subject specialization mismatch
    "workload": 0.70,   # High teacher-to-student burden (>35-40 students)
    "recency":  0.40,   # High percentage of stale training
    "distance": 0.50,   # Significant accessibility issues
}

def generate_recommendations(region_analysis: Dict[str, Any]) -> List[str]:
    """
    Generate natural language insights based on regional gap components.

    Args:
        region_analysis: Analysis dict from gap_score.compute_region_gap

    Returns:
        List[str]: Natural language recommendation strings
    """
    recs = []
    region = region_analysis.get("region", "Unknown Region")
    comps = region_analysis.get("components", {})

    # 1. Coverage Recommendation
    coverage_score = comps.get("coverage_score", 0.0)
    mismatch_score = comps.get("mismatch_score", 0.0)
    workload_score = comps.get("workload_score", 0.0)
    recency_score = comps.get("recency_score", 0.0)
    distance_score = comps.get("distance_score", 0.0)

    if coverage_score > THRESHOLDS["coverage"]:
        recs.append(
            f"Critical Coverage Gap: Over {int(coverage_score*100)}% of teachers in {region} have NO STAR training. "
            f"Prioritize basic capacity-building modules immediately."
        )

    # 2. Mismatch Recommendation (Science/Math focus)
    if mismatch_score > THRESHOLDS["mismatch"]:
        recs.append(
            f"Specialization Mismatch: High out-of-field teaching detected ({int(mismatch_score*100)}%). "
            f"Deploy 'Interdisciplinary Contextualization' and subject-specific content modules."
        )

    # 3. Workload Recommendation (Resource allocation)
    if workload_score > THRESHOLDS["workload"]:
        recs.append(
            f"High Instructional Burden: Teacher-to-student ratio is elevated ({region_analysis.get('avg_student_ratio', 0)}:1). "
            f"Consider 'Blended Learning Assessment' modules to optimize teacher time."
        )

    # 4. Recency Recommendation (Refresher)
    if recency_score > THRESHOLDS["recency"]:
        recs.append(
            f"Skill Stagnation: Significant portion of workforce hasn't been trained in 3+ years. "
            f"Schedule refresher workshops for 'Inquiry-based Science' and 'Modern Math Strategies'."
        )

    # 5. Distance Recommendation (Access mode)
    if distance_score > THRESHOLDS["distance"]:
        recs.append(
            f"Accessibility Barriers: Remote schools detected. Shift intervention to 'Online' or 'Blended' format "
            f"to bypass travel constraints."
        )

    # Default if no critical thresholds met
    if not recs:
        if region_analysis.get("gap_score", 0.0) < 0.3:
            recs.append(f"{region} is performing well. Maintain current engagement through advanced 'Cascade' programs.")
        else:
            recs.append(f"Monitor {region} for emerging gaps in specialization and workload balance.")

    return recs

def calculate_potential_impact(region_analysis: Dict[str, Any]) -> float:
    """
    Prescriptive Analytics: Rank interventions by 'Potential Impact'.
    
    Impact = Gap Score * Students Affected
    (Tries to maximize the 'Return on Training' in terms of student reach)
    """
    # Use total_students (we added this to region_analysis)
    return region_analysis["gap_score"] * region_analysis.get("total_students", 0)

def rank_interventions(all_regions_analysis: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Rank all regions by Potential Impact Score.
    """
    for region in all_regions_analysis:
        region["impact_score"] = round(calculate_potential_impact(region), 1)
        region["recommendations"] = generate_recommendations(region)
    
    return sorted(all_regions_analysis, key=lambda x: -x["impact_score"])
