import { ref } from 'vue'

/**
 * 可用皮肤列表
 * 新增皮肤时：1) 在此登记；2) 在 src/assets/skin.css 中编写 html.skin-<id> 样式。
 */
export const SKINS = [
  {
    id: 'default',
    name: '默认皮肤',
    desc: 'OpinionFlow 原生风格：蓝调玻璃卡片，支持浅色 / 深色。',
  },
  {
    id: 'mac',
    name: 'macOS',
    desc: '苹果系统风：毛玻璃面板、交通灯点缀、系统字体与蓝色强调。',
    tag: '苹果风',
  },
  {
    id: 'win11',
    name: 'Windows 11',
    desc: 'Mica 材质与 Segoe UI，Windows 蓝 + 柔和圆角窗口。',
    tag: 'Windows',
  },
  {
    id: 'linux',
    name: 'Ubuntu / Linux',
    desc: 'Ubuntu 终端风：等宽字体、深紫底 + 橙色强调。',
    tag: '终端',
  },
  {
    id: 'win95',
    name: 'Windows 95',
    desc: '复古像素风：青色桌面、灰色 3D 凸起边框、无圆角。',
    tag: '复古',
  },
  {
    id: 'cyberpunk',
    name: '赛博朋克 2077',
    desc: '霓虹黄 + 青蓝辉光，夜之城的高科技低生活界面。',
    tag: '霓虹',
  },
  {
    id: 'matrix',
    name: '黑客帝国',
    desc: '黑底绿字极简终端，Matrix 数字雨观感。',
    tag: '极客',
  },
  {
    id: 'bloomberg',
    name: 'Bloomberg Terminal',
    desc: '彭博终端：橙色标题栏、黑底绿字、等宽密集数据表。',
    tag: '金融',
  },
  {
    id: 'google',
    name: 'Google',
    desc: '极简留白（1998 至今）：胶囊圆角、几乎零装饰，聚焦核心功能。',
    tag: '极简',
  },
  {
    id: 'craigslist',
    name: 'Craigslist',
    desc: '纯文字链接、零设计感配色，信息浏览零干扰。',
    tag: '简陋',
  },
  {
    id: 'wikipedia',
    name: 'Wikipedia',
    desc: '蓝白配色 + 衬线标题，为最大化可读性而设计。',
    tag: '知识',
  },
  {
    id: 'reddit',
    name: 'Reddit（旧版）',
    desc: '浅蓝顶栏 + 高密度文字链接，论坛类产品经典形态。',
    tag: '论坛',
  },
]

const SKIN_KEY = 'opinionskin'

/**
 * 皮肤切换 composable：
 * 在 <html> 元素上维护 skin-<id> class，并持久化到 localStorage。
 * 皮肤与深浅色主题（useTheme 的 html.dark）互不冲突，可叠加。
 */
export function useSkin() {
  const saved = localStorage.getItem(SKIN_KEY)
  const currentSkin = ref(SKINS.some((s) => s.id === saved) ? saved : 'default')

  function applySkin(id) {
    if (!SKINS.some((s) => s.id === id)) id = 'default'
    const html = document.documentElement
    for (const s of SKINS) html.classList.remove(`skin-${s.id}`)
    if (id !== 'default') html.classList.add(`skin-${id}`)
    localStorage.setItem(SKIN_KEY, id)
    currentSkin.value = id
  }

  // 页面加载/刷新时恢复上次选中的皮肤
  if (currentSkin.value !== 'default') {
    document.documentElement.classList.add(`skin-${currentSkin.value}`)
  }

  return { currentSkin, applySkin }
}