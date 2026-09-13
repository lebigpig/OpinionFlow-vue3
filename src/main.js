import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './assets/global.css'

import App from './App.vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
// 皮肤样式（皮肤商城）：放在 Element Plus 之后，保证皮肤变量可覆盖组件默认值
import './assets/skin.css'
import router from './router'

const pinia = createPinia()
const app = createApp(App)
app.use(ElementPlus)
app.use(pinia)
app.use(router)

// 提前应用已保存的皮肤，避免首屏闪烁（useSkin 中也会在挂载时恢复）
try {
  const savedSkin = localStorage.getItem('opinionskin')
  if (savedSkin && savedSkin !== 'default') {
    document.documentElement.classList.add(`skin-${savedSkin}`)
  }
} catch {
  /* localStorage 不可用时忽略 */
}

app.mount('#app')
