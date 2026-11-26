import { useState, useEffect, useRef } from 'react'
import './App.css'

interface Message {
  message_id: string
  role: 'user' | 'assistant'
  content: string
  liked?: boolean | null
  created_at: string
}

interface ChatResponse {
  session_id: string
  user_message: Message
  ai_message: Message
}

interface PipelineStats {
  total_runs: number
  successful: number
  failed: number
  total_samples_generated: number
}

function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [pipelineStats, setPipelineStats] = useState<PipelineStats | null>(null)
  const [dislikedCount, setDislikedCount] = useState(0)
  const [pipelineRunning, setPipelineRunning] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    fetchPipelineStats()
    fetchDislikedCount()
  }, [])

  const fetchPipelineStats = async () => {
    try {
      const res = await fetch('/pipeline1/stats')
      const data = await res.json()
      setPipelineStats(data)
    } catch (err) {
      console.error('Failed to fetch pipeline stats:', err)
    }
  }

  const fetchDislikedCount = async () => {
    try {
      const res = await fetch('/chatbot/sample-data?limit=100')
      const data = await res.json()
      setDislikedCount(data.total || 0)
    } catch (err) {
      console.error('Failed to fetch disliked count:', err)
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userMessage = input
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/chatbot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userMessage,
          session_id: sessionId
        })
      })

      const data: ChatResponse = await res.json()

      if (!sessionId) {
        setSessionId(data.session_id)
      }

      setMessages(prev => [...prev, data.user_message, data.ai_message])
    } catch (err) {
      console.error('Failed to send message:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleFeedback = async (messageId: string, liked: boolean) => {
    try {
      await fetch('/chatbot/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: messageId, liked })
      })

      setMessages(prev => prev.map(msg =>
        msg.message_id === messageId ? { ...msg, liked } : msg
      ))

      if (!liked) {
        setDislikedCount(prev => prev + 1)
      }
    } catch (err) {
      console.error('Failed to send feedback:', err)
    }
  }

  const runPipeline = async () => {
    if (dislikedCount === 0 || pipelineRunning) return

    setPipelineRunning(true)

    try {
      const trainingRes = await fetch('/chatbot/generate-training-data', {
        method: 'POST'
      })
      const trainingData = await trainingRes.json()

      const pipelineRes = await fetch('/pipeline1/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversations_text: trainingData.formatted_text,
          batch_id: `batch-${Date.now()}`
        })
      })

      const result = await pipelineRes.json()

      if (result.status === 'success' && result.csv_path) {
        await fetch('/pipeline2/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            csv_path: result.csv_path,
            batch_id: result.batch_id
          })
        })
      }

      await fetchPipelineStats()
      await fetchDislikedCount()
    } catch (err) {
      console.error('Pipeline failed:', err)
    } finally {
      setPipelineRunning(false)
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1 className="logo">AutoTune AI</h1>
        <div className="header-actions">
          <button className="header-btn">Stats</button>
          <button className="header-btn">Settings</button>
        </div>
      </header>

      <div className="main-container">
        <div className="chat-panel">
          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="empty-state">
                <h2>Start a conversation</h2>
                <p>Chat with Qwen 2.5 (1.5B) - a deliberately weak model that improves through your feedback.</p>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.message_id} className={`message ${msg.role}`}>
                <div className="message-content">{msg.content}</div>
                {msg.role === 'assistant' && (
                  <div className="message-actions">
                    <button
                      className={`feedback-btn ${msg.liked === true ? 'active' : ''}`}
                      onClick={() => handleFeedback(msg.message_id, true)}
                      title="Good response"
                    >
                      👍
                    </button>
                    <button
                      className={`feedback-btn ${msg.liked === false ? 'active' : ''}`}
                      onClick={() => handleFeedback(msg.message_id, false)}
                      title="Bad response - will be used for training"
                    >
                      👎
                    </button>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-container">
            <input
              type="text"
              className="chat-input"
              placeholder="Type a message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              disabled={loading}
            />
            <button
              className="send-btn"
              onClick={sendMessage}
              disabled={loading || !input.trim()}
            >
              {loading ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>

        <div className="pipeline-panel">
          <div className="panel-section">
            <h3 className="panel-title">Training Pipeline</h3>

            <div className="pipeline-status">
              <div className="status-indicator">
                <span className={`status-dot ${pipelineRunning ? 'running' : 'idle'}`}></span>
                <span className="status-text">
                  {pipelineRunning ? 'Running' : 'Ready'}
                </span>
              </div>
            </div>

            <div className="stat-row">
              <span className="stat-label">Disliked messages</span>
              <span className="stat-value">{dislikedCount}</span>
            </div>

            <button
              className="pipeline-btn"
              onClick={runPipeline}
              disabled={dislikedCount === 0 || pipelineRunning}
            >
              {pipelineRunning ? 'Running Pipeline...' : 'Generate Training Data'}
            </button>

            <div className="pipeline-info">
              <p>Dislike responses to collect training data. The pipeline will:</p>
              <ol>
                <li>Analyze failed conversations</li>
                <li>Search the web for answers</li>
                <li>Generate Q&A training samples</li>
                <li>Store in vector database</li>
              </ol>
            </div>
          </div>

          <div className="panel-section">
            <h3 className="panel-title">Pipeline Stats</h3>

            {pipelineStats ? (
              <div className="stats-grid">
                <div className="stat-item">
                  <div className="stat-number">{pipelineStats.total_runs}</div>
                  <div className="stat-name">Total Runs</div>
                </div>
                <div className="stat-item">
                  <div className="stat-number">{pipelineStats.successful}</div>
                  <div className="stat-name">Successful</div>
                </div>
                <div className="stat-item">
                  <div className="stat-number">{pipelineStats.total_samples_generated}</div>
                  <div className="stat-name">Training Samples</div>
                </div>
              </div>
            ) : (
              <p className="loading-text">Loading stats...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
