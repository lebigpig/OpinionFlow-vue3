<script setup>
import { ref, watch, onBeforeUnmount, nextTick } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  isDark: { type: Boolean, default: false },
  mood: { type: [String, Number], default: '' },
})

const chartEl = ref(null)
let chartInst = null
let resizeBound = false

/** 具名 resize handler，确保 add/remove 使用同一引用 */
function onResize() {
  chartInst?.resize()
}

/** 绑定全局 resize 事件（仅绑定一次） */
function bindResize() {
  if (!resizeBound) {
    window.addEventListener('resize', onResize)
    resizeBound = true
  }
}

/** 解绑全局 resize 事件 */
function unbindResize() {
  if (resizeBound) {
    window.removeEventListener('resize', onResize)
    resizeBound = false
  }
}

/** 将各种格式的情绪评分解析为 0-100 数值 */
function parseScore0to100(v) {
  if (v == null) return null
  const s = String(v).trim()
  if (!s) return null
  if (/^\d+(\.\d+)?%$/.test(s)) return Math.min(100, parseFloat(s))
  if (/^\d+(\.\d+)?$/.test(s)) { const n = parseFloat(s); return n <= 1 ? n * 100 : n }
  const m = s.match(/([0-9]+(?:\.[0-9]+)?)/)
  return m ? Math.min(100, parseFloat(m[1])) : null
}

/**
 * 渲染/更新情绪分布饼图。
 * - 首次调用时创建 ECharts 实例并绑定 resize
 * - 后续复用实例，仅 clear + setOption 更新数据
 * - 若 DOM 元素发生变化（如 v-if 重建），则重新 init
 */
function render() {
  if (!chartEl.value) return

  // DOM 元素变化或首次：需要重新 init
  if (!chartInst || chartInst.isDisposed?.()) {
    chartInst = echarts.init(chartEl.value, props.isDark ? 'dark' : null)
    bindResize()
  } else if (chartInst.getDom() !== chartEl.value) {
    // DOM 发生了变化，销毁旧实例，重新创建
    chartInst.dispose()
    chartInst = echarts.init(chartEl.value, props.isDark ? 'dark' : null)
    // resize 已绑定，无需重复绑定
  }

  const moodVal = parseScore0to100(props.mood)
  const m = moodVal ?? 50

  chartInst.clear()
  chartInst.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item' },
    legend: { top: 8, data: ['乐观倾向', '悲观倾向'] },
    series: [{
      name: '情绪 mood',
      type: 'pie',
      radius: ['38%', '72%'],
      label: { formatter: '{b}: {c}' },
      data: [
        { value: m, name: '乐观倾向', itemStyle: { color: '#ffffff' } },
        { value: Math.max(0, 100 - m), name: '悲观倾向', itemStyle: { color: '#000000' } },
      ],
    }],
  }, true)

  chartInst.resize()
}

function dispose() {
  unbindResize()
  chartInst?.dispose()
  chartInst = null
}

function resize() {
  chartInst?.resize()
}

watch(
  () => [props.mood, props.isDark],
  async () => {
    await nextTick()
    requestAnimationFrame(() => {
      render()
    })
  },
  { deep: true }
)

onBeforeUnmount(() => {
  dispose()
})

defineExpose({ render, dispose, resize })
</script>

<template>
  <div ref="chartEl" class="chart small"></div>
</template>

<style scoped>
.chart {
  width: 100%;
  height: 220px;
}
</style>