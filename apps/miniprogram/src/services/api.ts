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

const TRIAL_CODE_KEY='cooking-atlas-trial-code'
const DEVICE_KEY='cooking-atlas-device-id'

/** 稳定的设备标识：同一台手机上同一试用码 → 同一账号；换手机 → 不同账号 */
export function getDeviceId(){
 let id=Taro.getStorageSync(DEVICE_KEY)
 if(!id){
  id='d'+Math.random().toString(36).slice(2)+Date.now().toString(36)
  Taro.setStorageSync(DEVICE_KEY,id)
 }
 return String(id)
}
export function getTrialCode(){return Taro.getStorageSync(TRIAL_CODE_KEY)||''}
export function clearTrialCode(){Taro.removeStorageSync(TRIAL_CODE_KEY)}

/** 试用码登录（服务端未开启 TRIAL_LOGIN_CODE 时返回 503 TRIAL_LOGIN_DISABLED） */
export async function loginWithTrialCode(code:string){
 const result=await apiRequest<{token:string;user:{id:string;displayName?:string}}>('/api/auth/trial','POST',{code:code.trim(),deviceId:getDeviceId()})
 Taro.setStorageSync(TOKEN_KEY,result.token)
 Taro.setStorageSync(TRIAL_CODE_KEY,code.trim())
 return result.user
}

/** multipart 上传：spaceId 作为表单字段，服务端校验成员权限并返回空间隔离的 object key */
export async function uploadImage(filePath:string,spaceId:string):Promise<{key:string;contentType:string;size:number}>{
 const token=getAccessToken()
 const res=await Taro.uploadFile({url:BASE+'/api/uploads',filePath,name:'file',formData:{spaceId},header:token?{Authorization:'Bearer '+token}:{}})
 if(res.statusCode<200||res.statusCode>=300){let body:any=null;try{body=JSON.parse(res.data)}catch{};throw new Error(body?.error||('UPLOAD_FAILED_'+res.statusCode))}
 return JSON.parse(res.data)
}

/** 录音上传：与图片同等的空间隔离；服务端按音频魔数校验 */
export async function uploadAudio(filePath:string,spaceId:string):Promise<{key:string;contentType:string;size:number}>{
 const token=getAccessToken()
 const res=await Taro.uploadFile({url:BASE+'/api/uploads/audio',filePath,name:'file',formData:{spaceId},header:token?{Authorization:'Bearer '+token}:{}})
 if(res.statusCode<200||res.statusCode>=300){let body:any=null;try{body=JSON.parse(res.data)}catch{};throw new Error(body?.error||('UPLOAD_FAILED_'+res.statusCode))}
 return JSON.parse(res.data)
}

/** 语音转写：audioKey 必须是本空间已上传的音频对象；STT 未配置时服务端 503 */
export async function transcribeAudio(audioKey:string,spaceId=getActiveSpaceId()){
 return apiRequest<{text:string}>('/api/ai/transcribe','POST',{spaceId,audioKey})
}

export async function resolveImageUrl(key:string,spaceId=getActiveSpaceId()){
 const result=await apiRequest<{url:string}>('/api/uploads/read-url?spaceId='+encodeURIComponent(spaceId)+'&key='+encodeURIComponent(key))
 return result.url
}

export type SpaceMembership={id:string;role:'owner'|'member';status:string;space:{id:string;name:string;ownerId:string}}

/**
 * 会话编排：登录 → 拉取我的空间 → 无空间则自动创建 → 持久化 activeSpaceId。
 * 返回当前激活空间与角色；已有 activeSpaceId 且仍在成员列表时优先沿用。
 *
 * 登录顺序：已存 token → 微信登录；微信未配置(503)且存有试用码 → 试用码登录；
 * 都没有则抛 TRIAL_CODE_REQUIRED，由页面提示输入试用码。
 */
export async function ensureSession():Promise<{user:{id:string;displayName?:string};space:{id:string;name:string;inviteCode?:string};role:'owner'|'member'}>{
 let user:{id:string;displayName?:string}
 try{
  user=await apiRequest<{id:string;displayName?:string}>('/api/me')
 }catch(e:any){
  if(e?.statusCode!==401)throw e
  user=await loginAny()
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

/**
 * 登录策略：微信优先；微信未配置时用已存试用码自动登录；
 * 两者都不可用则抛 TRIAL_CODE_REQUIRED（页面据此提示输入试用码）。
 * H5 运行时无 wx.login，直接走试用码链路。
 */
export async function loginAny(){
 // H5 运行时无 wx.login（process.env.TARO_ENV 编译期注入），直接走试用码链路
 if(process.env.TARO_ENV==='h5'){
  const code=getTrialCode()
  if(!code)throw Object.assign(new Error('TRIAL_CODE_REQUIRED'),{statusCode:401})
  return await loginWithTrialCode(code)
 }
 try{
  return await loginWithWechat()
 }catch(e:any){
  const msg=String(e?.message||e)
  if(msg!=='WECHAT_AUTH_NOT_CONFIGURED')throw e
  const code=getTrialCode()
  if(!code)throw Object.assign(new Error('TRIAL_CODE_REQUIRED'),{statusCode:401})
  return await loginWithTrialCode(code)
 }
}

/** 凭邀请码加入家庭空间，成功后切换 activeSpaceId */export async function joinSpaceByCode(inviteCode:string){
 const space=await apiRequest<{id:string;name:string}>('/api/spaces/join','POST',{inviteCode:inviteCode.trim().toUpperCase()})
 setActiveSpaceId(space.id)
 return space
}