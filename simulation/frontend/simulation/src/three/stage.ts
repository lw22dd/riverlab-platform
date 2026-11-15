import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'
import gsap from 'gsap'
import type { StageHotspot } from '@/models/presentation.model'

export interface AmbiencePreset {
  background?: number
  fogColor?: number
  fogDensity?: number
  sunIntensity?: number
  sunColor?: number
  fillIntensity?: number
  exposure?: number
}

export type Vec3Tuple = [number, number, number]

export interface StageOptions {
  reducedMotion?: boolean
  cinematic?: boolean
}

export interface HotspotSpec extends StageHotspot {
  position: Vec3Tuple
}

type UpdateFn = (delta: number, elapsed: number) => void

const DEFAULT_AMBIENCE: AmbiencePreset = {
  background: 0xdcebf8,
  fogColor: 0xeaf4fc,
  fogDensity: 0.009,
  sunIntensity: 2.45,
  sunColor: 0xfff2dc,
  fillIntensity: 1.2,
  exposure: 1.05,
}

/**
 * 共享的 Three.js 表现外壳。
 *
 * 各场景构建器自行添加灯光与几何体；`Stage` 负责渲染管线、相机编排、
 * 氛围分级、CSS2D 热点与资源清理。
 */
export class Stage {
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  readonly renderer: THREE.WebGLRenderer
  readonly labelRenderer: CSS2DRenderer
  readonly controls: OrbitControls
  readonly sun: THREE.DirectionalLight
  readonly fill: THREE.HemisphereLight

  private readonly host: HTMLElement
  private readonly updaters = new Set<UpdateFn>()
  private readonly ambientPresets = new Map<string, AmbiencePreset>()
  private readonly hotspotElements = new Map<string, HTMLButtonElement>()
  private readonly hotspotObjects = new Map<string, CSS2DObject>()
  private readonly tweens: gsap.core.Tween[] = []
  private readonly disposables: Array<() => void> = []
  private resizeObserver?: ResizeObserver
  private frame = 0
  private lastFrame = performance.now()
  private elapsed = 0
  private paused = false
  private disposed = false
  private reducedMotion: boolean
  private cinematic: boolean
  private shakeStrength = 0
  private shakeTime = 0
  private currentHotspotHandler?: (hotspot: StageHotspot) => void

  constructor(host: HTMLElement, options: StageOptions = {}) {
    this.host = host
    this.reducedMotion = options.reducedMotion ?? false
    this.cinematic = options.cinematic ?? true

    const width = Math.max(1, host.clientWidth)
    const height = Math.max(1, host.clientHeight)

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(DEFAULT_AMBIENCE.background)
    this.scene.fog = new THREE.FogExp2(DEFAULT_AMBIENCE.fogColor ?? 0xeaf4fc, DEFAULT_AMBIENCE.fogDensity)

    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 320)
    this.camera.position.set(14, 11, 24)

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setSize(width, height)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = DEFAULT_AMBIENCE.exposure ?? 1.05
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.domElement.className = 'stage-canvas'
    host.appendChild(this.renderer.domElement)

    this.labelRenderer = new CSS2DRenderer()
    this.labelRenderer.setSize(width, height)
    Object.assign(this.labelRenderer.domElement.style, {
      position: 'absolute',
      inset: '0',
      pointerEvents: 'none',
      overflow: 'hidden',
      zIndex: '3',
    })
    host.appendChild(this.labelRenderer.domElement)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.06
    this.controls.enablePan = false
    this.controls.minDistance = 5
    this.controls.maxDistance = 58
    this.controls.minPolarAngle = 0.18
    this.controls.maxPolarAngle = Math.PI * 0.495
    this.controls.target.set(0, 1.5, 0)

    this.fill = new THREE.HemisphereLight(0xeaf4ff, 0xdad3c7, DEFAULT_AMBIENCE.fillIntensity ?? 1.2)
    this.scene.add(this.fill)

    this.sun = new THREE.DirectionalLight(DEFAULT_AMBIENCE.sunColor ?? 0xfff2dc, DEFAULT_AMBIENCE.sunIntensity ?? 2.45)
    this.sun.position.set(18, 28, 14)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    this.sun.shadow.camera.near = 1
    this.sun.shadow.camera.far = 90
    this.sun.shadow.camera.left = -38
    this.sun.shadow.camera.right = 38
    this.sun.shadow.camera.top = 38
    this.sun.shadow.camera.bottom = -38
    this.sun.shadow.bias = -0.0012
    this.sun.shadow.normalBias = 0.025
    this.scene.add(this.sun)
    this.scene.add(this.sun.target)
    this.sun.target.position.set(0, 0, 0)

    // 跟随容器尺寸变化，保持画布与 CSS2D 标签同步。
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(host)

    this.loop = this.loop.bind(this)
    this.frame = requestAnimationFrame(this.loop)
  }

  /** 注册一套氛围预设（背景、雾、曝光、光照），场景构建时调用。 */
  defineAmbience(name: string, preset: AmbiencePreset): void {
    this.ambientPresets.set(name, preset)
  }

  /**
   * 平滑切换到指定氛围，用于表现压力升级。
   * 减少动效模式下直接瞬切，不产生补间。
   */
  setAmbience(name: string, immediate = false): void {
    const preset = this.ambientPresets.get(name)
    if (!preset) return
    const duration = immediate || this.reducedMotion ? 0 : 1.1
    const fog = this.scene.fog as THREE.FogExp2
    const background = this.scene.background as THREE.Color

    if (preset.background !== undefined) {
      const color = new THREE.Color(preset.background)
      this.tweens.push(gsap.to(background, { r: color.r, g: color.g, b: color.b, duration }))
    }
    if (preset.fogColor !== undefined) {
      const color = new THREE.Color(preset.fogColor)
      this.tweens.push(gsap.to(fog.color, { r: color.r, g: color.g, b: color.b, duration }))
    }
    if (preset.fogDensity !== undefined) {
      this.tweens.push(gsap.to(fog, { density: preset.fogDensity, duration }))
    }
    if (preset.exposure !== undefined) {
      this.tweens.push(gsap.to(this.renderer, { toneMappingExposure: preset.exposure, duration }))
    }
    if (preset.sunIntensity !== undefined) {
      this.tweens.push(gsap.to(this.sun, { intensity: preset.sunIntensity, duration }))
    }
    if (preset.sunColor !== undefined) {
      const color = new THREE.Color(preset.sunColor)
      this.tweens.push(gsap.to(this.sun.color, { r: color.r, g: color.g, b: color.b, duration }))
    }
    if (preset.fillIntensity !== undefined) {
      this.tweens.push(gsap.to(this.fill, { intensity: preset.fillIntensity, duration }))
    }
  }

  /** 相机编排：把机位与观察目标同时补间到新位置，是各场景预设镜头的统一入口。 */
  cameraTo(position: Vec3Tuple, target: Vec3Tuple, options: { immediate?: boolean; duration?: number } = {}): void {
    const immediate = options.immediate || this.reducedMotion
    const duration = immediate ? 0 : (options.duration ?? (this.cinematic ? 1.4 : 0.7))
    const positionTween = gsap.to(this.camera.position, {
      x: position[0],
      y: position[1],
      z: position[2],
      duration,
      ease: 'power3.inOut',
      overwrite: 'auto',
      onUpdate: () => this.controls.update(),
    })
    const targetTween = gsap.to(this.controls.target, {
      x: target[0],
      y: target[1],
      z: target[2],
      duration,
      ease: 'power3.inOut',
      overwrite: 'auto',
    })
    this.tweens.push(positionTween, targetTween)
  }

  /** 触发一次镜头震动；冲击越强传入越大的强度与时长，减少动效时自动忽略。 */
  shake(strength = 0.22, duration = 0.65): void {
    if (this.reducedMotion) return
    this.shakeStrength = Math.max(this.shakeStrength, strength)
    this.shakeTime = Math.max(this.shakeTime, duration)
  }

  /** 注册逐帧更新回调（雨、水流动画等），返回取消函数。 */
  addUpdater(updater: UpdateFn): () => void {
    this.updaters.add(updater)
    return () => this.updaters.delete(updater)
  }

  /** 延迟执行回调，并由舞台统一管理生命周期，避免场景销毁后仍在跑。 */
  after(ms: number, callback: () => void): gsap.core.Tween {
    const tween = gsap.delayedCall(Math.max(0.01, ms / 1000), callback)
    this.tweens.push(tween)
    return tween
  }

  /** 统一补间入口：减少动效时把时长压到 0，同时登记到舞台以便销毁时终止。 */
  tweenTo(
    target: gsap.TweenTarget,
    vars: gsap.TweenVars,
  ): gsap.core.Tween {
    const tween = gsap.to(target, { ...vars, duration: this.reducedMotion ? 0 : vars.duration })
    this.tweens.push(tween)
    return tween
  }

  /** 登记需要在销毁时释放 GPU 资源的对象，避免切换场景后显存泄漏。 */
  registerDisposable(...objects: THREE.Object3D[]): void {
    this.disposables.push(() => {
      for (const object of objects) disposeObject(object)
    })
  }

  /** 登记任意清理逻辑（DOM 节点、定时器等），与 dispose 一起执行。 */
  registerCleanup(cleanup: () => void): void {
    this.disposables.push(cleanup)
  }

  /** 设置热点点击回调，把「勘查」意图转交给运行页与引擎。 */
  onHotspot(handler: (hotspot: StageHotspot) => void): void {
    this.currentHotspotHandler = handler
  }

  /** 在 3D 空间中放置一个可点击的勘查热点（CSS2D 按钮）。 */
  addHotspot(spec: HotspotSpec): void {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = `world-hotspot world-hotspot--${spec.tone ?? 'info'}`
    button.dataset.hotspot = spec.id
    button.setAttribute('aria-label', `${spec.label}，现场勘查`)
    const dot = document.createElement('span')
    dot.className = 'world-hotspot__dot'
    const label = document.createElement('span')
    label.className = 'world-hotspot__label'
    label.textContent = spec.label
    const hint = document.createElement('span')
    hint.className = 'world-hotspot__hint'
    hint.textContent = '现场勘查'
    button.append(dot, label, hint)
    button.addEventListener('click', (event) => {
      event.stopPropagation()
      this.markHotspot(spec.id)
      this.currentHotspotHandler?.({
        id: spec.id,
        label: spec.label,
        detail: spec.detail,
        tone: spec.tone,
      })
    })

    const object = new CSS2DObject(button)
    object.position.set(...spec.position)
    object.center.set(0.5, 0.5)
    this.scene.add(object)
    this.hotspotObjects.set(spec.id, object)
    this.hotspotElements.set(spec.id, button)
    this.registerCleanup(() => {
      object.removeFromParent()
      button.remove()
    })
  }

  /** 把热点标记为「已勘查」，与引擎的 inspected 记录保持一致。 */
  markHotspot(id: string): void {
    const element = this.hotspotElements.get(id)
    if (!element) return
    element.classList.add('is-visited')
    element.setAttribute('aria-label', `${element.querySelector('.world-hotspot__label')?.textContent ?? id}，已勘查`)
    const hint = element.querySelector('.world-hotspot__hint')
    if (hint) hint.textContent = '已勘查'
  }

  /** 清除所有热点的「已勘查」状态，用于重开推演。 */
  resetHotspots(): void {
    for (const element of this.hotspotElements.values()) element.classList.remove('is-visited')
  }

  /** 在场景中加一条浮动文字标注（时间戳、证据标签等），随场景一起销毁。 */
  addAnnotation(text: string, position: Vec3Tuple, variant = 'default'): HTMLElement {
    const element = document.createElement('span')
    element.className = `world-annotation world-annotation--${variant}`
    element.textContent = text
    const object = new CSS2DObject(element)
    object.position.set(...position)
    object.center.set(0.5, 1)
    this.scene.add(object)
    this.registerCleanup(() => {
      object.removeFromParent()
      element.remove()
    })
    return element
  }

  /** 隐藏全部热点，后果演出期间避免玩家继续勘查。 */
  hideHotspots(): void {
    for (const object of this.hotspotObjects.values()) object.visible = false
  }

  /** 恢复热点显示，回到可勘查状态。 */
  showHotspots(): void {
    for (const object of this.hotspotObjects.values()) object.visible = true
  }

  /** 暂停/恢复逐帧更新（不停止渲染），配合运行页的暂停面板。 */
  setPaused(paused: boolean): void {
    this.paused = paused
    this.lastFrame = performance.now()
  }

  private resize(): void {
    if (this.disposed) return
    const width = Math.max(1, this.host.clientWidth)
    const height = Math.max(1, this.host.clientHeight)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
    this.labelRenderer.setSize(width, height)
  }

  private loop(): void {
    if (this.disposed) return
    this.frame = requestAnimationFrame(this.loop)

    const now = performance.now()
    const delta = Math.min(0.05, Math.max(0, (now - this.lastFrame) / 1000))
    this.lastFrame = now

    // 暂停时冻结更新器与轨道控制，但继续渲染最后一帧。
    if (!this.paused) {
      this.elapsed += delta
      this.controls.update()
      for (const updater of this.updaters) updater(delta, this.elapsed)
    }

    if (this.shakeTime > 0 && !this.paused) {
      this.shakeTime -= delta
      const amplitude = this.shakeStrength * Math.max(0, this.shakeTime)
      const x = THREE.MathUtils.randFloatSpread(amplitude)
      const y = THREE.MathUtils.randFloatSpread(amplitude * 0.6)
      const base = this.camera.position.clone()
      this.camera.position.add(new THREE.Vector3(x, y, 0))
      this.renderer.render(this.scene, this.camera)
      this.labelRenderer.render(this.scene, this.camera)
      this.camera.position.copy(base)
    } else {
      this.renderer.render(this.scene, this.camera)
      this.labelRenderer.render(this.scene, this.camera)
    }
  }

  /** 释放 GPU 资源、监听器与所有补间，防止场景切换后泄漏。 */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    cancelAnimationFrame(this.frame)
    this.resizeObserver?.disconnect()
    for (const tween of this.tweens) tween.kill()
    for (const cleanup of this.disposables) cleanup()
    this.controls.dispose()
    disposeObject(this.scene)
    this.renderer.dispose()
    this.renderer.domElement.remove()
    this.labelRenderer.domElement.remove()
    this.updaters.clear()
    this.scene.clear()
  }
}

/** 递归释放对象树上的几何体、材质与贴图，是显存回收的基础操作。 */
export function disposeObject(root: THREE.Object3D): void {
  // 递归释放几何体、材质与贴图。
  root.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (mesh.geometry) mesh.geometry.dispose()
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(material)) {
      material.forEach((entry) => {
        disposeMaterial(entry)
      })
    } else if (material) {
      disposeMaterial(material)
    }
  })
}

function disposeMaterial(material: THREE.Material): void {
  const candidate = material as THREE.Material & { map?: THREE.Texture; emissiveMap?: THREE.Texture }
  candidate.map?.dispose()
  candidate.emissiveMap?.dispose()
  material.dispose()
}
