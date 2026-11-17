import {Component, createElement, PropsWithChildren, ReactNode} from 'react'
import {View, Text, Button} from '@tarojs/components'
import {installDiagnostics, readDiagnostics, clearDiagnostics, reportError, subscribeDiagnostics, DiagnosticRecord} from './services/diagnostics'
import Taro from '@tarojs/taro'
import './app.scss'

// 必须在任何组件渲染之前安装全局错误钩子（模块顶层副作用）
installDiagnostics()

// 渲染期错误边界：捕获 Taro hydration / React 渲染异常导致的白屏。
// 使用 createElement 而非 JSX，因为 app 入口是 .ts 文件。
class AppErrorBoundary extends Component<PropsWithChildren, {failed: boolean; records: DiagnosticRecord[]}> {
  state = {failed: false, records: readDiagnostics()}
  private _off?: () => void

  static getDerivedStateFromError() {
    return {failed: true}
  }

  componentDidCatch(error: Error, info: any) {
    reportError('renderBoundary', (error?.stack || error?.message || String(error)) + '\n' + (info?.componentStack || ''))
    this.setState({records: readDiagnostics()})
  }

  componentDidMount() {
    this._off = subscribeDiagnostics(() => this.setState({records: readDiagnostics()}))
  }

  componentWillUnmount() {
    this._off?.()
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children
    const records = this.state.records.slice(-4)
    return createElement(View, {className: 'fatal'},
      createElement(Text, {className: 'fatalTitle'}, '页面加载失败'),
      ...records.map((r, i) => createElement(Text, {className: 'fatalMsg', key: i}, r.kind + ': ' + r.message)),
      createElement(Text, {className: 'fatalHint'}, '完整错误已上报服务日志，可清除后重试。'),
      createElement(Button, {className: 'fatalRetry', onClick: () => { clearDiagnostics(); Taro.reLaunch({url: '/pages/index/index'}) }}, '重试')
    )
  }
}

// Taro App 入口官方写法：class 组件。会话初始化由页面 index.tsx 的 useEffect 承担，
// 此处不再重复调用 ensureSession，避免启动时并发建空间 / token 竞争。
class App extends Component<PropsWithChildren> {
  render(): ReactNode {
    return createElement(AppErrorBoundary, null, this.props.children)
  }
}

export default App
