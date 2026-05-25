<script setup>
const props = defineProps({
  menuGroups: { type: Array, required: true },
  groupOpen: { type: Object, required: true },
  activeMenu: { type: String, required: true },
})

const emit = defineEmits(['toggleGroup'])
</script>

<template>
  <aside class="sidebar card">
    <div class="menu">
      <div v-for="g in menuGroups" :key="g.key" class="menuGroup">
        <div class="menuGroupHeader" @click="emit('toggleGroup', g.key)">
          <span>{{ g.name }}</span>
          <span class="arrow" :class="{ rotated: !groupOpen[g.key] }">▼</span>
        </div>

        <transition name="menu-fade">
          <div v-if="groupOpen[g.key]" class="menuGroupContent">
            <router-link
              v-for="m in g.children"
              :key="m.key"
              :to="m.to"
              class="menuItem"
              :class="{ active: activeMenu === m.key }"
            >
              {{ m.name }}
            </router-link>
          </div>
        </transition>
      </div>
    </div>
  </aside>
</template>

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

.menuItem {
  display: block;
  text-decoration: none;
}

.menu-fade-enter-active, .menu-fade-leave-active { transition: all 0.3s ease; max-height: 500px; overflow: hidden; }
.menu-fade-enter-from, .menu-fade-leave-to { max-height: 0; opacity: 0; }
</style>