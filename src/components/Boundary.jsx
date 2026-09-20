import { Component } from 'react'

// A minimal error boundary with NO dependencies.
//
// Deliberately separate from SectionBoundary: that one imports ScrollTrigger from
// lib/scroll, which would drag GSAP + Lenis into the project-page bundle and break the
// "no GSAP/Lenis/Framer on project pages" rule in CLAUDE.md. This one is safe to use
// anywhere, including inside the shared <Nav>.
//
// Scope it as tightly as the thing that might throw. A boundary's `failed` state never
// resets, so whatever it wraps is gone for the rest of the page's life — wrapping the
// nav to protect the Talk-to-Tej panel would mean a panel bug silently deletes the
// wordmark, the menu and the contact button too, on a public shareable URL.
export default class Boundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.error(`[Nirmal Studio] "${this.props.name}" failed to render and was hidden:`, error)
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}
