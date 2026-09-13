import { Component } from 'react'
import { ScrollTrigger } from '../lib/scroll'

// Wraps each homepage section. If one section throws while rendering (say, a
// content entry is missing a field it expects), only that section disappears —
// the rest of the page keeps working, instead of the whole site going blank.
export default class SectionBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.error(`[Nirmal Studio] "${this.props.name}" section failed to render and was hidden:`, error)
    // The page just got shorter — re-measure so later sections' scroll
    // animations don't wait for a point that no longer exists.
    requestAnimationFrame(() => ScrollTrigger.refresh())
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}
