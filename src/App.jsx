import { useEffect } from 'react'
import { initScroll, destroyScroll } from './lib/scroll'
import { homepageProject, isSectionOn } from './lib/content'
import Loader from './components/Loader'
import Nav from './components/Nav'
import Hero from './components/Hero'
import Statement from './components/Statement'
import FocusImage from './components/FocusImage'
import Philosophy from './components/Philosophy'
import IdeaTimeline from './components/IdeaTimeline'
import FeaturedProjects from './components/FeaturedProjects'
import Studio from './components/Studio'
import Process from './components/Process'
import Journal from './components/Journal'
import Testimonials from './components/Testimonials'
import Contact from './components/Contact'
import SectionBoundary from './components/SectionBoundary'

// Each section sits in its own SectionBoundary: a section that fails to render
// hides itself instead of blanking the whole page. Which project image each
// homepage section shows, and whether a section is shown at all, come from
// content/site.json (editable in the backend).
function App() {
  useEffect(() => {
    initScroll()
    return () => destroyScroll()
  }, [])

  const section = (key, name, element) =>
    key === null || isSectionOn(key) ? <SectionBoundary name={name}>{element}</SectionBoundary> : null

  return (
    <>
      <Loader />
      <SectionBoundary name="Nav">
        <Nav />
      </SectionBoundary>
      <main>
        {section(null, 'Hero', <Hero project={homepageProject('hero')} />)}
        {section('statement', 'Statement', <Statement />)}
        {section('focusImage', 'Focus image', <FocusImage project={homepageProject('focus')} />)}
        {section('philosophy', 'Philosophy', <Philosophy project={homepageProject('philosophy')} />)}
        {section('ideaTimeline', 'Idea timeline', <IdeaTimeline project={homepageProject('timeline')} />)}
        {section('featuredProjects', 'Featured projects', <FeaturedProjects />)}
        {section('studio', 'Studio', <Studio />)}
        {section('process', 'Process', <Process />)}
        {section(null, 'Journal', <Journal />)}
        {section(null, 'Testimonials', <Testimonials />)}
        {section('contact', 'Contact', <Contact />)}
      </main>
    </>
  )
}

export default App
