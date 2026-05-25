<script setup>
import AppHeader from './header/AppHeader.vue'
import AppSidebar from './Right Sidebar/AppSidebar.vue'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useTheme } from '@/composables/useTheme'
import StockThemesBar from '@/charts/StockComment/StockThemesBar.vue'
import StockMetricsBar from '@/charts/StockComment/StockMetricsBar.vue'
import Industryanalyse from '@/views/Industryanalyse.vue'
import StockMoodPie from '@/charts/StockComment/StockMoodPie.vue'

import ScriptPanel from '@/components/Run Script/ScriptPanel.vue'
import TimeFilter from '@/components/Filter/TimeFilter.vue'
import AICustomAnalysis from '@/views/AICustomAnalysis.vue'
import * as echarts from 'echarts'
import { aiParseStream, getFinanceDetail, getNewsDetail, listDeepseekMenu, listFinance, listFinanceIds, listGeneral, listGeneralIds, listStockComments, getStockCommentDetail, listYahooFinanceNews, listYahooIds, listNewYorkTimesNews } from '@/lib/api'
import htmlToPlainText from "@/moudle/htmlToPlainText.js";

// import AppHeader from '@/layouts/header/AppHeader.vue'
// import AppSidebar from '@/layouts/Right Sidebar/AppSidebar.vue'


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
const loadingList = ref(false)
const listError = ref('')
const items = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(50)
const timeRange = ref(null)
const keyword = ref('')
const allSelectLoading = ref(false)
const allSelectError = ref('')

const selectedMap = ref({})
const yahooSelectedData = ref({})
const nytimesSelectedData = ref({})
// 存储通过"全部选中"从后端获取的全部文章（title+content），key 为 "source:id"
const bulkSelectedArticles = ref({})
const industryChartData = ref(null)
// industry 相关变量和方法已迁移至 views/Industryanalyse.vue
const chartEl = ref(null)
let chartInstance = null
let chartDom = null
const moodChartEl = ref(null)
let moodChartInstance = null
let moodDom = null

const chartPreviewOpen = ref(false)
const chartPreviewTarget = ref('industry')
const chartPreviewEl = ref(null)
let chartPreviewInst = null

const industryanalyseRef = ref(null)
const stockMoodPieRef = ref(null)
const stockMetricsBarRef = ref(null)
const stockThemesBarRef = ref(null)
const selectedId = ref(null)
const loadingDetail = ref(false)
const detailError = ref('')
const detail = ref(null)

const { isDark, toggleTheme } = useTheme({
  onThemeChange: () => {
    if (industryChartData.value) {
      rebuildIndustryCharts()
    }
    if (detail.value && detail.value.kind === 'stock_comment') {
      renderStockCommentCharts(detail.value)
    }
  }
})

const aiLoading = ref(false)
const aiError = ref('')
const aiResult = ref('')

function scriptKeyFromMenu() {
  if (activeMenu.value === 'script_all') return 'all'
  if (activeMenu.value === 'script_comments') return 'comments'
  if (activeMenu.value === 'script_news') return 'news'
  if (activeMenu.value === 'script_realtime') return 'realtime'
  return null
}

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

const groupOpen = ref({ news: true, realtime: true, analysis: true })
const industryReasonText = computed(() => {
  const raw = industryChartData.value?.reason
  if (raw === null || raw === undefined) return ''
  return String(raw)
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
})

async function loadList() {
  if (scriptKeyFromMenu()) return
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

    const rows = resp?.content || resp?.list || []
    items.value = activeMenu.value === 'comments'
        ? rows.map(r => ({
          id: r.id,
          title: r.stockCode,
          publishTime: r.analysisTime,
          commentTotal: r.totalCommentsAnalyzed,
        }))
        : rows.map(r => ({
          ...r,
          publishTime: r.publishTime || r.time || '',
          summary: activeMenu.value === 'finance' ? (r.summary || r.content || '') : r.summary,
        }))
    total.value = resp?.totalElements || resp?.total || 0
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

const canSelectAllMenu = computed(() => {
  return activeMenu.value === 'general' || activeMenu.value === 'finance' || activeMenu.value === 'yahoo' || activeMenu.value === 'nytimes'
})

const currentSourceSelectedCount = computed(() => {
  return selectedCounts.value[currentSource.value] || 0
})

function clearSourceSelection(source) {
  const next = { ...selectedMap.value }
  for (const k of Object.keys(next)) {
    if (k.startsWith(`${source}:`)) {
      delete next[k]
    }
  }
  selectedMap.value = next
  if (source === 'yahoo') yahooSelectedData.value = {}
  if (source === 'nytimes') nytimesSelectedData.value = {}
}

async function selectAllResults() {
  const source = currentSource.value
  // 如果已有勾选，则全部取消
  if (currentSourceSelectedCount.value > 0) {
    clearSourceSelection(source)
    // 同时清除该 source 的批量文章缓存
    const nextBulk = { ...bulkSelectedArticles.value }
    for (const k of Object.keys(nextBulk)) {
      if (k.startsWith(`${source}:`)) delete nextBulk[k]
    }
    bulkSelectedArticles.value = nextBulk
    return
  }

  // finance 保持原有的远程全选逻辑（跨分页选中所有）
  if (source === 'finance') {
    allSelectLoading.value = true
    allSelectError.value = ''
    try {
      const start = timeRange.value?.[0] || ''
      const end = timeRange.value?.[1] || ''
      const q = keyword.value?.trim() || ''
      const resp = await listFinanceIds({ start, end, q, limit: total.value || 5000 })
      const ids = resp?.ids || []
      const truncated = !!resp?.truncated
      const next = { ...selectedMap.value }
      for (const id of ids) {
        next[`finance:${id}`] = true
      }
      selectedMap.value = next
      if (truncated) {
        allSelectError.value = `结果过多，仅选中了前 ${ids.length} 条（limit=${resp?.limit}，total=${resp?.total}）。如需更多请提高后端 limit 上限或缩小筛选范围。`
        alert(allSelectError.value)
      }
    } catch (e) {
      allSelectError.value = e?.message || String(e)
    } finally {
      allSelectLoading.value = false
    }
    return
  }

  // general：远程获取全部 ID（无分页限制），并存储文章数据
  if (source === 'general') {
    allSelectLoading.value = true
    allSelectError.value = ''
    try {
      const start = timeRange.value?.[0] || ''
      const end = timeRange.value?.[1] || ''
      const q = keyword.value?.trim() || ''
      const resp = await listGeneralIds({ start, end, q, limit: total.value || 50000 })
      const ids = resp?.ids || []
      const truncated = !!resp?.truncated
      const next = { ...selectedMap.value }
      for (const id of ids) {
        next[`general:${id}`] = true
      }
      selectedMap.value = next
      // 获取全部列表数据以存储 title/content 等信息
      try {
        const fetchSize = ids.length || (total.value || 50000)
        const listResp = await listGeneral(0, fetchSize, { start, end, q })
        const rows = listResp?.content || listResp?.list || []
        const nextBulk = { ...bulkSelectedArticles.value }
        for (const r of rows) {
          const key = `general:${r.id}`
          if (next[key] && !nextBulk[key]) {
            nextBulk[key] = {
              title: r.title || '',
              content: r.summary || r.content || '',
            }
          }
        }
        bulkSelectedArticles.value = nextBulk
      } catch (bulkErr) {
        console.warn('获取 general 全量文章数据失败，词云分析时将逐条请求详情', bulkErr)
      }
      if (truncated) {
        allSelectError.value = `结果过多，仅选中了前 ${ids.length} 条（limit=${resp?.limit}，total=${resp?.total}）。如需更多请提高后端 limit 上限或缩小筛选范围。`
        alert(allSelectError.value)
      }
    } catch (e) {
      allSelectError.value = e?.message || String(e)
    } finally {
      allSelectLoading.value = false
    }
    return
  }

  // yahoo：远程获取全部 ID（无分页限制），并获取全量文章数据存储
  if (source === 'yahoo') {
    allSelectLoading.value = true
    allSelectError.value = ''
    try {
      const start = timeRange.value?.[0] || ''
      const end = timeRange.value?.[1] || ''
      const q = keyword.value?.trim() || ''
      const resp = await listYahooIds({ start, end, q, limit: total.value || 50000 })
      const ids = resp?.ids || []
      const truncated = !!resp?.truncated
      const next = { ...selectedMap.value }
      for (const id of ids) {
        next[`yahoo:${id}`] = true
      }
      selectedMap.value = next
      // 获取全部列表数据以存储 title/summary 等信息
      try {
        const fetchSize = ids.length || (total.value || 50000)
        const listResp = await listYahooFinanceNews(0, fetchSize, { start, end, q })
        const rows = listResp?.content || listResp?.list || []
        const nextData = { ...yahooSelectedData.value }
        for (const r of rows) {
          const idStr = String(r.id)
          if (next[`yahoo:${idStr}`] && !nextData[idStr]) {
            nextData[idStr] = {
              title: r.title || '',
              displayTime: r.displayTime || '',
              summary: r.summary || '',
            }
          }
        }
        yahooSelectedData.value = nextData
      } catch (bulkErr) {
        // 回退：至少存储当前页面数据
        const nextData = { ...yahooSelectedData.value }
        for (const it of items.value) {
          const idStr = String(it.id)
          if (next[`yahoo:${idStr}`] && !nextData[idStr]) {
            nextData[idStr] = {
              title: it?.title || '',
              displayTime: it?.displayTime || '',
              summary: it?.summary || '',
            }
          }
        }
        yahooSelectedData.value = nextData
        console.warn('获取 yahoo 全量文章数据失败，仅存储当前页数据', bulkErr)
      }
      if (truncated) {
        allSelectError.value = `结果过多，仅选中了前 ${ids.length} 条（limit=${resp?.limit}，total=${resp?.total}）。如需更多请提高后端 limit 上限或缩小筛选范围。`
        alert(allSelectError.value)
      }
    } catch (e) {
      allSelectError.value = e?.message || String(e)
    } finally {
      allSelectLoading.value = false
    }
    return
  }

  // nytimes：直接选中当前已加载的 items，无需发请求
  if (source === 'nytimes') {
    for (const it of items.value) {
      toggleNytimesSelected(it, true)
    }
    return
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
      throw new Error('请先在"雅虎新闻"列表中勾选新闻（可用本页全选）')
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
  // mood array is pairs of [optimistic1, pessimistic1, optimistic2, pessimistic2, ...]
  // Sum all even indices for optimistic, all odd indices for pessimistic
  let optimisticSum = 0
  let pessimisticSum = 0
  for (let i = 0; i < mood.length; i++) {
    const val = Number(mood[i]) || 0
    if (i % 2 === 0) {
      optimisticSum += val
    } else {
      pessimisticSum += val
    }
  }
  const optimistic = optimisticSum || 50
  const pessimistic = pessimisticSum || 50

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

function onIndustryChartDataChanged(parsed) {
  industryChartData.value = parsed
}

watch(industryChartData, async () => {
  await nextTick()
  requestAnimationFrame(() => {
    renderIndustryChart()
    renderMoodChart()
  })
})

function disposeStockCommentCharts() {
  stockMoodPieRef.value?.dispose()
  stockMetricsBarRef.value?.dispose()
  stockThemesBarRef.value?.dispose()
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

  stockMoodPieRef.value?.render()

  if (stockMetricsBarRef.value) {
    nextTick(() => {
      stockMetricsBarRef.value.render()
    })
  }

  const themes = x.mainThemes?.length ? x.mainThemes : []
  if (stockThemesBarRef.value) {
    nextTick(() => {
      stockThemesBarRef.value.render()
    })
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
      loadingDetail.value = false
      await nextTick()
      renderStockCommentCharts(detail.value)
      requestAnimationFrame(() => {
        stockMoodPieRef.value?.resize()
        stockMetricsBarRef.value?.resize()
        stockThemesBarRef.value?.resize()
      })
      return
    }
    const d = activeMenu.value === 'finance'
        ? await getFinanceDetail(id)
        : await getNewsDetail(id)

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

watch(activeMenu, (newVal, oldVal) => {
  page.value = 1
  timeRange.value = null
  keyword.value = ''
  if (oldVal === 'industry' && newVal !== 'industry') {
    industryChartData.value = null
  }
  if (activeMenu.value === 'industry') {
    // echart 历史列表已迁移至 Industryanalyse.vue 自行加载
  } else if (!scriptKeyFromMenu()) {
    loadList()
  }
  // ScriptPanel 组件内部自行管理状态
})

onMounted(() => {
  loadList()
})
</script>

<template>
  <AppHeader
      :activeMenuName="activeMenuName"
      :isDark="isDark"
      :loadingList="loadingList"
      @toggleTheme="toggleTheme"
      @loadList="loadList"
  />

  <div class="layout">
    <AppSidebar
        :menuGroups="menuGroups"
        :groupOpen="groupOpen"
        :activeMenu="activeMenu"
        @toggleGroup="(key) => groupOpen[key] = !groupOpen[key]"
        @selectMenu="(key) => activeMenu = key"
    />
    <RouterView>

    </RouterView>

  </div>


</template>

<style scoped>

</style>