<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { storeToRefs } from 'pinia'
import * as echarts from 'echarts'
import { useTheme } from '@/composables/useTheme'
import { useCompanyStore } from '@/stores/CompanyStore'
import {
  fetchCompanyList,
  fetchCompanyDetail,
  fetchCompanyReportDetail,
  fetchCompanyIndicatorHistory,
  fetchCompanyStatementHistory,
  fetchCompanyPeerCompare,
  fetchCompanyStatementPeerCompare,
} from '@/lib/api.js'

const keyword = ref('')
const page = ref(0)
const size = ref(10)
const total = ref(0)
const companies = ref([])
const listLoading = ref(false)
const listError = ref('')

// 列表排序（股票代码 / 公司全称 / 简称 / 交易所 / 所属行业，升序或降序）
const sortBy = ref('companyCode')
const sortDir = ref('asc')

// 行业清单存 Pinia（stores/CompanyStore.js），下拉框直接消费其中的行业
const companyStore = useCompanyStore()
const { industries, industryFilter } = storeToRefs(companyStore)

const currentCompany = ref(null)
const reports = ref([])
const reportsLoading = ref(false)
const currentReportId = ref(null)
const activeTab = ref('income')

// 阅读器（近全屏、半透明浮层，背景可透视）
const readerOpen = ref(false)
const readerTab = ref('income')

const statementLoading = ref(false)
const statementError = ref('')
const income = ref([])
const balance = ref([])
const cashflow = ref([])
const indicators = ref([])

async function loadCompanies() {
  listLoading.value = true
  listError.value = ''
  try {
    const res = await fetchCompanyList({
      keyword: keyword.value,
      industry: industryFilter.value,
      page: page.value,
      size: size.value,
      sortBy: sortBy.value,
      sortDir: sortDir.value,
    })
    companies.value = res?.list || []
    total.value = res?.total || 0
    // 把本次查询到的「所属行业」并入 Pinia，保证下拉框能选到查询结果里的行业
    companyStore.mergeIndustries(companies.value)
  } catch (e) {
    listError.value = `加载公司列表失败：${e?.message || e}`
    companies.value = []
    total.value = 0
  } finally {
    listLoading.value = false
  }
}

// 详情面板 DOM 引用：点击「查看详情」后把视口下移到该面板
const detailPanelRef = ref(null)

/** 视口平滑下移到详情面板顶部 */
function scrollToDetail() {
  const el = detailPanelRef.value
  if (el && typeof el.scrollIntoView === 'function') {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

async function selectCompany(row) {
  currentCompany.value = row
  reports.value = []
  currentReportId.value = null
  income.value = []
  balance.value = []
  cashflow.value = []
  indicators.value = []
  activeTab.value = 'income'
  statementError.value = ''
  reportsLoading.value = true
  // 详情面板一渲染就下移视口（不等数据加载完，点击即响应）
  await nextTick()
  scrollToDetail()
  try {
    const res = await fetchCompanyDetail(row.id)
    currentCompany.value = res?.company || row
    reports.value = res?.reports || []
    if (reports.value.length) {
      currentReportId.value = reports.value[0].id
      await loadStatement()
    }
  } catch (e) {
    statementError.value = `加载财报列表失败：${e?.message || e}`
  } finally {
    reportsLoading.value = false
  }
}

/** 并行拉取某份财报的利润表 / 资产负债表 / 现金流量表 / 财务指标 */
async function loadStatement() {
  if (!currentReportId.value) return
  statementLoading.value = true
  statementError.value = ''
  try {
    const res = await fetchCompanyReportDetail(currentReportId.value)
    income.value = res?.income || []
    balance.value = res?.balance || []
    cashflow.value = res?.cashflow || []
    indicators.value = res?.indicators || []
  } catch (e) {
    statementError.value = `加载报表失败：${e?.message || e}`
  } finally {
    statementLoading.value = false
  }
}

function backToList() {
  currentCompany.value = null
  reports.value = []
  currentReportId.value = null
  income.value = []
  balance.value = []
  cashflow.value = []
  indicators.value = []
  // 返回列表：视口滚回顶部，避免停留在已消失的详情位置
  nextTick(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
}

async function onReportRowClick(r) {
  currentReportId.value = r.id
  await loadStatement()
  openReader('income')
}

function openReader(tab) {
  readerTab.value = tab || activeTab.value || 'income'
  readerOpen.value = true
}

function closeReader() {
  readerOpen.value = false
  closeBalancePie()
  closeOverallPie()
}

const currentReportLabel = computed(() => {
  const r = reports.value.find((x) => x.id === currentReportId.value)
  if (!r) return ''
  return [`${r.fiscalYear ?? ''}`, r.fiscalPeriod, r.reportType].filter(Boolean).join(' ')
})

const readerRows = computed(() => {
  switch (readerTab.value) {
    case 'income': return income.value
    case 'balance': return balance.value
    case 'cashflow': return cashflow.value
    case 'indicators': return indicators.value
    default: return []
  }
})

const readerIsIndicator = computed(() => readerTab.value === 'indicators')

const READER_TABS = [
  { key: 'income', label: '利润表' },
  { key: 'balance', label: '资产负债表' },
  { key: 'cashflow', label: '现金流量表' },
  { key: 'indicators', label: '财务指标' },
]

function search() {
  page.value = 0
  loadCompanies()
}

function onPageChange(p) {
  page.value = p - 1
  loadCompanies()
}

/**
 * 表头排序（el-table sortable="custom"）
 * order: 'ascending' | 'descending' | null（取消排序回到默认股票代码升序）
 * 排序交由后端执行，保证分页数据顺序正确
 */
function onSortChange({ prop, order }) {
  if (!prop || !order) {
    sortBy.value = 'companyCode'
    sortDir.value = 'asc'
  } else {
    sortBy.value = prop
    sortDir.value = order === 'ascending' ? 'asc' : 'desc'
  }
  page.value = 0
  loadCompanies()
}

/** 行业下拉框切换（行业清单来自 Pinia） */
function onIndustryChange() {
  page.value = 0
  loadCompanies()
}

const reportOptions = computed(() =>
  reports.value.map((r) => ({
    id: r.id,
    label:
      [`${r.fiscalYear ?? ''}`, r.fiscalPeriod, r.reportType].filter(Boolean).join(' ') || `报告 #${r.id}`,
  })),
)

/** 当前 tab 对应的数据行 */
const activeRows = computed(() => {
  switch (activeTab.value) {
    case 'income': return income.value
    case 'balance': return balance.value
    case 'cashflow': return cashflow.value
    case 'indicators': return indicators.value
    default: return []
  }
})

const isIndicatorTab = computed(() => activeTab.value === 'indicators')

function fmtAmount(v) {
  if (v === null || v === undefined || v === '') return '-'
  const n = Number(v)
  if (!Number.isFinite(n)) return String(v)
  return n.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

/**
 * 同比(%)：
 * - 财务指标行：直接用后端已存好 yoyChange
 * - 利润表 / 资产负债表 / 现金流量表：后端未提供，按 (本期-上期)/上期 计算
 * - 上期缺失或为 0 时返回 null（无法计算，显示 '-'）
 */
function yoyOf(row) {
  const rc = row?.yoyChange
  if (rc !== null && rc !== undefined && rc !== '') return Number(rc)
  const cur = Number(row?.valueCurrent)
  const prev = Number(row?.valuePrevious)
  if (!Number.isFinite(cur) || !Number.isFinite(prev) || prev === 0) return null
  return ((cur - prev) / prev) * 100
}

function indentStyle(row) {
  const lv = Number(row.itemLevel || 0)
  return { paddingLeft: `${Math.max(0, lv) * 14}px` }
}

// ===== 指标走势图：阅读器财务指标 tab 点击“本期值”弹出 =====
const { isDark } = useTheme()

const trendOpen = ref(false)
const trendLoading = ref(false)
const trendError = ref('')
const trendMeta = ref(null) // { indicatorName, indicatorCode, unit }
const trendPoints = ref([]) // 后端返回的全部历史点（财年/期间升序）
const trendLineMode = ref('yoy') // 折线口径：'yoy' 同比% | 'diff' 直接差值（本期值-上期值，扇形图明细走差线）
// 数值口径：'amount' 金额（默认，表格「📈 走势」）| 'ratio' 占比%；
// 从构成占比扇形图点进来看走势时，柱/线/同行业对比全部显示「该明细占所属合计项的比例（%）」而非金额
const trendValueMode = ref('amount')
// 占比分母科目名（扇形图的合计项名称）；ratio 模式下用于取分母科目自身的走势 / 同行业数据
const trendRatioBase = ref('')
const trendGroup = ref('quarter') // 'quarter' | 'year'
const trendChartEl = ref(null)
const trendChecked = ref({}) // { label: true/false } —— 勾选 = 图表中显示该期数据
let trendChartInst = null

// 对比模式：点击走势图中的蓝色柱子 → 切换为「同行业公司横向对比」（无折线图 + Top5 排名）
const trendMode = ref('single') // 'single' 单企业走势 | 'peer' 同行业对比
const peerLoading = ref(false)
const peerError = ref('')
const peerMeta = ref(null) // { indicatorCode, indicatorName, industry, fiscalYear, fiscalPeriod }
const peerPoints = ref([]) // 同行业各公司数据（后端已按指标值降序）
const peerChecked = ref({}) // { companyKey: true/false } —— 勾选 = 对比图中显示该公司

/** 期间排序权重：Q1 < Q2 < H1 < Q3 < Q4 < FY */
function periodRank(p) {
  switch (String(p ?? '').toUpperCase()) {
    case 'Q1': return 1
    case 'Q2': return 2
    case 'H1': return 3
    case 'Q3': return 4
    case 'Q4': return 5
    case 'FY': return 6
    default: return 99
  }
}

/** 当前展示模式（季度/年度）下的点，带 x 轴 label */
const trendGroupPoints = computed(() => {
  if (trendGroup.value !== 'year') {
    return trendPoints.value.map((p) => ({ label: `${p.fiscalYear ?? ''}${p.fiscalPeriod ?? ''}`, ...p }))
  }
  // 年度展示：按财年去重，取该年期间权重最大的一期（优先年报，否则当年最后一期）
  const byYear = new Map()
  for (const p of trendPoints.value) {
    const y = p.fiscalYear
    const prev = byYear.get(y)
    if (!prev || periodRank(p.fiscalPeriod) > periodRank(prev.fiscalPeriod)) {
      byYear.set(y, { ...p })
    }
  }
  return [...byYear.values()]
    .sort((a, b) => (a.fiscalYear || 0) - (b.fiscalYear || 0))
    .map((p) => ({ label: `${p.fiscalYear ?? ''}`, ...p }))
})

function numOrNull(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** 期间唯一键（财年 + 期间 + 报告类型）：用于把「明细科目」与「分母科目（合计项）」的各期数据一一对齐 */
function periodKeyOf(p) {
  return `${p?.fiscalYear ?? ''}|${p?.fiscalPeriod ?? ''}|${p?.reportType ?? ''}`
}

/**
 * 把「明细科目」的各期数值换算成占「分母科目（扇形图合计项）」的比例（%）：
 *   本期占比 = 明细本期值 / 分母本期值 × 100
 *   差值     = 本期占比 - 上期占比（百分点）
 * 分母缺失或为 0 的期按 null 处理（图表留空）。原金额保留在 amount 上，图表只展示占比。
 */
function toRatioPoints(points, basePoints) {
  const baseMap = new Map()
  for (const b of basePoints || []) {
    const k = periodKeyOf(b)
    if (!baseMap.has(k)) baseMap.set(k, b)
  }
  return (points || []).map((p) => {
    const b = baseMap.get(periodKeyOf(p))
    const cur = numOrNull(p.valueCurrent)
    const prev = numOrNull(p.valuePrevious)
    const bCur = numOrNull(b?.valueCurrent)
    const bPrev = numOrNull(b?.valuePrevious)
    const ratioCur = cur !== null && bCur !== null && bCur !== 0 ? (cur / bCur) * 100 : null
    const ratioPrev = prev !== null && bPrev !== null && bPrev !== 0 ? (prev / bPrev) * 100 : null
    return {
      ...p,
      amount: cur,
      value: ratioCur,
      diff: ratioCur !== null && ratioPrev !== null ? ratioCur - ratioPrev : null,
    }
  })
}

const INCOME_TAB_TYPES = ['income', 'balance', 'cashflow']
const TAB_LABELS = { income: '利润表', balance: '资产负债表', cashflow: '现金流量表', indicators: '财务指标' }

/** 打开科目/指标走势图：财务指标按 indicatorCode，利润表/资产负债表/现金流量表按科目名称。
 *  opts.lineMode: 'yoy'（默认，同比%折线）| 'diff'（直接差值折线，用于扇形图明细条目） */
async function openTrend(row, opts = {}) {
  const companyId = currentCompany.value?.id
  if (!companyId || !row) return
  const tab = readerTab.value
  trendOpen.value = true
  trendLineMode.value = opts.lineMode || 'yoy'
  // opts.ratioBase 有值 = 从扇形图点进来的「占比模式」：柱/线/同行业对比都展示占比%而非金额
  trendValueMode.value = opts.ratioBase ? 'ratio' : 'amount'
  trendRatioBase.value = opts.ratioBase || ''
  trendLoading.value = true
  trendError.value = ''
  // 每次打开都回到「单企业分析」模式
  trendMode.value = 'single'
  peerPoints.value = []
  peerMeta.value = null
  peerError.value = ''
  try {
    let points = []
    if (tab === 'indicators') {
      const code = row?.parentItem || row?.indicatorCode
      const res = await fetchCompanyIndicatorHistory(companyId, code)
      points = (res?.points || []).map((p) => {
        const cur = numOrNull(p.indicatorValue)
        const prev = numOrNull(p.valuePrevious)
        return {
          fiscalYear: p.fiscalYear,
          fiscalPeriod: p.fiscalPeriod,
          reportType: p.reportType,
          value: p.indicatorValue,
          valuePrevious: p.valuePrevious,
          yoyChange: p.yoyChange,
          diff: cur !== null && prev !== null ? cur - prev : null,
        }
      })
      trendMeta.value = { kind: 'indicator', title: res?.indicatorName || row.itemName || code, sub: code, code, unit: res?.unit }
    } else {
      const tableType = INCOME_TAB_TYPES.includes(tab) ? tab : 'income'
      const res = await fetchCompanyStatementHistory(companyId, tableType, row.itemName)
      points = (res?.points || []).map((p) => {
        const cur = Number(p.valueCurrent)
        const prev = Number(p.valuePrevious)
        const yoy = Number.isFinite(cur) && Number.isFinite(prev) && prev !== 0 ? ((cur - prev) / prev) * 100 : null
        const diff = Number.isFinite(cur) && Number.isFinite(prev) ? cur - prev : null
        return { ...p, value: p.valueCurrent, yoyChange: yoy, diff }
      })
      // 占比模式：再取一次分母科目（扇形图合计项）的历史，把各期金额换算成「占合计项的比例%」
      if (opts.ratioBase && opts.ratioBase !== row.itemName) {
        const baseRes = await fetchCompanyStatementHistory(companyId, tableType, opts.ratioBase)
        points = toRatioPoints(points, baseRes?.points || [])
      }
      trendMeta.value = {
        kind: 'statement',
        title: opts.ratioBase ? `${row.itemName}（占 ${opts.ratioBase}）` : row.itemName,
        sub: TAB_LABELS[tableType] || tableType,
        tableType,
        itemName: row.itemName,
        ratioBase: opts.ratioBase || '',
        unit: points[0]?.unit,
      }
    }
    trendPoints.value = points
    trendGroup.value = 'quarter'
    syncTrendChecks()
    await nextTick()
    renderTrendChart()
  } catch (e) {
    trendError.value = `加载走势数据失败：${e?.message || e}`
  } finally {
    trendLoading.value = false
  }
}

/** 按当前模式重置勾选（默认全选） */
function syncTrendChecks() {
  const checked = {}
  for (const p of trendGroupPoints.value) checked[p.label] = true
  trendChecked.value = checked
}

function setTrendGroup(g) {
  trendGroup.value = g
  syncTrendChecks()
  renderTrendChart()
}

function checkAllTrend() {
  if (trendMode.value === 'peer') {
    for (const k of Object.keys(peerChecked.value)) peerChecked.value[k] = true
    return
  }
  for (const k of Object.keys(trendChecked.value)) trendChecked.value[k] = true
}

function uncheckAllTrend() {
  if (trendMode.value === 'peer') {
    for (const k of Object.keys(peerChecked.value)) peerChecked.value[k] = false
    return
  }
  for (const k of Object.keys(trendChecked.value)) trendChecked.value[k] = false
}

function closeTrend() {
  trendOpen.value = false
  trendChartInst?.dispose()
  trendChartInst = null
  disposePeerPie()
  closePeerPieZoom()
  trendPoints.value = []
  trendMeta.value = null
  // 关闭时重置对比模式
  trendMode.value = 'single'
  peerPoints.value = []
  peerMeta.value = null
  peerError.value = ''
  // 若走势图是从构成占比扇形图打开的，关闭后自动回到原扇形图浮层（可继续点其他明细查看走势）
  const resumeIds = bsPieResumeIds.value
  bsPieResumeIds.value = null
  if (resumeIds && resumeIds.length) {
    const nodes = resumeIds.map((id) => balanceTree.value.byId.get(id)).filter(Boolean)
    if (nodes.length) {
      bsPiePath.value = nodes
      bsPieOpen.value = true
      nextTick(renderBalancePie)
    }
  }
  // 若走势图是从「总体构成」扇形图打开的，关闭后自动回到该浮层
  if (ovPieResume.value) {
    ovPieResume.value = false
    ovPieOpen.value = true
    nextTick(renderOverallPie)
  }
}

// ===== 同行业对比（点击走势图中的蓝色柱子触发）=====

/** 公司唯一键（用于对比图的公司勾选） */
function peerKey(c) {
  return String(c?.companyId ?? c?.companyCode ?? c?.shortName ?? '')
}

/** 前 5 名（后端已按指标值降序返回） */
const peerTop5 = computed(() => peerPoints.value.slice(0, 5))

/**
 * 扇形图配色：按公司总数均匀分布色相（hsl），保证同行业每家公司颜色都不同；
 * 排名小窗的圆标与扇形图扇区使用同一取色规则，颜色一一对应。
 */
function peerColorAt(i, total) {
  const n = Math.max(total || 0, 1)
  const hue = Math.round((i * 360) / n)
  return `hsl(${hue}, 62%, 52%)`
}

/** 「同行业各公司占比」扇形图数据：涵盖该行业全部公司（剔除空值与负值）
 *  占比模式下 peerPoints 的 value 是各公司「占比%」，此处仍按原始金额 amount 统计各公司占全行业该科目金额合计的比例 */
const peerPieData = computed(() => {
  const total = peerPoints.value.length
  return peerPoints.value
    .map((c, i) => ({
      name: c.shortName || c.companyName || c.companyCode || '',
      value: numOrNull(c.amount ?? c.value),
      color: peerColorAt(i, total), // 先按原名次取色（保证与排名一致），再过滤
    }))
    .filter((d) => d.value !== null && d.value > 0)
})

/** 「全行业占比」扇形图 tooltip：占比模式下只显示百分比，不展示财务金额 */
function peerPieTooltip(p) {
  return trendValueMode.value === 'ratio'
    ? `${p.name}<br/>占全行业 ${p.percent}%`
    : `${p.name}<br/>${fmtAmount(p.value)}（${p.percent}%）`
}

const peerPieEl = ref(null)
let peerPieInst = null

/** 渲染「同行业各公司占比」扇形图（每家公司不同颜色 + 百分比标签） */
function renderPeerPie() {
  const el = peerPieEl.value
  if (!el) return
  peerPieInst?.dispose()
  peerPieInst = null
  const data = peerPieData.value
  if (data.length < 2) return
  peerPieInst = echarts.init(el, isDark.value ? 'dark' : null)
  peerPieInst.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      // 挂到 body，避免被小窗 overflow 裁剪，悬浮说明始终在最上层
      appendToBody: true,
      formatter: peerPieTooltip,
    },
    series: [
      {
        type: 'pie',
        radius: ['28%', '62%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: { borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.45)' },
        // 公司较多时只标注占比 ≥2% 的扇区，避免标签糊在一起（tooltip 可看全部）
        label: {
          show: true,
          fontSize: 9,
          formatter: (p) => (p.percent >= 2 ? `${p.percent}%` : ''),
        },
        labelLine: { length: 4, length2: 4 },
        data: data.map((d) => ({
          name: d.name,
          value: d.value,
          itemStyle: { color: d.color },
        })),
      },
    ],
  })
  peerPieInst.resize()
}

function disposePeerPie() {
  peerPieInst?.dispose()
  peerPieInst = null
}

// ===== 扇形图放大查看（基本占满屏幕，背景半透明） =====
const peerPieZoomOpen = ref(false)
const peerPieZoomEl = ref(null)
let peerPieZoomInst = null

/** 打开放大视图 */
async function openPeerPieZoom() {
  peerPieZoomOpen.value = true
  await nextTick()
  renderPeerPieZoom()
}

function closePeerPieZoom() {
  peerPieZoomOpen.value = false
  peerPieZoomInst?.dispose()
  peerPieZoomInst = null
}

/** 放大后的扇形图：更大半径 + 图例 + 完整"公司名 + 百分比"标签 */
function renderPeerPieZoom() {
  const el = peerPieZoomEl.value
  if (!el) return
  peerPieZoomInst?.dispose()
  peerPieZoomInst = null
  const data = peerPieData.value
  if (!data.length) return
  peerPieZoomInst = echarts.init(el, isDark.value ? 'dark' : null)
  peerPieZoomInst.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      // 关键：挂到 body 上，保证 hover 时的"企业名 + 占比"说明浮层永远在最上层
      appendToBody: true,
      formatter: peerPieTooltip,
    },
    legend: {
      type: 'scroll',
      orient: 'vertical',
      right: 24,
      top: 'middle',
      itemWidth: 12,
      itemHeight: 12,
      textStyle: { fontSize: 12 },
      data: data.map((d) => d.name),
    },
    series: [
      {
        type: 'pie',
        radius: ['26%', '62%'],
        center: ['40%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: { borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.45)' },
        label: {
          show: true,
          fontSize: 12,
          formatter: (p) => `${p.name}\n${p.percent}%`,
        },
        labelLine: { length: 10, length2: 10 },
        data: data.map((d) => ({
          name: d.name,
          value: d.value,
          itemStyle: { color: d.color },
        })),
      },
    ],
  })
  peerPieZoomInst.resize()
}

// ===== 资产负债表 / 利润表 / 现金流量表「合计 → 明细」构成占比扇形图 =====
// 数据只有扁平行 + parent_item + is_total，需要用「排序 + 小计折叠 + 子集求和」还原层级：
//   流动资产合计(220) ← 货币资金(0) / 应收票据(60) / …   （组内 is_total 行收编上方明细）
//   资产总计(470)     ← 流动资产合计(220) + 非流动资产合计(460)（顶层汇总行 = 前面同级合计之和）
//   负债和所有者权益总计 ← 负债合计 + 所有者权益合计

/** 两份金额是否近似相等（校验「合计 = 明细之和」，容忍 0.5% 的源数据缺失/四舍五入误差） */
function nearAmount(a, b) {
  const x = numOrNull(a)
  const y = numOrNull(b)
  if (x === null || y === null) return false
  const tol = Math.max(1, Math.abs(y) * 0.005)
  return Math.abs(x - y) <= tol
}

/** 组内折叠：明细按 sort_order 依次入栈，遇到金额对得上栈内明细之和的 is_total 行，
 *  就把栈内明细收编为它的子节点（形成一层嵌套）；对不上则视为普通明细 */
function foldSubTotals(nodes) {
  const top = []
  const pending = []
  for (const n of nodes) {
    if (n.isTotal && pending.length) {
      const sum = pending.reduce((s, x) => s + x.value, 0)
      if (nearAmount(sum, n.value)) {
        n.children = pending.splice(0, pending.length)
        for (const k of n.children) k.parent = n
      } else {
        top.push(...pending.splice(0, pending.length))
      }
    }
    pending.push(n)
  }
  top.push(...pending)
  return top
}

/**
 * 顶层汇总行（parent_item 为空且 is_total=1：资产总计 / 负债合计 / 所有者权益合计 /
 * 负债和所有者权益总计）的子项，在「排在自己前面的同级汇总节点」里做子集求和匹配：
 * 取偏差最小 → 项数最少 → 最靠近自己的组合（负值项也参与匹配，保证口径正确）
 */
function pickChildSubset(node, pool) {
  const cands = pool
    .filter((c) => c !== node && c.sortOrder < node.sortOrder)
    .sort((a, b) => b.value - a.value)
    .slice(0, 16)
  const tol = Math.max(1, Math.abs(node.value) * 0.005)
  const n = cands.length
  let best = null
  let bestScore = null
  for (let mask = 1; mask < 1 << n; mask++) {
    let sum = 0
    let count = 0
    let minOrder = Infinity
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        sum += cands[i].value
        count++
        if (cands[i].sortOrder < minOrder) minOrder = cands[i].sortOrder
      }
    }
    if (count < 2) continue
    const dev = Math.abs(sum - node.value)
    if (dev > tol) continue
    // 偏差大于 1 元视为近似匹配（排序时排后），优先「完全对得上」的组合
    const score = [dev > 1 ? 1 : 0, count, -minOrder]
    if (
      !bestScore ||
      score[0] < bestScore[0] ||
      (score[0] === bestScore[0] && score[1] < bestScore[1]) ||
      (score[0] === bestScore[0] && score[1] === bestScore[1] && score[2] < bestScore[2])
    ) {
      bestScore = score
      best = cands.filter((_, i) => mask & (1 << i)).sort((a, b) => a.sortOrder - b.sortOrder)
    }
  }
  return best
}

/** 由报表行还原可下钻层级树：{ roots[], nodes[], byId, pieNodes[] } */
function buildBalanceTree(rows) {
  const list = (rows || []).filter((r) => numOrNull(r.valueCurrent) !== null)
  const sorted = [...list].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.id ?? 0) - (b.id ?? 0),
  )
  const nodes = sorted.map((r) => ({
    id: r.id,
    name: r.itemName || '',
    value: numOrNull(r.valueCurrent) ?? 0,
    unit: r.unit || '',
    level: Number(r.itemLevel || 1),
    isTotal: Number(r.isTotal) === 1,
    sortOrder: r.sortOrder ?? 0,
    children: null,
    parent: null,
    depth: 0,
  }))
  const byId = new Map(nodes.map((n) => [n.id, n]))
  // 按 parent_item 分组（流动资产 / 非流动资产 / 流动负债 / 非流动负债 / 所有者权益 …）
  const groups = new Map()
  sorted.forEach((r, i) => {
    const g = (r.parentItem ?? '') || '__root__'
    if (!groups.has(g)) groups.set(g, [])
    groups.get(g).push(nodes[i])
  })
  const groupTops = []
  const rootRows = []
  for (const [g, ns] of groups) {
    if (g === '__root__') rootRows.push(...ns)
    else groupTops.push(...foldSubTotals(ns))
  }
  const pool = [...groupTops, ...rootRows]
  for (const rn of rootRows) {
    if (!rn.isTotal) continue
    const kids = pickChildSubset(rn, pool)
    if (kids) {
      rn.children = kids
      for (const k of kids) k.parent = rn
    }
  }
  const roots = [...groupTops, ...rootRows]
    .filter((n) => !n.parent)
    .sort((a, b) => a.sortOrder - b.sortOrder)
  // 展平出「可查看占比」的合计项（至少 2 个明细才值得画扇形图），供浮层下拉框切换
  const pieNodes = []
  const walk = (node, depth) => {
    node.depth = depth
    if (node.children && node.children.length >= 2) {
      pieNodes.push(node)
      for (const c of node.children) walk(c, depth + 1)
    }
  }
  for (const r of roots) walk(r, 0)
  return { roots, nodes, byId, pieNodes }
}

/**
 * 由现金流量表行还原可下钻层级树：{ roots[], nodes[], byId, pieNodes[] }
 * 现金流量表结构与资产负债表不同，无需小计折叠：
 *   明细行的 parent_item = 其所属「XX活动现金流入/流出小计」的名称（如「销售商品、提供劳务收到的现金」→「经营活动现金流入小计」）；
 *   小计行自身的 parent_item = 活动名（经营活动 / 投资活动 / 筹资活动）。
 * → 直接把 parent_item 指向「名称以“小计”结尾的合计行」的明细行收编为该小计行的子节点即可，
 *   经营 / 投资 / 筹资三大活动的现金流入小计、现金流出小计都能拿到各自构成的占比。
 */
function buildCashFlowTree(rows) {
  const list = (rows || []).filter((r) => numOrNull(r.valueCurrent) !== null)
  const sorted = [...list].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.id ?? 0) - (b.id ?? 0),
  )
  const nodes = sorted.map((r) => ({
    id: r.id,
    name: r.itemName || '',
    value: numOrNull(r.valueCurrent) ?? 0,
    unit: r.unit || '',
    level: Number(r.itemLevel || 1),
    isTotal: Number(r.isTotal) === 1,
    isSubItem: Number(r.isSubItem) === 1,
    parentItem: String(r.parentItem || '').trim(),
    sortOrder: r.sortOrder ?? 0,
    children: null,
    parent: null,
    depth: 0,
  }))
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const byName = new Map()
  for (const n of nodes) {
    const k = n.name.trim()
    if (!byName.has(k)) byName.set(k, [])
    byName.get(k).push(n)
  }
  // 明细行 → 挂到其归属的小计行下（parent_item 指向名称以「小计」结尾的合计行；跳过“其中”附注行）
  for (const n of nodes) {
    if (!n.parentItem || n.isSubItem) continue
    const parent = (byName.get(n.parentItem) || []).find(
      (p) => p.id !== n.id && p.isTotal && p.name.trim().endsWith('小计'),
    )
    if (!parent) continue
    parent.children = parent.children || []
    parent.children.push(n)
    n.parent = parent
  }
  const roots = nodes.filter((n) => !n.parent).sort((a, b) => a.sortOrder - b.sortOrder)
  // 展平出「可查看占比」的合计项（至少 2 个明细才值得画扇形图），供浮层下拉框切换
  const pieNodes = []
  const walk = (node, depth) => {
    node.depth = depth
    if (node.children && node.children.length >= 2) {
      pieNodes.push(node)
      for (const c of node.children) walk(c, depth + 1)
    }
  }
  for (const r of roots) walk(r, 0)
  return { roots, nodes, byId, pieNodes }
}

/** 利润表里允许查看构成占比的汇总行：营业总成本（营业成本/税金及附加/销售费用/管理费用/财务费用…）与
 *  财务费用（其中：利息费用 / 其中：利息收入）。这两个汇总行的明细能构成合计；
 *  其余汇总行（营业利润、利润总额、净利润等）只是报表的局部挂接，明细和与合计不符，画扇形图会误导。 */
const INCOME_PIE_ITEMS = new Set(['营业总成本', '财务费用'])

/**
 * 由利润表行还原可下钻层级树：{ roots[], nodes[], byId, pieNodes[] }
 * 利润表的明细行 parent_item = 其上级汇总行名称（营业成本→营业总成本，财务费用→营业总成本，
 * 「其中：利息费用」→财务费用 …）。按 parent_item 直挂即可还原层级；
 * 「其中」附注行本身就是财务费用等的构成明细，因此与现金流量表相反，这里需要保留。
 */
function buildIncomeTree(rows) {
  const list = (rows || []).filter((r) => numOrNull(r.valueCurrent) !== null)
  const sorted = [...list].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.id ?? 0) - (b.id ?? 0),
  )
  const nodes = sorted.map((r) => ({
    id: r.id,
    name: r.itemName || '',
    value: numOrNull(r.valueCurrent) ?? 0,
    unit: r.unit || '',
    level: Number(r.itemLevel || 1),
    isTotal: Number(r.isTotal) === 1,
    isSubItem: Number(r.isSubItem) === 1,
    parentItem: String(r.parentItem || '').trim(),
    sortOrder: r.sortOrder ?? 0,
    children: null,
    parent: null,
    depth: 0,
  }))
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const byName = new Map()
  for (const n of nodes) {
    const k = n.name.trim()
    if (!byName.has(k)) byName.set(k, [])
    byName.get(k).push(n)
  }
  // 明细行 → 挂到 parent_item 指向的上级行（同名节点可能多行，取第一个非自身）
  for (const n of nodes) {
    if (!n.parentItem) continue
    const parent = (byName.get(n.parentItem) || []).find((p) => p.id !== n.id)
    if (!parent) continue
    parent.children = parent.children || []
    parent.children.push(n)
    n.parent = parent
  }
  const roots = nodes.filter((n) => !n.parent).sort((a, b) => a.sortOrder - b.sortOrder)
  // 展平出「可查看占比」的汇总行（营业总成本 / 财务费用且至少 2 个明细），供浮层下拉框切换
  const pieNodes = []
  const walk = (node, depth) => {
    node.depth = depth
    if (node.children && node.children.length >= 2 && INCOME_PIE_ITEMS.has(node.name)) {
      pieNodes.push(node)
      for (const c of node.children) walk(c, depth + 1)
    }
  }
  for (const r of roots) walk(r, 0)
  return { roots, nodes, byId, pieNodes }
}

/** 节点的祖先链（含自身），用于面包屑与「上一层」 */
function balanceNodePath(node) {
  const path = []
  let cur = node
  while (cur) {
    path.unshift(cur)
    cur = cur.parent
  }
  return path
}

/** 扇形图配色（按明细项位置取色，右侧列表圆点与扇区一一对应） */
const PIE_PALETTE = [
  '#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#9b59b6', '#1abc9c',
  '#e67e22', '#3498db', '#2ecc71', '#f39c12', '#16a085', '#8e44ad',
  '#c0392b', '#27ae60', '#d35400', '#7f8c8d',
]
function pieColorAt(i) {
  return PIE_PALETTE[i % PIE_PALETTE.length]
}

// 「构成占比」层级树：阅读器在资产负债表 tab 时用 parentItem + 小计折叠还原层级；
// 利润表 tab 按「明细行 parent_item = 上级汇总行名称」直挂（营业总成本 / 财务费用）；
// 现金流量表 tab 按「明细行 parent_item = 小计行名称」直挂（经营/投资/筹资的现金流入、流出小计）。
// 切季度财报后自动重建。
const balanceTree = computed(() => {
  switch (readerTab.value) {
    case 'cashflow': return buildCashFlowTree(cashflow.value)
    case 'income': return buildIncomeTree(income.value)
    default: return buildBalanceTree(balance.value)
  }
})

function balancePieNodeOf(row) {
  return row ? balanceTree.value.byId.get(row.id) || null : null
}

/** 该行是否可以查看构成占比：
 * 资产负债表 tab → 合计项（流动资产/非流动资产/…）至少有 2 个明细；
 * 利润表 tab     → 营业总成本 / 财务费用（明细能构成合计的汇总行）；
 * 现金流量表 tab → 经营/投资/筹资的现金流入小计、现金流出小计至少有 2 个明细 */
function hasBalancePie(row) {
  if (readerTab.value !== 'balance' && readerTab.value !== 'cashflow' && readerTab.value !== 'income') return false
  const node = balancePieNodeOf(row)
  if (!node || !node.children || node.children.length < 2) return false
  if (readerTab.value === 'income' && !INCOME_PIE_ITEMS.has(node.name)) return false
  return true
}

// —— 构成占比浮层状态 ——
const bsPieOpen = ref(false)
const bsPieResumeIds = ref(null) // 从扇形图打开走势图时暂存路径，关闭走势图后自动回到该扇形图浮层
const bsPiePath = ref([]) // 当前节点的祖先链（末位为当前项）
const bsPieChartEl = ref(null)
let bsPieChartInst = null

const bsPieCurrent = computed(() => bsPiePath.value[bsPiePath.value.length - 1] || null)

/** 明细列表（金额 / 占比 / 是否可继续下钻），与扇形图配色一一对应 */
const bsPieRows = computed(() => {
  const node = bsPieCurrent.value
  if (!node || !node.children) return []
  const base = node.children.reduce((s, c) => s + Math.max(c.value, 0), 0)
  return node.children.map((c, i) => ({
    id: c.id,
    name: c.name,
    value: c.value,
    color: pieColorAt(i),
    percent: c.value > 0 && base > 0 ? (c.value / base) * 100 : null,
    drill: !!(c.children && c.children.length >= 2),
  }))
})

/** 明细之和与报表合计的差额（源数据缺失/四舍五入时提示口径） */
const bsPieDiff = computed(() => {
  const node = bsPieCurrent.value
  if (!node || !node.children) return null
  const sum = node.children.reduce((s, c) => s + c.value, 0)
  const diff = sum - node.value
  return Math.abs(diff) > 0.5 ? diff : null
})

/** 是否存在可画扇区的正值明细（明细全为负值/0 时用文字提示代替空白图） */
const bsPieHasSlices = computed(() => bsPieRows.value.some((r) => r.value > 0))

/** 是否存在负值明细（扇形图无法表示负值，只在列表标注） */
const bsPieHasNegative = computed(() => bsPieRows.value.some((r) => r.value < 0))

/** 打开某合计项的构成占比扇形图（阅读器里资产负债表 / 利润表 / 现金流量表的「📊 占比」按钮） */
async function openBalancePie(row) {
  const node = balancePieNodeOf(row)
  if (!node || !node.children) return
  bsPiePath.value = balanceNodePath(node)
  bsPieOpen.value = true
  await nextTick()
  renderBalancePie()
}

function closeBalancePie() {
  bsPieOpen.value = false
  bsPiePath.value = []
  bsPieChartInst?.dispose()
  bsPieChartInst = null
}

/** 点击构成占比扇形图里的明细条目（扇区 / 右侧列表行）→ 打开该科目的走势图：
 *  企业自身往期排列的蓝色本期值柱 + 直接差值折线（样式与阅读器表格的走势图完全一致），
 *  点击蓝色柱子同样进入同行业公司横向对比。 */
async function openPieItemTrend(item) {
  const name = item?.name
  if (!name) return
  // 分母 = 当前扇形图的合计项（如「营业总成本」「经营活动现金流入小计」「资产总计」）
  const ratioBase = bsPieCurrent.value?.name || ''
  // 记录当前扇形图路径：关闭走势图后自动回到这张构成占比扇形图，方便连续查看多个明细
  bsPieResumeIds.value = bsPiePath.value.map((n) => n.id)
  closeBalancePie()
  await openTrend({ itemName: name }, { lineMode: 'diff', ratioBase })
}

/** 下钻到某个明细项（该项还有下级时：资产总计 → 流动资产合计 → 货币资金…） */
async function drillBalancePie(id) {
  const node = balanceTree.value.byId.get(id)
  if (!node || !node.children || node.children.length < 2) return
  bsPiePath.value = balanceNodePath(node)
  await nextTick()
  renderBalancePie()
}

/** 上钻一级 */
function bsPieGoUp() {
  if (bsPiePath.value.length <= 1) return
  bsPiePath.value = bsPiePath.value.slice(0, -1)
  nextTick(renderBalancePie)
}

/** 面包屑跳转到某一层 */
function bsPieJumpTo(index) {
  if (index < 0 || index >= bsPiePath.value.length - 1) return
  bsPiePath.value = bsPiePath.value.slice(0, index + 1)
  nextTick(renderBalancePie)
}

/** 浮层顶部下拉框切换要查看的合计项 */
function onBsPieSelect(id) {
  const node = balanceTree.value.byId.get(id)
  if (!node || !node.children) return
  bsPiePath.value = balanceNodePath(node)
  nextTick(renderBalancePie)
}

/** 名称过长时截断（扇形图标签用） */
function shortItemName(name, len = 10) {
  const s = String(name || '')
  return s.length > len ? `${s.slice(0, len)}…` : s
}

/**
 * 渲染构成占比扇形图（负值明细无法用扇形表示，只在右侧列表标注为「负值」）
 * tooltip 挂到 body，保证悬浮说明浮层始终在最上层、不被面板裁剪
 */
function renderBalancePie() {
  const el = bsPieChartEl.value
  if (!el) return
  bsPieChartInst?.dispose()
  bsPieChartInst = null
  const slices = bsPieRows.value.filter((r) => r.value > 0)
  if (!slices.length) return
  bsPieChartInst = echarts.init(el, isDark.value ? 'dark' : null)
  bsPieChartInst.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      appendToBody: true,
      formatter: (p) => {
        const r = slices[p.dataIndex]
        return `${r.name}<br/>${fmtAmount(r.value)}（${p.percent}%）<br/>点击查看历史走势图`
      },
    },
    series: [
      {
        type: 'pie',
        radius: ['32%', '66%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: { borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.45)' },
        label: {
          show: true,
          fontSize: 11,
          formatter: (p) => `${shortItemName(slices[p.dataIndex].name)}\n${p.percent}%`,
        },
        labelLine: { length: 8, length2: 8 },
        data: slices.map((r) => ({
          name: r.name,
          value: r.value,
          itemStyle: { color: r.color, cursor: 'pointer' },
        })),
      },
    ],
  })
  // 点击扇区 → 打开该明细科目的走势图（企业自身往期蓝色本期值柱 + 直接差值折线）
  bsPieChartInst.on('click', (p) => {
    const r = slices[p.dataIndex]
    if (r) openPieItemTrend(r)
  })
  bsPieChartInst.resize()
}

// 切换季度财报 / 重新载入利润表、资产负债表、现金流量表 → 浮层按行 id 重新定位，找不到则自动关闭
watch([income, balance, cashflow], () => {
  if (!bsPieOpen.value) return
  const id = bsPieCurrent.value?.id
  const node = id ? balanceTree.value.byId.get(id) : null
  if (!node || !node.children) {
    closeBalancePie()
    return
  }
  bsPiePath.value = balanceNodePath(node)
  nextTick(renderBalancePie)
})

// 阅读器切到非资产负债表 / 利润表 / 现金流量表 tab → 关闭构成占比浮层（占比数据只对这三张报表有意义）
watch(readerTab, (t) => {
  if (bsPieOpen.value && t !== 'balance' && t !== 'cashflow' && t !== 'income') closeBalancePie()
  // 「总体构成」只针对资产负债表，切到别的 tab 就关掉
  if (ovPieOpen.value && t !== 'balance') closeOverallPie()
})

// 切换季度财报 / 重新载入资产负债表 → 总体构成浮层重绘
watch(balance, () => {
  if (ovPieOpen.value) nextTick(renderOverallPie)
})

// ===== 资产负债表「总体构成」扇形图（四大区域 + 全部明细，占比统一按「占总资产%」）=====
// 数据直接来自现有资产负债表层级树（buildBalanceTree），不需要任何额外接口；
// 点区域 / 明细 → 该科目「占总资产%」的历史走势（蓝柱 + 差值折线）→ 点蓝柱 → 同行业对比，样式与已有完全一致。
const OV_PIE_TOTAL_NAMES = ['资产总计', '负债和所有者权益(或股东权益)总计'] // 分母（总资产）候选名
const OV_PIE_REGIONS = ['流动资产合计', '非流动资产合计', '流动负债合计', '非流动负债合计']

/** 四大区域配色：一个区域一个色相，右侧列表圆标与内环扇区一一对应 */
function ovRegionColor(ri) {
  return `hsl(${(ri * 84 + 6) % 360}, 68%, 52%)`
}

/** 区域内部明细配色：同色相由浅到深，视觉上归到所属区域 */
function ovItemColor(ri, ii, n) {
  const light = 74 - (ii / Math.max(n - 1, 1)) * 32
  return `hsl(${(ri * 84 + 6) % 360}, 62%, ${light.toFixed(0)}%)`
}

const ovPieOpen = ref(false)
const ovPieEl = ref(null)
let ovPieInst = null
const ovPieResume = ref(false) // 从总体构成浮层打开走势图 → 关闭走势图后自动回到该浮层

/**
 * 总体构成数据：分母 = 资产总计；四个区域（流动资产/非流动资产/流动负债/非流动负债）各带全部明细，
 * 每项占比一律按「占总资产%」计算（资产与负债分列报表两侧，故四区域占比之和会大于 100%，属正常）。
 */
const ovPieModel = computed(() => {
  const tree = buildBalanceTree(balance.value)
  const total = OV_PIE_TOTAL_NAMES.map((nm) => tree.nodes.find((n) => n.name === nm)).find((n) => n && n.value)
  if (!total) return null
  const regions = []
  OV_PIE_REGIONS.forEach((nm, ri) => {
    const n = tree.nodes.find((x) => x.name === nm)
    if (!n) return
    const kids = (n.children || []).filter((c) => c !== n)
    regions.push({
      id: n.id,
      name: n.name,
      value: n.value,
      percent: (n.value / total.value) * 100,
      color: ovRegionColor(ri),
      items: kids.map((c, ii) => ({
        id: c.id,
        name: c.name,
        value: c.value,
        percent: (c.value / total.value) * 100,
        color: ovItemColor(ri, ii, kids.length),
      })),
    })
  })
  if (regions.length < 2) return null
  return { totalName: total.name, totalValue: total.value, regions }
})

/** 明细条目总数（浮层标题展示用） */
const ovPieItemCount = computed(() =>
  (ovPieModel.value?.regions || []).reduce((s, r) => s + r.items.length, 0),
)

/** 四区域合计占总资产%（用于浮层提示：资产与负债分列两侧，故合计大于 100%） */
const ovPieSumPercent = computed(() => {
  const m = ovPieModel.value
  if (!m || !m.totalValue) return null
  const sum = m.regions.reduce((s, r) => s + r.value, 0)
  return (sum / m.totalValue) * 100
})

/** 打开资产负债表「总体构成」扇形图（四大区域 + 全部明细，占比均为「占总资产%」） */
async function openOverallPie() {
  if (!ovPieModel.value) return
  ovPieOpen.value = true
  await nextTick()
  renderOverallPie()
}

/** 关闭总体构成扇形图浮层 */
function closeOverallPie() {
  ovPieOpen.value = false
  ovPieInst?.dispose()
  ovPieInst = null
}

/**
 * 渲染总体构成扇形图：内环 = 四大区域，外环 = 各区域全部明细；
 * 两者都以「占总资产%」标注（资产与负债分列报表两侧，故合计大于 100%）。
 */
function renderOverallPie() {
  const el = ovPieEl.value
  const model = ovPieModel.value
  if (!el || !model) return
  ovPieInst?.dispose()
  ovPieInst = null
  const regions = model.regions
  // 内环：四大区域
  const innerData = regions.map((r) => ({ name: r.name, value: r.value, percent: r.percent, itemStyle: { color: r.color } }))
  // 外环：各区域全部明细（区域自身没有下级明细时用区域占位，保证内外环角度对齐）
  const outerData = []
  for (const r of regions) {
    const list = r.items.length
      ? r.items
      : [{ name: r.name, value: r.value, percent: r.percent, color: r.color }]
    for (const it of list) {
      outerData.push({ name: it.name, value: it.value, percent: it.percent, itemStyle: { color: it.color } })
    }
  }
  const center = ['38%', '52%']
  ovPieInst = echarts.init(el, isDark.value ? 'dark' : null)
  ovPieInst.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      // 挂到 body，保证悬浮说明不被面板裁剪
      appendToBody: true,
      formatter: (p) => `${p.name}<br/>${fmtAmount(p.value)}<br/>占总资产 ${fmtAmount(p.data?.percent)}%`,
    },
    series: [
      {
        // 内环：四大区域（占比 = 该区域 / 资产总计）
        type: 'pie',
        radius: ['20%', '42%'],
        center,
        sort: false, // 保持与「资产/负债」顺序一致，外环才能与之对齐
        data: innerData,
        itemStyle: { borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.45)' },
        label: {
          show: true,
          fontSize: 12,
          formatter: (p) => `${shortItemName(p.name, 8)}\n${fmtAmount(p.data?.percent)}%`,
        },
        labelLine: { length: 8, length2: 8 },
      },
      {
        // 外环：各区域全部明细（同样按「占总资产%」）
        type: 'pie',
        radius: ['46%', '70%'],
        center,
        sort: false,
        data: outerData,
        itemStyle: { borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.45)' },
        label: {
          show: true,
          fontSize: 10,
          // 明细较多时只标注占比 ≥2% 的扇区，避免标签糊在一起（tooltip 与右侧列表可看全部）
          formatter: (p) => (numOrNull(p.data?.percent) >= 2 ? `${shortItemName(p.name, 8)} ${fmtAmount(p.data.percent)}%` : ''),
        },
        labelLine: { show: true, length: 6, length2: 6 },
      },
    ],
  })
  // 点击扇区（区域 / 明细）→ 该科目「占总资产%」的历史走势图
  ovPieInst.on('click', (p) => {
    if (p?.name) openOverallItemTrend({ name: p.name })
  })
  ovPieInst.resize()
}

/** 点击总体构成里的区域 / 明细 → 打开该科目「占总资产%」走势图（蓝柱 + 直接差值折线；点蓝柱可对比同行业） */
async function openOverallItemTrend(item) {
  const model = ovPieModel.value
  const name = item?.name
  if (!model || !name) return
  ovPieResume.value = true
  closeOverallPie()
  await openTrend({ itemName: name }, { lineMode: 'diff', ratioBase: model.totalName })
}

/** 重置对比勾选（默认全部选中） */
function syncPeerChecks() {
  const checked = {}
  for (const c of peerPoints.value) checked[peerKey(c)] = true
  peerChecked.value = checked
}

/** 点击蓝柱 → 载入同行业对比数据并切换到对比视图（财务指标 / 三张报表科目都支持） */
async function openPeerCompare(p) {
  const meta = trendMeta.value
  const companyId = currentCompany.value?.id
  if (!meta?.kind || !companyId || !p) return
  const isIndicator = meta.kind === 'indicator'
  // 行业取当前公司所属行业（该行业同时存在于 Pinia 的行业清单中）
  const industry = (currentCompany.value?.industry || industryFilter.value || '').trim()
  trendMode.value = 'peer'
  peerLoading.value = true
  peerError.value = ''
  peerPoints.value = []
  peerMeta.value = {
    kind: meta.kind,
    tableType: meta.tableType,
    indicatorName: meta.title || '',
    industry,
    fiscalYear: p.fiscalYear,
    fiscalPeriod: p.fiscalPeriod,
  }
  try {
    const opts = { industry, fiscalYear: p.fiscalYear, fiscalPeriod: p.fiscalPeriod }
    if (isIndicator) {
      const res = await fetchCompanyPeerCompare(meta.code, opts)
      // 指标后端字段为 indicatorValue —— 统一成 value 供图表与排名复用
      peerPoints.value = (res?.list || []).map((c) => ({
        companyId: c.companyId,
        companyCode: c.companyCode,
        companyName: c.companyName,
        shortName: c.shortName,
        industry: c.industry,
        value: c.indicatorValue,
        valuePrevious: c.valuePrevious,
        yoyChange: c.yoyChange,
      }))
    } else if (trendValueMode.value === 'ratio' && meta.ratioBase) {
      // 占比模式：同时取「明细科目」与「分母科目（合计项）」的同行业数据，逐公司换算成占比%
      const [itemRes, baseRes] = await Promise.all([
        fetchCompanyStatementPeerCompare(meta.tableType, meta.itemName, opts),
        fetchCompanyStatementPeerCompare(meta.tableType, meta.ratioBase, opts),
      ])
      const baseMap = new Map()
      for (const c of baseRes?.list || []) baseMap.set(peerKey(c), numOrNull(c.valueCurrent))
      peerPoints.value = (itemRes?.list || []).map((c) => {
        const v = numOrNull(c.valueCurrent)
        const b = baseMap.get(peerKey(c))
        return {
          companyId: c.companyId,
          companyCode: c.companyCode,
          companyName: c.companyName,
          shortName: c.shortName,
          industry: c.industry,
          amount: v, // 原始金额：仅「全行业占比」扇形图按金额统计用，图表不展示财务数字
          value: v !== null && b !== null && b !== 0 ? (v / b) * 100 : null, // 该科目占自身合计项的比例%
        }
      })
      // 后端按金额降序返回；占比模式下改按占比降序，保证前 5 名排名与配色跟图中数值一致
      peerPoints.value.sort(
        (a, b) => (numOrNull(b.value) ?? Number.NEGATIVE_INFINITY) - (numOrNull(a.value) ?? Number.NEGATIVE_INFINITY),
      )
    } else {
      const res = await fetchCompanyStatementPeerCompare(meta.tableType, meta.itemName, opts)
      // 三张报表为 valueCurrent —— 统一成 value 供图表与排名复用
      peerPoints.value = (res?.list || []).map((c) => ({
        companyId: c.companyId,
        companyCode: c.companyCode,
        companyName: c.companyName,
        shortName: c.shortName,
        industry: c.industry,
        value: c.valueCurrent,
        valuePrevious: c.valuePrevious,
        yoyChange: c.yoyChange,
      }))
    }
    syncPeerChecks()
  } catch (e) {
    peerError.value = `加载同行业对比失败：${e?.message || e}`
  } finally {
    peerLoading.value = false
    await nextTick()
    renderTrendChart()
    renderPeerPie()
  }
}

/** 返回按钮：切回单企业分析 */
function backToSingle() {
  trendMode.value = 'single'
  peerPoints.value = []
  peerMeta.value = null
  peerError.value = ''
  disposePeerPie()
  closePeerPieZoom()
  nextTick(renderTrendChart)
}

/** 图表点击回调（仅单企业模式下点击蓝柱有效；指标与三张报表科目都支持） */
function onTrendChartClick(params) {
  if (trendMode.value !== 'single') return
  if (!trendMeta.value?.kind) return
  if (params?.componentType !== 'series' || params?.seriesType !== 'bar') return
  const point = trendGroupPoints.value[params.dataIndex]
  if (point) openPeerCompare(point)
}

/** 同行业对比柱状图：只保留蓝色柱 + 数值（不要折线图） */
function buildPeerOption() {
  const list = peerPoints.value
  const currentId = currentCompany.value?.id
  // 占比模式：柱子展示各公司「该科目占其自身合计项的比例%」（不是金额）
  const isRatio = trendValueMode.value === 'ratio'
  const barName = isRatio ? '占比%' : '本期值'
  const fmtBar = (v) => (v === null || v === undefined ? '-' : isRatio ? `${fmtAmount(v)}%` : fmtAmount(v))
  const labels = list.map((c) => c.shortName || c.companyName || c.companyCode || '')
  const data = list.map((c) => ({
    // 未勾选的公司置 null（隐藏，但保留 x 轴位置）
    value: peerChecked.value[peerKey(c)] !== false ? numOrNull(c.value) : null,
    // 当前公司用橙色高亮
    itemStyle: { color: c.companyId === currentId ? '#ff9e00' : '#409eff' },
  }))
  const MAX_VISIBLE = 10
  const endValue = Math.min(MAX_VISIBLE - 1, Math.max(labels.length - 1, 0))
  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: fmtBar,
    },
    legend: { data: [barName], bottom: 0 },
    grid: { left: 70, right: 30, top: 30, bottom: 78 },
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: { rotate: labels.length > 6 ? 45 : 0, interval: 0 },
    },
    dataZoom: [
      { type: 'slider', xAxisIndex: 0, startValue: 0, endValue, height: 16, bottom: 40 },
      { type: 'inside', xAxisIndex: 0 },
    ],
    yAxis: { type: 'value', name: barName },
    series: [
      {
        name: barName,
        type: 'bar',
        barWidth: 26,
        data,
        label: {
          show: true,
          position: 'top',
          formatter: (p) => (p.value === null ? '' : isRatio ? `${fmtAmount(p.value)}%` : fmtAmount(p.value)),
        },
      },
    ],
  }
}

function buildTrendOption() {
  const points = trendGroupPoints.value
  const labels = points.map((p) => p.label)
  // 折线口径：默认同比%（扇形图明细条目打开的走势图为“直接差值”）
  const isDiff = trendLineMode.value === 'diff'
  const lineName = isDiff ? '差值' : '同比%'
  // 数值口径：占比模式（从扇形图进入）时柱=占比%、线=占比差值（百分点），全部为百分比，不展示金额
  const isRatio = trendValueMode.value === 'ratio'
  const barName = isRatio ? '占比%' : '本期值'
  // 未勾选的期置 null：柱与线留空（x 轴位置保留）
  const valueData = points.map((p) => (trendChecked.value[p.label] ? numOrNull(p.value) : null))
  const lineData = points.map((p) => (trendChecked.value[p.label] ? numOrNull(isDiff ? p.diff : p.yoyChange) : null))
  const fmtVal = (v) => (v === null || v === undefined ? '-' : isRatio ? `${fmtAmount(v)}%` : fmtAmount(v))
  // 一次最多显示 10 个柱/折线点，超出的通过底部滑条 + 图表内拖拽横向浏览
  const MAX_VISIBLE = 10
  const zoomStart = labels.length > MAX_VISIBLE ? labels.length - MAX_VISIBLE : 0
  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: fmtVal,
    },
    legend: { data: [barName, lineName], bottom: 0 },
    grid: { left: 70, right: 90, top: 36, bottom: 78 },
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: { rotate: labels.length > 10 ? 40 : 25, interval: 0 },
    },
    dataZoom: [
      // 底部滑条：拖动浏览超出 10 个的历史数据
      {
        type: 'slider',
        xAxisIndex: 0,
        startValue: zoomStart,
        endValue: labels.length - 1,
        height: 16,
        bottom: 40,
      },
      // 图表内：鼠标滚轮 / 直接横向拖拽
      { type: 'inside', xAxisIndex: 0, disabled: false },
    ],
    yAxis: [
      { type: 'value', name: barName },
      isDiff
        ? { type: 'value', name: isRatio ? '差值(百分点)' : '差值' }
        : { type: 'value', name: '同比%', axisLabel: { formatter: '{value}%' } },
    ],
    series: [
      {
        name: barName,
        type: 'bar', // 数据柱形图（蓝色）——可点击对比同行业
        color: '#409eff',
        barWidth: 26,
        cursor: 'pointer',
        data: valueData,
        label: {
          show: true,
          position: 'top',
          formatter: (p) => (p.value === null ? '' : isRatio ? `${fmtAmount(p.value)}%` : fmtAmount(p.value)),
        },
      },
      {
        name: lineName,
        type: 'line', // 折线图：同比百分比 / 直接差值（本期值-上期值 / 占比差值）
        yAxisIndex: 1,
        color: '#f56c6c',
        smooth: true,
        connectNulls: false,
        data: lineData,
        label: {
          show: true,
          formatter: (p) => (p.value === null ? '' : isRatio || !isDiff ? `${fmtAmount(p.value)}%` : fmtAmount(p.value)),
        },
      },
    ],
  }
}

function renderTrendChart() {
  const el = trendChartEl.value
  if (!el) return
  trendChartInst?.dispose()
  trendChartInst = null

  // 对比模式：同行业公司横向对比（只有蓝色柱状图，无折线）
  if (trendMode.value === 'peer') {
    if (!peerPoints.value.length) return
    trendChartInst = echarts.init(el, isDark.value ? 'dark' : null)
    trendChartInst.setOption(buildPeerOption(), true)
    trendChartInst.resize()
    return
  }

  // 单企业模式：本期值柱状图 + 同比折线
  const points = trendGroupPoints.value
  if (!points.length) return
  trendChartInst = echarts.init(el, isDark.value ? 'dark' : null)
  trendChartInst.setOption(buildTrendOption(), true)
  // 点击蓝色柱子 → 切换为同行业对比
  trendChartInst.on('click', onTrendChartClick)
  trendChartInst.resize()
}

// 勾选状态变化 → 即时刷新图表（勾选按钮）
watch(trendChecked, () => {
  if (trendOpen.value && trendMode.value === 'single' && trendChartInst) {
    trendChartInst.setOption(buildTrendOption(), true)
  }
}, { deep: true })

// 对比模式的公司勾选 → 即时刷新对比图
watch(peerChecked, () => {
  if (trendOpen.value && trendMode.value === 'peer' && trendChartInst) {
    trendChartInst.setOption(buildPeerOption(), true)
  }
}, { deep: true })

// 切换深浅色 → 图表换肤
watch(isDark, () => {
  if (trendOpen.value) {
    nextTick(() => {
      renderTrendChart()
      renderPeerPie()
      if (peerPieZoomOpen.value) renderPeerPieZoom()
    })
  }
  if (bsPieOpen.value) nextTick(renderBalancePie)
  if (ovPieOpen.value) nextTick(renderOverallPie)
})

onMounted(() => {
  // 首次进入：加载公司列表 + 拉取全部行业存入 Pinia（供行业下拉框选择）
  loadCompanies()
  companyStore.loadIndustries()
})
</script>

<template>
  <div class="companyPage">
    <div class="topbar">
      <div class="title">🏢 中国企业 <span class="muted">（company_china 库）</span></div>
      <div class="searchRow">
        <el-input
          v-model="keyword"
          placeholder="股票代码 / 公司名称"
          clearable
          style="width: 240px"
          @keyup.enter="search"
        />
        <!-- 行业下拉框：选项来自 Pinia（stores/CompanyStore.js 中的 industries） -->
        <el-select
          v-model="industryFilter"
          placeholder="所属行业（全部）"
          clearable
          filterable
          :loading="companyStore.industriesLoading"
          style="width: 200px"
          @change="onIndustryChange"
        >
          <el-option v-for="ind in industries" :key="ind" :label="ind" :value="ind" />
        </el-select>
        <el-button type="primary" @click="search">搜索</el-button>
        <el-button @click="loadCompanies">刷新</el-button>
      </div>
    </div>

    <el-alert v-if="listError" :title="listError" type="error" show-icon :closable="false" />

    <div class="panel">
      <el-table
        :data="companies"
        v-loading="listLoading"
        size="small"
        highlight-current-row
        style="width: 100%"
        :default-sort="{ prop: 'companyCode', order: 'ascending' }"
        @sort-change="onSortChange"
        @row-click="selectCompany"
      >
        <!-- 五列均支持升序 / 降序（点击表头排序，排序由后端执行） -->
        <el-table-column prop="companyCode" label="股票代码" width="110" sortable="custom" />
        <el-table-column prop="companyName" label="公司全称" min-width="220" sortable="custom" />
        <el-table-column prop="shortName" label="简称" width="130" sortable="custom" />
        <el-table-column prop="exchange" label="交易所" width="100" sortable="custom" />
        <el-table-column prop="industry" label="所属行业" width="160" sortable="custom" />
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" text @click.stop="selectCompany(row)">
              查看详情 →
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pager">
        <el-pagination
          layout="total, prev, pager, next"
          :total="total"
          :page-size="size"
          :current-page="page + 1"
          @current-change="onPageChange"
        />
      </div>
    </div>

    <div v-if="currentCompany" ref="detailPanelRef" class="panel detailPanel">
      <div class="detailHead">
        <el-button size="small" @click="backToList">← 返回列表</el-button>
        <span class="companyName">{{ currentCompany.companyName }}</span>
        <span class="muted">
          {{ currentCompany.companyCode }}
          · {{ currentCompany.exchange || '-' }}
          · {{ currentCompany.industry || '-' }}
        </span>
        <div class="reportPicker">
          <span class="muted">财报：</span>
          <el-select
            v-model="currentReportId"
            size="small"
            style="width: 240px"
            :disabled="reportsLoading || !reports.length"
            @change="loadStatement"
          >
            <el-option v-for="r in reportOptions" :key="r.id" :label="r.label" :value="r.id" />
          </el-select>
          <span v-if="!reports.length" class="muted">（该公司暂无财报数据）</span>
        </div>
      </div>

      <el-alert v-if="statementError" :title="statementError" type="error" show-icon :closable="false" />

      <div v-if="reports.length" class="sectionTitle">
        各表明细（三表 UNION ALL + 财务指标）
        <el-button size="small" text type="primary" @click="openReader(activeTab)">⛶ 全屏阅读</el-button>
      </div>
      <el-tabs v-if="reports.length" v-model="activeTab">
        <el-tab-pane :label="`利润表 (${income.length})`" name="income" />
        <el-tab-pane :label="`资产负债表 (${balance.length})`" name="balance" />
        <el-tab-pane :label="`现金流量表 (${cashflow.length})`" name="cashflow" />
        <el-tab-pane :label="`财务指标 (${indicators.length})`" name="indicators" />
      </el-tabs>

      <el-table
        v-if="reports.length"
        v-loading="statementLoading"
        :data="activeRows"
        size="small"
        border
        max-height="1550"
        style="width: 100%"
      >
        <el-table-column
          :label="isIndicatorTab ? '指标名称' : '科目'"
          :min-width="isIndicatorTab ? 220 : 260"
        >
          <template #default="{ row }">
            <span v-if="isIndicatorTab">{{ row.itemName }}</span>
            <span v-else :style="indentStyle(row)">{{ row.itemName }}</span>
          </template>
        </el-table-column>
        <el-table-column v-if="!isIndicatorTab" prop="unit" label="单位" width="80" />
        <el-table-column v-if="activeTab === 'cashflow'" prop="activityType" label="活动类型" width="110" />
        <el-table-column :label="isIndicatorTab ? '本期值' : '本期金额'" align="right" min-width="150">
          <template #default="{ row }">
            {{ fmtAmount(row.valueCurrent) }}
          </template>
        </el-table-column>
        <el-table-column label="上期" align="right" min-width="150">
          <template #default="{ row }">{{ fmtAmount(row.valuePrevious) }}</template>
        </el-table-column>
        <el-table-column label="同比(%)" align="right" min-width="110">
          <template #default="{ row }">
            <span v-if="yoyOf(row) !== null">{{ fmtAmount(yoyOf(row)) }}%</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
      </el-table>

      <el-empty
        v-if="reports.length && !statementLoading && !activeRows.length"
        description="该报表暂无数据"
      />

      <div class="sectionTitle">财报列表（company JOIN financial_report）</div>
      <el-table
        v-if="reports.length"
        :data="reports"
        size="small"
        border
        highlight-current-row
        style="width: 100%; margin-bottom: 0"
        @row-click="onReportRowClick"
      >
        <el-table-column prop="fiscalYear" label="财年" width="80" />
        <el-table-column prop="fiscalPeriod" label="期间" width="80" />
        <el-table-column prop="reportType" label="类型" width="110" />
        <el-table-column prop="reportDate" label="报告日期" width="120" />
        <el-table-column prop="publishDate" label="披露日期" width="120" />
        <el-table-column prop="currency" label="币种" width="70" />
        <el-table-column prop="unit" label="单位" width="80" />
        <el-table-column prop="auditStatus" label="审计" width="110" />
        <el-table-column prop="parseStatus" label="解析状态" width="110" />
        <el-table-column label="各表行数（利润 / 资产负债 / 现金流 / 指标）" min-width="250">
          <template #default="{ row }">
            {{ row.incomeCount ?? 0 }} / {{ row.balanceCount ?? 0 }} /
            {{ row.cashflowCount ?? 0 }} / {{ row.indicatorCount ?? 0 }}
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-empty
      v-else
      description="点击上方公司行查看财报（利润表 / 资产负债表 / 现金流量表 / 财务指标）"
    />
  <!-- 阅读器：近全屏半透明浮层（背景可透视，类似阅读器） -->
  <teleport to="body">
    <transition name="readerFade">
      <div v-if="readerOpen" class="readerOverlay" @click.self="closeReader">
        <div class="readerPanel">
          <div class="readerHead">
            <div class="readerTitleBox">
              <div class="readerTitle">📊 {{ currentCompany?.companyName || '' }}</div>
              <div class="readerSub">
                {{ currentCompany?.companyCode || '' }} · 报告 {{ currentReportLabel || '-' }}
                <span class="readerStat">
                  利润表 {{ income.length }} · 资产负债表 {{ balance.length }} · 现金流量表 {{ cashflow.length }} · 财务指标 {{ indicators.length }}
                </span>
              </div>
            </div>
            <!-- 阅读器内财报（季度）切换下拉框 -->
            <div class="readerPicker">
              <span class="readerPickerLabel">财报：</span>
              <el-select
                v-model="currentReportId"
                size="small"
                style="width: 220px"
                popper-class="readerSelectPopper"
                :disabled="reportsLoading || !reports.length"
                @change="loadStatement"
              >
                <el-option v-for="r in reportOptions" :key="r.id" :label="r.label" :value="r.id" />
              </el-select>
            </div>
            <button
              v-if="readerTab === 'balance'"
              type="button"
              class="ovPieEntryBtn"
              title="以「资产总计」为分母，查看流动资产 / 非流动资产 / 流动负债 / 非流动负债 四大区域及全部明细占总资产的百分比扇形图（点击可看走势图与同行业对比）"
              @click="openOverallPie"
            >📊 总体构成（占总资产%）</button>
            <div class="readerTabs">
              <button
                v-for="t in READER_TABS"
                :key="t.key"
                type="button"
                class="readerTabBtn"
                :class="{ active: readerTab === t.key }"
                @click="readerTab = t.key"
              >{{ t.label }}</button>
            </div>
            <button type="button" class="readerClose" @click="closeReader">✕ 关闭</button>
          </div>

          <div v-loading="statementLoading" class="readerBody">
            <el-table :data="readerRows" size="small" border height="100%" style="width: 100%">
              <el-table-column
                :label="readerIsIndicator ? '指标名称' : '科目'"
                :min-width="readerIsIndicator ? 280 : 360"
              >
                <template #default="{ row }">
                  <span v-if="readerIsIndicator">{{ row.itemName }}</span>
                  <span v-else :style="indentStyle(row)">{{ row.itemName }}</span>
                </template>
              </el-table-column>
              <el-table-column v-if="readerIsIndicator" prop="parentItem" label="指标编码" width="180" />
              <el-table-column v-if="!readerIsIndicator" prop="unit" label="单位" width="90" />
              <el-table-column
                v-if="readerTab === 'cashflow'"
                prop="activityType"
                label="活动类型"
                width="140"
              />
              <el-table-column :label="readerIsIndicator ? '本期值' : '本期金额'" align="right" min-width="180">
                <template #default="{ row }">
                  <button
                    type="button"
                    class="indicatorValBtn"
                    :title="readerIsIndicator ? '点击查看该指标历史走势' : '点击查看该科目历史走势'"
                    @click.stop="openTrend(row)"
                  >
                    {{ fmtAmount(row.valueCurrent) }} 📈
                  </button>
                  <!-- 资产负债表合计项 / 利润表营业总成本与财务费用 / 现金流量表流入流出小计（经营 · 投资 · 筹资）的构成占比扇形图 -->
                  <button
                    v-if="hasBalancePie(row)"
                    type="button"
                    class="bsPieBtn"
                    title="查看该项的构成占比扇形图（点条目看走势图 / 可逐级下钻）"
                    @click.stop="openBalancePie(row)"
                  >
                    📊 占比
                  </button>
                </template>
              </el-table-column>
              <el-table-column label="上期" align="right" min-width="180">
                <template #default="{ row }">{{ fmtAmount(row.valuePrevious) }}</template>
              </el-table-column>
              <el-table-column label="同比(%)" align="right" min-width="130">
                <template #default="{ row }">
                  <span v-if="yoyOf(row) !== null">{{ fmtAmount(yoyOf(row)) }}%</span>
                  <span v-else>-</span>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </div>
    </transition>
  </teleport>

  <!-- 资产负债表/利润表/现金流量表「合计 → 明细」构成占比扇形图浮层：可下拉切换合计项 / 点条目看走势图 / 点「下钻」逐级下钻 -->
  <teleport to="body">
    <transition name="readerFade">
      <div v-if="bsPieOpen" class="peerPieZoomOverlay bsPieOverlay" @click.self="closeBalancePie">
        <div class="peerPieZoomPanel bsPiePanel">
          <div class="peerPieZoomHead">
            <div class="peerPieZoomTitle">
              📊 {{ bsPieCurrent?.name || '' }} · 构成占比
              <span class="peerPieZoomSub">
                {{ currentCompany?.companyName || '' }} · {{ currentReportLabel || '' }}
                · 明细 {{ bsPieRows.length }} 项 · 报表合计 {{ fmtAmount(bsPieCurrent?.value) }}
              </span>
            </div>
            <div class="bsPieTools">
              <button
                v-if="bsPiePath.length > 1"
                type="button"
                class="readerClose"
                title="返回上一层合计项"
                @click="bsPieGoUp"
              >⤴ 上一层</button>
              <button type="button" class="readerClose" @click="closeBalancePie">✕ 关闭</button>
            </div>
          </div>

          <div class="bsPieToolbar">
            <span class="readerPickerLabel">切换报表项：</span>
            <el-select
              :model-value="bsPieCurrent?.id"
              size="small"
              style="width: 360px"
              popper-class="readerSelectPopper bsPieSelectPopper"
              @change="onBsPieSelect"
            >
              <el-option
                v-for="n in balanceTree.pieNodes"
                :key="n.id"
                :label="`${'　'.repeat(n.depth)}${n.name}（${n.children.length} 项）`"
                :value="n.id"
              />
            </el-select>
            <span class="bsPieCrumb">
              <template v-for="(p, i) in bsPiePath" :key="p.id">
                <span v-if="i > 0" class="bsPieCrumbSep">›</span>
                <a
                  class="bsPieCrumbLink"
                  :class="{ current: i === bsPiePath.length - 1 }"
                  @click="bsPieJumpTo(i)"
                >{{ p.name }}</a>
              </template>
            </span>
          </div>

          <div class="bsPieBody">
            <div class="bsPieChartWrap">
              <div v-if="bsPieHasSlices" ref="bsPieChartEl" class="bsPieChart"></div>
              <div v-else class="bsPieEmptyTip">
                该合计项的明细均为负值或 0，无法用扇形图表示，请查看右侧明细列表
              </div>
            </div>
            <div class="bsPieList">
              <div class="bsPieListTitle">明细构成（点击查看走势图）</div>
              <div
                v-for="r in bsPieRows"
                :key="r.id"
                class="bsPieRow"
                :class="{ drill: r.drill }"
                title="点击查看该科目的历史走势图（企业自身往期，蓝色柱子可对比同行业）"
                @click="openPieItemTrend(r)"
              >
                <span class="bsPieDot" :style="{ background: r.color }"></span>
                <span class="bsPieRowName" :title="r.name">{{ r.name }}</span>
                <span class="bsPieRowVal">{{ fmtAmount(r.value) }}</span>
                <span class="bsPieRowPct">{{ r.percent === null ? '负值' : `${r.percent.toFixed(2)}%` }}</span>
                <span
                  v-if="r.drill"
                  class="bsPieDrillHint"
                  title="查看该明细的下级构成"
                  @click.stop="drillBalancePie(r.id)"
                >下钻</span>
              </div>
              <div v-if="!bsPieRows.length" class="bsPieListEmpty">该合计项暂无可拆分的明细</div>
              <div v-if="bsPieHasNegative" class="bsPieNote">
                ⚠ 负值明细不计入扇形图（占比按正值明细合计计算，见右侧「负值」标注）
              </div>
              <div v-if="bsPieDiff !== null" class="bsPieNote">
                ⚠ 明细合计与报表合计相差 {{ fmtAmount(bsPieDiff) }}（源数据缺失或四舍五入），占比按明细金额计算
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </teleport>

  <!-- 资产负债表「总体构成」扇形图浮层：内环=四大区域、外环=各区域全部明细，占比一律「占总资产%」 -->
  <teleport to="body">
    <transition name="readerFade">
      <div v-if="ovPieOpen" class="peerPieZoomOverlay bsPieOverlay" @click.self="closeOverallPie">
        <div class="peerPieZoomPanel bsPiePanel">
          <div class="peerPieZoomHead">
            <div class="peerPieZoomTitle">
              📊 总体构成 · 占总资产%
              <span class="peerPieZoomSub">
                {{ currentCompany?.companyName || '' }} · {{ currentReportLabel || '' }}
                · 明细 {{ ovPieItemCount }} 项 · {{ ovPieModel?.totalName }} {{ fmtAmount(ovPieModel?.totalValue) }}
              </span>
            </div>
            <div class="bsPieTools">
              <button type="button" class="readerClose" @click="closeOverallPie">✕ 关闭</button>
            </div>
          </div>

          <div class="bsPieToolbar">
            <span class="bsPieCrumb">
              <a class="bsPieCrumbLink current">四大区域及其全部明细，占比 = 各项金额 ÷ {{ ovPieModel?.totalName || '资产总计' }}</a>
            </span>
          </div>

          <div class="bsPieBody">
            <div class="bsPieChartWrap">
              <div ref="ovPieEl" class="bsPieChart"></div>
            </div>
            <div class="bsPieList">
              <div class="bsPieListTitle">四大区域及全部明细（占总资产%，点击查看走势图）</div>
              <template v-for="r in ovPieModel?.regions || []" :key="r.id">
                <div
                  class="ovPieGroupHead"
                  title="点击查看该区域历史走势图（占总资产%）"
                  @click="openOverallItemTrend(r)"
                >
                  <span class="bsPieDot" :style="{ background: r.color }"></span>
                  <span class="bsPieRowName">{{ r.name }}</span>
                  <span class="ovPieGroupPct">{{ fmtAmount(r.percent) }}%</span>
                </div>
                <div
                  v-for="it in r.items"
                  :key="it.id"
                  class="bsPieRow"
                  title="点击查看该科目历史走势图（占总资产%）"
                  @click="openOverallItemTrend(it)"
                >
                  <span class="bsPieDot" :style="{ background: it.color }"></span>
                  <span class="bsPieRowName" :title="it.name">{{ it.name }}</span>
                  <span class="bsPieRowVal">{{ fmtAmount(it.value) }}</span>
                  <span class="bsPieRowPct">{{ fmtAmount(it.percent) }}%</span>
                </div>
                <div v-if="!r.items.length" class="bsPieListEmpty">该报表未披露下级明细</div>
              </template>
              <div v-if="ovPieSumPercent !== null" class="bsPieNote">
                ⚠ 四大区域合计占总资产 {{ fmtAmount(ovPieSumPercent) }}%（资产与负债分列报表两侧，故合计大于 100%）
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </teleport>

  <!-- 指标走势图：阅读器财务指标 tab 点击“本期值”弹出 -->
  <teleport to="body">
    <transition name="readerFade">
      <div v-if="trendOpen" class="readerOverlay trendOverlay" @click.self="closeTrend">
        <div class="readerPanel trendPanel">
          <div class="readerHead">
            <div class="readerTitleBox">
              <div class="readerTitle">
                📈 {{ trendMeta?.title || '走势图' }}
                <span v-if="trendMode === 'peer'" class="peerBadge">同行业对比</span>
              </div>
              <div class="readerSub">
                <template v-if="trendMode === 'peer'">
                  {{ peerMeta?.industry || '全部行业' }} · {{ peerMeta?.fiscalYear }}{{ peerMeta?.fiscalPeriod }}
                  · 共 {{ peerPoints.length }} 家公司（橙色为本公司）
                </template>
                <template v-else>
                  {{ currentCompany?.companyName || '' }} · {{ trendMeta?.sub || '' }}
                  <span class="readerStat">
                    {{ trendGroup === 'year' ? '年度展示' : '季度展示' }} · 共 {{ trendGroupPoints.length }} 期
                    <template v-if="trendValueMode === 'ratio'"> · 按占比%（该科目占 {{ trendRatioBase }}）展示</template>
                    <template v-if="trendMeta?.kind"> · 点击蓝柱可对比同行业</template>
                  </span>
                </template>
              </div>
            </div>

            <!-- 对比模式：返回单企业分析 -->
            <button
              v-if="trendMode === 'peer'"
              type="button"
              class="readerTabBtn backBtn"
              @click="backToSingle"
            >← 返回单企业分析</button>

            <!-- 单企业模式：季度 / 年度切换 -->
            <div v-else class="trendModeGroup">
              <button
                type="button"
                class="readerTabBtn"
                :class="{ active: trendGroup === 'quarter' }"
                @click="setTrendGroup('quarter')"
              >季度展示</button>
              <button
                type="button"
                class="readerTabBtn"
                :class="{ active: trendGroup === 'year' }"
                @click="setTrendGroup('year')"
              >年度展示</button>
            </div>

            <div class="trendModeGroup">
              <button type="button" class="readerTabBtn" @click="checkAllTrend">全选</button>
              <button type="button" class="readerTabBtn" @click="uncheckAllTrend">清空</button>
            </div>
            <button type="button" class="readerClose" @click="closeTrend">✕ 关闭</button>
          </div>

          <div class="readerBody trendBody">
            <el-alert
              v-if="trendError"
              :title="trendError"
              type="error"
              show-icon
              :closable="false"
              class="trendErr"
            />
            <el-alert
              v-if="peerError"
              :title="peerError"
              type="error"
              show-icon
              :closable="false"
              class="trendErr"
            />
            <div class="trendMain">
              <div
                v-loading="trendMode === 'peer' ? peerLoading : trendLoading"
                ref="trendChartEl"
                class="trendChart"
              ></div>
              <!-- 对比模式：前 5 名排名小窗 -->
              <div v-if="trendMode === 'peer'" class="peerRank">
                <div class="peerRankTitle">🏆 前 5 名</div>
                <div
                  v-for="(c, i) in peerTop5"
                  :key="peerKey(c)"
                  class="peerRankRow"
                  :class="{ current: c.companyId === currentCompany?.id }"
                >
                  <span class="peerRankNo" :style="{ background: peerColorAt(i, peerPoints.length) }">{{ i + 1 }}</span>
                  <span class="peerRankName" :title="c.companyName || ''">
                    {{ c.shortName || c.companyName || c.companyCode }}
                  </span>
                  <span class="peerRankVal">{{ trendValueMode === 'ratio' ? `${fmtAmount(c.value)}%` : fmtAmount(c.value) }}</span>
                </div>
                <div v-if="!peerTop5.length && !peerLoading" class="peerRankEmpty">暂无数据</div>

                <!-- 同行业全部公司的数值占比扇形图（颜色与排名圆标对应） -->
                <template v-if="peerPieData.length >= 2">
                  <div class="peerPieTitle">
                    📊 全行业占比（{{ peerPieData.length }} 家）
                    <button
                      type="button"
                      class="peerPieZoomBtn"
                      title="放大查看扇形图"
                      @click="openPeerPieZoom"
                    >⛶ 放大</button>
                  </div>
                  <div ref="peerPieEl" class="peerPie"></div>
                </template>
              </div>
            </div>
            <div class="trendChecks">
              <template v-if="trendMode === 'peer'">
                <label v-for="c in peerPoints" :key="peerKey(c)" class="trendCheckItem">
                  <el-checkbox v-model="peerChecked[peerKey(c)]" size="small">
                    {{ c.shortName || c.companyCode }}
                  </el-checkbox>
                </label>
              </template>
              <template v-else>
                <label v-for="p in trendGroupPoints" :key="p.label" class="trendCheckItem">
                  <el-checkbox v-model="trendChecked[p.label]" size="small">{{ p.label }}</el-checkbox>
                </label>
              </template>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </teleport>

  <!-- 扇形图放大查看：基本占满屏幕、背景半透明；鼠标悬浮的说明浮层始终在最上层 -->
  <teleport to="body">
    <transition name="readerFade">
      <div v-if="peerPieZoomOpen" class="peerPieZoomOverlay" @click.self="closePeerPieZoom">
        <div class="peerPieZoomPanel">
          <div class="peerPieZoomHead">
            <div class="peerPieZoomTitle">
              📊 全行业占比 · {{ peerMeta?.indicatorName || trendMeta?.title || '' }}
              <span class="peerPieZoomSub">
                {{ peerMeta?.industry || '全部行业' }} · {{ peerMeta?.fiscalYear }}{{ peerMeta?.fiscalPeriod }}
                · {{ peerPieData.length }} 家
              </span>
            </div>
            <button type="button" class="readerClose" @click="closePeerPieZoom">✕ 关闭</button>
          </div>
          <div ref="peerPieZoomEl" class="peerPieZoomChart"></div>
        </div>
      </div>
    </transition>
  </teleport>
  </div>
</template>

<style scoped>
.companyPage {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px 20px;
  border-radius: 12px;
  background: var(--panel-bg, #fff);
  border: 1px solid var(--border-color-light, #eee);
}
.title { font-weight: 800; font-size: 16px; }
.searchRow { display: flex; align-items: center; gap: 10px; }
.panel {
  border: 1px solid var(--border-color-light, #eee);
  border-radius: 12px;
  background: var(--panel-bg, #fff);
  padding: 12px 16px;
}
.pager { display: flex; justify-content: flex-end; margin-top: 10px; }
.detailPanel { display: flex; flex-direction: column; gap: 10px; }
.detailHead { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.companyName { font-weight: 800; font-size: 15px; }
.reportPicker { display: flex; align-items: center; gap: 8px; margin-left: auto; }
.muted { color: #909399; font-size: 12px; }
.sectionTitle {
  font-weight: 700;
  font-size: 13px;
  padding: 4px 0 8px;
  color: var(--primary-color, #409eff);
}

/* —— 阅读器：近全屏半透明浮层（背景可透视）—— */
.readerOverlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2vh 2vw;
  background: rgba(15, 23, 42, 0.26); /* 半透明遮罩：仍能看到原页面 */
  backdrop-filter: blur(3px);
}
.readerPanel {
  width: 96vw;
  height: 93vh; /* 几乎占满整个屏幕 */
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.80); /* 半透明面板 */
  backdrop-filter: blur(14px) saturate(1.2);
  border: 1px solid rgba(255, 255, 255, 0.55);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.35);
}
.readerHead {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px 16px;
  padding: 12px 18px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  background: rgba(255, 255, 255, 0.5);
}
.readerTitleBox {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.readerTitle { font-weight: 800; font-size: 15px; white-space: nowrap; }
.readerSub {
  font-size: 12px;
  color: #606266;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.readerStat { margin-left: 10px; color: #909399; }
.readerPicker {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
.readerPickerLabel { font-size: 12px; color: #606266; white-space: nowrap; }
.readerTabs { display: flex; gap: 6px; margin-left: auto; flex-wrap: wrap; }
.readerTabBtn {
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: rgba(255, 255, 255, 0.6);
  border-radius: 999px;
  padding: 5px 14px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
  color: #303133;
}
.readerTabBtn:hover { background: #ecf5ff; border-color: #b3d8ff; }
.readerTabBtn.active {
  background: var(--primary-color, #409eff);
  border-color: var(--primary-color, #409eff);
  color: #fff;
  font-weight: 700;
}
.readerClose {
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: rgba(255, 255, 255, 0.6);
  border-radius: 8px;
  padding: 5px 12px;
  font-size: 13px;
  cursor: pointer;
  color: #303133;
}
.readerClose:hover { background: #fef0f0; border-color: #fbc4c4; color: #f56c6c; }
.readerBody {
  flex: 1;
  min-height: 0;
  padding: 0 10px 10px;
  overflow: hidden;
}
/* —— 指标走势图浮层（点击财务指标“本期值”弹出）—— */
.indicatorValBtn {
  appearance: none;
  border: 1px solid transparent;
  background: transparent;
  color: var(--primary-color, #409eff);
  font-weight: 700;
  font-size: 13px;
  padding: 2px 8px;
  border-radius: 8px;
  white-space: nowrap;
  cursor: pointer;
}
.indicatorValBtn:hover { background: rgba(64, 158, 255, 0.12); }
.trendOverlay { z-index: 5000; } /* 高于阅读器(3000)与下拉面板(4000) */
.trendPanel { width: 94vw; height: 96vh; }
.trendBody {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 12px 10px;
  min-height: 0;
}
.trendErr { flex-shrink: 0; }
.trendMain {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 12px;
}
.trendChart { flex: 1; min-height: 0; width: 100%; }

/* —— 对比模式：前 5 名排名小窗 —— */
.peerRank {
  width: 290px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-left: 12px;
  border-left: 1px solid rgba(0, 0, 0, 0.08);
  overflow: auto;
}
.peerRankTitle { font-weight: 800; font-size: 13px; margin-bottom: 2px; }
.peerRankRow {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  padding: 5px 6px;
  border-radius: 6px;
  background: rgba(64, 158, 255, 0.06);
}
.peerRankRow.current {
  background: rgba(255, 158, 0, 0.18);
  font-weight: 700;
}
.peerRankNo {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--primary-color, #409eff);
  color: #fff;
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.peerRankRow.current .peerRankNo { box-shadow: 0 0 0 2px rgba(255, 158, 0, 0.75); }
/* 全行业占比扇形图 */
.peerPieTitle { font-weight: 800; font-size: 12px; margin-top: 10px; }
.peerPie { width: 100%; height: 230px; flex-shrink: 0; }
.peerPieZoomBtn {
  margin-left: 8px;
  border: 1px solid var(--border-color, #dcdfe6);
  background: rgba(255, 255, 255, 0.6);
  color: var(--primary-color, #409eff);
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  padding: 1px 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.peerPieZoomBtn:hover { background: rgba(64, 158, 255, 0.12); }

/* —— 扇形图放大浮层：基本占满屏幕，背景半透明 —— */
.peerPieZoomOverlay {
  position: fixed;
  inset: 0;
  z-index: 7000; /* 高于走势图浮层(5000)，保证在最上层 */
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3vh 3vw;
  background: rgba(15, 23, 42, 0.35);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
}
.peerPieZoomPanel {
  width: 96vw;
  height: 94vh;
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.86);
  backdrop-filter: blur(16px) saturate(1.2);
  -webkit-backdrop-filter: blur(16px) saturate(1.2);
  border: 1px solid rgba(255, 255, 255, 0.55);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.35);
}
.peerPieZoomHead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 18px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}
.peerPieZoomTitle { font-weight: 800; font-size: 15px; }
.peerPieZoomSub { font-size: 12px; color: #606266; font-weight: 400; margin-left: 8px; }
.peerPieZoomChart { flex: 1; min-height: 0; width: 100%; padding: 6px; }
.peerRankName {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.peerRankVal { font-variant-numeric: tabular-nums; }
.peerRankEmpty { font-size: 12px; color: var(--text-muted, #909399); }
.peerBadge {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 999px;
  color: #fff;
  background: #ff9e00;
  vertical-align: middle;
}
.backBtn { font-weight: 700; }
.trendChecks {
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-height: 96px;
  overflow: auto;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  padding-top: 8px;
  background: rgba(255, 255, 255, 0.35);
}
.trendCheckItem { white-space: nowrap; font-size: 12px; }
/* 浮层内表格半透明，保持"可透视"观感 */
.readerBody :deep(.el-table),
.readerBody :deep(.el-table__inner-wrapper),
.readerBody :deep(.el-table tr),
.readerBody :deep(.el-table th.el-table__cell) {
  background-color: rgba(255, 255, 255, 0.72);
}
.readerBody :deep(.el-table__body tr:hover > td.el-table__cell) {
  background-color: rgba(236, 245, 255, 0.9);
}

/* —— 资产负债表合计项「构成占比」按钮 + 浮层 —— */
.bsPieBtn {
  margin-left: 6px;
  border: 1px solid var(--border-color, #dcdfe6);
  background: rgba(255, 255, 255, 0.6);
  color: #e6a23c;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  padding: 1px 8px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}
.bsPieBtn:hover { background: rgba(230, 162, 60, 0.14); border-color: rgba(230, 162, 60, 0.5); }
.bsPieOverlay { z-index: 7200; } /* 高于同行业占比放大浮层(7000) */
.bsPiePanel { width: 96vw; height: 94vh; } /* 基本占满屏幕，背景半透明 */
.bsPieTools { display: flex; gap: 8px; }
.bsPieToolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 10px 18px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}
.bsPieCrumb {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  font-size: 12px;
  color: #606266;
}
.bsPieCrumbSep { color: #c0c4cc; }
.bsPieCrumbLink { color: var(--primary-color, #409eff); cursor: pointer; }
.bsPieCrumbLink.current { color: #303133; font-weight: 700; cursor: default; }
.bsPieBody {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 12px;
  padding: 8px 14px 12px;
}
.bsPieChartWrap { flex: 1; min-height: 0; display: flex; }
.bsPieChart { flex: 1; min-height: 0; width: 100%; }
.bsPieEmptyTip {
  margin: auto;
  max-width: 360px;
  text-align: center;
  font-size: 13px;
  color: var(--text-muted, #909399);
}
.bsPieList {
  width: 420px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-left: 10px;
  border-left: 1px solid rgba(0, 0, 0, 0.08);
  overflow: auto;
}
.bsPieListTitle { font-weight: 800; font-size: 13px; margin-bottom: 4px; }
.bsPieRow {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  padding: 5px 6px;
  border-radius: 6px;
  background: rgba(64, 158, 255, 0.06);
  cursor: pointer;
}
.bsPieRow:hover { background: rgba(64, 158, 255, 0.16); }
.bsPieDot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.bsPieRowName { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bsPieRowVal { font-variant-numeric: tabular-nums; }
.bsPieRowPct {
  width: 64px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: #606266;
}
.bsPieDrillHint {
  flex-shrink: 0;
  font-size: 10px;
  padding: 0 5px;
  border-radius: 999px;
  background: rgba(64, 158, 255, 0.16);
  color: var(--primary-color, #409eff);
  cursor: pointer;
}
.bsPieDrillHint:hover { background: rgba(64, 158, 255, 0.3); }
.bsPieListEmpty { font-size: 12px; color: var(--text-muted, #909399); }
.bsPieNote { margin-top: 6px; font-size: 12px; color: #e6a23c; }

/* —— 资产负债表「总体构成」扇形图：浮层入口按钮 + 区域分组列表 —— */
.ovPieEntryBtn {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid rgba(64, 158, 255, 0.5);
  background: rgba(64, 158, 255, 0.1);
  color: var(--primary-color, #409eff);
  cursor: pointer;
}
.ovPieEntryBtn:hover { background: rgba(64, 158, 255, 0.2); }
.ovPieGroupHead {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 800;
  padding: 5px 6px;
  margin-top: 4px;
  border-radius: 6px;
  background: rgba(230, 162, 60, 0.1);
  cursor: pointer;
}
.ovPieGroupHead:hover { background: rgba(230, 162, 60, 0.2); }
.ovPieGroupPct { flex-shrink: 0; color: #e6a23c; font-variant-numeric: tabular-nums; }

.readerFade-enter-active, .readerFade-leave-active { transition: opacity 0.22s ease; }
.readerFade-enter-from, .readerFade-leave-to { opacity: 0; }
</style>

<style>
/* 阅读器下拉面板（popper 渲染在 <body> 层级，不受 scoped 约束）
   Element Plus popper 默认 z-index = 2000，低于阅读器遮罩 3000，
   会被半透明遮罩盖住导致下拉列表看不见；这里提到阅读器之上。 */
.readerSelectPopper {
  z-index: 4000 !important;
}

/* ── 深色模式：阅读器整体变深灰底 + 白字 ── */
html.dark .readerOverlay {
  background: rgba(0, 0, 0, 0.42);
}
html.dark .readerPanel {
  background: rgba(30, 34, 40, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55);
}
html.dark .readerHead {
  background: rgba(36, 40, 46, 0.72);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
html.dark .readerTitle { color: #f2f4f7; }
html.dark .readerSub { color: #b6bdc9; }
html.dark .readerStat { color: #8d9095; }
html.dark .readerPickerLabel { color: #9aa3ad; }
html.dark .readerTabBtn {
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(58, 64, 74, 0.6);
  color: #cfd3dc;
}
html.dark .readerTabBtn:hover {
  background: rgba(64, 158, 255, 0.16);
  border-color: rgba(64, 158, 255, 0.42);
}
html.dark .readerClose {
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(58, 64, 74, 0.6);
  color: #cfd3dc;
}
html.dark .readerClose:hover {
  background: rgba(245, 108, 108, 0.16);
  border-color: rgba(245, 108, 108, 0.5);
  color: #f56c6c;
}
/* 表格：灰底 + 白字（默认浅色样式特异性更高，必须在此覆盖） */
html.dark .readerBody .el-table,
html.dark .readerBody .el-table__inner-wrapper,
html.dark .readerBody .el-table tr,
html.dark .readerBody .el-table th.el-table__cell,
html.dark .readerBody .el-table td.el-table__cell {
  background-color: rgba(42, 47, 54, 0.88);
  color: #e5eaf3;
}
html.dark .readerBody .el-table__body tr:hover > td.el-table__cell {
  background-color: rgba(64, 158, 255, 0.16);
}

/* 趋势图浮层：勾选区深色适配 */
html.dark .trendChecks {
  border-top-color: rgba(255, 255, 255, 0.12);
  background: rgba(46, 50, 56, 0.5);
}

/* 对比模式：排名小窗深色适配 */
html.dark .peerRank {
  border-left-color: rgba(255, 255, 255, 0.12);
}
html.dark .peerRankRow {
  background: rgba(64, 158, 255, 0.12);
}
html.dark .peerRankRow.current {
  background: rgba(255, 158, 0, 0.22);
}

/* 扇形图放大浮层：深色适配 */
html.dark .peerPieZoomPanel {
  background: rgba(30, 34, 40, 0.92);
  border-color: rgba(255, 255, 255, 0.12);
}
html.dark .peerPieZoomHead {
  border-bottom-color: rgba(255, 255, 255, 0.08);
}
html.dark .peerPieZoomSub { color: #b6bdc9; }
html.dark .peerPieZoomBtn {
  background: rgba(58, 64, 74, 0.6);
  border-color: rgba(255, 255, 255, 0.16);
}

/* 构成占比浮层下拉面板：需高于浮层(7200)，且必须写在 .readerSelectPopper(4000) 之后 */
.bsPieSelectPopper {
  z-index: 7600 !important;
}
html.dark .bsPieToolbar { border-bottom-color: rgba(255, 255, 255, 0.08); }
html.dark .bsPieCrumb { color: #b6bdc9; }
html.dark .bsPieCrumbLink { color: #79bbff; }
html.dark .bsPieCrumbLink.current { color: #e5eaf3; }
html.dark .bsPieRow { background: rgba(64, 158, 255, 0.12); }
html.dark .ovPieEntryBtn {
  border-color: rgba(64, 158, 255, 0.55);
  background: rgba(64, 158, 255, 0.16);
  color: #79bbff;
}
html.dark .ovPieGroupHead { background: rgba(230, 162, 60, 0.16); }
html.dark .ovPieGroupPct { color: #f3c26b; }
html.dark .bsPieRow:hover { background: rgba(64, 158, 255, 0.22); }
html.dark .bsPieRowPct { color: #b6bdc9; }
html.dark .bsPieList { border-left-color: rgba(255, 255, 255, 0.12); }
html.dark .bsPieBtn {
  background: rgba(58, 64, 74, 0.6);
  border-color: rgba(255, 255, 255, 0.16);
}
</style>
