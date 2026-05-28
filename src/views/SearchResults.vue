<script setup>
import { ref, reactive } from 'vue'
import { Search, Setting } from '@element-plus/icons-vue'
import { tavilySearch, saveSearchResults } from '@/lib/api'

// 搜索关键词
const searchQuery = ref('')

// 搜索设置抽屉
const drawerVisible = ref(false)

// 搜索结果状态
const loading = ref(false)
const searchError = ref('')
const searchResults = ref([])
const searchAnswer = ref('')
const searchImages = ref([])
const searchTime = ref(null)

// 搜索设置参数（匹配 Tavily API）
const searchSettings = reactive({
  topic: 'news',              // 搜索主题：news / general / finance
  searchDepth: 'advanced',    // 搜索深度：basic / advanced / fast / ultra-fast
  maxResults: 20,             // 结果数量
  timeRange: 'day',           // 时间范围：day / week / month / year
  includeAnswer: 'advanced',     // AI摘要：off / basic / advanced
  includeImages: true,        // 包含图片
  includeFavicon: true,       // 包含网站图标
  chunksPerSource: 4,         // 每个来源的片段数
})

// 搜索主题选项
const topicOptions = [
  { label: '新闻', value: 'news' },
  { label: '通用', value: 'general' },
  { label: '财经', value: 'finance' }
]

// 搜索深度选项
const searchDepthOptions = [
  { label: '基础', value: 'basic' },
  { label: '高级', value: 'advanced' },
  { label: '快速', value: 'fast' },
  { label: '极速', value: 'ultra-fast' }
]

// AI摘要选项
const includeAnswerOptions = [
  { label: '关闭', value: 'off' },
  { label: '基础摘要', value: 'basic' },
  { label: '详细摘要', value: 'advanced' }
]

// 时间范围选项
const timeRangeOptions = [
  { label: '不限', value: 'day' },
  { label: '一天内', value: 'day' },
  { label: '一周内', value: 'week' },
  { label: '一月内', value: 'month' },
  { label: '一年内', value: 'year' }
]

// 打开设置抽屉
const openSettings = () => {
  drawerVisible.value = true
}

// 执行搜索
const handleSearch = async () => {
  if (!searchQuery.value.trim()) return
  loading.value = true
  searchError.value = ''
  searchResults.value = []
  searchAnswer.value = ''
  searchImages.value = []
  searchTime.value = null

  try {
    const params = {
      query: searchQuery.value.trim(),
      topic: searchSettings.topic,
      search_depth: searchSettings.searchDepth,
      max_results: searchSettings.maxResults,
      time_range: searchSettings.timeRange,
      include_answer: searchSettings.includeAnswer !== 'off' ? searchSettings.includeAnswer : false,
      include_images: searchSettings.includeImages,
      include_favicon: searchSettings.includeFavicon,
      chunks_per_source: searchSettings.chunksPerSource,
      include_usage: true,
    }
    const data = await tavilySearch(params)
    searchResults.value = data.results || []
    searchAnswer.value = data.answer || ''
    searchImages.value = data.images || []
    searchTime.value = data.response_time || null

    // 异步保存搜索结果到数据库（不阻塞 UI）
    if (searchResults.value.length > 0) {
      const items = searchResults.value.map(r => ({
        query: searchQuery.value.trim(),
        url: r.url,
        title: r.title,
        score: r.score,
        publishedDate: r.published_date,
        content: r.content + '\nAI解析:' + searchAnswer.value,
        rawContent: r.raw_content,
      }))
      saveSearchResults(items).catch(err => {
        console.warn('保存搜索结果失败:', err)
      })
    }
  } catch (err) {
    searchError.value = err.message || '搜索失败'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="mainContent">
    <span class="search-header">
      <!-- 最左侧：Logo图片 -->
      <img src="@/assets/pig.png" alt="Logo" class="logo-img" />

      <!-- 中间：搜索输入框 -->
      <div class="search-input-section">
        <el-input
          v-model="searchQuery"
          size="large"
          placeholder="请输入搜索关键词..."
          :prefix-icon="Search"
          clearable
          @keyup.enter="handleSearch"
          class="search-input"
        >
          <template #append>
            <el-button :icon="Search" @click="handleSearch">搜索</el-button>
          </template>
        </el-input>
      </div>

      <!-- 右边：搜索设置按钮 -->
      <el-button
        :icon="Setting"
        circle
        size="large"
        @click="openSettings"
        class="settings-btn"
      />
    </span>

    <!-- 搜索结果区域 -->
    <div class="results-container" v-if="loading || searchError || searchResults.length > 0">
      <!-- 加载状态 -->
      <div v-if="loading" class="loading-state">
        <el-icon class="is-loading" :size="24"><Loading /></el-icon>
        <span>正在搜索...</span>
      </div>

      <!-- 错误提示 -->
      <el-alert
        v-if="searchError"
        :title="searchError"
        type="error"
        show-icon
        :closable="true"
        style="margin-bottom: 16px;"
      />

      <!-- AI 摘要 -->
      <div v-if="searchAnswer && !loading" class="answer-card">
        <div class="answer-title">AI 摘要</div>
        <div class="answer-content">{{ searchAnswer }}</div>
        <div v-if="searchTime" class="answer-meta">
          响应时间: {{ searchTime.toFixed(2) }}s
        </div>
      </div>

      <!-- 顶部图片区域 -->
      <div v-if="searchImages.length > 0 && !loading" class="result-images">
        <div class="images-grid">
          <div v-for="(img, idx) in searchImages" :key="idx" class="image-card">
            <img
              v-if="typeof img === 'object'"
              :src="img.url"
              :alt="img.title || ''"
              class="image-thumb"
            />
            <img
              v-else
              :src="img"
              alt=""
              class="image-thumb"
            />
            <div v-if="typeof img === 'object' && img.title" class="image-title">{{ img.title }}</div>
          </div>
        </div>
      </div>

      <!-- 搜索结果列表 -->
      <div v-if="searchResults.length > 0 && !loading" class="results-list">
        <div
          v-for="(item, index) in searchResults"
          :key="index"
          class="result-item"
        >
          <div class="result-header">
            <img
              v-if="item.favicon"
              :src="item.favicon"
              class="result-favicon"
              alt=""
            />
            <a :href="item.url" target="_blank" class="result-title">
              {{ item.title }}
            </a>
          </div>
          <div class="result-url">{{ item.url }}</div>
          <div class="result-content">{{ item.content }}</div>
          <div v-if="item.published_date" class="result-date">{{ item.published_date }}</div>
          <div v-if="item.images && item.images.length > 0" class="result-item-images">
            <a
              v-for="(img, idx) in item.images"
              :key="idx"
              :href="img.url"
              target="_blank"
              class="result-image-link"
            >
              <img :src="img.url" :alt="img.description || ''" class="result-image-thumb" />
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- 搜索设置抽屉 -->
    <el-drawer
      v-model="drawerVisible"
      title="搜索设置"
      direction="rtl"
      size="350px"
    >
      <el-form label-position="top" class="settings-form">
        <!-- 搜索主题 -->
        <el-form-item label="搜索主题">
          <el-select v-model="searchSettings.topic" placeholder="选择搜索主题">
            <el-option
              v-for="item in topicOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>

        <!-- 搜索深度 -->
        <el-form-item label="搜索深度">
          <el-radio-group v-model="searchSettings.searchDepth">
            <el-radio
              v-for="item in searchDepthOptions"
              :key="item.value"
              :value="item.value"
            >
              {{ item.label }}
            </el-radio>
          </el-radio-group>
        </el-form-item>

        <!-- 时间范围 -->
        <el-form-item label="时间范围">
          <el-select v-model="searchSettings.timeRange" placeholder="选择时间范围">
            <el-option
              v-for="item in timeRangeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>

        <!-- 结果数量 -->
        <el-form-item label="结果数量">
          <el-slider
            v-model="searchSettings.maxResults"
            :min="1"
            :max="20"
            :step="1"
            show-input
          />
        </el-form-item>

        <!-- 每个来源片段数 -->
        <el-form-item label="每个来源片段数">
          <el-slider
            v-model="searchSettings.chunksPerSource"
            :min="1"
            :max="8"
            :step="1"
            show-input
          />
        </el-form-item>

        <!-- AI摘要 -->
        <el-form-item label="AI摘要">
          <el-select v-model="searchSettings.includeAnswer" placeholder="选择AI摘要模式">
            <el-option
              v-for="item in includeAnswerOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>

        <!-- 包含图片 -->
        <el-form-item label="包含图片">
          <el-switch v-model="searchSettings.includeImages" />
        </el-form-item>

        <!-- 包含网站图标 -->
        <el-form-item label="包含网站图标">
          <el-switch v-model="searchSettings.includeFavicon" />
        </el-form-item>
      </el-form>
    </el-drawer>
  </main>
</template>

<style scoped>
.mainContent {
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.search-header {
  width: 100%;
  max-width: 1000px;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 20px;
}

.logo-img {
  width: 13vw;
  height: 13vh;
  object-fit: contain;
  flex-shrink: 0;
}

.search-input-section {
  flex: 1;
  min-width: 0;
}

.search-input {
  width: 100%;
  border-radius: 24px;
  --el-input-border-color: #dcdfe6;
}

.search-input :deep(.el-input__wrapper) {
  border-radius: 24px;
  box-shadow: 0 0 0 1px #c0c4cc inset;
}

.search-input :deep(.el-input-group__append) {
  border-radius: 0 24px 24px 0;
}

.settings-btn {
  font-size: 18px;
  flex-shrink: 0;
}

/* 搜索结果区域 */
.results-container {
  width: 100%;
  max-width: 900px;
  padding: 0 20px;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 0;
  color: #909399;
  font-size: 14px;
}

/* AI 摘要卡片 */
.answer-card {
  background: linear-gradient(135deg, #f0f9ff 0%, #e8f4fd 100%);
  border: 1px solid #b3d8fd;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
}

.answer-title {
  font-weight: 700;
  font-size: 16px;
  color: #409eff;
  margin-bottom: 10px;
}

.answer-content {
  font-size: 14px;
  line-height: 1.8;
  color: #303133;
  white-space: pre-wrap;
}

.answer-meta {
  margin-top: 10px;
  font-size: 12px;
  color: #909399;
  text-align: right;
}

/* 搜索结果列表 */
.results-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.result-item {
  padding: 16px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  transition: box-shadow 0.2s;
}

.result-item:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.result-favicon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  border-radius: 2px;
}

.result-title {
  font-size: 16px;
  font-weight: 600;
  color: #409eff;
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-title:hover {
  text-decoration: underline;
}

.result-url {
  font-size: 12px;
  color: #67c23a;
  margin-bottom: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-content {
  font-size: 13px;
  line-height: 1.6;
  color: #606266;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.result-date {
  margin-top: 6px;
  font-size: 12px;
  color: #909399;
}

/* 顶部图片区域 */
.result-images {
  margin-bottom: 20px;
}

.images-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
}

.image-card {
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #ebeef5;
  background: #fff;
  transition: box-shadow 0.2s;
}

.image-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.image-thumb {
  width: 100%;
  height: 100px;
  object-fit: cover;
  display: block;
}

.image-title {
  font-size: 11px;
  color: #606266;
  padding: 6px 8px;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 结果项内图片 */
.result-item-images {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.result-image-link {
  display: block;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #ebeef5;
  flex-shrink: 0;
}

.result-image-link:hover {
  border-color: #409eff;
}

.result-image-thumb {
  width: 80px;
  height: 60px;
  object-fit: cover;
  display: block;
}

.settings-form {
  padding: 10px;
}

.settings-form .el-select {
  width: 100%;
}
</style>