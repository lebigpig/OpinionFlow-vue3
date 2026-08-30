<template>
  <div class="worldmapPage">
    <div class="topbar card">
      <div class="pageTitle">世界格局</div>
      <div class="topbarActions">
        <button class="btn" type="button" @click="doSave">💾 保存到服务器</button>
        <button class="btn" type="button" @click="doLoad">📥 从服务器加载</button>
        <button class="btn danger" type="button" @click="doClear">🗑 清空全部</button>
      </div>
    </div>

    <div class="worldLayout">
      <!-- 世界地图 -->
      <div class="mapCard card">
        <div ref="mapEl" class="map"></div>
        <div v-if="selectedCountry" class="floatCountry">
          <span class="dot" :style="{ background: addColor }"></span>
          已选：{{ selectedCountry.zh || selectedCountry.en }}（{{ selectedCountry.id }}）
        </div>
      </div>

      <!-- 右侧控制面板 -->
      <div class="panel card">
        <!-- 智能 Agent -->
        <div class="panelSection">
          <div class="panelTitle">🤖 智能 Agent</div>
          <div class="muted hint">输入指令，Agent 会自主把组件添加到指定国家，如："在中国添加GDP柱状图，数值500"</div>
          <el-input
              v-model="agentInput"
              type="textarea"
              :rows="3"
              placeholder="例如：在日本添加折线图，GDP 趋势 1200"
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

        <!-- 选中国家 + 手动添加 -->
        <div class="panelSection">
          <div class="panelTitle">📍 选中国家</div>
          <div v-if="selectedCountry" class="countryBox">
            <div class="countryName">{{ selectedCountry.zh || selectedCountry.en }}</div>
            <div class="muted mono">ISO：{{ selectedCountry.id }} / {{ selectedCountry.en }}</div>
            <button class="btn sm" type="button" @click="clearSelect">取消选择</button>
          </div>
          <div v-else class="muted">点击地图上的国家区域以选中整个国家</div>

          <div class="formRow">
            <label>组件类型</label>
            <el-select v-model="addType" style="flex:1">
              <el-option v-for="(m, k) in TYPE_META" :key="k" :label="m.label" :value="k" />
            </el-select>
          </div>
          <div class="formRow">
            <label>名称</label>
            <el-input v-model="addTitle" placeholder="如 GDP" style="flex:1" />
          </div>
          <div class="formRow">
            <label>数值</label>
            <el-input-number v-model="addValue" :controls="false" placeholder="可选" style="flex:1" />
          </div>
          <div class="formRow">
            <label>颜色</label>
            <input type="color" v-model="addColor" class="colorInput" />
          </div>
          <button class="btn primary" type="button" @click="handleAdd" :disabled="!selectedCountry">添加到当前国家</button>
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
            <button class="btn-delete-item" type="button" @click="removeComp(c.id)" title="删除">✕</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as am5 from '@amcharts/amcharts5'
import * as am5map from '@amcharts/amcharts5/map'
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated'
import am5geodata_worldLow from '@amcharts/amcharts5-geodata/worldLow'
import { useWorldMapStore, TYPE_META } from '@/stores/WorldMapStore.js'
import { storeToRefs } from 'pinia'

const store = useWorldMapStore()
const { components, selectedCountry, agentInput, agentLog, agentRunning, agentUseAI } = storeToRefs(store)

const mapEl = ref(null)
const addType = ref('marker')
const addTitle = ref('')
const addValue = ref(null)
const addColor = ref('#409eff')

let root = null
let chart = null
let polygonSeries = null
let pointSeries = null
let selectedPolygon = null

function typeDefaultColor(t) { return TYPE_META[t]?.color || '#409eff' }
watch(addType, (t) => { addColor.value = typeDefaultColor(t) }, { immediate: true })

// ── 组件图标构建 ──────────────────────────────────────────────────
function buildIcon(root, type, color) {
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
  // marker
  return am5.Circle.new(root, { radius: 8, fill: color, stroke: am5.color(0xffffff), strokeWidth: 2 })
}

function makeBullet(root, dataItem) {
  const d = dataItem.dataContext
  const type = d.type || 'marker'
  const color = am5.color(d.color || typeDefaultColor(type))
  const container = am5.Container.new(root, {
    width: 70, height: 54,
    centerX: am5.p50, centerY: am5.p50,
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
  container.events.on('click', (ev) => {
    const it = components.value.find(x => x.id === d.id)
    if (it) store.selectCountry({ id: it.countryId, en: it.countryName, zh: it.zh })
    ev.stopPropagation()
  })
  return am5.Bullet.new(root, { sprite: container })
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

  polygonSeries = chart.series.push(am5map.MapPolygonSeries.new(root, {
    geoJSON: am5geodata_worldLow,
    exclude: ['AQ'],
  }))
  polygonSeries.mapPolygons.template.setAll({
    tooltipHTML: '<b>{name}</b>',
    fill: am5.color(0x2f5b9e),
    stroke: am5.color(0xffffff),
    strokeWidth: 0.5,
    fillOpacity: 0.9,
  })
  polygonSeries.mapPolygons.template.states.create('hover', { fill: am5.color(0x5b8dd6) })
  polygonSeries.mapPolygons.template.states.create('active', { fill: am5.color(0xffb84d), stroke: am5.color(0xffffff), strokeWidth: 1.5 })

  polygonSeries.mapPolygons.template.events.on('click', (ev) => {
    if (selectedPolygon && selectedPolygon !== ev.target) selectedPolygon.set('active', false)
    ev.target.set('active', true)
    selectedPolygon = ev.target
    const ctx = ev.target.dataItem.dataContext
    const id = ctx?.properties?.id || ctx?.id
    const en = ctx?.properties?.name || ctx?.name
    store.selectCountry({ id, en, zh: '' })
  })

  pointSeries = chart.series.push(am5map.MapPointSeries.new(root, {}))
  pointSeries.bullets.push((r, series, dataItem) => makeBullet(r, dataItem))
  pointSeries.data.setAll(buildPointData())
}

// 组件列表变化 → 更新地图上的点
watch(components, () => {
  if (pointSeries) pointSeries.data.setAll(buildPointData())
}, { deep: true })

// ── 事件处理 ──────────────────────────────────────────────────────
async function runAgent() { await store.agentRun() }

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

function handleAdd() {
  const r = store.addToSelected({ type: addType.value, title: addTitle.value, value: addValue.value, color: addColor.value })
  store.pushLog(r.msg)
  if (r.ok) { addTitle.value = ''; addValue.value = null }
}

function removeComp(id) { store.removeComponent(id) }
function clearSelect() { store.selectCountry(null) }

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


