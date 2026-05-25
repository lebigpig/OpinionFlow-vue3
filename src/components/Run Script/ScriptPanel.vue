<script setup>
import { computed, ref } from 'vue'
import { runScriptStream, runAllScriptsStream } from '../../lib/api'

const props = defineProps({
  activeMenu: { type: String, required: true },
  activeMenuName: { type: String, default: '' },
})

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

function scriptKeyFromMenu() {
  if (props.activeMenu === 'script_all') return 'all'
  if (props.activeMenu === 'script_comments') return 'comments'
  if (props.activeMenu === 'script_news') return 'news'
  if (props.activeMenu === 'script_realtime') return 'realtime'
  return null
}

async function runAllScripts() {
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

async function runActiveScript() {
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

function clearOutput() {
  scriptError.value = ''
  scriptResult.value = null
}
</script>

<template>
  <main class="mainContent">
  <div class="card scriptPanel">
    <div class="cardHeader">
      <div style="font-weight:800; font-size: 16px;">脚本运行 · {{ activeMenuName }}</div>
      <div class="headerActions">
        <button
          class="btn primary"
          @click="runActiveScript"
          :disabled="scriptRunning || (activeMenu === 'script_comments' && !scriptStockCode)"
        >
          {{ scriptRunning ? '运行中...' : '运行脚本' }}
        </button>
        <button class="btn" @click="clearOutput" :disabled="scriptRunning" type="button">
          清空输出
        </button>
      </div>
    </div>
    <div class="cardBody">
      <div class="muted">
        这里会调用后端执行你配置的 Python 脚本（仅支持 comments/news/realtime 三个 key）。仅在你手动点击"运行脚本"时执行。
      </div>

      <div v-if="activeMenu === 'script_comments'" class="scriptForm">
        <div class="muted" style="font-weight: 700;">请输入股票编号</div>
        <div class="scriptRow">
          <el-input
            v-model="scriptStockCodeInput"
            placeholder="例如：601398 / 000001"
            clearable
            @keyup.enter="runActiveScript"
          />
          <span class="badge" v-if="scriptStockCode">格式化：{{ scriptStockCode }}</span>
        </div>
        <div class="muted" v-if="scriptStockCode">
          将执行：<span class="monoInline">{{ `--code ${scriptStockCode}` }}</span>
        </div>
      </div>

      <div v-else-if="activeMenu === 'script_all'" class="scriptForm">
        <div class="muted" style="font-weight: 700;">请输入股票编号（用于评论爬取）</div>
        <div class="scriptRow">
          <el-input
            v-model="scriptStockCodeInput"
            placeholder="例如：601398 / 000001"
            clearable
            @keyup.enter="runActiveScript"
          />
          <span class="badge" v-if="scriptStockCode">格式化：{{ scriptStockCode }}</span>
        </div>
        <div class="muted" v-if="scriptStockCode">
          将并行运行：<span class="monoInline">comments(--code)</span>、<span class="monoInline">news</span>、<span class="monoInline">realtime</span>
        </div>
      </div>

      <div v-if="scriptError" class="errorState" style="padding: 12px 0;">{{ scriptError }}</div>
      <div v-if="scriptRunning" class="aiProgress">
        <div class="spinner sm"></div>
        <span>脚本运行中...</span>
      </div>
      <div v-if="scriptMetaLive" class="aiResultBox">
        <div class="chartTitle">meta</div>
        <pre class="pre">{{ scriptMetaLive }}</pre>
      </div>
      <div v-if="scriptStdoutLive" class="aiResultBox">
        <div class="chartTitle">stdout（实时）</div>
        <pre class="pre">{{ scriptStdoutLive }}</pre>
      </div>
      <div v-if="scriptStderrLive" class="aiResultBox">
        <div class="chartTitle">stderr（实时）</div>
        <pre class="pre">{{ scriptStderrLive }}</pre>
      </div>
      <div v-if="scriptResult" class="aiResultBox">
        <div class="muted" style="margin-bottom: 10px;">
          key={{ scriptResult.key }}；exit={{ scriptResult.exitCode }}；耗时={{ scriptResult.durationMs }}ms
        </div>
        <div class="chartTitle">stdout</div>
        <pre class="pre">{{ scriptResult.stdout || '' }}</pre>
        <div class="chartTitle" style="margin-top: 14px;">stderr</div>
        <pre class="pre">{{ scriptResult.stderr || '' }}</pre>
      </div>
      <div v-else-if="!scriptRunning" class="emptyState sm">点击"运行脚本"开始执行</div>
    </div>
  </div>
  </main>
</template>

<style scoped>
.scriptPanel{
  grid-column: 1 / -1;
  width: min(980px, 100%);
  margin: 0 auto;
}
.scriptForm{
  margin-top: 14px;
  padding: 14px;
  border-radius: 14px;
  border: 1px solid var(--border-color-light);
  background: var(--panel-bg-2);
  display: grid;
  gap: 10px;
}
.scriptRow{
  display: flex;
  align-items: center;
  gap: 10px;
}
.monoInline{
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 12px;
}

.cardHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.headerActions { display: flex; gap: 10px; }
.cardBody { }
.muted { color: var(--text-secondary); font-size: 13px; }
.badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 20px;
  border: 1px solid var(--border-color);
  font-size: 12px;
  font-weight: 600;
}

.errorState { color: #e74c3c; }
.loadingState, .emptyState {
  padding: 60px 0;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.emptyState.sm { padding: 20px 0; }

.aiProgress {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: var(--panel-bg-2);
  border-radius: 10px;
  font-size: 13px;
}
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

.aiResultBox {
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
.pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 13px;
  line-height: 1.6;
}
</style>