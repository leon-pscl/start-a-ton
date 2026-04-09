"""
Advanced Reporting Service - PDF Executive Summary Generation

This module generates a stakeholder-ready PDF report containing:
- Executive Summary of the STAR program status
- Regional WPI comparisons (Charts)
- Priority Interventions (Intelligent Recommendations)
- Subject-specific shortage analysis
"""

import os
import tempfile
from fpdf import FPDF
import matplotlib
matplotlib.use("Agg", force=True)
import matplotlib.pyplot as plt
import io
from datetime import datetime
from typing import List, Dict, Any

class STARReport(FPDF):
    def header(self):
        # Logo placeholder (if any)
        self.set_font('helvetica', 'B', 15)
        self.cell(0, 10, 'STAR Program: Regional Gap Analysis & Executive Summary', border=False, ln=True, align='C')
        self.set_font('helvetica', 'I', 10)
        self.cell(0, 10, f'Report Generated: {datetime.now().strftime("%B %d, %Y")}', border=False, ln=True, align='C')
        self.ln(10)

    def footer(self):
        self.set_y(-15)
        self.set_font('helvetica', 'I', 8)
        self.cell(0, 10, f'Page {self.page_no()}/{{nb}} - DOST-SEI STAR Integrated Data System', align='C')

def create_wpi_chart(regions: List[Dict[str, Any]]) -> io.BytesIO:
    """Create a bar chart of WPI scores for the top 10 priority regions."""
    # Sort and take top 10
    top_10 = sorted(regions, key=lambda x: -x["gap_score"])[:10]
    names = [r["region"] for r in top_10]
    scores = [r["gap_score"] for r in top_10]

    plt.figure(figsize=(10, 6))
    colors = ['#d32f2f' if s >= 0.7 else '#f57c00' if s >= 0.4 else '#388e3c' for s in scores]
    plt.bar(names, scores, color=colors)
    plt.axhline(y=0.7, color='r', linestyle='--', alpha=0.5, label='High Priority Threshold')
    plt.title('Top 10 Priority Regions by Weighted Priority Index (WPI)')
    plt.ylabel('WPI Score (0-1)')
    plt.xticks(rotation=45, ha='right')
    plt.tight_layout()

    img_buf = io.BytesIO()
    plt.savefig(img_buf, format='png')
    img_buf.seek(0)
    plt.close()
    return img_buf

def generate_executive_pdf(regions_analysis: List[Dict[str, Any]], filename: str = "star_executive_summary.pdf") -> str:
    """
    Generates a full PDF report.
    Returns path to the generated PDF file.
    """
    # Use temp directory for all file operations (works on Render)
    temp_dir = tempfile.gettempdir()

    pdf = STARReport()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)

    # 1. Executive Summary Table
    pdf.set_font('helvetica', 'B', 12)
    pdf.cell(0, 10, '1. National Overview', ln=True)
    pdf.set_font('helvetica', '', 10)

    total_teachers = sum(r.get("total_teachers", 0) for r in regions_analysis)
    high_priority = sum(1 for r in regions_analysis if r.get("gap_level") == "high")
    avg_wpi = sum(r.get("gap_score", 0) for r in regions_analysis) / len(regions_analysis) if regions_analysis else 0

    summary_text = (
        f"The current analysis covers {len(regions_analysis)} regions and a total of {total_teachers} teachers. "
        f"Nationwide, {high_priority} regions have been identified as High Priority (WPI >= 0.70). "
        f"The national average Weighted Priority Index stands at {avg_wpi:.2f}."
    )
    pdf.multi_cell(0, 10, summary_text)
    pdf.ln(5)

    # 2. WPI Visualization
    pdf.set_font('helvetica', 'B', 12)
    pdf.cell(0, 10, '2. Priority Visualization', ln=True)

    # Create chart with safe data
    safe_regions = [
        {"region": r.get("region", "Unknown"), "gap_score": r.get("gap_score", 0)}
        for r in regions_analysis
    ]
    chart_buf = create_wpi_chart(safe_regions)

    # Write chart to temp file
    tmp_chart = os.path.join(temp_dir, "tmp_wpi_chart.png")
    with open(tmp_chart, "wb") as f:
        f.write(chart_buf.getbuffer())

    pdf.image(tmp_chart, x=15, w=180)
    pdf.ln(5)
    os.remove(tmp_chart)

    # 3. Top 5 Priorities & Recommendations
    pdf.add_page()
    pdf.set_font('helvetica', 'B', 12)
    pdf.cell(0, 10, '3. Critical Interventions by Region', ln=True)

    top_5 = sorted(regions_analysis, key=lambda x: -x.get("impact_score", 0))[:5]

    for r in top_5:
        pdf.set_font('helvetica', 'B', 11)
        pdf.set_fill_color(240, 240, 240)
        pdf.cell(0, 10, f'REGION: {r.get("region", "Unknown")} (WPI: {r.get("gap_score", 0):.2f})', ln=True, fill=True)

        pdf.set_font('helvetica', 'B', 10)
        pdf.cell(30, 8, 'Metric', border=1)
        pdf.cell(30, 8, 'Score', border=1)
        pdf.cell(0, 8, 'Status', border=1, ln=True)

        pdf.set_font('helvetica', '', 9)
        components = r.get("components", {})
        if components:
            for name, score in components.items():
                status = "CRITICAL" if score > 0.6 else "STABLE"
                pdf.cell(30, 7, name.replace("_score", "").title(), border=1)
                pdf.cell(30, 7, f"{score:.2f}", border=1)
                pdf.cell(0, 7, status, border=1, ln=True)
        else:
            pdf.cell(0, 7, "No component data available", border=1, ln=True)

        pdf.ln(2)
        pdf.set_font('helvetica', 'I', 10)
        recommendations = r.get("recommendations", [])
        rec_text = recommendations[0] if recommendations else "No specific recommendations available."
        pdf.multi_cell(0, 8, f"Impact-Weighted Recommendation: {rec_text}")
        pdf.ln(5)

    # 4. Global Policy Recommendations
    pdf.set_font('helvetica', 'B', 12)
    pdf.cell(0, 10, '4. Strategic Recommendations', ln=True)
    pdf.set_font('helvetica', '', 10)

    policy_recs = [
        "Digital Transformation: Shift remote regions (High Distance Score) to asynchronous blended modules.",
        "Retention & Recency: Mandatory refresher cycles every 3 years for regions with Recency Score > 0.4.",
        "Workload Balancing: Deploy teaching assistants or assessment-reduction modules in high S/T regions.",
        "Subject Alignment: Targeted recruitment/retraining for regions emphasizing Physics and Chemistry shortages."
    ]
    for prec in policy_recs:
        # Starting X for the bullet
        current_x = pdf.get_x()
        pdf.cell(5, 10, "-", ln=0)
        # Calculate remaining width manually to be safe
        remaining_width = pdf.w - pdf.r_margin - pdf.get_x()
        pdf.multi_cell(remaining_width, 10, prec)
        pdf.ln(2)

    # Output to temp directory
    output_path = os.path.join(temp_dir, filename)
    pdf.output(output_path)
    return output_path
