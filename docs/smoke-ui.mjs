import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = process.env.WEB_BASE ?? 'http://localhost'
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const DEBUG_PORT = Number(process.env.CHROME_DEBUG_PORT ?? 9223)
const profileDir = mkdtempSync(join(tmpdir(), 'moral-lab-e2e-'))

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profileDir}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitForDebugger() {
  for (let i = 0; i < 40; i++) {
    try {
      const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`)
      if (response.ok) return
    } catch {
      // Chrome 尚未就绪
    }
    await sleep(250)
  }
  throw new Error('Chrome 调试端口未就绪')
}

class CDP {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    this.events = []
    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data)
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id)
        this.pending.delete(message.id)
        if (message.error) reject(new Error(message.error.message))
        else resolve(message.result)
        return
      }
      if (message.method) {
        this.events.push(message)
        if (this.events.length > 200) this.events.shift()
      }
    })
  }

  send(method, params = {}) {
    const id = ++this.id
    this.ws.send(JSON.stringify({ id, method, params }))
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }))
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    })
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text ?? '页面脚本执行失败')
    }
    return result.result?.value
  }

  async navigate(url) {
    await this.send('Page.navigate', { url })
    await sleep(1200)
  }
}

async function waitForPath(cdp, predicate, timeoutMs = 10000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const path = await cdp.evaluate('location.pathname')
    if (path && predicate(path)) return path
    await sleep(300)
  }
  throw new Error('等待路由跳转超时')
}

async function main() {
  await waitForDebugger()
  const target = await fetch(
    `http://127.0.0.1:${DEBUG_PORT}/json/new?${encodeURIComponent(`${BASE}/login`)}`,
    { method: 'PUT' },
  ).then((response) => response.json())

  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', reject, { once: true })
  })

  const cdp = new CDP(ws)
  await cdp.send('Runtime.enable')
  await cdp.send('Page.enable')
  await cdp.send('Network.enable')
  await sleep(1000)

  const loginTitle = await cdp.evaluate('document.body.innerText.slice(0, 200)')
  if (!String(loginTitle).includes('登录你的账户')) {
    throw new Error(`登录页未渲染: ${loginTitle}`)
  }

  const result = await cdp.evaluate(`(() => {
    const inputs = Array.from(document.querySelectorAll('input'));
    if (inputs.length < 2) return { ok: false, reason: '输入框数量不足' };
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(inputs[0], 'admin');
    inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
    setter.call(inputs[1], 'admin123');
    inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
    const button = document.querySelector('button[type="submit"]');
    const form = document.querySelector('form.login-form');
    if (!button || !form) return { ok: false, reason: '没有登录按钮或表单' };
    form.requestSubmit();
    return { ok: true, disabled: button.disabled, values: inputs.map((input) => input.value), form: Boolean(button.form) };
  })()`)
  if (!result?.ok) throw new Error(String(result?.reason ?? '登录表单操作失败'))

  let path = '/login'
  try {
    path = await waitForPath(cdp, (value) => value !== '/login')
  } catch (error) {
    const diagnostics = await cdp.evaluate(`({
      path: location.pathname,
      body: document.body.innerText.slice(0, 600),
      auth: localStorage.getItem('user'),
      disabled: document.querySelector('button[type="submit"]')?.disabled,
      values: Array.from(document.querySelectorAll('input')).map((input) => input.value)
    })`)
    const events = cdp.events
      .filter((event) =>
        ['Runtime.consoleAPICalled', 'Runtime.exceptionThrown', 'Network.requestWillBeSent', 'Network.responseReceived'].includes(
          event.method,
        ),
      )
      .slice(-12)
      .map((event) => ({ method: event.method, params: event.params }))
    throw new Error(`${error.message} | ${JSON.stringify({ diagnostics, events })}`)
  }
  await sleep(1200)

  const auth = await cdp.evaluate('localStorage.getItem("user")')
  const authState = JSON.parse(auth ?? 'null')
  if (!authState?.accessToken || authState?.userInfo?.username !== 'admin') {
    throw new Error(`登录态未写入: ${auth}`)
  }

  const homeText = await cdp.evaluate('document.body.innerText.slice(0, 600)')
  if (!String(homeText).includes('实验主题')) {
    throw new Error(`首页未渲染: ${homeText}`)
  }

  await cdp.navigate(`${BASE}/experiments/dujiangyan`)
  const detailText = await cdp.evaluate('document.body.innerText')
  const panoramaHref = await cdp.evaluate(
    'document.querySelector(".panorama-card")?.getAttribute("href") ?? ""',
  )
  if (!String(detailText).includes('都江堰全景漫游')) {
    throw new Error('都江堰详情页没有全景卡片')
  }
  if (panoramaHref !== '/panorama/?space=dujiangyan') {
    throw new Error(`全景卡片链接不正确: ${panoramaHref}`)
  }

  await cdp.navigate(`${BASE}/panorama/admin/experiments`)
  await sleep(1500)
  const panoramaPath = await cdp.evaluate('location.pathname')
  const adminText = await cdp.evaluate('document.body.innerText.slice(0, 800)')
  if (!panoramaPath.startsWith('/panorama/')) {
    throw new Error(`全景路由未接管: ${panoramaPath}`)
  }
  if (!String(adminText).includes('实验数据')) {
    throw new Error(`平台后台实验数据页未渲染: ${adminText}`)
  }

  await cdp.navigate(`${BASE}/panorama/user/experiments`)
  await sleep(1600)
  const recordsPath = await cdp.evaluate('location.pathname')
  const recordsText = await cdp.evaluate('document.body.innerText.slice(0, 1200)')
  if (recordsPath !== '/panorama/user/experiments' || !String(recordsText).includes('实验记录')) {
    throw new Error(`个人实验记录页未渲染: ${recordsPath} ${recordsText}`)
  }

  await cdp.navigate(`${BASE}/panorama/?space=dujiangyan`)
  await sleep(2200)
  const dujiangyanPath = await cdp.evaluate('location.pathname')
  if (!dujiangyanPath.startsWith('/panorama/space/')) {
    throw new Error(`都江堰全景入口未自动进入景区: ${dujiangyanPath}`)
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        loginRedirect: path,
        user: authState.userInfo.username,
        panoramaCard: panoramaHref,
        panoramaPath,
        adminPage: '实验数据',
        recordsPath,
        dujiangyanPath,
      },
      null,
      2,
    ),
  )

  ws.close()
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    chrome.kill()
    await sleep(300)
    try {
      rmSync(profileDir, { recursive: true, force: true })
    } catch {
      // 忽略临时目录清理失败
    }
  })
