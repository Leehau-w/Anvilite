import React from 'react'

interface CheckboxProps {
  checked: boolean
  onChange: () => void
  size?: number
  disabled?: boolean
}

export function Checkbox({ checked, onChange, size = 13, disabled }: CheckboxProps) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onChange() }}
      disabled={disabled}
      style={{
        width: size,
        height: size,
        borderRadius: 'var(--radius-sm)',
        border: checked ? 'none' : '1.5px solid var(--color-border)',
        background: checked ? 'var(--color-success)' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'default' : 'pointer',
        padding: 0,
        flexShrink: 0,
        transition: 'all 0.15s ease',
      }}
    >
      {checked && (
        <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 5 L4.5 7.5 L8 3" />
        </svg>
      )}
    </button>
  )
}
