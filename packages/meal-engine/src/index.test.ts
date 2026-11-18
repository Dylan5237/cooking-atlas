import{describe,it,expect}from'vitest'
import{recommendMeal,dishRole,stapleKind,isStapleRecipe}from'./index'
import type{Recipe}from'@cooking-atlas/shared'

const R=(id:string,title:string,category:string):Recipe=>({
 id,spaceId:'s',title,category,coverUrl:'',servings:2,cookingMinutes:15,difficulty:'简单',
 description:'',ingredients:[{name:`食材${id}`,quantity:1,unit:'份'}],steps:[{content:'做'}],
 createdBy:'u',createdAt:'2026-11-16',updatedAt:'2026-11-16',source:'manual',version:1
})
// 2 荤 2 素 1 汤 2 主食（米饭=配餐、汤面=一餐式）
const POOL:Recipe[]=[
 R('p1','红烧肉','荤菜'),R('p2','清蒸鱼','荤菜'),
 R('v1','西兰花','素菜'),R('v2','凉拌黄瓜','素菜'),
 R('s1','冬瓜排骨汤','汤羹'),
 R('st1','米饭','主食'),R('st2','牛肉汤面','主食'),
]
const base=(over:Partial<Parameters<typeof recommendMeal>[0]>={})=>({
 recipes:POOL,servings:3,mealType:'dinner' as const,favoriteRecipeIds:[],recentRecipeIds:[],
 requestedRecipeIds:[],restrictions:[],allowNewSuggestions:true,...over
})

describe('角色与主食识别（分类优先于标题）',()=>{
 it('主食分类的牛肉汤面是主食，不被标题中的“汤”误判为汤羹',()=>{
  expect(dishRole(POOL[6])).toBe('staple')
  expect(stapleKind(POOL[6])).toBe('meal')
 })
 it('米饭是配餐主食，汤羹分类仍是汤',()=>{
  expect(stapleKind(POOL[5])).toBe('side')
  expect(dishRole(POOL[4])).toBe('soup')
 })
 it('未知分类按标题兜底识别主食',()=>{
  expect(isStapleRecipe(R('x','白粥','其他'))).toBe(true)
  expect(isStapleRecipe(R('x','红烧肉','荤菜'))).toBe(false)
 })
})

describe('主食规则',()=>{
 it('3 人常规家常餐：菜肴按目标数配齐，主食不被菜数上限挤掉',()=>{
  const r=recommendMeal(base({}))
  const staples=r.items.filter(x=>dishRole(x.recipe)==='staple')
  const dishes=r.items.filter(x=>dishRole(x.recipe)!=='staple')
  expect(dishes.length).toBe(4) // 3 人目标 4 道
  expect(staples.length).toBe(1) // 主食位额外保留
 })
 it('2 人常规家常餐也含主食',()=>{
  const r=recommendMeal(base({servings:2}))
  expect(r.items.some(x=>dishRole(x.recipe)==='staple')).toBe(true)
  expect(r.items.filter(x=>dishRole(x.recipe)!=='staple').length).toBe(3)
 })
 it('1 人选择汤面（一餐式主食）：不自动添米饭，配菜不超过 1 道',()=>{
  const r=recommendMeal(base({servings:1,stapleRecipeId:'st2'}))
  const ids=r.items.map(x=>x.recipe.id)
  expect(ids).toContain('st2')
  expect(ids).not.toContain('st1') // 不机械补米饭
  expect(r.items.filter(x=>dishRole(x.recipe)!=='staple').length).toBe(1)
 })
 it('staplePolicy=none（本餐不安排主食）：不纳入任何主食',()=>{
  const r=recommendMeal(base({staplePolicy:'none'}))
  expect(r.items.some(x=>dishRole(x.recipe)==='staple')).toBe(false)
  expect(r.warnings.some(w=>w.includes('主食'))).toBe(false)
 })
 it('无主食候选时提示“这餐还没选主食”，不伪造',()=>{
  const r=recommendMeal(base({recipes:POOL.filter(x=>dishRole(x)!=='staple')}))
  expect(r.items.some(x=>dishRole(x.recipe)==='staple')).toBe(false)
  expect(r.warnings.some(w=>w.includes('还没选主食'))).toBe(true)
 })
 it('家人明确点米饭：换推荐仍保留（requested 保证入组）',()=>{
  const r=recommendMeal(base({requestedRecipeIds:['st1','v1']}))
  const ids=r.items.map(x=>x.recipe.id)
  expect(ids).toContain('st1') // 明确请求的主食必留
  expect(ids).toContain('v1')
  expect(r.items.filter(x=>dishRole(x.recipe)==='staple').length).toBe(1) // 不重复补主食
 })
})

describe('明确请求与既有行为',()=>{
 it('不编造图鉴外的菜',()=>{
  const r=recommendMeal({recipes:[],servings:4,mealType:'dinner',favoriteRecipeIds:[],recentRecipeIds:[],requestedRecipeIds:[],restrictions:[],allowNewSuggestions:true})
  expect(r.items).toHaveLength(0)
  expect(r.newDishSuggestions.length).toBeGreaterThan(0)
 })
 it('requested 超出目标数也全部保留',()=>{
  const r=recommendMeal(base({requestedRecipeIds:['p1','p2','v1','v2','s1']}))
  expect(r.items.length).toBeGreaterThanOrEqual(5)
  ;['p1','p2','v1','v2','s1'].forEach(id=>expect(r.items.map(x=>x.recipe.id)).toContain(id))
 })
 it('与忌口冲突的请求被剔除并具体说明',()=>{
  const r=recommendMeal(base({restrictions:['食材p2'],requestedRecipeIds:['p2']}))
  expect(r.items.map(x=>x.recipe.id)).not.toContain('p2')
  expect(r.warnings.some(w=>w.includes('清蒸鱼')&&w.includes('忌口'))).toBe(true)
 })
 it('recent 惩罚促使换组（有替代时不重复）',()=>{
  const r1=recommendMeal(base({servings:1}))
  const r2=recommendMeal(base({servings:1,recentRecipeIds:r1.items.map(x=>x.recipe.id)}))
  expect(r2.items.map(x=>x.recipe.id)).not.toEqual(r1.items.map(x=>x.recipe.id))
 })
})
