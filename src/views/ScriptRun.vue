<script setup>

import {computed, watch} from "vue";
import { useRoute } from 'vue-router'
import { useScriptStore } from '@/stores/ScriptStore.js'
import { storeToRefs } from 'pinia'
const route = useRoute()
const scriptStore = useScriptStore()
const activeMenuName = computed(() => route.name || '')

// 路由切换时清空输出信息
watch(() => route.name, () => {
  scriptStore.resetOutput()
})

const {
  scriptStockCodeInput,
  scriptStockCode,
  scriptRunning,
  scriptError,
  scriptResult,
  scriptMetaLive,
  scriptStdoutLive,
  scriptStderrLive,
} = storeToRefs(scriptStore)
const { runActiveScript
} = scriptStore
</script>

<template>
  <main class="mainContent">
    <div class="card scriptPanel">
      <div class="cardHeader">
        <div style="font-weight:800; font-size: 16px;">脚本运行 · {{ activeMenuName }}</div>
        <div class="headerActions">
          <button
              class="btn primary"
              @click="runActiveScript"
              :disabled="scriptRunning || (activeMenuName === 'script_comments' && !scriptStockCode)"
          >
            {{ scriptRunning ? '运行中...' : '运行脚本' }}
          </button>
          <button class="btn" @click="() => { scriptError = ''; scriptResult = null }" :disabled="scriptRunning" type="button">
            清空输出
          </button>
        </div>
      </div>
      <div class="cardBody">
        <div class="muted">
          这里会调用后端执行你配置的 Python 脚本（仅支持 comments/news/realtime 三个 key）。仅在你手动点击"运行脚本"时执行。
        </div>

        <div v-if="activeMenuName === 'script_comments'" class="scriptForm">
          <div class="muted" style="font-weight: 700;">请输入股票编号</div>
          <div class="scriptRow">
            <el-input
                v-model="scriptStockCodeInput"
                placeholder="例如：601398 / 000001"
                clearable
                @keyup.enter="runActiveScript"
            />
            <span class="badge" v-if="scriptStockCode">格式化：{{ scriptStockCode }}</span>
          </div>
          <div class="muted" v-if="scriptStockCode">
            将执行：<span class="monoInline">{{ `--code ${scriptStockCode}` }}</span>
          </div>
        </div>

        <div v-else-if="activeMenuName === 'script_all'" class="scriptForm">
          <div class="muted" style="font-weight: 700;">请输入股票编号（用于评论爬取）</div>
          <div class="scriptRow">
            <el-input
                v-model="scriptStockCodeInput"
                placeholder="例如：601398 / 000001"
                clearable
                @keyup.enter="runActiveScript"
            />
            <span class="badge" v-if="scriptStockCode">格式化：{{ scriptStockCode }}</span>
          </div>
          <div class="muted" v-if="scriptStockCode">
            将并行运行：<span class="monoInline">comments(--code)</span>、<span class="monoInline">news</span>、<span class="monoInline">realtime</span>
          </div>
        </div>

        <div v-if="scriptError" class="errorState" style="padding: 12px 0;">{{ scriptError }}</div>
        <div v-if="scriptRunning" class="aiProgress">
          <div class="spinner sm"></div>
          <span>脚本运行中...</span>
        </div>
        <div v-if="scriptMetaLive" class="aiResultBox">
          <div class="chartTitle">meta</div>
          <pre class="pre">{{ scriptMetaLive }}</pre>
        </div>
        <div v-if="scriptStdoutLive" class="aiResultBox">
          <div class="chartTitle">stdout（实时）</div>
          <pre class="pre">{{ scriptStdoutLive }}</pre>
        </div>
        <div v-if="scriptStderrLive" class="aiResultBox">
          <div class="chartTitle">stderr（实时）</div>
          <pre class="pre">{{ scriptStderrLive }}</pre>
        </div>
        <div v-if="scriptResult" class="aiResultBox">
          <div class="muted" style="margin-bottom: 10px;">
            key={{ scriptResult.key }}；exit={{ scriptResult.exitCode }}；耗时={{ scriptResult.durationMs }}ms
          </div>
          <div class="chartTitle">stdout</div>
          <pre class="pre">{{ scriptResult.stdout || '' }}</pre>
          <div class="chartTitle" style="margin-top: 14px;">stderr</div>
          <pre class="pre">{{ scriptResult.stderr || '' }}</pre>
        </div>
        <div v-else-if="!scriptRunning" class="emptyState sm">点击"运行脚本"开始执行</div>
      </div>
    </div>


  </main>
</template>

<style scoped>

</style>