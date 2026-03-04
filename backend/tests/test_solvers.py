"""
Numerical solver tests - verifies BaseEquationSolver, HeatEquationSolver, WaveEquationSolver.
"""
import pytest
import numpy as np

from app.core.heat_equation_solver import HeatEquationSolver
from app.core.wave_equation_solver import WaveEquationSolver
from app.core.base_equation_solver import BaseEquationSolver


class TestBaseEquationSolver:
    """Test shared base class behavior."""

    def test_cannot_instantiate_abstract(self):
        with pytest.raises(TypeError):
            BaseEquationSolver(0, 1, 0, 1, 0.1, 0.01)  # type: ignore[abstract]

    def test_grid_generation(self):
        solver = HeatEquationSolver(0, 1, 0, 0.5, dx=0.1, dt=0.01, beta=0.1)
        assert solver.nx == 11
        assert solver.nt == 51
        assert len(solver.x) == 11
        assert len(solver.t) == 51
        np.testing.assert_allclose(solver.x[0], 0.0)
        np.testing.assert_allclose(solver.x[-1], 1.0)

    def test_boundary_conditions(self):
        solver = HeatEquationSolver(0, 1, 0, 0.5, dx=0.1, dt=0.01, beta=0.1)
        solver.set_boundary_conditions(1.0, 2.0)
        assert solver.boundary_left == 1.0
        assert solver.boundary_right == 2.0


class TestHeatEquationSolver:
    """Test heat equation solver."""

    def _make_solver(self, beta=0.1, dx=0.01, dt=0.0001):
        return HeatEquationSolver(0, 1, 0, 0.01, dx=dx, dt=dt, beta=beta)

    def test_stability_check_stable(self):
        solver = self._make_solver(beta=0.1, dx=0.01, dt=0.0001)
        # sigma = 0.1 * 0.0001 / 0.01^2 = 0.1
        assert solver.check_stability() is True
        assert pytest.approx(solver.sigma, rel=1e-6) == 0.1

    def test_stability_check_unstable(self):
        solver = self._make_solver(beta=0.5, dx=0.01, dt=0.01)
        # sigma = 0.5 * 0.01 / 0.0001 = 50
        assert solver.check_stability() is False

    def test_solve_raises_without_ic(self):
        solver = self._make_solver()
        with pytest.raises(ValueError, match="Initial condition not set"):
            solver.solve()

    def test_solve_shape(self):
        solver = self._make_solver()
        solver.set_initial_condition(lambda x: np.sin(np.pi * x))
        result = solver.solve()
        assert result.shape == (solver.nt, solver.nx)

    def test_boundary_enforced(self):
        solver = self._make_solver()
        solver.set_boundary_conditions(0.0, 0.0)
        solver.set_initial_condition(lambda x: np.sin(np.pi * x))
        result = solver.solve()
        np.testing.assert_allclose(result[:, 0], 0.0, atol=1e-15)
        np.testing.assert_allclose(result[:, -1], 0.0, atol=1e-15)

    def test_heat_diffuses(self):
        """Peak of Gaussian should decrease over time (heat diffuses)."""
        solver = self._make_solver(beta=0.1, dx=0.01, dt=0.0001)
        solver.set_initial_condition(lambda x: np.exp(-((x - 0.5) ** 2) / 0.01))
        result = solver.solve()
        assert result[0].max() > result[-1].max()


class TestWaveEquationSolver:
    """Test wave equation solver."""

    def _make_solver(self, c=1.0, dx=0.01, dt=0.005):
        return WaveEquationSolver(0, 1, 0, 0.1, dx=dx, dt=dt, c=c)

    def test_stability_check_stable(self):
        solver = self._make_solver(c=1.0, dx=0.01, dt=0.005)
        # sigma = (1.0 * 0.005 / 0.01)^2 = 0.25
        assert solver.check_stability() is True

    def test_stability_check_unstable(self):
        solver = self._make_solver(c=1.0, dx=0.01, dt=0.02)
        # sigma = (1.0 * 0.02 / 0.01)^2 = 4.0
        assert solver.check_stability() is False

    def test_solve_raises_without_position(self):
        solver = self._make_solver()
        solver.set_initial_velocity(lambda x: np.zeros_like(x))
        with pytest.raises(ValueError, match="Initial position not set"):
            solver.solve()

    def test_solve_raises_without_velocity(self):
        solver = self._make_solver()
        solver.set_initial_position(lambda x: np.sin(np.pi * x))
        with pytest.raises(ValueError, match="Initial velocity not set"):
            solver.solve()

    def test_solve_shape(self):
        solver = self._make_solver()
        solver.set_initial_position(lambda x: np.sin(np.pi * x))
        solver.set_initial_velocity(lambda x: np.zeros_like(x))
        result = solver.solve()
        assert result.shape == (solver.nt, solver.nx)

    def test_boundary_enforced(self):
        solver = self._make_solver()
        solver.set_boundary_conditions(0.0, 0.0)
        solver.set_initial_position(lambda x: np.sin(np.pi * x))
        solver.set_initial_velocity(lambda x: np.zeros_like(x))
        result = solver.solve()
        np.testing.assert_allclose(result[:, 0], 0.0, atol=1e-15)
        np.testing.assert_allclose(result[:, -1], 0.0, atol=1e-15)
