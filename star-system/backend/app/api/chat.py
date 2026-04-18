"""
Chat API Routes

Provides AI chatbot endpoint for answering questions about the STAR system data.
Uses Ollama for local LLM inference (http://localhost:11434).

Demo Mode: Set DEMO_MODE=true (default) to use pre-determined responses with strict keyword matching.
"""

import os
import httpx
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/chat", tags=["chat"])

# Ollama configuration (runs locally by default)
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")

# Demo mode configuration
DEMO_MODE = os.getenv("DEMO_MODE", "true").lower() == "true"

# Pre-determined Q&A pairs for demo mode
DEMO_RESPONSES = {
    "which regions need the most intervention": "The regions that need the most intervention are the ones that have the highest gap scores. These regions are **Region IV-B**, **Region IX**, and **Region VIII** among others.",

    "what interventions can i implement for those regions": "Each region has different needs. Based on the data:\n\n- **Region IV-B** has the highest gap score as it is severely underserved. Training for supplementary modules hasn't reached teachers in the area, and instructional workload is quite heavy.\n\n- **Region IX** - most teachers have difficulty reaching training areas, so training coverage is also scarce. Trained teachers, if present at all, were last trained years ago.\n\n- For areas like **NCR**, instructional workload is the main problem, as there are few teachers for so many students.",

    "what is the overall training coverage": "The overall training coverage across all regions is approximately **68%**. This means about two-thirds of teachers have received some form of training through the STAR program. The remaining 32% represents teachers who have not yet been reached by training initiatives, with the highest gaps concentrated in **Region IV-B**, **Region IX**, and **Region VIII**.",

    "what is a gap score": "A **gap score** is a composite metric that measures the training and support deficit in a region or school. It takes into account:\n\n- **Training coverage** - percentage of teachers who have received training\n- **Out-of-field teaching** - teachers teaching subjects outside their specialization\n- **Instructional workload** - student-to-teacher ratios\n\nHigher gap scores indicate areas needing urgent intervention. Scores are categorized as **Low**, **Moderate**, or **Critical**.",

    "how many schools are at critical priority": "Based on current data, there are **23 schools** classified as **Critical priority**. These schools have the highest gap scores and lowest training coverage. They should be prioritized for immediate intervention programs. The top critical schools are primarily located in **Region IV-B** and **Region IX**.",

    "what subjects have the most teacher shortages": "The subjects with the most significant teacher shortages are:\n\n- **Physics** - highest demand, particularly in rural regions\n- **Chemistry** - second highest shortage area\n- **Earth Science** - growing need as curriculum expands\n- **Biology** - moderate shortages across most regions\n\nThese shortages are most acute in **Region IV-B** and **Region IX** where specialized science teachers are scarce.",

    "what is the competency level distribution": "The competency level distribution of trained teachers is:\n\n- **High competency**: ~35% - can lead training sessions\n- **Medium competency**: ~45% - proficient in their specialization\n- **Low competency**: ~20% - recently trained, developing skills\n\nRegions with lower training coverage tend to have fewer high-competency teachers available to mentor others.",

    "which regions have the best training coverage": "The regions with the best training coverage are:\n\n- **Region III (Central Luzon)** - 82% coverage\n- **Region IV-A (CALABARZON)** - 78% coverage\n- **Region VII (Central Visayas)** - 75% coverage\n\nThese regions have well-established training centers and better accessibility for teachers. They can serve as models for improving coverage in underserved regions.",

    "how can i improve training in remote regions": "For remote regions with low coverage, consider these strategies:\n\n- **Mobile training units** - bring training directly to schools\n- **Online modules** - for teachers who cannot travel\n- **Cluster training** - train teachers from nearby schools together\n- **Peer mentoring** - leverage high-competency teachers to coach others\n- **Partnerships** - collaborate with local universities for resources\n\n**Region IX** would benefit most from mobile and online approaches due to accessibility challenges.",

    "how do i use the planning and simulation page": "The **Planning & Simulation** page helps you forecast the impact of training interventions:\n\n1. **Go to Interventions** from the sidebar\n2. **Select a region** using the dropdown to focus your planning\n3. **Use the Training Simulator** to model different scenarios:\n   - Enter the number of teachers you plan to train\n   - Adjust the expected competency uplift percentage\n   - Click **Simulate** to see projected outcomes\n4. **Review Reassignment Suggestions** for teacher relocation recommendations\n5. **Export results** using the download buttons for reports\n\nThe simulator shows how training investments can reduce gap scores and improve coverage over time."
}


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
- When the data supports it, end with one concrete implication or action.

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

    # Regional insights (detailed)
    if context.get("regional_insights"):
        context_parts.append("## Regional Insights (Detailed):")
        for ri in context["regional_insights"][:10]:  # Limit to first 10 for token efficiency
            context_parts.append(
                f"- {ri['region']}: {ri['total_teachers']} teachers, "
                f"{ri['training_coverage_pct']:.1f}% coverage, "
                f"{ri['out_of_field_pct']:.1f}% out-of-field, "
                f"{ri['critical_schools']} critical schools, "
                f"competency: {ri.get('avg_competency_score', 'N/A')}"
            )
        context_parts.append("")

    # Schools data
    if context.get("all_schools"):
        context_parts.append("## All Schools (Summary):")
        # Group by priority level
        critical = [s for s in context["all_schools"] if s.get("priority_level") == "Critical"]
        moderate = [s for s in context["all_schools"] if s.get("priority_level") == "Moderate"]
        low = [s for s in context["all_schools"] if s.get("priority_level") == "Low"]
        context_parts.append(f"- Critical priority: {len(critical)} schools")
        context_parts.append(f"- Moderate priority: {len(moderate)} schools")
        context_parts.append(f"- Low priority: {len(low)} schools")
        # Top 5 critical schools
        if critical:
            context_parts.append("- Top critical schools:")
            for s in critical[:5]:
                context_parts.append(f"  - {s['name']} ({s['region']}): {s['total_teachers']} teachers, {s.get('training_coverage_pct', 0):.0f}% coverage")
        context_parts.append("")

    # Subject shortage data
    if context.get("subject_shortage"):
        context_parts.append("## Subject Specialization Shortage:")
        shortage = context["subject_shortage"]
        if isinstance(shortage, dict):
            subject_totals = {}
            for subject, regions in shortage.items():
                if isinstance(regions, dict):
                    total = sum(regions.values())
                    subject_totals[subject] = total
            sorted_subjects = sorted(subject_totals.items(), key=lambda x: -x[1])[:10]
            for subject, total in sorted_subjects:
                context_parts.append(f"- {subject}: {total} teachers needed")
        context_parts.append("")

    return base_prompt + "\n".join(context_parts)


def match_demo_response(user_message: str) -> str | None:
    """
    Match user message to a demo response using strict keyword matching.
    Returns the demo response if a good match is found, None otherwise.
    """
    msg = user_message.lower().strip()

    # Direct phrase matching for high-confidence matches
    if any(phrase in msg for phrase in ["which region", "what region", "region need", "region that need"]):
        if any(word in msg for word in ["intervention", "help", "most", "priority", "critical", "gap"]):
            return DEMO_RESPONSES["which regions need the most intervention"]

    if any(phrase in msg for phrase in ["how to improve", "improve training", "strategies", "recommend"]):
        if any(word in msg for word in ["remote", "region", "training"]):
            return DEMO_RESPONSES["how can i improve training in remote regions"]

    if "intervention" in msg and any(word in msg for word in ["implement", "do", "apply", "action"]):
        return DEMO_RESPONSES["what interventions can i implement for those regions"]

    if "training coverage" in msg or "overall training" in msg:
        return DEMO_RESPONSES["what is the overall training coverage"]

    if "gap score" in msg or ("what is gap" in msg):
        return DEMO_RESPONSES["what is a gap score"]

    if "critical" in msg and any(word in msg for word in ["school", "how many", "count"]):
        return DEMO_RESPONSES["how many schools are at critical priority"]

    if "shortage" in msg and any(word in msg for word in ["subject", "teacher", "specialization"]):
        return DEMO_RESPONSES["what subjects have the most teacher shortages"]

    if "competency" in msg and any(word in msg for word in ["distribution", "level", "breakdown"]):
        return DEMO_RESPONSES["what is the competency level distribution"]

    if "best" in msg and "training" in msg and "coverage" in msg:
        return DEMO_RESPONSES["which regions have the best training coverage"]

    if any(phrase in msg for phrase in ["planning", "simulation", "simulate", "training simulator"]):
        return DEMO_RESPONSES["how do i use the planning and simulation page"]

    return None


DEMO_HELP_TEXT = """I can answer these questions in demo mode:

**Regions & Interventions:**
• Which regions need the most intervention?
• What interventions can I implement?
• Which regions have the best training coverage?

**Training & Coverage:**
• What is the overall training coverage?
• What is a gap score?
• What is the competency level distribution?

**Schools & Teachers:**
• How many schools are at critical priority?
• What subjects have teacher shortages?

**Navigation:**
• How do I use the planning and simulation page?

For more detailed answers, enable Ollama by setting `DEMO_MODE=false`."""


@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Send a message to the AI chatbot.

    Demo Mode (DEMO_MODE=true): Uses pre-determined responses with strict keyword matching.
    Normal Mode: Uses Ollama for local LLM inference.
    """
    # Demo mode: use pre-determined responses
    if DEMO_MODE:
        demo_response = match_demo_response(request.message)
        if demo_response:
            return ChatResponse(response=demo_response)
        return ChatResponse(response=DEMO_HELP_TEXT)


@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Send a message to the AI chatbot.

    Demo Mode (DEMO_MODE=true): Uses pre-determined responses with fuzzy matching.
    Normal Mode: Uses Ollama for local LLM inference.
    """
    # Demo mode: use pre-determined responses
    if DEMO_MODE:
        demo_response = fuzzy_match_demo_response(request.message)
        if demo_response:
            return ChatResponse(response=demo_response)
        return ChatResponse(
            response="I don't have a pre-determined response for that question in demo mode. "
                     "Try asking about regions that need intervention or recommended interventions."
        )

    # Normal mode: use Ollama
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
            response=f"⚠️ Cannot connect to Ollama at {OLLAMA_URL}.\n\n"
                     "Make sure Ollama is running:\n"
                     "  1. Install: https://ollama.ai\n"
                     "  2. Run: ollama serve\n"
                     "  3. Pull a model: ollama pull {OLLAMA_MODEL}"
        )
    except httpx.HTTPStatusError as e:
        error_msg = "Ollama error"
        try:
            error_data = e.response.json()
            if "error" in error_data:
                error_msg = error_data["error"]
        except:
            pass
        return ChatResponse(response=f"❌ Ollama Error: {error_msg}")
    except httpx.TimeoutException:
        return ChatResponse(response="⏱️ Request timed out. The model may be loading, try again.")
    except Exception as e:
        return ChatResponse(response=f"❌ An error occurred: {str(e)}")