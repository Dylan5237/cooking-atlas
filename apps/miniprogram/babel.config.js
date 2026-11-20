// Taro 4 的 script rule 仅使用 babel-loader，TS/JSX 解析由本文件提供。
// 缺少此配置会导致 .ts/.tsx 被当作纯 JS 解析，构建报 Unexpected token。
//
// 【不要改成 useBuiltIns:'usage'】
// 小程序逻辑层没有完整 DOM，core-js polyfill 会访问 document.all（core-js 模块
// is-object/is-array）并触发真机基础库 3.x 的连锁崩溃：
//   Cannot read properties of undefined (reading 'F') at Module.document
//   -> n(...) is not a function（core-js 初始化链被打断）
//   -> webviewScriptError setChanges（渲染层拿不到逻辑层数据）-> 白屏
// 微信基础库自带现代 JS 运行时，Taro 语法转译已覆盖目标语法，无需 core-js 注入。
// 开发/生产一律关闭，保证开发者工具与真机行为一致。
module.exports = {
  presets: [
    ['taro', {
      framework: 'react',
      compiler: 'webpack5',
      ts: true,
      useBuiltIns: false
    }]
  ]
}
