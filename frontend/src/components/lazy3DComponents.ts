/**
 * Lazy-loaded 3D visualization components
 *
 * Use these exports instead of direct imports when the 3D views are not
 * needed on the initial paint (e.g., they're behind a tab or toggle).
 * React.lazy() defers their bundle chunk until first render.
 *
 * Usage:
 *   import { LazyTrajectory3D, LazyPartial3D, LazyEnhanced3D } from './lazy3DComponents';
 *   // Wrap usage site in <Suspense fallback={<Spinner />}>
 */

import { lazy } from 'react';

export const LazyTrajectory3D = lazy(() => import('./Trajectory3DVisualization'));
export const LazyPartial3D = lazy(() => import('./Partial3DSolution'));
export const LazyEnhanced3D = lazy(() => import('./Enhanced3DViewer'));
