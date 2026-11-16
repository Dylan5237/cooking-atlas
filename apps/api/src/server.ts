import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import {PrismaClient} from '@prisma/client'
import {z} from 'zod'
import {randomBytes} from 'node:crypto'
import {env} from './env.js'
import {objectKey,putObject,signedReadUrl} from './storage.js'
import {recommendMeal} from '@cooking-atlas/meal-engine'
import {buildShoppingList} from '@cooking-atlas/shopping-engine'

const prisma=new PrismaClient()
const app=Fastify({logger:true,bodyLimit:2*1024*1024})
await app.register(cors,{origin:env.CORS_ORIGIN==='*'?true:env.CORS_ORIGIN.split(',')})
await app.register(jwt,{secret:env.JWT_SECRET})
await app.register(rateLimit,{max:120,timeWindow:'1 minute'})
await app.register(multipart,{limits:{fileSize:env.MAX_UPLOAD_MB*1024*1024,files:1}})
const idSchema=z.string().min(1)
async function auth(req:any,reply:any){try{await req.jwtVerify()}catch{return reply.code(401).send({error:'UNAUTHORIZED'})}}
function user(req:any){if(!req.user?.id)throw Object.assign(new Error('UNAUTHORIZED'),{statusCode:401});return req.user as {id:string;openid:string}}
async function member(spaceId:string,userId:string){const m=await prisma.familyMembership.findUnique({where:{spaceId_userId:{spaceId,userId}}});if(!m||m.status!=='active')throw Object.assign(new Error('SPACE_FORBIDDEN'),{statusCode:403});return m}
async function owner(spaceId:string,userId:string){const m=await member(spaceId,userId);if(m.role!=='owner')throw Object.assign(new Error('OWNER_REQUIRED'),{statusCode:403});return m}

app.get('/health',async()=>({ok:true,service:'cooking-atlas-api'}))
app.post('/api/auth/wechat',async(req:any,reply)=>{
 const b=z.object({code:z.string().min(1),displayName:z.string().optional()}).parse(req.body)
 if(!env.WECHAT_APP_ID||!env.WECHAT_APP_SECRET)return reply.code(503).send({error:'WECHAT_AUTH_NOT_CONFIGURED'})
 const qs=new URLSearchParams({appid:env.WECHAT_APP_ID,secret:env.WECHAT_APP_SECRET,js_code:b.code,grant_type:'authorization_code'})
 const wx=await fetch('https://api.weixin.qq.com/sns/jscode2session?'+qs),result:any=await wx.json()
 if(!result.openid||result.errcode)return reply.code(401).send({error:'WECHAT_LOGIN_FAILED',detail:result.errmsg})
 const u=await prisma.user.upsert({where:{openid:result.openid},create:{openid:result.openid,displayName:b.displayName},update:b.displayName?{displayName:b.displayName}:{}})
 return{token:app.jwt.sign({id:u.id,openid:u.openid},{expiresIn:'30d'}),user:{id:u.id,displayName:u.displayName}}
})

app.get('/api/uploads/read-url',{preHandler:auth},async(req:any,reply)=>{
 const u=user(req),q=z.object({spaceId:idSchema,key:z.string().min(1)}).parse(req.query)
 await member(q.spaceId,u.id)
 if(!q.key.startsWith('spaces/'+q.spaceId+'/'))return reply.code(403).send({error:'IMAGE_FORBIDDEN'})
 return {url:await signedReadUrl(q.key),expiresIn:300}
})
app.register(async api=>{
 api.addHook('preHandler',auth)
 api.get('/api/me',async(req:any)=>{const u=user(req);return prisma.user.findUnique({where:{id:u.id},select:{id:true,displayName:true,avatarUrl:true,createdAt:true}})})
 api.post('/api/spaces',async(req:any)=>{const u=user(req),b=z.object({name:z.string().min(1).max(40)}).parse(req.body);const s=await prisma.familySpace.create({data:{name:b.name,ownerId:u.id,inviteCode:randomBytes(5).toString('hex').toUpperCase(),memberships:{create:{userId:u.id,role:'owner'}}}});return{id:s.id,name:s.name,inviteCode:s.inviteCode}})
 api.post('/api/spaces/join',async(req:any,reply)=>{const u=user(req),b=z.object({inviteCode:z.string().min(4)}).parse(req.body),s=await prisma.familySpace.findUnique({where:{inviteCode:b.inviteCode.toUpperCase()}});if(!s||s.status!=='active')return reply.code(404).send({error:'INVITE_NOT_FOUND'});await prisma.familyMembership.upsert({where:{spaceId_userId:{spaceId:s.id,userId:u.id}},create:{spaceId:s.id,userId:u.id,role:'member'},update:{status:'active'}});return{id:s.id,name:s.name}})
 api.get('/api/spaces',async(req:any)=>{const u=user(req);return prisma.familyMembership.findMany({where:{userId:u.id,status:'active'},include:{space:{select:{id:true,name:true,ownerId:true}}}})})
 api.get('/api/recipes',async(req:any)=>{const u=user(req),q=z.object({spaceId:idSchema}).parse(req.query);await member(q.spaceId,u.id);return prisma.recipe.findMany({where:{spaceId:q.spaceId,status:'active'},orderBy:{createdAt:'desc'}})})
 api.post('/api/recipes',async(req:any)=>{const u=user(req),b=z.object({spaceId:idSchema,title:z.string().min(1),category:z.string().default('家常菜'),coverKey:z.string().optional(),servings:z.number().int().positive().default(2),cookingMinutes:z.number().int().nonnegative().default(0),difficulty:z.string().default('待补充'),description:z.string().default(''),ingredients:z.array(z.any()),steps:z.array(z.any())}).parse(req.body);await owner(b.spaceId,u.id);return prisma.recipe.create({data:{...b,createdById:u.id}})})
 api.put('/api/recipes/:id',async(req:any)=>{const u=user(req),p=z.object({id:idSchema}).parse(req.params),b=z.object({spaceId:idSchema,title:z.string().min(1),category:z.string(),coverKey:z.string().nullable().optional(),servings:z.number().int().positive(),cookingMinutes:z.number().int().nonnegative(),difficulty:z.string(),description:z.string(),ingredients:z.array(z.any()),steps:z.array(z.any())}).parse(req.body);await owner(b.spaceId,u.id);const old=await prisma.recipe.findFirstOrThrow({where:{id:p.id,spaceId:b.spaceId,status:'active'}});return prisma.recipe.update({where:{id:p.id},data:{...b,version:old.version+1}})})
 api.delete('/api/recipes/:id',async(req:any)=>{const u=user(req),p=z.object({id:idSchema}).parse(req.params),q=z.object({spaceId:idSchema}).parse(req.query);await owner(q.spaceId,u.id);await prisma.recipe.updateMany({where:{id:p.id,spaceId:q.spaceId},data:{status:'deleted'}});return{ok:true}})
 api.post('/api/recipes/:id/favorite',async(req:any)=>{const u=user(req),p=z.object({id:idSchema}).parse(req.params),b=z.object({spaceId:idSchema}).parse(req.body);await member(b.spaceId,u.id);const where={spaceId_userId_recipeId:{spaceId:b.spaceId,userId:u.id,recipeId:p.id}},old=await prisma.recipeFavorite.findUnique({where});if(old){await prisma.recipeFavorite.delete({where:{id:old.id}});return{favorite:false}}await prisma.recipeFavorite.create({data:{spaceId:b.spaceId,userId:u.id,recipeId:p.id}});return{favorite:true}})
 api.get('/api/favorites',async(req:any)=>{const u=user(req),q=z.object({spaceId:idSchema}).parse(req.query);await member(q.spaceId,u.id);return prisma.recipeFavorite.findMany({where:{spaceId:q.spaceId,userId:u.id},include:{recipe:true}})})
 api.post('/api/meal-requests',async(req:any)=>{const u=user(req),b=z.object({spaceId:idSchema,mealDate:z.coerce.date().optional(),mealType:z.enum(['lunch','dinner']),servings:z.number().int().positive(),recipeIds:z.array(z.string()),note:z.string().max(500).default('')}).parse(req.body);await member(b.spaceId,u.id);return prisma.mealRequest.create({data:{...b,userId:u.id,mealDate:b.mealDate||new Date()}})})
 api.get('/api/meal-requests',async(req:any)=>{const u=user(req),q=z.object({spaceId:idSchema}).parse(req.query);await owner(q.spaceId,u.id);return prisma.mealRequest.findMany({where:{spaceId:q.spaceId,status:'submitted'},include:{user:{select:{id:true,displayName:true}}},orderBy:{createdAt:'desc'}})})
 api.post('/api/meal-recommendations',async(req:any)=>{const u=user(req),b=z.object({spaceId:idSchema,servings:z.number().int().positive(),mealType:z.enum(['lunch','dinner']),requestedRecipeIds:z.array(z.string()).default([]),favoriteRecipeIds:z.array(z.string()).default([]),recentRecipeIds:z.array(z.string()).default([]),restrictions:z.array(z.string()).default([])}).parse(req.body);await member(b.spaceId,u.id);const rows=await prisma.recipe.findMany({where:{spaceId:b.spaceId,status:'active'}});const recipes=rows.map(r=>({...r,coverUrl:r.coverKey||'',ingredients:r.ingredients as any,steps:r.steps as any,createdBy:r.createdById,createdAt:r.createdAt.toISOString(),updatedAt:r.updatedAt.toISOString(),source:'manual' as const}));return recommendMeal({recipes,servings:b.servings,mealType:b.mealType,requestedRecipeIds:b.requestedRecipeIds,favoriteRecipeIds:b.favoriteRecipeIds,recentRecipeIds:b.recentRecipeIds,restrictions:b.restrictions,allowNewSuggestions:true})})
 api.post('/api/meal-plans',async(req:any)=>{const u=user(req),b=z.object({spaceId:idSchema,title:z.string().min(1),mealType:z.enum(['lunch','dinner']),servings:z.number().int().positive(),recipeIds:z.array(z.string()).min(1)}).parse(req.body);await owner(b.spaceId,u.id);const rows=await prisma.recipe.findMany({where:{id:{in:b.recipeIds},spaceId:b.spaceId,status:'active'}});if(rows.length!==new Set(b.recipeIds).size)throw Object.assign(new Error('RECIPE_NOT_FOUND'),{statusCode:400});const items=rows.map(r=>({recipeId:r.id,recipeTitle:r.title,servings:r.servings,source:'library',recipeVersion:r.version,snapshotIngredients:r.ingredients}));return prisma.mealPlan.create({data:{spaceId:b.spaceId,title:b.title,mealType:b.mealType,servings:b.servings,status:'confirmed',items,createdById:u.id,confirmedById:u.id,confirmedAt:new Date()}})})
 api.get('/api/meal-plans',async(req:any)=>{const u=user(req),q=z.object({spaceId:idSchema}).parse(req.query);await member(q.spaceId,u.id);return prisma.mealPlan.findMany({where:{spaceId:q.spaceId},orderBy:{createdAt:'desc'}})})
 api.post('/api/meal-plans/:id/shopping-list',async(req:any)=>{const u=user(req),p=z.object({id:idSchema}).parse(req.params),b=z.object({spaceId:idSchema}).parse(req.body);await owner(b.spaceId,u.id);const plan=await prisma.mealPlan.findFirstOrThrow({where:{id:p.id,spaceId:b.spaceId,status:'confirmed'}});const list=buildShoppingList({...plan,items:plan.items as any} as any);return prisma.shoppingList.create({data:{spaceId:b.spaceId,mealPlanId:plan.id,title:list.title,status:'active',items:list.items as any}})})
 api.get('/api/shopping-lists',async(req:any)=>{const u=user(req),q=z.object({spaceId:idSchema}).parse(req.query);await member(q.spaceId,u.id);return prisma.shoppingList.findMany({where:{spaceId:q.spaceId},orderBy:{createdAt:'desc'}})})
 api.patch('/api/shopping-lists/:id/items/:itemId',async(req:any)=>{const u=user(req),p=z.object({id:idSchema,itemId:idSchema}).parse(req.params),b=z.object({spaceId:idSchema,status:z.enum(['needed','have','purchased']),quantity:z.number().nonnegative().nullable().optional()}).parse(req.body);await owner(b.spaceId,u.id);const list=await prisma.shoppingList.findFirstOrThrow({where:{id:p.id,spaceId:b.spaceId}}),items=list.items as any[],item=items.find(x=>x.id===p.itemId);if(!item)throw Object.assign(new Error('ITEM_NOT_FOUND'),{statusCode:404});item.status=b.status;if(b.quantity!==undefined){item.quantity=b.quantity;item.displayQuantity=b.quantity===null?item.unit:String(b.quantity)+item.unit}return prisma.shoppingList.update({where:{id:list.id},data:{items:items as any}})})
 api.post('/api/uploads',async(req:any,reply)=>{const u=user(req),file=await req.file();if(!file)return reply.code(400).send({error:'FILE_REQUIRED'});if(!file.mimetype.startsWith('image/'))return reply.code(415).send({error:'IMAGE_ONLY'});const spaceId=String((file.fields as any).spaceId?.value||'');await member(spaceId,u.id);const key=objectKey(spaceId,file.filename),buffer=await file.toBuffer();await putObject(key,buffer,file.mimetype);return{key,contentType:file.mimetype,size:buffer.length}})
 api.post('/api/ai/recipe-draft',async(req:any,reply)=>{const u=user(req),b=z.object({spaceId:idSchema,text:z.string().default(''),imageKey:z.string().optional()}).parse(req.body);await member(b.spaceId,u.id);if(!env.AI_BASE_URL||!env.AI_API_KEY||!env.AI_MODEL)return reply.code(503).send({error:'AI_PROVIDER_NOT_CONFIGURED'});const content:any[]=[{type:'text',text:b.text||'请根据图片识别菜品并整理菜谱。'}];if(b.imageKey){if(!b.imageKey.startsWith('spaces/'+b.spaceId+'/'))return reply.code(403).send({error:'IMAGE_FORBIDDEN'});content.push({type:'image_url',image_url:{url:await signedReadUrl(b.imageKey)}})}const response=await fetch(env.AI_BASE_URL.replace(/\\/$/,'')+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+env.AI_API_KEY},body:JSON.stringify({model:env.AI_MODEL,temperature:0.2,response_format:{type:'json_object'},messages:[{role:'system',content:'你是家庭菜谱结构化助手。只根据输入提取，不得猜测用量或步骤。未知数量使用 null，未知单位写待补充。输出 JSON：title,category,description,servings,cookingMinutes,difficulty,ingredients[{name,quantity,unit,note}],steps[{content}]。图片不可用于推断精确重量。'},{role:'user',content}]})});if(!response.ok)throw Object.assign(new Error('AI_PROVIDER_ERROR'),{statusCode:502});const data:any=await response.json();return{draft:JSON.parse(data.choices?.[0]?.message?.content||'{}')}})
}, {prefix:''})
app.setErrorHandler((error:any,req,reply)=>{req.log.error(error);reply.code(error.statusCode||400).send({error:error.message||'INTERNAL_ERROR'})})
const close=async()=>{await app.close();await prisma.$disconnect()}
process.on('SIGINT',close);process.on('SIGTERM',close)
await app.listen({host:env.HOST,port:env.PORT})
