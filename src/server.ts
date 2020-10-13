import { readFileSync } from 'fs'
import { createServer as createHttpServer, IncomingMessage, Server, ServerResponse } from 'http'
import {
    createSecureServer,
    createServer as createHttp2Server,
    Http2Server,
    Http2ServerRequest,
    Http2ServerResponse,
} from 'http2'
import { createServer as createHttpsServer } from 'https'
import { logger } from './logger'

let server: Http2Server | Server

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
        // eslint-disable-next-line no-process-exit
        process.exit(0)
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
