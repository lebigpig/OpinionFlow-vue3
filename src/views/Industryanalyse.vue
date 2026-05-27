
<template>
  <main class="mainContent">
      <div class="card listCard">
        <div class="cardBody">
          <!-- 词云分析：reasonBox + 图表在 listCard 顶部 -->
            <div v-if="industryChartData?.reason" class="reasonBox" style="margin-top: 0;">
              <div class="chartTitle" style="text-align: center; border-left: none;">分析理由</div>
              <pre class="pre" style="text-align: left;">{{ industryReasonText }}</pre>
            </div>
            <div v-if="industryChartData" class="chartContainer">
              <div class="chartTitleRow">
                <div class="chartTitle">行业风险/机会分布</div>
                <button class="btn sm" @click="openChartPreview('industry')" type="button">放大</button>
              </div>
              <div ref="chartEl" class="chart"></div>
            </div>
            <div v-if="industryChartData" class="chartContainer">
              <div class="chartTitleRow">
                <div class="chartTitle">整体情绪分布</div>
                <button class="btn sm" @click="openChartPreview('mood')" type="button">放大</button>
              </div>
              <div ref="moodChartEl" class="chart small"></div>
            </div>
            <div v-if="!industryChartData" class="emptyState">请在右侧详情面板中选择新闻后点击"开始分析"</div>
        </div>
      </div>

      <div class="card detailPlaceholder">
        <div class="cardHeader">
          <div style="font-weight:700; font-size: 16px;">详情预览</div>
        </div>
        <div class="cardBody">
          <div>
            <div class="muted">勾选新闻后点击下方按钮生成行业风险/机会分析。</div>
            <div class="selectedHint">
              <span class="badge">已勾选 {{ selectedCounts.total }} 条</span>
              <span class="muted" v-if="selectedCounts.total">
               （网易 {{ selectedCounts.general }} / 财经 {{ selectedCounts.finance }} / 雅虎 {{ selectedCounts.yahoo }}）
             </span>
            </div>
            <div class="actionGroup">
              <button class="btn primary" type="button" @click="runIndustryAnalysis" :disabled="industryLoading">开始分析</button>
              <button class="btn" type="button" @click="rebuildIndustryCharts" :disabled="!industryChartData">刷新图表</button>
            </div>

            <div class="historyBox" v-if="echartHistory.length">
              <div class="chartTitle">历史加载（public/echart）</div>
              <div class="muted" style="margin-bottom: 10px;">
                点击 ID 即可加载对应的 JSON 并重建图表（不会触发 AI 请求）。
              </div>
              <div v-if="historyError" class="errorState" style="padding: 12px 0;">{{ historyError }}</div>
              <div class="historyList">
                <button
                    v-for="h in echartHistoryPaginated"
                    :key="h.id"
                    class="historyItem"
                    @click="loadIndustryFromHistory(h)"
                    type="button"
                >
                  <div class="historyItemMain">
                    <span class="historyTime">{{ h.createdAt || '' }}</span>
                  </div>
                </button>
              </div>
              <div class="echartPagination" v-if="echartHistoryTotal > echartHistoryPageSize">
                <el-pagination
                    v-model:current-page="echartHistoryPage"
                    v-model:page-size="echartHistoryPageSize"
                    :page-sizes="[10]"
                    :total="echartHistoryTotal"
                    background
                    layout="prev, pager, next, total"
                    small
                />
              </div>
            </div>
            <div v-if="industryLoading" class="aiProgress">
              <div class="spinner sm"></div>
              <span>流式分析中... ({{ industryAiRaw.length }} 字符)</span>
            </div>

            <div v-if="industryError" class="errorState">{{ industryError }}</div>

            <div v-if="industryAiRaw" class="reasonBox">
              <div class="chartTitle">AI 原始输出（JSON）</div>
              <pre class="pre">{{ industryAiRaw }}</pre>
            </div>
          </div>


        </div>
      </div>
  </main>
</template>

<script setup>
import {useIndustryStore} from "@/stores/IndustryStore.js";
import {storeToRefs} from "pinia";
import {useNewsStore} from "@/stores/NewsStore.js";

const newsStore = useNewsStore()
const industryStore = useIndustryStore()

const {
  industryChartData,
  industryReasonText,
  industryLoading,
  industryAiRaw,
  industryError,


  historyError,

  echartHistory,
  echartHistoryPaginated,
  echartHistoryTotal,
  echartHistoryPageSize,
  echartHistoryPage,

  chartEl,
  moodChartEl,




} = storeToRefs(industryStore)




const {selectedCounts} = storeToRefs(newsStore)
const {openChartPreview,runIndustryAnalysis,rebuildIndustryCharts,loadIndustryFromHistory,loadEchartHistory} = industryStore
loadEchartHistory()
</script>