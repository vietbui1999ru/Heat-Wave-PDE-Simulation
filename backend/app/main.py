"""
FastAPI main application for PDE simulation platform.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.api import routes
from app.websockets import handlers
from app.config import ALLOWED_ORIGINS

app = FastAPI(
    title="PDE Simulation Platform",
    description="Heat and Wave Equation Solver with Real-time Visualization",
    version="1.0.0"
)

# Compress large JSON responses (e.g. /api/simulations/solve can be ~8 MB).
# Only kicks in for responses >= 1 KB to avoid overhead on small payloads.
app.add_middleware(GZipMiddleware, minimum_size=1024)

# Configure CORS from environment variable (ALLOWED_ORIGINS).
# Defaults to http://localhost:5173 for local Vite dev server.
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(routes.router, prefix="/api")

# Include WebSocket routes (legacy streaming - see handlers.py)
app.include_router(handlers.router)


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "online", "service": "PDE Simulation Platform"}


@app.get("/health")
async def health():
    """Health check for container orchestration."""
    return {"status": "healthy"}
