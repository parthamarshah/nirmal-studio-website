// Styles for <ProjectStory>, shared by the homepage takeover and the standalone
// project pages. A plain string rendered in a <style> tag (this codebase's
// pattern), so pre-rendered project pages arrive already styled.
export const PROJECT_STORY_CSS = `
  .project-detail-hero {
    position: relative;
    margin: 0 0 var(--space-md);
    border-radius: 4px;
    overflow: hidden;
    aspect-ratio: 16 / 9;
    background: var(--color-beige);
  }
  .project-detail-hero img {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  @media (max-width: 640px) {
    .project-detail-hero.has-phone-framing {
      aspect-ratio: 4 / 5;
    }
  }
  .project-detail-meta {
    display: block;
    font-family: var(--font-body);
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-bronze-darker);
    margin-bottom: var(--space-xs);
  }
  .project-detail-name {
    font-family: var(--font-heading);
    font-weight: 400;
    font-size: clamp(1.6rem, 4vw, 2.25rem);
    margin: 0 0 var(--space-sm);
  }
  .project-detail-facts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-sm) var(--space-md);
    margin: 0 0 var(--space-md);
    padding-bottom: var(--space-md);
    border-bottom: 1px solid var(--color-beige);
  }
  .project-detail-facts dt {
    font-family: var(--font-body);
    font-size: 0.7rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-stone-dark);
  }
  .project-detail-facts dd {
    margin: 2px 0 0;
    font-family: var(--font-heading);
    font-size: 1.1rem;
  }
  .project-detail-block {
    margin-top: var(--space-md);
  }
  .project-detail-section-heading {
    font-family: var(--font-body);
    font-weight: 400;
    font-size: 0.75rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-bronze-darker);
    margin: 0 0 var(--space-xs);
  }
  .project-detail-copy {
    font-family: var(--font-body);
    font-size: 0.95rem;
    line-height: 1.7;
    color: var(--color-text);
    max-width: 60ch;
  }
  .project-detail-copy p + p,
  .project-detail-copy p + ul,
  .project-detail-copy p + ol {
    margin-top: var(--space-sm);
  }
  .project-detail-copy ul,
  .project-detail-copy ol {
    margin: var(--space-xs) 0;
    padding-left: 1.25rem;
  }
  .project-detail-copy a {
    color: var(--color-bronze-darker);
    text-underline-offset: 3px;
  }
  .rich-heading {
    font-family: var(--font-heading);
    font-weight: 400;
    font-size: 1.2rem;
    line-height: 1.25;
    margin: var(--space-sm) 0 var(--space-xs);
  }
  .rich-subheading {
    font-family: var(--font-heading);
    font-weight: 500;
    font-size: 1.05rem;
    margin: var(--space-sm) 0 4px;
  }
  .rich-quote {
    margin: var(--space-sm) 0;
    padding-left: var(--space-sm);
    border-left: 2px solid var(--color-bronze);
    font-family: var(--font-heading);
    font-style: italic;
    font-size: 1.2rem;
    line-height: 1.5;
  }
  .rich-quote p { margin: 0; }
  .project-detail-images {
    margin-top: var(--space-sm);
  }
  figure.project-detail-images {
    margin: var(--space-sm) 0 0;
  }
  .project-detail-single {
    position: relative;
    display: block;
    width: 100%;
    padding: 0;
    border: none;
    border-radius: 4px;
    overflow: hidden;
    background: var(--color-beige);
    cursor: zoom-in;
  }
  .project-detail-single img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .project-detail-single.is-original img {
    height: auto;
  }
  .project-detail-caption {
    margin-top: 6px;
    font-family: var(--font-body);
    font-size: 0.8rem;
    color: var(--color-stone-dark);
  }
  .project-detail-gallery {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-xs);
  }
  .project-detail-thumb {
    position: relative;
    padding: 0;
    border: none;
    border-radius: 4px;
    overflow: hidden;
    cursor: zoom-in;
    aspect-ratio: 4 / 3;
    background: var(--color-beige);
  }
  .project-detail-thumb img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .project-detail-thumb.is-drawing {
    background: #fff;
    border: 1px solid var(--color-beige);
  }
  .project-detail-thumb.is-drawing img {
    object-fit: contain;
  }
  .project-detail-thumb.is-concept img {
    filter: saturate(0.7) brightness(0.96);
  }
  .project-detail-thumb.is-concept {
    border: 1px dashed var(--color-stone);
  }
  .project-detail-type-tag,
  .project-detail-thumb-label {
    position: absolute;
    right: 6px;
    bottom: 6px;
    padding: 3px 8px;
    border-radius: 999px;
    background: rgba(17, 17, 17, 0.75);
    color: var(--color-warm-white);
    font-family: var(--font-body);
    font-size: 0.65rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    pointer-events: none;
  }
  .project-detail-concept-note {
    font-family: var(--font-body);
    font-size: 0.8rem;
    line-height: 1.6;
    color: var(--color-stone-dark);
    max-width: 60ch;
    margin: 0 0 var(--space-sm);
  }
  .project-detail-drawing {
    position: relative;
    display: block;
    width: 100%;
    padding: 0;
    border: 1px solid var(--color-beige);
    background: none;
    cursor: zoom-in;
  }
  .project-detail-drawing img {
    display: block;
    width: 100%;
    height: auto;
  }
  .project-detail-drawing-hint {
    position: absolute;
    right: 8px;
    bottom: 8px;
    padding: 4px 10px;
    border-radius: 999px;
    background: rgba(17, 17, 17, 0.7);
    color: var(--color-warm-white);
    font-family: var(--font-body);
    font-size: 0.7rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .project-share {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-xs) var(--space-sm);
    margin-top: var(--space-md);
  }
  .project-share button,
  .project-share a {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: var(--space-xs) var(--space-sm);
    border: 1px solid var(--color-beige);
    border-radius: 999px;
    background: var(--color-warm-white);
    color: var(--color-text);
    font-family: var(--font-body);
    font-size: 0.85rem;
    text-decoration: none;
    cursor: pointer;
  }
  .project-share-manual {
    display: grid;
    gap: 4px;
    flex: 1 1 260px;
    font-family: var(--font-body);
    font-size: 0.75rem;
    color: var(--color-stone-dark);
  }
  .project-share-manual input {
    min-height: 44px;
    padding: 0 var(--space-xs);
    border: 1px solid var(--color-beige);
    border-radius: 6px;
    background: var(--color-warm-white);
    font: inherit;
    font-size: 0.85rem;
    color: var(--color-text);
  }
  .project-detail-body a:focus-visible,
  .project-detail-body button:focus-visible,
  .project-detail-body input:focus-visible {
    outline: 2px solid var(--color-bronze-darker);
    outline-offset: 3px;
  }
  @media (min-width: 1024px) {
    .project-detail-gallery {
      grid-template-columns: repeat(3, 1fr);
    }
  }
`
