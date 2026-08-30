// src/stores/WorldMapStore.js
// 世界格局地图状态：选中国家、添加/删除组件、Agent 智能解析、持久化
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { saveEchartJson, listEchartPage, worldMapAgent } from '@/lib/api.js'
import { getCentroid, getCountryName, matchCountry } from '@/lib/worldCountries.js'

const STORAGE_KEY = 'opinionflow_worldmap_v1'

let uidCounter = 1
function uid() {
  return 'c' + Date.now().toString(36) + '_' + (uidCounter++)
}

export const TYPE_META = {
  marker: { label: '标记', color: '#409eff', icon: '📍' },
  bar: { label: '柱状图', color: '#67c23a', icon: '📊' },
  pie: { label: '饼图', color: '#e6a23c', icon: '🥧' },
  line: { label: '折线图', color: '#f56c6c', icon: '📈' },
  label: { label: '标签', color: '#909399', icon: '🏷️' },
  mining: { label: '采矿', color: '#8d6e63', icon: '⛏️' },
  oil: { label: '石油开采', color: '#546e7a', icon: '🛢️' },
}

export const useWorldMapStore = defineStore('worldMap', () => {
  const components = ref([])
  const selectedCountry = ref(null) // { id, en, zh }
  const agentInput = ref('')
  const agentLog = ref([])
  const agentRunning = ref(false)
  const agentUseAI = ref(true)

  // ── 持久化（localStorage） ──────────────────────────────────────
  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(components.value))
    } catch (e) { /* ignore */ }
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const arr = JSON.parse(raw)
        if (Array.isArray(arr)) components.value = arr
      }
    } catch (e) { /* ignore */ }
  }

  function loadComponents(arr) {
    components.value = (arr || []).map(it => ({ ...it, id: it.id || uid() }))
    persist()
  }

  // ── 国家选择 ────────────────────────────────────────────────────
  function selectCountry(c) {
    if (!c) { selectedCountry.value = null; return }
    const rec = getCountryName(c.id)
    selectedCountry.value = {
      id: c.id,
      en: c.en || rec?.en || '',
      zh: c.zh || rec?.zh || c.en || '',
    }
  }

  // ── 组件增删 ────────────────────────────────────────────────────
  function addComponent({ countryId, countryName, zh, lat, lng, type, title, value, color }) {
    const item = {
      id: uid(),
      countryId,
      countryName: countryName || '',
      zh: zh || '',
      lat,
      lng,
      type: type || 'marker',
      title: title || '',
      value: value ?? null,
      color: color || '#409eff',
      createdAt: Date.now(),
    }
    components.value.push(item)
    persist()
    return item
  }

  function removeComponent(id) {
    components.value = components.value.filter(c => c.id !== id)
    persist()
  }

  // 拖拽后更新组件位置并保存
  function updatePosition(id, lat, lng) {
    const it = components.value.find(c => c.id === id)
    if (!it) return false
    it.lat = lat
    it.lng = lng
    persist()
    return true
  }

  function clearAll() {
    components.value = []
    persist()
  }

  // 给当前选中国家添加组件
  function addToSelected({ type, title, value, color }) {
    const s = selectedCountry.value
    if (!s) return { ok: false, msg: '请先在地图上点击一个国家' }
    const cen = getCentroid(s.id)
    if (!cen) return { ok: false, msg: `未找到 ${s.en || s.id} 的中心点，无法放置` }
    addComponent({
      countryId: s.id,
      countryName: s.en,
      zh: s.zh,
      lat: cen[1],
      lng: cen[0],
      type: type || 'marker',
      title: title || '',
      value,
      color: color || '#409eff',
    })
    return { ok: true, msg: `已在 ${s.zh || s.en} (${s.id}) 添加 ${TYPE_META[type]?.label || type} 组件` }
  }

  // 从图例拖拽到地图指定坐标直接添加组件（无需先选中国家）
  function addAtPosition({ lat, lng, type, title, value, color }) {
    return addComponent({
      countryId: '',
      countryName: '',
      zh: '',
      lat,
      lng,
      type: type || 'marker',
      title: title || '',
      value,
      color: color || '#409eff',
    })
  }

  // ── 服务器保存 / 加载 ───────────────────────────────────────────
  async function saveToServer() {
    const jsonText = JSON.stringify({ _type: 'world-map', items: components.value })
    const resp = await saveEchartJson({ filename: 'world-map', jsonText })
    return resp
  }

  async function loadFromServer() {
    const resp = await listEchartPage(0, 50)
    const rows = (resp?.content || []).filter(r => r.content && r.content._type === 'world-map')
    if (!rows.length) return { ok: false, msg: '服务器尚未保存世界格局数据' }
    const latest = rows[0]
    loadComponents(latest.content.items || [])
    return { ok: true, msg: `已从服务器加载 (id=${latest.id}, ${components.value.length} 个组件)` }
  }

  // ── Agent 日志 ──────────────────────────────────────────────────
  function pushLog(msg) {
    const t = new Date().toLocaleTimeString('zh-CN', { hour12: false })
    agentLog.value.unshift(`[${t}] ${msg}`)
    if (agentLog.value.length > 100) agentLog.value.length = 100
  }

  // ── 本地规则解析（离线可用） ─────────────────────────────────────
  function parseAgentIntent(text) {
    const country = matchCountry(text)
    if (!country) return null

    const typeRules = [
      { t: 'mining', kws: ['采矿', '矿山', '矿区', 'mining'] },
      { t: 'oil', kws: ['石油', '油田', '原油', '油井', 'oil'] },
      { t: 'bar', kws: ['柱状', '条形', 'bar'] },
      { t: 'pie', kws: ['饼图', 'pie', '占比', '份额', '结构'] },
      { t: 'line', kws: ['折线', 'line', '趋势'] },
      { t: 'label', kws: ['标签', 'label', '文字'] },
      { t: 'marker', kws: ['标记', 'marker', '图标'] },
    ]
    let type = 'marker'
    for (const r of typeRules) {
      if (r.kws.some(k => text.includes(k))) { type = r.t; break }
    }

    let value = null
    const m = text.match(/(\d+(?:\.\d+)?)/)
    if (m) value = Number(m[1])

    let title = ''
    const tm = text.match(/(?:添加|加上|放置|标注|加一个|来个)\s*([\u4e00-\u9fa5A-Za-z]{2,12})/)
    if (tm) title = tm[1]

    return { country, type, value, title }
  }

  // ── 后端 AI 解析（智能 Agent） ───────────────────────────────────
  async function agentParseWithAI(text) {
    const systemPrompt =
      '你是一个世界格局地图 Agent。请把用户的中文指令解析为 JSON，' +
      '字段：{"countryId":"ISO2代码","type":"bar|pie|line|marker|label","title":"简短中文名称","value":数字或null}。' +
      '只能输出一个 JSON 对象，不要输出其它文字。若无法确定国家，返回 {"countryId":null}。'
    const resp = await worldMapAgent(text, systemPrompt)
    const result = resp?.result || ''
    const jm = result.match(/\{[\s\S]*\}/)
    if (!jm) throw new Error('AI 返回内容不含 JSON')
    const data = JSON.parse(jm[0])
    if (!data.countryId) return null
    const country = getCountryName(data.countryId)
    if (!country) return null
    const type = ['bar', 'pie', 'line', 'marker', 'label', 'mining', 'oil'].includes(data.type) ? data.type : 'marker'
    return { country, type, title: data.title || '', value: data.value ?? null }
  }

  // ── Agent 执行入口 ──────────────────────────────────────────────
  async function agentRun() {
    const text = agentInput.value.trim()
    if (!text) return
    if (agentRunning.value) return
    agentRunning.value = true
    try {
      let plan = null
      if (agentUseAI.value) {
        try {
          plan = await agentParseWithAI(text)
        } catch (e) {
          pushLog(`⚠️ AI 解析失败（${e?.message || e}），自动改用本地规则解析`)
        }
      }
      if (!plan) plan = parseAgentIntent(text)

      if (!plan || !plan.country) {
        pushLog('❌ 未能识别目标国家，试试："在中国添加GDP柱状图，数值500"')
        return
      }
      const c = plan.country
      addComponent({
        countryId: c.id,
        countryName: c.en,
        zh: c.zh,
        lat: c.centroid[1],
        lng: c.centroid[0],
        type: plan.type,
        title: plan.title || '',
        value: plan.value,
        color: TYPE_META[plan.type]?.color || '#409eff',
      })
      const meta = TYPE_META[plan.type] || { label: plan.type }
      const parts = [`✅ Agent 已在 ${c.zh || c.en} (${c.id}) 添加「${meta.label}」`]
      if (plan.title) parts.push(`名称「${plan.title}」`)
      if (plan.value != null) parts.push(`数值 ${plan.value}`)
      pushLog(parts.join('，'))
      agentInput.value = ''
    } finally {
      agentRunning.value = false
    }
  }

  return {
    components,
    selectedCountry,
    agentInput,
    agentLog,
    agentRunning,
    agentUseAI,

    loadLocal,
    loadComponents,
    selectCountry,
    addComponent,
    removeComponent,
    updatePosition,
    clearAll,
    addToSelected,
    addAtPosition,
    saveToServer,
    loadFromServer,
    pushLog,
    agentRun,
  }
})


