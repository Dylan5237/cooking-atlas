import { View, Text } from '@tarojs/components'
import type { Recipe } from '@cooking-atlas/shared'
import { Cover } from './Cover'

/** 点菜扇形卡组：三张微旋转卡预览当前搭配（点击看详情）；缺图如实标注。 */
export default function FanCards({ items, wishIds, onDetail }: {
  items: Recipe[]
  wishIds: string[]
  onDetail: (r: Recipe) => void
}) {
  if (!items.length) return null
  const shown = items.slice(0, 3)
  return <View className='hand'>
    {shown.map((r, i) => {
      const tag = wishIds.includes(r.id) ? '家人点菜' : r.category
      return <View
        key={r.id}
        className={`fan-card fc-${i}`}
        onClick={() => onDetail(r)}
      >
        <Text className='serial'>NO.{String(i + 1).padStart(3, '0')}</Text>
        <Text className='tag'>{tag}</Text>
        <View className='fan-img'><Cover url={r.coverUrl} label='未上传照片' /></View>
        <Text className='fan-title'>{r.title}</Text>
      </View>
    })}
  </View>
}
