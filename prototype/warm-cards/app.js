/* 可点击设计原型。全部为本页演示状态；与真实 API、AI、用户账户完全隔离。 */
const ICONS = {
  book:'<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M9 3v18M13 8h3M13 12h3"/>',
  plate:'<circle cx="13" cy="12" r="7"/><path d="M2 4v7h3V4M3.5 11v9M23 4v16"/>',
  bag:'<path d="M5 7h14l2 14H3Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 22v-2a8 8 0 0 1 16 0v2"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',spark:'<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3ZM20 2v4M18 4h4"/>',
  arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',heart:'<path d="M12 21 3 12C-3 4 8-2 12 6c4-8 15-2 9 6Z"/>',
  search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',check:'<path d="m4 12 5 5L20 6"/>',
  shuffle:'<path d="M3 5h3l12 14h3m-4-4 4 4-4 4M3 19h3l12-14h3m-4-4 4 4-4 4"/>',
  leaf:'<path d="M21 3C5 1 1 12 7 17s16-1 14-14ZM4 21 16 9"/>',
  copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  camera:'<path d="m8 5 2-3h4l2 3h5v15H3V5Z"/><circle cx="12" cy="12" r="4"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',chevron:'<path d="m9 5 7 7-7 7"/>',
  home:'<path d="m3 11 9-8 9 8v10H3ZM9 21v-8h6v8"/>',flip:'<path d="M5 7a8 8 0 1 1-1 8M2 3v5h5"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  edit:'<path d="m14 4 6 6M3 21l5-1L21 7l-5-5L3 15Z"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
};
const ic = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.leaf}</svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone = value => JSON.parse(JSON.stringify(value));
const asset = id => `assets/${id}.svg`;
const amount = (q,u) => q == null ? (u === '适量' ? '适量' : '待核对') : `${Number(q.toFixed(2))} ${u}`;
const ingredient = (name, quantity, unit, group='蔬菜与配料') => ({name,quantity,unit,group});
const BASE_RECIPES = [
  {id:'noodles',serial:'005',title:'葱油拌面',category:'主食',minutes:12,servings:2,cooked:4,signature:true,cover:asset('noodles'),description:'小火慢熬的葱油，是这碗面的灵魂。',ingredients:[ingredient('面条',200,'g','主食与肉蛋'),ingredient('小葱',1,'把'),ingredient('生抽',2,'勺','调味与其他')],steps:['小葱切段，冷油下锅，小火熬至葱段金黄。','面条煮熟，沥水。葱油加入生抽拌开，再和面条拌匀。'],note:'葱油多熬一点，下次忙的时候就有一碗好面。'},
  {id:'pork',serial:'002',title:'红烧五花肉',category:'荤菜',minutes:60,servings:3,cooked:3,signature:true,cover:asset('pork'),description:'小火慢炖，等到肥肉也变得温柔。',ingredients:[ingredient('五花肉',500,'g','主食与肉蛋'),ingredient('姜',3,'片'),ingredient('生抽',2,'勺','调味与其他'),ingredient('冰糖',null,'适量','调味与其他')],steps:['五花肉切块焯水，沥干。','冰糖小火炒色，倒入肉块翻匀。加入生抽、姜和热水，小火炖至软烂，收汁。'],note:'家人点的菜。下次再少放一点糖。'},
  {id:'greens',serial:'003',title:'蒜蓉西兰花',category:'素菜',minutes:10,servings:2,cooked:5,signature:false,cover:asset('greens'),description:'脆一点，蒜香浓一点。',ingredients:[ingredient('西兰花',1,'颗'),ingredient('大蒜',4,'瓣'),ingredient('盐',null,'适量','调味与其他')],steps:['西兰花切小朵，清洗后焯水。','蒜末炒香，加入西兰花快速翻炒，加盐调味。'],note:'焯水之后不要焖，颜色更好看。'},
  {id:'soup',serial:'004',title:'冬瓜排骨汤',category:'汤羹',minutes:45,servings:4,cooked:2,signature:false,cover:asset('soup'),description:'一口清润，给这顿饭收个温暖的尾。',ingredients:[ingredient('排骨',400,'g','主食与肉蛋'),ingredient('冬瓜',300,'g'),ingredient('姜',2,'片'),ingredient('盐',null,'适量','调味与其他')],steps:['排骨焯水，洗净浮沫。','加姜和清水炖煮，再下冬瓜煮熟，最后调味。'],note:'这份原菜谱是 4 人份，不要统一按 2 人份换算。'},
  {id:'eggs',serial:'001',title:'番茄炒蛋',category:'家常菜',minutes:15,servings:2,cooked:6,signature:false,cover:asset('eggs'),description:'家里最熟悉、也最想念的那一口。',ingredients:[ingredient('番茄',2,'个'),ingredient('鸡蛋',3,'个','主食与肉蛋'),ingredient('糖',null,'适量','调味与其他'),ingredient('盐',null,'适量','调味与其他')],steps:['鸡蛋打散炒至凝固，盛出。','番茄炒出汁，倒回鸡蛋，调味拌匀。'],note:'分量可以改，酸甜记得留给自己的口味。'}
];
let role='owner', state, drawTurn=0;
const owner = () => role === 'owner';
const findRecipe = id => state.recipes.find(r=>r.id===id) || state.candidates.find(r=>r.id===id);
const getDraftKey = () => JSON.stringify([state.people,state.meal,state.plates]);
function snapshot(){
  return {id:`plan-${Date.now()}`,title:state.meal==='dinner'?'今晚的家庭晚餐':'今天的家庭午餐',people:state.people,meal:state.meal,key:getDraftKey(),items:state.plates.map(p=>({recipe:clone(findRecipe(p.id)),target:p.target})).filter(p=>p.recipe)};
}
function calculateShopping(plan, previous=[]){
  const map=new Map();
  for(const {recipe:r,target} of plan.items){
    for(const ing of r.ingredients){
      const key=`${ing.name}|${ing.unit}`;
      if(!map.has(key))map.set(key,{id:key,name:ing.name,unit:ing.unit,quantity:0,unknown:false,group:ing.group||'蔬菜与配料',sources:[],status:'needed'});
      const row=map.get(key);
      if(ing.quantity==null)row.unknown=true;
      else row.quantity+=ing.quantity*target/r.servings;
      row.sources.push(r.title);
    }
  }
  return [...map.values()].map(x=>{
    if(x.quantity===0&&x.unknown)x.quantity=null;
    x.calculated=x.quantity;
    const old=previous.find(o=>o.id===x.id && o.calculated===x.calculated && o.unknown===x.unknown);
    if(old){x.status=old.status;x.quantity=old.quantity;x.note=old.note;}
    return x;
  });
}
function reset(){
  state={recipes:clone(BASE_RECIPES),candidates:[],hero:'noodles',people:3,meal:'dinner',favorites:{owner:['pork','noodles'],member:['pork']},wishes:[{by:'家人',ids:['pork'],note:'想吃红烧肉，少放一点糖。'}],memberPicked:['pork','soup'],plates:[{id:'pork',target:3},{id:'greens',target:3},{id:'soup',target:3},{id:'eggs',target:3}],plan:null,shopping:[],logs:[]};
  state.plan=snapshot();state.shopping=calculateShopping(state.plan);
  state.shopping.forEach(i=>{if(['大蒜','生抽'].includes(i.name))i.status='have';});
  drawTurn=0;document.querySelectorAll('.phone').forEach((phone,i)=>{phone.dataset.page=['home','menu','shop'][i];phone.querySelector('.view').scrollTop=0;});renderAll();
}
function makePhones(){
  document.querySelector('#screens').innerHTML=['home','menu','shop'].map((page,i)=>`<div class="device"><section class="phone" data-page="${page}" data-index="${i}"><div class="status"><span>9:41</span><b>▴ ▰ ▱</b></div><div class="appbar"><span class="brand">${ic('book')}料理图鉴</span><span class="capsule" aria-hidden="true">···<i></i>◉</span></div><div class="view"></div><div class="actionbar" hidden></div><nav class="nav" aria-label="主导航"></nav><div class="modal" role="dialog" aria-modal="true" aria-label="操作详情"><div class="sheet"></div></div><div class="toast" role="status" aria-live="polite"></div></section></div>`).join('');
}
function toast(phone,message){const el=phone.querySelector('.toast');el.textContent=message;el.classList.add('show');clearTimeout(el._timer);el._timer=setTimeout(()=>el.classList.remove('show'),2400);}
function renderAll(){document.querySelectorAll('.phone').forEach(renderPhone);}
function nav(page){return [['home','book','图鉴'],['menu','plate','点菜'],['shop','bag','采购'],['profile','user','我的']].map(([key,icon,title])=>`<button data-action="nav" data-page="${key}" class="${page===key?'on':''}" aria-current="${page===key?'page':'false'}">${ic(icon)}${title}</button>`).join('');}
function renderPhone(phone){
  const view=phone.querySelector('.view'),scroll=view.scrollTop,page=phone.dataset.page;
  view.innerHTML=page==='home'?home():page==='menu'?menu():page==='shop'?shopping():profile();view.scrollTop=scroll;
  phone.querySelector('.nav').innerHTML=nav(page);
  const bar=phone.querySelector('.actionbar');bar.hidden=!['menu','shop'].includes(page);
  if(page==='menu')bar.innerHTML=`<div class="above"><span>${owner()?'掌勺者确认后，再生成采购清单':'点菜是心愿，由掌勺者安排'}</span><span>${state.people} 人 · ${state.meal==='dinner'?'晚餐':'午餐'}</span></div><button class="cta" data-action="${owner()?'review':'submit'}" ${!state.recipes.length?'disabled':''}>${owner()?'就吃这一桌 · 确认菜单':'提交我的点菜'} ${ic('arrow')}</button>`;
  if(page==='shop')bar.innerHTML=`<button class="cta" data-action="copy-shopping" ${!state.plan?'disabled':''}>${ic('copy')}复制待购清单</button>`;
}
function home(){
  if(!state.recipes.length)return `<div class="kicker">YOUR COLLECTION STARTS HERE</div><h2>我的料理图鉴</h2><div class="empty">${ic('book')}<h3>第一张卡，<br>留给你的拿手菜。</h3><p>${owner()?'拍张成品照，记下这次的做法。':'等掌勺者收进第一道菜，<br>你就可以从这里点菜了。'}</p>${owner()?'<button class="cta" data-action="add">＋ 收录第一道菜</button>':''}</div>`;
  const r=findRecipe(state.hero)||state.recipes[0];
  const favorites=state.recipes.filter(r=>state.favorites[role].includes(r.id));
  return `<div class="head-row"><div><h2>我的料理图鉴</h2><p class="subtitle">做过的味道，都值得收藏。</p></div><button class="iconbtn" data-action="browse" aria-label="搜索和浏览全部菜谱">${ic('search')}</button></div>
    <div class="meta-pills"><span class="pill">已收集 <strong>${String(state.recipes.length).padStart(2,'0')}</strong> 道</span><span class="pill">拿手菜 <strong>${String(state.recipes.filter(r=>r.signature).length).padStart(2,'0')}</strong> 道</span></div>
    <div class="stack"><div class="stack-base"></div><div class="stack-base second"></div><button class="hero-card" data-action="flip" aria-label="翻看${esc(r.title)}的配方"><span class="card-rotor"><span class="face"><span class="card-top">FAMILY COLLECTION<strong>${r.serial} ✧</strong></span><img class="card-food" src="${esc(r.cover)}" alt="${esc(r.title)}示意图"><span class="stamp">我家的<br>拿手菜</span><span class="card-title">${esc(r.title)}</span><span class="card-foot"><span>${esc(r.category)} · ${r.minutes||'—'} MIN</span><span>做过 ${r.cooked||1} 次 ↗</span></span></span><span class="face back"><span class="back-label">RECIPE / 配方背面</span><h3>${esc(r.title)}</h3><span class="back-ingredients">${r.ingredients.slice(0,3).map(i=>`<span>${esc(i.name)} ${amount(i.quantity,i.unit)}</span>`).join('')}</span><p>${esc(r.steps[0]||'做法待补充')}</p><small>${r.servings} 人份 · 再点一次回到正面</small></span></span></button></div>
    <div class="flip-hint">${ic('flip')}轻触翻面，看配方与料理心得</div>
    <div class="paired"><button class="cta" data-action="${owner()?'add':'detail'}" data-id="${r.id}">${ic(owner()?'plus':'book')}${owner()?'收录新卡':'查看完整菜谱'}</button><button class="cta ghost" data-action="next">翻到下一张 ${ic('arrow')}</button></div>
    <div class="section-head"><h3>再做一次，也很喜欢</h3><button class="textbtn" data-action="browse">全部图鉴 ${ic('chevron')}</button></div>
    <div class="mini-grid">${(favorites.length?favorites:state.recipes).slice(0,2).map(r=>`<button class="mini-card" data-action="detail" data-id="${r.id}"><span class="serial">ATLAS / ${r.serial}</span><img src="${esc(r.cover)}" alt=""><b>${esc(r.title)}</b><small>${r.minutes} 分钟 · ${esc(r.category)}</small></button>`).join('')}</div>
    <div class="family-note"><span>家人想吃：${esc(findRecipe(state.wishes[0]?.ids[0])?.title||'还没有点菜')}</span><button class="textbtn" data-action="nav" data-page="menu">去安排 ${ic('arrow')}</button></div>
    <button class="linkline" data-action="detail" data-id="${r.id}">查看这张卡的完整菜谱 ${ic('chevron')}</button>`;
}
function recipeRow(r,action='detail',meta=''){return `<div class="recipe-row"><button class="row-action" data-action="detail" data-id="${r.id}" aria-label="查看${esc(r.title)}"><img class="thumb" src="${esc(r.cover)}" alt=""></button><div class="copy"><b>${esc(r.title)} ${r.isNew?'<span class="new-badge">新菜建议</span>':''}</b><small>${meta||`${r.minutes||'—'} 分钟 · ${esc(r.category)}`}</small></div><button class="row-action" data-action="${action}" data-id="${r.id}" aria-label="${action==='swap'?'替换':action==='pick'?'选择':'查看'}${esc(r.title)}">${ic(action==='swap'?'shuffle':action==='pick'?'plus':'chevron')}</button></div>`;}
function menu(){
  const allWishes=[...new Set(state.wishes.flatMap(w=>w.ids))],current=owner()?state.plates:state.memberPicked.map(id=>({id,target:state.people}));
  const dishes=current.map(p=>findRecipe(p.id)).filter(Boolean);
  return `<div class="kicker">THE DINNER DECK / 今晚吃什么</div><h2 class="menu-title">没灵感？<br><em>抽一桌家的味道。</em></h2>
    <div class="config"><select data-control="meal" aria-label="用餐时段"><option value="dinner" ${state.meal==='dinner'?'selected':''}>今晚的晚餐</option><option value="lunch" ${state.meal==='lunch'?'selected':''}>今天的午餐</option></select><div class="people"><button data-action="people" data-delta="-1" aria-label="减少一人">−</button><strong>${state.people} 人</strong><button data-action="people" data-delta="1" aria-label="增加一人">＋</button></div></div>
    <div class="family-request"><span class="avatar">家</span><span>${allWishes.length?`家人想吃 ${allWishes.map(id=>findRecipe(id)?.title).filter(Boolean).map(esc).join('、')}`:'还没有点菜，先选一两道喜欢的。'}</span>${allWishes.length?ic('lock'):''}</div>
    ${dishes.length?`<div class="hand">${dishes.slice(0,3).map((r,i)=>`<button class="fan-card" data-action="detail" data-id="${r.id}"><span class="serial">NO.${r.serial||'NEW'}</span><span class="tag">${r.isNew?'未做过':allWishes.includes(r.id)?'家人点菜':r.category}</span><img src="${esc(r.cover)}" alt=""><b>${esc(r.title)}</b></button>`).join('')}</div>`:'<div class="empty"><p>先从图鉴挑几道想吃的，<br>再让它们组成今晚的菜单。</p></div>'}
    <p class="draw-hint">保留家人心愿，再搭配其他味道。</p><button class="cta ${owner()?'':'ghost'}" data-action="draw" ${!state.recipes.length?'disabled':''}>${ic('shuffle')}换一桌灵感</button>
    <div class="panel"><div class="panel-top"><span>${owner()?'这一桌，大家都喜欢':'我想吃这些'}</span><button class="textbtn" data-action="browse" data-mode="pick">加一道 ${ic('plus')}</button></div>${dishes.map(r=>recipeRow(r,owner()?'swap':'toggle-pick',allWishes.includes(r.id)?'家人的心愿 · 换一桌时保留':r.isNew?'新菜建议 · 不计入已做图鉴':'图鉴已有 · 熟悉的味道')).join('')||'<p class="mini">还没有选择菜品。</p>'}</div>
    <button class="linkline" data-action="requests">查看家人点菜与备注 ${ic('chevron')}</button><button class="linkline" data-action="new-suggestion">图鉴不够？看看一道新菜建议 ${ic('spark')}</button>`;
}
function shopping(){
  if(!state.plan)return `<h2>本次采购</h2><div class="empty">${ic('bag')}<h3>先定好这一桌，<br>再去买食材。</h3><p>只有掌勺者确认过的菜单，<br>才会生成采购清单。</p><button class="cta" data-action="nav" data-page="menu">去看看今晚的菜单 ${ic('arrow')}</button></div>`;
  const ready=state.shopping.filter(r=>r.status!=='needed').length,total=state.shopping.length;
  const groups=['蔬菜与配料','主食与肉蛋','调味与其他'].filter(g=>state.shopping.some(i=>i.group===g));
  return `<div class="kicker">PREPARE THE TABLE</div><div class="head-row"><h2>晚餐采购单</h2><span class="pill">${state.plan.people} 人份</span></div><p class="subtitle">菜单已定，把这一桌的材料备齐。</p>
    ${getDraftKey()!==state.plan.key?'<div class="state-banner">选菜有调整。这份清单仍对应上次确认的菜单，不会被悄悄覆盖。</div>':''}
    <div class="shop-hero"><div><div class="count">${ready}<span> / ${total}</span></div><p class="mini">已经备齐 · 含家中已有</p><div class="meter"><i style="width:${total?ready/total*100:0}%"></i></div></div>${ic('bag')}</div>
    ${groups.map((group,index)=>`<div class="shop-head"><span>${ic(index===0?'leaf':'bag')}${esc(group)}</span><span>${owner()?'点数量可调整':'家庭共享 · 只读'}</span></div><div class="shop-group">${state.shopping.filter(x=>x.group===group).map(x=>`<div class="shop-row ${x.status!=='needed'?'done':''} ${x.status==='purchased'?'bought':''}"><button class="check ${x.status!=='needed'?'done':''}" data-action="check" data-id="${esc(x.id)}" aria-label="${x.status==='needed'?'标记已购买':'取消备齐'}${esc(x.name)}" ${owner()?'':'disabled'}>${x.status==='have'?ic('home'):x.status==='purchased'?ic('check'):''}</button><div class="name"><span>${esc(x.name)}</span>${x.status==='have'?'<small>家中已有</small>':x.unknown?'<small>含适量或待核对用量</small>':''}</div><button class="qty" data-action="shop-edit" data-id="${esc(x.id)}">${amount(x.quantity,x.unit)}${x.unknown&&x.quantity!=null?' ＋ 适量':''}${owner()?ic('edit'):''}</button></div>`).join('')}</div>`).join('')}
    <div class="at-home">${ic('home')}<span>家里有的，不必再买。<br>${owner()?'点数量可改用量、标记已有，也能看到食材来自哪道菜。':'这份清单由掌勺者维护；你可以复制清单，帮忙买菜。'}</span></div>
    ${owner()?`<button class="linkline" data-action="log-meal">这顿做好了，记一笔 ${ic('arrow')}</button>`:''}`;
}
function profile(){
  return `<div class="kicker">OUR FAMILY COLLECTION</div><div class="profile-hero"><span class="avatar">${owner()?'我':'家'}</span><h2>森几的家</h2><p class="subtitle">${owner()?'掌勺者 · 记录与安排一桌好味道':'家庭成员 · 收藏、点菜、等开饭'}</p><div class="profile-stat"><span><b>${state.recipes.length}</b><small>已做菜谱</small></span><span><b>${state.favorites[role].length}</b><small>我的收藏</small></span><span><b>${state.logs.length}</b><small>本页新增记录</small></span></div></div><div class="panel"><div class="panel-top">一起吃饭的人</div><div class="recipe-row"><span class="avatar">森</span><div class="copy"><b>森几</b><small>掌勺者 · 管理菜谱与最终菜单</small></div></div><div class="recipe-row"><span class="avatar">家</span><div class="copy"><b>家人</b><small>收藏、点菜与查看清单</small></div></div><p class="helper mini">这是演示家庭。正式版由真实登录身份决定权限。</p></div><div class="panel"><div class="panel-top">这一家的料理记忆</div>${state.logs.map(l=>`<div class="recipe-row"><div class="copy"><b>${esc(l.title)}</b><small>${esc(l.note)}</small></div>${ic('check')}</div>`).join('')||'<p class="mini" style="margin-top:10px">做完一顿饭，可以在采购页记下心得。</p>'}</div><button class="linkline" data-action="browse" data-mode="favorite">看看我的收藏 ${ic('heart')}</button>`;
}
let focusBefore;
function show(phone,content,label='操作详情'){
  focusBefore=document.activeElement;const modal=phone.querySelector('.modal');modal.setAttribute('aria-label',label);
  modal.querySelector('.sheet').innerHTML=`<div class="grab"></div><div class="close-row"><span>${esc(label)}</span><button class="iconbtn" data-action="close" aria-label="关闭弹层">${ic('close')}</button></div>${content}`;
  modal.classList.add('open');modal.querySelector('.sheet').scrollTop=0;modal.querySelector('button,input,textarea')?.focus({preventScroll:true});
}
function close(phone){phone.querySelector('.modal').classList.remove('open');if(focusBefore?.isConnected)focusBefore.focus({preventScroll:true});}
function go(phone,page){close(phone);phone.dataset.page=page;renderPhone(phone);phone.querySelector('.view').scrollTop=0;}
function detail(phone,id){
  const r=findRecipe(id);if(!r)return;
  const favored=state.favorites[role].includes(id);
  show(phone,`<img class="dish-large" src="${esc(r.cover)}" alt="${esc(r.title)}示意图"><div class="head-row"><h2>${esc(r.title)}</h2><button class="iconbtn" data-action="favorite" data-id="${id}" aria-label="${favored?'取消':'添加'}收藏" aria-pressed="${favored}" style="color:${favored?'var(--accent)':'var(--muted)'}">${ic('heart')}</button></div><div class="detail-meta"><span class="pill">${esc(r.category)}</span><span class="pill">${r.minutes||'—'} 分钟</span><span class="pill">原配方 ${r.servings} 人份</span>${r.isNew?'<span class="new-badge">新菜建议 · 未做过</span>':''}</div><p class="mini">${esc(r.description)}</p><h3>食材</h3>${r.ingredients.map(i=>`<div class="ing-line"><span>${esc(i.name)}</span><span>${amount(i.quantity,i.unit)}</span></div>`).join('')}<h3>做法</h3>${r.steps.map((s,i)=>`<div class="step-line"><b>${i+1}</b><span>${esc(s)}</span></div>`).join('')}<div class="tip">${esc(r.note||'记录下来，下次就能重现这份味道。')}</div><div class="paired"><button class="cta" data-action="pick" data-id="${id}">加入点菜 ${ic('plus')}</button><button class="cta ghost" data-action="card" data-id="${id}">一张菜谱卡 ${ic('book')}</button></div>${owner()?`<button class="linkline" data-action="edit" data-id="${id}">编辑菜谱 ${ic('edit')}</button>`:''}`,'菜谱详情');
}
function browse(phone,mode='detail',swapId=''){
  phone._browse={mode,swapId,category:'全部',query:''};
  show(phone,`<h2>${mode==='favorite'?'我喜欢的味道':mode==='swap'?'换一道，换个口味。':'家里的拿手菜'}</h2><label>搜索菜名<input data-control="search" type="search" placeholder="输入菜名，比如番茄" aria-label="搜索菜名"></label><div class="chips">${['全部','荤菜','素菜','汤羹','主食','家常菜'].map(c=>`<button class="chip ${c==='全部'?'on':''}" data-action="filter" data-category="${c}">${c}</button>`).join('')}</div><div class="browse-results"></div>`,'浏览图鉴');
  browseResults(phone);
}
function browseResults(phone){
  const {mode,swapId,category,query}=phone._browse;
  const rows=state.recipes.filter(r=>(category==='全部'||r.category===category)&&r.title.includes(query)&&(mode!=='favorite'||state.favorites[role].includes(r.id)));
  phone.querySelector('.browse-results').innerHTML=rows.map(r=>`<div class="recipe-row"><img class="thumb" src="${esc(r.cover)}" alt=""><div class="copy"><b>${esc(r.title)}</b><small>${r.minutes} 分钟 · ${r.category}</small></div><button class="row-action" data-action="${mode==='swap'?'replace':mode==='pick'?'pick':'detail'}" data-id="${r.id}" data-old="${swapId}" aria-label="选择${esc(r.title)}">${ic(['swap','pick'].includes(mode)?'plus':'chevron')}</button></div>`).join('')||'<div class="modal-empty"><p class="mini">没有匹配的菜，换个词试试。</p></div>';
}
function review(phone){
  if(!owner())return toast(phone,'只有掌勺者能确认最终菜单');
  if(!state.plates.length)return toast(phone,'先从图鉴加一道菜吧');
  show(phone,`<h2>今晚，就吃这一桌。</h2><p class="subtitle">${state.people} 人 · ${state.plates.length} 道菜 · ${state.meal==='dinner'?'晚餐':'午餐'}</p>${state.plates.map(p=>{const r=findRecipe(p.id);return `<div class="recipe-row"><img class="thumb" src="${esc(r.cover)}" alt=""><div class="copy"><b>${esc(r.title)} ${r.isNew?'<span class="new-badge">未做过</span>':''}</b><small>原配方 ${r.servings} 人份</small></div><label style="width:78px;margin:0;font-size:9px">计划做几人份<input type="number" min="1" max="12" data-control="portion" data-id="${r.id}" value="${p.target}" aria-label="${esc(r.title)}计划份量"></label><button class="row-action" data-action="remove" data-id="${r.id}" aria-label="移除${esc(r.title)}">${ic('close')}</button></div>`;}).join('')}<div class="tip">人数不等于每道菜的份量。按这顿实际要做的份量换算；未知用量继续标为待核对。</div>${state.plan&&getDraftKey()!==state.plan.key?'<p class="helper">确认后更新采购清单：用量没变的保留已买/已有状态；有变化的重新核对，不静默覆盖人工调整。</p>':''}<button class="cta" data-action="confirm">确认菜单，生成采购清单 ${ic('arrow')}</button>`,'掌勺者确认');
}
function importSheet(phone,id=''){
  if(!owner())return toast(phone,'只有掌勺者能录入和修改菜谱');
  const r=id?findRecipe(id):null;
  phone._form=r?{...clone(r),editId:r.id}:{editId:'',title:'',description:'',cover:'',ingredients:[],steps:[],servings:2,category:'家常菜',minutes:15};
  show(phone,`<h2>${r?'再打磨一下拿手菜。':'记一道新菜。'}</h2><p class="subtitle">把这次的味道，变成下一次的底气。</p><div class="chips"><button class="chip ${r?'':'on'}" data-action="import-mode" data-mode="ai">AI 帮我整理</button><button class="chip ${r?'on':''}" data-action="import-mode" data-mode="manual">手动填写</button></div><div class="import-body"></div>`,'收录料理卡');
  importBody(phone,r?'manual':'ai');
}
function importBody(phone,mode){
  phone._importMode=mode;const f=phone._form;
  phone.querySelector('.import-body').innerHTML=mode==='ai'?`<label>菜名<input id="ai-title" value="${esc(f.title)}" placeholder="例如：番茄炒蛋"></label><label>说说你怎么做的<textarea id="ai-text" rows="4" placeholder="用了什么、怎么做的、有什么心得……">${esc(f.description)}</textarea></label><label class="upload">${ic('camera')}选择一张成品照<input type="file" accept="image/jpeg,image/png,image/webp" data-control="photo" aria-label="选择成品照"></label><div class="photo-preview">${f.cover?`<img class="upload-preview" src="${esc(f.cover)}" alt="本地成品照">`:''}</div><p class="helper">原型仅在本地预览照片。整理按钮只演示“输入 → 草稿”，不调用模型，不补造用量。</p><button class="cta" data-action="draft">${ic('spark')}整理成草稿</button><div class="paired"><button class="textbtn" data-action="example">用一段示例试试</button><button class="textbtn" data-action="ai-error">查看失败状态</button></div><div class="ai-error"></div>`:
    `<span class="pill warm">${f.editId?'编辑已有菜谱':'待核对草稿 · 确认后才保存'}</span><label>菜名<input id="m-title" value="${esc(f.title)}" placeholder="菜名"></label><div class="form-pair"><label>原配方几人份<input id="m-servings" type="number" min="1" max="12" value="${f.servings}"></label><label>预计用时（分钟）<input id="m-minutes" type="number" min="0" max="480" value="${f.minutes||0}"></label></div><label>分类<select id="m-category">${['家常菜','荤菜','素菜','汤羹','主食','甜品'].map(c=>`<option ${c===f.category?'selected':''}>${c}</option>`).join('')}</select></label><label>食材与用量 · 每行一项<textarea id="m-ingredients" rows="4" placeholder="番茄：2个&#10;鸡蛋：3个&#10;盐：适量">${esc(f.ingredients.map(i=>`${i.name}：${i.quantity??''}${i.unit}`).join('\n'))}</textarea></label><label>制作步骤 · 每行一步<textarea id="m-steps" rows="4" placeholder="记录自己的真实做法">${esc(f.steps.join('\n'))}</textarea></label><label class="upload">${ic('camera')}${f.cover?'更换成品照':'选择成品照'}<input type="file" accept="image/jpeg,image/png,image/webp" data-control="photo" aria-label="选择成品照"></label><div class="photo-preview">${f.cover?`<img class="upload-preview" src="${esc(f.cover)}" alt="本地成品照">`:''}</div><p class="helper">不清楚的数量写“适量”或“待补充”，不要为了完整而猜数值。无照片时使用明确的示意封面。</p><button class="cta" data-action="save-recipe">${f.editId?'保存修改':'确认，收进我的图鉴'} ${ic('check')}</button>`;
}
function parseIngredients(text){return text.split('\n').map(x=>x.trim()).filter(Boolean).map(line=>{const [name,...rest]=line.split(/[：:]/),raw=rest.join(':').trim(),m=raw.match(/^(\d+(?:\.\d+)?)\s*(.+)$/);return ingredient(name.trim(),m?Number(m[1]):null,m?m[2]:(raw||'待补充'),'调味与其他');});}
function collectManual(phone){
  const q=id=>phone.querySelector(id)?.value;
  if(!q('#m-title')?.trim())throw new Error('请填写菜名');
  const ingredients=parseIngredients(q('#m-ingredients')||''),steps=(q('#m-steps')||'').split('\n').map(s=>s.trim()).filter(Boolean);
  if(!ingredients.length||ingredients.some(i=>!i.name))throw new Error('请至少填写一项有名称的食材');
  if(!steps.length)throw new Error('请记录至少一步真实做法');
  const servings=Number(q('#m-servings')),minutes=Number(q('#m-minutes'));
  if(!Number.isInteger(servings)||servings<1||servings>12||!Number.isFinite(minutes)||minutes<0)throw new Error('请核对份量与时间');
  return {...phone._form,title:q('#m-title').trim(),category:q('#m-category'),servings,minutes,ingredients,steps};
}
async function copyText(phone,text){
  try{if(!navigator.clipboard)throw new Error('clipboard unavailable');await navigator.clipboard.writeText(text);toast(phone,'已复制待购清单');}
  catch{show(phone,`<h2>待购清单</h2><p class="helper">当前浏览器未开放剪贴板，请长按或选中复制。</p><textarea rows="12" readonly>${esc(text)}</textarea>`,'复制清单');}
}
function shoppingText(){return `${state.plan.title} · ${state.plan.people}人\n`+state.shopping.filter(i=>i.status==='needed').map(i=>`${i.name} ${amount(i.quantity,i.unit)}${i.unknown&&i.quantity!=null?' ＋ 适量待核对':''}`).join('\n');}
function shopEdit(phone,id){
  const i=state.shopping.find(i=>i.id===id);if(!i)return;
  show(phone,`<h2>${esc(i.name)}</h2><p class="subtitle">来自：${i.sources.map(esc).join('、')}</p>${owner()?`<label>采购数量（留空表示未知）<input id="shop-quantity" type="number" min="0" step="0.1" value="${i.quantity??''}"></label><p class="helper">单位：${esc(i.unit)}。${i.unknown?'仍包含“适量/待核对”部分，确认后按需要手动调整。':'原始换算量：'+amount(i.calculated,i.unit)}</p><label>当前状态<select id="shop-status"><option value="needed" ${i.status==='needed'?'selected':''}>还要买</option><option value="have" ${i.status==='have'?'selected':''}>家中已有</option><option value="purchased" ${i.status==='purchased'?'selected':''}>已经买好</option></select></label><button class="cta" data-action="shop-save" data-id="${esc(id)}">保存调整 ${ic('check')}</button>`:`<div class="tip">${amount(i.quantity,i.unit)} · ${i.status==='have'?'家中已有':i.status==='purchased'?'已购买':'待采购'}<br>由掌勺者维护，家庭成员只读。</div>`}`,'食材来源与用量');
}
function cardPreview(phone,id){
  const r=findRecipe(id);if(!r)return;
  show(phone,`<div class="export-preview"><img src="${esc(r.cover)}" alt="${esc(r.title)}"><div><p class="kicker">FAMILY COLLECTION / NO.${r.serial||'NEW'}</p><h3>${esc(r.title)}</h3><p class="mini">${r.servings} 人份 · ${r.minutes} 分钟</p><h3 style="font-size:13px;margin-top:16px">食材</h3>${r.ingredients.map(i=>`<div class="ing-line"><span>${esc(i.name)}</span><span>${amount(i.quantity,i.unit)}</span></div>`).join('')}<h3 style="font-size:13px;margin-top:16px">做法</h3>${r.steps.map((s,i)=>`<div class="step-line"><b>${i+1}</b><span>${esc(s)}</span></div>`).join('')}<p class="helper">森几的家 · 我的料理图鉴</p></div></div><button class="cta" data-action="export" data-id="${id}">${ic('download')}生成 PNG 菜谱长卡</button><p class="helper">包含完整食材与步骤，不截取页面按钮。当前为浏览器图片导出，不代表已写入微信相册。</p>`,'一张图，留住这道菜');
}
async function exportPng(phone,id){
  const r=findRecipe(id);if(!r)return;
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');const W=900,pad=70,textW=W-pad*2;
  function lines(text,size){ctx.font=`${size}px sans-serif`;const rows=[];let line='';for(const char of text){if(ctx.measureText(line+char).width>textW){rows.push(line);line=char;}else line+=char;}rows.push(line);return rows;}
  const steps=r.steps.map((s,i)=>lines(`${i+1}. ${s}`,28));const H=950+r.ingredients.length*55+steps.reduce((n,a)=>n+a.length*45+18,0);
  canvas.width=W;canvas.height=H;ctx.fillStyle='#fbf8ee';ctx.fillRect(0,0,W,H);ctx.fillStyle='#edf0e4';ctx.fillRect(35,35,W-70,480);
  const image=new Image();image.src=r.cover;await image.decode();ctx.drawImage(image,210,55,480,440);
  ctx.fillStyle='#64796c';ctx.font='18px sans-serif';ctx.fillText(`FAMILY COLLECTION / NO.${r.serial||'NEW'}`,pad,550);ctx.fillStyle='#254b42';ctx.font='bold 48px serif';ctx.fillText(r.title,pad,615);ctx.font='24px sans-serif';ctx.fillText(`${r.servings}人份 · ${r.minutes}分钟 · 我的料理图鉴`,pad,663);let y=724;
  ctx.font='bold 30px sans-serif';ctx.fillText('食材',pad,y);y+=48;
  for(const i of r.ingredients){ctx.font='27px sans-serif';ctx.fillText(i.name,pad,y);ctx.textAlign='right';ctx.fillText(amount(i.quantity,i.unit),W-pad,y);ctx.textAlign='left';y+=55;}
  y+=20;ctx.font='bold 30px sans-serif';ctx.fillText('做法',pad,y);y+=50;
  for(const rows of steps){ctx.font='28px sans-serif';for(const line of rows){ctx.fillText(line,pad,y);y+=45;}y+=18;}
  ctx.font='20px sans-serif';ctx.fillStyle='#64796c';ctx.fillText('森几的家 · 把做过的味道，收藏起来。',pad,H-34);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('图片生成失败');const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${r.title}-料理卡.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);toast(phone,'PNG 已生成，请在浏览器下载中查看');
}
function drawMeal(phone){
  const lock=[...new Set(state.wishes.flatMap(w=>w.ids))].filter(id=>state.recipes.some(r=>r.id===id));
  const suggested=[...lock];
  for(const c of ['素菜','汤羹','家常菜','主食','荤菜']){const options=state.recipes.filter(r=>r.category===c&&!suggested.includes(r.id));if(options.length)suggested.push(options[drawTurn%options.length].id);}
  const target=state.people===1?2:state.people<=3?4:5;
  if(drawTurn%2===1&&suggested.length>3){const n=suggested.indexOf('eggs'),m=suggested.indexOf('noodles');if(n>=0&&m>=0)[suggested[n],suggested[m]]=[suggested[m],suggested[n]];}
  const ids=suggested.slice(0,Math.max(target,lock.length));
  if(owner())state.plates=ids.map(id=>({id,target:state.people}));else state.memberPicked=ids;
  drawTurn++;renderAll();toast(phone,`已保留 ${lock.length} 道家人心愿，换好这桌搭配（规则演示）`);
}
function newSuggestion(phone){
  show(phone,`<span class="new-badge">新菜建议 · 尚未做过</span><h2 style="margin-top:10px">清炒藕片</h2><p class="subtitle">已有图鉴不足时，补一个清爽的选择。</p><div class="tip">这是固定演示建议，不是模型生成，也不是你已经会做的菜。需掌勺者确认配方后，才纳入本次菜单；不自动计入收藏。</div><label>本次准备做几人份<input id="new-servings" type="number" min="1" max="12" value="${state.people}"></label><label>确认食材用量<textarea id="new-ingredients" rows="3">莲藕：待补充
食用油：适量
盐：适量</textarea></label><label>确认制作步骤<textarea id="new-steps" rows="3" placeholder="核对做法后再填写"></textarea></label>${owner()?'<button class="cta" data-action="add-candidate">确认配方，加入本次菜单</button>':'<p class="helper">请由掌勺者确认是否尝试新菜。</p>'}`,'图鉴外的灵感');
}
// 所有操作都保留独立状态；演示权限与最终服务端鉴权不是同一回事。
document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-action]');if(!button||button.disabled)return;
  const phone=button.closest('.phone');if(!phone)return;
  const action=button.dataset.action,id=button.dataset.id;
  try{
    if(action==='nav')return go(phone,button.dataset.page);
    if(action==='close')return close(phone);
    if(action==='flip'){button.classList.toggle('flipped');return;}
    if(action==='next'){const i=state.recipes.findIndex(r=>r.id===state.hero);state.hero=state.recipes[(i+1)%state.recipes.length].id;renderAll();return;}
    if(action==='detail')return detail(phone,id);
    if(action==='browse')return browse(phone,button.dataset.mode||'detail');
    if(action==='filter'){phone._browse.category=button.dataset.category;phone.querySelectorAll('[data-action="filter"]').forEach(b=>b.classList.toggle('on',b===button));return browseResults(phone);}
    if(action==='favorite'){const list=state.favorites[role],i=list.indexOf(id);if(i<0)list.push(id);else list.splice(i,1);renderAll();detail(phone,id);return;}
    if(action==='pick'){if(owner()){if(!state.plates.some(p=>p.id===id))state.plates.push({id,target:state.people});}else if(!state.memberPicked.includes(id))state.memberPicked.push(id);renderAll();go(phone,'menu');toast(phone,'已加入选菜，尚未提交或确认');return;}
    if(action==='toggle-pick'){state.memberPicked=state.memberPicked.filter(v=>v!==id);renderAll();return;}
    if(action==='people'){state.people=Math.max(1,Math.min(12,state.people+Number(button.dataset.delta)));state.plates=state.plates.map(p=>({...p,target:state.people}));renderAll();return;}
    if(action==='draw')return drawMeal(phone);
    if(action==='swap')return browse(phone,'swap',id);
    if(action==='replace'){if(!owner())return toast(phone,'只有掌勺者能调整最终菜单');const p=state.plates.find(p=>p.id===button.dataset.old);if(state.plates.some(p=>p.id===id)&&id!==button.dataset.old)return toast(phone,'这道菜已经在菜单里');if(p)p.id=id;renderAll();close(phone);toast(phone,'已换一道，确认后才更新采购单');return;}
    if(action==='requests'){show(phone,`<h2>家人的点菜心愿</h2>${state.wishes.map(w=>`<div class="panel"><b>${esc(w.by)}</b><p class="subtitle">${w.ids.map(id=>esc(findRecipe(id)?.title||'菜谱已移除')).join('、')}</p><p class="mini">${esc(w.note||'没有备注')}</p></div>`).join('')}<p class="helper">这些是用餐心愿，不等于最终菜单，也不直接生成采购清单。</p>`,'家人点菜');return;}
    if(action==='submit'){if(!state.memberPicked.length)return toast(phone,'先选一道想吃的吧');show(phone,`<h2>把心愿交给掌勺者。</h2><p class="subtitle">${state.memberPicked.map(id=>esc(findRecipe(id).title)).join('、')}</p><label>给掌勺者的备注<textarea id="wish-note" rows="3" placeholder="例如：少辣、想喝汤"></textarea></label><button class="cta" data-action="submit-wish">提交我的点菜 ${ic('check')}</button>`,'提交点菜');return;}
    if(action==='submit-wish'){state.wishes=state.wishes.filter(w=>w.by!=='我（家人）');state.wishes.push({by:'我（家人）',ids:[...state.memberPicked],note:phone.querySelector('#wish-note').value.trim()});close(phone);renderAll();toast(phone,'已提交心愿，等待掌勺者确认');return;}
    if(action==='review')return review(phone);
    if(action==='remove'){if(!owner())return;state.plates=state.plates.filter(p=>p.id!==id);renderAll();if(state.plates.length)review(phone);else close(phone);return;}
    if(action==='confirm'){
      if(!owner())return toast(phone,'只有掌勺者能确认菜单');
      if(!state.plates.length)return toast(phone,'请至少选一道菜');
      const old=state.shopping;state.plan=snapshot();state.shopping=calculateShopping(state.plan,old);renderAll();go(phone,'shop');toast(phone,'菜单已确认，采购单已按配方换算');return;
    }
    if(action==='check'){if(!owner())return;const i=state.shopping.find(x=>x.id===id);i.status=i.status==='needed'?'purchased':'needed';renderAll();return;}
    if(action==='shop-edit')return shopEdit(phone,id);
    if(action==='shop-save'){if(!owner())return;const i=state.shopping.find(x=>x.id===id),raw=phone.querySelector('#shop-quantity').value,q=raw===''?null:Number(raw);if(q!==null&&(!Number.isFinite(q)||q<0))return toast(phone,'请填写有效数量');i.quantity=q;i.status=phone.querySelector('#shop-status').value;close(phone);renderAll();return;}
    if(action==='copy-shopping')return copyText(phone,shoppingText());
    if(action==='add')return importSheet(phone);
    if(action==='edit')return importSheet(phone,id);
    if(action==='import-mode'){
      if(phone._importMode==='ai'){phone._form.title=phone.querySelector('#ai-title').value;phone._form.description=phone.querySelector('#ai-text').value;}
      else {const val=id=>phone.querySelector(id)?.value||''; Object.assign(phone._form,{title:val('#m-title'),servings:Number(val('#m-servings'))||2,minutes:Number(val('#m-minutes'))||0,category:val('#m-category')||'家常菜',ingredients:parseIngredients(val('#m-ingredients')),steps:val('#m-steps').split('\n').filter(Boolean)});}
      phone.querySelectorAll('[data-action="import-mode"]').forEach(b=>b.classList.toggle('on',b===button));return importBody(phone,button.dataset.mode);
    }
    if(action==='example'){phone.querySelector('#ai-title').value='我家的番茄炒蛋';phone.querySelector('#ai-text').value='番茄：2个\n鸡蛋：3个\n盐：适量\n先炒鸡蛋盛出，再把番茄炒出汁，倒回鸡蛋调味。';return;}
    if(action==='ai-error'){phone.querySelector('.ai-error').innerHTML='<div class="error">服务暂时不可用（演示）。你的文字和照片仍在，可以重试，或切换手动填写。</div>';return;}
    if(action==='draft'){
      const title=phone.querySelector('#ai-title').value.trim(),text=phone.querySelector('#ai-text').value.trim();if(!title)return toast(phone,'先写一个菜名吧');
      if(!text&&!phone._form.cover)return toast(phone,'写一点做法，或选一张成品照');
      const rows=text.split('\n'),ingredients=rows.filter(line=>/[：:]/.test(line)),steps=rows.filter(line=>!/[：:]/.test(line)).filter(Boolean);
      Object.assign(phone._form,{title,description:text,ingredients:parseIngredients(ingredients.join('\n')),steps});
      phone.querySelectorAll('[data-action="import-mode"]').forEach(b=>b.classList.toggle('on',b.dataset.mode==='manual'));importBody(phone,'manual');toast(phone,'已进入草稿演示；未提供的食材需补充');return;
    }
    if(action==='save-recipe'){
      if(!owner())return toast(phone,'只有掌勺者能录入');const f=collectManual(phone);
      const r={...f,id:f.editId||`recipe-${Date.now()}`,serial:f.serial||String(state.recipes.length+1).padStart(3,'0'),cover:f.cover||asset('eggs'),cooked:f.cooked||1,signature:f.signature||false,note:f.note||'刚收进图鉴的一道新味道。'};
      if(f.editId){const i=state.recipes.findIndex(x=>x.id===f.editId);if(i>=0)state.recipes[i]=r;}else state.recipes.unshift(r);
      state.hero=r.id;close(phone);renderAll();go(phone,'home');toast(phone,'已保存到本页演示图鉴');return;
    }
    if(action==='new-suggestion')return newSuggestion(phone);
    if(action==='add-candidate'){
      if(!owner())return;const steps=phone.querySelector('#new-steps').value.trim().split('\n').filter(Boolean),servings=Number(phone.querySelector('#new-servings').value),ingredients=parseIngredients(phone.querySelector('#new-ingredients').value);
      if(!steps.length||!ingredients.length||!Number.isInteger(servings)||servings<1||servings>12)return toast(phone,'请先核对份量、食材和做法');
      const r={id:`candidate-${Date.now()}`,serial:'NEW',title:'清炒藕片',category:'素菜',minutes:15,servings,ingredients,steps,description:'图鉴外的新菜建议',cover:asset('greens'),isNew:true};state.candidates.push(r);state.plates.push({id:r.id,target:servings});close(phone);renderAll();toast(phone,'已加入本次菜单，未计入已做图鉴');return;
    }
    if(action==='card')return cardPreview(phone,id);
    if(action==='export')return await exportPng(phone,id);
    if(action==='log-meal'){if(!owner())return;show(phone,`<h2>这一桌，做得怎么样？</h2><p class="subtitle">${state.plan.items.map(i=>esc(i.recipe.title)).join('、')}</p><label>记下心得<textarea id="meal-note" rows="4" placeholder="火候、调味、家人的评价……"></textarea></label><button class="cta" data-action="save-log">保存制作记录 ${ic('check')}</button>`,'料理记忆');return;}
    if(action==='save-log'){if(!owner())return;state.logs.unshift({title:state.plan.title,note:phone.querySelector('#meal-note').value.trim()||'今天也好好吃饭了。'});close(phone);renderAll();toast(phone,'制作心得已保存在本页演示中');return;}
  }catch(error){console.error(error);toast(phone,error.message||'操作未完成，请重试');}
});
document.addEventListener('input',event=>{const phone=event.target.closest('.phone');if(!phone)return;if(event.target.dataset.control==='search'){phone._browse.query=event.target.value.trim();browseResults(phone);}});
document.addEventListener('change',async event=>{
  const input=event.target,phone=input.closest('.phone');if(!phone)return;
  if(input.dataset.control==='meal'){state.meal=input.value;renderAll();}
  if(input.dataset.control==='portion'){const n=Number(input.value);if(!Number.isInteger(n)||n<1||n>12){input.value=state.plates.find(p=>p.id===input.dataset.id).target;return toast(phone,'份量请填 1 到 12 的整数');}state.plates.find(p=>p.id===input.dataset.id).target=n;renderAll();}
  if(input.dataset.control==='photo'){
    const file=input.files?.[0];if(!file)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024)return toast(phone,'请选择 5 MB 内的 JPG、PNG 或 WebP 图片');
    const reader=new FileReader();reader.onload=()=>{phone._form.cover=String(reader.result);phone.querySelector('.photo-preview').innerHTML=`<img class="upload-preview" src="${esc(reader.result)}" alt="本地成品照">`;toast(phone,'照片仅在本地预览，没有上传');};reader.readAsDataURL(file);
  }
});
document.addEventListener('keydown',event=>{
  const modal=document.querySelector('.modal.open');if(!modal)return;
  if(event.key==='Escape')return close(modal.closest('.phone'));
  if(event.key==='Tab'){const list=[...modal.querySelectorAll('button:not(:disabled),input,textarea,select')].filter(el=>el.offsetParent!==null);const first=list[0],last=list.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
});
document.addEventListener('click',event=>{if(event.target.classList.contains('modal'))close(event.target.closest('.phone'));});
document.querySelector('#role').addEventListener('change',event=>{role=event.target.value;document.querySelectorAll('.phone').forEach(close);renderAll();});
document.querySelector('#reset').addEventListener('click',()=>{document.querySelectorAll('.phone').forEach(close);reset();});
document.querySelector('#empty').addEventListener('click',()=>{state.recipes=[];state.candidates=[];state.plates=[];state.memberPicked=[];state.plan=null;state.shopping=[];state.wishes=[];document.querySelectorAll('.phone').forEach(close);renderAll();});
makePhones();reset();
