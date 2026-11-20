import { ReactNode } from 'react'
import { View, Text } from '@tarojs/components'

/** 轻量底部弹层：详情 / 录入 / 菜单确认共用。点遮罩关闭。 */
export default function Sheet({ open, label, onClose, children }: {
  open: boolean
  label: string
  onClose: () => void
  children: ReactNode
}) {
  if (!open) return null
  return <View className='mask' onClick={e => { if ((e.target as any).className === 'mask') onClose() }} catchMove>
    <View className='sheet' onClick={e => e.stopPropagation()}>
      <View className='grab' />
      <View className='close-row'>
        <Text>{label}</Text>
        <View className='iconbtn' onClick={onClose}><Text>✕</Text></View>
      </View>
      {children}
    </View>
  </View>
}
