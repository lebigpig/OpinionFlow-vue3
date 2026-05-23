<script setup>
import { ref, onBeforeUnmount } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  isDark: { type: Boolean, default: false },
  ivi: { type: Number, default: 0 },
  narrativeCoherence: { type: Number, default: 0 },
  infoSourceReliance: { type: Number, default: 0 },
  themeCount: { type: Number, default: 0 },
})

const chartEl = ref(null)
let chartInst = null
let resizeBound = false

function onResize() {
  chartInst?.resize()
}

function bindResize() {
  if (!resizeBound) {
    window.addEventListener('resize', onResize)
    resizeBound = true
  }
}

function unbindResize() {
  if (resizeBound) {
    window.removeEventListener('resize', onResize)
    resizeBound = false
  }
}

function render() {
  if (!chartEl.value) return

  if (!chartInst || chartInst.isDisposed?.()) {
    chartInst = echarts.init(chartEl.value, props.isDark ? 'dark' : null)
    bindResize()
  } else if (chartInst.getDom() !== chartEl.value) {
    chartInst.dispose()
    chartInst = echarts.init(chartEl.value, props.isDark ? 'dark' : null)
  }

  const vIvi = props.ivi ?? 0
  const vNar = props.narrativeCoherence ?? 0
  const vInfo = props.infoSourceReliance ?? 0
  const themeBar = Math.max(0, props.themeCount ?? 0)
  const maxY = Math.max(100, vIvi, vNar, vInfo, themeBar)

  chartInst.clear()
  chartInst.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    grid: { left: 48, right: 16, top: 36, bottom: 72, containLabel: true },
    xAxis: {
      type: 'category',
      data: ['IVI(非理性)', '叙事一致性', '信息源依赖度', '主题数量'],
      axisLabel: { interval: 0, rotate: 18 },
    },
    yAxis: { type: 'value', min: 0, max: maxY, name: '分数/个数' },
    series: [{
      type: 'bar',
      data: [vIvi, vNar, vInfo, themeBar],
      itemStyle: { color: '#3498db' },
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