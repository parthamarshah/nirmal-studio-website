import { useEffect, useRef, useState } from 'react'
import Img from './Img'
import RichText from './RichText'
import { IMAGE_TYPE_LABELS, STATUS_LABELS, legacyConceptArt, projectUrl, sectionImages } from '../lib/content'
import { PROJECT_STORY_CSS } from '../styles/projectStory'

// A project's full story — cover, facts, and its sections (heading, formatted
// text, images) — rendered from the backend's project data. Shared by the
// homepage takeover (FeaturedProjects.jsx) and standalone project pages
// (ProjectPage.jsx); each supplies its own image viewer via `onOpenImage`.
//
// Images in a section: one shows large (drawings open in the zoomable viewer),
// two or more form a tidy grid. A section image's `shape` sets its frame;
// 'original' keeps the image's own proportions when shown alone, and a 4:3 tile
// in a grid. Nothing is ever cut from the original file — frames are crops of
// the display, not of the upload.
//
// Render-time output must not depend on the browser (no window/matchMedia
// reads): project pages are pre-rendered and hydrated, and a mismatch would
// throw the pre-rendered HTML away.

const SHAPE_RATIO = { '3:2': '3 / 2', '16:9': '16 / 9', '4:5': '4 / 5', '1:1': '1 / 1' }
const SINGLE_SIZES = '(min-width: 760px) 760px, 100vw'
const THUMB_SIZES = '(min-width: 1024px) 240px, (min-width: 760px) 360px, 50vw'

function SectionImages({ project, images, onOpenImage }) {
  const open = (img) =>
    onOpenImage({
      src: img.media,
      alt: img.caption || `${project.name}, ${IMAGE_TYPE_LABELS[img.type].toLowerCase()}`,
      mode: img.type === 'drawing' ? 'pan' : 'fit',
    })

  if (images.length === 1) {
    const img = images[0]
    const alt = img.caption || `${project.name}, ${IMAGE_TYPE_LABELS[img.type].toLowerCase()}`
    if (img.type === 'drawing') {
      return (
        <figure className="project-detail-images is-single">
          <button type="button" className="project-detail-drawing" onClick={() => open(img)}>
            <Img media={img.media} sizes={SINGLE_SIZES} placeholder={false} alt={alt} loading="lazy" />
            <span className="project-detail-drawing-hint">Enlarge</span>
          </button>
          {img.caption && <figcaption className="project-detail-caption">{img.caption}</figcaption>}
        </figure>
      )
    }
    const ratio = SHAPE_RATIO[img.shape]
    return (
      <figure className="project-detail-images is-single">
        <button
          type="button"
          className={`project-detail-single${ratio ? '' : ' is-original'}`}
          style={ratio ? { aspectRatio: ratio } : undefined}
          onClick={() => open(img)}
        >
          <Img media={img.media} sizes={SINGLE_SIZES} alt={alt} loading="lazy" />
          {img.showTag && <span className="project-detail-type-tag">{IMAGE_TYPE_LABELS[img.type]}</span>}
        </button>
        {img.caption && <figcaption className="project-detail-caption">{img.caption}</figcaption>}
      </figure>
    )
  }

  return (
    <div className="project-detail-images project-detail-gallery">
      {images.map((img) => (
        <button
          key={img.id}
          type="button"
          className={`project-detail-thumb${img.type === 'drawing' ? ' is-drawing' : ''}`}
          style={SHAPE_RATIO[img.shape] ? { aspectRatio: SHAPE_RATIO[img.shape] } : undefined}
          onClick={() => open(img)}
          aria-label={`Enlarge: ${img.caption || IMAGE_TYPE_LABELS[img.type]}`}
        >
          <Img
            media={img.media}
            sizes={THUMB_SIZES}
            placeholder={img.type !== 'drawing'}
            alt=""
            aria-hidden="true"
            loading="lazy"
          />
          {img.showTag && <span className="project-detail-type-tag">{IMAGE_TYPE_LABELS[img.type]}</span>}
        </button>
      ))}
    </div>
  )
}

// Phones open the native share sheet; laptops copy the link. If copying is
// blocked, the link appears in a selected box to copy by hand.
function ShareProject({ project }) {
  const [state, setState] = useState('idle') // 'idle' | 'copied' | 'manual'
  const timerRef = useRef(null)
  const url = projectUrl(project.slug)
  useEffect(() => () => window.clearTimeout(timerRef.current), [])
  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: `${project.name} — Nirmal Studio`, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setState('copied')
      window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => setState('idle'), 2000)
    } catch (e) {
      // Closing the phone's share sheet isn't an error worth showing.
      if (e?.name !== 'AbortError') setState('manual')
    }
  }
  return (
    <div className="project-share">
      <button type="button" onClick={share} aria-live="polite">
        {state === 'copied' ? 'Link copied ✓' : 'Share'}
      </button>
      {state === 'manual' && (
        <label className="project-share-manual">
          <span>Copy this link</span>
          <input readOnly value={url} onFocus={(e) => e.target.select()} autoFocus />
        </label>
      )}
    </div>
  )
}

const HEADING_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']

// `titleLevel`: 1 on a project page, 3 inside the homepage takeover. Section
// headings sit one level below the title, and headings written inside a
// section's text one level below that — so the outline never skips levels.
export default function ProjectStory({ project, onOpenImage, titleLevel = 3, showShare = true, showLegacyConceptArt = false }) {
  const Title = HEADING_TAGS[titleLevel - 1]
  const SectionHeading = HEADING_TAGS[Math.min(titleLevel, 5)]
  const { facts, coverMedia } = project
  const factList = [
    facts.status && { label: 'Status', value: STATUS_LABELS[facts.status] },
    facts.siteArea && { label: 'Site Area', value: facts.siteArea },
    facts.builtUpArea && { label: 'Built-up Area', value: facts.builtUpArea },
    ...(facts.custom ?? []),
  ].filter(Boolean)
  const meta = [facts.type, facts.city].filter(Boolean).join(' — ')
  const conceptArt = showLegacyConceptArt ? legacyConceptArt(project.slug) : []

  return (
    <>
      {coverMedia.desktop && (
        <div className={`project-detail-hero${coverMedia.phone ? ' has-phone-framing' : ''}`}>
          <Img media={coverMedia.desktop} mobile={coverMedia.phone} sizes={SINGLE_SIZES} alt={project.name} />
        </div>
      )}

      <div className="project-detail-body">
        {meta && <span className="project-detail-meta">{meta}</span>}
        <Title className="project-detail-name">{project.name}</Title>

        {factList.length > 0 && (
          <dl className="project-detail-facts">
            {factList.map((f) => (
              <div key={f.label}>
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {project.sections.map((section) => {
          const images = sectionImages(project, section)
          if (!section.body && images.length === 0) return null
          return (
            <section key={section.id} className="project-detail-block">
              {section.heading && <SectionHeading className="project-detail-section-heading">{section.heading}</SectionHeading>}
              <RichText doc={section.body} className="project-detail-copy" baseLevel={Math.min(titleLevel + 2, 6)} />
              {images.length > 0 && <SectionImages project={project} images={images} onOpenImage={onOpenImage} />}
            </section>
          )
        })}

        {conceptArt.length > 0 && (
          <section className="project-detail-block">
            <SectionHeading className="project-detail-section-heading">Concept Visualization</SectionHeading>
            <p className="project-detail-concept-note">
              AI-generated imagery to help visualize the space — not real photography or final design output.
              This image set is shared illustratively across related projects, not tied to specific rooms in this one.
            </p>
            <div className="project-detail-gallery">
              {conceptArt.map((img) => (
                <button
                  key={img.id}
                  type="button"
                  className="project-detail-thumb is-concept"
                  aria-label="Enlarge concept visualization"
                  onClick={() =>
                    onOpenImage({
                      src: img.media,
                      alt: `${project.name} concept visualization`,
                      mode: 'fit',
                      label: 'Concept visualization',
                    })
                  }
                >
                  <Img media={img.media} sizes={THUMB_SIZES} alt="" aria-hidden="true" loading="lazy" />
                  <span className="project-detail-thumb-label">AI visualization</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {showShare && <ShareProject project={project} />}
      </div>

      <style>{PROJECT_STORY_CSS}</style>
    </>
  )
}
