import { useMemo } from 'react'
import type { SOP, SOPStep } from '@/types/sop'
import type { JSONContent } from '@tiptap/react'
import { useSOPStore } from '@/stores/sopStore'
import { useT } from '@/i18n'
import { renderContentHTML, preprocessContent } from './SOPRichEditor'
import { getSOPStepPrefix } from '@/utils/sop'

interface Props {
  sop: SOP
  executionMode: boolean
  checkedIds: Set<string>
  onToggle: (stepId: string) => void
}

export function SOPStepListView({ sop, executionMode, checkedIds, onToggle }: Props) {
  const steps = [...sop.steps].sort((a, b) => a.sortOrder - b.sortOrder)

  if (sop.displayStyle === 'timeline') {
    return (
      <TimelineLayout
        steps={steps}
        executionMode={executionMode}
        checkedIds={checkedIds}
        onToggle={onToggle}
      />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {steps.map((step, index) => (
        <StepRow
          key={step.id}
          step={step}
          index={index}
          displayStyle={sop.displayStyle}
          executionMode={executionMode}
          checkedIds={checkedIds}
          onToggle={onToggle}
          depth={0}
        />
      ))}
    </div>
  )
}

function StepRow({
  step,
  index,
  displayStyle,
  executionMode,
  checkedIds,
  onToggle,
  depth,
  parentIndex,
}: {
  step: SOPStep
  index: number
  displayStyle: SOP['displayStyle']
  executionMode: boolean
  checkedIds: Set<string>
  onToggle: (stepId: string) => void
  depth: number
  parentIndex?: string
}) {
  const checked = executionMode && checkedIds.has(step.id)
  const childSteps = [...step.childSteps].sort((a, b) => a.sortOrder - b.sortOrder)
  const prefix = getSOPStepPrefix(displayStyle, index, parentIndex)

  return (
    <div style={{ marginLeft: depth * 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {executionMode && (
          <input
            type="checkbox"
            checked={checked}
            onChange={() => onToggle(step.id)}
            style={{ marginTop: 3, cursor: 'pointer', flexShrink: 0, accentColor: 'var(--color-success)' }}
          />
        )}
        <span
          style={{
            fontSize: 14,
            fontWeight: depth === 0 ? 500 : 400,
            color: checked ? 'var(--color-text-dim)' : 'var(--color-text)',
            textDecoration: checked ? 'line-through' : 'none',
            lineHeight: '22px',
          }}
        >
          {prefix && (
            <span style={{ color: 'var(--color-accent)', fontWeight: 600, marginRight: 6 }}>
              {prefix}
            </span>
          )}
          {step.title}
        </span>
      </div>

      <StepContentView content={step.content} indentLeft={executionMode ? 38 : 24} />

      {childSteps.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {childSteps.map((child, ci) => (
            <StepRow
              key={child.id}
              step={child}
              index={ci}
              displayStyle={displayStyle}
              executionMode={executionMode}
              checkedIds={checkedIds}
              onToggle={onToggle}
              depth={depth + 1}
              parentIndex={prefix || String(index + 1)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Shared rich content viewer
function StepContentView({ content, indentLeft }: { content: JSONContent | null; indentLeft: number }) {
  const t = useT()
  const sops = useSOPStore((s) => s.sops)
  const selectSOP = useSOPStore((s) => s.selectSOP)

  const html = useMemo(() => {
    if (!content) return ''
    const sopIds = new Set(sops.map((s) => s.id))
    const processed = preprocessContent(content, sopIds, t.sop_linkedDeleted)
    return renderContentHTML(processed)
  }, [content, sops, t.sop_linkedDeleted])

  if (!html) return null

  function handleClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement
    const link = target.closest('[data-sop-link]')
    if (link) {
      const sopId = link.getAttribute('data-sopid')
      if (sopId) {
        selectSOP(sopId)
      }
    }
  }

  return (
    <div
      style={{ marginTop: 4, marginLeft: indentLeft, fontSize: 13 }}
      className="sop-content-view"
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

// Timeline layout
function TimelineLayout({
  steps,
  executionMode,
  checkedIds,
  onToggle,
}: {
  steps: SOPStep[]
  executionMode: boolean
  checkedIds: Set<string>
  onToggle: (stepId: string) => void
}) {
  return (
    <div style={{ position: 'relative', paddingLeft: executionMode ? 52 : 32 }}>
      <div
        style={{
          position: 'absolute',
          left: executionMode ? 32 : 12,
          top: 6,
          bottom: 6,
          width: 2,
          background: 'var(--color-border)',
        }}
      />

      {steps.map((step, index) => {
        const checked = executionMode && checkedIds.has(step.id)
        const childSteps = [...step.childSteps].sort((a, b) => a.sortOrder - b.sortOrder)

        return (
          <div key={step.id} style={{ position: 'relative', display: 'flex', gap: 16, marginBottom: 24 }}>
            <div
              style={{
                position: 'absolute',
                left: -22,
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: checked ? 'var(--color-text-dim)' : 'var(--color-accent)',
                border: '2px solid var(--color-bg)',
                marginTop: 4,
                flexShrink: 0,
              }}
            />

            {executionMode && (
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(step.id)}
                style={{
                  position: 'absolute',
                  left: -48,
                  top: 2,
                  cursor: 'pointer',
                  accentColor: 'var(--color-success)',
                }}
              />
            )}

            <div
              style={{
                width: 48,
                flexShrink: 0,
                fontSize: 13,
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                color: checked ? 'var(--color-text-dim)' : 'var(--color-accent)',
                lineHeight: '20px',
              }}
            >
              {step.time ?? `${index + 1}.`}
            </div>

            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 14,
                  color: checked ? 'var(--color-text-dim)' : 'var(--color-text)',
                  textDecoration: checked ? 'line-through' : 'none',
                  lineHeight: '20px',
                }}
              >
                {step.title}
              </div>

              <StepContentView content={step.content} indentLeft={0} />

              {childSteps.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {childSteps.map((child, ci) => (
                    <div key={child.id}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        {executionMode && (
                          <input
                            type="checkbox"
                            checked={checkedIds.has(child.id)}
                            onChange={() => onToggle(child.id)}
                            style={{ marginTop: 2, cursor: 'pointer', accentColor: 'var(--color-success)' }}
                          />
                        )}
                        <span
                          style={{
                            fontSize: 13,
                            color: checkedIds.has(child.id) ? 'var(--color-text-dim)' : 'var(--color-text)',
                            textDecoration: checkedIds.has(child.id) ? 'line-through' : 'none',
                          }}
                        >
                          {child.title}
                        </span>
                      </div>
                      <StepContentView content={child.content} indentLeft={executionMode ? 24 : 8} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}

      <style>{`
        .sop-content-view div[data-callout] {
          padding: 8px 12px;
          border-radius: var(--radius-sm);
          margin: 4px 0;
          font-size: 13px;
        }
        .sop-content-view div[data-callout][data-variant="info"] {
          background: color-mix(in srgb, var(--color-accent) 8%, transparent);
          border-left: 3px solid var(--color-accent);
        }
        .sop-content-view div[data-callout][data-variant="warning"] {
          background: color-mix(in srgb, var(--color-warning) 8%, transparent);
          border-left: 3px solid var(--color-warning);
        }
        .sop-content-view table {
          border-collapse: collapse;
          width: 100%;
          margin: 4px 0;
        }
        .sop-content-view th,
        .sop-content-view td {
          border: 1px solid var(--color-border);
          padding: 4px 8px;
          font-size: 13px;
        }
        .sop-content-view th {
          background: var(--color-surface-hover);
          font-weight: 600;
        }
        .sop-content-view pre {
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          padding: 8px 12px;
          font-size: 12px;
          overflow-x: auto;
        }
        .sop-content-view a {
          color: var(--color-accent);
          text-decoration: underline;
        }
        .sop-content-view span[data-sop-link] {
          color: var(--color-accent);
          cursor: pointer;
          text-decoration: underline;
        }
      `}</style>
    </div>
  )
}
