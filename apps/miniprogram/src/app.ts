import {PropsWithChildren,useEffect} from 'react'
import Taro from '@tarojs/taro'
import {ensureSession} from './services/api'
import {repository,isDemoMode} from './services/repository'
import './app.scss'
export default function App({children}:PropsWithChildren){
 useEffect(()=>{
  if(isDemoMode())return
  ensureSession()
   .then(()=>repository.refresh())
   .catch(()=>Taro.showToast({title:'登录服务暂不可用，请检查网络后重试',icon:'none'}))
 },[])
 return children
}