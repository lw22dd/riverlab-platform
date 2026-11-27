<script setup lang="ts">
import { computed } from 'vue'
import type { ChronicleLedger } from '@/three/chronicle'
import { TOTAL_SEC } from '@/three/chronicle'

const props = defineProps<{
  ledger: ChronicleLedger
  open: boolean
}>()

const emit = defineEmits<{ close: [] }>()

interface BriefPart {
  name: string
  size: string
  build: string
  inst: string
  hook: string
}

const PARTS: BriefPart[] = [
  {
    name: '竹笼（卵石填心）',
    size: '长 1.42 × 径 0.80（4 道箍，长径比 1.78 : 1）',
    build: '3 层：9 边筒 + 4 道合批环箍 + 两端石簇（≤ 140 面 / 件）',
    inst: '1 个实例池，全局仅 3 Draw Calls',
    hook: '由 +3.2 单位依次垂直落水，远距隐藏端石 LOD',
  },
  {
    name: '截流木架（后称杩槎）',
    size: '高 3.0 × 半径 1.35，竹席 2.3 × 2.1',
    build: '4 组：3 腿 2 横木 + 绳环 + 18° 双面竹席 + 6 块压脚石',
    inst: '3 座（内江修正位 +4.20 / +8.10）',
    hook: '竖架 → 竹席下滑 → 下游退水露凤栖窝基岩标',
  },
  {
    name: '玉垒山嘴（连续山体岩塞）',
    size: '沿峡口 s 1.05 → 8.95（约 7.9 单位），脊高沿用玉垒山原生剖面',
    build: '顶面取未凿山脊解析面 + 槽壁 rim 收边 + 竖直裙边，沿走廊切 5 片',
    inst: '5 片（每片 1 Geometry，共 1 Draw Call + 裂隙 2）',
    hook: '崖根炙烤自发光 → 柴薪引水沃裂 → 竖向节理生长 → 逐片外倾坍落 → 峡口贯通',
  },
  {
    name: '石人水则（秦代标尺）',
    size: '高 1.35 × 宽 0.42（禁用水则之外的明清卧铁）',
    build: '方座 + 6 边柱身 + 20 面体头（≤ 64 面）',
    inst: '2 尊（岸畔浅滩）',
    hook: '枯水露足（0.00）、洪水及肩（+0.72）',
  },
  {
    name: '四级自流渠网与田块',
    size: '渠宽 1.7 → 0.65，单田 3.8 × 3.4',
    build: '1 合并渠带 Shader + 1 田块 / 水光 / 禾苗 InstancedMesh',
    inst: '36 块田 + 40 棵树（实例化）',
    hook: '水头波前推进 + 测地距离逐块泛绿拔节',
  },
]

const stats = computed(() => [
  { value: `${(props.ledger.triangles / 1000).toFixed(1)}k`, label: '实时三角面' },
  { value: String(props.ledger.drawCalls), label: 'Draw Calls' },
  { value: String(Math.round(props.ledger.fps)), label: 'FPS' },
  { value: `${TOTAL_SEC}s`, label: '8 阶段循环' },
])
</script>

<template>
  <aside class="brief" :class="{ 'is-open': open }" aria-label="建模提单">
    <header class="brief__head">
      <div>
        <span class="rl-eyebrow">MODEL LEDGER</span>
        <h2 class="brief__title">部件建模提单</h2>
      </div>
      <button type="button" class="brief__close" aria-label="收起建模提单" @click="emit('close')">×</button>
    </header>

    <p class="brief__note">
      1 平面单位 ≈ 20 m（山脊 1.65× / 崖壁 2.85× / 堤堰 4.5× 分级垂直夸张）。以下数字与当前渲染画面同源。
    </p>

    <dl class="brief__stats">
      <div v-for="stat in stats" :key="stat.label">
        <dt>{{ stat.label }}</dt>
        <dd>{{ stat.value }}</dd>
      </div>
    </dl>

    <article v-for="part in PARTS" :key="part.name" class="brief__part">
      <h3>{{ part.name }}</h3>
      <dl>
        <dt>尺寸</dt>
        <dd>{{ part.size }}</dd>
        <dt>拓扑</dt>
        <dd>{{ part.build }}</dd>
        <dt>合批</dt>
        <dd>{{ part.inst }}</dd>
        <dt>挂点</dt>
        <dd>{{ part.hook }}</dd>
      </dl>
    </article>

    <p class="brief__foot">
      堤身轴线全长 {{ ledger.dikeLength.toFixed(2) }} 单位（约 {{ (ledger.dikeLength * 20).toFixed(0) }} m）：
      鱼嘴迎水尖 → 飞沙堰北端，折线全程按 JPS 剖面贴地。
    </p>
  </aside>
</template>

<style scoped>
.brief {
  display: flex;
  flex-direction: column;
  gap: 11px;
  width: 380px;
  max-height: 100%;
  padding: 14px;
  overflow-y: auto;
  border: 1px solid var(--rl-border);
  border-radius: var(--rl-r-md);
  background: color-mix(in srgb, var(--rl-surface) 94%, transparent);
  box-shadow: var(--rl-sh-lg);
  backdrop-filter: blur(16px);
  scrollbar-width: thin;
}

.brief__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.brief__title {
  margin: 3px 0 0;
  font-family: var(--rl-display);
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--rl-ink);
}

.brief__close {
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

.brief__close:hover {
  background: var(--rl-primary-soft);
  color: var(--rl-primary);
}

.brief__note {
  margin: 0;
  font-size: 10.5px;
  line-height: 1.6;
  color: var(--rl-muted);
}

.brief__stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  margin: 0;
  padding: 9px 0;
  border-block: 1px solid var(--rl-border);
}

.brief__stats div {
  display: flex;
  flex-direction: column-reverse;
  gap: 2px;
  text-align: center;
}

.brief__stats dt {
  font-size: 9px;
  color: var(--rl-faint);
}

.brief__stats dd {
  margin: 0;
  font-family: var(--rl-mono);
  font-size: 15px;
  font-weight: 600;
  color: var(--rl-primary);
}

.brief__part h3 {
  margin: 0 0 5px;
  font-size: 12px;
  font-weight: 600;
  color: var(--rl-ink);
}

.brief__part dl {
  display: grid;
  grid-template-columns: 34px 1fr;
  gap: 3px 8px;
  margin: 0;
  padding: 8px 10px;
  border: 1px solid var(--rl-border);
  border-radius: var(--rl-r-sm);
  background: var(--rl-bg-alt);
}

.brief__part dt {
  font-size: 9.5px;
  color: var(--rl-faint);
}

.brief__part dd {
  margin: 0;
  font-size: 10.5px;
  line-height: 1.55;
  color: var(--rl-body);
}

.brief__foot {
  margin: 0;
  padding-top: 9px;
  border-top: 1px solid var(--rl-border);
  font-size: 10px;
  line-height: 1.6;
  color: var(--rl-faint);
}

@media (max-width: 720px) {
  .brief {
    width: 100%;
  }

  .brief__stats {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
