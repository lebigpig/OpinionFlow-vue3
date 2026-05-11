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

export function saveAiAnswer({ filename, content }) {
  return request('/api/ai-answer/save', {
    method: 'POST',
    body: JSON.stringify({ filename, content }),
  })
}

export function listAiAnswers() {
  return request('/api/ai-answer/list')
}

export async function readAiAnswer(filename) {
  const resp = await fetch(`/api/ai-answer/read/${encodeURIComponent(filename)}`, {
    headers: { 'Accept': 'text/plain' },
  })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(text || `HTTP ${resp.status}`)
  }
  return await resp.text()
}
