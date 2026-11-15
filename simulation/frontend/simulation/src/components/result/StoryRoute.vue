<script setup lang="ts">
import { computed, useId } from 'vue'
import type { ScenarioDefinition, SimNode } from '@/models/scenario.model'
import type { SessionRecord } from '@/models/session.model'

const props = defineProps<{
  scenario: ScenarioDefinition
  session: SessionRecord
}>()

const NODE_WIDTH = 132
const NODE_HEIGHT = 50
const COLUMN_GAP = 42
const ROW_GAP = 14
const PADDING = 22

interface RouteEdge {
  id: string
  from: string
  to: string
  label: string
  optionId?: string
}

interface PlacedNode {
  node: SimNode
  x: number
  y: number
  level: number
}

const uid = `route-${useId()}`
const arrowActive = `${uid}-arrow-active`
const arrowMuted = `${uid}-arrow-muted`

function outgoingEdges(node: SimNode): RouteEdge[] {
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
        label: branchCase.note ?? `分支 ${index + 1}`,
      }))
    case 'end':
      return []
  }
}

const layout = computed(() => {
  const nodes = props.scenario.nodes
  const edges = nodes.flatMap(outgoingEdges)
  const depth = new Map<string, number>()
  depth.set(props.scenario.startNodeId, 0)

  for (let pass = 0; pass < nodes.length + 2; pass += 1) {
    let changed = false
    for (const node of nodes) {
      const base = depth.get(node.id)
      if (base === undefined) continue
      for (const edge of outgoingEdges(node)) {
        if ((depth.get(edge.to) ?? -1) < base + 1) {
          depth.set(edge.to, base + 1)
          changed = true
        }
      }
    }
    if (!changed) break
  }

  const parents = new Map<string, string[]>()
  for (const edge of edges) {
    const list = parents.get(edge.to) ?? []
    list.push(edge.from)
    parents.set(edge.to, list)
  }

  const order = new Map(nodes.map((node, index) => [node.id, index]))
  const levels = new Map<number, string[]>()
  for (const node of nodes) {
    const level = depth.get(node.id) ?? 0
    const bucket = levels.get(level) ?? []
    bucket.push(node.id)
    levels.set(level, bucket)
  }

  const maxRows = Math.max(1, ...[...levels.values()].map((bucket) => bucket.length))
  const maxLevel = Math.max(0, ...levels.keys())
  const rowIndexes = new Map<number, Map<string, number>>()
  const positions = new Map<string, PlacedNode>()
  const nodeById = new Map(nodes.map((node) => [node.id, node]))

  for (const [level, bucket] of [...levels.entries()].sort((a, b) => a[0] - b[0])) {
    const previous = rowIndexes.get(level - 1)

    bucket.sort((a, b) => {
      const score = (id: string): number => {
        const parentRows = (parents.get(id) ?? [])
          .map((parent) => previous?.get(parent))
          .filter((row): row is number => row !== undefined)
        return parentRows.length
          ? parentRows.reduce((sum, row) => sum + row, 0) / parentRows.length
          : Number.MAX_SAFE_INTEGER
      }
      return score(a) - score(b) || (order.get(a) ?? 0) - (order.get(b) ?? 0)
    })

    const rows = new Map<string, number>()
    const startY = PADDING + ((maxRows - bucket.length) * (NODE_HEIGHT + ROW_GAP)) / 2

    bucket.forEach((id, index) => {
      const node = nodeById.get(id)
      if (!node) return
      rows.set(id, index)
      positions.set(id, {
        node,
        x: PADDING + level * (NODE_WIDTH + COLUMN_GAP),
        y: startY + index * (NODE_HEIGHT + ROW_GAP),
        level,
      })
    })
    rowIndexes.set(level, rows)
  }

  const width =
    PADDING * 2 + (maxLevel + 1) * NODE_WIDTH + maxLevel * COLUMN_GAP

  return {
    positions,
    edges,
    width,
    height: PADDING * 2 + maxRows * NODE_HEIGHT + (maxRows - 1) * ROW_GAP,
    wide: width > 1120,
  }
})

const placedNodes = computed(() => [...layout.value.positions.values()])

const pathSet = computed(() => new Set(props.session.path))
const pathPairs = computed(() => {
  const pairs = new Set<string>()
  const path = props.session.path
  for (let index = 1; index < path.length; index += 1) {
    pairs.add(`${path[index - 1]}>${path[index]}`)
  }
  return pairs
})
const chosenOptions = computed(
  () => new Map(props.session.decisions.map((decision) => [decision.nodeId, decision.optionId])),
)

function edgeActive(edge: RouteEdge): boolean {
  if (!pathPairs.value.has(`${edge.from}>${edge.to}`)) return false
  const chosen = chosenOptions.value.get(edge.from)
  return !chosen || !edge.optionId || chosen === edge.optionId
}

function nodeActive(node: SimNode): boolean {
  return pathSet.value.has(node.id)
}

function edgePath(edge: RouteEdge): string {
  const from = layout.value.positions.get(edge.from)
  const to = layout.value.positions.get(edge.to)
  if (!from || !to) return ''
  const x1 = from.x + NODE_WIDTH
  const y1 = from.y + NODE_HEIGHT / 2
  const x2 = to.x
  const y2 = to.y + NODE_HEIGHT / 2
  const midX = x1 + (x2 - x1) / 2
  return `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`
}

function nodeTypeLabel(node: SimNode): string {
  switch (node.type) {
    case 'narrative':
      return '剧情'
    case 'decision':
      return '决策'
    case 'consequence':
      return '后果'
    case 'branch':
      return '分支'
    case 'end':
      return '结局'
  }
}

function truncate(value: string, max = 8): string {
  return value.length > max ? `${value.slice(0, max)}…` : value
}
</script>

<template>
  <section class="story-route" aria-labelledby="story-route-title">
    <header class="story-route__head">
      <div>
        <span class="story-route__eyebrow">STORY ROUTE</span>
        <h2 id="story-route-title">故事路线</h2>
        <p>从左到右是完整剧情图谱，高亮部分为本次实际走过的路线。</p>
      </div>
      <div class="story-route__legend" aria-hidden="true">
        <span><i class="is-active"></i>你的路线</span>
        <span><i></i>其他分支</span>
      </div>
    </header>

    <div class="story-route__scroll">
      <svg
        class="story-route__canvas"
        :viewBox="`0 0 ${layout.width} ${layout.height}`"
        :style="{ width: `${layout.width}px`, height: `${layout.height}px` }"
        role="img"
        aria-label="实验故事路线图，高亮为本次选择的路径"
      >
        <defs>
          <marker
            :id="arrowActive"
            viewBox="0 0 8 8"
            refX="6.4"
            refY="4"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M0 0 L8 4 L0 8 Z" class="story-route__arrow story-route__arrow--active" />
          </marker>
          <marker
            :id="arrowMuted"
            viewBox="0 0 8 8"
            refX="6.4"
            refY="4"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M0 0 L8 4 L0 8 Z" class="story-route__arrow" />
          </marker>
        </defs>

        <g class="story-route__edges">
          <path
            v-for="edge in layout.edges"
            :key="edge.id"
            :d="edgePath(edge)"
            class="story-route__edge"
            :class="{ 'is-active': edgeActive(edge) }"
            :marker-end="`url(#${edgeActive(edge) ? arrowActive : arrowMuted})`"
          />
        </g>

        <g class="story-route__nodes">
          <g
            v-for="placed in placedNodes"
            :key="placed.node.id"
            class="story-route__node"
            :class="{ 'is-active': nodeActive(placed.node), 'is-end': placed.node.type === 'end' }"
            :transform="`translate(${placed.x} ${placed.y})`"
          >
            <rect :width="NODE_WIDTH" :height="NODE_HEIGHT" rx="9" class="story-route__node-bg" />
            <rect width="3" :height="NODE_HEIGHT" rx="1.5" class="story-route__node-bar" />
            <text x="14" y="19" class="story-route__node-type">
              {{ nodeTypeLabel(placed.node) }}
            </text>
            <text x="14" y="37" class="story-route__node-title">
              {{ truncate(placed.node.title) }}
            </text>
            <circle
              v-if="nodeActive(placed.node)"
              cx="118"
              cy="14"
              r="3"
              class="story-route__node-dot"
            />
          </g>
        </g>
      </svg>
    </div>

    <p v-if="layout.wide" class="story-route__hint">图谱较宽，可左右拖动查看完整路线。</p>

    <div v-if="session.decisions.length" class="story-route__decisions">
      <span class="story-route__decisions-label">{{ session.program?.length ? '程序选择' : '你的选择' }}</span>
      <ol>
        <li v-for="(decision, index) in session.decisions" :key="`${decision.nodeId}-${index}`">
          <em>{{ index + 1 }}</em>
          {{ decision.label }}
          <span v-if="decision.timedOut">（超时默认）</span>
        </li>
      </ol>
    </div>

    <div v-if="session.program?.length" class="story-route__program">
      <span class="story-route__decisions-label">程序规则</span>
      <ul>
        <li v-for="line in session.program" :key="line">{{ line }}</li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.story-route {
  padding: 22px 24px 20px;
  border: 1px solid var(--line);
  border-radius: 20px;
  background: var(--panel-raised);
  box-shadow: var(--shadow-sm);
}

.story-route__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--line);
}

.story-route__eyebrow {
  color: var(--text-faint);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
}

.story-route__head h2 {
  margin-top: 5px;
  color: var(--text-strong);
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.story-route__head p {
  margin-top: 6px;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.7;
}

.story-route__legend {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: none;
  color: var(--text-muted);
  font-size: 11.5px;
}

.story-route__legend span {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.story-route__legend i {
  display: block;
  width: 20px;
  height: 2px;
  border-radius: 999px;
  background: repeating-linear-gradient(
    90deg,
    rgba(22, 50, 79, 0.22) 0 4px,
    transparent 4px 7px
  );
}

.story-route__legend i.is-active {
  background: var(--accent, var(--brand));
}

.story-route__scroll {
  overflow-x: auto;
  overflow-y: hidden;
  margin-top: 16px;
  padding-bottom: 6px;
  scrollbar-width: thin;
}

.story-route__canvas {
  display: block;
  max-width: none;
}

.story-route__arrow {
  fill: rgba(22, 50, 79, 0.18);
}

.story-route__arrow--active {
  fill: var(--accent, var(--brand));
}

.story-route__edge {
  fill: none;
  stroke: rgba(22, 50, 79, 0.15);
  stroke-width: 1.2;
  stroke-dasharray: 3 4;
}

.story-route__edge.is-active {
  stroke: var(--accent, var(--brand));
  stroke-width: 2;
  stroke-dasharray: none;
}

.story-route__node {
  opacity: 0.42;
}

.story-route__node.is-active {
  opacity: 1;
}

.story-route__node-bg {
  fill: #f7fafc;
  stroke: rgba(22, 50, 79, 0.1);
  stroke-width: 1;
}

.story-route__node.is-active .story-route__node-bg {
  fill: rgba(var(--accent-rgb, var(--brand-rgb)), 0.07);
  stroke: rgba(var(--accent-rgb, var(--brand-rgb)), 0.45);
}

.story-route__node-bar {
  fill: rgba(22, 50, 79, 0.18);
}

.story-route__node.is-active .story-route__node-bar {
  fill: var(--accent, var(--brand));
}

.story-route__node-type {
  fill: var(--text-faint);
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.04em;
}

.story-route__node.is-active .story-route__node-type {
  fill: var(--accent, var(--brand));
}

.story-route__node-title {
  fill: var(--text-muted);
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 550;
}

.story-route__node.is-active .story-route__node-title {
  fill: var(--text-strong);
}

.story-route__node-dot {
  fill: var(--accent, var(--brand));
}

.story-route__hint {
  margin-top: 4px;
  color: var(--text-faint);
  font-size: 11px;
}

.story-route__decisions {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin-top: 16px;
  padding-top: 15px;
  border-top: 1px solid var(--line);
}

.story-route__decisions-label {
  flex: none;
  padding-top: 2px;
  color: var(--text-faint);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.1em;
}

.story-route__decisions ol {
  display: flex;
  flex-wrap: wrap;
  gap: 7px 18px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.story-route__decisions li {
  display: inline-flex;
  align-items: baseline;
  gap: 7px;
  color: var(--text);
  font-size: 12.5px;
}

.story-route__decisions li em {
  display: grid;
  place-items: center;
  width: 17px;
  height: 17px;
  flex: none;
  border-radius: 50%;
  background: rgba(var(--accent-rgb, var(--brand-rgb)), 0.1);
  color: var(--accent, var(--brand));
  font-family: var(--font-mono);
  font-size: 9.5px;
  font-style: normal;
}

.story-route__decisions li span {
  color: var(--warn);
  font-size: 11px;
}

.story-route__program {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
}

.story-route__program ul {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.story-route__program li {
  position: relative;
  padding-left: 12px;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.55;
}

.story-route__program li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 6px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--accent, var(--brand));
}

@media (max-width: 760px) {
  .story-route {
    padding: 18px 16px;
  }

  .story-route__head {
    align-items: flex-start;
    flex-direction: column;
    gap: 12px;
  }

  .story-route__decisions {
    flex-direction: column;
    gap: 8px;
  }

  .story-route__program {
    flex-direction: column;
    gap: 8px;
  }
}
</style>
