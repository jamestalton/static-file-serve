/* istanbul ignore file */

import { readFileSync } from 'fs'
import { createServer as createHttpServer, IncomingMessage, request, Server, ServerResponse, STATUS_CODES } from 'http'
import {
    createSecureServer,
    createServer as createHttp2Server,
    Http2Server,
    Http2ServerRequest,
    Http2ServerResponse,
} from 'http2'
import { createServer as createHttpsServer } from 'https'
import { Socket } from 'net'
import { TLSSocket } from 'tls'
import { logger } from './logger'

let server: Http2Server | Server

interface ISocketRequests {
    socketID: number
    activeRequests: number
}

let nextSocketID = 0
const sockets: { [id: string]: Socket | TLSSocket } = {}

export type ServerOptions =
    | {
          http2: true
          requestHandler: (req: Http2ServerRequest, res: Http2ServerResponse) => void
      }
    | {
          http2: false
          requestHandler: (req: IncomingMessage, res: ServerResponse) => void
      }

export function startServer(options: ServerOptions): Promise<Http2Server | Server> {
    let cert: Buffer
    let key: Buffer
    try {
        cert = readFileSync('certs/tls.crt')
        key = readFileSync('certs/tls.key')
    } catch {
        /**/
    }

    try {
        if (options.http2 === true) {
            if (cert && key) {
                logger.debug({ msg: `server start`, type: 'http2', secure: true })
                server = createSecureServer({ cert, key, allowHTTP1: true }, options.requestHandler)
            } else {
                logger.debug({ msg: `server start`, type: 'http2', secure: false })
                server = createHttp2Server(options.requestHandler)
            }
        } else {
            if (cert && key) {
                logger.debug({ msg: `server start`, type: 'http', secure: true })
                server = createHttpsServer({ cert, key }, options.requestHandler)
            } else {
                logger.debug({ msg: `server start`, type: 'http', secure: false })
                server = createHttpServer(options.requestHandler)
            }
        }
        return new Promise((resolve, reject) => {
            server
                .listen(process.env.PORT, () => {
                    // server.listening
                    const address = server.address()
                    if (typeof address === 'string') {
                        logger.debug({ msg: `server listening`, address })
                    } else {
                        logger.debug({ msg: `server listening`, port: address.port })
                    }

                    resolve(server)
                })
                .on('connection', (socket) => {
                    let socketID = nextSocketID++
                    while (sockets[socketID] !== undefined) {
                        socketID = nextSocketID++
                    }
                    sockets[socketID] = socket
                    ;((socket as unknown) as ISocketRequests).socketID = socketID
                    ;((socket as unknown) as ISocketRequests).activeRequests = 0
                    socket.on('close', () => {
                        const socketID = ((socket as unknown) as ISocketRequests).socketID
                        if (socketID < nextSocketID) nextSocketID = socketID
                        sockets[socketID] = undefined
                    })
                })
                .on('request', (req, res) => {
                    const start = process.hrtime()
                    const socket = (req.socket as unknown) as ISocketRequests
                    socket.activeRequests++
                    req.on('close', () => {
                        socket.activeRequests--
                        if (isShuttingDown) {
                            req.socket.destroy()
                        }

                        const msg = {
                            msg: STATUS_CODES[res.statusCode],
                            status: res.statusCode,
                            method: req.method,
                            url: req.url,
                            ms: 0,
                        }

                        const diff = process.hrtime(start)
                        const time = Math.round((diff[0] * 1e9 + diff[1]) / 10000) / 100
                        msg.ms = time

                        if (res.statusCode < 400) {
                            logger.info(msg)
                        } else if (res.statusCode < 500) {
                            logger.warn(msg)
                        } else {
                            logger.error(msg)
                        }
                    })
                })
                .on('error', (err: NodeJS.ErrnoException) => {
                    server.close()
                    if (err.code === 'EADDRINUSE') {
                        logger.error({
                            msg: `server error`,
                            error: 'address already in use',
                            port: Number(process.env.PORT),
                        })
                    } else {
                        logger.error({ msg: `server error`, error: err.message })
                    }
                })
        })
    } catch (err) {
        if (err instanceof Error) {
            logger.error({ msg: `server start error`, error: err.message, stack: err.stack })
        } else {
            logger.error({ msg: `server start error` })
        }
        void stopServer()
    }
}

let isShuttingDown = false

export async function stopServer(): Promise<void> {
    if (isShuttingDown) return
    isShuttingDown = true

    logger.debug({ msg: 'shutting down' })

    if (process.env.NODE_ENV === 'development') {
        setTimeout(function () {
            logger.error({ msg: 'shutdown timeout' })
            // eslint-disable-next-line no-process-exit
            process.exit(1)
        }, 5 * 1000).unref()
    }

    for (const socketID of Object.keys(sockets)) {
        const socket = sockets[socketID]
        if (socket !== undefined) {
            if (((socket as unknown) as ISocketRequests).activeRequests === 0) {
                socket.destroy()
            }
        }
    }

    if (server) {
        logger.debug({ msg: 'closing server' })
        await new Promise((resolve) =>
            server.close((err: Error) => {
                if (err) {
                    logger.error({ msg: 'server close error', error: err.message })
                } else {
                    logger.debug({ msg: 'server closed' })
                }
                resolve()
            })
        )
    }

    logger.debug({ msg: `shutdown complete` })
}
