<script setup>
import AppHeader from './header/AppHeader.vue'
import AppSidebar from './Right Sidebar/AppSidebar.vue'
import { computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useTheme } from '@/composables/useTheme'
import { useNewsStore } from '@/stores/NewsStore'

const route = useRoute()
const newsStore = useNewsStore()
const { isDark, toggleTheme } = useTheme()

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
</template>

<style scoped>

</style>