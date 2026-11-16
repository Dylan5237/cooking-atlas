import Taro from '@tarojs/taro'
const TOKEN_KEY='cooking-atlas-access-token'
const SPACE_KEY='cooking-atlas-active-space'
const BASE=(process.env.TARO_APP_API_BASE_URL||'http://127.0.0.1:3001').replace(/\/$/,'')
export type ApiMethod='GET'|'POST'|'PUT'|'PATCH'|'DELETE'
export function getAccessToken(){return Taro.getStorageSync(TOKEN_KEY)||''}
export function clearAccessToken(){Taro.removeStorageSync(TOKEN_KEY)}
export function setActiveSpaceId(id:string){Taro.setStorageSync(SPACE_KEY,id)}
export function getActiveSpaceId(){return Taro.getStorageSync(SPACE_KEY)||''}
export function apiBaseUrl(){return BASE}

export async function apiRequest<T>(path:string,method:ApiMethod='GET',data?:unknown):Promise<T>{
 const token=getAccessToken()
 const res=await Taro.request({url:BASE+path,method,data,header:{'content-type':'application/json',...(token?{Authorization:'Bearer '+token}:{})}})
 if(res.statusCode===401){clearAccessToken();throw Object.assign(new Error('UNAUTHORIZED'),{statusCode:401})}
 if(res.statusCode<200||res.statusCode>=300){const body:any=res.data;throw Object.assign(new Error(body?.error||('API_REQUEST_FAILED_'+res.statusCode)),{statusCode:res.statusCode})}
 return res.data as T
}

export async function loginWithWechat(){
 const login=await Taro.login()
 if(!login.code)throw new Error('WECHAT_LOGIN_CODE_MISSING')
 const result=await apiRequest<{token:string;user:{id:string;displayName?:string}}>('/api/auth/wechat','POST',{code:login.code})
 Taro.setStorageSync(TOKEN_KEY,result.token)
 return result.user
}

/** multipart 上传：spaceId 作为表单字段，服务端校验成员权限并返回空间隔离的 object key */
export async function uploadImage(filePath:string,spaceId:string):Promise<{key:string;contentType:string;size:number}>{
 const token=getAccessToken()
 const res=await Taro.uploadFile({url:BASE+'/api/uploads',filePath,name:'file',formData:{spaceId},header:token?{Authorization:'Bearer '+token}:{}})
 if(res.statusCode<200||res.statusCode>=300){let body:any=null;try{body=JSON.parse(res.data)}catch{};throw new Error(body?.error||('UPLOAD_FAILED_'+res.statusCode))}
 return JSON.parse(res.data)
}

export async function resolveImageUrl(key:string,spaceId=getActiveSpaceId()){
 const result=await apiRequest<{url:string}>('/api/uploads/read-url?spaceId='+encodeURIComponent(spaceId)+'&key='+encodeURIComponent(key))
 return result.url
}

export type SpaceMembership={id:string;role:'owner'|'member';status:string;space:{id:string;name:string;ownerId:string}}

/**
 * 会话编排：登录 → 拉取我的空间 → 无空间则自动创建 → 持久化 activeSpaceId。
 * 返回当前激活空间与角色；已有 activeSpaceId 且仍在成员列表时优先沿用。
 */
export async function ensureSession():Promise<{user:{id:string;displayName?:string};space:{id:string;name:string;inviteCode?:string};role:'owner'|'member'}>{
 let user:{id:string;displayName?:string}
 try{
  user=await apiRequest<{id:string;displayName?:string}>('/api/me')
 }catch(e:any){
  if(e?.statusCode!==401)throw e
  user=await loginWithWechat()
 }
 let memberships=await apiRequest<SpaceMembership[]>('/api/spaces')
 let active=getActiveSpaceId()
 let mine=memberships.find(m=>m.space.id===active)
 let inviteCode:string|undefined
 if(!mine){
  if(memberships.length>0){mine=memberships[0]}
  else{
   const created=await apiRequest<{id:string;name:string;inviteCode:string}>('/api/spaces','POST',{name:'我们的餐桌'})
   mine={id:'',role:'owner',status:'active',space:{id:created.id,name:created.name,ownerId:user.id}}
   inviteCode=created.inviteCode
   memberships=[mine]
  }
  setActiveSpaceId(mine.space.id)
 }
 // owner 重进小程序时也能取回邀请码（成员不可见）；失败不阻塞会话
 if(!inviteCode&&mine.role==='owner'){
  try{inviteCode=(await apiRequest<{inviteCode:string}>('/api/spaces/'+mine.space.id+'/invite-code')).inviteCode}catch{}
 }
 return{user,space:{...mine.space,inviteCode},role:mine.role}
}

/** 凭邀请码加入家庭空间，成功后切换 activeSpaceId */
export async function joinSpaceByCode(inviteCode:string){
 const space=await apiRequest<{id:string;name:string}>('/api/spaces/join','POST',{inviteCode:inviteCode.trim().toUpperCase()})
 setActiveSpaceId(space.id)
 return space
}