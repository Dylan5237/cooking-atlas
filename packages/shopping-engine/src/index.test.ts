import{describe,it,expect}from'vitest';import{buildShoppingList}from'./index';describe('shopping engine',()=>{
 it('scales and merges ingredients by name and unit',()=>{const p:any={id:'p',spaceId:'s',title:'晚餐',servings:4,items:[{recipeId:'a',servings:2,snapshotIngredients:[{name:'番茄',quantity:2,unit:'个'}]},{recipeId:'b',servings:2,snapshotIngredients:[{name:'番茄',quantity:1,unit:'个'}]}]};const l=buildShoppingList(p);expect(l.items).toHaveLength(1);expect(l.items[0].quantity).toBe(6)})
 it('按每项计划份数换算：排骨 500g/原 4 人份/计划 2 人份 = 250g',()=>{
  const p:any={id:'p',spaceId:'s',title:'晚餐',servings:3,items:[{recipeId:'a',servings:4,plannedServings:2,snapshotIngredients:[{name:'排骨',quantity:500,unit:'g'}]}]}
  const l=buildShoppingList(p);expect(l.items[0].quantity).toBe(250);expect(l.items[0].displayQuantity).toBe('250g')
 })
 it('缺省 plannedServings 时沿用整桌 plan.servings（向后兼容）',()=>{
  const p:any={id:'p',spaceId:'s',title:'晚餐',servings:3,items:[{recipeId:'a',servings:4,snapshotIngredients:[{name:'排骨',quantity:500,unit:'g'}]}]}
  expect(buildShoppingList(p).items[0].quantity).toBe(375)
 })
 it('计划份数混合时同食材分别缩放后合并；主食独立计价（大米 150g/2 人份×3 人份=225g）',()=>{
  const p:any={id:'p',spaceId:'s',title:'晚餐',servings:3,items:[
   {recipeId:'a',servings:2,plannedServings:3,snapshotIngredients:[{name:'大米',quantity:150,unit:'g'}]},
   {recipeId:'b',servings:2,plannedServings:3,snapshotIngredients:[{name:'鸡蛋',quantity:3,unit:'个'}]}
  ]}
  const l=buildShoppingList(p)
  expect(l.items.find(i=>i.name==='大米')!.quantity).toBe(225)
  expect(l.items.find(i=>i.name==='鸡蛋')!.quantity).toBe(4.5)
 })
 it('未知用量保持 null 并原样展示，不伪造数值',()=>{
  const p:any={id:'p',spaceId:'s',title:'晚餐',servings:2,items:[{recipeId:'a',servings:2,plannedServings:1,snapshotIngredients:[{name:'盐',quantity:null,unit:'适量'}]}]}
  const item=buildShoppingList(p).items[0]
  expect(item.quantity).toBeNull();expect(item.displayQuantity).toBe('适量')
 })
})
