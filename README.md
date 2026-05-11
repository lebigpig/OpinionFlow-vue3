<div align="center">

# 🧠 OpinionFlow

**舆情分析与新闻聚合平台**

[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.4.5-brightgreen)](https://spring.io/projects/spring-boot)
[![Kotlin](https://img.shields.io/badge/Kotlin-2.1.20-purple)](https://kotlinlang.org/)
[![Vue 3](https://img.shields.io/badge/Vue-3.5-4FC08D)](https://vuejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

</div>

---

## 📋 项目简介

OpinionFlow 是一个集**新闻聚合、舆情分析、脚本调度**于一体的平台。它能够：

- 📰 **多源新闻聚合** — 网易新闻、纽约时报、雅虎财经、实时财经快讯
- 🤖 **AI 智能分析** — 接入 OpenAI 兼容 API（DeepSeek / ChatGPT 等），自动分析新闻情绪、行业风险与机会
- 📊 **可视化图表** — 基于 ECharts 生成行业风险/机会指数、情绪饼图等
- 🐍 **脚本调度引擎** — 集成 Python 爬虫脚本，支持评论爬取、新闻爬取、实时数据采集
- 💬 **股吧评论分析** — 对股票评论进行情绪分析、主题提取、叙事一致性评估

---

## 🏗️ 项目结构

```
OpinionFlow/                    # 后端（Spring Boot + Kotlin）
├── sql/
│   └── init.sql                # 数据库初始化脚本
├── src/main/
│   ├── kotlin/com/lespider/opinionflow/
│   │   ├── config/             # 配置类（CORS、Jackson）
│   │   ├── domain/             # 实体类（JPA）
│   │   ├── repo/               # 数据访问层
│   │   ├── service/            # 业务逻辑层
│   │   └── web/                # RESTful API 控制器
│   └── resources/
│       └── application.properties  # 核心配置文件
├── build.gradle.kts
└── settings.gradle.kts

opinionflow-vue/                # 前端（Vue 3 + Element Plus + ECharts）
├── src/
│   ├── App.vue                 # 主页面（单页应用）
│   ├── lib/api.js              # API 请求封装
│   └── echart/                 # 保存的图表 JSON 文件
├── package.json
└── vite.config.js
```

---

## 🚀 快速开始

### 环境要求

| 工具 | 版本要求 |
|------|---------|
| JDK | 17+ |
| Kotlin | 2.1.x |
| MySQL | 8.0+ |
| Node.js | ^20.19.0 或 >=22.12.0 |
| Python（可选） | 3.x（运行爬虫脚本时需要） |

### 1️⃣ 克隆项目

```bash
git clone https://github.com/sha7adow/OpinionFlow.git
cd OpinionFlow
```

### 2️⃣ 初始化数据库

```bash
# 创建数据库
mysql -u root -p -e "CREATE DATABASE spider DEFAULT CHARSET utf8mb4;"

# 导入表结构
mysql -u root -p spider < sql/init.sql
```

### 3️⃣ 配置后端

复制并编辑配置文件：

```bash
cp src/main/resources/application.properties src/main/resources/application.properties
```

需要修改的关键配置：

```properties
# ===== 数据库配置 =====
spring.datasource.url=jdbc:mysql://127.0.0.1:3306/spider?useUnicode=true&characterEncoding=UTF-8&serverTimezone=Asia/Shanghai
spring.datasource.username=root
spring.datasource.password=你的数据库密码

# ===== AI 接口配置（可选，用于舆情分析） =====
opinionflow.ai.api-url=https://api.deepseek.com
opinionflow.ai.api-key=sk-your-api-key
opinionflow.ai.model=deepseek-chat

# ===== 脚本运行配置（可选，用于爬虫） =====
opinionflow.scripts.enabled=true
opinionflow.scripts.python=python
opinionflow.scripts.comment-path=你的评论爬取脚本路径
opinionflow.scripts.news-path=你的新闻爬取脚本路径
opinionflow.scripts.realtime-path=你的实时爬取脚本路径
```

> **完整配置项说明见下方 [⚙️ 配置详解](#️-配置详解)**

### 4️⃣ 启动后端

```bash
# Windows
gradlew.bat bootRun

# macOS / Linux
./gradlew bootRun
```

后端默认启动在 `http://localhost:8080`

### 5️⃣ 启动前端

```bash
cd ../opinionflow-vue
npm install
npm run dev
```

前端默认启动在 `http://localhost:5173`，自动代理 `/api` 请求到后端。

---

## ⚙️ 配置详解

### `application.properties` 完整配置

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| **数据库** | | |
| `spring.datasource.url` | MySQL 连接地址 | `jdbc:mysql://127.0.0.1:3306/spider?...` |
| `spring.datasource.username` | 数据库用户名 | `root` |
| `spring.datasource.password` | 数据库密码 | — |
| **AI 接口** | | |
| `opinionflow.ai.api-url` | OpenAI 兼容 API 地址 | `https://api.deepseek.com` |
| `opinionflow.ai.api-key` | API 密钥 | — |
| `opinionflow.ai.model` | 模型名称 | `deepseek-chat` |
| **脚本运行** | | |
| `opinionflow.scripts.enabled` | 是否启用脚本运行 | `true` |
| `opinionflow.scripts.python` | Python 解释器路径 | `python` |
| `opinionflow.scripts.comment-path` | 评论爬取脚本路径（支持多个，逗号分隔） | — |
| `opinionflow.scripts.news-path` | 新闻爬取脚本路径（支持多个，逗号分隔） | — |
| `opinionflow.scripts.realtime-path` | 实时爬取脚本路径（支持多个，逗号分隔） | — |

### CORS 跨域配置

在 `src/main/kotlin/.../config/WebConfig.kt` 中配置允许跨域的前端地址：

```kotlin
.allowedOrigins(
    "http://localhost:5173",   // 开发环境
    "http://127.0.0.1:5173",
    // 部署时添加你的前端域名
)
```

### ECharts 图表保存路径

在 `src/main/kotlin/.../web/EchartController.kt` 中配置：

```kotlin
val targetDir = Path.of("..", "opinionflow-vue", "src", "echart").normalize()
```

如果前端项目不在 `../opinionflow-vue/`，请修改此路径。

---

## 🗄️ 数据库表结构

| 表名 | 说明 | 数据来源 |
|------|------|---------|
| `wynews` | 网易新闻（通用新闻） | 脚本爬取 |
| `falsh_news` | 快讯新闻（财经快讯） | 脚本爬取 |
| `new_york_news` | 纽约时报新闻 | 脚本爬取 |
| `yahoo_finance_news` | 雅虎财经新闻 | 脚本爬取 |
| `stock_comment` | 股票评论分析结果 | AI 分析后写入 |

详细建表语句见 [`sql/init.sql`](sql/init.sql)。

---

## 📡 API 接口一览

### 新闻接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/news/general` | 网易新闻列表（分页） |
| GET | `/api/news/deepseek-menu` | DeepSeek 专区新闻 |
| GET | `/api/news/finance` | 实时财经新闻 |
| GET | `/api/news/finance/ids` | 财经新闻 ID 列表 |
| GET | `/api/news/{id}` | 新闻详情 |
| GET | `/api/news/finance/{id}` | 财经新闻详情 |
| GET | `/api/yahoo/news` | 雅虎财经新闻 |
| GET | `/api/nytimes/news` | 纽约时报新闻 |

### 评论分析接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/comments` | 股票评论分析列表 |
| GET | `/api/comments/{id}` | 评论分析详情 |

### AI 分析接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/ai/parse` | AI 分析（非流式） |
| POST | `/api/ai/parse/stream` | AI 分析（SSE 流式） |

### 脚本运行接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/scripts/run` | 运行单个脚本 |
| POST | `/api/scripts/run/stream` | 运行单个脚本（SSE 流式） |
| POST | `/api/scripts/run-all` | 并行运行全部脚本 |
| POST | `/api/scripts/run-all/stream` | 并行运行全部脚本（SSE 流式） |

### 其他

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/echart/save` | 保存 ECharts 图表 JSON |

---

## 🧩 脚本运行说明

脚本运行功能支持 3 种 key：

| Key | 说明 | 是否需要股票代码 |
|-----|------|----------------|
| `comments` | 评论爬取 | ✅ 需要 |
| `news` | 新闻爬取 | ❌ 不需要 |
| `realtime` | 实时爬取 | ❌ 不需要 |

每个 key 支持配置多个脚本路径（用英文逗号或分号分隔），按顺序依次执行。

---

## 🛠️ 技术栈

### 后端
- **Spring Boot 3.4.5** — 应用框架
- **Kotlin 2.1.20** — 编程语言
- **Spring Data JPA** — 数据持久化
- **MySQL** — 数据库
- **Gradle** — 构建工具

### 前端
- **Vue 3** — 前端框架
- **Element Plus** — UI 组件库
- **ECharts 6** — 图表可视化
- **Vite** — 构建工具

---

## 📄 开源协议

本项目基于 MIT 协议开源，详见 [LICENSE](LICENSE) 文件。

---

## ⚠️ 注意事项

1. **API 密钥安全**：`application.properties` 中的 `opinionflow.ai.api-key` 请勿提交到 Git 仓库
2. **数据库密码**：请使用强密码，不要使用示例中的 `123456`
3. **脚本路径**：脚本路径指向本地文件系统，不同用户需要自行配置
4. **前端代理**：开发环境下 Vite 自动代理 `/api` 到 `localhost:8080`，生产环境需自行配置 Nginx 等反向代理
