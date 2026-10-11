// The nav's sections, shared by Nav.jsx (renders them) and HomeNav.jsx (works out
// which one is in view). Its own file so Nav.jsx exports only a component.
export const NAV_LINKS = [
  { label: 'Work', href: '#projects', section: 'featuredProjects' },
  { label: 'Studio', href: '#studio', section: 'studio' },
  { label: 'Process', href: '#process', section: 'process' },
  { label: 'Journal', href: '#journal', requiresJournal: true },
  { label: 'Contact', href: '#contact', section: 'contact' },
]
