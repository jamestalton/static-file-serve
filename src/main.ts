/* istanbul ignore file */
import { loadStaticCache, staticRequestHandler } from './static-serve'
import { shutdown, start } from './server'

const logger = console

process.stdout.write('\n')
logger.debug({ msg: `process start` })

process
    .on('SIGINT', (signal) => {
        process.stdout.write('\n')
        logger.debug({ msg: `process ${signal}` })
        void shutdown()
    })
    .on('SIGTERM', (signal) => {
        logger.debug({ msg: `process ${signal}` })
        void shutdown()
    })
    .on('uncaughtException', (err) => {
        logger.error({ msg: 'process uncaughtException', error: err.message, stack: err.stack })
        void shutdown()
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
        defaultHtml: '/index.html',
        directory: 'public',
    })
    start({
        http2: true,
        requestHandler: staticRequestHandler,
    })
}
void main()
