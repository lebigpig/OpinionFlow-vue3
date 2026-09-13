<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import * as echarts from 'echarts'
import { useTheme } from '@/composables/useTheme'
import {
  fetchCompanyList,
  fetchCompanyDetail,
  fetchCompanyReportDetail,
  fetchCompanyIndicatorHistory,
  fetchCompanyStatementHistory,
} from '@/lib/api.js'

const keyword = ref('')
const page = ref(0)
const size = ref(20)
const total = ref(0)
const companies = ref([])
const listLoading = ref(false)
const listError = ref('')

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
    const res = await fetchCompanyList({ keyword: keyword.value, page: page.value, size: size.value })
    companies.value = res?.list || []
    total.value = res?.total || 0
  } catch (e) {
    listError.value = `加载公司列表失败：${e?.message || e}`
    companies.value = []
    total.value = 0
  } finally {
    listLoading.value = false
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
const trendGroup = ref('quarter') // 'quarter' | 'year'
const trendChartEl = ref(null)
const trendChecked = ref({}) // { label: true/false } —— 勾选 = 图表中显示该期数据
let trendChartInst = null

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

const INCOME_TAB_TYPES = ['income', 'balance', 'cashflow']
const TAB_LABELS = { income: '利润表', balance: '资产负债表', cashflow: '现金流量表', indicators: '财务指标' }

/** 打开科目/指标走势图：财务指标按 indicatorCode，利润表/资产负债表/现金流量表按科目名称 */
async function openTrend(row) {
  const companyId = currentCompany.value?.id
  if (!companyId || !row) return
  const tab = readerTab.value
  trendOpen.value = true
  trendLoading.value = true
  trendError.value = ''
  try {
    let points = []
    if (tab === 'indicators') {
      const code = row?.parentItem || row?.indicatorCode
      const res = await fetchCompanyIndicatorHistory(companyId, code)
      points = (res?.points || []).map((p) => ({
        fiscalYear: p.fiscalYear,
        fiscalPeriod: p.fiscalPeriod,
        reportType: p.reportType,
        value: p.indicatorValue,
        valuePrevious: p.valuePrevious,
        yoyChange: p.yoyChange,
      }))
      trendMeta.value = { title: res?.indicatorName || row.itemName || code, sub: code, unit: res?.unit }
    } else {
      const tableType = INCOME_TAB_TYPES.includes(tab) ? tab : 'income'
      const res = await fetchCompanyStatementHistory(companyId, tableType, row.itemName)
      points = (res?.points || []).map((p) => {
        const cur = Number(p.valueCurrent)
        const prev = Number(p.valuePrevious)
        const yoy = Number.isFinite(cur) && Number.isFinite(prev) && prev !== 0 ? ((cur - prev) / prev) * 100 : null
        return { ...p, value: p.valueCurrent, yoyChange: yoy }
      })
      trendMeta.value = { title: row.itemName, sub: TAB_LABELS[tableType] || tableType, unit: points[0]?.unit }
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
  for (const k of Object.keys(trendChecked.value)) trendChecked.value[k] = true
}

function uncheckAllTrend() {
  for (const k of Object.keys(trendChecked.value)) trendChecked.value[k] = false
}

function closeTrend() {
  trendOpen.value = false
  trendChartInst?.dispose()
  trendChartInst = null
  trendPoints.value = []
  trendMeta.value = null
}

function buildTrendOption() {
  const points = trendGroupPoints.value
  const labels = points.map((p) => p.label)
  // 未勾选的期置 null：柱与线留空（x 轴位置保留）
  const valueData = points.map((p) => (trendChecked.value[p.label] ? numOrNull(p.value) : null))
  const yoyData = points.map((p) => (trendChecked.value[p.label] ? numOrNull(p.yoyChange) : null))
  // 一次最多显示 10 个柱/折线点，超出的通过底部滑条 + 图表内拖拽横向浏览
  const MAX_VISIBLE = 10
  const zoomStart = labels.length > MAX_VISIBLE ? labels.length - MAX_VISIBLE : 0
  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: (v) => (v === null || v === undefined ? '-' : fmtAmount(v)),
    },
    legend: { data: ['本期值', '同比%'], bottom: 0 },
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
      { type: 'value', name: '本期值' },
      { type: 'value', name: '同比%', axisLabel: { formatter: '{value}%' } },
    ],
    series: [
      {
        name: '本期值',
        type: 'bar', // 数据柱形图（蓝色）
        color: '#409eff',
        barWidth: 26,
        data: valueData,
        label: { show: true, position: 'top', formatter: (p) => (p.value === null ? '' : fmtAmount(p.value)) },
      },
      {
        name: '同比%',
        type: 'line', // 折线图：同比百分比
        yAxisIndex: 1,
        color: '#f56c6c',
        smooth: true,
        connectNulls: false,
        data: yoyData,
        label: { show: true, formatter: (p) => (p.value === null ? '' : `${fmtAmount(p.value)}%`) },
      },
    ],
  }
}

function renderTrendChart() {
  const el = trendChartEl.value
  if (!el) return
  trendChartInst?.dispose()
  trendChartInst = null
  const points = trendGroupPoints.value
  if (!points.length) {
    trendChartInst?.dispose()
    trendChartInst = null
    return
  }
  trendChartInst = echarts.init(el, isDark.value ? 'dark' : null)
  trendChartInst.setOption(buildTrendOption(), true)
  trendChartInst.resize()
}

// 勾选状态变化 → 即时刷新图表（勾选按钮）
watch(trendChecked, () => {
  if (trendOpen.value && trendChartInst) trendChartInst.setOption(buildTrendOption(), true)
}, { deep: true })

// 切换深浅色 → 图表换肤
watch(isDark, () => {
  if (trendOpen.value) nextTick(renderTrendChart)
})

onMounted(loadCompanies)
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
          style="width: 260px"
          @keyup.enter="search"
        />
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
        @row-click="selectCompany"
      >
        <el-table-column prop="companyCode" label="股票代码" width="110" />
        <el-table-column prop="companyName" label="公司全称" min-width="220" />
        <el-table-column prop="shortName" label="简称" width="130" />
        <el-table-column prop="exchange" label="交易所" width="100" />
        <el-table-column prop="industry" label="所属行业" width="160" />
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

    <div v-if="currentCompany" class="panel detailPanel">
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

      <div class="sectionTitle">财报列表（company JOIN financial_report）</div>
      <el-table
        v-if="reports.length"
        :data="reports"
        size="small"
        border
        highlight-current-row
        style="width: 100%; margin-bottom: 12px"
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
        max-height="520"
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

  <!-- 指标走势图：阅读器财务指标 tab 点击“本期值”弹出 -->
  <teleport to="body">
    <transition name="readerFade">
      <div v-if="trendOpen" class="readerOverlay trendOverlay" @click.self="closeTrend">
        <div class="readerPanel trendPanel">
          <div class="readerHead">
            <div class="readerTitleBox">
              <div class="readerTitle">📈 {{ trendMeta?.title || '走势图' }}</div>
              <div class="readerSub">
                {{ currentCompany?.companyName || '' }} · {{ trendMeta?.sub || '' }}
                <span class="readerStat">
                  {{ trendGroup === 'year' ? '年度展示' : '季度展示' }} · 共 {{ trendGroupPoints.length }} 期 · 取消勾选图形隐藏对应数据
                </span>
              </div>
            </div>
            <div class="trendModeGroup">
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
            <div v-loading="trendLoading" ref="trendChartEl" class="trendChart"></div>
            <div class="trendChecks">
              <label v-for="p in trendGroupPoints" :key="p.label" class="trendCheckItem">
                <el-checkbox v-model="trendChecked[p.label]" size="small">{{ p.label }}</el-checkbox>
              </label>
            </div>
          </div>
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
.trendChart { flex: 1; min-height: 0; width: 100%; }
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
</style>
