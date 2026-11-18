import type { Ingredient } from '@cooking-atlas/shared'

/**
 * AI 草稿 → 录入表单 的纯映射（不调模型，可用 fixture 单测）。
 * 规则：字段对位，不用步骤冒充心得；未知信息留空待人工核对，不编造。
 */
export type AiDraft = {
  title?: string | null
  category?: string | null
  servings?: number | null
  cookingMinutes?: number | null
  description?: string | null
  ingredients?: { name: string; quantity?: number | null; unit?: string | null }[] | null
  steps?: { content: string }[] | null
}

export type DraftForm = {
  title: string
  category: string
  servings: string
  minutes: string
  ingredientsText: string
  stepsText: string
  note: string
}

const KNOWN_CATS = ['荤菜', '素菜', '汤羹', '主食', '家常菜', '甜品']

export function mapDraftToForm(draft: AiDraft, fallbackTitle = ''): DraftForm {
  const d = draft || {}
  const ingredients = (d.ingredients || [])
    .map(i => `${i.name}：${i.quantity === null || i.quantity === undefined ? '' : i.quantity}${i.unit || ''}`)
    .join('\n')
  const steps = (d.steps || []).map(s => s.content).filter(Boolean).join('\n')
  return {
    title: String(d.title || fallbackTitle || '').trim(),
    category: d.category && KNOWN_CATS.includes(d.category) ? d.category : '家常菜',
    servings: d.servings && d.servings > 0 ? String(d.servings) : '',
    minutes: d.cookingMinutes && d.cookingMinutes > 0 ? String(d.cookingMinutes) : '',
    ingredientsText: ingredients,
    stepsText: steps,
    note: String(d.description || ''),
  }
}

/** 食材文本 → Ingredient：数值+单位可解析则解析，否则数量留空待核对 */
export function parseIngredients(raw: string): Ingredient[] {
  return raw.split('\n').map(x => x.trim()).filter(Boolean).map(x => {
    const parts = x.split(/[：:]/), a = (parts.slice(1).join(':') || '').trim(), m = a.match(/^(\d+(?:\.\d+)?)\s*(.*)$/)
    return { name: parts[0].trim(), quantity: m ? Number(m[1]) : null, unit: m ? (m[2] || '待补充') : (a || '待补充') }
  })
}

/**
 * 原配方份数解析：空/非正数返回 null（保存前必须人工补充，禁止静默默认 2）。
 * AI 草稿未识别份数时 mapper 留空，经此函数把"留空"翻译成"阻止保存"。
 */
export function resolveServingsInput(raw: string): number | null {
  const n = Number(String(raw ?? '').trim())
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null
}
