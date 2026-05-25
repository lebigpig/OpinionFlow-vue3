// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '@/layouts/MainLayout.vue'

const routes = [
    {
        path: '/',
        component: MainLayout,
        children: [
            // 默认重定向
            {
                path: '',
                redirect: '/news/general'
            },

            // 新闻模块
            {
                path: 'news/general',
                name: 'GeneralNews',
                component: () => import('@/views/GeneralNews.vue')
            },
            {
                path: 'news/yahoo',
                name: 'YahooNews',
                component: () => import('@/views/YahooNews.vue')
            },
            {
                path: 'news/nytimes',
                name: 'NytimesNews',
                component: () => import('@/views/NYTimesNews.vue')
            },
            {
                path: 'news/deepseek',
                name: 'DeepseekZone',
                component: () => import('@/views/DeepseekNews.vue')
            },

            // 实时模块
            {
                path: 'realtime/finance',
                name: 'FinanceNews',
                component: () => import('@/views/FinanceNews.vue')
            },

            // 分析模块
            {
                path: 'analysis/industry',
                name: 'WordCloudAnalysis',
                component: () => import('@/views/Industryanalyse.vue')
            },
            {
                path: 'analysis/ai_custom',
                name: 'AICustomAnalysis',
                component: () => import('@/views/AICustomAnalysis.vue')
            },
            {
                path: 'analysis/comments',
                name: 'CommentsAnalysis',
                component: () => import('@/views/StockComments.vue')
            },

            // 脚本运行模块
            {
                path: 'scripts',
                name: 'Scripts',
                component: () => import('@/views/ScriptRun.vue')
            },
        ]
    },

    // 404 兜底
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

export default router