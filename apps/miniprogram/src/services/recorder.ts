import Taro from '@tarojs/taro'
import {uploadAudio,transcribeAudio,getActiveSpaceId} from './api'

/**
 * 语音录入编排：录音 → 上传 → 转写 → 返回文本（回填 AI 录入草稿）。
 *
 * 录音参数依据微信官方 RecorderManager.start 文档：
 *   format=mp3、sampleRate=16000（合法值）、numberOfChannels=1、
 *   encodeBitRate=48000（16000Hz 对应合法区间 24000~96000）、
 *   duration=60000（默认上限内）。
 * STT Provider 未配置时服务端返回 503，这里原样抛出由 UI 降级提示手动输入。
 */
export const RECORD_OPTIONS={duration:60000,sampleRate:16000,numberOfChannels:1,encodeBitRate:48000,format:'mp3'} as const

type RecorderLike={
 start:(options:Record<string,unknown>)=>void
 stop:()=>void
 onStop:(cb:(res:{tempFilePath:string;duration?:number;fileSize?:number})=>void)=>void
 onError:(cb:(res:{errMsg?:string})=>void)=>void
}

let recorder:RecorderLike|null=null
let stopHandler:((res:{tempFilePath:string})=>void)|null=null
let errorHandler:((res:{errMsg?:string})=>void)|null=null
let recording=false

function getRecorder():RecorderLike{
 if(!recorder){
  recorder=Taro.getRecorderManager() as unknown as RecorderLike
  recorder.onStop(res=>{recording=false;stopHandler?.(res)})
  recorder.onError(res=>{recording=false;errorHandler?.(res)})
 }
 return recorder
}

export function isRecording(){return recording}

/** 复位内部状态（页面卸载/异常恢复/测试隔离用）；不触发硬件 stop */
export function resetRecorderState(){recording=false;stopHandler=null;errorHandler=null}

/** 开始录音；重复调用先停止上一段（避免状态悬挂） */
export function startRecording(){
 const r=getRecorder()
 if(recording)r.stop()
 recording=true
 r.start({...RECORD_OPTIONS})
}

/** 停止录音并等待 onStop 回调，返回临时文件路径 */
export function stopRecording():Promise<{tempFilePath:string}>{
 const r=getRecorder()
 if(!recording)return Promise.reject(new Error('NOT_RECORDING'))
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{stopHandler=null;errorHandler=null;recording=false;reject(new Error('RECORD_STOP_TIMEOUT'))},5000)
  stopHandler=res=>{clearTimeout(timer);stopHandler=null;errorHandler=null;resolve({tempFilePath:res.tempFilePath})}
  errorHandler=res=>{clearTimeout(timer);stopHandler=null;errorHandler=null;reject(new Error(res?.errMsg||'RECORD_ERROR'))}
  r.stop()
 })
}

/** 完整链路：录音文件 → 上传到当前空间 → 服务端转写 → 文本 */
export async function transcribeRecording(tempFilePath:string,spaceId=getActiveSpaceId()):Promise<string>{
 const up=await uploadAudio(tempFilePath,spaceId)
 const result=await transcribeAudio(up.key,spaceId)
 return result.text||''
}