import { useEffect } from 'react'
import { initScroll, destroyScroll } from './lib/scroll'
import CustomCursor from './components/CustomCursor'
import FontPreview from './components/FontPreview'

// Sections are added here one at a time as each build phase (Tasks #5–#13)
// lands — this file stays intentionally minimal until then.
//
// TEMPORARY: rendering FontPreview instead of the real placeholder while
// Task #4 (font comparison) is being decided. Swap back once a font is
// chosen, then delete FontPreview.jsx.
function App() {
  useEffect(() => {
    initScroll()
    return () => destroyScroll()
  }, [])

  return (
    <>
      <CustomCursor />
      <main>
        <FontPreview />
      </main>
    </>
  )
}

export default App
