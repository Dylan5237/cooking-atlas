/** ts.net HTTPS 入口实拍：隧道 + 域名映射 + 真实证书校验，登录后截图。 */
const path = require('path')
const { chromium } = require('playwright-core')
const SHOTS = path.resolve(__dirname, '../../../../shots/h5-cvm')
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-proxy-server', '--host-resolver-rules=MAP review-svc.tail16fd19.ts.net 127.0.0.1'],
  })
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
  await page.goto('https://review-svc.tail16fd19.ts.net:8443/', { waitUntil: 'domcontentloaded', timeout: 20000 })
  await sleep(2500)
  await page.fill('input[placeholder="试用码"]', process.env.TRIAL_CODE)
  await page.getByText('进入试用').click()
  await sleep(3000)
  await page.screenshot({ path: path.join(SHOTS, 'final-tsnet-https-390.png'), fullPage: true })
  console.log('TSNET-OK title=', await pTitle(page))
  await browser.close()

  async function pTitle(p) { return p.title() }
}

main().catch(e => { console.error('FAIL', e.message); process.exit(1) })
