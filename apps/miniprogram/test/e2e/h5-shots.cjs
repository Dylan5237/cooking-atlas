/**
 * 交付截图集：360/390/430 三档视口 × 关键页面（图鉴/点菜/采购/我的）+ ts.net HTTPS 入口实拍。
 *   TRIAL_CODE=xxx INVITE=4147F1946B node test/e2e/h5-shots.cjs
 */
const path = require('path')
const fs = require('fs')
const { chromium } = require('playwright-core')

const BASE = process.env.H5_URL || 'http://127.0.0.1:18090/'
const SHOTS = path.resolve(__dirname, '../../../../shots/h5-cvm')
fs.mkdirSync(SHOTS, { recursive: true })
const log = (...a) => console.log('[SHOTS]', ...a)
const sleep = ms => new Promise(r => setTimeout(r, ms))
const WIDTHS = [360, 390, 430]

async function main() {
  // --host-resolver-rules 把 ts.net 域名指到本机（SSH 隧道 → CVM tailscale），证书照常校验
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-proxy-server', '--host-resolver-rules=MAP review-svc.tail16fd19.ts.net 127.0.0.1'],
  })
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'zh-CN', ignoreHTTPSErrors: false })
  const page = await ctx.newPage()

  // 家人路径（HTTP）：三档视口 × 四个 tab
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await sleep(2500)
  await page.fill('input[placeholder="试用码"]', process.env.TRIAL_CODE)
  await page.getByText('进入试用').click(); await sleep(3000)
  await page.getByText('我的').last().click(); await sleep(1200)
  await page.fill('input[placeholder="输入邀请码"]', process.env.INVITE)
  await page.getByText('加入家庭空间').click(); await sleep(2200)

  const tabs = [
    ['图鉴', 'atlas'], ['点菜', 'order'], ['采购', 'shop'], ['我的', 'mine'],
  ]
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: Math.round(w * 2.16) })
    for (const [label, name] of tabs) {
      await page.getByText(label).last().click(); await sleep(1600)
      await page.screenshot({ path: path.join(SHOTS, `final-${name}-${w}.png`), fullPage: true })
      log(`shot ${name}-${w}`)
    }
  }

  // ts.net HTTPS 入口（经隧道 + 域名映射，真实证书校验）
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('https://review-svc.tail16fd19.ts.net:8443/', { waitUntil: 'domcontentloaded', timeout: 20000 })
  await sleep(3000)
  await page.fill('input[placeholder="试用码"]', process.env.TRIAL_CODE)
  await page.getByText('进入试用').click(); await sleep(3000)
  await page.screenshot({ path: path.join(SHOTS, 'final-tsnet-https-390.png'), fullPage: true })
  log('shot tsnet-https')

  await browser.close()
  console.log('SHOTS-DONE')
}

main().catch(e => { console.error('FAIL', e); process.exit(1) })
