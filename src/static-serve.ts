/* istanbul ignore file */
import * as etag from 'etag'
import { readdir, readFileSync, stat, Stats } from 'fs'
import { IncomingMessage, ServerResponse } from 'http'
import { Http2ServerRequest, Http2ServerResponse } from 'http2'
import { contentType } from 'mime-types'
import * as Negotiator from 'negotiator'
import * as path from 'path'
import { promisify } from 'util'
import { brotliCompress, BrotliOptions, constants, deflate, gzip, InputType, ZlibOptions } from 'zlib'

const logger = console

const brCompress = promisify<InputType, BrotliOptions, Buffer>(brotliCompress)
const {
    BROTLI_PARAM_MODE,
    BROTLI_MODE_TEXT,
    BROTLI_PARAM_QUALITY,
    BROTLI_PARAM_SIZE_HINT,
    BROTLI_MAX_QUALITY,
} = constants

const gzipCompress = promisify<InputType, ZlibOptions, Buffer>(gzip)
const deflateCompress = promisify<InputType, ZlibOptions, Buffer>(deflate)

const readdirAsync = promisify(readdir)
const statAsync = promisify(stat)

interface ICachedFile {
    filePath: string
    fileBuffer?: Buffer
    brBuffer?: Buffer
    gzipBuffer?: Buffer
    deflateBuffer?: Buffer
    headers: {
        'Content-Type': string
        'Cache-Control'?: string
        Link?: string
        ETag?: string
    }
}

export interface IStaticCacheOptions {
    cacheLength: number
    cacheIgnore: string[]
}

interface IStaticCache {
    defaultHtml?: string
    files: {
        [filePath: string]: ICachedFile
    }
}
let staticCache: IStaticCache = { files: {} }

async function sendCachedFile(
    cachedFile: ICachedFile,
    req: Http2ServerRequest | IncomingMessage,
    res: Http2ServerResponse | ServerResponse
): Promise<void> {
    if (cachedFile !== undefined) {
        if (cachedFile.headers.ETag && req.headers['if-none-match'] === cachedFile.headers.ETag) {
            res.writeHead(304) // 304 Not Modified
            res.end()
        } else {
            if (cachedFile.fileBuffer === undefined) {
                cachedFile.fileBuffer = readFileSync(cachedFile.filePath)
                cachedFile.headers.ETag = etag(cachedFile.fileBuffer)
                // const cacheFileString = cachedFile.fileBuffer.toString()
                // for (const subFilePath in staticCache.files) {
                //     if (cacheFileString.includes(subFilePath)) {
                //         let linkHeader = cachedFile.headers['Link']
                //         if (!linkHeader) {
                //             linkHeader = ''
                //         } else {
                //             linkHeader += ', '
                //         }
                //         linkHeader += `<${subFilePath}>; rel="preload"`
                //         cachedFile.headers['Link'] = linkHeader
                //     }
                // }
            }

            const negotiator = new Negotiator(req)
            const encodings = negotiator.encodings()
            let buffer: Buffer = cachedFile.fileBuffer
            let length = cachedFile.fileBuffer.length
            let encodingHeader = 'identity'
            for (const encoding of encodings) {
                let encodedBuffer: Buffer
                let encodedEncoding: string
                switch (encoding) {
                    case 'br':
                        if (cachedFile.brBuffer === undefined) {
                            cachedFile.brBuffer = await brCompress(cachedFile.fileBuffer, {
                                params: {
                                    [BROTLI_PARAM_MODE]: BROTLI_MODE_TEXT,
                                    [BROTLI_PARAM_QUALITY]: BROTLI_MAX_QUALITY,
                                    [BROTLI_PARAM_SIZE_HINT]: cachedFile.fileBuffer.length,
                                },
                            })
                        }
                        encodedBuffer = cachedFile.brBuffer
                        encodedEncoding = 'br'
                        break
                    case 'gzip':
                        if (cachedFile.gzipBuffer === undefined) {
                            cachedFile.gzipBuffer = await gzipCompress(cachedFile.fileBuffer, { level: 9 })
                        }
                        encodedBuffer = cachedFile.gzipBuffer
                        encodedEncoding = 'gzip'
                        break
                    case 'deflate':
                        if (cachedFile.deflateBuffer === undefined) {
                            cachedFile.deflateBuffer = await deflateCompress(cachedFile.fileBuffer, { level: 9 })
                        }
                        encodedBuffer = cachedFile.deflateBuffer
                        encodedEncoding = 'deflate'
                        break
                    default:
                        break
                }
                if (encodedBuffer) {
                    if (encodedBuffer.length < buffer.length) {
                        buffer = encodedBuffer
                        length = buffer.length
                        encodingHeader = encodedEncoding
                    }
                }
            }
            if (encodingHeader !== 'identity') {
                res.setHeader('Content-Encoding', encodingHeader)
            }
            res.setHeader('Content-Length', length)
            if (!cachedFile.headers['Cache-Control']) {
                res.setHeader('Cache-Control', `public, max-age=31536000`) // 1 year
            }
            res.writeHead(200, cachedFile.headers) // 200 OK
            res.end(buffer)
        }
    } else {
        res.writeHead(404)
        res.end()
    }
}

function cacheFile(filePath: string): ICachedFile {
    const contentTypeHeader = contentType(path.extname(filePath))
    if (contentTypeHeader !== false) {
        try {
            const cachedFile: ICachedFile = { filePath, headers: { 'Content-Type': contentTypeHeader } }
            return cachedFile
        } catch {
            // Do Nothing
        }
    }
}

function parseDirectory(directory: string, cache: IStaticCache, baseDirectory = true): Promise<IStaticCache> {
    return readdirAsync(directory)
        .then(async (entries: string[]) => {
            const promises: Array<Promise<void>> = []
            for (const entry of entries) {
                const entryPath = path.join(directory, entry)
                const statPromise: Promise<void> = statAsync(entryPath)
                    .then(
                        async (statResult: Stats): Promise<void> => {
                            if (statResult.isDirectory()) {
                                await parseDirectory(entryPath, cache, false)
                            } else if (statResult.isFile()) {
                                const cachedFile = cacheFile(entryPath)
                                if (cachedFile) {
                                    cache.files[entryPath] = cachedFile
                                }
                            }
                        }
                    )
                    .catch((err) => {
                        if (err instanceof Error) {
                            logger.error(`static cache stat  err:${err.message}`)
                        } else {
                            logger.error(`static cache stat`, err)
                        }
                    })

                promises.push(statPromise)
            }
            await Promise.all(promises)
            return cache
        })
        .catch((err) => {
            if (err instanceof Error) {
                logger.error(`static cache directory  err:${err.message}`)
            } else {
                logger.error(`static cache directory`, err)
            }
            return cache
        })
}

export async function loadStaticCache(options: { directory?: string; defaultHtml?: string }): Promise<void> {
    const newCache: IStaticCache = { defaultHtml: options.defaultHtml, files: {} }
    await parseDirectory(options.directory, { files: {} }).then((cache) => {
        for (const filePath in cache.files) {
            newCache.files[filePath.substr(filePath.indexOf('/'))] = cache.files[filePath]
        }

        for (const filePath in newCache) {
            if (filePath === options.defaultHtml) {
                const defaultRecord: ICachedFile = newCache.files[filePath]
                const headers: { [header: string]: string } = defaultRecord.headers
                headers['Cache-Control'] = `no-cache`
                headers['Strict-Transport-Security'] = 'max-age=31536000 ; includeSubDomains'
                headers['X-Frame-Options'] = 'deny'
                headers['X-XSS-Protection'] = '1; mode=block'
                headers['X-Content-Type-Options'] = 'nosniff'
                headers['Content-Security-Policy'] = "default-src 'self'"
                headers['X-Permitted-Cross-Domain-Policies'] = 'none'
                headers['Referrer-Policy'] = 'no-referrer'
                headers['Feature-Policy'] = "vibrate 'none'; geolocation 'none'"
                headers['X-DNS-Prefetch-Control'] = 'off'
                headers['Expect-CT'] = 'enforce, max-age=30'
            }
            //  else if (filePath.startsWith('/assets/')) {
            //     newCache.files[filePath].headers[
            //         'Cache-Control'
            //     ] = `public, max-age=86400, stale-while-revalidate=120, stale-if-error=120` // 24 hours
            // } else if (filePath === '/favicon.ico') {
            //     newCache.files[filePath].headers[
            //         'Cache-Control'
            //     ] = `public, max-age=86400, stale-while-revalidate=120, stale-if-error=120` // 24 hours
            // } else if (filePath.startsWith('/ngsw')) {
            //     newCache.files[filePath].headers['Cache-Control'] = `no-cache, no-store, must-revalidate`
            // }
        }

        staticCache = newCache

        logger.debug({ msg: `static files cached`, count: Object.keys(cache.files).length })
    })
}

export async function staticRequestHandler(
    req: Http2ServerRequest | IncomingMessage,
    res: Http2ServerResponse | ServerResponse
): Promise<void> {
    let url = req.url

    const i = url.indexOf('?')
    if (i !== -1) {
        url = url.substr(0, i)
    }

    let cached = staticCache.files[url]
    if (cached === undefined) {
        const ext = path.extname(url)
        if (ext === '') {
            cached = staticCache.files[staticCache.defaultHtml]
        }
    }

    await sendCachedFile(cached, req, res)
}
