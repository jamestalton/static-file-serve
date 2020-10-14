/* istanbul ignore file */

interface ILogMessage {
    msg: string
    [key: string]: unknown
}

export interface ILogger {
    info(message: ILogMessage): void
    warn(message: ILogMessage): void
    debug(message: ILogMessage): void
    error(message: ILogMessage): void
}

function noop(): void {
    // Do Nothing
}

export let logger: ILogger = {
    info: noop,
    warn: noop,
    debug: noop,
    error: noop,
}

/* istanbul ignore next */
export function setLogger(newLogger: ILogger): void {
    logger = newLogger
}
