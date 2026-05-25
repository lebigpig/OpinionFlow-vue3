import './assets/main.css'

import { createApp } from 'vue'
import  './assets/global.css'

import App from './App.vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import router from './router'


const app = createApp(App)
app.use(ElementPlus)
app.use(router)
createApp(App).use(ElementPlus).mount('#app')
