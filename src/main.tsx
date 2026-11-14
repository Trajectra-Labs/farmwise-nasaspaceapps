import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import { routes } from './app/routes'
import { FarmWiseProvider } from './core'
import './styles/global.css'

const router = createBrowserRouter(routes)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FarmWiseProvider>
      <RouterProvider router={router} />
    </FarmWiseProvider>
  </StrictMode>,
)
