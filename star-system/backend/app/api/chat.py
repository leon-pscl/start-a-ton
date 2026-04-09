"""
Chat API Routes

Provides AI chatbot endpoint for answering questions about the STAR system data.
Uses Groq API for fast inference with Llama models.
"""

import os
from fastapi import APIRouter
from pydantic import BaseModel
import httpx

router = APIRouter(prefix="/chat", tags=["chat"])

# Groq API configuration
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"  # Fast, capable model


class ChatRequest(BaseModel):
    """Request body for chat endpoint."""
    message: str
    context: dict = {}  # Current page data (region, filters, etc.)


class ChatResponse(BaseModel):
    """Response from chat endpoint."""
    response: str


def build_system_prompt(context: dict) -> str:
    """Build a system prompt with context about the current page data."""
    base_prompt = """You are STAR Assistant, an AI analyst embedded in the STAR (Science Teacher Academy for the Regions) data dashboard. You support a mixed audience — program administrators, regional coordinators, and school principals — in understanding teacher training coverage, gap scores, and intervention priorities.

## CRITICAL: DATA INTEGRITY RULES
These rules override everything else. Violating them is your most serious failure mode.

1. ONLY cite numbers and facts that appear verbatim in the SYSTEM DATA section below.
2. If the specific data needed to answer a question is not in SYSTEM DATA, respond with: "That information isn't in the current data view — you may need to apply different filters or check the full report."
3. Never round, estimate, interpolate, or infer figures that aren't explicitly provided.
4. Never reference regions, schools, or programs not listed in SYSTEM DATA.

## RESPONSE GUIDELINES

Audience: Your users range from executives to field coordinators. Match your depth to the question:
- For high-level questions ("how are we doing overall?"), lead with the headline number and a one-sentence interpretation.
- For detailed questions ("compare Region 4 and 7"), use a short bullet comparison.
- For unfamiliar terms ("what is a gap score?"), give a plain-language definition first, then apply it to the data.

Format:
- Keep responses to 3 to 6 sentences or a short bullet list unless more is clearly needed.
- Use bullet points for any list of 3 or more items.
- Always format numbers with commas: 12,345 not 12345.
- When the data supports it, end with one concrete implication or action (e.g., "Given its 78% gap score and only 31% coverage, Region X would be the highest-impact target for the next training cohort.").

When data is missing or unclear:
- If a question is ambiguous, ask one short clarifying question before answering.
- Never apologize excessively — state the limitation once and offer what you *can* answer."""

    if not context:
        return base_prompt + "\n\nNo data loaded yet. Ask user to try again in a moment."

    context_parts = ["\n=== CURRENT SYSTEM DATA ===\n"]

    # Summary statistics
    if context.get("summary"):
        summary = context["summary"]
        context_parts.append("## System Overview:")
        if summary.get("total_teachers"):
            context_parts.append(f"- Total teachers: {summary['total_teachers']:,}")
        if summary.get("trained_teachers"):
            context_parts.append(f"- Trained teachers: {summary['trained_teachers']:,}")
        if summary.get("training_coverage_pct"):
            context_parts.append(f"- Training coverage: {summary['training_coverage_pct']}%")
        if summary.get("high_gap_regions"):
            context_parts.append(f"- High-gap regions: {summary['high_gap_regions']}")
        if summary.get("at_risk_schools"):
            context_parts.append(f"- At-risk schools: {summary['at_risk_schools']}")
        if summary.get("out_of_field_pct"):
            context_parts.append(f"- Out-of-field teachers: {summary['out_of_field_pct']}%")
        if summary.get("competency_distribution"):
            dist = summary["competency_distribution"]
            context_parts.append(f"- Competency levels: Low={dist.get('low', 0)}, Medium={dist.get('medium', 0)}, High={dist.get('high', 0)}")
        if summary.get("star_modules"):
            context_parts.append(f"- STAR modules: {', '.join(summary['star_modules'])}")
        context_parts.append("")

    # Regional data
    if context.get("regions"):
        context_parts.append("## Regional Gap Analysis:")
        for r in context["regions"]:
            coverage = r.get('training_coverage_pct', 0) or 0
            context_parts.append(
                f"- {r['name']}: {r['gap_score']}% gap ({r['gap_level']}), "
                f"{r['total_teachers']} teachers, {coverage:.0f}% coverage"
            )
        context_parts.append("")

    # Top schools
    if context.get("top_schools"):
        context_parts.append("## Priority Schools (Top 20):")
        for s in context["top_schools"]:
            coverage = s.get('training_coverage_pct', 0) or 0
            context_parts.append(
                f"- {s['name']} ({s['region']}, {s.get('city', 'N/A')}): "
                f"{s['total_teachers']} teachers, {coverage:.0f}% coverage, {s['priority_level']} priority"
            )
        context_parts.append("")

    # Subject shortage data
    if context.get("subject_shortage"):
        context_parts.append("## Subject Specialization Shortage (by Region):")
        shortage = context["subject_shortage"]
        if isinstance(shortage, dict):
            # Summarize top subjects with shortages across all regions
            subject_totals = {}
            for subject, regions in shortage.items():
                if isinstance(regions, dict):
                    total = sum(regions.values())
                    subject_totals[subject] = total
            # Sort by total shortage
            sorted_subjects = sorted(subject_totals.items(), key=lambda x: -x[1])[:5]
            for subject, total in sorted_subjects:
                context_parts.append(f"- {subject}: {total} teachers needed")
        context_parts.append("")

    return base_prompt + "\n".join(context_parts)


@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Send a message to the AI chatbot.

    The chatbot has context about the current page data and can answer
    questions about teachers, regions, training, and gap scores.
    """
    if not GROQ_API_KEY:
        return ChatResponse(
            response="⚠️ Groq API key not configured. Set the GROQ_API_KEY environment variable on Render."
        )

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                GROQ_URL,
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": GROQ_MODEL,
                    "messages": [
                        {"role": "system", "content": build_system_prompt(request.context)},
                        {"role": "user", "content": request.message}
                    ],
                    "max_tokens": 1024,
                    "temperature": 0.7
                }
            )
            response.raise_for_status()
            data = response.json()
            return ChatResponse(response=data["choices"][0]["message"]["content"])

    except httpx.HTTPStatusError as e:
        error_msg = "API error"
        try:
            error_data = e.response.json()
            if "error" in error_data:
                error_msg = error_data["error"].get("message", str(e))
        except:
            pass
        return ChatResponse(response=f"❌ API Error: {error_msg}")
    except httpx.TimeoutException:
        return ChatResponse(response="⏱️ Request timed out. Please try again.")
    except Exception as e:
        return ChatResponse(response=f"❌ An error occurred: {str(e)}")