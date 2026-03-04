"""
Wave equation solver using finite difference methods.
Implements central difference approximation for second-order PDE.
"""
from typing import Callable, Optional
import numpy as np

from .base_equation_solver import BaseEquationSolver

# CFL stability threshold for wave equation central difference
WAVE_CFL_LIMIT = 1.0


class WaveEquationSolver(BaseEquationSolver):
    """
    Solves 1D wave equation: d2u/dt2 = c^2 * d2u/dx2
    Uses central difference finite difference scheme (three-level time stepping).
    """

    def __init__(
        self,
        x_min: float,
        x_max: float,
        t_min: float,
        t_max: float,
        dx: float,
        dt: float,
        c: float,
    ):
        super().__init__(x_min, x_max, t_min, t_max, dx, dt)
        self.c = c
        self.sigma = (c * dt / dx) ** 2
        self.v_initial: Optional[np.ndarray] = None

    def set_initial_position(self, position_func: Callable[[np.ndarray], np.ndarray]):
        """Set initial position u(x, 0)."""
        self.u_initial = position_func(self.x)

    def set_initial_velocity(self, velocity_func: Callable[[np.ndarray], np.ndarray]):
        """Set initial velocity du/dt(x, 0)."""
        self.v_initial = velocity_func(self.x)

    def check_stability(self) -> bool:
        """CFL condition: sigma = (c*dt/dx)^2 <= 1"""
        return self.sigma <= WAVE_CFL_LIMIT

    def solve(self) -> np.ndarray:
        """Solve the wave equation. Returns array of shape (nt, nx)."""
        if self.u_initial is None:
            raise ValueError("Initial position not set")
        if self.v_initial is None:
            raise ValueError("Initial velocity not set")

        # Build tri-diagonal matrix A
        main_diag = 2 * (1 - self.sigma) * np.ones(self.nx)
        off_diag = self.sigma * np.ones(self.nx - 1)
        A = np.diag(main_diag) + np.diag(off_diag, k=1) + np.diag(off_diag, k=-1)

        # Initialize solution matrix
        u_matrix = np.zeros((self.nt, self.nx))
        u_matrix[0, :] = self.u_initial

        # First time step using initial velocity and position
        u_matrix[1, :] = (A @ self.u_initial - (self.u_initial + self.dt * self.v_initial)) / 2
        self._enforce_boundary(u_matrix[1])

        # Three-level time-stepping (matrix-vector product is already vectorized spatially)
        for i in range(1, self.nt - 1):
            u_matrix[i + 1, :] = A @ u_matrix[i, :] - u_matrix[i - 1, :]
            self._enforce_boundary(u_matrix[i + 1])

        return u_matrix
