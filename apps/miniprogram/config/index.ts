import * as path from 'path'
import { defineConfig } from '@tarojs/cli'

// workspace 内的 shared / 业务引擎以 TS 源码形式被引用（package.json main -> src/index.ts）。
// 它们经 npm workspace symlink 落在 node_modules 下，默认不会经过 Taro 的 babel-loader，
// 因此必须通过 mini.compile.include 显式纳入编译范围。
export default defineConfig({
  projectName: 'cooking-atlas',
  date: '2026-11-16',
  designWidth: 750,
  deviceRatio: { 640: 2.34 / 2, 750: 1, 828: 1.81 / 2 },
  sourceRoot: 'src',
  outputRoot: 'dist',
  framework: 'react',
  compiler: { type: 'webpack5', prebundle: { enable: false } },
  // 静默 sass @import 弃用提示（Dart Sass 2.x 写法迁移前不阻塞构建）
  sassLoaderOption: { sassOptions: { silenceDeprecations: ['import'] } },
  h5: {
    publicPath: '/',
    staticDirectory: 'static',
    router: { mode: 'hash' },
    esnextModules: ['@cooking-atlas'],
    devServer: { port: 10086, client: { overlay: { errors: true, warnings: false } } },
    compile: {
      include: [
        path.resolve(__dirname, '../../../packages'),
        path.resolve(__dirname, '../../../node_modules/@cooking-atlas')
      ]
    },
  },
  mini: {
    postcss: { pxtransform: { enable: true } },
    compile: {
      include: [
        path.resolve(__dirname, '../../../packages'),
        path.resolve(__dirname, '../../../node_modules/@cooking-atlas')
      ]
    }
  }
})
