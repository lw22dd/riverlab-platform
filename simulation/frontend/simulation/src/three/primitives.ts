import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

/** 全项目共用的基础色板，保证各场景的材质色调一致。 */
export const COLORS = {
  asphalt: 0x8a97a3,
  asphaltWet: 0x6f7e8c,
  line: 0xf8fafc,
  sidewalk: 0xdfe5ea,
  steel: 0x9aa7b2,
  darkSteel: 0x5e6a76,
  concrete: 0xc0c7cd,
  brick: 0xa87c66,
  grass: 0x8fb57a,
  grassDark: 0x739660,
  hazard: 0xe3b452,
  danger: 0xd26453,
  glass: 0xb9d3e4,
  windowWarm: 0xffdfae,
  windowCool: 0xc6e8f5,
}

// 固定种子的伪随机数，保证每次生成的街景一致。
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

/** 立面贴图的两张贴图：基础色与自发光（夜间窗户）。 */
export interface FacadeTextures {
  map: THREE.CanvasTexture
  emissiveMap: THREE.CanvasTexture
}

// 用 Canvas 生成可复用的立面贴图，避免依赖外部资源。
/**
 * 生成建筑立面贴图：随机点亮的窗户 + 对应的自发光贴图。
 * 使用固定种子，保证同一场景每次打开外观一致。
 */
export function createFacadeTextures(options: {
  seed?: number
  litRatio?: number
  warm?: number
  cols?: number
  rows?: number
  base?: string
} = {}): FacadeTextures {
  const { seed = 1, litRatio = 0.36, warm = 0.7, cols = 6, rows = 12, base = '#b8c4cf' } = options
  const random = mulberry32(seed)
  const width = 256
  const height = 512
  const canvas = document.createElement('canvas')
  const emissive = document.createElement('canvas')
  canvas.width = emissive.width = width
  canvas.height = emissive.height = height

  const context = canvas.getContext('2d')
  const glow = emissive.getContext('2d')
  if (!context || !glow) throw new Error('2D canvas is unavailable')

  context.fillStyle = base
  context.fillRect(0, 0, width, height)
  glow.fillStyle = '#000000'
  glow.fillRect(0, 0, width, height)

  const marginX = 18
  const marginY = 22
  const cellW = (width - marginX * 2) / cols
  const cellH = (height - marginY * 2) / rows
  const windowW = cellW * 0.55
  const windowH = cellH * 0.48

  // 立面上淡淡的横向分层。
  context.fillStyle = 'rgba(255,255,255,0.2)'
  for (let row = 0; row < rows; row += 3) {
    context.fillRect(0, marginY + row * cellH - 5, width, 1)
  }

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = marginX + col * cellW + (cellW - windowW) / 2
      const y = marginY + row * cellH + (cellH - windowH) / 2
      const lit = random() < litRatio
      const warmWindow = random() < warm
      const color = lit ? (warmWindow ? '#ffe0ac' : '#c6e7f2') : '#7e97ab'
      context.fillStyle = color
      context.globalAlpha = lit ? 0.95 : 0.78
      context.fillRect(x, y, windowW, windowH)
      context.globalAlpha = 1
      context.strokeStyle = 'rgba(76,96,113,0.42)'
      context.lineWidth = 1
      context.strokeRect(x, y, windowW, windowH)

      if (lit) {
        glow.fillStyle = warmWindow ? '#ffd39a' : '#a9dbea'
        glow.globalAlpha = 0.55 + random() * 0.35
        glow.fillRect(x, y, windowW, windowH)
        glow.globalAlpha = 1
      }

      if (lit && random() > 0.72) {
        context.fillStyle = 'rgba(86, 104, 119, 0.38)'
        context.fillRect(x + windowW * 0.08, y + windowH * 0.2, windowW * 0.3, windowH * 0.8)
      }
    }
  }

  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = THREE.SRGBColorSpace
  map.anisotropy = 4
  const emissiveMap = new THREE.CanvasTexture(emissive)
  emissiveMap.colorSpace = THREE.SRGBColorSpace
  emissiveMap.anisotropy = 4
  return { map, emissiveMap }
}

/** 生成带窗户贴图、屋顶与女儿墙的建筑体块，是所有城市类场景的通用积木。 */
export function createBuilding(options: {
  width: number
  height: number
  depth: number
  seed?: number
  baseColor?: number
  base?: string
  litRatio?: number
  windowWarm?: number
  roof?: number
}): THREE.Group {
  const {
    width,
    height,
    depth,
    seed = 3,
    baseColor = 0xcbd4de,
    base = '#b8c4cf',
    litRatio = 0.34,
    windowWarm = 0.62,
    roof = 0xb9c0c7,
  } = options

  const group = new THREE.Group()
  const textures = createFacadeTextures({ seed, litRatio, warm: windowWarm, cols: 5, rows: Math.max(6, Math.round(height / 1.6)), base })

  const facade = new THREE.MeshStandardMaterial({
    color: baseColor,
    map: textures.map,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: textures.emissiveMap,
    emissiveIntensity: 0.4,
    roughness: 0.84,
    metalness: 0.04,
  })
  const roofMaterial = new THREE.MeshStandardMaterial({ color: roof, roughness: 0.94, metalness: 0.03 })
  const materials = [facade, facade, roofMaterial, roofMaterial, facade, facade]

  const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), materials)
  body.position.y = height / 2
  body.castShadow = true
  body.receiveShadow = true
  group.add(body)

  const parapet = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.22, 0.3, depth + 0.22),
    new THREE.MeshStandardMaterial({ color: 0xc7cfd6, roughness: 0.88 }),
  )
  parapet.position.y = height + 0.15
  parapet.castShadow = true
  group.add(parapet)

  const random = mulberry32(seed + 17)
  const roofUnits = 1 + Math.floor(random() * 3)
  for (let index = 0; index < roofUnits; index += 1) {
    const unit = new THREE.Mesh(
      new THREE.BoxGeometry(0.9 + random() * 1.6, 0.5 + random() * 0.5, 0.7 + random() * 1.1),
      new THREE.MeshStandardMaterial({ color: 0xb2bbc3, roughness: 0.9 }),
    )
    unit.position.set(
      (random() - 0.5) * (width * 0.56),
      height + 0.45,
      (random() - 0.5) * (depth * 0.56),
    )
    unit.castShadow = true
    group.add(unit)
  }

  const antenna = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 1.5 + random(), 5),
    new THREE.MeshStandardMaterial({ color: 0x707c88, metalness: 0.6, roughness: 0.4 }),
  )
  antenna.position.set(width * 0.28, height + 1.1, -depth * 0.1)
  group.add(antenna)

  group.userData = { kind: 'building', width, height, depth }
  return group
}

/** 生成道路平面，可选车道标线、人行道与湿滑反光。 */
export function createRoad(options: {
  width: number
  length: number
  color?: number
  markings?: boolean
  sidewalk?: boolean
  wet?: boolean
}): THREE.Group {
  const {
    width,
    length,
    color = COLORS.asphalt,
    markings = true,
    sidewalk = true,
    wet = false,
  } = options

  const group = new THREE.Group()
  const roadMaterial = new THREE.MeshStandardMaterial({
    color,
    roughness: wet ? 0.26 : 0.86,
    metalness: wet ? 0.18 : 0.03,
  })
  const road = new THREE.Mesh(new THREE.PlaneGeometry(width, length), roadMaterial)
  road.rotation.x = -Math.PI / 2
  road.receiveShadow = true
  group.add(road)

  if (markings) {
    const lineMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.line,
      roughness: 0.58,
      metalness: 0.02,
      emissive: 0xdfe8ef,
      emissiveIntensity: 0.12,
    })
    const dashCount = Math.floor(length / 6)
    for (let index = 0; index < dashCount; index += 1) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 2.6), lineMaterial)
      dash.rotation.x = -Math.PI / 2
      dash.position.set(0, 0.012, -length / 2 + 3 + index * 6)
      group.add(dash)
    }
    for (const side of [-1, 1]) {
      const edge = new THREE.Mesh(new THREE.PlaneGeometry(0.11, length - 6), lineMaterial)
      edge.rotation.x = -Math.PI / 2
      edge.position.set(side * (width / 2 - 0.32), 0.012, 0)
      group.add(edge)
    }
  }

  if (sidewalk) {
    const sidewalkMaterial = new THREE.MeshStandardMaterial({ color: COLORS.sidewalk, roughness: 0.9 })
    const kerbMaterial = new THREE.MeshStandardMaterial({ color: 0xc4cbd2, roughness: 0.86 })
    for (const side of [-1, 1]) {
      const walk = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.22, length), sidewalkMaterial)
      walk.position.set(side * (width / 2 + 1.3), 0.11, 0)
      walk.receiveShadow = true
      group.add(walk)

      const kerb = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, length), kerbMaterial)
      kerb.position.set(side * (width / 2 + 0.06), 0.15, 0)
      kerb.castShadow = true
      group.add(kerb)
    }
  }

  group.userData = { kind: 'road', width, length }
  return group
}

/** 生成斑马线条纹，用于人行横道场景。 */
export function createCrosswalk(width = 9.5, z = 0): THREE.Group {
  const group = new THREE.Group()
  const material = new THREE.MeshStandardMaterial({
    color: 0xf5f8fb,
    roughness: 0.54,
    emissive: 0xdfe8ee,
    emissiveIntensity: 0.1,
  })
  for (let index = 0; index < 7; index += 1) {
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(width, 0.46), material)
    stripe.rotation.x = -Math.PI / 2
    stripe.position.set(0, 0.017, z - 1.8 + index * 0.6)
    group.add(stripe)
  }
  return group
}

/** 生成轿车；`autonomous` 会加上车顶传感器，`headlights` 控制大灯发光。 */
export function createCar(options: {
  color?: number
  autonomous?: boolean
  headlights?: boolean
  glass?: number
}): THREE.Group {
  const { color = 0x93a5b5, autonomous = false, headlights = false, glass = 0x9dbacd } = options
  const group = new THREE.Group()

  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.28, metalness: 0.45 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x4c5862, roughness: 0.68, metalness: 0.28 })
  const glassMaterial = new THREE.MeshStandardMaterial({
    color: glass,
    roughness: 0.16,
    metalness: 0.28,
    emissive: 0x334a59,
    emissiveIntensity: 0.08,
  })

  const body = new THREE.Mesh(new RoundedBoxGeometry(1.86, 0.52, 4.25, 4, 0.16), paint)
  body.position.y = 0.62
  body.castShadow = true
  body.receiveShadow = true
  group.add(body)

  const cabin = new THREE.Mesh(new RoundedBoxGeometry(1.6, 0.58, 2.2, 4, 0.14), glassMaterial)
  cabin.position.set(0, 1.12, 0.1)
  cabin.castShadow = true
  group.add(cabin)

  const roof = new THREE.Mesh(new RoundedBoxGeometry(1.48, 0.12, 1.85, 4, 0.05), paint)
  roof.position.set(0, 1.43, 0.1)
  roof.castShadow = true
  group.add(roof)

  const wheelGeometry = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 14)
  for (const x of [-0.93, 0.93]) {
    for (const z of [-1.35, 1.35]) {
      const wheel = new THREE.Mesh(wheelGeometry, dark)
      wheel.rotation.z = Math.PI / 2
      wheel.position.set(x, 0.35, z)
      wheel.castShadow = true
      group.add(wheel)
    }
  }

  const lightMaterial = new THREE.MeshStandardMaterial({
    color: 0xf4fbff,
    emissive: 0xdff6ff,
    emissiveIntensity: 2.2,
  })
  for (const x of [-0.62, 0.62]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.13, 0.04), lightMaterial)
    light.position.set(x, 0.68, -2.13)
    group.add(light)
  }
  const tailMaterial = new THREE.MeshStandardMaterial({
    color: 0xff3e32,
    emissive: 0xff2e22,
    emissiveIntensity: 1.6,
  })
  for (const x of [-0.68, 0.68]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.04), tailMaterial)
    tail.position.set(x, 0.69, 2.13)
    group.add(tail)
  }

  if (autonomous) {
    const sensorBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.19, 0.1, 12),
      new THREE.MeshStandardMaterial({ color: 0x56636d, roughness: 0.5, metalness: 0.6 }),
    )
    sensorBase.position.set(0, 1.56, 0.15)
    group.add(sensorBase)
    const sensor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.13, 0.22, 12),
      new THREE.MeshStandardMaterial({
        color: 0x7fe9ee,
        emissive: 0x58d8df,
        emissiveIntensity: 1.6,
        roughness: 0.2,
        metalness: 0.7,
      }),
    )
    sensor.position.set(0, 1.72, 0.15)
    group.add(sensor)
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.012, 6, 27),
      new THREE.MeshBasicMaterial({ color: 0x8df4ff, transparent: true, opacity: 0.68 }),
    )
    ring.rotation.x = Math.PI / 2
    ring.position.set(0, 1.58, 0.15)
    group.add(ring)
    group.userData.sensor = { sensor, ring }
  }

  if (headlights) {
    for (const x of [-0.65, 0.65]) {
      const spot = new THREE.SpotLight(0xe9f8ff, 18, 22, 0.44, 0.52, 1.35)
      spot.position.set(x, 0.74, -2.1)
      spot.target.position.set(x * 0.3, 0, -15)
      group.add(spot, spot.target)
    }
  }

  group.userData = { kind: 'car', autonomous }
  return group
}

/** 生成带车厢的货车，用于对向车流与多方碰撞场景。 */
export function createTruck(options: { color?: number } = {}): THREE.Group {
  const color = options.color ?? 0xc4c9c7
  const group = new THREE.Group()
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.22 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x4c545a, roughness: 0.82 })
  const glass = new THREE.MeshStandardMaterial({
    color: 0x9dbacd,
    roughness: 0.18,
    metalness: 0.26,
    emissive: 0x334a59,
    emissiveIntensity: 0.08,
  })

  const cab = new THREE.Mesh(new RoundedBoxGeometry(2.35, 2.15, 2.15, 3, 0.16), paint)
  cab.position.set(0, 1.55, -3.4)
  cab.castShadow = true
  group.add(cab)

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.72, 0.04), glass)
  windshield.position.set(0, 1.98, -4.49)
  group.add(windshield)

  const trailer = new THREE.Mesh(new THREE.BoxGeometry(2.45, 2.7, 6.4), paint)
  trailer.position.set(0, 1.78, 1.05)
  trailer.castShadow = true
  trailer.receiveShadow = true
  group.add(trailer)

  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(2.47, 0.32, 6.42),
    new THREE.MeshStandardMaterial({ color: 0xb45c4a, roughness: 0.66 }),
  )
  stripe.position.set(0, 1.25, 1.05)
  group.add(stripe)

  const wheelGeometry = new THREE.CylinderGeometry(0.46, 0.46, 0.28, 14)
  for (const x of [-1.05, 1.05]) {
    for (const z of [-3.5, 0.2, 2.7]) {
      const wheel = new THREE.Mesh(wheelGeometry, dark)
      wheel.rotation.z = Math.PI / 2
      wheel.position.set(x, 0.46, z)
      wheel.castShadow = true
      group.add(wheel)
    }
  }

  const lampMaterial = new THREE.MeshStandardMaterial({
    color: 0xfff6da,
    emissive: 0xffe6aa,
    emissiveIntensity: 2.2,
  })
  for (const x of [-0.78, 0.78]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.04), lampMaterial)
    lamp.position.set(x, 1.1, -4.5)
    group.add(lamp)
    const spot = new THREE.SpotLight(0xffefc9, 18, 24, 0.42, 0.6, 1.35)
    spot.position.set(x, 1.12, -4.55)
    spot.target.position.set(x * 0.4, 0, -18)
    group.add(spot, spot.target)
  }

  group.userData = { kind: 'truck' }
  return group
}

/** 生成简化的行人模型，可用工装颜色与安全帽区分工人与路人。 */
export function createPerson(options: {
  vestColor?: number
  helmetColor?: number
  shirtColor?: number
  trouserColor?: number
  scale?: number
  helmet?: boolean
} = {}): THREE.Group {
  const {
    vestColor = 0xe2b44c,
    helmetColor = 0xf2d76a,
    shirtColor = 0x64717d,
    trouserColor = 0x596572,
    scale = 1,
    helmet = true,
  } = options
  const group = new THREE.Group()
  const skin = new THREE.MeshStandardMaterial({ color: 0xd1a37e, roughness: 0.8 })
  const shirt = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.86 })
  const vest = new THREE.MeshStandardMaterial({
    color: vestColor,
    roughness: 0.64,
    emissive: vestColor,
    emissiveIntensity: 0.08,
  })
  const trousers = new THREE.MeshStandardMaterial({ color: trouserColor, roughness: 0.9 })
  const helmetMaterial = new THREE.MeshStandardMaterial({
    color: helmetColor,
    roughness: 0.45,
    metalness: 0.15,
    emissive: helmetColor,
    emissiveIntensity: 0.1,
  })

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.23, 0.58, 4, 10), shirt)
  torso.position.y = 1.06
  torso.castShadow = true
  group.add(torso)

  const vestMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.44, 4, 10), vest)
  vestMesh.position.y = 1.16
  vestMesh.castShadow = true
  group.add(vestMesh)

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 12), skin)
  head.position.y = 1.6
  head.castShadow = true
  group.add(head)

  const helmetMesh = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.56), helmetMaterial)
  helmetMesh.position.y = 1.65
  helmetMesh.castShadow = true
  if (helmet) group.add(helmetMesh)

  const limbGeometry = new THREE.CylinderGeometry(0.062, 0.075, 0.55, 7)
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(limbGeometry, trousers)
    leg.position.set(side * 0.1, 0.38, 0)
    leg.rotation.z = side * 0.045
    leg.castShadow = true
    group.add(leg)
    const arm = new THREE.Mesh(limbGeometry, shirt)
    arm.position.set(side * 0.29, 1.06, 0)
    arm.rotation.z = side * 0.16
    arm.castShadow = true
    group.add(arm)
  }

  group.scale.setScalar(scale)
  group.userData = { kind: 'person' }
  return group
}

/** 生成低多边形行道树，随机形状由缩放与颜色派生，保持可复现。 */
export function createTree(options: { scale?: number; color?: number } = {}): THREE.Group {
  const { scale = 1, color = 0x6f9c61 } = options
  const group = new THREE.Group()
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.15, 1.6, 6),
    new THREE.MeshStandardMaterial({ color: 0x7b624c, roughness: 0.95 }),
  )
  trunk.position.y = 0.8
  trunk.castShadow = true
  group.add(trunk)

  const foliageMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.92, flatShading: true })
  const random = mulberry32(Math.round(scale * 100) + color)
  for (let index = 0; index < 3; index += 1) {
    const foliage = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.72 + random() * 0.28, 0),
      foliageMaterial,
    )
    foliage.position.set((random() - 0.5) * 0.72, 1.65 + index * 0.38, (random() - 0.5) * 0.5)
    foliage.castShadow = true
    group.add(foliage)
  }

  group.scale.setScalar(scale)
  return group
}

/** 生成路灯，可选附带真实点光源；默认只发光不产生照明开销。 */
export function createStreetLamp(options: { color?: number; light?: boolean } = {}): THREE.Group {
  const { color = 0xffd9a0, light = true } = options
  const group = new THREE.Group()
  const metal = new THREE.MeshStandardMaterial({ color: 0x67727c, roughness: 0.58, metalness: 0.35 })
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.09, 4.7, 8), metal)
  pole.position.y = 2.35
  pole.castShadow = true
  group.add(pole)

  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.1), metal)
  arm.position.set(0, 4.62, 0.5)
  arm.rotation.x = 0.12
  group.add(arm)

  const lamp = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.08, 0.62),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 1.6,
      roughness: 0.28,
    }),
  )
  lamp.position.set(0, 4.56, 1.0)
  group.add(lamp)

  if (light) {
    const point = new THREE.PointLight(color, 3.4, 9, 2)
    point.position.set(0, 4.45, 1.0)
    group.add(point)
  }
  group.userData = { kind: 'lamp' }
  return group
}

/** 生成护栏，用于天桥、基坑等边界；长度与立柱间距可调。 */
export function createGuardrail(options: {
  length?: number
  postSpacing?: number
  color?: number
} = {}): THREE.Group {
  const { length = 24, postSpacing = 2.4, color = COLORS.steel } = options
  const group = new THREE.Group()
  const metal = new THREE.MeshStandardMaterial({ color, roughness: 0.44, metalness: 0.35 })
  const postMaterial = new THREE.MeshStandardMaterial({ color: 0x7b858f, roughness: 0.58, metalness: 0.32 })

  for (let offset = -length / 2; offset <= length / 2; offset += postSpacing) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.88, 0.12), postMaterial)
    post.position.set(0, 0.44, offset)
    post.castShadow = true
    group.add(post)
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.1, 0.16),
      new THREE.MeshStandardMaterial({
        color: 0xffdf9a,
        emissive: 0xffcf6b,
        emissiveIntensity: 0.7,
        side: THREE.DoubleSide,
      }),
    )
    plate.position.set(0.07, 0.7, offset)
    group.add(plate)
  }

  for (const y of [0.58, 0.82]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.19, length), metal)
    rail.position.set(0.04, y, 0)
    rail.castShadow = true
    group.add(rail)
  }

  group.userData = { kind: 'guardrail', length }
  return group
}

/** 生成减速带（半圆柱体），用于校门前的风险点。 */
export function createSpeedBump(options: { width?: number; height?: number } = {}): THREE.Group {
  const { width = 6.4, height = 0.1 } = options
  const group = new THREE.Group()
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(height, height, width, 12, 1, false, 0, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0x565d63, roughness: 0.68 }),
  )
  base.rotation.z = Math.PI / 2
  base.scale.z = 1.6
  base.position.y = 0.03
  base.receiveShadow = true
  base.castShadow = true
  group.add(base)

  const stripeMaterial = new THREE.MeshStandardMaterial({
    color: 0xe7bd4b,
    emissive: 0x5a4a1e,
    emissiveIntensity: 0.12,
    roughness: 0.6,
  })
  for (let index = -2; index <= 2; index += 1) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.02, 0.55), stripeMaterial)
    stripe.position.set(index * 1.0, height * 0.56, 0)
    stripe.rotation.z = Math.PI / 2
    group.add(stripe)
  }
  group.userData = { kind: 'speed-bump' }
  return group
}

/** 生成脚手架，覆盖在待建/待拆建筑立面上，强化施工现场的观感。 */
export function createScaffold(options: {
  width: number
  height: number
  depth?: number
}): THREE.Group {
  const { width, height, depth = 1.4 } = options
  const group = new THREE.Group()
  const material = new THREE.MeshStandardMaterial({ color: 0x9aa5ac, roughness: 0.48, metalness: 0.35 })
  const plankMaterial = new THREE.MeshStandardMaterial({ color: 0x947a5b, roughness: 0.9 })

  const columns = Math.max(2, Math.round(width / 2.4) + 1)
  const levels = Math.max(2, Math.round(height / 2.3))
  for (let column = 0; column < columns; column += 1) {
    const x = -width / 2 + (width / (columns - 1)) * column
    for (const z of [-depth / 2, depth / 2]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, height, 6), material)
      pole.position.set(x, height / 2, z)
      pole.castShadow = true
      group.add(pole)
    }
  }
  for (let level = 1; level <= levels; level += 1) {
    const y = (height / (levels + 1)) * level
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, width, 6), material)
    bar.rotation.z = Math.PI / 2
    bar.position.set(0, y, depth / 2)
    bar.castShadow = true
    group.add(bar)
    const plank = new THREE.Mesh(new THREE.BoxGeometry(width, 0.07, depth * 0.8), plankMaterial)
    plank.position.set(0, y + 0.06, 0)
    plank.castShadow = true
    plank.receiveShadow = true
    group.add(plank)
  }
  const cross = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, Math.hypot(width * 0.32, height * 0.6), 5), material)
  cross.position.set(-width * 0.2, height * 0.42, depth / 2 + 0.02)
  cross.rotation.z = -0.66
  group.add(cross)
  return group
}

/**
 * 沿给定控制点生成轨道：道砟带、枕木与双轨。
 * 同时返回曲线本身，供电车按进度取点运动。
 */
export function createRailway(options: {
  points: THREE.Vector3[]
  gauge?: number
  color?: number
  sleeperSpacing?: number
}): { group: THREE.Group; curve: THREE.CatmullRomCurve3 } {
  const { points, gauge = 1.42, color = 0x6f7881, sleeperSpacing = 1.1 } = options
  const group = new THREE.Group()
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.2)
  const samples = 180

  // 道砟带
  const vertices: number[] = []
  const indices: number[] = []
  const halfWidth = 2.0
  for (let index = 0; index <= samples; index += 1) {
    const t = index / samples
    const point = curve.getPointAt(t)
    const tangent = curve.getTangentAt(t).normalize()
    const perpendicular = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize()
    const left = point.clone().addScaledVector(perpendicular, halfWidth)
    const right = point.clone().addScaledVector(perpendicular, -halfWidth)
    vertices.push(left.x, 0.025, left.z, right.x, 0.025, right.z)
    if (index < samples) {
      const baseIndex = index * 2
      indices.push(baseIndex, baseIndex + 1, baseIndex + 2, baseIndex + 1, baseIndex + 3, baseIndex + 2)
    }
  }
  const ballastGeometry = new THREE.BufferGeometry()
  ballastGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  ballastGeometry.setIndex(indices)
  ballastGeometry.computeVertexNormals()
  const ballast = new THREE.Mesh(
    ballastGeometry,
    new THREE.MeshStandardMaterial({ color: 0x9a9489, roughness: 0.98 }),
  )
  ballast.receiveShadow = true
  group.add(ballast)

  const railMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.85 })
  for (const offset of [-gauge / 2, gauge / 2]) {
    const railPoints: THREE.Vector3[] = []
    for (let index = 0; index <= samples; index += 1) {
      const t = index / samples
      const point = curve.getPointAt(t)
      const tangent = curve.getTangentAt(t).normalize()
      const perpendicular = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize()
      railPoints.push(point.clone().addScaledVector(perpendicular, offset).setY(0.14))
    }
    const railCurve = new THREE.CatmullRomCurve3(railPoints, false, 'catmullrom', 0.2)
    const rail = new THREE.Mesh(new THREE.TubeGeometry(railCurve, samples, 0.055, 5, false), railMaterial)
    rail.castShadow = true
    group.add(rail)
  }

  const sleeperMaterial = new THREE.MeshStandardMaterial({ color: 0x8a735c, roughness: 0.94 })
  const sleeperLength = gauge + 0.9
  const sleeperCount = Math.floor(curve.getLength() / sleeperSpacing)
  const sleeperGeometry = new THREE.BoxGeometry(sleeperLength, 0.12, 0.23)
  for (let index = 0; index < sleeperCount; index += 1) {
    const t = (index + 0.5) / sleeperCount
    const point = curve.getPointAt(t)
    const tangent = curve.getTangentAt(t).normalize()
    const sleeper = new THREE.Mesh(sleeperGeometry, sleeperMaterial)
    sleeper.position.set(point.x, 0.075, point.z)
    sleeper.rotation.y = Math.atan2(tangent.x, tangent.z)
    sleeper.receiveShadow = true
    group.add(sleeper)
  }

  group.userData = { kind: 'railway' }
  return { group, curve }
}

/**
 * 生成雨幕粒子系统，返回需要每帧调用的 `update`，
 * 由场景注册到舞台的 updater 中驱动。
 */
export function createRain(options: {
  count?: number
  area?: { x: number; y: number; z: number }
  center?: THREE.Vector3
} = {}): { group: THREE.Group; update: (delta: number) => void } {
  const {
    count = 900,
    area = { x: 44, y: 24, z: 76 },
    center = new THREE.Vector3(0, 0, 0),
  } = options
  const positions = new Float32Array(count * 6)
  const speeds = new Float32Array(count)
  const random = mulberry32(91)

  for (let index = 0; index < count; index += 1) {
    const x = center.x + (random() - 0.5) * area.x
    const y = center.y + random() * area.y
    const z = center.z + (random() - 0.5) * area.z
    const length = 0.35 + random() * 0.75
    const base = index * 6
    positions[base] = x
    positions[base + 1] = y
    positions[base + 2] = z
    positions[base + 3] = x - 0.12
    positions[base + 4] = y - length
    positions[base + 5] = z + 0.05
    speeds[index] = 14 + random() * 16
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const material = new THREE.LineBasicMaterial({
    color: 0x86a8bf,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  })
  const lines = new THREE.LineSegments(geometry, material)
  lines.frustumCulled = false
  const group = new THREE.Group()
  group.add(lines)

  function update(delta: number) {
    const attribute = geometry.getAttribute('position') as THREE.BufferAttribute
    const array = attribute.array as Float32Array
    for (let index = 0; index < count; index += 1) {
      const base = index * 6
      const drop = speeds[index] * delta
      array[base + 1] -= drop
      array[base + 4] -= drop
      if (array[base + 4] < 0) {
        const resetY = area.y
        const length = array[base + 1] - array[base + 4]
        array[base + 1] = resetY
        array[base + 4] = resetY - length
      }
    }
    attribute.needsUpdate = true
  }

  return { group, update }
}

/** 生成半透明积水圆盘，用于湿滑路面与制动距离的视觉暗示。 */
export function createPuddle(options: { radius?: number; color?: number } = {}): THREE.Mesh {
  const { radius = 2.2, color = 0xcfe4f2 } = options
  const puddle = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 28),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.12,
      metalness: 0.2,
      transparent: true,
      opacity: 0.55,
    }),
  )
  puddle.rotation.x = -Math.PI / 2
  puddle.position.y = 0.018
  return puddle
}

/** 生成污水积潭：复用积水网格，换成深色低反光材质。 */
export function createSewagePool(options: { radius?: number } = {}): THREE.Mesh {
  const puddle = createPuddle({ radius: options.radius ?? 2.4, color: 0x4b482f })
  const material = puddle.material as THREE.MeshStandardMaterial
  material.roughness = 0.24
  material.metalness = 0.18
  material.color.setHex(0x4b482f)
  material.opacity = 0.78
  return puddle
}

/** 生成一段水平管道（含两端法兰），用于污水管接口等细节。 */
export function createPipe(options: { length?: number; radius?: number; color?: number } = {}): THREE.Group {
  const { length = 4.2, radius = 0.24, color = 0x8b9294 } = options
  const group = new THREE.Group()
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.25 })
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 14), material)
  pipe.rotation.z = Math.PI / 2
  pipe.castShadow = true
  group.add(pipe)
  for (const x of [-length / 2 + 0.2, length / 2 - 0.2]) {
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(radius + 0.05, radius + 0.05, 0.16, 14), material)
    collar.rotation.z = Math.PI / 2
    collar.position.x = x
    group.add(collar)
  }
  return group
}
