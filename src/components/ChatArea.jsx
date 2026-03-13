import React, { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import { FiImage, FiFileText, FiMessageSquare, FiFileText as FiFileTextIcon, FiCopy, FiEdit2, FiPlus } from 'react-icons/fi'
import { LuAudioLines } from 'react-icons/lu'
import { RiSendPlaneFill } from 'react-icons/ri'
import { IoStopCircleOutline } from 'react-icons/io5'
import { deviceManager } from '../api/deviceManager'
import { ApiConfig } from '../api/ApiConfig'
import '../style/ChatArea.css'
import GoogleLoginButton from './GoogleLoginButton';

export default function ChatArea({
  mode = 'chat',
  onToggleMode,
  onChangeMode,
  conversation,
  onCreateConversation,
  onUpdateConversation,
  onStartNewConversation,
}) {
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedImages, setSelectedImages] = useState([])
  const [editingMessageId, setEditingMessageId] = useState(null)
  const [editingText, setEditingText] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const abortRef = useRef(null)
  const streamTimeoutRef = useRef(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const userStoppedRef = useRef(false)
  const imageInputRef = useRef(null)

  // Check authentication status on mount and set up listener
  useEffect(() => {
    const checkAuth = () => {
      const token = deviceManager.getAccessToken()
      setIsAuthenticated(!!token)
    }
    checkAuth()
    // Listen for storage changes to detect login
    window.addEventListener('storage', checkAuth)
    // Listen for custom login event
    window.addEventListener('userLoggedIn', checkAuth)
    return () => {
      window.removeEventListener('storage', checkAuth)
      window.removeEventListener('userLoggedIn', checkAuth)
    }
  }, [])

  const accessToken = deviceManager.getAccessToken();
  const refreshToken = deviceManager.getRefreshToken();

  console.log('Access Token:', accessToken);
  console.log('Refresh Token:', refreshToken);



 // ✅ Axios + Abort + Auth + Token Refresh + Streaming
async function callApiAndAppend(id, userText, retryAttempt = 0) {
  abortRef.current = new AbortController();
  const signal = abortRef.current.signal;
  setIsLoading(true);

  try {
    // --- Get valid access token ---
    let token = deviceManager.getAccessToken();
    if (!token) {
      console.log('No access token — generating new one...');
      await deviceManager.loginWithGoogle();
      token = deviceManager.getAccessToken();
    }

    // --- Make API request ---
    const res = await axios.post(
      `${ApiConfig.BASE_URL}/text/segment`,
      { prompt: userText },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`, // ✅ fixed variable name
          
        },
        signal,
      }
    );
    console
    // --- Parse response ---
    const json = res.data;
    let fullReply = '';

    if (json == null) fullReply = '';
    else if (json.response) fullReply = json.response;
    else if (typeof json === 'string') fullReply = json;
    else if (typeof json === 'object') {
      fullReply =
        json.text || json.result || json.message || JSON.stringify(json);
    } else fullReply = String(json);

    // --- Create a new message entry ---
    const messageId = Date.now().toString() + '_a';
    if (onUpdateConversation) {
      onUpdateConversation(id, (conv) => {
        const msgs = [
          ...(conv.messages || []),
          { id: messageId, role: 'assistant', text: '' },
        ];
        return { ...conv, messages: msgs };
      });
    }

    // --- Stream the text gradually and await completion ---
    let currentIndex = 0;
    await new Promise((resolve) => {
      const step = () => {
        // If aborted, stop streaming and resolve
        if (abortRef.current && abortRef.current.signal?.aborted) {
          if (streamTimeoutRef.current) {
            clearTimeout(streamTimeoutRef.current);
            streamTimeoutRef.current = null;
          }
          resolve();
          return;
        }

        if (currentIndex <= fullReply.length) {
          const currentText = fullReply.slice(0, currentIndex);
          if (onUpdateConversation) {
            onUpdateConversation(id, (conv) => {
              const msgs = conv.messages.map((m) =>
                m.id === messageId ? { ...m, text: currentText } : m
              );
              return { ...conv, messages: msgs };
            });
          }
          currentIndex++;
          streamTimeoutRef.current = setTimeout(step, 15);
        } else {
          // finished streaming
          if (streamTimeoutRef.current) {
            clearTimeout(streamTimeoutRef.current);
            streamTimeoutRef.current = null;
          }
          resolve();
        }
      };
      step();
    });

  } catch (err) {

    // --- Request aborted ---
    if (axios.isCancel(err) || err.name === 'CanceledError') {
      console.log('Request aborted by user.');
      // If the user explicitly pressed Stop, we already removed the partial message.
      // Only append a 'Stopped' indicator if this wasn't a user-initiated stop.
      if (!userStoppedRef.current) {
        if (onUpdateConversation) {
          onUpdateConversation(id, (conv) => ({
            ...conv,
            messages: [
              ...(conv.messages || []),
              { id: Date.now().toString() + '_a', role: 'assistant', text: 'Stopped' },
            ],
          }));
        }
      }
    }

    // --- Token expired or unauthorized ---
    // else if (
    //   err.response?.status === 500 ||
    //   err.response?.data?.error_code === 'TOKEN_EXPIRED' ||
    //   (err.response?.data?.message &&
    //     err.response.data.message.includes('TOKEN_EXPIRED'))
    // )
    else if (err.response.data.error_code === 'INVALID_TOKEN'){
      console.log('Access token expired — attempting refresh...');
      if (retryAttempt < 1) {
        try {
          const newToken = await deviceManager.refreshTokenAndGetNew();
          if (newToken) {
            console.log('Token refreshed — retrying request...');
            return callApiAndAppend(id, userText, retryAttempt + 1); // ✅ Retry once
          } else {
            console.error('Token refresh failed — cannot retry.');
          }
        } catch (refreshErr) {
          console.error('Error during token refresh:', refreshErr);
        }
      } else {
        console.error('Retry limit reached — giving up.');
      }
    }

    // --- Other API errors ---
    else {
    console.log('Error in callApiAndAppend status:', err.code);

      console.error('API error:', err);
      if (onUpdateConversation) {
        onUpdateConversation(id, (conv) => ({
          ...conv,
          messages: [
            ...(conv.messages || []),
            {
              id: Date.now().toString() + '_a',
              role: 'assistant',
              text: 'Error: could not fetch response',
            },
          ],
        }));
      }
    }
  } finally {
    setIsLoading(false);
    abortRef.current = null;
    // reset userStopped flag after the request finishes/aborts
    userStoppedRef.current = false;
  }
}


  async function handleSend() {
    const text = input.trim()
    if (!text) return
    if (isLoading) return // prevent double sends
    setInput('')

    if (!conversation) {
      const newId = onCreateConversation && onCreateConversation(mode, text)
      if (newId && onUpdateConversation) {
        await callApiAndAppend(newId, text)
      }
      return
    }

    const msg = { id: Date.now().toString(), role: 'user', text }
    if (onUpdateConversation) {
      onUpdateConversation(conversation.id, (conv) => {
        const msgs = [...(conv.messages || []), msg]
        const shouldSetTitle =
          !conv.title || conv.title === 'New chat' || (conv.messages || []).length === 0
        const newTitle = shouldSetTitle
          ? text.length > 60
            ? text.slice(0, 60) + '…'
            : text
          : conv.title
        return { ...conv, messages: msgs, title: newTitle }
      })

      await callApiAndAppend(conversation.id, text)
    }
  }

  function handleStop() {
    // Mark that the user requested stop so the API handler won't append "Stopped"
    userStoppedRef.current = true

    // Abort the API request / streaming and immediately re-enable the input
    if (abortRef.current) {
      try {
        abortRef.current.abort()
      } catch {
        // ignore
      }
    }
    if (streamTimeoutRef.current) {
      clearTimeout(streamTimeoutRef.current)
      streamTimeoutRef.current = null
    }

    // Immediately allow the user to send a new prompt and focus the input
    setIsLoading(false)
    setInput('')
    inputRef.current?.focus()
  }

  function handleImageSelect(event) {
    const files = event.target.files
    if (files) {
      Array.from(files).forEach((file) => {
        console.log('Image selected:', file.name, file.size, file.type)
        const reader = new FileReader()
        reader.onload = (e) => {
          setSelectedImages((prev) => [
            ...prev,
            {
              id: Date.now() + Math.random(),
              file,
              preview: e.target?.result,
            },
          ])
        }
        reader.readAsDataURL(file)
      })
    }
    // Reset the input so the same files can be selected again if needed
    if (imageInputRef.current) {
      imageInputRef.current.value = ''
    }
  }

  function handleRemoveImage(id) {
    setSelectedImages((prev) => prev.filter((img) => img.id !== id))
  }

  function handleCopyMessage(text) {
    navigator.clipboard.writeText(text).then(() => {
      // Optional: You can add a toast notification here
      console.log('Message copied to clipboard')
    }).catch(err => {
      console.error('Failed to copy:', err)
    })
  }

  function handleEditMessage(messageId, text) {
    setEditingMessageId(messageId)
    setEditingText(text)
  }

  function handleCancelEdit() {
    setEditingMessageId(null)
    setEditingText('')
  }

  function handleSaveEditAndResend() {
    if (!editingText.trim()) return
    
    handleCancelEdit()
    setInput('')
    
    // Resend the edited message
    if (conversation && onUpdateConversation) {
      const msg = { id: Date.now().toString(), role: 'user', text: editingText.trim() }
      onUpdateConversation(conversation.id, (conv) => {
        const msgs = [...(conv.messages || []), msg]
        return { ...conv, messages: msgs }
      })
      callApiAndAppend(conversation.id, editingText.trim())
    }
  }

  // Cleanup streaming on unmount
  useEffect(() => {
    return () => {
      if (streamTimeoutRef.current) {
        clearTimeout(streamTimeoutRef.current)
      }
    }
  }, [])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation?.messages])

  // Show sign-in screen if not authenticated
  if (!isAuthenticated) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', alignItems: 'center', gap: 20 }}>
        <div style={{ textAlign: 'center' }}>
          <h2>Welcome to LFL Chat</h2>
          <p style={{ fontSize: 16, color: '#666', marginBottom: 30 }}>
            Please sign in to access the chat
          </p>
          <GoogleLoginButton />
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        
        <nav className='chat-mode-btn nav-tabs icon-tabs' role="tablist" aria-label="Chat Mode Tabs">
          <div>
          <button
            role="tab"
            aria-selected={mode === 'chat'}
            className={`nav-tab ${mode === 'chat' ? 'active' : ''} icon-tab`}
            onClick={() => (typeof onChangeMode === 'function' ? onChangeMode('chat') : onToggleMode && onToggleMode())}
            title="Chat"
          >
            <span  className="tab-icon"><FiMessageSquare size={18} /></span>
            <span className="sr-only">Chat</span>
          </button>
          <button
            role="tab"
            aria-selected={mode === 'template'}
            className={`nav-tab ${mode === 'template' ? 'active' : ''} icon-tab`}
            onClick={() => (typeof onChangeMode === 'function' ? onChangeMode('template') : onToggleMode && onToggleMode())}
            title="Templates"
          >
            <span className="tab-icon"><FiFileTextIcon size={18} /></span>
            <span className="sr-only">Templates</span>
          </button>
          </div>
          <div className='new-chat-button-wrapper'>
            <button
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
              {mode === 'chat' ? (
                <>
                  <FiPlus size={14} />
                  New chat
                </>
              ) : (
                <>
                  <FiPlus size={14} />
                  New Document
                </>
              )}
            </button></div>
        </nav>



        {!conversation && (
          mode === 'chat' ? (
            <div style={{ padding: 20 }}>
              <h2>Welcome to LFL Chat</h2>
              <p className="read-the-docs">
                Start a new chat from the left or click New chat.
              </p>
              <button
                onClick={() => {
                  if (onStartNewConversation) {
                    onStartNewConversation('chat')
                  } else if (onCreateConversation) {
                    onCreateConversation('chat')
                  }
                }}
              >
                New chat
              </button>
            </div>
          ) : (
            <div style={{ padding: 20 }}>
              <h2>Create Legal Documents, Contracts, and Forms in Minutes</h2>
              <p className="read-the-docs">
              Create, customize, and manage legal paperwork effortlessly online.
              </p>
              <button
                onClick={() => {
                  if (onStartNewConversation) {
                    onStartNewConversation('template')
                  } else if (onCreateConversation) {
                    onCreateConversation('template')
                  }
                }}
              >
                New Document
              </button>
            </div>
          )
        )}

        <div className='chat-message-section' style={{ flex: 1, overflow: 'auto' }}>
          {/* {conversation ? <h3>{conversation.title}</h3> : null} */}
          <div className="messages">
            {(conversation && conversation.messages ? conversation.messages : []).map((m) => (
              <div
                key={m.id}
                className={`msg ${m.role === 'assistant' ? 'assistant' : 'user'}`}
              >
                <div className="msg-wrapper">
                  <div className="msg-body">{m.text}</div>
                  {m.role === 'assistant' && !isLoading && (
                    <button
                      className="msg-action-btn msg-copy-btn"
                      onClick={() => handleCopyMessage(m.text)}
                      title="Copy message"
                      aria-label="Copy message"
                    >
                      <FiCopy size={16} />
                    </button>
                  )}
                  {m.role === 'user' && (
                    <div className="msg-actions">
                      <button
                        className="msg-action-btn"
                        onClick={() => handleEditMessage(m.id, m.text)}
                        title="Edit message"
                        aria-label="Edit message"
                      >
                        <FiEdit2 size={16} />
                      </button>
                      <button
                        className="msg-action-btn"
                        onClick={() => handleCopyMessage(m.text)}
                        title="Copy message"
                        aria-label="Copy message"
                      >
                        <FiCopy size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Edit message modal */}
        {editingMessageId && (
          <div className="edit-modal-overlay" onClick={handleCancelEdit}>
            <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
              <h3>Edit Message</h3>
              <textarea
                className="edit-textarea"
                value={editingText}
                onChange={(e) => setEditingText(e.target.value)}
                autoFocus
              />
              <div className="edit-modal-actions">
                <button className="edit-btn-cancel" onClick={handleCancelEdit}>
                  Cancel
                </button>
                <button 
                  className="edit-btn-save" 
                  onClick={handleSaveEditAndResend}
                  disabled={!editingText.trim()}
                >
                  Send Edited
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* input area */}
      <div
        onClick={(e) => {
          try {
            const target = e.target;
            // if clicking a control (button/input/textarea/link), don't steal the click
            if (
              target.closest &&
              (target.closest('button') ||
                target.closest('input') ||
                target.closest('textarea') ||
                target.closest('a'))
            ) {
              return;
            }
          } catch {
            // defensive: if DOM methods aren't available, ignore
          }
          inputRef.current?.focus();
        }}
        style={{
          borderTop: '1px solid rgba(0,0,0,0.06)',
          display: 'flex',
          justifyContent: 'center',
          gap: 8,
          marginBottom: 15,
          padding: '10px 20vw',
          cursor: 'text',
        }}
      >
        <div className="input-container">
          {/* Selected images preview */}
          {selectedImages.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(45px, 1fr))',
              gap: 10,
              margin: '0 0 10px 0',
              padding: '10px 0',
            }}>
              {selectedImages.map((img) => (
                <div
                  key={img.id}
                  style={{
                    position: 'relative',
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    overflow: 'hidden',
                  }}
                >
                  <img
                    src={img.preview}
                    alt="selected"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                  <button
                    onClick={() => handleRemoveImage(img.id)}
                    style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      width: 15,
                      height: 15,
                      borderRadius: '50%',
                      backgroundColor: 'rgba(0, 0, 0, 0.6)',
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 8,
                      fontWeight: 'bold',
                    }}
                    title="Remove image"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          {/* Input field row */}
          <div className="input-wrapper">
            {/* Input field */}
            <input
              className="input-field"
              ref={inputRef}
              value={input}
              placeholder="Type a message..."
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              // disabled={isLoading}
            />
          </div>

          {/* Bottom row with attachment icons and send/stop button */}
          <div className="input-bottom-row">
            {/* Attachment icons on the left */}
            <div className="input-left-icons">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageSelect}
                style={{ display: 'none' }}
              />
              <button
                className="input-icon-btn"
                title="Add image"
                aria-label="Add image"
                onClick={() => imageInputRef.current?.click()}
              >
                <FiImage size={20} />
              </button>
              {/* <button
                className="input-icon-btn"
                title="Add audio"
                aria-label="Add audio"
                onClick={() => console.log('Add audio')}
              >
                <LuAudioLines size={20} />
              </button> */}
              <button
                className="input-icon-btn"
                title="Add document"
                aria-label="Add document"
                onClick={() => console.log('Add document')}
              >
                <FiFileText size={20} />
              </button>
            </div>

            {/* Send/Stop icons on the right */}
            <div className="input-right-icons">
              {!isLoading ? (
                <button
                  className="input-send-icon-btn"
                  onClick={handleSend}
                  title="Send message"
                  aria-label="Send message"
                  disabled={!input.trim()}
                >
                  <RiSendPlaneFill size={35} />
                </button>
              ) : (
                <button
                  className="input-stop-icon-btn"
                  onClick={handleStop}
                  title="Stop generation"
                  aria-label="Stop generation"
                >
                  <IoStopCircleOutline size={20} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}