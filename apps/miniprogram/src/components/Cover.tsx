import { View, Text, Image } from '@tarojs/components'

/**
 * 菜品照片渲染（v2 修订）：真实成品照优先；缺图时诚实显示「未上传成品照」占位，
 * 不用通用插画或 Emoji 冒充成品照。容器尺寸由外层样式给出。
 */
export function Cover({ url, label = '未上传成品照' }: { url?: string; label?: string }) {
  if (url) return <Image className='real-photo' src={url} mode='aspectFill' />
  return <View className='no-photo' aria-label={label}>
    <View className='photo-corners' />
    <Text className='no-photo-label'>{label}</Text>
  </View>
}
