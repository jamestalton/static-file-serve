#!/usr/bin/env node # -*- TypeScript -*-
/* istanbul ignore file */
import { logger, setLogger } from './logger'
import { pinoLogger, stopLogger } from './pino-logger'
setLogger(pinoLogger)

import { loadStaticCache, staticRequestHandler } from './static-file-serve'
import { stopServer, startServer } from './server'
import { config } from './config'

process.stdout.write('\n')
logger.debug({ msg: `process start` })

async function start() {
    await loadStaticCache({
        defaultHtml: config.defaultHtml ? config.defaultHtml : '/index.html',
        directory: config.directory ? config.directory : 'public',
        defaultHeaders: config.defaultHeaders ? config.defaultHeaders : { ['Cache-Control']: 'no-cache' },
    })
    await startServer({
        http2: config.http2 === true,
        requestHandler: staticRequestHandler,
    })
}

async function stop() {
    await stopServer()
    stopLogger()
}

process
    .on('SIGINT', (signal) => {
        process.stdout.write('\n')
        logger.debug({ msg: `process ${signal}` })
        void stop()
    })
    .on('SIGTERM', (signal) => {
        logger.debug({ msg: `process ${signal}` })
        void stop()
    })
    .on('uncaughtException', (err) => {
        logger.error({ msg: 'process uncaughtException', error: err.message, stack: err.stack })
        void stop()
    })
    .on('exit', function processExit(code) {
        if (code !== 0) {
            logger.error({ msg: `process exit`, code })
        } else {
            logger.debug({ msg: `process exit` })
        }
    })

void start()
