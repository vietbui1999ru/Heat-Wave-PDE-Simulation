"""
Pydantic schemas for API request/response validation.
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional, Dict, Any, Literal
from enum import Enum


class EquationType(str, Enum):
    """Supported equation types."""
    HEAT = "heat"
    WAVE = "wave"


class BoundaryConditionType(str, Enum):
    """Boundary condition types."""
    DIRICHLET = "dirichlet"
    NEUMANN = "neumann"
    PERIODIC = "periodic"


class InitialConditionPreset(str, Enum):
    """Preset initial conditions."""
    GAUSSIAN = "gaussian"
    SINE = "sine"
    SQUARE_WAVE = "square_wave"
    TRIANGLE_WAVE = "triangle_wave"
    CUSTOM = "custom"


class BoundaryCondition(BaseModel):
    """Boundary condition configuration."""
    type: BoundaryConditionType = BoundaryConditionType.DIRICHLET
    left_value: float = 0.0
    right_value: float = 0.0
    time_dependent: bool = False


class InitialCondition(BaseModel):
    """Initial condition configuration."""
    type: InitialConditionPreset = InitialConditionPreset.GAUSSIAN
    expression: Optional[str] = None
    parameters: Dict[str, Any] = Field(default_factory=dict)

    # Allow 'preset' and 'params' for backwards compatibility
    class Config:
        populate_by_name = True


class SpatialDiscretization(BaseModel):
    """Spatial discretization parameters."""
    x_min: float = 0.0
    x_max: float = 1.0
    dx: float = 0.01

    @field_validator('dx')
    @classmethod
    def validate_dx(cls, v):
        if v <= 0:
            raise ValueError("dx must be positive")
        return v

    @field_validator('x_max')
    @classmethod
    def validate_domain(cls, v, info):
        if info.data.get('x_min') is not None and v <= info.data['x_min']:
            raise ValueError("x_max must be greater than x_min")
        return v


class TemporalDiscretization(BaseModel):
    """Temporal discretization parameters."""
    t_min: float = 0.0
    t_max: float = 1.0
    dt: float = 0.001

    @field_validator('dt')
    @classmethod
    def validate_dt(cls, v):
        if v <= 0:
            raise ValueError("dt must be positive")
        return v

    @field_validator('t_max')
    @classmethod
    def validate_domain(cls, v, info):
        if info.data.get('t_min') is not None and v <= info.data['t_min']:
            raise ValueError("t_max must be greater than t_min")
        return v


class PhysicalParameters(BaseModel):
    """Physical parameters for the equation."""
    beta: Optional[float] = Field(None, description="Thermal diffusivity (heat equation)", gt=0)
    c: Optional[float] = Field(None, description="Wave speed (wave equation)", gt=0)


class SimulationConfig(BaseModel):
    """Complete simulation configuration."""
    equation_type: EquationType
    spatial_domain: SpatialDiscretization
    temporal_domain: TemporalDiscretization
    physical_parameters: PhysicalParameters
    boundary_condition: BoundaryCondition
    initial_condition: InitialCondition
    name: Optional[str] = "Unnamed Simulation"

    class Config:
        populate_by_name = True


class ValidateConfigRequest(BaseModel):
    """Request to validate configuration."""
    config: SimulationConfig


class SimulationResponse(BaseModel):
    """Response for simulation creation."""
    simulation_id: str
    status: Literal["created", "running", "completed", "failed"]
    message: Optional[str] = None
    websocket_url: Optional[str] = None


class SimulationStatus(BaseModel):
    """Current simulation status."""
    simulation_id: str
    status: Literal["created", "running", "completed", "failed"]
    progress: float = Field(0.0, ge=0.0, le=1.0)
    current_time: Optional[float] = None
    message: Optional[str] = None


class SimulationData(BaseModel):
    """Simulation data packet for WebSocket streaming."""
    simulation_id: str
    time_index: int
    time_value: float
    x_values: list[float]
    u_values: list[float]
    metadata: Optional[Dict[str, Any]] = None


class SolutionMetadata(BaseModel):
    """Metadata for complete solution response."""
    global_min: float
    global_max: float
    nx: int
    nt: int
    computation_time_ms: float
    stability_parameter: float


class CompleteSolutionResponse(BaseModel):
    """Complete solution response with all data at once."""
    simulation_id: str
    config: SimulationConfig
    x_values: list[float]
    t_values: list[float]
    u_values: list[list[float]]
    metadata: SolutionMetadata
