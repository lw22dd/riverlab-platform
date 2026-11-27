/**
 * 把「开山导江记」纪事引擎接成场景运行页的舞台。
 *
 * 运行页只认 `ScenarioStageHandle`（focus / applyAction / setAmbience / markHotspot /
 * reset / pause / dispose），而纪事引擎是「时间轴 + 分支向量」的确定性场景。这一层负责：
 * ① 把节点动作翻译成时间轴窗口（映射表见 dujiangyan-chronicle-map.ts）；
 * ② 自己驱动 rAF（纪事引擎不持有循环）；
 * ③ 用 CSS2DRenderer 在三维里挂三处勘查热点，点击后回调运行页登记踏勘。
 */

import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'

import { createChronicleScene } from '@/three/chronicle'
import type { ChronicleScene } from '@/three/chronicle'
import type { StageHotspot } from '@/models/presentation.model'

import { ambienceSeason, focusCamera, resolveStageAction } from './dujiangyan-chronicle-map'
import type { ScenarioSceneOptions, ScenarioStageHandle } from './types'

/** 三处勘查热点：坐标是纪事场景的世界坐标（PLAN 的 X/Z 经 p2w 取反）。 */
const HOTSPOTS: Array<StageHotspot & { position: [number, number, number] }> = [
  {
    id: 'd_spot_ridge',
    label: '玉垒山嘴',
    detail: '玉垒山位于内江东侧；开凿山嘴形成宝瓶口，江水才能穿过缺口进入成都平原。',
    tone: 'info',
    position: [21.0, 10.6, 7.8],
  },
  {
    id: 'd_spot_bend',
    label: '内江弯道',
    detail: '内江顺山脚流向宝瓶口，弯道和飞沙堰配合，将一部分泥沙排回外江。',
    tone: 'info',
    position: [-7.2, 3.0, -17.6],
  },
  {
    id: 'd_spot_plain',
    label: '平原引水口',
    detail: '宝瓶口凿通后，内江水穿过缺口，沿干渠及支渠自流进入成都平原。',
    tone: 'info',
    position: [30.0, 1.8, -6.0],
  },
]

export function buildChronicleStage(
  host: HTMLElement,
  options: ScenarioSceneOptions,
): ScenarioStageHandle {
  const width = host.clientWidth || window.innerWidth
  const height = host.clientHeight || window.innerHeight

  // 纪事引擎把标签元素注入到外部容器里，这里给运行页现场造两层覆盖物。
  const labels = document.createElement('div')
  labels.className = 'scene-labels'
  labels.setAttribute('aria-hidden', 'true')
  host.append(labels)

  const scene: ChronicleScene = createChronicleScene({ stage: host, labels, mobile: width < 820 })

  // 开发期调机位用：控制台可直接 __chronicleStage.setCamera(...)、读 camera.position。
  if (import.meta.env.DEV) {
    ;(window as unknown as Record<string, unknown>).__chronicleStage = scene
  }

  scene.setFollowCamera(false)
  scene.setPreset('overview')
  scene.setPlaying(false)
  scene.seek(0)

  // --- 勘查热点：CSS2DRenderer 负责把三维点投影成屏幕按钮 ---------------------
  const labelRenderer = new CSS2DRenderer()
  labelRenderer.setSize(width, height)
  const hotspotRoot = labelRenderer.domElement
  hotspotRoot.className = 'scene-hotspots is-hidden'
  host.append(hotspotRoot)

  const hotspotButtons = new Map<string, HTMLButtonElement>()
  const hotspotObjects: CSS2DObject[] = []

  function markVisited(id: string): void {
    const button = hotspotButtons.get(id)
    if (!button) return
    button.classList.add('is-visited')
    const hint = button.querySelector('.world-hotspot__hint')
    if (hint) hint.textContent = '已勘查'
  }

  for (const spec of HOTSPOTS) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = `world-hotspot world-hotspot--${spec.tone ?? 'info'}`
    button.dataset.hotspot = spec.id
    button.setAttribute('aria-label', `${spec.label}，现场勘查`)

    const dot = document.createElement('span')
    dot.className = 'world-hotspot__dot'
    const text = document.createElement('span')
    text.className = 'world-hotspot__label'
    text.textContent = spec.label
    const hint = document.createElement('span')
    hint.className = 'world-hotspot__hint'
    hint.textContent = '现场勘查'
    button.append(dot, text, hint)

    button.addEventListener('click', (event) => {
      event.stopPropagation()
      // 是否「已勘查」由引擎回调 markHotspot 决定：开演前点击不该留下痕迹。
      options.onInspect({ id: spec.id, label: spec.label, detail: spec.detail, tone: spec.tone })
    })

    const object = new CSS2DObject(button)
    object.position.set(...spec.position)
    object.center.set(0.5, 0.5)
    scene.scene.add(object)
    hotspotButtons.set(spec.id, button)
    hotspotObjects.push(object)
  }

  function setHotspotsVisible(visible: boolean): void {
    hotspotRoot.classList.toggle('is-hidden', !visible)
  }

  // --- 时间轴推进：播放到窗口终点就停住，不回到 64 秒循环 --------------------
  let playUntil: number | null = null
  let lastStamp = 0
  let rafId = 0
  let disposed = false

  function frame(now: number): void {
    if (disposed) return
    rafId = requestAnimationFrame(frame)
    const delta = lastStamp === 0 ? 0 : Math.min(0.05, (now - lastStamp) / 1000)
    lastStamp = now
    const state = scene.tick(delta)
    if (playUntil !== null && state.time >= playUntil) {
      scene.setPlaying(false)
      scene.seek(playUntil)
      playUntil = null
    }
    labelRenderer.render(scene.scene, scene.camera)
  }

  function applyDirective(action: string): void {
    const directive = resolveStageAction(action)
    if (!directive) return

    if (directive.reset) {
      playUntil = null
      scene.setPlaying(false)
      scene.resetBranch()
      scene.seek(0)
      setHotspotsVisible(false)
      for (const button of hotspotButtons.values()) {
        button.classList.remove('is-visited')
        const hint = button.querySelector('.world-hotspot__hint')
        if (hint) hint.textContent = '现场勘查'
      }
      return
    }

    if (directive.branch) scene.setBranch(directive.branch)
    if (directive.season) scene.setSeason(directive.season)
    if (directive.showHotspots) setHotspotsVisible(true)

    if (directive.seekTo !== undefined) {
      playUntil = null
      scene.setPlaying(false)
      scene.seek(directive.seekTo)
    }

    // 开了「减少动态效果」就直接落到窗口终点，不跑补间。
    if (directive.playUntil !== undefined) {
      if (options.reducedMotion) {
        playUntil = null
        scene.seek(directive.playUntil)
      } else {
        playUntil = directive.playUntil
        scene.setPlaying(true)
      }
    }
  }

  rafId = requestAnimationFrame(frame)

  // 容器尺寸跟随窗口：纪事的相机与标签都按像素投影，必须同步。
  const observer = new ResizeObserver(([entry]) => {
    const box = entry?.contentRect
    if (!box || box.width === 0 || box.height === 0) return
    scene.resize(box.width, box.height)
    labelRenderer.setSize(box.width, box.height)
  })
  observer.observe(host)

  return {
    focus: (preset) => {
      if (options.cinematicCamera === false) return
      const camera = focusCamera(preset)
      scene.setCamera(camera.from, camera.look)
    },
    applyAction: (action) => applyDirective(action),
    setAmbience: (level) => {
      scene.setSeason(ambienceSeason(level))
    },
    markHotspot: (id) => markVisited(id),
    reset: () => {
      applyDirective('dujiangyan:reset')
      scene.setPreset('overview')
    },
    pause: (paused) => {
      if (paused) {
        playUntil = null
        scene.setPlaying(false)
      } else {
        scene.setPlaying(true)
      }
    },
    dispose: () => {
      disposed = true
      cancelAnimationFrame(rafId)
      observer.disconnect()
      for (const object of hotspotObjects) object.removeFromParent()
      hotspotRoot.remove()
      labels.remove()
      scene.dispose()
    },
  }
}

/** 供测试与调试：热点定义不依赖 DOM。 */
export const CHRONICLE_HOTSPOTS = HOTSPOTS
