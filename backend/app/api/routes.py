"""
REST API routes for simulation configuration and control.
"""
import uuid

from fastapi import APIRouter, HTTPException
from typing import Dict, Any

from app.models.schemas import SimulationConfig, SimulationResponse, CompleteSolutionResponse
from app.services import simulation_service
from app.presets.simulation_presets import PRESETS

router = APIRouter()


@router.post("/simulations/validate", response_model=Dict[str, Any])
async def validate_configuration(config: SimulationConfig):
    """
    Validate simulation configuration parameters.
    Checks stability conditions and parameter ranges.
    """
    result = simulation_service.validate_configuration(config)
    return result


@router.post("/simulations/create", response_model=SimulationResponse)
async def create_simulation(config: SimulationConfig):
    """
    Create a new simulation instance.
    Returns simulation ID for WebSocket connection.
    """
    simulation_id = simulation_service.create_simulation(config)
    return SimulationResponse(
        simulation_id=simulation_id,
        status="created",
        websocket_url=f"ws://localhost:8001/ws/simulation/{simulation_id}"
    )


@router.post("/simulations/solve", response_model=CompleteSolutionResponse)
async def solve_simulation(config: SimulationConfig):
    """
    Compute complete simulation solution and return all data at once.
    Returns x_values, t_values, u_values, and metadata for client-side playback.
    """
    # Validate configuration
    validation_result = simulation_service.validate_configuration(config)
    if not validation_result.get("valid", False):
        errors = validation_result.get("errors", ["Unknown validation error"])
        raise HTTPException(status_code=422, detail=f"Configuration validation failed: {'; '.join(errors)}")

    # Solve complete simulation
    try:
        solution_data = simulation_service.solve_complete_simulation(config)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Simulation computation failed: {str(e)}")

    # Generate simulation ID for response
    simulation_id = str(uuid.uuid4())

    # Build response
    return CompleteSolutionResponse(
        simulation_id=simulation_id,
        config=config,
        x_values=solution_data["x_values"],
        t_values=solution_data["t_values"],
        u_values=solution_data["u_values"],
        metadata=solution_data["metadata"]
    )


@router.get("/simulations/{simulation_id}/status")
async def get_simulation_status(simulation_id: str):
    """
    Get current status of a simulation.
    """
    status = simulation_service.get_simulation_status(simulation_id)
    if not status:
        raise HTTPException(status_code=404, detail="Simulation not found")
    return status


@router.delete("/simulations/{simulation_id}")
async def delete_simulation(simulation_id: str):
    """
    Cancel and delete a simulation.
    """
    success = simulation_service.delete_simulation(simulation_id)
    if not success:
        raise HTTPException(status_code=404, detail="Simulation not found")
    return {"message": "Simulation deleted successfully"}


@router.get("/presets")
async def get_presets():
    """
    Get predefined simulation configurations.
    """
    return PRESETS
