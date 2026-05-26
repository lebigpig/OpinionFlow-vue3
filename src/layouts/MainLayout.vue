<script setup>
import AppHeader from './header/AppHeader.vue'
import AppSidebar from './Right Sidebar/AppSidebar.vue'
import { computed, onMounted, watch, toRef } from 'vue'
import { useRoute } from 'vue-router'
import { useTheme } from '@/composables/useTheme'
import { useNewsStore } from '@/stores/NewsStore'
import {useDetailsStore} from "@/stores/DetailStore.js";
const detailStore = useDetailsStore()
const route = useRoute()
const newsStore = useNewsStore()
const { isDark, toggleTheme } = useTheme()

//逐个解耦detailStore的属性，避免整个store被过度依赖导致不必要的更新
const selectedId = toRef(detailStore, 'selectedId')
const detail = toRef(detailStore, 'detail')
const loadingDetail = toRef(detailStore, 'loadingDetail')
const detailError = toRef(detailStore, 'detailError')
const aiLoading = toRef(detailStore, 'aiLoading')
const aiError = toRef(detailStore, 'aiError')
const aiResult = toRef(detailStore, 'aiResult')
const { closeDetail,runAi } = detailStore

const routeNameToMenuKey = {
  GeneralNews: 'general',
  YahooNews: 'yahoo',
  NytimesNews: 'nytimes',
  DeepseekZone: 'deepseek',
  FinanceNews: 'finance',
  WordCloudAnalysis: 'industry',
  AICustomAnalysis: 'ai_custom',
  CommentsAnalysis: 'comments',
  Scripts: 'scripts',
}

const menuGroups = [
  {
    key: 'news',
    name: '新闻',
    children: [
      { key: 'general', name: '网易新闻列表', to: '/news/general' },
      { key: 'yahoo', name: '雅虎新闻', to: '/news/yahoo' },
      { key: 'nytimes', name: '纽约时报新闻', to: '/news/nytimes' },
      { key: 'deepseek', name: 'DeepSeek 专区', to: '/news/deepseek' },
    ],
  },
  {
    key: 'realtime',
    name: '实时',
    children: [
      { key: 'finance', name: '实时财经新闻', to: '/realtime/finance' },
    ],
  },
  {
    key: 'analysis',
    name: '分析',
    children: [
      { key: 'industry', name: '词云分析', to: '/analysis/industry' },
      { key: 'ai_custom', name: 'AI分析', to: '/analysis/ai_custom' },
      { key: 'comments', name: '评论分析', to: '/analysis/comments' },
    ],
  },
  {
    key: 'scripts',
    name: '脚本运行',
    children: [
      { key: 'script_all', name: '全部运行', to: '/scripts' },
      { key: 'script_comments', name: '评论爬取', to: '/scripts' },
      { key: 'script_news', name: '新闻爬取', to: '/scripts' },
      { key: 'script_realtime', name: '实时爬取', to: '/scripts' },
    ],
  }
]

const activeMenu = computed(() => routeNameToMenuKey[route.name] || 'general')
const groupOpen = computed(() => {
  // 根据当前路由自动展开对应的菜单组
  const key = activeMenu.value
  const open = { news: true, realtime: true, analysis: true, scripts: true }
  if (key === 'general' || key === 'yahoo' || key === 'nytimes' || key === 'deepseek') open.news = true
  return open
})

const activeMenuName = computed(() => {
  for (const g of menuGroups) {
    const hit = g.children.find(c => c.key === activeMenu.value)
    if (hit) return hit.name
  }
  return ''
})

// 同步路由到 store 的 activeMenu 并加载列表
watch(activeMenu, (newVal) => {
  newsStore.activeMenu = newVal
  newsStore.page = 1
  newsStore.timeRange = null
  newsStore.keyword = ''
  newsStore.loadList()
}, { immediate: true })

onMounted(() => {
  newsStore.activeMenu = activeMenu.value
  newsStore.loadList()
})
</script>

<template>
  <AppHeader
      :activeMenuName="activeMenuName"
      :isDark="isDark"
      :loadingList="newsStore.loadingList"
      @toggleTheme="toggleTheme"
      @loadList="newsStore.loadList"
  />

  <div class="layout">
    <AppSidebar
        :menuGroups="menuGroups"
        :groupOpen="groupOpen"
        :activeMenu="activeMenu"
        @toggleGroup="(key) => groupOpen[key] = !groupOpen[key]"
    />
    <RouterView />
  </div>
  <transition name="fade">
    <div v-if="selectedId" class="detailOverlay" @click.self="closeDetail">
      <div class="detailPanel card">
        <div class="cardHeader detailHeader">
          <div class="detailTitle">{{ detail?.title || '详情' }}</div>
          <div class="headerActions">
            <button class="btn primary" @click="runAi" :disabled="!detail || aiLoading">AI 解析</button>
            <button class="btn" @click="closeDetail">关闭</button>
          </div>
        </div>

        <div class="detailBody">
          <div v-if="loadingDetail" class="loadingState">
            <div class="spinner"></div>
            <span>详情加载中...</span>
          </div>
          <div v-else-if="detailError" class="errorState">{{ detailError }}</div>
          <div v-else-if="detail">
            <div class="detailMeta">
              <span class="badge">{{ activeMenu === 'comments' ? '分析时间' : '发布时间' }}</span>
              <span class="time">{{ detail.time || '未知' }}</span>
            </div>

            <pre class="pre contentPre">{{ detail.content || '' }}</pre>

            <div v-if="detail?.kind === 'stock_comment'" class="stockCharts">
              <div class="chartGroup">
                <div class="chartTitle">情绪分布 (Mood)</div>
                <div ref="stockMoodPieEl" class="chart small"></div>
              </div>
              <div class="chartGroup">
                <div class="chartTitle">核心指标分析</div>
                <div ref="stockMetricsBarEl" class="chart"></div>
              </div>
              <div class="chartGroup">
                <div class="chartTitle">主要叙事主题 (Themes)</div>
                <div ref="stockThemesBarEl" class="chart"></div>
                <div v-if="(detail?.mainThemesContent || '').trim()" class="themeContentBox">
                  <div class="chartTitle">主题解读 (main_themes_content)</div>
                  <pre class="pre themeContentPre">{{ detail.mainThemesContent }}</pre>
                </div>
              </div>
            </div>

            <div class="aiSection">
              <div class="aiHeader">
                <div class="aiTitle">AI 深度分析</div>
                <span v-if="aiLoading" class="badge primary">分析中...</span>
              </div>
              <div v-if="aiError" class="errorState">{{ aiError }}</div>
              <div v-else-if="aiResult" class="aiResultBody">
                <pre class="pre">{{ aiResult }}</pre>
              </div>
              <div v-else class="emptyState sm">点击上方"AI 解析"按钮开始分析</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>

  <transition name="fade">
    <div v-if="chartPreviewOpen" class="chartPreviewOverlay" @click.self="closeChartPreview">
      <div class="chartPreviewPanel card">
        <div class="cardHeader detailHeader">
          <div class="detailTitle">
            {{ chartPreviewTarget === 'mood' ? '整体情绪分布（放大）' : '行业风险/机会分布（放大）' }}
          </div>
          <div class="headerActions">
            <button class="btn" @click="downloadPreview('png')" type="button">下载 PNG</button>
            <button class="btn" @click="downloadPreview('svg')" type="button">下载 SVG</button>
            <button class="btn primary" @click="closeChartPreview" type="button">关闭</button>
          </div>
        </div>
        <div class="chartPreviewBody">
          <div ref="chartPreviewEl" class="chartPreviewCanvas"></div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.header {
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 24px;
}
.headerLeft {
  display: flex;
  align-items: center;
  gap: 12px;
}
.logoText {
  font-size: 20px;
  font-weight: 800;
  background: linear-gradient(120deg, var(--primary-color), #a8c0ff);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.headerRight {
  display: flex;
  align-items: center;
  gap: 16px;
}
.currentMenu {
  display: flex;
  align-items: center;
  gap: 4px;
}
.menuName {
  font-weight: 600;
  color: var(--primary-color);
}

.sidebar {
  height: fit-content;
  position: sticky;
  top: 20px;
}
.menuGroup {
  margin-bottom: 8px;
}
.menuGroupHeader {
  padding: 12px 16px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-radius: 10px;
  transition: background 0.2s;
}
.menuGroupHeader:hover {
  background: var(--panel-bg-2);
}
.arrow {
  font-size: 10px;
  transition: transform 0.3s;
}
.arrow.rotated {
  transform: rotate(-90deg);
}

.mainContent {
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: 20px;
}
@media (max-width: 1200px) {
  .mainContent {
    grid-template-columns: 1fr;
  }
}

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

.filterBar {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 20px;
  padding: 16px;
  background: var(--panel-bg-2);
  border-radius: 12px;
}
.filterItem {
  display: flex;
  align-items: center;
  gap: 8px;
}
.selectAll {
  margin-left: auto;
  padding-left: 12px;
  border-left: 1px solid var(--border-color);
}

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

.financeSummary {
  font-weight: 700;
  color: var(--text-primary);
  display: inline-block;
}
.yahooItem, .generalItem {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
}
.newsImg {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 12px;
  flex-shrink: 0;
}
.itemMain {
  flex: 1;
  min-width: 0;
}
.btn.sm { padding: 6px 10px; font-size: 12px; }



.aiContentHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  padding: 8px 0;
}
.aiContentBody {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  padding: 20px;
  background: var(--panel-bg-2);
  border-radius: 14px;
  border: 1px solid var(--border-color-light);
}
.aiContentPre {
  width: 100%;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}
.actionGroup {
  display: flex;
  gap: 10px;
  margin: 16px 0;
}
.selectedHint{
  display:flex;
  align-items:center;
  gap:10px;
  margin: 10px 0 0;
}
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
.historyTime{
  font-weight: 700;
  font-size: 14px;
  color: var(--text-primary);
}
.mono{
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 12px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.aiProgress {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: var(--panel-bg-2);
  border-radius: 10px;
  font-size: 13px;
}

.chartContainer {
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
.chartTitleRow{
  display:flex;
  align-items:center;
  justify-content: space-between;
  gap: 10px;
}
.chart { width: 100%; height: 300px; }
.chart.small { height: 240px; }

.reasonBox, .aiResultBox {
  margin-top: 20px;
  padding: 16px;
  background: var(--panel-bg-2);
  border-radius: 14px;
}

.emptyDetail {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  opacity: 0.6;
}
.emptyIcon { font-size: 48px; margin-bottom: 16px; }

.detailTitle {
  font-size: 18px;
  font-weight: 700;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.headerActions { display: flex; gap: 10px; }
.detailMeta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
}
.detailMeta .time { font-size: 14px; font-weight: 500; }

.aiSection {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px dashed var(--border-color);
}
.aiHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.aiTitle { font-weight: 800; font-size: 16px; }
.aiResultBody {
  padding: 16px;
  background: var(--panel-bg-2);
  border-radius: 12px;
  border: 1px solid var(--border-color-light);
}

.themeContentBox{
  margin-top: 12px;
  padding: 12px;
  background: var(--panel-bg-2);
  border-radius: 12px;
  border: 1px solid var(--border-color-light);
}
.themeContentPre{
  margin: 0;
  max-height: 240px;
  overflow: auto;
}

/* Transitions */
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.menu-fade-enter-active, .menu-fade-leave-active { transition: all 0.3s ease; max-height: 500px; overflow: hidden; }
.menu-fade-enter-from, .menu-fade-leave-to { max-height: 0; opacity: 0; }

.chartPreviewOverlay{
  position: fixed;
  inset: 0;
  z-index: 1100;
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(6px);
  display: grid;
  place-items: center;
  padding: 20px;
}
.chartPreviewPanel{
  width: min(82vw, 1200px);
  height: min(80vh, 820px);
  display:flex;
  flex-direction: column;
  overflow: hidden;
}
.chartPreviewBody{
  flex: 1;
  padding: 16px;
}
.chartPreviewCanvas{
  width: 100%;
  height: 100%;
}

/* LangChain4j 记忆化对话 */
.aiChatBox {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 400px;
  overflow: auto;
  padding-right: 6px;
}
.chatMsg {
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid var(--border-color-light);
}
.chatMsg.user {
  background: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 12%, transparent);
  border-color: var(--primary-color);
}
.chatMsg.assistant {
  background: var(--panel-bg);
}
.chatRole {
  font-weight: 700;
  font-size: 12px;
  margin-bottom: 6px;
  color: var(--text-secondary);
}
.chatContent {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 13px;
}
.aiChatInputBox {
  margin-top: 14px;
  padding: 14px;
  border-radius: 14px;
  border: 1px solid var(--border-color-light);
  background: var(--panel-bg-2);
}

/* 微信风格聊天面板 */
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

/* 聊天面板内部容器（v-show 保持 DOM 存在） */
.chatPanelInner {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  position: relative;
}

/* loading 覆盖层：绝对定位浮在聊天内容上方，不销毁底层 DOM */
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

/* 微信风格消息容器 */
.wechatChatContainer {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: transparent;
}

/* 每条消息行 */
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

/* 头像 */
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

/* 气泡 */
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
/* 深色模式下用户气泡保持可读 */
:global(.dark) .userBubble {
  background: color-mix(in srgb, var(--primary-color) 70%, #333);
}

.wechatBubbleContent {
  white-space: pre-wrap;
  word-break: break-word;
}

.allSelectAlert {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: color-mix(in srgb, #e74c3c 10%, var(--panel-bg));
  border: 1px solid #e74c3c;
  border-radius: 10px;
  margin: 8px 0;
}

/* 删除按钮 */
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