/**
 * Enhanced 3D Viewer Component
 *
 * Provides complete and partial 3D solution views with toggle control.
 * Allows users to switch between:
 * - Complete solution: Full spatiotemporal domain
 * - Partial solution: Time slice with temporal evolution
 */

import React, { useState } from 'react';
import VisualizationCanvas, { VisualizationMode } from './VisualizationCanvas';
import Partial3DSolution from './Partial3DSolution';
import { SimulationData, EquationType } from '../types/simulation';

type ViewMode = 'complete' | 'partial';

interface Enhanced3DViewerProps {
  /** Current simulation data */
  currentData: SimulationData | null;

  /** All simulation data */
  allData: SimulationData[];

  /** Current time index */
  currentTimeIndex: number;

  /** Total time steps */
  totalTimeSteps: number;

  /** Type of equation being solved */
  equationType?: EquationType;

  /** Global minimum for scaling */
  globalMin?: number;

  /** Global maximum for scaling */
  globalMax?: number;

  /** Whether to use fixed axes */
  useFixedAxes?: boolean;

  /** Color scheme */
  colorScheme?: string;

  /** Show grid lines */
  showGrid?: boolean;

  /** Height of viewer */
  height?: string | number;

  /** Time slice size for partial solution */
  partialTimeSliceSize?: number;

  /** Title override */
  title?: string;
}

/**
 * Enhanced 3D Viewer Component
 *
 * Provides advanced 3D visualization options:
 *
 * **Complete Solution Mode:**
 * - Shows entire spatiotemporal domain
 * - Full surface from first to last time step
 * - Interactive rotation and zoom
 *
 * **Partial Solution Mode:**
 * - Shows time slice centered on current time
 * - Window slides as simulation progresses
 * - Better for visualizing temporal dynamics
 * - Configurable time window size
 *
 * **Features:**
 * - Toggle between modes
 * - Time slice size slider (for partial mode)
 * - Color scale options
 * - Camera controls inherited from Plotly
 *
 * @example
 * ```tsx
 * <Enhanced3DViewer
 *   currentData={currentData}
 *   allData={allData}
 *   currentTimeIndex={currentTimeIndex}
 *   equationType={EquationType.HEAT}
 *   partialTimeSliceSize={15}
 * />
 * ```
 */
export const Enhanced3DViewer: React.FC<Enhanced3DViewerProps> = ({
  currentData,
  allData,
  currentTimeIndex,
  totalTimeSteps,
  equationType = EquationType.HEAT,
  globalMin,
  globalMax,
  useFixedAxes = true,
  colorScheme = 'Viridis',
  showGrid = true,
  height = '500px',
  partialTimeSliceSize = 15,
  title
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('complete');
  const [sliceSize, setSliceSize] = useState(partialTimeSliceSize);

  return (
    <div className="enhanced-3d-viewer">
      {/* Header with mode toggle */}
      <div className="enhanced-3d-header">
        <div className="mode-toggle-group">
          <button
            className={`mode-toggle-btn ${viewMode === 'complete' ? 'active' : ''}`}
            onClick={() => setViewMode('complete')}
            title="View complete spatiotemporal solution"
          >
            📊 Complete Solution
          </button>
          <button
            className={`mode-toggle-btn ${viewMode === 'partial' ? 'active' : ''}`}
            onClick={() => setViewMode('partial')}
            title="View time slice with temporal evolution"
          >
            ⏱️ Partial Solution (Time Slice)
          </button>
        </div>

        {/* Partial solution controls */}
        {viewMode === 'partial' && (
          <div className="partial-controls">
            <label htmlFor="time-slice-slider">Time Window: </label>
            <input
              id="time-slice-slider"
              type="range"
              min="5"
              max={Math.min(50, totalTimeSteps / 2)}
              value={sliceSize}
              onChange={(e) => setSliceSize(parseInt(e.target.value))}
              className="time-slice-slider"
              title={`Show ±${sliceSize} time steps (${sliceSize * 2 + 1} steps total)`}
            />
            <span className="slice-label">
              ±{sliceSize} steps ({sliceSize * 2 + 1} total)
            </span>
          </div>
        )}
      </div>

      {/* Visualization content */}
      <div className="enhanced-3d-content" style={{ height }}>
        {viewMode === 'complete' && allData.length >= 2 ? (
          <VisualizationCanvas
            currentData={currentData}
            allData={allData}
            mode={VisualizationMode.SURFACE_3D}
            equationType={equationType}
            title={title || `${equationType.toUpperCase()} - Complete 3D Solution`}
            xLabel="Position (x)"
            zLabel="Solution u(x,t)"
            colorScheme={colorScheme}
            showGrid={showGrid}
            globalMin={globalMin}
            globalMax={globalMax}
            useFixedAxes={useFixedAxes}
            height="100%"
          />
        ) : viewMode === 'partial' && allData.length >= 2 ? (
          <Partial3DSolution
            allData={allData}
            currentTimeIndex={currentTimeIndex}
            equationType={equationType}
            timeSliceSize={sliceSize}
            globalMin={globalMin}
            globalMax={globalMax}
            colorScheme={colorScheme}
            showGrid={showGrid}
            height="100%"
            title={
              title ||
              `${equationType.toUpperCase()} - Partial 3D (Time Slice at t=${
                allData[currentTimeIndex]?.time_value.toFixed(4) || 'N/A'
              })`
            }
          />
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#a0a0a0'
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <p>Insufficient data for 3D visualization</p>
              <p style={{ fontSize: '0.85rem', color: '#707070' }}>
                Run simulation to collect at least 2 time steps
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Info panel */}
      <div className="enhanced-3d-info">
        {viewMode === 'complete' && (
          <div className="info-text">
            <strong>Complete Solution:</strong> Shows the entire spatiotemporal solution from t=0 to t=max.
            Rotate, zoom, and pan to explore. Color indicates solution magnitude.
          </div>
        )}
        {viewMode === 'partial' && (
          <div className="info-text">
            <strong>Partial Solution (Time Slice):</strong> Shows a narrow time window centered at the current
            time step. Useful for visualizing temporal evolution and dynamics. Adjust the time window slider to
            see more or less temporal context.
          </div>
        )}
      </div>
    </div>
  );
};

export default Enhanced3DViewer;
