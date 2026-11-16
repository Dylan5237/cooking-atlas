import Taro from '@tarojs/taro'
const TOKEN_KEY='cooking-atlas-access-token'
const SPACE_KEY='cooking-atlas-active-space'
const BASE=(process.env.TARO_APP_API_BASE_URL||'http://127.0.0.1:3001').replace(/\/$/,'')
export type ApiMethod='GET'|'POST'|'PUT'|'PATCH'|'DELETE'
export function getAccessToken(){return Taro.getStorageSync(TOKEN_KEY)||''}
export function setActiveSpaceId(id:string){Taro.setStorageSync(SPACE_KEY,id)}
export function getActiveSpaceId(){return Taro.getStorageSync(SPACE_KEY)||''}
export async function apiRequest<T>(path:string,method:ApiMethod='GET',data?:unknown):Promise<T>{
 const token=getAccessToken()
 const res=await Taro.request({url:BASE+path,method,data,header:{'content-type':'application/json',...(token?{Authorization:'Bearer '+token}:{})}})
 if(res.statusCode<200||res.statusCode>=300){const body:any=res.data;throw new Error(body?.error||('API_REQUEST_FAILED_'+res.statusCode))}
 return res.data as T
}
export async function loginWithWechat(){
 const login=await Taro.login()
 if(!login.code)throw new Error('WECHAT_LOGIN_CODE_MISSING')
 const result=await apiRequest<{token:string;user:{id:string;displayName?:string}}>('/api/auth/wechat','POST',{code:login.code})
 Taro.setStorageSync(TOKEN_KEY,result.token)
 return result.user
}
export function apiBaseUrl(){return BASE}

export async function resolveImageUrl(key:string,spaceId=getActiveSpaceId()){
 const result=await apiRequest<{url:string}>('/api/uploads/read-url?'+new URLSearchParams({spaceId,key}).toString())
 return result.url
}
