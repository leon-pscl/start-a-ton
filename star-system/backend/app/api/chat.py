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
Your role is to help users understand the education data displayed on their screen.

You can answer questions about:
- Teacher statistics and training coverage
- Regional gap scores and priorities
- School-level data and interventions
- Subject specializations and training needs

Be concise and helpful. If you don't know something based on the provided context, say so.
Format numbers with commas (e.g., "1,234 teachers").
Use bullet points for lists."""

    if not context:
        return base_prompt

    # Add context about current page/view
    context_parts = []
    if context.get("page"):
        context_parts.append(f"Current page: {context['page']}")
    if context.get("region"):
        context_parts.append(f"Selected region: {context['region']}")
    if context.get("summary"):
        summary = context["summary"]
        context_parts.append(f"""Current data summary:
- Total teachers: {summary.get('total_teachers', 'N/A'):,}
- Training coverage: {summary.get('training_coverage_pct', 'N/A')}%
- High-gap regions: {summary.get('high_gap_regions', 'N/A')}
- At-risk schools: {summary.get('at_risk_schools', 'N/A')}""")
    if context.get("selectedData"):
        context_parts.append(f"Selected data: {context['selectedData']}")

    if context_parts:
        return f"{base_prompt}\n\nCurrent context:\n" + "\n".join(context_parts)

    return base_prompt


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