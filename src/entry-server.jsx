// Server-side entry used only by scripts/prerender.mjs at build time.
import { renderToString } from 'react-dom/server'
import ProjectPage from './ProjectPage.jsx'
import { visibleProjects } from './lib/content'

export { visibleProjects }

export const renderProject = (slug) => renderToString(<ProjectPage slug={slug} />)
