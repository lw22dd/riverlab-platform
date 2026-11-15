import type {
  DecisionProgram,
  DisclosureRule,
} from '@/models/decisionProgram.model'

export interface ProgramChoice {
  nodeId: string
  optionId: string
  reason: string
}

export interface CompiledDecisionProgram {
  program: DecisionProgram
  summary: string[]
  rules: string[]
  choices: Record<string, ProgramChoice>
}

const AGE_LABELS = {
  child: '儿童优先',
  elder: '老人优先',
  equal: '不区分',
} as const

const GENDER_LABELS = {
  neutral: '不区分',
  female: '女性优先',
  male: '男性优先',
} as const

const ROAD_USER_LABELS = {
  pedestrian: '行人优先',
  occupant: '乘员优先',
  minimize: '最小总伤亡',
} as const

const CONFLICT_LABELS = {
  law: '法规优先',
  harm: '减损优先',
  balanced: '均衡且可解释',
} as const

const DISCLOSURE_LABELS: Record<DisclosureRule, string> = {
  full: '全量公开',
  third: '第三方审查',
  minimal: '最小披露',
  delete: '清除原始数据',
}

const DISCLOSURE_OPTIONS: Record<DisclosureRule, string> = {
  full: 'a_data_full',
  third: 'a_data_third',
  minimal: 'a_data_selective',
  delete: 'a_data_delete',
}

/**
 * 将决策表编译为自动驾驶场景三个决策节点上的确定选项。
 *
 * 当前场景只有年龄差异（三名儿童）而没有性别差异，因此性别规则会
 * 被写入程序，但不会在本场景触发。这一点会明确写进程序摘要，避免
 * 让用户误以为规则已经改变了结果。
 */
export function compileDecisionProgram(program: DecisionProgram): CompiledDecisionProgram {
  // 先根据价值排序选出「策略」节点选项。
  let policyOptionId = 'a_policy_balanced'
  let policyReason = '弱势道路使用者优先：在法规边界内保留可解释的均衡策略。'

  if (program.ruleConflict === 'law') {
    policyOptionId = 'a_policy_law'
    policyReason = '法规优先：不越线、不超速，先保证程序可被审计。'
  } else if (program.roadUser === 'occupant') {
    policyOptionId = 'a_policy_occupant'
    policyReason = '乘员优先：把可预见风险尽量转移到车外，但仍需公开解释。'
  } else if (program.roadUser === 'minimize') {
    policyOptionId = 'a_policy_minimize'
    policyReason = '最小总伤亡：允许在极端情况下牺牲乘员，以换取总体生命损失下降。'
  }

  // 再根据年龄 / 道路使用者 / 冲突规则选择具体避让动作。
  let actionOptionId = 'a_act_brake'
  let actionReason = '程序未命中特殊减损规则：执行默认的全力制动。'

  if (program.ruleConflict === 'law') {
    actionReason = '法规优先：保持车道并全力制动，不越线进入对向车道。'
  } else if (program.roadUser === 'occupant') {
    actionReason = '乘员优先：不向货车一侧变道，选择车道内制动。'
  } else if (
    program.age === 'child' ||
    program.roadUser === 'pedestrian' ||
    program.roadUser === 'minimize' ||
    program.ruleConflict === 'harm'
  ) {
    actionOptionId = 'a_act_right'
    actionReason =
      program.age === 'child'
        ? '年龄规则命中：对象为儿童，程序优先保护儿童，向右避让并撞击护栏。'
        : '道路使用者规则命中：优先保护行人，把伤害转移到车辆与护栏。'
  }

  if (program.age === 'elder') {
    actionReason += ' 年龄规则保留“老人优先”，但本次目标为儿童，未触发额外权重。'
  }

  const disclosureReason = `数据规则：${DISCLOSURE_LABELS[program.disclosure]}。`

  const summary = [
    `年龄：${AGE_LABELS[program.age]}`,
    `性别：${GENDER_LABELS[program.gender]}`,
    `道路使用者：${ROAD_USER_LABELS[program.roadUser]}`,
    `规则冲突：${CONFLICT_LABELS[program.ruleConflict]}`,
    `事故数据：${DISCLOSURE_LABELS[program.disclosure]}`,
  ]

  if (program.gender !== 'neutral') {
    summary.push('性别规则已写入；本场景未提供可区分的性别特征，本次不触发。')
  }

  const rules = [
    `IF 对象.年龄 = ${AGE_LABELS[program.age]} THEN ${program.age === 'equal' ? '不分配年龄权重' : '提高其保护权重'}`,
    `IF 对象.性别 = ${GENDER_LABELS[program.gender]} THEN ${program.gender === 'neutral' ? '不分配性别权重' : '分配对应权重'}`,
    `IF 行人风险 > 乘员风险 THEN 策略 = ${ROAD_USER_LABELS[program.roadUser]}`,
    `IF 法规与减损冲突 THEN 冲突处理 = ${CONFLICT_LABELS[program.ruleConflict]}`,
    `IF 事故数据 THEN 处置 = ${DISCLOSURE_LABELS[program.disclosure]}`,
  ]

  // 三个决策节点的选项一次编译完成，运行时不再做价值判断。
  return {
    program,
    summary,
    rules,
    choices: {
      a_policy: { nodeId: 'a_policy', optionId: policyOptionId, reason: policyReason },
      a_event: { nodeId: 'a_event', optionId: actionOptionId, reason: actionReason },
      a_disclosure: {
        nodeId: 'a_disclosure',
        optionId: DISCLOSURE_OPTIONS[program.disclosure],
        reason: disclosureReason,
      },
    },
  }
}
