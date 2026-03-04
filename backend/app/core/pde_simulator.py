"""
Main PDE simulator orchestrator class.
Coordinates heat and wave equation solvers with boundary/initial conditions.
"""
from typing import Dict, Any, Optional
import numpy as np

from .heat_equation_solver import HeatEquationSolver
from .wave_equation_solver import WaveEquationSolver
from .stability_validator import StabilityValidator
from .initial_condition_manager import InitialConditionManager


class PDESimulator:
    """
    Main orchestrator for PDE simulations.
    Manages solver selection, configuration, and execution.
    """

    def __init__(self, config: Dict[str, Any]):
        """
        Initialize simulator with configuration.

        Args:
            config: Dictionary containing simulation parameters
        """
        self.config = config
        self.equation_type = config.get("equation_type", "heat")

        # Initialize components
        self.stability_validator = StabilityValidator()
        self.initial_manager = InitialConditionManager()

        # Initialize appropriate solver
        self.solver: Optional[HeatEquationSolver | WaveEquationSolver] = None
        self._initialize_solver()

    def _initialize_solver(self):
        """Initialize the appropriate solver based on equation type."""
        config = self.config

        if config["equation_type"] == "heat":
            self.solver = HeatEquationSolver(
                x_min=config["spatial_domain"]["x_min"],
                x_max=config["spatial_domain"]["x_max"],
                t_min=config["temporal_domain"]["t_min"],
                t_max=config["temporal_domain"]["t_max"],
                dx=config["spatial_domain"]["dx"],
                dt=config["temporal_domain"]["dt"],
                beta=config["physical_parameters"]["beta"]
            )

            # Set initial condition
            ic_manager = InitialConditionManager()
            ic_manager.set_preset(
                config["initial_condition"]["type"],
                config["initial_condition"].get("parameters", {})
            )
            ic_function = ic_manager.get_initial_condition()
            self.solver.set_initial_condition(ic_function)

            # Set boundary conditions
            bc = config["boundary_condition"]
            self.solver.set_boundary_conditions(
                bc.get("left_value", 0.0),
                bc.get("right_value", 0.0)
            )

        elif config["equation_type"] == "wave":
            self.solver = WaveEquationSolver(
                x_min=config["spatial_domain"]["x_min"],
                x_max=config["spatial_domain"]["x_max"],
                t_min=config["temporal_domain"]["t_min"],
                t_max=config["temporal_domain"]["t_max"],
                dx=config["spatial_domain"]["dx"],
                dt=config["temporal_domain"]["dt"],
                c=config["physical_parameters"]["c"]
            )

            # Set position initial condition
            ic_manager = InitialConditionManager()
            ic_manager.set_preset(
                config["initial_condition"]["type"],
                config["initial_condition"].get("parameters", {})
            )
            position_function = ic_manager.get_initial_condition()
            self.solver.set_initial_position(position_function)

            # Set velocity initial condition
            velocity_preset = config["initial_condition"].get("velocity_preset", "zero")
            ic_manager.set_initial_velocity(velocity_preset)
            velocity_function = ic_manager.get_initial_velocity()
            self.solver.set_initial_velocity(velocity_function)

            # Set boundary conditions
            bc = config["boundary_condition"]
            self.solver.set_boundary_conditions(
                bc.get("left_value", 0.0),
                bc.get("right_value", 0.0)
            )

    def validate(self) -> Dict[str, Any]:
        """
        Validate simulation configuration.

        Returns:
            Dictionary with validation results
        """
        if self.solver:
            return {"valid": self.solver.check_stability(), "solver": self.equation_type}
        return {"valid": False, "error": "Solver not initialized"}

    def solve(self) -> np.ndarray:
        """
        Execute the simulation.

        Returns:
            Solution array
        """
        if self.solver is None:
            raise ValueError("Solver not initialized")
        return self.solver.solve()

    def get_solution_at_time(self, t: float) -> np.ndarray:
        """
        Get solution at specific time step.

        Args:
            t: Time value

        Returns:
            Solution at time t
        """
        if self.solver is None:
            raise ValueError("Solver not initialized")
        # Find closest time index
        time_index = int(round((t - self.solver.t_min) / self.solver.dt))
        time_index = max(0, min(time_index, self.solver.nt - 1))
        return self.solver.solve()[time_index, :]
