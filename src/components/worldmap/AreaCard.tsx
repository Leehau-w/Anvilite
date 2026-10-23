import { motion, type TargetAndTransition } from 'framer-motion'
import type { Area } from '@/types/area'
import { AREA_TEMPLATES } from '@/types/area'
import { useTaskStore } from '@/stores/taskStore'
import { useHabitStore } from '@/stores/habitStore'
import { isHabitDueToday } from '@/engines/habitEngine'
import { getAreaActivityStats } from '@/utils/areaStats'
import { getAreaDisplayName } from '@/utils/area'
import { useT } from '@/i18n'

// 与 WorldMap.tsx 保持一致的宽高比常量（方便后期像素素材适配）
const CARD_ASPECT = 1

interface AreaCardProps {
  area: Area
  editMode: boolean
  onClick: () => void
  onRename: (id: string) => void
  onDelete: (id: string) => void
}

function getAreaEmoji(templateId: string | null): string {
  if (!templateId) return '🏕️'
  const template = AREA_TEMPLATES[templateId as keyof typeof AREA_TEMPLATES]
  if (!template) return '🏕️'
  return template.prosperityEmojis[0]
}

export function AreaCard({ area, editMode, onClick, onRename, onDelete }: AreaCardProps) {
  const t = useT()
  const tasks = useTaskStore((s) => s.tasks)
  const habits = useHabitStore((s) => s.habits)
  const isArchiveArea = area.category === '_milestone' || area.templateId === 'milestone'

  const { completedTaskCount, totalMinutes } = getAreaActivityStats(tasks, isArchiveArea ? undefined : area.category)
  const emoji = getAreaEmoji(area.templateId)
  const displayName = getAreaDisplayName(area, t)

  const areaTasks = isArchiveArea
    ? []
    : tasks.filter((task) => !task.deletedAt && !task.isHidden && task.category === area.category)
  const todoCount = areaTasks.filter((task) => task.status === 'todo').length
  const doingCount = areaTasks.filter((task) => task.status === 'doing').length
  const waitingCount = areaTasks.filter((task) => task.status === 'waiting').length
  const todayHabitCount = isArchiveArea
    ? 0
    : habits.filter((habit) =>
      !habit.deletedAt &&
      !habit.isHidden &&
      habit.category === area.category &&
      (habit.status === 'active' || habit.status === 'completed_today') &&
      isHabitDueToday(habit)
    ).length

  const metrics = [
    { label: t.worldmap_cardTodo, value: todoCount, color: 'var(--color-text)' },
    { label: t.worldmap_cardDoing, value: doingCount, color: 'var(--color-accent)' },
    { label: t.worldmap_cardCompleted, value: completedTaskCount, color: 'var(--color-success)' },
    { label: t.worldmap_cardTime, value: t.heatmap_minutes(totalMinutes), color: 'var(--color-text)' },
  ]

  return (
    <motion.div
      whileHover={editMode ? undefined : { scale: 1.02, borderColor: 'var(--color-accent)' } as TargetAndTransition}
      onClick={() => !editMode && onClick()}
      style={{
        position: 'relative',
        aspectRatio: `${CARD_ASPECT}`,
        width: '100%',
        padding: '9% 9% 8%',
        borderRadius: 'var(--radius-xl)',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        cursor: editMode ? 'default' : 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '5%',
        overflow: 'hidden',
        transition: 'border-color 0.15s',
        boxSizing: 'border-box',
      }}
    >
      {isArchiveArea ? (
        <div
          style={{
            flex: 1,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 'clamp(42px, 34%, 74px)', lineHeight: 1 }}>{emoji}</div>
          <div
            style={{
              width: '100%',
              fontSize: 'clamp(14px, 10%, 22px)',
              fontWeight: 700,
              color: 'var(--color-text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {displayName}
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minHeight: 34 }}>
            <div style={{ fontSize: 'clamp(24px, 18%, 42px)', lineHeight: 1, flexShrink: 0 }}>{emoji}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 'clamp(12px, 8%, 18px)',
                  fontWeight: 700,
                  color: 'var(--color-text)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {displayName}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6, width: '100%', flex: 1, alignContent: 'center' }}>
            {metrics.map((metric) => (
              <div
                key={metric.label}
                style={{
                  minHeight: 34,
                  padding: '4px 6px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                }}
              >
                <div style={{ fontSize: 'clamp(10px, 6%, 12px)', color: 'var(--color-text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {metric.label}
                </div>
                <div style={{ fontSize: 'clamp(13px, 9%, 18px)', fontFamily: 'var(--font-num)', fontWeight: 700, color: metric.color, lineHeight: 1.25 }}>
                  {metric.value}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 6 }}>

            <div style={{ fontSize: 'clamp(10px, 6%, 12px)', color: 'var(--color-text-dim)', fontFamily: 'var(--font-num)', whiteSpace: 'nowrap' }}>
              {waitingCount > 0 && <span title={t.task_waiting} aria-label={`${t.task_waiting}: ${waitingCount}`}>⏳ {waitingCount} · </span>}
              {t.worldmap_cardHabits} {todayHabitCount}
            </div>
          </div>
        </>
      )}

      {/* 编辑模式操作 */}
      {editMode && (
        <div
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            display: 'flex',
            gap: 2,
          }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); onRename(area.id) }}
            title={t.worldmap_rename}
            style={editBtnStyle}
          >
            ✏
          </button>
          {area.canDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(area.id) }}
              title={t.worldmap_delete}
              style={{ ...editBtnStyle, color: 'var(--color-danger)' }}
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* 拖拽提示（编辑模式） */}
      {editMode && (
        <div style={{ position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)', fontSize: 10, color: 'var(--color-text-dim)', opacity: 0.5 }}>
          ⠿
        </div>
      )}
    </motion.div>
  )
}

const editBtnStyle: React.CSSProperties = {
  width: 20,
  height: 20,
  fontSize: 11,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--color-text-dim)',
  cursor: 'pointer',
  padding: 0,
}
