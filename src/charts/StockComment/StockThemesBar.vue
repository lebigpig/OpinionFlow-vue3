<script setup>
import { ref, watch, onBeforeUnmount, nextTick } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  isDark: { type: Boolean, default: false },
  themes: { type: Array, default: () => [] },
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

/**
 * 渲染/更新图表。
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

  const themes = props.themes?.length ? props.themes : []

  chartInst.clear()

  if (!themes.length) {
    chartInst.setOption({
      backgroundColor: 'transparent',
      title: { text: '暂无 main_themes 数据', left: 'center', top: 'middle', textStyle: { fontSize: 14, color: '#888' } },
      xAxis: { show: false },
      yAxis: { show: false },
      series: [],
    }, true)
  } else {
    const isWeightedObject = themes.length && typeof themes[0] === 'object' && themes[0] !== null && 'name' in themes[0] && 'weight' in themes[0]
    const labels = isWeightedObject ? themes.map(t => String(t.name ?? '')) : themes.map(t => String(t ?? ''))
    const values = isWeightedObject ? themes.map(t => Number(t.weight ?? 0)) : themes.map(() => 1)
    const maxV = Math.max(1, ...values.filter(v => Number.isFinite(v)).map(v => Math.max(0, v)))
    chartInst.setOption({
      backgroundColor: 'transparent',
      title: { show: false, text: '' },
      tooltip: {
        trigger: 'axis',
        valueFormatter: (v) => {
          const n = Number(v)
          if (!Number.isFinite(n)) return String(v ?? '')
          return (isWeightedObject ? n.toFixed(3) : String(n))
        },
      },
      grid: { left: 48, right: 16, top: 28, bottom: 88, containLabel: true },
      xAxis: { type: 'category', data: labels, axisLabel: { interval: 0, rotate: 28 } },
      yAxis: { type: 'value', min: 0, max: maxV, name: isWeightedObject ? '权重(0-1)' : '出现(示意)' },
      series: [{ type: 'bar', data: values, itemStyle: { color: '#9b59b6' } }],
    }, true)
  }

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
  () => [props.themes, props.isDark],
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
  <div ref="chartEl" class="chart"></div>
</template>

<style scoped>
.chart {
  width: 100%;
  height: 300px;
}
</style>