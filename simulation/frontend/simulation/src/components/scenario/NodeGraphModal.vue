<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ScenarioDefinition, SimNode } from '@/models/scenario.model'
import type { SimState } from '@/models/simulation.model'
import Icon from '@/components/common/Icon.vue'

const props = defineProps<{
  scenario: ScenarioDefinition
  state: SimState | null
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const NODE_WIDTH = 190
const NODE_HEIGHT = 56
const LEVEL_GAP = 112
const BRANCH_GAP = 26
const PADDING = 44

interface GraphEdge {
  id: string
  from: string
  to: string
  label: string
  optionId?: string
}

interface GraphNodePosition {
  node: SimNode
  x: number
  y: number
  level: number
}

const selectedId = ref<string | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)
const canvasWrap = ref<HTMLElement | null>(null)

function outgoingEdges(node: SimNode): GraphEdge[] {
  switch (node.type) {
    case 'narrative':
    case 'consequence':
      return [{ id: `${node.id}-next`, from: node.id, to: node.next, label: '继续' }]
    case 'decision':
      return node.options.map((option) => ({
        id: `${node.id}-${option.id}`,
        from: node.id,
        to: option.next,
        label: option.label,
        optionId: option.id,
      }))
    case 'branch':
      return node.cases.map((branchCase, index) => ({
        id: `${node.id}-case-${index}`,
        from: node.id,
        to: branchCase.next,
        label: branchCase.note ? `条件分支 ${index + 1}` : '默认分支',
      }))
    case 'end':
      return []
  }
}

const graph = computed(() => {
  const nodes = props.scenario.nodes
  const depths = new Map<string, number>()
  depths.set(props.scenario.startNodeId, 0)

  for (let pass = 0; pass < nodes.length + 2; pass += 1) {
    let changed = false
    for (const node of nodes) {
      const base = depths.get(node.id)
      if (base === undefined) continue
      for (const edge of outgoingEdges(node)) {
        const current = depths.get(edge.to) ?? -1
        if (current < base + 1) {
          depths.set(edge.to, base + 1)
          changed = true
        }
      }
    }
    if (!changed) break
  }

  const order = new Map(nodes.map((node, index) => [node.id, index]))
  const levels = new Map<number, SimNode[]>()
  for (const node of nodes) {
    const level = depths.get(node.id) ?? 0
    const bucket = levels.get(level) ?? []
    bucket.push(node)
    levels.set(level, bucket)
  }

  const maxColumns = Math.max(...[...levels.values()].map((bucket) => bucket.length), 1)
  const graphWidth = Math.max(
    680,
    PADDING * 2 + maxColumns * NODE_WIDTH + (maxColumns - 1) * BRANCH_GAP,
  )
  const positions = new Map<string, GraphNodePosition>()
  const sortedLevels = [...levels.entries()].sort((a, b) => a[0] - b[0])

  for (const [level, bucket] of sortedLevels) {
    bucket.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    const rowWidth = bucket.length * NODE_WIDTH + (bucket.length - 1) * BRANCH_GAP
    const startX = (graphWidth - rowWidth) / 2
    bucket.forEach((node, index) => {
      positions.set(node.id, {
        node,
        x: startX + index * (NODE_WIDTH + BRANCH_GAP),
        y: PADDING + level * LEVEL_GAP,
        level,
      })
    })
  }

  const edges = nodes.flatMap((node) => outgoingEdges(node))
  const maxLevel = Math.max(0, ...depths.values())
  const graphHeight = PADDING * 2 + (maxLevel + 1) * LEVEL_GAP - (LEVEL_GAP - NODE_HEIGHT)

  return {
    positions,
    edges,
    width: graphWidth,
    height: graphHeight,
  }
})

const currentId = computed(() => props.state?.currentNodeId ?? null)
const visited = computed(() => new Set(props.state?.visited ?? []))
const inspected = computed(() => new Set(props.state?.inspected ?? []))

const transitionKeys = computed(() => {
  const keys = new Set<string>()
  for (const transition of props.state?.transitions ?? []) {
    keys.add(`${transition.from ?? ''}>${transition.to}:${transition.optionId ?? ''}`)
  }
  return keys
})

function edgeActive(edge: GraphEdge): boolean {
  return transitionKeys.value.has(`${edge.from}>${edge.to}:${edge.optionId ?? ''}`)
}

function pathFor(from: GraphNodePosition, to: GraphNodePosition): string {
  const x1 = from.x + NODE_WIDTH / 2
  const y1 = from.y + NODE_HEIGHT
  const x2 = to.x + NODE_WIDTH / 2
  const y2 = to.y
  const midY = y1 + (y2 - y1) * 0.48
  return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`
}

const selectedNode = computed(() => {
  const id = selectedId.value ?? currentId.value ?? props.scenario.startNodeId
  return props.scenario.nodes.find((node) => node.id === id) ?? props.scenario.nodes[0]
})

const selectedOutgoing = computed(() => (selectedNode.value ? outgoingEdges(selectedNode.value) : []))

const selectedIncoming = computed(() => {
  if (!selectedNode.value) return []
  return props.scenario.nodes.flatMap((node) =>
    outgoingEdges(node).filter((edge) => edge.to === selectedNode.value?.id),
  )
})

const selectedBody = computed(() => {
  const node = selectedNode.value
  if (!node) return ''
  switch (node.type) {
    case 'narrative':
    case 'consequence':
      return node.text
    case 'decision':
      return node.prompt
    case 'branch':
      return node.cases.map((branchCase, index) => `${index + 1}. ${branchCase.note ?? branchCase.next}`).join('\n')
    case 'end':
      return node.summary ?? '推演在此结算。'
  }
})

function nodeTypeLabel(node: SimNode | undefined): string {
  if (!node) return ''
  switch (node.type) {
    case 'narrative':
      return 'NARRATIVE'
    case 'decision':
      return 'DECISION'
    case 'consequence':
      return 'CONSEQUENCE'
    case 'branch':
      return 'BRANCH'
    case 'end':
      return 'END'
  }
}

function nodeTitle(id: string): string {
  return props.scenario.nodes.find((node) => node.id === id)?.title ?? id
}

function truncate(value: string, max = 13): string {
  return value.length > max ? `${value.slice(0, max)}…` : value
}

function edgeLabelVisible(edge: GraphEdge): boolean {
  return edgeActive(edge) || edge.from === selectedId.value || edge.from === currentId.value
}

function labelPosition(from: GraphNodePosition, to: GraphNodePosition): { x: number; y: number } {
  return {
    x: (from.x + to.x) / 2 + NODE_WIDTH / 2,
    y: (from.y + NODE_HEIGHT + to.y) / 2,
  }
}

function edgePositions(edge: GraphEdge) {
  const from = graph.value.positions.get(edge.from)
  const to = graph.value.positions.get(edge.to)
  if (!from || !to) return null
  return {
    from,
    to,
    path: pathFor(from, to),
    label: labelPosition(from, to),
  }
}

watch(
  () => [props.visible, currentId.value] as const,
  ([visible, current]) => {
    if (visible) {
      selectedId.value = current ?? props.scenario.startNodeId
    }
  },
  { immediate: true },
)

function requestClose() {
  emit('close')
}

function onKeydown(event: KeyboardEvent) {
  if (props.visible && event.key === 'Escape') {
    event.preventDefault()
    requestClose()
  }
}

let previousOverflow = ''

watch(
  () => props.visible,
  async (visible) => {
    if (typeof document === 'undefined') return
    if (visible) {
      previousOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      await nextTick()
      closeButton.value?.focus()
      const position = graph.value.positions.get(currentId.value ?? props.scenario.startNodeId)
      if (position && canvasWrap.value) {
        canvasWrap.value.scrollTo({
          top: Math.max(0, position.y - canvasWrap.value.clientHeight * 0.28),
          behavior: 'smooth',
        })
      }
    } else {
      document.body.style.overflow = previousOverflow
    }
  },
)

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  if (typeof document !== 'undefined') document.body.style.overflow = previousOverflow
})
</script>

<template>
  <Teleport to="body">
    <Transition name="graph-fade">
      <div v-if="visible" class="graph-modal" role="dialog" aria-modal="true" aria-labelledby="graph-title">
        <div class="graph-modal__backdrop" @click="requestClose"></div>

        <div class="graph-modal__card">
          <header class="graph-modal__head">
            <div>
              <span class="graph-modal__kicker">NODE GRAPH / INTERPRETER TRACE</span>
              <h2 id="graph-title">推演图谱 <span>{{ scenario.title }}</span></h2>
            </div>
            <div class="graph-modal__head-stats">
              <span>{{ visited.size }} / {{ scenario.nodes.length }} 节点</span>
              <span>{{ state?.transitions.length ?? 0 }} 次迁移</span>
              <span>{{ inspected.size }} 项勘查</span>
            </div>
            <button ref="closeButton" type="button" class="graph-modal__close" aria-label="关闭图谱" @click="requestClose">
              <Icon name="close" :size="17" />
            </button>
          </header>

          <div class="graph-modal__body">
            <div ref="canvasWrap" class="graph-modal__canvas-wrap">
              <div class="graph-modal__canvas" :style="{ width: `${graph.width}px`, height: `${graph.height}px` }">
                <svg
                  :viewBox="`0 0 ${graph.width} ${graph.height}`"
                  :width="graph.width"
                  :height="graph.height"
                  class="graph-svg"
                >
                  <defs>
                    <marker id="graph-arrow" viewBox="0 0 8 8" refX="6.2" refY="4" markerWidth="5" markerHeight="5" orient="auto">
                      <path d="M0,0 L8,4 L0,8 z" fill="rgba(20,36,46,.38)" />
                    </marker>
                    <marker id="graph-arrow-active" viewBox="0 0 8 8" refX="6.2" refY="4" markerWidth="5" markerHeight="5" orient="auto">
                      <path d="M0,0 L8,4 L0,8 z" fill="#0f6e84" />
                    </marker>
                  </defs>

                  <g class="graph-edges">
                    <template v-for="edge in graph.edges" :key="edge.id">
                      <template v-if="edgePositions(edge)">
                        <path
                          :d="edgePositions(edge)?.path"
                          class="graph-edge"
                          :class="{
                            'is-active': edgeActive(edge),
                            'is-outgoing': edge.from === selectedId,
                          }"
                          :marker-end="edgeActive(edge) ? 'url(#graph-arrow-active)' : 'url(#graph-arrow)'"
                        />
                        <text
                          v-if="edgeLabelVisible(edge)"
                          :x="edgePositions(edge)?.label.x"
                          :y="edgePositions(edge)?.label.y"
                          class="graph-edge-label"
                          :class="{ 'is-active': edgeActive(edge) }"
                          text-anchor="middle"
                        >
                          {{ truncate(edge.label, 11) }}
                        </text>
                      </template>
                    </template>
                  </g>

                  <g class="graph-nodes">
                    <g
                      v-for="position in graph.positions.values()"
                      :key="position.node.id"
                      class="graph-node"
                      :class="[
                        `graph-node--${position.node.type}`,
                        {
                          'is-current': position.node.id === currentId,
                          'is-visited': visited.has(position.node.id),
                          'is-selected': position.node.id === selectedId,
                        },
                      ]"
                      role="button"
                      tabindex="0"
                      @click="selectedId = position.node.id"
                      @keydown.enter="selectedId = position.node.id"
                    >
                      <rect
                        :x="position.x"
                        :y="position.y"
                        :width="NODE_WIDTH"
                        :height="NODE_HEIGHT"
                        rx="10"
                        class="graph-node__bg"
                      />
                      <rect
                        :x="position.x"
                        :y="position.y + 10"
                        width="2.5"
                        :height="NODE_HEIGHT - 20"
                        rx="1.25"
                        class="graph-node__bar"
                      />
                      <text :x="position.x + 15" :y="position.y + 20" class="graph-node__type">
                        {{ nodeTypeLabel(position.node) }}
                      </text>
                      <text :x="position.x + 15" :y="position.y + 39" class="graph-node__title">
                        {{ truncate(position.node.title, 13) }}
                      </text>
                      <circle
                        v-if="position.node.id === currentId"
                        :cx="position.x + NODE_WIDTH - 14"
                        :cy="position.y + 14"
                        r="3"
                        class="graph-node__current"
                      />
                      <text
                        v-if="visited.has(position.node.id)"
                        :x="position.x + NODE_WIDTH - 14"
                        :y="position.y + NODE_HEIGHT - 11"
                        text-anchor="end"
                        class="graph-node__visited"
                      >
                        VISITED
                      </text>
                    </g>
                  </g>
                </svg>
              </div>
            </div>

            <aside class="graph-detail">
              <div class="graph-detail__head">
                <span class="graph-detail__type">{{ nodeTypeLabel(selectedNode) }}</span>
                <span v-if="selectedNode?.id === currentId" class="graph-detail__current">
                  <i></i> CURRENT
                </span>
              </div>
              <h3>{{ selectedNode?.title }}</h3>
              <span class="graph-detail__id">{{ selectedNode?.id }}</span>
              <p class="graph-detail__body">{{ selectedBody }}</p>

              <div v-if="selectedNode?.type === 'decision'" class="graph-detail__meta">
                <span>超时默认</span>
                <strong>{{ selectedNode.timeoutOptionId ?? '—' }}</strong>
              </div>

              <div v-if="selectedNode?.type === 'decision'" class="graph-detail__section">
                <span class="mono-label">OPTIONS</span>
                <div class="graph-detail__option-list">
                  <span v-for="option in selectedNode.options" :key="option.id">
                    <em>{{ option.id }}</em>
                    {{ option.label }}
                  </span>
                </div>
              </div>

              <div class="graph-detail__section">
                <span class="mono-label">OUTGOING / {{ selectedOutgoing.length }}</span>
                <div class="graph-detail__edges">
                  <span v-for="edge in selectedOutgoing" :key="edge.id">
                    <Icon name="chevron-right" :size="10" />
                    {{ truncate(edge.label, 22) }}
                    <em>→ {{ nodeTitle(edge.to) }}</em>
                  </span>
                </div>
              </div>

              <div class="graph-detail__section">
                <span class="mono-label">INCOMING / {{ selectedIncoming.length }}</span>
                <div class="graph-detail__edges">
                  <span v-for="edge in selectedIncoming" :key="edge.id">
                    <Icon name="arrow-left" :size="10" />
                    {{ nodeTitle(edge.from) }}
                  </span>
                </div>
              </div>

              <div class="graph-detail__foot">
                <span>Node {{ selectedNode?.id }}</span>
                <span>{{ selectedOutgoing.length }} 条出边</span>
              </div>
            </aside>
          </div>

          <footer class="graph-modal__foot">
            <div class="graph-legend">
              <span><i class="legend-dot legend-dot--narrative"></i>叙事</span>
              <span><i class="legend-dot legend-dot--decision"></i>决策</span>
              <span><i class="legend-dot legend-dot--consequence"></i>后果</span>
              <span><i class="legend-dot legend-dot--branch"></i>条件分支</span>
              <span><i class="legend-dot legend-dot--end"></i>结束</span>
            </div>
            <div class="graph-modal__foot-hint">
              <span><i class="legend-line is-active"></i>已走过的边</span>
              <span><i class="legend-line"></i>未触发的边</span>
              <span><Icon name="info" :size="11" /> 评分规则不在图中暴露</span>
            </div>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.graph-modal {
  position: fixed;
  inset: 0;
  z-index: 95;
  display: grid;
  place-items: center;
  padding: 18px;
}

.graph-modal__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(236, 244, 250, 0.72);
  backdrop-filter: blur(18px) saturate(115%);
}

.graph-modal__card {
  position: relative;
  z-index: 1;
  width: min(1240px, 100%);
  height: min(880px, calc(100svh - 36px));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 22px;
  background:
    radial-gradient(90% 70% at 100% 0%, rgba(var(--brand-rgb), 0.035), transparent 55%),
    var(--panel-raised);
  box-shadow: var(--shadow-lg);
  color: var(--text);
}

.graph-modal__head {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 18px 22px;
  border-bottom: 1px solid var(--line);
}

.graph-modal__kicker {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.16em;
  color: var(--brand);
}

.graph-modal__head h2 {
  margin-top: 4px;
  font-size: 22px;
  font-weight: 550;
  letter-spacing: -0.02em;
  color: var(--text-strong);
}

.graph-modal__head h2 span {
  margin-left: 7px;
  font-size: 13px;
  font-weight: 400;
  color: var(--text-faint);
}

.graph-modal__head-stats {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.graph-modal__head-stats span {
  padding: 4px 8px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.72);
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--text-muted);
}

.graph-modal__close {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  flex: none;
  margin-left: auto;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.graph-modal__close:hover {
  background: rgba(22, 50, 79, 0.06);
  color: var(--text-strong);
}

.graph-modal__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 318px;
  min-height: 0;
  flex: 1;
}

.graph-modal__canvas-wrap {
  min-width: 0;
  min-height: 0;
  overflow: auto;
  background:
    radial-gradient(60% 50% at 52% 18%, rgba(var(--brand-rgb), 0.05), transparent 70%),
    linear-gradient(rgba(22, 50, 79, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(22, 50, 79, 0.045) 1px, transparent 1px),
    var(--bg-soft);
  background-size: auto, 28px 28px, 28px 28px, auto;
}

.graph-modal__canvas {
  position: relative;
  margin: 0 auto;
}

.graph-svg {
  display: block;
  overflow: visible;
}

.graph-edge {
  fill: none;
  stroke: rgba(22, 50, 79, 0.28);
  stroke-width: 1.1;
  stroke-dasharray: 3 5;
}

.graph-edge.is-outgoing {
  stroke: rgba(169, 118, 26, 0.38);
}

.graph-edge.is-active {
  stroke: var(--brand);
  stroke-width: 1.5;
  stroke-dasharray: none;
  filter: drop-shadow(0 0 3px rgba(15, 110, 132, 0.2));
}

.graph-edge-label {
  fill: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.02em;
  stroke: var(--bg-soft);
  stroke-width: 3;
  paint-order: stroke;
}

.graph-edge-label.is-active {
  fill: var(--brand);
}

.graph-node {
  cursor: pointer;
  outline: none;
}

.graph-node__bg {
  fill: var(--panel-solid);
  stroke: var(--line-strong);
  stroke-width: 1;
  transition:
    stroke 160ms ease,
    fill 160ms ease;
}

.graph-node:hover .graph-node__bg {
  fill: var(--bg-soft);
  stroke: var(--line-bright);
}

.graph-node__bar {
  fill: rgba(22, 50, 79, 0.35);
}

.graph-node__type {
  fill: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.09em;
}

.graph-node__title {
  fill: var(--text-strong);
  font-family: var(--font-sans);
  font-size: 12.5px;
  font-weight: 500;
}

.graph-node__current {
  fill: var(--brand);
  animation: graph-pulse 1.8s ease-in-out infinite;
}

.graph-node__visited {
  fill: var(--brand);
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.08em;
}

.graph-node--decision .graph-node__bar {
  fill: var(--warn);
}

.graph-node--consequence .graph-node__bar {
  fill: var(--danger);
}

.graph-node--branch .graph-node__bar {
  fill: #4e9a8e;
}

.graph-node--end .graph-node__bar {
  fill: var(--success);
}

.graph-node.is-visited .graph-node__bg {
  stroke: rgba(15, 110, 132, 0.28);
}

.graph-node.is-current .graph-node__bg {
  stroke: var(--brand);
  stroke-width: 1.4;
  fill: rgba(var(--brand-rgb), 0.07);
}

.graph-node.is-selected .graph-node__bg {
  stroke: rgba(169, 118, 26, 0.65);
  stroke-width: 1.4;
}

.graph-node.is-current.is-selected .graph-node__bg {
  stroke: var(--brand);
}

.graph-detail {
  min-height: 0;
  overflow-y: auto;
  padding: 20px;
  border-left: 1px solid var(--line);
  background: rgba(237, 244, 250, 0.66);
}

.graph-detail__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.graph-detail__type {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.14em;
  color: var(--warn);
}

.graph-detail__current {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--brand);
}

.graph-detail__current i {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--brand);
  box-shadow: 0 0 6px var(--brand);
}

.graph-detail h3 {
  margin-top: 9px;
  font-size: 19px;
  font-weight: 550;
  letter-spacing: -0.02em;
  color: var(--text-strong);
}

.graph-detail__id {
  display: inline-block;
  margin-top: 5px;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-faint);
}

.graph-detail__body {
  max-height: 160px;
  margin-top: 13px;
  overflow-y: auto;
  padding-right: 4px;
  font-size: 12.5px;
  line-height: 1.72;
  color: var(--text-muted);
  white-space: pre-line;
}

.graph-detail__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 14px;
  padding: 9px 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.72);
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
}

.graph-detail__meta strong {
  font-size: 11px;
  font-weight: 400;
  color: var(--warn);
}

.graph-detail__section {
  margin-top: 17px;
  padding-top: 13px;
  border-top: 1px solid var(--line);
}

.graph-detail__option-list,
.graph-detail__edges {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 8px;
}

.graph-detail__option-list span {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-muted);
}

.graph-detail__option-list em {
  display: block;
  font-family: var(--font-mono);
  font-size: 10px;
  font-style: normal;
  color: var(--text-muted);
}

.graph-detail__edges span {
  display: flex;
  align-items: baseline;
  gap: 5px;
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--text-muted);
}

.graph-detail__edges span em {
  margin-left: auto;
  font-style: normal;
  font-size: 10.5px;
  color: var(--text-muted);
  text-align: right;
}

.graph-detail__foot {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-top: 20px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-muted);
}

.graph-modal__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 24px;
  padding: 11px 22px;
  border-top: 1px solid var(--line);
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--text-muted);
}

.graph-legend,
.graph-modal__foot-hint {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.graph-legend span,
.graph-modal__foot-hint span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.legend-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--text-faint);
}

.legend-dot--narrative {
  background: rgba(22, 50, 79, 0.45);
}

.legend-dot--decision {
  background: var(--warn);
}

.legend-dot--consequence {
  background: var(--danger);
}

.legend-dot--branch {
  background: #4e9a8e;
}

.legend-dot--end {
  background: var(--success);
}

.legend-line {
  width: 18px;
  height: 1px;
  border-top: 1px dashed rgba(22, 50, 79, 0.3);
}

.legend-line.is-active {
  border-top-style: solid;
  border-color: var(--brand);
}

@keyframes graph-pulse {
  0%,
  100% {
    opacity: 0.55;
  }
  50% {
    opacity: 1;
  }
}

.graph-fade-enter-active,
.graph-fade-leave-active {
  transition: opacity 240ms ease;
}

.graph-fade-enter-active .graph-modal__card,
.graph-fade-leave-active .graph-modal__card {
  transition: transform 300ms var(--ease-out);
}

.graph-fade-enter-from,
.graph-fade-leave-to {
  opacity: 0;
}

.graph-fade-enter-from .graph-modal__card,
.graph-fade-leave-to .graph-modal__card {
  transform: translateY(14px) scale(0.99);
}

@media (max-width: 980px) {
  .graph-modal {
    padding: 8px;
  }

  .graph-modal__card {
    height: calc(100svh - 16px);
    border-radius: 17px;
  }

  .graph-modal__head-stats {
    display: none;
  }

  .graph-modal__body {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(0, 1fr) 238px;
  }

  .graph-detail {
    border-left: 0;
    border-top: 1px solid var(--line);
  }

  .graph-modal__foot-hint {
    display: none;
  }
}

@media (max-width: 600px) {
  .graph-modal__head {
    padding: 13px 15px;
  }

  .graph-modal__head h2 {
    font-size: 18px;
  }

  .graph-modal__head h2 span {
    display: none;
  }

  .graph-modal__foot {
    padding: 9px 15px;
  }

  .graph-legend {
    gap: 8px;
  }

  .graph-detail {
    padding: 15px;
  }
}
</style>
