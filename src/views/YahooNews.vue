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

            <div class="filterItem selectAll">
              <span class="muted">本页全选</span>
              <el-checkbox
                  :model-value="pageAllSelected"
                  @change="(v) => toggleSelectAllOnPage(!!v)"
              />
            </div>

            <div class="filterItem">
              <button class="btn" type="button" @click="selectAllResults" :disabled="allSelectLoading || loadingList">
                {{ allSelectLoading ? '操作中...' : (currentSourceSelectedCount > 0 ? `全部取消勾选（已选${currentSourceSelectedCount}条）` : `全部选中（共${total || 0}条）`) }}
              </button>
            </div>
          </div>

          <div v-if="canSelectAllMenu && allSelectError" class="errorState allSelectAlert" style="padding: 12px 0;">
            <span>{{ allSelectError }}</span>
            <button class="btn sm" type="button" @click="allSelectError = ''" style="margin-left: 8px;">知道了</button>
          </div>

          <!-- 词云分析：reasonBox + 图表在 listCard 顶部 -->


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
                <div v-if="activeMenu === 'yahoo' || activeMenu === 'nytimes'" class="yahooItem">
                  <el-checkbox
                      :model-value="isSelected(activeMenu === 'yahoo' ? 'yahoo' : 'nytimes', it.id)"
                      @click.stop
                      @change="(v) => (activeMenu === 'yahoo' ? toggleYahooSelected(it, !!v) : toggleNytimesSelected(it, !!v))"
                  />
                  <img
                      v-if="it.imgUrl"
                      :src="it.imgUrl"
                      alt="img"
                      class="newsImg"
                  />
                  <div class="itemMain">
                    <div class="listItemTitle">{{ it.title || '(无标题)' }}</div>
                    <div class="muted">{{ it.displayTime || '' }}</div>
                  </div>
                  <button class="btn sm" @click.stop="openUrl(it.articleUrl)">
                    🔗
                  </button>
                </div>
                <div v-else class="generalItem">
                  <el-checkbox
                      v-if="activeMenu === 'general' || activeMenu === 'finance'"
                      :model-value="isSelected(currentSource, it.id)"
                      @click.stop
                      @change="(v) => toggleSelected(currentSource, it.id, !!v)"
                  />
                  <div class="itemMain">
                    <div class="listItemTitle">{{ it.title || '(无标题)' }}</div>
                    <div class="muted">
                      <template v-if="activeMenu === 'comments'">
                        分析时间为: {{ it.publishTime || '—' }}；总评论数：{{ it.commentTotal ?? '—' }}
                      </template>
                      <template v-else-if="activeMenu === 'finance'">
                        <span class="financeSummary">{{ it.summary || '' }}</span>
                      </template>
                      <template v-else>
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
          <button class="btn primary" @click="runAi" :disabled="!detail || aiLoading" v-if="activeMenu !== 'industry' && activeMenu !== 'yahoo' && !scriptKeyFromMenu()">AI 解析</button>
        </div>
        <div class="cardBody">


          <div>
            <div class="muted">勾选雅虎新闻后发送给 AI 分析。</div>
            <div class="actionGroup">
              <button class="btn primary" @click="runYahooAi" :disabled="yahooAiLoading">发送到 AI</button>
            </div>
            <div v-if="yahooAiLoading" class="aiProgress">
              <div class="spinner sm"></div>
              <span>流式分析中...</span>
            </div>
            <div v-if="yahooAiError" class="errorState">{{ yahooAiError }}</div>
            <div v-if="yahooAiResult" class="aiResultBox">
              <pre class="pre">{{ yahooAiResult }}</pre>
            </div>
          </div>

        </div>
      </div>
    </template>
  </main>

</template>

<style scoped>

</style>