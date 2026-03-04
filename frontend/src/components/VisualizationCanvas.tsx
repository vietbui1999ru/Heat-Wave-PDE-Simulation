/**
 * VisualizationCanvas Component
 *
 * Renders interactive visualizations of PDE simulation data using Plotly.js.
 * Supports 2D line plots for current time step and 3D surface plots for
 * complete spatiotemporal solutions.
 */

import React, { useEffect, useRef, useMemo } from 'react';
import Plotly from 'plotly.js-dist-min';
import { SimulationData, EquationType } from '../types/simulation';
import {
  getRecommendedPreset,
} from '../utils/visualizationOptimizations';
import {
  BASE_PLOTLY_CONFIG,
  make2DLayout,
  make3DLayout,
  makeHeatmapLayout,
  makeColorbar
} from '../utils/plotlyConfig';
import { PerformanceMonitor } from '../utils/performanceMonitor';

/**
 * Visualization mode types
 */
export enum VisualizationMode {
  /** 2D line plot showing u(x) at current time */
  LINE_2D = '2d',

  /** 3D surface plot showing u(x,t) for all time steps */
  SURFACE_3D = '3d',

  /** Heatmap showing u(x,t) */
  HEATMAP = 'heatmap',

  /** Heatmap strip animation showing spatial distribution over time */
  HEATMAP_STRIP = 'heatmap_strip',

  /** 2x2 grid showing all four visualization modes simultaneously */
  GRID = 'grid'
}

/**
 * Props for the VisualizationCanvas component
 */
interface VisualizationCanvasProps {
  /** Current simulation data to display */
  currentData: SimulationData | null;

  /** All simulation data (for 3D visualization) */
  allData?: SimulationData[];

  /** Type of equation being solved */
  equationType?: EquationType;

  /** Visualization mode */
  mode?: VisualizationMode;

  /** Chart title */
  title?: string;

  /** X-axis label */
  xLabel?: string;

  /** Y-axis label */
  yLabel?: string;

  /** Z-axis label (for 3D) */
  zLabel?: string;

  /** Color scheme */
  colorScheme?: string;

  /** Whether to show grid lines */
  showGrid?: boolean;

  /** Custom CSS class name */
  className?: string;

  /** Height of the visualization */
  height?: string | number;

  /** Global minimum value for fixed axis scaling */
  globalMin?: number;

  /** Global maximum value for fixed axis scaling */
  globalMax?: number;

  /** Whether to use fixed axis ranges (prevents jumping) */
  useFixedAxes?: boolean;
}

/**
 * VisualizationCanvas Component
 *
 * Creates interactive plots of PDE solutions using Plotly.js.
 * Uses Plotly.react() for all updates after the initial render to avoid
 * full DOM redraws during animation frames.
 */
export const VisualizationCanvas: React.FC<VisualizationCanvasProps> = ({
  currentData,
  allData = [],
  equationType = EquationType.HEAT,
  mode = VisualizationMode.LINE_2D,
  title,
  xLabel = 'x',
  yLabel = 'u(x, t)',
  zLabel = 'u',
  colorScheme = 'Viridis',
  showGrid = true,
  className = '',
  height = '500px',
  globalMin,
  globalMax,
  useFixedAxes = false
}) => {
  const plotContainerRef = useRef<HTMLDivElement>(null);
  // Track whether Plotly has initialized a chart in this container.
  // Reset to false when the container is purged (on cleanup).
  const isInitializedRef = useRef(false);

  const optimizationConfigRef = useRef(getRecommendedPreset());
  const performanceMonitorRef = useRef(PerformanceMonitor.getInstance());

  // Enable performance monitoring in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      performanceMonitorRef.current.enable();
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Memoized layout objects – recomputed only when stable props change.
  // These do NOT depend on currentData / time_value so they survive animation
  // frames without re-allocation.
  // ---------------------------------------------------------------------------

  const yaxisRange = useMemo<[number, number] | undefined>(() => {
    if (useFixedAxes && globalMin !== undefined && globalMax !== undefined) {
      const padding = (globalMax - globalMin) * 0.1;
      return [globalMin - padding, globalMax + padding];
    }
    return undefined;
  }, [useFixedAxes, globalMin, globalMax]);

  const layout2D = useMemo(
    () =>
      make2DLayout(
        title || `${equationType.toUpperCase()} Equation Solution (2D)`,
        xLabel,
        yLabel,
        showGrid,
        yaxisRange,
        undefined,
        optimizationConfigRef.current.disableAnimations
      ),
    [title, equationType, xLabel, yLabel, showGrid, yaxisRange]
  );

  const layout3D = useMemo(
    () =>
      make3DLayout(
        title || `${equationType.toUpperCase()} Equation Solution (3D)`,
        xLabel,
        't (time)',
        zLabel,
        showGrid,
        optimizationConfigRef.current.disableAnimations
      ),
    [title, equationType, xLabel, zLabel, showGrid]
  );

  const layoutHeatmap = useMemo(
    () =>
      makeHeatmapLayout(
        title || `${equationType.toUpperCase()} Equation Solution (Heatmap)`,
        xLabel,
        't (time)',
        showGrid,
        undefined,
        false,
        optimizationConfigRef.current.disableAnimations
      ),
    [title, equationType, xLabel, showGrid]
  );

  // Strip layout is mostly static; title includes time_value but we update
  // it via Plotly.react so the memoized base is still useful.
  const layoutHeatmapStripBase = useMemo(
    () =>
      makeHeatmapLayout(
        '',  // title set dynamically per frame below
        xLabel,
        '',
        showGrid,
        { l: 60, r: 120, t: 60, b: 60 },
        true, // hide y-axis
        optimizationConfigRef.current.disableAnimations
      ),
    [xLabel, showGrid]
  );

  // heatmapGLMode decides trace type for heatmap/strip
  const heatmapTraceType = optimizationConfigRef.current.heatmapGLMode
    ? 'heatmapgl'
    : 'heatmap';

  // ---------------------------------------------------------------------------
  // Plotly render helpers
  // ---------------------------------------------------------------------------

  /**
   * Calls Plotly.newPlot on first call, then Plotly.react for incremental
   * updates. Using Plotly.react avoids a full DOM teardown per animation frame.
   */
  const plotOrUpdate = (
    traces: Partial<Plotly.PlotData>[],
    layout: Partial<Plotly.Layout>
  ) => {
    const el = plotContainerRef.current;
    if (!el) return;
    if (isInitializedRef.current) {
      Plotly.react(el, traces, layout, BASE_PLOTLY_CONFIG);
    } else {
      Plotly.newPlot(el, traces, layout, BASE_PLOTLY_CONFIG);
      isInitializedRef.current = true;
    }
  };

  const render2DPlot = () => {
    if (!plotContainerRef.current || !currentData) return;

    performanceMonitorRef.current.startFrame();

    const trace: Partial<Plotly.PlotData> = {
      x: currentData.x_values,
      y: currentData.u_values,
      type: 'scatter',
      mode: 'lines+markers',
      name: `t = ${currentData.time_value.toFixed(4)}`,
      line: { color: '#00d4ff', width: 2 },
      marker: { size: 4, color: '#00d4ff' }
    };

    performanceMonitorRef.current.endRender();
    plotOrUpdate([trace], layout2D);
    performanceMonitorRef.current.endFrame();
  };

  const render3DPlot = () => {
    if (!plotContainerRef.current || allData.length === 0) return;

    performanceMonitorRef.current.startFrame();

    const xValues = allData[0].x_values;
    const tValues = allData.map(d => d.time_value);
    const zMatrix = allData.map(d => d.u_values);

    const trace: Partial<Plotly.PlotData> = {
      x: xValues,
      y: tValues,
      z: zMatrix,
      type: 'surface',
      colorscale: colorScheme,
      showscale: true,
      colorbar: makeColorbar(zLabel)
    };

    performanceMonitorRef.current.endRender();
    plotOrUpdate([trace], layout3D);
    performanceMonitorRef.current.endFrame();
  };

  const renderHeatmap = () => {
    if (!plotContainerRef.current || allData.length === 0) return;

    performanceMonitorRef.current.startFrame();

    const xValues = allData[0].x_values;
    const tValues = allData.map(d => d.time_value);
    const zMatrix = allData.map(d => d.u_values);

    const trace: Partial<Plotly.PlotData> = {
      x: xValues,
      y: tValues,
      z: zMatrix,
      type: heatmapTraceType as any,
      colorscale: colorScheme,
      showscale: true,
      colorbar: makeColorbar(zLabel)
    };

    performanceMonitorRef.current.endRender();
    plotOrUpdate([trace], layoutHeatmap);
    performanceMonitorRef.current.endFrame();
  };

  const renderHeatmapStrip = () => {
    if (!plotContainerRef.current || !currentData) return;

    performanceMonitorRef.current.startFrame();

    const stripRows = 5;
    const stripMatrix = Array(stripRows).fill(currentData.u_values);

    const trace: Partial<Plotly.PlotData> = {
      x: currentData.x_values,
      y: Array.from({ length: stripRows }, (_, i) => i),
      z: stripMatrix,
      type: heatmapTraceType as any,
      colorscale: colorScheme,
      zmin: globalMin,
      zmax: globalMax,
      showscale: true,
      colorbar: {
        title: { text: yLabel, side: 'right' },
        tickfont: { color: '#e0e0e0' },
        titlefont: { color: '#e0e0e0' }
      }
    };

    // Only the title changes per-frame for the strip; merge into base layout
    const layout: Partial<Plotly.Layout> = {
      ...layoutHeatmapStripBase,
      title: {
        text: `${equationType.toUpperCase()} - Strip Animation (t = ${currentData.time_value.toFixed(4)})`,
        font: { color: '#e0e0e0', size: 18 }
      },
      height: 250
    };

    performanceMonitorRef.current.endRender();
    plotOrUpdate([trace], layout);
    performanceMonitorRef.current.endFrame();
  };

  // ---------------------------------------------------------------------------
  // Effect – re-render whenever data or mode changes
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!plotContainerRef.current) return;

    if (mode === VisualizationMode.LINE_2D) {
      render2DPlot();
    } else if (mode === VisualizationMode.SURFACE_3D) {
      render3DPlot();
    } else if (mode === VisualizationMode.HEATMAP) {
      renderHeatmap();
    } else if (mode === VisualizationMode.HEATMAP_STRIP) {
      renderHeatmapStrip();
    }

    return () => {
      if (plotContainerRef.current) {
        Plotly.purge(plotContainerRef.current);
        // Mark as not initialized so the next mount calls newPlot, not react
        isInitializedRef.current = false;
      }
    };
    // We intentionally list all reactive inputs. The memoized layout objects
    // already collapse stable props so this effect runs at the right cadence.
  }, [currentData, allData, mode, equationType, globalMin, globalMax, useFixedAxes, layout2D, layout3D, layoutHeatmap, layoutHeatmapStripBase]);

  // ---------------------------------------------------------------------------
  // Empty-state guards
  // ---------------------------------------------------------------------------

  if (!currentData && allData.length === 0) {
    return (
      <div className={`visualization-canvas ${className}`} style={{ height }}>
        <div className="visualization-empty">
          <p>No simulation data available</p>
          <p className="visualization-hint">Start a simulation to see visualization</p>
        </div>
      </div>
    );
  }

  if ((mode === VisualizationMode.SURFACE_3D || mode === VisualizationMode.HEATMAP) && allData.length < 2) {
    return (
      <div className={`visualization-canvas ${className}`} style={{ height }}>
        <div className="visualization-empty">
          <p>Insufficient data for {mode === VisualizationMode.SURFACE_3D ? '3D' : 'heatmap'} visualization</p>
          <p className="visualization-hint">Run simulation to collect more time steps</p>
        </div>
      </div>
    );
  }

  if (mode === VisualizationMode.HEATMAP_STRIP && !currentData) {
    return (
      <div className={`visualization-canvas ${className}`} style={{ height }}>
        <div className="visualization-empty">
          <p>No data available for strip animation</p>
          <p className="visualization-hint">Run simulation to generate solution</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`visualization-canvas ${className}`}>
      <div
        ref={plotContainerRef}
        className="plot-container"
        style={{ height, width: '100%' }}
      />
    </div>
  );
};

export default VisualizationCanvas;
