# Team QCeb - START a Ton! Data & AI Innovation Challenge Submission

A data system that analyzes teacher training coverage, gap scores, and intervention priorities across the Philippines.

## Features

- **Dashboard** - System-wide summary statistics and key metrics
- **Regional Analysis** - Interactive map with gap analysis by region
- **School Intelligence** - Priority ranking of schools needing intervention
- **Teacher Profiles** - Browse and manage teacher records
- **Data Import** - Upload SF7 exports and/or training logs
- **AI Chatbot** - Ask questions about the data (powered by Groq/Llama)
- **PDF Reports** - Generate summary reports

## Tech Stack

- **Backend**: FastAPI, SQLModel, SQLite
- **Frontend**: React, Vite, TailwindCSS
- **AI**: Groq API (Llama 3.3)
- **Deployment**: Vercel (frontend), Render (backend)

## Running Locally

**This branch is configured for cloud deployment.**

To run the project locally with Ollama for the AI chatbot, switch to the `run-local` branch:

```bash
git checkout run-local
```

Then follow the setup instructions in that branch's README.

## Deployment

The main branch is configured for deployment:

- **Frontend**: Vercel (proxies `/api` to Render)
- **Backend**: Render (requires `GROQ_API_KEY` environment variable)
- **Database**: SQLite (seeded on first deploy)

### Required Environment Variables

```
GROQ_API_KEY=your_groq_api_key
```

## Project Structure

```
star-system/
├── backend/
│   ├── main.py              # FastAPI entry point
│   ├── seed.py              # Database seeding
│   ├── requirements.txt     # Python dependencies
│   └── app/
│       ├── api/             # API routes (teachers, analytics, chat, import)
│       ├── core/             # Database configuration
│       ├── models/           # SQLModel schemas
│       └── services/         # Business logic (gap scoring, reporting)
│
└── frontend/
    ├── src/                  # React components
    ├── package.json          # Node dependencies
    └── vite.config.js        # Vite configuration
```

## API Documentation

When running, visit:
- **Swagger UI**: `/docs`
- **ReDoc**: `/redoc`

## License

MIT