import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './index.css'

// Two kinds of page, each loaded as its own chunk so a project page never
// downloads the homepage's animation libraries:
//   /projects/<slug> → ProjectPage (pre-rendered at build, so hydrate it)
//   everything else  → the homepage App (rendered in the browser)
const root = document.getElementById('root')
const projectMatch = window.location.pathname.match(/^\/projects\/([a-z0-9-]+)\/?$/)

if (projectMatch) {
  import('./ProjectPage.jsx').then(({ default: ProjectPage }) => {
    const page = (
      <StrictMode>
        <ProjectPage slug={projectMatch[1]} />
      </StrictMode>
    )
    // A pre-rendered page has markup to hydrate; an unknown slug (served the
    // plain app shell) doesn't.
    if (root.hasChildNodes()) hydrateRoot(root, page)
    else createRoot(root).render(page)
  })
} else {
  import('./App.jsx').then(({ default: App }) => {
    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
}
