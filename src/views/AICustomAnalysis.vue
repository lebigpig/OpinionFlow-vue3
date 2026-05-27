<script setup>
import {storeToRefs} from "pinia";
import {useAiStore} from "@/stores/AiCustomStore.js";
import {useNewsStore} from "@/stores/NewsStore.js";

const AiStore = useAiStore()
const newsStore = useNewsStore()
const {selectedCounts} = storeToRefs(newsStore)
const {
  selectedAiCustomItem,
  aiCustomHistory,
  aiCustomHistoryLoading,
  aiCustomPrompt,
  aiCustomLoading,
  aiCustomError,
  aiCustomResult,

  aiChatLoading,
  aiChatMessages,
  aiChatInput,
  aiChatSending,

} = storeToRefs(AiStore)
const {loadAiCustomHistory,sendAiChatMessage,runAiCustom,clearAiChatMemory,loadAiCustomHistoryItem,deleteCustomHistory} = AiStore
loadAiCustomHistory()
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
              <div v-if="msg.role === 'assistant'" class="assistantContent">
                <div class="wechatAvatar assistantAvatar">🤖</div>
                <div class="wechatBubble assistantBubble">
                  <div class="wechatBubbleContent">{{ msg.content }}</div>
                </div>
              </div>
              <div v-else class="userContent">
                <div class="wechatAvatar userAvatar">👤</div>

                <div class="wechatBubble userBubble">
                  <div class="wechatBubbleContent">{{ msg.content }}</div>
                </div>
              </div>
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

</style>
