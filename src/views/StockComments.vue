<script setup>
import {useDetailsStore} from "@/stores/DetailStore.js";
import {useNewsStore} from "@/stores/NewsStore.js";
import {storeToRefs} from "pinia";
const newsStore = useNewsStore()
const detailStore = useDetailsStore()
const {openCommentDetail,openDetail} = detailStore
const {loadingList,listError,items,total,page,pageSize,loadList} = storeToRefs(newsStore)
</script>

<template>
  <main class="mainContent">
      <div class="card listCard">
        <div class="cardBody">
          <!-- 其他菜单：正常列表 -->
            <div v-if="loadingList" class="loadingState">
              <div class="spinner"></div>
              <div class="muted">正在加载数据...</div>
            </div>
            <div v-else-if="listError" class="errorState">{{ listError }}</div>
            <div v-else-if="!items.length" class="emptyState">暂无数据</div>
            <div class="list">
              <button
                  v-for="it in items"
                  :key="it.id"
                  class="listItem"
                  @click="openDetail(it.id)"
              >
                <div class="generalItem">
                  <div class="itemMain">
                    <div class="listItemTitle">{{ it.title || '(无标题)' }}</div>
                    <div class="muted">
                        分析时间为: {{ it.publishTime || '—' }}；总评论数：{{ it.commentTotal ?? '—' }}
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
  </main>
</template>

<style scoped>

</style>