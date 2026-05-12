import React, { useEffect, useRef, useState, lazy, Suspense } from 'react'
import type { SOP, SOPStep } from '@/types/sop'
import type { JSONContent } from '@tiptap/react'
import { useSOPStore } from '@/stores/sopStore'
import { useT } from '@/i18n'
import { generateId } from '@/utils/id'
import { extractSOPPlainText } from '@/utils/sop'

const SOPRichEditor = lazy(() =>
  import('./SOPRichEditor').then((m) => ({ default: m.SOPRichEditor }))
)

interface Props {
  sopId: string | null
  defaultFolderId?: string
  onSave: () => void
  onCancel: () => void
}

function makeStep(sortOrder: number): SOPStep {
  return {
    id: generateId(),
    title: '',
    content: null,
    time: null,
    sortOrder,
    childSteps: [],
  }
}

export function SOPEditor({ sopId, defaultFolderId = '', onSave, onCancel }: Props) {
  const t = useT()
  const { folders, sops, addSOP, updateSOP, addFolder, getFolderDepth } = useSOPStore()
  const existingSOP = sopId ? sops.find((s) => s.id === sopId) : null

  const [title, setTitle] = useState(existingSOP?.title ?? '')
  const [displayStyle, setDisplayStyle] = useState<SOP['displayStyle']>(existingSOP?.displayStyle ?? 'numbered')
  const [folderId, setFolderId] = useState(existingSOP?.folderId ?? defaultFolderId)
  const [steps, setSteps] = useState<SOPStep[]>(
    existingSOP?.steps ? [...existingSOP.steps].sort((a, b) => a.sortOrder - b.sortOrder) : []
  )

  const [creatingFolder, setCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [openContentIds, setOpenContentIds] = useState<Set<string>>(() => new Set())
  const [focusStepId, setFocusStepId] = useState<string | null>(null)
  const stepInputRefs = useRef(new Map<string, HTMLInputElement>())

  const userFolders = folders.filter((f) => !f.isSystem)

  useEffect(() => {
    if (!focusStepId) return
    const input = stepInputRefs.current.get(focusStepId)
    if (!input) return
    input.focus()
    input.select()
    setFocusStepId(null)
  }, [focusStepId, steps])

  // ── Step operations ──────────────────────────────────────
  function handleAddStep() {
    const step = makeStep(steps.length)
    setSteps((prev) => [...prev, step])
    setFocusStepId(step.id)
  }

  function handleInsertStepAfter(idx: number) {
    const step = makeStep(idx + 1)
    setSteps((prev) => {
      const next = [...prev]
      next.splice(idx + 1, 0, step)
      return next.map((s, i) => ({ ...s, sortOrder: i }))
    })
    setFocusStepId(step.id)
  }

  function handleRemoveStep(idx: number) {
    setSteps((prev) => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, sortOrder: i })))
  }

  function handleUpdateStep(idx: number, patch: Partial<SOPStep>) {
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
  }

  function handleMoveStep(idx: number, direction: 'up' | 'down') {
    setSteps((prev) => {
      const arr = [...prev]
      const target = direction === 'up' ? idx - 1 : idx + 1
      if (target < 0 || target >= arr.length) return prev
      ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
      return arr.map((s, i) => ({ ...s, sortOrder: i }))
    })
  }

  // ── Child step operations ────────────────────────────────
  function addChildStep(parentIndex: number) {
    const step = makeStep(steps[parentIndex]?.childSteps.length ?? 0)
    setSteps((prev) =>
      prev.map((s, i) =>
        i === parentIndex
          ? { ...s, childSteps: [...s.childSteps, step] }
          : s
      )
    )
    setFocusStepId(step.id)
  }

  function insertChildStepAfter(parentIndex: number, childIndex: number) {
    const step = makeStep(childIndex + 1)
    setSteps((prev) =>
      prev.map((s, i) => {
        if (i !== parentIndex) return s
        const next = [...s.childSteps]
        next.splice(childIndex + 1, 0, step)
        return { ...s, childSteps: next.map((c, ci) => ({ ...c, sortOrder: ci })) }
      })
    )
    setFocusStepId(step.id)
  }

  function updateChildStep(parentIndex: number, childIndex: number, patch: Partial<SOPStep>) {
    setSteps((prev) =>
      prev.map((s, i) =>
        i === parentIndex
          ? {
              ...s,
              childSteps: s.childSteps.map((c, ci) =>
                ci === childIndex ? { ...c, ...patch } : c
              ),
            }
          : s
      )
    )
  }

  function removeChildStep(parentIndex: number, childIndex: number) {
    setSteps((prev) =>
      prev.map((s, i) =>
        i === parentIndex
          ? {
              ...s,
              childSteps: s.childSteps
                .filter((_, ci) => ci !== childIndex)
                .map((c, ci) => ({ ...c, sortOrder: ci })),
            }
          : s
      )
    )
  }

  function moveChildStep(parentIndex: number, childIndex: number, direction: 'up' | 'down') {
    setSteps((prev) =>
      prev.map((s, i) => {
        if (i !== parentIndex) return s
        const arr = [...s.childSteps]
        const target = direction === 'up' ? childIndex - 1 : childIndex + 1
        if (target < 0 || target >= arr.length) return s
        ;[arr[childIndex], arr[target]] = [arr[target], arr[childIndex]]
        return { ...s, childSteps: arr.map((c, ci) => ({ ...c, sortOrder: ci })) }
      })
    )
  }

  // ── Grandchild step operations ───────────────────────────
  function addGrandChildStep(parentIndex: number, childIndex: number) {
    const step = makeStep(steps[parentIndex]?.childSteps[childIndex]?.childSteps.length ?? 0)
    setSteps((prev) =>
      prev.map((s, i) =>
        i === parentIndex
          ? {
              ...s,
              childSteps: s.childSteps.map((c, ci) =>
                ci === childIndex
                  ? { ...c, childSteps: [...c.childSteps, step] }
                  : c
              ),
            }
          : s
      )
    )
    setFocusStepId(step.id)
  }

  function insertGrandChildStepAfter(parentIndex: number, childIndex: number, grandChildIndex: number) {
    const step = makeStep(grandChildIndex + 1)
    setSteps((prev) =>
      prev.map((s, i) =>
        i === parentIndex
          ? {
              ...s,
              childSteps: s.childSteps.map((c, ci) => {
                if (ci !== childIndex) return c
                const next = [...c.childSteps]
                next.splice(grandChildIndex + 1, 0, step)
                return { ...c, childSteps: next.map((gc, gci) => ({ ...gc, sortOrder: gci })) }
              }),
            }
          : s
      )
    )
    setFocusStepId(step.id)
  }

  function updateGrandChildStep(
    parentIndex: number,
    childIndex: number,
    grandChildIndex: number,
    patch: Partial<SOPStep>
  ) {
    setSteps((prev) =>
      prev.map((s, i) =>
        i === parentIndex
          ? {
              ...s,
              childSteps: s.childSteps.map((c, ci) =>
                ci === childIndex
                  ? {
                      ...c,
                      childSteps: c.childSteps.map((gc, gci) =>
                        gci === grandChildIndex ? { ...gc, ...patch } : gc
                      ),
                    }
                  : c
              ),
            }
          : s
      )
    )
  }

  function removeGrandChildStep(parentIndex: number, childIndex: number, grandChildIndex: number) {
    setSteps((prev) =>
      prev.map((s, i) =>
        i === parentIndex
          ? {
              ...s,
              childSteps: s.childSteps.map((c, ci) =>
                ci === childIndex
                  ? {
                      ...c,
                      childSteps: c.childSteps
                        .filter((_, gci) => gci !== grandChildIndex)
                        .map((gc, gci) => ({ ...gc, sortOrder: gci })),
                    }
                  : c
              ),
            }
          : s
      )
    )
  }

  function moveGrandChildStep(
    parentIndex: number,
    childIndex: number,
    grandChildIndex: number,
    direction: 'up' | 'down'
  ) {
    setSteps((prev) =>
      prev.map((s, i) =>
        i === parentIndex
          ? {
              ...s,
              childSteps: s.childSteps.map((c, ci) => {
                if (ci !== childIndex) return c
                const arr = [...c.childSteps]
                const target = direction === 'up' ? grandChildIndex - 1 : grandChildIndex + 1
                if (target < 0 || target >= arr.length) return c
                ;[arr[grandChildIndex], arr[target]] = [arr[target], arr[grandChildIndex]]
                return { ...c, childSteps: arr.map((gc, gci) => ({ ...gc, sortOrder: gci })) }
              }),
            }
          : s
      )
    )
  }

  // ── Save ─────────────────────────────────────────────────
  function handleSave() {
    if (!title.trim()) return
    const resolvedFolderId = folderId || (userFolders[0]?.id ?? '')
    if (!resolvedFolderId) return

    const finalSteps = steps.map((s, i) => ({
      ...s,
      sortOrder: i,
      childSteps: s.childSteps.map((c, ci) => ({
        ...c,
        sortOrder: ci,
        childSteps: c.childSteps.map((cc, cci) => ({ ...cc, sortOrder: cci })),
      })),
    }))

    if (sopId) {
      updateSOP(sopId, {
        title: title.trim(),
        displayStyle,
        folderId: resolvedFolderId,
        steps: finalSteps,
      })
    } else {
      addSOP({
        title: title.trim(),
        displayStyle,
        folderId: resolvedFolderId,
        steps: finalSteps,
        isSystem: false,
      })
    }
    onSave()
  }

  function handleCreateFolder() {
    if (!newFolderName.trim()) return
    const id = addFolder(newFolderName.trim())
    setFolderId(id)
    setCreatingFolder(false)
    setNewFolderName('')
  }

  // ── Styles ───────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 36,
    padding: '0 12px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    color: 'var(--color-text-dim)',
    marginBottom: 6,
    display: 'block',
  }

  const smallBtnStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: 'var(--color-text-dim)',
    cursor: 'pointer',
    fontSize: 14,
    padding: '2px 4px',
    borderRadius: 'var(--radius-sm)',
    lineHeight: 1,
  }

  const stepTitleInputStyle: React.CSSProperties = {
    ...inputStyle,
    height: 32,
    padding: '0 10px',
  }

  function openContentEditor(stepId: string) {
    setOpenContentIds((prev) => {
      const next = new Set(prev)
      next.add(stepId)
      return next
    })
  }

  function closeContentEditor(stepId: string) {
    setOpenContentIds((prev) => {
      const next = new Set(prev)
      next.delete(stepId)
      return next
    })
  }

  function bindStepInput(stepId: string) {
    return (node: HTMLInputElement | null) => {
      if (node) stepInputRefs.current.set(stepId, node)
      else stepInputRefs.current.delete(stepId)
    }
  }

  function handleStepInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>, insertAfter: () => void) {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
    e.preventDefault()
    insertAfter()
  }

  function renderContentEditor(
    step: SOPStep,
    onChange: (content: JSONContent | null) => void,
    fallbackHeight: number,
  ) {
    const isOpen = openContentIds.has(step.id)
    const summary = extractSOPPlainText(step.content, 120)

    if (!isOpen) {
      return (
        <button
          type="button"
          onClick={() => openContentEditor(step.id)}
          style={{
            alignSelf: summary ? 'stretch' : 'flex-start',
            fontSize: 12,
            color: 'var(--color-text-dim)',
            background: 'none',
            border: '1px dashed var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '3px 6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 6,
            textAlign: 'left',
          }}
        >
          {summary ? (
            <>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {summary}
              </span>
              <span style={{ flexShrink: 0, color: 'var(--color-accent)' }}>
                {t.sop_editDetails}
              </span>
            </>
          ) : (
            <span>+ {t.sop_content_placeholder}</span>
          )}
        </button>
      )
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => closeContentEditor(step.id)}
            style={{
              border: 'none',
              background: 'none',
              color: 'var(--color-text-dim)',
              cursor: 'pointer',
              fontSize: 11,
              padding: '0 2px',
            }}
          >
            {t.sop_hideDetails}
          </button>
        </div>
        <Suspense fallback={<div style={{ height: fallbackHeight, background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)' }} />}>
          <SOPRichEditor
            compact
            content={step.content}
            onChange={onChange}
            placeholder={t.sop_content_placeholder}
          />
        </Suspense>
      </div>
    )
  }

  // ── Render step card ─────────────────────────────────────
  function renderStepCard(step: SOPStep, idx: number) {
    return (
      <div
        key={step.id}
        style={{
          padding: '8px 10px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          background: 'var(--color-bg)',
        }}
      >
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--color-accent)',
              minWidth: 20,
              paddingTop: 7,
            }}
          >
            {idx + 1}.
          </span>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {displayStyle === 'timeline' && (
                <input
                  type="time"
                  value={step.time ?? ''}
                  onChange={(e) => handleUpdateStep(idx, { time: e.target.value || null })}
                  style={{ ...stepTitleInputStyle, width: 104, flexShrink: 0 }}
                />
              )}
              <input
                ref={bindStepInput(step.id)}
                value={step.title}
                onChange={(e) => handleUpdateStep(idx, { title: e.target.value })}
                onKeyDown={(e) => handleStepInputKeyDown(e, () => handleInsertStepAfter(idx))}
                placeholder={t.sop_stepPlaceholder}
                style={stepTitleInputStyle}
              />
            </div>

            {renderContentEditor(step, (content) => handleUpdateStep(idx, { content }), 52)}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => handleMoveStep(idx, 'up')}
              disabled={idx === 0}
              style={{ ...smallBtnStyle, opacity: idx === 0 ? 0.3 : 1 }}
              title={t.sop_moveUp}
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => handleMoveStep(idx, 'down')}
              disabled={idx === steps.length - 1}
              style={{ ...smallBtnStyle, opacity: idx === steps.length - 1 ? 0.3 : 1 }}
              title={t.sop_moveDown}
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => handleInsertStepAfter(idx)}
              style={{ ...smallBtnStyle, color: 'var(--color-accent)' }}
              title={t.sop_insertStepAfter}
            >
              +
            </button>
            <button
              type="button"
              onClick={() => handleRemoveStep(idx)}
              style={{ ...smallBtnStyle, color: 'var(--color-danger)' }}
              title={t.common_delete}
            >
              ×
            </button>
          </div>
        </div>

        {step.childSteps.length > 0 && (
          <div style={{ marginLeft: 26, marginTop: 5, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {step.childSteps.map((child, ci) => renderChildStepCard(child, idx, ci))}
          </div>
        )}

        <div style={{ marginLeft: 26, marginTop: step.childSteps.length > 0 ? 3 : 4 }}>
          <button
            type="button"
            onClick={() => addChildStep(idx)}
            style={{
              fontSize: 12,
              color: 'var(--color-accent)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '1px 0',
            }}
          >
            + {t.sop_addChildStep}
          </button>
        </div>
      </div>
    )
  }

  function renderChildStepCard(child: SOPStep, parentIdx: number, childIdx: number) {
    return (
      <div
        key={child.id}
        style={{
          padding: '6px 7px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
        }}
      >
        <div style={{ display: 'flex', gap: 5, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 12, color: 'var(--color-text-dim)', minWidth: 26, paddingTop: 5 }}>
            {parentIdx + 1}.{childIdx + 1}
          </span>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <input
              ref={bindStepInput(child.id)}
              value={child.title}
              onChange={(e) => updateChildStep(parentIdx, childIdx, { title: e.target.value })}
              onKeyDown={(e) => handleStepInputKeyDown(e, () => insertChildStepAfter(parentIdx, childIdx))}
              placeholder={t.sop_stepPlaceholder}
              style={{ ...inputStyle, height: 28, padding: '0 9px', fontSize: 13 }}
            />
            {renderContentEditor(child, (content) => updateChildStep(parentIdx, childIdx, { content }), 44)}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => moveChildStep(parentIdx, childIdx, 'up')}
              disabled={childIdx === 0}
              style={{ ...smallBtnStyle, fontSize: 12, opacity: childIdx === 0 ? 0.3 : 1 }}
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => moveChildStep(parentIdx, childIdx, 'down')}
              disabled={childIdx === steps[parentIdx].childSteps.length - 1}
              style={{ ...smallBtnStyle, fontSize: 12, opacity: childIdx === steps[parentIdx].childSteps.length - 1 ? 0.3 : 1 }}
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => insertChildStepAfter(parentIdx, childIdx)}
              style={{ ...smallBtnStyle, fontSize: 12, color: 'var(--color-accent)' }}
              title={t.sop_insertStepAfter}
            >
              +
            </button>
            <button
              type="button"
              onClick={() => removeChildStep(parentIdx, childIdx)}
              style={{ ...smallBtnStyle, fontSize: 12, color: 'var(--color-danger)' }}
            >
              ×
            </button>
          </div>
        </div>

        {child.childSteps.length > 0 && (
          <div style={{ marginLeft: 31, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {child.childSteps.map((gc, gci) => renderGrandChildStepCard(gc, parentIdx, childIdx, gci))}
          </div>
        )}

        <div style={{ marginLeft: 31, marginTop: child.childSteps.length > 0 ? 2 : 3 }}>
          <button
            type="button"
            onClick={() => addGrandChildStep(parentIdx, childIdx)}
            style={{
              fontSize: 11,
              color: 'var(--color-text-dim)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '1px 0',
            }}
          >
            + {t.sop_addChildStep}
          </button>
        </div>
      </div>
    )
  }

  function renderGrandChildStepCard(
    gc: SOPStep,
    parentIdx: number,
    childIdx: number,
    gcIdx: number
  ) {
    const parentChild = steps[parentIdx]?.childSteps[childIdx]
    return (
      <div
        key={gc.id}
        style={{
          padding: '3px 5px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--color-border)',
          background: 'var(--color-bg)',
        }}
      >
        <div style={{ display: 'flex', gap: 5, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 11, color: 'var(--color-text-dim)', minWidth: 34, paddingTop: 5 }}>
            {parentIdx + 1}.{childIdx + 1}.{gcIdx + 1}
          </span>
          <input
            ref={bindStepInput(gc.id)}
            value={gc.title}
            onChange={(e) => updateGrandChildStep(parentIdx, childIdx, gcIdx, { title: e.target.value })}
            onKeyDown={(e) => handleStepInputKeyDown(e, () => insertGrandChildStepAfter(parentIdx, childIdx, gcIdx))}
            placeholder={t.sop_stepPlaceholder}
            style={{ ...inputStyle, height: 26, padding: '0 8px', fontSize: 12, flex: 1 }}
          />
          <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => moveGrandChildStep(parentIdx, childIdx, gcIdx, 'up')}
              disabled={gcIdx === 0}
              style={{ ...smallBtnStyle, fontSize: 11, opacity: gcIdx === 0 ? 0.3 : 1 }}
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => moveGrandChildStep(parentIdx, childIdx, gcIdx, 'down')}
              disabled={!parentChild || gcIdx === parentChild.childSteps.length - 1}
              style={{ ...smallBtnStyle, fontSize: 11, opacity: !parentChild || gcIdx === parentChild.childSteps.length - 1 ? 0.3 : 1 }}
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => insertGrandChildStepAfter(parentIdx, childIdx, gcIdx)}
              style={{ ...smallBtnStyle, fontSize: 11, color: 'var(--color-accent)' }}
              title={t.sop_insertStepAfter}
            >
              +
            </button>
            <button
              type="button"
              onClick={() => removeGrandChildStep(parentIdx, childIdx, gcIdx)}
              style={{ ...smallBtnStyle, fontSize: 11, color: 'var(--color-danger)' }}
            >
              ×
            </button>
          </div>
        </div>
        <div style={{ marginLeft: 39, marginTop: 3 }}>
          {renderContentEditor(gc, (content) => updateGrandChildStep(parentIdx, childIdx, gcIdx, { content }), 40)}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: 'var(--color-text)' }}>
        {sopId ? t.sop_edit : t.sop_create}
      </h2>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>{t.sop_titlePlaceholder}</label>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t.sop_titlePlaceholder}
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>{t.sop_displayStyle}</label>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['numbered', 'bullet', 'timeline'] as const).map((style) => {
            const isActive = displayStyle === style
            const labels: Record<typeof style, string> = {
              numbered: t.sop_style_numbered,
              bullet: t.sop_style_bullet,
              timeline: t.sop_style_timeline,
            }
            return (
              <button
                key={style}
                type="button"
                onClick={() => setDisplayStyle(style)}
                style={{
                  padding: '4px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${isActive ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  background: isActive
                    ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)'
                    : 'transparent',
                  color: isActive ? 'var(--color-accent)' : 'var(--color-text-dim)',
                  fontSize: 12,
                  cursor: 'pointer',
                  fontWeight: isActive ? 500 : 400,
                }}
              >
                {style === 'numbered' ? '≡' : style === 'bullet' ? '•' : '⏰'} {labels[style]}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>{t.sop_folderLabel}</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {userFolders.length > 0 && (
            <select
              value={folderId || userFolders[0]?.id}
              onChange={(e) => setFolderId(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            >
              {userFolders.map((f) => (
                <option key={f.id} value={f.id}>
                  {'  '.repeat(getFolderDepth(f.id))}📁 {f.name}
                </option>
              ))}
            </select>
          )}
        </div>
        {!creatingFolder ? (
          <button
            type="button"
            onClick={() => setCreatingFolder(true)}
            style={{
              marginTop: 4,
              fontSize: 12,
              color: 'var(--color-accent)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            + {t.sop_newFolderInline}
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            <input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newFolderName.trim()) handleCreateFolder()
                if (e.key === 'Escape') {
                  setCreatingFolder(false)
                  setNewFolderName('')
                }
              }}
              placeholder={t.sop_newFolderInline}
              style={{ ...inputStyle, height: 28, fontSize: 12, flex: 1 }}
            />
            <button
              type="button"
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim()}
              style={{
                height: 28,
                padding: '0 10px',
                fontSize: 12,
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: newFolderName.trim() ? 'var(--color-accent)' : 'var(--color-border)',
                color: 'white',
                cursor: newFolderName.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              {t.common_save}
            </button>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>{t.sop_stepsLabel}</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {steps.map((step, idx) => renderStepCard(step, idx))}
        </div>

        <button
          type="button"
          onClick={handleAddStep}
          style={{
            marginTop: 6,
            fontSize: 13,
            color: 'var(--color-accent)',
            background: 'none',
            border: '1px dashed var(--color-accent)',
            borderRadius: 'var(--radius-md)',
            padding: '5px 12px',
            cursor: 'pointer',
            width: '100%',
          }}
        >
          + {t.sop_addStep}
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            height: 36,
            padding: '0 16px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            background: 'transparent',
            color: 'var(--color-text-dim)',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          {t.common_cancel}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!title.trim() || (!folderId && userFolders.length === 0)}
          style={{
            height: 36,
            padding: '0 20px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: title.trim() ? 'var(--color-accent)' : 'var(--color-border)',
            color: title.trim() ? 'white' : 'var(--color-text-dim)',
            fontSize: 14,
            fontWeight: 600,
            cursor: title.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          {t.common_save}
        </button>
      </div>
    </div>
  )
}
