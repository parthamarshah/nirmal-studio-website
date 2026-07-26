// Temporary, throwaway comparison tool for Task #4 — not part of the final
// site. Delete this file (and its wiring in App.jsx, and the Google Fonts
// link in index.html) once a heading font + wordmark are chosen.
const headlineSamples = [
  {
    name: 'Fraunces',
    vibe: 'Warm & soft — rounder, slightly organic letterforms',
    family: "'Fraunces', serif",
    weight: 400,
  },
  {
    name: 'Newsreader',
    vibe: 'Cool & editorial — classic literary serif, sharper contrast',
    family: "'Newsreader', serif",
    weight: 400,
  },
  {
    name: 'Piazzolla',
    vibe: 'Cool & sharp — higher-contrast, more formal/architectural',
    family: "'Piazzolla', serif",
    weight: 400,
  },
]

const wordmarkSamples = [
  { name: 'Unbounded', family: "'Unbounded', sans-serif", bold: 900, thin: 200 },
  { name: 'Syne', family: "'Syne', sans-serif", bold: 800, thin: 400 },
]

const headline = 'Most houses look beautiful. Few truly feel like home.'

export default function FontPreview() {
  return (
    <div
      style={{
        minHeight: '100vh',
        padding: 'var(--space-lg) var(--space-md)',
        maxWidth: 1000,
        margin: '0 auto',
      }}
    >
      <p style={{ fontFamily: 'var(--font-body)', marginBottom: 'var(--space-xl)' }}>
        Font comparison — pick by looking, not by name. This page is temporary.
      </p>

      <h2 style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', opacity: 0.6 }}>
        Heading serif candidates
      </h2>
      {headlineSamples.map((f) => (
        <div key={f.name} style={{ marginBottom: 'var(--space-xl)' }}>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.85rem',
              opacity: 0.6,
              marginBottom: 'var(--space-xs)',
            }}
          >
            {f.name} — {f.vibe}
          </p>
          <p
            style={{
              fontFamily: f.family,
              fontWeight: f.weight,
              fontSize: 'clamp(1.75rem, 5vw, 3.5rem)',
              lineHeight: 1.15,
            }}
          >
            {headline}
          </p>
        </div>
      ))}

      <h2
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '1rem',
          opacity: 0.6,
          marginTop: 'var(--space-2xl)',
        }}
      >
        Wordmark candidates (licensed alternatives to Stinger Wide)
      </h2>
      {wordmarkSamples.map((f) => (
        <div key={f.name} style={{ marginBottom: 'var(--space-lg)' }}>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.85rem',
              opacity: 0.6,
              marginBottom: 'var(--space-xs)',
            }}
          >
            {f.name}
          </p>
          <p style={{ fontSize: 'clamp(2rem, 6vw, 4rem)', lineHeight: 1 }}>
            <span style={{ fontFamily: f.family, fontWeight: f.bold }}>nirmal</span>{' '}
            <span style={{ fontFamily: f.family, fontWeight: f.thin }}>studio</span>
          </p>
        </div>
      ))}
    </div>
  )
}
