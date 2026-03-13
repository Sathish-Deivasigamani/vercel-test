import React, { useState, useEffect } from 'react'
import { FiSettings, FiInfo, FiTrendingUp, FiPlus, FiX, FiChevronDown, FiChevronUp } from 'react-icons/fi'
import Settings from './Settings'
import '../style/Sidebar.css'
import left_arrow from '../assets/left_panel_open.png';
import right_arrow from '../assets/left_panel_close.png';
import { LuPanelLeftOpen } from "react-icons/lu";
import GoogleLoginButton from './GoogleLoginButton';
import { deviceManager } from '../api/deviceManager';


export default function Sidebar({
  history = [],
  mode = 'chat',
  onChangeMode,
  onStartNewConversation,
  onCreateConversation,
  onSelectConversation,
  settings,
  onSettingsChange,
  onDeleteConversation,
  selectedId,
  onToggleSidebar,
}) {
  const [isOpen, setIsOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('lfl_sidebar_open')
      return saved !== null ? JSON.parse(saved) : true
    } catch {
      return true
    }
  })
  const [showSettingsInline, setShowSettingsInline] = useState(false)
  const [historyOpenMap, setHistoryOpenMap] = useState({ chat: true, template: true })
  const [deleteConfirm, setDeleteConfirm] = useState(null) // { id, title, type }
  const [signOutConfirm, setSignOutConfirm] = useState(false)

  // Persist sidebar open state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('lfl_sidebar_open', JSON.stringify(isOpen))
    } catch {
      // ignore
    }
  }, [isOpen])

  const toggleSidebar = () => {
    const newState = !isOpen
    setIsOpen(newState)
    if (onToggleSidebar) {
      onToggleSidebar(newState)
    }
  }
  const isCurrentHistoryOpen = historyOpenMap[mode] ?? true

  const toggleHistorySection = (section) => {
    setHistoryOpenMap((prev) => ({
      ...prev,
      [section]: !(prev[section] ?? true),
    }))
  }

  // prevent unused prop lint warnings (these props may be used by parent)
  void onStartNewConversation
  void onCreateConversation

  // User info state (shows avatar/name when available)
  const [user, setUser] = useState(() => deviceManager.getUser())

  useEffect(() => {
    const refresh = () => setUser(deviceManager.getUser())
    window.addEventListener('storage', refresh)
    window.addEventListener('userLoggedIn', refresh)
    window.addEventListener('userLoggedOut', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('userLoggedIn', refresh)
      window.removeEventListener('userLoggedOut', refresh)
    }
  }, [])

  const handleSignOut = () => {
    // Clear everything (tokens, user, history, settings, selected/mode)
    deviceManager.clearAllData()

    // Update local UI state immediately
    setUser(null)
    // Refresh the page so the app state is fully reset
    try {
      window.location.reload()
    } catch {
      // ignore in non-browser environments
    }
  }

  return (
    <aside className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
      <div className='sidebar-drawer-main-btn'>
        {isOpen && (
          <div className='sidebar-company-logo'><img src="https://workiycrm.s3.ap-south-1.amazonaws.com/CRM+menu+images/user/workiy.ico" height={40} width={40} alt="" /></div>
        )}
        <button className="sidebar-toggle" onClick={toggleSidebar} aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}>
          {/* {isOpen ? '◀' : '▶'} */}
          {isOpen ?
            <img src={right_arrow} height={25} width={25} /> : <img src={left_arrow} height={25} width={25} />}

        </button>
      </div>



      {isOpen && (
        <>
          <div className="top">
            {/* <button
              className="new-chat"
              onClick={() => {
                if (onStartNewConversation) {
                  onStartNewConversation(mode)
                } else if (onCreateConversation) {
                  onCreateConversation(mode)
                }
              }}
              aria-label={mode === 'chat' ? 'New chat' : 'New Document'}
            >
              {mode === 'chat' ? '➕ New chat' : '➕ New Document'}
            </button> */}
            <div className="mode-switch">
              <button
                className={mode === 'chat' ? 'active' : ''}
                onClick={() => onChangeMode && onChangeMode('chat')}
              >
                Chat
              </button>
              <button
                className={mode === 'template' ? 'active' : ''}
                onClick={() => onChangeMode && onChangeMode('template')}
              >
                Document
              </button>
            </div>
          </div>
          {(mode === 'chat' || mode === 'template') && (
            <div
              className="sidebar-helper history-toggle"
              onClick={() => toggleHistorySection(mode)}
            >
              <span>{mode === 'template' ? 'Template history' : 'Chat history'}</span>
              <FiChevronDown
                className={`history-toggle-icon ${isCurrentHistoryOpen ? 'open' : 'closed'}`}
              />
            </div>
          )}

          {mode !== 'chat' && mode !== 'template' && (
            <div className="sidebar-helper">{mode}</div>
          )}

          {isCurrentHistoryOpen &&
            (() => {
              const filteredHistory = history.filter((c) => (c.type || 'chat') === mode)

              return (
                <div className="history" role="list">
                  {filteredHistory.length === 0 && (
                    <div style={{ padding: 12, color: 'var(--muted)' }}>
                      {mode === 'chat'
                        ? 'No conversations yet — start a new chat.'
                        : 'No templates yet — create one to get started.'}
                    </div>
                  )}
                  {filteredHistory.map((c) => (
                    <div
                      key={c.id}
                      role="listitem"
                      className={`history-item ${selectedId === c.id ? 'selected' : ''}`}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div
                          className="history-title"
                          onClick={() => onSelectConversation(c.id)}
                        >
                          {c.title}
                        </div>
                        <button
                          aria-label={`Delete ${c.title}`}
                          className="delete-btn"
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent triggering the conversation selection
                            setDeleteConfirm({ id: c.id, title: c.title, type: mode })
                          }}
                          title="Delete"
                        >
                          ✖
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}



        </>
      )}

      <div className="bottom-menu">
        <button
          className="menu-button"
          onClick={() => {
            if (!isOpen) setIsOpen(true);
            setShowSettingsInline((s) => !s);
          }}
          title="Settings"
          aria-expanded={showSettingsInline}
        >
          <FiSettings className="menu-icon" />
          {isOpen && <span className="menu-text">Settings</span>}
          {isOpen && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                setShowSettingsInline((s) => !s);
              }}
              role="button"
              tabIndex={0}
              aria-label={showSettingsInline ? 'Collapse settings' : 'Expand settings'}
              aria-expanded={showSettingsInline}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px',
                marginLeft: '6px',
                cursor: 'pointer',
                color: 'var(--muted)',
                borderRadius: '6px',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.03)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {showSettingsInline ? <FiChevronUp /> : <FiChevronDown />}
            </div>
          )}
        </button>
        {/* Inline settings (rendered above the bottom menu) */}
        {showSettingsInline && isOpen && (
          <div className="sidebar-settings-inline">
            <Settings
              settings={settings}
              onChange={(patch) => onSettingsChange && onSettingsChange(patch)}
              onClose={() => setShowSettingsInline(false)}
              inline
            />
          </div>
        )}

        {isOpen && (
          <>
            <button className="menu-button" title="About">
              <FiInfo className="menu-icon" />
              <span className="menu-text">About</span>
            </button>
            <button className="menu-button" title="Upgrade">
              <FiTrendingUp className="menu-icon" />
              <span className="menu-text">Upgrade</span>
            </button>
          </>
        )}

        {user ? (
          <div style={{ display: 'flex', flexDirection: 'row', gap: '0.5rem', justifyContent: isOpen ? 'flex-start' : 'center' }}>
            <button className="menu-button" disabled style={{ cursor: 'default', padding: isOpen ? '0.6rem 0.75rem' : '0' }}>
              {user.picture && (
                <img src={user.picture} alt={user.name || user.email} style={{ width: 28, height: 28, borderRadius: 999, marginRight: isOpen ? 8 : 0 }} />
              )}
              {isOpen && <span className="menu-text">{user.name || user.email}</span>}
            </button>

            {isOpen && (
              <button
                onClick={() => setSignOutConfirm(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ef4444',
                  fontSize: '11px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  padding: '0.4rem 0.75rem',
                  fontWeight: '500',
                  transition: 'all 0.18s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                Sign Out
              </button>
            )}
          </div>
        ) : (
          ''
        )}
      </div>



      {/* Sign Out Confirmation Modal */}
      {signOutConfirm && (
        <div
          className="delete-modal-overlay"
          onClick={() => setSignOutConfirm(false)}
        >
          <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="delete-modal-title">Sign Out?</h3>
            <div className="delete-modal-body">

              <p>
                Are you sure you want to sign out?
              </p>
            </div>
            <div className="delete-modal-actions">
              <button
                className="delete-btn-cancel"
                onClick={() => setSignOutConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="delete-btn-confirm"
                onClick={() => {
                  setSignOutConfirm(false)
                  handleSignOut()
                }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div
          className="delete-modal-overlay"
          onClick={() => setDeleteConfirm(null)}
        >
          <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="delete-modal-title">
              Delete {deleteConfirm.type === 'template' ? 'template' : 'chat'}?
            </h3>
            <div className="delete-modal-body">
              <p>
                This will delete <strong>{deleteConfirm.title}</strong>.
              </p>
              <p>
                Visit <button
                  className="delete-modal-link"
                  onClick={() => {
                    setDeleteConfirm(null);
                    setShowSettingsInline(true);
                  }}
                >
                  settings
                </button> to delete any memories saved during this {deleteConfirm.type === 'template' ? 'template' : 'chat'}.
              </p>
            </div>
            <div className="delete-modal-actions">
              <button
                className="delete-btn-cancel"
                onClick={() => setDeleteConfirm(null)}
              >
                Cancel
              </button>
              <button
                className="delete-btn-confirm"
                onClick={() => {
                  if (onDeleteConversation) {
                    onDeleteConversation(deleteConfirm.id);
                  }
                  setDeleteConfirm(null);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
