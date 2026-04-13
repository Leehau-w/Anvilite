import React, { useMemo, useState } from 'react'
import { useSOPStore } from '@/stores/sopStore'
import { useT } from '@/i18n'
import { useSettingsStore } from '@/stores/settingsStore'
import { getSystemSOPs } from '@/data/systemSOPs'
import { SOPTree } from './SOPTree'
import { SOPContent } from './SOPContent'
import { SOPEditor } from './SOPEditor'

export function SOPPage() {
  const t = useT()
  const lang = useSettingsStore((s) => s.settings.language)
  const { sops, selectedSOPId } = useSOPStore()

  const systemSOPs = useMemo(() => getSystemSOPs(lang), [lang])
  const selectedSOP = useMemo(
    () => [...systemSOPs, ...sops].find((s) => s.id === selectedSOPId) ?? null,
    [systemSOPs, sops, selectedSOPId]
  )

  const [creatingInFolder, setCreatingInFolder] = useState<string | null>(null)

  if (creatingInFolder !== null) {
    return (
      <div style={{ display: 'flex', height: '100%' }}>
        <SOPTree onNewSOP={(fid) => setCreatingInFolder(fid)} />
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <SOPEditor
            sopId={null}
            defaultFolderId={creatingInFolder}
            onSave={() => setCreatingInFolder(null)}
            onCancel={() => setCreatingInFolder(null)}
          />
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <SOPTree onNewSOP={(fid) => setCreatingInFolder(fid)} />
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {selectedSOP ? (
          <SOPContent sop={selectedSOP} />
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: 12,
              color: 'var(--color-text-dim)',
            }}
          >
            <div style={{ fontSize: 32 }}>📋</div>
            <div style={{ fontSize: 14 }}>{t.sop_emptyState}</div>
          </div>
        )}
      </div>
    </div>
  )
}
