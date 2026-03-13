import { useEffect, useState, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import ChatArea from './components/ChatArea'
import './App.css'

const SETTINGS_KEY = 'lfl_settings_v1'
const HISTORY_KEY = 'lfl_history_v1'
const SELECTED_KEY = 'lfl_selected_v1'
const MODE_KEY = 'lfl_mode_v1'

// Read initial values from localStorage synchronously so theme can be applied
const _initial = (() => {
  let settings = { email: '', dark: false, model: 'OpenAI' }
  let history = []
  let selectedId = null
  let mode = 'chat'
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) settings = JSON.parse(raw)
  } catch { /* ignore */ }
  try {
    const rawH = localStorage.getItem(HISTORY_KEY)
    if (rawH) history = JSON.parse(rawH)
  } catch { /* ignore */ }
  // sanitize history items in case previous versions stored non-string titles
  try {
    history = (history || []).map((c) => {
      const title = c && c.title
      let safeTitle = ''
      if (typeof title === 'string') safeTitle = title
      else if (title && typeof title === 'object') safeTitle = title.text || title.toString()
      else safeTitle = String(title || 'New chat')

      const msgs = (c && Array.isArray(c.messages) ? c.messages : []).map((m) => ({
        id: m && m.id ? m.id : Date.now().toString(),
        role: m && m.role ? m.role : 'user',
        text: m && (typeof m.text === 'string' ? m.text : JSON.stringify(m.text || '')),
      }))

      const type = c && c.type === 'template' ? 'template' : 'chat'
      return { id: c.id || Date.now().toString(), title: safeTitle, messages: msgs, type }
    })
  } catch { /* ignore sanitize errors */ }
  try {
    const rawS = localStorage.getItem(SELECTED_KEY)
    if (rawS) selectedId = rawS
  } catch { /* ignore */ }

  // If no explicit selectedId, pick the first conversation (most recent)
  if (!selectedId && history && history.length > 0) selectedId = history[0].id

  const selectedConversation = history.find((c) => c.id === selectedId)
  if (selectedConversation) mode = selectedConversation.type || 'chat'
  else if (history && history.length > 0) mode = history[0].type || 'chat'

  try {
    const rawMode = localStorage.getItem(MODE_KEY)
    if (rawMode === 'chat' || rawMode === 'template') {
      const hasConversationForMode =
        rawMode === 'chat' ? true : history.some((c) => (c.type || 'chat') === rawMode)
      if (hasConversationForMode) {
        mode = rawMode
      }
    }
  } catch { /* ignore */ }

  // apply theme immediately to avoid flicker
  try {
    document.documentElement.setAttribute('data-theme', settings.dark ? 'dark' : 'light')
  } catch { /* ignore */ }

  return { settings, history, selectedId, mode }
})()

function App() {
  const [settings, setSettings] = useState(_initial.settings)
  const [history, setHistory] = useState(_initial.history)
  const [selectedId, setSelectedId] = useState(_initial.selectedId)
  const [mode, setMode] = useState(_initial.mode)
  
  const [apiError, setApiError] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)



  // Persist settings and apply theme
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    } catch { /* ignore */ }
    try {
      document.documentElement.setAttribute('data-theme', settings.dark ? 'dark' : 'light')
    } catch { /* ignore */ }
  }, [settings])

  // Persist history
  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
    } catch { /* ignore */ }
  }, [history])

  // Persist selected conversation id
  useEffect(() => {
    try {
      if (selectedId) localStorage.setItem(SELECTED_KEY, selectedId)
      else localStorage.removeItem(SELECTED_KEY)
    } catch (error) {
      console.error('Failed to persist selected ID:', error)
    }
  }, [selectedId])

  useEffect(() => {
    try {
      localStorage.setItem(MODE_KEY, mode)
    } catch { /* ignore */ }
  }, [mode])

  const handleChangeMode = useCallback(
    (nextMode) => {
      setMode(nextMode)
      setSelectedId((currentId) => {
        const currentConversation = history.find((c) => c.id === currentId)
        if (currentConversation && currentConversation.type === nextMode) {
          return currentId
        }
        const nextConversation = history.find((c) => c.type === nextMode)
        return nextConversation ? nextConversation.id : null
      })
    },
    [history],
  )

  const handleToggleMode = useCallback(() => {
    handleChangeMode(mode === 'chat' ? 'template' : 'chat')
  }, [mode, handleChangeMode])

  const handleNewConversation = useCallback((type, initialMessage = '') => {
    const id = Date.now().toString()
    const firstText = initialMessage ? String(initialMessage).trim() : ''
    const title = firstText
      ? firstText.length > 60
        ? firstText.slice(0, 60) + '…'
        : firstText
      : type === 'template'
      ? 'New template'
      : 'New chat'
    const messageId = Date.now().toString() + '_m'
    const conv = {
      id,
      title,
      type,
      messages: firstText
        ? [
            {
              id: messageId,
              role: 'user',
              text: firstText,
            },
          ]
        : [],
    }
    setHistory((h) => [conv, ...h])
    setMode(type)
    setSelectedId(id)
    return id
  }, [])

  const handleSelect = useCallback(
    (id) => {
      setSelectedId(id)
      const conv = history.find((c) => c.id === id)
      if (conv) {
        setMode(conv.type || 'chat')
      }
    },
    [history],
  )

  const handleStartNewConversation = useCallback((type) => {
    setMode(type)
    setSelectedId(null)
  }, [])

  const handleDeleteConversation = useCallback(
    (id) => {
      setHistory((h) => {
        const remaining = h.filter((c) => c.id !== id)
        setSelectedId((cur) => {
          if (cur === id) {
            const fallback = remaining.find((c) => c.type === mode)
            return fallback ? fallback.id : null
          }
          return cur
        })
        return remaining
      })
    },
    [mode],
  )

  const handleUpdateConversation = useCallback((id, updater) => {
    setHistory((h) =>
      h.map((c) => {
        if (c.id !== id) return c
        const updated = updater(c)
        return { ...c, ...updated, type: (updated && updated.type) || c.type }
      }),
    )
  }, [])

  // Sidebar will manage an inline/collapsible settings panel now

  const handleSettingsChange = useCallback((patch) => {
    setSettings((s) => ({ ...s, ...patch }))
  }, [])

  const handleToggleSidebar = useCallback((isOpen) => {
    setSidebarOpen(isOpen)
  }, [])

  const selectedConversation = history.find((c) => c.id === selectedId) || null

  return (
    <div className={`app-root ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      {apiError && <div className="api-error">{apiError}</div>}
      <Sidebar
        history={history}
        mode={mode}
        onChangeMode={handleChangeMode}
        onStartNewConversation={handleStartNewConversation}
        onCreateConversation={handleNewConversation}
        onSelectConversation={handleSelect}
        settings={settings}
        onSettingsChange={handleSettingsChange}
        onDeleteConversation={handleDeleteConversation}
        selectedId={selectedId}
        onToggleSidebar={handleToggleSidebar}
      />

      <main className="main-area">
        <ChatArea
          mode={mode}
          onToggleMode={handleToggleMode}
          onChangeMode={handleChangeMode}
          conversation={selectedConversation}
          onCreateConversation={handleNewConversation}
          onStartNewConversation={handleStartNewConversation}
          onUpdateConversation={(id, up) => id && handleUpdateConversation(id, up)}
        />
      </main>

      {/* Settings moved into sidebar as a collapsible inline panel */}
    </div>
  )
}

export default App
