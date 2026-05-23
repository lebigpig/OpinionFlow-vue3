<template>
  <header class="header card">
    <div class="headerLeft">
      <img alt="logo" src="../../assets/新闻.png" width="32" height="32" />
      <div class="logoText">OpinionFlow 舆情</div>
      <div class="badge">MySQL spider</div>
    </div>
    <div class="headerRight">
      <div class="currentMenu">
        <span class="muted">当前菜单：</span>
        <span class="menuName">{{ activeMenuName }}</span>
      </div>
      <button class="btn" @click="$emit('toggleTheme')">
        <span v-if="isDark">🌙 深色模式</span>
        <span v-else>☀️ 浅色模式</span>
      </button>
      <button class="btn primary" @click="$emit('loadList')" :disabled="loadingList">刷新数据</button>
    </div>
  </header>
</template>

<script setup>
defineProps({
  activeMenuName: { type: String, default: '' },
  isDark: { type: Boolean, default: false },
  loadingList: { type: Boolean, default: false }
})

defineEmits(['toggleTheme', 'loadList'])
</script>

<style scoped>
.header {
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 24px;
}
.headerLeft {
  display: flex;
  align-items: center;
  gap: 12px;
}
.logoText {
  font-size: 20px;
  font-weight: 800;
  background: linear-gradient(120deg, var(--primary-color), #a8c0ff);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.headerRight {
  display: flex;
  align-items: center;
  gap: 16px;
}
.currentMenu {
  display: flex;
  align-items: center;
  gap: 4px;
}
.menuName {
  font-weight: 600;
  color: var(--primary-color);
}
</style>