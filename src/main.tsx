import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { FarmWiseProvider } from '@/core/store'
import { AppShell } from '@/app/AppShell'
import { AppRouter } from '@/app/Router'
import { ErrorBoundary } from '@/app/ErrorBoundary'
import '@/styles/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <FarmWiseProvider>
          <AppShell>
            <ErrorBoundary>
              <AppRouter />
            </ErrorBoundary>
          </AppShell>
        </FarmWiseProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
)
