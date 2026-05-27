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
                name: 'general',
                component: () => import('@/views/GeneralNews.vue')
            },
            {
                path: 'news/yahoo',
                name: 'yahoo',
                component: () => import('@/views/YahooNews.vue')
            },


            // 实时模块
            {
                path: 'realtime/finance',
                name: 'finance',
                component: () => import('@/views/FinanceNews.vue')
            },

            // 分析模块
            {
                path: 'analysis/industry',
                name: 'industry',
                component: () => import('@/views/Industryanalyse.vue')
            },
            {
                path: 'analysis/ai_custom',
                name: 'ai_custom',
                component: () => import('@/views/AICustomAnalysis.vue')
            },
            {
                path: 'analysis/comments',
                name: 'comments',
                component: () => import('@/views/StockComments.vue')
            },

            // 脚本运行模块
            {
                path: 'scripts',
                name: 'scripts',
                component: () => import('@/views/ScriptRun.vue'),
                children: [
                    {
                        path:'/script_all',
                        name:'script_all',

                    },
                    {
                        path:'/script_news',
                        name:'script_news',

                    },
                    {
                        path:'/script_realtime',
                        name:'script_realtime',

                    },
                    {
                        path:'/script_comments',
                        name:'script_comments',

                    },

                    ]
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