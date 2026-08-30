// src/lib/worldMapData.js
// 世界格局地图：主要国家的一级行政区地图 + 全球重要城市坐标标记

// ── 主要国家行政区地图（一级行政区：省/州/县） ──────────────────────
// 由 @amcharts/amcharts5-geodata/data/countries.js 的映射得到文件名（*Low）
import chinaLow from '@amcharts/amcharts5-geodata/chinaLow'
import usaLow from '@amcharts/amcharts5-geodata/usaLow'
import japanLow from '@amcharts/amcharts5-geodata/japanLow'
import indiaLow from '@amcharts/amcharts5-geodata/indiaLow'
import russiaLow from '@amcharts/amcharts5-geodata/russiaLow'
import germanyLow from '@amcharts/amcharts5-geodata/germanyLow'
import franceLow from '@amcharts/amcharts5-geodata/franceLow'
import ukLow from '@amcharts/amcharts5-geodata/ukLow'
import brazilLow from '@amcharts/amcharts5-geodata/brazilLow'
import australiaLow from '@amcharts/amcharts5-geodata/australiaLow'
import canadaLow from '@amcharts/amcharts5-geodata/canadaLow'
import italyLow from '@amcharts/amcharts5-geodata/italyLow'
import spainLow from '@amcharts/amcharts5-geodata/spainLow'
import southKoreaLow from '@amcharts/amcharts5-geodata/southKoreaLow'
import indonesiaLow from '@amcharts/amcharts5-geodata/indonesiaLow'
import turkeyLow from '@amcharts/amcharts5-geodata/turkeyLow'
import mexicoLow from '@amcharts/amcharts5-geodata/mexicoLow'
import thailandLow from '@amcharts/amcharts5-geodata/thailandLow'
import vietnamLow from '@amcharts/amcharts5-geodata/vietnamLow'
import singaporeLow from '@amcharts/amcharts5-geodata/singaporeLow'

// ISO2 → 行政区地图
export const SUB_MAPS = {
  CN: chinaLow,
  US: usaLow,
  JP: japanLow,
  IN: indiaLow,
  RU: russiaLow,
  DE: germanyLow,
  FR: franceLow,
  GB: ukLow,
  BR: brazilLow,
  AU: australiaLow,
  CA: canadaLow,
  IT: italyLow,
  ES: spainLow,
  KR: southKoreaLow,
  ID: indonesiaLow,
  TR: turkeyLow,
  MX: mexicoLow,
  TH: thailandLow,
  VN: vietnamLow,
  SG: singaporeLow,
}


// ── 全球重要城市坐标（用于地图上的城市标记） ───────────────────────
// { countryId, zh, en, lat, lng }
export const IMPORTANT_CITIES = [
  // 中国
  { countryId: 'CN', zh: '北京', en: 'Beijing', lat: 39.9042, lng: 116.4074 },
  { countryId: 'CN', zh: '上海', en: 'Shanghai', lat: 31.2304, lng: 121.4737 },
  { countryId: 'CN', zh: '广州', en: 'Guangzhou', lat: 23.1291, lng: 113.2644 },
  { countryId: 'CN', zh: '深圳', en: 'Shenzhen', lat: 22.5431, lng: 114.0579 },
  { countryId: 'CN', zh: '成都', en: 'Chengdu', lat: 30.5728, lng: 104.0668 },
  { countryId: 'CN', zh: '香港', en: 'Hong Kong', lat: 22.3193, lng: 114.1694 },
  { countryId: 'CN', zh: '台北', en: 'Taipei', lat: 25.033, lng: 121.5654 },
  // 美国
  { countryId: 'US', zh: '纽约', en: 'New York', lat: 40.7128, lng: -74.006 },
  { countryId: 'US', zh: '洛杉矶', en: 'Los Angeles', lat: 34.0522, lng: -118.2437 },
  { countryId: 'US', zh: '芝加哥', en: 'Chicago', lat: 41.8781, lng: -87.6298 },
  { countryId: 'US', zh: '华盛顿', en: 'Washington D.C.', lat: 38.9072, lng: -77.0369 },
  { countryId: 'US', zh: '旧金山', en: 'San Francisco', lat: 37.7749, lng: -122.4194 },
  { countryId: 'US', zh: '休斯敦', en: 'Houston', lat: 29.7604, lng: -95.3698 },
  // 日本
  { countryId: 'JP', zh: '东京', en: 'Tokyo', lat: 35.6762, lng: 139.6503 },
  { countryId: 'JP', zh: '大阪', en: 'Osaka', lat: 34.6937, lng: 135.5023 },
  { countryId: 'JP', zh: '京都', en: 'Kyoto', lat: 35.0116, lng: 135.7681 },
  { countryId: 'JP', zh: '札幌', en: 'Sapporo', lat: 43.0618, lng: 141.3545 },
  // 印度
  { countryId: 'IN', zh: '新德里', en: 'New Delhi', lat: 28.6139, lng: 77.209 },
  { countryId: 'IN', zh: '孟买', en: 'Mumbai', lat: 19.076, lng: 72.8777 },
  { countryId: 'IN', zh: '班加罗尔', en: 'Bengaluru', lat: 12.9716, lng: 77.5946 },
  // 俄罗斯
  { countryId: 'RU', zh: '莫斯科', en: 'Moscow', lat: 55.7558, lng: 37.6173 },
  { countryId: 'RU', zh: '圣彼得堡', en: 'Saint Petersburg', lat: 59.9311, lng: 30.3609 },
  // 德国
  { countryId: 'DE', zh: '柏林', en: 'Berlin', lat: 52.52, lng: 13.405 },
  { countryId: 'DE', zh: '慕尼黑', en: 'Munich', lat: 48.1351, lng: 11.582 },
  { countryId: 'DE', zh: '法兰克福', en: 'Frankfurt', lat: 50.1109, lng: 8.6821 },
  // 法国
  { countryId: 'FR', zh: '巴黎', en: 'Paris', lat: 48.8566, lng: 2.3522 },
  { countryId: 'FR', zh: '里昂', en: 'Lyon', lat: 45.764, lng: 4.8357 },
  { countryId: 'FR', zh: '马赛', en: 'Marseille', lat: 43.2965, lng: 5.3698 },
  // 英国
  { countryId: 'GB', zh: '伦敦', en: 'London', lat: 51.5074, lng: -0.1278 },
  { countryId: 'GB', zh: '曼彻斯特', en: 'Manchester', lat: 53.4808, lng: -2.2426 },
  { countryId: 'GB', zh: '爱丁堡', en: 'Edinburgh', lat: 55.9533, lng: -3.1883 },
  // 巴西
  { countryId: 'BR', zh: '圣保罗', en: 'São Paulo', lat: -23.5505, lng: -46.6333 },
  { countryId: 'BR', zh: '里约热内卢', en: 'Rio de Janeiro', lat: -22.9068, lng: -43.1729 },
  { countryId: 'BR', zh: '巴西利亚', en: 'Brasília', lat: -15.8267, lng: -47.9218 },
  // 澳大利亚
  { countryId: 'AU', zh: '悉尼', en: 'Sydney', lat: -33.8688, lng: 151.2093 },
  { countryId: 'AU', zh: '墨尔本', en: 'Melbourne', lat: -37.8136, lng: 144.9631 },
  { countryId: 'AU', zh: '堪培拉', en: 'Canberra', lat: -35.2809, lng: 149.13 },
  // 加拿大
  { countryId: 'CA', zh: '多伦多', en: 'Toronto', lat: 43.6532, lng: -79.3832 },
  { countryId: 'CA', zh: '温哥华', en: 'Vancouver', lat: 49.2827, lng: -123.1207 },
  { countryId: 'CA', zh: '渥太华', en: 'Ottawa', lat: 45.4215, lng: -75.6972 },
  // 意大利
  { countryId: 'IT', zh: '罗马', en: 'Rome', lat: 41.9028, lng: 12.4964 },
  { countryId: 'IT', zh: '米兰', en: 'Milan', lat: 45.4642, lng: 9.19 },
  // 西班牙
  { countryId: 'ES', zh: '马德里', en: 'Madrid', lat: 40.4168, lng: -3.7038 },
  { countryId: 'ES', zh: '巴塞罗那', en: 'Barcelona', lat: 41.3874, lng: 2.1686 },
  // 韩国
  { countryId: 'KR', zh: '首尔', en: 'Seoul', lat: 37.5665, lng: 126.978 },
  { countryId: 'KR', zh: '釜山', en: 'Busan', lat: 35.1796, lng: 129.0756 },
  // 印尼
  { countryId: 'ID', zh: '雅加达', en: 'Jakarta', lat: -6.2088, lng: 106.8456 },
  // 土耳其
  { countryId: 'TR', zh: '伊斯坦布尔', en: 'Istanbul', lat: 41.0082, lng: 28.9784 },
  { countryId: 'TR', zh: '安卡拉', en: 'Ankara', lat: 39.9334, lng: 32.8597 },
  // 墨西哥
  { countryId: 'MX', zh: '墨西哥城', en: 'Mexico City', lat: 19.4326, lng: -99.1332 },
  // 泰国
  { countryId: 'TH', zh: '曼谷', en: 'Bangkok', lat: 13.7563, lng: 100.5018 },
  // 越南
  { countryId: 'VN', zh: '河内', en: 'Hanoi', lat: 21.0278, lng: 105.8342 },
  { countryId: 'VN', zh: '胡志明市', en: 'Ho Chi Minh City', lat: 10.8231, lng: 106.6297 },
  // 新加坡
  { countryId: 'SG', zh: '新加坡', en: 'Singapore', lat: 1.3521, lng: 103.8198 },
  // 其他重要城市
  { countryId: 'NL', zh: '阿姆斯特丹', en: 'Amsterdam', lat: 52.3676, lng: 4.9041 },
  { countryId: 'SE', zh: '斯德哥尔摩', en: 'Stockholm', lat: 59.3293, lng: 18.0686 },
  { countryId: 'CH', zh: '苏黎世', en: 'Zürich', lat: 47.3769, lng: 8.5417 },
  { countryId: 'AT', zh: '维也纳', en: 'Vienna', lat: 48.2082, lng: 16.3738 },
  { countryId: 'PL', zh: '华沙', en: 'Warsaw', lat: 52.2297, lng: 21.0122 },
  { countryId: 'UA', zh: '基辅', en: 'Kyiv', lat: 50.4501, lng: 30.5234 },
  { countryId: 'EG', zh: '开罗', en: 'Cairo', lat: 30.0444, lng: 31.2357 },
  { countryId: 'ZA', zh: '约翰内斯堡', en: 'Johannesburg', lat: -26.2041, lng: 28.0473 },
  { countryId: 'ZA', zh: '开普敦', en: 'Cape Town', lat: -33.9249, lng: 18.4241 },
  { countryId: 'SA', zh: '利雅得', en: 'Riyadh', lat: 24.7136, lng: 46.6753 },
  { countryId: 'AR', zh: '布宜诺斯艾利斯', en: 'Buenos Aires', lat: -34.6037, lng: -58.3816 },
  { countryId: 'CL', zh: '圣地亚哥', en: 'Santiago', lat: -33.4489, lng: -70.6693 },
  { countryId: 'NG', zh: '拉各斯', en: 'Lagos', lat: 6.5244, lng: 3.3792 },
  { countryId: 'NZ', zh: '奥克兰', en: 'Auckland', lat: -36.8509, lng: 174.7645 },
  { countryId: 'NO', zh: '奥斯陆', en: 'Oslo', lat: 59.9139, lng: 10.7522 },
  { countryId: 'DK', zh: '哥本哈根', en: 'Copenhagen', lat: 55.6761, lng: 12.5683 },
  { countryId: 'FI', zh: '赫尔辛基', en: 'Helsinki', lat: 60.1699, lng: 24.9384 },
  { countryId: 'IE', zh: '都柏林', en: 'Dublin', lat: 53.3498, lng: -6.2603 },
  { countryId: 'PT', zh: '里斯本', en: 'Lisbon', lat: 38.7223, lng: -9.1393 },
  { countryId: 'GR', zh: '雅典', en: 'Athens', lat: 37.9838, lng: 23.7275 },
  { countryId: 'HU', zh: '布达佩斯', en: 'Budapest', lat: 47.4979, lng: 19.0402 },
  { countryId: 'CZ', zh: '布拉格', en: 'Prague', lat: 50.0755, lng: 14.4378 },
  { countryId: 'RO', zh: '布加勒斯特', en: 'Bucharest', lat: 44.4268, lng: 26.1025 },
  { countryId: 'BE', zh: '布鲁塞尔', en: 'Brussels', lat: 50.8503, lng: 4.3517 },
  { countryId: 'PK', zh: '卡拉奇', en: 'Karachi', lat: 24.8607, lng: 67.0011 },
  { countryId: 'IR', zh: '德黑兰', en: 'Tehran', lat: 35.6892, lng: 51.389 },
  { countryId: 'IL', zh: '特拉维夫', en: 'Tel Aviv', lat: 32.0853, lng: 34.7818 },
  { countryId: 'AE', zh: '迪拜', en: 'Dubai', lat: 25.2048, lng: 55.2708 },
  { countryId: 'PH', zh: '马尼拉', en: 'Manila', lat: 14.5995, lng: 120.9842 },
  { countryId: 'MY', zh: '吉隆坡', en: 'Kuala Lumpur', lat: 3.139, lng: 101.6869 },
  { countryId: 'BD', zh: '达卡', en: 'Dhaka', lat: 23.8103, lng: 90.4125 },
  { countryId: 'PE', zh: '利马', en: 'Lima', lat: -12.0464, lng: -77.0428 },
  { countryId: 'CO', zh: '波哥大', en: 'Bogotá', lat: 4.711, lng: -74.0721 },
  { countryId: 'KE', zh: '内罗毕', en: 'Nairobi', lat: -1.2921, lng: 36.8219 },
  { countryId: 'ET', zh: '亚的斯亚贝巴', en: 'Addis Ababa', lat: 9.03, lng: 38.74 },
  { countryId: 'MM', zh: '仰光', en: 'Yangon', lat: 16.8409, lng: 96.1735 },
  { countryId: 'KZ', zh: '阿拉木图', en: 'Almaty', lat: 43.222, lng: 76.8512 },
]

