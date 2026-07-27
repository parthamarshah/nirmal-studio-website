import { useEffect } from 'react'
import { initScroll, destroyScroll } from './lib/scroll'
import Loader from './components/Loader'
import Hero from './components/Hero'
import Statement from './components/Statement'
import FocusImage from './components/FocusImage'
import Philosophy from './components/Philosophy'
import IdeaTimeline from './components/IdeaTimeline'
import FeaturedProjects from './components/FeaturedProjects'
import Studio from './components/Studio'
import Process from './components/Process'
import { projects } from './data/projects'

// Sections are added here one at a time as each build phase (Tasks #5–#13)
// lands — this file stays intentionally minimal until then.
function App() {
  useEffect(() => {
    initScroll()
    return () => destroyScroll()
  }, [])

  const heroProject = projects.find((p) => p.slug === 'citadel-tower')
  const focusProject = projects.find((p) => p.slug === 'terra-row-houses')
  const philosophyProject = projects.find((p) => p.slug === 'dolomite-factory-office')
  const timelineProject = projects.find((p) => p.slug === 'nishee-house')

  return (
    <>
      <Loader />
      <main>
        <Hero project={heroProject} />
        <Statement />
        <FocusImage project={focusProject} />
        <Philosophy project={philosophyProject} />
        <IdeaTimeline project={timelineProject} />
        <FeaturedProjects />
        <Studio />
        <Process />
      </main>
    </>
  )
}

export default App
