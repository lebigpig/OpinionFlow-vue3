import { ref, watch } from 'vue'

/**
 * 主题切换 composable
 * @param {Object} options
 * @param {Function} [options.onThemeChange] - 主题切换后的回调，参数为 (isDark: boolean)
 * @returns {{ isDark: Ref<boolean>, toggleTheme: () => void }}
 */
export function useTheme({ onThemeChange } = {}) {
  const isDark = ref(localStorage.getItem('theme') === 'dark')

  function toggleTheme() {
    isDark.value = !isDark.value
  }

  watch(isDark, (val) => {
    const html = document.documentElement
    if (val) {
      html.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      html.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
    if (typeof onThemeChange === 'function') {
      onThemeChange(val)
    }
  }, { immediate: true })

  return { isDark, toggleTheme }
}