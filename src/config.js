/**
 * OpinionFlow 前端运行模式配置
 *
 * microservice  - true  = 连接 OpinionFlow-Cloud 微服务网关
 *               false = 连接原始单体后端
 *
 * 其它字段说明：
 *   gatewayPort  - 微服务网关端口（Spring Cloud Gateway）
 *   monoPort     - 单体后端端口
 */
const config = {
  // ────────── 切换开关 ──────────
  microservice: true,

  // ────────── 端口配置 ──────────
  gatewayPort: 9006,   // OpinionFlow-Cloud 网关端口
  monoPort: 8080,      // 单体后端端口
}

// ---------- 派生常量（不要手动修改） ----------
export const IS_MICROSERVICE = config.microservice
export const PROXY_TARGET = config.microservice
  ? `http://localhost:${config.gatewayPort}`
  : `http://localhost:${config.monoPort}`

export default config