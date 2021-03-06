/* istanbul ignore file */
import * as pino from 'pino'

const options: pino.LoggerOptions = {
    safe: false,
    base: {
        app: process.env.APP,
        instance: process.pid,
        region: process.env.REGION,
        version: process.env.VERSION,
    },
    level: process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'debug',
    formatters: {
        level(label: string, number: number) {
            return { level: label }
        },
    },
    redact: ['req.headers.authorization'],
}

let stream: pino.DestinationStream
let timeout: NodeJS.Timeout
if (process.env.NODE_ENV === 'production') {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    stream = pino.destination({ sync: false })
    timeout = setInterval(function loggerFlush() {
        pinoLogger.flush()
    }, 5 * 1000)
}

export const pinoLogger: pino.Logger = pino(options, stream)

export function stopLogger(): void {
    if (timeout != undefined) {
        clearInterval(timeout)
        timeout = undefined
    }
    if (stream != undefined) {
        pino.final(pinoLogger, (err, finalLogger, evt) => {
            if (err) finalLogger.error(err, 'error caused exit')
            finalLogger.flush()
        })(undefined)
        stream = undefined
    }
}

switch (process.env.LOG_LEVEL) {
    case 'trace':
    case 'debug':
    case 'info':
    case 'warn':
    case 'error':
    case 'fatal':
    case 'silent':
    case undefined:
        break
    default:
        pinoLogger.debug({ msg: 'Unknown LOG_LEVEL', level: process.env.LOG_LEVEL })
        break
}

export const logLevel = process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'debug'
