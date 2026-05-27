import { defineStore } from 'pinia'
import {ref, computed, nextTick, watch} from 'vue'
import {useRoute} from "vue-router";
import {
    aiParseStream,
    getFinanceDetail,
    getNewsDetail,
    getStockCommentDetail,
    saveEchartJson,
    listEchartFiles,
    getEchartDetail,
    createNewSession, chatMemoryStream, listChatSessions, chatMemoryClear, chatMemoryHistory
} from "@/lib/api.js";
import * as echarts from "echarts";
import {useTheme} from "@/composables/useTheme.js";
import {useNewsStore} from "@/stores/NewsStore.js";
import { storeToRefs } from 'pinia' 


export const useIndustryStore = defineStore('industries', () => {
    const { isDark, toggleTheme } = useTheme()
    const newsStore = useNewsStore()
    const {selectedMap, yahooSelectedData, nytimesSelectedData, items, bulkSelectedArticles} = storeToRefs(newsStore)



    const chartPreviewOpen = ref(false)
    const chartPreviewTarget = ref('industry')
    const chartPreviewEl = ref(null)
    let chartPreviewInst = null
    let chartInstance = null
    let chartDom = null
    const chartEl = ref(null)
    const echartHistoryTotal = computed(() => echartHistory.value.length)

    const historyError = ref('')
    const echartHistoryPaginated = computed(() => {
        const sorted = [...echartHistory.value].sort((a, b) => {
            const dateA = new Date(a.createdAt || 0).getTime()
            const dateB = new Date(b.createdAt || 0).getTime()
            return dateB - dateA
        })
        const start = (echartHistoryPage.value - 1) * echartHistoryPageSize.value
        return sorted.slice(start, start + echartHistoryPageSize.value)
    })
    const echartHistory = ref([])
    const echartHistoryLoading = ref(false)
    const echartHistoryPage = ref(1)
    const echartHistoryPageSize = ref(10)

    let moodDom = null
    let moodChartInstance = null
    const moodChartEl = ref(null)

    const industryLoading = ref(false)
    const industryError = ref('')
    const industryAiRaw = ref('')
    const industryChartData = ref(null)
    const industrySavedPath = ref('')
    const industryLastDelta = ref('')
    const industryReasonText = computed(() => {
        const raw = industryChartData.value?.reason
        if (raw === null || raw === undefined) return ''
        return String(raw)
            .replace(/\\r\\n/g, '\n')
            .replace(/\\n/g, '\n')
    })


    // ─── 工具函数 ───────────────────────────────────────

    const openChartPreview = async (target)=> {
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

    function getMoodChartOption() {
        try {
            return moodChartInstance?.getOption?.() || null
        } catch {
            return null
        }
    }

    function getIndustryChartOption() {
        try {
            return chartInstance?.getOption?.() || null
        } catch {
            return null
        }
    }

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

    const runIndustryAnalysis = async ()=> {
        console.log('[runIndustryAnalysis] called, industryLoading before:', industryLoading.value)
        industryLoading.value = true
        industryError.value = ''
        console.log('[runIndustryAnalysis] industryLoading after set true:', industryLoading.value)
        industryAiRaw.value = ''
        industryChartData.value = null
        industrySavedPath.value = ''
        industryLastDelta.value = ''

        try {
            const keys = Object.keys(selectedMap.value)
            if (keys.length === 0) {
                throw new Error('请先在"网易新闻列表/实时财经新闻"里勾选新闻（可用本页全选）')
            }

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
                // 优先从批量缓存中获取
                const cached = bulkSelectedArticles.value[k]
                if (cached) {
                    articles.push({
                        title: cached.title || '',
                        content: cached.content || '',
                    })
                    continue
                }
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
            industryChartData.value = JSON.parse(jsonText)

            const now = new Date()
            const pad = (n) => String(n).padStart(2, '0')
            const filename = `opinionflow-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`
            const saveResp = await saveEchartJson({ filename, jsonText })
            industrySavedPath.value = saveResp?.savedPath || ''

            loadEchartHistory().catch(() => {})
        } catch (e) {
            industryError.value = e?.message || String(e)
        } finally {
            industryLoading.value = false
        }
    }

    const rebuildIndustryCharts =  async () => {
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
    let industryResizeHandler = null
    function renderIndustryChart() {
        if (!chartEl.value || !industryChartData.value) return
        if (chartInstance && chartDom !== chartEl.value) {
            if (industryResizeHandler) window.removeEventListener('resize', industryResizeHandler)
            chartInstance.dispose()
            chartInstance = null
            chartDom = null
        }
        if (!chartInstance) {
            chartDom = chartEl.value
            chartInstance = echarts.init(chartDom, isDark.value ? 'dark' : null)
            industryResizeHandler = () => chartInstance?.resize()
            window.addEventListener('resize', industryResizeHandler)
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

    let moodResizeHandler = null
    function renderMoodChart() {
        if (!moodChartEl.value || !industryChartData.value) return
        if (moodChartInstance && moodDom !== moodChartEl.value) {
            if (moodResizeHandler) window.removeEventListener('resize', moodResizeHandler)
            moodChartInstance.dispose()
            moodChartInstance = null
            moodDom = null
        }
        if (!moodChartInstance) {
            moodDom = moodChartEl.value
            moodChartInstance = echarts.init(moodDom, isDark.value ? 'dark' : null)
            moodResizeHandler = () => moodChartInstance?.resize()
            window.addEventListener('resize', moodResizeHandler)
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

    function closeChartPreview() {
        chartPreviewOpen.value = false
        chartPreviewInst?.dispose()
        chartPreviewInst = null
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

    const loadIndustryFromHistory = async (item)=> {
        historyError.value = ''
        try {
            const resp = await getEchartDetail(item.id)
            let content = resp?.content
            if (!content) throw new Error('文件内容为空')
            // content is already a parsed object from backend, but handle string case too
            let parsed
            if (typeof content === 'string') {
                parsed = JSON.parse(content)
            } else {
                parsed = content
            }
            industryAiRaw.value = JSON.stringify(parsed, null, 2)
            industryChartData.value = parsed
            industrySavedPath.value = `/echart/${item.filename || item.id}`
            // 不需要手动 rebuild，watch(industryChartData) 会自动触发渲染
        } catch (e) {
            historyError.value = `加载失败：${e?.message || String(e)}`
        }
    }


    watch(industryChartData, async () => {
        await nextTick()
        // v-if 从 false→true 时，first rAF 触发布局，second rAF 才能拿到正确的宽高
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                renderIndustryChart()
                renderMoodChart()
            })
        })
    }, { deep: true })
    return {
        industryChartData,
        industryReasonText,
        industryLoading,
        industryAiRaw,
        industryError,

        openChartPreview,
        runIndustryAnalysis,
        rebuildIndustryCharts,

        loadIndustryFromHistory,
        loadEchartHistory,


        historyError,
        echartHistory,
        echartHistoryPaginated,
        echartHistoryTotal,
        echartHistoryPage,

        chartEl,
        moodChartEl,

        chartPreviewOpen,
        chartPreviewTarget,
        chartPreviewEl,
        closeChartPreview,
        downloadPreview,
    }
})