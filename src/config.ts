import { readFileSync } from 'fs'

export interface IConfig {
    http2?: boolean
    defaultHtml?: string
    directory?: string
}

export let config: IConfig

try {
    const file = readFileSync('config.json')
    config = JSON.parse(file.toString()) as IConfig
} catch {
    config = {}
}
