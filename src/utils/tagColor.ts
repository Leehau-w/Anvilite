export const TAG_PALETTE = [
  '#e8600a', '#8b5cf6', '#16a34a', '#0891b2', '#d97706',
  '#ec4899', '#6366f1', '#14b8a6', '#f43f5e', '#84cc16',
]

export function getTagColor(tagName: string): string {
  let hash = 0
  for (let i = 0; i < tagName.length; i++) {
    hash = ((hash << 5) - hash + tagName.charCodeAt(i)) | 0
  }
  return TAG_PALETTE[Math.abs(hash) % TAG_PALETTE.length]
}
