import { useEffect } from 'react'
import { initScroll, destroyScroll } from './lib/scroll'
import Loader from './components/Loader'
import Hero from './components/Hero'
import Statement from './components/Statement'
import { projects } from './data/projects'

// Sections are added here one at a time as each build phase (Tasks #5–#13)
// lands — this file stays intentionally minimal until then.
function App() {
  useEffect(() => {
    initScroll()
    return () => destroyScroll()
  }, [])

  const heroProject = projects.find((p) => p.slug === 'citadel-tower')

  return (
    <>
      <Loader />
      <main>
        <Hero project={heroProject} />
        <Statement />
      </main>
    </>
  )
}

export default App
