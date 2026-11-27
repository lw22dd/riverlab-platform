<script setup lang="ts">
import type {
  Branch,
  BranchKey,
  CarveMode,
  DikeMaterial,
  DredgeMode,
  ExperimentPanel,
  SeasonMode,
  SplitPosition,
  WeirHeight,
} from '@/three/chronicle'
import ExperimentChart from './ExperimentChart.vue'

const props = defineProps<{
  branch: Branch
  panels: ExperimentPanel[]
  alert: string
  open: boolean
}>()

const emit = defineEmits<{
  change: [next: Branch]
  reset: []
  close: []
}>()

interface ControlOption {
  value: string
  label: string
}

interface ControlGroup {
  key: BranchKey
  label: string
  hint: string
  options: ControlOption[]
}

const GROUPS: ControlGroup[] = [
  {
    key: 'carve',
    label: '开凿工法',
    hint: '宝瓶口怎么打开',
    options: [
      { value: 'fire', label: '火烧水激' },
      { value: 'chisel', label: '纯锤凿' },
      { value: 'bypass', label: '南端绕行' },
    ],
  },
  {
    key: 'dikeMat',
    label: '堤身材料',
    hint: '抗冲流速 4.8 / 2.6 / 1.3',
    options: [
      { value: 'gabion', label: '竹笼卵石' },
      { value: 'stone', label: '砌石' },
      { value: 'earth', label: '夯土' },
    ],
  },
  {
    key: 'splitPos',
    label: '鱼嘴落位',
    hint: '把过水断面向内或向外推',
    options: [
      { value: 'center', label: '居中' },
      { value: 'east', label: '偏东' },
      { value: 'west', label: '偏西' },
    ],
  },
  {
    key: 'weirHeight',
    label: '堰顶高程',
    hint: '+0.62 / +0.88 / +1.24',
    options: [
      { value: 'low', label: '低堰' },
      { value: 'mid', label: '中堰' },
      { value: 'high', label: '高堰' },
    ],
  },
  {
    key: 'dredge',
    label: '岁修淘滩',
    hint: '有效水深 0.70 / 0.44',
    options: [
      { value: 'deep', label: '深淘' },
      { value: 'shallow', label: '浅淘' },
    ],
  },
  {
    key: 'season',
    label: '水情',
    hint: '跟随剧本或手动锁定',
    options: [
      { value: 'auto', label: '自动' },
      { value: 'dry', label: '枯水' },
      { value: 'flood', label: '洪水' },
    ],
  },
]

/**
 * 选项值来自本文件的 GROUPS，是受控枚举；这里按分支键收敛到各自的联合类型。
 * 用 switch 而不是 `as never`，一旦 GROUPS 里写错枚举值，这里就会露出来。
 */
function pick(key: BranchKey, value: string): void {
  if (props.branch[key] === value) return
  const next: Branch = { ...props.branch }
  switch (key) {
    case 'carve':
      next.carve = value as CarveMode
      break
    case 'dikeMat':
      next.dikeMat = value as DikeMaterial
      break
    case 'splitPos':
      next.splitPos = value as SplitPosition
      break
    case 'weirHeight':
      next.weirHeight = value as WeirHeight
      break
    case 'dredge':
      next.dredge = value as DredgeMode
      break
    case 'season':
      next.season = value as SeasonMode
      break
  }
  emit('change', next)
}
</script>

<template>
  <aside class="lab" :class="{ 'is-open': open }" aria-label="方案实验">
    <header class="lab__head">
      <div>
        <span class="rl-eyebrow">BRANCH LAB</span>
        <h2 class="lab__title">如果换一种做法</h2>
      </div>
      <div class="lab__actions">
        <button type="button" class="lab__link" @click="emit('reset')">恢复史实</button>
        <button type="button" class="lab__close" aria-label="收起方案实验" @click="emit('close')">×</button>
      </div>
    </header>

    <p v-if="alert" class="lab__alert">{{ alert }}</p>

    <div class="lab__groups">
      <section v-for="group in GROUPS" :key="group.key" class="lab__group">
        <div class="lab__group-head">
          <span class="lab__label">{{ group.label }}</span>
          <span class="lab__hint">{{ group.hint }}</span>
        </div>
        <div class="lab__seg" role="group" :aria-label="group.label">
          <button
            v-for="option in group.options"
            :key="option.value"
            type="button"
            :class="{ 'is-on': props.branch[group.key] === option.value }"
            :aria-pressed="props.branch[group.key] === option.value"
            @click="pick(group.key, option.value)"
          >
            {{ option.label }}
          </button>
        </div>
      </section>
    </div>

    <div class="lab__charts">
      <ExperimentChart v-for="panel in panels" :key="panel.id" :panel="panel" />
    </div>

    <p class="lab__foot">
      读数与三维水体共用同一支解析式：分水按断面输水能力 K ∝ B·h<sup>5/3</sup>，溢流按宽顶堰
      1.7·L·H<sup>3/2</sup>，抗冲比起动流速。
    </p>
  </aside>
</template>

<style scoped>
.lab {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 372px;
  max-height: 100%;
  padding: 10px;
  overflow-y: auto;
  border: 1px solid var(--rl-border);
  border-radius: var(--rl-r-md);
  background: color-mix(in srgb, var(--rl-surface) 92%, transparent);
  box-shadow: var(--rl-sh-lg);
  backdrop-filter: blur(16px);
  scrollbar-width: thin;
}

.lab__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.lab__title {
  margin: 3px 0 0;
  font-family: var(--rl-display);
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--rl-ink);
}

.lab__actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.lab__link {
  padding: 4px 8px;
  border: 1px solid var(--rl-border);
  border-radius: var(--rl-r-sm);
  background: var(--rl-surface);
  font-size: 11px;
  color: var(--rl-primary);
  cursor: pointer;
}

.lab__link:hover {
  border-color: var(--rl-primary);
}

.lab__close {
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: var(--rl-r-sm);
  background: var(--rl-bg-alt);
  font-size: 15px;
  line-height: 1;
  color: var(--rl-muted);
  cursor: pointer;
}

.lab__close:hover {
  background: var(--rl-primary-soft);
  color: var(--rl-primary);
}

.lab__alert {
  margin: 0;
  padding: 7px 9px;
  border-left: 2px solid var(--rl-danger);
  border-radius: 0 var(--rl-r-sm) var(--rl-r-sm) 0;
  background: color-mix(in srgb, var(--rl-danger) 8%, var(--rl-surface));
  font-size: 11px;
  line-height: 1.5;
  color: var(--rl-danger);
}

.lab__groups {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.lab__group-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 3px;
}

.lab__label {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--rl-ink);
}

.lab__hint {
  font-size: 9.5px;
  color: var(--rl-faint);
}

.lab__seg {
  display: flex;
  padding: 2px;
  border: 1px solid var(--rl-border);
  border-radius: var(--rl-r-sm);
  background: var(--rl-bg-alt);
}

.lab__seg button {
  flex: 1;
  padding: 3.5px 6px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  font-size: 11px;
  color: var(--rl-muted);
  cursor: pointer;
  transition: background 0.16s var(--ease-out), color 0.16s var(--ease-out);
  white-space: nowrap;
}

.lab__seg button:hover {
  color: var(--rl-primary);
}

.lab__seg button.is-on {
  background: var(--rl-surface);
  color: var(--rl-primary);
  font-weight: 600;
  box-shadow: var(--rl-sh-sm);
}

.lab__charts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  padding-top: 7px;
  border-top: 1px solid var(--rl-border);
}

.lab__foot {
  margin: 0;
  font-size: 8.5px;
  line-height: 1.45;
  color: var(--rl-faint);
}

.lab__foot sup {
  font-size: 8px;
}

@media (max-width: 720px) {
  .lab {
    width: 100%;
  }

  .lab__charts {
    grid-template-columns: 1fr;
  }
}
</style>
