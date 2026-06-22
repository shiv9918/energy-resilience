from fastapi import FastAPI

app = FastAPI(
    title="Energy Resilience API",
    description="AI-powered energy supply chain resilience platform",
    version="0.1.0",
)


@app.get("/health")
def health_check():
    return {"status": "ok"}
