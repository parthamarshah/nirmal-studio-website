// Renders text written in the backend's editor (Tiptap's JSON document format)
// as plain React elements — never as raw HTML, so pasted content can't inject
// markup or scripts. Unknown node types render their children (or nothing),
// so a newer editor feature can never crash a page.
//
// Supported: paragraph, heading (3 = Heading, 4 = Subheading), blockquote
// (Pull quote), bulletList, orderedList, listItem, hardBreak, text with bold /
// italic / link marks.

const SAFE_LINK = /^(https?:\/\/|mailto:|tel:|\/)/i

function renderText(node, key) {
  let out = node.text ?? ''
  for (const mark of node.marks ?? []) {
    if (mark.type === 'bold') out = <strong key={key}>{out}</strong>
    else if (mark.type === 'italic') out = <em key={key}>{out}</em>
    else if (mark.type === 'link' && SAFE_LINK.test(mark.attrs?.href ?? '')) {
      const href = mark.attrs.href
      const external = /^https?:\/\//i.test(href) && !href.startsWith('https://nirmalstudio.com')
      out = (
        <a key={key} href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
          {out}
        </a>
      )
    }
  }
  return out
}

const TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']

function renderNodes(nodes = [], base) {
  return nodes.map((node, i) => renderNode(node, i, base))
}

function renderNode(node, key, base) {
  switch (node.type) {
    case 'text':
      return <span key={key}>{renderText(node, key)}</span>
    case 'hardBreak':
      return <br key={key} />
    case 'paragraph':
      return node.content?.length ? <p key={key}>{renderNodes(node.content, base)}</p> : null
    case 'heading': {
      // Editor level 3 = Heading, 4 = Subheading; mapped onto the page's outline.
      const sub = node.attrs?.level === 4
      const Tag = TAGS[Math.min(base + (sub ? 1 : 0), 6) - 1]
      return (
        <Tag key={key} className={sub ? 'rich-subheading' : 'rich-heading'}>
          {renderNodes(node.content, base)}
        </Tag>
      )
    }
    case 'blockquote':
      return (
        <blockquote key={key} className="rich-quote">
          {renderNodes(node.content, base)}
        </blockquote>
      )
    case 'bulletList':
      return <ul key={key}>{renderNodes(node.content, base)}</ul>
    case 'orderedList':
      return <ol key={key}>{renderNodes(node.content, base)}</ol>
    case 'listItem':
      return <li key={key}>{renderNodes(node.content, base)}</li>
    default:
      return node.content ? <span key={key}>{renderNodes(node.content, base)}</span> : null
  }
}

// `baseLevel`: the HTML heading level a "Heading" in this text should use.
export default function RichText({ doc, className, baseLevel = 4 }) {
  if (!doc?.content?.length) return null
  return <div className={className}>{renderNodes(doc.content, baseLevel)}</div>
}
