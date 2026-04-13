import React, { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Drawer } from '@/components/ui/Drawer'
import { StarRating } from '@/components/ui/StarRating'
import { CategorySelect } from '@/components/ui/CategorySelect'
import type { Habit } from '@/types/habit'
import { useHabitStore } from '@/stores/habitStore'
import { useAreaStore } from '@/stores/areaStore'
import { useGrowthEventStore } from '@/stores/growthEventStore'
import { useToast } from '@/components/feedback/Toast'
import { useT } from '@/i18n'

interface HabitDrawerProps {
  open: boolean
  onClose: () => void
  editHabit?: Habit | null
  defaultCategory?: string
}

// UI中的重复类型，monthly_fixed通过monthlyMode子选项区分
type UIRepeatType = 'daily' | 'weekdays' | 'weekly' | 'biweekly' | 'monthly' | 'custom'
// Alias for repeat label key lookup
type RepeatLabelKey = 'repeat_daily' | 'repeat_weekdays' | 'repeat_weekly' | 'repeat_biweekly' | 'repeat_monthly' | 'repeat_custom'

type FormData = {
  title: string
  category: string
  difficulty: 1 | 2 | 3 | 4 | 5
  repeatType: UIRepeatType
  weeklyMode: 'strict' | 'flexible'
  weeklyDays: number[]
  weeklyFlexibleCount: number
  monthlyMode: 'flexible' | 'fixed'
  monthlyDays: number[]           // 1-31 + (-1 = 月末)
  targetCount: number             // 周期内目标次数（≥1）
  customIntervalDays: number
  startDate: string
  estimatedMinutes: string
  description: string
}

const TODAY = new Date().toISOString().split('T')[0]
const REPEAT_OPTIONS: UIRepeatType[] = ['daily', 'weekdays', 'weekly', 'biweekly', 'monthly', 'custom']

export function HabitDrawer({ open, onClose, editHabit, defaultCategory }: HabitDrawerProps) {
  const { addHabit, updateHabit, addSubHabit, removeSubHabit } = useHabitStore()
  const currentHabit = useHabitStore((s) => editHabit ? s.habits.find((h) => h.id === editHabit.id) : null)
  const { addEvent } = useGrowthEventStore()
  const { showToast } = useToast()
  const getAreaCategories = useAreaStore((s) => s.getAreaCategories)
  const t = useT()
  const [subHabitInput, setSubHabitInput] = useState('')

  function makeDefault(): FormData {
    const cats = getAreaCategories()
    const isMonthlyFixed = editHabit?.repeatType === 'monthly_fixed'
    return {
      title: editHabit?.title ?? '',
      category: editHabit?.category ?? defaultCategory ?? (cats[0] ?? 'other'),
      difficulty: editHabit?.difficulty ?? 3,
      repeatType: isMonthlyFixed ? 'monthly' : (editHabit?.repeatType ?? 'daily') as UIRepeatType,
      weeklyMode: editHabit?.weeklyMode ?? 'strict',
      weeklyDays: editHabit?.weeklyDays ?? [1, 3, 5],
      weeklyFlexibleCount: editHabit?.weeklyFlexibleCount ?? 3,
      monthlyMode: isMonthlyFixed ? 'fixed' : 'flexible',
      monthlyDays: editHabit?.monthlyDays ?? [],
      targetCount: editHabit?.targetCount ?? 1,
      customIntervalDays: editHabit?.customIntervalDays ?? 2,
      startDate: editHabit?.startDate ?? TODAY,
      estimatedMinutes: editHabit?.estimatedMinutes ? String(editHabit.estimatedMinutes) : '',
      description: editHabit?.description ?? '',
    }
  }

  const [form, setForm] = useState<FormData>(makeDefault)

  useEffect(() => {
    if (open) setForm(makeDefault())
  }, [open, editHabit])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return

    const isWeekly = form.repeatType === 'weekly'
    const isMonthly = form.repeatType === 'monthly'
    const isMonthlyFixed = isMonthly && form.monthlyMode === 'fixed'
    // targetCount适用的类型
    const usesTargetCount = form.repeatType === 'daily' || form.repeatType === 'biweekly' || form.repeatType === 'custom'
      || (isMonthly && form.monthlyMode === 'flexible')
    const data = {
      title: form.title.trim(),
      category: form.category,
      difficulty: form.difficulty,
      repeatType: isMonthlyFixed ? ('monthly_fixed' as const) : form.repeatType,
      customIntervalDays: form.repeatType === 'custom' ? form.customIntervalDays : null,
      weeklyDays: isWeekly && form.weeklyMode === 'strict' ? form.weeklyDays : null,
      weeklyMode: isWeekly ? form.weeklyMode : null,
      weeklyFlexibleCount: isWeekly && form.weeklyMode === 'flexible' ? form.weeklyFlexibleCount : null,
      monthlyDays: isMonthlyFixed ? form.monthlyDays : null,
      targetCount: usesTargetCount ? Math.max(1, form.targetCount) : 1,
      startDate: form.startDate,
      endDate: null as string | null,
      reminderTime: null as string | null,
      estimatedMinutes: form.estimatedMinutes ? Number(form.estimatedMinutes) : 15,
      description: form.description,
    }

    if (editHabit) {
      updateHabit(editHabit.id, data)
    } else {
      addHabit(data)
    }
    onClose()
  }

  function toggleWeekday(day: number) {
    setForm((f) => ({
      ...f,
      weeklyDays: f.weeklyDays.includes(day)
        ? f.weeklyDays.filter((d) => d !== day)
        : [...f.weeklyDays, day].sort((a, b) => a - b),
    }))
  }

  const canSubmit = form.title.trim().length > 0

  return (
    <Drawer open={open} onClose={onClose} title={editHabit ? t.habitDrawer_editTitle : t.habitDrawer_createTitle}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: 16 }}>

        {/* 名称 */}
        <Field label={t.habitDrawer_nameLabel}>
          <input
            autoFocus
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder={t.habitDrawer_namePlaceholder}
            style={inputStyle}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--color-accent)'
              e.target.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--color-accent) 15%, transparent)'
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--color-border)'
              e.target.style.boxShadow = 'none'
            }}
          />
        </Field>

        {/* 分类 */}
        <Field label={t.habitDrawer_category}>
          <CategorySelect
            value={form.category}
            onChange={(v) => setForm((f) => ({ ...f, category: v }))}
            categories={getAreaCategories()}
          />
        </Field>

        {/* 难度 */}
        <Field label={t.habitDrawer_difficulty}>
          <StarRating
            value={form.difficulty}
            onChange={(v) => setForm((f) => ({ ...f, difficulty: v as 1 | 2 | 3 | 4 | 5 }))}
          />
        </Field>

        {/* 重复 */}
        <Field label={t.habitDrawer_repeat}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {REPEAT_OPTIONS.map((rt) => {
              const isActive = form.repeatType === rt
              const labelKey = `repeat_${rt}` as RepeatLabelKey
              return (
                <button
                  key={rt}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, repeatType: rt }))}
                  style={{
                    fontSize: 12,
                    padding: '5px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${isActive ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    background: isActive
                      ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)'
                      : 'transparent',
                    color: isActive ? 'var(--color-accent)' : 'var(--color-text-dim)',
                    cursor: 'pointer',
                    fontWeight: isActive ? 500 : 400,
                    transition: 'all 0.15s',
                  }}
                >
                  {t[labelKey]}
                </button>
              )
            })}
          </div>

          {/* 每周子选项 */}
          {form.repeatType === 'weekly' && (
            <div style={subPanelStyle}>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['strict', 'flexible'] as const).map((mode) => {
                  const isActive = form.weeklyMode === mode
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, weeklyMode: mode }))}
                      style={modeTabStyle(isActive)}
                    >
                      {mode === 'strict' ? t.habitDrawer_weeklyStrict : t.habitDrawer_weeklyFlexible}
                    </button>
                  )
                })}
              </div>

              {form.weeklyMode === 'strict' ? (
                <div style={{ display: 'flex', gap: 4 }}>
                  {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                    const isSelected = form.weeklyDays.includes(day)
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleWeekday(day)}
                        style={dayBtnStyle(isSelected)}
                      >
                        {(t[`weekday_${day}` as keyof typeof t] as string) ?? day}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <CounterRow
                  label={t.habitDrawer_targetCount(t.repeat_weekly)}
                  value={form.weeklyFlexibleCount}
                  min={1}
                  max={7}
                  onChange={(v) => setForm((f) => ({ ...f, weeklyFlexibleCount: v }))}
                />
              )}
            </div>
          )}

          {/* 每月子选项 */}
          {form.repeatType === 'monthly' && (
            <div style={subPanelStyle}>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['flexible', 'fixed'] as const).map((mode) => {
                  const isActive = form.monthlyMode === mode
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, monthlyMode: mode }))}
                      style={modeTabStyle(isActive)}
                    >
                      {mode === 'flexible' ? t.habitDrawer_monthlyFlexible : t.habitDrawer_monthlyFixed}
                    </button>
                  )
                })}
              </div>

              {form.monthlyMode === 'flexible' ? (
                <CounterRow
                  label={t.habitDrawer_targetCount(t.repeat_monthly)}
                  value={form.targetCount}
                  min={1}
                  max={31}
                  onChange={(v) => setForm((f) => ({ ...f, targetCount: v }))}
                />
              ) : (
                <MonthDayGrid
                  selected={form.monthlyDays}
                  onChange={(days) => setForm((f) => ({ ...f, monthlyDays: days }))}
                />
              )}
            </div>
          )}

          {/* 每天/每两周/自定义：目标次数步进器 */}
          {(form.repeatType === 'daily' || form.repeatType === 'biweekly' || form.repeatType === 'custom') && (
            <div style={subPanelStyle}>
              <CounterRow
                label={t.habitDrawer_targetCount(t[`repeat_${form.repeatType}` as RepeatLabelKey])}
                value={form.targetCount}
                min={1}
                max={99}
                onChange={(v) => setForm((f) => ({ ...f, targetCount: v }))}
              />
            </div>
          )}

          {/* 自定义间隔 */}
          {form.repeatType === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>{t.habitDrawer_customInterval}</span>
              <input
                type="number"
                min={1}
                value={form.customIntervalDays}
                onChange={(e) =>
                  setForm((f) => ({ ...f, customIntervalDays: Math.max(1, Number(e.target.value)) }))
                }
                style={{ ...inputStyle, width: 70, textAlign: 'center' }}
              />
              <span style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>{t.habitDrawer_customDays}</span>
            </div>
          )}
        </Field>

        {/* 开始日期 */}
        <Field label={t.habitDrawer_startDate}>
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
            style={inputStyle}
          />
        </Field>

        {/* 预估时长 */}
        <Field label={t.habitDrawer_duration}>
          <input
            type="number"
            min={1}
            value={form.estimatedMinutes}
            onChange={(e) => setForm((f) => ({ ...f, estimatedMinutes: e.target.value }))}
            placeholder={t.taskDrawer_optional}
            style={inputStyle}
          />
        </Field>

        {/* 备注 */}
        <Field label={t.habitDrawer_notes}>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder={`${t.taskDrawer_optional}...`}
            rows={2}
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg)',
              color: 'var(--color-text)',
              fontSize: 14,
              outline: 'none',
              resize: 'vertical',
              fontFamily: 'var(--font-zh)',
              width: '100%',
              boxSizing: 'border-box',
              transition: 'border-color 0.15s',
            }}
          />
        </Field>

        {/* 铭刻为里程碑（编辑现有习惯时显示） */}
        {editHabit && (
          <button
            type="button"
            onClick={() => {
              const days = Math.floor((Date.now() - new Date(editHabit.createdAt).getTime()) / 86400000)
              addEvent({
                type: 'custom_milestone',
                title: editHabit.title,
                details: {
                  sourceType: 'habit',
                  categoryName: editHabit.category,
                  difficulty: editHabit.difficulty,
                  consecutiveCount: editHabit.consecutiveCount,
                  totalCompletions: editHabit.totalCompletions,
                  durationDays: days,
                },
                isMilestone: true,
              })
              showToast(`⭐ ${editHabit.title}`)
              onClose()
            }}
            style={{
              width: '100%', height: 36, borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-xp)', background: 'color-mix(in srgb, var(--color-xp) 10%, transparent)',
              color: 'var(--color-xp)', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            }}
          >
            ⭐ {t.habit_inscribe}
          </button>
        )}

        {/* 子步骤管理（编辑模式，内嵌 subHabits） */}
        {editHabit && (() => {
          const subHabits = currentHabit?.subHabits ?? editHabit.subHabits ?? []
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>{t.subtask_add}</label>
              {subHabits.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <AnimatePresence>
                    {subHabits.map((sub) => (
                      <motion.div
                        key={sub.id}
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: 40 }}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border)', background: 'var(--color-bg)', fontSize: 13,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="checkbox"
                            checked={sub.completed}
                            onChange={() => undefined}
                            style={{ accentColor: 'var(--color-accent)', cursor: 'pointer' }}
                            readOnly
                          />
                          <span style={{ color: sub.completed ? 'var(--color-text-dim)' : 'var(--color-text)', textDecoration: sub.completed ? 'line-through' : 'none' }}>
                            {sub.title}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeSubHabit(editHabit.id, sub.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--color-text-dim)', cursor: 'pointer', fontSize: 12, padding: '0 4px' }}
                        >
                          ✕
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  value={subHabitInput}
                  onChange={(e) => setSubHabitInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (!subHabitInput.trim()) return
                      addSubHabit(editHabit.id, subHabitInput.trim())
                      setSubHabitInput('')
                    }
                  }}
                  placeholder={t.subtask_placeholder}
                  style={{
                    flex: 1, height: 32, padding: '0 10px', borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)', background: 'var(--color-bg)',
                    color: 'var(--color-text)', fontSize: 13, outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!subHabitInput.trim()) return
                    addSubHabit(editHabit.id, subHabitInput.trim())
                    setSubHabitInput('')
                  }}
                  disabled={!subHabitInput.trim()}
                  style={{
                    height: 32, padding: '0 12px', borderRadius: 'var(--radius-md)', border: 'none',
                    background: subHabitInput.trim() ? 'var(--color-accent)' : 'var(--color-border)',
                    color: subHabitInput.trim() ? 'white' : 'var(--color-text-dim)',
                    fontSize: 12, fontWeight: 600, cursor: subHabitInput.trim() ? 'pointer' : 'default',
                  }}
                >
                  +
                </button>
              </div>
            </div>
          )
        })()}

        {/* 按钮 */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              height: 36,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: 'transparent',
              color: 'var(--color-text-dim)',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            {t.habitDrawer_cancel}
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              flex: 2,
              height: 36,
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: canSubmit ? 'var(--color-accent)' : 'var(--color-border)',
              color: canSubmit ? 'white' : 'var(--color-text-dim)',
              fontSize: 14,
              fontWeight: 600,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              transition: 'background 0.15s',
            }}
          >
            {editHabit ? t.habitDrawer_save : t.habitDrawer_create}
          </button>
        </div>
      </form>
    </Drawer>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>{label}</label>
      {children}
    </div>
  )
}

function CounterRow({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  const tInner = useT()
  const tUnit = tInner.counter_times
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--color-text-dim)', flex: 1 }}>{label}</span>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        style={stepBtnStyle}
      >−</button>
      <span style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-num)', minWidth: 28, textAlign: 'center', color: 'var(--color-text)' }}>
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        style={stepBtnStyle}
      >＋</button>
      <span style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>{tUnit}</span>
    </div>
  )
}

function MonthDayGrid({
  selected,
  onChange,
}: {
  selected: number[]
  onChange: (days: number[]) => void
}) {
  const tInner = useT()
  function toggle(day: number) {
    onChange(
      selected.includes(day)
        ? selected.filter((d) => d !== day)
        : [...selected, day].sort((a, b) => (a === -1 ? 32 : a) - (b === -1 ? 32 : b))
    )
  }
  const hasLastDay = selected.includes(-1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
          const isSelected = selected.includes(day)
          return (
            <button
              key={day}
              type="button"
              onClick={() => toggle(day)}
              style={{
                height: 30,
                borderRadius: 'var(--radius-sm)',
                border: `1px solid ${isSelected ? 'var(--color-accent)' : 'var(--color-border)'}`,
                background: isSelected ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)' : 'transparent',
                color: isSelected ? 'var(--color-accent)' : 'var(--color-text-dim)',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: isSelected ? 600 : 400,
                transition: 'all 0.12s',
              }}
            >
              {day}
            </button>
          )
        })}
      </div>
      {/* 月末快捷 */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: 'var(--color-text-dim)' }}>
        <input
          type="checkbox"
          checked={hasLastDay}
          onChange={() => toggle(-1)}
          style={{ accentColor: 'var(--color-accent)', width: 14, height: 14 }}
        />
        {tInner.monthGrid_includeLastDay}
      </label>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  height: 36,
  padding: '0 12px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-bg)',
  color: 'var(--color-text)',
  fontSize: 14,
  outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
  width: '100%',
  boxSizing: 'border-box',
}

const subPanelStyle: React.CSSProperties = {
  marginTop: 8,
  padding: 12,
  background: 'var(--color-bg)',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
}

const stepBtnStyle: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)',
  background: 'transparent',
  color: 'var(--color-text)',
  cursor: 'pointer',
  fontSize: 14,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
}

function modeTabStyle(isActive: boolean): React.CSSProperties {
  return {
    fontSize: 11,
    padding: '3px 10px',
    borderRadius: 'var(--radius-sm)',
    border: `1px solid ${isActive ? 'var(--color-secondary)' : 'var(--color-border)'}`,
    background: isActive ? 'color-mix(in srgb, var(--color-secondary) 12%, transparent)' : 'transparent',
    color: isActive ? 'var(--color-secondary)' : 'var(--color-text-dim)',
    cursor: 'pointer',
    transition: 'all 0.15s',
  }
}

function dayBtnStyle(isSelected: boolean): React.CSSProperties {
  return {
    width: 34,
    height: 34,
    borderRadius: 'var(--radius-sm)',
    border: `1px solid ${isSelected ? 'var(--color-accent)' : 'var(--color-border)'}`,
    background: isSelected ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)' : 'transparent',
    color: isSelected ? 'var(--color-accent)' : 'var(--color-text-dim)',
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: isSelected ? 600 : 400,
    transition: 'all 0.15s',
  }
}
