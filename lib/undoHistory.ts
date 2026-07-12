const KEY = 'money-board-undo-history'
const MAX = 5

export interface UndoEntry {
  id: string
  description: string
  timestamp: number
  changes: Array<{
    id: string
    user_category: string | null
    user_subcategory: string | null
    manual_override: boolean
  }>
}

export function getUndoHistory(): UndoEntry[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function addUndoEntry(entry: Omit<UndoEntry, 'id' | 'timestamp'>) {
  try {
    const history = getUndoHistory()
    const next: UndoEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    }
    history.unshift(next)
    localStorage.setItem(KEY, JSON.stringify(history.slice(0, MAX)))
    window.dispatchEvent(new CustomEvent('undo-history-change'))
  } catch {}
}

export function removeUndoEntry(id: string) {
  try {
    const history = getUndoHistory().filter(e => e.id !== id)
    localStorage.setItem(KEY, JSON.stringify(history))
    window.dispatchEvent(new CustomEvent('undo-history-change'))
  } catch {}
}
