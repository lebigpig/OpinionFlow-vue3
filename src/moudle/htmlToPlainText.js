// File: `src/lib/htmlToPlainText.js`
export function htmlToPlainText(input) {
    const s = String(input ?? '')
    if (!s) return ''
    if (!/[<>]/.test(s)) return decodeHtmlEntities(s)

    const withNewlines = s
        .replace(/<\s*br\s*\/?\s*>/gi, '\n')
        .replace(/<\s*\/p\s*>/gi, '\n')
        .replace(/<\s*p(\s+[^>]*)?>/gi, '')
        .replace(/<\s*\/div\s*>/gi, '\n')
        .replace(/<\s*div(\s+[^>]*)?>/gi, '')

    // 浏览器环境：使用 DOM 解析并读取 textContent
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
        const el = document.createElement('div')
        el.innerHTML = withNewlines
        const text = (el.textContent || el.innerText || '').replace(/\u00a0/g, ' ')
        return text
            .replace(/\r\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim()
    }

    // SSR 或非浏览器回退：简单去标签并解码实体
    const stripped = withNewlines.replace(/<\/?[^>]+>/g, '')
    return decodeHtmlEntities(
        stripped.replace(/\u00a0/g, ' ')
            .replace(/\r\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim()
    )
}

export default htmlToPlainText

// 辅助：解码常见 HTML 实体（含数值实体）
function decodeHtmlEntities(str) {
    if (!str || typeof str !== 'string') return ''
    const map = {
        amp: '&',
        lt: '<',
        gt: '>',
        quot: '"',
        apos: "'",
        nbsp: ' ',
    }
    return str.replace(/&(#x[0-9a-fA-F]+|#\d+|\w+);/g, (m, g1) => {
        if (g1[0] === '#') {
            if (g1[1] === 'x' || g1[1] === 'X') {
                return String.fromCharCode(parseInt(g1.slice(2), 16) || 0)
            }
            return String.fromCharCode(parseInt(g1.slice(1), 10) || 0)
        }
        return map[g1] ?? m
    })
}

/*
使用示例（在 `src/App.vue` 中）：
import { htmlToPlainText } from './lib/htmlToPlainText'
...
d.content = htmlToPlainText(d.content)
*/