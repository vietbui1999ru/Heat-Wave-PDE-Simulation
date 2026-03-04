/**
 * Visualization Optimization Configuration
 *
 * Provides GPU acceleration and rendering optimizations for Plotly.js charts.
 * Handles WebGL mode selection, Virtual WebGL support, and render config.
 */

/**
 * Render mode for Plotly charts
 */
export type RenderMode = 'webgl' | 'svg' | 'auto';

/**
 * Optimization configuration
 */
export interface OptimizationConfig {
  renderMode: RenderMode;
  enableVirtualWebGL: boolean;
  scatterGLMode: boolean;
  heatmapGLMode: boolean;
  disableAnimations: boolean;
  reduceDataPoints: boolean;
  maxDataPoints: number;
  enableBuffering: boolean;
}

/**
 * Default optimization settings
 * @deprecated Prefer OPTIMIZATION_PRESETS.highPerformance directly.
 */
export const DEFAULT_OPTIMIZATION_CONFIG: OptimizationConfig = {
  renderMode: 'webgl',
  enableVirtualWebGL: false,
  scatterGLMode: true,
  heatmapGLMode: true,
  disableAnimations: false,
  reduceDataPoints: false,
  maxDataPoints: 100000,
  enableBuffering: true
};

/** Shared base fields applied to all presets */
const BASE_PRESET = {
  reduceDataPoints: false,
  enableBuffering: true
} as const;

/**
 * Optimization presets for different scenarios.
 * Choose a preset based on detected hardware (see getRecommendedPreset).
 */
export const OPTIMIZATION_PRESETS = {
  /** Best performance on lower-end / no-WebGL hardware */
  low: {
    ...BASE_PRESET,
    renderMode: 'svg' as RenderMode,
    enableVirtualWebGL: false,
    scatterGLMode: false,
    heatmapGLMode: false,
    disableAnimations: true,
    maxDataPoints: 10000
  },

  /** Balanced performance – scatter GL on, heatmap stays CPU-rendered */
  balanced: {
    ...BASE_PRESET,
    renderMode: 'auto' as RenderMode,
    enableVirtualWebGL: false,
    scatterGLMode: true,
    heatmapGLMode: false,
    disableAnimations: false,
    maxDataPoints: 50000
  },

  /** Maximum GPU acceleration; enables Virtual WebGL for multi-plot pages */
  highPerformance: {
    ...BASE_PRESET,
    renderMode: 'webgl' as RenderMode,
    enableVirtualWebGL: true,
    scatterGLMode: true,
    heatmapGLMode: true,
    disableAnimations: false,
    maxDataPoints: 1000000
  }
};

/**
 * Detect supported hardware capabilities
 */
export const detectHardwareCapabilities = (): {
  hasWebGL: boolean;
  hasWebGL2: boolean;
  maxTextureSize: number;
  maxViewportSize: number;
  isLowEnd: boolean;
} => {
  try {
    const canvas = document.createElement('canvas');
    const webgl = canvas.getContext('webgl');
    const webgl2 = canvas.getContext('webgl2');

    const maxTexture = webgl?.getParameter(webgl.MAX_TEXTURE_SIZE) || 0;
    const maxViewport = webgl?.getParameter(webgl.MAX_VIEWPORT_DIMS) || [0, 0];

    // Detect low-end hardware (based on memory and texture support)
    const isLowEnd = maxTexture < 4096 || (performance.memory?.jsHeapSizeLimit || 0) < 100000000;

    return {
      hasWebGL: webgl !== null,
      hasWebGL2: webgl2 !== null,
      maxTextureSize: maxTexture,
      maxViewportSize: maxViewport[0] || 0,
      isLowEnd
    };
  } catch (e) {
    console.warn('Failed to detect WebGL capabilities:', e);
    return {
      hasWebGL: false,
      hasWebGL2: false,
      maxTextureSize: 0,
      maxViewportSize: 0,
      isLowEnd: true
    };
  }
};

/**
 * Get recommended optimization preset based on hardware
 */
export const getRecommendedPreset = (): OptimizationConfig => {
  const capabilities = detectHardwareCapabilities();

  if (!capabilities.hasWebGL) {
    console.log('WebGL not supported, using SVG mode');
    return OPTIMIZATION_PRESETS.low;
  }

  if (capabilities.isLowEnd) {
    console.log('Low-end hardware detected, using balanced mode');
    return OPTIMIZATION_PRESETS.balanced;
  }

  console.log('High-end hardware detected, using performance mode');
  return OPTIMIZATION_PRESETS.highPerformance;
};

/**
 * Plotly configuration object for WebGL optimization.
 * @deprecated Use BASE_PLOTLY_CONFIG from utils/plotlyConfig.ts directly.
 * This wrapper is kept for backwards compatibility with legacy call sites.
 */
export const getOptimizedPlotlyConfig = (
  _config: OptimizationConfig
): Partial<Plotly.Config> => ({
  responsive: true,
  displayModeBar: true,
  displaylogo: false,
  modeBarButtonsToRemove: ['select2d', 'lasso2d'],
  toImageButtonOptions: {
    format: 'webp',
    width: 1200,
    height: 800
  }
});

/**
 * Plotly layout configuration for optimization
 */
export const getOptimizedLayout = (
  baseLayout: Partial<Plotly.Layout>,
  config: OptimizationConfig
): Partial<Plotly.Layout> => {
  return {
    ...baseLayout,
    // Disable excessive animations for better performance
    transition: config.disableAnimations
      ? { duration: 0 }
      : { duration: 200 }
  };
};

/**
 * Virtual WebGL script URL
 * Using this enables virtualizing a single WebGL context
 */
export const VIRTUAL_WEBGL_URL = 'https://unpkg.com/virtual-webgl@1.0.6/src/virtual-webgl.js';

/**
 * Initialize Virtual WebGL support
 * This allows rendering multiple WebGL plots on the same page
 */
export const initializeVirtualWebGL = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if Virtual WebGL is already loaded
    if ((window as any).VirtualWebGL) {
      console.log('Virtual WebGL already loaded');
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = VIRTUAL_WEBGL_URL;
    script.async = true;
    script.onload = () => {
      console.log('Virtual WebGL initialized successfully');
      resolve();
    };
    script.onerror = () => {
      console.error('Failed to load Virtual WebGL');
      reject(new Error('Failed to load Virtual WebGL from CDN'));
    };
    document.head.appendChild(script);
  });
};

/**
 * Check if multiple WebGL contexts would exceed limits
 */
export const wouldExceedWebGLLimit = (numCharts: number): boolean => {
  // Conservative estimate: ~2 contexts per chart on average
  const estimatedContexts = numCharts * 2;
  // Most browsers support 8-16 contexts
  return estimatedContexts > 8;
};

/**
 * Select optimal render mode based on data size
 */
export const selectOptimalRenderMode = (dataPoints: number): RenderMode => {
  if (dataPoints > 15000) {
    return 'webgl'; // WebGL performs much better for large datasets
  }
  if (dataPoints > 5000) {
    return 'auto'; // Let Plotly decide
  }
  return 'svg'; // SVG is fine for small datasets
};

/**
 * Get data point reduction factor for optimization
 */
export const getReductionFactor = (
  numDataPoints: number,
  config: OptimizationConfig
): number => {
  if (!config.reduceDataPoints || numDataPoints <= config.maxDataPoints) {
    return 1;
  }
  return Math.max(1, Math.ceil(numDataPoints / config.maxDataPoints));
};

/**
 * Reduce data points by sampling or binning
 */
export const reduceDataPoints = <T extends { x: number | number[]; y: number | number[] }>(
  data: T[],
  factor: number
): T[] => {
  if (factor <= 1) return data;

  return data.reduce((acc, item, index) => {
    if (index % factor === 0) {
      acc.push(item);
    }
    return acc;
  }, [] as T[]);
};

/**
 * Logger for optimization decisions
 */
export const logOptimizationSettings = (config: OptimizationConfig): void => {
  console.group('🚀 Visualization Optimizations');
  console.log('Render Mode:', config.renderMode);
  console.log('Virtual WebGL:', config.enableVirtualWebGL);
  console.log('ScatterGL:', config.scatterGLMode);
  console.log('HeatmapGL:', config.heatmapGLMode);
  console.log('Max Data Points:', config.maxDataPoints);
  console.log('Animations Disabled:', config.disableAnimations);
  console.groupEnd();
};
