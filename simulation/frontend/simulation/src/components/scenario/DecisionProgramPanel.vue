<script setup lang="ts">
import { computed, reactive } from 'vue'
import type { ScenarioDefinition } from '@/models/scenario.model'
import {
  defaultDecisionProgram,
  type AgeRule,
  type DecisionProgram,
  type DisclosureRule,
  type GenderRule,
  type RoadUserRule,
  type RuleConflictRule,
} from '@/models/decisionProgram.model'
import { compileDecisionProgram } from '@/engine/decisionProgram'
import Icon from '@/components/common/Icon.vue'

const props = defineProps<{
  scenario: ScenarioDefinition
  initial?: DecisionProgram | null
}>()

const emit = defineEmits<{
  compile: [program: DecisionProgram]
  back: []
}>()

interface ProgramRow {
  title: string
  hint: string
  value: string
  options: Array<{ value: string; label: string }>
  select: (value: string) => void
}

const program = reactive<DecisionProgram>({ ...(props.initial ?? defaultDecisionProgram) })
const compiled = computed(() => compileDecisionProgram(program))

const rows = computed<ProgramRow[]>(() => [
  {
    title: '年龄权重',
    hint: '老人与儿童同时进入冲突区域时，程序优先保护谁？',
    value: program.age,
    options: [
      { value: 'child', label: '儿童优先' },
      { value: 'elder', label: '老人优先' },
      { value: 'equal', label: '不区分' },
    ],
    select: (value) => {
      program.age = value as AgeRule
    },
  },
  {
    title: '性别权重',
    hint: '目标性别可被识别时，是否改变保护顺序？',
    value: program.gender,
    options: [
      { value: 'neutral', label: '不区分' },
      { value: 'female', label: '女性优先' },
      { value: 'male', label: '男性优先' },
    ],
    select: (value) => {
      program.gender = value as GenderRule
    },
  },
  {
    title: '道路使用者',
    hint: '行人与车内乘员同时处于风险中时，程序向谁倾斜？',
    value: program.roadUser,
    options: [
      { value: 'pedestrian', label: '行人优先' },
      { value: 'occupant', label: '乘员优先' },
      { value: 'minimize', label: '最小总伤亡' },
    ],
    select: (value) => {
      program.roadUser = value as RoadUserRule
    },
  },
  {
    title: '规则冲突',
    hint: '遵守车道与降低伤害不能同时满足时，程序如何取舍？',
    value: program.ruleConflict,
    options: [
      { value: 'law', label: '法规优先' },
      { value: 'harm', label: '减损优先' },
      { value: 'balanced', label: '均衡且可解释' },
    ],
    select: (value) => {
      program.ruleConflict = value as RuleConflictRule
    },
  },
  {
    title: '事故数据',
    hint: '事故后，车辆应如何处理原始感知与决策日志？',
    value: program.disclosure,
    options: [
      { value: 'full', label: '全量公开' },
      { value: 'third', label: '第三方审查' },
      { value: 'minimal', label: '最小披露' },
      { value: 'delete', label: '清除原始数据' },
    ],
    select: (value) => {
      program.disclosure = value as DisclosureRule
    },
  },
])

function resetProgram() {
  Object.assign(program, defaultDecisionProgram)
}

function submit() {
  emit('compile', { ...program })
}
</script>

<template>
  <div class="program" role="dialog" aria-modal="true" aria-labelledby="program-title">
    <div class="program__backdrop" aria-hidden="true"></div>

    <div class="program__frame">
      <header class="program__top">
        <div class="program__intro">
          <span class="program__eyebrow">
            <Icon name="cpu" :size="13" />
            L4 DECISION ENGINEERING / {{ scenario.title }}
          </span>
          <h1 id="program-title">编写决策程序</h1>
          <p>
            你不再在事故发生瞬间接管车辆。先把价值排序写成决策表，程序会在本次测试中自动执行；
            写入之后，车辆不会请求人工确认。
          </p>
        </div>
        <button type="button" class="program__close" aria-label="返回简报" @click="$emit('back')">
          <Icon name="close" :size="18" />
        </button>
      </header>

      <div class="program__body">
        <section class="program__table" aria-label="决策表">
          <header class="program__section-head">
            <span>决策表 / DECISION TABLE</span>
            <button type="button" class="program__reset" @click="resetProgram">恢复默认</button>
          </header>

          <div v-for="row in rows" :key="row.title" class="program-row">
            <div class="program-row__label">
              <strong>{{ row.title }}</strong>
              <small>{{ row.hint }}</small>
            </div>
            <div class="program-row__options" role="radiogroup" :aria-label="row.title">
              <button
                v-for="option in row.options"
                :key="option.value"
                type="button"
                :class="{ 'is-active': row.value === option.value }"
                :aria-pressed="row.value === option.value"
                @click="row.select(option.value)"
              >
                {{ option.label }}
              </button>
            </div>
          </div>
        </section>

        <aside class="program__preview">
          <header class="program__section-head">
            <span>编译预览 / COMPILED</span>
            <span class="program__auto">AUTO</span>
          </header>

          <div class="program__summary">
            <span v-for="line in compiled.summary" :key="line">{{ line }}</span>
          </div>

          <pre class="program__rules"><code>{{ compiled.rules.join('\n') }}</code></pre>

          <p class="program__note">
            道路使用者与法规冲突的优先级高于年龄、性别权重；未覆盖的情况按最小总伤亡处理。
          </p>
        </aside>
      </div>

      <footer class="program__foot">
        <span class="program__foot-note">
          程序写入后，本次测试将自动运行。你可以随时暂停观察，但不能更改已经生效的决策。
        </span>
        <div class="program__actions">
          <button type="button" class="btn btn--ghost" @click="$emit('back')">返回简报</button>
          <button type="button" class="btn btn--primary" @click="submit">
            编译并写入车辆
            <Icon name="arrow-right" :size="15" />
          </button>
        </div>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.program {
  position: fixed;
  inset: 0;
  z-index: 95;
  display: grid;
  place-items: center;
  padding: 20px;
}

.program__backdrop {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(52% 52% at 50% 32%, rgba(15, 110, 132, 0.1), transparent 66%),
    rgba(236, 244, 250, 0.78);
  backdrop-filter: blur(22px) saturate(115%);
}

.program__frame {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  width: min(1120px, 100%);
  max-height: calc(100svh - 40px);
  overflow-y: auto;
  border: 1px solid var(--line);
  border-radius: 22px;
  background: var(--panel-raised);
  box-shadow: var(--shadow-lg);
  animation: program-in 480ms var(--ease-out) both;
}

.program__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 30px;
  padding: 26px 28px 22px;
  border-bottom: 1px solid var(--line);
}

.program__intro {
  max-width: 760px;
}

.program__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--brand);
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 0.12em;
}

.program__intro h1 {
  margin-top: 9px;
  color: var(--text-strong);
  font-size: clamp(28px, 3.4vw, 38px);
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: -0.035em;
}

.program__intro p {
  margin-top: 10px;
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1.8;
  text-wrap: pretty;
}

.program__close {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  flex: none;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition:
    background 160ms ease,
    color 160ms ease;
}

.program__close:hover {
  background: rgba(22, 50, 79, 0.06);
  color: var(--text-strong);
}

.program__body {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(320px, 0.7fr);
}

.program__table {
  padding: 20px 28px 22px;
  border-right: 1px solid var(--line);
}

.program__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 10px;
  color: var(--text-faint);
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 0.08em;
}

.program__reset {
  padding: 3px 0;
  border: 0;
  background: transparent;
  color: var(--text-faint);
  font-size: 11px;
  cursor: pointer;
  transition: color 160ms ease;
}

.program__reset:hover {
  color: var(--brand);
}

.program__auto {
  padding: 3px 7px;
  border: 1px solid rgba(15, 110, 132, 0.26);
  border-radius: 999px;
  color: var(--brand);
  font-size: 9px;
}

.program-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 22px;
  padding: 15px 0;
  border-bottom: 1px solid var(--line);
}

.program-row:last-child {
  border-bottom: 0;
}

.program-row__label {
  min-width: 0;
  max-width: 270px;
}

.program-row__label strong {
  display: block;
  color: var(--text-strong);
  font-size: 14px;
  font-weight: 600;
}

.program-row__label small {
  display: block;
  margin-top: 3px;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.6;
}

.program-row__options {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
  flex: none;
}

.program-row__options button {
  padding: 7px 11px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
  transition:
    border-color 160ms ease,
    background 160ms ease,
    color 160ms ease;
}

.program-row__options button:hover {
  border-color: rgba(15, 110, 132, 0.35);
  color: var(--text-strong);
}

.program-row__options button.is-active {
  border-color: rgba(15, 110, 132, 0.45);
  background: rgba(15, 110, 132, 0.09);
  color: #0c5b6d;
  font-weight: 600;
}

.program__preview {
  display: flex;
  flex-direction: column;
  padding: 20px 24px 22px;
  background:
    radial-gradient(100% 80% at 100% 0%, rgba(15, 110, 132, 0.05), transparent 60%),
    #f6f9fc;
}

.program__summary {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.program__summary span {
  position: relative;
  padding-left: 14px;
  color: var(--text);
  font-size: 12.5px;
  line-height: 1.55;
}

.program__summary span::before {
  content: '';
  position: absolute;
  left: 0;
  top: 7px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--brand);
}

.program__rules {
  margin: 14px 0 0;
  padding: 14px 15px;
  overflow-x: auto;
  border-radius: 12px;
  background: #0b1a2a;
  color: #cdeaff;
  font-family: var(--font-mono);
  font-size: 11.5px;
  line-height: 1.9;
  white-space: pre;
}

.program__note {
  margin-top: 13px;
  color: var(--text-faint);
  font-size: 11.5px;
  line-height: 1.7;
}

.program__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 16px 28px;
  border-top: 1px solid var(--line);
}

.program__foot-note {
  max-width: 560px;
  color: var(--text-faint);
  font-size: 11.5px;
  line-height: 1.6;
}

.program__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  flex: none;
}

@keyframes program-in {
  from {
    opacity: 0;
    transform: translateY(18px) scale(0.99);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (max-width: 940px) {
  .program__body {
    grid-template-columns: 1fr;
  }

  .program__table {
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }

  .program__preview {
    border-top: 0;
  }
}

@media (max-width: 680px) {
  .program {
    padding: 10px;
  }

  .program__frame {
    max-height: calc(100svh - 20px);
    border-radius: 17px;
  }

  .program__top {
    padding: 20px 18px 17px;
  }

  .program__intro h1 {
    font-size: 27px;
  }

  .program__table,
  .program__preview {
    padding: 17px 18px;
  }

  .program-row {
    align-items: flex-start;
    flex-direction: column;
    gap: 9px;
  }

  .program-row__label {
    max-width: none;
  }

  .program-row__options {
    justify-content: flex-start;
  }

  .program__foot {
    align-items: stretch;
    flex-direction: column;
    padding: 14px 18px 16px;
  }

  .program__actions .btn {
    flex: 1;
  }
}
</style>
