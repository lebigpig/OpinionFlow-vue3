// src/stores/WorldMapStore.js
// 世界格局地图状态：选中国家、添加/删除组件、Agent 智能解析、持久化
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { saveEchartJson, listEchartPage, worldMapAgent, saveMapMarker } from '@/lib/api.js'
import { getCentroid, getCountryName, matchCountry } from '@/lib/worldCountries.js'
import { IMPORTANT_CITIES } from '@/lib/worldMapData.js'

const STORAGE_KEY = 'opinionflow_worldmap_v1'

let uidCounter = 1
function uid() {
  return 'c' + Date.now().toString(36) + '_' + (uidCounter++)
}

// 商品 / 港口 / 航线 等图例与组件类型定义
// [key, 中文名, emoji, 颜色]
const COMMODITY_TYPES = [
  // 农产品
  ['corn', '玉米', '🌽', '#f0b429'],
  ['wheat', '小麦', '🌾', '#d9a441'],
  ['soybean', '大豆', '🫘', '#b5912f'],
  ['coffee', '咖啡', '☕', '#6f4e37'],
  ['cocoa', '可可', '🍫', '#7b3f00'],
  ['cotton', '棉花', '☁️', '#c9d2da'],
  ['sugar', '糖', '🍬', '#e91e63'],
  ['orangeJuice', '橙汁', '🍊', '#ff9800'],
  ['liveCattle', '活牛', '🐄', '#8d6e63'],
  ['leanHogs', '活猪', '🐖', '#f48fb1'],
  // 工业金属
  ['copper', '铜', '🧡', '#b87333'],
  ['cobalt', '钴', '🔷', '#1565c0'],
  ['aluminum', '铝', '⬜', '#b0bec5'],
  ['zinc', '锌', '⚪', '#9e9e9e'],
  ['nickel', '镍', '⚙️', '#78909c'],
  ['lead', '铅', '⬛', '#616161'],
  ['tin', '锡', '🥫', '#cfd8dc'],
  ['ironOre', '铁矿石', '🪨', '#795548'],
  ['lithium', '锂', '🔋', '#7cb342'],
  ['manganese', '锰', '🧱', '#9e9e9e'],
  ['graphite', '石墨', '✏️', '#607d8b'],
  ['rareEarth', '稀土', '🧲', '#ab47bc'],
  // 贵金属
  ['gold', '金', '🥇', '#ffd700'],
  ['silver', '银', '🥈', '#b0bec5'],
  ['platinum', '铂金', '💠', '#e0e0e0'],
  ['palladium', '钯金', '💎', '#90a4ae'],
  // 能源
  ['coal', '煤炭', '⛰️', '#37474f'],
  ['naturalGas', '天然气', '🔥', '#ff7043'],
  ['crudeOil', '原油', '🛢️', '#263238'],
  ['gasoline', '汽油', '⛽', '#fdd835'],
  ['propane', '丙烷', '🧯', '#b0bec5'],
  ['ethanol', '乙醇', '🧪', '#9ccc65'],
  ['uranium', '铀', '☢️', '#4caf50'],
  // 港口 / 航线
  ['port', '港口', '⚓', '#039be5'],
  ['shipping', '轮船航线', '🚢', '#29b6f6'],
]

export const TYPE_META = {
  ...Object.fromEntries(COMMODITY_TYPES.map(([k, label, icon, color]) => [k, { label, color, icon }])),
}

// 解析用户指令中的经纬度（中文纬度/经度、lat/lng、或 "纬度,经度"）
export function parseLatLng(text) {
  if (!text) return null
  let lat = null
  let lng = null
  const latZh = text.match(/纬度[:：]?\s*(-?\d+(?:\.\d+)?)/)
  const lngZh = text.match(/经度[:：]?\s*(-?\d+(?:\.\d+)?)/)
  const latEn = text.match(/\blat(?:itude)?\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i)
  const lngEn = text.match(/\blon(?:gitude)?\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i)
  lat = (latZh && latZh[1]) || (latEn && latEn[1]) || null
  lng = (lngZh && lngZh[1]) || (lngEn && lngEn[1]) || null
  if (lat == null || lng == null) {
    const m = text.match(/(-?\d+(?:\.\d+)?)\s*[,，]\s*(-?\d+(?:\.\d+)?)/)
    if (m) { lat = m[1]; lng = m[2] }
  }
  if (lat == null || lng == null) return null
  lat = Number(lat)
  lng = Number(lng)
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

// 供 AI 参考的地图坐标表（城市名: 纬度, 经度），让 AI 能给出精确经纬度
export function buildCoordTable() {
  return IMPORTANT_CITIES
    .map(c => `${c.zh}(${c.en}): ${c.lat}, ${c.lng}`)
    .join('；')
}

// 精简 key → 内部类型 key 映射（供 AI 返回的英文 key 使用）
const TYPE_ALIASES = {
  orange: 'orangeJuice',
  beef: 'liveCattle',
  pork: 'leanHogs',
  iron: 'ironOre',
  gas: 'naturalGas',
  natural: 'naturalGas',
  oil: 'crudeOil',
}

// 类型 → 分类（用于写入 map_markers.category）
const TYPE_CATEGORY = {
  corn: '农产品', wheat: '农产品', soybean: '农产品', coffee: '农产品', cocoa: '农产品',
  cotton: '农产品', sugar: '农产品', orangeJuice: '农产品', liveCattle: '农产品', leanHogs: '农产品',
  copper: '工业金属', cobalt: '工业金属', aluminum: '工业金属', zinc: '工业金属', nickel: '工业金属',
  lead: '工业金属', tin: '工业金属', ironOre: '工业金属', lithium: '工业金属', manganese: '工业金属',
  graphite: '工业金属', rareEarth: '工业金属',
  gold: '贵金属', silver: '贵金属', platinum: '贵金属', palladium: '贵金属',
  coal: '能源', naturalGas: '能源', crudeOil: '能源', gasoline: '能源', propane: '能源', ethanol: '能源', uranium: '能源',
  port: '港口与航线', shipping: '港口与航线',
}
function categoryOfType(t) { return TYPE_CATEGORY[t] || '' }

// 把用户/AI 给的类型名（key、别名或中文名）归一化为 TYPE_META 的 key
export function normalizeType(input) {
  if (!input) return null
  const s = String(input).trim()
  if (TYPE_META[s]) return s
  if (TYPE_ALIASES[s]) return TYPE_ALIASES[s]
  // 精确中文名匹配
  for (const k in TYPE_META) {
    if (TYPE_META[k].label === s) return k
  }
  // 中文名包含匹配（如 "黄金" 命中 "金"）
  for (const k in TYPE_META) {
    if (s.includes(TYPE_META[k].label)) return k
  }
  return null
}

// 在用户文本中直接识别出现的类型（按名称长度降序，优先匹配较长词，避免单字误判）
export function detectType(text) {
  if (!text) return null
  const keys = Object.keys(TYPE_META).sort((a, b) => TYPE_META[b].label.length - TYPE_META[a].label.length)
  for (const k of keys) {
    if (text.includes(TYPE_META[k].label)) return k
  }
  return null
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
    const latlng = parseLatLng(text)
    const country = latlng ? null : matchCountry(text)
    if (!latlng && !country) return null

    const typeRules = [
      { t: 'ironOre', kws: ['铁矿石', '铁矿', 'iron ore'] },
      { t: 'coal', kws: ['煤炭', 'coal'] },
      { t: 'crudeOil', kws: ['原油', 'crude'] },
      { t: 'naturalGas', kws: ['天然气', 'natural gas'] },
      { t: 'gasoline', kws: ['汽油'] },
      { t: 'corn', kws: ['玉米', 'corn'] },
      { t: 'wheat', kws: ['小麦', 'wheat'] },
      { t: 'soybean', kws: ['大豆', 'soybean'] },
      { t: 'coffee', kws: ['咖啡', 'coffee'] },
      { t: 'cocoa', kws: ['可可', 'cocoa'] },
      { t: 'cotton', kws: ['棉花', 'cotton'] },
      { t: 'sugar', kws: ['糖', 'sugar'] },
      { t: 'gold', kws: ['黄金', '金价', 'gold'] },
      { t: 'silver', kws: ['白银', '银价', 'silver'] },
      { t: 'copper', kws: ['铜价', '精铜', 'copper'] },
      { t: 'cobalt', kws: ['钴', 'cobalt'] },
      { t: 'lithium', kws: ['锂', '锂矿', 'lithium'] },
      { t: 'manganese', kws: ['锰', '锰矿', 'manganese'] },
      { t: 'uranium', kws: ['铀', '铀矿', 'uranium'] },
      { t: 'graphite', kws: ['石墨', 'graphite'] },
      { t: 'rareEarth', kws: ['稀土', 'rare earth', 'rareEarth'] },
      { t: 'port', kws: ['港口', 'port'] },
      { t: 'shipping', kws: ['航线', '轮船', 'shipping', 'shipping route'] },
    ]
    let type = detectType(text)
    if (!type) {
      for (const r of typeRules) {
        if (r.kws.some(k => text.includes(k))) { type = r.t; break }
      }
    }

    let value = null
    const m = text.match(/(\d+(?:\.\d+)?)/)
    if (m) value = Number(m[1])

    let title = ''
    const tm = text.match(/(?:添加|加上|放置|标注|加一个|来个)\s*([\u4e00-\u9fa5A-Za-z0-9]{1,12})/)
    if (tm) title = tm[1]

    // 若关键词未命中，用标题名反向匹配类型（如 "添加 金" → gold）
    if (!type && title) type = normalizeType(title)
    if (!type) type = 'ironOre'

    const description = `${TYPE_META[type]?.label || type} 标记`
    if (latlng) return { latlng, type, value, title, description }
    return { country, type, value, title, description }
  }

  // ── 后端 AI 解析（智能 Agent，支持多条 → 返回多个 plan） ───────────
  // 从 AI 返回文本中提取所有 JSON 对象（支持 JSON 数组 或 多个 {...}）
  function extractJsonItems(text) {
    if (!text) return []
    const trimmed = text.trim()
    // 整体是 JSON 数组
    try {
      const arr = JSON.parse(trimmed)
      if (Array.isArray(arr)) return arr
    } catch (e) { /* ignore */ }
    // 逐个提取 {...}
    const items = []
    const re = /\{[\s\S]*?\}/g
    let m
    while ((m = re.exec(text)) !== null) {
      try { items.push(JSON.parse(m[0])) } catch (e) { /* ignore */ }
    }
    return items
  }

  // 单个 JSON → plan
  function planFromJson(item) {
    if (!item || typeof item !== 'object') return null
    const type = normalizeType(item.type) || normalizeType(item.title) || 'ironOre'
    let latlng = null
    const lat = Number(item.latitude)
    const lng = Number(item.longitude)
    if (isFinite(lat) && isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      latlng = { lat, lng }
    }
    let country = null
    if (!latlng && item.countryId) {
      country = getCountryName(item.countryId)
    }
    if (!latlng && !country) return null
    return { country, latlng, type, title: item.title || '', value: item.value ?? null, description: item.description || '' }
  }

  async function agentParsePlansWithAI(text) {
    const systemPrompt =
      '你是地图标注 Agent。将中文指令解析为单个或多个 JSON：\n' +
      '{"countryId":"ISO2或null","type":"组件key","title":"简短中文名","value":数字或null,"description":"约40字详细描述，结合该地位置、类型、背景与用途","latitude":纬度或null,"longitude":经度或null}\n\n' +
      '组件key：与详情描述最贴切的英文词(corn,wheat,soybean,coffee,cocoa,cotton,sugar,orange,beef,pork,copper,cobalt,aluminum,zinc,nickel,lead,tin,iron,lithium,manganese,uranium,graphite,rareEarth,gold,silver,platinum,palladium,coal,gas,natural,oil,gasoline,propane,ethanol,port,shipping)\n\n' +
      '经纬度规则：用户给具体数值则用；否则 latitude/longitude 为 null。'
    const resp = await worldMapAgent(text, systemPrompt)
    const items = extractJsonItems(resp?.result || '')
    return items.map(planFromJson).filter(Boolean)
  }


  // ── 本地多行解析：每行解析一个 plan ──────────────────────────────
  function parseAgentIntents(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    const plans = []
    for (const line of lines) {
      const p = parseAgentIntent(line)
      if (p) plans.push(p)
    }
    return plans
  }

  // plan 去重键（经纬度+类型 或 国家+类型）
  function planKey(p) {
    if (p.latlng) return `ll:${p.latlng.lat.toFixed(3)},${p.latlng.lng.toFixed(3)}:${p.type}`
    return `c:${p.country?.id || '?'}:${p.type}`
  }

  // ── Agent 执行入口（支持多条 → 逐个放置） ────────────────────────
  async function agentRun() {
    const text = agentInput.value.trim()
    if (!text) return
    if (agentRunning.value) return
    agentRunning.value = true
    try {
      let plans = []
      if (agentUseAI.value) {
        try {
          plans = await agentParsePlansWithAI(text)
        } catch (e) {
          pushLog(`⚠️ AI 解析失败（${e?.message || e}），改用本地规则解析`)
        }
      }
      // 本地逐行解析：AI 为空时作为主解析；AI 非空时补充 AI 遗漏的行
      const localPlans = parseAgentIntents(text)
      if (!plans.length) {
        plans = localPlans
      } else {
        const seen = new Set(plans.map(planKey))
        for (const lp of localPlans) {
          if (!seen.has(planKey(lp))) { plans.push(lp); seen.add(planKey(lp)) }
        }
      }

      if (!plans.length) {
        pushLog('❌ 未能识别任何位置，试试："在 39.9, 116.4 添加 金"')
        return
      }

      let okCount = 0
      for (const plan of plans) {
        const type = plan.type || 'ironOre'
        const meta = TYPE_META[type] || { label: type }
        const title = plan.title || ''
        const value = plan.value ?? null
        let item
        if (plan.latlng) {
          // 用户给定或 AI 推断出的精确经纬度 → 直接放置
          item = addAtPosition({ lat: plan.latlng.lat, lng: plan.latlng.lng, type, title, value, color: meta.color })
        } else {
          // 国家中心点
          const c = plan.country
          item = addComponent({
            countryId: c.id,
            countryName: c.en,
            zh: c.zh,
            lat: c.centroid[1],
            lng: c.centroid[0],
            type,
            title,
            value,
            color: meta.color,
          })
        }
        okCount++

        // 自动写入数据库（map_markers），并把返回的 DB id 绑定到组件
        try {
          const resp = await saveMapMarker({
            latitude: item?.lat ?? plan.latlng?.lat,
            longitude: item?.lng ?? plan.latlng?.lng,
            name: title || meta.label,
            category: categoryOfType(type),
            iconType: type,
            country: plan.country?.zh || plan.country?.en || '',
            region: '',
            description: plan.description || '',
            annualOutput: '',
            annualProfit: '',
            operator: '',
            status: 1,
            createdBy: 'agent',
          })
          if (item) {
            item.markerId = resp?.id
            item.description = plan.description || ''
          }
        } catch (e) {
          pushLog(`⚠️ 自动写库失败（${meta.label}）：${e?.message || e}`)
        }

        const where = plan.latlng
          ? `经纬度 (${plan.latlng.lat}, ${plan.latlng.lng})`
          : `${plan.country?.zh || plan.country?.en || ''} (${plan.country?.id || '?'})`
        const parts = [`✅ 已在 ${where} 添加「${meta.label}」`]
        if (plan.title) parts.push(`名称「${plan.title}」`)
        if (plan.value != null) parts.push(`数值 ${plan.value}`)
        pushLog(parts.join('，'))
      }
      pushLog(`📊 本轮共添加 ${okCount} 个组件`)
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


