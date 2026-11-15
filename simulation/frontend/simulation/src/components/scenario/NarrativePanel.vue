<script setup lang="ts">
import type { ConsequenceNode, NarrativeNode } from '@/models/scenario.model'
import Icon from '@/components/common/Icon.vue'

withDefaults(
  defineProps<{
    node: NarrativeNode | ConsequenceNode
    auto?: boolean
  }>(),
  { auto: false },
)

defineEmits<{
  advance: []
}>()
</script>

<template>
  <section
    class="scene-caption"
    :class="{ 'scene-caption--consequence': node.type === 'consequence' }"
  >
    <header class="scene-caption__head">
      <span class="scene-caption__kicker">
        {{ node.kicker ?? (node.type === 'consequence' ? 'CONSEQUENCE' : 'FIELD NOTE') }}
      </span>
      <span v-if="node.speaker" class="scene-caption__speaker">
        <i aria-hidden="true"></i>
        {{ node.speaker }}
      </span>
    </header>

    <h2 class="scene-caption__title">{{ node.title }}</h2>
    <p class="scene-caption__text">{{ node.text }}</p>

    <footer class="scene-caption__foot">
      <button type="button" class="scene-caption__advance" @click="$emit('advance')">
        {{ auto ? '立即继续' : node.advanceLabel ?? '继续' }}
        <Icon name="arrow-right" :size="16" />
      </button>
      <span v-if="auto" class="scene-caption__auto">
        <i aria-hidden="true"></i>
        决策程序运行中 · 即将继续
      </span>
      <span v-else class="scene-caption__key">
        <kbd>Enter</kbd>
        继续
      </span>
    </footer>
  </section>
</template>

<style scoped>
.scene-caption {
  position: absolute;
  left: 50%;
  bottom: 0;
  width: min(1140px, calc(100% - 40px));
  max-height: calc(100svh - 88px);
  padding: 20px 26px calc(18px + env(safe-area-inset-bottom, 0px));
  border: 1px solid var(--line);
  border-left: 3px solid var(--accent, var(--brand));
  border-radius: 18px 18px 0 0;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(22px) saturate(130%);
  box-shadow: var(--shadow-md);
  overflow-y: auto;
  pointer-events: auto;
  translate: -50% 0;
  animation: caption-in 420ms var(--ease-out) both;
}

.scene-caption::before {
  display: none;
}

.scene-caption__head {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.scene-caption__kicker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex: none;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--accent, var(--brand));
}

.scene-caption__kicker::before {
  content: '';
  width: 16px;
  height: 1px;
  background: currentColor;
  opacity: 0.7;
}

.scene-caption--consequence {
  border-left-color: var(--warn);
}

.scene-caption--consequence .scene-caption__kicker {
  color: var(--warn);
}

.scene-caption__speaker {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  font-size: 11px;
  color: var(--text-faint);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.scene-caption__speaker i {
  width: 3px;
  height: 3px;
  flex: none;
  border-radius: 50%;
  background: var(--text-faint);
}

.scene-caption__title {
  margin-top: 9px;
  font-size: clamp(20px, 1.6vw, 23px);
  font-weight: 600;
  letter-spacing: -0.015em;
  color: var(--text-strong);
}

.scene-caption__text {
  max-width: none;
  margin-top: 7px;
  font-size: 15px;
  line-height: 1.85;
  color: var(--text);
  text-wrap: pretty;
}

.scene-caption__foot {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 13px;
}

.scene-caption__advance {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 0;
  border: 0;
  background: transparent;
  font-size: 13px;
  font-weight: 600;
  color: var(--accent, var(--brand));
  cursor: pointer;
  transition:
    gap 180ms ease,
    color 180ms ease;
}

.scene-caption__advance:hover {
  gap: 11px;
  color: var(--brand);
}

.scene-caption--consequence .scene-caption__advance {
  color: var(--warn);
}

.scene-caption__auto {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--text-faint);
  font-size: 11px;
}

.scene-caption__auto i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--accent, var(--brand));
  animation: caption-pulse 2.2s ease-in-out infinite;
}

@keyframes caption-pulse {
  0%,
  100% {
    opacity: 0.45;
  }
  50% {
    opacity: 1;
  }
}

.scene-caption__key {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-faint);
}

.scene-caption__key kbd {
  padding: 2px 6px;
  border: 1px solid var(--line-strong);
  border-bottom-width: 2px;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-muted);
}

@keyframes caption-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 860px) {
  .scene-caption {
    left: 12px;
    right: 12px;
    bottom: 0;
    width: auto;
    padding: 14px 16px calc(14px + env(safe-area-inset-bottom, 0px));
    border-radius: 16px 16px 0 0;
    translate: none;
    background: rgba(255, 255, 255, 0.82);
  }

  .scene-caption__title {
    margin-top: 7px;
    font-size: 17px;
  }

  .scene-caption__text {
    max-height: 28svh;
    overflow-y: auto;
    font-size: 13.5px;
    line-height: 1.75;
    padding-right: 4px;
  }

  .scene-caption__foot {
    margin-top: 11px;
  }
}

@media (max-width: 600px) {
  .scene-caption__key {
    display: none;
  }

  .scene-caption__text {
    max-height: 26svh;
  }
}
</style>
