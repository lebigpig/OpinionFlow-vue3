import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { fetchCompanyIndustries } from '@/lib/api.js'

/**
 * 企业（中国上市公司）模块状态
 *
 * industries：所属行业清单，供公司列表的「所属行业」下拉框选择。
 * 两个来源合并：
 *   1) 后端 /api/company/industries 去重全量结果（loadIndustries）
 *   2) 每次查询公司列表时，把结果里出现过的行业并入（mergeIndustries）
 */
export const useCompanyStore = defineStore('company', () => {
  const industries = ref([])            // 行业清单（去重 + 已排序）
  const industriesLoading = ref(false)
  const industriesError = ref('')
  const industryFilter = ref('')        // 当前选中的行业（'' = 全部）

  const industryOptions = computed(() => industries.value)
  const industryCount = computed(() => industries.value.length)

  /** 去重 + 去空白 + 中文友好排序 */
  function normalize(list) {
    return [...new Set((list || []).map((s) => (s ?? '').toString().trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'zh-CN'))
  }

  /** 拉取全部行业（去重）并存入 store */
  async function loadIndustries() {
    industriesLoading.value = true
    industriesError.value = ''
    try {
      const list = await fetchCompanyIndustries()
      industries.value = normalize(list)
    } catch (e) {
      industriesError.value = `加载行业列表失败：${e?.message || e}`
    } finally {
      industriesLoading.value = false
    }
  }

  /** 把查询结果中出现的行业合并进 store（保证"查询到的行业"都能被下拉框选择） */
  function mergeIndustries(rows) {
    const extra = (rows || []).map((r) => r?.industry).filter(Boolean)
    if (!extra.length) return
    const merged = normalize([...industries.value, ...extra])
    if (merged.length !== industries.value.length) {
      industries.value = merged
    }
  }

  /** 设置当前行业筛选（同步给其他组件用） */
  function setIndustry(v) {
    industryFilter.value = v || ''
  }

  /** 清空行业筛选 */
  function clearIndustry() {
    industryFilter.value = ''
  }

  return {
    industries,
    industryOptions,
    industryCount,
    industriesLoading,
    industriesError,
    industryFilter,
    loadIndustries,
    mergeIndustries,
    setIndustry,
    clearIndustry,
  }
})