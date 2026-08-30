<script setup>
import AppHeader from './header/AppHeader.vue'
import AppSidebar from './Right Sidebar/AppSidebar.vue'
import { computed, onMounted, watch, toRef, reactive } from 'vue'
import { useRoute } from 'vue-router'
import { useTheme } from '@/composables/useTheme'
import { useNewsStore } from '@/stores/NewsStore'
import {useDetailsStore} from "@/stores/DetailStore.js";
import {useIndustryStore} from "@/stores/IndustryStore.js";
import {storeToRefs} from 'pinia'
const detailStore = useDetailsStore()
const industryStore = useIndustryStore()
const { chartPreviewOpen, chartPreviewTarget, chartPreviewEl } = storeToRefs(industryStore)
const { closeChartPreview, downloadPreview } = industryStore
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
const stockMoodPieEl = toRef(detailStore, 'stockMoodPieEl')
const stockMetricsBarEl = toRef(detailStore, 'stockMetricsBarEl')
const stockThemesBarEl = toRef(detailStore, 'stockThemesBarEl')
const { closeDetail, runAi } = detailStore
const { clearIndustryData } = industryStore

const routeNameToMenuKey = {
  general: 'general',
  yahoo: 'yahoo',
  finance: 'finance',
  industry: 'industry',
  ai_custom: 'ai_custom',
  comments: 'comments',
  world: 'world',
  search: 'le_search',
  scripts: 'scripts',
  script_all: 'script_all',
  script_comments: 'script_comments',
  script_news: 'script_news',
  script_realtime: 'script_realtime',
}

const menuGroups = [
  {
    key: 'news',
    name: '新闻',
    children: [
      { key: 'general', name: '网易新闻列表', to: '/news/general' },
      { key: 'yahoo', name: '雅虎新闻', to: '/news/yahoo' },
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
    key: 'macro',
    name: '宏观',
    children: [
      { key: 'world', name: '世界格局', to: '/macro/world' },
    ],
  },
  {

    key:'search',
    name:'搜索引擎',
    children: [
      { key: 'le_search', name: '乐搜索', to: '/search' },
    ],
  },
  {
    key: 'scripts',
    name: '脚本运行',
    children: [
      { key: 'script_all', name: '全部运行', to: '/scripts/script_all' },
      { key: 'script_comments', name: '评论爬取', to: '/scripts/script_comments' },
      { key: 'script_news', name: '新闻爬取', to: '/scripts/script_news' },
      { key: 'script_realtime', name: '实时爬取', to: '/scripts/script_realtime' },
    ],
  }
]

const activeMenu = computed(() => routeNameToMenuKey[route.name] || 'general')
const groupOpen = reactive({
  news: true,
  realtime: true,
  analysis: true,
  macro: true,
  search: true,
  scripts: true,
})

function toggleGroup(key) {
  groupOpen[key] = !groupOpen[key]
}

const activeMenuName = computed(() => {
  for (const g of menuGroups) {
    const hit = g.children.find(c => c.key === activeMenu.value)
    if (hit) return hit.name
  }
  return ''
})

// 路由切换时清空行业分析数据 & 关闭详情面板（销毁 ECharts 实例）
watch(() => route.path, () => {
  clearIndustryData()
  closeDetail()
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
        @toggleGroup="toggleGroup"
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
              <span class="time">{{ detail.analysisTime || detail.time||'未知' }}</span>
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


.chartTitle {
  font-weight: 700;
  font-size: 14px;
  margin-bottom: 12px;
  padding-left: 8px;
  border-left: 4px solid var(--primary-color);
}

.chart { width: 100%; height: 300px; }
.chart.small { height: 240px; }



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


/* 深色模式下用户气泡保持可读 */
:global(.dark) .userBubble {
  background: color-mix(in srgb, var(--primary-color) 70%, #333);
}


</style>