/**
 * AI Chat Widget Component
 *
 * Floating chat button that opens a chat panel for asking questions
 * about the current data being viewed.
 */

import { useState, useEffect } from 'react'
import { sendChat, getSummary, getRegions, getSchools } from '../../lib/api'

/**
 * Simple markdown renderer for chat messages.
 * Handles: bullet points, bold, line breaks, numbered lists.
 */
function renderMarkdown(text) {
  const lines = text.split('\n')
  const elements = []
  let inList = false
  let listItems = []

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={elements.length} className="list-disc list-inside space-y-1 my-1">
          {listItems}
        </ul>
      )
      listItems = []
    }
  }

  const processLine = (line, key) => {
    // Process inline formatting: **bold** and `code`
    let processed = line
    processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    processed = processed.replace(/`(.*?)`/g, '<code class="bg-slate-200 px-1 rounded text-xs">$1</code>')
    return <span key={key} dangerouslySetInnerHTML={{ __html: processed }} />
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Bullet list item
    if (line.match(/^[\-\*]\s+/)) {
      if (!inList) {
        flushList()
        inList = true
      }
      listItems.push(
        <li key={`li-${i}`} className="text-sm">
          {processLine(line.replace(/^[\-\*]\s+/, ''), `li-text-${i}`)}
        </li>
      )
    }
    // Numbered list item
    else if (line.match(/^\d+\.\s+/)) {
      if (!inList) {
        flushList()
        inList = true
      }
      listItems.push(
        <li key={`li-${i}`} className="text-sm" value={parseInt(line)}>
          {processLine(line.replace(/^\d+\.\s+/, ''), `li-text-${i}`)}
        </li>
      )
    }
    // Empty line
    else if (line.trim() === '') {
      if (inList) {
        flushList()
        inList = false
      }
      elements.push(<br key={`br-${i}`} />)
    }
    // Regular paragraph
    else {
      if (inList) {
        flushList()
        inList = false
      }
      elements.push(
        <p key={`p-${i}`} className="text-sm">
          {processLine(line, `p-text-${i}`)}
        </p>
      )
    }
  }

  flushList()
  return <div className="space-y-1">{elements}</div>
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [dataContext, setDataContext] = useState(null)

  // Fetch all data when chat opens
  useEffect(() => {
    if (isOpen && !dataContext) {
      Promise.all([getSummary(), getRegions(), getSchools()])
        .then(([summary, regions, schools]) => {
          setDataContext({
            summary,
            regions: regions.map(r => ({
              name: r.region,
              gap_score: Math.round((r.gap_score || 0) * 100),
              gap_level: r.gap_level,
              total_teachers: r.total_teachers,
              trained_teachers: r.trained_teachers,
              training_coverage_pct: r.training_coverage_pct
            })),
            top_schools: schools.slice(0, 20).map(s => ({
              name: s.school_name,
              region: s.region,
              city: s.city,
              total_teachers: s.total_teachers,
              training_coverage_pct: s.training_coverage_pct,
              priority_level: s.priority_level
            }))
          })
        })
        .catch(() => setDataContext({}))
    }
  }, [isOpen, dataContext])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setLoading(true)

    try {
      const data = await sendChat(userMessage, { summary: dataContext })
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${err.message || 'Failed to get response'}`
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Floating chat button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all z-50"
        aria-label="Open chat"
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 max-w-[calc(100vw-3rem)] bg-white rounded-2xl shadow-2xl flex flex-col z-50 border border-slate-200">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">STAR Assistant</h3>
              <p className="text-xs text-slate-500">
                {dataContext ? `${dataContext.total_teachers?.toLocaleString()} teachers in system` : 'Loading data...'}
              </p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-80">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-slate-500">
                  Ask questions about the STAR data.
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Try: "Which regions need the most training?"
                </p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {msg.role === 'user' ? msg.content : renderMarkdown(msg.content)}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 px-3 py-2 rounded-lg">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-3 border-t border-slate-200 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question..."
              className="flex-1 input text-sm"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="btn-primary px-4 text-sm disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  )
}