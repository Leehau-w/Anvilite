type DateChangeCallback = () => void

export function startDateWatcher(onDateChange: DateChangeCallback): () => void {
  let lastDate = new Date().toDateString()

  const check = () => {
    const currentDate = new Date().toDateString()
    if (currentDate !== lastDate) {
      lastDate = currentDate
      onDateChange()
    }
  }

  // 每分钟检查一次（兜底）
  const intervalId = setInterval(check, 60_000)

  // 页面从后台恢复时立即检查
  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      check()
    }
  }
  document.addEventListener('visibilitychange', handleVisibility)

  return () => {
    clearInterval(intervalId)
    document.removeEventListener('visibilitychange', handleVisibility)
  }
}
