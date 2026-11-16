import { PropsWithChildren } from 'react'
import { initCloud } from './services/cloud'
import './app.scss'
initCloud()
export default function App({ children }: PropsWithChildren) { return children }
