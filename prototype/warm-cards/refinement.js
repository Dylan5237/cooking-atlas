/* V2 设计修订层。仅用于本页可点击原型；不是应用框架或 Claude 必须复用的代码。
 * 保留原型的状态、采购快照与导出流程，修正图标、图片缺省与文案。
 */
Object.assign(ICONS, {
  book: '<path fill="#dcead9" d="M5 3.5c4-.9 8.4-.8 13 .1l.2 16.8c-4.3-.8-8.6-.8-13 .1Z"/><path d="M5 3.5c4-.9 8.4-.8 13 .1l.2 16.8c-4.3-.8-8.6-.8-13 .1ZM8 4v16"/><path stroke="#b36850" d="m11 8 4 .2m-4 3.2 3-.1"/>',
  plate: '<path fill="#dcead9" d="M3.8 12c.9 5.1 3.5 7.5 8.2 7.5s7.3-2.4 8.2-7.5Z"/><path d="M3.8 12c.9 5.1 3.5 7.5 8.2 7.5s7.3-2.4 8.2-7.5M3.5 12h17M9 20h6"/><path stroke="#b36850" d="m14 4-5 7m9-6-5 6"/>',
  bag: '<path fill="#f3d3bc" d="m5 8-1 9.3c-.2 2.7 2.2 3.1 8 3.1s8.2-.4 8-3.1L19 8Z"/><path d="m5 8-1 9.3c-.2 2.7 2.2 3.1 8 3.1s8.2-.4 8-3.1L19 8ZM8 9V7a4 4 0 0 1 8 0v2"/><path stroke="#b36850" d="m9 15 1.8 1.8 4-4.2"/>',
  user: '<path fill="#dcead9" d="M8.5 8h7c.1 4 1.4 6 3 7.1V21h-13v-5.9C7.1 14 8.4 12 8.5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2M8.5 8h7c.1 4 1.4 6 3 7.1V21h-13v-5.9C7.1 14 8.4 12 8.5 8Z"/><path stroke="#b36850" d="M9 15h6v3H9Z"/>',
  heart: '<path d="M12 20S3 14.5 3 8.5c0-5 6.6-5.4 9-.9 2.4-4.5 9-4.1 9 .9 0 6-9 11.5-9 11.5Z"/>',
  shuffle: '<path d="M5 8a7.5 7.5 0 0 1 13-2l2 2M20 4v4h-4M19 16a7.5 7.5 0 0 1-13 2l-2-2M4 20v-4h4"/>',
  camera: '<rect x="3" y="6" width="18" height="14" rx="4"/><path d="m8 6 2-3h4l2 3"/><circle cx="12" cy="13" r="4"/>',
});

// 文案由显示的数据决定，不替用户判断情绪、熟练度或家人的态度。
const REFINEMENT_COPY = [
 ['做过的味道，都值得收藏。','收录自己做过的菜'],
 ['再打磨一下拿手菜。','编辑菜谱'],
 ['记一道新菜。','录入菜谱'],
 ['把这次的味道，变成下一次的底气。','填写食材与做法，核对后保存'],
 ['收录料理卡','录入菜谱'],
 ['再做一次，也很喜欢','我的收藏'],
 ['这一桌，大家都喜欢','待确认菜单'],
 ['保留家人心愿，再搭配其他味道。','保留家人点的菜，再补充其他搭配'],
 ['家人的心愿 · 换一桌时保留','家人点的菜 · 重新推荐时保留'],
 ['图鉴已有 · 熟悉的味道','已收录菜谱'],
 ['就吃这一桌 · 确认菜单','确认菜单'],
 ['点菜是心愿，由掌勺者安排','提交点菜后，由掌勺者确认'],
 ['换一桌灵感','换一组推荐'],
 ['翻到下一张','下一张'],
 ['收录新卡','录入菜谱'],
 ['轻触翻面，看配方与料理心得','点卡片查看配方'],
 ['图鉴不够？看看一道新菜建议','推荐一道新菜'],
 ['把心愿交给掌勺者。','确认我的点菜'],
 ['家人的点菜心愿','家人点菜'],
 ['已提交心愿，等待掌勺者确认','已提交点菜，等待确认'],
 ['这些是用餐心愿，不等于最终菜单，也不直接生成采购清单。','点菜还不是最终菜单。掌勺者确认后再生成采购清单。'],
 ['这顿做好了，记一笔','记录本次制作'],
 ['这一桌，做得怎么样？','记录本次制作'],
 ['这一家的料理记忆','制作记录'],
 ['料理记忆','制作记录'],
 ['记录与安排一桌好味道','管理菜谱与确认菜单'],
 ['收藏、点菜、等开饭','浏览菜谱与点菜'],
 ['我喜欢的味道','我的收藏'],
 ['家里的拿手菜','全部菜谱'],
 ['换一道，换个口味。','替换菜品'],
 ['第一张卡，<br>留给你的拿手菜。','还没有菜谱'],
 ['先定好这一桌，<br>再去买食材。','还没有采购清单'],
 ['去看看今晚的菜单','去确认菜单'],
 ['一张图，留住这道菜','导出菜谱卡'],
 ['一张菜谱卡','导出菜谱卡'],
 ['确认，收进我的图鉴','保存菜谱'],
 ['图鉴外的灵感','新菜建议'],
 ['今天也好好吃饭了。','未填写心得'],
 ['刚收进图鉴的一道新味道。',''],
 ['记录下来，下次就能重现这份味道。','未填写心得'],
 ['无照片时使用明确的示意封面。','无照片时显示“未上传成品照”，不套用其他菜的图片。'],
];
function refineCopy(text) {
  let value = String(text);
  // 仅替换系统文案；用户填写的标题、心得等暂存后还原。
  const keep = typeof state === 'object' && state ? [...state.recipes, ...state.candidates].flatMap(r => [r.title,r.description,r.note,...r.steps]).concat(state.logs.map(l=>l.note),state.wishes.map(w=>w.note)).filter(v => typeof v === 'string' && v.length > 1) : [];
  const originals=[];
  for(const raw of [...new Set(keep)].sort((a,b)=>b.length-a.length)){const safe=esc(raw);if(value.includes(safe)){const token=`__USER_COPY_${originals.length}__`;originals.push([token,safe]);value=value.split(safe).join(token);}}
  for (const [before, after] of REFINEMENT_COPY) value = value.split(before).join(after);
  value=value.split(ic('spark')).join('');
  for(const [token,safe] of originals)value=value.split(token).join(safe);
  return value;
}

// 修正原型的示例数据：不把示意插画当作成品照；不编造评价。
const PLACEHOLDER = 'assets/no-photo.svg';
BASE_RECIPES.forEach(r => {
  r.cover = PLACEHOLDER;
  r.description = '';
  r.note = '';
});
function normalizeCovers() {
  for (const r of [...state.recipes, ...state.candidates]) {
    if (!r.cover || /^assets\/(eggs|greens|noodles|pork|soup)\.svg$/.test(r.cover)) r.cover = PLACEHOLDER;
    if (r.note === '刚收进图鉴的一道新味道。') r.note = '';
  }
}
function hasPhoto(r) { return r.cover && r.cover !== PLACEHOLDER; }
function media(r, cls = '') {
  return hasPhoto(r)
    ? `<img class="${cls} real-photo" src="${esc(r.cover)}" alt="${esc(r.title)}成品照">`
    : `<span class="${cls} no-photo" aria-label="未上传成品照"><span class="photo-corners" aria-hidden="true"></span><small>未上传成品照</small></span>`;
}

const originalHome = home;
home = function () {
  if (!state.recipes.length) return refineCopy(originalHome());
  const r = findRecipe(state.hero) || state.recipes[0];
  const favorites = state.recipes.filter(item => state.favorites[role].includes(item.id));
  const recent = state.recipes.slice(0, 2);
  return `<div class="head-row"><div><h2>我的料理图鉴</h2><p class="subtitle">已收录 ${state.recipes.length} 道菜 · 我的收藏 ${favorites.length} 道</p></div><button class="iconbtn" data-action="browse" aria-label="搜索菜谱">${ic('search')}</button></div>
    <div class="stack"><div class="stack-base"></div><div class="stack-base second"></div><button class="hero-card" data-action="flip" aria-label="翻看${esc(r.title)}的配方"><span class="card-rotor"><span class="face"><span class="card-top">我的菜谱<strong>NO. ${esc(r.serial)}</strong></span>${media(r,'card-food')}<span class="card-title">${esc(r.title)}</span><span class="card-foot"><span>${esc(r.category)} · ${r.minutes || '—'} 分钟</span><span>${r.cooked ? `记录 ${r.cooked} 次` : '暂无制作记录'}</span></span></span><span class="face back"><span class="back-label">配方摘要 · ${r.servings} 人份</span><h3>${esc(r.title)}</h3><span class="back-ingredients">${r.ingredients.slice(0,3).map(i => `<span>${esc(i.name)} ${amount(i.quantity,i.unit)}</span>`).join('')}</span><p>${esc(r.steps[0] || '做法待补充')}</p><small>再点一次返回 · 完整步骤见详情</small></span></span></button></div>
    <div class="flip-hint">点卡片查看配方</div>
    <div class="paired"><button class="cta" data-action="${owner() ? 'add' : 'detail'}" data-id="${r.id}">${owner() ? '录入菜谱' : '查看菜谱'}</button><button class="cta ghost" data-action="next">下一张 ${ic('arrow')}</button></div>
    <div class="section-head"><h3>${favorites.length ? '我的收藏' : '已收录菜谱'}</h3><button class="textbtn" data-action="browse">全部菜谱 ${ic('chevron')}</button></div>
    <div class="mini-grid">${(favorites.length ? favorites : recent).slice(0,2).map(item => `<button class="mini-card" data-action="detail" data-id="${item.id}">${media(item,'mini-photo')}<b>${esc(item.title)}</b><small>${item.minutes} 分钟 · ${esc(item.category)}</small></button>`).join('')}</div>
    <div class="family-note"><span>家人点菜：${esc(findRecipe(state.wishes[0]?.ids[0])?.title || '暂无')}</span><button class="textbtn" data-action="nav" data-page="menu">查看 ${ic('chevron')}</button></div>
    <button class="linkline" data-action="detail" data-id="${r.id}">查看完整菜谱 ${ic('chevron')}</button>`;
};
const originalMenu = menu;
menu = function () {
  let html = refineCopy(originalMenu());
  html = html.replace(/<div class="kicker">[\s\S]*?<\/div>/, '')
    .replace(/<h2 class="menu-title">[\s\S]*?<\/h2>/, `<h2 class="menu-title">${owner() ? (state.meal==='dinner'?'今晚吃什么':'午餐吃什么') : '我来点菜'}</h2><p class="subtitle">${owner() ? '按人数搭配，也可以自己选' : '选好后提交，交给掌勺者安排'}</p>`)
    .replace('换一组推荐', (owner() ? state.plates : state.memberPicked).length ? '换一组推荐' : '推荐一桌菜');
  html = html.replace(/<img src="([^"]*)" alt="">/g, (match, src) => src === PLACEHOLDER ? '<span class="fan-placeholder">未上传照片</span>' : match.replace('<img ', '<img class="real-photo" '));
  return html;
};
const originalShopping = shopping;
shopping = function () {
  let html = refineCopy(originalShopping());
  html = html.replace(/<div class="kicker">PREPARE THE TABLE<\/div>/, '')
    .replace('晚餐采购单', '采购清单')
    .replace('菜单已定，把这一桌的材料备齐。', state.plan ? `${esc(state.plan.title)} · ${state.plan.items.length} 道菜` : '')
    .replace(`<div class="shop-hero">`, '<div class="shop-hero">')
    .replace(`</div>${ic('bag')}</div>`, '</div></div>'); // 不放大购物袋当装饰
  return html;
};
const originalProfile = profile;
profile = () => refineCopy(originalProfile()).replace(/<div class="kicker">OUR FAMILY COLLECTION<\/div>/, '');
const originalShow = show;
show = (phone, content, label) => originalShow(phone, refineCopy(content), refineCopy(label || '操作详情'));
const originalImportBody=importBody;
importBody=function(phone,mode){originalImportBody(phone,mode);const body=phone.querySelector('.import-body');body.innerHTML=refineCopy(body.innerHTML);};
const originalToast = toast;
toast = (phone, message) => originalToast(phone, refineCopy(message).replace('家人心愿','家人点菜'));
const originalRender = renderPhone;
renderPhone = function (phone) {
  normalizeCovers();
  originalRender(phone);
  const actionbar = phone.querySelector('.actionbar');
  actionbar.innerHTML = refineCopy(actionbar.innerHTML);
};
const originalReset = reset;
reset = function () { originalReset(); state.logs = []; renderAll(); };

// 本地选图可即时检验真实照片适配；不会上传文件，也不是云端保存。
const photoInput = document.createElement('input');
photoInput.type = 'file'; photoInput.accept = 'image/jpeg,image/png,image/webp'; photoInput.hidden = true;
photoInput.addEventListener('change', () => {
  const file = photoInput.files?.[0]; if (!file) return;
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
    alert('请选择 5 MB 内的 JPG、PNG 或 WebP 图片'); return;
  }
  const reader = new FileReader();
  reader.onload = () => { const r=findRecipe(state.hero); if(r) {r.cover=String(reader.result);renderAll();} };
  reader.readAsDataURL(file);
});
document.body.appendChild(photoInput);
document.querySelector('#try-photo')?.addEventListener('click', () => photoInput.click());
makePhones(); reset();

// 导出也使用修订后的文本与照片规则；长内容增加高度，不拉伸照片。
exportPng = async function(phone,id) {
  const r=findRecipe(id); if(!r) return;
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  const width=900,pad=60,available=width-pad*2;
  function wrap(text,size,max=available){ctx.font=`${size}px sans-serif`;let line='';const out=[];for(const ch of text){if(ctx.measureText(line+ch).width>max&&line){out.push(line);line=ch;}else line+=ch;}out.push(line);return out;}
  const titleLines=wrap(r.title,44),stepLines=r.steps.map((s,i)=>wrap(`${i+1}. ${s}`,27));
  const ingredientLines=r.ingredients.map(i=>wrap(`${i.name}  ${amount(i.quantity,i.unit)}`,27));
  const height=790+titleLines.length*56+ingredientLines.reduce((n,a)=>n+a.length*42,0)+stepLines.reduce((n,a)=>n+a.length*44+18,0);
  canvas.width=width;canvas.height=height;ctx.fillStyle='#fbf8ee';ctx.fillRect(0,0,width,height);
  ctx.fillStyle='#edf0e4';ctx.fillRect(pad,40,available,420);
  if(hasPhoto(r)){
    const image=new Image();image.src=r.cover;await image.decode();
    const scale=Math.min(available/image.width,420/image.height),w=image.width*scale,h=image.height*scale;
    ctx.drawImage(image,pad+(available-w)/2,40+(420-h)/2,w,h);
  }else{ctx.fillStyle='#64796c';ctx.font='24px sans-serif';ctx.textAlign='center';ctx.fillText('未上传成品照',width/2,260);ctx.textAlign='left';}
  let y=515;ctx.fillStyle='#64796c';ctx.font='19px sans-serif';ctx.fillText(`菜谱卡 · ${r.serial||'新菜建议'}`,pad,y);y+=61;
  ctx.fillStyle='#254b42';ctx.font='44px serif';for(const line of titleLines){ctx.fillText(line,pad,y);y+=56;}
  ctx.font='24px sans-serif';ctx.fillText(`${r.servings} 人份 · ${r.minutes||'—'} 分钟`,pad,y);y+=64;
  ctx.font='bold 30px sans-serif';ctx.fillText('食材',pad,y);y+=45;
  for(const lines of ingredientLines){ctx.font='27px sans-serif';for(const line of lines){ctx.fillText(line,pad,y);y+=42;}}
  y+=35;ctx.font='bold 30px sans-serif';ctx.fillText('做法',pad,y);y+=48;
  for(const lines of stepLines){ctx.font='27px sans-serif';for(const line of lines){ctx.fillText(line,pad,y);y+=44;}y+=18;}
  ctx.font='18px sans-serif';ctx.fillStyle='#64796c';ctx.fillText('料理图鉴 · 本页演示数据',pad,height-28);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('图片生成失败');
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${r.title}-菜谱卡.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);toast(phone,'PNG 已生成，请在浏览器下载中查看');
};
