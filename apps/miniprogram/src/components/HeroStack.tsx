import { useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import type { Recipe } from '@cooking-atlas/shared'
import { fallbackCover } from '../services/coverMap'

const amount = (q: number | null | undefined, u: string) =>
  q == null ? (u === '适量' ? '适量' : '待核对') : `${Number(q.toFixed(2))} ${u}`

/**
 * 图鉴主卡叠卡组：主卡 3D 翻面 + 两张错位衬卡（B 结构 × C 视觉）。
 * 翻面用 CSS transform，低版本基础库由父级 flipMode='fade' 降级为正反切换淡入。
 */
export default function HeroStack({ recipe, serial, cooked, signature, onDetail }: {
  recipe: Recipe
  serial: string
  cooked: number
  signature: boolean
  onDetail: () => void
}) {
  const [flipped, setFlipped] = useState(false)
  const cover = recipe.coverKey ? undefined : fallbackCover(recipe.title)
  const coverUrl = recipe.coverUrl || ''

  return <View>
    <View className='stack'>
      <View className='stack-base' />
      <View className='stack-base second' />
      <View className={`hero-card ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(f => !f)}>
      <View className='card-rotor'>
        {/* 正面 */}
        <View className='face front'>
          <View className='card-top'>
            <Text className='ct-label'>FAMILY COLLECTION</Text>
            <Text className='ct-no'>{serial} ✧</Text>
          </View>
          {coverUrl
            ? <Image className='card-food' src={coverUrl} mode='aspectFill' />
            : <Image className='card-food contain' src={cover} mode='aspectFit' />}
          {signature && <View className='stamp'><Text>我家的{'\n'}拿手菜</Text></View>}
          <Text className='card-title'>{recipe.title}</Text>
          <View className='card-foot'>
            <Text>{recipe.category} · {recipe.cookingMinutes || '—'} MIN</Text>
            <Text>做过 {cooked || 1} 次 ↗</Text>
          </View>
        </View>
        {/* 背面：配方摘要 */}
        <View className='face back'>
          <Text className='back-label'>RECIPE / 配方背面</Text>
          <Text className='back-title'>{recipe.title}</Text>
          <View className='back-ingredients'>
            {(recipe.ingredients || []).slice(0, 3).map((i, idx) => (
              <Text key={idx}>{i.name} {amount(i.quantity, i.unit)}</Text>
            ))}
          </View>
          <Text className='back-step'>{recipe.steps?.[0]?.content || '做法待补充'}</Text>
          <Text className='back-hint'>{recipe.servings || 2} 人份 · 再点一次回到正面</Text>
        </View>
      </View>
      </View>
    </View>
    <View className='flip-hint' onClick={onDetail}><Text>轻触翻面，点此看完整菜谱</Text></View>
  </View>
}
