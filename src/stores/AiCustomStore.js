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
    saveEchartJson,
    deleteChatSession
} from "@/lib/api.js";



export const useAiStore = defineStore('ai_custom', () => {
    const { isDark, toggleTheme } = useTheme()
    const newsStore = useNewsStore()
    const { items, selectedMap, yahooSelectedData, nytimesSelectedData } = storeToRefs(newsStore)

    const aiChatMessages = ref([])
    const aiChatLoading = ref(false)
    const aiChatContainer = ref(null)
    const aiChatInput = ref('')
    const aiChatSending = ref(false)
    const aiChatError = ref('')


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
            // 兼容后端返回 { messages: [...] } 或直接返回 [...] 两种格式
            let messages = []
            if (Array.isArray(resp)) {
                messages = resp
            } else if (resp && Array.isArray(resp.messages)) {
                messages = resp.messages
            }
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

    const sendAiChatMessage = async()=> {
        const msg = (aiChatInput.value || '').trim()
        if (!msg || aiChatSending.value) return
        aiChatInput.value = ''
        aiChatError.value = ''
        aiChatSending.value = true

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
                    aiChatMessages.value[assistantIdx].content = reply
                    nextTick(() => {
                        if (aiChatContainer.value) {
                            aiChatContainer.value.scrollTop = aiChatContainer.value.scrollHeight
                        }
                    })
                },
            })

            loadAiCustomHistory(true).catch(() => {})
        } catch (e) {
            aiChatError.value = e?.message || String(e)
        } finally {
            aiChatSending.value = false
        }
    }
    return {
        selectedAiCustomItem,
        aiCustomHistory,
        aiCustomHistoryLoading,
        aiCustomPrompt,
        aiCustomSelectedContent,
        aiCustomLoading,
        aiCustomResult,
        aiCustomError,
        aiCustomSavedPath,

        aiChatMessages,
        aiChatLoading,
        aiChatInput,
        aiChatSending,
        aiChatError,
        aiChatContainer,

        loadAiCustomHistory,
        loadAiCustomHistoryItem,
        deleteCustomHistory,
        runAiCustom,
        clearAiChatMemory,
        sendAiChatMessage,
    }
})