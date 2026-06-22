# Energy Resilience Platform

An AI-powered energy supply chain resilience platform that helps organizations anticipate and respond to disruptions in global energy markets.

## What it does

- **Geopolitical risk monitoring** — ingests news and macro data to score supply-route risk in near real time using LLM-based agents (LangGraph + Groq).
- **Disruption scenario simulation** — models the downstream impact of pipeline closures, sanctions, or port blockages on an organization's energy procurement.
- **Procurement rerouting recommendations** — suggests alternative suppliers, routes, and contracts to maintain supply continuity and minimize cost exposure.

## Project structure

```
energy-resilience/
  backend/         FastAPI application + LangGraph agents
    app/
      agents/      LangGraph agent graphs
      models/      Pydantic schemas and SQLAlchemy ORM models
      data/        Data loaders and preprocessing utilities
    requirements.txt
    .env.example
  frontend/        (UI — to be added)
  data/
    macro_panel.csv   Historical macro / geopolitical panel data
```

## Quick start

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env   # fill in your API keys
uvicorn app.main:app --reload
```

## Environment variables

| Variable        | Description                        |
|-----------------|------------------------------------|
| `GROQ_API_KEY`  | API key for Groq LLM inference     |
| `NEWS_API_KEY`  | API key for news data ingestion    |
