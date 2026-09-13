<template>
  <header class="header card">
    <div class="headerLeft">
      <img alt="logo" src="../../assets/新闻.png" width="32" height="32" />
      <div class="logoText">OpinionFlow 舆情</div>
      <div class="badge">MySQL spider</div>
    </div>
    <div class="headerRight">
      <div class="currentMenu">
        <span class="muted">当前菜单：</span>
        <span class="menuName">{{ activeMenuName }}</span>
      </div>
      <button class="btn skinEntryBtn" @click="skinOpen = true">
        <span>🎨 皮肤商城</span>
      </button>
      <button class="btn" @click="$emit('toggleTheme')">
        <span v-if="isDark">🌙 深色模式</span>
        <span v-else>☀️ 浅色模式</span>
      </button>
      <button class="btn primary" @click="$emit('loadList')" :disabled="loadingList">刷新数据</button>
    </div>
  </header>

  <!-- ── 皮肤商城（点击 🎨 皮肤商城 打开）── -->
  <teleport to="body">
    <transition name="skinFade">
      <div v-if="skinOpen" class="skinOverlay" @click.self="skinOpen = false">
        <div class="skinPanel">
          <div class="skinPanelHead">
            <div>
              <div class="skinPanelTitle">🎨 皮肤商城</div>
              <div class="skinPanelSub">选择一个皮肤，整套界面风格立即切换</div>
            </div>
            <button class="skinClose" @click="skinOpen = false">✕ 关闭</button>
          </div>

          <div class="skinGrid">
            <div
              v-for="sk in SKINS"
              :key="sk.id"
              class="skinCard"
              :class="{ active: currentSkin === sk.id }"
            >
              <div class="skinPreview" :class="'sp-' + sk.id">
                <div class="spWin">
                  <div v-if="sk.id === 'mac'" class="spTraffic">
                    <i /><i /><i />
                  </div>
                  <div class="spTitleLine" />
                  <div class="spBar" />
                  <div class="spLine" />
                  <div class="spLine short" />
                </div>
              </div>
              <div class="skinInfo">
                <div class="skinName">
                  {{ sk.name }}
                  <span v-if="sk.tag" class="skinTag">{{ sk.tag }}</span>
                </div>
                <div class="skinDesc">{{ sk.desc }}</div>
              </div>
              <button
                class="skinUseBtn"
                :class="{ using: currentSkin === sk.id }"
                :disabled="currentSkin === sk.id"
                @click="applySkin(sk.id)"
              >
                {{ currentSkin === sk.id ? '✓ 使用中' : '使用此皮肤' }}
              </button>
            </div>
          </div>

          <div class="skinHint">＊ 皮肤选择会保存，可随时回来切换回默认皮肤。</div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup>
import { ref } from 'vue'
import { SKINS, useSkin } from '@/composables/useSkin'

defineProps({
  activeMenuName: { type: String, default: '' },
  isDark: { type: Boolean, default: false },
  loadingList: { type: Boolean, default: false }
})

defineEmits(['toggleTheme', 'loadList'])

// 皮肤商城：当前皮肤 + 切换（持久化在 useSkin 中）
const { currentSkin, applySkin } = useSkin()
const skinOpen = ref(false)
</script>

<style scoped>
.header {
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 24px;
}
.headerLeft {
  display: flex;
  align-items: center;
  gap: 12px;
}
.logoText {
  font-size: 20px;
  font-weight: 800;
  background: linear-gradient(120deg, var(--primary-color), #a8c0ff);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.headerRight {
  display: flex;
  align-items: center;
  gap: 16px;
}
.currentMenu {
  display: flex;
  align-items: center;
  gap: 4px;
}
.menuName {
  font-weight: 600;
  color: var(--primary-color);
}

/* ── 皮肤商城入口按钮 ── */
.skinEntryBtn {
  border-color: color-mix(in srgb, var(--primary-color, #409eff) 45%, transparent);
  color: var(--primary-color, #409eff);
}
.skinEntryBtn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--primary-color, #409eff) 12%, transparent);
}

/* ── 皮肤商城浮层 ── */
.skinOverlay {
  position: fixed;
  inset: 0;
  z-index: 5000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4vh 4vw;
  background: rgba(15, 23, 42, 0.38);
  backdrop-filter: blur(4px);
}
.skinPanel {
  width: min(1080px, 94vw);
  max-height: 88vh;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 24px 18px;
  border-radius: 18px;
  background: var(--panel-bg, rgba(255, 255, 255, 0.92));
  border: 1px solid var(--border-color-light, #eee);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(18px) saturate(1.2);
  -webkit-backdrop-filter: blur(18px) saturate(1.2);
}
.skinPanelHead {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.skinPanelTitle { font-size: 17px; font-weight: 800; }
.skinPanelSub { font-size: 12px; color: var(--text-muted, #909399); margin-top: 2px; }
.skinClose {
  border: 1px solid var(--border-color, #dcdfe6);
  background: transparent;
  color: var(--text-regular, #606266);
  border-radius: 8px;
  padding: 5px 12px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.16s ease;
}
.skinClose:hover {
  color: #f56c6c;
  border-color: #fbc4c4;
  background: rgba(245, 108, 108, 0.08);
}

.skinGrid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 16px;
}
.skinCard {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid var(--border-color-light, #eee);
  background: var(--panel-bg-2, rgba(0, 0, 0, 0.02));
  transition: border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
}
.skinCard:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md, 0 8px 30px rgba(0, 0, 0, 0.12));
}
.skinCard.active {
  border-color: var(--primary-color, #409eff);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary-color, #409eff) 35%, transparent);
}

/* 皮肤预览示意图 */
.skinPreview {
  height: 130px;
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(0, 0, 0, 0.06);
}
.sp-default { background: linear-gradient(160deg, #eef2f8, #dde5f1); }
.sp-default .spWin { background: rgba(255, 255, 255, 0.94); border: 1px solid #e6eaf0; }
.sp-mac {
  background:
    radial-gradient(240px 140px at 20% 10%, rgba(10, 132, 255, 0.35), transparent 70%),
    linear-gradient(160deg, #cfd9ee, #aebfe0);
}
.sp-mac .spWin {
  background: rgba(248, 249, 252, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

/* Windows 11 预览 */
.sp-win11 { background: linear-gradient(160deg, #e8f0fb, #d7e3f4); }
.sp-win11 .spWin {
  background: rgba(252, 252, 252, 0.94);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 6px;
}
.sp-win11 .spTitleLine { background: #0067c0; }

/* Ubuntu / Linux 预览 */
.sp-linux { background: linear-gradient(160deg, #3a0f2c, #22061a); }
.sp-linux .spWin {
  background: rgba(20, 4, 14, 0.92);
  border: 1px solid rgba(233, 84, 32, 0.5);
  border-radius: 4px;
  box-shadow: 0 0 12px rgba(233, 84, 32, 0.25);
}
.sp-linux .spTitleLine { background: #e95420; }
.sp-linux .spBar { background: rgba(233, 84, 32, 0.25); }
.sp-linux .spLine { background: rgba(255, 255, 255, 0.22); }

/* Windows 95 预览 */
.sp-win95 { background: #008080; }
.sp-win95 .spWin {
  background: #c0c0c0;
  border: 2px solid;
  border-color: #ffffff #808080 #808080 #ffffff;
  border-radius: 0;
  box-shadow: none;
}
.sp-win95 .spTitleLine {
  width: 100%;
  height: 10px;
  background: #000080;
  border-radius: 0;
}
.sp-win95 .spBar { background: #d4d0c8; border-radius: 0; }
.sp-win95 .spLine { background: rgba(0, 0, 0, 0.28); border-radius: 0; }

/* 赛博朋克 2077 预览 */
.sp-cyberpunk {
  background:
    radial-gradient(220px 140px at 18% 6%, rgba(252, 238, 10, 0.35), transparent 70%),
    linear-gradient(160deg, #0e0e1a, #06060c);
}
.sp-cyberpunk .spWin {
  background: rgba(12, 12, 22, 0.9);
  border: 1px solid rgba(0, 240, 255, 0.5);
  border-radius: 2px;
  box-shadow: 0 0 14px rgba(0, 240, 255, 0.35);
}
.sp-cyberpunk .spTitleLine { background: #fcee0a; border-radius: 0; }
.sp-cyberpunk .spBar { background: rgba(252, 238, 10, 0.18); border-radius: 0; }
.sp-cyberpunk .spLine { background: rgba(0, 240, 255, 0.3); border-radius: 0; }

/* 黑客帝国 预览 */
.sp-matrix { background: #000000; }
.sp-matrix .spWin {
  background: rgba(0, 20, 5, 0.9);
  border: 1px solid rgba(0, 255, 65, 0.55);
  border-radius: 2px;
  box-shadow: 0 0 14px rgba(0, 255, 65, 0.3);
}
.sp-matrix .spTitleLine { background: #00ff41; border-radius: 0; }
.sp-matrix .spBar { background: rgba(0, 255, 65, 0.16); border-radius: 0; }
.sp-matrix .spLine { background: rgba(0, 255, 65, 0.28); border-radius: 0; }

/* 金融终端（Bloomberg）预览 */
.sp-bloomberg { background: linear-gradient(160deg, #141414, #050505); }
.sp-bloomberg .spWin {
  background: rgba(18, 18, 18, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-top: 2px solid #ff9e00;
  border-radius: 2px;
  box-shadow: none;
}
.sp-bloomberg .spTitleLine { background: #ff9e00; border-radius: 0; }
.sp-bloomberg .spBar { background: rgba(255, 158, 0, 0.16); border-radius: 0; }
.sp-bloomberg .spLine { background: rgba(255, 255, 255, 0.22); border-radius: 0; }

/* Google 预览 */
.sp-google { background: #ffffff; border-color: #eceff1; }
.sp-google .spWin {
  background: #ffffff;
  border: 1px solid #eceff1;
  border-radius: 16px;
  box-shadow: none;
}
.sp-google .spTitleLine {
  width: 60%;
  background: linear-gradient(90deg, #4285f4 0%, #ea4335 34%, #fbbc05 62%, #34a853 88%);
}
.sp-google .spBar { background: #f1f3f4; border-radius: 999px; }
.sp-google .spLine { background: #dadce0; border-radius: 999px; }

/* Craigslist 预览 */
.sp-craigslist { background: #ffffff; border-color: #cccccc; }
.sp-craigslist .spWin {
  background: #ffffff;
  border: 1px solid #cccccc;
  border-radius: 0;
  box-shadow: none;
}
.sp-craigslist .spTitleLine { width: 40%; background: #0000ee; border-radius: 0; }
.sp-craigslist .spBar { background: #f5f5f5; border-radius: 0; }
.sp-craigslist .spLine { background: rgba(0, 0, 238, 0.45); border-radius: 0; }

/* Wikipedia 预览 */
.sp-wikipedia { background: #f6f6f6; border-color: #c8ccd1; }
.sp-wikipedia .spWin {
  background: #ffffff;
  border: 1px solid #a7d7f9;
  border-radius: 0;
  box-shadow: none;
}
.sp-wikipedia .spTitleLine { width: 52%; background: #202122; border-radius: 0; }
.sp-wikipedia .spBar { background: #f8f9fa; border-radius: 0; }
.sp-wikipedia .spLine { background: #c8ccd1; border-radius: 0; }

/* Reddit 旧版 预览 */
.sp-reddit { background: linear-gradient(180deg, #cee3f8, #b3d4f0); border-color: #9dbfdd; }
.sp-reddit .spWin {
  background: #ffffff;
  border: 1px solid #c6d9e9;
  border-radius: 4px;
  box-shadow: none;
}
.sp-reddit .spTitleLine { width: 44%; height: 10px; background: #336699; border-radius: 2px; }
.sp-reddit .spBar { background: #eff7ff; border-radius: 3px; }
.sp-reddit .spLine { background: #c6d9e9; border-radius: 2px; }
.spWin {
  position: relative;
  width: 74%;
  height: 76%;
  border-radius: 10px;
  padding: 22px 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.16);
}
.spTraffic { position: absolute; top: 7px; left: 10px; display: flex; gap: 5px; }
.spTraffic i { display: block; width: 8px; height: 8px; border-radius: 50%; }
.spTraffic i:nth-child(1) { background: #ff5f57; }
.spTraffic i:nth-child(2) { background: #ffbd2e; }
.spTraffic i:nth-child(3) { background: #28c840; }
.spTitleLine {
  width: 46%;
  height: 8px;
  border-radius: 4px;
  background: var(--primary-color, #409eff);
  opacity: 0.85;
}
.spBar {
  width: 100%;
  height: 20px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--primary-color, #409eff) 22%, transparent);
}
.spLine { width: 90%; height: 6px; border-radius: 3px; background: rgba(120, 130, 145, 0.3); }
.spLine.short { width: 62%; }

.skinInfo { display: flex; flex-direction: column; gap: 4px; }
.skinName { display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 14px; }
.skinTag {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 999px;
  color: var(--primary-color, #409eff);
  background: color-mix(in srgb, var(--primary-color, #409eff) 14%, transparent);
}
.skinDesc { font-size: 12px; color: var(--text-muted, #909399); line-height: 1.5; }

.skinUseBtn {
  margin-top: auto;
  border: none;
  border-radius: 10px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  color: #fff;
  background: var(--primary-color, #409eff);
  transition: all 0.16s ease;
}
.skinUseBtn:hover:not(:disabled) { background: var(--primary-hover, #66b1ff); }
.skinUseBtn:disabled {
  cursor: default;
  background: color-mix(in srgb, var(--primary-color, #409eff) 16%, transparent);
  color: var(--primary-color, #409eff);
}
.skinHint { font-size: 12px; color: var(--text-muted, #909399); }

.skinFade-enter-active, .skinFade-leave-active { transition: opacity 0.2s ease; }
.skinFade-enter-from, .skinFade-leave-to { opacity: 0; }
</style>