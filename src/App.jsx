import { useEffect } from 'react'
import { initScroll, destroyScroll, scrollTo } from './lib/scroll'
import { homepageProject, isSectionOn } from './lib/content'
import Loader from './components/Loader'
import HomeNav from './components/HomeNav'
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
    // Arriving from another page via a link like "/#projects" (project pages'
    // nav and "All projects"): the section didn't exist when the browser tried
    // to jump, so scroll there once the page has laid out.
    const hash = window.location.hash
    const timer = hash.length > 1 ? window.setTimeout(() => scrollTo(hash), 600) : null
    return () => {
      if (timer) window.clearTimeout(timer)
      destroyScroll()
    }
  }, [])

  const section = (key, name, element) =>
    key === null || isSectionOn(key) ? <SectionBoundary name={name}>{element}</SectionBoundary> : null

  return (
    <>
      <Loader />
      <SectionBoundary name="Nav">
        <HomeNav />
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
