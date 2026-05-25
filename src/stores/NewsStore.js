import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  listGeneral, listGeneralIds,
  listFinanceIds,
  listYahooFinanceNews, listYahooIds,
} from '../lib/api'

export const useNewsStore = defineStore('news', () => {
  // ─── 核心 5 个状态 ─────────────────────────────────
  const selectedMap = ref({})
  const bulkSelectedArticles = ref({})
  const yahooSelectedData = ref({})
  const nytimesSelectedData = ref({})
  const items = ref([])

  // ─── 辅助状态（被相关方法依赖） ─────────────────────
  const activeMenu = ref('general')
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(50)
  const timeRange = ref(null)
  const keyword = ref('')
  const allSelectLoading = ref(false)
  const allSelectError = ref('')
  const loadingList = ref(false)
  const listError = ref('')

  // ─── 工具函数 ───────────────────────────────────────
  function selectionKey(source, id) {
    return `${source}:${id}`
  }

  function isSelectableMenu() {
    return activeMenu.value === 'general' || activeMenu.value === 'finance' || activeMenu.value === 'yahoo' || activeMenu.value === 'nytimes'
  }

  // ─── 计算属性 ───────────────────────────────────────
  const selectedCounts = computed(() => {
    const keys = Object.keys(selectedMap.value || {})
    const bySource = { general: 0, finance: 0, yahoo: 0, nytimes: 0, total: 0 }
    for (const k of keys) {
      const source = String(k.split(':')[0] || '')
      if (source in bySource) bySource[source]++
      bySource.total++
    }
    return bySource
  })

  const currentSource = computed(() => {
    if (activeMenu.value === 'finance') return 'finance'
    if (activeMenu.value === 'yahoo') return 'yahoo'
    if (activeMenu.value === 'nytimes') return 'nytimes'
    return 'general'
  })

  const pageAllSelected = computed(() => {
    if (!isSelectableMenu()) return false
    if (!items.value?.length) return false
    return items.value.every(it => isSelected(currentSource.value, it.id))
  })

  const canSelectAllMenu = computed(() => {
    return activeMenu.value === 'general' || activeMenu.value === 'finance' || activeMenu.value === 'yahoo' || activeMenu.value === 'nytimes'
  })

  const currentSourceSelectedCount = computed(() => {
    return selectedCounts.value[currentSource.value] || 0
  })

  // ─── 选中操作方法 ───────────────────────────────────
  function isSelected(source, id) {
    return !!selectedMap.value[selectionKey(source, id)]
  }

  function toggleSelected(source, id, checked) {
    const k = selectionKey(source, id)
    const next = { ...selectedMap.value }
    if (checked) next[k] = true
    else delete next[k]
    selectedMap.value = next
  }

  function toggleYahooSelected(it, checked) {
    const id = String(it?.id ?? '')
    if (!id) return
    toggleSelected('yahoo', id, checked)
    const next = { ...yahooSelectedData.value }
    if (checked) {
      next[id] = {
        title: it?.title || '',
        displayTime: it?.displayTime || '',
        summary: it?.summary || '',
      }
    } else {
      delete next[id]
    }
    yahooSelectedData.value = next
  }

  function toggleNytimesSelected(it, checked) {
    const id = String(it?.id ?? '')
    if (!id) return
    toggleSelected('nytimes', id, checked)
    const next = { ...nytimesSelectedData.value }
    if (checked) {
      next[id] = {
        title: it?.title || '',
        displayTime: it?.displayTime || '',
        summary: it?.summary || '',
      }
    } else {
      delete next[id]
    }
    nytimesSelectedData.value = next
  }

  function toggleSelectAllOnPage(checked) {
    if (!isSelectableMenu()) return
    const source = currentSource.value
    if (source === 'yahoo') {
      for (const it of items.value) toggleYahooSelected(it, checked)
      return
    }
    if (source === 'nytimes') {
      for (const it of items.value) toggleNytimesSelected(it, checked)
      return
    }
    const next = { ...selectedMap.value }
    for (const it of items.value) {
      const k = selectionKey(source, it.id)
      if (checked) next[k] = true
      else delete next[k]
    }
    selectedMap.value = next
  }

  function clearSourceSelection(source) {
    const next = { ...selectedMap.value }
    for (const k of Object.keys(next)) {
      if (k.startsWith(`${source}:`)) delete next[k]
    }
    selectedMap.value = next
    if (source === 'yahoo') yahooSelectedData.value = {}
    if (source === 'nytimes') nytimesSelectedData.value = {}
  }

  async function selectAllResults() {
    const source = currentSource.value
    if (currentSourceSelectedCount.value > 0) {
      clearSourceSelection(source)
      const nextBulk = { ...bulkSelectedArticles.value }
      for (const k of Object.keys(nextBulk)) {
        if (k.startsWith(`${source}:`)) delete nextBulk[k]
      }
      bulkSelectedArticles.value = nextBulk
      return
    }

    if (source === 'finance') {
      allSelectLoading.value = true
      allSelectError.value = ''
      try {
        const start = timeRange.value?.[0] || ''
        const end = timeRange.value?.[1] || ''
        const q = keyword.value?.trim() || ''
        const resp = await listFinanceIds({ start, end, q, limit: total.value || 5000 })
        const ids = resp?.ids || []
        const truncated = !!resp?.truncated
        const next = { ...selectedMap.value }
        for (const id of ids) next[`finance:${id}`] = true
        selectedMap.value = next
        if (truncated) {
          allSelectError.value = `结果过多，仅选中了前 ${ids.length} 条（limit=${resp?.limit}，total=${resp?.total}）。如需更多请提高后端 limit 上限或缩小筛选范围。`
          alert(allSelectError.value)
        }
      } catch (e) {
        allSelectError.value = e?.message || String(e)
      } finally {
        allSelectLoading.value = false
      }
      return
    }

    if (source === 'general') {
      allSelectLoading.value = true
      allSelectError.value = ''
      try {
        const start = timeRange.value?.[0] || ''
        const end = timeRange.value?.[1] || ''
        const q = keyword.value?.trim() || ''
        const resp = await listGeneralIds({ start, end, q, limit: total.value || 50000 })
        const ids = resp?.ids || []
        const truncated = !!resp?.truncated
        const next = { ...selectedMap.value }
        for (const id of ids) next[`general:${id}`] = true
        selectedMap.value = next
        try {
          const fetchSize = ids.length || (total.value || 50000)
          const listResp = await listGeneral(0, fetchSize, { start, end, q })
          const rows = listResp?.content || listResp?.list || []
          const nextBulk = { ...bulkSelectedArticles.value }
          for (const r of rows) {
            const key = `general:${r.id}`
            if (next[key] && !nextBulk[key]) {
              nextBulk[key] = { title: r.title || '', content: r.summary || r.content || '' }
            }
          }
          bulkSelectedArticles.value = nextBulk
        } catch (bulkErr) {
          console.warn('获取 general 全量文章数据失败，词云分析时将逐条请求详情', bulkErr)
        }
        if (truncated) {
          allSelectError.value = `结果过多，仅选中了前 ${ids.length} 条（limit=${resp?.limit}，total=${resp?.total}）。如需更多请提高后端 limit 上限或缩小筛选范围。`
          alert(allSelectError.value)
        }
      } catch (e) {
        allSelectError.value = e?.message || String(e)
      } finally {
        allSelectLoading.value = false
      }
      return
    }

    if (source === 'yahoo') {
      allSelectLoading.value = true
      allSelectError.value = ''
      try {
        const start = timeRange.value?.[0] || ''
        const end = timeRange.value?.[1] || ''
        const q = keyword.value?.trim() || ''
        const resp = await listYahooIds({ start, end, q, limit: total.value || 50000 })
        const ids = resp?.ids || []
        const truncated = !!resp?.truncated
        const next = { ...selectedMap.value }
        for (const id of ids) next[`yahoo:${id}`] = true
        selectedMap.value = next
        try {
          const fetchSize = ids.length || (total.value || 50000)
          const listResp = await listYahooFinanceNews(0, fetchSize, { start, end, q })
          const rows = listResp?.content || listResp?.list || []
          const nextData = { ...yahooSelectedData.value }
          for (const r of rows) {
            const idStr = String(r.id)
            if (next[`yahoo:${idStr}`] && !nextData[idStr]) {
              nextData[idStr] = { title: r.title || '', displayTime: r.displayTime || '', summary: r.summary || '' }
            }
          }
          yahooSelectedData.value = nextData
        } catch (bulkErr) {
          const nextData = { ...yahooSelectedData.value }
          for (const it of items.value) {
            const idStr = String(it.id)
            if (next[`yahoo:${idStr}`] && !nextData[idStr]) {
              nextData[idStr] = { title: it?.title || '', displayTime: it?.displayTime || '', summary: it?.summary || '' }
            }
          }
          yahooSelectedData.value = nextData
          console.warn('获取 yahoo 全量文章数据失败，仅存储当前页数据', bulkErr)
        }
        if (truncated) {
          allSelectError.value = `结果过多，仅选中了前 ${ids.length} 条（limit=${resp?.limit}，total=${resp?.total}）。如需更多请提高后端 limit 上限或缩小筛选范围。`
          alert(allSelectError.value)
        }
      } catch (e) {
        allSelectError.value = e?.message || String(e)
      } finally {
        allSelectLoading.value = false
      }
      return
    }

    if (source === 'nytimes') {
      for (const it of items.value) toggleNytimesSelected(it, true)
      return
    }
  }

  return {
    // 5 个核心状态
    selectedMap,
    bulkSelectedArticles,
    yahooSelectedData,
    nytimesSelectedData,
    items,

    // 辅助状态
    activeMenu,
    total,
    page,
    pageSize,
    timeRange,
    keyword,
    allSelectLoading,
    allSelectError,
    loadingList,
    listError,

    // 计算属性
    selectedCounts,
    currentSource,
    pageAllSelected,
    canSelectAllMenu,
    currentSourceSelectedCount,

    // 方法
    selectionKey,
    isSelectableMenu,
    isSelected,
    toggleSelected,
    toggleYahooSelected,
    toggleNytimesSelected,
    toggleSelectAllOnPage,
    clearSourceSelection,
    selectAllResults,
  }
})
