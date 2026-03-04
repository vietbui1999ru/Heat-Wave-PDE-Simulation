"""
Heat equation solver using finite difference methods.
Implements forward Euler scheme with tri-diagonal matrix solver.
"""
import numpy as np

from .base_equation_solver import BaseEquationSolver

# CFL stability threshold for forward Euler heat equation
HEAT_CFL_LIMIT = 0.5


class HeatEquationSolver(BaseEquationSolver):
    """
    Solves 1D heat equation: du/dt = beta * d2u/dx2
    Uses forward Euler finite difference scheme.
    """

    def __init__(
        self,
        x_min: float,
        x_max: float,
        t_min: float,
        t_max: float,
        dx: float,
        dt: float,
        beta: float,
    ):
        super().__init__(x_min, x_max, t_min, t_max, dx, dt)
        self.beta = beta
        self.sigma = beta * dt / (dx ** 2)

    def check_stability(self) -> bool:
        """CFL condition: sigma = beta*dt/dx^2 < 0.5"""
        return self.sigma < HEAT_CFL_LIMIT

    def solve(self) -> np.ndarray:
        """Solve the heat equation. Returns array of shape (nt, nx)."""
        if self.u_initial is None:
            raise ValueError("Initial condition not set")

        # Build tri-diagonal matrix A
        main_diag = (1 - 2 * self.sigma) * np.ones(self.nx)
        off_diag = self.sigma * np.ones(self.nx - 1)
        A = np.diag(main_diag) + np.diag(off_diag, k=1) + np.diag(off_diag, k=-1)

        # Initialize solution matrix (nt x nx)
        u_matrix = np.zeros((self.nt, self.nx))
        u_matrix[0, :] = self.u_initial

        # Time-stepping loop (matrix-vector product is already vectorized spatially)
        for i in range(self.nt - 1):
            u_matrix[i + 1, :] = A @ u_matrix[i, :]
            self._enforce_boundary(u_matrix[i + 1])

        return u_matrix
