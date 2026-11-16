import {defineConfig} from 'vitest/config'

// 缓存目录固定在工作区内：本机系统 Temp 存在访问限制（EPERM），
// 默认临时缓存会导致 SSR 转换缓存写入失败并中断测试收集。
export default defineConfig({
  cacheDir: './node_modules/.vitest',
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node'
  }
})