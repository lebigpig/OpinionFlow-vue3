import {defineStore, storeToRefs} from "pinia";
import {useTheme} from "@/composables/useTheme.js";
import {useNewsStore} from "@/stores/NewsStore.js";
import {computed, nextTick, ref} from "vue";
import * as echarts from "echarts";
import {
    aiParseStream, chatMemoryClear, chatMemoryHistory, chatMemoryStream, createNewSession,
    getEchartDetail,
    getFinanceDetail,
    getNewsDetail, listChatSessions,
    listEchartFiles,
    saveEchartJson
} from "@/lib/api.js";

export const useIndustryStore = defineStore('industries', () => {
    const { isDark, toggleTheme } = useTheme()
    const newsStore = useNewsStore()


    const aiChatMessages = ref([])
    const aiChatLoading = ref(false)
    const aiChatContainer = ref(null)

    const aiCustomPrompt = ref('')
    const aiCustomLoading = ref(false)
    const aiCustomHistory = ref([])
    const aiCustomHistoryLoading = ref(false)
    const aiCustomError = ref('')
    const aiCustomResult = ref('')
    const aiCustomSavedPath = ref('')
    const aiCustomSelectedContent = ref('')
    const selectedAiCustomItem = ref(null)
    const currentAiChatSessionId = ref('ai_custom')


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
        industryLoading.value = true
        industryError.value = ''
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

            if (!industryFilenameValid.value) {
                throw new Error('请先输入合法的保存文件名（不能包含 \\ / : * ? \" < > |，并以 .json 结尾）')
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
            requestAnimationFrame(() => rebuildIndustryCharts())
        } catch (e) {
            historyError.value = `加载失败：${e?.message || String(e)}`
        }
    }

    const  runAiCustom = async()=> {
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

            const prompt = (aiCustomPrompt.value || '').trim()
            const fullContent = prompt
                ? `${prompt}\n\n---\n以下是选中的新闻内容：\n\n${userContent}`
                : userContent

            const sessionResp = await createNewSession()
            const newSessionId = sessionResp?.sessionId || 'default'
            currentAiChatSessionId.value = newSessionId

            await chatMemoryStream(fullContent, {
                sessionId: newSessionId,
                selectedContent: aiCustomSelectedContent.value || undefined,
                onDelta: (delta) => {
                    aiCustomResult.value += delta
                },
            })

            await loadAiCustomHistory()
        } catch (e) {
            aiCustomError.value = e?.message || String(e)
        } finally {
            aiCustomLoading.value = false
        }
    }
    const loadAiCustomHistory = async(silent = false)=> {
        if (!silent) aiCustomHistoryLoading.value = true
        try {
            const sessions = await listChatSessions()
            aiCustomHistory.value = Array.isArray(sessions) ? sessions : []
        } catch (e) {
            console.error('加载 AI 会话历史失败', e)
        } finally {
            if (!silent) aiCustomHistoryLoading.value = false
        }
    }
    const loadAiCustomHistoryItem = async (item)=> {
        aiChatLoading.value = true
        aiChatMessages.value = []
        try {
            selectedAiCustomItem.value = item
            const resp = await chatMemoryHistory(item.sessionId)
            const messages = resp?.messages || []
            aiChatMessages.value = messages
            const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')
            aiCustomResult.value = lastAssistant?.content || ''
            aiCustomSavedPath.value = ''
            currentAiChatSessionId.value = item.sessionId
            aiCustomError.value = ''
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
    const clearAiChatMemory = async ()=> {
        try {
            const chatSessionId = currentAiChatSessionId.value || 'ai_custom'
            await chatMemoryClear(chatSessionId)
            aiChatMessages.value = []
            aiChatError.value = ''
        } catch (e) {
            aiChatError.value = e?.message || String(e)
        }
    }
    const deleteCustomHistory = async (item)=> {
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
    return {
        industryChartData,
        industryReasonText,
        industryAiRaw,
        industryError,

        openChartPreview,
        runIndustryAnalysis,
        rebuildIndustryCharts,

        loadIndustryFromHistory,
        loadAiCustomHistoryItem,
        deleteCustomHistory,

        historyError,
        echartHistory,
        echartHistoryPaginated,
        echartHistoryTotal,
        echartHistoryPage,

        aiCustomPrompt,
        runAiCustom,
        aiCustomSelectedContent,
        aiCustomLoading,
        aiCustomResult,
        aiCustomError,
        aiCustomHistory,

        aiChatMessages,
        clearAiChatMemory,
    }
})