// opinionflow-vue/src/lib/api.js
import { IS_MICROSERVICE, PROXY_TARGET } from '../config.js'

const BASE = '';

// 控制台输出当前运行模式，方便调试
console.info(
  `[OpinionFlow] 运行模式：${IS_MICROSERVICE ? '微服务（OpinionFlow-Cloud）' : '单体'} | 代理目标：${PROXY_TARGET}`
)

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
    const err = new Error(msg)
    err.status = resp.status
    throw err
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
  return request(`/api/news?page=${page}&size=${size}${qs({ start, end, q })}`)
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

export function listGeneralIds({ start, end, q, limit } = {}) {
  return request(`/api/news/general/ids?dummy=1${qs({ start, end, q, limit })}`)
}

export function listYahooIds({ start, end, q, limit } = {}) {
  return request(`/api/news/yahoo/ids?dummy=1${qs({ start, end, q, limit })}`)
}

export function listGeneralAll({ start, end, q } = {}) {
  return request(`/api/news?page=0&size=5000${qs({ start, end, q })}`)
}

export function listYahooAll({ start, end, q } = {}) {
  return request(`/api/yahoo/news?page=0&size=5000${qs({ start, end, q })}`)
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

// 世界格局地图智能 Agent：独立地址，解析自然语言指令为结构化 JSON
export function worldMapAgent(content, systemPrompt) {
  return request('/api/ai/world-map-agent', {
    method: 'POST',
    body: JSON.stringify({ content, systemPrompt }),
  })
}

// ── 国家宏观指标（country_macro_indicators，点击国家弹出表单） ──────
export function fetchCountryMacroLatest(country) {
  return request(`/api/country-macro-indicators/latest?country=${encodeURIComponent(country)}`)
}

export function fetchCountryMacroByCountry(country) {
  return request(`/api/country-macro-indicators/by-country?country=${encodeURIComponent(country)}`)
}

export function fetchCountryMacroByYear(country, year) {
  return request(`/api/country-macro-indicators/by-year?country=${encodeURIComponent(country)}&year=${encodeURIComponent(year)}`)
}

export function fetchCountryMacroCountries() {
  return request('/api/country-macro-indicators/countries')
}

export function updateCountryMacro(id, data) {
  return request(`/api/country-macro-indicators/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

// ── 中国企业财报（company_china 库，微服务 opinionflow-company） ──
export function fetchCompanyList({ keyword, industry, page = 0, size = 20, sortBy, sortDir } = {}) {
  return request(`/api/company/list?page=${page}&size=${size}${qs({ keyword, industry, sortBy, sortDir })}`)
}

/** 全部所属行业（去重、升序，供前端下拉框选择） */
export function fetchCompanyIndustries() {
  return request('/api/company/industries')
}

export function fetchCompanyDetail(id) {
  return request(`/api/company/${id}/detail`)
}

/** 某份财报的各表明细（后端三表 UNION 连接查询） */
export function fetchCompanyReportDetail(reportId) {
  return request(`/api/company/reports/${reportId}/detail`)
}

export function fetchCompanyReports(id, { fiscalYear } = {}) {
  const y = fiscalYear === null || fiscalYear === undefined || fiscalYear === '' ? '' : fiscalYear
  const q = y === '' ? '' : `?fiscalYear=${encodeURIComponent(y)}`
  return request(`/api/company/${id}/reports${q}`)
}

export function fetchCompanyIncome(reportId) {
  return request(`/api/company/reports/${reportId}/income`)
}

export function fetchCompanyBalance(reportId) {
  return request(`/api/company/reports/${reportId}/balance`)
}

export function fetchCompanyCashFlow(reportId) {
  return request(`/api/company/reports/${reportId}/cashflow`)
}

export function fetchCompanyIndicators(reportId) {
  return request(`/api/company/reports/${reportId}/indicators`)
}

/** 某指标的历史走势：该指标在所有财报（各季度/年度）中的本期值、上期值、同比（时间升序） */
export function fetchCompanyIndicatorHistory(companyId, indicatorCode) {
  return request(`/api/company/${companyId}/indicators/${encodeURIComponent(indicatorCode)}/history`)
}

/**
 * 同行业公司横向对比：同一指标 + 同一财年/季度下同行业所有公司的指标值（按值降序）
 * @param {string} indicatorCode 指标编码
 * @param {{industry?: string, fiscalYear: number|string, fiscalPeriod: string}} opts
 */
export function fetchCompanyPeerCompare(indicatorCode, { industry, fiscalYear, fiscalPeriod } = {}) {
  const y = encodeURIComponent(fiscalYear ?? '')
  const p = encodeURIComponent(fiscalPeriod ?? '')
  return request(
    `/api/company/indicators/${encodeURIComponent(indicatorCode)}/peer-compare?fiscalYear=${y}&fiscalPeriod=${p}${qs({ industry })}`,
  )
}

/**
 * 同行业「某一科目」横向对比（利润表 / 资产负债表 / 现金流量表）
 * @param {'income'|'balance'|'cashflow'} tableType
 * @param {string} itemName 科目名称
 * @param {{industry?: string, fiscalYear: number|string, fiscalPeriod: string}} opts
 */
export function fetchCompanyStatementPeerCompare(tableType, itemName, { industry, fiscalYear, fiscalPeriod } = {}) {
  const y = encodeURIComponent(fiscalYear ?? '')
  const p = encodeURIComponent(fiscalPeriod ?? '')
  return request(
    `/api/company/statements/${encodeURIComponent(tableType)}/peer-compare?itemName=${encodeURIComponent(itemName ?? '')}&fiscalYear=${y}&fiscalPeriod=${p}${qs({ industry })}`,
  )
}

/** 利润表/资产负债表/现金流量表某一科目的历史走势（tableType: income | balance | cashflow） */
export function fetchCompanyStatementHistory(companyId, tableType, itemName) {
  return request(
    `/api/company/${companyId}/statements/${tableType}/history?itemName=${encodeURIComponent(itemName)}`,
  )
}

// ── 地图标记 CRUD（map_markers） ─────────────────────────────────
export function saveMapMarker(data) {
  return request('/api/map-markers', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateMapMarker(id, data) {
  return request(`/api/map-markers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function listMapMarkers() {
  return request('/api/map-markers')
}

export function getMapMarker(id) {
  return request(`/api/map-markers/${id}`)
}

export function deleteMapMarker(id) {
  return request(`/api/map-markers/${id}`, { method: 'DELETE' })
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
  const resp = await fetch('/api/scripts/run-stream', {
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

export function listEchartPage(page = 0, size = 20) {
  return request(`/api/echart/page?page=${page}&size=${size}`)
}

export function readEchartFile(filename) {
  return request(`/api/echart/read/${encodeURIComponent(filename)}`)
}

export function getEchartDetail(id) {
  return request(`/api/echart/${id}`)
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

export async function chatMemoryStream(content, { sessionId, systemPrompt, selectedContent, webSearch, onDelta } = {}) {
  const resp = await fetch('/api/chat-memory/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    },
    body: JSON.stringify({ sessionId: sessionId || 'default', content, systemPrompt, selectedContent, webSearch: !!webSearch }),
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

// ── 模块化组件兼容别名 ──
// 以下为各面板组件提供的具名导出，方便直接按模块导入

// 综合新闻
export const fetchGeneralNewsList = listGeneral
export const fetchGeneralNewsDetail = getNewsDetail
export const aiParseGeneralNews = aiParse
export const aiParseGeneralNewsStream = aiParseStream

// 深度求索
export const fetchDeepseekNewsList = listDeepseekMenu
export const fetchDeepseekNewsDetail = getNewsDetail
export const aiParseDeepseekNews = aiParse
export const aiParseDeepseekNewsStream = aiParseStream

// 财经新闻
export const fetchFinanceNewsList = listFinance
export const fetchFinanceNewsDetail = getFinanceDetail
export const aiParseFinanceNews = aiParse
export const aiParseFinanceNewsStream = aiParseStream

// 雅虎财经
export const fetchYahooNewsList = listYahooFinanceNews
export const fetchYahooNewsDetail = getNewsDetail
export const aiParseYahooNews = aiParse
export const aiParseYahooNewsStream = aiParseStream

// 纽约时报
export const fetchNytNewsList = listNewYorkTimesNews
export const fetchNytNewsDetail = getNewsDetail
export const aiParseNytNews = aiParse
export const aiParseNytNewsStream = aiParseStream

// 个股舆情
export const fetchStockComments = (params = {}) => {
  const { keyword, intervalDays, page = 0, size = 100 } = params
  return request(`/api/comments?keyword=${encodeURIComponent(keyword || '')}&intervalDays=${intervalDays || ''}&page=${page}&size=${size}`)
}

export const fetchStockCommentDetail = getStockCommentDetail

// ── 详情 / AI / Echart / Chat 别名 ──

export const fetchDetail = (id) => getNewsDetail(id)
export const aiAnalyzeStream = async ({ messages, onEvent } = {}) => {
  const content = messages?.map(m => m.content).join('\n') || ''
  await aiParseStream(content, { onDelta: (d) => onEvent?.('delta', d) })
  return {}
}
export const aiAnalyzeIndustryStream = async ({ selectedTexts, filename, onEvent } = {}) => {
  await aiParseStream(selectedTexts, { onDelta: (d) => onEvent?.('delta', d) })
  return {}
}
export const fetchEchartPage = listEchartPage
export const fetchEchartDetail = async (id) => {
  const resp = await request(`/api/echart/detail/${id}`)
  if (resp?.jsonText) {
    try { resp.jsonData = JSON.parse(resp.jsonText) } catch {}
  }
  return resp
}
export const aiCustomAnalyzeStream = async ({ prompt, selectedTexts, sessionId, onEvent } = {}) => {
  const content = `${prompt}\n\n${selectedTexts || ''}`
  await chatMemoryStream(content, {
    sessionId,
    selectedContent: selectedTexts,
    onDelta: (d) => onEvent?.('delta', d),
  })
  return { sessionId }
}
export const aiChatHistory = () => listChatSessions()
export const aiChatMessages = (sessionId) => chatMemoryHistory(sessionId)
export const aiChatSendStream = async ({ sessionId, message, onEvent } = {}) => {
  await chatMemoryStream(message, {
    sessionId,
    onDelta: (d) => onEvent?.('delta', d),
  })
}
export const aiChatClearMemory = (sessionId) => chatMemoryClear(sessionId)
export const aiChatDeleteSession = (sessionId) => deleteChatSession(sessionId)

/* global __TAVILY_API_KEY__ */

// ────────── 保存搜索结果到数据库 ──────────
export function saveSearchResults(items) {
  return request('/api/search-results/save', {
    method: 'POST',
    body: JSON.stringify(items),
  })
}

// ────────── Tavily 搜索（直连官方 API） ──────────
export async function tavilySearch(params) {
  const resp = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: __TAVILY_API_KEY__,
      query: params.query,
      topic: params.topic || 'news',
      search_depth: params.searchDepth || params.search_depth || 'basic',
      include_answer: params.includeAnswer || params.include_answer || 'basic',
      max_results: params.maxResults || params.max_results || 10,
      include_images: (params.includeImages || params.include_images) ?? true,
      include_image_descriptions: (params.includeImageDescriptions) ?? true,
      include_favicon: (params.includeFavicon) ?? true,
      time_range: params.timeRange || params.time_range || '',
    }),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(text || `HTTP ${resp.status}`)
  }

  return resp.json()
}

