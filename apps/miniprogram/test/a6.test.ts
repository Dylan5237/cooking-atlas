/**
 * A6 单元测试：语音录入编排、卡牌布局纯函数、相册保存授权降级。
 * mock Taro 录音/上传/网络/相册 API；不依赖真实微信运行时。
 */
import {describe, it, expect, vi, beforeEach} from 'vitest'

const storage = new Map<string, unknown>()
// 模拟真实微信 RecorderManager：handlers 常驻（onStop/onError 注册一次长期有效），
// stop() 异步触发 onStop。handlers 不能在 beforeEach 里清空——真实运行时不会卸载回调。
const recorderStub = (() => {
  const handlers: {stop?: (res: any) => void; error?: (res: any) => void} = {}
  return {
    handlers,
    start: vi.fn(),
    stop: vi.fn(() => { setTimeout(() => handlers.stop?.({tempFilePath: 'wxfile://tmp/rec.mp3'}), 0) }),
    onStop: vi.fn((cb: any) => { handlers.stop = cb }),
    onError: vi.fn((cb: any) => { handlers.error = cb })
  }
})()
vi.mock('@tarojs/taro', () => ({
  default: {
    getStorageSync: (k: string) => storage.get(k) ?? '',
    setStorageSync: (k: string, v: unknown) => { storage.set(k, v) },
    removeStorageSync: (k: string) => { storage.delete(k) },
    request: vi.fn(),
    login: vi.fn(),
    uploadFile: vi.fn(),
    getRecorderManager: vi.fn(() => recorderStub),
    saveImageToPhotosAlbum: vi.fn(),
    showModal: vi.fn(),
    openSetting: vi.fn(),
    downloadFile: vi.fn(),
    createSelectorQuery: vi.fn(),
    canvasToTempFilePath: vi.fn(),
    getSystemInfoSync: vi.fn(() => ({pixelRatio: 2}))
  },
  useShareAppMessage: vi.fn()
}))

import Taro from '@tarojs/taro'
import {RECORD_OPTIONS, startRecording, stopRecording, transcribeRecording, isRecording, resetRecorderState} from '../src/services/recorder'
import {layoutCard, CARD_W} from '../src/services/card'
import {saveCardToAlbum} from '../src/services/card'
import {setActiveSpaceId} from '../src/services/api'

const SPACE = 'space-a6'
const measure = (text: string, font: string) => text.length * (parseInt(font, 10) || 26) * 0.6

beforeEach(() => {
  storage.clear()
  vi.clearAllMocks()
  // RecorderManager 是单例，模块内 recording 状态跨用例残留；先复位保证隔离
  resetRecorderState()
  // clearAllMocks 会清掉 mock 实现，这里重建 stop 的默认行为（异步触发常驻 onStop handler）
  recorderStub.stop.mockImplementation(() => { setTimeout(() => recorderStub.handlers.stop?.({tempFilePath: 'wxfile://tmp/rec.mp3'}), 0) })
  process.env.TARO_APP_DEMO_MODE = 'false'
  storage.set('cooking-atlas-access-token', 'token-a6')
  setActiveSpaceId(SPACE)
})

describe('录音参数（微信官方合法值）', () => {
  it('mp3 / 16000Hz / 单声道 / 48000 码率（16000 对应 24000~96000 区间）', () => {
    expect(RECORD_OPTIONS.format).toBe('mp3')
    expect(RECORD_OPTIONS.sampleRate).toBe(16000)
    expect(RECORD_OPTIONS.numberOfChannels).toBe(1)
    expect(RECORD_OPTIONS.encodeBitRate).toBeGreaterThanOrEqual(24000)
    expect(RECORD_OPTIONS.encodeBitRate).toBeLessThanOrEqual(96000)
    expect(RECORD_OPTIONS.duration).toBeLessThanOrEqual(600000)
  })
})

describe('录音编排', () => {
  it('startRecording 传递官方参数并进入录音态', () => {
    startRecording()
    expect(recorderStub.start).toHaveBeenCalledWith(expect.objectContaining({format: 'mp3', sampleRate: 16000}))
    expect(isRecording()).toBe(true)
  })
  it('stopRecording 等待 onStop 返回临时路径并复位状态', async () => {
    startRecording()
    const res = await stopRecording()
    expect(res.tempFilePath).toBe('wxfile://tmp/rec.mp3')
    expect(isRecording()).toBe(false)
  })
  it('未录音时 stop 抛 NOT_RECORDING', async () => {
    await expect(stopRecording()).rejects.toThrow('NOT_RECORDING')
  })
  it('onError 透传 errMsg', async () => {
    // beforeEach 已 resetRecorderState，startRecording 不会预调 stop()，once 队列安全
    recorderStub.stop.mockImplementationOnce(() => { setTimeout(() => recorderStub.handlers.error?.({errMsg: 'operateRecorder:fail'}), 0) })
    startRecording()
    await expect(stopRecording()).rejects.toThrow('operateRecorder:fail')
    expect(isRecording()).toBe(false)
  })
  it('transcribeRecording：上传 → 转写 → 返回文本', async () => {
    ;(Taro.uploadFile as any).mockResolvedValue({statusCode: 200, data: JSON.stringify({key: `spaces/${SPACE}/rec.mp3`, contentType: 'audio/mpeg', size: 1024})})
    ;(Taro.request as any).mockResolvedValue({statusCode: 200, data: {text: '今天做了番茄炒蛋'}})
    const text = await transcribeRecording('wxfile://tmp/rec.mp3')
    expect(text).toBe('今天做了番茄炒蛋')
    const up = (Taro.uploadFile as any).mock.calls[0][0]
    expect(up.url).toContain('/api/uploads/audio')
    expect(up.formData.spaceId).toBe(SPACE)
    const req = (Taro.request as any).mock.calls[0][0]
    expect(req.url).toContain('/api/ai/transcribe')
    expect(req.data.audioKey).toBe(`spaces/${SPACE}/rec.mp3`)
  })
  it('STT 未配置（503）原样抛错供 UI 降级', async () => {
    ;(Taro.uploadFile as any).mockResolvedValue({statusCode: 200, data: JSON.stringify({key: `spaces/${SPACE}/rec.mp3`})})
    ;(Taro.request as any).mockResolvedValue({statusCode: 503, data: {error: 'STT_PROVIDER_NOT_CONFIGURED'}})
    await expect(transcribeRecording('wxfile://tmp/rec.mp3')).rejects.toThrow('STT_PROVIDER_NOT_CONFIGURED')
  })
})

describe('卡牌布局（纯函数）', () => {
  const recipe = {
    title: '番茄炒蛋', category: '家常菜', description: '先炒蛋再炒番茄，酸甜下饭。',
    servings: 3, cookingMinutes: 15,
    ingredients: [{name: '番茄', quantity: 2, unit: '个'}, {name: '鸡蛋', quantity: 3, unit: '个'}, {name: '盐', quantity: null, unit: '适量'}],
    steps: [{content: '炒熟鸡蛋盛出'}, {content: '炒番茄后混合调味'}]
  }
  it('无封面时高度为正且包含全部食材行', () => {
    const l = layoutCard(recipe, false, measure)
    expect(l.coverH).toBe(0)
    expect(l.height).toBeGreaterThan(300)
    expect(l.ingredientLines.join('')).toContain('番茄')
    expect(l.ingredientLines.join('')).toContain('盐')
    expect(l.stepLines.length).toBe(2)
  })
  it('有封面时高度增加 coverH', () => {
    const a = layoutCard(recipe, false, measure)
    const b = layoutCard(recipe, true, measure)
    expect(b.height - a.height).toBe(b.coverH + 28)
    expect(b.coverH).toBe(400)
  })
  it('未知用量不伪造数字（quantity null → 只显示单位）', () => {
    const l = layoutCard(recipe, false, measure)
    expect(l.ingredientLines.join('')).toContain('盐 适量')
    expect(l.ingredientLines.join('')).not.toContain('盐 null')
  })
  it('超长文本按宽度换行且截断加省略号（不无限增高）', () => {
    const long = {...recipe, steps: [{content: '非常长的步骤'.repeat(200)}]}
    const l = layoutCard(long, false, measure)
    expect(l.stepLines.length).toBeLessThanOrEqual(10)
    expect(l.stepLines[l.stepLines.length - 1].endsWith('…')).toBe(true)
    expect(l.height).toBeLessThan(3000)
  })
  it('换行尊重原文换行符', () => {
    const multi = {...recipe, steps: [{content: '第一步'}, {content: '第二步'}]}
    const l = layoutCard(multi, false, measure)
    expect(l.stepLines[0]).toContain('1.')
    expect(l.stepLines[1]).toContain('2.')
  })
  it('卡牌逻辑宽度固定 750（导出乘 dpr 得高清）', () => {
    expect(CARD_W).toBe(750)
  })
})

describe('相册保存与授权降级', () => {
  it('直接保存成功', async () => {
    ;(Taro.saveImageToPhotosAlbum as any).mockResolvedValue({})
    await saveCardToAlbum('wxfile://tmp/card.png')
    expect(Taro.saveImageToPhotosAlbum).toHaveBeenCalledWith({filePath: 'wxfile://tmp/card.png'})
  })
  it('用户拒绝授权 → 引导设置 → 授权后重试成功', async () => {
    ;(Taro.saveImageToPhotosAlbum as any)
      .mockRejectedValueOnce({errMsg: 'saveImageToPhotosAlbum:fail auth deny'})
      .mockResolvedValueOnce({})
    ;(Taro.showModal as any).mockResolvedValue({confirm: true})
    ;(Taro.openSetting as any).mockResolvedValue({authSetting: {'scope.writePhotosAlbum': true}})
    await saveCardToAlbum('wxfile://tmp/card.png')
    expect(Taro.openSetting).toHaveBeenCalled()
    expect(Taro.saveImageToPhotosAlbum).toHaveBeenCalledTimes(2)
  })
  it('用户拒绝且不去设置 → ALBUM_PERMISSION_DENIED', async () => {
    ;(Taro.saveImageToPhotosAlbum as any).mockRejectedValue({errMsg: 'saveImageToPhotosAlbum:fail authorize no response'})
    ;(Taro.showModal as any).mockResolvedValue({confirm: false})
    await expect(saveCardToAlbum('wxfile://tmp/card.png')).rejects.toThrow('ALBUM_PERMISSION_DENIED')
  })
  it('非授权类失败原样抛出', async () => {
    ;(Taro.saveImageToPhotosAlbum as any).mockRejectedValue({errMsg: 'saveImageToPhotosAlbum:fail invalid file'})
    await expect(saveCardToAlbum('wxfile://tmp/card.png')).rejects.toMatchObject({errMsg: expect.stringContaining('invalid file')})
  })
})