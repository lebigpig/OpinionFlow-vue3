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

  <!-- 点击国家 → 宏观指标编辑表单（选择年份 → where 查询 → 修改 → 提交 update） -->
  <el-dialog
      v-model="macroVisible"
      :title="`${macroCountryInfo?.en || '国家'} · 宏观指标`"
      width="1100px"
      top="3vh"
      :close-on-click-modal="false"
      @closed="closeMacroForm"
  >
    <div v-loading="macroLoading" class="macroBody">
      <el-empty v-if="macroError && !macroLoading" :description="macroError" />
      <template v-else-if="macroData">
        <div class="macroToolbar">
          <span class="macroQuestion">请选择数据年份：</span>
          <el-select
              v-model="macroYear"
              placeholder="选择年份"
              style="width: 150px"
              :disabled="macroLoading || !macroYears.length"
              @change="onMacroYearChange"
          >
            <el-option v-for="y in macroYears" :key="y" :label="`${y} 年`" :value="y" />
          </el-select>
          <span v-if="macroForm.id != null" class="macroRecordId">
            记录 #{{ macroForm.id }} · {{ macroForm.dataSource || '未知来源' }}
          </span>
          <span class="muted macroHint">修改字段后点击右下角「提交修改」，将按记录 id 写入数据库</span>
        </div>

        <el-form :model="macroForm" label-width="120px" class="macroForm" @click="onMacroFormClick">
          <div class="macroGroup">
            <div class="macroGroupTitle">📋 基本信息</div>
            <div class="macroGrid">
              <el-form-item label="国家/地区">
                <el-input v-model="macroForm.country" placeholder="与 map_markers 的 country 对应" />
              </el-form-item>
              <el-form-item label="ISO 代码">
                <el-input v-model="macroForm.countryCode" placeholder="如 CHN" />
              </el-form-item>
              <el-form-item label="数据年份">
                <el-input v-model.number="macroForm.year" placeholder="如 2024" />
              </el-form-item>
              <el-form-item label="所属区域">
                <el-input v-model="macroForm.region" placeholder="如 东亚与太平洋" />
              </el-form-item>
            </div>
          </div>

          <div class="macroGroup">
            <div class="macroGroupTitle">🧮 经济总量</div>
            <div class="macroGrid">
              <el-form-item label="GDP（现价美元）">
                <el-input v-model="macroForm.gdpUsd" data-metric="gdpUsd" placeholder="如 18729668435848.00" />
              </el-form-item>
              <el-form-item label="GDP 实际增长率">
                <el-input v-model="macroForm.gdpGrowthPct" data-metric="gdpGrowthPct" placeholder="如 4.9583" />
              </el-form-item>
            </div>
          </div>

          <div class="macroGroup">
            <div class="macroGroupTitle">🏷 物价</div>
            <div class="macroGrid">
              <el-form-item label="CPI 同比涨幅">
                <el-input v-model="macroForm.cpiPct" data-metric="cpiPct" placeholder="如 0.2181" />
              </el-form-item>
              <el-form-item label="PPI 同比涨幅">
                <el-input v-model="macroForm.ppiPct" data-metric="ppiPct" placeholder="如 2.3568" />
              </el-form-item>
              <el-form-item label="通胀率">
                <el-input v-model="macroForm.inflationPct" data-metric="inflationPct" placeholder="如 0.2181" />
              </el-form-item>
            </div>
          </div>

          <div class="macroGroup">
            <div class="macroGroupTitle">💼 就业与汇率</div>
            <div class="macroGrid">
              <el-form-item label="就业率">
                <el-input v-model="macroForm.employmentRatePct" data-metric="employmentRatePct" placeholder="如 61.9310" />
              </el-form-item>
              <el-form-item label="失业率">
                <el-input v-model="macroForm.unemploymentRatePct" data-metric="unemploymentRatePct" placeholder="如 4.5900" />
              </el-form-item>
              <el-form-item label="美元兑本币汇率">
                <el-input v-model="macroForm.exchangeRateUsd" data-metric="exchangeRateUsd" placeholder="1 USD = ? 本币" />
              </el-form-item>
            </div>
          </div>

          <div class="macroGroup">
            <div class="macroGroupTitle">👥 人口</div>
            <div class="macroGrid">
              <el-form-item label="总人口">
                <el-input v-model="macroForm.populationTotal" data-metric="populationTotal" placeholder="如 1408975000" />
              </el-form-item>
              <el-form-item label="人口增长率">
                <el-input v-model="macroForm.populationGrowthPct" data-metric="populationGrowthPct" placeholder="如 -0.1231" />
              </el-form-item>
              <el-form-item label="年龄中位数">
                <el-input v-model="macroForm.medianAge" data-metric="medianAge" placeholder="如 39.10" />
              </el-form-item>
              <el-form-item label="城镇化率">
                <el-input v-model="macroForm.urbanPopulationPct" data-metric="urbanPopulationPct" placeholder="如 65.8947" />
              </el-form-item>
              <el-form-item label="0–14 岁占比">
                <el-input v-model="macroForm.age014Pct" data-metric="age014Pct" placeholder="如 16.0078" />
              </el-form-item>
              <el-form-item label="15–64 岁占比">
                <el-input v-model="macroForm.age1564Pct" data-metric="age1564Pct" placeholder="如 69.3269" />
              </el-form-item>
              <el-form-item label="65 岁+ 占比">
                <el-input v-model="macroForm.age65PlusPct" data-metric="age65PlusPct" placeholder="如 14.6653" />
              </el-form-item>
            </div>
          </div>

        <div class="macroGroup">
            <div class="macroGroupTitle">🚢 贸易</div>
            <div class="macroGrid">
              <el-form-item label="货物出口额">
                <el-input v-model="macroForm.exportsGoodsUsd" data-metric="exportsGoodsUsd" placeholder="USD" />
              </el-form-item>
              <el-form-item label="货物进口额">
                <el-input v-model="macroForm.importsGoodsUsd" data-metric="importsGoodsUsd" placeholder="USD" />
              </el-form-item>
              <el-form-item label="贸易依存度 / GDP">
                <el-input v-model="macroForm.tradeOpennessPct" data-metric="tradeOpennessPct" placeholder="如 32.8837" />
              </el-form-item>
              <el-form-item label="进口 / 出口比">
                <el-input v-model="macroForm.importExportRatio" data-metric="importExportRatio" placeholder="如 1.0342（>1 逆差，<1 顺差）" />
              </el-form-item>
            </div>
          </div>

          <div class="macroGroup">
            <div class="macroGroupTitle">🏦 政府负债</div>
            <div class="macroGrid">
              <el-form-item label="政府债务总额">
                <el-input v-model="macroForm.govtDebtTotal" data-metric="govtDebtTotal" placeholder="本币" />
              </el-form-item>
              <el-form-item label="政府债务 / GDP">
                <el-input v-model="macroForm.govtDebtGdpPct" data-metric="govtDebtGdpPct" placeholder="如 115.7684" />
              </el-form-item>
              <el-form-item label="债务口径说明">
                <el-input v-model="macroForm.govtDebtScope" placeholder="如 中央政府债务" />
              </el-form-item>
            </div>
          </div>

          <div class="macroGroup">
            <div class="macroGroupTitle">🏛 政治制度</div>
            <div class="macroGrid">
              <el-form-item label="政治制度描述">
                <el-input v-model="macroForm.politicalSystem" placeholder="描述" />
              </el-form-item>
              <el-form-item label="政体类型">
                <el-input v-model="macroForm.regimeType" placeholder="如 议会制共和制" />
              </el-form-item>
            </div>
          </div>

          <div class="macroGroup">
            <div class="macroGroupTitle">📎 数据来源与备注</div>
            <div class="macroGrid">
              <el-form-item label="数据来源">
                <el-input v-model="macroForm.dataSource" placeholder="如 World Bank WDI" />
              </el-form-item>
              <el-form-item label="来源链接">
                <el-input v-model="macroForm.sourceUrl" placeholder="https://..." />
              </el-form-item>
              <el-form-item label="备注" class="macroSpan2">
                <el-input v-model="macroForm.notes" type="textarea" :rows="2" placeholder="口径差异、估算值等说明" />
              </el-form-item>
            </div>
          </div>
        </el-form>

        <!-- 点击指标 → 该国该指标全部年份柱形图 + 同比增减折线图 -->
        <div v-if="macroMetric" v-loading="macroHistoryLoading" class="macroChartCard">
          <div class="macroChartHead">
            <span class="macroChartTitle">
              📈 {{ macroCurrentMetric?.label || '' }} · 全部年份趋势
              <span class="muted">（{{ macroCountryInfo?.query || '' }}）</span>
            </span>
            <el-checkbox v-model="macroShowBarLabel">柱上显示数值</el-checkbox>
            <el-checkbox v-model="macroShowYoyLine">显示同比增减量折线</el-checkbox>
            <el-checkbox v-model="macroShowYoyPctLine">显示同比增长率(%)折线</el-checkbox>
            <el-button size="small" text @click="macroMetric = ''">收起图表</el-button>
          </div>
          <div ref="macroChartEl" class="macroChart"></div>
        </div>
        <div v-else class="muted macroChartTip">
          💡 点击上方任意指标（如「就业率」），查看该国该指标全部年份的柱形图与同比增减折线（低年份 → 高年份，从左往右）
        </div>
      </template>
      <div v-else class="muted macroLoadingText">加载中…</div>
    </div>
    <template #footer>
      <el-button @click="macroVisible = false">取消</el-button>
      <el-button type="success" :loading="macroSaving" :disabled="!macroData" @click="submitMacroForm">💾 提交修改</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import * as am5 from '@amcharts/amcharts5'
import * as am5map from '@amcharts/amcharts5/map'
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated'
import am5geodata_worldLow from '@amcharts/amcharts5-geodata/worldLow'
import * as echarts from 'echarts'
import { saveMapMarker, updateMapMarker, getMapMarker, fetchCountryMacroByCountry, fetchCountryMacroByYear, fetchCountryMacroCountries, updateCountryMacro } from '@/lib/api.js'
import { useWorldMapStore, TYPE_META } from '@/stores/WorldMapStore.js'
import { SUB_MAPS, IMPORTANT_CITIES } from '@/lib/worldMapData.js'
import { ZINC_SVG, ALUMINUM_SVG, SOYBEAN_SVG } from '@/lib/worldMapIcons.js'
import { getCountryName, resolveMacroCountry } from '@/lib/worldCountries.js'
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
    // 世界视图下点击国家 → 选中整国 + 弹出该国宏观指标表单；行政区视图下点击区域 → 仅高亮
    if (!viewingCountry.value) {
      const ctx = ev.target.dataItem.dataContext
      const id = ctx?.properties?.id || ctx?.id
      const en = ctx?.properties?.name || ctx?.name
      store.selectCountry({ id, en, zh: '' })
      openMacroForm({ id, en })
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

// ── 国家宏观指标弹窗（点击地图国家 → 选择年份 → 查询/编辑 country_macro_indicators） ──
const macroVisible = ref(false)
const macroLoading = ref(false)
const macroSaving = ref(false)
const macroData = ref(null)       // 当前记录（后端返回的 Map，含 id）
const macroError = ref('')
const macroCountryInfo = ref(null) // { id, en, query } 当前点击的国家
const macroYears = ref([])         // 该国所有数据年份（降序）
const macroYear = ref(null)        // 当前选中年份

// —— 趋势图：点击某个指标 → 该国该指标全部年份柱形图 + 同比增减折线图 ——
const macroMetric = ref('')        // 当前用于画图的指标 key（空 = 未选择，不显示图表）
const macroHistory = ref([])       // 该国全部年份原始记录（by-country 结果）
const macroHistoryLoading = ref(false)
let macroHistoryQuery = ''         // 已缓存历史数据对应的国家名
const macroShowBarLabel = ref(true) // 勾选：柱形图上显示数值
const macroShowYoyLine = ref(true)  // 勾选：显示同比增减量折线（绝对值）
const macroShowYoyPctLine = ref(true) // 勾选：显示同比增长率折线（%）
const macroChartEl = ref(null)
let macroChart = null

// 参与趋势图的指标（key 与后端 toMap 字段一一对应）
const MACRO_METRICS = [
  { key: 'gdpUsd', label: 'GDP（现价美元）', unit: 'USD' },
  { key: 'gdpGrowthPct', label: 'GDP 实际增长率', unit: '%' },
  { key: 'cpiPct', label: 'CPI 同比涨幅', unit: '%' },
  { key: 'ppiPct', label: 'PPI 同比涨幅', unit: '%' },
  { key: 'inflationPct', label: '通胀率', unit: '%' },
  { key: 'employmentRatePct', label: '就业率', unit: '%' },
  { key: 'unemploymentRatePct', label: '失业率', unit: '%' },
  { key: 'exchangeRateUsd', label: '汇率（1 美元 = ? 本币）', unit: '' },
  { key: 'populationTotal', label: '总人口', unit: '人' },
  { key: 'populationGrowthPct', label: '人口增长率', unit: '%' },
  { key: 'medianAge', label: '年龄中位数', unit: '岁' },
  { key: 'urbanPopulationPct', label: '城镇化率', unit: '%' },
  { key: 'age014Pct', label: '0–14 岁占比', unit: '%' },
  { key: 'age1564Pct', label: '15–64 岁占比', unit: '%' },
  { key: 'age65PlusPct', label: '65 岁+ 占比', unit: '%' },
  { key: 'exportsGoodsUsd', label: '货物出口额', unit: 'USD' },
  { key: 'importsGoodsUsd', label: '货物进口额', unit: 'USD' },
  { key: 'tradeOpennessPct', label: '贸易依存度', unit: '%' },
  { key: 'importExportRatio', label: '进口 / 出口比', unit: '' },
  { key: 'govtDebtTotal', label: '政府债务总额', unit: '本币' },
  { key: 'govtDebtGdpPct', label: '政府债务 / GDP', unit: '%' },
]
const macroCountryCache = ref([])  // 有宏观数据的国家清单（缓存）
let macroCountryCacheLoaded = false

// 与后端 toMap 字段一一对应的可编辑表单
const macroForm = reactive({
  id: null,
  country: '',
  countryCode: '',
  year: null,
  region: '',
  gdpUsd: '',
  gdpGrowthPct: '',
  cpiPct: '',
  ppiPct: '',
  inflationPct: '',
  employmentRatePct: '',
  unemploymentRatePct: '',
  exchangeRateUsd: '',
  populationTotal: '',
  populationGrowthPct: '',
  medianAge: '',
  urbanPopulationPct: '',
  age014Pct: '',
  age1564Pct: '',
  age65PlusPct: '',
  exportsGoodsUsd: '',
  importsGoodsUsd: '',
  tradeOpennessPct: '',
  importExportRatio: '',
  govtDebtTotal: '',
  govtDebtGdpPct: '',
  govtDebtScope: '',
  politicalSystem: '',
  regimeType: '',
  dataSource: '',
  sourceUrl: '',
  notes: '',
})

const MACRO_FORM_KEYS = Object.keys(macroForm)

function resetMacroForm() {
  for (const k of MACRO_FORM_KEYS) macroForm[k] = (k === 'id' || k === 'year') ? null : ''
}

function fillMacroForm(rec) {
  for (const k of MACRO_FORM_KEYS) {
    const v = rec ? rec[k] : undefined
    macroForm[k] = (v === null || v === undefined) ? ((k === 'id' || k === 'year') ? null : '') : v
  }
}

async function ensureMacroCountryCache() {
  if (macroCountryCacheLoaded) return macroCountryCache.value
  try {
    macroCountryCache.value = await fetchCountryMacroCountries()
  } catch {
    macroCountryCache.value = []
  }
  macroCountryCacheLoaded = true
  return macroCountryCache.value
}

async function openMacroForm({ id, en }) {
  const list = await ensureMacroCountryCache()
  const query = resolveMacroCountry(en, list)
  macroCountryInfo.value = { id, en, query }
  macroVisible.value = true
  macroLoading.value = true
  macroSaving.value = false
  macroError.value = ''
  macroData.value = null
  macroYears.value = []
  macroYear.value = null
  macroMetric.value = ''
  macroHistory.value = []
  macroHistoryQuery = ''
  macroHistoryLoading.value = false
  disposeMacroChart()
  resetMacroForm()

  if (!query) {
    macroLoading.value = false
    macroError.value = `未收录「${en}」的宏观指标数据`
    return
  }
  try {
    // 1) 先取该国家所有年份，默认选中最新一年
    const rows = await fetchCountryMacroByCountry(query)
    const years = [...new Set((rows || []).map(r => r.year).filter(y => y != null))].sort((a, b) => b - a)
    macroYears.value = years
    // 缓存该国全部年份原始记录，供趋势图使用（点击指标时无需再次请求）
    macroHistory.value = rows || []
    macroHistoryQuery = query
    if (!years.length) {
      macroLoading.value = false
      macroError.value = `未查询到「${query}」的宏观指标数据`
      return
    }
    macroYear.value = years[0]
    // 2) 按选中年份查询记录
    await loadMacroYear(query, years[0])
  } catch (e) {
    macroLoading.value = false
    macroError.value = `查询失败：${e?.message || e}`
  }
}

// 按国家 + 年份查询并填充表单（与后端 by-year 接口对应，where country + year）
async function loadMacroYear(query, year) {
  macroLoading.value = true
  macroError.value = ''
  macroSaving.value = false
  try {
    const rows = await fetchCountryMacroByYear(query, year)
    if (!rows || !rows.length) {
      macroData.value = null
      resetMacroForm()
      macroError.value = `未查询到「${query}」${year} 年的宏观指标数据`
      return
    }
    const rec = rows[0]
    macroData.value = rec
    fillMacroForm(rec)
  } catch (e) {
    macroError.value = `查询失败：${e?.message || e}`
  } finally {
    macroLoading.value = false
  }
}

async function onMacroYearChange() {
  if (!macroYear.value || !macroCountryInfo.value?.query) return
  await loadMacroYear(macroCountryInfo.value.query, macroYear.value)
}

// 提交修改 → 后端 UPDATE
async function submitMacroForm() {
  const id = macroForm.id != null ? macroForm.id : macroData.value?.id
  if (id == null) {
    store.pushLog('⚠️ 缺少记录 id，无法保存')
    return
  }
  if (!macroForm.country?.trim()) {
    store.pushLog('⚠️ 国家名称不能为空')
    return
  }
  macroSaving.value = true
  try {
    const resp = await updateCountryMacro(id, { ...macroForm })
    if (resp) {
      macroData.value = resp
      fillMacroForm(resp)
      store.pushLog(`✅ 已保存 ${resp.country} ${resp.year} 年宏观指标 (id=${resp.id})`)
    } else {
      store.pushLog('⚠️ 保存返回为空')
    }
  } catch (e) {
    store.pushLog(`❌ 保存失败：${e?.message || e}`)
  } finally {
    macroSaving.value = false
  }
}

// ────────── 趋势图：点击指标 → 全部年份柱形图 + 同比增减折线图 ──────────

/** 表单内点击任意指标项（输入框或标签）→ 选中该指标并绘制趋势图 */
function onMacroFormClick(e) {
  const target = e?.target
  if (!target?.closest) return
  let el = target.closest('[data-metric]')
  if (!el) {
    // 点到表单项的 label / 空白区域时，取同一 form-item 内的指标输入框
    const item = target.closest('.el-form-item')
    if (item) el = item.querySelector('[data-metric]')
  }
  if (!el) return
  const key = el.getAttribute('data-metric')
  if (key) selectMacroMetric(key)
}

/** 选中指标 → 展示该国该指标「全部年份」的趋势图 */
async function selectMacroMetric(key) {
  if (!MACRO_METRICS.some((m) => m.key === key)) return
  macroMetric.value = key
  await ensureMacroHistory()
  await nextTick()
  // 图表在表单下方，点击指标后滚动到可视区域
  macroChartEl.value?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
}

/** 历史数据：优先复用 openMacroForm 已缓存的 by-country 结果 */
async function ensureMacroHistory() {
  const query = macroCountryInfo.value?.query
  if (!query) return
  if (macroHistoryQuery === query && macroHistory.value.length) return
  macroHistoryLoading.value = true
  try {
    const rows = await fetchCountryMacroByCountry(query)
    macroHistory.value = rows || []
    macroHistoryQuery = query
  } catch (e) {
    store.pushLog(`❌ 趋势数据加载失败：${e?.message || e}`)
    macroHistory.value = []
    macroHistoryQuery = ''
  } finally {
    macroHistoryLoading.value = false
  }
}

/** 当前指标元数据（标题 / 轴名用） */
const macroCurrentMetric = computed(() =>
  MACRO_METRICS.find((m) => m.key === macroMetric.value) || null,
)

function macroToNum(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** 数值友好格式：十亿/百万/千分位/小数 */
function macroFmtNum(v) {
  if (v === null || v === undefined || v === '') return ''
  const n = Number(v)
  if (!Number.isFinite(n)) return String(v)
  const abs = Math.abs(n)
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (abs >= 1e4) return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
  return n.toFixed(abs < 10 ? 2 : 1)
}

/**
 * 组装序列：X 轴年份升序（低年份 → 高年份，从左往右）
 * 柱形 = 指标值；折线 = 同比增减量（当年 − 上一年）
 * 同一年有多条数据源记录时，优先取当前编辑记录的 dataSource，否则取第一条。
 */
const macroMetricSeries = computed(() => {
  const key = macroMetric.value
  if (!key || !macroHistory.value.length) return []
  const prefer = macroForm.dataSource
  const byYear = new Map()
  for (const r of macroHistory.value) {
    const y = Number(r?.year)
    if (!Number.isFinite(y)) continue
    const cur = byYear.get(y)
    if (!cur) { byYear.set(y, r); continue }
    if (prefer && r.dataSource === prefer && cur.dataSource !== prefer) byYear.set(y, r)
  }
  const years = [...byYear.keys()].sort((a, b) => a - b) // 低 → 高
  const out = []
  let prev = null
  for (const y of years) {
    const rec = byYear.get(y)
    const value = macroToNum(rec[key])
    const yoy = value !== null && prev !== null ? Number((value - prev).toFixed(4)) : null
    // 同比增长率（%）：(当年 − 上一年) / |上一年| × 100
    const yoyPct =
      value !== null && prev !== null && prev !== 0
        ? Number((((value - prev) / Math.abs(prev)) * 100).toFixed(4))
        : null
    out.push({ year: y, value, yoy, yoyPct, dataSource: rec.dataSource || '' })
    if (value !== null) prev = value
  }
  return out
})

/** 绘制/刷新趋势图（勾选项实时生效） */
function renderMacroChart() {
  if (!macroMetric.value || !macroChartEl.value) return
  const metric = macroCurrentMetric.value
  if (!metric) return
  if (!macroChart) macroChart = echarts.init(macroChartEl.value)

  const data = macroMetricSeries.value
  const years = data.map((d) => d.year)
  const values = data.map((d) => d.value)
  const yoys = data.map((d) => d.yoy)
  const yoyPcts = data.map((d) => d.yoyPct)
  const barName = metric.unit ? `${metric.label} (${metric.unit})` : metric.label

  const series = [
    {
      name: barName,
      type: 'bar',
      data: values,
      yAxisIndex: 0,
      barMaxWidth: 42,
      itemStyle: { color: '#409eff', borderRadius: [4, 4, 0, 0] },
      label: {
        show: macroShowBarLabel.value, // 勾选：柱形图上显示数值
        position: 'top',
        fontSize: 11,
        formatter: (p) => macroFmtNum(p.value),
      },
    },
  ]

  if (macroShowYoyLine.value) {
    series.push({
      name: '同比增减量',
      type: 'line',
      data: yoys,
      yAxisIndex: 1,
      smooth: true,
      symbol: 'circle',
      symbolSize: 7,
      connectNulls: true,
      itemStyle: { color: '#e6a23c' },
      lineStyle: { width: 2, color: '#e6a23c' },
      label: {
        show: true, // 折线上显示同比增减量
        position: 'bottom',
        fontSize: 11,
        color: '#e6a23c',
        formatter: (p) =>
          p.value === null || p.value === undefined ? '' : `${p.value > 0 ? '+' : ''}${macroFmtNum(p.value)}`,
      },
    })
  }

  if (macroShowYoyPctLine.value) {
    series.push({
      name: '同比增长率(%)',
      type: 'line',
      data: yoyPcts,
      yAxisIndex: 2,
      smooth: true,
      symbol: 'triangle',
      symbolSize: 7,
      connectNulls: true,
      itemStyle: { color: '#67c23a' },
      lineStyle: { width: 2, color: '#67c23a', type: 'dashed' },
      label: {
        show: true, // 折线上显示同比增长率
        position: 'top',
        fontSize: 11,
        color: '#67c23a',
        formatter: (p) =>
          p.value === null || p.value === undefined ? '' : `${p.value > 0 ? '+' : ''}${Number(p.value).toFixed(2)}%`,
      },
    })
  }

  macroChart.setOption(
    {
      tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
      legend: { top: 0, data: series.map((s) => s.name) },
      grid: {
        left: 76,
        right: macroShowYoyPctLine.value ? 138 : (macroShowYoyLine.value ? 86 : 40),
        top: 42,
        bottom: 44,
      },
      xAxis: {
        type: 'category',
        name: '年份',
        nameLocation: 'middle',
        nameGap: 26,
        data: years,
      },
      yAxis: [
        {
          type: 'value',
          name: metric.label,
          nameTextStyle: { fontSize: 11 },
          axisLabel: { formatter: (v) => macroFmtNum(v) },
        },
        {
          type: 'value',
          name: '同比增减量',
          show: macroShowYoyLine.value,
          nameTextStyle: { fontSize: 11 },
          axisLabel: { formatter: (v) => macroFmtNum(v) },
          splitLine: { show: false },
        },
        {
          type: 'value',
          name: '同比增长率(%)',
          show: macroShowYoyPctLine.value,
          position: 'right',
          offset: 64,
          nameTextStyle: { fontSize: 11 },
          axisLabel: { formatter: (v) => `${macroFmtNum(v)}%` },
          splitLine: { show: false },
        },
      ],
      series,
    },
    { notMerge: true },
  )
}

/** 数据/勾选项变化 → 下一帧重绘（等待图表容器渲染完成） */
function scheduleMacroRender() {
  if (!macroMetric.value) {
    // 收起图表：销毁实例，避免下次展开时渲染到已移除的容器上
    disposeMacroChart()
    return
  }
  nextTick(() => renderMacroChart())
}

function resizeMacroChart() {
  macroChart?.resize()
}

function disposeMacroChart() {
  if (macroChart) {
    macroChart.dispose()
    macroChart = null
  }
}

watch([macroMetric, macroShowBarLabel, macroShowYoyLine, macroShowYoyPctLine, macroHistory], scheduleMacroRender)

function closeMacroForm() {
  macroVisible.value = false
  macroMetric.value = ''
  macroHistory.value = []
  macroHistoryQuery = ''
  disposeMacroChart()
}

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
  window.addEventListener('resize', resizeMacroChart)
})

onBeforeUnmount(() => {
  if (root) { root.dispose(); root = null }
  window.removeEventListener('resize', resizeMacroChart)
  disposeMacroChart()
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

.macroBody { min-height: 120px; }
.macroToolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
.macroQuestion { font-weight: 700; font-size: 14px; }
.macroRecordId { color: #909399; font-size: 12px; }
.macroHint { margin-left: auto; font-size: 12px; }
.macroGroup {
  border: 1px solid var(--border-color-light, #eee);
  border-radius: 10px;
  padding: 4px 14px 2px;
  margin-bottom: 14px;
  background: var(--panel-bg-2, #fafafa);
}
.macroGroupTitle { font-weight: 700; font-size: 14px; padding: 10px 0 6px; }
.macroGrid { display: grid; grid-template-columns: repeat(2, 1fr); column-gap: 18px; }
.macroGrid .macroSpan2 { grid-column: 1 / -1; }
.macroForm :deep(.el-form-item) { margin-bottom: 8px; }
.macroLoadingText { padding: 40px 0; text-align: center; }

/* —— 趋势图（点击指标后展开）—— */
.macroChartCard {
  margin-top: 16px;
  border: 1px solid var(--border-color-light, #eee);
  border-radius: 10px;
  padding: 10px 14px 6px;
  background: var(--panel-bg-2, #fafafa);
}
.macroChartHead {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}
.macroChartTitle { font-weight: 700; font-size: 14px; }
.macroChart { width: 100%; height: 330px; }
.macroChartTip { margin-top: 12px; font-size: 12px; line-height: 1.6; }
/* 可点击查看趋势的指标输入框：给出可交互提示 */
.macroForm :deep([data-metric]) { cursor: pointer; }

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


