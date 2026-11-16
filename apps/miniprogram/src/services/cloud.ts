import Taro from '@tarojs/taro'
import {apiRequest,apiBaseUrl,getAccessToken,getActiveSpaceId} from './api'
export function initCloud(){/* CloudBase removed; API server is the only backend. */}
export async function callCloud<T>(name:string,data:Record<string,unknown>):Promise<T>{
 const spaceId=String(data.spaceId||getActiveSpaceId())
 if(name==='recipe-import')return apiRequest<T>('/api/ai/recipe-draft','POST',{spaceId,text:data.text||'',imageKey:data.imageFileId||data.imageKey})
 if(name==='meal-recommend')return apiRequest<T>('/api/meal-recommendations','POST',{...data,spaceId})
 throw new Error('UNKNOWN_API_ACTION_'+name)
}
export async function uploadLocalImage(filePath:string):Promise<string>{
 const spaceId=getActiveSpaceId()
 if(!spaceId)throw new Error('请先创建或加入家庭空间')
 const response=await Taro.uploadFile({url:apiBaseUrl()+'/api/uploads',filePath,name:'file',formData:{spaceId},header:{Authorization:'Bearer '+getAccessToken()}})
 if(response.statusCode<200||response.statusCode>=300)throw new Error('IMAGE_UPLOAD_FAILED_'+response.statusCode)
 const body=typeof response.data==='string'?JSON.parse(response.data):response.data
 return body.key as string
}
