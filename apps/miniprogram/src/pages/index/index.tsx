import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, Input, Textarea, Button, Image, Canvas } from '@tarojs/components'
import Taro, { useShareAppMessage } from '@tarojs/taro'
import { repository, isDemoMode } from '../../services/repository'
import { ensureSession, joinSpaceByCode, uploadImage, resolveImageUrl, getActiveSpaceId, apiRequest, loginWithTrialCode, choosePhotoH5, uploadImageH5 } from '../../services/api'
import { startRecording, stopRecording, transcribeRecording, isRecording } from '../../services/recorder'
import { CARD_W, layoutCard, drawCard, getCardCanvas, loadCoverImage, exportCardImage, saveCardToAlbum, exportCardH5 } from '../../services/card'
import { mapDraftToForm, parseIngredients, resolveServingsInput } from '../../services/draft'
import { dishRole, stapleKind } from '@cooking-atlas/meal-engine'
import HeroStack from '../../components/HeroStack'
import FanCards from '../../components/FanCards'
import Sheet from '../../components/Sheet'
import Icon from '../../components/Icon'
import { Cover } from '../../components/Cover'
import type { Recipe } from '@cooking-atlas/shared'
import './index.scss'

type Tab = 'home' | 'menu' | 'shop' | 'profile'
type SheetKind = null | 'detail' | 'add' | 'browse' | 'review' | 'log' | 'staple'
type Role = 'owner' | 'member'
/** 封面编辑意图：keep 维持原样（API 不传字段）/ replace 已换新照 / clear 清除 */
type CoverAction = 'keep' | 'replace' | 'clear'

const CATS = ['全部', '荤菜', '素菜', '汤羹', '主食', '家常菜', '甜品']
const SHOP_GROUPS = ['主食与肉蛋', '蔬菜与配料', '调味与其他']
const DEMO_ROLE_KEY = 'cooking-atlas-demo-role'
const errText = (e: unknown) => String((e as Error)?.message || e)
const amount = (q: number | null | undefined, u: string) =>
  q == null ? (u === '适量' ? '适量' : '待核对') : `${Number(q.toFixed(2))} ${u}`
const isH5 = process.env.TARO_ENV === 'h5'
const STAPLE_SIDE_LABEL: Record<string, string> = { side: '配餐主食', meal: '一餐式主食' }
/** 一餐构成文案：区分主食与菜肴，一餐式主食为主时点明「主食主体 + 配菜」 */
function compositionText(items: { id?: string; title: string; category?: string }[], lookupCategory?: (id?: string) => string | undefined): string {
  const cat = (x: { id?: string; category?: string }) => x.category || (x.id ? lookupCategory?.(x.id) : undefined) || '家常菜'
  const staples = items.filter(x => dishRole({ title: x.title, category: cat(x) }) === 'staple')
  const dishes = items.filter(x => dishRole({ title: x.title, category: cat(x) }) !== 'staple')
  if (staples.some(s => stapleKind({ title: s.title, category: cat(s) }) === 'meal')) {
    const names = staples.map(s => s.title).join('、')
    return dishes.length ? `主食 ${names} + ${dishes.length} 道配菜` : `主食 ${names}`
  }
  return `${dishes.length} 道菜${staples.length ? ` + ${staples.length} 份主食` : ''}`
}

interface Session {
  user: { id: string; displayName?: string }
  space: { id: string; name: string; inviteCode?: string }
  role: Role
}

export default function Index() {
  const [tab, setTab] = useState<Tab>('home')
  const [store, setStore] = useState(repository.getStore())
  const [loading, setLoading] = useState(!isDemoMode())
  const [session, setSession] = useState<Session | null>(null)
  // 演示角色切换：仅演示模式可见的工具，不是生产权限机制
  const [demoRole, setDemoRole] = useState<Role>(() =>
    (isDemoMode() ? String(Taro.getStorageSync(DEMO_ROLE_KEY) || 'owner') : 'owner') as Role)
  // 图鉴
  const [heroIdx, setHeroIdx] = useState(0)
  const [covers, setCovers] = useState<Record<string, string>>({})
  // 浏览弹层
  const [browseCat, setBrowseCat] = useState('全部')
  const [browseQuery, setBrowseQuery] = useState('')
  const [browseMode, setBrowseMode] = useState<'detail' | 'pick'>('detail')
  // 弹层
  const [sheet, setSheet] = useState<SheetKind>(null)
  const [detailRecipe, setDetailRecipe] = useState<Recipe | null>(null)
  // 录入表单
  const [importMode, setImportMode] = useState<'ai' | 'manual'>('ai')
  const [aiTitle, setAiTitle] = useState('')
  const [aiText, setAiText] = useState('')
  const [aiImageKey, setAiImageKey] = useState('')
  const [aiPreview, setAiPreview] = useState('')
  const [coverAction, setCoverAction] = useState<CoverAction>('keep')
  const [mTitle, setMTitle] = useState('')
  const [mDesc, setMDesc] = useState('')
  const [mIng, setMIng] = useState('')
  const [mSteps, setMSteps] = useState('')
  const [mServings, setMServings] = useState('2')
  const [mMinutes, setMMinutes] = useState('15')
  const [mCategory, setMCategory] = useState('家常菜')
  const [editId, setEditId] = useState('')
  // 点菜
  const [people, setPeople] = useState(3)
  const [meal, setMeal] = useState<'lunch' | 'dinner'>('dinner')
  const [chosen, setChosen] = useState<string[]>([])
  const [portions, setPortions] = useState<Record<string, number>>({})
  const [orderNote, setOrderNote] = useState('')
  const [busy, setBusy] = useState(false)
  // 手动锁定（加一道/详情加入/主食选择）：换推荐时保证保留
  const [manualPicks, setManualPicks] = useState<string[]>([])
  // 主食意图：stapleId=明确选择的主食；stapleOff=本餐不安排；两者皆空=自动搭配
  const [stapleId, setStapleId] = useState<string | null>(null)
  const [stapleOff, setStapleOff] = useState(false)
  // 本餐明确排除（删除/不安排）的菜：推荐与换组不得自动复活；确认或重新提交后清空
  const [excludedIds, setExcludedIds] = useState<string[]>([])
  // 推荐返回的缺主食提示（引擎 warning），显示在主食行旁
  const [stapleHint, setStapleHint] = useState('')
  // 录音 / 卡牌
  const [recording, setRecording] = useState(false)
  const [cardBusy, setCardBusy] = useState(false)
  // 制作记录
  const [logDishIds, setLogDishIds] = useState<string[]>([])
  const [logRating, setLogRating] = useState(0)
  const [logNotes, setLogNotes] = useState('')
  // 试用码
  const [trialRequired, setTrialRequired] = useState(false)
  const [trialCode, setTrialCode] = useState('')
  // 加入空间
  const [joinCode, setJoinCode] = useState('')

  const refresh = () => setStore(repository.getStore())
  const isOwner = isDemoMode() ? demoRole === 'owner' : session?.role === 'owner'
  const recipes = store.recipes
  const hero = recipes.length ? recipes[heroIdx % recipes.length] : null
  const heroSerial = String(((heroIdx % Math.max(recipes.length, 1)) + 1)).padStart(3, '0')
  const isSampleCover = (id: string) => isDemoMode() && (store.sampleCoverIds || []).includes(id)

  /* ---------------- 会话 ---------------- */
  useEffect(() => {
    if (isDemoMode()) { setLoading(false); return }
    ensureSession()
      .then(async s => {
        setSession(s)
        await repository.refresh(); refresh()
        if (s.role === 'owner') await repository.refreshRequests().catch(() => {})
        refresh()
      })
      .catch(e => {
        if (errText(e) === 'TRIAL_CODE_REQUIRED') { setTrialRequired(true); return }
        Taro.showToast({ title: '登录失败：' + errText(e), icon: 'none' })
      })
      .finally(() => setLoading(false))
  }, [])

  /* 封面签名 URL 缓存 */
  useEffect(() => {
    const missing = recipes.filter(r => r.coverKey && !covers[r.coverKey])
    if (!missing.length) return
    let cancelled = false
    Promise.all(missing.map(async r => {
      try { const url = await resolveImageUrl(r.coverKey!, getActiveSpaceId()); return [r.coverKey!, url] as const } catch { return null }
    })).then(pairs => {
      if (cancelled) return
      const next = { ...covers }
      for (const p of pairs) if (p) next[p[0]] = p[1]
      setCovers(next)
    })
    return () => { cancelled = true }
  }, [recipes])

  const recipeWithCover = (r: Recipe): Recipe =>
    r.coverKey && covers[r.coverKey] ? { ...r, coverUrl: covers[r.coverKey] } : r

  /* ---------------- 图鉴 ---------------- */
  const favorites = useMemo(() => recipes.filter(r => store.favoriteIds.includes(r.id)), [recipes, store.favoriteIds])
  const wishTitles = store.requests.flatMap(q => q.recipeIds)
    .map(id => recipes.find(r => r.id === id)?.title).filter(Boolean) as string[]

  const openDetail = (r: Recipe) => { setDetailRecipe(r); setSheet('detail') }

  const toggleFavorite = async (recipeId: string) => {
    try { await repository.toggleFavorite(recipeId); refresh() } catch (e) { Taro.showToast({ title: errText(e), icon: 'none' }) }
  }

  const addManualPick = (id: string) => setManualPicks(p => p.includes(id) ? p : [...p, id])

  const pickToOrder = (r: Recipe) => {
    if (!chosen.includes(r.id)) {
      setChosen(c => [...c, r.id])
      setPortions(p => ({ ...p, [r.id]: people }))
    }
    addManualPick(r.id)
    setSheet(null); setTab('menu')
    Taro.showToast({ title: '已加入点菜：' + r.title, icon: 'none' })
  }

  /* ---------------- 主食选择 ---------------- */
  const stapleRecipes = recipes.filter(r => dishRole(r) === 'staple')
  const wishIds = [...new Set(store.requests.flatMap(q => q.recipeIds))]
  const currentStaple = chosen.map(id => recipes.find(r => r.id === id)).filter(Boolean as any as (x: Recipe | undefined) => x is Recipe)
    .find(r => dishRole(r) === 'staple')
  const stapleLabel = stapleOff ? '本餐不安排' : currentStaple?.title || '未选择（自动搭配）'

  /** 主食三态选择。选择与确认边界都按 recipeId 保持唯一：同一主食反复选取幂等。 */
  const pickStaple = (mode: 'auto' | 'off' | string) => {
    const isStapleId = (id: string) => { const r = recipes.find(x => x.id === id); return !!r && dishRole(r) === 'staple' }
    const dropStaples = (ids: string[]) => ids.filter(id => !isStapleId(id))
    if (mode === 'auto') {
      // 只清显式选择；家人点的主食仍由推荐按请求保留
      setChosen(c => c.filter(id => !isStapleId(id) || wishIds.includes(id)))
      setManualPicks(p => p.filter(id => !isStapleId(id) || wishIds.includes(id)))
      setStapleId(null); setStapleOff(false)
    } else if (mode === 'off') {
      // 本餐最终安排以掌勺者操作为准：移除全部主食（含家人点的），并明示未纳入
      setChosen(dropStaples)
      setManualPicks(dropStaples)
      setStapleId(null); setStapleOff(true)
      const wishStaples = wishIds.filter(isStapleId).map(id => recipes.find(x => x.id === id)?.title).filter(Boolean)
      Taro.showToast({ title: wishStaples.length ? `本餐不安排主食（家人点的${wishStaples.join('、')}未纳入）` : '本餐不安排主食', icon: 'none' })
    } else {
      const r = recipes.find(x => x.id === mode)
      if (!r) return
      setChosen(c => [...new Set([...dropStaples(c), r.id])])
      setManualPicks(p => [...new Set([...dropStaples(p), r.id])])
      setPortions(p => ({ ...p, [r.id]: p[r.id] || people }))
      setStapleId(r.id); setStapleOff(false)
      setExcludedIds(v => v.filter(id => id !== r.id))
    }
    setSheet(null)
  }

  /** 统一移除：菜单、手动锁定、主食显选与本餐排除一起更新，换推荐不复活已删除项 */
  const removeDish = (id: string) => {
    setChosen(c => c.filter(x => x !== id))
    setManualPicks(p => p.filter(x => x !== id))
    setStapleId(s => (s === id ? null : s))
    setExcludedIds(v => [...new Set([...v, id])])
  }

  /* ---------------- 录入 ---------------- */
  const openAdd = (r?: Recipe) => {
    if (r) {
      setEditId(r.id); setImportMode('manual')
      setMTitle(r.title); setMDesc(r.description || '')
      setMIng(r.ingredients.map(i => `${i.name}：${i.quantity ?? ''}${i.unit}`).join('\n'))
      setMSteps((r.steps || []).map(s => s.content).join('\n'))
      setMServings(String(r.servings || 2)); setMMinutes(String(r.cookingMinutes || 0)); setMCategory(r.category || '家常菜')
      // 每次编辑初始化封面状态：未换新照前不携带任何残留上传 key
      setAiImageKey(''); setAiPreview(r.coverUrl || ''); setCoverAction('keep')
    } else {
      setEditId(''); setImportMode('ai')
      setAiTitle(''); setAiText(''); setAiImageKey(''); setAiPreview('')
      setMTitle(''); setMDesc(''); setMIng(''); setMSteps(''); setMServings('2'); setMMinutes('15'); setMCategory('家常菜')
      setCoverAction('keep')
    }
    setSheet('add')
  }

  const chooseCover = async () => {
    try {
      if (isH5) {
        // 浏览器选图：本地校验；演示模式仅本地预览（不冒充已上传）。
        // 真实 API 模式：上传成功后才成组更新预览+key+动作，失败保持原状态（不出现"预览B保存A"）
        const photo = await choosePhotoH5()
        if (isDemoMode()) { setAiPreview(photo.dataUrl); setAiImageKey(''); setCoverAction('replace'); return }
        Taro.showLoading({ title: '上传中' })
        const up = await uploadImageH5(photo.file, getActiveSpaceId())
        setAiPreview(photo.dataUrl); setAiImageKey(up.key); setCoverAction('replace')
        Taro.hideLoading(); Taro.showToast({ title: '照片已上传', icon: 'success' })
        return
      }
      const res = await Taro.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'] })
      const local = res.tempFilePaths[0]
      if (isDemoMode()) { setAiPreview(local); setAiImageKey(''); setCoverAction('replace'); return }
      Taro.showLoading({ title: '上传中' })
      const up = await uploadImage(local, getActiveSpaceId())
      setAiPreview(local); setAiImageKey(up.key); setCoverAction('replace')
      Taro.hideLoading(); Taro.showToast({ title: '照片已上传', icon: 'success' })
    } catch (e) {
      // 失败：预览/key/动作全部维持进入表单时的状态，可重试
      Taro.hideLoading()
      const msg = errText(e)
      if (msg === 'PHOTO_INVALID') Taro.showToast({ title: '请选择 5 MB 内的 JPG、PNG 或 WebP 图片', icon: 'none' })
      else if (msg !== 'NO_FILE') Taro.showToast({ title: '照片上传失败，已保留原照片：' + msg, icon: 'none' })
    }
  }

  const clearCover = () => { setAiPreview(''); setAiImageKey(''); setCoverAction('clear') }

  const parseAI = async () => {
    if (isDemoMode()) { Taro.showToast({ title: '演示模式未接入 AI，请直接手动填写', icon: 'none' }); setImportMode('manual'); return }
    if (!aiTitle.trim() && !aiImageKey) { Taro.showToast({ title: '请先写菜名或上传照片', icon: 'none' }); return }
    try {
      Taro.showLoading({ title: 'AI 整理中' })
      const res = await apiRequest<{ draft: any }>('/api/ai/recipe-draft', 'POST', { spaceId: getActiveSpaceId(), text: (aiTitle ? `菜名：${aiTitle}\n` : '') + aiText, imageKey: aiImageKey || undefined })
      // 字段对位映射：步骤进步骤、心得进心得；未知留空待核对
      const form = mapDraftToForm(res.draft || {}, aiTitle)
      setMTitle(form.title)
      setMCategory(form.category)
      setMServings(form.servings)
      setMMinutes(form.minutes)
      setMIng(form.ingredientsText)
      setMSteps(form.stepsText)
      setMDesc(form.note)
      setImportMode('manual')
      Taro.hideLoading(); Taro.showToast({ title: '草稿已生成，请核对', icon: 'none' })
    } catch (e) { Taro.hideLoading(); Taro.showModal({ title: 'AI 暂不可用', content: errText(e) + '（输入已保留，可切手动）', showCancel: false }) }
  }

  const saveRecipe = async () => {
    if (!isOwner) { Taro.showToast({ title: '仅掌勺者可录入', icon: 'none' }); return }
    if (!mTitle.trim()) { Taro.showToast({ title: '请填写菜名', icon: 'none' }); return }
    const ingredients = parseIngredients(mIng)
    if (!ingredients.length) { Taro.showToast({ title: '请至少填写一项食材', icon: 'none' }); return }
    const servings = resolveServingsInput(mServings)
    if (!servings) { Taro.showToast({ title: '请补充原配方份数（AI 未能识别时需人工确认）', icon: 'none' }); return }
    const steps = mSteps.split('\n').map(s => s.trim()).filter(Boolean).map(content => ({ content }))
    const payload = {
      title: mTitle.trim(), category: mCategory,
      // 封面三态：replace 换新（API 用 key / demo 用 dataURL）、clear 清除、keep 不动原封面
      coverKey: isDemoMode() || coverAction !== 'replace' ? undefined : (aiImageKey || undefined),
      coverUrl: isDemoMode() ? (coverAction === 'replace' ? aiPreview : coverAction === 'clear' ? '' : undefined) : undefined,
      servings, cookingMinutes: Number(mMinutes) || 0,
      difficulty: '待补充', description: mDesc, ingredients, steps,
    }
    // API 编辑：clear 时显式传 null 让服务端移除封面；keep 时不传字段
    const apiPayload = editId && coverAction === 'clear' ? { ...payload, coverKey: null } : payload
    try {
      setBusy(true)
      if (editId) await repository.updateRecipe(editId, apiPayload as any)
      else await repository.createRecipe(payload as any)
      await repository.refresh(); refresh()
      setHeroIdx(0); setSheet(null); setTab('home')
      Taro.showToast({ title: editId ? '已更新这张卡' : '新卡已收进图鉴', icon: 'success' })
    } catch (e) { Taro.showToast({ title: '保存失败：' + errText(e), icon: 'none' }) } finally { setBusy(false) }
  }

  /* ---------------- 点菜 ---------------- */
  const bumpPeople = (d: number) => {
    const next = Math.min(12, Math.max(1, people + d))
    setPeople(next)
    setPortions(p => { const n = { ...p }; for (const k of Object.keys(n)) n[k] = next; return n })
  }

  /** 明确选择（家人点菜 + 手动锁定）作为推荐必保项；排除本餐已删除项；不安排主食时主食愿望也不进必保 */
  const stapleIntent = () => ({ staplePolicy: stapleOff ? 'none' as const : 'auto' as const, stapleRecipeId: stapleId })
  const computeProtect = () => {
    const ids = [...new Set([...wishIds, ...manualPicks])].filter(id => !excludedIds.includes(id))
    if (!stapleOff) return ids
    return ids.filter(id => {
      const r = recipes.find(x => x.id === id)
      return !r || dishRole(r) !== 'staple'
    })
  }

  const recommend = async () => {
    try {
      setBusy(true)
      const protect = computeProtect()
      const rec = await repository.recommend({
        servings: people, mealType: meal,
        requestedRecipeIds: protect.filter(id => recipes.some(r => r.id === id)),
        ...stapleIntent(),
      })
      const ids = rec.items.map(x => x.recipeId)
      setChosen(ids)
      setPortions(Object.fromEntries(ids.map(id => [id, people])))
      setStapleHint(rec.warnings.find(w => w.includes('主食')) || '')
      refresh()
      // 按实际结果报告：保留数来自真实交集，主食按结果统计
      const kept = protect.filter(id => ids.includes(id)).length
      const stapleCount = rec.items.filter(x => dishRole(recipes.find(r => r.id === x.recipeId) || { title: x.title, category: '' }) === 'staple').length
      const suffix = protect.length > kept ? `，${protect.length - kept} 项因冲突未纳入` : ''
      Taro.showToast({ title: `配好 ${rec.items.length} 项（主食 ${stapleCount}）· 保留明确选择 ${kept} 项${suffix}`, icon: 'none' })
    } catch (e) {
      Taro.showToast({ title: '推荐失败：' + errText(e), icon: 'none' })
    } finally { setBusy(false) }
  }

  const reroll = async () => {
    try {
      setBusy(true)
      const protect = computeProtect()
      const rec = repository.reroll({
        servings: people, mealType: meal, protect,
        current: chosen, ...stapleIntent(),
      })
      const ids = rec.items.map(x => x.recipeId)
      setChosen(ids)
      setPortions(Object.fromEntries(ids.map(id => [id, people])))
      setStapleHint(rec.warnings.find(w => w.includes('主食')) || '')
      if (rec.changed > 0) Taro.showToast({ title: `已换 ${rec.changed} 道，保留明确选择 ${rec.keptProtected} 项`, icon: 'none' })
      else Taro.showToast({ title: '没有可换的搭配（同类候选不足），已保留当前选择', icon: 'none' })
    } catch (e) {
      Taro.showToast({ title: '换组失败：' + errText(e), icon: 'none' })
    } finally { setBusy(false) }
  }

  const submitOrder = async () => {
    if (!isDemoMode() && !session) { Taro.showToast({ title: '尚未登录', icon: 'none' }); return }
    if (!chosen.length) { Taro.showToast({ title: '请先选择想吃的菜', icon: 'none' }); return }
    try {
      setBusy(true)
      await repository.submitMealRequest({ mealType: meal, servings: people, recipeIds: chosen, note: orderNote })
      setChosen([]); setOrderNote(''); setManualPicks([]); setExcludedIds([]); setStapleId(null); setStapleOff(false); setStapleHint(''); refresh()
      Taro.showToast({ title: '已提交点菜，等待掌勺者确认', icon: 'success' })
    } catch (e) { Taro.showToast({ title: '提交失败：' + errText(e), icon: 'none' }) } finally { setBusy(false) }
  }

  const confirmPlan = async () => {
    if (!isOwner) { Taro.showToast({ title: '仅掌勺者可确认菜单', icon: 'none' }); return }
    if (!chosen.length) { Taro.showToast({ title: '请先选菜', icon: 'none' }); return }
    try {
      setBusy(true)
      const plan = await repository.confirmPlan({
        title: meal === 'dinner' ? '家庭晚餐' : '家庭午餐', mealType: meal,
        servings: people, recipeIds: chosen, portions,
      })
      // 菜单确认后立即按快照生成/同步采购清单
      await repository.generateShopping(plan.id)
      refresh(); setSheet(null); setTab('shop')
      setChosen([]); setManualPicks([]); setExcludedIds([]); setStapleId(null); setStapleOff(false); setStapleHint('')
      Taro.showToast({ title: '菜单已确认，清单已生成', icon: 'success' })
    } catch (e) { Taro.showToast({ title: '确认失败：' + errText(e), icon: 'none' }) } finally { setBusy(false) }
  }

  /* ---------------- 采购 ---------------- */
  const plan = store.plan
  const shopping = store.shopping

  const cycleItem = async (itemId: string) => {
    if (!isOwner) { Taro.showToast({ title: '清单由掌勺者维护', icon: 'none' }); return }
    const item = shopping?.items.find(i => i.id === itemId)
    if (!item) return
    const next = item.status === 'needed' ? 'have' : item.status === 'have' ? 'purchased' : 'needed'
    try { await repository.updateShoppingItem(itemId, { status: next }); refresh() } catch (e) { Taro.showToast({ title: errText(e), icon: 'none' }) }
  }

  const copyShopping = () => {
    if (!shopping) return
    const lines = shopping.items.filter(i => i.status === 'needed')
      .map(i => `${i.name} ${i.displayQuantity || ''}`)
    Taro.setClipboardData({ data: (plan ? plan.title + '\n' : '') + lines.join('\n') })
  }

  /* ---------------- 语音 / 卡牌 / 记录 ---------------- */
  const toggleRecord = async () => {
    if (isH5) { Taro.showToast({ title: '浏览器版暂不支持录音，请用文字描述', icon: 'none' }); return }
    if (isDemoMode()) { Taro.showToast({ title: '演示模式不支持语音', icon: 'none' }); return }
    if (!session) { Taro.showToast({ title: '尚未登录', icon: 'none' }); return }
    if (recording || isRecording()) {
      try {
        Taro.showLoading({ title: '转写中' })
        const { tempFilePath } = await stopRecording()
        setRecording(false)
        const text = await transcribeRecording(tempFilePath)
        setAiText(v => (v ? v + '\n' : '') + text)
        Taro.hideLoading(); Taro.showToast({ title: '已转写', icon: 'success' })
      } catch (e) {
        Taro.hideLoading(); setRecording(false)
        const msg = errText(e)
        if (msg.includes('STT_PROVIDER_NOT_CONFIGURED')) Taro.showModal({ title: '语音转写未配置', content: '请改用文字描述。', showCancel: false })
        else Taro.showToast({ title: '语音失败：' + msg, icon: 'none' })
      }
      return
    }
    try { startRecording(); setRecording(true); Taro.showToast({ title: '录音中，再点结束', icon: 'none' }) }
    catch (e) { Taro.showToast({ title: '无法启动录音：' + errText(e), icon: 'none' }) }
  }

  const exportCard = async (r: Recipe) => {
    if (cardBusy) return
    setCardBusy(true)
    try {
      Taro.showLoading({ title: '生成菜谱卡' })
      if (isH5) {
        // 浏览器：离屏 Canvas 全量合成 → PNG 下载（内容多自动增高，不截断步骤）
        const coverUrl = r.coverKey ? (covers[r.coverKey] || await resolveImageUrl(r.coverKey).catch(() => '')) : (r.coverUrl || '')
        await exportCardH5(r, coverUrl || undefined)
        Taro.hideLoading(); Taro.showToast({ title: 'PNG 已生成，请在浏览器下载中查看', icon: 'none' })
        return
      }
      const dpr = Math.min(Taro.getSystemInfoSync().pixelRatio || 2, 3)
      const { canvas, ctx } = await getCardCanvas()
      const realMeasure = (text: string, font: string) => { ctx.font = font; return ctx.measureText(text).width }
      const coverUrl = r.coverKey ? (covers[r.coverKey] || await resolveImageUrl(r.coverKey).catch(() => '')) : ''
      const layout = layoutCard(r, !!coverUrl, realMeasure)
      canvas.width = Math.round(CARD_W * dpr); canvas.height = Math.round(layout.height * dpr)
      const cover = coverUrl ? await loadCoverImage(canvas, coverUrl).catch(() => undefined) : undefined
      drawCard(ctx, r, layout, dpr, cover)
      const filePath = await exportCardImage(canvas, CARD_W, layout.height, dpr)
      await saveCardToAlbum(filePath)
      Taro.hideLoading(); Taro.showToast({ title: '菜谱卡已保存到相册', icon: 'success' })
    } catch (e) {
      Taro.hideLoading()
      const msg = errText(e)
      if (msg === 'ALBUM_PERMISSION_DENIED') Taro.showToast({ title: '未获得相册权限', icon: 'none' })
      else Taro.showToast({ title: '生成失败：' + msg, icon: 'none' })
    } finally { setCardBusy(false) }
  }

  const openLog = () => {
    if (!plan) return
    setLogDishIds(plan.items.map(i => i.recipeId).filter(Boolean) as string[])
    setLogRating(0); setLogNotes('')
    setSheet('log')
  }

  /** 制作记录：用户明确勾选本次做过的菜；未评分留空，不替用户打分 */
  const saveLog = async () => {
    if (!plan) return
    if (!logDishIds.length) { Taro.showToast({ title: '请勾选本次做过的菜', icon: 'none' }); return }
    try {
      setBusy(true)
      for (const recipeId of logDishIds) {
        await repository.addCookingLog({
          recipeId, mealPlanId: plan.id, notes: logNotes,
          rating: logRating > 0 ? logRating : undefined, photos: [],
        })
      }
      setLogNotes(''); setSheet(null); refresh()
      Taro.showToast({ title: `已记录 ${logDishIds.length} 道菜的制作`, icon: 'success' })
    } catch (e) { Taro.showToast({ title: '保存失败：' + errText(e), icon: 'none' }) } finally { setBusy(false) }
  }

  /* ---------------- 空间 / 试用 ---------------- */
  const submitTrialCode = async () => {
    if (!trialCode.trim()) { Taro.showToast({ title: '请输入试用码', icon: 'none' }); return }
    try {
      setBusy(true); setLoading(true)
      await loginWithTrialCode(trialCode)
      const s = await ensureSession()
      setSession(s); setTrialRequired(false); setTrialCode('')
      await repository.refresh(); refresh()
      if (s.role === 'owner') await repository.refreshRequests().catch(() => {})
      refresh(); Taro.showToast({ title: '已进入「' + s.space.name + '」', icon: 'success' })
    } catch (e) {
      const msg = errText(e)
      if (msg === 'TRIAL_LOGIN_DISABLED') Taro.showModal({ title: '试用入口未开启', content: '请配置 AppID/AppSecret 或联系管理员。', showCancel: false })
      else if (msg === 'TRIAL_CODE_INVALID') Taro.showToast({ title: '试用码不正确', icon: 'none' })
      else Taro.showToast({ title: '登录失败：' + msg, icon: 'none' })
    } finally { setBusy(false); setLoading(false) }
  }

  const joinSpace = async () => {
    if (!joinCode.trim()) { Taro.showToast({ title: '请输入邀请码', icon: 'none' }); return }
    try {
      setBusy(true)
      await joinSpaceByCode(joinCode)
      const s = await ensureSession()
      setSession(s); await repository.refresh(); refresh()
      setJoinCode(''); Taro.showToast({ title: '已加入新空间', icon: 'success' })
    } catch (e) { Taro.showToast({ title: '加入失败：' + errText(e), icon: 'none' }) } finally { setBusy(false) }
  }

  const switchDemoRole = (role: Role) => {
    setDemoRole(role)
    Taro.setStorageSync(DEMO_ROLE_KEY, role)
  }

  useShareAppMessage(() => ({
    title: detailRecipe ? `「${detailRecipe.title}」· 我的料理图鉴` : '我的料理图鉴',
    path: '/pages/index/index',
  }))

  /* ================= 渲染 ================= */
  const chosenRecipes = chosen.map(id => recipes.find(r => r.id === id)).filter(Boolean) as Recipe[]
  const browseList = recipes.filter(r =>
    (browseCat === '全部' || r.category === browseCat) && r.title.includes(browseQuery))

  const shopReady = shopping ? shopping.items.filter(i => i.status !== 'needed').length : 0
  const shopTotal = shopping ? shopping.items.length : 0
  const groupOf = (name: string) => /肉|排|鸡|鱼|牛|虾|蛋|面|米|饭/.test(name) ? '主食与肉蛋' : /油|盐|酱|醋|糖|椒|料|酒/.test(name) ? '调味与其他' : '蔬菜与配料'
  const heroCooked = hero ? store.cookingLogs.filter(l => l.recipeId === hero.id).length : 0
  const chosenComposition = compositionText(chosenRecipes.map(r => ({ id: r.id, title: r.title, category: r.category })))
  const planComposition = plan ? compositionText(
    plan.items.map(i => ({ id: i.recipeId, title: i.recipeTitle })),
    id => recipes.find(r => r.id === id)?.category) : ''

  return <View className='page'>
    {/* ===== 顶部品牌 ===== */}
    <View className='appbar'>
      <View className='brand'><Icon name='atlas' size={21} /><Text>料理图鉴</Text></View>
      <View className='appbar-right'>
        {isDemoMode() && <Text className='demo-badge'>演示数据</Text>}
        <View className='iconbtn' onClick={() => { setBrowseMode('detail'); setSheet('browse') }}><Icon name='search' size={19} /></View>
      </View>
    </View>

    {trialRequired && !loading && <View className='panel' style={{ marginTop: '20rpx' }}>
      <Text className='h3' style={{ margin: 0 }}>输入试用码进入</Text>
      <Input className='field' placeholder='试用码' value={trialCode} onInput={e => setTrialCode(e.detail.value)} />
      <Button className='cta' loading={busy} onClick={submitTrialCode}>进入试用</Button>
    </View>}

    {/* ===== 图鉴 ===== */}
    {tab === 'home' && (!recipes.length ? <View className='empty'>
      <Text className='h3'>还没有菜谱</Text>
      <Text className='subtitle'>{isOwner ? '录入第一道菜，开始你的料理图鉴。' : '等掌勺者收录菜谱后，就可以点菜了。'}</Text>
      {isOwner && <Button className='cta' onClick={() => openAdd()}>录入菜谱</Button>}
    </View> : <View>
      <View className='head-row' style={{ marginTop: '16rpx' }}>
        <View><Text className='h2'>我的料理图鉴</Text></View>
      </View>
      <Text className='subtitle'>已收录 {recipes.length} 道菜 · 我的收藏 {favorites.length} 道</Text>
      {hero && <HeroStack
        recipe={recipeWithCover(hero)}
        serial={heroSerial}
        cooked={heroCooked}
        sample={isSampleCover(hero.id)}
        onDetail={() => openDetail(recipeWithCover(hero))}
      />}
      <View className='paired'>
        {isOwner
          ? <Button className='cta' onClick={() => openAdd()}>录入菜谱</Button>
          : <Button className='cta ghost' onClick={() => openDetail(recipeWithCover(hero!))}>查看菜谱</Button>}
        <Button className='cta ghost' onClick={() => setHeroIdx(i => (i + 1) % recipes.length)}>下一张 <Icon name='next' size={15} /></Button>
      </View>
      <View className='section-head'>
        <Text className='h3'>{favorites.length ? '我的收藏' : '已收录菜谱'}</Text>
        <Text className='textbtn' onClick={() => { setBrowseMode('detail'); setSheet('browse') }}>全部菜谱 ›</Text>
      </View>
      <View className='mini-grid'>
        {(favorites.length ? favorites : recipes).slice(0, 2).map(r => (
          <View key={r.id} className='mini-card' onClick={() => openDetail(recipeWithCover(r))}>
            <View className='mini-photo'><Cover url={recipeWithCover(r).coverUrl} sample={isSampleCover(r.id)} /></View>
            <Text className='mini-title'>{r.title}</Text>
            <Text className='mini-sub'>{r.cookingMinutes || '—'} 分钟 · {r.category}</Text>
          </View>
        ))}
      </View>
      <View className='family-note'>
        <Text>家人点菜：{wishTitles.length ? wishTitles.slice(0, 3).join('、') : '暂无'}</Text>
        <Text className='textbtn' onClick={() => setTab('menu')}>查看 ›</Text>
      </View>
    </View>)}

    {/* ===== 点菜 ===== */}
    {tab === 'menu' && <View>
      <Text className='h2 menu-title'>{isOwner ? (meal === 'dinner' ? '今晚吃什么' : '午餐吃什么') : '我来点菜'}</Text>
      <Text className='subtitle'>{isOwner ? '按人数搭配，也可以自己选' : '选好后提交，交给掌勺者安排'}</Text>
      <View className='config'>
        <View className='segment'>
          <Text className={`seg-btn ${meal === 'lunch' ? 'on' : ''}`} onClick={() => setMeal('lunch')}>午餐</Text>
          <Text className={`seg-btn ${meal === 'dinner' ? 'on' : ''}`} onClick={() => setMeal('dinner')}>晚餐</Text>
        </View>
        <View className='people'>
          <Text className='pbtn' onClick={() => bumpPeople(-1)}>−</Text>
          <Text className='people-num'>{people} 人</Text>
          <Text className='pbtn' onClick={() => bumpPeople(1)}>＋</Text>
        </View>
      </View>
      <View className='staple-row' onClick={() => setSheet('staple')}>
        <Text className='staple-label'>主食</Text>
        <Text className='staple-value'>{stapleLabel}</Text>
        <Text className='staple-arrow'>›</Text>
      </View>
      {stapleHint && !stapleOff && <View className='staple-hint'>
        <Text>{stapleHint}</Text>
        <Text className='textbtn' onClick={() => setSheet('staple')}>去选择 ›</Text>
        {isOwner && <Text className='textbtn' onClick={() => openAdd()}>录入主食</Text>}
      </View>}
      <View className='family-request'>
        <Text className='avatar'>家</Text>
        <Text style={{ flex: 1 }}>{wishTitles.length ? `家人点的菜：${wishTitles.slice(0, 4).join('、')}` : '还没有家人点菜，先选一两道喜欢的。'}</Text>
      </View>
      {chosenRecipes.length
        ? <FanCards items={chosenRecipes.map(recipeWithCover)} wishIds={wishIds} sampleIds={store.sampleCoverIds || []} onDetail={openDetail} />
        : <View className='empty' style={{ padding: '40rpx 20rpx' }}>
            <Text className='subtitle'>先从图鉴挑几道想吃的，{'\n'}或让推荐来一桌搭配。</Text>
          </View>}
      <Text className='draw-hint'>保留家人点的菜和手动选择，再补充其他搭配</Text>
      <Button className='cta' onClick={chosenRecipes.length ? reroll : recommend} loading={busy}>
        {chosenRecipes.length ? '换一组推荐' : '推荐一桌菜'} <Icon name='shuffle' size={15} />
      </Button>
      <View className='panel'>
        <View className='panel-top'>
          <Text>{isOwner ? `待确认菜单${chosenRecipes.length ? `（${chosenComposition}）` : ''}` : '我想吃这些'}</Text>
          <Text className='textbtn' onClick={() => { setBrowseMode('pick'); setSheet('browse') }}>＋ 加一道</Text>
        </View>
        {chosenRecipes.map(r => {
          const isWish = wishIds.includes(r.id), isManual = manualPicks.includes(r.id), isStaple = dishRole(r) === 'staple'
          return <View className='recipe-row' key={r.id}>
            <View className='thumb'><Cover url={recipeWithCover(r).coverUrl} label='未上传照片' sample={isSampleCover(r.id)} /></View>
            <View className='copy'>
              <Text className='row-title'>{r.title}</Text>
              <Text className='row-sub'>{isWish ? '家人点菜 · 重新推荐时保留' : isManual ? '手动选择 · 保留' : isStaple ? '主食' : '已收录菜谱'}</Text>
            </View>
            <View className='row-action' onClick={() => removeDish(r.id)}><Text>✕</Text></View>
          </View>
        })}
        {!chosenRecipes.length && <Text className='mini'>还没有选择菜品。</Text>}
      </View>
      {!isOwner && <Input className='field' placeholder='给掌勺者的备注：少辣、想喝汤…' value={orderNote} onInput={e => setOrderNote(e.detail.value)} style={{ marginTop: '20rpx' }} />}
      {isOwner
        ? <Button className='cta' onClick={() => setSheet('review')}>确认菜单 →</Button>
        : <Button className='cta' onClick={submitOrder} loading={busy}>提交我的点菜</Button>}
      {!isOwner && <Text className='helper'>点菜还不是最终菜单。掌勺者确认后再生成采购清单。</Text>}
    </View>}

    {/* ===== 采购 ===== */}
    {tab === 'shop' && (!plan || !shopping ? <View className='empty'>
      <Text className='h3'>还没有采购清单</Text>
      <Text className='subtitle'>只有掌勺者确认过的菜单，{'\n'}才会生成采购清单。</Text>
      <Button className='cta' onClick={() => setTab('menu')}>去确认菜单 →</Button>
    </View> : <View>
      <View className='head-row' style={{ marginTop: '12rpx' }}>
        <Text className='h2'>采购清单</Text>
        <Text className='pill'>{plan.servings} 人份</Text>
      </View>
      <Text className='subtitle'>{plan.title} · {planComposition}</Text>
      <View className='shop-hero'>
        <View>
          <Text className='count'><Text className='count-num'>{shopReady}</Text><Text className='count-total'> / {shopTotal}</Text></Text>
          <Text className='mini' style={{ color: '#64796c' }}>已备齐 · 含家中已有</Text>
          <View className='meter'><View style={{ width: `${shopTotal ? (shopReady / shopTotal * 100) : 0}%`, height: '100%', background: '#2d604e' }} /></View>
        </View>
      </View>
      {SHOP_GROUPS.map(group => {
        const rows = shopping.items.filter(i => groupOf(i.name) === group)
        if (!rows.length) return null
        return <View key={group}>
          <View className='shop-head'><Text>{group}</Text><Text>{isOwner ? '点状态格切换' : '只读'}</Text></View>
          <View className='shop-group'>
            {rows.map(x => <View key={x.id} className={`shop-row ${x.status !== 'needed' ? 'done' : ''} ${x.status === 'purchased' ? 'bought' : ''}`}>
              <View className={`check ${x.status !== 'needed' ? 'done' : ''}`} onClick={() => cycleItem(x.id)}>
                {x.status === 'have' && <Icon name='home' size={17} />}
                {x.status === 'purchased' && <Text>✓</Text>}
              </View>
              <View className='name' onClick={() => cycleItem(x.id)}>
                <Text>{x.name}</Text>
                {x.status === 'have' && <Text className='mini'>家中已有</Text>}
                {x.status === 'purchased' && <Text className='mini'>已购买</Text>}
                {/待补充|适量|待核对/.test(x.displayQuantity || '') && <Text className='mini'>含待核对用量</Text>}
              </View>
              <Text className='qty'>{x.displayQuantity || '—'}</Text>
            </View>)}
          </View>
        </View>
      })}
      <View className='at-home'>
        <Text>{isOwner ? '点状态格按 待购 → 家中已有 → 已购买 切换。' : '这份清单由掌勺者维护；你可以复制清单帮忙买菜。'}</Text>
      </View>
      <Button className='cta ghost' onClick={copyShopping}>复制待购清单</Button>
      {isOwner && <Button className='linkline' onClick={openLog}>记录本次制作 →</Button>}
    </View>)}

    {/* ===== 我的 ===== */}
    {tab === 'profile' && <View>
      <View className='profile-hero'>
        <Text className='avatar'>{session?.user?.displayName?.[0] || '我'}</Text>
        <Text className='h2'>{session?.space?.name || (isDemoMode() ? '演示家庭' : '我的料理图鉴')}</Text>
        <Text className='subtitle'>{isOwner ? '掌勺者 · 管理菜谱与确认菜单' : '家庭成员 · 浏览菜谱与点菜'}</Text>
        <View className='profile-stat'>
          <View><Text className='stat-num'>{recipes.length}</Text><Text className='stat-sub'>已收录菜谱</Text></View>
          <View><Text className='stat-num'>{store.favoriteIds.length}</Text><Text className='stat-sub'>我的收藏</Text></View>
          <View><Text className='stat-num'>{store.cookingLogs.length}</Text><Text className='stat-sub'>制作记录</Text></View>
        </View>
      </View>
      {isDemoMode() && <View className='panel' style={{ marginTop: '30rpx' }}>
        <View className='panel-top'><Text>演示角色</Text><Text className='mini'>仅演示模式可切换，非生产权限</Text></View>
        <View className='chips'>
          <Text className={`chip ${demoRole === 'owner' ? 'on' : ''}`} onClick={() => switchDemoRole('owner')}>掌勺者</Text>
          <Text className={`chip ${demoRole === 'member' ? 'on' : ''}`} onClick={() => switchDemoRole('member')}>家人</Text>
        </View>
      </View>}
      {session?.space.inviteCode && <View className='panel' style={{ marginTop: '30rpx' }}>
        <View className='panel-top'><Text>邀请家人</Text></View>
        <View className='recipe-row' onClick={() => Taro.setClipboardData({ data: session.space.inviteCode! })}>
          <View className='copy'><Text className='row-title'>{session.space.inviteCode}</Text><Text className='row-sub'>点击复制邀请码</Text></View>
          {!isH5 && <Button className='textbtn' openType='share'>分享</Button>}
        </View>
      </View>}
      <View className='panel' style={{ marginTop: '20rpx' }}>
        <View className='panel-top'><Text>家庭制作记录</Text></View>
        {store.cookingLogs.slice(0, 10).map(l => {
          const r = recipes.find(x => x.id === l.recipeId)
          return <View className='recipe-row' key={l.id}>
            <View className='copy'><Text className='row-title'>{r?.title || '已删除菜谱'}</Text><Text className='row-sub'>{l.notes ? l.notes : '未填写心得'} · {l.cookedAt.slice(0, 10)}</Text></View>
            {!!l.rating && <Text className='stars'>{'★'.repeat(l.rating)}</Text>}
          </View>
        })}
        {!store.cookingLogs.length && <Text className='mini'>做完一顿饭，可以在采购页记录本次制作。</Text>}
      </View>
      {!isDemoMode() && <View className='panel' style={{ marginTop: '20rpx' }}>
        <View className='panel-top'><Text>加入其他家庭空间</Text></View>
        <Input className='field' placeholder='输入邀请码' value={joinCode} onInput={e => setJoinCode(e.detail.value)} />
        <Button className='cta ghost' onClick={joinSpace} loading={busy}>加入家庭空间</Button>
      </View>}
    </View>}

    {/* ===== 底部导航 ===== */}
    <View className='tabbar'>
      {([['home', 'atlas', '图鉴'], ['menu', 'plate', '点菜'], ['shop', 'bag', '采购'], ['profile', 'apron', '我的']] as [Tab, string, string][]).map(([key, ic, title]) => (
        <View key={key} className={`nav ${tab === key ? 'on' : ''}`} onClick={() => setTab(key)}>
          <Icon name={ic} size={24} /><Text>{title}</Text>
        </View>
      ))}
    </View>

    {/* ===== 卡牌导出画布（保留） ===== */}
    <Canvas type='2d' id='recipe-card' className='cardCanvas' />

    {/* ===== 弹层：详情 ===== */}
    <Sheet open={sheet === 'detail'} label='菜谱详情' onClose={() => setSheet(null)}>
      {detailRecipe && <View>
        <View className='dish-large'><Cover url={detailRecipe.coverUrl} sample={detailRecipe.id ? isSampleCover(detailRecipe.id) : false} /></View>
        <View className='head-row'>
          <Text className='h2' style={{ fontSize: '48rpx' }}>{detailRecipe.title}</Text>
          <View className='iconbtn' onClick={() => toggleFavorite(detailRecipe.id)}>
            <Icon name={store.favoriteIds.includes(detailRecipe.id) ? 'heart-on' : 'heart'} size={20} />
          </View>
        </View>
        <View className='detail-meta'>
          <Text className='pill'>{detailRecipe.category}</Text>
          <Text className='pill'>{detailRecipe.cookingMinutes || '—'} 分钟</Text>
          <Text className='pill'>原配方 {detailRecipe.servings || 2} 人份</Text>
        </View>
        {!!detailRecipe.description && <Text className='mini'>{detailRecipe.description}</Text>}
        <Text className='h3'>食材</Text>
        {detailRecipe.ingredients.map((i, idx) => <View className='ing-line' key={idx}>
          <Text>{i.name}</Text><Text className='q'>{amount(i.quantity, i.unit)}</Text>
        </View>)}
        <Text className='h3'>做法</Text>
        {(detailRecipe.steps || []).map((s, i) => <View className='step-line' key={i}>
          <Text className='n'>{i + 1}</Text><Text style={{ flex: 1 }}>{s.content}</Text>
        </View>)}
        <View className='paired'>
          <Button className='cta' onClick={() => pickToOrder(detailRecipe)}>加入点菜 ＋</Button>
          <Button className='cta ghost' onClick={() => exportCard(detailRecipe)} loading={cardBusy}>导出菜谱卡</Button>
        </View>
        {isOwner && <Button className='linkline' onClick={() => openAdd(detailRecipe)}>编辑菜谱 →</Button>}
      </View>}
    </Sheet>

    {/* ===== 弹层：浏览图鉴 ===== */}
    <Sheet open={sheet === 'browse'} label='浏览图鉴' onClose={() => setSheet(null)}>
      <Text className='h2' style={{ fontSize: '44rpx' }}>{browseMode === 'pick' ? '加一道想吃的' : '全部菜谱'}</Text>
      <Input className='field' placeholder='搜索菜名' value={browseQuery} onInput={e => setBrowseQuery(e.detail.value)} />
      <View className='chips'>
        {CATS.map(c => <Text key={c} className={`chip ${browseCat === c ? 'on' : ''}`} onClick={() => setBrowseCat(c)}>{c}</Text>)}
      </View>
      {browseList.map(r => <View className='recipe-row' key={r.id}>
        <View className='thumb'><Cover url={recipeWithCover(r).coverUrl} label='未上传照片' sample={isSampleCover(r.id)} /></View>
        <View className='copy'>
          <Text className='row-title'>{r.title}</Text>
          <Text className='row-sub'>{r.cookingMinutes} 分钟 · {r.category}</Text>
        </View>
        <View className='row-action' onClick={() => {
          if (browseMode === 'pick') {
            if (!chosen.includes(r.id)) { setChosen(c => [...c, r.id]); setPortions(p => ({ ...p, [r.id]: people })) }
            addManualPick(r.id)
            setSheet(null); setTab('menu')
          } else { openDetail(recipeWithCover(r)) }
        }}><Text>›</Text></View>
      </View>)}
      {!browseList.length && <Text className='mini'>没有匹配的菜，换个词试试。</Text>}
    </Sheet>

    {/* ===== 弹层：主食选择 ===== */}
    <Sheet open={sheet === 'staple'} label='选择主食' onClose={() => setSheet(null)}>
      <Text className='h2' style={{ fontSize: '44rpx' }}>这一餐的主食</Text>
      <Text className='subtitle'>米饭、馒头等配餐主食搭配菜肴；汤面、炒饭、饺子是一餐式主食，本身就是这餐主体。</Text>
      <View className='staple-option' onClick={() => pickStaple('auto')}>
        <View className='copy'><Text className='row-title'>自动搭配</Text><Text className='row-sub'>推荐时从图鉴主食中选择</Text></View>
        <Text className={`radio ${!stapleOff && !stapleId ? 'on' : ''}`} />
      </View>
      {stapleRecipes.map(r => <View className='staple-option' key={r.id} onClick={() => pickStaple(r.id)}>
        <View className='thumb'><Cover url={recipeWithCover(r).coverUrl} label='未上传照片' sample={isSampleCover(r.id)} /></View>
        <View className='copy'>
          <Text className='row-title'>{r.title}{wishIds.includes(r.id) ? ' · 家人点菜' : ''}</Text>
          <Text className='row-sub'>{STAPLE_SIDE_LABEL[stapleKind(r)]} · 原配方 {r.servings} 人份</Text>
        </View>
        <Text className={`radio ${stapleId === r.id ? 'on' : ''}`} />
      </View>)}
      <View className='staple-option' onClick={() => pickStaple('off')}>
        <View className='copy'><Text className='row-title'>本餐不安排主食</Text><Text className='row-sub'>推荐不再补主食</Text></View>
        <Text className={`radio ${stapleOff ? 'on' : ''}`} />
      </View>
      {!stapleRecipes.length && <Text className='mini'>图鉴还没有主食菜谱，可先在图鉴录入（分类选「主食」）。</Text>}
    </Sheet>

    {/* ===== 弹层：录入（AI/手动） ===== */}
    <Sheet open={sheet === 'add'} label={editId ? '编辑菜谱' : '录入菜谱'} onClose={() => setSheet(null)}>
      <Text className='h2' style={{ fontSize: '44rpx' }}>{editId ? '编辑菜谱' : '录入菜谱'}</Text>
      <Text className='subtitle'>填写食材与做法，核对后保存。</Text>
      <View className='chips'>
        <Text className={`chip ${importMode === 'ai' ? 'on' : ''}`} onClick={() => setImportMode('ai')}>AI 帮我整理</Text>
        <Text className={`chip ${importMode === 'manual' ? 'on' : ''}`} onClick={() => setImportMode('manual')}>手动填写</Text>
      </View>
      {importMode === 'ai' ? <View>
        <Input className='field' placeholder='菜名，例如：番茄炒蛋' value={aiTitle} onInput={e => setAiTitle(e.detail.value)} />
        <Textarea className='field area' placeholder='说说你怎么做的：用了什么、怎么做的、有什么心得…' value={aiText} onInput={e => setAiText(e.detail.value)} />
        <Button className='upload' onClick={chooseCover}><Icon name='camera' size={18} /> {aiPreview ? '已选成品照 · 重选' : '选择一张成品照'}</Button>
        {aiPreview ? <Image className='upload-preview' src={aiPreview} mode='aspectFill' /> : null}
        <Button className='cta ghost' style={recording ? { background: '#c9564a', color: '#fff' } : {}} onClick={toggleRecord}>
          {recording ? '结束录音并转写' : '语音描述这道菜'}
        </Button>
        <Button className='cta' onClick={parseAI}>整理成草稿 →</Button>
        <Text className='helper'>AI 只做整理，不补造用量；生成后请核对再保存。</Text>
      </View> : <View>
        <Input className='field' placeholder='菜名' value={mTitle} onInput={e => setMTitle(e.detail.value)} />
        <View className='form-pair'>
          <Input className='field' type='number' placeholder='几人份' value={mServings} onInput={e => setMServings(e.detail.value)} />
          <Input className='field' type='number' placeholder='预计分钟' value={mMinutes} onInput={e => setMMinutes(e.detail.value)} />
        </View>
        <View className='chips'>{CATS.slice(1).map(c => <Text key={c} className={`chip ${mCategory === c ? 'on' : ''}`} onClick={() => setMCategory(c)}>{c}</Text>)}</View>
        <Textarea className='field area' placeholder={'食材与用量 · 每行一项\n番茄：2个\n盐：适量'} value={mIng} onInput={e => setMIng(e.detail.value)} />
        <Textarea className='field area' placeholder={'制作步骤 · 每行一步\n记录自己的真实做法'} value={mSteps} onInput={e => setMSteps(e.detail.value)} />
        <Textarea className='field area' placeholder='心得（可选）' value={mDesc} onInput={e => setMDesc(e.detail.value)} />
        <Button className='upload' onClick={chooseCover}><Icon name='camera' size={18} /> {aiPreview ? '已选成品照 · 重选' : '选择一张成品照'}</Button>
        {aiPreview ? <Image className='upload-preview' src={aiPreview} mode='aspectFill' /> : null}
        {editId && aiPreview && coverAction === 'keep' && <Button className='linkline' onClick={clearCover}>移除现有成品照 →</Button>}
        {coverAction === 'clear' && <Text className='helper'>保存后将移除原成品照。</Text>}
        <Button className='cta' onClick={saveRecipe} loading={busy}>{editId ? '保存修改' : '保存菜谱'}</Button>
        <Text className='helper'>不清楚的用量写「适量」，不要为了完整而猜数值。</Text>
      </View>}
    </Sheet>

    {/* ===== 弹层：掌勺者确认 ===== */}
    <Sheet open={sheet === 'review'} label='确认菜单' onClose={() => setSheet(null)}>
      <Text className='h2' style={{ fontSize: '44rpx' }}>确认菜单</Text>
      <Text className='subtitle'>{people} 人 · {chosenComposition} · {meal === 'dinner' ? '晚餐' : '午餐'}</Text>
      {chosenRecipes.map(r => <View className='recipe-row' key={r.id}>
        <View className='thumb'><Cover url={recipeWithCover(r).coverUrl} label='未上传照片' sample={isSampleCover(r.id)} /></View>
        <View className='copy'>
          <Text className='row-title'>{r.title}</Text>
          <Text className='row-sub'>原配方 {r.servings || 2} 人份 · 计划</Text>
        </View>
        <Input className='portion-input' type='number' value={String(portions[r.id] ?? people)} onInput={e => setPortions(p => ({ ...p, [r.id]: Math.max(1, Number(e.detail.value) || 1) }))} />
        <View className='row-action' onClick={() => removeDish(r.id)}><Text>✕</Text></View>
      </View>)}
      <View className='tip'>人数不等于每道菜的份量；按每道菜实际要做的计划份数算，未知用量标待核对。</View>
      <Button className='cta' onClick={confirmPlan} loading={busy}>确认菜单，生成采购清单 →</Button>
    </Sheet>

    {/* ===== 弹层：记录制作 ===== */}
    <Sheet open={sheet === 'log'} label='制作记录' onClose={() => setSheet(null)}>
      <Text className='h2' style={{ fontSize: '44rpx' }}>记录本次制作</Text>
      <Text className='subtitle'>勾选这次实际做过的菜；评分可选，不打也可以。</Text>
      <View className='panel' style={{ marginTop: '20rpx', padding: '10rpx 26rpx' }}>
        {plan?.items.map(i => { const id = i.recipeId!; return <View className='recipe-row' key={id} onClick={() =>
          setLogDishIds(v => v.includes(id) ? v.filter(x => x !== id) : [...v, id])}>
          <View className={`check ${logDishIds.includes(id) ? 'done' : ''}`}>{logDishIds.includes(id) && <Text>✓</Text>}</View>
          <View className='copy'><Text className='row-title'>{i.recipeTitle}</Text><Text className='row-sub'>计划 {i.plannedServings || plan.servings} 人份</Text></View>
        </View> })}
      </View>
      <View className='star-row'>
        <Text className='mini' style={{ marginRight: '16rpx' }}>评分（可选）</Text>
        {[1, 2, 3, 4, 5].map(n => <Text key={n} className={`star ${logRating >= n ? 'on' : ''}`} onClick={() => setLogRating(v => v === n ? 0 : n)}>★</Text>)}
      </View>
      <Textarea className='field area' placeholder='火候、调味、家人的评价……' value={logNotes} onInput={e => setLogNotes(e.detail.value)} />
      <Button className='cta' onClick={saveLog} loading={busy}>保存制作记录</Button>
    </Sheet>

    {loading && <View className='warm-toast' style={{ opacity: 1 }}>正在登录并加载家庭数据…</View>}
  </View>
}
