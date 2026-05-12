<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import { aiParseStream, getFinanceDetail, getNewsDetail, listDeepseekMenu, listFinance, listFinanceIds, listGeneral, listStockComments, getStockCommentDetail, listYahooFinanceNews, listNewYorkTimesNews, saveEchartJson, runScriptStream, runAllScriptsStream, chatMemoryStream, chatMemoryHistory, chatMemoryClear, listChatSessions, createNewSession, deleteChatSession, listEchartFiles, readEchartFile } from './lib/api'

function htmlToPlainText(input) {
  const s = String(input ?? '')
  if (!s) return ''
  // 快速判断：没出现标签特征就直接返回
  if (!/[<>]/.test(s)) return s

  // 将常见换行标签先转换成 \n，避免被直接吞掉
  const withNewlines = s
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/p\s*>/gi, '\n')
    .replace(/<\s*p(\s+[^>]*)?>/gi, '')
    .replace(/<\s*\/div\s*>/gi, '\n')
    .replace(/<\s*div(\s+[^>]*)?>/gi, '')

  // 用 DOM 解码实体并剥离标签
  const el = document.createElement('div')
  el.innerHTML = withNewlines
  const text = (el.textContent || el.innerText || '').replace(/\u00a0/g, ' ')
  // 归一化空行
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const menuGroups = [
  {
    key: 'news',
    name: '新闻',
    children: [
      { key: 'general', name: '网易新闻列表' },
      { key: 'yahoo', name: '雅虎新闻' },
      { key: 'nytimes', name: '纽约时报新闻' },
      { key: 'deepseek', name: 'DeepSeek 专区' },
    ],
  },
  {
    key: 'realtime',
    name: '实时',
    children: [
      { key: 'finance', name: '实时财经新闻' },
    ],
  },
  {
    key: 'analysis',
    name: '分析',
    children: [
      { key: 'industry', name: '词云分析' },
      { key: 'ai_custom', name: 'AI分析' },
      { key: 'comments', name: '评论分析' },
    ],
  },
  {
    key: 'scripts',
    name: '脚本运行',
    children: [
      { key: 'script_all', name: '全部运行' },
      { key: 'script_comments', name: '评论爬取' },
      { key: 'script_news', name: '新闻爬取' },
      { key: 'script_realtime', name: '实时爬取' },
    ],
  }
]

const activeMenu = ref('general')
const isDark = ref(localStorage.getItem('theme') === 'dark')

function toggleTheme() {
  isDark.value = !isDark.value
}

const loadingList = ref(false)
const listError = ref('')
const items = ref([])
const total = ref(0)
const page = ref(1) // Element Plus: 1-based
const pageSize = ref(50)
const timeRange = ref(null) // [start, end] as string (yyyy-MM-dd HH:mm:ss)
const keyword = ref('')
const financeAllSelectLoading = ref(false)
const financeAllSelectError = ref('')

// 仅 general/finance 支持勾选；跨分页、跨菜单保留
const selectedMap = ref({}) // key: `${source}:${id}` -> true
// yahoo 选中项需要保存完整数据（跨菜单/分页也能用于词云分析拼包）
const yahooSelectedData = ref({}) // id(string) -> { title, displayTime, summary }
// nytimes 选中项：样式/交互与 yahoo 一致（预留后续分析拼包）
const nytimesSelectedData = ref({}) // id(string) -> { title, displayTime, summary }
const industryLoading = ref(false)
const industryError = ref('')
const industryAiRaw = ref('')
const industryChartData = ref(null)
const industrySavedPath = ref('')
const industryLastDelta = ref('')
const industryFilenameInput = ref('')
const industryFilenamePreview = computed(() => {
  const raw = String(industryFilenameInput.value ?? '').trim()
  if (!raw) return ''
  return raw.toLowerCase().endsWith('.json') ? raw : `${raw}.json`
})
const industryFilenameValid = computed(() => {
  const name = industryFilenamePreview.value
  if (!name) return false
  // Windows 禁用字符： < > : " / \ | ? *   以及控制字符；也不允许以空格/点结尾
  if (/[<>:"/\\|?*\x00-\x1F]/.test(name)) return false
  if (/[. ]$/.test(name)) return false
  // 简单长度限制，避免过长路径问题
  if (name.length > 120) return false
  return true
})
const chartEl = ref(null)
let chartInstance = null
let chartDom = null
const moodChartEl = ref(null)
let moodChartInstance = null
let moodDom = null

// 词云分析：图表放大预览 + 下载
const chartPreviewOpen = ref(false)
const chartPreviewTarget = ref('industry') // 'industry' | 'mood'
const chartPreviewEl = ref(null)
let chartPreviewInst = null

const stockMoodPieEl = ref(null)
const stockMetricsBarEl = ref(null)
const stockThemesBarEl = ref(null)
let stockMoodPieInst = null
let stockMetricsBarInst = null
let stockThemesBarInst = null

const selectedId = ref(null)
const loadingDetail = ref(false)
const detailError = ref('')
const detail = ref(null)

const aiLoading = ref(false)
const aiError = ref('')
const aiResult = ref('')

// 脚本运行
const scriptRunning = ref(false)
const scriptError = ref('')
const scriptResult = ref(null) // { ok, key, exitCode, durationMs, stdout, stderr, message }
const scriptStockCodeInput = ref('')
const scriptStdoutLive = ref('')
const scriptStderrLive = ref('')
const scriptMetaLive = ref('')
const scriptStockCode = computed(() => {
  const raw = String(scriptStockCodeInput.value ?? '').trim()
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  const last6 = digits.slice(-6)
  return last6.padStart(6, '0')
})

function scriptKeyFromMenu() {
  if (activeMenu.value === 'script_all') return 'all'
  if (activeMenu.value === 'script_comments') return 'comments'
  if (activeMenu.value === 'script_news') return 'news'
  if (activeMenu.value === 'script_realtime') return 'realtime'
  return null
}

async function runAllScripts() {
  scriptRunning.value = true
  scriptError.value = ''
  scriptResult.value = null
  scriptStdoutLive.value = ''
  scriptStderrLive.value = ''
  scriptMetaLive.value = ''
  try {
    const code = scriptStockCode.value
    await runAllScriptsStream({
      code,
      onEvent: (evt, data) => {
        if (evt === 'stdout') { scriptStdoutLive.value += data + '\n'; return }
        if (evt === 'stderr') { scriptStderrLive.value += data + '\n'; return }
        if (evt === 'meta') { scriptMetaLive.value += data + '\n'; return }
        if (evt === 'done_all') {
          try { scriptResult.value = JSON.parse(data) } catch {}
          return
        }
        if (evt === 'error') { scriptError.value = data || '脚本运行失败' }
      },
    })
  } catch (e) {
    scriptError.value = e?.message || String(e)
  } finally {
    scriptRunning.value = false
  }
}

async function runActiveScript() {
  const k = scriptKeyFromMenu()
  if (!k) return
  if (k === 'all') {
    await runAllScripts()
    return
  }
  scriptRunning.value = true
  scriptError.value = ''
  scriptResult.value = null
  scriptStdoutLive.value = ''
  scriptStderrLive.value = ''
  scriptMetaLive.value = ''
  try {
    const code = (k === 'comments') ? scriptStockCode.value : undefined
    await runScriptStream(k, {
      code,
      onEvent: (evt, data) => {
        if (evt === 'stdout') {
          scriptStdoutLive.value += data + '\n'
          return
        }
        if (evt === 'stderr') {
          scriptStderrLive.value += data + '\n'
          return
        }
        if (evt === 'meta') {
          scriptMetaLive.value += data + '\n'
          return
        }
        if (evt === 'done') {
          try {
            scriptResult.value = JSON.parse(data)
            if (!scriptResult.value?.ok) {
              scriptError.value = scriptResult.value?.message || '脚本运行失败'
            }
          } catch {
            // ignore
          }
          return
        }
        if (evt === 'error') {
          scriptError.value = data || '脚本运行失败'
        }
      },
    })
  } catch (e) {
    scriptError.value = e?.message || String(e)
  } finally {
    scriptRunning.value = false
  }
}

watch(isDark, (val) => {
  const html = document.documentElement
  if (val) {
    html.classList.add('dark')
    localStorage.setItem('theme', 'dark')
  } else {
    html.classList.remove('dark')
    localStorage.setItem('theme', 'light')
  }
  // Re-render all charts when theme changes
  if (industryChartData.value) {
    rebuildIndustryCharts()
  }
  if (detail.value && detail.value.kind === 'stock_comment') {
    renderStockCommentCharts(detail.value)
  }
}, { immediate: true })

const activeMenuName = computed(() => {
  for (const g of menuGroups) {
    const hit = g.children.find(c => c.key === activeMenu.value)
    if (hit) return hit.name
  }
  return ''
})

const selectedCounts = computed(() => {
  const keys = Object.keys(selectedMap.value || {})
  const bySource = { general: 0, finance: 0, yahoo: 0, nytimes: 0, total: 0 }
  for (const k of keys) {
    const source = String(k.split(':')[0] || '')
    if (source in bySource) bySource[source]++
    bySource.total++
  }
  return bySource
})

const echartHistory = ref([])
const echartHistoryLoading = ref(false)

async function loadEchartHistory() {
  echartHistoryLoading.value = true
  try {
    const list = await listEchartFiles()
    echartHistory.value = Array.isArray(list) ? list : []
  } catch (e) {
    console.error('加载 echart 历史列表失败', e)
  } finally {
    echartHistoryLoading.value = false
  }
}

const historyError = ref('')

async function loadIndustryFromHistory(item) {
  historyError.value = ''
  try {
    const resp = await readEchartFile(item.filename)
    const jsonText = String(resp?.content ?? '').trim()
    if (!jsonText) throw new Error('文件内容为空')
    const parsed = JSON.parse(jsonText)
    industryAiRaw.value = jsonText
    industryChartData.value = parsed
    industrySavedPath.value = `/echart/${item.filename}`
    requestAnimationFrame(() => rebuildIndustryCharts())
  } catch (e) {
    historyError.value = `加载失败：${e?.message || String(e)}`
  }
}

const groupOpen = ref({ news: true, realtime: true, analysis: true })
const industryReasonText = computed(() => {
  const raw = industryChartData.value?.reason
  if (raw === null || raw === undefined) return ''
  return String(raw)
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
})

async function loadList() {
  // 脚本运行菜单：不自动执行（仅手动点按钮触发）
  if (scriptKeyFromMenu()) return
  // AI分析菜单：不加载列表数据
  if (activeMenu.value === 'ai_custom') return

  loadingList.value = true
  listError.value = ''
  items.value = []
  total.value = 0
  selectedId.value = null
  detail.value = null
  aiResult.value = ''
  aiError.value = ''

  try {
    const p0 = Math.max(0, (page.value || 1) - 1)
    const size = pageSize.value || 50
    const start = timeRange.value?.[0] || ''
    const end = timeRange.value?.[1] || ''
    const q = keyword.value?.trim() || ''
    const resp = activeMenu.value === 'industry'
      ? { content: [], totalElements: 0 }
      : activeMenu.value === 'yahoo'
        ? await listYahooFinanceNews(p0, size, { start, end, q })
      : activeMenu.value === 'nytimes'
        ? await listNewYorkTimesNews(p0, size, { start, end, q })
      : activeMenu.value === 'comments'
        ? await listStockComments(p0, size, { start, end, q })
        : activeMenu.value === 'deepseek'
          ? await listDeepseekMenu(p0, size, { start, end, q })
          : activeMenu.value === 'finance'
            ? await listFinance(p0, size, { start, end, q })
            : await listGeneral(p0, size, { start, end, q })

    const content = resp?.content || []
    items.value = activeMenu.value === 'comments'
      ? content.map(r => ({
        id: r.id,
        title: r.stockCode,
        publishTime: r.analysisTime,
        commentTotal: r.total_comments_analyzed,
      }))
      : content
    total.value = resp?.totalElements || 0
  } catch (e) {
    listError.value = e?.message || String(e)
  } finally {
    loadingList.value = false
  }
}

function openUrl(url) {
  const u = (url || '').trim()
  if (!u) return
  window.open(u, '_blank', 'noopener,noreferrer')
}

function selectionKey(source, id) {
  return `${source}:${id}`
}

function isSelectableMenu() {
  return activeMenu.value === 'general' || activeMenu.value === 'finance' || activeMenu.value === 'yahoo' || activeMenu.value === 'nytimes'
}

function isSelected(source, id) {
  return !!selectedMap.value[selectionKey(source, id)]
}

function toggleSelected(source, id, checked) {
  const k = selectionKey(source, id)
  const next = { ...selectedMap.value }
  if (checked) next[k] = true
  else delete next[k]
  selectedMap.value = next
}

function toggleYahooSelected(it, checked) {
  const id = String(it?.id ?? '')
  if (!id) return
  toggleSelected('yahoo', id, checked)
  const next = { ...yahooSelectedData.value }
  if (checked) {
    next[id] = {
      title: it?.title || '',
      displayTime: it?.displayTime || '',
      summary: it?.summary || '',
    }
  } else {
    delete next[id]
  }
  yahooSelectedData.value = next
}

function toggleNytimesSelected(it, checked) {
  const id = String(it?.id ?? '')
  if (!id) return
  toggleSelected('nytimes', id, checked)
  const next = { ...nytimesSelectedData.value }
  if (checked) {
    next[id] = {
      title: it?.title || '',
      displayTime: it?.displayTime || '',
      summary: it?.summary || '',
    }
  } else {
    delete next[id]
  }
  nytimesSelectedData.value = next
}

const currentSource = computed(() => {
  if (activeMenu.value === 'finance') return 'finance'
  if (activeMenu.value === 'yahoo') return 'yahoo'
  if (activeMenu.value === 'nytimes') return 'nytimes'
  return 'general'
})
const pageAllSelected = computed(() => {
  if (!isSelectableMenu()) return false
  if (!items.value?.length) return false
  return items.value.every(it => isSelected(currentSource.value, it.id))
})

function toggleSelectAllOnPage(checked) {
  if (!isSelectableMenu()) return
  const source = currentSource.value
  // yahoo 需要同时维护 yahooSelectedData，否则“词云分析”拼包会拿不到内容
  if (source === 'yahoo') {
    for (const it of items.value) {
      toggleYahooSelected(it, checked)
    }
    return
  }
  if (source === 'nytimes') {
    for (const it of items.value) {
      toggleNytimesSelected(it, checked)
    }
    return
  }

  const next = { ...selectedMap.value }
  for (const it of items.value) {
    const k = selectionKey(source, it.id)
    if (checked) next[k] = true
    else delete next[k]
  }
  selectedMap.value = next
}

async function selectAllFinanceResults() {
  if (activeMenu.value !== 'finance') return
  financeAllSelectLoading.value = true
  financeAllSelectError.value = ''
  try {
    const start = timeRange.value?.[0] || ''
    const end = timeRange.value?.[1] || ''
    const q = keyword.value?.trim() || ''
    // 后端默认最多拉 5000；这里按 total 请求，仍会被后端上限 20000 保护
    const resp = await listFinanceIds({ start, end, q, limit: total.value || 5000 })
    const ids = resp?.ids || []
    const truncated = !!resp?.truncated
    const next = { ...selectedMap.value }
    for (const id of ids) {
      next[`finance:${id}`] = true
    }
    selectedMap.value = next
    if (truncated) {
      financeAllSelectError.value = `结果过多，仅选中了前 ${ids.length} 条（limit=${resp?.limit}，total=${resp?.total}）。如需更多请提高后端 limit 上限或缩小筛选范围。`
    }
  } catch (e) {
    financeAllSelectError.value = e?.message || String(e)
  } finally {
    financeAllSelectLoading.value = false
  }
}

// AI分析（自定义 prompt + 选中内容）
const aiCustomPrompt = ref('')
const aiCustomLoading = ref(false)
const aiCustomError = ref('')
const aiCustomResult = ref('')
const aiCustomSavedPath = ref('')
const currentAiChatSessionId = ref('ai_custom') // 当前对话的 sessionId
const aiCustomHistory = ref([]) // { sessionId, preview, messageCount, lastUpdated }
const aiCustomHistoryLoading = ref(false)
const aiCustomSelectedContent = ref('')
const selectedAiCustomItem = ref(null) // 当前选中的历史会话项
const aiChatMessages = ref([]) // { role: 'user'|'assistant', content: string }
const aiChatInput = ref('')
const aiChatSending = ref(false)
const aiChatError = ref('')
const aiChatLoading = ref(false)
const aiChatContainer = ref(null)

async function loadAiCustomHistory(silent = false) {
  // silent=true 时不显示 loading 状态，避免替换正在显示的聊天内容
  if (!silent) aiCustomHistoryLoading.value = true
  try {
    // 从 MySQL chat_history 表查询所有会话列表
    const sessions = await listChatSessions()
    aiCustomHistory.value = Array.isArray(sessions) ? sessions : []
  } catch (e) {
    console.error('加载 AI 会话历史失败', e)
  } finally {
    if (!silent) aiCustomHistoryLoading.value = false
  }
}

async function deleteCustomHistory(item) {
  const sessionId = item.sessionId
  if (!sessionId) return
  if (!confirm(`确定要删除该历史回答吗？此操作不可恢复。`)) return
  try {
    await deleteChatSession(sessionId)
    aiCustomHistory.value = aiCustomHistory.value.filter(h => h.sessionId !== sessionId)
    if (selectedAiCustomItem.value && selectedAiCustomItem.value.sessionId === sessionId) {
      selectedAiCustomItem.value = null
      aiChatMessages.value = []
      currentAiChatSessionId.value = ''
    }
  } catch (e) {
    console.error('删除会话失败', e)
    alert(`删除失败：${e.message}`)
  }
}

async function runAiCustom() {
  aiCustomLoading.value = true
  aiCustomError.value = ''
  aiCustomResult.value = ''
  aiCustomSavedPath.value = ''
  selectedAiCustomItem.value = null

  try {
    const keys = Object.keys(selectedMap.value)
    if (keys.length === 0) {
      throw new Error('请先在新闻列表中勾选条目（可用本页全选）')
    }

    // 拼装选中内容（与词云分析完全一致）
    const articles = []
    for (const k of keys) {
      const [source, idStr] = k.split(':')
      if (source === 'yahoo') {
        const idKey = String(idStr)
        const y = yahooSelectedData.value[idKey] || items.value.find(it => String(it.id) === idKey)
        if (!y) continue
        const title = (y.title || '').trim()
        const displayTime = (y.displayTime || '').trim()
        const summary = (y.summary || '').trim()
        const content = [
          `publishTime：${displayTime}`,
          `summary：`,
          summary,
        ].filter(Boolean).join('\n')
        if (!title && !content.trim()) continue
        articles.push({ title, content })
        continue
      }
      if (source === 'nytimes') {
        const idKey = String(idStr)
        const n = nytimesSelectedData.value[idKey] || items.value.find(it => String(it.id) === idKey)
        if (!n) continue
        const title = (n.title || '').trim()
        const displayTime = (n.displayTime || '').trim()
        const summary = (n.summary || '').trim()
        const content = [
          `publishTime：${displayTime}`,
          `summary：`,
          summary,
        ].filter(Boolean).join('\n')
        if (!title && !content.trim()) continue
        articles.push({ title, content })
        continue
      }

      const id = Number(idStr)
      if (!Number.isFinite(id)) continue
      const detail = source === 'finance'
        ? await getFinanceDetail(id)
        : await getNewsDetail(id)
      articles.push({
        title: detail?.title || '',
        content: detail?.content || '',
      })
    }

    if (!articles.length) {
      throw new Error('已勾选条目未能生成有效内容（可能跨分页/刷新后丢失了列表数据）')
    }

    const userContent = articles.map((a, idx) => {
      const t = (a.title || '').trim()
      const c = (a.content || '').trim()
      return `【${idx + 1}】标题：${t}\n内容：\n${c}`
    }).join('\n\n')

    aiCustomSelectedContent.value = userContent

    // 用户自定义 prompt + 选中内容
    const prompt = (aiCustomPrompt.value || '').trim()
    const fullContent = prompt
      ? `${prompt}\n\n---\n以下是选中的新闻内容：\n\n${userContent}`
      : userContent

    // 创建新的对话 session（MySQL 永久存储）
    const sessionResp = await createNewSession()
    const newSessionId = sessionResp?.sessionId || 'default'
    currentAiChatSessionId.value = newSessionId

    // 使用记忆化对话（对话内容存储到 MySQL，Redis 缓存 20min）
    await chatMemoryStream(fullContent, {
      sessionId: newSessionId,
      selectedContent: aiCustomSelectedContent.value || undefined,
      onDelta: (delta) => {
        aiCustomResult.value += delta
      },
    })

    // 对话内容已自动保存到 MySQL chat_history 表

    // 刷新历史列表
    await loadAiCustomHistory()
  } catch (e) {
    aiCustomError.value = e?.message || String(e)
  } finally {
    aiCustomLoading.value = false
  }
}

async function loadAiCustomHistoryItem(item) {
  aiChatLoading.value = true
  aiChatMessages.value = []
  try {
    selectedAiCustomItem.value = item
    // 从 MySQL chat_history 表加载该会话的完整对话历史
    const resp = await chatMemoryHistory(item.sessionId)
    const messages = resp?.messages || []
    aiChatMessages.value = messages
    // 将最后一条助手消息作为 aiCustomResult 展示
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')
    aiCustomResult.value = lastAssistant?.content || ''
    aiCustomSavedPath.value = ''
    currentAiChatSessionId.value = item.sessionId
    aiCustomError.value = ''
    // 滚动到底部
    await nextTick()
    if (aiChatContainer.value) {
      aiChatContainer.value.scrollTop = aiChatContainer.value.scrollHeight
    }
  } catch (e) {
    aiCustomError.value = `加载历史失败：${e?.message || String(e)}`
  } finally {
    aiChatLoading.value = false
  }
}

async function sendAiChatMessage() {
  const msg = (aiChatInput.value || '').trim()
  if (!msg || aiChatSending.value) return
  aiChatInput.value = ''
  aiChatError.value = ''
  aiChatSending.value = true

  // 先在本地推入用户消息和空的 assistant 占位
  aiChatMessages.value.push({ role: 'user', content: msg })
  const assistantIdx = aiChatMessages.value.length
  aiChatMessages.value.push({ role: 'assistant', content: '' })

  try {
    let reply = ''
    const chatSessionId = currentAiChatSessionId.value || 'ai_custom'
    await chatMemoryStream(msg, {
      sessionId: chatSessionId,
      selectedContent: aiCustomSelectedContent.value || undefined,
      onDelta: (delta) => {
        reply += delta
        // 实时更新 assistant 消息内容（直接修改数组中的占位消息）
        aiChatMessages.value[assistantIdx].content = reply
        // 自动滚动到底部
        nextTick(() => {
          if (aiChatContainer.value) {
            aiChatContainer.value.scrollTop = aiChatContainer.value.scrollHeight
          }
        })
      },
    })

    // 对话内容已自动保存到 MySQL chat_history 表
    // 静默刷新历史会话列表（不 await，不显示 loading，不阻塞 UI）
    loadAiCustomHistory(true).catch(() => {})
  } catch (e) {
    aiChatError.value = e?.message || String(e)
  } finally {
    aiChatSending.value = false
  }
}

async function clearAiChatMemory() {
  try {
    const chatSessionId = currentAiChatSessionId.value || 'ai_custom'
    await chatMemoryClear(chatSessionId)
    aiChatMessages.value = []
    aiChatError.value = ''
  } catch (e) {
    aiChatError.value = e?.message || String(e)
  }
}

const yahooAiLoading = ref(false)
const yahooAiError = ref('')
const yahooAiResult = ref('')

async function runYahooAi() {
  yahooAiLoading.value = true
  yahooAiError.value = ''
  yahooAiResult.value = ''

  try {
    const keys = Object.keys(selectedMap.value).filter(k => k.startsWith('yahoo:'))
    if (keys.length === 0) {
      throw new Error('请先在“雅虎新闻”列表中勾选新闻（可用本页全选）')
    }

    const selected = keys
      .map(k => k.split(':')[1])
      .map(id => items.value.find(it => String(it.id) === String(id)))
      .filter(Boolean)

    const payload = selected.map((it, idx) => {
      const title = (it.title || '').trim()
      const displayTime = (it.displayTime || '').trim()
      const summary = (it.summary || '').trim()
      return `【${idx + 1}】\n标题：${title}\n时间：${displayTime}\n摘要：\n${summary}`
    }).join('\n\n')

    if (!payload.trim()) throw new Error('所选条目内容为空')

    // 保护：避免后端判定 content 为空而 400
    const safePayload = String(payload || '').trim()
    await aiParseStream(safePayload, {
      onDelta: (delta) => {
        yahooAiResult.value += delta
      },
    })
  } catch (e) {
    yahooAiError.value = e?.message || String(e)
  } finally {
    yahooAiLoading.value = false
  }
}

async function runIndustryAnalysis() {
  industryLoading.value = true
  industryError.value = ''
  industryAiRaw.value = ''
  industryChartData.value = null
  industrySavedPath.value = ''
  industryLastDelta.value = ''

  try {
    const keys = Object.keys(selectedMap.value)
    if (keys.length === 0) {
      throw new Error('请先在“网易新闻列表/实时财经新闻”里勾选新闻（可用本页全选）')
    }

    // 拉取详情（general/finance 用详情接口；yahoo/nytimes 直接用已选中的 title+displayTime+summary）
    const articles = []
    for (const k of keys) {
      const [source, idStr] = k.split(':')
      if (source === 'yahoo') {
        const idKey = String(idStr)
        const y = yahooSelectedData.value[idKey] || items.value.find(it => String(it.id) === idKey)
        if (!y) continue
        const title = (y.title || '').trim()
        const displayTime = (y.displayTime || '').trim()
        const summary = (y.summary || '').trim()
        // 只发 title + publishTime(displayTime) + summary
        const content = [
          `publishTime：${displayTime}`,
          `summary：`,
          summary,
        ].filter(Boolean).join('\n')
        if (!title && !content.trim()) continue
        articles.push({ title, content })
        continue
      }
      if (source === 'nytimes') {
        const idKey = String(idStr)
        const n = nytimesSelectedData.value[idKey] || items.value.find(it => String(it.id) === idKey)
        if (!n) continue
        const title = (n.title || '').trim()
        const displayTime = (n.displayTime || '').trim()
        const summary = (n.summary || '').trim()
        const content = [
          `publishTime：${displayTime}`,
          `summary：`,
          summary,
        ].filter(Boolean).join('\n')
        if (!title && !content.trim()) continue
        articles.push({ title, content })
        continue
      }

      const id = Number(idStr)
      if (!Number.isFinite(id)) continue
      const detail = source === 'finance'
        ? await getFinanceDetail(id)
        : await getNewsDetail(id)
      articles.push({
        title: detail?.title || '',
        content: detail?.content || '',
      })
    }

    if (!articles.length) {
      throw new Error('已勾选条目未能生成有效内容（可能跨分页/刷新后丢失了列表数据）')
    }

    const userContent = articles.map((a, idx) => {
      const t = (a.title || '').trim()
      const c = (a.content || '').trim()
      return `【${idx + 1}】标题：${t}\n内容：\n${c}`
    }).join('\n\n')

    const systemPrompt = [
      '你现在是一个舆情数据分析专家和ECharts配置生成器。',
      '我给你一些新闻标题和内容，请你分析这些新闻中涉及的不同行业（例如：新能源、房地产、人工智能、消费电子等，至少10个行业）。',
      '对于每个行业，请输出两个指标：',
      '1. 风险指数：0-100之间的整数，数值越高代表负面新闻越多、风险越大。',
      '2. 机会指数：0-100之间的整数，数值越高代表发展机遇越大、政策或市场利好越多。',
      '3. 情绪指数：mood 值第一个表示乐观指数，第二个表示悲观指数，均为 0-100 之间的整数，根据新闻整体情绪综合评估。',
      '4. 理由：根据新闻内容分析出实际的行业机会与风险，并给出理由，用换行符分隔。并且最后给出个股推荐和个股避雷',
      '请按以下例子JSON格式输出，不要包含任何其他解释文字。例子：',
      '',
      '{',
      '  "industries": ["新能源", "房地产", "人工智能", "消费电子"],',
      '  "riskData": [85, 70, 25, 40],',
      '  "opportunityData": [60, 15, 90, 55]',
      '  "mood": [10,90]',
      '  "reason": 1.新能源机会:....,风险:.... \n 2.房地产机会:....,风险:.... \n 3.人工智能机会:....,风险:.... \n 4.消费电子机会:....,风险:....、\n最后 个股推荐:....\n个股避雷...',
      '}以上的行业只是例子并不一定是实际的行业，你需要根据新闻内容分析出实际的行业。',
    ].join('\n')

    await aiParseStream(userContent, {
      systemPrompt,
      onDelta: (delta) => {
        industryAiRaw.value += delta
        industryLastDelta.value = delta
      },
    })

    const jsonText = industryAiRaw.value.trim()
    const parsed = JSON.parse(jsonText)
    industryChartData.value = parsed

    // 成功后保存到前端工程目录 opinionflow-vue/src/echart 下（由后端落盘）
    if (!industryFilenameValid.value) {
      throw new Error('请先输入合法的保存文件名（不能包含 \\ / : * ? \" < > |，并以 .json 结尾）')
    }
    const filename = industryFilenamePreview.value
    const saveResp = await saveEchartJson({ filename, jsonText })
    industrySavedPath.value = saveResp?.savedPath || ''

    // 保存后刷新 echart 历史列表
    loadEchartHistory().catch(() => {})
  } catch (e) {
    industryError.value = e?.message || String(e)
  } finally {
    industryLoading.value = false
  }
}

function renderIndustryChart() {
  if (!chartEl.value || !industryChartData.value) return
  if (chartInstance && chartDom !== chartEl.value) {
    chartInstance.dispose()
    chartInstance = null
    chartDom = null
  }
  if (!chartInstance) {
    chartDom = chartEl.value
    chartInstance = echarts.init(chartDom, isDark.value ? 'dark' : null)
    window.addEventListener('resize', () => chartInstance?.resize())
  }

  const d = industryChartData.value
  const industries = Array.isArray(d.industries) ? d.industries : []
  const riskData = Array.isArray(d.riskData) ? d.riskData : []
  const opportunityData = Array.isArray(d.opportunityData) ? d.opportunityData : []

  chartInstance.clear()
  chartInstance.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    legend: { data: ['风险指数', '机会指数'] },
    grid: { left: 40, right: 20, top: 40, bottom: 40, containLabel: true },
    xAxis: { type: 'category', data: industries, axisLabel: { interval: 0, rotate: industries.length > 4 ? 20 : 0 } },
    yAxis: { type: 'value', min: 0, max: 100 },
    series: [
      { name: '风险指数', type: 'bar', data: riskData, itemStyle: { color: '#e74c3c' } },
      { name: '机会指数', type: 'bar', data: opportunityData, itemStyle: { color: '#2ecc71' } },
    ],
  })
  chartInstance.resize()
}

function renderMoodChart() {
  if (!moodChartEl.value || !industryChartData.value) return
  if (moodChartInstance && moodDom !== moodChartEl.value) {
    moodChartInstance.dispose()
    moodChartInstance = null
    moodDom = null
  }
  if (!moodChartInstance) {
    moodDom = moodChartEl.value
    moodChartInstance = echarts.init(moodDom, isDark.value ? 'dark' : null)
    window.addEventListener('resize', () => moodChartInstance?.resize())
  }

  const d = industryChartData.value
  const mood = Array.isArray(d.mood) ? d.mood : []
  const optimistic = Number(mood?.[0] ?? 0)
  const pessimistic = Number(mood?.[1] ?? 0)

  moodChartInstance.clear()
  moodChartInstance.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item' },
    legend: { orient: 'horizontal', left: 'center', top: 10, data: ['乐观', '悲观'] },
    series: [
      {
        name: '情绪指数',
        type: 'pie',
        radius: ['35%', '70%'],
        avoidLabelOverlap: true,
        label: { formatter: '{b}: {c}' },
        labelLine: { show: true },
        data: [
          { value: Number.isFinite(optimistic) ? optimistic : 0, name: '乐观', itemStyle: { color: '#ffffff' } },
          { value: Number.isFinite(pessimistic) ? pessimistic : 0, name: '悲观', itemStyle: { color: '#000000' } },
        ],
      },
    ],
  })
  moodChartInstance.resize()
}

function getIndustryChartOption() {
  // 尽量从当前实例拿（包含 label/legend 的最终状态），没有就返回 null
  try {
    return chartInstance?.getOption?.() || null
  } catch {
    return null
  }
}

function getMoodChartOption() {
  try {
    return moodChartInstance?.getOption?.() || null
  } catch {
    return null
  }
}

async function openChartPreview(target) {
  if (!industryChartData.value) return
  chartPreviewTarget.value = target
  chartPreviewOpen.value = true
  await nextTick()
  requestAnimationFrame(() => {
    const el = chartPreviewEl.value
    if (!el) return
    chartPreviewInst?.dispose()
    chartPreviewInst = echarts.init(el, isDark.value ? 'dark' : null)
    const opt = target === 'mood' ? getMoodChartOption() : getIndustryChartOption()
    if (opt) {
      chartPreviewInst.clear()
      chartPreviewInst.setOption(opt, true)
      chartPreviewInst.resize()
    }
  })
}

function closeChartPreview() {
  chartPreviewOpen.value = false
  chartPreviewTarget.value = 'industry'
  chartPreviewInst?.dispose()
  chartPreviewInst = null
}

function triggerDownloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

function buildFilename(ext) {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const base = chartPreviewTarget.value === 'mood' ? 'mood' : 'industry'
  return `opinionflow-${base}-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.${ext}`
}

async function downloadPreview(type) {
  if (!chartPreviewOpen.value) return
  const opt = chartPreviewTarget.value === 'mood' ? getMoodChartOption() : getIndustryChartOption()
  if (!opt) return

  if (type === 'png') {
    const url = chartPreviewInst?.getDataURL?.({ type: 'png', pixelRatio: 2, backgroundColor: 'transparent' })
    if (url) triggerDownloadDataUrl(url, buildFilename('png'))
    return
  }

  // SVG：用临时 svg renderer 重新渲染导出
  const tmp = document.createElement('div')
  tmp.style.position = 'fixed'
  tmp.style.left = '-99999px'
  tmp.style.top = '0'
  tmp.style.width = '1200px'
  tmp.style.height = '700px'
  document.body.appendChild(tmp)
  try {
    const inst = echarts.init(tmp, isDark.value ? 'dark' : null, { renderer: 'svg' })
    inst.setOption(opt, true)
    const url = inst.getDataURL({ type: 'svg' })
    triggerDownloadDataUrl(url, buildFilename('svg'))
    inst.dispose()
  } finally {
    tmp.remove()
  }
}

async function rebuildIndustryCharts() {
  chartInstance?.dispose()
  chartInstance = null
  chartDom = null
  moodChartInstance?.dispose()
  moodChartInstance = null
  moodDom = null

  await nextTick()
  requestAnimationFrame(() => {
    renderIndustryChart()
    renderMoodChart()
    // 若放大预览打开，同步重绘
    if (chartPreviewOpen.value) {
      const opt = chartPreviewTarget.value === 'mood' ? getMoodChartOption() : getIndustryChartOption()
      if (chartPreviewInst && opt) {
        chartPreviewInst.clear()
        chartPreviewInst.setOption(opt, true)
        chartPreviewInst.resize()
      }
    }
  })
}

watch(industryChartData, async () => {
  await nextTick()
  // nextTick 后再下一帧，避免容器宽高为 0 导致偶发不渲染
  requestAnimationFrame(() => {
    renderIndustryChart()
    renderMoodChart()
  })
})

function disposeStockCommentCharts() {
  stockMoodPieInst?.dispose()
  stockMoodPieInst = null
  stockMetricsBarInst?.dispose()
  stockMetricsBarInst = null
  stockThemesBarInst?.dispose()
  stockThemesBarInst = null
}

function parseScore0to100(v) {
  const n = Number(String(v ?? '').trim().replace(/%/g, ''))
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.min(100, n))
}

function normalizeStockCommentApi(d) {
  if (!d) return null
  const rawThemes = d.main_themes ?? d.mainThemes
  const mainThemes =
    rawThemes && typeof rawThemes === 'object' && !Array.isArray(rawThemes)
      ? Object.entries(rawThemes)
        .map(([k, v]) => ({ name: String(k), weight: Number(v) }))
        .filter(x => x.name && Number.isFinite(x.weight))
        .map(x => ({ ...x, weight: Math.max(0, Math.min(1, x.weight)) }))
        .sort((a, b) => b.weight - a.weight)
      : Array.isArray(rawThemes)
        ? rawThemes
        : []
  const mainThemesContent =
    d.main_themes_content ??
    d.mainThemesContent ??
    d.main_themesContent ??
    ''
  return {
    id: d.id,
    stockCode: d.stockCode ?? '',
    analysisTime: d.analysisTime ?? null,
    totalCommentsAnalyzed: d.total_comments_analyzed ?? d.totalCommentsAnalyzed ?? null,
    mood: d.mood,
    ivi: d.ivi,
    narrativeCoherence: d.narrative_coherence ?? d.narrativeCoherence,
    mainThemes,
    mainThemesContent: String(mainThemesContent ?? ''),
    themeCount: d.theme_count ?? d.themeCount ?? null,
    infoSourceReliance: d.info_source_reliance ?? d.infoSourceReliance,
  }
}

function renderStockCommentCharts(d) {
  const x = normalizeStockCommentApi(d)
  if (!x) return

  const moodVal = parseScore0to100(x.mood)
  if (stockMoodPieEl.value) {
    if (stockMoodPieInst) {
      stockMoodPieInst.dispose()
      stockMoodPieInst = null
    }
    stockMoodPieInst = echarts.init(stockMoodPieEl.value, isDark.value ? 'dark' : null)
    window.addEventListener('resize', () => stockMoodPieInst?.resize())
    const m = moodVal ?? 50
    stockMoodPieInst.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'item' },
      legend: { top: 8, data: ['乐观倾向', '悲观倾向'] },
      series: [{
        name: '情绪 mood',
        type: 'pie',
        radius: ['38%', '72%'],
        label: { formatter: '{b}: {c}' },
        data: [
          { value: m, name: '乐观倾向', itemStyle: { color: '#ffffff' } },
          { value: Math.max(0, 100 - m), name: '悲观倾向', itemStyle: { color: '#000000' } },
        ],
      }],
    }, true)
  }

  const ivi = parseScore0to100(x.ivi)
  const nar = parseScore0to100(x.narrativeCoherence)
  const info = parseScore0to100(x.infoSourceReliance)
  const tc = Number(x.themeCount)
  const themeBar = Number.isFinite(tc) ? Math.max(0, tc) : 0
  const vIvi = ivi ?? 0
  const vNar = nar ?? 0
  const vInfo = info ?? 0
  const maxY = Math.max(100, vIvi, vNar, vInfo, themeBar)

  if (stockMetricsBarEl.value) {
    if (stockMetricsBarInst) {
      stockMetricsBarInst.dispose()
      stockMetricsBarInst = null
    }
    stockMetricsBarInst = echarts.init(stockMetricsBarEl.value, isDark.value ? 'dark' : null)
    window.addEventListener('resize', () => stockMetricsBarInst?.resize())
    stockMetricsBarInst.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      grid: { left: 48, right: 16, top: 36, bottom: 72, containLabel: true },
      xAxis: {
        type: 'category',
        data: ['IVI(非理性)', '叙事一致性', '信息源依赖度', '主题数量'],
        axisLabel: { interval: 0, rotate: 18 },
      },
      yAxis: { type: 'value', min: 0, max: maxY, name: '分数/个数' },
      series: [{
        type: 'bar',
        data: [vIvi, vNar, vInfo, themeBar],
        itemStyle: { color: '#3498db' },
      }],
    }, true)
  }

  const themes = x.mainThemes?.length ? x.mainThemes : []
  if (stockThemesBarEl.value) {
    if (stockThemesBarInst) {
      stockThemesBarInst.dispose()
      stockThemesBarInst = null
    }
    stockThemesBarInst = echarts.init(stockThemesBarEl.value, isDark.value ? 'dark' : null)
    window.addEventListener('resize', () => stockThemesBarInst?.resize())
    if (!themes.length) {
      stockThemesBarInst.clear()
      stockThemesBarInst.setOption({
        backgroundColor: 'transparent',
        title: { text: '暂无 main_themes 数据', left: 'center', top: 'middle', textStyle: { fontSize: 14, color: '#888' } },
        xAxis: { show: false },
        yAxis: { show: false },
        series: [],
      }, true)
    } else {
      const isWeightedObject = themes.length && typeof themes[0] === 'object' && themes[0] !== null && 'name' in themes[0] && 'weight' in themes[0]
      const labels = isWeightedObject ? themes.map(t => String(t.name ?? '')) : themes.map(t => String(t ?? ''))
      const values = isWeightedObject ? themes.map(t => Number(t.weight ?? 0)) : themes.map(() => 1)
      const maxV = Math.max(1, ...values.filter(v => Number.isFinite(v)).map(v => Math.max(0, v)))
      stockThemesBarInst.setOption({
        backgroundColor: 'transparent',
        title: { show: false, text: '' },
        tooltip: {
          trigger: 'axis',
          valueFormatter: (v) => {
            const n = Number(v)
            if (!Number.isFinite(n)) return String(v ?? '')
            // 0-1 权重显示 3 位小数；若不是权重（旧数组模式）则显示原值
            return (isWeightedObject ? n.toFixed(3) : String(n))
          },
        },
        grid: { left: 48, right: 16, top: 28, bottom: 88, containLabel: true },
        xAxis: { type: 'category', data: labels, axisLabel: { interval: 0, rotate: 28 } },
        yAxis: { type: 'value', min: 0, max: maxV, name: isWeightedObject ? '权重(0-1)' : '出现(示意)' },
        series: [{ type: 'bar', data: values, itemStyle: { color: '#9b59b6' } }],
      }, true)
    }
  }
}

async function openDetail(id) {
  selectedId.value = id
  loadingDetail.value = true
  detailError.value = ''
  detail.value = null
  aiResult.value = ''
  aiError.value = ''
  disposeStockCommentCharts()

  try {
    if (activeMenu.value === 'comments') {
      const d = await getStockCommentDetail(id)
      const x = normalizeStockCommentApi(d)
      const lines = [
        `stock_code：${x.stockCode || ''}`,
        `分析时间为: ${x.analysisTime || ''}`,
        `总评论数(total_comments_analyzed)：${x.totalCommentsAnalyzed ?? '—'}`,
        `mood（乐观指数 0–100）：${x.mood ?? '—'}`,
        `ivi（非理性 0–100）：${x.ivi ?? '—'}`,
        `narrative_coherence（叙事一致性 0–100）：${x.narrativeCoherence ?? '—'}`,
        `main_themes：${JSON.stringify(x.mainThemes || [], null, 0)}`,
        `main_themes_content：${(x.mainThemesContent || '').trim() ? '(见下方 Themes 图表下的文本区)' : '—'}`,
        `theme_count：${x.themeCount ?? '—'}`,
        `info_source_reliance（信息源依赖 0–100）：${x.infoSourceReliance ?? '—'}`,
      ]
      detail.value = {
        kind: 'stock_comment',
        ...x,
        title: x.stockCode || '评论分析',
        publishTime: x.analysisTime,
        content: lines.join('\n'),
      }
      // 必须先结束 loading，否则 v-else-if="detail" 整块不渲染，图表 ref 一直为 null
      loadingDetail.value = false
      await nextTick()
      renderStockCommentCharts(detail.value)
      requestAnimationFrame(() => {
        stockMoodPieInst?.resize()
        stockMetricsBarInst?.resize()
        stockThemesBarInst?.resize()
      })
      return
    }
    const d = activeMenu.value === 'finance'
      ? await getFinanceDetail(id)
      : await getNewsDetail(id)

    // 网易新闻/DeepSeek 区常见 content 带 HTML，转为纯文本展示与 AI 解析
    if (d && (activeMenu.value === 'general' || activeMenu.value === 'deepseek')) {
      d.content = htmlToPlainText(d.content)
    }
    detail.value = d
  } catch (e) {
    detailError.value = e?.message || String(e)
  } finally {
    loadingDetail.value = false
  }
}

function closeDetail() {
  selectedId.value = null
  loadingDetail.value = false
  detailError.value = ''
  detail.value = null
  aiLoading.value = false
  aiError.value = ''
  aiResult.value = ''
  disposeStockCommentCharts()
}

async function runAi() {
  aiLoading.value = true
  aiError.value = ''
  aiResult.value = ''

  try {
    const content = (detail.value?.content || '').trim()
    if (!content) {
      throw new Error('正文为空，无法解析')
    }
    await aiParseStream(content, {
      onDelta: (delta) => {
        aiResult.value += delta
      },
    })
  } catch (e) {
    aiError.value = e?.message || String(e)
  } finally {
    aiLoading.value = false
  }
}

watch(activeMenu, () => {
  page.value = 1
  if (activeMenu.value === 'ai_custom') {
    // 切到 AI分析 菜单时加载历史列表，但左侧不显示内容，等待右侧点击历史项
    aiCustomResult.value = ''
    aiCustomSavedPath.value = ''
    aiCustomError.value = ''
    selectedAiCustomItem.value = null
    aiChatError.value = ''
    loadAiCustomHistory()
    return
  }
  if (activeMenu.value === 'industry') {
    // 切到词云分析时刷新 echart 历史列表
    loadEchartHistory()
  } else if (!scriptKeyFromMenu()) {
    loadList()
  } else {
    // 切到脚本菜单只清理状态，不执行
    scriptError.value = ''
    scriptResult.value = null
    if (activeMenu.value !== 'script_comments') {
      scriptStockCodeInput.value = ''
    }
  }
})

onMounted(() => {
  loadList()
  loadEchartHistory()

  // 给"词云分析"的保存文件名一个默认值（后端也能接受的安全字符集）
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  industryFilenameInput.value = `echart-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`
})
</script>

<template>
  <header class="header card">
    <div class="headerLeft">
      <img alt="logo" src="./assets/新闻.png" width="32" height="32" />
      <div class="logoText">OpinionFlow 舆情</div>
      <div class="badge">MySQL spider</div>
    </div>
    <div class="headerRight">
      <div class="currentMenu">
        <span class="muted">当前菜单：</span>
        <span class="menuName">{{ activeMenuName }}</span>
      </div>
      <button class="btn" @click="toggleTheme">
        <span v-if="isDark">🌙 深色模式</span>
        <span v-else>☀️ 浅色模式</span>
      </button>
      <button class="btn primary" @click="loadList" :disabled="loadingList">刷新数据</button>
    </div>
  </header>

  <div class="layout">
    <aside class="sidebar card">
      <div class="menu">
        <div v-for="g in menuGroups" :key="g.key" class="menuGroup">
          <div class="menuGroupHeader" @click="groupOpen[g.key] = !groupOpen[g.key]">
            <span>{{ g.name }}</span>
            <span class="arrow" :class="{ rotated: !groupOpen[g.key] }">▼</span>
          </div>

          <transition name="menu-fade">
            <div v-if="groupOpen[g.key]" class="menuGroupContent">
              <button
                v-for="m in g.children"
                :key="m.key"
                class="menuItem"
                :class="{ active: activeMenu === m.key }"
                @click="activeMenu = m.key"
              >
                {{ m.name }}
              </button>
            </div>
          </transition>
        </div>
      </div>
    </aside>

    <main class="mainContent">
      <div v-if="scriptKeyFromMenu()" class="card scriptPanel">
        <div class="cardHeader">
          <div style="font-weight:800; font-size: 16px;">脚本运行 · {{ activeMenuName }}</div>
          <div class="headerActions">
            <button
              class="btn primary"
              @click="runActiveScript"
              :disabled="scriptRunning || (activeMenu === 'script_comments' && !scriptStockCode)"
            >
              {{ scriptRunning ? '运行中...' : '运行脚本' }}
            </button>
            <button class="btn" @click="() => { scriptError = ''; scriptResult = null }" :disabled="scriptRunning" type="button">
              清空输出
            </button>
          </div>
        </div>
        <div class="cardBody">
          <div class="muted">
            这里会调用后端执行你配置的 Python 脚本（仅支持 comments/news/realtime 三个 key）。仅在你手动点击“运行脚本”时执行。
          </div>

          <div v-if="activeMenu === 'script_comments'" class="scriptForm">
            <div class="muted" style="font-weight: 700;">请输入股票编号</div>
            <div class="scriptRow">
              <el-input
                v-model="scriptStockCodeInput"
                placeholder="例如：601398 / 000001"
                clearable
                @keyup.enter="runActiveScript"
              />
              <span class="badge" v-if="scriptStockCode">格式化：{{ scriptStockCode }}</span>
            </div>
            <div class="muted" v-if="scriptStockCode">
              将执行：<span class="monoInline">{{ `--code ${scriptStockCode}` }}</span>
            </div>
          </div>

          <div v-else-if="activeMenu === 'script_all'" class="scriptForm">
            <div class="muted" style="font-weight: 700;">请输入股票编号（用于评论爬取）</div>
            <div class="scriptRow">
              <el-input
                v-model="scriptStockCodeInput"
                placeholder="例如：601398 / 000001"
                clearable
                @keyup.enter="runActiveScript"
              />
              <span class="badge" v-if="scriptStockCode">格式化：{{ scriptStockCode }}</span>
            </div>
            <div class="muted" v-if="scriptStockCode">
              将并行运行：<span class="monoInline">comments(--code)</span>、<span class="monoInline">news</span>、<span class="monoInline">realtime</span>
            </div>
          </div>

          <div v-if="scriptError" class="errorState" style="padding: 12px 0;">{{ scriptError }}</div>
          <div v-if="scriptRunning" class="aiProgress">
            <div class="spinner sm"></div>
            <span>脚本运行中...</span>
          </div>
          <div v-if="scriptMetaLive" class="aiResultBox">
            <div class="chartTitle">meta</div>
            <pre class="pre">{{ scriptMetaLive }}</pre>
          </div>
          <div v-if="scriptStdoutLive" class="aiResultBox">
            <div class="chartTitle">stdout（实时）</div>
            <pre class="pre">{{ scriptStdoutLive }}</pre>
          </div>
          <div v-if="scriptStderrLive" class="aiResultBox">
            <div class="chartTitle">stderr（实时）</div>
            <pre class="pre">{{ scriptStderrLive }}</pre>
          </div>
          <div v-if="scriptResult" class="aiResultBox">
            <div class="muted" style="margin-bottom: 10px;">
              key={{ scriptResult.key }}；exit={{ scriptResult.exitCode }}；耗时={{ scriptResult.durationMs }}ms
            </div>
            <div class="chartTitle">stdout</div>
            <pre class="pre">{{ scriptResult.stdout || '' }}</pre>
            <div class="chartTitle" style="margin-top: 14px;">stderr</div>
            <pre class="pre">{{ scriptResult.stderr || '' }}</pre>
          </div>
          <div v-else-if="!scriptRunning" class="emptyState sm">点击“运行脚本”开始执行</div>
        </div>
      </div>

      <template v-else>
      <div class="card listCard">
        <div class="cardHeader">
          <div style="font-weight:700; font-size: 16px;">列表</div>
          <div class="muted" v-if="total">共 {{ total }} 条</div>
        </div>
        <div class="cardBody">
          <div class="filterBar" v-show="activeMenu !== 'ai_custom'">
            <div class="filterItem">
              <span class="muted">时间范围</span>
              <el-date-picker
                v-model="timeRange"
                type="datetimerange"
                range-separator="至"
                start-placeholder="开始"
                end-placeholder="结束"
                value-format="YYYY-MM-DD HH:mm:ss"
                format="YYYY-MM-DD HH:mm:ss"
                :clearable="true"
                @change="() => { page = 1; loadList() }"
              />
            </div>

            <div class="filterItem">
              <el-input
                v-model="keyword"
                clearable
                placeholder="搜索标题/正文..."
                @clear="() => { page = 1; loadList() }"
                @keyup.enter="() => { page = 1; loadList() }"
              >
                <template #prefix>🔍</template>
              </el-input>
            </div>

            <button class="btn primary" @click="() => { page = 1; loadList() }">搜索</button>

            <div v-if="isSelectableMenu()" class="filterItem selectAll">
              <span class="muted">本页全选</span>
              <el-checkbox
                :model-value="pageAllSelected"
                @change="(v) => toggleSelectAllOnPage(!!v)"
              />
            </div>

            <div v-if="activeMenu === 'finance'" class="filterItem">
              <button class="btn" type="button" @click="selectAllFinanceResults" :disabled="financeAllSelectLoading || loadingList">
                {{ financeAllSelectLoading ? '全部选中中...' : `全部选中（共${total || 0}条）` }}
              </button>
            </div>
          </div>

          <div v-if="activeMenu === 'finance' && financeAllSelectError" class="errorState" style="padding: 12px 0;">
            {{ financeAllSelectError }}
          </div>

          <!-- AI分析 菜单：微信风格聊天界面 -->
          <!--
            关键修复：不再用 v-if/v-else 互斥切换 loading 和聊天内容。
            v-if/v-else 会导致 Vue 销毁和重建 DOM，浏览器布局引擎在高度骤变时会重置滚动位置到顶部。
            改为：loading 时用覆盖层浮在聊天内容上方，聊天 DOM 始终存在，不会被销毁。
          -->
          <div v-if="activeMenu === 'ai_custom'" class="chatPanel">
            <!-- 首次加载（还没有选中历史项）时显示提示 -->
            <div v-if="!selectedAiCustomItem && aiCustomHistory.length === 0 && !aiCustomHistoryLoading" class="emptyState">暂无历史回答</div>
            <div v-else-if="!selectedAiCustomItem && !aiCustomHistoryLoading" class="emptyState">请在右侧点击历史会话查看对话内容</div>

            <!-- 聊天面板：始终渲染，loading 时用覆盖层遮挡，避免 DOM 销毁重建 -->
            <div v-show="selectedAiCustomItem" class="chatPanelInner">
              <div class="chatPanelHeader">
                <div class="chatPanelTitle">{{ selectedAiCustomItem?.preview || selectedAiCustomItem?.sessionId }}</div>
                <button class="btn sm" type="button" @click="loadAiCustomHistory(true)" :disabled="aiCustomHistoryLoading">
                  {{ aiCustomHistoryLoading ? '加载中...' : '刷新列表' }}
                </button>
              </div>
              <div v-if="aiChatLoading" class="loadingState" style="padding:20px 0;">
                <div class="spinner"></div>
                <div class="muted">加载对话历史中...</div>
              </div>
              <div v-else-if="!aiChatMessages.length" class="emptyState sm">暂无对话记录</div>
              <div v-else ref="aiChatContainer" class="wechatChatContainer">
                <div
                  v-for="(msg, idx) in aiChatMessages"
                  :key="idx"
                  class="wechatMsgRow"
                  :class="msg.role"
                >
                  <!-- AI 消息：头像在左 -->
                  <template v-if="msg.role === 'assistant'">
                    <div class="wechatAvatar assistantAvatar">🤖</div>
                    <div class="wechatBubble assistantBubble">
                      <div class="wechatBubbleContent">{{ msg.content }}</div>
                    </div>
                  </template>
                  <!-- 用户消息：头像在右 -->
                  <template v-else>
                    <div class="wechatBubble userBubble">
                      <div class="wechatBubbleContent">{{ msg.content }}</div>
                    </div>
                    <div class="wechatAvatar userAvatar">👤</div>
                  </template>
                </div>
              </div>
              <!-- 追问输入框（中栏底部） -->
              <div class="aiChatInputBox">
                <el-input
                  v-model="aiChatInput"
                  type="textarea"
                  :rows="2"
                  placeholder="输入追问内容，AI 会基于之前的记忆回答..."
                  clearable
                  @keyup.ctrl.enter="sendAiChatMessage"
                />
                <div class="actionGroup" style="margin:8px 0 0;">
                  <button class="btn primary" type="button" @click="sendAiChatMessage" :disabled="aiChatSending || !aiChatInput.trim()">
                    {{ aiChatSending ? '发送中...' : '追问 AI' }}
                  </button>
                  <span class="muted" style="font-size:12px;">Ctrl+Enter 发送</span>
                </div>
              </div>
              <!-- loading 覆盖层：浮在聊天内容上方，不销毁底层 DOM -->
              <div v-if="aiCustomHistoryLoading" class="chatLoadingOverlay">
                <div class="spinner"></div>
                <div class="muted">正在刷新会话列表...</div>
              </div>
            </div>
          </div>

          <!-- 其他菜单：正常列表 -->
          <template v-else>
          <div v-if="loadingList" class="loadingState">
            <div class="spinner"></div>
            <div class="muted">正在加载数据...</div>
          </div>
          <div v-else-if="listError" class="errorState">{{ listError }}</div>
          <div v-else-if="!items.length" class="emptyState">暂无数据</div>

          <div v-else class="list">
            <button
              v-for="it in items"
              :key="it.id"
              class="listItem"
              @click="(activeMenu === 'yahoo' || activeMenu === 'nytimes') ? openUrl(it.articleUrl) : openDetail(it.id)"
            >
              <div v-if="activeMenu === 'yahoo' || activeMenu === 'nytimes'" class="yahooItem">
                <el-checkbox
                  :model-value="isSelected(activeMenu === 'yahoo' ? 'yahoo' : 'nytimes', it.id)"
                  @click.stop
                  @change="(v) => (activeMenu === 'yahoo' ? toggleYahooSelected(it, !!v) : toggleNytimesSelected(it, !!v))"
                />
                <img
                  v-if="it.imgUrl"
                  :src="it.imgUrl"
                  alt="img"
                  class="newsImg"
                />
                <div class="itemMain">
                  <div class="listItemTitle">{{ it.title || '(无标题)' }}</div>
                  <div class="muted">{{ it.displayTime || '' }}</div>
                </div>
                <button class="btn sm" @click.stop="openUrl(it.articleUrl)">
                  🔗
                </button>
              </div>
              <div v-else class="generalItem">
                <el-checkbox
                  v-if="activeMenu === 'general' || activeMenu === 'finance'"
                  :model-value="isSelected(currentSource, it.id)"
                  @click.stop
                  @change="(v) => toggleSelected(currentSource, it.id, !!v)"
                />
                <div class="itemMain">
                  <div class="listItemTitle">{{ it.title || '(无标题)' }}</div>
                  <div class="muted">
                    <template v-if="activeMenu === 'comments'">
                      分析时间为: {{ it.publishTime || '—' }}；总评论数：{{ it.commentTotal ?? '—' }}
                    </template>
                    <template v-else>
                      {{ activeMenu === 'finance' ? (it.summary || '') : (it.publishTime || '') }}
                    </template>
                  </div>
                </div>
              </div>
            </button>
          </div>

          <div class="pagination" v-if="total">
            <el-pagination
              v-model:current-page="page"
              v-model:page-size="pageSize"
              :page-sizes="[50]"
              :total="total"
              background
              layout="prev, pager, next, total"
              @current-change="loadList"
            />
          </div>
          </template>
        </div>
      </div>

      <div class="card detailPlaceholder">
        <div class="cardHeader">
          <div style="font-weight:700; font-size: 16px;">详情预览</div>
          <button class="btn primary" @click="runAi" :disabled="!detail || aiLoading" v-if="activeMenu !== 'industry' && activeMenu !== 'yahoo' && !scriptKeyFromMenu()">AI 解析</button>
        </div>
        <div class="cardBody">
          <div v-if="activeMenu === 'industry'">
            <div class="muted">勾选新闻后点击下方按钮生成行业风险/机会分析。</div>
            <div class="selectedHint">
              <span class="badge">已勾选 {{ selectedCounts.total }} 条</span>
              <span class="muted" v-if="selectedCounts.total">
                （网易 {{ selectedCounts.general }} / 财经 {{ selectedCounts.finance }} / 雅虎 {{ selectedCounts.yahoo }}）
              </span>
            </div>
            <div class="scriptForm">
              <div class="muted" style="font-weight: 700;">保存文件名（必须合法）</div>
              <div class="scriptRow">
                <el-input
                  v-model="industryFilenameInput"
                  placeholder="例如：echart-20260426-18：26：29.json"
                  clearable
                />
                <span class="badge" :style="{ borderColor: industryFilenameValid ? 'var(--primary-color)' : '#e74c3c' }">
                  {{ industryFilenameValid ? '合法' : '不合法' }}
                </span>
              </div>
              <div class="muted" v-if="industryFilenamePreview">
                预览：<span class="monoInline">{{ industryFilenamePreview }}</span>
              </div>
              <div class="muted" v-else>
                请输入文件名（自动补全 .json）
              </div>
            </div>
            <div class="actionGroup">
              <button class="btn primary" type="button" @click="runIndustryAnalysis" :disabled="industryLoading || !industryFilenameValid">开始分析</button>
              <button class="btn" type="button" @click="rebuildIndustryCharts" :disabled="!industryChartData">刷新图表</button>
            </div>

            <div class="historyBox" v-if="echartHistory.length">
              <div class="chartTitle">历史加载（public/echart）</div>
              <div class="muted" style="margin-bottom: 10px;">
                点击文件名即可加载对应的 JSON 并重建图表（不会触发 AI 请求）。
              </div>
              <div v-if="historyError" class="errorState" style="padding: 12px 0;">{{ historyError }}</div>
              <div class="historyList">
                <button
                  v-for="h in echartHistory"
                  :key="h.path"
                  class="historyItem"
                  @click="loadIndustryFromHistory(h)"
                  type="button"
                >
                  <span class="mono">{{ h.filename }}</span>
                  <span class="muted">加载</span>
                </button>
              </div>
            </div>
            <div v-if="industryLoading" class="aiProgress">
              <div class="spinner sm"></div>
              <span>流式分析中... ({{ industryAiRaw.length }} 字符)</span>
            </div>

            <div v-if="industryError" class="errorState">{{ industryError }}</div>

            <div v-if="industryChartData" class="chartContainer">
              <div class="chartTitleRow">
                <div class="chartTitle">行业风险/机会分布</div>
                <button class="btn sm" @click="openChartPreview('industry')" type="button">放大</button>
              </div>
              <div ref="chartEl" class="chart"></div>
            </div>

            <div v-if="industryChartData" class="chartContainer">
              <div class="chartTitleRow">
                <div class="chartTitle">整体情绪分布</div>
                <button class="btn sm" @click="openChartPreview('mood')" type="button">放大</button>
              </div>
              <div ref="moodChartEl" class="chart small"></div>
            </div>

            <div v-if="industryChartData?.reason" class="reasonBox">
              <div class="chartTitle">分析理由</div>
              <pre class="pre">{{ industryReasonText }}</pre>
            </div>

            <div v-if="industryAiRaw" class="reasonBox">
              <div class="chartTitle">AI 原始输出（JSON）</div>
              <pre class="pre">{{ industryAiRaw }}</pre>
            </div>
          </div>

          <div v-else-if="activeMenu === 'ai_custom'">
            <div class="muted">输入自定义 Prompt，结合已勾选的新闻内容发送给 AI 分析（支持记忆化多轮对话）。</div>
            <div class="selectedHint">
              <span class="badge">已勾选 {{ selectedCounts.total }} 条</span>
              <span class="muted" v-if="selectedCounts.total">
                （网易 {{ selectedCounts.general }} / 财经 {{ selectedCounts.finance }} / 雅虎 {{ selectedCounts.yahoo }} / 纽约时报 {{ selectedCounts.nytimes }}）
              </span>
            </div>
            <div class="scriptForm">
              <div class="muted" style="font-weight: 700;">自定义 Prompt</div>
              <el-input
                v-model="aiCustomPrompt"
                type="textarea"
                :rows="3"
                placeholder="请输入你的分析需求，例如：请分析这些新闻中关于新能源行业的趋势..."
                clearable
              />
            </div>
            <div class="actionGroup">
              <button class="btn primary" type="button" @click="runAiCustom" :disabled="aiCustomLoading">发送给 AI 分析</button>
              <button class="btn" type="button" @click="clearAiChatMemory">清除记忆</button>
            </div>

            <div v-if="aiCustomLoading" class="aiProgress">
              <div class="spinner sm"></div>
              <span>流式分析中... ({{ aiCustomResult.length }} 字符)</span>
            </div>

            <div v-if="aiCustomError" class="errorState">{{ aiCustomError }}</div>

            <div v-if="aiCustomHistory.length" class="historyBox">
              <div class="chartTitle">历史回答（MySQL chat_history）</div>
              <div class="historyList">
                <button
                  v-for="h in aiCustomHistory"
                  :key="h.sessionId"
                  class="historyItem"
                  @click="loadAiCustomHistoryItem(h)"
                  type="button"
                >
                  <div class="historyItemMain">
                    <span class="mono">{{ h.preview || h.sessionId }}</span>
                    <span class="muted" style="font-size:11px;">{{ h.messageCount }} 条消息</span>
                  </div>
                  <div style="display:flex;align-items:center;gap:6px;">
                    <span class="muted">加载</span>
                    <button class="btn-delete-item" @click.stop="deleteCustomHistory(h)" title="删除该会话">✕</button>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <div v-else-if="scriptKeyFromMenu()">
            <div class="muted">
              这里会调用后端执行你配置的 Python 脚本（仅支持 comments/news/realtime 三个 key）。
            </div>
            <div class="actionGroup">
              <button class="btn primary" @click="runActiveScript" :disabled="scriptRunning">
                {{ scriptRunning ? '运行中...' : '运行脚本' }}
              </button>
              <button class="btn" @click="() => { scriptError = ''; scriptResult = null }" :disabled="scriptRunning" type="button">
                清空输出
              </button>
            </div>

            <div v-if="scriptError" class="errorState" style="padding: 12px 0;">{{ scriptError }}</div>
            <div v-if="scriptResult" class="aiResultBox">
              <div class="muted" style="margin-bottom: 10px;">
                key={{ scriptResult.key }}；exit={{ scriptResult.exitCode }}；耗时={{ scriptResult.durationMs }}ms
              </div>
              <div class="chartTitle">stdout</div>
              <pre class="pre">{{ scriptResult.stdout || '' }}</pre>
              <div class="chartTitle" style="margin-top: 14px;">stderr</div>
              <pre class="pre">{{ scriptResult.stderr || '' }}</pre>
            </div>
          </div>

          <div v-else-if="activeMenu === 'yahoo'">
            <div class="muted">勾选雅虎新闻后发送给 AI 分析。</div>
            <div class="actionGroup">
              <button class="btn primary" @click="runYahooAi" :disabled="yahooAiLoading">发送到 AI</button>
            </div>
            <div v-if="yahooAiLoading" class="aiProgress">
              <div class="spinner sm"></div>
              <span>流式分析中...</span>
            </div>
            <div v-if="yahooAiError" class="errorState">{{ yahooAiError }}</div>
            <div v-if="yahooAiResult" class="aiResultBox">
              <pre class="pre">{{ yahooAiResult }}</pre>
            </div>
          </div>

          <div v-else-if="activeMenu === 'nytimes'">
            <div class="muted">纽约时报新闻列表支持勾选与打开链接（点击条目或右侧🔗）。</div>
            <div class="selectedHint">
              <span class="badge">已勾选 {{ selectedCounts.nytimes }} 条</span>
            </div>
            <div class="emptyState sm">左侧点击新闻将直接打开链接</div>
          </div>

          <div v-else class="emptyDetail">
            <div class="emptyIcon">📄</div>
            <div class="muted">请在左侧选择一条新闻查看详情</div>
          </div>
        </div>
      </div>
      </template>
    </main>
  </div>

  <transition name="fade">
    <div v-if="selectedId" class="detailOverlay" @click.self="closeDetail">
      <div class="detailPanel card">
        <div class="cardHeader detailHeader">
          <div class="detailTitle">{{ detail?.title || '详情' }}</div>
          <div class="headerActions">
            <button class="btn primary" @click="runAi" :disabled="!detail || aiLoading">AI 解析</button>
            <button class="btn" @click="closeDetail">关闭</button>
          </div>
        </div>

        <div class="detailBody">
          <div v-if="loadingDetail" class="loadingState">
            <div class="spinner"></div>
            <span>详情加载中...</span>
          </div>
          <div v-else-if="detailError" class="errorState">{{ detailError }}</div>
          <div v-else-if="detail">
            <div class="detailMeta">
              <span class="badge">{{ activeMenu === 'comments' ? '分析时间' : '发布时间' }}</span>
              <span class="time">{{ detail.publishTime || '未知' }}</span>
            </div>
            
            <pre class="pre contentPre">{{ detail.content || '' }}</pre>

            <div v-if="detail?.kind === 'stock_comment'" class="stockCharts">
              <div class="chartGroup">
                <div class="chartTitle">情绪分布 (Mood)</div>
                <div ref="stockMoodPieEl" class="chart small"></div>
              </div>
              <div class="chartGroup">
                <div class="chartTitle">核心指标分析</div>
                <div ref="stockMetricsBarEl" class="chart"></div>
              </div>
              <div class="chartGroup">
                <div class="chartTitle">主要叙事主题 (Themes)</div>
                <div ref="stockThemesBarEl" class="chart"></div>
                <div v-if="(detail?.mainThemesContent || '').trim()" class="themeContentBox">
                  <div class="chartTitle">主题解读 (main_themes_content)</div>
                  <pre class="pre themeContentPre">{{ detail.mainThemesContent }}</pre>
                </div>
              </div>
            </div>

            <div class="aiSection">
              <div class="aiHeader">
                <div class="aiTitle">AI 深度分析</div>
                <span v-if="aiLoading" class="badge primary">分析中...</span>
              </div>
              <div v-if="aiError" class="errorState">{{ aiError }}</div>
              <div v-else-if="aiResult" class="aiResultBody">
                <pre class="pre">{{ aiResult }}</pre>
              </div>
              <div v-else class="emptyState sm">点击上方“AI 解析”按钮开始分析</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>

  <transition name="fade">
    <div v-if="chartPreviewOpen" class="chartPreviewOverlay" @click.self="closeChartPreview">
      <div class="chartPreviewPanel card">
        <div class="cardHeader detailHeader">
          <div class="detailTitle">
            {{ chartPreviewTarget === 'mood' ? '整体情绪分布（放大）' : '行业风险/机会分布（放大）' }}
          </div>
          <div class="headerActions">
            <button class="btn" @click="downloadPreview('png')" type="button">下载 PNG</button>
            <button class="btn" @click="downloadPreview('svg')" type="button">下载 SVG</button>
            <button class="btn primary" @click="closeChartPreview" type="button">关闭</button>
          </div>
        </div>
        <div class="chartPreviewBody">
          <div ref="chartPreviewEl" class="chartPreviewCanvas"></div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.header {
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 24px;
}
.headerLeft {
  display: flex;
  align-items: center;
  gap: 12px;
}
.logoText {
  font-size: 20px;
  font-weight: 800;
  background: linear-gradient(120deg, var(--primary-color), #a8c0ff);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.headerRight {
  display: flex;
  align-items: center;
  gap: 16px;
}
.currentMenu {
  display: flex;
  align-items: center;
  gap: 4px;
}
.menuName {
  font-weight: 600;
  color: var(--primary-color);
}

.sidebar {
  height: fit-content;
  position: sticky;
  top: 20px;
}
.menuGroup {
  margin-bottom: 8px;
}
.menuGroupHeader {
  padding: 12px 16px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-radius: 10px;
  transition: background 0.2s;
}
.menuGroupHeader:hover {
  background: var(--panel-bg-2);
}
.arrow {
  font-size: 10px;
  transition: transform 0.3s;
}
.arrow.rotated {
  transform: rotate(-90deg);
}

.mainContent {
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: 20px;
}
@media (max-width: 1200px) {
  .mainContent {
    grid-template-columns: 1fr;
  }
}

.scriptPanel{
  grid-column: 1 / -1;
  width: min(980px, 100%);
  margin: 0 auto;
}
.scriptForm{
  margin-top: 14px;
  padding: 14px;
  border-radius: 14px;
  border: 1px solid var(--border-color-light);
  background: var(--panel-bg-2);
  display: grid;
  gap: 10px;
}
.scriptRow{
  display: flex;
  align-items: center;
  gap: 10px;
}
.monoInline{
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 12px;
}

.filterBar {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 20px;
  padding: 16px;
  background: var(--panel-bg-2);
  border-radius: 12px;
}
.filterItem {
  display: flex;
  align-items: center;
  gap: 8px;
}
.selectAll {
  margin-left: auto;
  padding-left: 12px;
  border-left: 1px solid var(--border-color);
}

.loadingState, .emptyState, .errorState {
  padding: 60px 0;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.emptyState.sm { padding: 20px 0; }
.errorState { color: #e74c3c; }

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-color);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
.spinner.sm { width: 16px; height: 16px; border-width: 2px; }
@keyframes spin { to { transform: rotate(360deg); } }

.yahooItem, .generalItem {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
}
.newsImg {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 12px;
  flex-shrink: 0;
}
.itemMain {
  flex: 1;
  min-width: 0;
}
.btn.sm { padding: 6px 10px; font-size: 12px; }

.pagination {
  margin-top: 24px;
  display: flex;
  justify-content: center;
}

.aiContentHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  padding: 8px 0;
}
.aiContentBody {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  padding: 20px;
  background: var(--panel-bg-2);
  border-radius: 14px;
  border: 1px solid var(--border-color-light);
}
.aiContentPre {
  width: 100%;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}
.actionGroup {
  display: flex;
  gap: 10px;
  margin: 16px 0;
}
.selectedHint{
  display:flex;
  align-items:center;
  gap:10px;
  margin: 10px 0 0;
}
.historyBox{
  margin-top: 14px;
  padding: 16px;
  background: var(--panel-bg-2);
  border-radius: 14px;
  border: 1px solid var(--border-color-light);
}
.historyList{
  display: grid;
  gap: 8px;
  max-height: 240px;
  overflow: auto;
  padding-right: 6px;
}
.historyItem{
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--border-color-light);
  background: var(--panel-bg);
  cursor: pointer;
  transition: all 0.2s ease;
}
.historyItem:hover{
  border-color: var(--primary-color);
  transform: translateX(2px);
}
.historyItemMain{
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  min-width: 0;
}
.mono{
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 12px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.aiProgress {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: var(--panel-bg-2);
  border-radius: 10px;
  font-size: 13px;
}

.chartContainer {
  margin-top: 20px;
  padding: 16px;
  background: var(--panel-bg-2);
  border-radius: 14px;
}
.chartTitle {
  font-weight: 700;
  font-size: 14px;
  margin-bottom: 12px;
  padding-left: 8px;
  border-left: 4px solid var(--primary-color);
}
.chartTitleRow{
  display:flex;
  align-items:center;
  justify-content: space-between;
  gap: 10px;
}
.chart { width: 100%; height: 300px; }
.chart.small { height: 240px; }

.reasonBox, .aiResultBox {
  margin-top: 20px;
  padding: 16px;
  background: var(--panel-bg-2);
  border-radius: 14px;
}

.emptyDetail {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  opacity: 0.6;
}
.emptyIcon { font-size: 48px; margin-bottom: 16px; }

.detailTitle {
  font-size: 18px;
  font-weight: 700;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.headerActions { display: flex; gap: 10px; }
.detailMeta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
}
.detailMeta .time { font-size: 14px; font-weight: 500; }

.aiSection {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px dashed var(--border-color);
}
.aiHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.aiTitle { font-weight: 800; font-size: 16px; }
.aiResultBody {
  padding: 16px;
  background: var(--panel-bg-2);
  border-radius: 12px;
  border: 1px solid var(--border-color-light);
}

.themeContentBox{
  margin-top: 12px;
  padding: 12px;
  background: var(--panel-bg-2);
  border-radius: 12px;
  border: 1px solid var(--border-color-light);
}
.themeContentPre{
  margin: 0;
  max-height: 240px;
  overflow: auto;
}

/* Transitions */
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.menu-fade-enter-active, .menu-fade-leave-active { transition: all 0.3s ease; max-height: 500px; overflow: hidden; }
.menu-fade-enter-from, .menu-fade-leave-to { max-height: 0; opacity: 0; }

.chartPreviewOverlay{
  position: fixed;
  inset: 0;
  z-index: 1100;
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(6px);
  display: grid;
  place-items: center;
  padding: 20px;
}
.chartPreviewPanel{
  width: min(82vw, 1200px);
  height: min(80vh, 820px);
  display:flex;
  flex-direction: column;
  overflow: hidden;
}
.chartPreviewBody{
  flex: 1;
  padding: 16px;
}
.chartPreviewCanvas{
  width: 100%;
  height: 100%;
}

/* LangChain4j 记忆化对话 */
.aiChatBox {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 400px;
  overflow: auto;
  padding-right: 6px;
}
.chatMsg {
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid var(--border-color-light);
}
.chatMsg.user {
  background: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 12%, transparent);
  border-color: var(--primary-color);
}
.chatMsg.assistant {
  background: var(--panel-bg);
}
.chatRole {
  font-weight: 700;
  font-size: 12px;
  margin-bottom: 6px;
  color: var(--text-secondary);
}
.chatContent {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 13px;
}
.aiChatInputBox {
  margin-top: 14px;
  padding: 14px;
  border-radius: 14px;
  border: 1px solid var(--border-color-light);
  background: var(--panel-bg-2);
}

/* 微信风格聊天面板 */
.chatPanel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 300px;
}
.chatPanelHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-color-light);
  margin-bottom: 8px;
}
.chatPanelTitle {
  font-weight: 700;
  font-size: 14px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 260px;
}

/* 聊天面板内部容器（v-show 保持 DOM 存在） */
.chatPanelInner {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  position: relative;
}

/* loading 覆盖层：绝对定位浮在聊天内容上方，不销毁底层 DOM */
.chatLoadingOverlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(2px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  border-radius: 12px;
}

/* 微信风格消息容器 */
.wechatChatContainer {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: transparent;
}

/* 每条消息行 */
.wechatMsgRow {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  max-width: 100%;
}
.wechatMsgRow.user {
  flex-direction: row;
  justify-content: flex-end;
}
.wechatMsgRow.assistant {
  flex-direction: row;
  justify-content: flex-start;
}

/* 头像 */
.wechatAvatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}
.assistantAvatar {
  background: linear-gradient(135deg, #e8f5e9, #c8e6c9);
}
.userAvatar {
  background: linear-gradient(135deg, #e3f2fd, #bbdefb);
}

/* 气泡 */
.wechatBubble {
  max-width: 72%;
  padding: 10px 14px;
  border-radius: 12px;
  position: relative;
  word-break: break-word;
  line-height: 1.6;
  font-size: 13px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}
.assistantBubble {
  background: var(--panel-bg);
  border: 1px solid var(--border-color-light);
  border-top-left-radius: 4px;
}
.userBubble {
  background: color-mix(in srgb, var(--primary-color) 88%, #fff);
  color: #fff;
  border-top-right-radius: 4px;
}
/* 深色模式下用户气泡保持可读 */
:global(.dark) .userBubble {
  background: color-mix(in srgb, var(--primary-color) 70%, #333);
}

.wechatBubbleContent {
  white-space: pre-wrap;
  word-break: break-word;
}

/* 删除按钮 */
.btn-delete-item {
  background: transparent;
  border: 1px solid #e74c3c;
  color: #e74c3c;
  border-radius: 50%;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
  transition: all 0.2s ease;
  flex-shrink: 0;
}
.btn-delete-item:hover {
  background: #e74c3c;
  color: #fff;
}
</style>
