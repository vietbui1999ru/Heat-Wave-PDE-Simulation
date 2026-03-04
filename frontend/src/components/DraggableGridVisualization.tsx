/**
 * Draggable Grid Visualization Component
 *
 * Allows users to freely drag visualization panels around.
 * Panels snap to quadrants and intelligently rearrange other panels.
 * Supports 2x2 grid layout with dynamic position management.
 */

import React, { useState, useRef, useCallback } from 'react';
import VisualizationCanvas, { VisualizationMode } from './VisualizationCanvas';
import Trajectory3DVisualization from './Trajectory3DVisualization';
import Partial3DSolution from './Partial3DSolution';
import { SimulationData, EquationType } from '../types/simulation';

/**
 * Visualization panel types and positions (3x2 grid)
 */
type PanelPosition = 'r1c1' | 'r1c2' | 'r1c3' | 'r2c1' | 'r2c2' | 'r2c3'; // row-col notation

interface VisualizationPanel {
  id: string;
  position: PanelPosition;
  mode: VisualizationMode;
  visualizationType?: 'complete' | 'partial' | 'trajectory'; // For 3D variants
  title: string;
  isDragging: boolean;
  dragOffset: { x: number; y: number };
}

interface DraggableGridVisualizationProps {
  currentData: SimulationData | null;
  allData?: SimulationData[];
  equationType?: EquationType;
  globalMin?: number;
  globalMax?: number;
  useFixedAxes?: boolean;
  colorScheme?: string;
  showGrid?: boolean;
  currentTimeIndex?: number;
  totalTimeSteps?: number;
}

/**
 * Default visualization panels configuration (3x2 grid = 6 panels)
 * Layout:
 *   Row 1: [2D Line Plot] [3D Partial] [Strip Animation]
 *   Row 2: [Heatmap] [3D Final] [3D Trajectory]
 */
const DEFAULT_PANELS: VisualizationPanel[] = [
  // Row 1: Column 1 - 2D Line Plot
  {
    id: 'panel-2d',
    position: 'r1c1',
    mode: VisualizationMode.LINE_2D,
    title: '2D Line Plot',
    isDragging: false,
    dragOffset: { x: 0, y: 0 }
  },
  // Row 1: Column 2 - 3D Partial Solution (Time Slice)
  {
    id: 'panel-3d-partial',
    position: 'r1c2',
    mode: VisualizationMode.SURFACE_3D,
    visualizationType: 'partial',
    title: '3D Partial (Time Slice)',
    isDragging: false,
    dragOffset: { x: 0, y: 0 }
  },
  // Row 1: Column 3 - Strip Animation
  {
    id: 'panel-strip',
    position: 'r1c3',
    mode: VisualizationMode.HEATMAP_STRIP,
    title: 'Strip Animation',
    isDragging: false,
    dragOffset: { x: 0, y: 0 }
  },
  // Row 2: Column 1 - Heatmap
  {
    id: 'panel-heatmap',
    position: 'r2c1',
    mode: VisualizationMode.HEATMAP,
    title: 'Heatmap',
    isDragging: false,
    dragOffset: { x: 0, y: 0 }
  },
  // Row 2: Column 2 - 3D Complete Solution (Final)
  {
    id: 'panel-3d-complete',
    position: 'r2c2',
    mode: VisualizationMode.SURFACE_3D,
    visualizationType: 'complete',
    title: '3D Complete Solution',
    isDragging: false,
    dragOffset: { x: 0, y: 0 }
  },
  // Row 2: Column 3 - 3D Trajectory Paths
  {
    id: 'panel-3d-trajectory',
    position: 'r2c3',
    mode: VisualizationMode.SURFACE_3D,
    visualizationType: 'trajectory',
    title: '3D Trajectory Paths',
    isDragging: false,
    dragOffset: { x: 0, y: 0 }
  }
];

/**
 * DraggableGridVisualization Component
 *
 * Renders a 2x2 grid of visualizations that users can:
 * - Drag individual panels to different quadrants
 * - Panels snap to grid positions
 * - Other panels rearrange intelligently
 * - All visualizations update synchronously
 *
 * @example
 * ```tsx
 * <DraggableGridVisualization
 *   currentData={currentData}
 *   allData={allData}
 *   equationType={EquationType.HEAT}
 * />
 * ```
 */
export const DraggableGridVisualization: React.FC<DraggableGridVisualizationProps> = ({
  currentData,
  allData = [],
  equationType = EquationType.HEAT,
  globalMin,
  globalMax,
  useFixedAxes = false,
  colorScheme = 'Viridis',
  showGrid = true,
  currentTimeIndex = 0,
  totalTimeSteps = 0
}) => {
  // State for panel positions and dragging
  const [panels, setPanels] = useState<VisualizationPanel[]>(DEFAULT_PANELS);
  const gridRef = useRef<HTMLDivElement>(null);
  const draggedPanelRef = useRef<VisualizationPanel | null>(null);

  // Get panel by position
  const getPanelAtPosition = (position: PanelPosition): VisualizationPanel | undefined => {
    return panels.find(p => p.position === position);
  };

  // Get closest grid cell based on mouse position (3x2 grid = 3 columns, 2 rows)
  const getClosestGridPosition = useCallback(
    (clientX: number, clientY: number): PanelPosition | null => {
      if (!gridRef.current) return null;

      const gridRect = gridRef.current.getBoundingClientRect();
      const relX = clientX - gridRect.left;
      const relY = clientY - gridRect.top;

      const rowThreshold = gridRect.height / 2;
      const row = relY < rowThreshold ? 1 : 2;

      const colThreshold1 = gridRect.width / 3;
      const colThreshold2 = (gridRect.width * 2) / 3;
      let col = 1;
      if (relX >= colThreshold2) {
        col = 3;
      } else if (relX >= colThreshold1) {
        col = 2;
      }

      return `r${row}c${col}` as PanelPosition;
    },
    [] // gridRef is stable
  );

  // Swap panels between positions
  const swapPanels = useCallback(
    (fromPosition: PanelPosition, toPosition: PanelPosition) => {
      setPanels(prev => {
        const fromPanel = prev.find(p => p.position === fromPosition);
        const toPanel = prev.find(p => p.position === toPosition);
        if (!fromPanel || !toPanel) return prev;
        return prev.map(panel => {
          if (panel.id === fromPanel.id) return { ...panel, position: toPosition, isDragging: false };
          if (panel.id === toPanel.id) return { ...panel, position: fromPosition };
          return panel;
        });
      });
    },
    []
  );

  // Handle panel drag start
  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>, panelId: string) => {
      const panel = panels.find(p => p.id === panelId);
      if (!panel) return;
      draggedPanelRef.current = panel;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('panelId', panelId);
    },
    [panels]
  );

  // Handle drag over grid
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  // Handle drop
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();

      const panelId = e.dataTransfer.getData('panelId');
      const draggedPanel = panels.find(p => p.id === panelId);
      if (!draggedPanel) return;

      const targetPosition = getClosestGridPosition(e.clientX, e.clientY);
      if (!targetPosition) return;

      if (draggedPanel.position !== targetPosition) {
        swapPanels(draggedPanel.position, targetPosition);
      }

      draggedPanelRef.current = null;
    },
    [panels, getClosestGridPosition, swapPanels]
  );

  // Render individual panel with support for different 3D visualization types
  const renderPanel = (position: PanelPosition) => {
    const panel = getPanelAtPosition(position);
    if (!panel) return null;

    const panelHeight = '100%';

    // Determine which component to render based on panel type
    const renderVisualization = () => {
      // 3D Trajectory visualization
      if (panel.mode === VisualizationMode.SURFACE_3D && panel.visualizationType === 'trajectory') {
        return (
          <Trajectory3DVisualization
            allData={allData}
            equationType={equationType}
            globalMin={globalMin}
            globalMax={globalMax}
            height="100%"
            colorScheme={colorScheme}
            showGrid={showGrid}
            title={panel.title}
            samplingRate={allData.length > 50 ? 2 : 1}
          />
        );
      }

      // 3D Partial Solution (Time Slice) - animated with current time
      if (panel.mode === VisualizationMode.SURFACE_3D && panel.visualizationType === 'partial') {
        if (allData.length < 2) {
          return (
            <div style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#a0a0a0'
            }}>
              <div style={{ textAlign: 'center' }}>
                <p>Insufficient data for partial 3D</p>
                <p style={{ fontSize: '0.85rem', color: '#707070' }}>
                  Run simulation to collect data
                </p>
              </div>
            </div>
          );
        }
        return (
          <Partial3DSolution
            allData={allData}
            currentTimeIndex={currentTimeIndex}
            equationType={equationType}
            timeSliceSize={Math.min(15, Math.floor(totalTimeSteps / 4))}
            globalMin={globalMin}
            globalMax={globalMax}
            colorScheme={colorScheme}
            showGrid={showGrid}
            height="100%"
            title={`${panel.title} (t=${allData[currentTimeIndex]?.time_value?.toFixed(4) || '0'})`}
          />
        );
      }

      // Default: VisualizationCanvas for all other modes (2D, heatmap, complete 3D, etc.)
      return (
        <VisualizationCanvas
          currentData={currentData}
          allData={allData}
          mode={panel.mode}
          equationType={equationType}
          title={panel.title}
          showGrid={showGrid}
          globalMin={globalMin}
          globalMax={globalMax}
          useFixedAxes={useFixedAxes}
          colorScheme={colorScheme}
          height={panelHeight}
        />
      );
    };

    return (
      <div
        key={panel.id}
        className={`draggable-grid-panel grid-panel-${position}`}
        draggable={true}
        onDragStart={(e) => handleDragStart(e, panel.id)}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="draggable-panel-header">
          <span className="draggable-panel-title">{panel.title}</span>
          <span className="draggable-handle">⋮⋮</span>
        </div>

        <div className="draggable-panel-content">
          {renderVisualization()}
        </div>
      </div>
    );
  };

  return (
    <div className="draggable-grid-visualization">
      <div className="draggable-grid-header">
        <h3>Interactive 2x2 Visualization Grid</h3>
        <p className="draggable-grid-subtitle">Drag panels to rearrange • Snaps to grid positions</p>
      </div>

      <div
        ref={gridRef}
        className="draggable-grid-container-3x2"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Row 1 */}
        {renderPanel('r1c1')} {/* 2D Line Plot */}
        {renderPanel('r1c2')} {/* 3D Partial */}
        {renderPanel('r1c3')} {/* Strip Animation */}

        {/* Row 2 */}
        {renderPanel('r2c1')} {/* Heatmap */}
        {renderPanel('r2c2')} {/* 3D Complete */}
        {renderPanel('r2c3')} {/* 3D Trajectory */}
      </div>

      {/* Info Indicator */}
      <div className="draggable-grid-info">
        <span className="info-icon">ℹ️</span>
        <span>Drag panel headers to rearrange • Panels snap to quadrants automatically</span>
      </div>
    </div>
  );
};

export default DraggableGridVisualization;
