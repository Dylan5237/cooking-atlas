// 无成品照时的示意封面映射：按分类/关键词选择示意插画（PNG，位于 src/assets）。
// 明确是示意图，不冒充用户成品照。
import eggs from '../assets/eggs.png'
import greens from '../assets/greens.png'
import noodles from '../assets/noodles.png'
import pork from '../assets/pork.png'
import soup from '../assets/soup.png'

const byCategory: Record<string, string> = {
  '荤菜': pork,
  '素菜': greens,
  '汤羹': soup,
  '主食': noodles,
  '家常菜': eggs,
  '甜品': eggs,
}

export function fallbackCover(title: string, category?: string): string {
  if (category && byCategory[category]) return byCategory[category]
  if (/面|粉|饭|饺|饼/.test(title)) return noodles
  if (/汤|羹/.test(title)) return soup
  if (/肉|排骨|鸡|鱼|牛|虾/.test(title)) return pork
  if (/菜|笋|瓜|豆/.test(title)) return greens
  return eggs
}

export const coverAssets = { eggs, greens, noodles, pork, soup }
