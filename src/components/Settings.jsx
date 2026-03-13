import React, { useState, useEffect } from 'react'
import { FiCheck, FiEdit2, FiX } from 'react-icons/fi'
import '../style/Settings.css'

const MODELS = [
  { value: 'OpenAI', label: 'OpenAI' },
  { value: 'WorkiyLLM', label: 'WorkiyLLM' },
]

export default function Settings({ settings, onChange, onClose, inline = false }) {
  const [isEditingEmail, setIsEditingEmail] = useState(false)
  const [emailValue, setEmailValue] = useState('')

  useEffect(() => {
    // Load email from localStorage on component mount
    const savedEmail = localStorage.getItem('userEmail')
    if (savedEmail) {
      setEmailValue(savedEmail)
      if (settings && !settings.email) {
        onChange({ email: savedEmail })
      }
    } else if (settings?.email) {
      setEmailValue(settings.email)
    }
  }, [])

  const handleEmailSave = () => {
    localStorage.setItem('userEmail', emailValue)
    onChange({ email: emailValue })
    setIsEditingEmail(false)
  }

  if (!settings) return null

  // When rendered inline inside the sidebar, avoid overlay/modal attributes
  const PanelWrapper = ({ children }) =>
    inline ? (
      <div className="settings-panel-inline inline">{children}</div>
    ) : (
      <div className="settings-overlay">
        <div className="settings-panel" role="dialog" aria-modal="true">
          {children}
        </div>
      </div>
    )

  return (
    <PanelWrapper>


        {/* Email Setting */}
        <div className="settings-item settings-item-inline">
          <div className="settings-item-header">
            <span className="settings-label">Email</span>
           
          </div>
          {isEditingEmail ? (
            <div className={"settings-item-edit" + (inline ? ' inline' : '')}>
              <input
                type="email"
                value={emailValue}
                onChange={(e) => setEmailValue(e.target.value)}
                placeholder="you@example.com"
                autoFocus
              />
              {inline ? (
                <div className="settings-item-edit-actions">
                  <button
                    className="save-btn"
                    onClick={handleEmailSave}
                    title="Save email"
                  >
                    <FiCheck size={16} />
                  </button>
                  <button
                    className="close-icon-btn"
                    onClick={() => setIsEditingEmail(false)}
                    title="Cancel"
                  >
                    <FiX size={16} />
                  </button>
                </div>
              ) : (
                <>
                  <button
                    className="save-btn"
                    onClick={handleEmailSave}
                    title="Save email"
                  >
                    <FiCheck size={16} />
                  </button>
                  <button
                    className="close-icon-btn"
                    onClick={() => setIsEditingEmail(false)}
                    title="Cancel"
                  >
                    <FiX size={16} />
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="settings-item-value">
              {emailValue || 'No email set'}
            </div>
          )}
           {!isEditingEmail && (
              <button
                className="edit-btn"
                onClick={() => setIsEditingEmail(true)}
                title="Edit email"
              >
                <FiEdit2 size={16} />
              </button>
            )}
        </div>

        {/* Dark Theme Setting */}
        <div className="settings-item settings-item-inline">
          <span className="settings-label">Dark Theme</span>
          <div className="toggle-switch">
            <input
              type="checkbox"
              id="dark-theme"
              checked={!!settings.dark}
              onChange={(e) => onChange({ dark: e.target.checked })}
            />
            <label htmlFor="dark-theme" className="toggle-label"></label>
            <span className="toggle-status">
              {settings.dark ? 'On' : 'Off'}
            </span>
          </div>
        </div>

        {/* Model Setting */}
        <div className="settings-item settings-item-inline">
          <span className="settings-label">Model</span>
          <select
            className="settings-select"
            value={settings.model}
            onChange={(e) => onChange({ model: e.target.value })}
          >
            {MODELS.map((m) => (
              <option    className="settings-select-menu" key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Only show the Close button when rendered as a modal (not inline) */}
        {!inline && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <button className="close-btn" onClick={onClose}>Close</button>
          </div>
        )}
    </PanelWrapper>
  )
}
