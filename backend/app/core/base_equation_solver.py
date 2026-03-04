"""
Abstract base class for PDE equation solvers.
Provides shared grid generation, boundary condition handling, and solve interface.
"""
from abc import ABC, abstractmethod
from typing import Callable, Optional
import numpy as np

# Default discretization parameters
DEFAULT_DX = 0.01
DEFAULT_DT = 0.001


class BaseEquationSolver(ABC):
    """
    Abstract base for 1D PDE solvers using finite difference methods.
    Subclasses implement compute_stability_parameter() and solve().
    """

    def __init__(
        self,
        x_min: float,
        x_max: float,
        t_min: float,
        t_max: float,
        dx: float = DEFAULT_DX,
        dt: float = DEFAULT_DT,
    ):
        self.x_min = x_min
        self.x_max = x_max
        self.t_min = t_min
        self.t_max = t_max
        self.dx = dx
        self.dt = dt

        # Compute grid dimensions
        self.nx = int((x_max - x_min) / dx) + 1
        self.nt = int((t_max - t_min) / dt) + 1

        # Create coordinate arrays
        self.x = np.linspace(x_min, x_max, self.nx)
        self.t = np.linspace(t_min, t_max, self.nt)

        # Boundary conditions (Dirichlet)
        self.boundary_left: float = 0.0
        self.boundary_right: float = 0.0

        # Initial condition
        self.u_initial: Optional[np.ndarray] = None

    def set_initial_condition(self, initial_func: Callable[[np.ndarray], np.ndarray]):
        """Set initial condition u(x, 0)."""
        self.u_initial = initial_func(self.x)

    def set_boundary_conditions(self, left_val: float, right_val: float):
        """Set Dirichlet boundary conditions."""
        self.boundary_left = left_val
        self.boundary_right = right_val

    def _enforce_boundary(self, u_row: np.ndarray) -> None:
        """Apply Dirichlet boundary conditions in-place."""
        u_row[0] = self.boundary_left
        u_row[-1] = self.boundary_right

    @abstractmethod
    def check_stability(self) -> bool:
        """Check CFL stability condition for this equation type."""
        ...

    @abstractmethod
    def solve(self) -> np.ndarray:
        """Solve the PDE. Returns solution array of shape (nt, nx)."""
        ...
