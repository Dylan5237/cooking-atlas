import {PropsWithChildren,useEffect} from 'react'
import Taro from '@tarojs/taro'
import {loginWithWechat} from './services/api'
import './app.scss'
export default function App({children}:PropsWithChildren){
 useEffect(()=>{
  if(process.env.TARO_APP_DEMO_MODE!=='true'){
   loginWithWechat().catch(()=>Taro.showToast({title:'登录服务暂不可用',icon:'none'}))
  }
 },[])
 return children
}
