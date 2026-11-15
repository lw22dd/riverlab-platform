import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { disposeObject, Stage } from '../stage'
import {
  createPerson,
  createRailway,
  createStreetLamp,
  createTree,
} from '../primitives'
import { createTrolley } from './trolley'
import type { CameraPreset, ScenarioSceneOptions, ScenarioStageHandle } from './types'

type StageTween = ReturnType<Stage['after']>
type TweenTarget = Parameters<Stage['tweenTo']>[0]
type TweenVars = Parameters<Stage['tweenTo']>[1]

const DECK_TOP = 4.55
const STOP_Z = 9.35
const WORKER_Z = [-2.6, -4.5, -6.4, -8.3, -10.2]

const CAMERA_PRESETS: Record<string, CameraPreset> = {
  overview: { position: [24, 10, -22], target: [0, 2.4, 0] },
  railing: { position: [4.6, 7.9, -2.2], target: [0.3, 4.2, 3.5] },
  push: { position: [18, 7.6, 5.0], target: [0.4, 2.4, 2.4] },
  stop: { position: [14, 4.5, 12], target: [0.2, 1.2, 5.0] },
  workers: { position: [15, 5.0, -16], target: [0.2, 1.1, -6.0] },
  wreck: { position: [12, 4.2, -2.0], target: [0.2, 1.0, -8.0] },
  evidence: { position: [4.8, 6.2, 7.4], target: [0.9, 4.7, 3.3] },
}

/**
 * 天桥上的路人。刻意做得比工人剪影更宽、更重，
 * 让「唯一足够重的物体」这一前提在视觉上成立。
 */
function createHeavyFigure(): THREE.Group {
  const group = new THREE.Group()
  const coat = new THREE.MeshStandardMaterial({ color: 0x75604a, roughness: 0.92 })
  const coatDark = new THREE.MeshStandardMaterial({ color: 0x554636, roughness: 0.94 })
  const skin = new THREE.MeshStandardMaterial({ color: 0xc99b78, roughness: 0.85 })
  const trousers = new THREE.MeshStandardMaterial({ color: 0x3f444c, roughness: 0.93 })
  const shoes = new THREE.MeshStandardMaterial({ color: 0x23262a, roughness: 0.82 })

  const legGeometry = new THREE.CylinderGeometry(0.14, 0.16, 0.74, 10)
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(legGeometry, trousers)
    leg.position.set(side * 0.19, 0.41, 0)
    leg.castShadow = true
    group.add(leg)

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.4), shoes)
    shoe.position.set(side * 0.19, 0.08, -0.05)
    shoe.castShadow = true
    group.add(shoe)
  }

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.64, 6, 14), coat)
  torso.position.set(0, 1.16, 0)
  torso.scale.set(1.12, 1, 0.94)
  torso.castShadow = true
  group.add(torso)

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.44, 20, 16), coat)
  belly.position.set(0, 1.0, -0.04)
  belly.scale.set(1.08, 0.9, 1.04)
  belly.castShadow = true
  group.add(belly)

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.2, 12), coatDark)
  collar.position.y = 1.62
  group.add(collar)

  const armGeometry = new THREE.CapsuleGeometry(0.115, 0.52, 4, 10)
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(armGeometry, coat)
    arm.position.set(side * 0.47, 1.12, 0)
    arm.rotation.z = side * 0.26
    arm.castShadow = true
    group.add(arm)
  }

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.215, 16, 12), skin)
  head.position.y = 1.79
  head.castShadow = true
  group.add(head)

  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.222, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.52),
    new THREE.MeshStandardMaterial({ color: 0x2c2520, roughness: 0.96 }),
  )
  hair.position.y = 1.81
  group.add(hair)

  group.userData = { kind: 'heavy-person' }
  return group
}

/**
 * 构建天桥电车场景：主线五人、侧线一人，以及桥上唯一足够重的路人。
 * 推人、呼喊、拉停等选择会播放不同的演出序列。
 */
export function buildFootbridgeScene(
  host: HTMLElement,
  options: ScenarioSceneOptions,
): ScenarioStageHandle {
  const stage = new Stage(host, {
    reducedMotion: options.reducedMotion,
    cinematic: options.cinematicCamera,
  })
  stage.onHotspot(options.onInspect)

  stage.defineAmbience('calm', {
    background: 0xe3eef3,
    fogColor: 0xf3e8d7,
    fogDensity: 0.009,
    sunIntensity: 2.5,
    sunColor: 0xfff0d0,
    fillIntensity: 1.15,
    exposure: 1.04,
  })
  stage.defineAmbience('tense', {
    background: 0xd8e5ec,
    fogColor: 0xecdfc9,
    fogDensity: 0.012,
    sunIntensity: 2.6,
    sunColor: 0xffe2b8,
    fillIntensity: 1.2,
    exposure: 1.05,
  })
  stage.defineAmbience('critical', {
    background: 0xf2ddd5,
    fogColor: 0xf0d0c3,
    fogDensity: 0.015,
    sunIntensity: 2.7,
    sunColor: 0xffc6a8,
    fillIntensity: 1.24,
    exposure: 1.06,
  })

  const animations: StageTween[] = []
  const transient: THREE.Object3D[] = []
  let outcomeState: 'none' | 'push' | 'shout' | 'hold' = 'none'

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
  // 光照、天空与地形
  // ---------------------------------------------------------------------------

  const fillLight = new THREE.DirectionalLight(0xd9e6f0, 0.34)
  fillLight.position.set(-18, 16, -22)
  stage.scene.add(fillLight)

  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x9cc6e8) },
      horizonColor: { value: new THREE.Color(0xf6d7a6) },
      bottomColor: { value: new THREE.Color(0xe3eef3) },
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
    new THREE.MeshStandardMaterial({ color: 0x93a473, roughness: 0.96 }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  stage.scene.add(ground)

  const hillsMaterial = new THREE.MeshStandardMaterial({ color: 0x7d9663, roughness: 0.98, flatShading: true })
  const hillSpecs = [
    [-48, -40, 32, 11, 19],
    [40, -50, 36, 12, 23],
    [-58, 16, 27, 9, 17],
    [52, 22, 29, 8, 18],
    [6, -76, 48, 12, 25],
  ] as const
  for (const [x, z, sx, sy, sz] of hillSpecs) {
    const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 10), hillsMaterial)
    hill.scale.set(sx, sy, sz)
    hill.position.set(x, -2.5, z)
    hill.receiveShadow = true
    stage.scene.add(hill)
  }

  // ---------------------------------------------------------------------------
  // 轨道与电车路线
  // ---------------------------------------------------------------------------

  const railPoints = [
    new THREE.Vector3(0, 0, 46),
    new THREE.Vector3(0, 0, 24),
    new THREE.Vector3(0.1, 0, 6),
    new THREE.Vector3(0, 0, -10),
    new THREE.Vector3(-0.2, 0, -44),
  ]
  const railway = createRailway({ points: railPoints, gauge: 1.45 })
  stage.scene.add(railway.group)

  const trolleyRoute = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(0, 0, 20),
      new THREE.Vector3(0, 0, 14),
      new THREE.Vector3(0.05, 0, 8),
      new THREE.Vector3(0, 0, 2),
      new THREE.Vector3(0, 0, -6),
      new THREE.Vector3(0.05, 0, -15),
    ],
    false,
    'catmullrom',
    0.1,
  )

  const trolley = createTrolley()
  const trolleyState = { progress: 0 }
  stage.scene.add(trolley)

  /** 按进度把电车放到轨道上，并让车头朝向切线方向。 */
  function placeTrolley(progress: number): void {
    const point = trolleyRoute.getPointAt(progress)
    const tangent = trolleyRoute.getTangentAt(progress)
    trolley.position.set(point.x, 0.02, point.z)
    trolley.rotation.y = Math.atan2(-tangent.x, -tangent.z)
  }

  /** 把世界坐标 z 换算成轨道进度，方便按「撞击点」定位电车。 */
  function progressAtZ(z: number): number {
    let best = 0
    let bestDelta = Number.POSITIVE_INFINITY
    for (let index = 0; index <= 240; index += 1) {
      const t = index / 240
      const delta = Math.abs(trolleyRoute.getPointAt(t).z - z)
      if (delta < bestDelta) {
        bestDelta = delta
        best = t
      }
    }
    return best
  }

  placeTrolley(0)

  // ---------------------------------------------------------------------------
  // 天桥
  // ---------------------------------------------------------------------------

  const bridge = new THREE.Group()
  const concrete = new THREE.MeshStandardMaterial({ color: 0xb5b1a4, roughness: 0.92 })
  const concreteDark = new THREE.MeshStandardMaterial({ color: 0x8d897c, roughness: 0.94 })
  const steel = new THREE.MeshStandardMaterial({ color: 0x5d6467, roughness: 0.55, metalness: 0.55 })

  const deck = new THREE.Mesh(new RoundedBoxGeometry(19.4, 0.32, 3.6, 2, 0.07), concrete)
  deck.position.set(0, DECK_TOP - 0.16, 2.4)
  deck.castShadow = true
  deck.receiveShadow = true
  bridge.add(deck)

  for (const z of [0.9, 3.9]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(19.4, 0.34, 0.24), concreteDark)
    beam.position.set(0, DECK_TOP - 0.42, z)
    beam.castShadow = true
    bridge.add(beam)
  }

  for (const x of [-4.9, 4.9]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(0.72, DECK_TOP - 0.5, 0.72), concreteDark)
    pier.position.set(x, (DECK_TOP - 0.5) / 2, 2.4)
    pier.castShadow = true
    pier.receiveShadow = true
    bridge.add(pier)

    const footing = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.24, 1.15), concrete)
    footing.position.set(x, 0.12, 2.4)
    footing.receiveShadow = true
    bridge.add(footing)
  }

  for (const z of [0.62, 4.18]) {
    for (let x = -9.2; x <= 9.2; x += 1.53) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.075, 1.16, 0.075), steel)
      post.position.set(x, DECK_TOP + 0.58, z)
      post.castShadow = true
      bridge.add(post)
    }
    for (const y of [DECK_TOP + 1.14, DECK_TOP + 0.72]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(18.9, 0.06, 0.06), steel)
      rail.position.set(0, y, z)
      bridge.add(rail)
    }
  }

  for (const side of [-1, 1]) {
    for (let step = 0; step < 7; step += 1) {
      const stair = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.18, 2.3), concrete)
      stair.position.set(side * (9.9 + step * 0.62), DECK_TOP - 0.34 - step * 0.58, 2.4)
      stair.castShadow = true
      stair.receiveShadow = true
      bridge.add(stair)
    }
    const landing = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.2, 2.6), concreteDark)
    landing.position.set(side * 14.6, 0.1, 2.4)
    landing.receiveShadow = true
    bridge.add(landing)
  }

  stage.scene.add(bridge)

  const beaconMaterial = new THREE.MeshStandardMaterial({
    color: 0xff5c3d,
    emissive: 0xff4a2b,
    emissiveIntensity: 1.5,
  })
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), beaconMaterial)
  beacon.position.set(-8.9, DECK_TOP + 1.3, 4.18)
  stage.scene.add(beacon)

  // 推人后，桥面上会留下一部手机；这是刚才站在这里的人唯一的痕迹。
  const phoneMaterial = new THREE.MeshStandardMaterial({
    color: 0xdff4ff,
    emissive: 0x8fd8ff,
    emissiveIntensity: 1.2,
    roughness: 0.2,
  })
  const phone = new THREE.Group()
  const phoneBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.02, 0.21),
    new THREE.MeshStandardMaterial({ color: 0x1a1f24, roughness: 0.5 }),
  )
  const phoneScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.18), phoneMaterial)
  phoneScreen.rotation.x = -Math.PI / 2
  phoneScreen.position.y = 0.012
  phone.add(phoneBody, phoneScreen)
  phone.position.set(0.9, DECK_TOP + 0.02, 3.62)
  phone.rotation.y = 0.4
  phone.visible = false
  stage.scene.add(phone)

  // ---------------------------------------------------------------------------
  // 场地周边道具
  // ---------------------------------------------------------------------------

  const fenceMaterial = new THREE.MeshStandardMaterial({ color: 0x8f887a, roughness: 0.86, metalness: 0.2 })
  const wireMaterial = new THREE.LineBasicMaterial({ color: 0x817966, transparent: true, opacity: 0.6 })
  const fenceSegments: Array<[number, number]> = [
    [-34, -5],
    [10, 30],
  ]
  for (const side of [-1, 1]) {
    for (const [from, to] of fenceSegments) {
      for (let z = from; z <= to; z += 3.2) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.5, 0.08), fenceMaterial)
        post.position.set(side * 7.6, 0.75, z)
        stage.scene.add(post)
      }
      for (const y of [0.55, 1.05, 1.42]) {
        const points = [
          new THREE.Vector3(side * 7.6, y, from),
          new THREE.Vector3(side * 7.6, y, to),
        ]
        stage.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), wireMaterial))
      }
    }
  }

  const lamps = [
    [-8.6, 0.6, 13, 0xffc87c],
    [8.8, 0.6, -16, 0xffb86b],
    [-8.2, 0.6, -26, 0xffcf91],
  ] as const
  for (const [x, y, z, color] of lamps) {
    const lamp = createStreetLamp({ color, light: true })
    lamp.position.set(x, y, z)
    lamp.rotation.y = Math.PI / 2
    stage.scene.add(lamp)
  }

  const treePositions = [
    [-12.5, 20, 1.3],
    [-13, 8, 1.15],
    [-12, -9, 1.3],
    [-12.5, -24, 1.2],
    [14.5, 14, 1.25],
    [16, -2, 1.35],
    [13.5, -25, 1.1],
  ] as const
  for (const [x, z, scale] of treePositions) {
    const tree = createTree({ scale, color: 0x719d5c })
    tree.position.set(x, 0, z)
    stage.scene.add(tree)
  }

  const signalPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.07, 3.2, 8),
    new THREE.MeshStandardMaterial({ color: 0x7a8384, metalness: 0.55, roughness: 0.4 }),
  )
  signalPole.position.set(3.3, 1.6, 7.2)
  stage.scene.add(signalPole)
  const signalBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.92, 0.24),
    new THREE.MeshStandardMaterial({ color: 0x4e5557, roughness: 0.6 }),
  )
  signalBox.position.set(3.3, 3.05, 7.2)
  stage.scene.add(signalBox)
  const signalRed = new THREE.Mesh(
    new THREE.SphereGeometry(0.095, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xff4b35, emissive: 0xff4b35, emissiveIntensity: 1.6 }),
  )
  signalRed.position.set(3.3, 3.38, 7.08)
  stage.scene.add(signalRed)

  const noticePole = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.5, 0.08), fenceMaterial)
  noticePole.position.set(-5.6, 0.75, 8.4)
  const noticeBoard = new THREE.Mesh(
    new THREE.BoxGeometry(1.55, 0.82, 0.06),
    new THREE.MeshStandardMaterial({ color: 0xb8b29a, roughness: 0.82 }),
  )
  noticeBoard.position.set(-5.0, 1.32, 8.4)
  noticeBoard.rotation.y = -0.12
  stage.scene.add(noticePole, noticeBoard)

  // 五名工人旁的检修推车。
  const cart = new THREE.Group()
  const cartBase = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.24, 2.6),
    new THREE.MeshStandardMaterial({ color: 0x8b7457, roughness: 0.85 }),
  )
  cartBase.position.y = 0.52
  cart.add(cartBase)
  const toolbox = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.44, 0.86),
    new THREE.MeshStandardMaterial({ color: 0xb1823f, roughness: 0.6, metalness: 0.25 }),
  )
  toolbox.position.set(0.15, 0.86, 0.15)
  cart.add(toolbox)
  cart.position.set(2.4, 0, -8.6)
  stage.scene.add(cart)

  // ---------------------------------------------------------------------------
  // 人物
  // ---------------------------------------------------------------------------

  const player = createPerson({
    vestColor: 0x4d5f68,
    shirtColor: 0x3c4a52,
    trouserColor: 0x2f373d,
    helmet: false,
    scale: 0.98,
  })
  player.position.set(-0.9, DECK_TOP, 2.85)
  stage.scene.add(player)

  const heavy = createHeavyFigure()
  heavy.position.set(0.2, DECK_TOP, 3.55)
  stage.scene.add(heavy)

  const workers = WORKER_Z.map((z, index) => {
    const worker = createPerson({
      vestColor: index === 0 ? 0xd7a94d : 0xc79a42,
      helmetColor: 0xe6cc63,
      shirtColor: 0x6a7263,
      trouserColor: 0x545a4e,
      scale: 0.92,
    })
    worker.position.set(index % 2 === 0 ? 0.55 : -0.55, 0.04, z)
    stage.scene.add(worker)
    return { mesh: worker, home: worker.position.clone(), homeRotation: worker.rotation.clone() }
  })

  const playerHome = player.position.clone()
  const playerRotation = player.rotation.clone()
  const heavyHome = heavy.position.clone()
  const heavyRotation = heavy.rotation.clone()

  // ---------------------------------------------------------------------------
  // 撞击辅助效果
  // ---------------------------------------------------------------------------

  const impactLight = new THREE.PointLight(0xffb26b, 0, 16, 2)
  impactLight.position.set(0.2, 1.4, 5.6)
  stage.scene.add(impactLight)

  /** 在指定位置炸开一小团尘土，用于撞击与落地反馈。 */
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

  /** 电车停下后，五名工人惊魂未定地向两侧退开。 */
  function reactSurvivors(): void {
    workers.forEach(({ mesh, home }, index) => {
      tw(mesh.position, {
        x: home.x + (index % 2 === 0 ? 1.0 : -1.0),
        z: home.z - 1.6 - index * 0.18,
        duration: 1.2,
        delay: 0.1 + index * 0.08,
        ease: 'power2.out',
      })
      tw(mesh.rotation, {
        y: (index % 2 === 0 ? 0.8 : -0.8),
        duration: 0.5,
        delay: 0.1 + index * 0.08,
      })
    })
  }

  /** 工人们听到呼喊后转身并朝来车方向移动，表现「被警告」但来不及撤离。 */
  function warnWorkers(): void {
    workers.forEach(({ mesh, home, homeRotation }, index) => {
      tw(mesh.rotation, {
        y: homeRotation.y + Math.PI,
        duration: 0.35,
        delay: index * 0.05,
      })
      tw(mesh.position, {
        x: home.x + (index % 2 === 0 ? 0.5 : -0.5),
        z: home.z - 0.9,
        duration: 0.9,
        delay: index * 0.05,
        ease: 'power2.out',
      })
    })
  }

  /** 电车撞上人群后的倒地动画。 */
  function knockWorkers(): void {
    workers.forEach(({ mesh, home }, index) => {
      tw(mesh.rotation, {
        z: (index % 2 === 0 ? 1 : -1) * 1.35,
        x: 0.16,
        duration: 0.5,
        delay: index * 0.07,
        ease: 'power2.in',
      })
      tw(mesh.position, {
        y: 0.24,
        z: home.z - 0.9,
        duration: 0.5,
        delay: index * 0.07,
        ease: 'power2.in',
      })
    })
  }

  // ---------------------------------------------------------------------------
  // 演出序列
  // ---------------------------------------------------------------------------

  /**
   * 推人是一个直接的身体动作：玩家的手够到路人，
   * 路人身体翻过护栏，随后电车才抵达。
   */
  function pushSequence(): void {
    if (outcomeState !== 'none') return
    outcomeState = 'push'
    stage.hideHotspots()
    stage.setAmbience('critical')
    camera('push')

    tw(player.position, { x: -0.4, z: 3.1, duration: 0.26, ease: 'power2.out' })
    tw(player.rotation, { x: 0.24, duration: 0.26, ease: 'power2.out' })
    tw(heavy.rotation, { x: 0.14, duration: 0.16, ease: 'power2.out' })

    later(180, () => {
      stage.shake(0.16, 0.35)
      tw(heavy.rotation, { x: 1.28, duration: 0.52, ease: 'power2.in' })
      tw(heavy.position, { z: 4.12, duration: 0.52, ease: 'power2.in' })
    })

    later(700, () => {
      tw(heavy.position, { x: 0.32, y: 0.3, z: 4.5, duration: 0.62, ease: 'power2.in' })
      tw(heavy.rotation, { x: 1.52, z: 0.18, duration: 0.62, ease: 'power2.in' })
      tw(player.position, { x: -1.2, z: 2.55, duration: 0.52, ease: 'power2.out' })
      tw(player.rotation, { x: -0.06, duration: 0.6, ease: 'power2.out' })
    })

    later(1300, () => {
      dustBurst(new THREE.Vector3(0.35, 0.4, 5.2))
      stage.shake(0.34, 0.7)
      tw(impactLight, { intensity: 22, duration: 0.1, yoyo: true, repeat: 1 })
      phone.visible = true
    })

    later(1520, runToStop)
  }

  /** 路人被推下轨道后，电车受撞击减速并最终停在桥下。 */
  function runToStop(): void {
    const target = progressAtZ(STOP_Z)
    trolleyState.progress = 0
    placeTrolley(0)

    tw(trolleyState, {
      progress: target * 0.72,
      duration: 1.25,
      ease: 'power1.in',
      onUpdate: () => placeTrolley(trolleyState.progress),
    })

    later(1250, () => {
      stage.shake(0.42, 0.9)
      dustBurst(new THREE.Vector3(0.35, 0.9, 6.1))
      tw(impactLight, { intensity: 30, duration: 0.1, yoyo: true, repeat: 1 })
      camera('stop')
      tw(trolleyState, {
        progress: target,
        duration: 1.2,
        ease: 'power3.out',
        onUpdate: () => placeTrolley(trolleyState.progress),
      })
      tw(trolley.rotation, { x: 0.04, duration: 0.3, yoyo: true, repeat: 1, ease: 'power2.out' })
    })

    later(2750, () => {
      tw(trolleyState, {
        progress: target - 0.012,
        duration: 0.5,
        ease: 'power2.out',
        onUpdate: () => placeTrolley(trolleyState.progress),
      })
      stage.shake(0.18, 0.4)
      dustBurst(new THREE.Vector3(0.4, 0.45, 6.2))
      reactSurvivors()
    })
  }

  /** 「按兵不动」：玩家退开，电车继续冲向主线的五名工人。 */
  function holdSequence(): void {
    if (outcomeState !== 'none') return
    outcomeState = 'hold'
    stage.hideHotspots()
    stage.setAmbience('critical')
    camera('workers')

    tw(player.position, { x: -1.28, z: 2.45, duration: 0.6, ease: 'power2.out' })
    tw(player.rotation, { x: -0.12, duration: 0.6, ease: 'power2.out' })
    tw(heavy.position, { z: 3.28, duration: 0.5, ease: 'power2.out' })
    tw(heavy.rotation, { y: -0.35, duration: 0.4, ease: 'power2.out' })

    later(300, () => runToWorkers(false))
  }

  /** 「大声呼喊」：玩家尝试用警告代替身体干预，结果取决于工人能否及时撤离。 */
  function shoutSequence(): void {
    if (outcomeState !== 'none') return
    outcomeState = 'shout'
    stage.hideHotspots()
    stage.setAmbience('critical')
    camera('workers')

    tw(player.position, { y: DECK_TOP + 0.16, duration: 0.22, yoyo: true, repeat: 3, ease: 'power2.out' })
    tw(player.rotation, { x: 0.2, duration: 0.2, yoyo: true, repeat: 3, ease: 'power2.out' })
    tw(heavy.rotation, { y: 0.45, duration: 0.3, ease: 'power2.out' })

    later(200, warnWorkers)
    later(400, () => runToWorkers(true))
  }

  /** 电车沿主线冲向五名工人；`warned` 决定提前量，因此碰撞时间略有差异。 */
  function runToWorkers(warned: boolean): void {
    trolleyState.progress = 0
    placeTrolley(0)

    tw(trolleyState, {
      progress: 1,
      duration: warned ? 3.8 : 3.5,
      ease: 'power1.in',
      onUpdate: () => placeTrolley(trolleyState.progress),
    })

    later(warned ? 3100 : 2900, () => {
      stage.shake(0.5, 1.0)
      tw(impactLight, { intensity: 34, duration: 0.12, yoyo: true, repeat: 2 })
      for (const worker of workers) {
        dustBurst(new THREE.Vector3(worker.mesh.position.x, 0.6, worker.mesh.position.z))
      }
      knockWorkers()
      camera('wreck')
    })

    later(4200, () => {
      stage.setAmbience('critical')
      tw(player.rotation, { x: 0.28, duration: 0.9, ease: 'power2.out' })
      tw(heavy.position, { z: 2.9, duration: 0.9, ease: 'power2.out' })
    })
  }

  // 将决策动作映射为推人、拉停或呼喊等演出序列。
  function handleAction(action: string): void {
    switch (action) {
      case 'footbridge:reveal':
        stage.showHotspots()
        break
      case 'footbridge:push':
        pushSequence()
        break
      case 'footbridge:shout':
        shoutSequence()
        break
      case 'footbridge:hold':
        holdSequence()
        break
      case 'footbridge:stop':
        camera('stop')
        break
      default:
        break
    }
  }

  // ---------------------------------------------------------------------------
  // 热点
  // ---------------------------------------------------------------------------

  stage.addHotspot({
    id: 'f_railing',
    label: '天桥护栏',
    detail: '护栏高约 1.1 米，没有缺口，也没有可以投下的重物。要把一个人送下轨道，你必须先接触他，再把他抬过或推过这道栏杆。',
    tone: 'caution',
    position: [-2.3, DECK_TOP + 1.5, 4.18],
  })
  stage.addHotspot({
    id: 'f_body',
    label: '身旁的路人',
    detail: '体型明显超过普通成人。从高度与落点判断，他的重量足以让电车脱轨或被迫停下。他没有参与这次决定，也没有被告知风险。',
    tone: 'danger',
    position: [0.2, DECK_TOP + 2.5, 3.55],
  })
  stage.addHotspot({
    id: 'f_workers',
    label: '轨道上的五人',
    detail: '主线检修组 5 人，作业牌编号与安全帽颜色可以核实。他们没有察觉来车方向，也无法在剩余时间内全部撤离。',
    tone: 'danger',
    position: [0.6, 1.8, -6.2],
  })
  stage.addHotspot({
    id: 'f_track',
    label: '主线与制动距离',
    detail: '轨道前方没有侧线、没有道岔，也没有手动制动装置。只有在桥下这段直线距离内被足够大的质量阻挡，电车才可能停下。',
    tone: 'info',
    position: [-3.2, 1.3, 5.2],
  })

  // ---------------------------------------------------------------------------
  // 环境脉动
  // ---------------------------------------------------------------------------

  stage.addUpdater((_delta, elapsed) => {
    beaconMaterial.emissiveIntensity = 1.1 + Math.sin(elapsed * 3.2) * 0.45
    beacon.rotation.y = elapsed * 0.6
    const red = signalRed.material as THREE.MeshStandardMaterial
    red.emissiveIntensity = 1.15 + Math.sin(elapsed * 2.6) * 0.5
    if (phone.visible) {
      phoneMaterial.emissiveIntensity = 1.3 + Math.sin(elapsed * 5.4) * 0.55
    }
  })

  // ---------------------------------------------------------------------------
  // 重置
  // ---------------------------------------------------------------------------

  /** 恢复初始状态：终止动画、清除临时物体、还原电车与人、重置热点。 */
  function resetScene(): void {
    while (animations.length) animations.pop()?.kill()
    for (const object of transient) {
      object.removeFromParent()
      disposeObject(object)
    }
    transient.length = 0
    outcomeState = 'none'

    trolleyState.progress = 0
    placeTrolley(0)
    trolley.rotation.x = 0

    player.position.copy(playerHome)
    player.rotation.copy(playerRotation)
    heavy.position.copy(heavyHome)
    heavy.rotation.copy(heavyRotation)

    for (const { mesh, home, homeRotation } of workers) {
      mesh.position.copy(home)
      mesh.rotation.copy(homeRotation)
    }

    phone.visible = false
    impactLight.intensity = 0

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
