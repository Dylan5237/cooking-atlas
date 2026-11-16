import Taro from '@tarojs/taro'

const cloud = (Taro as any).cloud
export function initCloud() {
  const env = process.env.TARO_APP_CLOUDBASE_ENV_ID
  if (cloud && env) cloud.init({ env, traceUser: true })
}
export async function callCloud<T>(name: string, data: Record<string, unknown>): Promise<T> {
  if (!cloud) throw new Error('当前运行环境未提供微信云开发 API')
  const result = await cloud.callFunction({ name, data })
  return result.result as T
}
export async function uploadLocalImage(filePath: string): Promise<string> {
  if (!cloud) throw new Error('当前运行环境未提供微信云存储 API')
  const result = await cloud.uploadFile({ cloudPath: 'recipe-covers/' + Date.now() + '.jpg', filePath })
  return result.fileID
}
