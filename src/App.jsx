import { useEffect } from 'react'
import { initScroll, destroyScroll } from './lib/scroll'
import CustomCursor from './components/CustomCursor'

// Sections are added here one at a time as each build phase (Tasks #5–#13)
// lands — this file stays intentionally minimal until then.
function App() {
  useEffect(() => {
    initScroll()
    return () => destroyScroll()
  }, [])

  return (
    <>
      <CustomCursor />
      <main>
        <section
          style={{
            minHeight: '100svh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-heading)',
            fontSize: 'clamp(1.5rem, 4vw, 3rem)',
            textAlign: 'center',
            padding: 'var(--space-lg)',
          }}
        >
          Nirmal Studio — foundation deployed, sections coming next.
        </section>
      </main>
    </>
  )
}

export default App
