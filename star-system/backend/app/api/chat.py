"""
Chat API Routes

Provides AI chatbot endpoint for answering questions about the STAR system data.
Uses Ollama running locally to process queries with page context.
"""

from fastapi import APIRouter
from pydantic import BaseModel
import httpx

router = APIRouter(prefix="/chat", tags=["chat"])

# Ollama configuration
OLLAMA_URL = "http://localhost:11434"
OLLAMA_MODEL = "llama3.2"  # Fast model, good for simple Q&A


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
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{OLLAMA_URL}/api/chat",
                json={
                    "model": OLLAMA_MODEL,
                    "messages": [
                        {"role": "system", "content": build_system_prompt(request.context)},
                        {"role": "user", "content": request.message}
                    ],
                    "stream": False
                }
            )
            response.raise_for_status()
            data = response.json()
            return ChatResponse(response=data["message"]["content"])

    except httpx.ConnectError:
        return ChatResponse(
            response="⚠️ Unable to connect to Ollama. Make sure Ollama is running locally on port 11434. "
                     "Run `ollama serve` in your terminal to start it."
        )
    except httpx.TimeoutException:
        return ChatResponse(
            response="⏱️ The request timed out. The model might be loading. Please try again in a moment."
        )
    except Exception as e:
        return ChatResponse(
            response=f"❌ An error occurred: {str(e)}"
        )