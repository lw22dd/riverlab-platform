const BASE = process.env.API_BASE ?? 'http://localhost:8080'

async function login(username, password) {
  const response = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const body = await response.json()
  if (!response.ok || body.code !== 200) throw new Error(`登录失败 ${username}: ${JSON.stringify(body)}`)
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
  const adminToken = await login('admin', 'admin123')
  const studentId = 20240001

  const create = await request('/api/v1/user/admin/create', adminToken, {
    method: 'POST',
    body: JSON.stringify({
      id: studentId,
      username: String(studentId),
      password: '123456',
      email: 'demo-student@example.com',
      nickname: '演示学生',
      role_id: 3,
      class_id: 1,
      teacher_ids: [2],
    }),
  })
  if (create.status !== 200) {
    const message = create.body?.msg ?? JSON.stringify(create.body)
    if (!String(message).includes('已存在') && !String(message).includes('exists')) {
      throw new Error(`创建演示学生失败: ${message}`)
    }
  }

  const studentToken = await login(String(studentId), '123456')
  const now = Date.now()
  const sessionId = `demo-student-${now}`
  const upload = await request('/api/v1/sim/sessions', studentToken, {
    method: 'POST',
    body: JSON.stringify({
      id: sessionId,
      scenarioId: 'dujiangyan-build',
      scenarioTitle: '都江堰：开山导江记',
      scenarioSubtitle: '建造过程仿真',
      scenarioVersion: '1.0.0',
      domain: 'engineering',
      startedAt: now - 720000,
      finishedAt: now,
      durationMs: 720000,
      decisions: [
        {
          nodeId: 'choose_plan',
          nodeTitle: '治水方略',
          optionId: 'plan_guide',
          label: '因势利导',
          tone: 'positive',
          tags: [],
          elapsedMs: 15000,
          at: now - 600000,
          timedOut: false,
        },
      ],
      logs: [
        {
          id: 1,
          at: now - 720000,
          elapsedMs: 0,
          kind: 'system',
          title: '开始',
          text: '进入都江堰建造场景',
          tone: 'info',
        },
      ],
      path: ['choose_plan'],
      inspected: [],
      transitions: [],
      metrics: [
        { key: 'judgement', label: '治水判断', description: '', value: 92, initial: 50, weight: 1 },
      ],
      score: 92,
      grade: 'A',
      gradeLabel: '优秀',
      gradeTone: 'positive',
      rules: [
        {
          id: 'rule_guide',
          label: '因势利导',
          description: '按水势安排工程',
          kind: 'positive',
          matched: true,
          metricDeltas: [],
          tags: [],
        },
      ],
      tags: ['demo'],
      outcome: {
        id: 'outcome_good',
        kicker: '验收',
        title: '工程配合得当',
        description: '工程整体配合得当。',
        advice: '继续关注岁修。',
      },
    }),
  })
  assert(upload.status === 200, `学生上报失败: ${JSON.stringify(upload)}`)

  const studentList = await request('/api/v1/sim/sessions?page=1&page_size=10', studentToken)
  assert(studentList.status === 200, '学生查询实验记录失败')
  const studentItems = studentList.body?.data?.items ?? []
  assert(
    studentItems.some((item) => item.id === sessionId),
    '学生个人中心看不到自己的实验记录',
  )

  const teacherToken = await login('teacher1', 'teacher123')
  const teacherList = await request('/api/v1/sim/sessions?page=1&page_size=20', teacherToken)
  assert(teacherList.status === 200, '教师查询班级实验记录失败')
  const teacherItems = teacherList.body?.data?.items ?? []
  assert(
    teacherItems.some((item) => item.id === sessionId),
    '教师看不到本班学生的实验记录',
  )

  const studentDetail = await request(`/api/v1/sim/sessions/${sessionId}`, studentToken)
  assert(studentDetail.status === 200, '学生查询实验报告详情失败')
  assert(studentDetail.body?.data?.payload?.score === 92, '实验报告 payload 不完整')

  console.log(
    JSON.stringify(
      {
        ok: true,
        student: { username: String(studentId), password: '123456', class_id: 1 },
        sessionId,
        studentRecords: studentList.body.data.total,
        teacherRecords: teacherList.body.data.total,
        detailScore: studentDetail.body.data.payload.score,
        detailDecisions: studentDetail.body.data.payload.decisions.length,
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
