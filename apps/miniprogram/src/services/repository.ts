import Taro from '@tarojs/taro'
import type{Recipe,MealRequest,MealPlan,ShoppingList,Ingredient}from'@cooking-atlas/shared'
import{demoRecipes}from'../state/demo'
import{recommendMeal}from'@cooking-atlas/meal-engine'
import{buildShoppingList}from'@cooking-atlas/shopping-engine'
import{apiRequest,getActiveSpaceId,getAccessToken}from'./api'

export type CookingLog={id:string;spaceId:string;recipeId:string;mealPlanId?:string|null;cookedAt:string;photos:string[];notes:string;rating?:number|null;createdById:string}
export type Store={recipes:Recipe[];requests:MealRequest[];plan:MealPlan|null;shopping:ShoppingList|null;favoriteIds:string[];cookingLogs:CookingLog[]}
const KEY='cooking-atlas-demo'
const empty:Store={recipes:[],requests:[],plan:null,shopping:null,favoriteIds:[],cookingLogs:[]}
// 演示模式从空菜单开始：点菜→确认→采购的完整流程由本地引擎跑通并持久化
const demoInitial:Store={...empty,recipes:demoRecipes}

export function isDemoMode(){return process.env.TARO_APP_DEMO_MODE==='true'}

// ---------- 服务端行 → 领域类型映射（身份/时间以服务端为准） ----------
function mapRecipe(r:any):Recipe{
 return{id:r.id,spaceId:r.spaceId,title:r.title,category:r.category,coverUrl:'',coverKey:r.coverKey??undefined,servings:r.servings,cookingMinutes:r.cookingMinutes,difficulty:r.difficulty,description:r.description,ingredients:(r.ingredients||[]) as Ingredient[],steps:r.steps||[],createdBy:r.createdById,createdAt:typeof r.createdAt==='string'?r.createdAt:new Date(r.createdAt).toISOString(),updatedAt:typeof r.updatedAt==='string'?r.updatedAt:new Date(r.updatedAt).toISOString(),source:'manual',version:r.version}
}
function mapRequest(r:any):MealRequest{
 return{id:r.id,spaceId:r.spaceId,memberId:r.userId,mealDate:typeof r.mealDate==='string'?r.mealDate:new Date(r.mealDate).toISOString(),mealType:r.mealType,servings:r.servings,recipeIds:r.recipeIds||[],note:r.note||'',status:r.status,createdAt:typeof r.createdAt==='string'?r.createdAt:new Date(r.createdAt).toISOString()}
}
function mapPlan(p:any):MealPlan{
 return{id:p.id,spaceId:p.spaceId,title:p.title,mealType:p.mealType,servings:p.servings,status:p.status,items:(p.items||[]).map((x:any)=>({recipeId:x.recipeId,recipeTitle:x.recipeTitle,servings:x.servings,source:x.source,snapshotIngredients:x.snapshotIngredients||[],suggestionNote:x.suggestionNote,recipeVersion:x.recipeVersion})),createdAt:typeof p.createdAt==='string'?p.createdAt:new Date(p.createdAt).toISOString(),confirmedAt:p.confirmedAt?(typeof p.confirmedAt==='string'?p.confirmedAt:new Date(p.confirmedAt).toISOString()):undefined}
}
function mapList(l:any):ShoppingList{
 return{id:l.id,spaceId:l.spaceId,mealPlanId:l.mealPlanId,title:l.title,status:l.status,items:l.items||[],createdAt:typeof l.createdAt==='string'?l.createdAt:new Date(l.createdAt).toISOString(),updatedAt:typeof l.updatedAt==='string'?l.updatedAt:new Date(l.updatedAt).toISOString()}
}
function mapLog(l:any):CookingLog{
 return{id:l.id,spaceId:l.spaceId,recipeId:l.recipeId,mealPlanId:l.mealPlanId,cookedAt:typeof l.cookedAt==='string'?l.cookedAt:new Date(l.cookedAt).toISOString(),photos:l.photos||[],notes:l.notes||'',rating:l.rating,createdById:l.createdById}
}

// ---------- 内存缓存：同步读（UI 渲染），异步刷新（bootstrap/写后） ----------
let cache:Store=isDemoMode()?readDemo():empty
function readDemo():Store{try{return Taro.getStorageSync(KEY)||demoInitial}catch{return demoInitial}}
function writeDemo(s:Store){Taro.setStorageSync(KEY,s);return s}
function spaceId(){const id=getActiveSpaceId();if(!id)throw new Error('NO_ACTIVE_SPACE');return id}

export const repository={
 getStore():Store{return cache},

 /** 从 API 全量刷新当前空间数据；未登录/无空间时保持空缓存 */
 async refresh():Promise<Store>{
  if(isDemoMode()){cache=readDemo();return cache}
  if(!getAccessToken()||!getActiveSpaceId()){cache=empty;return cache}
  const sid=spaceId()
  const[recipes,plans,lists,favorites,logs]=await Promise.all([
   apiRequest<any[]>('/api/recipes?spaceId='+encodeURIComponent(sid)),
   apiRequest<any[]>('/api/meal-plans?spaceId='+encodeURIComponent(sid)),
   apiRequest<any[]>('/api/shopping-lists?spaceId='+encodeURIComponent(sid)),
   apiRequest<any[]>('/api/favorites?spaceId='+encodeURIComponent(sid)),
   apiRequest<any[]>('/api/cooking-logs?spaceId='+encodeURIComponent(sid))
  ])
  const mappedPlans=plans.map(mapPlan)
  const mappedLists=lists.map(mapList)
  cache={
   recipes:recipes.map(mapRecipe),
   requests:cache.requests,
   plan:mappedPlans.find(p=>p.status==='confirmed')||mappedPlans[0]||null,
   shopping:mappedLists[0]||null,
   favoriteIds:favorites.map((f:any)=>f.recipeId),
   cookingLogs:logs.map(mapLog)
  }
  return cache
 },

 /** owner 汇总点菜请求（仅 owner 可调用，member 调用会 403） */
 async refreshRequests():Promise<MealRequest[]>{
  if(isDemoMode())return cache.requests
  const rows=await apiRequest<any[]>('/api/meal-requests?spaceId='+encodeURIComponent(spaceId()))
  cache={...cache,requests:rows.map(mapRequest)}
  return cache.requests
 },

 async createRecipe(input:{title:string;category?:string;coverUrl?:string;coverKey?:string;servings?:number;cookingMinutes?:number;difficulty?:string;description?:string;ingredients:Ingredient[];steps:{content:string}[]}):Promise<Recipe>{
  const now=new Date().toISOString()
  if(isDemoMode()){
   // 演示模式本地可写（localStorage 持久化）；成品照存 dataURL，不上传
   const recipe:Recipe={id:'d'+Date.now().toString(36),spaceId:'family-demo',title:input.title,category:input.category||'家常菜',coverUrl:input.coverUrl||'',coverKey:undefined,servings:input.servings||2,cookingMinutes:input.cookingMinutes||0,difficulty:input.difficulty||'待补充',description:input.description||'',ingredients:input.ingredients,steps:input.steps,createdBy:'demo',createdAt:now,updatedAt:now,source:'manual',version:1}
   cache={...cache,recipes:[recipe,...cache.recipes]};writeDemo(cache);return recipe
  }
  const r=await apiRequest<any>('/api/recipes','POST',{spaceId:spaceId(),...input})
  const recipe=mapRecipe(r)
  cache={...cache,recipes:[recipe,...cache.recipes]}
  return recipe
 },

 async updateRecipe(id:string,input:{title:string;category:string;coverKey?:string|null;coverUrl?:string;servings:number;cookingMinutes:number;difficulty:string;description?:string;ingredients:Ingredient[];steps:{content:string}[]}):Promise<Recipe>{
  if(isDemoMode()){
   const old=cache.recipes.find(x=>x.id===id);if(!old)throw new Error('RECIPE_NOT_FOUND')
   const recipe:Recipe={...old,...input,coverUrl:input.coverUrl??old.coverUrl,updatedAt:new Date().toISOString(),version:(old.version||1)+1}
   cache={...cache,recipes:cache.recipes.map(x=>x.id===id?recipe:x)};writeDemo(cache);return recipe
  }
  const r=await apiRequest<any>('/api/recipes/'+id,'PUT',{spaceId:spaceId(),...input})
  const recipe=mapRecipe(r)
  cache={...cache,recipes:cache.recipes.map(x=>x.id===id?recipe:x)}
  return recipe
 },

 async deleteRecipe(id:string):Promise<void>{
  if(isDemoMode())throw new Error('DEMO_MODE_READONLY')
  await apiRequest('/api/recipes/'+id+'?spaceId='+encodeURIComponent(spaceId()),'DELETE')
  cache={...cache,recipes:cache.recipes.filter(x=>x.id!==id)}
 },

 async toggleFavorite(recipeId:string):Promise<boolean>{
  if(isDemoMode()){
   const has=cache.favoriteIds.includes(recipeId)
   cache={...cache,favoriteIds:has?cache.favoriteIds.filter(x=>x!==recipeId):[...cache.favoriteIds,recipeId]}
   writeDemo(cache);return !has
  }
  const r=await apiRequest<{favorite:boolean}>('/api/recipes/'+recipeId+'/favorite','POST',{spaceId:spaceId()})
  cache={...cache,favoriteIds:r.favorite?[...cache.favoriteIds,recipeId]:cache.favoriteIds.filter(x=>x!==recipeId)}
  return r.favorite
 },

 async submitMealRequest(input:{mealType:'lunch'|'dinner';servings:number;recipeIds:string[];note?:string}):Promise<MealRequest>{
  if(isDemoMode()){
   const req:MealRequest={id:'q'+Date.now().toString(36),spaceId:'family-demo',memberId:'demo-member',mealDate:new Date().toISOString(),mealType:input.mealType,servings:input.servings,recipeIds:input.recipeIds,note:input.note||'',status:'pending',createdAt:new Date().toISOString()}
   cache={...cache,requests:[req,...cache.requests]};writeDemo(cache);return req
  }
  const r=await apiRequest<any>('/api/meal-requests','POST',{spaceId:spaceId(),...input})
  const req=mapRequest(r)
  cache={...cache,requests:[req,...cache.requests]}
  return req
 },

 async recommend(input:{servings:number;mealType:'lunch'|'dinner';requestedRecipeIds?:string[];restrictions?:string[]}){
  if(isDemoMode()){
   // 演示模式用本地配餐引擎（与服务端同一套规则），不冒充 AI
   const rec=recommendMeal({recipes:cache.recipes,servings:input.servings,mealType:input.mealType,favoriteRecipeIds:cache.favoriteIds,recentRecipeIds:cache.cookingLogs.slice(0,5).map(l=>l.recipeId),requestedRecipeIds:input.requestedRecipeIds||[],restrictions:[],allowNewSuggestions:true})
   return{items:rec.items.map(x=>({recipeId:x.recipe.id,title:x.title,source:x.source,servings:input.servings,snapshotIngredients:x.recipe.ingredients,recipeVersion:x.recipe.version||1,reason:x.reason})),warnings:rec.warnings,newDishSuggestions:rec.newDishSuggestions}
  }
  return apiRequest<{items:{recipeId:string;title:string;source:string;servings:number;snapshotIngredients:Ingredient[];recipeVersion:number;reason:string}[];warnings:string[];newDishSuggestions:string[]}>('/api/meal-recommendations','POST',{spaceId:spaceId(),favoriteRecipeIds:cache.favoriteIds,...input})
 },

 /** owner 确认菜单：服务端依据菜谱构建快照与版本，客户端只传 recipeIds；portions 仅演示模式生效 */
 async confirmPlan(input:{title:string;mealType:'lunch'|'dinner';servings:number;recipeIds:string[];portions?:Record<string,number>}):Promise<MealPlan>{
  if(isDemoMode()){
   const now=new Date().toISOString()
   const items=input.recipeIds.map(id=>{
    const r=cache.recipes.find(x=>x.id===id)
    const planned=input.portions?.[id]||input.servings
    const origin=r?.servings||2
    // 与服务端一致：快照为原配方用量；每道菜计划份数按 planned/origin 预缩放进快照，
    // item.servings 对齐 plan.servings，让 buildShoppingList 得出该道菜的实际用量
    const scale=planned/origin
    const snapshot=(r?.ingredients||[]).map(i=>i.quantity===null||i.quantity===undefined?i:{...i,quantity:Number((i.quantity*scale).toFixed(2))})
    return{recipeId:id,recipeTitle:r?.title||'已删除菜谱',servings:input.servings,source:'library',snapshotIngredients:snapshot,recipeVersion:r?.version||1}
   })
   const plan:MealPlan={id:'p'+Date.now().toString(36),spaceId:'family-demo',title:input.title,mealType:input.mealType,servings:input.servings,status:'confirmed',items,createdAt:now,confirmedAt:now}
   cache={...cache,plan};writeDemo(cache);return plan
  }
  const p=await apiRequest<any>('/api/meal-plans','POST',{spaceId:spaceId(),...input})
  const plan=mapPlan(p)
  cache={...cache,plan}
  return plan
 },

 async generateShopping(planId:string):Promise<ShoppingList>{
  if(isDemoMode()){
   const plan=cache.plan&&cache.plan.id===planId?cache.plan:null
   if(!plan)throw new Error('PLAN_NOT_FOUND')
   const list=buildShoppingList(plan)
   cache={...cache,shopping:list};writeDemo(cache);return list
  }
  const l=await apiRequest<any>('/api/meal-plans/'+planId+'/shopping-list','POST',{spaceId:spaceId()})
  const list=mapList(l)
  cache={...cache,shopping:list}
  return list
 },

 async updateShoppingItem(itemId:string,patch:{status:'needed'|'have'|'purchased';quantity?:number|null}):Promise<ShoppingList>{
  if(isDemoMode()){
   if(!cache.shopping)throw new Error('NO_SHOPPING_LIST')
   const list:ShoppingList={...cache.shopping,items:cache.shopping.items.map(i=>i.id===itemId?{...i,...patch}:i),updatedAt:new Date().toISOString()}
   cache={...cache,shopping:list};writeDemo(cache);return list
  }
  const l=await apiRequest<any>('/api/shopping-lists/'+cache.shopping!.id+'/items/'+itemId,'PATCH',{spaceId:spaceId(),...patch})
  const list=mapList(l)
  cache={...cache,shopping:list}
  return list
 },

 /** owner 编辑已确认菜单：服务端重建快照并差异同步采购清单 */
 async updatePlan(planId:string,input:{title:string;servings:number;recipeIds:string[]}):Promise<MealPlan>{
  if(isDemoMode())throw new Error('DEMO_MODE_READONLY')
  const p=await apiRequest<any>('/api/meal-plans/'+planId,'PUT',{spaceId:spaceId(),...input})
  const plan=mapPlan(p)
  cache={...cache,plan}
  await this.refresh()
  return plan
 },

 async addCookingLog(input:{recipeId:string;mealPlanId?:string;notes?:string;rating?:number;photos?:string[]}):Promise<CookingLog>{
  if(isDemoMode()){
   const log:CookingLog={id:'l'+Date.now().toString(36),spaceId:'family-demo',recipeId:input.recipeId,mealPlanId:input.mealPlanId||null,cookedAt:new Date().toISOString(),photos:input.photos||[],notes:input.notes||'',rating:input.rating,createdById:'demo'}
   cache={...cache,cookingLogs:[log,...cache.cookingLogs]};writeDemo(cache);return log
  }
  const l=await apiRequest<any>('/api/cooking-logs','POST',{spaceId:spaceId(),...input})
  const log=mapLog(l)
  cache={...cache,cookingLogs:[log,...cache.cookingLogs]}
  return log
 }
}