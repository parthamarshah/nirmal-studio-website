import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './admin.css'
import Admin from './Admin.jsx'

// Second Vite entry (admin/index.html). Nothing here is reachable from the public
// site's bundle — see vite.config.js and the chunk check in progress.md.
createRoot(document.getElementById('admin-root')).render(
  <StrictMode>
    <Admin />
  </StrictMode>,
)
