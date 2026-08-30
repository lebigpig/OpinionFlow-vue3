<template>
  <div class="worldmapPage">
    <div class="topbar card">
      <div class="pageTitle">世界格局</div>
      <div class="viewTag">
        <template v-if="viewingCountry">
          <span class="dot" style="background:#ff6b6b"></span>
          <b>{{ selectedCountry?.zh || selectedCountry?.en || viewingCountry }}</b> 内部分区视图
        </template>
        <template v-else>
          <span class="dot" style="background:#409eff"></span>
          世界视图
        </template>
      </div>
      <div class="topbarActions">
        <button v-if="viewingCountry" class="btn" type="button" @click="exitToWorld">← 返回世界</button>
        <button class="btn" type="button" @click="doSave">💾 保存到服务器</button>
        <button class="btn" type="button" @click="doLoad">📥 从服务器加载</button>
        <button class="btn danger" type="button" @click="doClear">🗑 清空全部</button>
      </div>
    </div>

    <div class="worldLayout">
      <!-- 世界地图 -->
      <div class="mapCard card" :class="{ dragActive }">
        <div ref="mapEl" class="map"></div>
        <div class="floatCountry">
          <span v-if="selectedCountry" class="dot" :style="{ background: addColor }"></span>
          <template v-if="selectedCountry">
            当前：{{ selectedCountry.zh || selectedCountry.en }}（{{ selectedCountry.id }}）
          </template>
          <template v-else>
            悬停国家/城市查看名称，点击城市可进入其内部分区
          </template>
        </div>
        <div class="legend">
          <div v-for="g in legendGroups" :key="g.name" class="legendGroup">
            <span class="legendGroupName">{{ g.name }}</span>
            <span
                v-for="k in g.types"
                :key="k"
                class="legendItem draggable"
                :title="'拖拽「' + TYPE_META[k].label + '」到地图指定位置'"
                @mousedown.prevent="startLegendDrag(k, $event)"
                @touchstart.prevent="startLegendDrag(k, $event)"
            >
              <span v-if="isSvgType(k)" class="legendIcon" v-html="typeSvg(k)"></span>
              <span v-else class="legendEmoji">{{ TYPE_META[k].icon }}</span>
              {{ TYPE_META[k].label }}
            </span>
          </div>
          <span class="legendHint">长按图例图标拖到地图目标位置松手即可添加</span>
        </div>
      </div>

      <!-- 右侧控制面板 -->
      <div class="panel card">
        <!-- 智能 Agent -->
        <div class="panelSection">
          <div class="panelTitle">🤖 智能 Agent</div>
          <div class="muted hint">输入指令让 Agent 在地图上放置组件，支持指定经纬度或地名，如："在 39.9, 116.4 添加 金" 或 "在中国添加玉米"</div>
          <el-input
              v-model="agentInput"
              type="textarea"
              :rows="3"
              placeholder="例如：在 39.9, 116.4 添加 金 / 在日本添加原油"
              @keyup.ctrl.enter="runAgent"
          />
          <div class="actionRow">
            <button class="btn primary" type="button" @click="runAgent" :disabled="agentRunning || !agentInput.trim()">
              {{ agentRunning ? 'Agent 执行中...' : 'Agent 执行' }}
            </button>
            <label class="aiToggle" :class="{ active: agentUseAI }">
              <input type="checkbox" v-model="agentUseAI" />
              <span>启用 AI 解析</span>
            </label>
          </div>
          <div class="agentLog" v-if="agentLog.length">
            <div v-for="(l, i) in agentLog" :key="i" class="logLine">{{ l }}</div>
          </div>
        </div>

        <!-- 已添加组件 -->
        <div class="panelSection">
          <div class="panelTitle">🧩 已添加组件（{{ components.length }}）</div>
          <div v-if="!components.length" class="muted">暂无组件，点击国家或使用 Agent 添加</div>
          <div v-for="c in components" :key="c.id" class="compRow">
            <span class="compIcon">{{ TYPE_META[c.type]?.icon || '📍' }}</span>
            <div class="compInfo">
              <div class="compTitle">{{ c.title || TYPE_META[c.type]?.label || c.type }}<span v-if="c.value != null">: {{ c.value }}</span></div>
              <div class="muted small">{{ c.zh || c.countryName }}（{{ c.countryId }}）</div>
            </div>
            <div class="compActions">
              <button class="btn sm" type="button" @click="openMarkerForm({ lat: c.lat, lng: c.lng, type: c.type, comp: c })">编辑</button>
              <button class="btn-delete-item" type="button" @click="removeComp(c.id)" title="删除">✕</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 拖放图例后填写标记信息 -->
  <el-dialog v-model="markerFormVisible" title="标记信息" width="520px" :close-on-click-modal="false">
    <el-form label-width="96px">
      <div class="markerCoords">
        📍 位置：纬度 <b>{{ markerLat }}</b>，经度 <b>{{ markerLng }}</b>
      </div>
      <el-form-item label="名称" required>
        <el-input v-model="markerForm.name" placeholder="如：皮尔巴拉铁矿石" />
      </el-form-item>
      <el-form-item label="分类">
        <el-select v-model="markerForm.category" style="width:100%">
          <el-option v-for="g in legendGroups" :key="g.name" :label="g.name" :value="g.name" />
        </el-select>
      </el-form-item>
      <el-form-item label="图标类型">
        <el-select v-model="markerForm.iconType" style="width:100%">
          <el-option-group v-for="g in legendGroups" :key="g.name" :label="g.name">
            <el-option v-for="k in g.types" :key="k" :label="TYPE_META[k].label" :value="k" />
          </el-option-group>
        </el-select>
      </el-form-item>
      <el-form-item label="国家">
        <el-input v-model="markerForm.country" placeholder="如：澳大利亚" />
      </el-form-item>
      <el-form-item label="地区">
        <el-input v-model="markerForm.region" placeholder="如：西澳大利亚州皮尔巴拉" />
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="markerForm.description" type="textarea" :rows="2" placeholder="备注说明" />
      </el-form-item>
      <el-form-item label="年产量">
        <el-input v-model="markerForm.annualOutput" placeholder="如：5000万吨" />
      </el-form-item>
      <el-form-item label="年利润">
        <el-input v-model="markerForm.annualProfit" placeholder="如：12亿" />
      </el-form-item>
      <el-form-item label="经营方">
        <el-input v-model="markerForm.operator" placeholder="运营主体" />
      </el-form-item>
      <el-form-item label="状态">
        <el-radio-group v-model="markerForm.status">
          <el-radio :value="1">启用</el-radio>
          <el-radio :value="0">停用</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="创建人">
        <el-input v-model="markerForm.createdBy" placeholder="创建人（可选）" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="markerFormVisible = false">取消</el-button>
      <el-button type="primary" :loading="markerSaving" @click="submitMarkerForm">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount, watch } from 'vue'
import * as am5 from '@amcharts/amcharts5'
import * as am5map from '@amcharts/amcharts5/map'
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated'
import am5geodata_worldLow from '@amcharts/amcharts5-geodata/worldLow'
import { saveMapMarker, updateMapMarker, getMapMarker } from '@/lib/api.js'
import { useWorldMapStore, TYPE_META } from '@/stores/WorldMapStore.js'
import { SUB_MAPS, IMPORTANT_CITIES } from '@/lib/worldMapData.js'
import { ZINC_SVG, ALUMINUM_SVG, SOYBEAN_SVG } from '@/lib/worldMapIcons.js'
import { getCountryName } from '@/lib/worldCountries.js'
import { storeToRefs } from 'pinia'

const store = useWorldMapStore()
const { components, selectedCountry, agentInput, agentLog, agentRunning, agentUseAI } = storeToRefs(store)

const mapEl = ref(null)
const addColor = ref('#409eff')
const viewingCountry = ref(null) // null=世界视图，否则为进入的 ISO2 国家
const dragActive = ref(false) // 拖拽悬停高亮

// 图例与下拉的分组结构
const legendGroups = [
  { name: '农产品', types: ['corn', 'wheat', 'soybean', 'coffee', 'cocoa', 'cotton', 'sugar', 'orangeJuice', 'liveCattle', 'leanHogs'] },
  { name: '工业金属', types: ['copper', 'cobalt', 'aluminum', 'zinc', 'nickel', 'lead', 'tin', 'ironOre', 'lithium', 'manganese', 'graphite', 'rareEarth'] },
  { name: '贵金属', types: ['gold', 'silver', 'platinum', 'palladium'] },
  { name: '能源', types: ['coal', 'naturalGas', 'crudeOil', 'gasoline', 'propane', 'ethanol', 'uranium'] },
  { name: '港口与航线', types: ['port', 'shipping'] },
]

function svgForType(k) {
  if (k === 'zinc') return ZINC_SVG
  if (k === 'aluminum') return ALUMINUM_SVG
  if (k === 'soybean') return SOYBEAN_SVG
  return ''
}
function isSvgType(k) { return !!svgForType(k) }
function typeSvg(k) { return svgForType(k) }

// 图例项开始拖拽：记录组件类型，并创建跟随鼠标的幽灵图标
let dragGhostEl = null
const dragType = ref('')

function startLegendDrag(k, e) {
  dragType.value = k
  if (!dragGhostEl) {
    dragGhostEl = document.createElement('div')
    dragGhostEl.className = 'dragGhost'
    document.body.appendChild(dragGhostEl)
  }
  dragGhostEl.textContent = `${TYPE_META[k].icon || ''} ${TYPE_META[k].label}`
  dragGhostEl.style.display = 'block'
  moveLegendGhost(e.clientX, e.clientY)
  window.addEventListener('pointermove', onLegendPointerMove)
  window.addEventListener('pointerup', onLegendPointerUp)
  e.preventDefault()
}

function moveLegendGhost(x, y) {
  if (dragGhostEl) {
    dragGhostEl.style.left = (x + 12) + 'px'
    dragGhostEl.style.top = (y + 12) + 'px'
  }
}

function isOverMap(x, y) {
  if (!mapEl.value) return false
  const r = mapEl.value.getBoundingClientRect()
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
}

function onLegendPointerMove(e) {
  moveLegendGhost(e.clientX, e.clientY)
  dragActive.value = isOverMap(e.clientX, e.clientY)
}

function onLegendPointerUp(e) {
  window.removeEventListener('pointermove', onLegendPointerMove)
  window.removeEventListener('pointerup', onLegendPointerUp)
  if (dragGhostEl) dragGhostEl.style.display = 'none'
  const k = dragType.value
  dragType.value = ''
  dragActive.value = false
  if (!k || !TYPE_META[k] || !chart || !mapEl.value || !pointSeries) return

  const r = mapEl.value.getBoundingClientRect()
  const x = e.clientX - r.left
  const y = e.clientY - r.top
  if (x < 0 || y < 0 || x > r.width || y > r.height) {
    store.pushLog('⚠️ 请在松开前把图标拖到地图范围内')
    return
  }
  const geo = chart.invert({ x, y })
  if (!geo || !isFinite(geo.latitude) || !isFinite(geo.longitude)) {
    store.pushLog(`⚠️ 放置位置无效（像素 ${x.toFixed(0)},${y.toFixed(0)}），请拖到地图内部`)
    return
  }
  // 将地图中心移动到落点，并弹出表单填写标记信息（保存到 map_markers）
  chart.zoomToGeoPoint({ latitude: geo.latitude, longitude: geo.longitude }, Math.max(chart.get('zoomLevel') || 1, 1), true, 300)
  openMarkerForm({ lat: geo.latitude, lng: geo.longitude, type: k })
}

function refreshPoints() {
  if (pointSeries) pointSeries.data.setAll(buildPointData())
}

let root = null
let chart = null
let polygonSeries = null
let citySeries = null
let pointSeries = null
let selectedPolygon = null

// ── 组件图标构建 ──────────────────────────────────────────────────
function buildIcon(root, type, color) {
  if (isSvgType(type)) {
    const svg = svgForType(type)
    const cont = am5.Container.new(root, {})
    cont.children.push(am5.Circle.new(root, {
      radius: 13,
      fill: am5.color(0xffffff),
      fillOpacity: 0.9,
      stroke: color,
      strokeWidth: 1.5,
    }))
    cont.children.push(am5.Picture.new(root, {
      width: 20,
      height: 20,
      src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg),
    }))
    return cont
  }
  if (type === 'bar') {
    const bars = [
      { x: -13, h: 10, a: 0.6 }, { x: -4, h: 20, a: 0.85 }, { x: 5, h: 14, a: 1 },
    ]
    const cont = am5.Container.new(root, {})
    for (const b of bars) {
      cont.children.push(am5.RoundedRectangle.new(root, {
        x: b.x, y: -b.h, width: 8, height: b.h, cornerRadius: 2,
        fill: color, fillOpacity: b.a,
      }))
    }
    return cont
  }
  if (type === 'pie') {
    const cont = am5.Container.new(root, {})
    cont.children.push(am5.Circle.new(root, { radius: 9, fill: color, fillOpacity: 0.25, stroke: color, strokeWidth: 1.5 }))
    cont.children.push(am5.Sector.new(root, { startAngle: -90, endAngle: 90, radius: 7, innerRadius: 3, fill: color }))
    return cont
  }
  if (type === 'line') {
    const pts = [[-12, -4], [-6, -12], [0, -2], [6, -10], [12, 0]]
    const cont = am5.Container.new(root, {})
    for (let i = 0; i < pts.length - 1; i++) {
      cont.children.push(am5.Line.new(root, {
        x1: pts[i][0], y1: pts[i][1], x2: pts[i + 1][0], y2: pts[i + 1][1],
        stroke: color, strokeWidth: 2.5,
      }))
    }
    return cont
  }
  if (type === 'label') {
    return am5.Circle.new(root, { radius: 6, fill: color, stroke: am5.color(0xffffff), strokeWidth: 2 })
  }
  // 商品 / 港口 / 航线 等：白色圆底 + emoji
  const meta = TYPE_META[type]
  if (meta && meta.icon) {
    const cont = am5.Container.new(root, {})
    cont.children.push(am5.Circle.new(root, {
      radius: 13,
      fill: color,
      fillOpacity: 0.22,
      stroke: color,
      strokeWidth: 1.5,
    }))
    cont.children.push(am5.Label.new(root, {
      text: meta.icon,
      fontSize: 16,
      x: 0, y: 0, centerX: am5.p50, centerY: am5.p50,
    }))
    return cont
  }
  // marker
  return am5.Circle.new(root, { radius: 8, fill: color, stroke: am5.color(0xffffff), strokeWidth: 2 })
}

function makeBullet(root, dataItem) {
  const d = dataItem.dataContext
  const type = d.type || 'marker'
  const color = am5.color(d.color || typeDefaultColor(type))
  const locked = !!d.markerId // 已写入数据库的标记：位置锁定，不可拖拽
  const container = am5.Container.new(root, {
    width: 70, height: 54,
    centerX: am5.p50, centerY: am5.p50,
    draggable: !locked,
    cursorOverStyle: 'pointer',
    tooltipHTML: locked ? '该标记已入库，位置已锁定' : '按住可拖拽到指定位置',
  })
  const icon = buildIcon(root, type, color)
  icon.setAll({ x: 35, y: 16, centerX: am5.p50, centerY: am5.p50 })
  const labelText = d.title ? `${d.title}${d.value != null ? ' ' + d.value : ''}` : ''
  const label = am5.Label.new(root, {
    text: labelText,
    fontSize: 10,
    x: 35, y: 40, centerX: am5.p50,
    fill: am5.color(0xffffff), stroke: am5.color(0x000000), strokeWidth: 3,
  })
  container.children.push(icon, label)
  container.events.on('dragstop', (ev) => {
    if (locked) return // 已入库组件不可移动
    const oe = ev.originalEvent
    if (oe && typeof oe.clientX === 'number' && mapEl.value && chart) {
      const rect = mapEl.value.getBoundingClientRect()
      const geo = chart.invert({ x: oe.clientX - rect.left, y: oe.clientY - rect.top })
      if (geo && isFinite(geo.latitude) && isFinite(geo.longitude)) {
        const ok = store.updatePosition(d.id, geo.latitude, geo.longitude)
        if (ok) store.pushLog(`📌 已将「${d.title || TYPE_META[d.type]?.label || d.type}」拖拽到新位置并保存`)
      }
    }
  })
  container.events.on('click', (ev) => {
    const it = components.value.find(x => x.id === d.id)
    if (it) openMarkerForm({ lat: it.lat, lng: it.lng, type: it.type, comp: it })
    ev.stopPropagation()
  })
  return am5.Bullet.new(root, { sprite: container })
}

function createPolygonSeries(geoJSON) {
  if (polygonSeries) polygonSeries.dispose()
  polygonSeries = chart.series.push(am5map.MapPolygonSeries.new(root, {
    geoJSON,
    exclude: ['AQ'],
  }))
  polygonSeries.mapPolygons.template.setAll({
    tooltipHTML: '<b>{name}</b>',
    fill: am5.color(0x2f5b9e),
    stroke: am5.color(0xffffff),
    strokeWidth: 0.5,
    fillOpacity: 0.9,
  })
  polygonSeries.mapPolygons.template.states.create('hover', { fill: am5.color(0xe74c3c) })
  polygonSeries.mapPolygons.template.states.create('active', { fill: am5.color(0xffb84d), stroke: am5.color(0xffffff), strokeWidth: 1.5 })

  polygonSeries.mapPolygons.template.events.on('click', (ev) => {
    if (selectedPolygon && selectedPolygon !== ev.target) selectedPolygon.set('active', false)
    ev.target.set('active', true)
    selectedPolygon = ev.target
    // 世界视图下点击国家 → 选中整国；行政区视图下点击区域 → 仅高亮
    if (!viewingCountry.value) {
      const ctx = ev.target.dataItem.dataContext
      const id = ctx?.properties?.id || ctx?.id
      const en = ctx?.properties?.name || ctx?.name
      store.selectCountry({ id, en, zh: '' })
    }
  })
  return polygonSeries
}

function createCitySeries(data) {
  if (citySeries) citySeries.dispose()
  citySeries = chart.series.push(am5map.MapPointSeries.new(root, {}))
  citySeries.bullets.push((r, series, dataItem) => {
    const d = dataItem.dataContext
    const circle = am5.Circle.new(root, {
      radius: 4.5,
      fill: am5.color(0xff6b6b),
      stroke: am5.color(0xffffff),
      strokeWidth: 1.5,
      tooltipHTML: `<b>${d.zh || d.en}</b>`,
      cursorOverStyle: 'pointer',
    })
    circle.states.create('hover', { scale: 1.6 })
    circle.events.on('click', () => {
      const id = d.countryId
      if (SUB_MAPS[id]) {
        enterCountry(id)
      } else {
        store.selectCountry({ id, en: d.en, zh: d.zh })
        store.pushLog(`ℹ️ ${d.zh || d.en} 所属国家（${id}）暂无内部分区数据`)
      }
    })
    return am5.Bullet.new(root, { sprite: circle })
  })
  citySeries.data.setAll(data.map(c => ({ ...c, latitude: c.lat, longitude: c.lng })))
  return citySeries
}

function enterCountry(id) {
  const sub = SUB_MAPS[id]
  if (!sub) return
  viewingCountry.value = id
  const rec = getCountryName(id)
  store.selectCountry({ id, en: rec?.en || '', zh: rec?.zh || '' })
  createPolygonSeries(sub)
  createCitySeries(IMPORTANT_CITIES.filter(c => c.countryId === id))
  pointSeries && pointSeries.toFront() // 确保组件点始终在最上层
  const cen = rec?.centroid
  if (cen && chart) chart.zoomToGeoPoint({ latitude: cen[1], longitude: cen[0] }, 3.4, true, 800)
}

function exitToWorld() {
  viewingCountry.value = null
  createPolygonSeries(am5geodata_worldLow)
  createCitySeries(IMPORTANT_CITIES)
  pointSeries && pointSeries.toFront()
  if (chart) chart.zoomToGeoPoint({ latitude: 20, longitude: 10 }, 1, true, 600)
}

function buildPointData() {
  return components.value.map(c => ({
    id: c.id,
    latitude: c.lat,
    longitude: c.lng,
    type: c.type,
    title: c.title,
    value: c.value,
    color: c.color,
    markerId: c.markerId,
  }))
}

function buildChart() {
  if (!mapEl.value) return
  root = am5.Root.new(mapEl.value)
  root.setThemes([am5themes_Animated.new(root)])

  chart = root.container.children.push(am5map.MapChart.new(root, {
    panX: 'translateX',
    panY: 'translateY',
    projection: am5map.geoNaturalEarth1(),
    homeGeoPoint: { latitude: 20, longitude: 10 },
    homeZoomLevel: 1,
    maxZoomLevel: 10,
    minZoomLevel: 0.4,
    wheelable: true,
    pinchZoom: true,
    zoomControl: am5map.ZoomControl.new(root, {}),
  }))
  const bg = chart.get('background')
  if (bg) bg.set('fill', am5.color(0x0b1e3f))

  createPolygonSeries(am5geodata_worldLow)
  createCitySeries(IMPORTANT_CITIES)

  pointSeries = chart.series.push(am5map.MapPointSeries.new(root, {}))
  pointSeries.bullets.push((r, series, dataItem) => makeBullet(r, dataItem))
  pointSeries.data.setAll(buildPointData())
}

// 组件列表变化 → 更新地图上的点
watch(components, () => {
  if (pointSeries) pointSeries.data.setAll(buildPointData())
}, { deep: true })

// ── 事件处理 ──────────────────────────────────────────────────────
async function runAgent() {
  await store.agentRun()
  refreshPoints() // 强制刷新点图层，与拖拽放置一致，确保 Agent 添加的图标立即渲染
}

async function doSave() {
  try {
    const r = await store.saveToServer()
    store.pushLog(`💾 已保存到服务器 (id=${r?.id})`)
  } catch (e) {
    store.pushLog(`❌ 保存失败：${e?.message || e}`)
  }
}

async function doLoad() {
  try {
    const r = await store.loadFromServer()
    store.pushLog(r.msg)
  } catch (e) {
    store.pushLog(`❌ 加载失败：${e?.message || e}`)
  }
}

function doClear() {
  store.clearAll()
  store.pushLog('🗑 已清空全部组件')
}

function removeComp(id) { store.removeComponent(id) }

// ── 拖放后标记表单 ───────────────────────────────────────────────
const markerFormVisible = ref(false)
const markerSaving = ref(false)
const markerLat = ref(null)
const markerLng = ref(null)
const markerType = ref('gold')
const markerEditId = ref(null) // DB id，null=新增，非空=编辑
const markerCompId = ref(null) // 地图组件 id，编辑时用于更新
const markerForm = reactive({
  name: '',
  category: '',
  iconType: 'gold',
  country: '',
  region: '',
  description: '',
  annualOutput: '',
  annualProfit: '',
  operator: '',
  status: 1,
  createdBy: '',
})

async function openMarkerForm({ lat, lng, type, comp }) {
  markerLat.value = lat
  markerLng.value = lng
  markerType.value = type || 'gold'
  // 每次打开都清空所有字段，避免上次残留干扰本次
  resetMarkerForm()

  if (comp) {
    // 编辑模式：用组件信息预填（避免清空后被覆盖，先设基础再预填）
    markerEditId.value = comp.markerId || null
    markerCompId.value = comp.id
    markerForm.iconType = comp.type || type || 'gold'
    markerForm.name = comp.title || ''
    markerForm.category = legendGroups.find(g => g.types.includes(markerForm.iconType))?.name || ''
    // 若有 DB id，加载完整详情
    if (comp.markerId) {
      try {
        const rec = await getMapMarker(comp.markerId)
        if (rec) {
          Object.assign(markerForm, {
            name: rec.name || markerForm.name,
            category: rec.category || markerForm.category,
            iconType: rec.iconType || markerForm.iconType,
            country: rec.country || '',
            region: rec.region || '',
            description: rec.description || '',
            annualOutput: rec.annualOutput || '',
            annualProfit: rec.annualProfit || '',
            operator: rec.operator || '',
            status: rec.status ?? 1,
            createdBy: rec.createdBy || '',
          })
        }
      } catch (e) { /* 忽略，用组件已有信息 */ }
    }
  } else {
    // 新增模式（拖放图例）：清空后仅按拖放类型设置类型与分类
    markerEditId.value = null
    markerCompId.value = null
    markerForm.iconType = type || 'gold'
    markerForm.category = legendGroups.find(g => g.types.includes(type))?.name || ''
  }
  markerFormVisible.value = true
}

function resetMarkerForm() {
  Object.assign(markerForm, {
    name: '', category: '', iconType: 'gold', country: '', region: '',
    description: '', annualOutput: '', annualProfit: '', operator: '',
    status: 1, createdBy: '',
  })
}

function applyCompFields(comp) {
  comp.title = markerForm.name
  comp.type = markerForm.iconType
  comp.country = markerForm.country
  comp.region = markerForm.region
  comp.description = markerForm.description
  comp.annualOutput = markerForm.annualOutput
  comp.annualProfit = markerForm.annualProfit
  comp.operator = markerForm.operator
  comp.status = markerForm.status
}

function finishAndClose() {
  markerFormVisible.value = false
  resetMarkerForm()
}

// 新增：保存数据库 + 在地图显示（编辑时若记录不存在也走这里）
async function doCreate(payload) {
  const resp = await saveMapMarker(payload)
  store.pushLog(`💾 已保存标记「${markerForm.name}」到数据库 (id=${resp?.id})`)
  let item
  if (markerCompId.value) {
    // 编辑 404 转新建：更新已有组件
    item = components.value.find(x => x.id === markerCompId.value)
  }
  if (!item) {
    item = store.addAtPosition({
      lat: markerLat.value,
      lng: markerLng.value,
      type: markerForm.iconType,
      title: markerForm.name,
      color: TYPE_META[markerForm.iconType]?.color,
    })
  }
  if (item) {
    item.markerId = resp?.id
    applyCompFields(item)
  }
  refreshPoints()
}

async function submitMarkerForm() {
  if (!markerForm.name.trim()) { store.pushLog('⚠️ 请填写标记名称'); return }
  if (markerLat.value == null || markerLng.value == null) { store.pushLog('⚠️ 缺少经纬度'); return }
  markerSaving.value = true
  try {
    const payload = {
      latitude: markerLat.value,
      longitude: markerLng.value,
      name: markerForm.name,
      category: markerForm.category,
      iconType: markerForm.iconType,
      country: markerForm.country,
      region: markerForm.region,
      description: markerForm.description,
      annualOutput: markerForm.annualOutput,
      annualProfit: markerForm.annualProfit,
      operator: markerForm.operator,
      status: markerForm.status,
      createdBy: markerForm.createdBy,
    }
    if (markerEditId.value) {
      try {
        await updateMapMarker(markerEditId.value, payload)
        store.pushLog(`💾 已更新标记「${markerForm.name}」(id=${markerEditId.value})`)
        const comp = components.value.find(x => x.id === markerCompId.value)
        if (comp) { applyCompFields(comp); refreshPoints() }
      } catch (e) {
        // 记录在数据库中已不存在（404）→ 直接新建
        if (e && e.status === 404) {
          store.pushLog(`ℹ️ 原标记已不存在（404），转为新建`)
          await doCreate(payload)
        } else {
          throw e
        }
      }
    } else {
      await doCreate(payload)
    }
    finishAndClose()
  } catch (e) {
    store.pushLog(`❌ 保存标记失败：${e?.message || e}`)
  } finally {
    markerSaving.value = false
  }
}

onMounted(() => {
  store.loadLocal()
  buildChart()
})

onBeforeUnmount(() => {
  if (root) { root.dispose(); root = null }
})
</script>

<style scoped>
.worldmapPage {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
}
.pageTitle {
  font-size: 18px;
  font-weight: 800;
}
.viewTag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 13px;
  background: var(--panel-bg-2, #f5f5f5);
  color: var(--text-secondary, #666);
}
.viewTag .dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}
.topbarActions { display: flex; gap: 10px; }

.worldLayout {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 16px;
  min-height: calc(100vh - 160px);
  align-items: start;
}

.mapCard {
  position: relative;
  padding: 0;
  overflow: hidden;
  min-height: 640px;
}
.mapCard.dragActive .map {
  outline: 3px dashed #ff6b6b;
  outline-offset: -3px;
  background: color-mix(in srgb, var(--panel-bg-2, #0d1b3a) 80%, #ff6b6b) !important;
}
.map {
  width: 100%;
  height: 640px;
  background: var(--panel-bg-2, #0d1b3a);
}
.floatCountry {
  position: absolute;
  left: 16px;
  top: 16px;
  padding: 8px 14px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  border-radius: 20px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
  backdrop-filter: blur(4px);
}
.floatCountry .dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.legend {
  display: flex;
  align-items: flex-start;
  flex-direction: column;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px 16px;
  border-top: 1px solid var(--border-color-light, #eee);
  font-size: 13px;
  background: var(--panel-bg-2, #fafafa);
}
.legendGroup {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 14px;
  width: 100%;
}
.legendGroupName {
  font-weight: 700;
  font-size: 12px;
  color: var(--text-secondary, #888);
  margin-right: 2px;
  min-width: 64px;
}
.legendItem {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--text-primary, #333);
}
.legendItem.muted { color: var(--text-secondary, #999); }
.legendItem.draggable { cursor: grab; user-select: none; }
.legendItem.draggable:active { cursor: grabbing; }
.legendItem.draggable:hover { color: var(--primary-color, #409eff); }
.legendIcon { display: inline-flex; line-height: 0; }
.legendIcon :deep(svg) { width: 18px; height: 18px; display: block; }
.legendEmoji { font-size: 16px; line-height: 1; }
.legendSep {
  width: 1px;
  height: 18px;
  background: var(--border-color-light, #ddd);
  margin: 0 2px;
}
.legendHint {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-secondary, #999);
}
.dragGhost {
  position: fixed;
  left: 0;
  top: 0;
  z-index: 3000;
  pointer-events: none;
  background: rgba(0, 0, 0, 0.72);
  color: #fff;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  display: none;
  user-select: none;
}
.markerCoords {
  padding: 8px 12px;
  margin-bottom: 14px;
  background: var(--panel-bg-2, #f5f5f5);
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-secondary, #666);
}
.markerCoords b { color: var(--primary-color, #409eff); }

.panel {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: calc(100vh - 120px);
  overflow-y: auto;
}
.panelSection {
  padding: 14px;
  border-bottom: 1px solid var(--border-color-light, #eee);
}
.panelTitle {
  font-weight: 700;
  font-size: 15px;
  margin-bottom: 10px;
}
.hint { font-size: 12px; margin-bottom: 10px; line-height: 1.6; }
.actionRow {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
}
.aiToggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  cursor: pointer;
  user-select: none;
  color: var(--text-secondary, #888);
}
.aiToggle input { display: none; }
.aiToggle.active { color: #409eff; }

.agentLog {
  margin-top: 10px;
  max-height: 160px;
  overflow-y: auto;
  background: var(--panel-bg-2, #f5f5f5);
  border-radius: 8px;
  padding: 8px;
}
.logLine {
  font-size: 11px;
  line-height: 1.6;
  color: var(--text-secondary, #666);
  word-break: break-all;
}

.countryBox {
  padding: 10px;
  background: var(--panel-bg-2, #f5f5f5);
  border-radius: 8px;
  margin-bottom: 12px;
}
.countryName { font-size: 16px; font-weight: 700; }
.mono { font-family: monospace; font-size: 12px; }

.formRow {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.formRow label {
  width: 64px;
  font-size: 13px;
  color: var(--text-secondary, #666);
  flex-shrink: 0;
}
.colorInput {
  width: 40px;
  height: 28px;
  border: none;
  background: none;
  cursor: pointer;
  padding: 0;
}

.compRow {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid var(--border-color-light, #eee);
  margin-bottom: 6px;
}
.compIcon { font-size: 18px; }
.compInfo { flex: 1; min-width: 0; }
.compActions { display: flex; align-items: center; gap: 6px; }
.compTitle { font-size: 13px; font-weight: 600; }
.compTitle span { color: var(--primary-color, #409eff); }
.small { font-size: 11px; }

.btn.danger {
  color: #f56c6c;
  border-color: #f56c6c;
  background: transparent;
}
.btn.danger:hover { background: rgba(245, 108, 108, 0.1); }
</style>


