#!/usr/bin/env node # -*- TypeScript -*-
/* istanbul ignore file */
import { logger, setLogger } from './logger'
setLogger(console)

import { loadStaticCache, staticRequestHandler } from './static-file-serve'
import { stopServer, startServer } from './server'
import { config } from './config'

process.stdout.write('\n')
logger.debug({ msg: `process start` })

process
    .on('SIGINT', (signal) => {
        process.stdout.write('\n')
        logger.debug({ msg: `process ${signal}` })
        void stopServer()
    })
    .on('SIGTERM', (signal) => {
        logger.debug({ msg: `process ${signal}` })
        void stopServer()
    })
    .on('uncaughtException', (err) => {
        logger.error({ msg: 'process uncaughtException', error: err.message, stack: err.stack })
        void stopServer()
    })
    .on('exit', function processExit(code) {
        if (code !== 0) {
            logger.error({ msg: `process exit`, code })
        } else {
            logger.debug({ msg: `process exit` })
        }
    })

async function main() {
    await loadStaticCache({
        defaultHtml: config.defaultHtml ? config.defaultHtml : '/index.html',
        directory: config.directory ? config.directory : 'public',
    })
    await startServer({
        http2: config.http2 === true,
        requestHandler: staticRequestHandler,
    })
}
void main()
