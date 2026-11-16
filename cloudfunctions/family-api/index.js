const cloud=require('wx-server-sdk')
cloud.init({env:cloud.DYNAMIC_CURRENT_ENV})
const db=cloud.database()
const now=()=>new Date()
const code=()=>Math.random().toString(36).slice(2,8).toUpperCase()
async function membership(spaceId,openid){const r=await db.collection('family_memberships').where({spaceId,openid,status:'active'}).get();return r.data[0]||null}
async function owner(spaceId,openid){const m=await membership(spaceId,openid);if(!m||m.role!=='owner')throw new Error('OWNER_REQUIRED');return m}
exports.main=async(event)=>{
 const {OPENID}=cloud.getWXContext();if(!OPENID)throw new Error('UNAUTHENTICATED')
 const {action}=event||{}
 if(action==='createSpace'){
  const inviteCode=code(),space={name:event.name||'我们的餐桌',ownerOpenid:OPENID,inviteCode,status:'active',createdAt:now()}
  const s=await db.collection('family_spaces').add({data:space})
  await db.collection('family_memberships').add({data:{spaceId:s._id,openid:OPENID,displayName:event.displayName||'掌勺者',role:'owner',status:'active',joinedAt:now()}})
  return{spaceId:s._id,inviteCode}
 }
 if(action==='joinSpace'){
  const q=await db.collection('family_spaces').where({inviteCode:event.inviteCode,status:'active'}).get()
  if(!q.data.length)throw new Error('INVALID_INVITE_CODE')
  const space=q.data[0],existing=await membership(space._id,OPENID)
  if(!existing)await db.collection('family_memberships').add({data:{spaceId:space._id,openid:OPENID,displayName:event.displayName||'家庭成员',role:'member',status:'active',joinedAt:now()}})
  return{spaceId:space._id,name:space.name}
 }
 const spaceId=event.spaceId;if(!spaceId)throw new Error('SPACE_REQUIRED')
 const m=await membership(spaceId,OPENID);if(!m)throw new Error('FORBIDDEN')
 if(action==='listRecipes'){const r=await db.collection('recipes').where({spaceId,status:'active'}).orderBy('createdAt','desc').limit(200).get();return{items:r.data}}
 if(action==='saveRecipe'){await owner(spaceId,OPENID);const data={...event.recipe,spaceId,createdBy:OPENID,status:'active',updatedAt:now()};delete data._id;if(event.recipeId){await db.collection('recipes').doc(event.recipeId).update({data});return{id:event.recipeId}}const r=await db.collection('recipes').add({data:{...data,createdAt:now(),version:1}});return{id:r._id}}
 if(action==='deleteRecipe'){await owner(spaceId,OPENID);await db.collection('recipes').doc(event.recipeId).update({data:{status:'deleted',updatedAt:now()}});return{success:true}}
 if(action==='toggleFavorite'){const q=await db.collection('recipe_favorites').where({spaceId,openid:OPENID,recipeId:event.recipeId}).get();if(q.data.length){await db.collection('recipe_favorites').doc(q.data[0]._id).remove();return{favorite:false}}await db.collection('recipe_favorites').add({data:{spaceId,openid:OPENID,recipeId:event.recipeId,createdAt:now()}});return{favorite:true}}
 if(action==='submitMealRequest'){const r=await db.collection('meal_requests').add({data:{spaceId,openid:OPENID,mealDate:event.mealDate||now(),mealType:event.mealType||'dinner',servings:Math.max(1,event.servings||1),recipeIds:event.recipeIds||[],note:event.note||'',status:'submitted',createdAt:now()}});return{id:r._id}}
 if(action==='listMealRequests'){await owner(spaceId,OPENID);const r=await db.collection('meal_requests').where({spaceId,status:'submitted'}).orderBy('createdAt','desc').limit(100).get();return{items:r.data}}
 if(action==='confirmMealPlan'){await owner(spaceId,OPENID);if(!Array.isArray(event.items)||!event.items.length)throw new Error('PLAN_ITEMS_REQUIRED');const p={spaceId,title:event.title||'家庭菜单',mealType:event.mealType||'dinner',servings:event.servings||2,status:'confirmed',items:event.items,createdBy:OPENID,confirmedBy:OPENID,createdAt:now(),confirmedAt:now()};const r=await db.collection('meal_plans').add({data:p});return{id:r._id,...p}}
 if(action==='updateShoppingItem'){await owner(spaceId,OPENID);const list=await db.collection('shopping_lists').doc(event.listId).get();if(list.data.spaceId!==spaceId)throw new Error('FORBIDDEN');const items=list.data.items||[];const item=items.find(x=>x.id===event.itemId);if(!item)throw new Error('ITEM_NOT_FOUND');if(!['needed','have','purchased'].includes(event.status))throw new Error('INVALID_STATUS');item.status=event.status;await db.collection('shopping_lists').doc(event.listId).update({data:{items,updatedAt:now()}});return{success:true}}
 throw new Error('UNKNOWN_ACTION')
}
