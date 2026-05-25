<template>
  <router-view />
</template>

<!-- ============================================================
  App.vue 原有逻辑已迁移至 MainLayout.vue，以下代码保留作为参考
  当前 App.vue 仅作为路由出口，渲染 MainLayout 及其子路由
============================================================ -->

<!--
<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useTheme } from './composables/useTheme'
import StockThemesBar from '@/charts/StockComment/StockThemesBar.vue'
import StockMetricsBar from '@/charts/StockComment/StockMetricsBar.vue'
import Industryanalyse from '@/views/Industryanalyse.vue'
import StockMoodPie from '@/charts/StockComment/StockMoodPie.vue'
import AppHeader from '@/layouts/header/AppHeader.vue'
import AppSidebar from '@/layouts/Right Sidebar/AppSidebar.vue'
import ScriptPanel from '@/components/Run Script/ScriptPanel.vue'
import TimeFilter from '@/components/Filter/TimeFilter.vue'
import AICustomAnalysis from '@/views/AICustomAnalysis.vue'
import * as echarts from 'echarts'
import { aiParseStream, getFinanceDetail, getNewsDetail, getStockCommentDetail, listDeepseekMenu, listFinance, listFinanceIds, listGeneral, listGeneralIds, listStockComments, listYahooFinanceNews, listYahooIds, listNewYorkTimesNews } from './lib/api'
import htmlToPlainText from "@/moudle/htmlToPlainText.js";
import MainLayout from "@/layouts/MainLayout.vue";
import { useNewsStore } from './stores/NewsStore'
import { storeToRefs } from 'pinia'

const newsStore = useNewsStore()
const { selectedMap, bulkSelectedArticles, yahooSelectedData, nytimesSelectedData, items, activeMenu, loadingList, listError, total, page, pageSize, timeRange, keyword, allSelectLoading, allSelectError, selectedCounts, currentSource, pageAllSelected, canSelectAllMenu, currentSourceSelectedCount } = storeToRefs(newsStore)
const { selectionKey, isSelectableMenu, isSelected, toggleSelected, toggleYahooSelected, toggleNytimesSelected, toggleSelectAllOnPage, clearSourceSelection, selectAllResults } = newsStore

function scriptKeyFromMenu() {
  if (activeMenu.value === 'script_all') return 'all'
  if (activeMenu.value === 'script_comments') return 'comments'
  if (activeMenu.value === 'script_news') return 'news'
  if (activeMenu.value === 'script_realtime') return 'realtime'
  return null
}

const menuGroups = [
  {
    key: 'news',
    name: '新闻',
    children: [
      { key: 'general', name: '网易新闻列表' },
      { key: 'yahoo', name: '雅虎新闻' },
      { key: 'nytimes', name: '纽约时报新闻' },
      { key: 'deepseek', name: 'DeepSeek 专区' },
    ],
  },
  {
    key: 'realtime',
    name: '实时',
    children: [
      { key: 'finance', name: '实时财经新闻' },
    ],
  },
  {
    key: 'analysis',
    name: '分析',
    children: [
      { key: 'industry', name: '词云分析' },
      { key: 'ai_custom', name: 'AI分析' },
      { key: 'comments', name: '评论分析' },
    ],
  },
  {
    key: 'scripts',
    name: '脚本运行',
    children: [
      { key: 'script_all', name: '全部运行' },
      { key: 'script_comments', name: '评论爬取' },
      { key: 'script_news', name: '新闻爬取' },
      { key: 'script_realtime', name: '实时爬取' },
    ],
  }
]

const activeMenuName = computed(() => {
  for (const g of menuGroups) {
    const hit = g.children.find(c => c.key === activeMenu.value)
    if (hit) return hit.name
  }
  return ''
})
</script>
-->