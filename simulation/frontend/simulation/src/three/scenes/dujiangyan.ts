import * as THREE from 'three'
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import { createTree } from '../primitives'
import { Stage, disposeObject } from '../stage'
import type { CameraPreset, ScenarioSceneOptions, ScenarioStageHandle } from './types'

type StageTween = ReturnType<Stage['after']>
type TweenTarget = Parameters<Stage['tweenTo']>[0]
type TweenVars = Parameters<Stage['tweenTo']>[1]

const CAMERA_PRESETS: Record<string, CameraPreset> = {
  overview: { position: [18, 34, 76], target: [-8, 2, 27] },
  survey: { position: [0, 40, 74], target: [-9, 2, 28] },
  bottleneck: { position: [-11.4, 11, 62], target: [-11.4, 3, 41] },
  irrigation: { position: [-2, 38, 18], target: [-13, 1, 48] },
  fishmouth: { position: [30, 34, 24], target: [0, 0, 6] },
  split: { position: [32, 30, 42], target: [0, 1, 8] },
  weir: { position: [9, 15, 42], target: [-8, 1.2, 19] },
  maintenance: { position: [4, 9, 26], target: [-10.5, 0.7, 25] },
  legacy: { position: [-2, 26, 68], target: [-10, 2, 30] },
}

const WEIR_TOP: Record<'low' | 'mid' | 'high', number> = {
  low: 0.3,
  mid: 0.45,
  high: 0.62,
}

const CAGE_TARGETS: Array<[number, number, number, number]> = [
  [0, 0.36, -12.6, 0.04],
  [0.1, 0.36, -10.5, -0.03],
  [-1.3, 0.36, -8.5, 0.06],
  [1.3, 0.36, -8.6, -0.05],
  [-2.6, 0.36, -6.4, 0.02],
  [0, 1.02, -6.5, -0.04],
  [2.6, 0.36, -6.3, 0.05],
]

const INNER_PATH: Array<[number, number]> = [
  [-3.4, -16],
  [-5.6, -8],
  [-7.4, 2],
  [-9, 10],
  [-10.2, 18],
  [-11, 26],
  [-11.4, 34],
  [-11, 40],
]

interface IrrigationCanalSpec {
  path: Array<[number, number]>
  widths: number[]
}

/**
 * 宝瓶口之后的三条干渠。三条渠在口门内侧并排起水，穿过平原后分别向左、
 * 中、右三个方向展开，整体呈「山」字形，而不是让江水铺满整个平原。
 */
const IRRIGATION_CANALS: IrrigationCanalSpec[] = [
  {
    path: [
      [-12.9, 43.0],
      [-16.4, 47.2],
      [-22.4, 52.0],
      [-29.2, 58.2],
      [-36.0, 65.6],
      [-40.6, 73.4],
    ],
    widths: [1.7, 1.55, 1.4, 1.25, 1.1, 0.95],
  },
  {
    path: [
      [-11.3, 42.6],
      [-11.2, 49.6],
      [-11.0, 56.6],
      [-10.6, 64.2],
      [-10.0, 72.8],
    ],
    widths: [2.05, 1.9, 1.72, 1.52, 1.34],
  },
  {
    path: [
      [-9.7, 43.0],
      [-6.2, 47.2],
      [-0.2, 52.0],
      [6.6, 58.2],
      [13.4, 65.6],
      [18.0, 73.4],
    ],
    widths: [1.7, 1.55, 1.4, 1.25, 1.1, 0.95],
  },
]

const OUTER_PATH: Array<[number, number]> = [
  [3.4, -16],
  [7, -8],
  [9.2, 2],
  [10.6, 10],
  [11.6, 18],
  [12.2, 26],
  [13.6, 34],
  [16, 42],
  [20, 52],
  [25, 64],
  [31, 78],
  [36, 90],
]

const UPSTREAM_PATH: Array<[number, number]> = [
  [-4, -96],
  [-3, -80],
  [2, -66],
  [8, -54],
  [11, -42],
  [8, -31],
  [3, -24],
  [-1, -18],
  [0, -15],
]

const RIDGE = {
  minX: -46,
  maxX: -3,
  minZ: 28,
  maxZ: 40,
  cols: 58,
  rows: 16,
  gapX: -11.4,
}

const AMBIENCE = {
  calm: {
    background: 0xadc9c9,
    fogColor: 0xd3e0d6,
    fogDensity: 0.0038,
    sunIntensity: 2.9,
    sunColor: 0xfff0d2,
    fillIntensity: 1.08,
    exposure: 0.95,
    skyTop: 0x6aa3bf,
    skyHorizon: 0xf0e0bd,
    skyBottom: 0xd5e0d3,
  },
  tense: {
    background: 0x7f9699,
    fogColor: 0xaebcb9,
    fogDensity: 0.008,
    sunIntensity: 2,
    sunColor: 0xffd9ad,
    fillIntensity: 0.95,
    exposure: 0.9,
    skyTop: 0x4f7183,
    skyHorizon: 0xcabf9e,
    skyBottom: 0xaebdb5,
  },
  critical: {
    background: 0x63757a,
    fogColor: 0x94a29f,
    fogDensity: 0.012,
    sunIntensity: 1.4,
    sunColor: 0xffc69b,
    fillIntensity: 0.85,
    exposure: 0.86,
    skyTop: 0x3a525e,
    skyHorizon: 0xa8a68e,
    skyBottom: 0x8e9c96,
  },
} as const

/** 固定种子的伪随机数，保证每次构建的山形、砂石分布一致。 */
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 平滑插值，用于山体轮廓与缺口过渡，避免出现硬边。 */
function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/** 二维哈希，为噪声函数提供可复现的随机值。 */
function hash2(x: number, y: number): number {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return value - Math.floor(value)
}

/** 双线性插值的值噪声，用来给山体表面增加自然起伏。 */
function valueNoise(x: number, y: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)
  const a = hash2(ix, iy)
  const b = hash2(ix + 1, iy)
  const c = hash2(ix, iy + 1)
  const d = hash2(ix + 1, iy + 1)
  return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy
}

/** 按进度 t 在宽度数组上线性插值，让河道宽度平滑变化。 */
function widthAt(widths: number[], t: number): number {
  const position = Math.min(widths.length - 1, Math.max(0, t * (widths.length - 1)))
  const index = Math.floor(position)
  const next = Math.min(widths.length - 1, index + 1)
  const mix = position - index
  return widths[index] * (1 - mix) + widths[next] * mix
}

/** 点到折线的最小距离，用于让农田给干渠让出走廊。 */
function distanceToPath(x: number, z: number, path: Array<[number, number]>): number {
  let best = Number.POSITIVE_INFINITY
  for (let index = 0; index < path.length - 1; index += 1) {
    const [ax, az] = path[index]
    const [bx, bz] = path[index + 1]
    const dx = bx - ax
    const dz = bz - az
    const lengthSquared = dx * dx + dz * dz
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / lengthSquared))
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)))
  }
  return best
}

/**
 * 沿曲线生成带宽度的条带网格，是河道、水面与河床的共用几何体。
 * 传入 `edgeHeight` 时生成抛物线横断面：中线高程为 `height`，两岸为 `edgeHeight`，
 * 用来表达内江深槽、外江宽浅且床底加高的真实河床。
 */
function createRibbonGeometry(
  curve: THREE.CatmullRomCurve3,
  widths: number[],
  height: number,
  segments = 130,
  crossSegments = 1,
  edgeHeight?: number,
): THREE.BufferGeometry {
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const normal = new THREE.Vector3()
  const rowSize = crossSegments + 1

  for (let step = 0; step <= segments; step += 1) {
    const t = step / segments
    const point = curve.getPointAt(t)
    const tangent = curve.getTangentAt(t)
    normal.set(-tangent.z, 0, tangent.x).normalize()
    const half = widthAt(widths, t) / 2
    for (let cross = 0; cross <= crossSegments; cross += 1) {
      const u = cross / crossSegments
      const offset = half * (1 - u * 2)
      const bank = (1 - u * 2) * (1 - u * 2)
      const y = edgeHeight === undefined ? height : height + (edgeHeight - height) * bank
      positions.push(point.x + normal.x * offset, y, point.z + normal.z * offset)
      uvs.push(u, t)
    }
    if (step < segments) {
      for (let cross = 0; cross < crossSegments; cross += 1) {
        const base = step * rowSize + cross
        indices.push(base, base + rowSize, base + 1, base + 1, base + rowSize, base + rowSize + 1)
      }
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function createWaterMaterial(deep: number, shallow: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: true,
    uniforms: {
      uTime: { value: 0 },
      uFlow: { value: 1 },
      uFoam: { value: 0.1 },
      uOpacity: { value: 0.9 },
      uDeep: { value: new THREE.Color(deep) },
      uShallow: { value: new THREE.Color(shallow) },
      uBedCenter: { value: -10 },
      uBedEdge: { value: -10 },
      fogColor: { value: new THREE.Color(0xd8e6df) },
      fogDensity: { value: 0.0065 },
      fogNear: { value: 1 },
      fogFar: { value: 200 },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uFlow;
      uniform float uBedCenter;
      uniform float uBedEdge;
      varying vec2 vUv;
      varying vec3 vViewPosition;
      varying float vElevation;
      varying float vBedY;
      varying float vWorldY;
      #include <fog_pars_vertex>
      void main() {
        vUv = uv;
        float bank = smoothstep(0.0, 0.12, uv.x) * smoothstep(1.0, 0.88, uv.x);
        float crossSection = (1.0 - uv.x * 2.0) * (1.0 - uv.x * 2.0);
        vBedY = uBedCenter + (uBedEdge - uBedCenter) * crossSection;
        float time = uTime * uFlow;
        float longWave = sin(uv.y * 82.0 - time * 3.1 + uv.x * 8.0);
        float crossWave = sin(uv.y * 37.0 - time * 2.2 - uv.x * 19.0);
        vElevation = (longWave * 0.022 + crossWave * 0.012) * bank;
        vec3 transformed = position;
        transformed.y += vElevation;
        vWorldY = (modelMatrix * vec4(transformed, 1.0)).y;
        vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uFlow;
      uniform float uFoam;
      uniform float uOpacity;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      varying vec2 vUv;
      varying vec3 vViewPosition;
      varying float vElevation;
      varying float vBedY;
      varying float vWorldY;
      #include <common>
      #include <fog_pars_fragment>

      float waterHash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float waterNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(waterHash(i), waterHash(i + vec2(1.0, 0.0)), u.x),
          mix(waterHash(i + vec2(0.0, 1.0)), waterHash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }
      void main() {
        // 水面低于河床的位置直接露出河滩：枯水期外江因此退成细流，内江仍满槽。
        if (vWorldY < vBedY + 0.004) discard;
        float depth = max(vWorldY - vBedY, 0.0);
        float time = uTime * uFlow;
        float bank = smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x);
        float broadNoise = waterNoise(vec2(vUv.x * 5.0, vUv.y * 34.0 - time * 0.8));
        float ripple = sin(vUv.y * 96.0 - time * 4.2 + sin(vUv.x * 22.0) * 1.4);
        float ripple2 = sin(vUv.y * 53.0 - time * 2.8 - vUv.x * 31.0);
        float shallowness = 1.0 - clamp(depth * 2.4, 0.0, 1.0);
        vec3 color = mix(uDeep, uShallow, 0.32 + broadNoise * 0.38 + vElevation * 3.0 + shallowness * 0.3);
        color *= 0.96 + ripple * 0.035 + ripple2 * 0.025;

        vec3 normal = normalize(vec3(ripple2 * 0.12, 1.0, ripple * 0.18));
        vec3 viewDir = normalize(vViewPosition);
        vec3 lightDir = normalize(vec3(0.35, 0.85, 0.4));
        float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);
        float specular = pow(max(dot(reflect(-lightDir, normal), viewDir), 0.0), 72.0);
        color = mix(color, vec3(0.56, 0.72, 0.75), fresnel * 0.24);
        color += vec3(1.0, 0.94, 0.78) * specular * 0.5;

        float shore = 1.0 - smoothstep(0.0, 0.085, min(vUv.x, 1.0 - vUv.x));
        float brokenShore = smoothstep(0.38, 0.78, waterNoise(vec2(vUv.x * 24.0, vUv.y * 120.0 - time * 2.0)));
        float streak = smoothstep(0.91, 0.995, ripple * 0.5 + 0.5) * smoothstep(0.42, 0.8, broadNoise);
        float foam = shore * brokenShore * (0.16 + uFoam * 0.4) + streak * bank * uFoam * 0.22;
        color = mix(color, vec3(0.84, 0.94, 0.92), foam);
        color = mix(color, uDeep * 0.8, shore * 0.2);
        float alpha = uOpacity * (vBedY < -5.0 ? 1.0 : clamp(0.3 + depth * 2.6, 0.0, 1.0));
        gl_FragColor = vec4(color, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  })
}

/** 生成柔边圆点贴图，供尘土、蒸汽等粒子使用。 */
function createPuffTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const context = canvas.getContext('2d')
  if (context) {
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32)
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)')
    gradient.addColorStop(0.45, 'rgba(255, 255, 255, 0.42)')
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, 64, 64)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** 生成草地/土地的斑驳贴图，避免大面积纯色地面显得平板。 */
function createGroundTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const context = canvas.getContext('2d')
  const random = mulberry32(23)
  if (context) {
    context.fillStyle = '#8c9c6e'
    context.fillRect(0, 0, 256, 256)
    for (let index = 0; index < 2400; index += 1) {
      const green = 88 + Math.round(random() * 46)
      const red = 112 + Math.round(random() * 34)
      const blue = 72 + Math.round(random() * 30)
      context.fillStyle = `rgba(${red}, ${green}, ${blue}, ${0.08 + random() * 0.14})`
      context.beginPath()
      context.arc(random() * 256, random() * 256, 1 + random() * 7, 0, Math.PI * 2)
      context.fill()
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(10, 10)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

interface FigureHandle {
  group: THREE.Group
  rightArm: THREE.Group
  head: THREE.Group
}

interface FigureOptions {
  robe?: number
  trim?: number
  hat?: 'guan' | 'douli' | 'headband' | 'none'
  tool?: 'staff' | 'hammer' | 'none'
  beard?: boolean
  scale?: number
  shadow?: boolean
}

/**
 * 生成低多边形人物（李冰、二郎、工人、农夫等）。
 * 返回 `rightArm` 与 `head` 句柄，供动作演出直接驱动。
 */
function createFigure(options: FigureOptions = {}): FigureHandle {
  const {
    robe = 0x6d7f6a,
    trim = 0x3d4a42,
    hat = 'headband',
    tool = 'none',
    beard = false,
    scale = 1,
    shadow = true,
  } = options

  const group = new THREE.Group()
  const robeMaterial = new THREE.MeshStandardMaterial({ color: robe, roughness: 0.94, flatShading: true })
  const trimMaterial = new THREE.MeshStandardMaterial({ color: trim, roughness: 0.9 })
  const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xcaa07b, roughness: 0.86 })
  const hairMaterial = new THREE.MeshStandardMaterial({ color: 0x2b2622, roughness: 0.92 })
  const strawMaterial = new THREE.MeshStandardMaterial({ color: 0xb99a5c, roughness: 0.92, flatShading: true })

  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.38, 1.05, 9), robeMaterial)
  skirt.position.y = 0.62
  skirt.castShadow = shadow
  group.add(skirt)

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.27, 0.58, 9), robeMaterial)
  torso.position.y = 1.16
  torso.castShadow = shadow
  group.add(torso)

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.23, 0.15, 9), trimMaterial)
  collar.position.y = 1.46
  group.add(collar)

  const sash = new THREE.Mesh(new THREE.CylinderGeometry(0.385, 0.385, 0.08, 9, 1, true), trimMaterial)
  sash.position.y = 0.87
  group.add(sash)

  const head = new THREE.Group()
  head.position.y = 1.71
  group.add(head)

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), skinMaterial)
  skull.castShadow = shadow
  head.add(skull)

  if (beard) {
    const beardMesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.095, 0.38, 6),
      new THREE.MeshStandardMaterial({ color: 0xd9d5c9, roughness: 0.95, flatShading: true }),
    )
    beardMesh.position.set(0, -0.24, 0.09)
    beardMesh.rotation.x = Math.PI
    head.add(beardMesh)
  }

  if (hat === 'guan') {
    const bun = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.105, 0.12, 8), hairMaterial)
    bun.position.y = 0.16
    head.add(bun)
    const crown = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.12, 0.19), trimMaterial)
    crown.position.y = 0.25
    crown.castShadow = shadow
    head.add(crown)
    const pin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.4, 5),
      new THREE.MeshStandardMaterial({ color: 0xcbb37a, roughness: 0.55, metalness: 0.35 }),
    )
    pin.rotation.z = Math.PI / 2
    pin.position.y = 0.22
    head.add(pin)
  } else if (hat === 'douli') {
    const brim = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.16, 10, 1, true), strawMaterial)
    brim.position.y = 0.18
    brim.castShadow = shadow
    head.add(brim)
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.12, 9, 1, true), strawMaterial)
    top.position.y = 0.27
    head.add(top)
  } else if (hat === 'headband') {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.172, 0.025, 5, 12), trimMaterial)
    band.rotation.x = Math.PI / 2
    band.position.y = 0.07
    head.add(band)
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), hairMaterial)
    bun.position.y = 0.17
    head.add(bun)
  } else {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.175, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
      hairMaterial,
    )
    cap.position.y = 0.02
    head.add(cap)
  }

  function buildArm(side: number): THREE.Group {
    const pivot = new THREE.Group()
    pivot.position.set(side * 0.26, 1.39, 0)
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.098, 0.073, 0.5, 7), robeMaterial)
    sleeve.position.y = -0.25
    sleeve.castShadow = shadow
    pivot.add(sleeve)
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), skinMaterial)
    hand.position.y = -0.51
    pivot.add(hand)
    pivot.rotation.z = side * 0.14
    group.add(pivot)
    return pivot
  }

  buildArm(-1)
  const rightArm = buildArm(1)

  if (tool === 'staff') {
    const staff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.026, 1.9, 6),
      new THREE.MeshStandardMaterial({ color: 0x6b4f36, roughness: 0.9 }),
    )
    staff.position.set(0, -0.6, 0.04)
    staff.castShadow = shadow
    rightArm.add(staff)
  } else if (tool === 'hammer') {
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.03, 0.7, 6),
      new THREE.MeshStandardMaterial({ color: 0x7a5a3c, roughness: 0.9 }),
    )
    handle.position.y = -0.64
    rightArm.add(handle)
    const hammerHead = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.13, 0.15),
      new THREE.MeshStandardMaterial({ color: 0x6e6f6b, roughness: 0.55, metalness: 0.4 }),
    )
    hammerHead.position.y = -0.94
    rightArm.add(hammerHead)
  }

  group.scale.setScalar(scale)
  return { group, rightArm, head }
}

interface BedProfile {
  center: number
  edge: number
}

interface Channel {
  mesh: THREE.Mesh
  material: THREE.ShaderMaterial
  flow: THREE.InstancedMesh
  flowData: Array<{ offset: number; speed: number; lane: number; size: number }>
  maxFlow: number
  widthSampler: (t: number) => number
  curve: THREE.CatmullRomCurve3
  bed: BedProfile
  bedMesh?: THREE.Mesh
}

interface BuildLabel {
  element: HTMLSpanElement
  object: CSS2DObject
}

/** 都江堰建造过程场景：山河、竹笼鱼嘴、宝瓶口、飞沙堰与岁修。 */
export function buildDujiangyanScene(
  host: HTMLElement,
  options: ScenarioSceneOptions,
): ScenarioStageHandle {
  const stage = new Stage(host, {
    reducedMotion: options.reducedMotion,
    cinematic: options.cinematicCamera,
  })
  stage.camera.fov = 48
  stage.camera.updateProjectionMatrix()
  stage.onHotspot(options.onInspect)

  for (const level of ['calm', 'tense', 'critical'] as const) {
    const preset = AMBIENCE[level]
    stage.defineAmbience(level, {
      background: preset.background,
      fogColor: preset.fogColor,
      fogDensity: preset.fogDensity,
      sunIntensity: preset.sunIntensity,
      sunColor: preset.sunColor,
      fillIntensity: preset.fillIntensity,
      exposure: preset.exposure,
    })
  }

  const tweens: StageTween[] = []
  const transient: THREE.Object3D[] = []
  const puffTexture = createPuffTexture()

  function tw(target: TweenTarget, vars: TweenVars): StageTween {
    const tween = stage.tweenTo(target, { overwrite: 'auto', ...vars })
    tweens.push(tween)
    return tween
  }

  function later(ms: number, callback: () => void): void {
    tweens.push(stage.after(ms, callback))
  }

  function camera(preset: string, immediate = false): void {
    const config = CAMERA_PRESETS[preset] ?? CAMERA_PRESETS.overview
    stage.cameraTo(config.position, config.target, { immediate })
  }

  // -------------------------------------------------------------------------
  // Sky, terrain and distant mountains
  // -------------------------------------------------------------------------

  const skyUniforms = {
    topColor: { value: new THREE.Color(AMBIENCE.calm.skyTop) },
    horizonColor: { value: new THREE.Color(AMBIENCE.calm.skyHorizon) },
    bottomColor: { value: new THREE.Color(AMBIENCE.calm.skyBottom) },
  }
  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: skyUniforms,
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
        vec3 color = mix(bottomColor, horizonColor, smoothstep(-0.04, 0.12, h));
        color = mix(color, topColor, smoothstep(0.1, 0.7, h));
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  })
  stage.scene.add(new THREE.Mesh(new THREE.SphereGeometry(190, 32, 20), skyMaterial))

  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x93a074,
    map: createGroundTexture(),
    roughness: 0.98,
  })
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(230, 230), groundMaterial)
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.04
  ground.receiveShadow = true
  stage.scene.add(ground)

  const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x6a6a5c, roughness: 0.98, flatShading: true })
  const darkRockMaterial = new THREE.MeshStandardMaterial({ color: 0x55574e, roughness: 1, flatShading: true })
  const greenRockMaterial = new THREE.MeshStandardMaterial({ color: 0x5c7053, roughness: 0.98, flatShading: true })

  /** 生成一座圆锥形山体，用不同岩石材质堆出远景层次。 */
  function addPeak(x: number, z: number, radius: number, height: number, material: THREE.Material): void {
    const peak = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 7), material)
    peak.position.set(x, height / 2 - 0.4, z)
    peak.rotation.y = (x + z) * 0.07
    stage.scene.add(peak)
    const shoulder = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.62, height * 0.72, 6), material)
    shoulder.position.set(x + radius * 0.68, height * 0.36 - 0.4, z + radius * 0.34)
    stage.scene.add(shoulder)
  }

  addPeak(-44, -46, 18, 27, greenRockMaterial)
  addPeak(-52, -18, 16, 21, rockMaterial)
  addPeak(-30, -66, 20, 25, darkRockMaterial)
  addPeak(34, -58, 17, 23, greenRockMaterial)
  addPeak(22, -36, 6, 5, greenRockMaterial)
  addPeak(43, -22, 17, 18, rockMaterial)
  addPeak(-58, 32, 13, 12, greenRockMaterial)
  addPeak(-15, -30, 6, 11, greenRockMaterial)
  addPeak(-24, 8, 9, 9, greenRockMaterial)

  // 玉垒山：带缺口的低多边形山体，缺口随开凿进度张开。
  const ridgeGeometry = new THREE.BufferGeometry()
  {
    const cols = RIDGE.cols + 1
    const rows = RIDGE.rows + 1
    const positions = new Float32Array(cols * rows * 3)
    const colors = new Float32Array(cols * rows * 3)
    const uvs = new Float32Array(cols * rows * 2)
    const indices: number[] = []
    for (let row = 0; row <= RIDGE.rows; row += 1) {
      for (let col = 0; col <= RIDGE.cols; col += 1) {
        const index = row * cols + col
        const x = RIDGE.minX + ((RIDGE.maxX - RIDGE.minX) * col) / RIDGE.cols
        const z = RIDGE.minZ + ((RIDGE.maxZ - RIDGE.minZ) * row) / RIDGE.rows
        positions[index * 3] = x
        positions[index * 3 + 1] = 0
        positions[index * 3 + 2] = z
        uvs[index * 2] = col / RIDGE.cols
        uvs[index * 2 + 1] = row / RIDGE.rows
      }
    }
    for (let row = 0; row < RIDGE.rows; row += 1) {
      for (let col = 0; col < RIDGE.cols; col += 1) {
        const a = row * cols + col
        const b = a + 1
        const c = a + cols
        const d = c + 1
        indices.push(a, c, b, b, c, d)
      }
    }
    ridgeGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    ridgeGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    ridgeGeometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
    ridgeGeometry.setIndex(indices)
  }

  const ridge = new THREE.Mesh(
    ridgeGeometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97, flatShading: true }),
  )
  ridge.castShadow = true
  ridge.receiveShadow = true
  stage.scene.add(ridge)

  const rockColor = new THREE.Color(0x72746a)
  const grassColor = new THREE.Color(0x6c8059)
  const cutColor = new THREE.Color(0x9c9480)
  const mixedColor = new THREE.Color()

  /** 玉垒山的高度场：`open` 越大，中间缺口越宽，模拟宝瓶口开凿进度。 */
  function ridgeHeight(x: number, z: number, open: number): number {
    const tx = (x - RIDGE.minX) / (RIDGE.maxX - RIDGE.minX)
    const tz = (z - RIDGE.minZ) / (RIDGE.maxZ - RIDGE.minZ)
    const dx = Math.abs(x - RIDGE.gapX)
    const base =
      11.5 *
      smoothstep(0, 0.08, tx) *
      (1 - smoothstep(0.9, 1, tx)) *
      Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, tz))), 0.86)
    const noise = (valueNoise(x * 0.22, z * 0.22) - 0.5) * 1.35
    const gapHalf = 0.3 + open * 1.55
    const mask = smoothstep(gapHalf, gapHalf + 0.95, dx)
    const wall = Math.max(0, base + noise) * mask
    const fill = (1 - open) * (1 - smoothstep(gapHalf + 0.15, gapHalf + 2.6, dx)) * base
    return Math.max(0, Math.max(wall, fill))
  }

  const gapState = { value: 0 }
  const ridgeAttachments: Array<{
    object: THREE.Object3D
    x: number
    z: number
    offset: number
  }> = []

  /** 按缺口开度重建山体顶点与顶点色，是开凿动画的每帧回调。 */
  function writeRidge(open: number): void {
    const positions = ridgeGeometry.getAttribute('position') as THREE.BufferAttribute
    const colors = ridgeGeometry.getAttribute('color') as THREE.BufferAttribute
    const cols = RIDGE.cols + 1
    const gapHalf = 0.3 + open * 1.55
    for (let row = 0; row <= RIDGE.rows; row += 1) {
      for (let col = 0; col <= RIDGE.cols; col += 1) {
        const index = row * cols + col
        const x = positions.getX(index)
        const z = positions.getZ(index)
        const y = ridgeHeight(x, z, open)
        positions.setY(index, y)
        const dx = Math.abs(x - RIDGE.gapX)
        const cutMix = 1 - smoothstep(gapHalf + 0.1, gapHalf + 1.6, dx)
        const greenMix = smoothstep(5.0, 8.8, y) * (1 - cutMix * 0.8)
        mixedColor.copy(rockColor).lerp(grassColor, greenMix).lerp(cutColor, cutMix * 0.45)
        const shade = 0.86 + valueNoise(x * 0.3 + 11, z * 0.3 + 3) * 0.24
        colors.setXYZ(index, mixedColor.r * shade, mixedColor.g * shade, mixedColor.b * shade)
      }
    }
    positions.needsUpdate = true
    colors.needsUpdate = true
    ridgeGeometry.computeVertexNormals()
    for (const attachment of ridgeAttachments) {
      const height = ridgeHeight(attachment.x, attachment.z, open)
      attachment.object.position.y = height + attachment.offset
      attachment.object.visible = height > 0.3
    }
  }

  writeRidge(0)

  for (const [x, z, size, rotation] of [
    [-17, 31, 1.0, 0.4],
    [-22, 35, 1.2, 1.1],
    [-28, 30, 0.8, 2.2],
    [-8.2, 31.5, 0.9, 0.8],
    [-6.5, 36, 1.05, 1.7],
    [-14.5, 38, 0.85, 2.8],
  ] as const) {
    const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(size, 0), rockMaterial)
    boulder.position.set(x, ridgeHeight(x, z, 0) + size * 0.35, z)
    boulder.rotation.set(rotation, rotation * 1.4, rotation * 0.6)
    boulder.castShadow = true
    stage.scene.add(boulder)
    ridgeAttachments.push({ object: boulder, x, z, offset: size * 0.35 })
  }
  for (const [x, z, scale] of [
    [-21, 33, 0.9],
    [-24.5, 31.5, 0.75],
    [-17.5, 34.5, 0.8],
  ] as const) {
    const tree = createTree({ scale, color: 0x526b45 })
    tree.position.set(x, ridgeHeight(x, z, 0) - 0.1, z)
    stage.scene.add(tree)
    ridgeAttachments.push({ object: tree, x, z, offset: -0.1 })
  }

  // -------------------------------------------------------------------------
  // Rivers and irrigation canals
  // -------------------------------------------------------------------------

  const bedMaterial = new THREE.MeshStandardMaterial({ color: 0x6e5f48, roughness: 1 })
  // 各条水道的河床高程：内江深窄，外江宽浅且床底加高，是四六分水的地形基础。
  const INNER_BED: BedProfile = { center: 0.02, edge: 0.1 }
  const OUTER_BED: BedProfile = { center: 0.12, edge: 0.3 }
  const UPSTREAM_BED: BedProfile = { center: 0.02, edge: 0.14 }
  const CANAL_BED: BedProfile = { center: 0, edge: 0.02 }
  const NO_BED: BedProfile = { center: -10, edge: -10 }
  // 统一水面高程。枯水 0.2 低于外江两岸，外江只剩细流；丰水 0.58 漫过整个宽浅外江。
  const SEASON_LEVEL: Record<'dry' | 'normal' | 'flood', number> = { dry: 0.2, normal: 0.3, flood: 0.58 }
  const hydro = {
    level: SEASON_LEVEL.dry,
    inner: 0.6,
    targetLevel: SEASON_LEVEL.dry,
    targetInner: 0.6,
    flood: 0,
    targetFlood: 0,
    backwater: 0,
    targetBackwater: 0,
  }

  const channels: Channel[] = []
  const canalChannels: Channel[] = []
  const waterMaterials: THREE.ShaderMaterial[] = []

  /**
   * 构建一条水道：河床条带、水面网格与随水流移动的粒子。
   * 内江、外江、上游与灌渠都复用同一套构建逻辑。
   */
  function buildChannel(
    path: Array<[number, number]>,
    widths: number[],
    flowCount: number,
    deep: number,
    shallow: number,
    parent: THREE.Object3D = stage.scene,
    bed: BedProfile = NO_BED,
  ): Channel {
    const curve = new THREE.CatmullRomCurve3(
      path.map(([x, z]) => new THREE.Vector3(x, 0, z)),
      false,
      'catmullrom',
      0.42,
    )
    const widthSampler = (t: number): number => widthAt(widths, t)

    let bedMesh: THREE.Mesh | undefined
    if (parent === stage.scene) {
      bedMesh = new THREE.Mesh(
        createRibbonGeometry(curve, widths.map((width) => width + 1.1), bed.center, 130, 10, bed.edge),
        bedMaterial,
      )
      bedMesh.receiveShadow = true
      stage.scene.add(bedMesh)
    }

    const material = createWaterMaterial(deep, shallow)
    material.uniforms.uBedCenter.value = bed.center
    material.uniforms.uBedEdge.value = bed.edge
    waterMaterials.push(material)
    const mesh = new THREE.Mesh(createRibbonGeometry(curve, widths, 0, 150, 8), material)
    mesh.renderOrder = 2
    parent.add(mesh)

    const flow = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 8, 4),
      new THREE.MeshBasicMaterial({ color: 0xd9f0eb, transparent: true, opacity: 0.32, depthWrite: false }),
      flowCount,
    )
    flow.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    flow.frustumCulled = false
    stage.scene.add(flow)

    const random = mulberry32(path.length * 97 + flowCount)
    const flowData = Array.from({ length: flowCount }, () => ({
      offset: random(),
      speed: 0.65 + random() * 0.8,
      lane: (random() - 0.5) * 0.6,
      size: 0.6 + random() * 0.8,
    }))

    return { mesh, material, flow, flowData, maxFlow: flowCount, widthSampler, curve, bed, bedMesh }
  }

  const innerChannel = buildChannel(
    INNER_PATH,
    [4.4, 4.1, 3.8, 3.5, 3.2, 3, 2.9, 3],
    110,
    0x1f5e66,
    0x63aaa4,
    stage.scene,
    INNER_BED,
  )
  const outerChannel = buildChannel(
    OUTER_PATH,
    [7.6, 7.9, 8.1, 8.3, 8.5, 8.7, 9, 9.4, 9.8, 10.2, 10.6, 11],
    110,
    0x2a5f63,
    0x6aa9a5,
    stage.scene,
    OUTER_BED,
  )
  const upstreamChannel = buildChannel(
    UPSTREAM_PATH,
    [15, 14, 13, 12.5, 12, 11.5, 11, 10.5, 10],
    70,
    0x245a63,
    0x66a6a3,
    stage.scene,
    UPSTREAM_BED,
  )
  channels.push(innerChannel, outerChannel, upstreamChannel)

  // 都江堰建成前只有一条天然岷江河道：内江暂不出现，等鱼嘴分水堤成形后再揭示。
  innerChannel.mesh.visible = false
  if (innerChannel.bedMesh) innerChannel.bedMesh.visible = false
  innerChannel.flow.visible = false

  const waterGroup = new THREE.Group()
  stage.scene.add(waterGroup)
  // 内江水位独立控制：高堰壅水与杩槎截流只影响内江，外江与上游保持天然水位。
  for (const channel of [outerChannel, upstreamChannel]) {
    waterGroup.attach(channel.mesh)
  }

  const canalGroup = new THREE.Group()
  canalGroup.visible = false
  stage.scene.add(canalGroup)

  const canalBedMaterial = new THREE.MeshStandardMaterial({ color: 0x75674d, roughness: 1 })
  const canalBankMaterial = new THREE.MeshStandardMaterial({ color: 0x8b835c, roughness: 0.98 })

  /**
   * 给干渠铺一层略宽于水面的河床，并在两侧压出土埂。
   * 有了河床和渠岸，水面就不会像一层洪水直接铺在农田上。
   */
  function buildCanalBed(path: Array<[number, number]>, widths: number[], group: THREE.Group): void {
    const curve = new THREE.CatmullRomCurve3(
      path.map(([x, z]) => new THREE.Vector3(x, 0, z)),
      false,
      'catmullrom',
      0.42,
    )
    const bed = new THREE.Mesh(
      createRibbonGeometry(curve, widths.map((width) => width + 1.8), 0.018, 110, 4),
      canalBedMaterial,
    )
    bed.receiveShadow = true
    group.add(bed)

    for (const sign of [-1, 1]) {
      const points: THREE.Vector3[] = []
      for (let step = 0; step <= 48; step += 1) {
        const t = step / 48
        const point = curve.getPointAt(t)
        const tangent = curve.getTangentAt(t)
        const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize()
        const offset = widthAt(widths, t) / 2 + 0.62
        points.push(new THREE.Vector3(point.x + normal.x * offset * sign, 0, point.z + normal.z * offset * sign))
      }
      const bankCurve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.3)
      const bank = new THREE.Mesh(
        createRibbonGeometry(bankCurve, [0.55, 0.55], 0.065, 48, 1),
        canalBankMaterial,
      )
      bank.receiveShadow = true
      group.add(bank)
    }
  }

  for (const spec of IRRIGATION_CANALS) {
    buildCanalBed(spec.path, spec.widths, canalGroup)
    const canal = buildChannel(spec.path, spec.widths, 30, 0x2a6666, 0x77b5a9, canalGroup, CANAL_BED)
    canal.material.uniforms.uOpacity.value = 0.82
    canal.flow.visible = false
    canalChannels.push(canal)
  }

  // -------------------------------------------------------------------------
  // 宝瓶口施工现场
  // -------------------------------------------------------------------------

  const woodMaterial = new THREE.MeshStandardMaterial({ color: 0x7a5c3e, roughness: 0.93 })
  const scaffold = new THREE.Group()
  for (const z of [40.4, 42.4, 44.4]) {
    for (const x of [-13.0, -11.0]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 6.4, 6), woodMaterial)
      pole.position.set(x, 3.2, z)
      pole.castShadow = true
      scaffold.add(pole)
    }
  }
  for (const y of [2.1, 4.2]) {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 4.6), woodMaterial)
    deck.position.set(-12.0, y, 42.4)
    deck.castShadow = true
    scaffold.add(deck)
  }
  for (const z of [40.4, 42.4, 44.4]) {
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.09, 4.2, 0.09), woodMaterial)
    brace.position.set(-12.0, 2.1, z)
    brace.rotation.z = 0.5
    scaffold.add(brace)
  }
  stage.scene.add(scaffold)

  const fireGroup = new THREE.Group()
  const flameMaterials = [
    new THREE.MeshBasicMaterial({
      color: 0xff8c36,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
    new THREE.MeshBasicMaterial({
      color: 0xffd36e,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  ]
  const flames: THREE.Mesh[] = []
  for (const [x, z, scale] of [
    [-12.0, 40.6, 1.2],
    [-10.9, 40.9, 1],
    [-11.5, 41.6, 0.82],
  ] as const) {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.52 * scale, 2.3 * scale, 6), flameMaterials[0])
    flame.position.set(x, 1.15 * scale, z)
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.26 * scale, 1.5 * scale, 5), flameMaterials[1])
    inner.position.set(x, 0.75 * scale, z)
    fireGroup.add(flame, inner)
    flames.push(flame, inner)
  }
  const fireLight = new THREE.PointLight(0xff7c2e, 0, 26, 1.5)
  fireLight.position.set(-11.4, 2.5, 41.6)
  fireGroup.add(fireLight)
  fireGroup.visible = false
  stage.scene.add(fireGroup)

  const rockChunks: THREE.Mesh[] = []
  const detailRandom = mulberry32(20250401)
  const chunkMaterial = new THREE.MeshStandardMaterial({ color: 0x7b7a6d, roughness: 0.98, flatShading: true })
  for (let index = 0; index < 20; index += 1) {
    const radius = 0.22 + detailRandom() * 0.32
    const chunk = new THREE.Mesh(new THREE.DodecahedronGeometry(radius, 0), chunkMaterial)
    chunk.userData.radius = radius
    chunk.visible = false
    chunk.castShadow = true
    stage.scene.add(chunk)
    rockChunks.push(chunk)
  }

  const puffs: Array<{
    points: THREE.Points
    geometry: THREE.BufferGeometry
    material: THREE.PointsMaterial
    velocities: number[]
    age: number
    life: number
    rise: number
  }> = []

  /** 在指定位置生成一团粒子（尘土、蒸汽、水雾），寿命结束后自动回收。 */
  function spawnPuff(
    x: number,
    y: number,
    z: number,
    color: number,
    count: number,
    size: number,
    life: number,
    spread: number,
    rise: number,
  ): void {
    const positions: number[] = []
    const velocities: number[] = []
    const random = mulberry32(Math.round(x * 13 + z * 17 + count))
    for (let index = 0; index < count; index += 1) {
      positions.push(x + (random() - 0.5) * spread, y + random() * spread * 0.6, z + (random() - 0.5) * spread)
      velocities.push((random() - 0.5) * 0.55, 0.45 + random() * 1.1, (random() - 0.5) * 0.55)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    const material = new THREE.PointsMaterial({
      map: puffTexture,
      color,
      size,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      sizeAttenuation: true,
    })
    const points = new THREE.Points(geometry, material)
    points.frustumCulled = false
    stage.scene.add(points)
    transient.push(points)
    puffs.push({ points, geometry, material, velocities, age: 0, life, rise })
  }

  const splashMaterial = new THREE.MeshBasicMaterial({
    color: 0xe9f7f1,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
  /** 在水面激起一圈扩散的波纹，用于投笼、落石等入水反馈。 */
  function splash(x: number, z: number, strength = 1): void {
    const material = splashMaterial.clone()
    const geometry = new THREE.RingGeometry(0.32, 0.48, 20)
    const ring = new THREE.Mesh(geometry, material)
    ring.rotation.x = -Math.PI / 2
    ring.position.set(x, hydro.level + 0.03, z)
    stage.scene.add(ring)
    transient.push(ring)
    tw(ring.scale, { x: 2.2 * strength, y: 2.2 * strength, z: 2.2 * strength, duration: 1.1, ease: 'power2.out' })
    tw(material, {
      opacity: 0,
      duration: 1.1,
      ease: 'power1.in',
      onComplete: () => {
        ring.removeFromParent()
        geometry.dispose()
        material.dispose()
        const index = transient.indexOf(ring)
        if (index >= 0) transient.splice(index, 1)
      },
    })
  }

  // -------------------------------------------------------------------------
  // 鱼嘴：竹笼卵石
  // -------------------------------------------------------------------------

  const bambooMaterial = new THREE.MeshStandardMaterial({ color: 0xb08b52, roughness: 0.9, flatShading: true })
  const ropeMaterial = new THREE.MeshStandardMaterial({ color: 0x6e5634, roughness: 0.95 })
  const cageGroups: THREE.Group[] = []
  const cageTargets: THREE.Vector3[] = []
  const cagePlaced: boolean[] = []
  for (const [x, y, z, rotation] of CAGE_TARGETS) {
    const cage = new THREE.Group()
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.54, 2.7, 9, 1, true), bambooMaterial)
    barrel.rotation.z = Math.PI / 2
    barrel.castShadow = true
    cage.add(barrel)
    for (const offset of [-0.86, 0.86]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.04, 4, 9), ropeMaterial)
      ring.rotation.y = Math.PI / 2
      ring.position.x = offset
      cage.add(ring)
    }
    cage.position.set(x, y, z)
    cage.rotation.y = rotation
    cage.visible = false
    stage.scene.add(cage)
    cageGroups.push(cage)
    cageTargets.push(new THREE.Vector3(x, y, z))
    cagePlaced.push(false)
  }

  const levee = new THREE.Group()
  const leveeMound = new THREE.Mesh(
    new THREE.SphereGeometry(1, 18, 10),
    new THREE.MeshStandardMaterial({ color: 0x899066, roughness: 0.98, flatShading: true }),
  )
  leveeMound.scale.set(1.9, 0.6, 16.2)
  leveeMound.position.set(0.4, 0.02, 4.4)
  leveeMound.castShadow = true
  leveeMound.receiveShadow = true
  levee.add(leveeMound)
  const leveeCrest = new THREE.Mesh(
    new THREE.SphereGeometry(1, 16, 8),
    new THREE.MeshStandardMaterial({ color: 0x7b8459, roughness: 1, flatShading: true }),
  )
  leveeCrest.scale.set(1.2, 0.22, 13.2)
  leveeCrest.position.set(0.4, 0.48, 4.4)
  levee.add(leveeCrest)
  const leveeTree = createTree({ scale: 0.82, color: 0x5b7447 })
  leveeTree.position.set(0.4, 0.56, 18.4)
  levee.add(leveeTree)
  levee.scale.y = 0.001
  levee.visible = false
  stage.scene.add(levee)

  // -------------------------------------------------------------------------
  // 飞沙堰与溢流
  // -------------------------------------------------------------------------

  const weirGroup = new THREE.Group()
  weirGroup.position.set(-8.15, 0, 20)
  const weirWallGeometry = new THREE.BoxGeometry(1.3, 1, 5.2)
  weirWallGeometry.translate(0, 0.5, 0)
  const weirWall = new THREE.Mesh(
    weirWallGeometry,
    new THREE.MeshStandardMaterial({ color: 0x77715f, roughness: 0.96, flatShading: true }),
  )
  weirWall.castShadow = true
  weirWall.receiveShadow = true
  weirWall.scale.y = 0.001
  weirGroup.add(weirWall)
  const weirApron = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.14, 5.8), darkRockMaterial)
  weirApron.position.y = 0.06
  weirApron.receiveShadow = true
  weirGroup.add(weirApron)
  const weirCap = new THREE.Mesh(
    new THREE.BoxGeometry(1.55, 0.07, 5.4),
    new THREE.MeshStandardMaterial({ color: 0x8c8468, roughness: 0.95 }),
  )
  weirCap.position.set(0, 0.3, 0)
  weirGroup.add(weirCap)
  const crestFoamMaterial = new THREE.MeshBasicMaterial({
    color: 0xeaf7f2,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const crestFoam = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.035, 5.2), crestFoamMaterial)
  crestFoam.position.set(0.74, 0.3, 0)
  weirGroup.add(crestFoam)
  weirGroup.visible = false
  stage.scene.add(weirGroup)

  const spillCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(-7.4, 0, 20),
      new THREE.Vector3(0, 0, 20),
      new THREE.Vector3(7.2, 0, 20),
    ],
    false,
    'catmullrom',
    0.3,
  )
  const spillMaterial = createWaterMaterial(0x2f4f4c, 0x7fa19a)
  spillMaterial.uniforms.uOpacity.value = 0
  spillMaterial.uniforms.uFoam.value = 0.02
  waterMaterials.push(spillMaterial)
  const spillMesh = new THREE.Mesh(createRibbonGeometry(spillCurve, [5.2, 5.2, 5.2], 0, 64, 6), spillMaterial)
  spillMesh.visible = false
  spillMesh.renderOrder = 3
  spillMesh.position.y = 0.28
  stage.scene.add(spillMesh)
  const spillBed = new THREE.Mesh(
    createRibbonGeometry(spillCurve, [5.8, 5.8, 5.8], 0.015, 40),
    new THREE.MeshStandardMaterial({ color: 0x6a6350, roughness: 1 }),
  )
  spillBed.visible = false
  stage.scene.add(spillBed)

  const spillFallMaterial = new THREE.MeshBasicMaterial({
    color: 0xe9f7f2,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const spillFall = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.4), spillFallMaterial)
  spillFall.position.set(-7.3, 0.5, 20)
  spillFall.rotation.y = Math.PI / 2
  stage.scene.add(spillFall)

  const spillRandom = mulberry32(53)
  const spillParticles = Array.from({ length: 12 }, () => ({
    offset: spillRandom(),
    speed: 0.9 + spillRandom() * 0.6,
    lane: (spillRandom() - 0.5) * 0.7,
    size: 0.8 + spillRandom() * 0.5,
  }))
  const spillFlow = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 6, 4),
    new THREE.MeshBasicMaterial({ color: 0xe8f5f0, transparent: true, opacity: 0.16, depthWrite: false }),
    12,
  )
  spillFlow.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  spillFlow.frustumCulled = false
  spillFlow.visible = false
  stage.scene.add(spillFlow)

  const spillChannel: Channel = {
    mesh: spillMesh,
    material: spillMaterial,
    flow: spillFlow,
    flowData: spillParticles,
    maxFlow: 12,
    widthSampler: () => 5.2,
    curve: spillCurve,
    bed: NO_BED,
  }

  // -------------------------------------------------------------------------
  // 岁修：杩槎、河床与泥沙
  // -------------------------------------------------------------------------

  const cribGroup = new THREE.Group()
  for (const x of [-11.6, -10.1, -8.7]) {
    const tripod = new THREE.Group()
    for (let index = 0; index < 3; index += 1) {
      const angle = (index / 3) * Math.PI * 2
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.08, 2.2, 5), woodMaterial)
      pole.position.set(Math.cos(angle) * 0.5, 1.1, Math.sin(angle) * 0.5)
      pole.rotation.z = Math.cos(angle) * 0.35
      pole.rotation.x = Math.sin(angle) * 0.35
      pole.castShadow = true
      tripod.add(pole)
    }
    const lash = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.35, 6), ropeMaterial)
    lash.position.y = 2.15
    tripod.add(lash)
    tripod.position.set(x, 0, 22)
    cribGroup.add(tripod)
  }
  const riverMat = new THREE.Mesh(
    new THREE.PlaneGeometry(5.2, 1.4),
    new THREE.MeshStandardMaterial({
      color: 0xb89b62,
      roughness: 0.98,
      transparent: true,
      opacity: 0.94,
      side: THREE.DoubleSide,
    }),
  )
  riverMat.position.set(-10.1, 0.7, 22)
  cribGroup.add(riverMat)
  cribGroup.visible = false
  stage.scene.add(cribGroup)

  const sedimentMounds: THREE.Mesh[] = []
  const sedimentRandom = mulberry32(31)
  for (let index = 0; index < 7; index += 1) {
    const mound = new THREE.Mesh(
      new THREE.SphereGeometry(0.5 + sedimentRandom() * 0.6, 8, 5),
      new THREE.MeshStandardMaterial({ color: 0x776044, roughness: 1 }),
    )
    mound.scale.set(1.5, 0.32, 1.1)
    mound.position.set(-11.3 + sedimentRandom() * 2.2, 0.045, 23.2 + sedimentRandom() * 3.6)
    mound.receiveShadow = true
    mound.visible = false
    stage.scene.add(mound)
    sedimentMounds.push(mound)
  }
  const ironMarker = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.06, 1.8),
    new THREE.MeshStandardMaterial({ color: 0x4b4c47, roughness: 0.5, metalness: 0.5 }),
  )
  ironMarker.position.set(-10.4, 0.06, 25.5)
  ironMarker.visible = false
  stage.scene.add(ironMarker)

  const exposedBed = new THREE.Mesh(
    new THREE.PlaneGeometry(4.8, 9.2),
    new THREE.MeshStandardMaterial({ color: 0x6b5b45, roughness: 0.98 }),
  )
  exposedBed.rotation.x = -Math.PI / 2
  exposedBed.position.set(-10.4, 0.04, 25)
  exposedBed.visible = false
  stage.scene.add(exposedBed)

  const cribState = { drop: 0 }
  // 凤栖窝淤积程度：0 为淘净，1 为严重淤积。汛期与高中堰加速淤积，低堰溢流把沙带走。
  const sediment = { level: 0.3 }

  // -------------------------------------------------------------------------
  // 泥沙：鱼嘴二八分沙、离堆回流与飞沙堰二次排沙
  // -------------------------------------------------------------------------

  interface SandSystem {
    mesh: THREE.InstancedMesh
    curve: THREE.CatmullRomCurve3
    data: Array<{ offset: number; speed: number; lane: number; size: number }>
    bed: BedProfile
    spread: number
  }

  /** 悬浮泥沙颗粒：沿河床附近运动，数量比例直接表现分沙比例。 */
  function buildSand(
    curve: THREE.CatmullRomCurve3,
    count: number,
    color: number,
    seed: number,
    bed: BedProfile,
    spread: number,
  ): SandSystem {
    const mesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 6, 4),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.82, depthWrite: false }),
      count,
    )
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    mesh.frustumCulled = false
    mesh.visible = false
    stage.scene.add(mesh)
    const random = mulberry32(seed)
    const data = Array.from({ length: count }, () => ({
      offset: random(),
      speed: 0.7 + random() * 0.7,
      lane: (random() - 0.5) * 0.56,
      size: 0.7 + random() * 0.7,
    }))
    return { mesh, curve, data, bed, spread }
  }

  const upstreamSand = buildSand(upstreamChannel.curve, 42, 0x8a6c40, 97, UPSTREAM_BED, 5)
  // 八成泥沙入外江、两成入内江：颗粒数 160 : 40 即二八分沙。
  const outerSand = buildSand(outerChannel.curve, 160, 0x9c7a44, 131, OUTER_BED, 6)
  const innerSand = buildSand(innerChannel.curve, 40, 0x9c7a44, 173, INNER_BED, 2.4)

  // 离堆回流把内江余沙甩向飞沙堰，越堰排回外江，构成二级排沙通道。
  const sandReturnCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(-11.2, 0, 34.5),
      new THREE.Vector3(-10.2, 0, 28),
      new THREE.Vector3(-8.4, 0, 21),
      new THREE.Vector3(-6, 0, 20),
      new THREE.Vector3(0, 0, 20),
      new THREE.Vector3(7.4, 0, 20),
    ],
    false,
    'catmullrom',
    0.35,
  )
  const returnSand = buildSand(sandReturnCurve, 46, 0xa07a44, 211, NO_BED, 1.2)

  // 离堆前的回旋流：白色泡沫颗粒绕椭圆循环，汛期转速加快。
  const reflux = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 6, 4),
    new THREE.MeshBasicMaterial({ color: 0xe6f2ec, transparent: true, opacity: 0.5, depthWrite: false }),
    26,
  )
  reflux.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  reflux.frustumCulled = false
  reflux.visible = false
  stage.scene.add(reflux)
  const refluxRandom = mulberry32(269)
  const refluxData = Array.from({ length: 26 }, () => ({
    offset: refluxRandom(),
    speed: 0.75 + refluxRandom() * 0.5,
    size: 0.7 + refluxRandom() * 0.6,
  }))

  // -------------------------------------------------------------------------
  // 成都平原
  // -------------------------------------------------------------------------

  const fieldMaterials: THREE.MeshStandardMaterial[] = []
  const fieldDryColors = [0xb4a86c, 0xa8a262, 0xbcae74, 0x9f9d64]
  const fieldGreenColors = [0x6f8f4f, 0x7fa05a, 0x88a862, 0x6a8a4a]
  const fieldRandom = mulberry32(61)
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 7; col += 1) {
      const x = -42 + col * 8 + (fieldRandom() - 0.5) * 1.2
      const z = 49 + row * 6.5 + (fieldRandom() - 0.5) * 1.4
      const angle = (fieldRandom() - 0.5) * 0.18
      if (IRRIGATION_CANALS.some((canal) => distanceToPath(x, z, canal.path) < 3.6)) continue

      const material = new THREE.MeshStandardMaterial({
        color: fieldDryColors[(row + col) % fieldDryColors.length],
        roughness: 1,
      })
      const field = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 3.6), material)
      field.rotation.x = -Math.PI / 2
      field.rotation.z = angle
      field.position.set(x, 0.01, z)
      field.receiveShadow = true
      stage.scene.add(field)
      fieldMaterials.push(material)
    }
  }
  const bundMaterial = new THREE.MeshStandardMaterial({ color: 0x7a7a55, roughness: 1 })
  for (let index = 0; index < 9; index += 1) {
    const x = -43 + index * 4.6
    if (IRRIGATION_CANALS.some((canal) => distanceToPath(x, 60, canal.path) < 2.4)) continue
    const bund = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 24), bundMaterial)
    bund.position.set(x, 0.035, 60)
    stage.scene.add(bund)
  }

  const houseWallMaterial = new THREE.MeshStandardMaterial({ color: 0xd8cdb2, roughness: 0.94 })
  const houseRoofMaterial = new THREE.MeshStandardMaterial({ color: 0x4b4a42, roughness: 0.92, flatShading: true })
  for (const [x, z] of [
    [-35, 46],
    [-30, 49],
    [-17, 63],
    [5, 55],
  ] as const) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.1, 1.4), houseWallMaterial)
    body.position.set(x, 0.55, z)
    body.castShadow = true
    stage.scene.add(body)
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.45, 0.75, 4), houseRoofMaterial)
    roof.position.set(x, 1.45, z)
    roof.rotation.y = Math.PI / 4
    roof.castShadow = true
    stage.scene.add(roof)
  }

  for (const [x, z, scale] of [
    [-18, 42, 1.5],
    [-22, 47, 1.2],
    [-33, 58, 1.4],
    [-25, 50, 1.3],
    [-4, 45, 1.2],
    [-45, 40, 1.6],
    [-48, 20, 1.7],
    [-20, 12, 1.2],
    [-18, 24, 1.1],
    [-6, 34, 1.2],
    [4, 10, 1.3],
    [22, 34, 1.4],
    [24, 43, 1.5],
    [26, 30, 1.3],
    [-26, 68, 1.4],
    [-44, 66, 1.5],
  ] as const) {
    const tree = createTree({ scale, color: 0x647f53 })
    tree.position.set(x, 0, z)
    stage.scene.add(tree)
  }

  // -------------------------------------------------------------------------
  // 人物
  // -------------------------------------------------------------------------

  const libing = createFigure({
    robe: 0x4f6b63,
    trim: 0x2e3f3b,
    hat: 'guan',
    beard: true,
    tool: 'staff',
    scale: 1.16,
  })
  const erlang = createFigure({ robe: 0x6d7761, trim: 0x3b4538, hat: 'headband', scale: 1.08 })
  stage.scene.add(libing.group, erlang.group)

  const gapWorkers: FigureHandle[] = []
  for (const [x, y, z, rotation] of [
    [-12.6, 2.2, 41.0, 0.5],
    [-11.4, 2.2, 43.6, 0.9],
    [-12.6, 4.3, 42.2, 0.6],
    [-11.5, 4.3, 44.0, 0.8],
  ] as const) {
    const worker = createFigure({ robe: 0x7a6a4f, trim: 0x4e4637, hat: 'douli', tool: 'hammer', scale: 0.92, shadow: false })
    worker.group.position.set(x, y, z)
    worker.group.rotation.y = rotation
    stage.scene.add(worker.group)
    gapWorkers.push(worker)
  }

  const damWorkers: FigureHandle[] = []
  for (const [x, z, rotation] of [
    [-4.6, -2.4, 0.4],
    [-5.6, 1.2, 0.1],
    [3.2, -2.4, -2.6],
    [4.0, 2.4, -3.1],
  ] as const) {
    const worker = createFigure({ robe: 0x7f6b4d, trim: 0x504737, hat: 'douli', scale: 0.94, shadow: false })
    worker.group.position.set(x, 0, z)
    worker.group.rotation.y = rotation
    stage.scene.add(worker.group)
    damWorkers.push(worker)
  }

  const farmers: FigureHandle[] = []
  for (const [x, z, rotation, robe] of [
    [-31, 52, 0.9, 0x8b7d63],
    [-22, 57, -0.4, 0x7e7058],
    [-14, 61, 2.4, 0x8a7c62],
    [-38, 63, 1.6, 0x756b58],
  ] as const) {
    const farmer = createFigure({ robe, trim: 0x4b463a, hat: 'headband', scale: 0.92, shadow: false })
    farmer.group.position.set(x, 0, z)
    farmer.group.rotation.y = rotation
    stage.scene.add(farmer.group)
    farmers.push(farmer)
  }

  const dredgeWorkers: FigureHandle[] = []
  for (const [x, z, rotation] of [
    [-12.2, 24.1, 1.2],
    [-9.0, 25.5, 1.5],
    [-12.2, 26.8, 0.9],
  ] as const) {
    const worker = createFigure({ robe: 0x77674c, trim: 0x4c4436, hat: 'douli', tool: 'staff', scale: 1, shadow: false })
    worker.group.position.set(x, 0.02, z)
    worker.group.rotation.y = rotation
    worker.group.visible = false
    stage.scene.add(worker.group)
    dredgeWorkers.push(worker)
  }

  /** 把李冰与二郎移动到指定机位对应的站位，让「讲解者」始终出现在画面里。 */
  function moveCast(preset: string, immediate = false): void {
    const positions: Record<string, [[number, number, number], [number, number, number]]> = {
      overview: [
        [-17.4, 0, 18],
        [-16.1, 0, 19.2],
      ],
      survey: [
        [-18, 0, 22],
        [-16.7, 0, 23.1],
      ],
      bottleneck: [
        [-18.2, 0, 43.4],
        [-16.9, 0, 44.3],
      ],
      fishmouth: [
        [2.8, 0, -1.2],
        [3.4, 0, -0.2],
      ],
      split: [
        [-17.4, 0, 12],
        [-16.1, 0, 13.1],
      ],
      weir: [
        [-5.4, 0, 13.5],
        [-4.1, 0, 14.4],
      ],
      irrigation: [
        [-18.5, 0, 58],
        [-17.2, 0, 59.1],
      ],
      maintenance: [
        [-14.6, 0, 21.6],
        [-13.3, 0, 22.5],
      ],
      legacy: [
        [-17.6, 0, 45.5],
        [-16.2, 0, 46.6],
      ],
    }
    const home = positions[preset] ?? positions.overview
    for (const [figure, target, rotation] of [
      [libing, home[0], 0.7],
      [erlang, home[1], 0.9],
    ] as const) {
      if (immediate) {
        figure.group.position.set(target[0], 0, target[2])
        figure.group.rotation.y = rotation
      } else {
        tw(figure.group.position, { x: target[0], z: target[2], duration: 1.2, ease: 'power2.inOut' })
        tw(figure.group.rotation, { y: rotation, duration: 1.2 })
      }
    }
  }

  moveCast('overview', true)

  // -------------------------------------------------------------------------
  // 流动粒子与水面着色器
  // -------------------------------------------------------------------------

  const dummy = new THREE.Object3D()
  const forward = new THREE.Vector3(0, 0, 1)
  const tangent = new THREE.Vector3()
  const side = new THREE.Vector3()

  /** 归一化横向位置对应的河床高程，与水面 shader 使用同一条抛物线剖面。 */
  function bedHeightAt(bed: BedProfile, lane: number): number {
    const cross = 2 * lane
    return bed.center + (bed.edge - bed.center) * cross * cross
  }

  /**
   * 推进一条水道的水流粒子：`fraction` 控制粒子数量，用来表现分水比例；
   * `level` 决定粒子所在水位。水位低于该处河床时粒子隐去，与露滩画面一致。
   */
  function updateFlow(
    channel: Channel,
    elapsed: number,
    fraction: number,
    level: number,
    visible: boolean,
  ): void {
    const count = Math.max(0, Math.min(channel.maxFlow, Math.round(channel.maxFlow * fraction)))
    channel.flow.count = count
    channel.flow.visible = visible && count > 1
    if (!channel.flow.visible) return
    for (let index = 0; index < count; index += 1) {
      const data = channel.flowData[index]
      const t = (data.offset + elapsed * 0.032 * data.speed) % 1
      const point = channel.curve.getPointAt(t)
      channel.curve.getTangentAt(t, tangent)
      side.set(-tangent.z, 0, tangent.x).normalize()
      const lane = data.lane * channel.widthSampler(t)
      dummy.position.set(point.x + side.x * lane, level + 0.045, point.z + side.z * lane)
      dummy.quaternion.setFromUnitVectors(forward, tangent)
      const submerged = level > bedHeightAt(channel.bed, data.lane) + 0.012 ? 1 : 0
      dummy.scale.set(0.055 * data.size * submerged, 0.018 * data.size * submerged, 0.55 * data.size * submerged)
      dummy.updateMatrix()
      channel.flow.setMatrixAt(index, dummy.matrix)
    }
    channel.flow.instanceMatrix.needsUpdate = true
  }

  /** 推进一条水道的悬沙颗粒：贴床运动，水位退去时随河床一起露出。 */
  function updateSand(system: SandSystem, elapsed: number, level: number, visible: boolean): void {
    system.mesh.visible = visible
    if (!visible) return
    const count = system.data.length
    for (let index = 0; index < count; index += 1) {
      const data = system.data[index]
      const t = (data.offset + elapsed * 0.026 * data.speed) % 1
      const point = system.curve.getPointAt(t)
      system.curve.getTangentAt(t, tangent)
      side.set(-tangent.z, 0, tangent.x).normalize()
      const lane = data.lane * system.spread
      const bedY = bedHeightAt(system.bed, data.lane)
      // 颗粒保持在水面或露出的滩面之上，枯水期外江露滩后分沙仍然可读。
      const y = system.bed.center < -5 ? level + 0.02 : Math.max(bedY + 0.04, level + 0.02)
      dummy.position.set(point.x + side.x * lane, y, point.z + side.z * lane)
      dummy.quaternion.setFromUnitVectors(forward, tangent)
      dummy.scale.set(0.13 * data.size, 0.07 * data.size, 0.16 * data.size)
      dummy.updateMatrix()
      system.mesh.setMatrixAt(index, dummy.matrix)
    }
    system.mesh.instanceMatrix.needsUpdate = true
  }

  // -------------------------------------------------------------------------
  // 空间注记与勘查热点
  // -------------------------------------------------------------------------

  const labels = new Map<string, BuildLabel>()

  /** 创建一个随场景销毁的空间注记（工程名称、分水比例等）。 */
  function addLabel(id: string, text: string, position: [number, number, number]): void {
    const element = document.createElement('span')
    element.className = 'dujiangyan-label'
    element.textContent = text
    element.style.opacity = '0'
    Object.assign(element.style, {
      display: 'inline-block',
      padding: '4px 9px',
      border: '1px solid rgba(24, 48, 45, 0.18)',
      borderRadius: '4px',
      background: 'rgba(250, 249, 240, 0.86)',
      color: '#29423d',
      fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
      fontSize: '11px',
      lineHeight: '1.4',
      letterSpacing: '0.08em',
      whiteSpace: 'nowrap',
      boxShadow: '0 4px 14px rgba(10, 30, 26, 0.12)',
      backdropFilter: 'blur(6px)',
      pointerEvents: 'none',
      transition: 'opacity 500ms ease',
    })
    const object = new CSS2DObject(element)
    object.position.set(...position)
    object.center.set(0.5, 1)
    stage.scene.add(object)
    stage.registerCleanup(() => {
      object.removeFromParent()
      element.remove()
    })
    labels.set(id, { element, object })
  }

  /** 控制注记显隐，配合推演进度逐条揭示工程信息。 */
  function showLabel(id: string, visible: boolean): void {
    const label = labels.get(id)
    if (label) label.element.style.opacity = visible ? '1' : '0'
  }

  /** 更新注记文案（如「宝瓶口 · 开凿中」），内容不变时不触发重排。 */
  function setLabel(id: string, text: string): void {
    const label = labels.get(id)
    if (label && label.element.textContent !== text) label.element.textContent = text
  }

  addLabel('mountain', '玉垒山', [-28, 8, 32])
  addLabel('minjiang', '岷江弯道', [8, 3.2, -36])
  addLabel('gap', '宝瓶口', [-11.4, 6.5, 42])
  addLabel('isle', '离堆', [-6.5, 4.2, 41])
  addLabel('fishmouth', '鱼嘴', [0, 3.2, -7])
  addLabel('split46', '四六分水 · 枯水内六外四', [0, 4.8, -2])
  addLabel('sand28', '二八分沙 · 八成泥沙入外江', [5.2, 2.4, -2])
  addLabel('reflux', '离堆回流', [-11.2, 2.8, 34.5])
  addLabel('inner', '内江 60% · 深槽', [-8.6, 2.4, 8])
  addLabel('outer', '外江 40% · 宽浅', [10.2, 2.6, 8])
  addLabel('weir', '飞沙堰', [-8.15, 2.0, 20])
  addLabel('fqwo', '凤栖窝', [-11.8, 2.2, 25.2])
  addLabel('plain', '成都平原', [-31, 2.8, 56])
  addLabel('canals', '左 · 中 · 右 三干渠', [-11, 2.4, 58])
  addLabel('wotie', '卧铁', [-9.6, 1.4, 26.2])
  showLabel('mountain', true)
  showLabel('minjiang', true)
  showLabel('plain', true)

  stage.addHotspot({
    id: 'd_spot_ridge',
    label: '玉垒山嘴',
    detail: '山嘴伸入江心，砾岩坚硬，是山体最薄、也最适合开凿宝瓶口的位置。',
    tone: 'info',
    position: [-15.4, 5.6, 31.6],
  })
  stage.addHotspot({
    id: 'd_spot_bend',
    label: '内江弯道',
    detail: '凹岸水深流急，凸岸水浅沙多。鱼嘴放在弯道上游，可以借水流完成分水与排沙。',
    tone: 'info',
    position: [-8.6, 2.8, 10.5],
  })
  stage.addHotspot({
    id: 'd_spot_plain',
    label: '平原引水口',
    detail: '成都平原高程低于山口。只要凿穿山嘴，内江的水就能沿着三条干渠自流灌田。',
    tone: 'info',
    position: [-30, 2.6, 58],
  })
  stage.hideHotspots()

  // -------------------------------------------------------------------------
  // 状态与动作
  // -------------------------------------------------------------------------

  let currentSeason: 'normal' | 'dry' | 'flood' = 'normal'
  let currentWeir: 'none' | 'low' | 'mid' | 'high' = 'none'
  // 溢流强度由「内江水位 − 堰顶」逐帧推出，低堰大溢、中堰勉强、高堰不溢。
  const overflow = { amount: 0 }
  let lastInnerPercent = 60
  let lastRefluxText = ''

  /** 同时切换舞台氛围与天空渐变，保证灯光和天色不脱节。 */
  function applyAmbience(level: 'calm' | 'tense' | 'critical', immediate = false): void {
    stage.setAmbience(level, immediate)
    const preset = AMBIENCE[level]
    const duration = immediate || options.reducedMotion ? 0 : 1.2
    for (const [uniform, hex] of [
      [skyUniforms.topColor, preset.skyTop],
      [skyUniforms.horizonColor, preset.skyHorizon],
      [skyUniforms.bottomColor, preset.skyBottom],
    ] as const) {
      const color = new THREE.Color(hex)
      if (duration === 0) {
        uniform.value.copy(color)
      } else {
        tw(uniform.value, { r: color.r, g: color.g, b: color.b, duration })
      }
    }
  }

  /** 根据堰高刷新飞沙堰注记，提示「低作堰」是否被违背。 */
  function updateWeirLabel(): void {
    if (currentWeir === 'none') return
    setLabel(
      'weir',
      currentWeir === 'low' ? '飞沙堰 · 低作堰' : currentWeir === 'mid' ? '飞沙堰 · 堰顶偏高' : '飞沙堰 · 高堰受阻',
    )
  }

  /** 高堰在汛期把内江水位壅高，外江水位不变；低中堰不壅水。 */
  function refreshBackwater(): void {
    hydro.targetBackwater = currentWeir === 'high' && currentSeason === 'flood' ? 0.07 : 0
  }

  /** 鱼嘴建成后，四六分水注记随季节切换「内六外四 / 内四外六」。 */
  function refreshSplitLabel(): void {
    if (!levee.visible) return
    setLabel('split46', currentSeason === 'flood' ? '四六分水 · 丰水内四外六' : '四六分水 · 枯水内六外四')
  }

  /** 切换水文季节：枯水、常水、汛期分别对应不同的水位与分水比目标值。 */
  function setSeason(season: 'normal' | 'dry' | 'flood'): void {
    currentSeason = season
    hydro.targetLevel = SEASON_LEVEL[season]
    hydro.targetInner = season === 'flood' ? 0.4 : 0.6
    hydro.targetFlood = season === 'flood' ? 1 : season === 'dry' ? 0 : 0.35
    refreshBackwater()
    refreshSplitLabel()
  }

  /** 调整宝瓶口开度：0 为未开凿，1 为完全凿通，过程带动山体重建。 */
  function setGap(open: number, immediate = false): void {
    if (immediate) {
      gapState.value = open
      writeRidge(open)
      return
    }
    tw(gapState, {
      value: open,
      duration: 3.2,
      ease: 'power2.inOut',
      onUpdate: () => writeRidge(gapState.value),
    })
  }

  /**
   * 设置已投放的竹笼数量。`animated` 为真时新笼子从空中落下并溅起水花，
   * 投满后升起堤身，鱼嘴成形。
   */
  function setCageCount(count: number, animated = false): void {
    for (let index = 0; index < cageGroups.length; index += 1) {
      const cage = cageGroups[index]
      const target = cageTargets[index]
      if (index >= count) {
        cage.visible = false
        cagePlaced[index] = false
        continue
      }
      cage.visible = true
      if (animated && !cagePlaced[index]) {
        cagePlaced[index] = true
        cage.position.set(target.x, target.y + 8, target.z)
        cage.rotation.set(0.5, CAGE_TARGETS[index][3], 0.18)
        tw(cage.position, { y: target.y, duration: 0.9, ease: 'power2.in' })
        tw(cage.rotation, { x: 0, y: CAGE_TARGETS[index][3], z: 0, duration: 0.9 })
        later(520, () => splash(target.x, target.z, 0.75))
      } else {
        cage.position.copy(target)
        cage.rotation.set(0, CAGE_TARGETS[index][3], 0)
        cagePlaced[index] = true
      }
    }
    if (count >= cageGroups.length) {
      levee.visible = true
      innerChannel.mesh.visible = true
      if (innerChannel.bedMesh) innerChannel.bedMesh.visible = true
      tw(levee.scale, { y: 1, duration: 1.4, ease: 'power2.out' })
      showLabel('fishmouth', true)
      showLabel('inner', true)
      showLabel('outer', true)
      showLabel('split46', true)
      showLabel('sand28', true)
      refreshSplitLabel()
    }
  }

  /** 设置飞沙堰高度（低 / 偏高 / 过高），并同步溢流与注记。 */
  function setWeir(level: 'low' | 'mid' | 'high'): void {
    currentWeir = level
    weirGroup.visible = true
    spillBed.visible = true
    const top = WEIR_TOP[level]
    tw(weirWall.scale, { y: top, duration: 1.4, ease: 'power2.inOut' })
    tw(weirCap.position, { y: top - 0.035, duration: 1.4, ease: 'power2.inOut' })
    crestFoam.position.y = top
    showLabel('weir', true)
    updateWeirLabel()
    refreshBackwater()
  }

  /** 显示/隐藏岁修淘滩的工人。 */
  function moveDredgeWorkers(visible: boolean): void {
    for (const worker of dredgeWorkers) worker.group.visible = visible
  }

  /** 「火烧水激」第一步：点燃柴堆，为开凿玉垒山做准备。 */
  function ignite(): void {
    stage.hideHotspots()
    fireGroup.visible = true
    showLabel('inner', false)
    showLabel('outer', false)
    showLabel('gap', true)
    setLabel('gap', '宝瓶口 · 开凿中')
    tw(fireLight, { intensity: 36, duration: 0.8 })
    spawnPuff(-12.6, 2.2, 42, 0x8b8780, 24, 3.4, 5, 3.4, 0.9)
  }

  /** 第二步：泼水淬冷，岩石因骤冷开裂，用大量蒸汽表现。 */
  function quench(): void {
    fireGroup.visible = false
    tw(fireLight, { intensity: 0, duration: 0.4 })
    spawnPuff(-11.8, 1.2, 42, 0xf3f7f2, 64, 3.6, 3.6, 4.6, 1.6)
    spawnPuff(-13.2, 1.4, 41.2, 0xe9efea, 28, 3, 3, 3, 1.3)
  }

  /** 第三步：凿通山体，碎石飞溅、宝瓶口成形并引出灌渠。 */
  function chisel(): void {
    setGap(1)
    showLabel('gap', true)
    showLabel('isle', true)
    showLabel('reflux', true)
    setLabel('gap', '宝瓶口')
    canalGroup.visible = true
    showLabel('canals', true)
    const random = mulberry32(51)
    rockChunks.forEach((chunk) => {
      chunk.visible = true
      const startX = -11.4 + (random() - 0.5) * 2.2
      const startY = 0.8 + random() * 5.5
      const startZ = 40 + random() * 5
      chunk.position.set(startX, startY, startZ)
      chunk.scale.setScalar(0.7 + random() * 0.8)
      const velocityX = (random() - 0.5) * 3.4
      const velocityY = 1.4 + random() * 2.4
      const velocityZ = (random() - 0.5) * 3.4
      const spin = (random() - 0.5) * 0.18
      const state = { t: 0 }
      tw(state, {
        t: 1,
        duration: 1.5 + random() * 0.9,
        ease: 'none',
        onUpdate: () => {
          const time = state.t * 1.8
          chunk.position.set(
            startX + velocityX * time,
            Math.max(0.04 + chunk.userData.radius * chunk.scale.y, startY + velocityY * time - 4.9 * time * time),
            startZ + velocityZ * time,
          )
          chunk.rotation.x += spin
          chunk.rotation.z += spin * 0.7
        },
      })
    })
    spawnPuff(-11.4, 1, 42, 0xb7ac96, 44, 3.4, 3.4, 4.4, 0.8)
    for (const worker of gapWorkers) {
      tw(worker.rightArm.rotation, { x: -1.5, duration: 0.35, repeat: 5, yoyo: true, ease: 'power1.inOut' })
    }
    later(2600, () => {
      scaffold.visible = false
      for (const worker of gapWorkers) worker.group.visible = false
      for (const chunk of rockChunks) chunk.visible = false
    })
  }

  /** 依次投放竹笼，逐步堆出鱼嘴分水堤。 */
  function buildCages(): void {
    stage.hideHotspots()
    setCageCount(0)
    for (let index = 0; index < CAGE_TARGETS.length; index += 1) {
      later(index * 260, () => setCageCount(index + 1, true))
    }
    showLabel('fishmouth', true)
    for (const worker of damWorkers) {
      tw(worker.rightArm.rotation, { x: -1.1, duration: 0.5, repeat: 2, yoyo: true, ease: 'power1.inOut' })
    }
  }

  /** 安装杩槎并落下，用于截流与调节内江水量。 */
  function installCribs(): void {
    cribGroup.visible = true
    cribGroup.scale.y = 0.001
    tw(cribGroup.scale, { y: 1, duration: 1.1, ease: 'power2.out' })
    tw(cribState, { drop: 0.22, duration: 1.6, ease: 'power2.inOut' })
    currentSeason = 'dry'
    hydro.targetLevel = 0.24
    hydro.targetFlood = 0.28
    refreshBackwater()
    sediment.level = Math.max(sediment.level, 0.75)
    showLabel('fqwo', true)
    showLabel('inner', false)
    showLabel('outer', false)
    showLabel('weir', false)
    exposedBed.visible = true
    moveDredgeWorkers(true)
  }

  /** 岁修淘滩：清走淤积的砂石，露出卧铁作为深度基准。 */
  function dredge(): void {
    tw(sediment, { level: 0, duration: 1.8, ease: 'power2.inOut' })
    for (const [index, mound] of sedimentMounds.entries()) {
      later(320 + index * 90, () => spawnPuff(mound.position.x, 0.15, mound.position.z, 0xa08d6d, 10, 1.6, 2, 1.4, 0.5))
    }
    later(700, () => {
      ironMarker.visible = true
      showLabel('wotie', true)
    })
    for (const worker of dredgeWorkers) {
      tw(worker.rightArm.rotation, { x: -1.2, duration: 0.45, repeat: 4, yoyo: true, ease: 'power1.inOut' })
    }
  }

  /** 拆除杩槎、恢复过流，岁修结束。 */
  function restoreFlow(): void {
    tw(cribState, { drop: 0, duration: 1.2, ease: 'power2.inOut' })
    tw(cribGroup.scale, { y: 0.001, duration: 0.8, onComplete: () => { cribGroup.visible = false } })
    exposedBed.visible = false
    moveDredgeWorkers(false)
  }

  /** 结局演出：汛期水位抬升、平原由枯黄转为青绿，所有注记亮起。 */
  function celebrate(): void {
    if (currentWeir === 'none') setWeir('low')
    currentSeason = 'flood'
    hydro.targetLevel = SEASON_LEVEL.flood
    hydro.targetInner = 0.4
    hydro.targetFlood = 0.75
    refreshBackwater()
    refreshSplitLabel()
    for (const [index, material] of fieldMaterials.entries()) {
      const color = new THREE.Color(fieldGreenColors[index % fieldGreenColors.length])
      tw(material.color, { r: color.r, g: color.g, b: color.b, duration: 2.6, delay: index * 0.03 })
    }
    for (const label of ['gap', 'isle', 'fishmouth', 'weir', 'fqwo', 'inner', 'outer', 'plain', 'mountain', 'canals', 'split46', 'sand28', 'reflux']) {
      showLabel(label, true)
    }
    setLabel('gap', '宝瓶口')
  }

  /** 把平原农田的颜色还原为初始的枯黄状态。 */
  function resetFields(): void {
    for (const [index, material] of fieldMaterials.entries()) {
      material.color.setHex(fieldDryColors[index % fieldDryColors.length])
    }
  }

  /** 恢复初始状态：终止补间、清除临时粒子、复位山体/竹笼/堰体/水位与注记。 */
  function resetScene(): void {
    while (tweens.length) tweens.pop()?.kill()
    for (const object of transient) {
      object.removeFromParent()
      disposeObject(object)
    }
    transient.length = 0
    puffs.length = 0
    for (const chunk of rockChunks) chunk.visible = false
    for (const worker of dredgeWorkers) worker.group.visible = false
    scaffold.visible = true
    for (const worker of gapWorkers) worker.group.visible = true
    fireGroup.visible = false
    fireLight.intensity = 0
    setGap(0, true)
    setCageCount(0)
    levee.visible = false
    levee.scale.y = 0.001
    weirGroup.visible = false
    currentWeir = 'none'
    overflow.amount = 0
    spillMesh.visible = false
    spillFlow.visible = false
    spillBed.visible = false
    spillFall.visible = false
    spillFallMaterial.opacity = 0
    crestFoamMaterial.opacity = 0
    spillMaterial.uniforms.uOpacity.value = 0
    spillMaterial.uniforms.uFoam.value = 0.02
    cribGroup.visible = false
    cribGroup.scale.y = 1
    cribState.drop = 0
    innerChannel.mesh.visible = false
    if (innerChannel.bedMesh) innerChannel.bedMesh.visible = false
    innerChannel.mesh.position.y = 0
    innerChannel.material.uniforms.uOpacity.value = 0.88
    sediment.level = 0.3
    for (const mound of sedimentMounds) {
      mound.visible = false
      mound.scale.set(1.5, 0.32, 1.1)
    }
    ironMarker.visible = false
    exposedBed.visible = false
    canalGroup.visible = false
    canalGroup.position.y = 0
    resetFields()
    hydro.level = SEASON_LEVEL.dry
    hydro.inner = 0.6
    hydro.targetLevel = SEASON_LEVEL.dry
    hydro.targetInner = 0.6
    hydro.flood = 0
    hydro.targetFlood = 0
    hydro.backwater = 0
    hydro.targetBackwater = 0
    currentSeason = 'normal'
    lastRefluxText = ''
    stage.resetHotspots()
    stage.hideHotspots()
    for (const label of labels.keys()) showLabel(label, false)
    for (const label of ['mountain', 'plain', 'minjiang']) showLabel(label, true)
    setLabel('inner', '内江 60% · 深槽')
    setLabel('outer', '外江 40% · 宽浅')
    setLabel('reflux', '离堆回流')
    moveCast('overview', true)
    applyAmbience('calm', true)
    camera('overview', true)
  }

  // -------------------------------------------------------------------------
  // 主循环
  // -------------------------------------------------------------------------

  stage.addUpdater((delta, elapsed) => {
    const ease = 1 - Math.exp(-delta * 2.6)
    hydro.level += (hydro.targetLevel - hydro.level) * ease
    hydro.inner += (hydro.targetInner - hydro.inner) * ease
    hydro.flood += (hydro.targetFlood - hydro.flood) * ease
    hydro.backwater += (hydro.targetBackwater - hydro.backwater) * ease

    const innerLevel = hydro.level + hydro.backwater
    const fishmouthBuilt = levee.visible
    waterGroup.position.y = hydro.level
    canalGroup.position.y = 0
    innerChannel.mesh.visible = fishmouthBuilt
    if (innerChannel.bedMesh) innerChannel.bedMesh.visible = fishmouthBuilt
    innerChannel.mesh.position.y = innerLevel - cribState.drop
    innerChannel.material.uniforms.uOpacity.value = 0.88 * (1 - (cribState.drop / 0.22) * 0.88)
    canalGroup.visible = canalGroup.children.length > 0 && gapState.value > 0.18
    // 宝瓶口限流：低堰时灌渠水位稳定；高堰壅水才会漫过渠岸、威胁灌区。
    const canalLevel = 0.03 + innerLevel * 0.06 + hydro.backwater * 0.8
    for (const canal of canalChannels) canal.mesh.position.y = canalLevel

    for (const material of waterMaterials) {
      material.uniforms.uTime.value += delta * (0.55 + hydro.flood * 0.85)
      material.uniforms.uFlow.value = 0.8 + hydro.flood * 1.5
      if (material !== spillMaterial) material.uniforms.uFoam.value = 0.1 + hydro.flood * 0.45
    }

    updateFlow(innerChannel, elapsed, hydro.inner * (1 - (cribState.drop / 0.22) * 0.94), innerLevel - cribState.drop, fishmouthBuilt)
    updateFlow(outerChannel, elapsed, fishmouthBuilt ? 1 - hydro.inner : 1, hydro.level, true)
    updateFlow(upstreamChannel, elapsed, 1, hydro.level, true)
    if (canalGroup.visible) {
      for (const canal of canalChannels) updateFlow(canal, elapsed, 0.9, canalLevel, true)
    } else {
      for (const canal of canalChannels) canal.flow.visible = false
    }

    const weirTop = currentWeir === 'none' ? Number.POSITIVE_INFINITY : WEIR_TOP[currentWeir]
    const overflowTarget = currentWeir === 'none' ? 0 : THREE.MathUtils.clamp((innerLevel - weirTop) / 0.3, 0, 1)
    overflow.amount += (overflowTarget - overflow.amount) * ease
    const spilling = overflow.amount > 0.03
    spillMesh.visible = spilling
    spillFlow.visible = spilling
    spillFall.visible = spilling
    spillMaterial.uniforms.uOpacity.value = 0.85 * overflow.amount
    spillMaterial.uniforms.uFoam.value = 0.05 + overflow.amount * 0.65
    spillFallMaterial.opacity = 0.52 * overflow.amount
    crestFoamMaterial.opacity = 0.62 * overflow.amount
    spillMesh.position.y = innerLevel + 0.025
    const crestBase = currentWeir === 'none' ? WEIR_TOP.low : WEIR_TOP[currentWeir]
    crestFoam.position.y = Math.max(crestBase, innerLevel + 0.045)
    const spillHeight = Math.max(0.12, innerLevel - 0.06)
    spillFall.position.y = 0.06 + spillHeight / 2
    spillFall.scale.y = spillHeight / 1.4
    if (spilling) updateFlow(spillChannel, elapsed, 0.4 + overflow.amount * 0.6, innerLevel + 0.055, true)

    // 二八分沙：上游来沙在鱼嘴按颗粒数 8:2 分入外江与内江。
    updateSand(upstreamSand, elapsed, hydro.level, true)
    updateSand(outerSand, elapsed, hydro.level, fishmouthBuilt)
    updateSand(innerSand, elapsed, innerLevel - cribState.drop, fishmouthBuilt)
    // 二次排沙：离堆回流把内江余沙甩向飞沙堰，随溢流排回外江。
    updateSand(returnSand, elapsed, innerLevel, overflow.amount > 0.12 && cribState.drop < 0.05)

    reflux.visible = gapState.value > 0.5 && cribState.drop < 0.1
    if (reflux.visible) {
      for (let index = 0; index < refluxData.length; index += 1) {
        const data = refluxData[index]
        const angle = data.offset * Math.PI * 2 + elapsed * (0.45 + hydro.flood * 0.85) * data.speed
        dummy.position.set(-11.2 + Math.cos(angle) * 1.05, innerLevel + 0.03, 34.5 + Math.sin(angle) * 1.5)
        tangent.set(-Math.sin(angle) * 1.05, 0, Math.cos(angle) * 1.5).normalize()
        dummy.quaternion.setFromUnitVectors(forward, tangent)
        dummy.scale.set(0.07 * data.size, 0.018 * data.size, 0.4 * data.size)
        dummy.updateMatrix()
        reflux.setMatrixAt(index, dummy.matrix)
      }
      reflux.instanceMatrix.needsUpdate = true
    }

    // 凤栖窝淤积：低堰溢流把沙带走，高中堰与汛期加速淤积，岁修淘滩清零。
    if (fishmouthBuilt && cribState.drop < 0.05) {
      const rate = overflow.amount > 0.15
        ? 0.002
        : currentSeason === 'flood'
          ? currentWeir === 'high' ? 0.03 : currentWeir === 'mid' ? 0.024 : 0.012
          : 0.004
      sediment.level = Math.min(1, sediment.level + delta * rate)
    }
    for (const mound of sedimentMounds) {
      mound.visible = fishmouthBuilt && sediment.level > 0.04
      const grow = 0.25 + sediment.level * 1.15
      mound.scale.set(1.5 * grow, 0.32 * grow, 1.1 * grow)
    }

    const refluxText = overflow.amount > 0.12 ? '离堆回流 · 二次排沙' : '离堆回流'
    if (refluxText !== lastRefluxText) {
      lastRefluxText = refluxText
      setLabel('reflux', refluxText)
    }

    const innerPercent = Math.round(hydro.inner * 100)
    if (innerPercent !== lastInnerPercent) {
      lastInnerPercent = innerPercent
      setLabel('inner', `内江 ${innerPercent}% · 深槽`)
      setLabel('outer', `外江 ${100 - innerPercent}% · 宽浅`)
    }

    if (fireGroup.visible) {
      for (const [index, flame] of flames.entries()) {
        flame.scale.y = 0.82 + Math.sin(elapsed * 9 + index * 1.7) * 0.22
        flame.scale.x = 0.9 + Math.cos(elapsed * 7 + index) * 0.1
      }
    }

    for (let index = puffs.length - 1; index >= 0; index -= 1) {
      const puff = puffs[index]
      puff.age += delta
      const attribute = puff.geometry.getAttribute('position') as THREE.BufferAttribute
      const count = puff.velocities.length / 3
      for (let particle = 0; particle < count; particle += 1) {
        attribute.setX(
          particle,
          attribute.getX(particle) + puff.velocities[particle * 3] * delta,
        )
        attribute.setY(
          particle,
          attribute.getY(particle) + (puff.velocities[particle * 3 + 1] + puff.rise) * delta,
        )
        attribute.setZ(
          particle,
          attribute.getZ(particle) + puff.velocities[particle * 3 + 2] * delta,
        )
      }
      attribute.needsUpdate = true
      puff.material.opacity = 0.82 * Math.max(0, 1 - puff.age / puff.life)
      if (puff.age >= puff.life) {
        puff.points.removeFromParent()
        puff.geometry.dispose()
        puff.material.dispose()
        const transientIndex = transient.indexOf(puff.points)
        if (transientIndex >= 0) transient.splice(transientIndex, 1)
        puffs.splice(index, 1)
      }
    }

    libing.head.rotation.y = Math.sin(elapsed * 0.45) * 0.08
    erlang.head.rotation.y = Math.cos(elapsed * 0.52) * 0.06
    for (const farmer of farmers) {
      farmer.rightArm.rotation.z = 0.14 + Math.sin(elapsed * 0.9 + farmer.group.position.x) * 0.05
    }
  })

  /** 引擎动作 → 工程演出：开凿、筑鱼嘴、定堰高、岁修与结局。 */
  function handleAction(action: string): void {
    switch (action) {
      case 'dujiangyan:flood':
        setSeason('flood')
        break
      case 'dujiangyan:dry':
        setSeason('dry')
        break
      case 'dujiangyan:show:survey':
        stage.showHotspots()
        stage.resetHotspots()
        showLabel('mountain', true)
        showLabel('minjiang', true)
        showLabel('plain', true)
        break
      case 'dujiangyan:ignite':
        ignite()
        break
      case 'dujiangyan:quench':
        quench()
        break
      case 'dujiangyan:chisel':
        chisel()
        break
      case 'dujiangyan:cages':
        buildCages()
        break
      case 'dujiangyan:split:dry':
        setSeason('dry')
        break
      case 'dujiangyan:split:flood':
        setSeason('flood')
        break
      case 'dujiangyan:weir:low':
        setWeir('low')
        break
      case 'dujiangyan:weir:mid':
        setWeir('mid')
        break
      case 'dujiangyan:weir:high':
        setWeir('high')
        break
      case 'dujiangyan:cribs':
        installCribs()
        break
      case 'dujiangyan:dredge':
        dredge()
        break
      case 'dujiangyan:restore':
        restoreFlow()
        break
      case 'dujiangyan:celebrate':
        celebrate()
        break
      case 'dujiangyan:reset':
        resetScene()
        break
      default:
        break
    }
  }

  applyAmbience('calm', true)
  camera('overview', true)

  return {
    focus: (preset) => {
      camera(preset ?? 'overview')
      moveCast(preset ?? 'overview')
    },
    applyAction: handleAction,
    setAmbience: (level) => applyAmbience(level),
    markHotspot: (id) => stage.markHotspot(id),
    reset: resetScene,
    pause: (paused) => stage.setPaused(paused),
    dispose: () => stage.dispose(),
  }
}
