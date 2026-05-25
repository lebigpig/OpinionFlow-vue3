<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useTheme } from './composables/useTheme'
import StockThemesBar from '@/charts/StockComment/StockThemesBar.vue'
import StockMetricsBar from '@/charts/StockComment/StockMetricsBar.vue'
import Industryanalyse from '@/views/Industryanalyse.vue'
import StockMoodPie from '@/charts/StockComment/StockMoodPie.vue'
import AppHeader from '@/layouts/header/AppHeader.vue'
import AppSidebar from '@/layouts/Right Sidebar/AppSidebar.vue'
import ScriptPanel from '@/components/Run Script/ScriptPanel.vue'
import TimeFilter from '@/components/Filter/TimeFilter.vue'
import AICustomAnalysis from '@/views/AICustomAnalysis.vue'
import * as echarts from 'echarts'
import { aiParseStream, getFinanceDetail, getNewsDetail, getStockCommentDetail, listDeepseekMenu, listFinance, listFinanceIds, listGeneral, listGeneralIds, listStockComments, listYahooFinanceNews, listYahooIds, listNewYorkTimesNews } from './lib/api'
import htmlToPlainText from "@/moudle/htmlToPlainText.js";
import MainLayout from "@/layouts/MainLayout.vue";
import { useNewsStore } from './stores/NewsStore'
import { storeToRefs } from 'pinia'

const newsStore = useNewsStore()
const { selectedMap, bulkSelectedArticles, yahooSelectedData, nytimesSelectedData, items, activeMenu, loadingList, listError, total, page, pageSize, timeRange, keyword, allSelectLoading, allSelectError, selectedCounts, currentSource, pageAllSelected, canSelectAllMenu, currentSourceSelectedCount } = storeToRefs(newsStore)
const { selectionKey, isSelectableMenu, isSelected, toggleSelected, toggleYahooSelected, toggleNytimesSelected, toggleSelectAllOnPage, clearSourceSelection, selectAllResults } = newsStore

function scriptKeyFromMenu() {
  if (activeMenu.value === 'script_all') return 'all'
  if (activeMenu.value === 'script_comments') return 'comments'
  if (activeMenu.value === 'script_news') return 'news'
  if (activeMenu.value === 'script_realtime') return 'realtime'
  return null
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

const activeMenuName = computed(() => {
  for (const g of menuGroups) {
    const hit = g.children.find(c => c.key === activeMenu.value)
    if (hit) return hit.name
  }
  return ''
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

    <main class="mainContent">
      <ScriptPanel
        v-if="scriptKeyFromMenu()"
        :activeMenu="activeMenu"
        :activeMenuName="activeMenuName"
      />

      <!-- AI分析 菜单：整块替换为 AICustomAnalysis 组件（内含左右两栏） -->
      <template v-else-if="activeMenu === 'ai_custom'">
        <AICustomAnalysis
          :selectedCounts="selectedCounts"
          :selectedMap="selectedMap"
          :items="items"
          :yahooSelectedData="yahooSelectedData"
          :nytimesSelectedData="nytimesSelectedData"
        />
      </template>

      <!-- 其他菜单：正常两栏布局 -->
      <template v-else>
        <div class="card listCard">
        <div class="cardHeader" v-if="activeMenu !== 'industry'">
          <div style="font-weight:700; font-size: 16px;">列表</div>
          <div class="muted" v-if="total">共 {{ total }} 条</div>
        </div>
        <div class="cardBody">
          <div class="filterBar" v-show="activeMenu !== 'industry'">
            <TimeFilter
              v-model="timeRange"
              @change="() => { page = 1; loadList() }"
            />

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

            <div v-if="canSelectAllMenu" class="filterItem">
              <button class="btn" type="button" @click="selectAllResults" :disabled="allSelectLoading || loadingList">
                {{ allSelectLoading ? '操作中...' : (currentSourceSelectedCount > 0 ? `全部取消勾选（已选${currentSourceSelectedCount}条）` : `全部选中（共${total || 0}条）`) }}
              </button>
            </div>
          </div>

          <div v-if="canSelectAllMenu && allSelectError" class="errorState allSelectAlert" style="padding: 12px 0;">
            <span>{{ allSelectError }}</span>
            <button class="btn sm" type="button" @click="allSelectError = ''" style="margin-left: 8px;">知道了</button>
          </div>

          <!-- 词云分析：reasonBox + 图表在 listCard 顶部 -->
          <template v-if="activeMenu === 'industry'">
            <div v-if="industryChartData?.reason" class="reasonBox" style="margin-top: 0;">
              <div class="chartTitle" style="text-align: center; border-left: none;">分析理由</div>
              <pre class="pre" style="text-align: left;">{{ industryReasonText }}</pre>
            </div>
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
            <div v-if="!industryChartData" class="emptyState">请在右侧详情面板中选择新闻后点击"开始分析"</div>
          </template>

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
                    <template v-else-if="activeMenu === 'finance'">
                      <span class="financeSummary">{{ it.summary || '' }}</span>
                    </template>
                    <template v-else>
                      {{ it.publishTime || '' }}
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
            <Industryanalyse
              ref="industryanalyseRef"
              :selectedMap="selectedMap"
              :bulkSelectedArticles="bulkSelectedArticles"
              :yahooSelectedData="yahooSelectedData"
              :nytimesSelectedData="nytimesSelectedData"
              :items="items"
              @chart-data-changed="onIndustryChartDataChanged"
              @refresh-charts="rebuildIndustryCharts"
            />
          </div>

          <div v-if="activeMenu === 'yahoo'">
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
                <StockMoodPie ref="stockMoodPieRef" :is-dark="isDark" :mood="detail?.mood" />
              </div>
              <div class="chartGroup">
                <div class="chartTitle">核心指标分析</div>
                <StockMetricsBar ref="stockMetricsBarRef" :isDark="isDark" :ivi="parseScore0to100(detail?.ivi) ?? 0" :narrativeCoherence="parseScore0to100(detail?.narrativeCoherence) ?? 0" :infoSourceReliance="parseScore0to100(detail?.infoSourceReliance) ?? 0" :themeCount="Number(detail?.themeCount) || 0" />
              </div>
              <div class="chartGroup">
                <div class="chartTitle">主要叙事主题 (Themes)</div>
                <StockThemesBar ref="stockThemesBarRef" :isDark="isDark" :themes="detail?.mainThemes || []" />
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
              <div v-else class="emptyState sm">点击上方"AI 解析"按钮开始分析</div>
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

@media (max-width: 1200px) {
  .mainContent {
    grid-template-columns: 1fr;
  }
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

.financeSummary {
  font-weight: 700;
  color: var(--text-primary);
  display: inline-block;
}
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

.allSelectAlert {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: color-mix(in srgb, #e74c3c 10%, var(--panel-bg));
  border: 1px solid #e74c3c;
  border-radius: 10px;
  margin: 8px 0;
}

/* 删除按钮 */
</style>