<script setup>
import { ref, nextTick, computed, onMounted } from 'vue'
import {
  listChatSessions,
  createNewSession,
  chatMemoryStream,
  chatMemoryHistory,
  chatMemoryClear,
  deleteChatSession,
  getFinanceDetail,
  getNewsDetail,
} from '@/lib/api.js'

const props = defineProps({
  selectedCounts: { type: Object, required: true },
  selectedMap: { type: Object, required: true },
  items: { type: Array, default: () => [] },
  yahooSelectedData: { type: Object, default: () => ({}) },
  nytimesSelectedData: { type: Object, default: () => ({}) },
})

/* ---- 状态变量 ---- */
const aiCustomPrompt = ref('')
const aiCustomLoading = ref(false)
const aiCustomError = ref('')
const aiCustomResult = ref('')
const aiCustomSavedPath = ref('')
const currentAiChatSessionId = ref('ai_custom')
const aiCustomHistory = ref([])
const aiCustomHistoryLoading = ref(false)
const aiCustomSelectedContent = ref('')
const selectedAiCustomItem = ref(null)
const aiChatMessages = ref([])
const aiChatInput = ref('')
const aiChatSending = ref(false)
const aiChatError = ref('')
const aiChatLoading = ref(false)
const aiChatContainer = ref(null)

/* ---- 历史会话列表 ---- */
async function loadAiCustomHistory(silent = false) {
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

async function deleteCustomHistory(item) {
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

/* ---- 发送自定义分析请求 ---- */
async function runAiCustom() {
  aiCustomLoading.value = true
  aiCustomError.value = ''
  aiCustomResult.value = ''
  aiCustomSavedPath.value = ''
  selectedAiCustomItem.value = null

  try {
    const keys = Object.keys(props.selectedMap)
    if (keys.length === 0) {
      throw new Error('请先在新闻列表中勾选条目（可用本页全选）')
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

/* ---- 加载历史详情 ---- */
async function loadAiCustomHistoryItem(item) {
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

/* ---- 发送追问消息 ---- */
async function sendAiChatMessage() {
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

/* ---- 清除记忆 ---- */
async function clearAiChatMemory() {
  try {
    const chatSessionId = currentAiChatSessionId.value || 'ai_custom'
    await chatMemoryClear(chatSessionId)
    aiChatMessages.value = []
    aiChatError.value = ''
  } catch (e) {
    aiChatError.value = e?.message || String(e)
  }
}

/* ---- 挂载时加载历史 ---- */
onMounted(() => {
  loadAiCustomHistory()
})

/* ---- 对外暴露方法 ---- */
defineExpose({
  loadAiCustomHistory,
  resetState() {
    aiCustomResult.value = ''
    aiCustomSavedPath.value = ''
    aiCustomError.value = ''
    selectedAiCustomItem.value = null
    aiChatError.value = ''
    loadAiCustomHistory()
  },
  init() {
    aiCustomResult.value = ''
    aiCustomSavedPath.value = ''
    aiCustomError.value = ''
    selectedAiCustomItem.value = null
    aiChatError.value = ''
    loadAiCustomHistory()
  },
})
</script>

<template>
  <!-- 左侧卡片：聊天面板 -->
  <main class="mainContent">
    <div class="card listCard">
      <div class="cardHeader">
        <div style="font-weight:700; font-size: 16px;">列表</div>
      </div>
    <div class="cardBody">
      <div class="chatPanel">
        <div v-if="!selectedAiCustomItem && aiCustomHistory.length === 0 && !aiCustomHistoryLoading" class="emptyState">暂无历史回答</div>
        <div v-else-if="!selectedAiCustomItem && !aiCustomHistoryLoading" class="emptyState">请在右侧点击历史会话查看对话内容</div>

        <div v-show="selectedAiCustomItem" class="chatPanelInner">
          <div class="chatPanelHeader">
            <div class="chatPanelTitle">{{ selectedAiCustomItem?.preview || selectedAiCustomItem?.sessionId }}</div>
            <button class="btn sm" type="button" @click="loadAiCustomHistory(true)" :disabled="aiCustomHistoryLoading">
              {{ aiCustomHistoryLoading ? '加载中...' : '刷新列表' }}
            </button>
          </div>
          <div v-if="aiChatLoading" class="loadingState" style="padding:20px 0;">
            <div class="spinner"></div>
            <div class="muted">加载对话历史中...</div>
          </div>
          <div v-else-if="!aiChatMessages.length" class="emptyState sm">暂无对话记录</div>
          <div v-else ref="aiChatContainer" class="wechatChatContainer">
            <div
                v-for="(msg, idx) in aiChatMessages"
                :key="idx"
                class="wechatMsgRow"
                :class="msg.role"
            >
              <template v-if="msg.role === 'assistant'">
                <div class="wechatAvatar assistantAvatar">🤖</div>
                <div class="wechatBubble assistantBubble">
                  <div class="wechatBubbleContent">{{ msg.content }}</div>
                </div>
              </template>
              <template v-else>
                <div class="wechatBubble userBubble">
                  <div class="wechatBubbleContent">{{ msg.content }}</div>
                </div>
                <div class="wechatAvatar userAvatar">👤</div>
              </template>
            </div>
          </div>
          <div class="aiChatInputBox">
            <el-input
                v-model="aiChatInput"
                type="textarea"
                :rows="2"
                placeholder="输入追问内容，AI 会基于之前的记忆回答..."
                clearable
                @keyup.ctrl.enter="sendAiChatMessage"
            />
            <div class="actionGroup" style="margin:8px 0 0;">
              <button class="btn primary" type="button" @click="sendAiChatMessage" :disabled="aiChatSending || !aiChatInput.trim()">
                {{ aiChatSending ? '发送中...' : '追问 AI' }}
              </button>
              <span class="muted" style="font-size:12px;">Ctrl+Enter 发送</span>
            </div>
          </div>
          <div v-if="aiCustomHistoryLoading" class="chatLoadingOverlay">
            <div class="spinner"></div>
            <div class="muted">正在刷新会话列表...</div>
          </div>
        </div>
      </div>
    </div>
    </div>

    <!-- 右侧卡片：详情面板 -->
    <div class="card detailPlaceholder">
      <div class="cardHeader">
        <div style="font-weight:700; font-size: 16px;">详情预览</div>
        </div>
    <div class="cardBody">
      <div class="muted">输入自定义 Prompt，结合已勾选的新闻内容发送给 AI 分析（支持记忆化多轮对话）。</div>
      <div class="selectedHint">
        <span class="badge">已勾选 {{ selectedCounts.total }} 条</span>
        <span class="muted" v-if="selectedCounts.total">
          （网易 {{ selectedCounts.general }} / 财经 {{ selectedCounts.finance }} / 雅虎 {{ selectedCounts.yahoo }} / 纽约时报 {{ selectedCounts.nytimes }}）
        </span>
      </div>
      <div class="scriptForm">
        <div class="muted" style="font-weight: 700;">自定义 Prompt</div>
        <el-input
            v-model="aiCustomPrompt"
            type="textarea"
            :rows="3"
            placeholder="请输入你的分析需求，例如：请分析这些新闻中关于新能源行业的趋势..."
            clearable
        />
      </div>
      <div class="actionGroup">
        <button class="btn primary" type="button" @click="runAiCustom" :disabled="aiCustomLoading">发送给 AI 分析</button>
        <button class="btn" type="button" @click="clearAiChatMemory">清除记忆</button>
      </div>

      <div v-if="aiCustomLoading" class="aiProgress">
        <div class="spinner sm"></div>
        <span>流式分析中... ({{ aiCustomResult.length }} 字符)</span>
      </div>

      <div v-if="aiCustomError" class="errorState">{{ aiCustomError }}</div>

      <div v-if="aiCustomHistory.length" class="historyBox">
        <div class="chartTitle">历史回答（MySQL chat_history）</div>
        <div class="historyList">
          <button
              v-for="h in aiCustomHistory"
              :key="h.sessionId"
              class="historyItem"
              @click="loadAiCustomHistoryItem(h)"
              type="button"
          >
            <div class="historyItemMain">
              <span class="mono">{{ h.preview || h.sessionId }}</span>
              <span class="muted" style="font-size:11px;">{{ h.messageCount }} 条消息</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              <span class="muted">加载</span>
              <button class="btn-delete-item" @click.stop="deleteCustomHistory(h)" title="删除该会话">✕</button>
            </div>
          </button>
              </div>
          </div>
        </div>
      </div>
  </main>
</template>

<style scoped>
/* ---- 聊天面板 ---- */
.chatPanel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 300px;
}
.chatPanelHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-color-light);
  margin-bottom: 8px;
}
.chatPanelTitle {
  font-weight: 700;
  font-size: 14px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 260px;
}
.chatPanelInner {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  position: relative;
}
.chatLoadingOverlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(2px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  border-radius: 12px;
}
.wechatChatContainer {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: transparent;
}
.wechatMsgRow {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  max-width: 100%;
}
.wechatMsgRow.user {
  flex-direction: row;
  justify-content: flex-end;
}
.wechatMsgRow.assistant {
  flex-direction: row;
  justify-content: flex-start;
}
.wechatAvatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}
.assistantAvatar {
  background: linear-gradient(135deg, #e8f5e9, #c8e6c9);
}
.userAvatar {
  background: linear-gradient(135deg, #e3f2fd, #bbdefb);
}
.wechatBubble {
  max-width: 72%;
  padding: 10px 14px;
  border-radius: 12px;
  position: relative;
  word-break: break-word;
  line-height: 1.6;
  font-size: 13px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}
.assistantBubble {
  background: var(--panel-bg);
  border: 1px solid var(--border-color-light);
  border-top-left-radius: 4px;
}
.userBubble {
  background: color-mix(in srgb, var(--primary-color) 88%, #fff);
  color: #fff;
  border-top-right-radius: 4px;
}
:global(.dark) .userBubble {
  background: color-mix(in srgb, var(--primary-color) 70%, #333);
}
.wechatBubbleContent {
  white-space: pre-wrap;
  word-break: break-word;
}
.aiChatInputBox {
  margin-top: 14px;
  padding: 14px;
  border-radius: 14px;
  border: 1px solid var(--border-color-light);
  background: var(--panel-bg-2);
}

/* ---- 加载/空/错误状态 ---- */
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

/* ---- 操作按钮组 ---- */
.actionGroup {
  display: flex;
  gap: 10px;
  margin: 16px 0;
}
.btn.sm { padding: 6px 10px; font-size: 12px; }

/* ---- 已勾选提示 ---- */
.selectedHint{
  display:flex;
  align-items:center;
  gap:10px;
  margin: 10px 0 0;
}

/* ---- 脚本/Prompt 表单 ---- */
.scriptForm{
  margin-top: 14px;
  padding: 14px;
  border-radius: 14px;
  border: 1px solid var(--border-color-light);
  background: var(--panel-bg-2);
  display: grid;
  gap: 10px;
}

/* ---- 历史记录 ---- */
.historyBox{
  margin-top: 14px;
  padding: 16px;
  background: var(--panel-bg-2);
  border-radius: 14px;
  border: 1px solid var(--border-color-light);
}
.historyList{
  display: grid;
  gap: 8px;
  max-height: 240px;
  overflow: auto;
  padding-right: 6px;
}
.historyItem{
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
.historyItem:hover{
  border-color: var(--primary-color);
  transform: translateX(2px);
}
.historyItemMain{
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  min-width: 0;
}
.mono{
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 12px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.chartTitle {
  font-weight: 700;
  font-size: 14px;
  margin-bottom: 12px;
  padding-left: 8px;
  border-left: 4px solid var(--primary-color);
}

/* ---- AI 进度条 ---- */
.aiProgress {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: var(--panel-bg-2);
  border-radius: 10px;
  font-size: 13px;
}

/* ---- 删除按钮 ---- */
.btn-delete-item {
  background: transparent;
  border: 1px solid #e74c3c;
  color: #e74c3c;
  border-radius: 50%;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
  transition: all 0.2s ease;
  flex-shrink: 0;
}
.btn-delete-item:hover {
  background: #e74c3c;
  color: #fff;
}
</style>
