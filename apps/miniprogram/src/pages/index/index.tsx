import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, Input, Textarea, Button, Image, Canvas } from '@tarojs/components'
import Taro, { useShareAppMessage } from '@tarojs/taro'
import { repository, isDemoMode } from '../../services/repository'
import { ensureSession, joinSpaceByCode, uploadImage, resolveImageUrl, getActiveSpaceId, apiRequest, loginWithTrialCode } from '../../services/api'
import { startRecording, stopRecording, transcribeRecording, isRecording } from '../../services/recorder'
import { CARD_W, layoutCard, drawCard, getCardCanvas, loadCoverImage, exportCardImage, saveCardToAlbum } from '../../services/card'
import HeroStack from '../../components/HeroStack'
import FanCards from '../../components/FanCards'
import Sheet from '../../components/Sheet'
import { fallbackCover } from '../../services/coverMap'
import type { Recipe, Ingredient } from '@cooking-atlas/shared'
import './index.scss'

type Tab = 'home' | 'menu' | 'shop' | 'profile'
type SheetKind = null | 'detail' | 'add' | 'browse' | 'review' | 'log'

const CATS = ['全部', '荤菜', '素菜', '汤羹', '主食', '家常菜', '甜品']
const SHOP_GROUPS = ['主食与肉蛋', '蔬菜与配料', '调味与其他']
const errText = (e: unknown) => String((e as Error)?.message || e)
const amount = (q: number | null | undefined, u: string) =>
  q == null ? (u === '适量' ? '适量' : '待核对') : `${Number(q.toFixed(2))} ${u}`

interface Session {
  user: { id: string; displayName?: string }
  space: { id: string; name: string; inviteCode?: string }
  role: 'owner' | 'member'
}

export default function Index() {
  const [tab, setTab] = useState<Tab>('home')
  const [store, setStore] = useState(repository.getStore())
  const [loading, setLoading] = useState(!isDemoMode())
  const [session, setSession] = useState<Session | null>(null)
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
  // 录音 / 卡牌
  const [recording, setRecording] = useState(false)
  const [cardBusy, setCardBusy] = useState(false)
  // 制作记录
  const [logNotes, setLogNotes] = useState('')
  // 试用码
  const [trialRequired, setTrialRequired] = useState(false)
  const [trialCode, setTrialCode] = useState('')
  // 加入空间
  const [joinCode, setJoinCode] = useState('')

  const refresh = () => setStore(repository.getStore())
  const isOwner = session?.role === 'owner'
  const recipes = store.recipes
  const hero = recipes.length ? recipes[heroIdx % recipes.length] : null
  const heroSerial = String(((heroIdx % Math.max(recipes.length, 1)) + 1)).padStart(3, '0')

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

  const pickToOrder = (r: Recipe) => {
    if (!chosen.includes(r.id)) {
      setChosen(c => [...c, r.id])
      setPortions(p => ({ ...p, [r.id]: people }))
    }
    setSheet(null); setTab('menu')
    Taro.showToast({ title: '已加入选菜：' + r.title, icon: 'none' })
  }

  /* ---------------- 录入 ---------------- */
  const openAdd = (r?: Recipe) => {
    if (r) {
      setEditId(r.id); setImportMode('manual')
      setMTitle(r.title); setMDesc(r.description || '')
      setMIng(r.ingredients.map(i => `${i.name}：${i.quantity ?? ''}${i.unit}`).join('\n'))
      setMSteps((r.steps || []).map(s => s.content).join('\n'))
      setMServings(String(r.servings || 2)); setMMinutes(String(r.cookingMinutes || 0)); setMCategory(r.category || '家常菜')
    } else {
      setEditId(''); setImportMode('ai')
      setAiTitle(''); setAiText(''); setAiImageKey(''); setAiPreview('')
      setMTitle(''); setMDesc(''); setMIng(''); setMSteps(''); setMServings('2'); setMMinutes('15'); setMCategory('家常菜')
    }
    setSheet('add')
  }

  const chooseCover = async () => {
    try {
      const res = await Taro.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'] })
      const local = res.tempFilePaths[0]
      if (isDemoMode()) { setAiPreview(local); return }
      Taro.showLoading({ title: '上传中' })
      const up = await uploadImage(local, getActiveSpaceId())
      setAiImageKey(up.key); setAiPreview(local)
      Taro.hideLoading(); Taro.showToast({ title: '照片已上传', icon: 'success' })
    } catch (e) { Taro.hideLoading(); Taro.showToast({ title: '上传失败：' + errText(e), icon: 'none' }) }
  }

  const parseAI = async () => {
    if (isDemoMode()) { Taro.showToast({ title: '演示模式不支持 AI 录入', icon: 'none' }); return }
    if (!aiTitle.trim() && !aiImageKey) { Taro.showToast({ title: '请先写菜名或上传照片', icon: 'none' }); return }
    try {
      Taro.showLoading({ title: 'AI 整理中' })
      const res = await apiRequest<{ draft: any }>('/api/ai/recipe-draft', 'POST', { spaceId: getActiveSpaceId(), text: (aiTitle ? `菜名：${aiTitle}\n` : '') + aiText, imageKey: aiImageKey || undefined })
      const d = res.draft || {}
      setMTitle(d.title || aiTitle)
      setMDesc((d.steps || []).map((x: any) => x.content).join('\n') || aiText)
      setMIng((d.ingredients || []).map((x: any) => x.name + '：' + (x.quantity === null || x.quantity === undefined ? '' : x.quantity) + (x.unit || '待补充')).join('\n'))
      setImportMode('manual')
      Taro.hideLoading(); Taro.showToast({ title: '草稿已生成，请核对', icon: 'none' })
    } catch (e) { Taro.hideLoading(); Taro.showModal({ title: 'AI 暂不可用', content: errText(e) + '（输入已保留，可切手动）', showCancel: false }) }
  }

  const parseIngredients = (raw: string): Ingredient[] => raw.split('\n').map(x => x.trim()).filter(Boolean).map(x => {
    const parts = x.split(/[：:]/), a = (parts.slice(1).join(':') || '').trim(), m = a.match(/^(\d+(?:\.\d+)?)\s*(.*)$/)
    return { name: parts[0].trim(), quantity: m ? Number(m[1]) : null, unit: m ? (m[2] || '待补充') : (a || '待补充') }
  })

  const saveRecipe = async () => {
    if (!isOwner && !isDemoMode()) { Taro.showToast({ title: '仅掌勺者可录入', icon: 'none' }); return }
    if (!mTitle.trim()) { Taro.showToast({ title: '请填写菜名', icon: 'none' }); return }
    const ingredients = parseIngredients(mIng)
    if (!ingredients.length) { Taro.showToast({ title: '请至少填写一项食材', icon: 'none' }); return }
    const steps = mSteps.split('\n').map(s => s.trim()).filter(Boolean).map(content => ({ content }))
    const payload = {
      title: mTitle.trim(), category: mCategory, coverKey: aiImageKey || undefined,
      servings: Math.max(1, Number(mServings) || 2), cookingMinutes: Number(mMinutes) || 0,
      difficulty: '待补充', description: mDesc, ingredients, steps,
    }
    try {
      setBusy(true)
      if (editId) {
        await apiRequest(`/api/recipes/${editId}`, 'PUT', { spaceId: getActiveSpaceId(), ...payload })
      } else {
        await repository.createRecipe(payload as any)
      }
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

  const drawMeal = () => {
    // 换一桌（本地兜底）：优先保留已收到的点菜心愿，再按荤素汤主食补齐
    const wishIds = [...new Set(store.requests.flatMap(q => q.recipeIds))].filter(id => recipes.some(r => r.id === id))
    const picked = [...wishIds]
    for (const c of ['素菜', '汤羹', '家常菜', '主食', '荤菜']) {
      const options = recipes.filter(r => r.category === c && !picked.includes(r.id))
      if (options.length) picked.push(options[Math.floor(Math.random() * options.length)].id)
    }
    const target = people === 1 ? 2 : people <= 3 ? 4 : 5
    setChosen(picked.slice(0, Math.max(target, wishIds.length)))
    setPortions(Object.fromEntries(picked.map(id => [id, people])))
    Taro.showToast({ title: `已保留 ${wishIds.length} 道心愿，换好这桌搭配`, icon: 'none' })
  }

  const recommend = async () => {
    if (isDemoMode()) { drawMeal(); return }
    try {
      setBusy(true)
      const rec = await repository.recommend({ servings: people, mealType: meal, requestedRecipeIds: chosen })
      setChosen(rec.items.map(x => x.recipeId))
      setPortions(Object.fromEntries(rec.items.map(x => [x.recipeId, people])))
      refresh()
      Taro.showToast({ title: `AI 配好 ${rec.items.length} 道`, icon: 'none' })
    } catch (e) {
      // 服务端推荐不可用时降级为本地搭配，不阻塞交互
      drawMeal()
    } finally { setBusy(false) }
  }

  const submitOrder = async () => {
    if (isDemoMode()) { Taro.showToast({ title: '演示模式不支持点菜', icon: 'none' }); return }
    if (!session) { Taro.showToast({ title: '尚未登录', icon: 'none' }); return }
    if (!chosen.length) { Taro.showToast({ title: '请先选择想吃的菜', icon: 'none' }); return }
    try {
      setBusy(true)
      await repository.submitMealRequest({ mealType: meal, servings: people, recipeIds: chosen, note: orderNote })
      setChosen([]); setOrderNote(''); refresh()
      Taro.showToast({ title: '心愿已提交，等掌勺者安排', icon: 'success' })
    } catch (e) { Taro.showToast({ title: '提交失败：' + errText(e), icon: 'none' }) } finally { setBusy(false) }
  }

  const confirmPlan = async () => {
    if (!isOwner) { Taro.showToast({ title: '仅掌勺者可确认菜单', icon: 'none' }); return }
    if (!chosen.length) { Taro.showToast({ title: '请先选菜', icon: 'none' }); return }
    try {
      setBusy(true)
      const plan = await repository.confirmPlan({
        title: meal === 'dinner' ? '家庭晚餐' : '家庭午餐', mealType: meal,
        servings: people, recipeIds: chosen,
      })
      // 菜单确认后立即按快照生成/同步采购清单
      await repository.generateShopping(plan.id)
      refresh(); setSheet(null); setTab('shop')
      Taro.showToast({ title: '菜单已确认，清单已生成', icon: 'success' })
    } catch (e) { Taro.showToast({ title: '确认失败：' + errText(e), icon: 'none' }) } finally { setBusy(false) }
  }

  /* ---------------- 采购 ---------------- */
  const plan = store.plan
  const shopping = store.shopping

  const markItem = async (itemId: string, status: 'needed' | 'have' | 'purchased') => {
    if (!isOwner) { Taro.showToast({ title: '由掌勺者维护', icon: 'none' }); return }
    try { await repository.updateShoppingItem(itemId, { status }); refresh() } catch (e) { Taro.showToast({ title: errText(e), icon: 'none' }) }
  }

  const copyShopping = () => {
    if (!shopping) return
    const lines = shopping.items.filter(i => i.status === 'needed')
      .map(i => `${i.name} ${i.displayQuantity || ''}`)
    Taro.setClipboardData({ data: (plan ? plan.title + '\n' : '') + lines.join('\n') })
  }

  /* ---------------- 语音 / 卡牌 / 记录 ---------------- */
  const toggleRecord = async () => {
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

  const saveLog = async () => {
    if (!plan) return
    try {
      setBusy(true)
      await repository.addCookingLog({
        recipeId: plan.items[0]?.recipeId || recipes[0]?.id || '',
        mealPlanId: plan.id, notes: logNotes, rating: 5, photos: [],
      })
      setLogNotes(''); setSheet(null); refresh()
      Taro.showToast({ title: '料理记忆已保存', icon: 'success' })
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

  useShareAppMessage(() => ({
    title: detailRecipe ? `「${detailRecipe.title}」· 我的料理图鉴` : '我的料理图鉴 · 家的味道',
    path: '/pages/index/index',
  }))

  /* ================= 渲染 ================= */
  const wishIds = [...new Set(store.requests.flatMap(q => q.recipeIds))]
  const chosenRecipes = chosen.map(id => recipes.find(r => r.id === id)).filter(Boolean) as Recipe[]
  const browseList = recipes.filter(r =>
    (browseCat === '全部' || r.category === browseCat) && r.title.includes(browseQuery))

  const shopReady = shopping ? shopping.items.filter(i => i.status !== 'needed').length : 0
  const shopTotal = shopping ? shopping.items.length : 0
  const groupOf = (name: string) => /肉|排|鸡|鱼|牛|虾|蛋|面|米|饭/.test(name) ? '主食与肉蛋' : /油|盐|酱|醋|糖|椒|料|酒/.test(name) ? '调味与其他' : '蔬菜与配料'

  return <View className='page'>
    {/* ===== 顶部品牌 ===== */}
    <View className='appbar'>
      <View className='brand'><View className='brand-icon'><Text>📖</Text></View><Text>料理图鉴</Text></View>
      <View className='iconbtn' onClick={() => { setBrowseMode('detail'); setSheet('browse') }}><Text>🔍</Text></View>
    </View>

    {trialRequired && !loading && <View className='panel' style={{ marginTop: '20rpx' }}>
      <Text className='h3' style={{ margin: 0 }}>输入试用码进入</Text>
      <Input className='field' placeholder='试用码' value={trialCode} onInput={e => setTrialCode(e.detail.value)} />
      <Button className='cta' loading={busy} onClick={submitTrialCode}>进入试用</Button>
    </View>}

    {/* ===== 图鉴 ===== */}
    {tab === 'home' && (!recipes.length ? <View className='empty'>
      <Text style={{ fontSize: '80rpx' }}>📖</Text>
      <Text className='h3'>第一张卡，{'\n'}留给你的拿手菜。</Text>
      <Text className='subtitle'>{isOwner ? '拍张成品照，记下这次的做法。' : '等掌勺者收进第一道菜，你就可以点菜了。'}</Text>
      {isOwner && <Button className='cta' onClick={() => openAdd()}>＋ 收录第一道菜</Button>}
    </View> : <View>
      <View className='head-row' style={{ marginTop: '16rpx' }}>
        <View><Text className='h2'>我的料理图鉴</Text></View>
      </View>
      <View className='meta-pills'>
        <Text className='pill'>已收集 <Text style={{ fontWeight: 700 }}>{String(recipes.length).padStart(2, '0')}</Text> 道</Text>
        <Text className='pill'>拿手菜 <Text style={{ fontWeight: 700 }}>{String(favorites.length).padStart(2, '0')}</Text> 道</Text>
      </View>
      {hero && <HeroStack
        recipe={recipeWithCover(hero)}
        serial={heroSerial}
        cooked={Math.max(1, store.cookingLogs.filter(l => l.recipeId === hero.id).length + 1)}
        signature={store.favoriteIds.includes(hero.id)}
        onDetail={() => openDetail(recipeWithCover(hero))}
      />}
      <View className='paired'>
        {isOwner
          ? <Button className='cta' onClick={() => openAdd()}>＋ 收录新卡</Button>
          : <Button className='cta ghost' onClick={() => openDetail(recipeWithCover(hero!))}>查看完整菜谱</Button>}
        <Button className='cta ghost' onClick={() => setHeroIdx(i => (i + 1) % recipes.length)}>翻到下一张 →</Button>
      </View>
      <View className='section-head'>
        <Text className='h3'>再做一次，也很喜欢</Text>
        <Text className='textbtn' onClick={() => { setBrowseMode('detail'); setSheet('browse') }}>全部图鉴 ›</Text>
      </View>
      <View className='mini-grid'>
        {(favorites.length ? favorites : recipes).slice(0, 2).map(r => (
          <View key={r.id} className='mini-card' onClick={() => openDetail(recipeWithCover(r))}>
            <Text className='serial'>ATLAS / {String(recipes.indexOf(r) + 1).padStart(3, '0')}</Text>
            <Image src={r.coverUrl || fallbackCover(r.title, r.category)} mode={r.coverUrl ? 'aspectFill' : 'aspectFit'} />
            <Text style={{ fontWeight: 650, fontSize: '26rpx' }}>{r.title}</Text>
            <Text style={{ fontSize: '20rpx', color: '#64796c' }}>{r.cookingMinutes || '—'} 分钟 · {r.category}</Text>
          </View>
        ))}
      </View>
      <View className='family-note'>
        <Text>家人想吃：{wishTitles.length ? wishTitles.slice(0, 3).join('、') : '还没有点菜'}</Text>
        <Text className='textbtn' onClick={() => setTab('menu')}>去安排 →</Text>
      </View>
    </View>)}

    {/* ===== 点菜 ===== */}
    {tab === 'menu' && <View>
      <Text className='kicker'>THE DINNER DECK / 今晚吃什么</Text>
      <Text className='h2 menu-title'>没灵感？{'\n'}<Text style={{ color: '#2d604e' }}>抽一桌家的味道。</Text></Text>
      <View className='config'>
        <View className='meal-chips'>
          <Text className={`meal-chip ${meal === 'lunch' ? 'on' : ''}`} onClick={() => setMeal('lunch')}>午餐</Text>
          <Text className={`meal-chip ${meal === 'dinner' ? 'on' : ''}`} onClick={() => setMeal('dinner')}>晚餐</Text>
        </View>
        <View className='people'>
          <Text className='pbtn' onClick={() => bumpPeople(-1)}>−</Text>
          <Text style={{ fontWeight: 700 }}>{people} 人</Text>
          <Text className='pbtn' onClick={() => bumpPeople(1)}>＋</Text>
        </View>
      </View>
      <View className='family-request'>
        <Text className='avatar'>家</Text>
        <Text style={{ flex: 1 }}>{wishTitles.length ? `家人想吃 ${wishTitles.slice(0, 4).join('、')}` : '还没有家人点菜，先选一两道喜欢的。'}</Text>
      </View>
      {chosenRecipes.length
        ? <FanCards items={chosenRecipes.map(recipeWithCover)} wishIds={wishIds} onDetail={openDetail} />
        : <View className='empty' style={{ padding: '40rpx 20rpx' }}>
            <Text className='subtitle'>先从图鉴挑几道想吃的，{'\n'}再让它们组成今晚的菜单。</Text>
          </View>}
      <Text className='draw-hint'>保留家人心愿，再搭配其他味道。</Text>
      <Button className='cta' onClick={recommend} loading={busy}>✨ 换一桌灵感</Button>
      <View className='panel'>
        <View className='panel-top'>
          <Text>{isOwner ? '这一桌，大家都喜欢' : '我想吃这些'}</Text>
          <Text className='textbtn' onClick={() => { setBrowseMode('pick'); setSheet('browse') }}>＋ 加一道</Text>
        </View>
        {chosenRecipes.map(r => <View className='recipe-row' key={r.id}>
          <Image className='thumb' src={r.coverUrl || fallbackCover(r.title, r.category)} mode={r.coverUrl ? 'aspectFill' : 'aspectFit'} />
          <View className='copy'>
            <Text style={{ fontWeight: 600 }}>{r.title}{wishIds.includes(r.id) ? ' ♥' : ''}</Text>
            <Text className='mini' style={{ marginTop: '4rpx' }}>{wishIds.includes(r.id) ? '家人的心愿 · 换一桌时保留' : '图鉴已有 · 熟悉的味道'}</Text>
          </View>
          <View className='row-action' onClick={() => setChosen(c => c.filter(x => x !== r.id))}><Text>✕</Text></View>
        </View>)}
        {!chosenRecipes.length && <Text className='mini'>还没有选择菜品。</Text>}
      </View>
      {!isOwner && <Input className='field' placeholder='给掌勺者的备注：少辣、想喝汤…' value={orderNote} onInput={e => setOrderNote(e.detail.value)} style={{ marginTop: '20rpx' }} />}
      {isOwner
        ? <Button className='cta' onClick={() => setSheet('review')}>就吃这一桌 · 确认菜单 →</Button>
        : <Button className='cta' onClick={submitOrder} loading={busy}>提交我的点菜</Button>}
    </View>}

    {/* ===== 采购 ===== */}
    {tab === 'shop' && (!plan || !shopping ? <View className='empty'>
      <Text style={{ fontSize: '80rpx' }}>🛒</Text>
      <Text className='h3'>先定好这一桌，{'\n'}再去买食材。</Text>
      <Text className='subtitle'>只有掌勺者确认过的菜单，{'\n'}才会生成采购清单。</Text>
      <Button className='cta' onClick={() => setTab('menu')}>去看看今晚的菜单 →</Button>
    </View> : <View>
      <Text className='kicker'>PREPARE THE TABLE</Text>
      <View className='head-row' style={{ marginTop: '12rpx' }}>
        <Text className='h2'>{plan.title}</Text>
        <Text className='pill'>{plan.servings} 人份</Text>
      </View>
      <Text className='subtitle'>菜单已定，把这一桌的材料备齐。</Text>
      <View className='shop-hero'>
        <View>
          <Text className='count'>{shopReady}<Text style={{ fontSize: '42rpx', color: '#78917d' }}> / {shopTotal}</Text></Text>
          <Text className='mini' style={{ color: '#64796c' }}>已经备齐 · 含家中已有</Text>
          <View className='meter'><View style={{ width: `${shopTotal ? (shopReady / shopTotal * 100) : 0}%`, height: '100%', background: '#2d604e' }} /></View>
        </View>
        <Text className='bag'>🛍️</Text>
      </View>
      {SHOP_GROUPS.map(group => {
        const rows = shopping.items.filter(i => groupOf(i.name) === group)
        if (!rows.length) return null
        return <View key={group}>
          <View className='shop-head'><Text>{group}</Text><Text>{isOwner ? '点勾选备齐' : '家庭共享 · 只读'}</Text></View>
          <View className='shop-group'>
            {rows.map(x => <View key={x.id} className={`shop-row ${x.status !== 'needed' ? 'done' : ''} ${x.status === 'purchased' ? 'bought' : ''}`}>
              <View className={`check ${x.status !== 'needed' ? 'done' : ''}`} onClick={() => markItem(x.id, x.status === 'purchased' ? 'needed' : 'purchased')}>
                <Text>{x.status === 'have' ? '🏠' : x.status === 'purchased' ? '✓' : ''}</Text>
              </View>
              <View className='name'>
                <Text>{x.name}</Text>
                {x.status === 'have' && <Text className='mini'>家中已有</Text>}
                {/待补充|适量|待核对/.test(x.displayQuantity || '') && <Text className='mini'>含待核对用量</Text>}
              </View>
              <Text className='qty'>{x.displayQuantity || '—'}</Text>
            </View>)}
          </View>
        </View>
      })}
      <View className='at-home'>
        <Text className='ic'>🏠</Text>
        <Text>{isOwner ? '家里有的不必再买。点勾选标记备齐。' : '这份清单由掌勺者维护；你可以复制清单帮忙买菜。'}</Text>
      </View>
      <Button className='cta ghost' onClick={copyShopping}>📋 复制待购清单</Button>
      {isOwner && <Button className='linkline' onClick={() => setSheet('log')}>这顿做好了，记一笔 →</Button>}
    </View>)}

    {/* ===== 我的 ===== */}
    {tab === 'profile' && <View>
      <Text className='kicker'>OUR FAMILY COLLECTION</Text>
      <View className='profile-hero'>
        <Text className='avatar'>{session?.user?.displayName?.[0] || '我'}</Text>
        <Text className='h2'>{session?.space?.name || '我的料理图鉴'}</Text>
        <Text className='subtitle'>{isOwner ? '👨‍🍳 掌勺者 · 记录与安排一桌好味道' : '👨‍👩‍👧 家庭成员 · 收藏、点菜、等开饭'}</Text>
        <View className='profile-stat'>
          <View><Text style={{ fontWeight: 700, fontSize: '44rpx' }}>{recipes.length}</Text><Text className='mini'>已做菜谱</Text></View>
          <View><Text style={{ fontWeight: 700, fontSize: '44rpx' }}>{store.favoriteIds.length}</Text><Text className='mini'>我的收藏</Text></View>
          <View><Text style={{ fontWeight: 700, fontSize: '44rpx' }}>{store.cookingLogs.length}</Text><Text className='mini'>制作记录</Text></View>
        </View>
      </View>
      {session?.space.inviteCode && <View className='panel' style={{ marginTop: '30rpx' }}>
        <View className='panel-top'><Text>邀请家人</Text></View>
        <View className='recipe-row' onClick={() => Taro.setClipboardData({ data: session.space.inviteCode! })}>
          <View className='copy'><Text style={{ fontWeight: 600, letterSpacing: '2rpx' }}>{session.space.inviteCode}</Text><Text className='mini'>点击复制邀请码</Text></View>
          <Button className='textbtn' openType='share'>📤 分享</Button>
        </View>
      </View>}
      <View className='panel' style={{ marginTop: '20rpx' }}>
        <View className='panel-top'><Text>家庭制作记录</Text></View>
        {store.cookingLogs.slice(0, 10).map(l => {
          const r = recipes.find(x => x.id === l.recipeId)
          return <View className='recipe-row' key={l.id}>
            <View className='copy'><Text style={{ fontWeight: 600 }}>{r?.title || '已删除菜谱'}</Text><Text className='mini'>{l.notes || '无心得'} · {l.cookedAt.slice(0, 10)}</Text></View>
            <Text style={{ color: '#d99a3c' }}>{'★'.repeat(l.rating || 0)}</Text>
          </View>
        })}
        {!store.cookingLogs.length && <Text className='mini'>做完一顿饭，可以在采购页记下心得。</Text>}
      </View>
      <View className='panel' style={{ marginTop: '20rpx' }}>
        <View className='panel-top'><Text>加入其他家庭空间</Text></View>
        <Input className='field' placeholder='输入邀请码' value={joinCode} onInput={e => setJoinCode(e.detail.value)} />
        <Button className='cta ghost' onClick={joinSpace} loading={busy}>加入家庭空间</Button>
      </View>
    </View>}

    {/* ===== 底部导航 ===== */}
    <View className='tabbar'>
      {([['home', '📖', '图鉴'], ['menu', '🍽️', '点菜'], ['shop', '🛒', '采购'], ['profile', '👤', '我的']] as [Tab, string, string][]).map(([key, ic, title]) => (
        <View key={key} className={`nav ${tab === key ? 'on' : ''}`} onClick={() => setTab(key)}>
          <Text className='ic'>{ic}</Text><Text>{title}</Text>
        </View>
      ))}
    </View>

    {/* ===== 卡牌导出画布（保留） ===== */}
    <Canvas type='2d' id='recipe-card' className='cardCanvas' />

    {/* ===== 弹层：详情 ===== */}
    <Sheet open={sheet === 'detail'} label='菜谱详情' onClose={() => setSheet(null)}>
      {detailRecipe && <View>
        <Image className='dish-large' src={detailRecipe.coverUrl || fallbackCover(detailRecipe.title, detailRecipe.category)} mode={detailRecipe.coverUrl ? 'aspectFill' : 'aspectFit'} />
        <View className='head-row'>
          <Text className='h2' style={{ fontSize: '48rpx' }}>{detailRecipe.title}</Text>
          <View className='iconbtn' onClick={() => toggleFavorite(detailRecipe.id)}>
            <Text>{store.favoriteIds.includes(detailRecipe.id) ? '♥' : '♡'}</Text>
          </View>
        </View>
        <View className='detail-meta'>
          <Text className='pill'>{detailRecipe.category}</Text>
          <Text className='pill'>{detailRecipe.cookingMinutes || '—'} 分钟</Text>
          <Text className='pill'>原配方 {detailRecipe.servings || 2} 人份</Text>
        </View>
        <Text className='mini'>{detailRecipe.description || '记录下来，下次就能重现这份味道。'}</Text>
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
          <Button className='cta ghost' onClick={() => exportCard(detailRecipe)} loading={cardBusy}>一张菜谱卡</Button>
        </View>
        {isOwner && <Button className='linkline' onClick={() => openAdd(detailRecipe)}>✏️ 编辑菜谱 →</Button>}
      </View>}
    </Sheet>

    {/* ===== 弹层：浏览图鉴 ===== */}
    <Sheet open={sheet === 'browse'} label='浏览图鉴' onClose={() => setSheet(null)}>
      <Text className='h2' style={{ fontSize: '44rpx' }}>{browseMode === 'pick' ? '加一道想吃的' : '家里的拿手菜'}</Text>
      <Input className='field' placeholder='搜索菜名' value={browseQuery} onInput={e => setBrowseQuery(e.detail.value)} />
      <View className='chips'>
        {CATS.map(c => <Text key={c} className={`chip ${browseCat === c ? 'on' : ''}`} onClick={() => setBrowseCat(c)}>{c}</Text>)}
      </View>
      {browseList.map(r => <View className='recipe-row' key={r.id}>
        <Image className='thumb' src={r.coverUrl || fallbackCover(r.title, r.category)} mode={r.coverUrl ? 'aspectFill' : 'aspectFit'} />
        <View className='copy'>
          <Text style={{ fontWeight: 600 }}>{r.title}</Text>
          <Text className='mini'>{r.cookingMinutes} 分钟 · {r.category}</Text>
        </View>
        <View className='row-action' onClick={() => {
          if (browseMode === 'pick') {
            if (!chosen.includes(r.id)) { setChosen(c => [...c, r.id]); setPortions(p => ({ ...p, [r.id]: people })) }
            setSheet(null); setTab('menu')
          } else { openDetail(recipeWithCover(r)) }
        }}><Text>›</Text></View>
      </View>)}
      {!browseList.length && <Text className='mini'>没有匹配的菜，换个词试试。</Text>}
    </Sheet>

    {/* ===== 弹层：录入（AI/手动） ===== */}
    <Sheet open={sheet === 'add'} label={editId ? '编辑菜谱' : '收录料理卡'} onClose={() => setSheet(null)}>
      <Text className='h2' style={{ fontSize: '44rpx' }}>{editId ? '再打磨一下拿手菜。' : '记一道新菜。'}</Text>
      <Text className='subtitle'>把这次的味道，变成下一次的底气。</Text>
      <View className='chips'>
        <Text className={`chip ${importMode === 'ai' ? 'on' : ''}`} onClick={() => setImportMode('ai')}>AI 帮我整理</Text>
        <Text className={`chip ${importMode === 'manual' ? 'on' : ''}`} onClick={() => setImportMode('manual')}>手动填写</Text>
      </View>
      {importMode === 'ai' ? <View>
        <Input className='field' placeholder='菜名，例如：番茄炒蛋' value={aiTitle} onInput={e => setAiTitle(e.detail.value)} />
        <Textarea className='field area' placeholder='说说你怎么做的：用了什么、怎么做的、有什么心得…' value={aiText} onInput={e => setAiText(e.detail.value)} />
        <Button className='upload' onClick={chooseCover}>📷 {aiImageKey ? '已选成品照 · 重选' : '选择一张成品照'}</Button>
        {aiPreview ? <Image className='upload-preview' src={aiPreview} mode='aspectFill' /> : null}
        <Button className='cta ghost' style={recording ? { background: '#c9564a', color: '#fff' } : {}} onClick={toggleRecord}>
          {recording ? '⏹ 结束录音并转写' : '🎙 语音描述这道菜'}
        </Button>
        <Button className='cta' onClick={parseAI}>✨ 整理成草稿 →</Button>
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
        {aiPreview ? <Image className='upload-preview' src={aiPreview} mode='aspectFill' /> : null}
        <Button className='cta' onClick={saveRecipe} loading={busy}>{editId ? '保存修改' : '确认，收进我的图鉴 ✓'}</Button>
        <Text className='helper'>不清楚的用量写「适量」，不要为了完整而猜数值。</Text>
      </View>}
    </Sheet>

    {/* ===== 弹层：掌勺者确认 ===== */}
    <Sheet open={sheet === 'review'} label='掌勺者确认' onClose={() => setSheet(null)}>
      <Text className='h2' style={{ fontSize: '44rpx' }}>今晚，就吃这一桌。</Text>
      <Text className='subtitle'>{people} 人 · {chosen.length} 道菜 · {meal === 'dinner' ? '晚餐' : '午餐'}</Text>
      {chosenRecipes.map(r => <View className='recipe-row' key={r.id}>
        <Image className='thumb' src={r.coverUrl || fallbackCover(r.title, r.category)} mode={r.coverUrl ? 'aspectFill' : 'aspectFit'} />
        <View className='copy'>
          <Text style={{ fontWeight: 600 }}>{r.title}</Text>
          <Text className='mini'>原配方 {r.servings || 2} 人份</Text>
        </View>
        <Input className='portion-input' type='number' value={String(portions[r.id] ?? people)} onInput={e => setPortions(p => ({ ...p, [r.id]: Math.max(1, Number(e.detail.value) || 1) }))} />
        <View className='row-action' onClick={() => setChosen(c => c.filter(x => x !== r.id))}><Text>✕</Text></View>
      </View>)}
      <View className='tip'>人数不等于每道菜的份量；按实际要做的份量算，未知用量标待核对。</View>
      <Button className='cta' onClick={confirmPlan} loading={busy}>确认菜单，生成采购清单 →</Button>
    </Sheet>

    {/* ===== 弹层：记一笔 ===== */}
    <Sheet open={sheet === 'log'} label='料理记忆' onClose={() => setSheet(null)}>
      <Text className='h2' style={{ fontSize: '44rpx' }}>这一桌，做得怎么样？</Text>
      <Textarea className='field area' placeholder='火候、调味、家人的评价……' value={logNotes} onInput={e => setLogNotes(e.detail.value)} />
      <Button className='cta' onClick={saveLog} loading={busy}>保存制作记录 ✓</Button>
    </Sheet>

    {loading && <View className='warm-toast' style={{ opacity: 1 }}>正在登录并加载家庭数据…</View>}
  </View>
}
