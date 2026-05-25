<script setup>

import TimeFilter from "@/components/Filter/TimeFilter.vue";
import Industryanalyse from "@/views/Industryanalyse.vue";
import ScriptPanel from "@/components/Run Script/ScriptPanel.vue";
import AICustomAnalysis from "@/views/AICustomAnalysis.vue";


</script>

<template>
  <main class="mainContent">
    <!-- AI分析 菜单：整块替换为 AICustomAnalysis 组件（内含左右两栏） -->
    <!-- 其他菜单：正常两栏布局 -->
    <template>
      <div class="card listCard">
        <div class="cardHeader">
          <div style="font-weight:700; font-size: 16px;">列表</div>
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

            <div v-if="canSelectAllMenu" class="filterItem">
              <button class="btn" type="button" @click="selectAllResults" :disabled="allSelectLoading || loadingList">
                {{ allSelectLoading ? '操作中...' : (currentSourceSelectedCount > 0 ? `全部取消勾选（已选${currentSourceSelectedCount}条）` : `全部选中（共${total || 0}条）`) }}
              </button>
            </div>
          </div>

          <div v-if="canSelectAllMenu && allSelectError" class="errorState allSelectAlert" style="padding: 12px 0;">
            <span>{{ allSelectError }}</span>
            <button class="btn sm" type="button" @click="allSelectError = ''" style="margin-left: 8px;">知道了</button>
          </div>

          <!-- 其他菜单：正常列表 -->
          <template>
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
                  @click="(activeMenu === 'yahoo' || activeMenu === 'nytimes') ? openUrl(it.articleUrl) : openDetail(it.id)"
              >

                <div class="generalItem">
                  <el-checkbox
                      :model-value="isSelected(currentSource, it.id)"
                      @click.stop
                      @change="(v) => toggleSelected(currentSource, it.id, !!v)"
                  />
                  <div class="itemMain">
                    <div class="listItemTitle">{{ it.title || '(无标题)' }}</div>
                    <div class="muted">

                      <template>
                        {{ it.publishTime || '' }}
                      </template>
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
          </template>
        </div>
      </div>

      <div class="card detailPlaceholder">
        <div class="cardHeader">
          <div style="font-weight:700; font-size: 16px;">详情预览</div>
        </div>
        <div class="cardBody">
          <div class="emptyDetail">
            <div class="emptyIcon">📄</div>
            <div class="muted">请在左侧选择一条新闻查看详情</div>
          </div>
        </div>
      </div>
    </template>
  </main>
</template>

<style scoped>

</style>