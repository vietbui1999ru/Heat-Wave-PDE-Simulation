/**
 * 3D Trajectory Visualization Component
 *
 * Visualizes particle/simulation paths as lines in 3D space.
 * Shows temporal evolution with color/width encoding.
 * Useful for understanding solution dynamics and evolution patterns.
 */

import React, { useEffect, useRef, useMemo } from 'react';
import Plotly from 'plotly.js-dist-min';
import { SimulationData, EquationType } from '../types/simulation';
import { BASE_PLOTLY_CONFIG, make3DLayout } from '../utils/plotlyConfig';

interface Trajectory3DVisualizationProps {
  /** All simulation data for trajectory construction */
  allData: SimulationData[];

  /** Type of equation being solved */
  equationType?: EquationType;

  /** Global minimum for color scaling */
  globalMin?: number;

  /** Global maximum for color scaling */
  globalMax?: number;

  /** Height of the visualization */
  height?: string | number;

  /** Color scheme */
  colorScheme?: string;

  /** Show grid lines */
  showGrid?: boolean;

  /** Title override */
  title?: string;

  /** Number of sample points to use (reduces density for performance) */
  samplingRate?: number;
}

/**
 * 3D Trajectory Visualization Component
 *
 * Creates a 3D visualization showing the evolution of the solution.
 * - X-axis: Position
 * - Y-axis: Time
 * - Z-axis: Solution value
 * - Trajectory: Lines connecting consecutive time steps
 * - Color/Width: Encodes time progression
 *
 * Useful for:
 * - Visualizing wave propagation
 * - Understanding heat diffusion patterns
 * - Identifying solution instabilities
 * - Analyzing temporal dynamics
 *
 * @example
 * ```tsx
 * <Trajectory3DVisualization
 *   allData={allData}
 *   equationType={EquationType.HEAT}
 *   samplingRate={2}  // Use every 2nd point for performance
 * />
 * ```
 */
export const Trajectory3DVisualization: React.FC<Trajectory3DVisualizationProps> = ({
  allData,
  equationType = EquationType.HEAT,
  globalMin,
  globalMax,
  height = '500px',
  colorScheme = 'Viridis',
  showGrid = true,
  title,
  samplingRate = 1
}) => {
  const plotContainerRef = useRef<HTMLDivElement>(null);
  const isInitializedRef = useRef(false);

  const layout = useMemo(
    () =>
      make3DLayout(
        title || `${equationType.toUpperCase()} - 3D Trajectory Paths (Temporal Evolution)`,
        'Position (x)',
        'Time (t)',
        'Solution u(x,t)',
        showGrid
      ),
    [title, equationType, showGrid]
  );

  /**
   * Build trajectory traces from simulation data
   * Samples spatial points and connects time evolution
   */
  const buildTrajectoryTraces = (): Partial<Plotly.PlotData>[] => {
    if (allData.length < 2) return [];

    const traces: Partial<Plotly.PlotData>[] = [];
    const xValues = allData[0].x_values;
    const numPoints = xValues.length;

    // Sample spatial points
    const sampleIndices: number[] = [];
    for (let i = 0; i < numPoints; i += samplingRate) {
      sampleIndices.push(i);
    }

    // Create a trace for each spatial point
    // Each trace shows how solution evolves at that position over time
    sampleIndices.forEach((xIdx) => {
      const x: number[] = [];
      const y: number[] = [];
      const z: number[] = [];
      const colorValues: number[] = [];

      // Collect time evolution for this spatial point
      allData.forEach((dataPoint) => {
        x.push(xValues[xIdx]);
        y.push(dataPoint.time_value);
        z.push(dataPoint.u_values[xIdx]);
        colorValues.push(dataPoint.time_value); // Color by time
      });

      // Create trace for this trajectory
      const trace: Partial<Plotly.PlotData> = {
        x,
        y,
        z,
        mode: 'lines+markers',
        type: 'scatter3d',
        name: `x = ${xValues[xIdx].toFixed(3)}`,
        line: {
          color: colorValues,
          colorscale: colorScheme,
          showscale: xIdx === sampleIndices[0], // Only show scale bar once
          width: 4,
          colorbar: {
            title: 't (time)',
            thickness: 20,
            len: 0.7,
            x: 1.02
          }
        },
        marker: {
          size: 3,
          color: colorValues,
          colorscale: colorScheme,
          showscale: false,
          opacity: 0.8
        }
      };

      traces.push(trace);
    });

    return traces;
  };

  /**
   * Render 3D trajectory visualization
   */
  const renderTrajectory = () => {
    if (!plotContainerRef.current || allData.length < 2) return;

    const traces = buildTrajectoryTraces();
    if (traces.length === 0) return;

    const el = plotContainerRef.current;
    if (isInitializedRef.current) {
      Plotly.react(el, traces, { ...layout, showlegend: false }, BASE_PLOTLY_CONFIG);
    } else {
      Plotly.newPlot(el, traces, { ...layout, showlegend: false }, BASE_PLOTLY_CONFIG);
      isInitializedRef.current = true;
    }
  };

  // Render when data changes
  useEffect(() => {
    renderTrajectory();

    return () => {
      if (plotContainerRef.current) {
        Plotly.purge(plotContainerRef.current);
        isInitializedRef.current = false;
      }
    };
  }, [allData, equationType, globalMin, globalMax, colorScheme, showGrid, samplingRate, layout]);

  if (allData.length < 2) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#a0a0a0', textAlign: 'center' }}>
          <p>Insufficient data for trajectory visualization</p>
          <p style={{ fontSize: '0.85rem', color: '#707070' }}>Run simulation to collect more time steps</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={plotContainerRef}
      style={{
        width: '100%',
        height,
        borderRadius: '8px',
        overflow: 'hidden'
      }}
    />
  );
};

export default Trajectory3DVisualization;
