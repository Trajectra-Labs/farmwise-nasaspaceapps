/**
 * FarmWise Router — Shaheem
 * Defines all routes and mounts feature pages.
 */
import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useFarmWise } from '@/core/store';
import { Skeleton } from '@/ui/components';
import { NotFoundPage } from './NotFoundPage';

const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'));
const FarmPage = lazy(() => import('@/features/farm-map/FarmPage'));
const RotationPage = lazy(() => import('@/features/rotation/RotationPage').then(m => ({ default: m.RotationPage })));
const ScenarioPage = lazy(() => import('@/features/scenarios/ScenarioPage').then(m => ({ default: m.ScenarioPage })));
const PlantCheckPage = lazy(() => import('@/features/plant/PlantCheckPage').then(m => ({ default: m.PlantCheckPage })));
const EvidencePage = lazy(() => import('@/features/evidence/EvidencePage').then(m => ({ default: m.EvidencePage })));
const OnboardingPage = lazy(() => import('@/features/onboarding/OnboardingPage'));

/** Warm the other route chunks once the first page is idle, so navigation also works with a flaky or lost connection. */
const prefetchers = [
  () => import('@/features/dashboard/DashboardPage'),
  () => import('@/features/farm-map/FarmPage'),
  () => import('@/features/rotation/RotationPage'),
  () => import('@/features/scenarios/ScenarioPage'),
  () => import('@/features/plant/PlantCheckPage'),
  () => import('@/features/evidence/EvidencePage'),
];
function usePrefetchRoutes() {
  React.useEffect(() => {
    const run = () => prefetchers.forEach((load) => { load().catch(() => undefined); });
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(run);
    else window.setTimeout(run, 1500);
  }, []);
}

function PageLoader() {
  return (
    // Layout lives in components.css (.fw-page-loader) so the placeholder follows the content
    // padding and never overflows narrow screens.
    <div className="fw-page-loader" role="status">
      <span className="sr-only">Loading page</span>
      <Skeleton className="fw-page-loader__title" height="44px" />
      <Skeleton className="fw-page-loader__subtitle" height="20px" />
      <div className="fw-page-loader__grid">
        {[1, 2, 3].map(i => <Skeleton key={i} height="160px" />)}
      </div>
    </div>
  );
}

function RequireFarm({ children }: { children: React.ReactNode }) {
  const { state } = useFarmWise();
  if (!state.farm) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

export function AppRouter() {
  usePrefetchRoutes();
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/" element={<RequireFarm><DashboardPage /></RequireFarm>} />
        <Route path="/farm" element={<RequireFarm><FarmPage /></RequireFarm>} />
        <Route path="/rotation" element={<RequireFarm><RotationPage /></RequireFarm>} />
        <Route path="/scenarios" element={<RequireFarm><ScenarioPage /></RequireFarm>} />
        <Route path="/plant" element={<RequireFarm><PlantCheckPage /></RequireFarm>} />
        <Route path="/evidence" element={<RequireFarm><EvidencePage /></RequireFarm>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
