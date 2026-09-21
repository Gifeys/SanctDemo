// Drives the installed app through the WebView's DevTools protocol, so a
// test clicks the real button rather than a guessed screen coordinate.
const WebSocket = require('ws')
const http = require('http')

const get = (path) => new Promise((resolve, reject) => {
  http.get({ host: '127.0.0.1', port: 9222, path }, res => {
    let body = ''
    res.on('data', d => (body += d))
    res.on('end', () => resolve(JSON.parse(body)))
  }).on('error', reject)
})

const expression = process.argv[2]

;(async () => {
  const targets = await get('/json/list')
  const page = targets.find(t => t.type === 'page' && t.url.includes('localhost'))
  if (!page) { console.log('NO PAGE TARGET'); process.exit(1) }

  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise(r => ws.on('open', r))

  const send = (method, params) => new Promise(resolve => {
    const id = Math.floor(Math.random() * 1e6)
    const onMessage = raw => {
      const msg = JSON.parse(raw)
      if (msg.id === id) { ws.off('message', onMessage); resolve(msg) }
    }
    ws.on('message', onMessage)
    ws.send(JSON.stringify({ id, method, params }))
  })

  const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  console.log(JSON.stringify(res.result?.result?.value ?? res.result, null, 2))
  ws.close()
})().catch(e => { console.error('ERR', e.message); process.exit(1) })
