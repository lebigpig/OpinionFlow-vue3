<script setup>
import { ref, watch, onBeforeUnmount, nextTick } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  isDark: { type: Boolean, default: false },
  themes: { type: Array, default: () => [] },
})

const stockThemesBarEl = ref(null)
let stockThemesBarInst = null

function render() {
  if (!stockThemesBarEl.value) return

  if (stockThemesBarInst) {
    stockThemesBarInst.dispose()
    stockThemesBarInst = null
  }

  stockThemesBarInst = echarts.init(stockThemesBarEl.value, props.isDark ? 'dark' : null)
  window.addEventListener('resize', () => stockThemesBarInst?.resize())

  const themes = props.themes?.length ? props.themes : []

  if (!themes.length) {
    stockThemesBarInst.clear()
    stockThemesBarInst.setOption({
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
    stockThemesBarInst.setOption({
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
}

function dispose() {
  stockThemesBarInst?.dispose()
  stockThemesBarInst = null
  window.removeEventListener('resize', () => stockThemesBarInst?.resize())
}

function resize() {
  stockThemesBarInst?.resize()
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
  <div ref="stockThemesBarEl" class="chart"></div>
</template>

<style scoped>
.chart {
  width: 100%;
  height: 300px;
}
</style>