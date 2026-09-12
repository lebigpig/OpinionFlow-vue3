// src/lib/worldCountries.js
// 世界格局地图工具：中文/英文国家名 → ISO2 → 地理中心点
// 中心点由 amCharts5 worldLow geodata 的几何坐标计算得出，用于在地图上放置图标/图表。

import am5geodata_worldLow from '@amcharts/amcharts5-geodata/worldLow'

// ── 中文国家名 → ISO2 映射（含常用别名） ─────────────────────────────
export const COUNTRY_ZH = {
  中国: 'CN', 中华人民共和国: 'CN', 中国大陆: 'CN',
  美国: 'US', 美利坚: 'US', 美利坚合众国: 'US',
  日本: 'JP', 日本国: 'JP',
  韩国: 'KR', 大韩民国: 'KR', 朝鲜: 'KP',
  印度: 'IN', 印度尼西亚: 'ID', 印尼: 'ID',
  俄罗斯: 'RU', 俄罗斯联邦: 'RU', 英国: 'GB', 英格兰: 'GB', 大不列颠: 'GB',
  法国: 'FR', 德国: 'DE', 意大利: 'IT', 西班牙: 'ES', 葡萄牙: 'PT',
  加拿大: 'CA', 澳大利亚: 'AU', 新西兰: 'NZ', 巴西: 'BR', 阿根廷: 'AR',
  墨西哥: 'MX', 秘鲁: 'PE', 智利: 'CL', 哥伦比亚: 'CO', 委内瑞拉: 'VE', 古巴: 'CU',
  埃及: 'EG', 南非: 'ZA', 尼日利亚: 'NG', 埃塞俄比亚: 'ET', 肯尼亚: 'KE',
  摩洛哥: 'MA', 阿尔及利亚: 'DZ', 利比亚: 'LY', 苏丹: 'SD',
  沙特阿拉伯: 'SA', 沙特: 'SA', 阿联酋: 'AE', 伊朗: 'IR', 伊拉克: 'IQ',
  土耳其: 'TR', 以色列: 'IL', 巴基斯坦: 'PK', 孟加拉: 'BD', 孟加拉国: 'BD',
  泰国: 'TH', 越南: 'VN', 菲律宾: 'PH', 马来西亚: 'MY', 新加坡: 'SG', 蒙古: 'MN',
  哈萨克斯坦: 'KZ', 乌克兰: 'UA', 波兰: 'PL', 瑞典: 'SE', 挪威: 'NO',
  芬兰: 'FI', 丹麦: 'DK', 荷兰: 'NL', 比利时: 'BE', 瑞士: 'CH', 奥地利: 'AT',
  希腊: 'GR', 匈牙利: 'HU', 捷克: 'CZ', 罗马尼亚: 'RO', 爱尔兰: 'IE',
  阿富汗: 'AF', 缅甸: 'MM', 斯里兰卡: 'LK', 尼泊尔: 'NP', 老挝: 'LA', 柬埔寨: 'KH',
  冰岛: 'IS', 格陵兰: 'GL', 巴拿马: 'PA', 哥斯达黎加: 'CR', 危地马拉: 'GT',
  斐济: 'FJ', 巴布亚新几内亚: 'PG', 也门: 'YE', 阿曼: 'OM', 卡塔尔: 'QA', 科威特: 'KW',
  叙利亚: 'SY', 黎巴嫩: 'LB', 约旦: 'JO', 塞浦路斯: 'CY',
}

// ── 中心点缓存 ─────────────────────────────────────────────────────
let index = null

function averageCoord(rings) {
  const pts = rings.flat(2)
  if (!pts.length) return null
  let x = 0, y = 0
  for (const p of pts) { x += p[0]; y += p[1] }
  return [x / pts.length, y / pts.length]
}

function centroidOfGeometry(geometry) {
  if (!geometry) return null
  if (geometry.type === 'Polygon') return averageCoord(geometry.coordinates)
  if (geometry.type === 'MultiPolygon') return averageCoord(geometry.coordinates.flat(1))
  return null
}

export function buildCountryIndex(geoJson = am5geodata_worldLow) {
  const byId = {}
  const features = geoJson?.features || []
  for (const f of features) {
    const id = f?.properties?.id || f?.id
    if (!id) continue
    const en = f?.properties?.name || ''
    let zh = ''
    for (const k of Object.keys(COUNTRY_ZH)) {
      if (COUNTRY_ZH[k] === id) { zh = k; break }
    }
    byId[id] = {
      id,
      en,
      zh,
      centroid: centroidOfGeometry(f?.geometry),
    }
  }
  return { byId, geoJson }
}

export function getCountryIndex() {
  if (!index) index = buildCountryIndex()
  return index
}

export function getCentroid(countryId) {
  const rec = getCountryIndex().byId[countryId]
  return rec?.centroid || null
}

export function getCountryName(countryId) {
  const rec = getCountryIndex().byId[countryId]
  return rec || null
}

// ─────────────────────────────────────────────────────────────────────
// 国家宏观指标名称解析
// amCharts worldLow 英文国家名 → country_macro_indicators.country（世界银行口径）
// 大部分可直接用规范化文本匹配，少数不同名的国家需要显式映射。
// ─────────────────────────────────────────────────────────────────────

const MACRO_COUNTRY_MAP = {
  Russia: 'Russian Federation',
  Vietnam: 'Viet Nam',
  Türkiye: 'Turkiye',
  Turkey: 'Turkiye',
  'South Korea': 'Korea, Rep.',
  'North Korea': "Korea, Dem. People's Rep.",
  'Cape Verde': 'Cabo Verde',
  Curaçao: 'Curacao',
  "Côte d'Ivoire": "Cote d'Ivoire",
  'Ivory Coast': "Cote d'Ivoire",
  'Democratic Republic of Congo': 'Congo, Dem. Rep.',
  'Congo (Kinshasa)': 'Congo, Dem. Rep.',
  'Republic of Congo': 'Congo, Rep.',
  'Congo (Brazzaville)': 'Congo, Rep.',
  Kyrgyzstan: 'Kyrgyz Republic',
  "Lao People's Democratic Republic": 'Lao PDR',
  Laos: 'Lao PDR',
  Macau: 'Macao SAR, China',
  'Macao SAR': 'Macao SAR, China',
  'Hong Kong SAR': 'Hong Kong SAR, China',
  Slovakia: 'Slovak Republic',
  'Saint Lucía': 'St. Lucia',
  'Saint Lucia': 'St. Lucia',
  'Saint Kitts and Nevis': 'St. Kitts and Nevis',
  'Saint Vincent and the Grenadines': 'St. Vincent and the Grenadines',
  'Saint Martin': 'St. Martin (French part)',
  'Federated States of Micronesia': 'Micronesia, Fed. Sts.',
  'Micronesia (country)': 'Micronesia, Fed. Sts.',
  'Palestinian Territories': 'West Bank and Gaza',
  'Palestine': 'West Bank and Gaza',
  Nauru: 'Naoero',
  Brunei: 'Brunei Darussalam',
  'Virgin Islands': 'Virgin Islands (U.S.)',
  'DR Congo': 'Congo, Dem. Rep.',
  'Côte D’Ivoire': "Cote d'Ivoire",
}

/** 名称规范化：小写 + 仅保留字母数字 */
function normalizeName(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * 将地图英文国家名解析为数据库 country 名称。
 * @param {string} mapName 地图国家名（如 "China"、"United States of America"）
 * @param {Array<{country:string}>} dbCountries fetchCountryMacroCountries() 返回的国家清单
 * @returns {string|null} 数据库中确切的 country 名称；库中无数据返回 null
 */
export function resolveMacroCountry(mapName, dbCountries) {
  if (!mapName) return null
  const direct = MACRO_COUNTRY_MAP[mapName]
  if (direct) return direct

  const k = normalizeName(mapName)
  if (!k) return null
  const list = Array.isArray(dbCountries) ? dbCountries : []

  // 1) 规范化后完全一致
  let hit = list.find((c) => normalizeName(c.country) === k)
  if (hit) return hit.country

  // 2) 双向包含匹配（处理 "United States of America" → "United States" 等）
  hit = list.find((c) => {
    const nk = normalizeName(c.country)
    if (!nk) return false
    return k.includes(nk) || nk.includes(k)
  })
  return hit ? hit.country : null
}

/**
 * 从自然语言文本中匹配国家（中文优先，其次英文）。
 * 返回 { id, en, zh, centroid } 或 null
 */
export function matchCountry(text) {
  if (!text) return null
  const idx = getCountryIndex()
  // 中文优先
  for (const zh of Object.keys(COUNTRY_ZH)) {
    if (text.includes(zh)) {
      const rec = idx.byId[COUNTRY_ZH[zh]]
      if (rec) return rec
    }
  }
  // 英文匹配
  const lower = text.toLowerCase()
  for (const id of Object.keys(idx.byId)) {
    const rec = idx.byId[id]
    if (rec.en && lower.includes(rec.en.toLowerCase())) return rec
  }
  return null
}
