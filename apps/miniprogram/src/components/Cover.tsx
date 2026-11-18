import { View, Text, Image } from '@tarojs/components'

/**
 * 菜品照片渲染（v2 修订）：真实成品照优先；缺图时诚实显示「未上传成品照」占位，
 * 不用通用插画或 Emoji 冒充成品照。容器尺寸由外层样式给出。
 * sample=true 时叠加「示例照片」角标（仅演示数据使用，来源见 state/demo.ts）。
 */
export function Cover({ url, label = '未上传成品照', sample = false }: { url?: string; label?: string; sample?: boolean }) {
  if (url) return <View className='cover-wrap'>
    <Image className='real-photo' src={url} mode='aspectFill' />
    {sample && <Text className='sample-badge'>示例照片</Text>}
  </View>
  return <View className='no-photo' aria-label={label}>
    <View className='photo-corners' />
    <Text className='no-photo-label'>{label}</Text>
  </View>
}
