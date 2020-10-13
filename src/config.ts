/* istanbul ignore file */

import { readFileSync } from 'fs'

export interface IConfig {
    http2?: boolean
    defaultHtml?: string
    directory?: string
    defaultHeaders?: Record<string, string>
}

export let config: IConfig

try {
    const file = readFileSync('config.json')
    config = JSON.parse(file.toString()) as IConfig
} catch {
    config = {}
}
