export interface ILogger {
    info(message: Record<string, unknown>): void
    debug(message: Record<string, unknown>): void
    error(message: Record<string, unknown>): void
}

export let logger: ILogger = {
    info: () => {
        /**/
    },
    debug: () => {
        /**/
    },
    error: () => {
        /**/
    },
}

export function setLogger(newLogger: ILogger): void {
    logger = newLogger
}
