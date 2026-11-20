import { View } from '@tarojs/components'

/**
 * 统一圆润图标集（v2 修订）：底部导航四枚沿用 prototype/warm-cards/assets/icons 原稿，
 * 操作小图标按同一气质补齐。全部 data-URI SVG，H5 与小程序编译均可用。
 * 不与系统 Emoji 混用；搜索/关闭/加减等常规符号仍用文本。
 */
const BODIES: Record<string, string> = {
  // 导航四枚：菜谱册 / 餐碗 / 采购袋 / 围裙（原型原稿）
  atlas: '<path fill="#dcead9" d="M5 3.5c4-.9 8.4-.8 13 .1l.2 16.8c-4.3-.8-8.6-.8-13 .1Z"/><path d="M5 3.5c4-.9 8.4-.8 13 .1l.2 16.8c-4.3-.8-8.6-.8-13 .1ZM8 4v16"/><path stroke="#b36850" d="m11 8 4 .2m-4 3.2 3-.1"/>',
  plate: '<path fill="#dcead9" d="M3.8 12c.9 5.1 3.5 7.5 8.2 7.5s7.3-2.4 8.2-7.5Z"/><path d="M3.8 12c.9 5.1 3.5 7.5 8.2 7.5s7.3-2.4 8.2-7.5M3.5 12h17M9 20h6"/><path stroke="#b36850" d="m14 4-5 7m9-6-5 6"/>',
  bag: '<path fill="#f3d3bc" d="m5 8-1 9.3c-.2 2.7 2.2 3.1 8 3.1s8.2-.4 8-3.1L19 8Z"/><path d="m5 8-1 9.3c-.2 2.7 2.2 3.1 8 3.1s8.2-.4 8-3.1L19 8ZM8 9V7a4 4 0 0 1 8 0v2"/><path stroke="#b36850" d="m9 15 1.8 1.8 4-4.2"/>',
  apron: '<path fill="#dcead9" d="M8.5 8h7c.1 4 1.4 6 3 7.1V21h-13v-5.9C7.1 14 8.4 12 8.5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2M8.5 8h7c.1 4 1.4 6 3 7.1V21h-13v-5.9C7.1 14 8.4 12 8.5 8Z"/><path stroke="#b36850" d="M9 15h6v3H9Z"/>',
  // 操作小图标
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  heart: '<path d="M12 20S3 14.5 3 8.5c0-5 6.6-5.4 9-.9 2.4-4.5 9-4.1 9 .9 0 6-9 11.5-9 11.5Z"/>',
  'heart-on': '<path fill="#dd765d" stroke="#dd765d" d="M12 20S3 14.5 3 8.5c0-5 6.6-5.4 9-.9 2.4-4.5 9-4.1 9 .9 0 6-9 11.5-9 11.5Z"/>',
  shuffle: '<path d="M5 8a7.5 7.5 0 0 1 13-2l2 2M20 4v4h-4M19 16a7.5 7.5 0 0 1-13 2l-2-2M4 20v-4h4"/>',
  camera: '<rect x="3" y="6" width="18" height="14" rx="4"/><path d="m8 6 2-3h4l2 3"/><circle cx="12" cy="13" r="4"/>',
  home: '<path fill="#fffdf7" d="m5 11 7-6.5 7 6.5V20h-5v-5h-4v5H5Z"/><path d="m5 11 7-6.5 7 6.5V20h-5v-5h-4v5H5Z"/>',
  next: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
}

export type IconName = keyof typeof BODIES

function svgUri(body: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#254b42" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

const cache: Record<string, string> = {}
export default function Icon({ name, size = 24, className = '' }: {
  name: IconName | string
  size?: number
  className?: string
}) {
  if (!cache[name]) cache[name] = svgUri(BODIES[name] || '')
  return <View
    className={`icon ${className}`}
    style={{ width: `${size}px`, height: `${size}px`, backgroundImage: cache[name], backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat' }}
  />
}
