<template>
  <div>
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
      <button class="btn" type="button" @click="$emit('refresh-charts')" :disabled="!industryChartData">刷新图表</button>
    </div>

    <div class="historyBox" v-if="echartHistory.length">
      <div class="chartTitle">历史加载（public/echart）</div>
      <div class="muted" style="margin-bottom: 10px;">
        点击 ID 即可加载对应的 JSON 并重建图表（不会触发 AI 请求）。
      </div>
      <div v-if="historyError" class="errorState" style="padding: 12px 0;">{{ historyError }}</div>
      <div class="historyList">
        <button
          v-for="h in echartHistoryPaginated"
          :key="h.id"
          class="historyItem"
          @click="loadIndustryFromHistory(h)"
          type="button"
        >
          <div class="historyItemMain">
            <span class="historyTime">{{ h.createdAt || '' }}</span>
          </div>
        </button>
      </div>
      <div class="echartPagination" v-if="echartHistoryTotal > echartHistoryPageSize">
        <el-pagination
          v-model:current-page="echartHistoryPage"
          v-model:page-size="echartHistoryPageSize"
          :page-sizes="[10]"
          :total="echartHistoryTotal"
          background
          layout="prev, pager, next, total"
          small
        />
      </div>
    </div>
    <div v-if="industryLoading" class="aiProgress">
      <div class="spinner sm"></div>
      <span>流式分析中... ({{ industryAiRaw.length }} 字符)</span>
    </div>

    <div v-if="industryError" class="errorState">{{ industryError }}</div>

    <div v-if="industryAiRaw" class="reasonBox">
      <div class="chartTitle">AI 原始输出（JSON）</div>
      <pre class="pre">{{ industryAiRaw }}</pre>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { getFinanceDetail, getNewsDetail, saveEchartJson, aiParseStream, listEchartFiles, getEchartDetail } from '../lib/api.js'

const props = defineProps({
  selectedMap: { type: Object, default: () => ({}) },
  bulkSelectedArticles: { type: Object, default: () => ({}) },
  yahooSelectedData: { type: Object, default: () => ({}) },
  nytimesSelectedData: { type: Object, default: () => ({}) },
  items: { type: Array, default: () => [] },
})

const emit = defineEmits(['chart-data-changed', 'refresh-charts'])

/* ── 状态 ── */
const industryLoading = ref(false)
const industryError = ref('')
const industryAiRaw = ref('')
const industryChartData = ref(null)
const industrySavedPath = ref('')
const industryFilenameInput = ref('')

const echartHistory = ref([])
const echartHistoryPage = ref(1)
const echartHistoryPageSize = ref(10)
const historyError = ref('')

/* ── 计算属性 ── */
const selectedCounts = computed(() => {
  const keys = Object.keys(props.selectedMap || {})
  const bySource = { general: 0, finance: 0, yahoo: 0, nytimes: 0, total: 0 }
  for (const k of keys) {
    const source = String(k.split(':')[0] || '')
    if (source in bySource) bySource[source]++
    bySource.total++
  }
  return bySource
})

const industryFilenamePreview = computed(() => {
  const raw = String(industryFilenameInput.value ?? '').trim()
  if (!raw) return ''
  return raw.toLowerCase().endsWith('.json') ? raw : `${raw}.json`
})

const industryFilenameValid = computed(() => {
  const name = industryFilenamePreview.value
  if (!name) return false
  if (/[<>:"/\\|?*\x00-\x1F]/.test(name)) return false
  if (/[. ]$/.test(name)) return false
  if (name.length > 120) return false
  return true
})

const echartHistoryTotal = computed(() => echartHistory.value.length)

const echartHistoryPaginated = computed(() => {
  const sorted = [...echartHistory.value].sort((a, b) => {
    const dateA = new Date(a.createdAt || 0).getTime()
    const dateB = new Date(b.createdAt || 0).getTime()
    return dateB - dateA
  })
  const start = (echartHistoryPage.value - 1) * echartHistoryPageSize.value
  return sorted.slice(start, start + echartHistoryPageSize.value)
})

/* ── 核心方法 ── */
async function runIndustryAnalysis() {
  industryLoading.value = true
  industryError.value = ''
  industryAiRaw.value = ''
  industryChartData.value = null
  industrySavedPath.value = ''

  try {
    const keys = Object.keys(props.selectedMap)
    if (keys.length === 0) {
      throw new Error('请先在"网易新闻列表/实时财经新闻"里勾选新闻（可用本页全选）')
    }

    const articles = []
    for (const k of keys) {
      const [source, idStr] = k.split(':')
      if (source === 'yahoo') {
        const idKey = String(idStr)
        const y = props.yahooSelectedData[idKey] || props.items.find(it => String(it.id) === idKey)
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
        const n = props.nytimesSelectedData[idKey] || props.items.find(it => String(it.id) === idKey)
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
      // 优先从批量缓存中获取
      const cached = props.bulkSelectedArticles[k]
      if (cached) {
        articles.push({
          title: cached.title || '',
          content: cached.content || '',
        })
        continue
      }
      const d = source === 'finance'
        ? await getFinanceDetail(id)
        : await getNewsDetail(id)
      articles.push({
        title: d?.title || '',
        content: d?.content || '',
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
      },
    })

    const jsonText = industryAiRaw.value.trim()
    const parsed = JSON.parse(jsonText)
    industryChartData.value = parsed
    emit('chart-data-changed', parsed)

    if (!industryFilenameValid.value) {
      throw new Error('请先输入合法的保存文件名（不能包含 \\ / : * ? " < > |，并以 .json 结尾）')
    }
    const filename = industryFilenamePreview.value
    const saveResp = await saveEchartJson({ filename, jsonText })
    industrySavedPath.value = saveResp?.savedPath || ''

    loadEchartHistory().catch(() => {})
  } catch (e) {
    industryError.value = e?.message || String(e)
  } finally {
    industryLoading.value = false
  }
}

async function loadEchartHistory() {
  try {
    const list = await listEchartFiles()
    echartHistory.value = Array.isArray(list) ? list : []
  } catch (e) {
    console.error('加载 echart 历史列表失败', e)
  }
}

async function loadIndustryFromHistory(item) {
  historyError.value = ''
  try {
    const resp = await getEchartDetail(item.id)
    let content = resp?.content
    if (!content) throw new Error('文件内容为空')
    let parsed
    if (typeof content === 'string') {
      parsed = JSON.parse(content)
    } else {
      parsed = content
    }
    industryAiRaw.value = JSON.stringify(parsed, null, 2)
    industryChartData.value = parsed
    industrySavedPath.value = `/echart/${item.filename || item.id}`
    emit('chart-data-changed', parsed)
    emit('refresh-charts')
  } catch (e) {
    historyError.value = `加载失败：${e?.message || String(e)}`
  }
}

/* ── 暴露给父组件 ── */
defineExpose({
  industryChartData,
  industryAiRaw,
  loadEchartHistory,
})

onMounted(loadEchartHistory)
</script>

<style scoped>
.scriptForm {
  margin-top: 14px;
  padding: 14px;
  border-radius: 14px;
  border: 1px solid var(--border-color-light);
  background: var(--panel-bg-2);
  display: grid;
  gap: 10px;
}
.scriptRow {
  display: flex;
  align-items: center;
  gap: 10px;
}
.monoInline {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 12px;
}
.actionGroup {
  display: flex;
  gap: 10px;
  margin: 16px 0;
}
.selectedHint {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 10px 0 0;
}
.historyBox {
  margin-top: 14px;
  padding: 16px;
  background: var(--panel-bg-2);
  border-radius: 14px;
  border: 1px solid var(--border-color-light);
}
.historyList {
  display: grid;
  gap: 8px;
  max-height: 240px;
  overflow: auto;
  padding-right: 6px;
}
.historyItem {
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
.historyItem:hover {
  border-color: var(--primary-color);
  transform: translateX(2px);
}
.historyItemMain {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  min-width: 0;
}
.historyTime {
  font-weight: 700;
  font-size: 14px;
  color: var(--text-primary);
}
.chartTitle {
  font-weight: 700;
  font-size: 14px;
  margin-bottom: 12px;
  padding-left: 8px;
  border-left: 4px solid var(--primary-color);
}
.errorState {
  color: #e74c3c;
  padding: 10px 0;
}
.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-color);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
.spinner.sm {
  width: 16px;
  height: 16px;
  border-width: 2px;
}
@keyframes spin { to { transform: rotate(360deg); } }
.aiProgress {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: var(--panel-bg-2);
  border-radius: 10px;
  font-size: 13px;
}
.reasonBox {
  margin-top: 20px;
  padding: 16px;
  background: var(--panel-bg-2);
  border-radius: 14px;
}
.pre {
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 420px;
  overflow: auto;
}
.muted {
  color: var(--text-secondary);
}
.badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  border: 1px solid var(--primary-color);
  color: var(--primary-color);
  font-size: 12px;
  white-space: nowrap;
}
.echartPagination {
  margin-top: 12px;
  display: flex;
  justify-content: center;
}
</style>