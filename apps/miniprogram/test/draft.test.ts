/**
 * AI 草稿映射 + 换组推荐 纯函数测试：
 * 用结构化响应 fixture 验证「生成 → 核对 → 保存」的字段映射，不调用付费模型。
 */
import {describe, it, expect} from 'vitest'
import {mapDraftToForm, parseIngredients, resolveServingsInput} from '../src/services/draft'

const fixture = {
  title: '葱油拌面',
  category: '主食',
  servings: 4,
  cookingMinutes: 25,
  description: '葱香浓郁。',
  ingredients: [
    {name: '面条', quantity: 300, unit: 'g'},
    {name: '小葱', quantity: 50, unit: 'g'},
    {name: '生抽', quantity: null, unit: '适量'},
  ],
  steps: [{content: '熬葱油至焦香。'}, {content: '面条煮熟捞出，淋葱油拌匀。'}],
}

describe('mapDraftToForm（字段对位，未知留空）', () => {
  it('步骤进步骤、心得进心得，份数/分钟/分类齐备', () => {
    const f = mapDraftToForm(fixture)
    expect(f.title).toBe('葱油拌面')
    expect(f.category).toBe('主食')
    expect(f.servings).toBe('4')
    expect(f.minutes).toBe('25')
    expect(f.stepsText).toBe('熬葱油至焦香。\n面条煮熟捞出，淋葱油拌匀。')
    expect(f.note).toBe('葱香浓郁。')
    expect(f.ingredientsText).toContain('面条：300g')
    expect(f.ingredientsText).toContain('生抽：适量')
  })
  it('字段缺失时留空待核对，不用步骤冒充心得', () => {
    const f = mapDraftToForm({steps: [{content: '只有一步'}]})
    expect(f.title).toBe('')
    expect(f.category).toBe('家常菜')
    expect(f.servings).toBe('')
    expect(f.minutes).toBe('')
    expect(f.note).toBe('')
    expect(f.stepsText).toBe('只有一步')
  })
  it('未识别分类回退家常菜，标题回退用户输入', () => {
    const f = mapDraftToForm({title: '', category: '异国料理'}, '手写菜名')
    expect(f.title).toBe('手写菜名')
    expect(f.category).toBe('家常菜')
  })
})

describe('parseIngredients（草稿→保存载荷）', () => {
  it('数值+单位解析，适量保留为空数量', () => {
    const list = parseIngredients('面条：300g\n小葱：50 g\n盐：适量')
    expect(list[0]).toEqual({name: '面条', quantity: 300, unit: 'g'})
    expect(list[1]).toEqual({name: '小葱', quantity: 50, unit: 'g'})
    expect(list[2]).toEqual({name: '盐', quantity: null, unit: '适量'})
  })
  it('fixture 全链路：草稿表单 → 食材载荷可解析', () => {
    const f = mapDraftToForm(fixture)
    const list = parseIngredients(f.ingredientsText)
    expect(list).toHaveLength(3)
    expect(list.find(i => i.name === '面条')!.quantity).toBe(300)
  })
})

describe('resolveServingsInput（保存前的份数校验）', () => {
  it('空/非正数返回 null，保存必须阻止而不是默认 2', () => {
    expect(resolveServingsInput('')).toBeNull()
    expect(resolveServingsInput('  ')).toBeNull()
    expect(resolveServingsInput('abc')).toBeNull()
    expect(resolveServingsInput('0')).toBeNull()
    expect(resolveServingsInput('-3')).toBeNull()
  })
  it('合法份数取整返回', () => {
    expect(resolveServingsInput('2')).toBe(2)
    expect(resolveServingsInput('4')).toBe(4)
    expect(resolveServingsInput('2.9')).toBe(2)
  })
  it('AI 未知份数全链路：mapper 留空 → resolve null → 保存被阻止（不静默变 2）', () => {
    const f = mapDraftToForm({title: '未知份数菜', steps: [{content: '一步'}]})  // servings 未返回
    expect(f.servings).toBe('')
    expect(resolveServingsInput(f.servings)).toBeNull()
  })
})
