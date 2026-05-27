import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import {
    runAllScriptsStream, runScriptStream

} from '../lib/api'
export const useScriptStore = defineStore('script', () => {
    const route = useRoute()

    const isScriptRoute = computed(() => route.path.startsWith('/scripts'))
    const activeMenu = computed(() => route.name || '')

    const scriptRunning = ref(false)
    const scriptError = ref('')
    const scriptResult = ref(null)
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

    const runAllScripts = async()=>{
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

    function scriptKeyFromMenu() {
        if (activeMenu.value === 'script_all') return 'all'
        if (activeMenu.value === 'script_comments') return 'comments'
        if (activeMenu.value === 'script_news') return 'news'
        if (activeMenu.value === 'script_realtime') return 'realtime'
        return null
    }

    const runActiveScript = async ()=> {
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



    function resetOutput() {
        if (scriptRunning.value) return
        scriptError.value = ''
        scriptResult.value = null
        scriptStdoutLive.value = ''
        scriptStderrLive.value = ''
        scriptMetaLive.value = ''
    }

    return {
        // 5 个核心状态
        runActiveScript,
        resetOutput,
        scriptRunning,
        scriptError,
        scriptResult,
        scriptStockCodeInput,
        scriptStdoutLive,
        scriptStderrLive,
        scriptMetaLive,
        // 计算属性
        isScriptRoute,
        activeMenu,
        scriptStockCode,


    }
})
