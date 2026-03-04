/**
 * Shared Plotly configuration and layout factories
 *
 * Centralizes all repeated Plotly config/layout objects across visualization
 * components. Import from here to avoid duplication and ensure consistency.
 */

import Plotly from 'plotly.js-dist-min';

// ---------------------------------------------------------------------------
// Static config (does not change per-frame)
// ---------------------------------------------------------------------------

/**
 * Base Plotly config shared by every plot in the application.
 * Passed as the fourth argument to Plotly.newPlot / Plotly.react.
 */
export const BASE_PLOTLY_CONFIG: Partial<Plotly.Config> = {
  responsive: true,
  displayModeBar: true,
  displaylogo: false,
  modeBarButtonsToRemove: ['select2d', 'lasso2d'],
  toImageButtonOptions: {
    format: 'webp',
    width: 1200,
    height: 800
  }
};

// ---------------------------------------------------------------------------
// Shared theme tokens
// ---------------------------------------------------------------------------

export const THEME = {
  bgColor: '#1a1a1a',
  fontColor: '#e0e0e0',
  gridColor: '#333',
  gridColor3D: '#444'
} as const;

// ---------------------------------------------------------------------------
// Layout factory helpers
// ---------------------------------------------------------------------------

/**
 * Common paper/plot background and font settings applied to every layout.
 */
export const BASE_LAYOUT_THEME: Partial<Plotly.Layout> = {
  paper_bgcolor: THEME.bgColor,
  plot_bgcolor: THEME.bgColor,
  font: { color: THEME.fontColor }
};

/**
 * Returns the standard 2D axis style.
 */
export const axis2DStyle = (
  title: string,
  showGrid: boolean
): Partial<Plotly.LayoutAxis> => ({
  title,
  gridcolor: showGrid ? THEME.gridColor : 'transparent',
  color: THEME.fontColor
});

/**
 * Returns the standard 3D axis style (for scene.xaxis / yaxis / zaxis).
 */
export const axis3DStyle = (
  title: string,
  showGrid: boolean
): Partial<Plotly.LayoutAxis> => ({
  title,
  gridcolor: showGrid ? THEME.gridColor3D : 'transparent',
  color: THEME.fontColor,
  backgroundcolor: THEME.bgColor
} as Partial<Plotly.LayoutAxis>);

/**
 * Builds a complete 2D Plotly layout.
 *
 * @param titleText   - Chart title string
 * @param xLabel      - X-axis label
 * @param yLabel      - Y-axis label
 * @param showGrid    - Whether to show grid lines
 * @param yaxisRange  - Optional fixed [min, max] range for the y-axis
 * @param extraMargin - Margin override; defaults to { l:60, r:40, t:60, b:60 }
 * @param disableTransition - Set true to use 0-duration transition (perf mode)
 */
export const make2DLayout = (
  titleText: string,
  xLabel: string,
  yLabel: string,
  showGrid: boolean,
  yaxisRange?: [number, number],
  extraMargin?: Partial<Plotly.Margin>,
  disableTransition = false
): Partial<Plotly.Layout> => ({
  ...BASE_LAYOUT_THEME,
  title: { text: titleText, font: { color: THEME.fontColor, size: 18 } },
  xaxis: axis2DStyle(xLabel, showGrid),
  yaxis: {
    ...axis2DStyle(yLabel, showGrid),
    ...(yaxisRange ? { range: yaxisRange } : {})
  },
  margin: extraMargin ?? { l: 60, r: 40, t: 60, b: 60 },
  hovermode: 'closest',
  transition: { duration: disableTransition ? 0 : 200 }
});

/**
 * Builds a complete 3D scene Plotly layout.
 */
export const make3DLayout = (
  titleText: string,
  xLabel: string,
  yLabel: string,
  zLabel: string,
  showGrid: boolean,
  disableTransition = false
): Partial<Plotly.Layout> => ({
  ...BASE_LAYOUT_THEME,
  title: { text: titleText, font: { color: THEME.fontColor, size: 18 } },
  scene: {
    xaxis: axis3DStyle(xLabel, showGrid),
    yaxis: axis3DStyle(yLabel, showGrid),
    zaxis: axis3DStyle(zLabel, showGrid),
    bgcolor: THEME.bgColor,
    camera: { eye: { x: 1.5, y: 1.5, z: 1.2 } }
  },
  margin: { l: 0, r: 0, t: 60, b: 0 },
  transition: { duration: disableTransition ? 0 : 200 }
});

/**
 * Builds a heatmap / heatmapgl Plotly layout.
 */
export const makeHeatmapLayout = (
  titleText: string,
  xLabel: string,
  yLabel: string,
  showGrid: boolean,
  extraMargin?: Partial<Plotly.Margin>,
  hideYAxis = false,
  disableTransition = false
): Partial<Plotly.Layout> => ({
  ...BASE_LAYOUT_THEME,
  title: { text: titleText, font: { color: THEME.fontColor, size: 18 } },
  xaxis: axis2DStyle(xLabel, showGrid),
  yaxis: hideYAxis
    ? { visible: false, showticklabels: false }
    : axis2DStyle(yLabel, showGrid),
  margin: extraMargin ?? { l: 60, r: 40, t: 60, b: 60 },
  transition: { duration: disableTransition ? 0 : 200 }
});

// ---------------------------------------------------------------------------
// Colorbar helper
// ---------------------------------------------------------------------------

/**
 * Returns a standard colorbar config for 2D/3D traces.
 */
export const makeColorbar = (title: string): Partial<Plotly.ColorBar> => ({
  title,
  titleside: 'right',
  tickfont: { color: THEME.fontColor }
});
