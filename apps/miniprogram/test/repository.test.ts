/**
 * REST repository 单元测试：mock Taro 存储/网络与全局 fetch，
 * 验证「服务端行 → 领域类型」映射、缓存一致性、写入契约与 demo 模式行为。
 * 不依赖真实后端；真实后端契约由 apps/api/test/contract.test.ts 覆盖。
 */
import {describe, it, expect, vi, beforeEach} from 'vitest'

const storage = new Map<string, unknown>()
vi.mock('@tarojs/taro', () => ({
  default: {
    getStorageSync: (k: string) => storage.get(k) ?? '',
    setStorageSync: (k: string, v: unknown) => { storage.set(k, v) },
    removeStorageSync: (k: string) => { storage.delete(k) },
    request: vi.fn(),
    login: vi.fn(),
    uploadFile: vi.fn()
  }
}))

import Taro from '@tarojs/taro'
import {repository, isDemoMode} from '../src/services/repository'
import {setActiveSpaceId, ensureSession, joinSpaceByCode} from '../src/services/api'

const SPACE = 'space-test-1'
const TOKEN = 'test-token'

function mockRequest(routes: Record<string, {statusCode?: number; data: unknown}>) {
  ;(Taro.request as any).mockImplementation(async ({url, method}: any) => {
    const path = url.replace(/^https?:\/\/[^/]+/, '')
    const key = `${method} ${path.split('?')[0]}`
    const hit = routes[key] || routes[path.split('?')[0]]
    if (!hit) return {statusCode: 404, data: {error: 'NO_MOCK_FOR_' + key}}
    return {statusCode: hit.statusCode ?? 200, data: hit.data}
  })
}

const serverRecipe = {
  id: 'r1', spaceId: SPACE, title: '番茄炒蛋', category: '家常菜', coverKey: `spaces/${SPACE}/x.png`,
  servings: 2, cookingMinutes: 15, difficulty: '简单', description: '好吃',
  ingredients: [{name: '番茄', quantity: 2, unit: '个'}], steps: [{content: '炒'}],
  version: 3, status: 'active', createdById: 'u1',
  createdAt: '2026-11-16T06:00:00.000Z', updatedAt: '2026-11-16T06:00:00.000Z'
}
const serverPlan = {
  id: 'p1', spaceId: SPACE, title: '家庭晚餐', mealType: 'dinner', servings: 3, status: 'confirmed',
  items: [{recipeId: 'r1', recipeTitle: '番茄炒蛋', servings: 2, source: 'library', recipeVersion: 3, snapshotIngredients: serverRecipe.ingredients}],
  createdById: 'u1', createdAt: '2026-11-16T06:00:00.000Z', confirmedAt: '2026-11-16T06:30:00.000Z'
}
const serverList = {
  id: 'l1', spaceId: SPACE, mealPlanId: 'p1', title: '家庭晚餐 · 采购清单', status: 'active',
  items: [{id: 'i1', name: '番茄', quantity: 6, unit: '个', displayQuantity: '6个', status: 'needed', sourceRecipeIds: ['r1']}],
  createdAt: '2026-11-16T06:00:00.000Z', updatedAt: '2026-11-16T06:00:00.000Z'
}

beforeEach(() => {
  storage.clear()
  vi.clearAllMocks()
  process.env.TARO_APP_DEMO_MODE = 'false'
  storage.set('cooking-atlas-access-token', TOKEN)
  setActiveSpaceId(SPACE)
})

describe('模式与前置条件', () => {
  it('默认非演示模式', () => {
    expect(isDemoMode()).toBe(false)
  })
  it('未登录时 refresh 返回空缓存而不发请求', async () => {
    storage.delete('cooking-atlas-access-token')
    const s = await repository.refresh()
    expect(s.recipes).toEqual([])
    expect(Taro.request).not.toHaveBeenCalled()
  })
})

describe('refresh 映射与缓存', () => {
  beforeEach(() => {
    mockRequest({
      'GET /api/recipes': {data: [serverRecipe]},
      'GET /api/meal-plans': {data: [serverPlan]},
      'GET /api/shopping-lists': {data: [serverList]},
      'GET /api/favorites': {data: [{recipeId: 'r1'}]}
    })
  })
  it('服务端行正确映射为领域类型', async () => {
    const s = await repository.refresh()
    expect(s.recipes[0].id).toBe('r1')
    expect(s.recipes[0].createdBy).toBe('u1')
    expect(s.recipes[0].coverKey).toBe(`spaces/${SPACE}/x.png`)
    expect(s.recipes[0].coverUrl).toBe('')
    expect(s.recipes[0].version).toBe(3)
    expect(s.plan?.status).toBe('confirmed')
    expect(s.plan?.items[0].recipeVersion).toBe(3)
    expect(s.plan?.items[0].snapshotIngredients.length).toBe(1)
    expect(s.shopping?.items[0].displayQuantity).toBe('6个')
    expect(s.favoriteIds).toEqual(['r1'])
  })
  it('getStore 同步返回最近一次刷新结果', async () => {
    await repository.refresh()
    expect(repository.getStore().recipes.length).toBe(1)
  })
  it('coverKey 为 null 时映射为 undefined', async () => {
    mockRequest({
      'GET /api/recipes': {data: [{...serverRecipe, coverKey: null}]},
      'GET /api/meal-plans': {data: []},
      'GET /api/shopping-lists': {data: []},
      'GET /api/favorites': {data: []}
    })
    const s = await repository.refresh()
    expect(s.recipes[0].coverKey).toBeUndefined()
  })
})

describe('写入契约（服务端权威）', () => {
  it('createRecipe 携带 spaceId 且缓存前插', async () => {
    mockRequest({'POST /api/recipes': {data: serverRecipe}})
    const r = await repository.createRecipe({title: '番茄炒蛋', ingredients: [], steps: []})
    const call = (Taro.request as any).mock.calls[0][0]
    expect(call.method).toBe('POST')
    expect(call.data.spaceId).toBe(SPACE)
    expect(call.header.Authorization).toBe('Bearer ' + TOKEN)
    expect(r.id).toBe('r1')
    expect(repository.getStore().recipes[0].id).toBe('r1')
  })
  it('confirmPlan 只传 recipeIds（快照由服务端构建）', async () => {
    mockRequest({'POST /api/meal-plans': {data: serverPlan}})
    await repository.confirmPlan({title: '家庭晚餐', mealType: 'dinner', servings: 3, recipeIds: ['r1']})
    const call = (Taro.request as any).mock.calls[0][0]
    expect(call.data.recipeIds).toEqual(['r1'])
    expect(call.data.items).toBeUndefined()
    expect(repository.getStore().plan?.items[0].snapshotIngredients.length).toBe(1)
  })
  it('toggleFavorite 依据服务端返回更新缓存', async () => {
    mockRequest({'POST /api/recipes/r1/favorite': {data: {favorite: true}}})
    const fav = await repository.toggleFavorite('r1')
    expect(fav).toBe(true)
    expect(repository.getStore().favoriteIds).toContain('r1')
  })
  it('updateShoppingItem 走 PATCH 且刷新缓存', async () => {
    mockRequest({
      'GET /api/recipes': {data: []}, 'GET /api/meal-plans': {data: []},
      'GET /api/shopping-lists': {data: [serverList]}, 'GET /api/favorites': {data: []},
      'PATCH /api/shopping-lists/l1/items/i1': {data: {...serverList, items: [{...serverList.items[0], status: 'purchased'}]}}
    })
    await repository.refresh()
    const l = await repository.updateShoppingItem('i1', {status: 'purchased'})
    expect(l.items[0].status).toBe('purchased')
    expect(repository.getStore().shopping?.items[0].status).toBe('purchased')
  })
  it('服务端 403 透传错误（owner 校验在服务端）', async () => {
    mockRequest({'POST /api/recipes': {statusCode: 403, data: {error: 'OWNER_REQUIRED'}}})
    await expect(repository.createRecipe({title: 'x', ingredients: [], steps: []})).rejects.toThrow('OWNER_REQUIRED')
  })
  it('无激活空间时写入抛 NO_ACTIVE_SPACE', async () => {
    storage.delete('cooking-atlas-active-space')
    await expect(repository.createRecipe({title: 'x', ingredients: [], steps: []})).rejects.toThrow('NO_ACTIVE_SPACE')
  })
})

describe('会话编排 ensureSession', () => {
  it('已登录且有空间：沿用 activeSpaceId，owner 取回邀请码', async () => {
    mockRequest({
      'GET /api/me': {data: {id: 'u1', displayName: '掌勺者'}},
      'GET /api/spaces': {data: [{id: 'm1', role: 'owner', status: 'active', space: {id: SPACE, name: '我们的餐桌', ownerId: 'u1'}}]},
      [`GET /api/spaces/${SPACE}/invite-code`]: {data: {inviteCode: 'ABC123'}}
    })
    const s = await ensureSession()
    expect(s.space.id).toBe(SPACE)
    expect(s.role).toBe('owner')
    expect(s.space.inviteCode).toBe('ABC123')
  })
  it('member 不请求邀请码接口', async () => {
    mockRequest({
      'GET /api/me': {data: {id: 'u2'}},
      'GET /api/spaces': {data: [{id: 'm1', role: 'member', status: 'active', space: {id: SPACE, name: '家', ownerId: 'u1'}}]}
    })
    const s = await ensureSession()
    expect(s.role).toBe('member')
    expect(s.space.inviteCode).toBeUndefined()
    const calls = (Taro.request as any).mock.calls.map((c: any) => c[0].url)
    expect(calls.some((u: string) => u.includes('invite-code'))).toBe(false)
  })
  it('401 时自动重新登录', async () => {
    ;(Taro.login as any).mockResolvedValue({code: 'wx-code'})
    mockRequest({
      'GET /api/me': {statusCode: 401, data: {error: 'UNAUTHORIZED'}},
      'POST /api/auth/wechat': {data: {token: 'new-token', user: {id: 'u1'}}},
      'GET /api/spaces': {data: [{id: 'm1', role: 'member', status: 'active', space: {id: SPACE, name: '家', ownerId: 'u2'}}]}
    })
    const s = await ensureSession()
    expect(s.role).toBe('member')
    expect(storage.get('cooking-atlas-access-token')).toBe('new-token')
  })
  it('无任何空间时自动创建并持久化', async () => {
    mockRequest({
      'GET /api/me': {data: {id: 'u1'}},
      'GET /api/spaces': {data: []},
      'POST /api/spaces': {data: {id: 'new-space', name: '我们的餐桌', inviteCode: 'ABC123'}}
    })
    const s = await ensureSession()
    expect(s.space.id).toBe('new-space')
    expect(s.role).toBe('owner')
    expect(storage.get('cooking-atlas-active-space')).toBe('new-space')
  })
  it('joinSpaceByCode 成功后切换 activeSpaceId', async () => {
    mockRequest({'POST /api/spaces/join': {data: {id: 'joined-space', name: '家人空间'}}})
    const space = await joinSpaceByCode('abc123')
    expect(space.id).toBe('joined-space')
    expect(storage.get('cooking-atlas-active-space')).toBe('joined-space')
    const call = (Taro.request as any).mock.calls[0][0]
    expect(call.data.inviteCode).toBe('ABC123')
  })
})

describe('演示模式', () => {
  beforeEach(() => { process.env.TARO_APP_DEMO_MODE = 'true' })
  it('refresh 读本地演示数据且不发网络请求', async () => {
    const s = await repository.refresh()
    expect(s.recipes.length).toBeGreaterThan(0)
    expect(Taro.request).not.toHaveBeenCalled()
  })
  it('写入操作拒绝（DEMO_MODE_READONLY）', async () => {
    await expect(repository.createRecipe({title: 'x', ingredients: [], steps: []})).rejects.toThrow('DEMO_MODE_READONLY')
  })
})