const BASE = process.env.API_BASE ?? 'http://localhost:7000'

async function waitForHealth() {
  for (let i = 0; i < 40; i++) {
    try {
      const response = await fetch(`${BASE}/health`)
      if (response.ok) return
    } catch {
      // 服务尚未启动
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error('API 未在 20 秒内启动')
}

async function login(username, password) {
  const response = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const body = await response.json()
  if (!response.ok || body.code !== 200) {
    throw new Error(`登录失败 ${username}: ${JSON.stringify(body)}`)
  }
  return body.data.access_token
}

async function request(path, token, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  })
  const text = await response.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  return { status: response.status, body }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function main() {
  await waitForHealth()

  const adminToken = await login('admin', 'admin123')
  const sessionId = `smoke-${Date.now()}`
  const now = Date.now()
  const payload = {
    id: sessionId,
    scenarioId: 'dujiangyan-build',
    scenarioTitle: '都江堰：开山导江记',
    scenarioSubtitle: '建造过程仿真',
    scenarioVersion: '1.0.0',
    domain: 'engineering',
    startedAt: now - 60000,
    finishedAt: now,
    durationMs: 60000,
    decisions: [
      {
        nodeId: 'choose_plan',
        nodeTitle: '治水方略',
        optionId: 'plan_guide',
        label: '因势利导',
        tone: 'positive',
        tags: [],
        elapsedMs: 12000,
        at: now - 40000,
        timedOut: false,
      },
    ],
    logs: [],
    path: ['choose_plan'],
    inspected: [],
    transitions: [],
    metrics: [{ key: 'judgement', label: '治水判断', description: '', value: 88, initial: 50, weight: 1 }],
    score: 88,
    grade: 'A',
    gradeLabel: '优秀',
    gradeTone: 'positive',
    rules: [
      {
        id: 'rule_guide',
        label: '因势利导',
        description: '',
        kind: 'positive',
        matched: true,
        metricDeltas: [],
        tags: [],
      },
    ],
    tags: ['smoke'],
    outcome: {
      id: 'outcome_good',
      kicker: '验收',
      title: '工程配合得当',
      description: '',
      advice: '',
    },
  }

  const upload = await request('/api/v1/sim/sessions', adminToken, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  assert(upload.status === 200 && upload.body?.data?.id === sessionId, `上报失败: ${JSON.stringify(upload)}`)

  const list = await request('/api/v1/sim/sessions?page=1&page_size=10', adminToken)
  assert(list.status === 200 && list.body?.data?.total >= 1, `列表失败: ${JSON.stringify(list)}`)
  assert(
    list.body.data.items.some((item) => item.id === sessionId),
    '列表中没有刚上报的会话',
  )

  const detail = await request(`/api/v1/sim/sessions/${sessionId}`, adminToken)
  assert(detail.status === 200 && detail.body?.data?.payload?.id === sessionId, '详情失败')

  const overview = await request('/api/v1/sim/analytics/overview', adminToken)
  assert(overview.status === 200 && overview.body?.data?.sessions >= 1, '概览失败')
  assert(overview.body.data.grade_distribution.A >= 1, '等级分布未统计到 A')

  const scenarios = await request('/api/v1/sim/analytics/scenarios', adminToken)
  assert(
    scenarios.status === 200 &&
      scenarios.body.data.items.some((item) => item.scenario_id === 'dujiangyan-build'),
    '场景汇总失败',
  )

  const decisions = await request('/api/v1/sim/analytics/decisions?scenario_id=dujiangyan-build', adminToken)
  assert(decisions.status === 200 && decisions.body?.data?.items?.length >= 1, '决策汇总失败')

  const rules = await request('/api/v1/sim/analytics/rules?scenario_id=dujiangyan-build', adminToken)
  assert(rules.status === 200 && rules.body?.data?.items?.length >= 1, '规则汇总失败')

  const csvResponse = await fetch(`${BASE}/api/v1/sim/analytics/export.csv`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  const csvText = await csvResponse.text()
  assert(csvResponse.ok && csvText.includes('学号'), 'CSV 导出失败')

  const teacherToken = await login('teacher1', 'teacher123')
  const teacherDetail = await request(`/api/v1/sim/sessions/${sessionId}`, teacherToken)
  assert(teacherDetail.status === 404, `教师不应看到管理员会话，实际 ${teacherDetail.status}`)

  const conflict = await request('/api/v1/sim/sessions', teacherToken, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  assert(conflict.status === 409, `同一会话 id 被其他用户复用时应为 409，实际 ${conflict.status}`)

  console.log(
    JSON.stringify(
      {
        ok: true,
        sessionId,
        overview: overview.body.data,
        scenarios: scenarios.body.data.items.length,
        decisions: decisions.body.data.items.length,
        rules: rules.body.data.items.length,
        csvBytes: Buffer.byteLength(csvText),
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
