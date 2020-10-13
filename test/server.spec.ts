import { setup, request } from './setup'

setup()

describe(`Routes`, function () {
    it(`GET / returns status 200 and default html`, async function () {
        const response = await request.get(`/`)
        expect(response.status).toEqual(200)
        expect(response.headers).toMatchObject({
            'cache-control': 'no-cache',
            'content-type': 'text/html; charset=utf-8',
        })
    })

    it(`GET /index.html returns status 200 and html`, async function () {
        const response = await request.get(`/index.html`)
        expect(response.status).toEqual(200)
        expect(response.headers).toMatchObject({
            'cache-control': 'no-cache',
            'content-type': 'text/html; charset=utf-8',
        })
    })

    it(`GET /styles.css returns css`, async function () {
        const response = await request.get(`/styles.css`)
        expect(response.status).toEqual(200)
        expect(response.headers).toMatchObject({
            'cache-control': 'public, max-age=31536000',
            'content-type': 'text/css; charset=utf-8',
        })
    })
})
