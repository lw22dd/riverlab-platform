import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { disposeObject, Stage } from '../stage'
import {
  createPerson,
  createRailway,
  createStreetLamp,
  createTree,
} from '../primitives'
import type { CameraPreset, ScenarioSceneOptions, ScenarioStageHandle } from './types'

type StageTween = ReturnType<Stage['after']>
type TweenTarget = Parameters<Stage['tweenTo']>[0]
type TweenVars = Parameters<Stage['tweenTo']>[1]

const CAMERA_PRESETS: Record<string, CameraPreset> = {
  overview: { position: [22, 11, 34], target: [1.5, -1.2, -6] },
  lever: { position: [16, 10, 32], target: [-1, -2.2, -8] },
  main: { position: [-8.5, 3.8, 9], target: [0, 1, -12] },
  side: { position: [17, 4.4, 0], target: [8.7, 0.8, -13] },
  wreck: { position: [12, 5, -2], target: [1.5, 1, -14] },
  evidence: { position: [2.6, 1.8, 14.5], target: [-3.5, 1.1, 12.6] },
}

/** 生成电车模型（车身、车窗与集电杆），供电车难题与天桥场景复用。 */
export function createTrolley(): THREE.Group {
  const group = new THREE.Group()
  const body = new THREE.MeshStandardMaterial({ color: 0x9a774a, roughness: 0.62, metalness: 0.32 })
  const trim = new THREE.MeshStandardMaterial({ color: 0x695b47, roughness: 0.8, metalness: 0.3 })
  const hazard = new THREE.MeshStandardMaterial({
    color: 0xd7a73d,
    emissive: 0x3a2806,
    emissiveIntensity: 0.3,
    roughness: 0.52,
  })
  const glass = new THREE.MeshStandardMaterial({
    color: 0x9ebfd2,
    emissive: 0x2e4551,
    emissiveIntensity: 0.12,
    roughness: 0.18,
    metalness: 0.26,
  })

  const chassis = new THREE.Mesh(new RoundedBoxGeometry(2.35, 1.9, 5.9, 3, 0.14), body)
  chassis.position.y = 1.28
  chassis.castShadow = true
  chassis.receiveShadow = true
  group.add(chassis)

  const lower = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.35, 6.05), trim)
  lower.position.y = 0.46
  lower.castShadow = true
  group.add(lower)

  const frontWindow = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.68, 0.06), glass)
  frontWindow.position.set(0, 1.72, -2.97)
  group.add(frontWindow)

  for (const side of [-1, 1]) {
    const window = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.62, 1.5), glass)
    window.position.set(side * 1.18, 1.72, -0.9)
    group.add(window)
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 5.4), hazard)
    stripe.position.set(side * 1.2, 0.92, 0)
    group.add(stripe)
  }

  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.16, 6.05), trim)
  roof.position.y = 2.3
  roof.castShadow = true
  group.add(roof)

  const frontPlate = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.35, 0.5), hazard)
  frontPlate.position.set(0, 0.48, -3.05)
  frontPlate.rotation.x = 0.22
  group.add(frontPlate)

  const lampMaterial = new THREE.MeshStandardMaterial({
    color: 0xfff4d0,
    emissive: 0xffe1a0,
    emissiveIntensity: 2.4,
    roughness: 0.2,
  })
  for (const x of [-0.72, 0.72]) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), lampMaterial)
    lamp.position.set(x, 1.18, -3.02)
    group.add(lamp)
  }
  const spot = new THREE.SpotLight(0xffedc4, 22, 22, 0.42, 0.55, 1.4)
  spot.position.set(0, 1.2, -3.05)
  spot.target.position.set(0, 0.2, -16)
  group.add(spot, spot.target)

  const wheelGeometry = new THREE.CylinderGeometry(0.42, 0.42, 0.2, 16)
  const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x4b4f52, roughness: 0.9 })
  const wheels: THREE.Mesh[] = []
  for (const x of [-1.1, 1.1]) {
    for (const z of [-2.1, 0.2, 2.2]) {
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial)
      wheel.rotation.z = Math.PI / 2
      wheel.position.set(x, 0.43, z)
      wheel.castShadow = true
      group.add(wheel)
      wheels.push(wheel)
    }
  }

  group.userData = { kind: 'trolley', wheels }
  return group
}

/**
 * 构建经典电车难题场景：主线五人、侧线一人与可扳动的道岔手柄。
 * 手柄是本场景的主要交互物，扳动后电车沿侧线推进。
 */
export function buildTrolleyScene(
  host: HTMLElement,
  options: ScenarioSceneOptions,
): ScenarioStageHandle {
  const stage = new Stage(host, {
    reducedMotion: options.reducedMotion,
    cinematic: options.cinematicCamera,
  })
  stage.onHotspot(options.onInspect)

  stage.defineAmbience('calm', {
    background: 0xe8eef2,
    fogColor: 0xf2e3c8,
    fogDensity: 0.01,
    sunIntensity: 2.5,
    sunColor: 0xfff0d0,
    fillIntensity: 1.15,
    exposure: 1.04,
  })
  stage.defineAmbience('tense', {
    background: 0xd9e6f0,
    fogColor: 0xeadfc9,
    fogDensity: 0.013,
    sunIntensity: 2.6,
    sunColor: 0xffe2b8,
    fillIntensity: 1.2,
    exposure: 1.05,
  })
  stage.defineAmbience('critical', {
    background: 0xf3ded6,
    fogColor: 0xf2d2c4,
    fogDensity: 0.015,
    sunIntensity: 2.7,
    sunColor: 0xffc9ab,
    fillIntensity: 1.22,
    exposure: 1.06,
  })

  const animations: StageTween[] = []
  const transient: THREE.Object3D[] = []
  let impactState: 'none' | 'main' | 'side' = 'none'

  function tw(target: TweenTarget, vars: TweenVars): StageTween {
    const tween = stage.tweenTo(target, vars)
    animations.push(tween)
    return tween
  }

  function later(ms: number, callback: () => void): StageTween {
    const tween = stage.after(ms, callback)
    animations.push(tween)
    return tween
  }

  function camera(preset: string, immediate = false): void {
    const config = CAMERA_PRESETS[preset] ?? CAMERA_PRESETS.overview
    stage.cameraTo(config.position, config.target, { immediate })
  }

  // ---------------------------------------------------------------------------
  // 环境
  // ---------------------------------------------------------------------------

  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x9ec9ee) },
      horizonColor: { value: new THREE.Color(0xf8d9a8) },
      bottomColor: { value: new THREE.Color(0xe8eef2) },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      uniform vec3 bottomColor;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition).y;
        vec3 color = mix(bottomColor, horizonColor, smoothstep(-0.05, 0.13, h));
        color = mix(color, topColor, smoothstep(0.12, 0.65, h));
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  })
  const sky = new THREE.Mesh(new THREE.SphereGeometry(150, 32, 20), skyMaterial)
  stage.scene.add(sky)

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 220),
    new THREE.MeshStandardMaterial({ color: 0x93a86a, roughness: 0.96 }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  stage.scene.add(ground)

  const hillsMaterial = new THREE.MeshStandardMaterial({ color: 0x7d9663, roughness: 0.98, flatShading: true })
  const hillSpecs = [
    [-45, -38, 30, 10, 18],
    [38, -46, 34, 12, 22],
    [-55, 14, 26, 9, 16],
    [50, 20, 28, 8, 17],
    [8, -72, 46, 12, 24],
  ] as const
  for (const [x, z, sx, sy, sz] of hillSpecs) {
    const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 10), hillsMaterial)
    hill.scale.set(sx, sy, sz)
    hill.position.set(x, -2.5, z)
    hill.receiveShadow = true
    stage.scene.add(hill)
  }

  const mainRailPoints = [
    new THREE.Vector3(0, 0, 44),
    new THREE.Vector3(0, 0, 24),
    new THREE.Vector3(0.15, 0, 10),
    new THREE.Vector3(0, 0, -12),
    new THREE.Vector3(-0.2, 0, -36),
  ]
  const sideRailPoints = [
    new THREE.Vector3(0.15, 0, 10),
    new THREE.Vector3(2.7, 0, 6),
    new THREE.Vector3(8.7, 0, 1.5),
    new THREE.Vector3(9, 0, -10),
    new THREE.Vector3(9, 0, -34),
  ]

  const mainRailway = createRailway({ points: mainRailPoints, gauge: 1.45 })
  stage.scene.add(mainRailway.group)
  const sideRailway = createRailway({ points: sideRailPoints, gauge: 1.45 })
  stage.scene.add(sideRailway.group)

  const mainRoute = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(0, 0, 18),
      new THREE.Vector3(0, 0, 14),
      new THREE.Vector3(0.15, 0, 10),
      new THREE.Vector3(0, 0, -12),
      new THREE.Vector3(-0.2, 0, -34),
    ],
    false,
    'catmullrom',
    0.16,
  )
  const sideRoute = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(0, 0, 18),
      new THREE.Vector3(0, 0, 14),
      new THREE.Vector3(0.15, 0, 10),
      new THREE.Vector3(2.7, 0, 6),
      new THREE.Vector3(8.7, 0, 1.5),
      new THREE.Vector3(9, 0, -10),
      new THREE.Vector3(9, 0, -34),
    ],
    false,
    'catmullrom',
    0.16,
  )

  // 碎石场坪
  const apron = new THREE.Mesh(
    new THREE.CircleGeometry(16, 48),
    new THREE.MeshStandardMaterial({ color: 0xbdb3a0, roughness: 0.97 }),
  )
  apron.rotation.x = -Math.PI / 2
  apron.position.set(3, 0.015, -6)
  apron.receiveShadow = true
  stage.scene.add(apron)

  // 远侧围栏
  const fenceMaterial = new THREE.MeshStandardMaterial({ color: 0x8f887a, roughness: 0.86, metalness: 0.2 })
  const fence = new THREE.Group()
  for (let z = -32; z <= 28; z += 3.2) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.5, 0.08), fenceMaterial)
    post.position.set(-7.4, 0.75, z)
    fence.add(post)
  }
  const wireMaterial = new THREE.LineBasicMaterial({ color: 0x817966, transparent: true, opacity: 0.6 })
  for (const y of [0.55, 1.05, 1.42]) {
    const points = [new THREE.Vector3(-7.4, y, -32), new THREE.Vector3(-7.4, y, 28)]
    fence.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), wireMaterial))
  }
  stage.scene.add(fence)

  const lamps = [
    [-5.8, 0.6, 17, 0xffc87c],
    [6.4, 0.6, -5, 0xffb86b],
    [-5.2, 0.6, -23, 0xffcf91],
  ] as const
  for (const [x, y, z, color] of lamps) {
    const lamp = createStreetLamp({ color, light: true })
    lamp.position.set(x, y, z)
    lamp.rotation.y = Math.PI / 2
    stage.scene.add(lamp)
  }

  const treePositions = [
    [-11, 20, 1.35],
    [-12, 8, 1.1],
    [-10.5, -6, 1.3],
    [-12, -21, 1.2],
    [14, 12, 1.2],
    [16, -4, 1.35],
    [13, -24, 1.1],
  ] as const
  for (const [x, z, scale] of treePositions) {
    const tree = createTree({ scale, color: 0x719d5c })
    tree.position.set(x, 0, z)
    stage.scene.add(tree)
  }

  // 道岔信号灯
  const signalPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.07, 3.2, 8),
    new THREE.MeshStandardMaterial({ color: 0x7a8384, metalness: 0.55, roughness: 0.4 }),
  )
  signalPole.position.set(-3.1, 1.6, 8.5)
  stage.scene.add(signalPole)
  const signalBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.92, 0.24),
    new THREE.MeshStandardMaterial({ color: 0x4e5557, roughness: 0.6 }),
  )
  signalBox.position.set(-3.1, 3.05, 8.5)
  stage.scene.add(signalBox)
  const signalLights = [0xff4b35, 0xffb340, 0x64c787].map((color, index) => {
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.095, 10, 8),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: index === 0 ? 1.4 : 0.12 }),
    )
    lamp.position.set(-3.1, 3.38 - index * 0.27, 8.38)
    stage.scene.add(lamp)
    return lamp
  })

  const noticePoleA = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.5, 0.08), fenceMaterial)
  noticePoleA.position.set(-3.6, 0.75, 7.0)
  const noticePoleB = noticePoleA.clone()
  noticePoleB.position.x = -2.2
  const noticeBoard = new THREE.Mesh(
    new THREE.BoxGeometry(1.55, 0.82, 0.06),
    new THREE.MeshStandardMaterial({ color: 0xb8b29a, roughness: 0.82 }),
  )
  noticeBoard.position.set(-2.9, 1.32, 7.0)
  noticeBoard.rotation.y = 0.08
  stage.scene.add(noticePoleA, noticePoleB, noticeBoard)

  // 检修推车
  const cart = new THREE.Group()
  const cartBase = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.24, 2.8),
    new THREE.MeshStandardMaterial({ color: 0x8b7457, roughness: 0.85 }),
  )
  cartBase.position.y = 0.52
  cart.add(cartBase)
  const toolbox = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.45, 0.9),
    new THREE.MeshStandardMaterial({ color: 0xb1823f, roughness: 0.6, metalness: 0.25 }),
  )
  toolbox.position.set(0.2, 0.87, 0.2)
  cart.add(toolbox)
  cart.position.set(-0.1, 0, -10.5)
  stage.scene.add(cart)

  // ---------------------------------------------------------------------------
  // 工人
  // ---------------------------------------------------------------------------

  const mainWorkerPositions = [-7.4, -9.3, -11.5, -13.8, -16.1]
  const mainWorkers = mainWorkerPositions.map((z, index) => {
    const worker = createPerson({
      vestColor: index === 0 ? 0xd7a94d : 0xc79a42,
      helmetColor: 0xe6cc63,
      shirtColor: 0x6a7263,
      trouserColor: 0x545a4e,
      scale: 0.92,
    })
    worker.position.set(index === 2 ? -0.2 : index % 2 === 0 ? 0.52 : -0.55, 0.04, z)
    worker.rotation.y = index % 2 === 0 ? Math.PI : 0
    stage.scene.add(worker)
    return { mesh: worker, home: worker.position.clone(), homeRotation: worker.rotation.clone() }
  })

  const sideWorker = createPerson({
    vestColor: 0x79b3a8,
    helmetColor: 0xe8dfc5,
    shirtColor: 0x5e7671,
    trouserColor: 0x4d5a55,
    scale: 0.9,
  })
  sideWorker.position.set(8.65, 0.04, -12.4)
  sideWorker.rotation.y = Math.PI / 2
  stage.scene.add(sideWorker)
  const sideWorkerHome = sideWorker.position.clone()
  const sideWorkerRotation = sideWorker.rotation.clone()

  // ---------------------------------------------------------------------------
  // 电车与道岔手柄
  // ---------------------------------------------------------------------------

  const trolley = createTrolley()
  const trolleyState = { progress: 0, lastProgress: 0 }
  const initialPoint = mainRoute.getPointAt(0)
  trolley.position.copy(initialPoint)
  const initialTangent = mainRoute.getTangentAt(0)
  trolley.rotation.y = Math.atan2(-initialTangent.x, -initialTangent.z)
  stage.scene.add(trolley)

  /** 按进度把电车放到指定曲线上，并朝向切线方向。 */
  function placeTrolley(route: THREE.CatmullRomCurve3, progress: number): void {
    const point = route.getPointAt(progress)
    const tangent = route.getTangentAt(progress)
    trolley.position.set(point.x, 0.02, point.z)
    trolley.rotation.y = Math.atan2(-tangent.x, -tangent.z)
    const wheels = trolley.userData.wheels as THREE.Mesh[] | undefined
    if (wheels) {
      const delta = Math.max(0, progress - trolleyState.lastProgress)
      for (const wheel of wheels) wheel.rotation.x += delta * 28
    }
    trolleyState.lastProgress = progress
  }

  /** 把世界坐标 z 换算成轨道进度，让撞击在车头真正到达工人时发生。 */
  function progressAtZ(route: THREE.CatmullRomCurve3, z: number): number {
    let best = 0
    let bestDelta = Number.POSITIVE_INFINITY
    for (let index = 0; index <= 260; index += 1) {
      const t = index / 260
      const delta = Math.abs(route.getPointAt(t).z - z)
      if (delta < bestDelta) {
        bestDelta = delta
        best = t
      }
    }
    return best
  }

  const lever = new THREE.Group()
  const leverBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.28, 0.65),
    new THREE.MeshStandardMaterial({ color: 0x6c6f69, roughness: 0.8, metalness: 0.24 }),
  )
  leverBase.position.y = 0.14
  leverBase.castShadow = true
  lever.add(leverBase)
  const leverPivot = new THREE.Group()
  leverPivot.position.set(0, 0.26, 0)
  const leverArm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.055, 1.35, 8),
    new THREE.MeshStandardMaterial({ color: 0x9a927d, roughness: 0.42, metalness: 0.64 }),
  )
  leverArm.position.y = 0.65
  leverPivot.add(leverArm)
  const leverKnob = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 12, 10),
    new THREE.MeshStandardMaterial({
      color: 0xd8644f,
      emissive: 0x6b1f15,
      emissiveIntensity: 0.35,
      roughness: 0.42,
    }),
  )
  leverKnob.position.y = 1.33
  leverPivot.add(leverKnob)
  leverPivot.rotation.z = 0.55
  lever.add(leverPivot)
  // 道岔手柄是本场景的主要可交互物；要保证默认机位下也清晰可见，
  // 不能只依赖热点标记。
  lever.scale.setScalar(1.6)
  lever.position.set(-3.85, 0.04, 12.2)
  stage.scene.add(lever)

  const beaconMaterial = new THREE.MeshStandardMaterial({
    color: 0xff5c3d,
    emissive: 0xff4a2b,
    emissiveIntensity: 1.8,
  })
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), beaconMaterial)
  beacon.position.set(-3.85, 0.62, 12.0)
  stage.scene.add(beacon)
  stage.addUpdater((_delta, elapsed) => {
    const pulse = 1.2 + Math.sin(elapsed * 3.2) * 0.55
    beaconMaterial.emissiveIntensity = pulse
    const redMaterial = signalLights[0].material as THREE.MeshStandardMaterial
    redMaterial.emissiveIntensity = 1.1 + Math.sin(elapsed * 2.6) * 0.5
  })

  // ---------------------------------------------------------------------------
  // 后果演出
  // ---------------------------------------------------------------------------

  /** 在撞击点炸开尘土，并在延时后自动回收临时对象。 */
  function dustBurst(position: THREE.Vector3): void {
    const group = new THREE.Group()
    group.position.copy(position)
    for (let index = 0; index < 14; index += 1) {
      const chunk = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.035 + Math.random() * 0.05, 0),
        new THREE.MeshBasicMaterial({ color: 0x9c7a52, transparent: true, opacity: 0.82 }),
      )
      group.add(chunk)
      tw(chunk.position, {
        x: (Math.random() - 0.5) * 3.2,
        y: 0.2 + Math.random() * 1.7,
        z: (Math.random() - 0.5) * 2.4,
        duration: 0.6 + Math.random() * 0.4,
        ease: 'power2.out',
      })
      tw(chunk.material as THREE.Material, { opacity: 0, duration: 0.8 })
    }
    stage.scene.add(group)
    transient.push(group)
    later(1500, () => {
      const index = transient.indexOf(group)
      if (index >= 0) {
        transient.splice(index, 1)
        group.removeFromParent()
        disposeObject(group)
      }
    })
  }

  /** 让指定工人被撞倒，`direction` 控制倒向哪一侧。 */
  function knockDownWorkers(workers: Array<{ mesh: THREE.Group }>, direction: 1 | -1): void {
    workers.forEach(({ mesh }, index) => {
      tw(mesh.rotation, {
        z: direction * (1.35 + (index % 3) * 0.08),
        x: 0.14,
        duration: 0.5,
        delay: index * 0.08,
        ease: 'power2.in',
      })
      tw(mesh.position, { y: 0.25, duration: 0.5, delay: index * 0.08, ease: 'power2.in' })
    })
  }

  /** 电车沿主线撞向五人：扬尘、倒地，侧线工人惊逃。 */
  function impactMain(): void {
    if (impactState !== 'none') return
    impactState = 'main'
    stage.setAmbience('critical')
    stage.shake(0.38, 0.95)
    dustBurst(new THREE.Vector3(0, 0.7, -11.5))
    knockDownWorkers(mainWorkers, 1)
    tw(sideWorker.position, { x: -4.4, z: -4.5, duration: 1.9, ease: 'power2.inOut' })
    tw(sideWorker.rotation, { y: -1.2, duration: 0.5 })
  }

  /** 电车被扳向侧线撞向一人：主线五人则向反方向逃散。 */
  function impactSide(): void {
    if (impactState !== 'none') return
    impactState = 'side'
    stage.setAmbience('critical')
    stage.shake(0.32, 0.85)
    dustBurst(new THREE.Vector3(8.8, 0.7, -12.4))
    knockDownWorkers([{ mesh: sideWorker }], -1)
    mainWorkers.forEach(({ mesh, home }, index) => {
      tw(mesh.position, {
        x: home.x - 3.6 - index * 0.35,
        z: home.z + 13.5 + index * 0.4,
        duration: 1.6 + index * 0.12,
        delay: 0.3 + index * 0.05,
        ease: 'power2.inOut',
      })
      tw(mesh.rotation, { y: -1.4, duration: 0.42 })
    })
  }

  /** 扳动道岔手柄并让信号灯闪一下，是「切换轨道」的视觉确认。 */
  function pullLever(): void {
    tw(leverPivot.rotation, { z: -0.55, duration: 0.32, ease: 'power2.inOut' })
    tw(beaconMaterial, { emissiveIntensity: 2.6, duration: 0.15, yoyo: true, repeat: 1 })
  }

  // 沿指定曲线推进电车；side 决定最终停在主线还是侧线。
  function runTrolley(route: THREE.CatmullRomCurve3, side: boolean): void {
    trolleyState.progress = 0
    const duration = 4.4
    // 车头在车心前方约 3.05m；让车头到达第一组工人/侧线工人时触发撞击。
    const impactProgress = progressAtZ(route, side ? -9.35 : -10.5)
    tw(trolleyState, {
      progress: 1,
      duration,
      ease: 'none',
      onUpdate: () => placeTrolley(route, trolleyState.progress),
    })
    later(Math.max(600, impactProgress * duration * 1000), () => {
      if (side) impactSide()
      else impactMain()
    })
  }

  // 引擎动作 → 场景演出：切换道岔、推进电车、触发撞击。
  function handleAction(action: string): void {
    switch (action) {
      case 'trolley:reveal':
        stage.showHotspots()
        break
      case 'trolley:switch-side':
        stage.hideHotspots()
        pullLever()
        later(380, () => runTrolley(sideRoute, true))
        break
      case 'trolley:main':
        stage.hideHotspots()
        runTrolley(mainRoute, false)
        break
      case 'trolley:impact-side':
        if (impactState === 'none') later(300, impactSide)
        break
      case 'trolley:impact-main':
        if (impactState === 'none') later(300, impactMain)
        break
      default:
        break
    }
  }

  stage.addHotspot({
    id: 't_lever',
    label: '道岔手柄',
    detail: '机械联锁完好，扳动行程不足一秒。手柄只能从主线切换到侧线，无法再切回主线。',
    tone: 'caution',
    position: [-3.85, 2.6, 12.2],
  })
  stage.addHotspot({
    id: 't_notice',
    label: '调度告示',
    detail: '侧线未经调度许可禁止使用。按规程，你应该先广播警告并请求停止作业，而不是直接改变路径。',
    tone: 'info',
    position: [-2.9, 2.0, 7.0],
  })
  stage.addHotspot({
    id: 't_workers',
    label: '作业人数',
    detail: '主线检修编组 5 人，侧线巡检 1 人。头盔颜色与作业牌编号可以核实，不是传闻。',
    tone: 'danger',
    position: [0.9, 3.0, -11.8],
  })

  /** 恢复初始状态：终止动画、电车归位、工人复位并重置热点。 */
  function resetScene(): void {
    while (animations.length) animations.pop()?.kill()
    for (const object of transient) {
      object.removeFromParent()
      disposeObject(object)
    }
    transient.length = 0
    impactState = 'none'
    trolleyState.progress = 0
    placeTrolley(mainRoute, 0)
    leverPivot.rotation.z = 0.55
    for (const { mesh, home, homeRotation } of mainWorkers) {
      mesh.position.copy(home)
      mesh.rotation.copy(homeRotation)
    }
    sideWorker.position.copy(sideWorkerHome)
    sideWorker.rotation.copy(sideWorkerRotation)
    stage.resetHotspots()
    stage.showHotspots()
    stage.setAmbience('tense', true)
    camera('overview', true)
  }

  stage.setAmbience('tense', true)
  camera('overview', true)

  return {
    focus: (preset) => camera(preset ?? 'overview'),
    applyAction: handleAction,
    setAmbience: (level) => stage.setAmbience(level),
    markHotspot: (id) => stage.markHotspot(id),
    reset: resetScene,
    pause: (paused) => stage.setPaused(paused),
    dispose: () => stage.dispose(),
  }
}
