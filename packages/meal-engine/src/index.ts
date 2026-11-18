import type{Recipe}from'@cooking-atlas/shared'
export type MealInput={
 recipes:Recipe[];servings:number;mealType:'lunch'|'dinner'
 favoriteRecipeIds:string[];recentRecipeIds:string[];requestedRecipeIds:string[];restrictions:string[]
 allowNewSuggestions:boolean
 /** 主食策略：auto=有候选且未安排一餐式主食时自动配一份（默认）；none=用户明确本餐不安排主食 */
 staplePolicy?:'auto'|'none'
 /** 用户在主食选择器中明确选择的主食菜谱 id */
 stapleRecipeId?:string|null
}

/**
 * 分类优先于标题关键词：明确分类的菜不被标题字面误读
 * （「主食」分类的牛肉汤面是主食而非汤羹；「汤羹」分类仍是汤）。
 * 标题关键词仅在分类不属于已知特定分类（荤菜/素菜/汤羹/主食/家常菜/甜品）时兜底。
 */
const KNOWN_CATS=['荤菜','素菜','汤羹','主食','家常菜','甜品']
export function isStapleRecipe(r:Pick<Recipe,'title'|'category'>):boolean{
 if(r.category==='主食')return true
 if(KNOWN_CATS.includes(r.category))return false
 return /饭|面|粉|粥|馒头|饺子/.test(r.title)
}
/** 菜肴结构角色：staple 主食 / soup 汤 / veg 素 / main 荤 */
export function dishRole(r:Pick<Recipe,'title'|'category'>):'main'|'veg'|'soup'|'staple'{
 if(isStapleRecipe(r))return'staple'
 if(r.category==='汤羹'||/汤|羹/.test(r.title))return'soup'
 if(r.category==='素菜'||/素|蔬/.test(r.category))return'veg'
 return'main'
}
/** 主食类型：side 配餐主食（米饭/馒头，搭配菜肴）；meal 一餐式主食（汤面/炒饭/饺子，本身是这餐主体） */
export function stapleKind(r:Pick<Recipe,'title'|'category'>):'side'|'meal'{
 return /面|粉|饺|炒饭|拌饭|盖饭|煲仔/.test(r.title)?'meal':'side'
}

const RECENT_PENALTY=4
export function recommendMeal(x:MealInput){
 const n=Math.max(1,Math.min(20,Math.floor(x.servings||1)))
 const warnings:string[]=[]
 const available=x.recipes.filter(r=>!r.ingredients.some(i=>x.restrictions.some(z=>i.name.includes(z))))

 // 明确请求（家人点菜/手动锁定）保证保留：可用者全部入组，不受菜数上限约束
 const requested=available.filter(r=>x.requestedRecipeIds.includes(r.id))
 const requestedBlocked=x.requestedRecipeIds
  .filter(id=>{const r=x.recipes.find(v=>v.id===id);return r&&!available.some(v=>v.id===id)})
  .map(id=>x.recipes.find(v=>v.id===id)!.title)
 if(requestedBlocked.length)warnings.push(`家人点菜中 ${requestedBlocked.join('、')} 与忌口冲突，本次未纳入。`)

 // 主食意图
 const staplePolicy=x.staplePolicy??'auto'
 let staplePick:Recipe|undefined
 if(x.stapleRecipeId){
  staplePick=available.find(r=>r.id===x.stapleRecipeId)
  if(!staplePick)warnings.push('所选主食不可用（可能已被删除或与忌口冲突），本次未纳入。')
 }
 const requestedStaples=requested.filter(r=>dishRole(r)==='staple')
 const mealMainPicked=requestedStaples.some(r=>stapleKind(r)==='meal')||(staplePick?stapleKind(staplePick)==='meal':false)

 // 菜肴（荤/素/汤）目标数：一餐式主食已是这餐主体时，只配少量菜，不机械补齐
 const dishTarget=mealMainPicked?(n<=2?1:2):(n===1?1:n<=2?3:n<=4?4:n<=6?5:6)

 const score=(r:Recipe)=>(x.requestedRecipeIds.includes(r.id)?8:0)+(x.favoriteRecipeIds.includes(r.id)?5:0)-(x.recentRecipeIds.includes(r.id)?RECENT_PENALTY:0)
 const ordered=[...available].sort((a,b)=>score(b)-score(a))
 const picked:Recipe[]=[...requested]
 const dishCount=()=>picked.filter(r=>dishRole(r)!=='staple').length
 for(const want of(n===1?['main']:['main','veg','soup','main'])as('main'|'veg'|'soup')[]){
  if(dishCount()>=dishTarget)break
  const r=ordered.find(v=>dishRole(v)===want&&!picked.some(p=>p.id===v.id))
  if(r)picked.push(r)
 }
 for(const r of ordered){
  if(dishCount()>=dishTarget)break
  if(dishRole(r)!=='staple'&&!picked.some(p=>p.id===r.id))picked.push(r)
 }
 if(dishCount()<dishTarget&&!mealMainPicked)warnings.push('图鉴菜谱数量有限，未达到建议菜品数量。')

 // 主食位：不计入菜肴上限，不会被普通菜数截断
 let staple=staplePick
 if(!staple&&staplePolicy!=='none'&&!mealMainPicked&&requestedStaples.length===0){
  const side=ordered.find(v=>dishRole(v)==='staple'&&stapleKind(v)==='side'&&!picked.some(p=>p.id===v.id))
  const meal=ordered.find(v=>dishRole(v)==='staple'&&stapleKind(v)==='meal'&&!picked.some(p=>p.id===v.id))
  staple=side||meal
 }
 if(staple&&!picked.some(p=>p.id===staple.id))picked.push(staple)
 const hasStapleItem=picked.some(r=>dishRole(r)==='staple')
 if(staplePolicy!=='none'&&!hasStapleItem&&!mealMainPicked){
  warnings.push(x.recipes.some(isStapleRecipe)
   ?'所选主食与当前忌口冲突，未纳入主食。'
   :'这餐还没选主食：可在点菜页选择主食，或在图鉴录入主食。')
 }
 if(!x.recipes.length)warnings.push('图鉴暂无菜谱，无法推荐已有菜。')

 return{
  items:picked.map(recipe=>({
   recipe,title:recipe.title,source:'library' as const,
   reason:x.requestedRecipeIds.includes(recipe.id)?'响应家人点菜':dishRole(recipe)==='staple'?'搭配主食':x.favoriteRecipeIds.includes(recipe.id)?'符合家庭偏好':'兼顾菜品结构与多样性'
  })),
  warnings,
  newDishSuggestions:x.allowNewSuggestions&&dishCount()<dishTarget&&!mealMainPicked
   ?['可以考虑新增一道时令蔬菜或家常主菜（尚未加入图鉴，需人工确认菜谱）']
   :[]
 }
}
