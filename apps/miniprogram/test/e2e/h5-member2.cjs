/**
 * B（member）完整点菜流程（幂等：登录→加入(upsert)→主食→加菜→备注→提交）。
 *   TRIAL_CODE=xxx INVITE=xxx node test/e2e/h5-member2.cjs
 * 每步 dump + 截图 + 容错继续，便于迭代修选择器。
 */
const path = require('path')
const fs = require('fs')
const { chromium } = require('playwright-core')

const BASE = process.env.H5_URL || 'http://127.0.0.1:18090/'
const SHOTS = path.resolve(__dirname, '../../../../shots/h5-cvm')
fs.mkdirSync(SHOTS, { recursive: true })
const log = (...a) => console.log('[B2]', ...a)
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function dump(page, tag, limit = 40) {
  const items = await page.evaluate(() => {
    const vis = els => els.filter(e => e.offsetParent !== null)
    return vis([...document.querySelectorAll('view,button,taro-button-core,[class*=btn],[class*=chip],[class*=cta],[class*=item],[class*=row],[class*=card]')])
      .map(e => ({ cls: (e.className || '').toString().trim().slice(0, 28), text: (e.innerText || '').trim().replace(/\n/g, '|').slice(0, 46) }))
      .filter(x => x.text)
  })
  log(`DUMP ${tag}:`, JSON.stringify(items.slice(0, limit)))
}

async function step(name, fn) {
  try { await fn(); log(`OK ${name}`) } catch (e) { log(`ERR ${name}:`, String(e).split('\n')[0].slice(0, 160)) }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'zh-CN' })
  const page = await ctx.newPage()
  page.on('pageerror', e => log('[pageerror]', String(e).slice(0, 160)))

  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await sleep(2500)
  await step('login', async () => {
    await page.fill('input[placeholder="试用码"]', process.env.TRIAL_CODE)
    await page.getByText('进入试用').click(); await sleep(3000)
  })
  await step('join', async () => {
    await page.getByText('我的').last().click(); await sleep(1200)
    await page.fill('input[placeholder="输入邀请码"]', process.env.INVITE)
    await page.getByText('加入家庭空间').click(); await sleep(2200)
  })
  await step('goto-order', async () => {
    await page.getByText('点菜').last().click(); await sleep(1500)
  })

  // 主食：打开选择 sheet → 选 蒸米饭
  await step('staple-open', async () => {
    await page.locator('[class*=staple]').first().click(); await sleep(1000)
  })
  await dump(page, 'staple-sheet')
  await page.screenshot({ path: path.join(SHOTS, 'b4-staple-sheet.png') })
  await step('staple-pick', async () => {
    await page.getByText('蒸米饭').last().click(); await sleep(900)
  })
  await dump(page, 'after-staple-pick')
  await page.screenshot({ path: path.join(SHOTS, 'b5-after-staple-pick.png') })

  // 加一道：红烧排骨（点行容器；若 sheet 未关先尝试关掉）
  await step('add-dish-1', async () => {
    await page.getByText('＋ 加一道').last().click(); await sleep(1000)
  })
  await dump(page, 'add-picker')
  await page.screenshot({ path: path.join(SHOTS, 'b6-add-picker.png') })
  await step('pick-paigu', async () => {
    await page.locator('.recipe-row', { hasText: '红烧排骨' }).locator('.row-action').first().click(); await sleep(1000)
  })
  await page.screenshot({ path: path.join(SHOTS, 'b6b-after-pick-paigu.png') })
  await dump(page, 'after-pick-paigu')

  // 再加 清炒时蔬（pick 模式点 › 后 sheet 会自动关，需重开）
  await step('add-dish-2', async () => {
    await page.getByText('＋ 加一道').last().click({ timeout: 8000 })
    await sleep(900)
    await page.locator('.recipe-row', { hasText: '清炒时蔬' }).locator('.row-action').first().click(); await sleep(900)
  })
  await dump(page, 'after-pick-shicai')

  // 关闭浏览 sheet（如有）
  await step('close-picker', async () => {
    const x = page.locator('.close-row .iconbtn')
    if (await x.count()) await x.first().click(); await sleep(800)
  })
  await dump(page, 'after-close-picker')
  await page.screenshot({ path: path.join(SHOTS, 'b6c-order-filled.png'), fullPage: true })

  // 备注 + 提交
  await step('note', async () => {
    await page.fill('input[placeholder*="给掌勺者的备注"]', '排骨软烂一点，少油')
  })
  await page.screenshot({ path: path.join(SHOTS, 'b7-before-submit.png'), fullPage: true })
  await step('submit', async () => {
    await page.getByText('提交我的点菜').last().click(); await sleep(2500)
  })
  await dump(page, 'after-submit')
  await page.screenshot({ path: path.join(SHOTS, 'b8-after-submit.png'), fullPage: true })

  await browser.close()
  console.log('B-FLOW-DONE')
}

main().catch(e => { console.error('FAIL', e); process.exit(1) })
