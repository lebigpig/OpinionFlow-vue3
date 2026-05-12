// opinionflow-vue/src/lib/api.js
const BASE = '';

async function request(path, init) {
  const resp = await fetch(BASE + path, {
    headers: {
      'Content-Type': 'application/json',
      ...(init && init.headers ? init.headers : {}),
    },
    ...init,
  })

  const text = await resp.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    // ignore
  }

  if (!resp.ok) {
    const msg = (json && (json.message || json.error)) || text || `HTTP ${resp.status}`
    throw new Error(msg)
  }

  return json
}

function qs(params) {
  const s = Object.entries(params)
    .filter(([, v]) => v !== null && v !== undefined && String(v).length > 0)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')
  return s ? `&${s}` : ''
}

export function listGeneral(page = 0, size = 50, { start, end, q } = {}) {
  return request(`/api/news/general?page=${page}&size=${size}${qs({ start, end, q })}`)
}

export function listDeepseekMenu(page = 0, size = 50, { start, end, q } = {}) {
  return request(`/api/news/deepseek-menu?page=${page}&size=${size}${qs({ start, end, q })}`)
}

export function listFinance(page = 0, size = 50, { start, end, q } = {}) {
  return request(`/api/news/finance?page=${page}&size=${size}${qs({ start, end, q })}`)
}

export function listFinanceIds({ start, end, q, limit } = {}) {
  return request(`/api/news/finance/ids?dummy=1${qs({ start, end, q, limit })}`)
}

export function listStockComments(page = 0, size = 50, { start, end, q } = {}) {
  return request(`/api/comments?page=${page}&size=${size}${qs({ start, end, q })}`)
}

export function listYahooFinanceNews(page = 0, size = 50, { start, end, q } = {}) {
  return request(`/api/yahoo/news?page=${page}&size=${size}${qs({ start, end, q })}`)
}

export function listNewYorkTimesNews(page = 0, size = 50, { start, end, q } = {}) {
  return request(`/api/nytimes/news?page=${page}&size=${size}${qs({ start, end, q })}`)
}

export function getStockCommentDetail(id) {
  return request(`/api/comments/${id}`)
}

export function getNewsDetail(id) {
  return request(`/api/news/${id}`)
}

export function getFinanceDetail(id) {
  return request(`/api/news/finance/${id}`)
}

export function aiParse(content) {
  return request('/api/ai/parse', {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
}

export async function aiParseStream(content, { onDelta, systemPrompt } = {}) {
  const resp = await fetch('/api/ai/parse/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    },
    body: JSON.stringify({ content, systemPrompt }),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(text || `HTTP ${resp.status}`)
  }
  if (!resp.body) {
    throw new Error('浏览器不支持流式响应')
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buf = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })

    // SSE: event/data blocks separated by blank line
    const parts = buf.split('\n\n')
    buf = parts.pop() || ''
    for (const block of parts) {
      const lines = block.split('\n')
      for (const line of lines) {
        if (line.startsWith('data:')) {
          const data = line.slice(5).trimStart()
          if (data) onDelta?.(data)
        }
      }
    }
  }
}

export function saveEchartJson({ filename, jsonText }) {
  return request('/api/echart/save', {
    method: 'POST',
    body: JSON.stringify({ filename, jsonText }),
  })
}

export function runScript(key, payload = {}) {
  return request('/api/scripts/run', {
    method: 'POST',
    body: JSON.stringify({ key, ...payload }),
  })
}

export async function runScriptStream(key, { code, onEvent } = {}) {
  const resp = await fetch('/api/scripts/run/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    },
    body: JSON.stringify({ key, code }),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(text || `HTTP ${resp.status}`)
  }
  if (!resp.body) {
    throw new Error('浏览器不支持流式响应')
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buf = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })

    const parts = buf.split('\n\n')
    buf = parts.pop() || ''
    for (const block of parts) {
      const lines = block.split('\n')
      let eventName = 'message'
      const dataLines = []
      for (const line of lines) {
        if (line.startsWith('event:')) eventName = line.slice(6).trim()
        if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
      }
      const data = dataLines.join('\n')
      if (data) onEvent?.(eventName, data)
    }
  }
}

export async function runAllScriptsStream({ code, onEvent } = {}) {
  const resp = await fetch('/api/scripts/run-all/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    },
    body: JSON.stringify({ code }),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(text || `HTTP ${resp.status}`)
  }
  if (!resp.body) {
    throw new Error('浏览器不支持流式响应')
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buf = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })

    const parts = buf.split('\n\n')
    buf = parts.pop() || ''
    for (const block of parts) {
      const lines = block.split('\n')
      let eventName = 'message'
      const dataLines = []
      for (const line of lines) {
        if (line.startsWith('event:')) eventName = line.slice(6).trim()
        if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
      }
      const data = dataLines.join('\n')
      if (data) onEvent?.(eventName, data)
    }
  }
}

// ── Echart 历史文件 (public/echart/) ──

export function listEchartFiles() {
  return request('/api/echart/list')
}

export function readEchartFile(filename) {
  return request(`/api/echart/read/${encodeURIComponent(filename)}`)
}

// ── 记忆化对话 (MySQL + Redis 永久化) ──

/**
 * 获取所有 session 的摘要列表（前端 AI 分析菜单打开时调用）
 */
export function listChatSessions() {
  return request('/api/chat-memory/sessions')
}

/**
 * 创建新会话（runAiCustom 对应），返回 { sessionId }
 */
export function createNewSession() {
  return request('/api/chat-memory/new-session', { method: 'POST' })
}

export async function chatMemoryStream(content, { sessionId, systemPrompt, selectedContent, onDelta } = {}) {
  const resp = await fetch('/api/chat-memory/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    },
    body: JSON.stringify({ sessionId: sessionId || 'default', content, systemPrompt, selectedContent }),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(text || `HTTP ${resp.status}`)
  }
  if (!resp.body) {
    throw new Error('浏览器不支持流式响应')
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buf = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })

    const parts = buf.split('\n\n')
    buf = parts.pop() || ''
    for (const block of parts) {
      const lines = block.split('\n')
      let eventName = 'message'
      const dataLines = []
      for (const line of lines) {
        if (line.startsWith('event:')) eventName = line.slice(6).trim()
        if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
      }
      const data = dataLines.join('\n')
      if (eventName === 'delta' && data) {
        // 反转义后端转义的特殊字符
        const decoded = data.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\\\/g, '\\')
        onDelta?.(decoded)
      }
    }
  }
}

export function chatMemoryHistory(sessionId = 'default') {
  return request(`/api/chat-memory/history?sessionId=${encodeURIComponent(sessionId)}`)
}

export function chatMemoryClear(sessionId = 'default') {
  return request('/api/chat-memory/clear', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  })
}

/**
 * 删除指定 session 的所有对话记录（从 MySQL chat_history 表中永久删除）
 */
export function deleteChatSession(sessionId) {
  return request(`/api/chat-memory/session/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
  })
}

