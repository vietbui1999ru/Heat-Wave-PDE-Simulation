import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './styles/App.css';
import {
  SimulationConfig,
  SimulationData,
  SimulationStatus,
  EquationType,
  BoundaryConditionType,
  InitialConditionType,
} from './types/simulation';
import { usePlayback } from './hooks/usePlayback';
import { useSimulation } from './hooks/useSimulation';
import ParameterPanel from './components/ParameterPanel';
import VisualizationCanvas, { VisualizationMode } from './components/VisualizationCanvas';
import DraggableGridVisualization from './components/DraggableGridVisualization';
import Enhanced3DViewer from './components/Enhanced3DViewer';
import SimulationControls from './components/SimulationControls';
import PresetSelector from './components/PresetSelector';
import PerformanceOverlay from './components/PerformanceOverlay';
import {
  initializeVirtualWebGL,
  wouldExceedWebGLLimit,
  logOptimizationSettings,
  getRecommendedPreset
} from './utils/visualizationOptimizations';

const DEFAULT_CONFIG: SimulationConfig = {
  equation_type: EquationType.HEAT,
  spatial_domain: { x_min: 0.0, x_max: 1.0, dx: 0.01 },
  temporal_domain: { t_min: 0.0, t_max: 1.0, dt: 0.001 },
  boundary_condition: { type: BoundaryConditionType.DIRICHLET, left_value: 0.0, right_value: 0.0 },
  initial_condition: { type: InitialConditionType.SINE, parameters: { amplitude: 1.0, frequency: 1.0 } },
  physical_parameters: { beta: 1.0 }
};

const MemoizedVisualizationCanvas = React.memo(VisualizationCanvas);
const MemoizedParameterPanel = React.memo(ParameterPanel);
const MemoizedSimulationControls = React.memo(SimulationControls);

export const App: React.FC = () => {
  const [config, setConfig] = useState<SimulationConfig>(DEFAULT_CONFIG);
  const [vizMode, setVizMode] = useState<VisualizationMode>(VisualizationMode.LINE_2D);
  const [hasValidationErrors, setHasValidationErrors] = useState(false);

  const simulation = useSimulation();
  const { completeSolution, isComputing, status, error } = simulation;

  const playback = usePlayback({ completeSolution });
  const { currentTimeIndex, playbackSpeed } = playback;

  // Computed values
  const currentData: SimulationData | null = useMemo(() => {
    if (!completeSolution) return null;
    return {
      simulation_id: completeSolution.simulation_id,
      time_index: currentTimeIndex,
      time_value: completeSolution.t_values[currentTimeIndex],
      x_values: completeSolution.x_values,
      u_values: completeSolution.u_values[currentTimeIndex]
    };
  }, [completeSolution, currentTimeIndex]);

  const allData: SimulationData[] = useMemo(() => {
    if (!completeSolution) return [];
    return completeSolution.u_values.map((u_vals, timeIdx) => ({
      simulation_id: completeSolution.simulation_id,
      time_index: timeIdx,
      time_value: completeSolution.t_values[timeIdx],
      x_values: completeSolution.x_values,
      u_values: u_vals
    }));
  }, [completeSolution]);

  const totalTimeSteps = completeSolution?.metadata.nt || 0;
  const currentTime = currentData?.time_value || 0;
  const maxTime = config.temporal_domain.t_max;
  const hasSolution = completeSolution !== null;

  // GPU initialization
  useEffect(() => {
    const initGPUAcceleration = async () => {
      const gpuConfig = getRecommendedPreset();
      logOptimizationSettings(gpuConfig);
      if (vizMode === VisualizationMode.GRID && wouldExceedWebGLLimit(4)) {
        try {
          await initializeVirtualWebGL();
        } catch {
          console.warn('Virtual WebGL initialization failed, falling back to standard rendering');
        }
      }
    };
    initGPUAcceleration();
  }, [vizMode]);

  // Handlers
  const handleApplyConfiguration = useCallback(async () => {
    playback.pause();
    playback.reset();
    await simulation.solve(config);
  }, [config, simulation, playback]);

  const handlePlay = useCallback(() => {
    playback.play();
    simulation.setStatus(SimulationStatus.RUNNING);
  }, [playback, simulation]);

  const handlePause = useCallback(() => {
    playback.pause();
    simulation.setStatus(SimulationStatus.PAUSED);
  }, [playback, simulation]);

  const handleReset = useCallback(() => {
    playback.reset();
    simulation.setStatus(SimulationStatus.COMPLETED);
  }, [playback, simulation]);

  const handleSeek = useCallback((timeIndex: number) => {
    playback.seek(timeIndex);
  }, [playback]);

  const handleStepForward = useCallback(() => {
    playback.stepForward();
  }, [playback]);

  const handleStepBackward = useCallback(() => {
    playback.stepBackward();
  }, [playback]);

  const handleSpeedChange = useCallback((speed: number) => {
    playback.setSpeed(speed);
  }, [playback]);

  const handlePresetSelect = useCallback((presetConfig: SimulationConfig) => {
    setConfig(presetConfig);
    if (completeSolution) {
      simulation.clearSolution();
      playback.reset();
    }
  }, [completeSolution, simulation, playback]);

  const handleVisualizationModeChange = useCallback((newMode: VisualizationMode) => {
    setVizMode(newMode);
  }, []);

  const handleClearError = useCallback(() => {
    simulation.clearError();
  }, [simulation]);

  const partialTimeSliceSize = useMemo(
    () => Math.min(15, Math.floor(totalTimeSteps / 10)),
    [totalTimeSteps]
  );

  return (
    <div className="app">
      <header className="app-header">
        <h1>PDE Simulation Platform</h1>
        <p className="app-subtitle">
          Interactive solver for Heat and Wave equations using finite difference methods
        </p>
      </header>

      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠</span>
          <span className="error-message">{error}</span>
          <button className="error-close" onClick={handleClearError}>✕</button>
        </div>
      )}

      {isComputing && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p>Computing simulation...</p>
        </div>
      )}

      <div className="app-content">
        <aside className="sidebar-left">
          <div className="sidebar-section">
            <PresetSelector onPresetSelect={handlePresetSelect} displayMode="dropdown" />
          </div>
          <div className="sidebar-section sidebar-parameters">
            <MemoizedParameterPanel
              config={config}
              onChange={setConfig}
              onApply={handleApplyConfiguration}
              showValidation={true}
              onValidationChange={setHasValidationErrors}
            />
          </div>
          <div className="sidebar-apply-button">
            <button
              className="btn-apply-fixed"
              onClick={handleApplyConfiguration}
              disabled={hasValidationErrors}
              title={hasValidationErrors ? 'Fix validation errors before applying' : 'Apply configuration and solve'}
            >
              Apply Configuration
            </button>
          </div>
        </aside>

        <main className="main-content">
          <div className="viz-mode-selector">
            <button
              className={`viz-mode-btn ${vizMode === VisualizationMode.LINE_2D ? 'active' : ''}`}
              onClick={() => handleVisualizationModeChange(VisualizationMode.LINE_2D)}
            >
              2D Line Plot
            </button>
            <button
              className={`viz-mode-btn ${vizMode === VisualizationMode.SURFACE_3D ? 'active' : ''}`}
              onClick={() => handleVisualizationModeChange(VisualizationMode.SURFACE_3D)}
              disabled={allData.length < 2}
            >
              3D Surface (Enhanced)
            </button>
            <button
              className={`viz-mode-btn ${vizMode === VisualizationMode.HEATMAP ? 'active' : ''}`}
              onClick={() => handleVisualizationModeChange(VisualizationMode.HEATMAP)}
              disabled={allData.length < 2}
            >
              Heatmap
            </button>
            <button
              className={`viz-mode-btn ${vizMode === VisualizationMode.HEATMAP_STRIP ? 'active' : ''}`}
              onClick={() => handleVisualizationModeChange(VisualizationMode.HEATMAP_STRIP)}
              disabled={!currentData}
            >
              Strip Animation
            </button>
            <button
              className={`viz-mode-btn ${vizMode === VisualizationMode.GRID ? 'active' : ''}`}
              onClick={() => handleVisualizationModeChange(VisualizationMode.GRID)}
              disabled={!currentData}
              title="Interactive 3x2 grid - drag panels to rearrange"
            >
              3x2 Grid (Interactive)
            </button>
          </div>

          <div className={`visualization-container ${vizMode === VisualizationMode.GRID ? 'grid-mode' : ''}`}>
            {vizMode === VisualizationMode.SURFACE_3D ? (
              <Enhanced3DViewer
                currentData={currentData}
                allData={allData}
                currentTimeIndex={currentTimeIndex}
                totalTimeSteps={totalTimeSteps}
                equationType={config.equation_type}
                globalMin={completeSolution?.metadata.global_min}
                globalMax={completeSolution?.metadata.global_max}
                useFixedAxes={true}
                showGrid={true}
                partialTimeSliceSize={partialTimeSliceSize}
              />
            ) : vizMode === VisualizationMode.GRID ? (
              <DraggableGridVisualization
                currentData={currentData}
                allData={allData}
                equationType={config.equation_type}
                globalMin={completeSolution?.metadata.global_min}
                globalMax={completeSolution?.metadata.global_max}
                useFixedAxes={true}
                showGrid={true}
                currentTimeIndex={currentTimeIndex}
                totalTimeSteps={totalTimeSteps}
              />
            ) : (
              <MemoizedVisualizationCanvas
                currentData={currentData}
                allData={allData}
                mode={vizMode}
                equationType={config.equation_type}
                showGrid={true}
                globalMin={completeSolution?.metadata.global_min}
                globalMax={completeSolution?.metadata.global_max}
                useFixedAxes={true}
              />
            )}
          </div>

          <div className="controls-container">
            <MemoizedSimulationControls
              status={status}
              currentTimeStep={currentTimeIndex}
              totalTimeSteps={totalTimeSteps}
              currentTime={currentTime}
              maxTime={maxTime}
              hasSolution={hasSolution}
              onPlay={handlePlay}
              onPause={handlePause}
              onReset={handleReset}
              onSeek={handleSeek}
              onStepForward={handleStepForward}
              onStepBackward={handleStepBackward}
              onSpeedChange={handleSpeedChange}
              playbackSpeed={playbackSpeed}
            />
          </div>

          <div className="info-panel">
            <div className="info-item">
              <span className="info-label">Equation:</span>
              <span className="info-value">{config.equation_type.toUpperCase()}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Solution Data:</span>
              <span className="info-value">
                {completeSolution ? `${totalTimeSteps} time steps` : 'Not computed'}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Grid Size:</span>
              <span className="info-value">
                {completeSolution ? `${completeSolution.metadata.nx} points` : '-'}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Compute Time:</span>
              <span className="info-value">
                {completeSolution ? `${completeSolution.metadata.computation_time_ms.toFixed(1)}ms` : '-'}
              </span>
            </div>
          </div>
        </main>
      </div>

      <footer className="app-footer">
        <p>
          PDE Simulation Platform | Built with React + TypeScript + FastAPI |{' '}
          <a href="https://github.com" target="_blank" rel="noopener noreferrer">
            Documentation
          </a>
        </p>
      </footer>

      <PerformanceOverlay enabled={process.env.NODE_ENV === 'development'} />
    </div>
  );
};

export default App;
