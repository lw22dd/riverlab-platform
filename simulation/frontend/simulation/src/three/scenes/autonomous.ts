import * as THREE from 'three'
import { disposeObject, Stage } from '../stage'
import {
  createBuilding,
  createCar,
  createCrosswalk,
  createGuardrail,
  createPerson,
  createPuddle,
  createRain,
  createRoad,
  createStreetLamp,
  createTree,
  createTruck,
} from '../primitives'
import type { CameraPreset, ScenarioSceneOptions, ScenarioStageHandle } from './types'

type StageTween = ReturnType<Stage['after']>
type TweenTarget = Parameters<Stage['tweenTo']>[0]
type TweenVars = Parameters<Stage['tweenTo']>[1]

const CAMERA_PRESETS: Record<string, CameraPreset> = {
  overview: { position: [-1.2, 5.2, 36], target: [1.6, 1.4, 1] },
  car: { position: [4.8, 4.6, 34], target: [2.2, 0.9, 16] },
  cockpit: { position: [2.7, 1.85, 16.8], target: [2.7, 1.4, -6] },
  crosswalk: { position: [-4.5, 6, 30], target: [1.2, -0.6, -0.5] },
  guardrail: { position: [10.5, 3.5, 13], target: [4.6, 1, 4] },
  truck: { position: [-11, 4.6, -9], target: [-1.5, 1.2, 2] },
  aftermath: { position: [8.2, 5.2, 14], target: [0.4, 1, 3] },
  evidence: { position: [6.2, 2.4, 15.4], target: [2.5, 1.2, 19.5] },
}

/**
 * 构建自动驾驶场景：雨夜街口、儿童、对向货车与制动距离。
 * 返回的 handle 把引擎动作转成撞击、避让等演出。
 */
export function buildAutonomousScene(
  host: HTMLElement,
  options: ScenarioSceneOptions,
): ScenarioStageHandle {
  const stage = new Stage(host, {
    reducedMotion: options.reducedMotion,
    cinematic: options.cinematicCamera,
  })
  stage.onHotspot(options.onInspect)

  stage.defineAmbience('calm', {
    background: 0xdcebf8,
    fogColor: 0xe8f2fa,
    fogDensity: 0.009,
    sunIntensity: 2.5,
    sunColor: 0xfff4e4,
    fillIntensity: 1.2,
    exposure: 1.04,
  })
  stage.defineAmbience('tense', {
    background: 0xc9dbe9,
    fogColor: 0xdbe8f2,
    fogDensity: 0.011,
    sunIntensity: 2.6,
    sunColor: 0xfff0dc,
    fillIntensity: 1.18,
    exposure: 1.03,
  })
  stage.defineAmbience('critical', {
    background: 0xf2dede,
    fogColor: 0xf6e5e2,
    fogDensity: 0.012,
    sunIntensity: 2.75,
    sunColor: 0xffd9c6,
    fillIntensity: 1.25,
    exposure: 1.06,
  })

  const animations: StageTween[] = []
  const transient: THREE.Object3D[] = []
  let impactState: 'none' | 'peds' | 'barrier' | 'truck' = 'none'
  let edrRevealed = false
  let annotationReveal: HTMLElement | null = null

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

  function focusPreset(preset?: string): void {
    camera(preset ?? 'overview')
  }

  // ---------------------------------------------------------------------------
  // 静态城市街区
  // ---------------------------------------------------------------------------

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(190, 190),
    new THREE.MeshStandardMaterial({ color: 0x9aaf8f, roughness: 0.96, metalness: 0.02 }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  stage.scene.add(ground)

  const road = createRoad({ width: 11.2, length: 110, color: 0x7c8a96, wet: true })
  road.position.y = 0.002
  stage.scene.add(road)

  const crosswalk = createCrosswalk(9.8, 0)
  stage.scene.add(crosswalk)

  const buildingSpecs = [
    { side: -1, z: -37, w: 12, h: 24, d: 12, seed: 2 },
    { side: -1, z: -20, w: 9, h: 15, d: 10, seed: 7 },
    { side: -1, z: -3, w: 11, h: 27, d: 12, seed: 11 },
    { side: -1, z: 16, w: 8, h: 12, d: 9, seed: 13 },
    { side: -1, z: 31, w: 13, h: 21, d: 13, seed: 17 },
    { side: 1, z: -34, w: 10, h: 18, d: 11, seed: 5 },
    { side: 1, z: -16, w: 13, h: 29, d: 13, seed: 9 },
    { side: 1, z: 2, w: 9, h: 14, d: 9, seed: 19 },
    { side: 1, z: 19, w: 12, h: 22, d: 11, seed: 23 },
    { side: 1, z: 37, w: 11, h: 17, d: 12, seed: 29 },
  ]

  for (const spec of buildingSpecs) {
    const building = createBuilding({
      width: spec.w,
      height: spec.h,
      depth: spec.d,
      seed: spec.seed,
      litRatio: 0.3,
      windowWarm: spec.side === 1 ? 0.7 : 0.55,
    })
    building.position.set(spec.side * (8.7 + spec.w / 2), 0, spec.z)
    stage.scene.add(building)
  }

  const storefrontMaterial = new THREE.MeshStandardMaterial({
    color: 0x72e1ef,
    emissive: 0x4cd9e8,
    emissiveIntensity: 1.2,
    transparent: true,
    opacity: 0.88,
  })
  for (const z of [-20, 19]) {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.13), storefrontMaterial)
    sign.position.set(-8.62, 4.8, z)
    sign.rotation.y = Math.PI / 2
    stage.scene.add(sign)
  }
  const amberSignMaterial = new THREE.MeshStandardMaterial({
    color: 0xffc678,
    emissive: 0xffb45d,
    emissiveIntensity: 1.1,
    transparent: true,
    opacity: 0.9,
  })
  const amberSign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.11), amberSignMaterial)
  amberSign.position.set(8.62, 5.4, -16)
  amberSign.rotation.y = -Math.PI / 2
  stage.scene.add(amberSign)

  const lampPositions = [
    [-6.15, 32],
    [-6.15, 18],
    [-6.15, -6],
    [-6.15, -22],
    [6.15, 28],
    [6.15, 13],
    [6.15, -8],
    [6.15, -24],
  ] as const
  lampPositions.forEach(([x, z], index) => {
    const lamp = createStreetLamp({ light: index % 2 === 0 })
    lamp.position.set(x, 0, z)
    lamp.rotation.y = x > 0 ? -Math.PI / 2 : Math.PI / 2
    stage.scene.add(lamp)
  })

  const treePositions = [
    [-7.55, 25],
    [-7.55, 8],
    [-7.55, -12],
    [-7.55, -29],
    [7.6, 35],
    [7.6, 21],
    [7.6, -12],
    [7.6, -32],
  ] as const
  treePositions.forEach(([x, z], index) => {
    const tree = createTree({ scale: 0.9 + (index % 3) * 0.12, color: index % 2 === 0 ? 0x6f9c5d : 0x7eab67 })
    tree.position.set(x, 0, z)
    stage.scene.add(tree)
  })

  const guardrailRightA = createGuardrail({ length: 25, color: 0xc3ced8 })
  guardrailRightA.position.set(5.82, 0, -17)
  stage.scene.add(guardrailRightA)
  const guardrailRightB = createGuardrail({ length: 22, color: 0xc3ced8 })
  guardrailRightB.position.set(5.82, 0, 16)
  stage.scene.add(guardrailRightB)

  for (const [x, z, radius] of [
    [2.2, 15, 1.8],
    [-1.5, 26, 1.3],
    [3.8, -10, 1.5],
    [-3.2, -20, 1.9],
    [1.2, 36, 1.2],
  ] as const) {
    const puddle = createPuddle({ radius })
    puddle.position.set(x, 0.019, z)
    stage.scene.add(puddle)
  }

  // 人行横道信号灯
  const signPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.055, 2.9, 8),
    new THREE.MeshStandardMaterial({ color: 0x808d98, metalness: 0.55, roughness: 0.4 }),
  )
  signPole.position.set(7.15, 1.45, -2.2)
  stage.scene.add(signPole)
  const signBoard = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.7, 0.07),
    new THREE.MeshStandardMaterial({
      color: 0x2f86b5,
      emissive: 0x1a6387,
      emissiveIntensity: 0.7,
      roughness: 0.35,
    }),
  )
  signBoard.position.set(7.15, 2.65, -2.2)
  stage.scene.add(signBoard)
  const signGlyph = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.12),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 }),
  )
  signGlyph.position.set(7.15, 2.65, -2.15)
  signGlyph.rotation.y = Math.PI
  stage.scene.add(signGlyph)

  // ---------------------------------------------------------------------------
  // 雨幕
  // ---------------------------------------------------------------------------

  const rain = createRain({ count: 1200, center: new THREE.Vector3(0, 0, 4), area: { x: 48, y: 25, z: 92 } })
  stage.scene.add(rain.group)
  stage.addUpdater((delta) => rain.update(delta))

  // ---------------------------------------------------------------------------
  // 场景实体
  // ---------------------------------------------------------------------------

  const ego = createCar({ color: 0x3f7fbf, autonomous: true, headlights: true })
  const egoHome = new THREE.Vector3(2.6, 0.015, 20)
  ego.position.copy(egoHome)
  stage.scene.add(ego)

  const sensor = ego.userData.sensor as { sensor: THREE.Mesh; ring: THREE.Mesh } | undefined
  if (sensor) {
    stage.addUpdater((delta) => {
      sensor.ring.rotation.z += delta * 0.45
      const pulse = 1 + Math.sin(performance.now() * 0.0022) * 0.08
      sensor.ring.scale.setScalar(pulse)
    })
  }

  const truck = createTruck()
  truck.position.set(-2.65, 0.01, -25)
  truck.rotation.y = Math.PI
  stage.scene.add(truck)

  const childSpecs = [
    { x: 3.5, z: 0.9, color: 0xd47a62, shirt: 0x627586 },
    { x: 1.9, z: -0.4, color: 0x77a8c7, shirt: 0x6c7f8e },
    { x: 0.3, z: 0.8, color: 0xd8b75b, shirt: 0x687b8a },
  ] as const
  const children = childSpecs.map((spec, index) => {
    const person = createPerson({
      vestColor: spec.color,
      shirtColor: spec.shirt,
      trouserColor: 0x4f5d6a,
      scale: 0.78,
      helmet: false,
    })
    person.position.set(spec.x, 0.03, spec.z)
    person.rotation.y = index === 1 ? -0.3 : index * 0.45
    stage.scene.add(person)
    return { mesh: person, home: new THREE.Vector3(spec.x, 0.03, spec.z) }
  })

  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xeef3f6, roughness: 0.5 }),
  )
  ball.position.set(4.35, 0.14, 1.8)
  stage.scene.add(ball)

  // 刹车痕迹
  const skidMaterial = new THREE.MeshBasicMaterial({ color: 0x2a2f34, transparent: true, opacity: 0 })
  const skidGroup = new THREE.Group()
  for (const x of [-0.73, 0.73]) {
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 15.5), skidMaterial)
    mark.rotation.x = -Math.PI / 2
    mark.position.set(x, 0.023, 11.4)
    skidGroup.add(mark)
  }
  ego.add(skidGroup)

  // 传感器轨迹线，在「感知告警」节点显示。
  const trajectoryGroup = new THREE.Group()
  const trajectoryMaterials: THREE.LineDashedMaterial[] = []
  const origin = new THREE.Vector3(2.6, 0.9, 17.7)
  for (const child of children) {
    const material = new THREE.LineDashedMaterial({
      color: 0xe05d42,
      dashSize: 0.38,
      gapSize: 0.22,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
    const points = [origin, new THREE.Vector3(child.home.x, 0.75, child.home.z)]
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    const line = new THREE.Line(geometry, material)
    line.computeLineDistances()
    trajectoryGroup.add(line)
    trajectoryMaterials.push(material)
  }
  stage.scene.add(trajectoryGroup)

  // ---------------------------------------------------------------------------
  // 后果演出
  // ---------------------------------------------------------------------------

  /** 清理上一次后果演出留下的临时对象（火花、闪光、扬尘）。 */
  function clearTransient(): void {
    for (const object of transient) {
      object.removeFromParent()
      disposeObject(object)
    }
    transient.length = 0
  }

  /** 在撞击点炸出一组火花与一次短促闪光，是三种碰撞结果的共用特效。 */
  function sparkBurst(position: THREE.Vector3, color = 0xffb869): void {
    const group = new THREE.Group()
    group.position.copy(position)
    for (let index = 0; index < 16; index += 1) {
      const spark = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, 0.035, 0.12),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 }),
      )
      spark.position.set(Math.random() * 0.4, Math.random() * 0.4, Math.random() * 0.4)
      spark.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI)
      group.add(spark)
      tw(spark.position, {
        x: (Math.random() - 0.5) * 3.4,
        y: 0.15 + Math.random() * 1.8,
        z: (Math.random() - 0.5) * 2.6,
        duration: 0.5 + Math.random() * 0.5,
        ease: 'power2.out',
      })
      tw(spark.material as THREE.Material, { opacity: 0, duration: 0.7 + Math.random() * 0.4 })
    }
    const flash = new THREE.PointLight(color, 60, 16, 2)
    flash.position.copy(position)
    group.add(flash)
    tw(flash, { intensity: 0, duration: 0.5, ease: 'power2.out' })
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

  /** 让儿童向一侧跑散，用于表现车辆避让成功后的现场反应。 */
  function pedestriansRun(direction: 1 | -1): void {
    children.forEach(({ mesh, home }, index) => {
      tw(mesh.position, {
        x: direction * (4.6 + index * 0.4),
        z: home.z + (index - 1) * 0.9,
        duration: 1.1 + index * 0.08,
        delay: 0.15 + index * 0.06,
        ease: 'power2.inOut',
      })
      tw(mesh.rotation, { y: mesh.rotation.y + direction * 1.4, duration: 0.4 })
    })
  }

  /** 撞击行人的后果演出：紧急制动、车身点头与火花。 */
  function impactPedestrians(): void {
    if (impactState !== 'none') return
    impactState = 'peds'
    stage.setAmbience('critical')
    stage.shake(0.32, 0.9)
    sparkBurst(new THREE.Vector3(2.5, 0.9, 1.2), 0xffa285)
    children.forEach(({ mesh }, index) => {
      tw(mesh.rotation, {
        z: (index % 2 === 0 ? 1 : -1) * 1.38,
        x: (index % 2 === 0 ? -1 : 1) * 0.18,
        duration: 0.55,
        delay: index * 0.1,
        ease: 'power2.in',
      })
      tw(mesh.position, { y: 0.24, duration: 0.55, delay: index * 0.1, ease: 'power2.in' })
    })
  }

  /** 撞击护栏的后果演出：车头偏转、火花并驱散行人。 */
  function impactBarrier(): void {
    if (impactState !== 'none') return
    impactState = 'barrier'
    stage.setAmbience('critical')
    stage.shake(0.2, 0.7)
    sparkBurst(new THREE.Vector3(5.35, 0.95, 6.4), 0xffc98a)
    tw(ego.rotation, { z: -0.055, duration: 0.32, ease: 'power2.out' })
    pedestriansRun(-1)
  }

  /** 撞上对向货车的后果演出：更强烈的震动与更大的火花范围。 */
  function impactTruck(): void {
    if (impactState !== 'none') return
    impactState = 'truck'
    stage.setAmbience('critical')
    stage.shake(0.46, 1.1)
    sparkBurst(new THREE.Vector3(-1.8, 1.0, 3.2), 0xff9d78)
    tw(ego.rotation, { z: 0.06, duration: 0.4, ease: 'power2.out' })
    tw(truck.rotation, { z: -0.045, duration: 0.5, ease: 'power2.out' })
    pedestriansRun(1)
  }

  // 将决策动作映射为刹车、避让、撞击与数据公开等演出。
  function handleAction(action: string): void {
    switch (action) {
      case 'reveal-crosswalk':
        if (annotationReveal) annotationReveal.style.opacity = '1'
        for (const material of trajectoryMaterials) {
          tw(material, { opacity: 0.62, duration: 0.65 })
        }
        break
      case 'ego-brake':
        stage.hideHotspots()
        tw(ego.position, { z: 3.15, duration: 2.2, ease: 'power2.out' })
        tw(ego.rotation, { x: 0.025, duration: 0.7, ease: 'power2.out' })
        tw(skidMaterial, { opacity: 0.56, duration: 0.5, delay: 0.3 })
        later(2350, impactPedestrians)
        break
      case 'ego-swerve-right':
        stage.hideHotspots()
        tw(ego.position, { x: 4.62, z: 6.2, duration: 1.5, ease: 'power3.out' })
        tw(ego.rotation, { y: -0.15, z: -0.03, duration: 1.2, ease: 'power2.out' })
        tw(skidMaterial, { opacity: 0.35, duration: 0.4 })
        later(1550, impactBarrier)
        break
      case 'ego-swerve-left':
        stage.hideHotspots()
        tw(ego.position, { x: -2.3, z: 3.6, duration: 1.7, ease: 'power3.out' })
        tw(ego.rotation, { y: 0.16, duration: 1.2, ease: 'power2.out' })
        tw(truck.position, { z: -2.2, duration: 1.9, ease: 'power1.in' })
        tw(skidMaterial, { opacity: 0.3, duration: 0.4 })
        later(1950, impactTruck)
        break
      case 'ego-continue':
        stage.hideHotspots()
        tw(ego.position, { z: -8.5, duration: 2.5, ease: 'power1.in' })
        later(1150, impactPedestrians)
        break
      case 'impact-pedestrians':
        if (impactState === 'none') later(400, impactPedestrians)
        break
      case 'guardrail-impact':
        if (impactState === 'none') later(400, impactBarrier)
        break
      case 'truck-impact':
        if (impactState === 'none') later(400, impactTruck)
        break
      case 'reveal-edr':
        if (!edrRevealed) {
          edrRevealed = true
          stage.addAnnotation('EDR · 数据封存', [ego.position.x, 2.35, ego.position.z + 0.4], 'data')
          stage.addAnnotation('争议焦点', [2.6, 3.15, 1.2], 'warning')
        }
        break
      default:
        break
    }
  }

  // ---------------------------------------------------------------------------
  // 热点与重置
  // ---------------------------------------------------------------------------

  // 热点既是勘查入口，也是评分条件 inspected 的数据来源。
  stage.addHotspot({
    id: 'a_sensor',
    label: '感知单元',
    detail: '雨幕中激光雷达点云稀疏，融合置信度 78%。系统已记录 4 次低置信度回退。',
    tone: 'info',
    position: [2.6, 2.45, 20.1],
  })
  stage.addHotspot({
    id: 'a_crosswalk',
    label: '斑马线视野',
    detail: '右侧行道树遮挡了 0.6 秒的儿童轨迹；湿滑路面把有效制动距离拉长到 18.4 米。',
    tone: 'caution',
    position: [7.55, 3.4, -1.8],
  })
  stage.addHotspot({
    id: 'a_truck',
    label: '对向货车',
    detail: '12 吨货车，距离 31 米。对向车道的任何侵入都会把单方事故变成多方碰撞。',
    tone: 'danger',
    position: [-2.65, 3.4, -22.5],
  })

  annotationReveal = stage.addAnnotation('感知置信度 78%', [4.1, 3.0, 0.9], 'warning')
  annotationReveal.style.opacity = '0'
  annotationReveal.style.transition = 'opacity .4s ease'

  /** 把场景恢复到初始状态：终止动画、还原车辆与行人、重置热点与机位。 */
  function resetScene(): void {
    while (animations.length) animations.pop()?.kill()
    clearTransient()
    impactState = 'none'
    edrRevealed = false
    ego.position.copy(egoHome)
    ego.rotation.set(0, 0, 0)
    truck.position.set(-2.65, 0.01, -25)
    truck.rotation.set(0, Math.PI, 0)
    for (const { mesh, home } of children) {
      mesh.position.copy(home)
      mesh.rotation.set(0, 0, 0)
    }
    for (const material of trajectoryMaterials) material.opacity = 0
    skidMaterial.opacity = 0
    if (annotationReveal) annotationReveal.style.opacity = '0'
    stage.resetHotspots()
    stage.showHotspots()
    stage.setAmbience('tense', true)
    camera('overview', true)
  }

  stage.setAmbience('tense', true)
  camera('overview', true)

  return {
    focus: focusPreset,
    applyAction: handleAction,
    setAmbience: (level) => stage.setAmbience(level),
    markHotspot: (id) => stage.markHotspot(id),
    reset: resetScene,
    pause: (paused) => stage.setPaused(paused),
    dispose: () => stage.dispose(),
  }
}
