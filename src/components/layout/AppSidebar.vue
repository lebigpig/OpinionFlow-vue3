b<template>
  <aside class="sidebar card">
    <div class="menuGroup">
      <div class="menuGroupHeader" @click="toggleGroup('news')">
        <span>📰 资讯中心</span>
        <span class="arrow" :class="{ rotated: !groupOpen.news }">▼</span>
      </div>
      <transition name="menu-fade">
        <div v-show="groupOpen.news">
          <button
            v-for="item in newsMenus"
            :key="item.key"
            class="btn full menuBtn"
            :class="{ active: activeMenu === item.key }"
            @click="$emit('select', item.key)"
          >
            {{ item.icon }} {{ item.label }}
          </button>
        </div>
      </transition>
    </div>

    <div class="menuGroup">
      <div class="menuGroupHeader" @click="toggleGroup('analysis')">
        <span>📊 数据分析</span>
        <span class="arrow" :class="{ rotated: !groupOpen.analysis }">▼</span>
      </div>
      <transition name="menu-fade">
        <div v-show="groupOpen.analysis">
          <button
            v-for="item in analysisMenus"
            :key="item.key"
            class="btn full menuBtn"
            :class="{ active: activeMenu === item.key }"
            @click="$emit('select', item.key)"
          >
            {{ item.icon }} {{ item.label }}
          </button>
        </div>
      </transition>
    </div>

    <div class="menuGroup">
      <div class="menuGroupHeader" @click="toggleGroup('tools')">
        <span>🛠️ 工具</span>
        <span class="arrow" :class="{ rotated: !groupOpen.tools }">▼</span>
      </div>
      <transition name="menu-fade">
        <div v-show="groupOpen.tools">
          <button
            v-for="item in toolsMenus"
            :key="item.key"
            class="btn full menuBtn"
            :class="{ active: activeMenu === item.key }"
            @click="$emit('select', item.key)"
          >
            {{ item.icon }} {{ item.label }}
          </button>
        </div>
      </transition>
    </div>
  </aside>
</template>

<script setup>
import { reactive } from 'vue'

defineProps({
  activeMenu: { type: String, default: 'general' }
})

defineEmits(['select'])

const groupOpen = reactive({
  news: true,
  analysis: true,
  tools: true,
})

function toggleGroup(group) {
  groupOpen[group] = !groupOpen[group]
}

const newsMenus = [
  { key: 'general', label: '综合新闻', icon: '📋' },
  { key: 'deepseek', label: '深度求索', icon: '🔍' },
  { key: 'finance', label: '财经新闻', icon: '💰' },
  { key: 'yahoo', label: '雅虎财经', icon: '🌐' },
  { key: 'nyt', label: '纽约时报', icon: '📰' },
]

const analysisMenus = [
  { key: 'comments', label: '个股分析', icon: '📈' },
  { key: 'ai', label: 'AI 分析', icon: '🤖' },
]

const toolsMenus = [
  { key: 'echart', label: 'Echart 面板', icon: '📊' },
  { key: 'script', label: '脚本面板', icon: '⚡' },
]
</script>

<style scoped>
.sidebar {
  height: fit-content;
  position: sticky;
  top: 20px;
}
.menuGroup {
  margin-bottom: 8px;
}
.menuGroupHeader {
  padding: 12px 16px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-radius: 10px;
  transition: background 0.2s;
}
.menuGroupHeader:hover {
  background: var(--panel-bg-2);
}
.arrow {
  font-size: 10px;
  transition: transform 0.3s;
}
.arrow.rotated {
  transform: rotate(-90deg);
}
.menuBtn.active {
  border-color: var(--primary-color);
  background: var(--primary-color);
  color: #fff;
}
</style>