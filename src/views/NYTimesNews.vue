<script setup>
import { useNewsStore } from '@/stores/NewsStore'
import { storeToRefs } from 'pinia'

const newsStore = useNewsStore()
const { items, loadingList, listError, total } = storeToRefs(newsStore)

function openUrl(url) {
  if (url) window.open(url, '_blank')
}
</script>

<template>
  <main class="mainContent">
    <div class="card listCard">
      <div class="cardHeader">
        <div style="font-weight:700; font-size: 16px;">纽约时报新闻</div>
        <div class="muted" v-if="total">共 {{ total }} 条</div>
      </div>
      <div class="cardBody">
        <div v-if="loadingList" class="loadingState">
          <div class="spinner"></div>
          <div class="muted">正在加载数据...</div>
        </div>
        <div v-else-if="listError" class="errorState">{{ listError }}</div>
        <div v-else-if="!items.length" class="emptyState">暂无数据</div>
        <div v-else class="list">
          <div
            v-for="it in items"
            :key="it.id"
            class="listItem"
            @click="openUrl(it.articleUrl)"
          >
            <div class="listItemTitle">{{ it.title || '(无标题)' }}</div>
            <div class="muted">{{ it.publishTime || '' }}</div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
</style>