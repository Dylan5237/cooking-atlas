import React,{useEffect,useMemo,useState}from'react'
import{View,Text,Input,Textarea,Button,Image}from'@tarojs/components'
import Taro from'@tarojs/taro'
import{repository,isDemoMode}from'../../services/repository'
import{ensureSession,joinSpaceByCode,uploadImage,resolveImageUrl,getActiveSpaceId,apiRequest}from'../../services/api'
import type{Recipe,Ingredient}from'@cooking-atlas/shared'
import'./index.scss'

type Tab='atlas'|'order'|'shopping'|'profile'
const cats=['全部','家常菜','荤菜','素菜','汤羹','主食','甜品']
const errText=(e:unknown)=>String((e as Error)?.message||e)

export default function Index(){
 const[tab,setTab]=useState<Tab>('atlas')
 const[store,setStore]=useState(repository.getStore())
 const[loading,setLoading]=useState(!isDemoMode())
 const[session,setSession]=useState<{user:{id:string;displayName?:string};space:{id:string;name:string;inviteCode?:string};role:'owner'|'member'}|null>(null)
 const[cat,setCat]=useState('全部')
 const[query,setQuery]=useState('')
 // AI 录入
 const[aiText,setAiText]=useState('')
 const[aiImageKey,setAiImageKey]=useState('')
 const[aiPreview,setAiPreview]=useState('')
 // 手动录入 / 草稿回填
 const[title,setTitle]=useState('')
 const[description,setDescription]=useState('')
 const[rawIngredients,setRawIngredients]=useState('')
 const[coverKey,setCoverKey]=useState('')
 const[coverPreview,setCoverPreview]=useState('')
 // 点菜
 const[people,setPeople]=useState('3')
 const[mealType,setMealType]=useState<'lunch'|'dinner'>('dinner')
 const[chosen,setChosen]=useState<string[]>([])
 const[note,setNote]=useState('')
 const[suggested,setSuggested]=useState<string[]>([])
 const[warnings,setWarnings]=useState<string[]>([])
 // 家庭空间
 const[joinCode,setJoinCode]=useState('')
 const[busy,setBusy]=useState(false)
 // 封面签名 URL 缓存（object key → 短期签名 URL）
 const[covers,setCovers]=useState<Record<string,string>>({})

 const refresh=()=>setStore(repository.getStore())
 const isOwner=session?.role==='owner'
 const recipes=store.recipes
 const visible=useMemo(()=>recipes.filter(r=>(cat==='全部'||r.category===cat)&&r.title.includes(query)),[recipes,cat,query])

 useEffect(()=>{
  if(isDemoMode()){setLoading(false);return}
  ensureSession()
   .then(async s=>{setSession(s);await repository.refresh();refresh();if(s.role==='owner')await repository.refreshRequests().catch(()=>{});refresh()})
   .catch(e=>Taro.showToast({title:'登录失败：'+errText(e),icon:'none'}))
   .finally(()=>setLoading(false))
 },[])

 // 列表封面：object key → 签名 URL（300s 时效，页面生命周期内缓存）
 useEffect(()=>{
  const missing=recipes.filter(r=>r.coverKey&&!covers[r.coverKey])
  if(!missing.length)return
  let cancelled=false
  Promise.all(missing.map(async r=>{
   try{const url=await resolveImageUrl(r.coverKey!,getActiveSpaceId());return[r.coverKey!,url]as const}catch{return null}
  })).then(pairs=>{
   if(cancelled)return
   const next={...covers}
   for(const p of pairs)if(p)next[p[0]]=p[1]
   setCovers(next)
  })
  return()=>{cancelled=true}
 },[recipes])

 const guardOwner=()=>{
  if(isDemoMode()){Taro.showToast({title:'演示模式不支持写入',icon:'none'});return false}
  if(!session){Taro.showToast({title:'尚未登录，请稍后重试',icon:'none'});return false}
  if(!isOwner){Taro.showToast({title:'仅掌勺者可执行此操作',icon:'none'});return false}
  return true
 }

 const chooseCover=async()=>{
  try{
   const res=await Taro.chooseImage({count:1,sizeType:['compressed'],sourceType:['album','camera']})
   const local=res.tempFilePaths[0]
   if(isDemoMode()){setCoverPreview(local);setAiPreview(local);return}
   Taro.showLoading({title:'上传中'})
   const up=await uploadImage(local,getActiveSpaceId())
   setCoverKey(up.key);setCoverPreview(local);setAiImageKey(up.key);setAiPreview(local)
   Taro.hideLoading();Taro.showToast({title:'照片已上传',icon:'success'})
  }catch(e){Taro.hideLoading();Taro.showToast({title:'上传失败：'+errText(e),icon:'none'})}
 }

 const parseAI=async()=>{
  if(isDemoMode()){Taro.showToast({title:'演示模式不支持 AI 录入',icon:'none'});return}
  if(!aiText.trim()&&!aiImageKey){Taro.showToast({title:'请先描述菜品或上传照片',icon:'none'});return}
  try{
   Taro.showLoading({title:'AI 整理中'})
   const res=await apiRequest<{draft:any}>('/api/ai/recipe-draft','POST',{spaceId:getActiveSpaceId(),text:aiText,imageKey:aiImageKey||undefined})
   const d=res.draft||{}
   setTitle(d.title||'')
   setDescription(d.description||(d.steps||[]).map((x:any)=>x.content).join('\n'))
   setRawIngredients((d.ingredients||[]).map((x:any)=>x.name+'：'+(x.quantity===null||x.quantity===undefined?'':x.quantity)+(x.unit||'待补充')).join('\n'))
   if(aiImageKey)setCoverKey(aiImageKey)
   Taro.hideLoading();Taro.showToast({title:'已生成草稿，请核对后保存',icon:'success'})
  }catch(e){Taro.hideLoading();Taro.showModal({title:'AI 录入暂不可用',content:errText(e),showCancel:false})}
 }

 const parseIngredients=(raw:string):Ingredient[]=>raw.split('\n').map(x=>x.trim()).filter(Boolean).map(x=>{
  const parts=x.split(/[：:]/),amount=(parts.slice(1).join(':')||'').trim(),match=amount.match(/^(\d+(?:\.\d+)?)\s*(.*)$/)
  return{name:parts[0].trim(),quantity:match?Number(match[1]):null,unit:match?(match[2]||'待补充'):(amount||'待补充')}
 })

 const addRecipe=async()=>{
  if(!title.trim()){Taro.showToast({title:'请填写菜名',icon:'none'});return}
  if(!guardOwner())return
  const ingredients=parseIngredients(rawIngredients)
  if(!ingredients.length){Taro.showToast({title:'请至少填写一项食材',icon:'none'});return}
  try{
   setBusy(true)
   await repository.createRecipe({title:title.trim(),category:'家常菜',coverKey:coverKey||undefined,servings:2,cookingMinutes:0,difficulty:'待补充',description,ingredients,steps:description?[{content:description}]:[]})
   setTitle('');setDescription('');setRawIngredients('');setAiText('');setAiImageKey('');setAiPreview('');setCoverKey('');setCoverPreview('')
   refresh();Taro.showToast({title:'菜谱已收藏',icon:'success'})
  }catch(e){Taro.showToast({title:'保存失败：'+errText(e),icon:'none'})}finally{setBusy(false)}
 }

 const toggleFavorite=async(recipeId:string)=>{
  try{await repository.toggleFavorite(recipeId);refresh()}catch(e){Taro.showToast({title:errText(e),icon:'none'})}
 }

 const toggle=(x:string)=>setChosen(v=>v.includes(x)?v.filter(a=>a!==x):[...v,x])

 const submitOrder=async()=>{
  if(isDemoMode()){Taro.showToast({title:'演示模式不支持点菜',icon:'none'});return}
  if(!session){Taro.showToast({title:'尚未登录',icon:'none'});return}
  if(!chosen.length){Taro.showToast({title:'请先选择想吃的菜',icon:'none'});return}
  try{
   setBusy(true)
   await repository.submitMealRequest({mealType,servings:Math.max(1,Number(people)||1),recipeIds:chosen,note})
   setChosen([]);setNote('');refresh()
   Taro.showToast({title:'点菜已提交，等掌勺者汇总',icon:'success'})
  }catch(e){Taro.showToast({title:'提交失败：'+errText(e),icon:'none'})}finally{setBusy(false)}
 }

 const recommend=async()=>{
  if(isDemoMode()){Taro.showToast({title:'演示模式不支持推荐',icon:'none'});return}
  try{
   setBusy(true)
   const rec=await repository.recommend({servings:Math.max(1,Number(people)||1),mealType,requestedRecipeIds:chosen})
   setSuggested(rec.items.map(x=>x.recipeId));setWarnings([...rec.warnings,...rec.newDishSuggestions])
   Taro.showToast({title:'已按图鉴搭配 '+rec.items.length+' 道',icon:'success'})
  }catch(e){Taro.showToast({title:'推荐失败：'+errText(e),icon:'none'})}finally{setBusy(false)}
 }

 const confirmPlan=async()=>{
  if(!guardOwner())return
  const ids=suggested.length?suggested:chosen
  if(!ids.length){Taro.showToast({title:'请先点菜或生成推荐',icon:'none'});return}
  try{
   setBusy(true)
   await repository.confirmPlan({title:mealType==='dinner'?'家庭晚餐':'家庭午餐',mealType,servings:Math.max(1,Number(people)||1),recipeIds:ids})
   refresh();Taro.showToast({title:'菜单已确认',icon:'success'})
  }catch(e){Taro.showToast({title:'确认失败：'+errText(e),icon:'none'})}finally{setBusy(false)}
 }

 const generate=async()=>{
  if(!guardOwner())return
  if(!store.plan||store.plan.status!=='confirmed'){Taro.showToast({title:'请先确认菜单',icon:'none'});return}
  try{
   setBusy(true)
   await repository.generateShopping(store.plan.id)
   refresh();setTab('shopping')
  }catch(e){Taro.showToast({title:'生成失败：'+errText(e),icon:'none'})}finally{setBusy(false)}
 }

 const markItem=async(itemId:string,status:'needed'|'have'|'purchased')=>{
  if(!guardOwner())return
  try{await repository.updateShoppingItem(itemId,{status});refresh()}catch(e){Taro.showToast({title:errText(e),icon:'none'})}
 }

 const joinSpace=async()=>{
  if(!joinCode.trim()){Taro.showToast({title:'请输入邀请码',icon:'none'});return}
  try{
   setBusy(true)
   const space=await joinSpaceByCode(joinCode)
   const s=await ensureSession()
   setSession(s);await repository.refresh();refresh()
   setJoinCode('');Taro.showToast({title:'已加入「'+space.name+'」',icon:'success'})
  }catch(e){Taro.showToast({title:'加入失败：'+errText(e),icon:'none'})}finally{setBusy(false)}
 }

 const copyInvite=()=>{
  if(!session?.space.inviteCode){Taro.showToast({title:'邀请码仅创建时可见',icon:'none'});return}
  Taro.setClipboardData({data:session.space.inviteCode})
 }

 const showDetail=(r:Recipe)=>{
  Taro.showModal({title:r.title,content:r.ingredients.map(x=>x.name+' '+(x.quantity??'')+x.unit).join('、')+'\n'+r.steps.map((s,n)=>(n+1)+'. '+s.content).join('\n'),showCancel:false})
 }

 return <View className='app'>
  <View className='hero'>
   <Text className='eyebrow'>MY COOKING COLLECTION</Text>
   <Text className='heroTitle'>把做过的味道，收藏起来。</Text>
   <Text className='muted'>{session?session.space.name+' · ':'家庭料理图鉴 · '}{recipes.length} 道已收藏{isDemoMode()?' · 演示模式':''}</Text>
  </View>
  <View className='tabs'>{(['atlas','order','shopping','profile']as Tab[]).map((x,i)=><Text key={x} className={'tab '+(tab===x?'active':'')} onClick={()=>setTab(x)}>{['图鉴','点菜','采购','我的'][i]}</Text>)}</View>
  {loading&&<View className='empty'>正在登录并加载家庭数据…</View>}

  {tab==='atlas'&&<View>
   <Text className='heading'>我的料理收藏</Text>
   <Input className='field' placeholder='搜索菜名' value={query} onInput={e=>setQuery(e.detail.value)}/>
   <View className='chips'>{cats.map(x=><Text key={x} className={'chip '+(cat===x?'chosen':'')} onClick={()=>setCat(x)}>{x}</Text>)}</View>
   {!loading&&!visible.length&&<View className='empty'>还没有菜谱，用下方 AI 录入或手动添加第一道菜。</View>}
   <View className='cards'>{visible.map((r,i)=><View className='card' key={r.id} onClick={()=>showDetail(r)}>
    <View className='art'>
     {r.coverKey&&covers[r.coverKey]?<Image className='cover' src={covers[r.coverKey]} mode='aspectFill'/>:(r.coverUrl&&(r.coverUrl.startsWith('http')||r.coverUrl.startsWith('wxfile://'))?<Image className='cover' src={r.coverUrl} mode='aspectFill'/>:<Text className='emoji'>{['🍳','🥦','🍲','🍚'][i%4]}</Text>)}
     <Text className='number'>NO. {String(i+1).padStart(3,'0')}</Text>
    </View>
    <View className='cardBody'>
     <Text className='cardTitle'>{r.title}</Text>
     <Text className='muted small'>{r.category} · {r.cookingMinutes||'待补充'} 分钟</Text>
     <Text className='muted small'>{r.description||'一张等待补充故事的料理卡牌'}</Text>
     <Text className={'chip '+(store.favoriteIds.includes(r.id)?'chosen':'')} onClick={e=>{e.stopPropagation();toggleFavorite(r.id)}}>{store.favoriteIds.includes(r.id)?'★ 已收藏':'☆ 收藏'}</Text>
    </View>
   </View>)}</View>
   <View className='panel'>
    <Text className='heading'>AI 录入菜谱</Text>
    <Text className='muted'>拍摄成品或描述做法，AI 生成可编辑草稿。未知用量会保留待补充。</Text>
    <Textarea className='field area' placeholder='例如：今天做了番茄炒蛋，先炒鸡蛋，再炒番茄，最后混合调味。' value={aiText} onInput={e=>setAiText(e.detail.value)}/>
    {aiPreview?<Image className='aiPreview' src={aiPreview} mode='aspectFill'/>:null}
    <Button className='secondary' onClick={chooseCover}>{aiImageKey||coverKey?'已上传照片 · 重新选择':'拍照 / 从相册选择成品'}</Button>
    <Button className='primary' onClick={parseAI}>AI 整理成菜谱草稿</Button>
    <Text className='heading'>手动录入</Text>
    <Input className='field' placeholder='菜名' value={title} onInput={e=>setTitle(e.detail.value)}/>
    <Textarea className='field area' placeholder='制作过程、心得' value={description} onInput={e=>setDescription(e.detail.value)}/>
    <Textarea className='field area' placeholder={'食材，每行一项，例如：\n五花肉：500g\n冰糖：适量'} value={rawIngredients} onInput={e=>setRawIngredients(e.detail.value)}/>
    <Button className='primary' loading={busy} onClick={addRecipe}>保存菜谱{!isDemoMode()&&!isOwner?'（仅掌勺者）':''}</Button>
   </View>
  </View>}

  {tab==='order'&&<View>
   <Text className='heading'>今天想吃什么？</Text>
   <Text className='muted'>选择家人想吃的菜提交点菜；掌勺者汇总后确认菜单。</Text>
   <View className='panel'>
    <Text>用餐人数</Text>
    <Input className='field' type='number' value={people} onInput={e=>setPeople(e.detail.value)}/>
    <View className='chips'>
     <Text className={'chip '+(mealType==='lunch'?'chosen':'')} onClick={()=>setMealType('lunch')}>午餐</Text>
     <Text className={'chip '+(mealType==='dinner'?'chosen':'')} onClick={()=>setMealType('dinner')}>晚餐</Text>
    </View>
   </View>
   <Text className='heading'>家庭点菜</Text>
   {recipes.map(r=><View className='selectRow' key={r.id} onClick={()=>toggle(r.id)}>
    <Text>{chosen.includes(r.id)?'☑':'□'}</Text>
    <Text className='grow'>{r.title}</Text>
    <Text className='muted small'>加入点菜</Text>
   </View>)}
   <Input className='field' placeholder='备注（可选）：少辣、想喝汤…' value={note} onInput={e=>setNote(e.detail.value)}/>
   <Button className='primary' loading={busy} onClick={submitOrder}>提交我的点菜</Button>
   {isOwner&&<View className='panel'>
    <Text className='heading'>掌勺者汇总</Text>
    {!store.requests.length&&<Text className='muted'>还没有家人提交点菜。</Text>}
    {store.requests.map(q=><View className='selectRow' key={q.id}>
     <Text className='grow'>{q.mealType==='dinner'?'晚餐':'午餐'} · {q.servings} 人 · {q.recipeIds.length} 道</Text>
     <Text className='muted small'>{q.note||'无备注'}</Text>
    </View>)}
    <Button className='secondary' loading={busy} onClick={recommend}>AI 推荐一桌菜</Button>
    {warnings.map((w,i)=><Text key={i} className='muted small'>⚠ {w}</Text>)}
    {suggested.length>0&&<View>{suggested.map(rid=>{const r=recipes.find(x=>x.id===rid);return r?<Text key={rid} className='selectRow'>· {r.title}</Text>:null})}</View>}
    <Button className='primary' loading={busy} onClick={confirmPlan}>确认家庭菜单</Button>
   </View>}
   {store.plan&&<View className='panel'>
    <Text className='heading'>{store.plan.title}</Text>
    <Text className='muted'>{store.plan.servings} 人 · {store.plan.items.length} 道菜 · {store.plan.status==='confirmed'?'已确认':'待确认'}</Text>
    {store.plan.items.map((x,i)=><View className='selectRow' key={i}><Text>{x.recipeTitle}</Text><Text className='muted small'>图鉴已有</Text></View>)}
    {store.plan.status==='confirmed'&&isOwner&&<Button className='primary' loading={busy} onClick={generate}>生成采购清单</Button>}
   </View>}
  </View>}

  {tab==='shopping'&&<View>
   <Text className='heading'>本次采购</Text>
   <Text className='muted'>根据已确认菜单和菜谱快照自动汇总；掌勺者可标记家中已有 / 已购买。</Text>
   {!store.shopping?<View className='empty'>还没有采购清单，请先确认家庭菜单。</View>:<View className='panel'>
    <Text className='heading'>{store.shopping.title}</Text>
    {store.shopping.items.map(x=><View className='selectRow' key={x.id}>
     <Text className='grow' onClick={()=>markItem(x.id,x.status==='purchased'?'needed':'purchased')}>{x.status==='purchased'?'☑':x.status==='have'?'🏠':'□'} {x.name}</Text>
     <Text className='muted'>{x.displayQuantity}</Text>
     {isOwner&&<Text className='muted small' onClick={()=>markItem(x.id,x.status==='have'?'needed':'have')}>{x.status==='have'?'取消已有':'家中已有'}</Text>}
    </View>)}
   </View>}
  </View>}

  {tab==='profile'&&<View>
   <Text className='heading'>家庭空间</Text>
   {isDemoMode()?<View className='panel'>
    <Text className='heading'>演示模式</Text>
    <Text className='muted'>当前为本地演示数据。配置 TARO_APP_API_BASE_URL 并关闭 TARO_APP_DEMO_MODE 后接入真实家庭空间。</Text>
   </View>:!session?<View className='empty'>尚未登录，请检查网络后重新打开小程序。</View>:<View>
    <View className='panel'>
     <Text className='heading'>{session.space.name}</Text>
     <Text className='muted'>我的角色：{isOwner?'👨‍🍳 掌勺者 · 菜谱管理 / 菜单确认 / 采购管理':'👨‍👩‍👧 家庭成员 · 浏览、收藏、点菜'}</Text>
     {session.space.inviteCode&&<View className='selectRow' onClick={copyInvite}>
      <Text className='grow'>邀请码：{session.space.inviteCode}</Text>
      <Text className='muted small'>点击复制</Text>
     </View>}
    </View>
    <View className='panel'>
     <Text className='heading'>加入其他家庭空间</Text>
     <Input className='field' placeholder='输入邀请码' value={joinCode} onInput={e=>setJoinCode(e.detail.value)}/>
     <Button className='secondary' loading={busy} onClick={joinSpace}>加入家庭空间</Button>
    </View>
   </View>}
  </View>}
 </View>
}