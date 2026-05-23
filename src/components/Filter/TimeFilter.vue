<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: Array, default: null },
})

const emit = defineEmits(['update:modelValue', 'change'])

const pickerValue = computed({
  get: () => props.modelValue,
  set: (val) => {
    emit('update:modelValue', val)
  },
})

function onChange(val) {
  emit('change', val)
}
</script>

<template>
  <div class="filterItem">
    <span class="muted">时间范围</span>
    <el-date-picker
      v-model="pickerValue"
      type="datetimerange"
      range-separator="至"
      start-placeholder="开始"
      end-placeholder="结束"
      value-format="YYYY-MM-DD HH:mm:ss"
      format="YYYY-MM-DD HH:mm:ss"
      :clearable="true"
      @change="onChange"
    />
  </div>
</template>