import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { generateHTML } from '@tiptap/html'
import { common, createLowlight } from 'lowlight'
import { CalloutExtension } from './CalloutExtension'
import { SOPLinkNode } from './SOPLinkNode'
import { useSOPStore } from '@/stores/sopStore'
import { useT } from '@/i18n'
import type { JSONContent } from '@tiptap/react'
import type { Editor } from '@tiptap/react'
import type { SOP } from '@/types/sop'

const lowlight = createLowlight(common)

// Shared extensions for both editor and generateHTML
export function getSopEditorExtensions(placeholder?: string) {
  return [
    StarterKit.configure({ codeBlock: false }),
    Table.configure({ resizable: false }),
    TableRow,
    TableCell,
    TableHeader,
    CodeBlockLowlight.configure({ lowlight }),
    Link.configure({ openOnClick: false }),
    Placeholder.configure({ placeholder: placeholder ?? '' }),
    CalloutExtension,
    SOPLinkNode,
  ]
}

// For static HTML generation (no placeholder needed)
const renderExtensions = getSopEditorExtensions()

export function renderContentHTML(content: JSONContent | null): string {
  if (!content) return ''
  return generateHTML(content, renderExtensions)
}

// Preprocess content to mark deleted SOP links
export function preprocessContent(
  content: JSONContent,
  existingSopIds: Set<string>,
  deletedLabel: string
): JSONContent {
  if (!content) return content
  const result = { ...content }
  if (result.content) {
    result.content = result.content.map((node) => {
      if (node.type === 'sopLink' && node.attrs?.sopId && !existingSopIds.has(node.attrs.sopId)) {
        return {
          type: 'text',
          text: `[📋 ${deletedLabel}]`,
          marks: [{ type: 'italic' }],
        }
      }
      if (node.content) {
        return preprocessContent(node, existingSopIds, deletedLabel)
      }
      return node
    })
  }
  return result
}

// ── Editor component ──────────────────────────────────────────

interface Props {
  content: JSONContent | null
  onChange: (content: JSONContent | null) => void
  placeholder?: string
}

export function SOPRichEditor({ content, onChange, placeholder }: Props) {
  const t = useT()

  const editor = useEditor({
    extensions: getSopEditorExtensions(placeholder ?? t.sop_content_placeholder),
    content: content ?? undefined,
    onUpdate: ({ editor: ed }) => {
      const json = ed.getJSON()
      const isEmpty = !ed.state.doc.textContent.trim()
      onChange(isEmpty ? null : json)
    },
  })

  if (!editor) return null

  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
      }}
    >
      <Toolbar editor={editor} />
      <div className="sop-rich-editor-content">
        <EditorContent
          editor={editor}
          style={{
            padding: '8px 12px',
            minHeight: 80,
            fontSize: 13,
            color: 'var(--color-text)',
          }}
        />
      </div>
      <style>{calloutCSS}</style>
    </div>
  )
}

// ── Toolbar ──────────────────────────────────────────────────

function Toolbar({ editor }: { editor: Editor }) {
  const t = useT()
  const { sops } = useSOPStore()
  const [showSOPSearch, setShowSOPSearch] = useState(false)
  const [sopSearchQuery, setSOPSearchQuery] = useState('')
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showSOPSearch) return
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSOPSearch(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showSOPSearch])

  const insertLink = useCallback(() => {
    const url = window.prompt(t.sop_insertLink)
    if (url) {
      editor.chain().focus().setLink({ href: url }).run()
    }
  }, [editor, t])

  const filteredSOPs = sops.filter((s) =>
    !s.isSystem && s.title.toLowerCase().includes(sopSearchQuery.toLowerCase())
  )

  function insertSOPLink(sop: SOP) {
    editor.chain().focus().insertContent({
      type: 'sopLink',
      attrs: { sopId: sop.id, sopTitle: sop.title },
    }).run()
    setShowSOPSearch(false)
    setSOPSearchQuery('')
  }

  const btnStyle = (active?: boolean): React.CSSProperties => ({
    width: 28,
    height: 28,
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    background: active ? 'color-mix(in srgb, var(--color-accent) 15%, transparent)' : 'transparent',
    color: active ? 'var(--color-accent)' : 'var(--color-text-dim)',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: active ? 700 : 400,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  })

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 2,
        padding: '4px 8px',
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-surface-hover)',
        position: 'relative',
      }}
    >
      <button
        type="button"
        style={btnStyle(editor.isActive('bold'))}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold"
      >
        B
      </button>
      <button
        type="button"
        style={{ ...btnStyle(editor.isActive('italic')), fontStyle: 'italic' }}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic"
      >
        I
      </button>
      <button
        type="button"
        style={{ ...btnStyle(editor.isActive('strike')), textDecoration: 'line-through' }}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="Strikethrough"
      >
        S
      </button>

      <Separator />

      <button
        type="button"
        style={btnStyle(editor.isActive('codeBlock'))}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        title={t.sop_insertCodeBlock}
      >
        {'</>'}
      </button>
      <button
        type="button"
        style={btnStyle()}
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        title={t.sop_insertTable}
      >
        ⊞
      </button>
      <button
        type="button"
        style={btnStyle(editor.isActive('link'))}
        onClick={insertLink}
        title={t.sop_insertLink}
      >
        🔗
      </button>

      <Separator />

      <button
        type="button"
        style={btnStyle(editor.isActive('bulletList'))}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Bullet List"
      >
        •
      </button>
      <button
        type="button"
        style={btnStyle(editor.isActive('orderedList'))}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Ordered List"
      >
        1.
      </button>

      <Separator />

      <button
        type="button"
        style={btnStyle()}
        onClick={() => editor.chain().focus().insertContent({
          type: 'callout',
          attrs: { variant: 'info' },
          content: [{ type: 'paragraph' }],
        }).run()}
        title={t.sop_insertCalloutInfo}
      >
        💡
      </button>
      <button
        type="button"
        style={btnStyle()}
        onClick={() => editor.chain().focus().insertContent({
          type: 'callout',
          attrs: { variant: 'warning' },
          content: [{ type: 'paragraph' }],
        }).run()}
        title={t.sop_insertCalloutWarning}
      >
        ⚠️
      </button>

      <Separator />

      {/* SOP Link button */}
      <div ref={searchRef} style={{ position: 'relative' }}>
        <button
          type="button"
          style={btnStyle()}
          onClick={() => setShowSOPSearch((v) => !v)}
          title={t.sop_linkSOP}
        >
          📋
        </button>

        {showSOPSearch && (
          <div
            style={{
              position: 'absolute',
              top: 32,
              left: 0,
              width: 240,
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
              zIndex: 100,
              padding: 4,
            }}
          >
            <input
              autoFocus
              value={sopSearchQuery}
              onChange={(e) => setSOPSearchQuery(e.target.value)}
              placeholder={t.sop_linkSOP_search}
              style={{
                width: '100%',
                height: 28,
                fontSize: 12,
                padding: '0 8px',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-bg)',
                color: 'var(--color-text)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ maxHeight: 160, overflowY: 'auto', marginTop: 4 }}>
              {filteredSOPs.length === 0 ? (
                <div style={{ padding: '8px', fontSize: 12, color: 'var(--color-text-dim)', textAlign: 'center' }}>
                  —
                </div>
              ) : (
                filteredSOPs.map((sop) => (
                  <button
                    key={sop.id}
                    type="button"
                    onClick={() => insertSOPLink(sop)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '4px 8px',
                      fontSize: 12,
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--color-text)',
                      cursor: 'pointer',
                      borderRadius: 'var(--radius-sm)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-hover)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                  >
                    📋 {sop.title}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Separator() {
  return (
    <div
      style={{
        width: 1,
        height: 20,
        background: 'var(--color-border)',
        margin: '4px 2px',
        alignSelf: 'center',
      }}
    />
  )
}

// ── Callout CSS ──────────────────────────────────────────────

const calloutCSS = `
div[data-callout] {
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  margin: 4px 0;
  font-size: 13px;
}
div[data-callout][data-variant="info"] {
  background: color-mix(in srgb, var(--color-accent) 8%, transparent);
  border-left: 3px solid var(--color-accent);
}
div[data-callout][data-variant="warning"] {
  background: color-mix(in srgb, var(--color-warning) 8%, transparent);
  border-left: 3px solid var(--color-warning);
}
.sop-rich-editor-content .tiptap {
  outline: none;
}
.sop-rich-editor-content .tiptap p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: var(--color-text-dim);
  opacity: 0.5;
  pointer-events: none;
  height: 0;
}
.sop-rich-editor-content .tiptap table {
  border-collapse: collapse;
  width: 100%;
  margin: 8px 0;
}
.sop-rich-editor-content .tiptap th,
.sop-rich-editor-content .tiptap td {
  border: 1px solid var(--color-border);
  padding: 4px 8px;
  font-size: 13px;
}
.sop-rich-editor-content .tiptap th {
  background: var(--color-surface-hover);
  font-weight: 600;
}
.sop-rich-editor-content .tiptap pre {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
  font-size: 12px;
  overflow-x: auto;
}
.sop-rich-editor-content .tiptap a {
  color: var(--color-accent);
  text-decoration: underline;
}
`
