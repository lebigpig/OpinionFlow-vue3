import { defineStore } from 'pinia'
import {ref, computed, nextTick} from 'vue'
import { useRoute } from 'vue-router'
import * as echarts from "echarts";
import {useTheme} from "@/composables/useTheme.js";
import { getNewsDetail, getFinanceDetail, getStockCommentDetail,aiParseStream } from '@/lib/api.js'
import { htmlToPlainText } from '@/moudle/htmlToPlainText.js'


export const useDetailsStore = defineStore('details', () => {
  const route = useRoute()
  const { isDark, toggleTheme } = useTheme()
  

  const selectedId = ref(null)
  const loadingDetail = ref(false)
  const detail = ref(null)
  const detailError = ref('')

  const aiLoading = ref(false)
  const aiError = ref('')
  const aiResult = ref('')

  let stockMoodPieInst = null
  let stockMetricsBarInst = null
  let stockThemesBarInst = null

  const stockMoodPieEl = ref(null)
  const stockMetricsBarEl = ref(null)
  const stockThemesBarEl = ref(null)

  // ─── 工具函数 ───────────────────────────────────────
  const openDetail = async (id) => {
    selectedId.value = id
    loadingDetail.value = true
    detailError.value = ''
    detail.value = null
    aiResult.value = ''
    aiError.value = ''
    disposeStockCommentCharts()

    try {
      if (route.path === '/analysis/comments') {
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
          stockMoodPieInst?.resize()
          stockMetricsBarInst?.resize()
          stockThemesBarInst?.resize()
        })
        return
      }
      const d = route.path === '/realtime/finance'
          ? await getFinanceDetail(id)
          : await getNewsDetail(id)

      if (d && (route.path === '/news/general' || route.path === '/news/deepseek')) {
        d.content = htmlToPlainText(d.content)
      }
      detail.value = d
    } catch (e) {
      detailError.value = e?.message || String(e)
    } finally {
      loadingDetail.value = false
    }
  }

  const closeDetail = () => {
    selectedId.value = null
    loadingDetail.value = false
    detailError.value = ''
    detail.value = null
    aiLoading.value = false
    aiError.value = ''
    aiResult.value = ''
    disposeStockCommentCharts()
  }


  const disposeStockCommentCharts = () => {
    stockMoodPieInst?.dispose()
    stockMoodPieInst = null
    stockMetricsBarInst?.dispose()
    stockMetricsBarInst = null
    stockThemesBarInst?.dispose()
    stockThemesBarInst = null
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

  const runAi = async () => {
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
  return {
    // 状态
    selectedId,
    loadingDetail,
    detail,
    detailError,

    // AI 相关状态
    aiLoading,
    aiError,
    aiResult,

    //图的 DOM 引用
    stockMoodPieEl,
    stockMetricsBarEl,
    stockThemesBarEl,

    //图的实例
    stockMoodPieInst,
    stockMetricsBarInst,
    stockThemesBarInst,

    // 方法
    closeDetail,
    disposeStockCommentCharts,
    openDetail,
    renderStockCommentCharts,
    normalizeStockCommentApi,
    runAi,

  }
})