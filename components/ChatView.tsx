'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Loader2, Plus, Trash2, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Session {
  id: string
  title: string
  updated_at: string
}

interface UsageState {
  tokensUsed: number
  dailyLimit: number
  requestsCount: number
}

const SUGGESTED = [
  'How much did we spend last month?',
  'What are our top spending categories?',
  'How does this month compare to last month?',
  'What did we spend at restaurants recently?',
]

// Simple markdown renderer — converts AI formatting to HTML
function renderMarkdown(text: string): string {
  return text
    // Escape HTML first
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="font-semibold text-sm mt-3 mb-0.5">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="font-semibold text-sm mt-3 mb-0.5">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="font-semibold text-sm mt-3 mb-0.5">$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Bullet lists — collect consecutive items
    .replace(/(^[-•] .+$(\n[-•] .+$)*)/gm, (block) => {
      const items = block.split('\n').map(l => `<li>${l.replace(/^[-•] /, '')}</li>`).join('')
      return `<ul class="list-disc ml-4 space-y-0.5 my-1">${items}</ul>`
    })
    // Numbered lists
    .replace(/(^\d+\. .+$(\n\d+\. .+$)*)/gm, (block) => {
      const items = block.split('\n').map(l => `<li>${l.replace(/^\d+\. /, '')}</li>`).join('')
      return `<ol class="list-decimal ml-4 space-y-0.5 my-1">${items}</ol>`
    })
    // Paragraph breaks
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>')
}

function MarkdownMessage({ text }: { text: string }) {
  return (
    <div
      className="text-sm leading-relaxed"
      dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
    />
  )
}

export function ChatView() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [usage, setUsage] = useState<UsageState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showSessions, setShowSessions] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load usage + sessions on mount
  useEffect(() => {
    fetch('/api/chat').then(r => r.json()).then(d => {
      if (!d.error) setUsage({ tokensUsed: d.tokensUsed, dailyLimit: d.dailyLimit, requestsCount: d.requestsCount })
    })
    loadSessions()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }, [input])

  const loadSessions = async () => {
    const res = await fetch('/api/chat/sessions')
    const data = await res.json()
    if (!data.error) setSessions(data)
  }

  const loadSession = async (sessionId: string) => {
    setActiveSessionId(sessionId)
    setMessages([])
    setError(null)
    setShowSessions(false)
    setLoadingMessages(true)
    const res = await fetch(`/api/chat/sessions/${sessionId}`)
    const data = await res.json()
    setLoadingMessages(false)
    if (!data.error) setMessages(data.map((m: any) => ({ role: m.role, content: m.content })))
  }

  const newChat = () => {
    setActiveSessionId(null)
    setMessages([])
    setError(null)
    setInput('')
    setShowSessions(false)
  }

  const deleteSession = async (id: string) => {
    await fetch(`/api/chat/sessions/${id}`, { method: 'DELETE' })
    setSessions(prev => prev.filter(s => s.id !== id))
    if (activeSessionId === id) newChat()
    setDeletingId(null)
  }

  const send = async (text: string) => {
    const msg = text.trim()
    if (!msg || loading) return
    setInput('')
    setError(null)
    const newUserMsg: Message = { role: 'user', content: msg }
    setMessages(prev => [...prev, newUserMsg])
    setLoading(true)

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, session_id: activeSessionId }),
    })
    const data = await res.json()
    setLoading(false)

    if (data.error) {
      setError(data.error)
      setMessages(prev => prev.slice(0, -1))
      return
    }

    setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
    setUsage(u => u ? { ...u, tokensUsed: data.totalUsed, requestsCount: u.requestsCount + 1 } : u)

    // Update session state
    if (data.session_id) {
      if (!activeSessionId) {
        // New session created — add to list and set active
        setActiveSessionId(data.session_id)
        await loadSessions()
      } else {
        // Update existing session's updated_at in list
        setSessions(prev => prev.map(s =>
          s.id === data.session_id ? { ...s, updated_at: new Date().toISOString() } : s
        ).sort((a, b) => b.updated_at.localeCompare(a.updated_at)))
      }
    }
  }

  const pct = usage ? Math.min(100, Math.round((usage.tokensUsed / usage.dailyLimit) * 100)) : 0
  const meterColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-400' : 'bg-blue-500'

  return (
    <div className="flex gap-0 sm:gap-6 h-full" style={{ minHeight: 'calc(100vh - 180px)' }}>
      {/* Sessions sidebar — desktop */}
      <div className="hidden sm:flex flex-col w-56 shrink-0 border-r border-gray-100 pr-4">
        <button
          onClick={newChat}
          className="flex items-center gap-2 w-full px-3 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors mb-3"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </button>
        <div className="flex-1 overflow-y-auto space-y-1">
          {sessions.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">No chats yet</p>
          )}
          {sessions.map(s => (
            <div
              key={s.id}
              className={`group flex items-center gap-1 rounded-xl px-2 py-2 cursor-pointer transition-colors ${
                s.id === activeSessionId ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-600'
              }`}
            >
              <button
                onClick={() => loadSession(s.id)}
                className="flex-1 text-left text-xs truncate"
              >
                {s.title}
              </button>
              {deletingId === s.id ? (
                <div className="flex gap-1">
                  <button onClick={() => deleteSession(s.id)} className="text-xs text-red-500 hover:text-red-700">Del</button>
                  <button onClick={() => setDeletingId(null)} className="text-xs text-gray-400">✕</button>
                </div>
              ) : (
                <button
                  onClick={() => setDeletingId(s.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile: sessions dropdown */}
        <div className="sm:hidden mb-3 flex gap-2">
          <button
            onClick={() => setShowSessions(v => !v)}
            className="flex-1 flex items-center justify-between px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600"
          >
            <span className="flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="truncate">{sessions.find(s => s.id === activeSessionId)?.title ?? 'New Chat'}</span>
            </span>
            {showSessions ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={newChat}
            className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {showSessions && (
          <div className="sm:hidden bg-white border border-gray-200 rounded-xl shadow-lg mb-3 max-h-48 overflow-y-auto">
            {sessions.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No chats yet</p>}
            {sessions.map(s => (
              <div key={s.id} className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-50 last:border-0">
                <button onClick={() => loadSession(s.id)} className="flex-1 text-left text-sm text-gray-700 truncate">
                  {s.title}
                </button>
                <button onClick={() => deleteSession(s.id)} className="text-gray-400 hover:text-red-500">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Usage meter */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-3 mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-gray-500">Daily AI usage</span>
            <span className={`text-xs font-medium tabular-nums ${pct >= 90 ? 'text-red-500' : pct >= 70 ? 'text-amber-500' : 'text-gray-500'}`}>
              {usage ? `${usage.tokensUsed.toLocaleString()} / ${usage.dailyLimit.toLocaleString()}` : '—'}
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div className={`h-1.5 rounded-full transition-all ${meterColor}`} style={{ width: `${pct}%` }} />
          </div>
          {usage && (
            <p className="text-xs text-gray-400 mt-1">
              {usage.requestsCount} {usage.requestsCount === 1 ? 'message' : 'messages'} today · resets at midnight
            </p>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-3 mb-4 min-h-[200px]">
          {loadingMessages && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          )}

          {!loadingMessages && messages.length === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-400 text-center py-4">Ask anything about your spending</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SUGGESTED.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-left text-sm text-gray-600 bg-white border border-gray-100 rounded-xl px-4 py-3 hover:bg-gray-50 hover:border-gray-200 transition-colors shadow-sm"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[88%] rounded-2xl px-4 py-3 ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm text-sm leading-relaxed'
                  : 'bg-white border border-gray-100 shadow-sm text-gray-800 rounded-bl-sm'
              }`}>
                {m.role === 'user' ? m.content : <MarkdownMessage text={m.content} />}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-bl-sm px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                send(input)
              }
            }}
            placeholder="Ask about your finances… (Ctrl+Enter to send)"
            rows={1}
            disabled={loading || pct >= 100}
            className="flex-1 px-4 py-3 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 resize-none overflow-hidden"
            style={{ minHeight: '48px', maxHeight: '160px' }}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading || pct >= 100}
            className="flex items-center justify-center w-12 h-12 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors shrink-0"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
