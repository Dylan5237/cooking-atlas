import Taro from '@tarojs/taro'
import type{Recipe} from '@cooking-atlas/shared'

/**
 * 高清料理卡牌：Canvas 2D 合成 → canvasToTempFilePath 导出 → 相册保存 / 微信分享。
 *
 * 官方依据：
 *   - canvas type="2d" 时 canvasToTempFilePath 必须传 canvas 实例（非 canvasId）；
 *     destWidth/destHeight 控制导出分辨率（默认 width*像素密度）。
 *   - saveImageToPhotosAlbum 需要 scope.writePhotosAlbum 授权，filePath 只接受本地路径；
 *     用户拒绝后需引导 openSetting 重新授权。
 *
 * 布局与绘制分离：layoutCard 是纯函数（可单测），drawCard 只做 Canvas 调用。
 */
export const CARD_W=750
const PAD=48
const LINE=34
const palette={bg:'#fffefa',ink:'#2c3b30',muted:'#8c897f',accent:'#48634f',line:'#e9e5db',chip:'#eef1ea'}

export type Measure=(text:string,font:string)=>number
export type CardLayout={height:number;coverH:number;ingredientLines:string[];stepLines:string[];descLines:string[]}

function wrap(text:string,maxWidth:number,font:string,measure:Measure,maxLines:number):string[]{
 const out:string[]=[]
 let line=''
 for(const ch of String(text||'')){
  if(ch==='\n'){out.push(line);line='';if(out.length>=maxLines)break;continue}
  if(measure(line+ch,font)>maxWidth&&line){out.push(line);line=ch;if(out.length>=maxLines){line='';break}}
  else line+=ch
 }
 if(line&&out.length<maxLines)out.push(line)
 if(out.length===maxLines){
  // 截断提示：最后一行以 … 结尾（不伪造内容）
  const last=out[maxLines-1]
  out[maxLines-1]=last.length>1?last.slice(0,-1)+'…':'…'
 }
 return out
}

/** 纯函数布局：根据文本测量结果计算卡牌高度与各行内容（单测可用假 measure）。
 *  caps 限制各区块行数；导出完整菜谱卡时传大上限，内容多就增长画布，不截断步骤。 */
export type CardCaps={ingredients:number;steps:number;desc:number}
export function layoutCard(recipe:Pick<Recipe,'title'|'category'|'description'|'ingredients'|'steps'|'servings'|'cookingMinutes'>,hasCover:boolean,measure:Measure,caps:CardCaps={ingredients:6,steps:10,desc:3}):CardLayout{
 const inner=CARD_W-PAD*2
 const ingredientLines=wrap(recipe.ingredients.map(x=>x.name+' '+(x.quantity===null||x.quantity===undefined?'':x.quantity)+(x.unit||'')).join('、'),inner,'26px sans-serif',measure,caps.ingredients)
 const stepLines=wrap(recipe.steps.map((s,i)=>(i+1)+'. '+s.content).join('\n'),inner,'26px sans-serif',measure,caps.steps)
 const descLines=wrap(recipe.description||'',inner,'24px sans-serif',measure,caps.desc)
 const coverH=hasCover?400:0
 let height=PAD+40+70+20 // eyebrow + 标题 + 间距
 if(hasCover)height+=coverH+28
 height+=40+ingredientLines.length*LINE+24
 height+=40+stepLines.length*LINE+24
 if(descLines.length)height+=40+descLines.length*LINE+24
 height+=90 // footer
 return{height,coverH,ingredientLines,stepLines,descLines}
}

export type CardCtx={
 scale:(x:number,y:number)=>void
 fillStyle:string|CanvasGradient
 strokeStyle:string
 lineWidth:number
 font:string
 textBaseline:string
 fillRect:(x:number,y:number,w:number,h:number)=>void
 fillText:(text:string,x:number,y:number)=>void
 beginPath:()=>void
 moveTo:(x:number,y:number)=>void
 lineTo:(x:number,y:number)=>void
 stroke:()=>void
 save:()=>void
 restore:()=>void
 clip:()=>void
 rect:(x:number,y:number,w:number,h:number)=>void
 drawImage:(img:unknown,dx:number,dy:number,dw:number,dh:number)=>void
 createLinearGradient:(x0:number,y0:number,x1:number,y1:number)=>{addColorStop:(p:number,c:string)=>void}
 measureText:(text:string)=>{width:number}
}

/** 在已按 dpr 设置好物理尺寸的 Canvas 2D 上下文上绘制卡牌（逻辑坐标 750 宽） */
export function drawCard(ctx:CardCtx,recipe:Parameters<typeof layoutCard>[0],layout:CardLayout,dpr:number,coverImage?:unknown){
 ctx.scale(dpr,dpr)
 ctx.fillStyle=palette.bg;ctx.fillRect(0,0,CARD_W,layout.height)
 ctx.textBaseline='top'
 let y=PAD
 ctx.fillStyle=palette.muted;ctx.font='20px sans-serif'
 ctx.fillText('菜谱卡',PAD,y);y+=40
 ctx.fillStyle=palette.ink;ctx.font='bold 52px serif'
 ctx.fillText(recipe.title,PAD,y);y+=70
 ctx.fillStyle=palette.muted;ctx.font='24px sans-serif'
 ctx.fillText(recipe.category+' · '+(recipe.cookingMinutes||'待补充')+' 分钟 · '+recipe.servings+' 人份',PAD,y);y+=44
 if(layout.coverH&&coverImage){
  // aspectFill：按短边铺满裁切
  const img=coverImage as {width:number;height:number}
  const scale=Math.max(CARD_W/img.width,layout.coverH/img.height)
  const dw=img.width*scale,dh=img.height*scale
  ctx.save();ctx.beginPath();ctx.rect(0,y,CARD_W,layout.coverH);ctx.clip()
  ctx.drawImage(coverImage,(CARD_W-dw)/2,y+(layout.coverH-dh)/2,dw,dh)
  ctx.restore();y+=layout.coverH+28
 }else if(layout.coverH){y+=layout.coverH+28}
 const section=(title:string,lines:string[],font:string)=>{
  ctx.fillStyle=palette.accent;ctx.font='bold 28px sans-serif';ctx.fillText(title,PAD,y);y+=40
  ctx.fillStyle=palette.ink;ctx.font=font
  for(const line of lines){ctx.fillText(line,PAD,y);y+=LINE}
  y+=24
 }
 section('食材',layout.ingredientLines,'26px sans-serif')
 section('做法',layout.stepLines,'26px sans-serif')
 if(layout.descLines.length)section('心得',layout.descLines,'24px sans-serif')
 ctx.strokeStyle=palette.line;ctx.lineWidth=1
 ctx.beginPath();ctx.moveTo(PAD,y);ctx.lineTo(CARD_W-PAD,y);ctx.stroke()
 ctx.fillStyle=palette.muted;ctx.font='22px sans-serif'
 ctx.fillText('我的料理图鉴',PAD,y+24)
}

/** H5 导出：离屏 Canvas 全量合成（食材/步骤不截断）→ toBlob → 浏览器下载 */
export async function exportCardH5(recipe:Parameters<typeof layoutCard>[0],coverUrl?:string):Promise<void>{
 const canvas=document.createElement('canvas')
 const ctx=canvas.getContext('2d')!
 const dpr=Math.min(window.devicePixelRatio||1,3)
 const measure:Measure=(text,font)=>{ctx.font=font;return ctx.measureText(text).width}
 const layout=layoutCard(recipe,!!coverUrl,measure,{ingredients:200,steps:500,desc:60})
 canvas.width=Math.round(CARD_W*dpr);canvas.height=Math.round(layout.height*dpr)
 let cover:HTMLImageElement|undefined
 if(coverUrl){
  cover=await new Promise<HTMLImageElement>((resolve,reject)=>{
   const img=new Image()
   if(/^https?:/i.test(coverUrl))img.crossOrigin='anonymous'
   img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('COVER_IMAGE_LOAD_FAILED'))
   img.src=coverUrl
  }).catch(()=>undefined)
 }
 drawCard(ctx,recipe,layout,dpr,cover)
 const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/png'))
 if(!blob)throw new Error('PNG_GENERATE_FAILED')
 const url=URL.createObjectURL(blob)
 const a=document.createElement('a')
 a.href=url;a.download=`${recipe.title}-菜谱卡.png`;a.click()
 setTimeout(()=>URL.revokeObjectURL(url),10000)
}

/** 获取页面内 Canvas 2D 节点（Taro 选择器） */
export async function getCardCanvas(selector='#recipe-card'):Promise<{canvas:any;ctx:CardCtx}>{
 const query=Taro.createSelectorQuery()
 const node:any=await new Promise((resolve,reject)=>{
  query.select(selector).fields({node:true,size:true} as any).exec((res:any[])=>{
   const n=res?.[0]?.node
   if(n)resolve(n);else reject(new Error('CARD_CANVAS_NOT_FOUND'))
  })
 })
 return{canvas:node,ctx:node.getContext('2d') as CardCtx}
}

/** 加载封面图：网络签名 URL 先 downloadFile 到本地临时路径，再交给 canvas.createImage */
export async function loadCoverImage(canvas:any,url:string):Promise<unknown>{
 let src=url
 if(/^https?:/.test(url)){
  const dl=await Taro.downloadFile({url})
  if(dl.statusCode!==200)throw new Error('COVER_DOWNLOAD_FAILED')
  src=dl.tempFilePath
 }
 return new Promise((resolve,reject)=>{
  const img=canvas.createImage()
  img.onload=()=>resolve(img)
  img.onerror=()=>reject(new Error('COVER_IMAGE_LOAD_FAILED'))
  img.src=src
 })
}

/** 导出高清卡牌 PNG：destWidth/Height = 逻辑尺寸 × dpr（官方 canvas 实例参数） */
export async function exportCardImage(canvas:any,width:number,height:number,dpr:number):Promise<string>{
 const res=await Taro.canvasToTempFilePath({canvas,width,height,destWidth:Math.round(width*dpr),destHeight:Math.round(height*dpr),fileType:'png'} as any)
 return res.tempFilePath
}

/** 保存到相册：处理 scope.writePhotosAlbum 拒绝 → 引导 openSetting */
export async function saveCardToAlbum(filePath:string):Promise<void>{
 try{
  await Taro.saveImageToPhotosAlbum({filePath})
 }catch(e:any){
  const msg=String(e?.errMsg||e?.message||e)
  if(/auth|deny|authorize/i.test(msg)){
   const modal=await Taro.showModal({title:'需要相册权限',content:'保存卡牌需要访问相册，请在设置中开启「添加到相册」权限。',confirmText:'去设置'})
   if(modal.confirm){
    const setting=await Taro.openSetting()
    if(setting.authSetting?.['scope.writePhotosAlbum']){await Taro.saveImageToPhotosAlbum({filePath});return}
   }
   throw new Error('ALBUM_PERMISSION_DENIED')
  }
  throw e
 }
}