import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { disposeObject, Stage } from '../stage'
import {
  createBuilding,
  createCrosswalk,
  createFacadeTextures,
  createGuardrail,
  createPerson,
  createPipe,
  createRoad,
  createScaffold,
  createSewagePool,
  createSpeedBump,
  createStreetLamp,
  createTree,
} from '../primitives'
import type { CameraPreset, ScenarioSceneOptions, ScenarioStageHandle } from './types'

type StageTween = ReturnType<Stage['after']>
type TweenTarget = Parameters<Stage['tweenTo']>[0]
type TweenVars = Parameters<Stage['tweenTo']>[1]

const CAMERA_PRESETS: Record<string, CameraPreset> = {
  overview: { position: [31, 21, 37], target: [2, 5, -3] },
  building: { position: [25, 14, 27], target: [0, 9, -8] },
  sewage: { position: [3, 6, 14], target: [-5, 0, 5.5] },
  school: { position: [8, 13, 28], target: [20, -1, 16] },
  guardrail: { position: [31, 10, 12], target: [14, 0, -8] },
  collapse: { position: [36, 17, 27], target: [5, 6, -7] },
  evidence: { position: [11, 5, 9], target: [4, 1.5, -2] },
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a += 0x6d2b79f5
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 生成挖掘机（履带、驾驶舱与动臂），作为施工现场的背景机械。 */
function createExcavator(): THREE.Group {
  const group = new THREE.Group()
  const yellow = new THREE.MeshStandardMaterial({ color: 0xd8a63e, roughness: 0.62, metalness: 0.2 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x545956, roughness: 0.9 })
  const glass = new THREE.MeshStandardMaterial({
    color: 0x9dbdcf,
    roughness: 0.18,
    metalness: 0.26,
    emissive: 0x2e4551,
    emissiveIntensity: 0.1,
  })

  for (const z of [-0.8, 0.8]) {
    const track = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.55, 0.62), dark)
    track.position.set(0, 0.3, z)
    track.castShadow = true
    group.add(track)
  }
  const base = new THREE.Mesh(new RoundedBoxGeometry(2.8, 1.15, 2.2, 3, 0.1), yellow)
  base.position.y = 1.15
  base.castShadow = true
  group.add(base)
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.35, 1.15), glass)
  cab.position.set(-0.6, 2.2, 0)
  cab.castShadow = true
  group.add(cab)
  const arm = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.32, 0.36), yellow)
  arm.position.set(1.7, 2.05, 0)
  arm.rotation.z = 0.4
  arm.castShadow = true
  group.add(arm)
  const forearm = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.26, 0.32), yellow)
  forearm.position.set(3.15, 1.35, 0)
  forearm.rotation.z = -0.9
  forearm.castShadow = true
  group.add(forearm)
  const bucket = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.9), dark)
  bucket.position.set(3.9, 0.6, 0)
  bucket.rotation.z = 0.4
  bucket.castShadow = true
  group.add(bucket)
  group.userData = { kind: 'excavator' }
  return group
}

/**
 * 构建建筑坍塌场景：基坑、脚手架、校门与污水管三处隐患。
 * 处置动作会改变护栏、减速带与污水的可见状态。
 */
export function buildCollapseScene(
  host: HTMLElement,
  options: ScenarioSceneOptions,
): ScenarioStageHandle {
  const stage = new Stage(host, {
    reducedMotion: options.reducedMotion,
    cinematic: options.cinematicCamera,
  })
  stage.onHotspot(options.onInspect)

  stage.defineAmbience('calm', {
    background: 0xdceffb,
    fogColor: 0xe9f5fc,
    fogDensity: 0.008,
    sunIntensity: 2.45,
    sunColor: 0xfff3dc,
    fillIntensity: 1.2,
    exposure: 1.04,
  })
  stage.defineAmbience('tense', {
    background: 0xd3e6f4,
    fogColor: 0xe4eff8,
    fogDensity: 0.009,
    sunIntensity: 2.55,
    sunColor: 0xffeed4,
    fillIntensity: 1.18,
    exposure: 1.05,
  })
  stage.defineAmbience('critical', {
    background: 0xf1e2d4,
    fogColor: 0xf3e4d6,
    fogDensity: 0.011,
    sunIntensity: 2.65,
    sunColor: 0xffd9bf,
    fillIntensity: 1.22,
    exposure: 1.06,
  })

  const animations: StageTween[] = []
  const transient: THREE.Object3D[] = []
  let collapseTriggered = false
  let stabilityTriggered = false

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

  const fillLight = new THREE.DirectionalLight(0xdbe8f2, 0.35)
  fillLight.position.set(-18, 16, -22)
  stage.scene.add(fillLight)

  // ---------------------------------------------------------------------------
  // 带真实基坑开口的地面
  // ---------------------------------------------------------------------------

  const groundShape = new THREE.Shape()
  groundShape.moveTo(-110, -110)
  groundShape.lineTo(110, -110)
  groundShape.lineTo(110, 110)
  groundShape.lineTo(-110, 110)
  groundShape.closePath()
  const pitHole = new THREE.Path()
  pitHole.moveTo(9.9, 1)
  pitHole.lineTo(16.1, 1)
  pitHole.lineTo(16.1, 15)
  pitHole.lineTo(9.9, 15)
  pitHole.closePath()
  groundShape.holes.push(pitHole)

  const ground = new THREE.Mesh(
    new THREE.ShapeGeometry(groundShape),
    new THREE.MeshStandardMaterial({ color: 0xc2bba9, roughness: 0.96 }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  stage.scene.add(ground)

  // 基坑底面与侧壁
  const dirtMaterial = new THREE.MeshStandardMaterial({ color: 0x8b7256, roughness: 0.98 })
  const pitFloor = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 14), dirtMaterial)
  pitFloor.rotation.x = -Math.PI / 2
  pitFloor.position.set(13, -2.75, -8)
  pitFloor.receiveShadow = true
  stage.scene.add(pitFloor)
  for (const x of [9.95, 16.05]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.8, 14.1), dirtMaterial)
    wall.position.set(x, -1.4, -8)
    wall.receiveShadow = true
    stage.scene.add(wall)
  }
  for (const z of [-0.95, -15.05]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(6.2, 2.8, 0.18), dirtMaterial)
    wall.position.set(13, -1.4, z)
    wall.receiveShadow = true
    stage.scene.add(wall)
  }
  const pitEdgeGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(6.2, 14),
    new THREE.MeshBasicMaterial({
      color: 0xff6e4f,
      transparent: true,
      opacity: 0.06,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  )
  pitEdgeGlow.rotation.x = -Math.PI / 2
  pitEdgeGlow.position.set(13, -2.72, -8)
  stage.scene.add(pitEdgeGlow)

  // 进出道路与人行道
  const road = createRoad({ width: 8, length: 78, sidewalk: true })
  road.rotation.y = Math.PI / 2
  road.position.set(8, 0.002, 16)
  stage.scene.add(road)

  const crosswalk = createCrosswalk(8, 0)
  crosswalk.rotation.y = Math.PI / 2
  crosswalk.position.set(20, 0.02, 16)
  stage.scene.add(crosswalk)

  // 风化的院内地坪已由上方形状网格表示；这里保留街道的可读性。

  // ---------------------------------------------------------------------------
  // 建筑
  // ---------------------------------------------------------------------------

  const buildingRoot = new THREE.Group()
  buildingRoot.position.set(0, 0, -8)
  stage.scene.add(buildingRoot)

  const blockWidth = 6.5
  const blockHeight = 2.72
  const blockDepth = 12
  const floors = 6
  const columns = 3
  const roofMaterial = new THREE.MeshStandardMaterial({ color: 0xb3b8bd, roughness: 0.94 })
  const columnMaterials = [4, 17, 31].map((seed) => {
    const textures = createFacadeTextures({
      seed,
      litRatio: 0.22,
      warm: 0.75,
      cols: 5,
      rows: 8,
      base: '#c3c8cd',
    })
    return new THREE.MeshStandardMaterial({
      color: 0xc2c7cc,
      map: textures.map,
      emissive: new THREE.Color(0xffffff),
      emissiveMap: textures.emissiveMap,
      emissiveIntensity: 0.35,
      roughness: 0.88,
    })
  })
  const buildingPieces: Array<{
    mesh: THREE.Mesh
    home: THREE.Vector3
    homeRotation: THREE.Euler
  }> = []

  for (let floor = 0; floor < floors; floor += 1) {
    for (let column = 0; column < columns; column += 1) {
      const facade = columnMaterials[column]
      const materials = [facade, facade, roofMaterial, roofMaterial, facade, facade]
      const block = new THREE.Mesh(
        new THREE.BoxGeometry(blockWidth, blockHeight, blockDepth),
        materials,
      )
      block.position.set((column - 1) * blockWidth, floor * blockHeight + blockHeight / 2, 0)
      block.castShadow = true
      block.receiveShadow = true
      buildingRoot.add(block)
      buildingPieces.push({
        mesh: block,
        home: block.position.clone(),
        homeRotation: block.rotation.clone(),
      })
    }
  }

  const roofSlab = new THREE.Mesh(
    new THREE.BoxGeometry(blockWidth * columns + 0.5, 0.4, blockDepth + 0.5),
    roofMaterial,
  )
  roofSlab.position.set(0, floors * blockHeight + 0.2, 0)
  roofSlab.castShadow = true
  buildingRoot.add(roofSlab)
  buildingPieces.push({ mesh: roofSlab, home: roofSlab.position.clone(), homeRotation: roofSlab.rotation.clone() })

  const parapetMaterial = new THREE.MeshStandardMaterial({ color: 0xc4c9ce, roughness: 0.92 })
  const parapet = new THREE.Mesh(new THREE.BoxGeometry(20, 0.45, 12.4), parapetMaterial)
  parapet.position.set(0, floors * blockHeight + 0.55, 0)
  buildingRoot.add(parapet)
  buildingPieces.push({ mesh: parapet, home: parapet.position.clone(), homeRotation: parapet.rotation.clone() })

  // 目标建筑屋顶上的几个设备机组
  for (const [x, z, size] of [
    [-5, -2, 1.5],
    [3, 2, 1.1],
    [6, -3, 0.9],
  ] as const) {
    const unit = new THREE.Mesh(new THREE.BoxGeometry(size, 0.8, size), roofMaterial)
    unit.position.set(x, floors * blockHeight + 1.0, z)
    unit.castShadow = true
    buildingRoot.add(unit)
  }

  const buildingScaffold = createScaffold({ width: 18.5, height: 16.8 })
  buildingScaffold.position.set(0, 0, -1.8)
  stage.scene.add(buildingScaffold)

  const netMaterial = new THREE.MeshStandardMaterial({
    color: 0x4f8f7a,
    transparent: true,
    opacity: 0.16,
    roughness: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
  const net = new THREE.Mesh(new THREE.PlaneGeometry(18.4, 16.5), netMaterial)
  net.position.set(0, 8.4, -1.95)
  stage.scene.add(net)

  // 坍塌后的废墟堆：让体块落地后仍有“碎掉”的尺度，而不是干净的长方体。
  const rubbleGroup = new THREE.Group()
  const rubbleMaterial = new THREE.MeshStandardMaterial({ color: 0xa39a8b, roughness: 0.98, flatShading: true })
  const rubbleRandom = mulberry32(77)
  for (let index = 0; index < 18; index += 1) {
    const size = 0.35 + rubbleRandom() * 0.95
    const chunk = new THREE.Mesh(new THREE.DodecahedronGeometry(size, 0), rubbleMaterial)
    chunk.position.set(
      (rubbleRandom() - 0.5) * 19,
      0.18 + rubbleRandom() * 1.2,
      -8 + (rubbleRandom() - 0.5) * 14,
    )
    chunk.rotation.set(rubbleRandom() * 2, rubbleRandom() * 2, rubbleRandom() * 2)
    chunk.castShadow = true
    chunk.receiveShadow = true
    chunk.scale.setScalar(0.001)
    rubbleGroup.add(chunk)
  }
  rubbleGroup.visible = false
  stage.scene.add(rubbleGroup)

  // 东侧立面的裂缝
  const crackPoints: number[] = []
  const randomCrack = mulberry32(66)
  for (let index = 0; index < 9; index += 1) {
    const startZ = -10 + randomCrack() * 4
    const startY = 5 + index * 1.15
    let x = 10.03
    let y = startY
    let z = startZ
    for (let segment = 0; segment < 3; segment += 1) {
      const nextX = 10.05
      const nextY = y + 0.3 + randomCrack() * 0.45
      const nextZ = z + (randomCrack() - 0.5) * 0.65
      crackPoints.push(x, y, z, nextX, nextY, nextZ)
      x = nextX
      y = nextY
      z = nextZ
    }
  }
  const crackGeometry = new THREE.BufferGeometry()
  crackGeometry.setAttribute('position', new THREE.Float32BufferAttribute(crackPoints, 3))
  const cracks = new THREE.LineSegments(
    crackGeometry,
    new THREE.LineBasicMaterial({ color: 0x3a332b, transparent: true, opacity: 0.8 }),
  )
  cracks.position.set(0, 0, -8)
  stage.scene.add(cracks)

  const neighbour = createBuilding({ width: 16, height: 21, depth: 13, seed: 41, litRatio: 0.22, windowWarm: 0.8, baseColor: 0xbec9d3 })
  neighbour.position.set(-27, 0, -10)
  stage.scene.add(neighbour)
  const rightNeighbour = createBuilding({ width: 12, height: 13, depth: 11, seed: 52, litRatio: 0.2, windowWarm: 0.7, baseColor: 0xc7cfd6 })
  rightNeighbour.position.set(44, 0, -16)
  stage.scene.add(rightNeighbour)

  // ---------------------------------------------------------------------------
  // 街对面的学校
  // ---------------------------------------------------------------------------

  const school = createBuilding({ width: 19, height: 10, depth: 10, seed: 77, litRatio: 0.3, windowWarm: 0.62, baseColor: 0xd2c9b9, base: '#d8d0c1' })
  school.position.set(19, 0, 40)
  stage.scene.add(school)

  const gatePillarMaterial = new THREE.MeshStandardMaterial({ color: 0x9a8c76, roughness: 0.9 })
  for (const x of [12.5, 27.5]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 3.1, 0.9), gatePillarMaterial)
    pillar.position.set(x, 1.55, 23.3)
    pillar.castShadow = true
    stage.scene.add(pillar)
  }
  const gateBar = new THREE.Mesh(new THREE.BoxGeometry(15.8, 0.36, 0.5), gatePillarMaterial)
  gateBar.position.set(20, 3.0, 23.3)
  stage.scene.add(gateBar)
  const gateSign = new THREE.Mesh(
    new THREE.PlaneGeometry(6.2, 0.65),
    new THREE.MeshBasicMaterial({ color: 0xe4d6a8, transparent: true, opacity: 0.9 }),
  )
  gateSign.position.set(20, 3.0, 23.02)
  stage.scene.add(gateSign)
  stage.addAnnotation('安和里小学 · 南门', [20, 3.8, 23.2], 'notice')

  const schoolChildren = [
    [23.2, 21.4, 0.68, 0xb85a4d],
    [17.6, 21.0, 0.7, 0x4b7390],
  ] as const
  for (const [x, z, scale, color] of schoolChildren) {
    const child = createPerson({ vestColor: color, shirtColor: 0x6b7780, trouserColor: 0x56626c, scale, helmet: false })
    child.position.set(x, 0.03, z)
    child.rotation.y = Math.PI + (x > 20 ? -0.5 : 0.4)
    stage.scene.add(child)
  }

  // 进出道路上的路灯
  for (const [x, z] of [
    [2, 21.4],
    [33, 21.4],
    [15, 10.6],
  ] as const) {
    const lamp = createStreetLamp({ light: true })
    lamp.position.set(x, 0, z)
    lamp.rotation.y = z > 15 ? -Math.PI / 2 : 0
    stage.scene.add(lamp)
  }

  for (const [x, z, scale] of [
    [38, 9, 1.25],
    [-17, 23, 1.1],
    [36, 27, 1.0],
    [-33, 12, 1.2],
  ] as const) {
    const tree = createTree({ scale, color: 0x729b5e })
    tree.position.set(x, 0, z)
    stage.scene.add(tree)
  }

  // ---------------------------------------------------------------------------
  // 施工现场道具
  // ---------------------------------------------------------------------------

  const excavator = createExcavator()
  excavator.position.set(-14, 0, 7)
  excavator.rotation.y = -0.55
  stage.scene.add(excavator)

  const pipeStack = new THREE.Group()
  for (let index = 0; index < 3; index += 1) {
    const pipe = createPipe({ length: 5.2, radius: 0.26, color: 0x8b9294 })
    pipe.position.set(0, 0.3 + index * 0.5, index * 0.45)
    pipe.rotation.y = Math.PI / 2
    pipeStack.add(pipe)
  }
  pipeStack.position.set(-21, 0, 0)
  stage.scene.add(pipeStack)

  const fencePanelMaterial = new THREE.MeshStandardMaterial({ color: 0xa98a54, roughness: 0.82 })
  const siteFence = new THREE.Group()
  for (let x = -21; x <= 21; x += 3.4) {
    if (x > -1 && x < 7) continue
    const panel = new THREE.Mesh(new THREE.BoxGeometry(3.1, 1.8, 0.08), fencePanelMaterial)
    panel.position.set(x, 0.9, 10.2)
    siteFence.add(panel)
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.1, 0.1), fencePanelMaterial)
    post.position.set(x + 1.6, 1.05, 10.2)
    siteFence.add(post)
  }
  stage.scene.add(siteFence)

  const coneMaterial = new THREE.MeshStandardMaterial({ color: 0xd5623e, roughness: 0.7 })
  for (const [x, z] of [
    [-8, 9.2],
    [10.5, 8.6],
    [21, 12.6],
    [18.5, 19.5],
  ] as const) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.55, 10), coneMaterial)
    cone.position.set(x, 0.28, z)
    cone.castShadow = true
    stage.scene.add(cone)
  }

  // ---------------------------------------------------------------------------
  // 污水管线
  // ---------------------------------------------------------------------------

  const channel = new THREE.Mesh(
    new THREE.BoxGeometry(23, 0.08, 1.3),
    new THREE.MeshStandardMaterial({ color: 0x676256, roughness: 0.9 }),
  )
  channel.position.set(-4, 0.015, 6)
  stage.scene.add(channel)

  const pipeA = createPipe({ length: 3.0, radius: 0.28, color: 0x8f9694 })
  pipeA.position.set(-8.2, 0.3, 6)
  stage.scene.add(pipeA)
  const pipeB = createPipe({ length: 3.0, radius: 0.28, color: 0x8f9694 })
  pipeB.position.set(-2.7, 0.3, 6)
  stage.scene.add(pipeB)

  const sewagePuddle = createSewagePool({ radius: 2.7 })
  sewagePuddle.scale.set(1.7, 1, 0.9)
  sewagePuddle.position.set(-5.6, 0.022, 6.5)
  stage.scene.add(sewagePuddle)
  const sewageMaterial = sewagePuddle.material as THREE.MeshStandardMaterial
  sewageMaterial.transparent = true
  sewageMaterial.opacity = 0.86

  const reportGroup = new THREE.Group()
  const pump = new THREE.Mesh(
    new RoundedBoxGeometry(1.2, 0.75, 0.8, 3, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x8a998f, roughness: 0.55, metalness: 0.25 }),
  )
  pump.position.set(-10.4, 0.38, 8.4)
  reportGroup.add(pump)
  const reportBeacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0x6fe0a4, emissive: 0x4fe091, emissiveIntensity: 1.4 }),
  )
  reportBeacon.position.set(-10.4, 0.9, 8.4)
  reportGroup.add(reportBeacon)
  reportGroup.visible = false
  stage.scene.add(reportGroup)

  const sealGroup = new THREE.Group()
  const clamp = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.07, 8, 18),
    new THREE.MeshStandardMaterial({ color: 0xb88743, roughness: 0.4, metalness: 0.55 }),
  )
  clamp.rotation.y = Math.PI / 2
  clamp.position.set(-5.5, 0.3, 6)
  sealGroup.add(clamp)
  sealGroup.visible = false
  stage.scene.add(sealGroup)

  const divertGroup = new THREE.Group()
  const hoseCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-5.5, 0.28, 6),
    new THREE.Vector3(-3.5, 0.16, 8.5),
    new THREE.Vector3(1.5, 0.13, 9.6),
    new THREE.Vector3(8.5, 0.12, 9.3),
  ])
  const hose = new THREE.Mesh(
    new THREE.TubeGeometry(hoseCurve, 40, 0.11, 8, false),
    new THREE.MeshStandardMaterial({ color: 0x4f5854, roughness: 0.76 }),
  )
  divertGroup.add(hose)
  const drain = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.45, 0.1, 16),
    new THREE.MeshStandardMaterial({ color: 0x5e6664, roughness: 0.8, metalness: 0.4 }),
  )
  drain.position.set(8.5, 0.06, 9.3)
  divertGroup.add(drain)
  divertGroup.visible = false
  stage.scene.add(divertGroup)

  const monitorGroup = new THREE.Group()
  for (const [x, z] of [
    [-9.5, 3.9],
    [-5.5, 9.4],
    [-1.5, 4.1],
  ] as const) {
    const tripod = new THREE.Group()
    const legMaterial = new THREE.MeshStandardMaterial({ color: 0x6d7676, metalness: 0.55, roughness: 0.45 })
    for (const angle of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 1.2, 5), legMaterial)
      leg.position.set(Math.sin(angle) * 0.22, 0.55, Math.cos(angle) * 0.22)
      leg.rotation.z = Math.sin(angle) * 0.24
      leg.rotation.x = Math.cos(angle) * 0.24
      tripod.add(leg)
    }
    const sensor = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.2, 0.2),
      new THREE.MeshStandardMaterial({
        color: 0x5bd4c8,
        emissive: 0x37c4b7,
        emissiveIntensity: 1.2,
        roughness: 0.3,
      }),
    )
    sensor.position.y = 1.24
    tripod.add(sensor)
    tripod.position.set(x, 0, z)
    monitorGroup.add(tripod)
  }
  monitorGroup.visible = false
  stage.scene.add(monitorGroup)

  // ---------------------------------------------------------------------------
  // 减速带与校门护学岗
  // ---------------------------------------------------------------------------

  const brokenBump = new THREE.Group()
  const brokenRandom = mulberry32(88)
  for (let index = 0; index < 4; index += 1) {
    const fragment = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.11, 1.25),
      new THREE.MeshStandardMaterial({ color: index % 2 === 0 ? 0x5d6266 : 0xc39a3c, roughness: 0.7 }),
    )
    fragment.position.set(-2.6 + index * 1.8, 0.06, (brokenRandom() - 0.5) * 0.8)
    fragment.rotation.y = (brokenRandom() - 0.5) * 0.4
    brokenBump.add(fragment)
  }
  brokenBump.position.set(20, 0.01, 16)
  brokenBump.rotation.y = Math.PI / 2
  stage.scene.add(brokenBump)

  const standardBump = createSpeedBump({ width: 8, height: 0.1 })
  standardBump.rotation.y = Math.PI / 2
  standardBump.position.set(20, 0.01, 16)
  standardBump.visible = false
  stage.scene.add(standardBump)

  const temporaryBump = new THREE.Group()
  for (let index = 0; index < 5; index += 1) {
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.09, 0.9),
      new THREE.MeshStandardMaterial({ color: index % 2 === 0 ? 0x9c7f55 : 0x846a45, roughness: 0.92 }),
    )
    plank.position.set(-2 + index * 1.0, 0.06, (index % 2 === 0 ? -0.2 : 0.2))
    plank.rotation.z = 0.04
    temporaryBump.add(plank)
  }
  temporaryBump.position.set(20, 0.01, 16)
  temporaryBump.rotation.y = Math.PI / 2
  temporaryBump.visible = false
  stage.scene.add(temporaryBump)

  const crossingGuard = createPerson({
    vestColor: 0xe0b13e,
    shirtColor: 0x5d6a71,
    trouserColor: 0x4c565d,
    scale: 0.92,
    helmet: false,
  })
  crossingGuard.position.set(17.35, 0.03, 20.2)
  crossingGuard.rotation.y = -0.8
  const flagPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 1.4, 6),
    new THREE.MeshStandardMaterial({ color: 0x9a8459, roughness: 0.6 }),
  )
  flagPole.position.set(0.28, 1.2, 0)
  crossingGuard.add(flagPole)
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.55, 0.34),
    new THREE.MeshStandardMaterial({ color: 0xe0b13e, side: THREE.DoubleSide, roughness: 0.6 }),
  )
  flag.position.set(0.56, 1.78, 0)
  crossingGuard.add(flag)
  crossingGuard.visible = false
  stage.scene.add(crossingGuard)

  const roadCone = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.65, 10), coneMaterial)
  roadCone.position.set(21.3, 0.33, 18.4)
  roadCone.visible = false
  stage.scene.add(roadCone)

  // ---------------------------------------------------------------------------
  // 基坑护栏
  // ---------------------------------------------------------------------------

  const guardWest = createGuardrail({ length: 14 })
  guardWest.position.set(10.06, 0, -8)
  stage.scene.add(guardWest)
  const guardSouth = createGuardrail({ length: 6 })
  guardSouth.rotation.y = Math.PI / 2
  guardSouth.position.set(13, 0, -1.02)
  stage.scene.add(guardSouth)
  const guardNorth = createGuardrail({ length: 6 })
  guardNorth.rotation.y = Math.PI / 2
  guardNorth.position.set(13, 0, -14.98)
  stage.scene.add(guardNorth)

  const standardFourth = createGuardrail({ length: 14 })
  standardFourth.position.set(16.04, 0, -8)
  standardFourth.visible = false
  stage.scene.add(standardFourth)

  const tapeGroup = new THREE.Group()
  const tapePostMaterial = new THREE.MeshStandardMaterial({ color: 0x6f746f, roughness: 0.7 })
  for (const z of [-14.8, -1.2]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.4, 0.08), tapePostMaterial)
    post.position.set(16.02, 0.7, z)
    tapeGroup.add(post)
  }
  for (const [y, offset] of [
    [0.75, 0],
    [1.15, 0.5],
  ] as const) {
    for (let index = 0; index < 14; index += 1) {
      const segment = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, 0.07, 1),
        new THREE.MeshStandardMaterial({
          color: (index + offset) % 2 === 0 ? 0xcf5a44 : 0xd9c9a5,
          roughness: 0.62,
        }),
      )
      segment.position.set(16.02, y, -14.5 + index)
      tapeGroup.add(segment)
    }
  }
  tapeGroup.visible = false
  stage.scene.add(tapeGroup)

  const palletGroup = new THREE.Group()
  const woodMaterial = new THREE.MeshStandardMaterial({ color: 0x9a7952, roughness: 0.9 })
  for (let index = 0; index < 3; index += 1) {
    const pallet = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.35, 2.1), woodMaterial)
    pallet.position.set(16.02, 0.68, -10.5 + index * 2.4)
    pallet.rotation.x = (index % 2 === 0 ? 0.12 : -0.08)
    pallet.castShadow = true
    palletGroup.add(pallet)
  }
  palletGroup.visible = false
  stage.scene.add(palletGroup)

  const gapCone = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.65, 10), coneMaterial)
  gapCone.position.set(16.02, 0.33, -2.2)
  stage.scene.add(gapCone)

  const warningLightMaterial = new THREE.MeshStandardMaterial({
    color: 0xff4f36,
    emissive: 0xff3b20,
    emissiveIntensity: 1.8,
  })
  const warningLight = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), warningLightMaterial)
  warningLight.position.set(16.02, 0.62, -4)
  const warningLightPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.04, 0.55, 6),
    new THREE.MeshStandardMaterial({ color: 0x4d4b45, roughness: 0.7 }),
  )
  warningLightPole.position.set(16.02, 0.28, -4)
  const warningLightGroup = new THREE.Group()
  warningLightGroup.add(warningLight, warningLightPole)
  warningLightGroup.visible = false
  stage.scene.add(warningLightGroup)
  stage.addUpdater((_delta, elapsed) => {
    if (!warningLightGroup.visible) return
    warningLightMaterial.emissiveIntensity = 1.2 + Math.abs(Math.sin(elapsed * 3.4)) * 1.8
  })

  // ---------------------------------------------------------------------------
  // 扬尘、应急与稳定效果
  // ---------------------------------------------------------------------------

  const dustCount = 850
  const dustRandom = mulberry32(101)
  const dustPositions = new Float32Array(dustCount * 3)
  const dustVelocities = new Float32Array(dustCount * 3)
  const dustGeometry = new THREE.BufferGeometry()
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3))
  const dustMaterial = new THREE.PointsMaterial({
    color: 0xa89780,
    size: 0.26,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    sizeAttenuation: true,
  })
  const dust = new THREE.Points(dustGeometry, dustMaterial)
  dust.visible = false
  stage.scene.add(dust)
  let dustLife = 0

  /** 触发一次扬尘爆发，是坍塌演出的一部分。 */
  function burstDust(): void {
    for (let index = 0; index < dustCount; index += 1) {
      const base = index * 3
      dustPositions[base] = (dustRandom() - 0.5) * 22
      dustPositions[base + 1] = dustRandom() * 14
      dustPositions[base + 2] = -8 + (dustRandom() - 0.5) * 14
      dustVelocities[base] = (dustRandom() - 0.25) * 1.4
      dustVelocities[base + 1] = 0.4 + dustRandom() * 1.6
      dustVelocities[base + 2] = (dustRandom() - 0.5) * 1.1
    }
    dustGeometry.getAttribute('position').needsUpdate = true
    dustMaterial.opacity = 0.48
    dust.visible = true
    dustLife = 8
  }

  stage.addUpdater((delta) => {
    if (!dust.visible) return
    dustLife -= delta
    if (dustLife <= 0) {
      dust.visible = false
      return
    }
    for (let index = 0; index < dustCount; index += 1) {
      const base = index * 3
      dustPositions[base] += dustVelocities[base] * delta
      dustPositions[base + 1] += dustVelocities[base + 1] * delta
      dustPositions[base + 2] += dustVelocities[base + 2] * delta
      dustVelocities[base + 1] -= delta * 0.06
    }
    dustGeometry.getAttribute('position').needsUpdate = true
    dustMaterial.opacity = Math.min(0.48, dustLife * 0.09)
  })

  const emergencyGroup = new THREE.Group()
  emergencyGroup.visible = false
  const emergencyRed = new THREE.PointLight(0xff3d2d, 0, 16, 2)
  emergencyRed.position.set(8, 3, -2)
  const emergencyBlue = new THREE.PointLight(0x3f7dff, 0, 16, 2)
  emergencyBlue.position.set(18, 3, -6)
  emergencyGroup.add(emergencyRed, emergencyBlue)
  const beaconA = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xff4733 }),
  )
  beaconA.position.copy(emergencyRed.position)
  const beaconB = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0x467dff }),
  )
  beaconB.position.copy(emergencyBlue.position)
  emergencyGroup.add(beaconA, beaconB)
  stage.scene.add(emergencyGroup)
  stage.addUpdater((_delta, elapsed) => {
    if (!emergencyGroup.visible) return
    const phase = Math.sin(elapsed * 4.2)
    emergencyRed.intensity = phase > 0 ? 12 : 2
    emergencyBlue.intensity = phase > 0 ? 2 : 12
    beaconA.scale.setScalar(phase > 0 ? 1.3 : 0.8)
    beaconB.scale.setScalar(phase > 0 ? 0.8 : 1.3)
  })

  const stableRingMaterial = new THREE.MeshBasicMaterial({
    color: 0x6fe0b5,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
  const stableRing = new THREE.Mesh(new THREE.RingGeometry(11, 11.7, 72), stableRingMaterial)
  stableRing.rotation.x = -Math.PI / 2
  stableRing.position.set(0, 0.07, -6)
  stage.scene.add(stableRing)
  stage.addUpdater((delta) => {
    if (stableRingMaterial.opacity > 0) stableRing.rotation.z += delta * 0.16
  })

  // ---------------------------------------------------------------------------
  // 场景动作
  // ---------------------------------------------------------------------------

  // 坍塌只触发一次，同时切换氛围、扬尘、应急灯与碎片动画。
  function collapseBuilding(): void {
    if (collapseTriggered) return
    collapseTriggered = true
    stage.hideHotspots()
    stage.setAmbience('critical')
    stage.shake(0.58, 1.6)
    burstDust()
    emergencyGroup.visible = true
    stage.addAnnotation('结构失稳 · 19:38', [1, 22, -4], 'danger')
    const fallingRandom = mulberry32(202)
    buildingPieces.forEach((piece, index) => {
      const direction = piece.home.x >= 0 ? 1 : -1
      const floor = Math.min(6, Math.floor(index / 3))
      const delay = floor * 0.12 + (index % 3) * 0.04
      tw(piece.mesh.position, {
        x: piece.home.x + direction * (1.6 + fallingRandom() * 4.8),
        y: 0.35 + fallingRandom() * 2.2,
        z: piece.home.z + (fallingRandom() - 0.5) * 5.6,
        duration: 1.5 + fallingRandom() * 0.9,
        delay,
        ease: 'power2.in',
      })
      tw(piece.mesh.rotation, {
        x: (fallingRandom() - 0.5) * 0.6,
        y: (fallingRandom() - 0.5) * 0.55,
        z: (fallingRandom() - 0.5) * 0.7,
        duration: 1.8 + fallingRandom() * 0.7,
        delay,
        ease: 'power2.in',
      })
    })
    tw(buildingScaffold.rotation, { x: -0.35, z: 0.22, duration: 1.6, ease: 'power2.in' })
    tw(buildingScaffold.position, { y: -3.2, z: 1.8, duration: 1.8, ease: 'power2.in' })
    tw(netMaterial, { opacity: 0, duration: 0.8 })
    rubbleGroup.visible = true
    rubbleGroup.children.forEach((chunk, index) => {
      chunk.scale.setScalar(0.001)
      tw(chunk.scale, {
        x: 1,
        y: 1,
        z: 1,
        duration: 0.55,
        delay: 1.15 + index * 0.025,
        ease: 'back.out(1.7)',
      })
    })
    later(1900, () => {
      buildingScaffold.visible = false
      net.visible = false
    })
    cracks.visible = false
  }

  /** 加固成功后的演出：氛围回落、稳定环扩散并标注监测结果。 */
  function stabilise(): void {
    if (stabilityTriggered) return
    stabilityTriggered = true
    stage.setAmbience('calm')
    stableRing.visible = true
    stableRingMaterial.opacity = 0.85
    stableRing.scale.setScalar(0.25)
    tw(stableRing.scale, { x: 1, y: 1, z: 1, duration: 1.7, ease: 'power2.out' })
    tw(stableRingMaterial, { opacity: 0, duration: 2.6, delay: 0.7 })
    stage.addAnnotation('监测稳定 · 沉降回落', [2, 19.6, -3], 'success')
    later(2800, () => {
      stableRing.visible = false
    })
  }

  /** 按处置方式切换基坑护栏形态：标准护栏 / 警戒带 / 木板 / 无防护。 */
  function showGuardrail(kind: 'standard' | 'tape' | 'pallet' | 'none'): void {
    standardFourth.visible = kind === 'standard'
    tapeGroup.visible = kind === 'tape'
    palletGroup.visible = kind === 'pallet'
    warningLightGroup.visible = kind !== 'standard'
    gapCone.visible = kind === 'none'
  }

  /** 按处置方式切换校门减速带形态：标准 / 临时 / 拆除 / 增设护学岗。 */
  function showSpeed(kind: 'standard' | 'temporary' | 'remove' | 'signage'): void {
    brokenBump.visible = false
    standardBump.visible = kind === 'standard'
    temporaryBump.visible = kind === 'temporary'
    crossingGuard.visible = kind === 'signage'
    roadCone.visible = kind === 'remove'
  }

  /** 按处置方式切换污水管场景：上报 / 封堵 / 导流 / 监测，并同步渗漏强度。 */
  function showSewage(kind: 'report' | 'seal' | 'divert' | 'monitor'): void {
    reportGroup.visible = kind === 'report'
    sealGroup.visible = kind === 'seal'
    divertGroup.visible = kind === 'divert'
    monitorGroup.visible = kind === 'monitor'
    if (kind === 'report' || kind === 'divert') {
      tw(sewageMaterial, { opacity: 0.12, duration: 0.7 })
    } else {
      tw(sewageMaterial, { opacity: 0.86, duration: 0.4 })
    }
  }

  // 将三处隐患的处置动作映射为场景中的可见变化。
  function handleAction(action: string): void {
    switch (action) {
      case 'sewage:report':
        showSewage('report')
        break
      case 'sewage:seal':
        showSewage('seal')
        break
      case 'sewage:divert':
        showSewage('divert')
        break
      case 'sewage:monitor':
        showSewage('monitor')
        break
      case 'speed:standard':
        showSpeed('standard')
        break
      case 'speed:temporary':
        showSpeed('temporary')
        break
      case 'speed:remove':
        showSpeed('remove')
        break
      case 'speed:signage':
        showSpeed('signage')
        break
      case 'guard:standard':
        showGuardrail('standard')
        break
      case 'guard:tape':
        showGuardrail('tape')
        break
      case 'guard:pallet':
        showGuardrail('pallet')
        break
      case 'guard:none':
        showGuardrail('none')
        break
      case 'collapse':
        collapseBuilding()
        break
      case 'stable':
        stabilise()
        break
      default:
        break
    }
  }

  // ---------------------------------------------------------------------------
  // 热点与重置
  // ---------------------------------------------------------------------------

  stage.addHotspot({
    id: 'c_pipe',
    label: '污水管接口',
    detail: '接口错位约 4 厘米，污水正在渗入基础回填土。管道内壁附着物显示渗漏并非刚刚发生。',
    tone: 'danger',
    position: [-5.5, 1.4, 6.4],
  })
  stage.addHotspot({
    id: 'c_crossing',
    label: '校门减速带',
    detail: '减速带被上午经过的混凝土车压成三段，固定螺栓裸露，碎石已经露在路面。小学 17:10 放学，接送人流和工程车要共用这条不足六米宽的路。',
    tone: 'caution',
    position: [20, 2.35, 18.9],
  })
  stage.addHotspot({
    id: 'c_edge',
    label: '基坑临边',
    detail: '基坑深 4.2 米，东侧缺口紧邻没有路灯的人行道。标准护栏只覆盖了另外三面。',
    tone: 'danger',
    position: [16.2, 2.5, -3.5],
  })
  stage.addHotspot({
    id: 'c_crack',
    label: '既有裂缝',
    detail: '3 号楼东侧存在斜向贯穿裂缝，宽度约 3 毫米。它不是今天施工造成的，但今天的施工正在放大它。',
    tone: 'caution',
    position: [10.2, 8.6, -7.4],
  })

  stage.addAnnotation('3 号楼 · 2008 年砖混结构', [0, 19.5, -4], 'notice')

  /** 恢复初始状态：终止动画、隐藏后果道具、还原建筑与热点。 */
  function resetScene(): void {
    while (animations.length) animations.pop()?.kill()
    for (const object of transient) {
      object.removeFromParent()
      disposeObject(object)
    }
    transient.length = 0
    collapseTriggered = false
    stabilityTriggered = false
    buildingPieces.forEach((piece) => {
      piece.mesh.position.copy(piece.home)
      piece.mesh.rotation.copy(piece.homeRotation)
    })
    buildingScaffold.visible = true
    buildingScaffold.position.set(0, 0, -1.8)
    buildingScaffold.rotation.set(0, 0, 0)
    net.visible = true
    netMaterial.opacity = 0.18
    cracks.visible = true
    rubbleGroup.visible = false
    for (const chunk of rubbleGroup.children) chunk.scale.setScalar(0.001)
    dust.visible = false
    dustMaterial.opacity = 0
    emergencyGroup.visible = false
    emergencyRed.intensity = 0
    emergencyBlue.intensity = 0
    stableRing.visible = false
    stableRingMaterial.opacity = 0
    sewageMaterial.opacity = 0.86
    reportGroup.visible = false
    sealGroup.visible = false
    divertGroup.visible = false
    monitorGroup.visible = false
    brokenBump.visible = true
    standardBump.visible = false
    temporaryBump.visible = false
    crossingGuard.visible = false
    roadCone.visible = false
    standardFourth.visible = false
    tapeGroup.visible = false
    palletGroup.visible = false
    warningLightGroup.visible = false
    gapCone.visible = true
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
