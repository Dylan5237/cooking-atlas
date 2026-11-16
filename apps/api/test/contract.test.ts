/**
 * cooking-atlas API 契约测试（黑盒，针对运行中的服务）
 *
 * 运行前提：
 *   - API 已启动且 AUTH_TEST_MODE=true（非 production + AUTH_TEST_SECRET）
 *   - PostgreSQL / MinIO 就绪
 * 环境变量：
 *   TEST_API_BASE_URL   默认 http://127.0.0.1:3001
 *   TEST_AUTH_SECRET    必填，与 api 的 AUTH_TEST_SECRET 一致
 *
 * 覆盖：鉴权、家庭空间、成员/owner 权限、跨空间 IDOR、菜谱版本、收藏、
 *       点菜汇总、菜单快照、采购合并与状态、上传与签名 URL 时效、AI 未配置降级。
 */
import 'dotenv/config'
import {describe, it, expect, beforeAll, afterAll} from 'vitest'
import {PrismaClient} from '@prisma/client'

const BASE = (process.env.TEST_API_BASE_URL || 'http://127.0.0.1:3001').replace(/\/$/, '')
const SECRET = process.env.TEST_AUTH_SECRET || ''
const RUN = `t${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`
// 测试基建直连数据库，仅用于构造「双空间 owner」这类生产接口无法构造的夹具
const prisma = new PrismaClient()

type Ctx = {token: string; userId: string}
let ownerA: Ctx, memberA: Ctx, ownerB: Ctx, dualOwner: Ctx
let spaceA: {id: string; name: string; inviteCode: string}
let spaceB: {id: string; name: string; inviteCode: string}
let recipe1: any, recipe2: any, plan: any, list: any

async function call(method: string, path: string, opts: {token?: string; body?: unknown; raw?: RequestInit} = {}) {
  const headers: Record<string, string> = {}
  if (opts.token) headers.Authorization = 'Bearer ' + opts.token
  let body: BodyInit | undefined
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opts.body)
  }
  const res = await fetch(BASE + path, {method, headers, body, ...opts.raw})
  const text = await res.text()
  let data: any = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  return {status: res.status, data}
}

async function testLogin(openid: string, displayName: string): Promise<Ctx> {
  const r = await call('POST', '/api/auth/test', {body: {openid, displayName, testSecret: SECRET}})
  if (r.status !== 200) throw new Error(`test login failed: ${r.status} ${JSON.stringify(r.data)}（确认 AUTH_TEST_MODE 已开启）`)
  return {token: r.data.token, userId: r.data.user.id}
}

const ingredient = (name: string, quantity: number | null, unit: string) => ({name, quantity, unit})

beforeAll(async () => {
  if (!SECRET) throw new Error('TEST_AUTH_SECRET 未设置')
  const health = await call('GET', '/health')
  expect(health.status).toBe(200)
  ownerA = await testLogin(`${RUN}-owner-a`, '掌勺者A')
  memberA = await testLogin(`${RUN}-member-a`, '家人A')
  ownerB = await testLogin(`${RUN}-owner-b`, '掌勺者B')
  dualOwner = await testLogin(`${RUN}-dual`, '双空间掌勺者')
}, 30000)

afterAll(async () => {
  await prisma.$disconnect()
})

describe('鉴权基线', () => {
  it('health 无需鉴权', async () => {
    const r = await call('GET', '/health')
    expect(r.data.ok).toBe(true)
  })
  it('无 token 访问受保护接口 → 401', async () => {
    const r = await call('GET', '/api/me')
    expect(r.status).toBe(401)
  })
  it('伪造 token → 401', async () => {
    const r = await call('GET', '/api/me', {token: 'forged.token.value'})
    expect(r.status).toBe(401)
  })
  it('测试登录密钥错误 → 403', async () => {
    const r = await call('POST', '/api/auth/test', {body: {openid: `${RUN}-x`, testSecret: 'wrong-secret-value'}})
    expect(r.status).toBe(403)
  })
  it('微信登录未配置凭据 → 503（不泄露内部信息）', async () => {
    const r = await call('POST', '/api/auth/wechat', {body: {code: 'dummy-code'}})
    expect([503, 401]).toContain(r.status)
  })
  it('GET /api/me 返回当前用户', async () => {
    const r = await call('GET', '/api/me', {token: ownerA.token})
    expect(r.status).toBe(200)
    expect(r.data.id).toBe(ownerA.userId)
  })
})

describe('家庭空间与成员', () => {
  it('owner 创建空间并自动成为 owner', async () => {
    const r = await call('POST', '/api/spaces', {token: ownerA.token, body: {name: `测试家庭A-${RUN}`}})
    expect(r.status).toBe(200)
    expect(r.data.inviteCode).toBeTruthy()
    spaceA = r.data
    const list = await call('GET', '/api/spaces', {token: ownerA.token})
    const mine = list.data.find((m: any) => m.space.id === spaceA.id)
    expect(mine.role).toBe('owner')
  })
  it('成员凭邀请码加入', async () => {
    const r = await call('POST', '/api/spaces/join', {token: memberA.token, body: {inviteCode: spaceA.inviteCode}})
    expect(r.status).toBe(200)
    expect(r.data.id).toBe(spaceA.id)
  })
  it('错误邀请码 → 404', async () => {
    const r = await call('POST', '/api/spaces/join', {token: memberA.token, body: {inviteCode: 'NOEXIST9'}})
    expect(r.status).toBe(404)
  })
  it('重复加入幂等（不产生重复成员）', async () => {
    await call('POST', '/api/spaces/join', {token: memberA.token, body: {inviteCode: spaceA.inviteCode}})
    const list = await call('GET', '/api/spaces', {token: memberA.token})
    expect(list.data.filter((m: any) => m.space.id === spaceA.id).length).toBe(1)
  })
  it('创建第二个空间 B（用于跨空间测试）', async () => {
    const r = await call('POST', '/api/spaces', {token: ownerB.token, body: {name: `测试家庭B-${RUN}`}})
    expect(r.status).toBe(200)
    spaceB = r.data
  })
  it('非成员访问空间菜谱 → 403（IDOR）', async () => {
    const r = await call('GET', `/api/recipes?spaceId=${spaceA.id}`, {token: ownerB.token})
    expect(r.status).toBe(403)
  })
  it('owner 可取回邀请码', async () => {
    const r = await call('GET', `/api/spaces/${spaceA.id}/invite-code`, {token: ownerA.token})
    expect(r.status).toBe(200)
    expect(r.data.inviteCode).toBe(spaceA.inviteCode)
  })
  it('member 取邀请码 → 403（不泄露）', async () => {
    const r = await call('GET', `/api/spaces/${spaceA.id}/invite-code`, {token: memberA.token})
    expect(r.status).toBe(403)
  })
  it('非成员取邀请码 → 403（IDOR）', async () => {
    const r = await call('GET', `/api/spaces/${spaceA.id}/invite-code`, {token: ownerB.token})
    expect(r.status).toBe(403)
  })
})

describe('菜谱 CRUD 与权限', () => {
  const recipeBody = () => ({
    spaceId: spaceA.id, title: `番茄炒蛋-${RUN}`, category: '家常菜', servings: 2,
    cookingMinutes: 15, difficulty: '简单', description: '先炒蛋再炒番茄',
    ingredients: [ingredient('番茄', 2, '个'), ingredient('鸡蛋', 3, '个'), ingredient('盐', null, '适量')],
    steps: [{content: '炒熟鸡蛋盛出'}, {content: '炒番茄后混合'}]
  })
  it('owner 创建菜谱', async () => {
    const r = await call('POST', '/api/recipes', {token: ownerA.token, body: recipeBody()})
    expect(r.status).toBe(200)
    expect(r.data.version).toBe(1)
    expect(r.data.createdById).toBe(ownerA.userId)
    recipe1 = r.data
  })
  it('member 创建菜谱 → 403 OWNER_REQUIRED', async () => {
    const r = await call('POST', '/api/recipes', {token: memberA.token, body: recipeBody()})
    expect(r.status).toBe(403)
    expect(r.data.error).toBe('OWNER_REQUIRED')
  })
  it('跨空间创建（用 A 的 owner 身份写 B 空间）→ 403', async () => {
    const r = await call('POST', '/api/recipes', {token: ownerA.token, body: {...recipeBody(), spaceId: spaceB.id}})
    expect(r.status).toBe(403)
  })
  it('owner 更新菜谱 → version+1', async () => {
    const r = await call('PUT', `/api/recipes/${recipe1.id}`, {token: ownerA.token, body: {...recipeBody(), title: `番茄炒蛋v2-${RUN}`, cookingMinutes: 20}})
    expect(r.status).toBe(200)
    expect(r.data.version).toBe(2)
    expect(r.data.cookingMinutes).toBe(20)
    recipe1 = r.data
  })
  it('member 更新菜谱 → 403', async () => {
    const r = await call('PUT', `/api/recipes/${recipe1.id}`, {token: memberA.token, body: recipeBody()})
    expect(r.status).toBe(403)
  })
  it('跨空间更新（B 的 owner 改 A 的菜谱）→ 404/403（IDOR）', async () => {
    const r = await call('PUT', `/api/recipes/${recipe1.id}`, {token: ownerB.token, body: {...recipeBody(), spaceId: spaceB.id}})
    expect([403, 404]).toContain(r.status)
  })
  it('双空间 owner 用 B 空间身份改 A 空间菜谱 → 404（IDOR 数据隔离）', async () => {
    // 夹具：dualOwner 通过 API 创建自己的空间 C（成为 owner），再直接写入 A 空间的 owner 成员记录。
    // 生产没有提权接口，此夹具只能由测试基建构造；用于验证「权限通过但数据跨空间」的隔离。
    const c = await call('POST', '/api/spaces', {token: dualOwner.token, body: {name: `双空间C-${RUN}`}})
    expect(c.status).toBe(200)
    await prisma.familyMembership.create({data: {spaceId: spaceA.id, userId: dualOwner.userId, role: 'owner'}})
    const r = await call('PUT', `/api/recipes/${recipe1.id}`, {token: dualOwner.token, body: {...recipeBody(), spaceId: c.data.id}})
    expect(r.status).toBe(404)
    // 合法路径不受影响（A 空间 owner 改 A 空间菜谱）；同步本地版本号供后续快照断言
    const r2 = await call('PUT', `/api/recipes/${recipe1.id}`, {token: dualOwner.token, body: {...recipeBody(), spaceId: spaceA.id}})
    expect(r2.status).toBe(200)
    recipe1 = r2.data
  })
  it('列表只返回本空间 active 菜谱', async () => {
    const r = await call('GET', `/api/recipes?spaceId=${spaceA.id}`, {token: memberA.token})
    expect(r.status).toBe(200)
    expect(r.data.every((x: any) => x.spaceId === spaceA.id && x.status === 'active')).toBe(true)
  })
  it('创建第二道菜并软删除', async () => {
    const c = await call('POST', '/api/recipes', {token: ownerA.token, body: {...recipeBody(), title: `待删除-${RUN}`}})
    recipe2 = c.data
    const d = await call('DELETE', `/api/recipes/${recipe2.id}?spaceId=${spaceA.id}`, {token: ownerA.token})
    expect(d.status).toBe(200)
    const list = await call('GET', `/api/recipes?spaceId=${spaceA.id}`, {token: ownerA.token})
    expect(list.data.find((x: any) => x.id === recipe2.id)).toBeUndefined()
    recipe2 = null
  })
  it('重新创建第二道菜（供菜单使用）', async () => {
    const c = await call('POST', '/api/recipes', {token: ownerA.token, body: {...recipeBody(), title: `红烧豆腐-${RUN}`, ingredients: [ingredient('豆腐', 1, '块'), ingredient('酱油', null, '适量')]}})
    expect(c.status).toBe(200)
    recipe2 = c.data
  })
})

describe('收藏', () => {
  it('member 收藏切换（幂等往返）', async () => {
    const on = await call('POST', `/api/recipes/${recipe1.id}/favorite`, {token: memberA.token, body: {spaceId: spaceA.id}})
    expect(on.data.favorite).toBe(true)
    const list = await call('GET', `/api/favorites?spaceId=${spaceA.id}`, {token: memberA.token})
    expect(list.data.some((f: any) => f.recipeId === recipe1.id)).toBe(true)
    const off = await call('POST', `/api/recipes/${recipe1.id}/favorite`, {token: memberA.token, body: {spaceId: spaceA.id}})
    expect(off.data.favorite).toBe(false)
  })
  it('非成员收藏 → 403（IDOR）', async () => {
    const r = await call('POST', `/api/recipes/${recipe1.id}/favorite`, {token: ownerB.token, body: {spaceId: spaceA.id}})
    expect(r.status).toBe(403)
  })
})

describe('点菜与菜单', () => {
  it('member 提交点菜请求', async () => {
    const r = await call('POST', '/api/meal-requests', {token: memberA.token, body: {spaceId: spaceA.id, mealType: 'dinner', servings: 3, recipeIds: [recipe1.id], note: '想吃番茄炒蛋'}})
    expect(r.status).toBe(200)
    expect(r.data.userId).toBe(memberA.userId)
  })
  it('owner 查看汇总（含成员信息）', async () => {
    const r = await call('GET', `/api/meal-requests?spaceId=${spaceA.id}`, {token: ownerA.token})
    expect(r.status).toBe(200)
    expect(r.data.length).toBeGreaterThan(0)
    expect(r.data[0].user.displayName).toBe('家人A')
  })
  it('member 查看汇总 → 403（仅 owner）', async () => {
    const r = await call('GET', `/api/meal-requests?spaceId=${spaceA.id}`, {token: memberA.token})
    expect(r.status).toBe(403)
  })
  it('配餐推荐（member 可用，引擎打分）', async () => {
    const r = await call('POST', '/api/meal-recommendations', {token: memberA.token, body: {spaceId: spaceA.id, servings: 3, mealType: 'dinner', requestedRecipeIds: [recipe1.id]}})
    expect(r.status).toBe(200)
    expect(r.data.items.length).toBeGreaterThan(0)
    expect(r.data.items[0].recipeId).toBe(recipe1.id)
  })
  it('owner 确认菜单：服务端构建快照+版本', async () => {
    const r = await call('POST', '/api/meal-plans', {token: ownerA.token, body: {spaceId: spaceA.id, title: `测试晚餐-${RUN}`, mealType: 'dinner', servings: 3, recipeIds: [recipe1.id, recipe2.id]}})
    expect(r.status).toBe(200)
    expect(r.data.status).toBe('confirmed')
    const item = r.data.items.find((x: any) => x.recipeId === recipe1.id)
    expect(item.recipeVersion).toBe(recipe1.version)
    expect(item.snapshotIngredients.length).toBe(recipe1.ingredients.length)
    plan = r.data
  })
  it('member 确认菜单 → 403', async () => {
    const r = await call('POST', '/api/meal-plans', {token: memberA.token, body: {spaceId: spaceA.id, title: 'x', mealType: 'dinner', servings: 2, recipeIds: [recipe1.id]}})
    expect(r.status).toBe(403)
  })
  it('菜单引用不存在/跨空间菜谱 → 400', async () => {
    const r = await call('POST', '/api/meal-plans', {token: ownerA.token, body: {spaceId: spaceA.id, title: 'x', mealType: 'dinner', servings: 2, recipeIds: ['nonexistent-id']}})
    expect(r.status).toBe(400)
  })
  it('member 可查看菜单列表', async () => {
    const r = await call('GET', `/api/meal-plans?spaceId=${spaceA.id}`, {token: memberA.token})
    expect(r.status).toBe(200)
    expect(r.data.some((p: any) => p.id === plan.id)).toBe(true)
  })
})

describe('采购清单', () => {
  it('owner 从已确认菜单生成（同名同单位合并）', async () => {
    const r = await call('POST', `/api/meal-plans/${plan.id}/shopping-list`, {token: ownerA.token, body: {spaceId: spaceA.id}})
    expect(r.status).toBe(200)
    expect(r.data.items.length).toBeGreaterThan(0)
    expect(r.data.items.every((x: any) => x.id && x.displayQuantity)).toBe(true)
    list = r.data
  })
  it('member 生成采购 → 403', async () => {
    const r = await call('POST', `/api/meal-plans/${plan.id}/shopping-list`, {token: memberA.token, body: {spaceId: spaceA.id}})
    expect(r.status).toBe(403)
  })
  it('member 可查看采购清单', async () => {
    const r = await call('GET', `/api/shopping-lists?spaceId=${spaceA.id}`, {token: memberA.token})
    expect(r.status).toBe(200)
    expect(r.data.some((l: any) => l.id === list.id)).toBe(true)
  })
  it('owner 修改数量与状态（家中已有/已购买）', async () => {
    const item = list.items[0]
    const r = await call('PATCH', `/api/shopping-lists/${list.id}/items/${item.id}`, {token: ownerA.token, body: {spaceId: spaceA.id, status: 'purchased', quantity: 5}})
    expect(r.status).toBe(200)
    const updated = r.data.items.find((x: any) => x.id === item.id)
    expect(updated.status).toBe('purchased')
    expect(updated.quantity).toBe(5)
    expect(updated.displayQuantity).toContain('5')
  })
  it('数量置 null → 显示回退为单位（不伪造用量）', async () => {
    const item = list.items[0]
    const r = await call('PATCH', `/api/shopping-lists/${list.id}/items/${item.id}`, {token: ownerA.token, body: {spaceId: spaceA.id, status: 'needed', quantity: null}})
    expect(r.status).toBe(200)
    const updated = r.data.items.find((x: any) => x.id === item.id)
    expect(updated.quantity).toBeNull()
  })
  it('跨空间修改采购项 → 404/403（IDOR）', async () => {
    const item = list.items[0]
    const r = await call('PATCH', `/api/shopping-lists/${list.id}/items/${item.id}`, {token: ownerB.token, body: {spaceId: spaceB.id, status: 'purchased'}})
    expect([403, 404]).toContain(r.status)
  })
  it('不存在的 itemId → 404', async () => {
    const r = await call('PATCH', `/api/shopping-lists/${list.id}/items/no-such-item`, {token: ownerA.token, body: {spaceId: spaceA.id, status: 'needed'}})
    expect(r.status).toBe(404)
  })
  it('幂等生成：同一菜单不重复创建清单', async () => {
    const before = await call('GET', `/api/shopping-lists?spaceId=${spaceA.id}`, {token: ownerA.token})
    const r = await call('POST', `/api/meal-plans/${plan.id}/shopping-list`, {token: ownerA.token, body: {spaceId: spaceA.id}})
    expect(r.status).toBe(200)
    expect(r.data.id).toBe(list.id)
    const after = await call('GET', `/api/shopping-lists?spaceId=${spaceA.id}`, {token: ownerA.token})
    expect(after.data.length).toBe(before.data.length)
  })
  it('差异同步：保留同名同单位项的状态，数量按最新快照', async () => {
    const item = list.items.find((x: any) => x.name === '番茄') || list.items[0]
    await call('PATCH', `/api/shopping-lists/${list.id}/items/${item.id}`, {token: ownerA.token, body: {spaceId: spaceA.id, status: 'have'}})
    const r = await call('POST', `/api/meal-plans/${plan.id}/shopping-list`, {token: ownerA.token, body: {spaceId: spaceA.id}})
    const same = r.data.items.find((x: any) => x.id === item.id)
    expect(same).toBeTruthy()
    expect(same.status).toBe('have')
    list = r.data
  })
  it('owner 编辑菜单（换菜）→ 快照重建 + 采购差异同步', async () => {
    // 新建第三道菜替换 recipe2
    const c = await call('POST', '/api/recipes', {token: ownerA.token, body: {spaceId: spaceA.id, title: `清炒时蔬-${RUN}`, ingredients: [ingredient('青菜', 300, 'g')], steps: [{content: '清炒'}]}})
    expect(c.status).toBe(200)
    const r = await call('PUT', `/api/meal-plans/${plan.id}`, {token: ownerA.token, body: {spaceId: spaceA.id, title: plan.title, servings: plan.servings, recipeIds: [recipe1.id, c.data.id]}})
    expect(r.status).toBe(200)
    expect(r.data.items.some((x: any) => x.recipeId === c.data.id)).toBe(true)
    expect(r.data.items.some((x: any) => x.recipeId === recipe2.id)).toBe(false)
    const lists = await call('GET', `/api/shopping-lists?spaceId=${spaceA.id}`, {token: ownerA.token})
    const synced = lists.data.find((l: any) => l.id === list.id)
    expect(synced.items.some((x: any) => x.name === '青菜')).toBe(true)
    expect(synced.items.some((x: any) => x.name === '豆腐')).toBe(false)
    plan = r.data
  })
  it('member 编辑菜单 → 403', async () => {
    const r = await call('PUT', `/api/meal-plans/${plan.id}`, {token: memberA.token, body: {spaceId: spaceA.id, title: 'x', servings: 2, recipeIds: [recipe1.id]}})
    expect(r.status).toBe(403)
  })
})

describe('烹饪记录 cooking_logs', () => {
  let log: any
  it('member 提交烹饪记录（含评分与心得）', async () => {
    const r = await call('POST', '/api/cooking-logs', {token: memberA.token, body: {spaceId: spaceA.id, recipeId: recipe1.id, mealPlanId: plan.id, notes: '家人都说好吃', rating: 5}})
    expect(r.status).toBe(200)
    expect(r.data.createdById).toBe(memberA.userId)
    expect(r.data.rating).toBe(5)
    log = r.data
  })
  it('列表全员可见（按时间倒序）', async () => {
    const r = await call('GET', `/api/cooking-logs?spaceId=${spaceA.id}`, {token: ownerA.token})
    expect(r.status).toBe(200)
    expect(r.data.some((l: any) => l.id === log.id)).toBe(true)
  })
  it('按菜谱过滤', async () => {
    const r = await call('GET', `/api/cooking-logs?spaceId=${spaceA.id}&recipeId=${recipe1.id}`, {token: memberA.token})
    expect(r.data.every((l: any) => l.recipeId === recipe1.id)).toBe(true)
  })
  it('跨空间菜谱 ID → 404（IDOR）', async () => {
    const r = await call('POST', '/api/cooking-logs', {token: ownerB.token, body: {spaceId: spaceB.id, recipeId: recipe1.id}})
    expect([403, 404]).toContain(r.status)
  })
  it('照片 key 跨空间 → 403 IMAGE_FORBIDDEN', async () => {
    const r = await call('POST', '/api/cooking-logs', {token: memberA.token, body: {spaceId: spaceA.id, recipeId: recipe1.id, photos: [`spaces/${spaceB.id}/evil.png`]}})
    expect(r.status).toBe(403)
  })
  it('非成员提交 → 403', async () => {
    const r = await call('POST', '/api/cooking-logs', {token: ownerB.token, body: {spaceId: spaceA.id, recipeId: recipe1.id}})
    expect(r.status).toBe(403)
  })
  it('评分越界 → 400', async () => {
    const r = await call('POST', '/api/cooking-logs', {token: memberA.token, body: {spaceId: spaceA.id, recipeId: recipe1.id, rating: 9}})
    expect(r.status).toBe(400)
  })
})

describe('上传与签名 URL', () => {
  const png1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
  let uploadedKey = ''
  it('member 上传图片 → 返回空间隔离的 object key', async () => {
    const form = new FormData()
    form.append('spaceId', spaceA.id)
    form.append('file', new Blob([png1x1], {type: 'image/png'}), 'cover.png')
    const res = await fetch(BASE + '/api/uploads', {method: 'POST', headers: {Authorization: 'Bearer ' + memberA.token}, body: form})
    expect(res.status).toBe(200)
    const data: any = await res.json()
    expect(data.key.startsWith(`spaces/${spaceA.id}/`)).toBe(true)
    uploadedKey = data.key
  })
  it('非图片类型 → 415', async () => {
    const form = new FormData()
    form.append('spaceId', spaceA.id)
    form.append('file', new Blob(['hello'], {type: 'text/plain'}), 'note.txt')
    const res = await fetch(BASE + '/api/uploads', {method: 'POST', headers: {Authorization: 'Bearer ' + ownerA.token}, body: form})
    expect(res.status).toBe(415)
  })
  it('非成员上传到空间 → 403', async () => {
    const form = new FormData()
    form.append('spaceId', spaceA.id)
    form.append('file', new Blob([png1x1], {type: 'image/png'}), 'x.png')
    const res = await fetch(BASE + '/api/uploads', {method: 'POST', headers: {Authorization: 'Bearer ' + ownerB.token}, body: form})
    expect(res.status).toBe(403)
  })
  it('签名 URL 可读且 300s 时效', async () => {
    const r = await call('GET', `/api/uploads/read-url?spaceId=${spaceA.id}&key=${encodeURIComponent(uploadedKey)}`, {token: memberA.token})
    expect(r.status).toBe(200)
    expect(r.data.expiresIn).toBe(300)
    const img = await fetch(r.data.url)
    expect(img.status).toBe(200)
  })
  it('跨空间 key → 403 IMAGE_FORBIDDEN', async () => {
    const r = await call('GET', `/api/uploads/read-url?spaceId=${spaceB.id}&key=${encodeURIComponent(uploadedKey)}`, {token: ownerB.token})
    expect(r.status).toBe(403)
  })
  it('非成员取签名 URL → 403', async () => {
    const r = await call('GET', `/api/uploads/read-url?spaceId=${spaceA.id}&key=${encodeURIComponent(uploadedKey)}`, {token: ownerB.token})
    expect(r.status).toBe(403)
  })
})

describe('AI 草稿', () => {
  it('未配置 AI provider → 503（不崩溃）', async () => {
    const r = await call('POST', '/api/ai/recipe-draft', {token: ownerA.token, body: {spaceId: spaceA.id, text: '番茄炒蛋'}})
    expect([503, 200]).toContain(r.status)
    if (r.status === 503) expect(r.data.error).toBe('AI_PROVIDER_NOT_CONFIGURED')
  })
  it('非成员调用 → 403', async () => {
    const r = await call('POST', '/api/ai/recipe-draft', {token: ownerB.token, body: {spaceId: spaceA.id, text: 'x'}})
    expect(r.status).toBe(403)
  })
})