import type { RouteObject } from 'react-router-dom'
import { AppShell } from './AppShell'
import { ErrorBoundary } from './ErrorBoundary'
import { MyFarmPage } from './MyFarmPage'
import { NotFoundPage } from './NotFoundPage'
import { DashboardPage } from '../features/dashboard'
import { RotationPage } from '../features/rotation'
import { ScenarioPage } from '../features/scenarios'
import { PlantCheckPage } from '../features/plant'
import { EvidencePage } from '../features/evidence'
import { OnboardingPage } from '../features/onboarding'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: (
      <ErrorBoundary>
        <AppShell />
      </ErrorBoundary>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'farm', element: <MyFarmPage /> },
      { path: 'rotation', element: <RotationPage /> },
      { path: 'scenarios', element: <ScenarioPage /> },
      { path: 'plant', element: <PlantCheckPage /> },
      { path: 'evidence', element: <EvidencePage /> },
      { path: 'onboarding', element: <OnboardingPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
