<script setup>
import { useNewsStore } from '@/stores/NewsStore'
import { useDetailsStore } from '@/stores/DetailStore.js'
import { storeToRefs } from 'pinia'
import TimeFilter from "@/components/Filter/TimeFilter.vue";

const newsStore = useNewsStore()
const detailStore = useDetailsStore()

const { items, loadingList, listError, total } = storeToRefs(newsStore)

const {
  timeRange, keyword, page, pageSize,
  pageAllSelected, allSelectLoading,
  currentSourceSelectedCount, allSelectError
} = storeToRefs(newsStore)


const {
  loadList, isSelectableMenu, isSelected, toggleSelected,
  toggleSelectAllOnPage, selectAllResults
} = newsStore


const {openDetail} = detailStore
</script>

<template>
  <main class="mainContent">
    <div class="card listCard">
      <div class="cardHeader">
        <div style="font-weight:700; font-size: 16px;">实时财经新闻</div>
        <div class="muted" v-if="total">共 {{ total }} 条</div>
      </div>
      <div class="cardBody">
        <div class="filterBar">
          <TimeFilter
              v-model="timeRange"
              @change="() => { page = 1; loadList() }"
          />
          <div class="filterItem">
            <el-input
                v-model="keyword"
                clearable
                placeholder="搜索标题/正文..."
                @clear="() => { page = 1; loadList() }"
                @keyup.enter="() => { page = 1; loadList() }"
            >
              <template #prefix>🔍</template>
            </el-input>
          </div>

          <button class="btn primary" @click="() => { page = 1; loadList() }">搜索</button>

          <div v-if="isSelectableMenu()" class="filterItem selectAll">
            <span class="muted">本页全选</span>
            <el-checkbox
                :model-value="pageAllSelected"
                @change="(v) => toggleSelectAllOnPage(!!v)"
            />
          </div>

          <div v-if="isSelectableMenu()" class="filterItem">
            <button class="btn" type="button" @click="selectAllResults" :disabled="allSelectLoading || loadingList">
              {{ allSelectLoading ? '操作中...' : (currentSourceSelectedCount > 0 ? `全部取消勾选（已选${currentSourceSelectedCount}条）` : `全部选中（共${total || 0}条）`) }}
            </button>
          </div>
        </div>
        <div v-if="loadingList" class="loadingState">
          <div class="spinner"></div>
          <div class="muted">正在加载数据...</div>
        </div>
        <div v-else-if="listError" class="errorState">{{ listError }}</div>
        <div v-else-if="!items.length" class="emptyState">暂无数据</div>
        <div v-else class="list">
          <button
              v-for="it in items"
              :key="it.id"
              class="listItem"
              @click="openDetail(it.id)"
          >
            <div class="generalItem">
              <el-checkbox
                  :model-value="isSelected('finance', it.id)"
                  @click.stop
                  @change="(v) => toggleSelected('finance', it.id, !!v)"
              />
              <div class="itemMain">
                <div class="listItemTitle">{{ it.title || '(无标题)' }}</div>
                <div class="muted">
                    <span class="financeSummary">{{ it.summary || '' }}</span>
                  <span>{{ it.publishTime || '' }}</span>
                </div>
              </div>
            </div>
          </button>
        </div>
        <div class="pagination" v-if="total">
          <el-pagination
              v-model:current-page="page"
              v-model:page-size="pageSize"
              :page-sizes="[50]"
              :total="total"
              background
              layout="prev, pager, next, total"
              @current-change="loadList"
          />
        </div>
      </div>
    </div>
    <div class="card detailPlaceholder">
      <div class="cardHeader">
        <div style="font-weight:700; font-size: 16px;">详情预览</div>
        <button class="btn primary">AI 解析</button>
      </div>
      <div class="cardBody">

        <div class="emptyDetail">
          <div class="emptyIcon">📄</div>
          <div class="muted">请在左侧选择一条新闻查看详情</div>
        </div>
      </div>
      </div>

  </main>
</template>

<style scoped>

</style>