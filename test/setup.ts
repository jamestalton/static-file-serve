process.env.NODE_ENV = 'test'
process.env.LOG_LEVEL = 'silent'

import * as axios from 'axios'
import { Server } from 'http'
import { Http2Server } from 'http2'
import { AddressInfo } from 'net'
import * as nock from 'nock'
import { startServer, stopServer } from '../src/server'
import { loadStaticCache, staticRequestHandler } from '../src/static-file-serve'

export let request: axios.AxiosInstance

export function setup(): void {
    beforeAll(setupBeforeAll)
    afterAll(setupAfterAll)
}

export async function setupBeforeAll(): Promise<void> {
    nock.disableNetConnect()
    nock.enableNetConnect('127.0.0.1')
    nock.enableNetConnect('localhost')

    await loadStaticCache({
        defaultHtml: '/index.html',
        directory: 'public',
    })

    const server: Http2Server | Server = await startServer({
        http2: false,
        requestHandler: staticRequestHandler,
    })

    const port = (server.address() as AddressInfo).port
    request = axios.default.create({
        baseURL: `http://localhost:${port}`,
        validateStatus: () => true,
    })
}

export async function setupAfterAll(): Promise<void> {
    await stopServer()
    nock.enableNetConnect()
    nock.restore()
}
