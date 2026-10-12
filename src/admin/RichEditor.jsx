import { useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { SAFE_LINK } from '../lib/projectRules.js'

// A section's text. Writes Tiptap's JSON document — the format src/components/RichText.jsx
// renders and src/lib/projectRules.js checks — and offers only what the site can show:
// Body, Heading, Subheading, Pull quote, bold, italic, lists and links. Anything else
// pasted in (colours, fonts, tables, images) is dropped by the editor's schema.
//
// Loaded on demand (React.lazy in ProjectEditor), so the editor library never weighs on
// the rest of /admin, and never on the public site.

const STYLES = [
  { key: 'p', label: 'Body' },
  { key: 'h3', label: 'Heading' },
  { key: 'h4', label: 'Subheading' },
  { key: 'quote', label: 'Pull quote' },
]

const extensions = [
  StarterKit.configure({
    heading: { levels: [3, 4] },
    code: false,
    codeBlock: false,
    horizontalRule: false,
    strike: false,
    underline: false,
    link: {
      openOnClick: false,
      autolink: true,
      defaultProtocol: 'https',
      isAllowedUri: (url) => SAFE_LINK.test(url),
    },
  }),
]

// mousedown is cancelled so a click keeps the text selection it is meant to format.
function Btn({ on, onClick, children, title, off }) {
  return (
    <button type="button" className="admin-rt-btn" aria-pressed={on} title={title} aria-label={title} disabled={off} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
      {children}
    </button>
  )
}

const empty = (doc) => !doc?.content?.some((n) => n.content?.length || n.type !== 'paragraph')

export default function RichEditor({ value, onChange, disabled, label, id }) {
  // The last document this editor handed out. A `value` that isn't it came from somewhere
  // else (a Discard, a conflict resolved, an undo) and replaces what is on screen.
  const emitted = useRef(value)
  const editor = useEditor({
    extensions,
    content: value ?? '',
    editable: !disabled,
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
    editorProps: { attributes: { 'aria-label': label, 'aria-multiline': 'true', role: 'textbox', ...(id ? { id } : {}), class: 'admin-rich-content' } },
    onUpdate: ({ editor: ed }) => {
      const json = ed.getJSON()
      const next = empty(json) ? null : json
      emitted.current = next
      onChange(next)
    },
  })

  useEffect(() => {
    if (!editor || value === emitted.current) return
    emitted.current = value
    editor.commands.setContent(value ?? '', { emitUpdate: false })
  }, [editor, value])

  useEffect(() => {
    editor?.setEditable(!disabled)
  }, [editor, disabled])

  const st = useEditorState({
    editor,
    selector: ({ editor: ed }) =>
      ed
        ? {
            style: ed.isActive('heading', { level: 3 }) ? 'h3' : ed.isActive('heading', { level: 4 }) ? 'h4' : ed.isActive('blockquote') ? 'quote' : 'p',
            bold: ed.isActive('bold'),
            italic: ed.isActive('italic'),
            bullet: ed.isActive('bulletList'),
            ordered: ed.isActive('orderedList'),
            link: ed.isActive('link') ? ed.getAttributes('link').href : null,
            hasSelection: !ed.state.selection.empty,
          }
        : null,
  })

  const [linking, setLinking] = useState(null) // the href being typed, or null
  const [linkError, setLinkError] = useState(null)

  if (!editor || !st) return null
  const chain = () => editor.chain().focus()
  const setStyle = (key) => {
    let c = chain()
    if (editor.isActive('blockquote') && key !== 'quote') c = c.lift('blockquote')
    if (key === 'p') c.setParagraph().run()
    else if (key === 'h3') c.setHeading({ level: 3 }).run()
    else if (key === 'h4') c.setHeading({ level: 4 }).run()
    else c.setParagraph().setBlockquote().run()
  }
  const applyLink = () => {
    let href = (linking ?? '').trim()
    if (!href) {
      chain().extendMarkRange('link').unsetLink().run()
      setLinking(null)
      return
    }
    if (!/^[a-z]+:/i.test(href) && !href.startsWith('/')) href = href.includes('@') && !href.includes('/') ? `mailto:${href}` : `https://${href}`
    if (!SAFE_LINK.test(href)) {
      setLinkError('Links must start with https://, mailto: or tel:.')
      return
    }
    chain().extendMarkRange('link').setLink({ href }).run()
    setLinking(null)
    setLinkError(null)
  }

  return (
    <div className={`admin-rich${disabled ? ' is-disabled' : ''}`}>
      <div className="admin-rt-bar" role="toolbar" aria-label={`Formatting for ${label}`}>
        <select className="admin-rt-style" value={st.style} disabled={disabled} aria-label="Paragraph style" onChange={(e) => setStyle(e.target.value)}>
          {STYLES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <span className="admin-rt-sep" />
        <Btn on={st.bold} off={disabled} title="Bold" onClick={() => chain().toggleBold().run()}>
          <b>B</b>
        </Btn>
        <Btn on={st.italic} off={disabled} title="Italic" onClick={() => chain().toggleItalic().run()}>
          <i>I</i>
        </Btn>
        <span className="admin-rt-sep" />
        <Btn on={st.bullet} off={disabled} title="Bulleted list" onClick={() => chain().toggleBulletList().run()}>
          • List
        </Btn>
        <Btn on={st.ordered} off={disabled} title="Numbered list" onClick={() => chain().toggleOrderedList().run()}>
          1. List
        </Btn>
        <span className="admin-rt-sep" />
        <Btn
          on={!!st.link}
          title={st.link ? 'Edit link' : st.hasSelection ? 'Add link' : 'Select some text to add a link'}
          off={disabled || (!st.link && !st.hasSelection)}
          onClick={() => {
            setLinkError(null)
            setLinking(st.link ?? '')
          }}
        >
          Link
        </Btn>
      </div>
      {linking !== null && (
        <div className="admin-rt-link">
          <input
            type="text"
            inputMode="url"
            autoFocus
            value={linking}
            placeholder="https://… or name@example.com"
            aria-label="Link address"
            onChange={(e) => setLinking(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                applyLink()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                setLinking(null)
              }
            }}
          />
          <button type="button" className="admin-btn" onClick={applyLink}>
            {linking.trim() ? 'Apply' : 'Remove link'}
          </button>
          <button type="button" className="admin-link" onClick={() => setLinking(null)}>
            Cancel
          </button>
          {linkError && <p className="admin-field-error">{linkError}</p>}
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  )
}
