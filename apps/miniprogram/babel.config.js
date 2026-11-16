// Taro 4 的 script rule 仅使用 babel-loader，TS/JSX 解析由本文件提供。
// 缺少此配置会导致 .ts/.tsx 被当作纯 JS 解析，构建报 Unexpected token。
module.exports = {
  presets: [
    ['taro', {
      framework: 'react',
      compiler: 'webpack5',
      ts: true,
      useBuiltIns: process.env.NODE_ENV === 'production' ? 'usage' : false
    }]
  ]
}
