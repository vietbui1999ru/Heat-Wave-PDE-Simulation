"""
Application-wide constants and configuration.
"""
import os

# ---------------------------------------------------------------------------
# Streaming / animation
# ---------------------------------------------------------------------------

# Target frame rate for WebSocket streaming (legacy path).
STREAMING_FPS: int = 50

# Sleep delay between streamed frames in seconds (1 / STREAMING_FPS).
STREAMING_FRAME_DELAY: float = 1.0 / STREAMING_FPS  # 0.02 s

# Sleep interval while simulation is paused (seconds).
PAUSE_POLL_INTERVAL: float = 0.1

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------

# Comma-separated list of allowed origins.  Falls back to the local Vite dev
# server when the environment variable is not set.
_cors_env = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5743,http://localhost:5173")
ALLOWED_ORIGINS: list[str] = [o.strip() for o in _cors_env.split(",") if o.strip()]

# ---------------------------------------------------------------------------
# Grid size limits (edge-case protection)
# ---------------------------------------------------------------------------

# Maximum number of spatial or temporal grid points accepted per dimension.
MAX_GRID_POINTS: int = 10_000
