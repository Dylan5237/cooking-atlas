import Taro from '@tarojs/taro'
import {apiBaseUrl} from './api'

// 全局错误诊断：在 App 模块加载最早期安装，捕获白屏这类首屏致命错误。
// 三层捕获：onError（app service 未捕获异常）+ onUnhandledRejection + console.error 劫持。
// 错误同时写入本地 storage（供页面错误条展示）并上报 API 日志（供远程排查，不依赖 GUI）。

const STORAGE_KEY = 'cooking-atlas-diagnostics'
const MAX_RECORDS = 40
const MAX_PER_KIND = 8
const MAX_TEXT = 1500

export type DiagnosticRecord = {
  ts: string
  kind: string
  message: string
  stack?: string
  scene?: string
}

let installed = false
let reporting = false
const seen = new Map<string, number>()
const listeners = new Set<() => void>()

const now = () => new Date().toISOString()

function normalize(value: unknown): {message: string; stack?: string} {
  if (value instanceof Error) {
    return {message: String(value.message || value.name).slice(0, MAX_TEXT), stack: String(value.stack || '').slice(0, MAX_TEXT * 2)}
  }
  if (typeof value === 'string') return {message: value.slice(0, MAX_TEXT)}
  try {
    const text = JSON.stringify(value)
    return {message: (text || String(value)).slice(0, MAX_TEXT)}
  } catch {
    return {message: String(value).slice(0, MAX_TEXT)}
  }
}

export function readDiagnostics(): DiagnosticRecord[] {
  try {
    const raw = Taro.getStorageSync(STORAGE_KEY)
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

function persist(records: DiagnosticRecord[]) {
  try {
    Taro.setStorageSync(STORAGE_KEY, records.slice(-MAX_RECORDS))
  } catch {
    // storage 写失败不应中断错误处理
  }
  listeners.forEach(fn => {
    try { fn() } catch { /* ignore */ }
  })
}

export function subscribeDiagnostics(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function clearDiagnostics() {
  persist([])
}

/**
 * 去重 + 限流：同一类错误（按前 120 字符）最多记 MAX_PER_KIND 条，避免错误风暴刷爆
 * storage 与日志。返回是否真正记录。
 */
function shouldRecord(kind: string, message: string): boolean {
  const key = kind + '|' + message.slice(0, 120)
  const count = seen.get(key) || 0
  if (count >= MAX_PER_KIND) return false
  seen.set(key, count + 1)
  return true
}

function report(kind: string, value: unknown) {
  const {message, stack} = normalize(value)
  if (!message) return
  // 忽略上报链路自身产生的错误，防止递归
  if (/client-error|diagnostics/i.test(message)) return
  if (!shouldRecord(kind, message)) return

  let scene = ''
  try {
    const pages = Taro.getCurrentPages()
    scene = pages?.length ? String(pages[pages.length - 1]?.route || '') : ''
  } catch { /* ignore */ }

  const record: DiagnosticRecord = {ts: now(), kind, message, ...(stack ? {stack} : {}), ...(scene ? {scene} : {})}
  const records = readDiagnostics()
  records.push(record)
  persist(records)

  // 同步回显到控制台，便于 Console 直接观察
  try { console.warn('[diagnostics][' + kind + ']', message) } catch { /* ignore */ }

  upload(record)
}

function upload(record: DiagnosticRecord) {
  if (reporting) return
  reporting = true
  try {
    Taro.request({
      url: apiBaseUrl() + '/api/dev/client-error',
      method: 'POST',
      data: record,
      header: {'content-type': 'application/json'},
      timeout: 4000,
    }).catch(() => { /* 上报失败静默 */ })
  } catch {
    /* ignore */
  } finally {
    // 给一帧缓冲，避免同一批错误并发打爆接口
    setTimeout(() => { reporting = false }, 50)
  }
}

/** 供业务代码显式记录捕获到的异常（如 ensureSession catch） */
export function reportError(kind: string, value: unknown) {
  report(kind, value)
}

/** 安装全局钩子。必须在 App 组件渲染前调用（模块顶层）。 */
export function installDiagnostics() {
  if (installed) return
  installed = true

  try {
    Taro.onError(err => report('onError', err))
  } catch { /* ignore */ }

  try {
    const anyTaro = Taro as any
    if (typeof anyTaro.onUnhandledRejection === 'function') {
      anyTaro.onUnhandledRejection((res: any) => report('unhandledRejection', res?.reason ?? res))
    }
  } catch { /* ignore */ }

  // 劫持 console.error：捕获框架层打印但未必抛异常的错误（如 LifeCycle.load fail）。
  // 保留原始实现，避免影响开发者工具 Console 的正常显示。
  try {
    const original = console.error
    console.error = function (...args: any[]) {
      try {
        const first = args[0]
        const text = args.map((a: any) => {
          if (a instanceof Error) return a.stack || a.message
          if (typeof a === 'string') return a
          try { return JSON.stringify(a) } catch { return String(a) }
        }).join(' ').slice(0, MAX_TEXT * 2)
        if (text && !/client-error|diagnostics/i.test(text) && typeof first !== 'undefined') {
          report('console.error', text)
        }
      } catch { /* ignore */ }
      original.apply(console, args as any)
    }
  } catch { /* ignore */ }

  report('lifecycle', 'diagnostics installed, api=' + apiBaseUrl())
}
