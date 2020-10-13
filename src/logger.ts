export interface ILogger {
    info(message: Record<string, unknown>): void
    debug(message: Record<string, unknown>): void
    error(message: Record<string, unknown>): void
}

function noop(): void {
    // Do Nothing
}

export let logger: ILogger = {
    info: noop,
    debug: noop,
    error: noop,
}

export function setLogger(newLogger: ILogger): void {
    logger = newLogger
}
