import { useState, useCallback } from 'react';
import { SimulationConfig, CompleteSolution, SimulationStatus } from '../types/simulation';
import { solveSimulation, validateConfiguration } from '../services/api';

interface UseSimulationReturn {
  completeSolution: CompleteSolution | null;
  isComputing: boolean;
  status: SimulationStatus;
  error: string | null;
  clearError: () => void;
  solve: (config: SimulationConfig) => Promise<void>;
  clearSolution: () => void;
  setStatus: (status: SimulationStatus) => void;
}

export function useSimulation(): UseSimulationReturn {
  const [completeSolution, setCompleteSolution] = useState<CompleteSolution | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const [status, setStatus] = useState<SimulationStatus>(SimulationStatus.IDLE);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const clearSolution = useCallback(() => {
    setCompleteSolution(null);
    setStatus(SimulationStatus.IDLE);
  }, []);

  const solve = useCallback(async (config: SimulationConfig) => {
    try {
      setIsComputing(true);
      setError(null);
      setStatus(SimulationStatus.RUNNING);

      console.log('[useSimulation] Validating configuration...');
      const validationResult = await validateConfiguration(config);

      if (!validationResult.success || !validationResult.data?.valid) {
        const errors = validationResult.data?.errors || ['Validation failed'];
        setError(errors.join('\n'));
        setIsComputing(false);
        setStatus(SimulationStatus.ERROR);
        return;
      }

      console.log('[useSimulation] Solving simulation...');
      const solveResult = await solveSimulation(config);

      if (!solveResult.success || !solveResult.data) {
        setError(solveResult.error || 'Failed to solve simulation');
        setIsComputing(false);
        setStatus(SimulationStatus.ERROR);
        return;
      }

      setCompleteSolution(solveResult.data);
      setStatus(SimulationStatus.COMPLETED);
      setIsComputing(false);

      console.log('[useSimulation] Simulation solved:', solveResult.data.simulation_id);
    } catch (err) {
      console.error('[useSimulation] Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setIsComputing(false);
      setStatus(SimulationStatus.ERROR);
    }
  }, []);

  return {
    completeSolution,
    isComputing,
    status,
    error,
    clearError,
    solve,
    clearSolution,
    setStatus,
  };
}
