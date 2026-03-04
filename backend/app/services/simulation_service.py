"""
Simulation service for managing simulation lifecycle.
"""
from typing import Dict, Any, Optional
import uuid
import asyncio
from datetime import datetime, timezone
import numpy as np
import time

from app.models.schemas import SimulationConfig
from app.core.pde_simulator import PDESimulator
from app.core.stability_validator import StabilityValidator
from app.config import (
    STREAMING_FRAME_DELAY,
    PAUSE_POLL_INTERVAL,
    MAX_GRID_POINTS,
)


class SimulationService:
    """
    Service layer for managing simulations.
    Handles creation, execution, and state management.
    """

    def __init__(self):
        """Initialize simulation service."""
        self.active_simulations: Dict[str, Dict[str, Any]] = {}
        self.stability_validator = StabilityValidator()

    def _check_grid_size(self, config: SimulationConfig) -> Optional[Dict[str, Any]]:
        """
        Guard against grids that are too large to process safely.

        Returns an error dict if the grid exceeds MAX_GRID_POINTS, else None.
        """
        nx = round((config.spatial_domain.x_max - config.spatial_domain.x_min) / config.spatial_domain.dx) + 1
        nt = round((config.temporal_domain.t_max - config.temporal_domain.t_min) / config.temporal_domain.dt) + 1

        if nx <= 0 or nt <= 0:
            return {
                "valid": False,
                "errors": ["Grid dimensions must be positive. Check x_min < x_max and t_min < t_max."],
                "sigma": None,
            }

        if nx > MAX_GRID_POINTS:
            return {
                "valid": False,
                "errors": [
                    f"Spatial grid too large: nx={nx} exceeds maximum of {MAX_GRID_POINTS}. "
                    "Increase dx or reduce the x domain."
                ],
                "sigma": None,
            }

        if nt > MAX_GRID_POINTS:
            return {
                "valid": False,
                "errors": [
                    f"Temporal grid too large: nt={nt} exceeds maximum of {MAX_GRID_POINTS}. "
                    "Increase dt or reduce the t domain."
                ],
                "sigma": None,
            }

        return None

    def create_simulation(self, config: SimulationConfig) -> str:
        """
        Create a new simulation instance.

        Args:
            config: Simulation configuration

        Returns:
            Simulation ID
        """
        simulation_id = str(uuid.uuid4())

        # Create simulator instance
        simulator = PDESimulator(config.model_dump())

        # Store simulation metadata
        self.active_simulations[simulation_id] = {
            "id": simulation_id,
            "config": config,
            "simulator": simulator,
            "status": "created",
            "created_at": datetime.now(timezone.utc),
            "progress": 0.0
        }

        return simulation_id

    def validate_configuration(self, config: SimulationConfig) -> Dict[str, Any]:
        """
        Validate simulation configuration.

        Args:
            config: Configuration to validate

        Returns:
            Validation results
        """
        # Reject zero-sized or oversized grids before anything else.
        grid_error = self._check_grid_size(config)
        if grid_error:
            return grid_error

        # Check parameter ranges first
        range_check = self.stability_validator.check_parameter_ranges(config.model_dump())
        if not range_check["valid"]:
            return range_check

        # Validate stability based on equation type
        if config.equation_type == "heat":
            return self.stability_validator.validate_heat_equation(
                beta=config.physical_parameters.beta or 0.1,
                dt=config.temporal_domain.dt,
                dx=config.spatial_domain.dx
            )
        elif config.equation_type == "wave":
            return self.stability_validator.validate_wave_equation(
                c=config.physical_parameters.c or 1.0,
                dt=config.temporal_domain.dt,
                dx=config.spatial_domain.dx
            )
        else:
            return {
                "valid": False,
                "errors": [f"Unknown equation type: {config.equation_type}"],
                "sigma": None
            }

    def get_simulation_status(self, simulation_id: str) -> Optional[dict]:
        """
        Get status of a simulation.

        Args:
            simulation_id: Simulation ID

        Returns:
            Simulation status or None if not found
        """
        if simulation_id not in self.active_simulations:
            return None

        sim = self.active_simulations[simulation_id]
        return {
            "simulation_id": simulation_id,
            "status": sim["status"],
            "progress": sim["progress"],
            "created_at": sim["created_at"].isoformat(),
            "message": f"Time step {int(sim['progress']*100)}% complete"
        }

    def delete_simulation(self, simulation_id: str) -> bool:
        """
        Delete a simulation.

        Args:
            simulation_id: Simulation ID

        Returns:
            True if deleted, False if not found
        """
        if simulation_id in self.active_simulations:
            del self.active_simulations[simulation_id]
            return True
        return False

    async def run_simulation(self, simulation_id: str):
        """
        Execute a simulation (async generator for streaming).

        LEGACY: Used by the WebSocket streaming path.  New code should call
        solve_complete_simulation() instead.

        Args:
            simulation_id: Simulation ID

        Yields:
            Solution data at each time step
        """
        if simulation_id not in self.active_simulations:
            raise ValueError(f"Simulation {simulation_id} not found")

        sim = self.active_simulations[simulation_id]
        simulator = sim["simulator"]
        config = sim["config"]

        # Update status
        sim["status"] = "running"

        # Get complete solution — shape: (nt, nx), kept as numpy array throughout
        solution: np.ndarray = simulator.solve()
        nt, nx = solution.shape

        # Compute x coordinates once; reused for every yielded frame
        x_values: list[float] = np.linspace(
            config.spatial_domain.x_min,
            config.spatial_domain.x_max,
            nx,
            dtype=np.float64,
        ).tolist()

        # Pre-compute per-row min/max to avoid redundant full-array scans
        row_min: np.ndarray = solution.min(axis=1)
        row_max: np.ndarray = solution.max(axis=1)

        # Stream each time step
        for time_index in range(nt):
            # Check if paused/stopped
            if sim["status"] == "paused":
                await asyncio.sleep(PAUSE_POLL_INTERVAL)
                continue
            if sim["status"] == "stopped":
                break

            time_value = config.temporal_domain.t_min + time_index * config.temporal_domain.dt

            # Update progress
            sim["progress"] = (time_index + 1) / nt

            # Yield data packet — convert row to list only when yielding
            yield {
                "simulation_id": simulation_id,
                "time_index": time_index,
                "time_value": time_value,
                "x_values": x_values,
                "u_values": solution[time_index].tolist(),
                "metadata": {
                    "max_value": float(row_max[time_index]),
                    "min_value": float(row_min[time_index]),
                }
            }

            # Control streaming speed using centralised constant (50 fps)
            await asyncio.sleep(STREAMING_FRAME_DELAY)

        # Mark as completed
        sim["status"] = "completed"
        sim["progress"] = 1.0

    def pause_simulation(self, simulation_id: str) -> bool:
        """Pause a running simulation."""
        if simulation_id in self.active_simulations:
            self.active_simulations[simulation_id]["status"] = "paused"
            return True
        return False

    def resume_simulation(self, simulation_id: str) -> bool:
        """Resume a paused simulation."""
        if simulation_id in self.active_simulations:
            self.active_simulations[simulation_id]["status"] = "running"
            return True
        return False

    def stop_simulation(self, simulation_id: str) -> bool:
        """Stop a running simulation."""
        if simulation_id in self.active_simulations:
            self.active_simulations[simulation_id]["status"] = "stopped"
            return True
        return False

    def solve_complete_simulation(self, config: SimulationConfig) -> Dict[str, Any]:
        """
        Compute complete simulation solution without storing state.

        Args:
            config: Simulation configuration

        Returns:
            Dictionary with x_values, t_values, u_values, and metadata
        """
        start_time = time.perf_counter()

        # Create simulator and solve — returns (nt, nx) C-contiguous numpy array
        simulator = PDESimulator(config.model_dump())
        solution: np.ndarray = simulator.solve()

        computation_time_ms = (time.perf_counter() - start_time) * 1000

        # Extract dimensions
        nt, nx = solution.shape

        # Compute global bounds in a single pass (no copies)
        global_min = float(solution.min())
        global_max = float(solution.max())

        # Build coordinate arrays — dtype float64 avoids implicit casting later
        x_values: list[float] = np.linspace(
            config.spatial_domain.x_min,
            config.spatial_domain.x_max,
            nx,
            dtype=np.float64,
        ).tolist()

        t_values: list[float] = np.linspace(
            config.temporal_domain.t_min,
            config.temporal_domain.t_max,
            nt,
            dtype=np.float64,
        ).tolist()

        # Convert solution to nested list — tolist() on a numpy array is the
        # fastest path; it avoids Python-level row iteration.
        u_values: list[list[float]] = solution.tolist()

        # Calculate stability parameter
        if config.equation_type == "heat":
            beta = config.physical_parameters.beta or 0.1
            sigma = beta * config.temporal_domain.dt / (config.spatial_domain.dx ** 2)
        elif config.equation_type == "wave":
            c = config.physical_parameters.c or 1.0
            sigma = (c * config.temporal_domain.dt / config.spatial_domain.dx) ** 2
        else:
            sigma = 0.0

        return {
            "x_values": x_values,
            "t_values": t_values,
            "u_values": u_values,
            "metadata": {
                "global_min": global_min,
                "global_max": global_max,
                "nx": nx,
                "nt": nt,
                "computation_time_ms": computation_time_ms,
                "stability_parameter": sigma,
            }
        }
