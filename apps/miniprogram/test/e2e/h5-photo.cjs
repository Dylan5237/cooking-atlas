/**
 * 真实照片跨设备链路：新空间 owner 录入菜谱并上传封面照片（真实 JPEG 经 /api/uploads 入 MinIO），
 * 另一 context 的 member 加入同空间后在图鉴看到封面（经 /api/uploads/content + Bearer 取 blob）。
 *   TRIAL_CODE=xxx PHOTO=<abs path> node test/e2e/h5-photo.cjs
 */
const path = require('path')
const fs = require('fs')
const { chromium } = require('playwright-core')

const BASE = process.env.H5_URL || 'http://127.0.0.1:18090/'
const SHOTS = path.resolve(__dirname, '../../../../shots/h5-cvm')
fs.mkdirSync(SHOTS, { recursive: true })
const log = (...a) => console.log('[PHOTO]', ...a)
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function step(who, name, fn) {
  try { await fn(); log(`OK [${who}] ${name}`) } catch (e) { log(`ERR [${who}] ${name}:`, String(e).split('\n')[0].slice(0, 180)) }
}

async function loginJoin(page, code, invite) {
  await page.fill('input[placeholder="试用码"]', code)
  await page.getByText('进入试用').click(); await sleep(3000)
  if (invite) {
    await page.getByText('我的').last().click(); await sleep(1200)
    await page.fill('input[placeholder="输入邀请码"]', invite)
    await page.getByText('加入家庭空间').click(); await sleep(2200)
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const owner = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'zh-CN' })).newPage()
  owner.on('pageerror', e => log('[owner.pageerror]', String(e).slice(0, 140)))

  await owner.goto(BASE, { waitUntil: 'domcontentloaded' })
  await sleep(2500)
  await step('owner', 'login(auto space)', () => loginJoin(owner, process.env.TRIAL_CODE))

  // 拿邀请码
  let invite = ''
  await step('owner', 'read-invite', async () => {
    await owner.getByText('我的').last().click(); await sleep(1500)
    invite = await owner.evaluate(() => {
      const el = [...document.querySelectorAll('view,text,taro-view-core,taro-text-core')].find(e => /^[0-9A-Z]{10}$/.test((e.textContent || '').trim()))
      return el ? el.textContent.trim() : ''
    })
    if (!invite) throw new Error('invite not found')
    log('invite =', invite)
  })

  // 录入带封面照的菜
  await step('owner', 'open-add', async () => {
    await owner.getByText('图鉴').last().click(); await sleep(1200)
    await owner.getByText('录入菜谱').last().click(); await sleep(1000)
    await owner.getByText('手动填写').click(); await sleep(700)
  })
  await step('owner', 'fill-form', async () => {
    await owner.fill('input[placeholder="菜名"]', '可乐鸡翅')
    await owner.fill('textarea[placeholder*="食材与用量"], input[placeholder*="食材与用量"]', '鸡翅中：500g\n可乐：1罐\n生抽：2勺')
    await owner.fill('textarea[placeholder*="制作步骤"], input[placeholder*="制作步骤"]', '鸡翅焯水\n煎至两面金黄\n倒可乐焖15分钟收汁')
  })
  await step('owner', 'upload-photo', async () => {
    const [fc] = await Promise.all([
      owner.waitForEvent('filechooser', { timeout: 10000 }),
      owner.getByText('选择一张成品照').last().click(),
    ])
    await fc.setFiles(process.env.PHOTO)
    await sleep(3000) // 等上传完成 toast
  })
  await step('owner', 'save', async () => {
    await owner.getByText('保存菜谱').last().click(); await sleep(2500)
  })
  await owner.screenshot({ path: path.join(SHOTS, 'd1-owner-after-save.png'), fullPage: true })

  // 校验封面 blob 图在 owner 端渲染
  const ownerImg = await owner.evaluate(() => {
    const imgs = [...document.querySelectorAll('img')].filter(i => i.src.startsWith('blob:'))
    return imgs.map(i => ({ ok: i.naturalWidth > 0, w: i.naturalWidth, h: i.naturalHeight }))
  })
  log('owner blob imgs:', JSON.stringify(ownerImg))

  // member：另一 context 加入后查看图鉴
  const member = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'zh-CN' })).newPage()
  member.on('pageerror', e => log('[member.pageerror]', String(e).slice(0, 140)))
  await member.goto(BASE, { waitUntil: 'domcontentloaded' })
  await sleep(2500)
  await step('member', 'login+join', () => loginJoin(member, process.env.TRIAL_CODE, invite))
  await step('member', 'goto-atlas', async () => {
    await member.getByText('图鉴').last().click(); await sleep(2500)
  })
  await member.screenshot({ path: path.join(SHOTS, 'd2-member-atlas.png'), fullPage: true })
  const memberImg = await member.evaluate(() => {
    const card = [...document.querySelectorAll('[class*=fan-card],[class*=recipe],[class*=card]')].find(e => (e.textContent || '').includes('可乐鸡翅'))
    if (!card) return { found: false }
    const imgs = [...card.querySelectorAll('img')].concat(card.querySelector('img') ? [] : [])
    const all = [...document.querySelectorAll('img')].filter(i => i.src.startsWith('blob:'))
    return {
      found: true, cardImgs: imgs.map(i => ({ ok: i.naturalWidth > 0, w: i.naturalWidth })),
      blobCount: all.length, blobOk: all.filter(i => i.naturalWidth > 0).length,
      hasKele: (card.textContent || '').includes('可乐鸡翅'),
    }
  })
  log('member view:', JSON.stringify(memberImg))

  await browser.close()
  console.log('PHOTO-FLOW-DONE')
}

main().catch(e => { console.error('FAIL', e); process.exit(1) })
