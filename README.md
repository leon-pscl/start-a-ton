# STAR System - Science Teacher Academy for the Regions

A data dashboard for analyzing teacher training coverage, gap scores, and intervention priorities across the Philippines. 

This branch is meant to be run locally.

## Prerequisites

- **Python 3.10+** - for the backend API
- **Node.js 18+** - for the frontend
- **Ollama** (optional) - for AI chatbot features

## First-Time Setup

### 1. Backend Setup

Open a terminal and run:

```bash
cd star-system/backend

# Create and activate virtual environment
python -m venv venv

# Activate (choose one based on your shell)
venv\Scripts\activate          # PowerShell
venv\Scripts\activate.bat      # Command Prompt
source venv/Scripts/activate  # Git Bash

# Install dependencies
pip install -r requirements.txt

# Initialize database with mock data
python seed.py
```

This creates the SQLite database (`star.db`) with sample teacher and training data.

### 2. Frontend Setup

Open a **new terminal** and run:

```bash
cd star-system/frontend
npm install
```

## Running the Application

After the initial setup, start both servers:

### Terminal 1 - Backend (API Server)
```bash
cd star-system/backend
venv\Scripts\activate          # Or use the appropriate activate command
uvicorn main:app --reload --port 8000
```

### Terminal 2 - Frontend (Web App)
```bash
cd star-system/frontend
npm run dev
```

The app will be available at `http://localhost:5173`.

### Login

Use the built-in authentication:
- **Role**: Program Officer / Regional Coordinator (full access) or Teacher (limited view)
- **Name**: Any name (authentication is simulated for local development)

### 1. Backend Setup

Open a terminal and run:

```bash
cd star-system/backend

# Create and activate virtual environment
python -m venv venv

# Activate (choose one based on your shell)
venv\Scripts\activate          # PowerShell
venv\Scripts\activate.bat      # Command Prompt
source venv/Scripts/activate  # Git Bash

# Install dependencies
pip install -r requirements.txt

# Initialize database with mock data
python seed.py

# Start the API server
uvicorn main:app --reload --port 8000
```

### AI Chatbot (Optional)

The chatbot uses Ollama for local LLM inference. To enable it:

```bash
# Install Ollama from https://ollama.ai

# In a new terminal:
# Pull the model (choose one)
ollama pull llama3.2      # Recommended, fast
ollama pull llama3.1      # Larger, more capable

# Start Ollama server
ollama serve
```

**Environment variables (optional):**
```bash
OLLAMA_URL=http://localhost:11434  # Default
OLLAMA_MODEL=llama3.2               # Default model
```

If Ollama is not running, the chatbot will show a helpful error message with setup instructions.

## Features

### Calamity Status Management

Program Officers can flag regions affected by natural calamities or emergencies:

1. Navigate to **Regional Analysis → Regional gaps**
2. Click on a region to view details
3. Click **"Mark calamity status"** in the region panel
4. Select status: `normal`, `calamity`, or `emergency`
5. Enter a reason and save

**Visual indicators:**
- **Calamity**: Amber dashed border on map
- **Emergency**: Red dashed border with pulsing effect
- Affected regions appear at the top of the list
- Use the **Calamity** filter to show only affected regions

## Project Structure

```
star-system/
├── backend/
│   ├── main.py              # FastAPI entry point
│   ├── seed.py              # Database seeding script
│   ├── requirements.txt     # Python dependencies
│   └── app/
│       ├── api/             # API route handlers
│       ├── core/            # Database config
│       ├── models/          # SQLModel schemas
│       └── services/        # Business logic
│
└── frontend/
    ├── src/                 # React components
    ├── package.json         # Node dependencies
    └── vite.config.js       # Vite config (proxies /api to backend)
```

## Reset Database

To start fresh:

```bash
cd star-system/backend
rm star.db                  # Delete database
python seed.py              # Re-seed with mock data
```

## API Documentation

With the backend running, visit:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

## Troubleshooting

**`python -m venv venv` fails**
- Delete the existing `venv` folder and try again

**Frontend can't connect to backend**
- Make sure the backend is running on port 8000
- Check that `vite.config.js` proxies `/api` correctly

**Chatbot shows connection error**
- Ensure Ollama is running: `ollama serve`
- Verify model is installed: `ollama list`
