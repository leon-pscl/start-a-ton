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

    if not context or not context.get("summary"):
        return base_prompt + "\n\nNote: No current data context available. Ask the user to provide specific numbers if they ask about statistics."

    # Add actual data summary
    summary = context.get("summary", {})
    context_parts = ["""
CURRENT DATA (use ONLY these numbers):
"""]

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
    if summary.get("total_training_records"):
        context_parts.append(f"- Total training records: {summary['total_training_records']:,}")

    if summary.get("competency_distribution"):
        dist = summary["competency_distribution"]
        context_parts.append(f"- Competency distribution: Low={dist.get('low', 0)}, Medium={dist.get('medium', 0)}, High={dist.get('high', 0)}")

    if summary.get("star_modules"):
        context_parts.append(f"- STAR modules: {', '.join(summary['star_modules'])}")

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