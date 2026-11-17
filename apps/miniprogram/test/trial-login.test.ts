/**
 * 试用码登录链路单测：微信未配置时的降级、设备标识稳定性、试用码持久化。
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
  },
  useShareAppMessage: vi.fn()
}))

import Taro from '@tarojs/taro'
import {ensureSession, loginWithTrialCode, getDeviceId, getTrialCode, loginAny} from '../src/services/api'

const SPACE = 'space-trial'
const CODE = 'trial-code-abc'

function route(map: Record<string, {statusCode?: number; data: unknown}>) {
  ;(Taro.request as any).mockImplementation(async ({url, method}: any) => {
    const path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0]
    const hit = map[`${method} ${path}`]
    return hit ? {statusCode: hit.statusCode ?? 200, data: hit.data} : {statusCode: 404, data: {error: 'NO_MOCK'}}
  })
}

beforeEach(() => {
  storage.clear()
  vi.clearAllMocks()
  process.env.TARO_APP_DEMO_MODE = 'false'
})

describe('设备标识', () => {
  it('同一设备多次调用返回相同 id，并持久化', () => {
    const a = getDeviceId()
    const b = getDeviceId()
    expect(a).toBe(b)
    expect(String(storage.get('cooking-atlas-device-id'))).toBe(a)
    expect(a.length).toBeGreaterThanOrEqual(8)
  })
})

describe('试用码登录', () => {
  it('把 code 与 deviceId 一起提交，成功后持久化 token 与试用码', async () => {
    route({'POST /api/auth/trial': {data: {token: 'tk-trial', user: {id: 'u-trial'}}}})
    const user = await loginWithTrialCode('  ' + CODE + '  ')
    expect(user.id).toBe('u-trial')
    const call = (Taro.request as any).mock.calls[0][0]
    expect(call.data.code).toBe(CODE)          // 两侧空白被裁剪
    expect(call.data.deviceId).toBe(getDeviceId())
    expect(storage.get('cooking-atlas-access-token')).toBe('tk-trial')
    expect(getTrialCode()).toBe(CODE)
  })
  it('试用码错误 → 透传 TRIAL_CODE_INVALID，不写入 token', async () => {
    route({'POST /api/auth/trial': {statusCode: 403, data: {error: 'TRIAL_CODE_INVALID'}}})
    await expect(loginWithTrialCode('bad-code')).rejects.toThrow('TRIAL_CODE_INVALID')
    expect(storage.get('cooking-atlas-access-token')).toBeUndefined()
  })
  it('服务端未开启试用入口 → TRIAL_LOGIN_DISABLED', async () => {
    route({'POST /api/auth/trial': {statusCode: 503, data: {error: 'TRIAL_LOGIN_DISABLED'}}})
    await expect(loginWithTrialCode(CODE)).rejects.toThrow('TRIAL_LOGIN_DISABLED')
  })
})

describe('登录策略降级 loginAny', () => {
  it('微信可用时不走试用码', async () => {
    ;(Taro.login as any).mockResolvedValue({code: 'wx-code'})
    route({'POST /api/auth/wechat': {data: {token: 'tk-wx', user: {id: 'u-wx'}}}})
    const u = await loginAny()
    expect(u.id).toBe('u-wx')
    expect((Taro.request as any).mock.calls.some((c: any) => c[0].url.includes('/api/auth/trial'))).toBe(false)
  })
  it('微信未配置且无试用码 → TRIAL_CODE_REQUIRED（页面提示输入）', async () => {
    ;(Taro.login as any).mockResolvedValue({code: 'wx-code'})
    route({'POST /api/auth/wechat': {statusCode: 503, data: {error: 'WECHAT_AUTH_NOT_CONFIGURED'}}})
    await expect(loginAny()).rejects.toThrow('TRIAL_CODE_REQUIRED')
  })
  it('微信未配置但已存试用码 → 自动试用码登录', async () => {
    storage.set('cooking-atlas-trial-code', CODE)
    ;(Taro.login as any).mockResolvedValue({code: 'wx-code'})
    route({
      'POST /api/auth/wechat': {statusCode: 503, data: {error: 'WECHAT_AUTH_NOT_CONFIGURED'}},
      'POST /api/auth/trial': {data: {token: 'tk-trial', user: {id: 'u-trial'}}}
    })
    const u = await loginAny()
    expect(u.id).toBe('u-trial')
    expect(storage.get('cooking-atlas-access-token')).toBe('tk-trial')
  })
})

describe('ensureSession 与试用码的衔接', () => {
  it('token 失效 → 微信 503 → 用已存试用码登录 → 自动建空间', async () => {
    storage.set('cooking-atlas-trial-code', CODE)
    storage.set('cooking-atlas-active-space', SPACE)
    ;(Taro.login as any).mockResolvedValue({code: 'wx-code'})
    route({
      'GET /api/me': {statusCode: 401, data: {error: 'UNAUTHORIZED'}},
      'POST /api/auth/wechat': {statusCode: 503, data: {error: 'WECHAT_AUTH_NOT_CONFIGURED'}},
      'POST /api/auth/trial': {data: {token: 'tk-trial', user: {id: 'u-trial'}}},
      'GET /api/spaces': {data: []},
      'POST /api/spaces': {data: {id: 'sp-new', name: '我们的餐桌', inviteCode: 'TRIAL01'}}
    })
    const s = await ensureSession()
    expect(s.role).toBe('owner')
    expect(s.space.id).toBe('sp-new')
    expect(s.space.inviteCode).toBe('TRIAL01')
    expect(storage.get('cooking-atlas-active-space')).toBe('sp-new')
  })
  it('无试用码时 ensureSession 抛 TRIAL_CODE_REQUIRED 而不是笼统失败', async () => {
    ;(Taro.login as any).mockResolvedValue({code: 'wx-code'})
    route({
      'GET /api/me': {statusCode: 401, data: {error: 'UNAUTHORIZED'}},
      'POST /api/auth/wechat': {statusCode: 503, data: {error: 'WECHAT_AUTH_NOT_CONFIGURED'}}
    })
    await expect(ensureSession()).rejects.toThrow('TRIAL_CODE_REQUIRED')
  })
})