import gurjarLogo from './gurjar-logo.webp'

// Links to the two older sister businesses (Gurjar Sahitya Bhavan, Sharda Design).
// Meant to be found by the curious, never pushed: no label, short names, a small
// pill each — shown at the foot of the phone menu (Nav.jsx) and as a quiet closing
// strip on every page (<SisterFooter>). Decided by Parth on 2026-10-18; see CLAUDE.md.
//
// The /en paths are deliberate: gurjarbooks.com's root redirects to Gujarati (/gu).
// rel="noopener" without "noreferrer" so the sister sites can see the visits came from here.
//
// No render-time browser reads — this is pre-rendered on project pages.

// Sharda's own mark, redrawn from its favicon.svg with the colour set directly on the
// paths: the original's <style> block would restyle every <path> on the page, and its
// dark-mode stroke is near-invisible on this site's cream.
function ShardaMark() {
  return (
    <svg className="sister-logo" viewBox="-20 -4 104 108" aria-hidden="true" focusable="false">
      <g fill="none" stroke="#4A4038" strokeWidth="7">
        <path d="M0,100V32A32,32 0 0 1 64,32V100Z" />
        <path d="M64,32H48A16,16 0 1 0 32,48A16,16 0 1 1 32,80H0" />
      </g>
    </svg>
  )
}

const SITES = [
  {
    name: 'Gurjar',
    fullName: 'Gurjar Sahitya Bhavan',
    href: 'https://gurjarbooks.com/en',
    logo: <img className="sister-logo" src={gurjarLogo} width="78" height="100" alt="" />,
  },
  {
    name: 'Sharda',
    fullName: 'Sharda Design',
    href: 'https://www.shardadesign.com/en/',
    logo: <ShardaMark />,
  },
]

export function SisterLinks({ className = '', onLinkClick }) {
  return (
    <div className={`sister-links ${className}`}>
      {SITES.map((site) => (
        <a
          key={site.href}
          href={site.href}
          target="_blank"
          rel="noopener"
          className="sister-link"
          aria-label={`${site.fullName} (opens in a new tab)`}
          title={site.fullName}
          onClick={onLinkClick}
        >
          {site.logo}
          <span>{site.name}</span>
          <span className="sister-arrow" aria-hidden="true">
            ↗
          </span>
        </a>
      ))}
      <style>{`
        .sister-links {
          display: flex;
          flex-wrap: wrap;
          gap: 0.6rem;
        }
        .sister-link {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          min-height: 44px;
          padding: 0 0.95rem 0 0.6rem;
          border: 1px solid var(--color-beige);
          border-radius: 999px;
          font-family: var(--font-body);
          font-size: 0.85rem;
          letter-spacing: 0.02em;
          color: var(--color-stone-dark);
          text-decoration: none;
          transition: color 0.25s ease, border-color 0.25s ease;
        }
        .sister-link:hover,
        .sister-link:focus-visible {
          color: var(--color-text);
          border-color: var(--color-stone);
        }
        .sister-logo {
          display: block;
          width: auto;
          height: 28px;
        }
        .sister-arrow {
          font-size: 0.8em;
          transition: transform 0.25s ease;
        }
        .sister-link:hover .sister-arrow,
        .sister-link:focus-visible .sister-arrow {
          transform: translate(2px, -2px);
        }
      `}</style>
    </div>
  )
}

// The closing strip after <main>, on the homepage and on project pages.
export default function SisterFooter() {
  return (
    <footer className="sister-footer" aria-label="Sister businesses">
      <SisterLinks />
      <style>{`
        .sister-footer {
          display: flex;
          justify-content: center;
          padding: var(--space-md);
          background: var(--color-bg);
        }
        .sister-footer .sister-links { justify-content: center; }
      `}</style>
    </footer>
  )
}
