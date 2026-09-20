import { useCallback, useState } from 'react'
import Nav from './components/Nav'
import Boundary from './components/Boundary'
import ProjectStory from './components/ProjectStory'
import ImageViewer from './components/ImageViewer'
import { findVisibleProject, projectPath, visibleProjects } from './lib/content'

// A standalone, shareable page for one project: nirmalstudio.com/projects/<slug>.
// Pre-rendered at build time (scripts/prerender.mjs) with its own title and
// link-preview image, then hydrated in the browser — so WhatsApp/Google see the
// real content and visitors see it before any JavaScript runs.
//
// Kept light on purpose: no GSAP, Lenis or Framer Motion. The homepage's
// full-screen project takeover renders the same <ProjectStory>.
export default function ProjectPage({ slug }) {
  const [viewerImage, setViewerImage] = useState(null)
  const closeViewer = useCallback(() => setViewerImage(null), [])
  const project = findVisibleProject(slug)
  const index = project ? visibleProjects.indexOf(project) : -1
  const prev = index >= 0 ? visibleProjects[(index - 1 + visibleProjects.length) % visibleProjects.length] : null
  const next = index >= 0 ? visibleProjects[(index + 1) % visibleProjects.length] : null

  return (
    <>
      {/* App.jsx wraps its Nav in SectionBoundary; project pages had a bare <Nav />,
          so a throw took down a public, shareable, indexed URL. Boundary (not
          SectionBoundary) because that one imports ScrollTrigger, which would pull
          GSAP + Lenis onto these deliberately light pages. */}
      <Boundary name="Nav">
        <Nav />
      </Boundary>
      <main className="project-page">
        <a href="/#projects" className="project-page-back">
          ← All projects
        </a>

        {project ? (
          <>
            <ProjectStory project={project} onOpenImage={setViewerImage} titleLevel={1} />
            {visibleProjects.length > 1 && (
              <nav className="project-page-nav" aria-label="More projects">
                <a href={projectPath(prev.slug)}>
                  <span>Previous</span>
                  {prev.name}
                </a>
                <a href={projectPath(next.slug)} className="is-next">
                  <span>Next</span>
                  {next.name}
                </a>
              </nav>
            )}
          </>
        ) : (
          <div className="project-page-missing">
            <h1 className="project-detail-name">This project isn’t available</h1>
            <p className="project-detail-copy">It may have been renamed or taken down.</p>
          </div>
        )}
      </main>

      <ImageViewer image={viewerImage} onClose={closeViewer} />

      <style>{`
        .project-page {
          max-width: 760px;
          margin: 0 auto;
          padding: calc(var(--space-lg) + 44px) var(--space-md) var(--space-lg);
          background: var(--color-bg);
        }
        .project-page-back {
          display: inline-flex;
          align-items: center;
          min-height: 44px;
          margin-bottom: var(--space-sm);
          font-family: var(--font-body);
          font-size: 0.85rem;
          color: var(--color-stone-dark);
          text-decoration: none;
        }
        .project-page-nav {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-sm);
          margin-top: var(--space-lg);
          padding-top: var(--space-md);
          border-top: 1px solid var(--color-beige);
        }
        .project-page-nav a {
          display: grid;
          gap: 4px;
          min-height: 44px;
          font-family: var(--font-heading);
          font-size: 1.05rem;
          color: var(--color-text);
          text-decoration: none;
        }
        .project-page-nav a.is-next {
          text-align: right;
        }
        .project-page-nav span {
          font-family: var(--font-body);
          font-size: 0.7rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--color-bronze-darker);
        }
        .project-page-missing {
          padding: var(--space-lg) 0;
        }
      `}</style>
    </>
  )
}
