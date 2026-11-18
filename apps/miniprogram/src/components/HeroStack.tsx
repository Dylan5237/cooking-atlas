import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import type { Recipe } from '@cooking-atlas/shared'
import { Cover } from './Cover'

const amount = (q: number | null | undefined, u: string) =>
  q == null ? (u === '适量' ? '适量' : '待核对') : `${Number(q.toFixed(2))} ${u}`

/**
 * 图鉴主卡叠卡组：主卡 3D 翻面 + 两张错位衬卡（B 结构 × C 视觉，v2 文案）。
 * 制作次数直接用真实记录数，无记录不补 1；没有独立「拿手菜」标记功能就不展示印章。
 */
export default function HeroStack({ recipe, serial, cooked, onDetail }: {
  recipe: Recipe
  serial: string
  cooked: number
  onDetail: () => void
}) {
  const [flipped, setFlipped] = useState(false)

  return <View>
    <View className='stack'>
      <View className='stack-base' />
      <View className='stack-base second' />
      <View className={`hero-card ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(f => !f)}>
      <View className='card-rotor'>
        {/* 正面 */}
        <View className='face front'>
          <View className='card-top'>
            <Text className='ct-label'>我的菜谱</Text>
            <Text className='ct-no'>NO. {serial}</Text>
          </View>
          <View className='card-food'><Cover url={recipe.coverUrl} /></View>
          <Text className='card-title'>{recipe.title}</Text>
          <View className='card-foot'>
            <Text>{recipe.category} · {recipe.cookingMinutes || '—'} 分钟</Text>
            <Text>{cooked ? `记录 ${cooked} 次` : '暂无制作记录'}</Text>
          </View>
        </View>
        {/* 背面：配方摘要 */}
        <View className='face back'>
          <Text className='back-label'>配方摘要 · {recipe.servings || 2} 人份</Text>
          <Text className='back-title'>{recipe.title}</Text>
          <View className='back-ingredients'>
            {(recipe.ingredients || []).slice(0, 3).map((i, idx) => (
              <Text key={idx}>{i.name} {amount(i.quantity, i.unit)}</Text>
            ))}
          </View>
          <Text className='back-step'>{recipe.steps?.[0]?.content || '做法待补充'}</Text>
          <Text className='back-hint'>再点一次返回 · 完整步骤见详情</Text>
        </View>
      </View>
      </View>
    </View>
    <View className='flip-hint' onClick={onDetail}><Text>点卡片查看配方</Text></View>
  </View>
}
