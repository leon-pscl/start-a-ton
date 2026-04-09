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
    base_prompt = """You are an AI assistant for the STAR (Science Teacher Academy for the Regions) data system.

IMPORTANT: Only use the data provided in the context below. Do not make up numbers or statistics.
If you don't have specific data, say "I don't have that specific data available" rather than guessing.

You can help users understand:
- Teacher statistics and training coverage
- Regional gap scores and priorities
- School-level data and interventions

Be concise and helpful. Format numbers with commas (e.g., "1,234 teachers")."""

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

    if summary.get("star_modules"):
        context_parts.append(f"## STAR Modules Available:\n{', '.join(summary['star_modules'])}")

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