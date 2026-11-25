import * as THREE from 'three'
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import { createTree } from '../primitives'
import { Stage, disposeObject } from '../stage'
import type { CameraPreset, ScenarioSceneOptions, ScenarioStageHandle } from './types'

type StageTween = ReturnType<Stage['after']>
type TweenTarget = Parameters<Stage['tweenTo']>[0]
type TweenVars = Parameters<Stage['tweenTo']>[1]

const CAMERA_PRESETS: Record<string, CameraPreset> = {
  overview: { position: [12, 56, -44], target: [10, 0, 14] },
  survey: { position: [10, 72, -58], target: [10, 0, 18] },
  bottleneck: { position: [16, 16, -18], target: [14.5, 4, 12] },
  irrigation: { position: [10, 48, -16], target: [10, 0, 46] },
  fishmouth: { position: [26, 26, -26], target: [2, 1, 2] },
  split: { position: [28, 30, -30], target: [4, 1, 5] },
  weir: { position: [42, 18, -18], target: [27, 1, 2] },
  maintenance: { position: [50, 14, -10], target: [39, 1, 6] },
  legacy: { position: [10, 58, -46], target: [10, 0, 16] },
}

const AMBIENCE = {
  calm: {
    background: 0xadc9c9,
    fogColor: 0xd3e0d6,
    fogDensity: 0.0036,
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
    fogDensity: 0.0075,
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
    fogDensity: 0.011,
    sunIntensity: 1.4,
    sunColor: 0xffc69b,
    fillIntensity: 0.85,
    exposure: 0.86,
    skyTop: 0x3a525e,
    skyHorizon: 0xa8a68e,
    skyBottom: 0x8e9c96,
  },
} as const

const GAP = { x: 14.5, z0: 8, z1: 18, width: 6.4, height: 8.4 }
const WEIR_X = 27
const CRIB_X = 38

const CAGE_TARGETS: Array<[number, number, number, number]> = [
  [-10.5, 0.42, -0.5, 0.02],
  [-8.6, 0.42, 0.5, -0.03],
  [-6.6, 0.42, -0.45, 0.05],
  [-4.6, 0.42, 0.45, -0.04],
  [-2.6, 0.42, -0.4, 0.02],
  [-0.6, 0.42, 0.4, 0.03],
  [1.4, 0.42, -0.35, -0.02],
  [3.4, 0.42, 0.35, 0.04],
  [5.4, 0.42, -0.3, -0.03],
  [7.2, 0.8, 0.2, 0.02],
  [8.2, 0.42, -0.2, 0],
  [9.2, 0.42, 0.2, 0.03],
]

const CANALS: Array<{ path: Array<[number, number]>; widths: number[] }> = [
  {
    path: [
      [14.5, 18],
      [10.5, 24],
      [4.5, 30],
      [-3.5, 38],
      [-13.5, 48],
      [-24, 60],
    ],
    widths: [2.6, 2.3, 2.0, 1.8, 1.55, 1.3],
  },
  {
    path: [
      [14.5, 18],
      [14.5, 26],
      [14, 36],
      [13, 48],
      [12, 60],
      [11, 74],
    ],
    widths: [2.8, 2.5, 2.2, 2.0, 1.8, 1.5],
  },
  {
    path: [
      [14.5, 18],
      [19, 24],
      [25, 30],
      [33, 38],
      [41, 48],
      [49, 60],
    ],
    widths: [2.6, 2.3, 2.0, 1.8, 1.55, 1.3],
  },
]

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

interface FigureOptions {
  robe?: number
  trim?: number
  hat?: 'guan' | 'douli' | 'headband' | 'none'
  tool?: 'staff' | 'hammer' | 'none'
  beard?: boolean
  scale?: number
  shadow?: boolean
}

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

function widthAt(widths: number[], t: number): number {
  if (widths.length === 1) return widths[0]
  const scaled = t * (widths.length - 1)
  const index = Math.min(widths.length - 2, Math.floor(scaled))
  return widths[index] + (widths[index + 1] - widths[index]) * (scaled - index)
}

function createRibbonGeometry(
  curve: THREE.CatmullRomCurve3,
  widths: number[],
  height: number,
  segments = 120,
  crossSegments = 4,
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
      fogFar: { value: 220 },
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
      float waterHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float waterNoise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(waterHash(i), waterHash(i + vec2(1.0, 0.0)), u.x),
          mix(waterHash(i + vec2(0.0, 1.0)), waterHash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      void main() {
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

function createPuffTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const context = canvas.getContext('2d')
  if (context) {
    const gradient = context.createRadialGradient(32, 32, 2, 32, 32, 30)
    gradient.addColorStop(0, 'rgba(255,255,255,0.9)')
    gradient.addColorStop(0.55, 'rgba(255,255,255,0.4)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, 64, 64)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function createGroundTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const context = canvas.getContext('2d')
  if (context) {
    context.fillStyle = '#93a074'
    context.fillRect(0, 0, 256, 256)
    const random = mulberry32(17)
    for (let index = 0; index < 2600; index += 1) {
      const x = random() * 256
      const y = random() * 256
      const shade = 0.72 + random() * 0.3
      context.fillStyle = `rgba(${Math.round(96 * shade)}, ${Math.round(116 * shade)}, ${Math.round(78 * shade)}, ${0.12 + random() * 0.2})`
      context.fillRect(x, y, 1 + random() * 2, 1 + random() * 2)
    }
    for (let index = 0; index < 40; index += 1) {
      context.strokeStyle = `rgba(78,94,62,${0.08 + random() * 0.08})`
      context.beginPath()
      context.moveTo(random() * 256, random() * 256)
      context.lineTo(random() * 256, random() * 256)
      context.stroke()
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(6, 5)
  return texture
}

function createFigure(options: FigureOptions = {}): {
  group: THREE.Group
  rightArm: THREE.Group
  head: THREE.Group
} {
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

/** 都江堰：岷江从西向东流过玉垒山北岸，宝瓶口是山体南侧的一条侧向缺口。 */
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

  // 天空与地面
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
  stage.scene.add(new THREE.Mesh(new THREE.SphereGeometry(210, 32, 20), skyMaterial))

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(280, 230),
    new THREE.MeshStandardMaterial({ color: 0x93a074, map: createGroundTexture(), roughness: 0.98 }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.set(0, -0.04, 18)
  ground.receiveShadow = true
  stage.scene.add(ground)

  const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x6a6a5c, roughness: 0.98, flatShading: true })
  const darkRockMaterial = new THREE.MeshStandardMaterial({ color: 0x55574e, roughness: 1, flatShading: true })
  const greenRockMaterial = new THREE.MeshStandardMaterial({ color: 0x5c7053, roughness: 0.98, flatShading: true })

  function addPeak(x: number, z: number, radius: number, height: number, material: THREE.Material): void {
    const peak = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 7), material)
    peak.position.set(x, height / 2 - 0.4, z)
    peak.rotation.y = (x + z) * 0.07
    stage.scene.add(peak)
    const shoulder = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.62, height * 0.72, 6), material)
    shoulder.position.set(x + radius * 0.68, height * 0.36 - 0.4, z + radius * 0.34)
    stage.scene.add(shoulder)
  }

  // 远景山只放在河岸北侧与两翼，不遮挡主河槽。
  addPeak(-70, 28, 18, 26, greenRockMaterial)
  addPeak(-58, 62, 16, 20, rockMaterial)
  addPeak(-30, 78, 20, 24, darkRockMaterial)
  addPeak(58, 68, 18, 24, greenRockMaterial)
  addPeak(78, 34, 16, 18, rockMaterial)
  addPeak(46, 82, 14, 16, greenRockMaterial)
  addPeak(-86, -18, 14, 16, greenRockMaterial)

  // 水体
  const waterMaterials: THREE.ShaderMaterial[] = []
  const INNER_BED: BedProfile = { center: 0.02, edge: 0.1 }
  const OUTER_BED: BedProfile = { center: 0.1, edge: 0.3 }
  const UPSTREAM_BED: BedProfile = { center: 0.02, edge: 0.14 }
  const CANAL_BED: BedProfile = { center: 0, edge: 0.02 }
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

  function buildChannel(
    path: Array<[number, number]>,
    widths: number[],
    flowCount: number,
    deep: number,
    shallow: number,
    bed: BedProfile,
    parent: THREE.Object3D = stage.scene,
    withBed = true,
  ): Channel {
    const curve = new THREE.CatmullRomCurve3(
      path.map(([x, z]) => new THREE.Vector3(x, 0, z)),
      false,
      'catmullrom',
      0.36,
    )
    const widthSampler = (t: number): number => widthAt(widths, t)
    let bedMesh: THREE.Mesh | undefined
    if (withBed) {
      bedMesh = new THREE.Mesh(
        createRibbonGeometry(curve, widths.map((width) => width + 1.2), bed.center, 120, 8, bed.edge),
        new THREE.MeshStandardMaterial({ color: 0x6e5f48, roughness: 1 }),
      )
      bedMesh.receiveShadow = true
      stage.scene.add(bedMesh)
    }
    const material = createWaterMaterial(deep, shallow)
    material.uniforms.uBedCenter.value = bed.center
    material.uniforms.uBedEdge.value = bed.edge
    waterMaterials.push(material)
    const mesh = new THREE.Mesh(createRibbonGeometry(curve, widths, 0, 140, 6), material)
    mesh.renderOrder = 2
    parent.add(mesh)
    const flow = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 6, 4),
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

  const upstreamChannel = buildChannel(
    [
      [-110, 0],
      [-82, 0],
      [-54, 0],
      [-28, 0],
      [-10, 0],
    ],
    [18, 18, 17, 16, 15],
    80,
    0x245a63,
    0x66a6a3,
    UPSTREAM_BED,
  )
  const innerChannel = buildChannel(
    [
      [-8, 0],
      [-4, 3],
      [0, 6],
      [8, 6],
      [20, 6],
      [40, 6],
      [70, 6],
    ],
    [7, 6, 5.6, 5.4, 5.2, 5, 4.6],
    120,
    0x1f5e66,
    0x63aaa4,
    INNER_BED,
  )
  const outerChannel = buildChannel(
    [
      [-8, 0],
      [-4, -3],
      [0, -6],
      [8, -6],
      [20, -6],
      [40, -6],
      [70, -6],
      [104, -6],
    ],
    [10, 10, 9.6, 9.4, 9.2, 9, 8.6, 8],
    120,
    0x2a5f63,
    0x6aa9a5,
    OUTER_BED,
  )

  // 宝瓶口：山体北岸的一条南北向缺口。水面从内江（z=6）穿过缺口到灌渠（z=18）。
  const gapWaterMaterial = createWaterMaterial(0x1f5e66, 0x63aaa4)
  gapWaterMaterial.uniforms.uOpacity.value = 0.0
  gapWaterMaterial.uniforms.uFoam.value = 0.18
  waterMaterials.push(gapWaterMaterial)
  const gapCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(GAP.x, 0, 6),
      new THREE.Vector3(GAP.x, 0, 10),
      new THREE.Vector3(GAP.x, 0, 14),
      new THREE.Vector3(GAP.x, 0, 18),
    ],
    false,
    'catmullrom',
    0.25,
  )
  const gapWater = new THREE.Mesh(new THREE.PlaneGeometry(6, 13), gapWaterMaterial)
  gapWater.rotation.x = -Math.PI / 2
  gapWater.position.set(GAP.x, 0.1, 12.5)
  gapWater.visible = false
  gapWater.renderOrder = 2
  stage.scene.add(gapWater)
  const gapBankMaterial = new THREE.MeshStandardMaterial({ color: 0x8a7b5e, roughness: 1, flatShading: true })
  for (const side of [-1, 1] as const) {
    const bankCurve = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(GAP.x + side * 3.0, 0, 6),
        new THREE.Vector3(GAP.x + side * 3.0, 0, 12),
        new THREE.Vector3(GAP.x + side * 3.0, 0, 19),
      ],
      false,
      'catmullrom',
      0.2,
    )
    const bank = new THREE.Mesh(
      createRibbonGeometry(bankCurve, [1.6, 1.6, 1.6], 0.34, 36, 2, 0.14),
      gapBankMaterial,
    )
    bank.receiveShadow = true
    stage.scene.add(bank)
  }
  const gapChannel: Channel = {
    mesh: gapWater,
    material: gapWaterMaterial,
    flow: new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 6, 4),
      new THREE.MeshBasicMaterial({ color: 0xe3f6ef, transparent: true, opacity: 0.28, depthWrite: false }),
      26,
    ),
    flowData: [],
    maxFlow: 26,
    widthSampler: (t) => widthAt([4.0, 4.6, 4.6, 4.0], t),
    curve: gapCurve,
    bed: { center: 0.02, edge: 0.08 },
  }
  const gapRandom = mulberry32(71)
  gapChannel.flowData = Array.from({ length: 26 }, () => ({
    offset: gapRandom(),
    speed: 0.5 + gapRandom() * 0.5,
    lane: (gapRandom() - 0.5) * 0.6,
    size: 0.6 + gapRandom() * 0.7,
  }))
  gapChannel.flow.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  gapChannel.flow.frustumCulled = false
  gapChannel.flow.visible = false
  stage.scene.add(gapChannel.flow)

  // 内江/外江分水鱼嘴：天然沙洲 + 后期竹笼护岸
  const gravelBar = new THREE.Mesh(
    new THREE.SphereGeometry(1, 18, 8),
    new THREE.MeshStandardMaterial({ color: 0xc9b48c, roughness: 0.98, flatShading: true }),
  )
  gravelBar.scale.set(9, 0.34, 1.35)
  gravelBar.position.set(0, 0.08, 0)
  gravelBar.receiveShadow = true
  stage.scene.add(gravelBar)
  const gravelNose = new THREE.Mesh(
    new THREE.ConeGeometry(1.25, 4.6, 5),
    new THREE.MeshStandardMaterial({ color: 0xb7a47f, roughness: 1, flatShading: true }),
  )
  gravelNose.rotation.z = -Math.PI / 2
  gravelNose.position.set(-9.4, 0.22, 0)
  stage.scene.add(gravelNose)

  const bambooMaterial = new THREE.MeshStandardMaterial({ color: 0xb08b52, roughness: 0.9, flatShading: true })
  const ropeMaterial = new THREE.MeshStandardMaterial({ color: 0x6e5634, roughness: 0.95 })
  const cageGroups: THREE.Group[] = []
  const cageTargets: THREE.Vector3[] = []
  const cagePlaced: boolean[] = []
  for (const [x, y, z, rotation] of CAGE_TARGETS) {
    const cage = new THREE.Group()
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 2.5, 8, 1, true), bambooMaterial)
    barrel.rotation.x = Math.PI / 2
    barrel.castShadow = true
    cage.add(barrel)
    for (const offset of [-0.82, 0.82]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.54, 0.04, 4, 8), ropeMaterial)
      ring.rotation.y = Math.PI / 2
      ring.position.z = offset
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
  const leveeBody = new THREE.Mesh(
    new THREE.SphereGeometry(1, 18, 10),
    new THREE.MeshStandardMaterial({ color: 0x9a8b6a, roughness: 0.98, flatShading: true }),
  )
  leveeBody.scale.set(9, 0.62, 2.2)
  leveeBody.position.set(0, 0.3, 0)
  leveeBody.castShadow = true
  leveeBody.receiveShadow = true
  levee.add(leveeBody)
  const leveeCrest = new THREE.Mesh(
    new THREE.SphereGeometry(1, 16, 8),
    new THREE.MeshStandardMaterial({ color: 0x7b8459, roughness: 1, flatShading: true }),
  )
  leveeCrest.scale.set(7.4, 0.16, 1.0)
  leveeCrest.position.set(0.3, 0.84, 0)
  levee.add(leveeCrest)
  levee.scale.y = 0.001
  levee.visible = false
  stage.scene.add(levee)

  // 40 个护岸竹笼沿鱼嘴两侧展开
  const cageWallGeometry = new THREE.CylinderGeometry(0.4, 0.4, 2.2, 8)
  cageWallGeometry.rotateX(Math.PI / 2)
  const cageWall = new THREE.InstancedMesh(cageWallGeometry, bambooMaterial, 40)
  cageWall.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  cageWall.castShadow = true
  cageWall.receiveShadow = true
  cageWall.visible = false
  stage.scene.add(cageWall)
  const cageWallData: Array<{ x: number; y: number; z: number; ry: number; scale: number }> = []
  const cageWallRandom = mulberry32(303)
  for (let index = 0; index < 10; index += 1) {
    for (const side of [-1, 1] as const) {
      for (const row of [0, 1] as const) {
        const x = -7.5 + index * 1.7 + (row === 1 ? 0.3 : 0)
        cageWallData.push({
          x,
          y: row === 1 ? 0.95 : 0.38,
          z: side * (row === 1 ? 1.55 : 2.05),
          ry: side * 0.06 + (cageWallRandom() - 0.5) * 0.1,
          scale: row === 1 ? 0.78 : 0.92,
        })
      }
    }
  }
  const cageWallDummy = new THREE.Object3D()
  function updateCageWall(placed: number): void {
    const ratio = placed / CAGE_TARGETS.length
    const visibleCount = Math.min(cageWallData.length, Math.floor(ratio * cageWallData.length))
    cageWall.count = visibleCount
    cageWall.visible = visibleCount > 0
    for (let index = 0; index < visibleCount; index += 1) {
      const data = cageWallData[index]
      cageWallDummy.position.set(data.x, data.y, data.z)
      cageWallDummy.rotation.set(0, data.ry, 0)
      cageWallDummy.scale.setScalar(data.scale)
      cageWallDummy.updateMatrix()
      cageWall.setMatrixAt(index, cageWallDummy.matrix)
    }
    cageWall.instanceMatrix.needsUpdate = true
  }

  // 玉垒山：北岸两团岩体，中间留出宝瓶口；缺口用可崩落的岩塞填住。
  const mountain = new THREE.Group()
  stage.scene.add(mountain)
  const mountainRandom = mulberry32(88)
  function addMass(x: number, z: number, sx: number, sy: number, sz: number, material: THREE.Material): void {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), material)
    rock.position.set(x, sy * 0.55 - 0.3, z)
    rock.scale.set(sx, sy, sz)
    rock.rotation.set(mountainRandom() * 0.2, mountainRandom() * Math.PI, mountainRandom() * 0.15)
    rock.castShadow = true
    rock.receiveShadow = true
    mountain.add(rock)
  }
  addMass(3, 16, 8.5, 6.8, 9.5, rockMaterial)
  addMass(5, 19, 6.5, 8.2, 7.2, greenRockMaterial)
  addMass(-6, 12, 4.2, 4.6, 5.2, darkRockMaterial)
  addMass(25.5, 16, 8.2, 7.2, 9.2, rockMaterial)
  addMass(23.5, 20, 6.2, 9.4, 7.0, greenRockMaterial)
  addMass(31, 12, 4.4, 5.0, 5.4, darkRockMaterial)
  for (const [x, z, scale, color] of [
    [-4, 22, 1.15, 0x5f7a4f],
    [2, 24, 1.0, 0x647f53],
    [25, 22, 1.15, 0x5f7a4f],
    [30, 23, 1.0, 0x647f53],
    [8, 18, 0.9, 0x526b45],
    [20, 17, 1.0, 0x526b45],
  ] as const) {
    const tree = createTree({ scale, color })
    tree.position.set(x, 6.8, z)
    mountain.add(tree)
  }

  // 岩塞：真实几何岩块，块与块之间留缝；淬冷时缝隙张开，凿通时整组崩落。
  const plugMaterial = new THREE.MeshStandardMaterial({ color: 0x9a917f, roughness: 0.98, flatShading: true })
  const plugDarkMaterial = new THREE.MeshStandardMaterial({ color: 0x756f62, roughness: 1, flatShading: true })
  // 岩塞内部是一团深色岩芯：块体裂开时，缝隙里看到的是它，而不是一张黑色平板。
  const crackCore = new THREE.Mesh(
    new THREE.DodecahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({
      color: 0x3a2b22,
      emissive: 0x2a0c04,
      emissiveIntensity: 0.35,
      roughness: 1,
      flatShading: true,
    }),
  )
  crackCore.position.set(GAP.x, 4.2, 11.8)
  crackCore.scale.set(3.0, 4.3, 3.0)
  stage.scene.add(crackCore)
  const plugGroup = new THREE.Group()
  stage.scene.add(plugGroup)
  const plugChunks: Array<{
    mesh: THREE.Mesh
    home: THREE.Vector3
    homeRotation: THREE.Euler
    dir: number
  }> = []
  const plugRandom = mulberry32(99)
  for (let column = 0; column < 3; column += 1) {
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 7.2, 5.6),
      column === 1 ? plugDarkMaterial : plugMaterial,
    )
    const home = new THREE.Vector3(
      GAP.x - 2.05 + column * 2.05 + (plugRandom() - 0.5) * 0.06,
      3.7,
      GAP.z0 + 3.2 + (plugRandom() - 0.5) * 0.1,
    )
    slab.position.copy(home)
    slab.rotation.set(
      (plugRandom() - 0.5) * 0.035,
      (plugRandom() - 0.5) * 0.045,
      (plugRandom() - 0.5) * 0.03,
    )
    slab.castShadow = true
    slab.receiveShadow = true
    plugGroup.add(slab)
    plugChunks.push({
      mesh: slab,
      home,
      homeRotation: slab.rotation.clone(),
      dir: column === 0 ? -1 : column === 2 ? 1 : 0,
    })
  }
  for (let index = 0; index < 5; index += 1) {
    const boulder = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.85 + plugRandom() * 0.35, 0),
      index % 2 === 0 ? plugMaterial : plugDarkMaterial,
    )
    const home = new THREE.Vector3(
      GAP.x - 2.0 + index * 1.0 + (plugRandom() - 0.5) * 0.2,
      7.35 + (plugRandom() - 0.5) * 0.3,
      GAP.z0 + 1.6 + (plugRandom() * 4.4),
    )
    boulder.position.copy(home)
    boulder.rotation.set(plugRandom() * 0.6, plugRandom() * 0.8, plugRandom() * 0.5)
    boulder.castShadow = true
    boulder.receiveShadow = true
    plugGroup.add(boulder)
    plugChunks.push({
      mesh: boulder,
      home,
      homeRotation: boulder.rotation.clone(),
      dir: index < 2 ? -1 : index > 2 ? 1 : 0,
    })
  }

  // 宝瓶口施工脚手架与火堆
  const woodMaterial = new THREE.MeshStandardMaterial({ color: 0x7a5c3e, roughness: 0.93 })
  const scaffold = new THREE.Group()
  for (const x of [GAP.x - 2.2, GAP.x + 2.2]) {
    for (const z of [8.4, 10.4]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 6.2, 6), woodMaterial)
      pole.position.set(x, 3.1, z)
      pole.castShadow = true
      scaffold.add(pole)
    }
  }
  for (const y of [2.0, 4.1]) {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.12, 2.8), woodMaterial)
    deck.position.set(GAP.x, y, 9.4)
    deck.castShadow = true
    scaffold.add(deck)
  }
  stage.scene.add(scaffold)

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
  const fireGroup = new THREE.Group()
  const flames: THREE.Mesh[] = []
  for (const [x, z, scale] of [
    [GAP.x - 1.2, 8.6, 1.3],
    [GAP.x, 8.8, 1.1],
    [GAP.x + 1.2, 8.5, 0.9],
  ] as const) {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.5 * scale, 2.2 * scale, 6), flameMaterials[0])
    flame.position.set(x, 1.1 * scale, z)
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.25 * scale, 1.4 * scale, 5), flameMaterials[1])
    inner.position.set(x, 0.75 * scale, z)
    fireGroup.add(flame, inner)
    flames.push(flame, inner)
  }
  const fireLight = new THREE.PointLight(0xff7c2e, 0, 28, 1.5)
  fireLight.position.set(GAP.x, 2.4, 8.8)
  fireGroup.add(fireLight)
  fireGroup.visible = false
  stage.scene.add(fireGroup)

  const emberCount = 42
  const emberPositions = new Float32Array(emberCount * 3)
  const emberVelocities = new Float32Array(emberCount * 3)
  const emberRandom = mulberry32(404)
  for (let index = 0; index < emberCount; index += 1) {
    const base = index * 3
    emberPositions[base] = GAP.x + (emberRandom() - 0.5) * 3.2
    emberPositions[base + 1] = 1 + emberRandom() * 2
    emberPositions[base + 2] = 8.7 + (emberRandom() - 0.5) * 1.6
    emberVelocities[base] = (emberRandom() - 0.5) * 0.5
    emberVelocities[base + 1] = 0.8 + emberRandom() * 1.7
    emberVelocities[base + 2] = (emberRandom() - 0.5) * 0.4
  }
  const emberGeometry = new THREE.BufferGeometry()
  emberGeometry.setAttribute('position', new THREE.BufferAttribute(emberPositions, 3))
  const emberMaterial = new THREE.PointsMaterial({
    color: 0xffb15a,
    size: 0.18,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  })
  const emberPoints = new THREE.Points(emberGeometry, emberMaterial)
  emberPoints.frustumCulled = false
  emberPoints.visible = false
  stage.scene.add(emberPoints)

  const smokeCount = 26
  const smokePositions = new Float32Array(smokeCount * 3)
  const smokeRandom = mulberry32(405)
  for (let index = 0; index < smokeCount; index += 1) {
    const base = index * 3
    smokePositions[base] = GAP.x + (smokeRandom() - 0.5) * 3
    smokePositions[base + 1] = 2 + smokeRandom() * 5
    smokePositions[base + 2] = 8.8 + (smokeRandom() - 0.5) * 1.6
  }
  const smokeGeometry = new THREE.BufferGeometry()
  smokeGeometry.setAttribute('position', new THREE.BufferAttribute(smokePositions, 3))
  const smokeMaterial = new THREE.PointsMaterial({
    map: puffTexture,
    color: 0x8c8579,
    size: 1.2,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    sizeAttenuation: true,
  })
  const smokePoints = new THREE.Points(smokeGeometry, smokeMaterial)
  smokePoints.frustumCulled = false
  smokePoints.visible = false
  stage.scene.add(smokePoints)
  const quenchFlash = new THREE.PointLight(0xcfeaf3, 0, 16, 2)
  quenchFlash.position.set(GAP.x, 3, 9)
  stage.scene.add(quenchFlash)

  // 飞沙堰：内江南岸的侧向溢流堰，水从内江漫出后穿过外江。
  const weirGroup = new THREE.Group()
  weirGroup.position.set(WEIR_X, 0, 3.2)
  const weirWallGeometry = new THREE.BoxGeometry(6, 1, 1.15)
  weirWallGeometry.translate(0, 0.5, 0)
  const weirWall = new THREE.Mesh(
    weirWallGeometry,
    new THREE.MeshStandardMaterial({ color: 0x77715f, roughness: 0.96, flatShading: true }),
  )
  weirWall.castShadow = true
  weirWall.receiveShadow = true
  weirWall.scale.y = 0.001
  weirGroup.add(weirWall)
  const weirCap = new THREE.Mesh(
    new THREE.BoxGeometry(6.2, 0.08, 1.4),
    new THREE.MeshStandardMaterial({ color: 0x8c8468, roughness: 0.95 }),
  )
  weirCap.position.y = 0.3
  weirGroup.add(weirCap)
  const crestFoamMaterial = new THREE.MeshBasicMaterial({
    color: 0xeaf7f2,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const crestFoam = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.035, 0.24), crestFoamMaterial)
  crestFoam.position.set(0, 0.3, 0.36)
  weirGroup.add(crestFoam)
  weirGroup.visible = false
  stage.scene.add(weirGroup)
  const spillCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(WEIR_X, 0, 3.2),
      new THREE.Vector3(WEIR_X, 0, 0),
      new THREE.Vector3(WEIR_X, 0, -6),
    ],
    false,
    'catmullrom',
    0.3,
  )
  const spillMaterial = createWaterMaterial(0x2f4f4c, 0x7fa19a)
  spillMaterial.uniforms.uOpacity.value = 0
  spillMaterial.uniforms.uFoam.value = 0.02
  waterMaterials.push(spillMaterial)
  const spillMesh = new THREE.Mesh(createRibbonGeometry(spillCurve, [5.6, 5.6, 5.6], 0.12, 40, 4), spillMaterial)
  spillMesh.visible = false
  spillMesh.renderOrder = 3
  stage.scene.add(spillMesh)
  const spillBed = new THREE.Mesh(
    createRibbonGeometry(spillCurve, [6.2, 6.2, 6.2], 0.02, 40, 2),
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
  const spillFall = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.4), spillFallMaterial)
  spillFall.position.set(WEIR_X, 0.45, 3.2)
  stage.scene.add(spillFall)
  const spillFlow = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 6, 4),
    new THREE.MeshBasicMaterial({ color: 0xe8f5f0, transparent: true, opacity: 0.16, depthWrite: false }),
    16,
  )
  spillFlow.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  spillFlow.frustumCulled = false
  spillFlow.visible = false
  stage.scene.add(spillFlow)
  const spillRandom = mulberry32(53)
  const spillFlowData = Array.from({ length: 16 }, () => ({
    offset: spillRandom(),
    speed: 0.8 + spillRandom() * 0.6,
    lane: (spillRandom() - 0.5) * 0.7,
    size: 0.7 + spillRandom() * 0.6,
  }))
  const spillMistCount = 22
  const mistPositions = new Float32Array(spillMistCount * 3)
  const mistGeometry = new THREE.BufferGeometry()
  mistGeometry.setAttribute('position', new THREE.BufferAttribute(mistPositions, 3))
  const mistMaterial = new THREE.PointsMaterial({
    map: puffTexture,
    color: 0xe7f4ef,
    size: 0.8,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    sizeAttenuation: true,
  })
  const spillMist = new THREE.Points(mistGeometry, mistMaterial)
  spillMist.frustumCulled = false
  spillMist.visible = false
  stage.scene.add(spillMist)
  const mistRandom = mulberry32(54)
  const mistData = Array.from({ length: spillMistCount }, () => ({
    offset: mistRandom(),
    speed: 0.5 + mistRandom() * 0.6,
    x: WEIR_X + (mistRandom() - 0.5) * 4,
    z: 3.2 + (mistRandom() - 0.5) * 3,
  }))

  // 岁修：内江上的两排杩槎、干河床、淤积与卧铁
  const cribGroup = new THREE.Group()
  const cribSplashPoints: Array<[number, number, number]> = []
  for (const rowX of [CRIB_X - 1.2, CRIB_X + 1.2]) {
    for (const z of [3.4, 4.7, 6.0, 7.3, 8.6]) {
      const tripod = new THREE.Group()
      for (let index = 0; index < 3; index += 1) {
        const angle = (index / 3) * Math.PI * 2
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.08, 2.1, 5), woodMaterial)
        pole.position.set(Math.cos(angle) * 0.5, 1.05, Math.sin(angle) * 0.5)
        pole.rotation.z = Math.cos(angle) * 0.35
        pole.rotation.x = Math.sin(angle) * 0.35
        pole.castShadow = true
        tripod.add(pole)
      }
      const lash = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.35, 6), ropeMaterial)
      lash.position.y = 2.05
      tripod.add(lash)
      tripod.position.set(rowX, 0, z)
      cribGroup.add(tripod)
      cribSplashPoints.push([rowX, 0.12, z])
    }
  }
  const cribBeam = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 5.8), woodMaterial)
  cribBeam.position.set(CRIB_X, 1.62, 6)
  cribGroup.add(cribBeam)
  const cribRopeMaterial = new THREE.LineBasicMaterial({ color: 0x5d472b, transparent: true, opacity: 0.8 })
  for (const x of [CRIB_X - 1.2, CRIB_X + 1.2]) {
    const ropeGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, 1.45, 3.2),
      new THREE.Vector3(x, 1.45, 8.8),
    ])
    cribGroup.add(new THREE.Line(ropeGeometry, cribRopeMaterial))
  }
  const riverMat = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 6),
    new THREE.MeshStandardMaterial({
      color: 0xb89b62,
      roughness: 0.98,
      transparent: true,
      opacity: 0.94,
      side: THREE.DoubleSide,
    }),
  )
  riverMat.rotation.x = -Math.PI / 2
  riverMat.position.set(CRIB_X, 0.7, 6)
  cribGroup.add(riverMat)
  cribGroup.visible = false
  stage.scene.add(cribGroup)

  const sedimentMounds: THREE.Mesh[] = []
  const sedimentRandom = mulberry32(31)
  for (let index = 0; index < 7; index += 1) {
    const mound = new THREE.Mesh(
      new THREE.SphereGeometry(0.5 + sedimentRandom() * 0.55, 8, 5),
      new THREE.MeshStandardMaterial({ color: 0x776044, roughness: 1 }),
    )
    mound.scale.set(1.4, 0.32, 1.0)
    mound.position.set(CRIB_X + 3 + sedimentRandom() * 5, 0.045, 4.4 + sedimentRandom() * 3.2)
    mound.receiveShadow = true
    mound.visible = false
    stage.scene.add(mound)
    sedimentMounds.push(mound)
  }
  const ironMarker = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.06, 1.8),
    new THREE.MeshStandardMaterial({ color: 0x4b4c47, roughness: 0.5, metalness: 0.5 }),
  )
  ironMarker.position.set(CRIB_X + 5.4, 0.06, 6)
  ironMarker.visible = false
  stage.scene.add(ironMarker)
  const exposedBed = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 5.2),
    new THREE.MeshStandardMaterial({ color: 0x6b5b45, roughness: 0.98 }),
  )
  exposedBed.rotation.x = -Math.PI / 2
  exposedBed.position.set(CRIB_X + 3.2, 0.04, 6)
  exposedBed.visible = false
  stage.scene.add(exposedBed)
  const cribState = { drop: 0 }
  const sediment = { level: 0.3 }

  // 灌渠与平原
  const canalGroup = new THREE.Group()
  stage.scene.add(canalGroup)
  const canalBedMaterial = new THREE.MeshStandardMaterial({ color: 0x75674d, roughness: 1 })
  const canalBankMaterial = new THREE.MeshStandardMaterial({ color: 0x8b835c, roughness: 0.98 })
  const canalChannels: Channel[] = []
  function buildCanalBed(path: Array<[number, number]>, widths: number[]): void {
    const curve = new THREE.CatmullRomCurve3(
      path.map(([x, z]) => new THREE.Vector3(x, 0, z)),
      false,
      'catmullrom',
      0.36,
    )
    const bed = new THREE.Mesh(
      createRibbonGeometry(curve, widths.map((width) => width + 1.6), 0.018, 90, 4),
      canalBedMaterial,
    )
    bed.receiveShadow = true
    canalGroup.add(bed)
    for (const sign of [-1, 1]) {
      const points: THREE.Vector3[] = []
      for (let step = 0; step <= 40; step += 1) {
        const t = step / 40
        const point = curve.getPointAt(t)
        const tangent = curve.getTangentAt(t)
        const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize()
        const offset = widthAt(widths, t) / 2 + 0.55
        points.push(new THREE.Vector3(point.x + normal.x * offset * sign, 0, point.z + normal.z * offset * sign))
      }
      const bankCurve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.3)
      const bank = new THREE.Mesh(
        createRibbonGeometry(bankCurve, [0.5, 0.5], 0.06, 40, 1),
        canalBankMaterial,
      )
      bank.receiveShadow = true
      canalGroup.add(bank)
    }
  }
  for (const spec of CANALS) {
    buildCanalBed(spec.path, spec.widths)
    const canal = buildChannel(spec.path, spec.widths, 26, 0x2a6666, 0x77b5a9, CANAL_BED, canalGroup, false)
    canal.material.uniforms.uOpacity.value = 0.82
    canal.flow.visible = false
    canalChannels.push(canal)
  }
  canalGroup.visible = false

  const fieldMaterials: THREE.MeshStandardMaterial[] = []
  const fieldDryColors = [0xb4a86c, 0xa8a262, 0xbcae74, 0x9f9d64]
  const fieldGreenColors = [0x6f8f4f, 0x7fa05a, 0x88a862, 0x6a8a4a]
  const fieldRandom = mulberry32(61)
  const canalDistance = (x: number, z: number): number => {
    let best = Number.POSITIVE_INFINITY
    for (const spec of CANALS) {
      for (let index = 0; index < spec.path.length - 1; index += 1) {
        const [x1, z1] = spec.path[index]
        const [x2, z2] = spec.path[index + 1]
        const dx = x2 - x1
        const dz = z2 - z1
        const t = Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / (dx * dx + dz * dz)))
        const px = x1 + dx * t
        const pz = z1 + dz * t
        best = Math.min(best, Math.hypot(x - px, z - pz))
      }
    }
    return best
  }
  for (let row = 0; row < 6; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const x = -30 + col * 8.5 + (fieldRandom() - 0.5) * 1.4
      const z = 22 + row * 7 + (fieldRandom() - 0.5) * 1.4
      if (canalDistance(x, z) < 2.6) continue
      const material = new THREE.MeshStandardMaterial({
        color: fieldDryColors[(row + col) % fieldDryColors.length],
        roughness: 1,
      })
      const field = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 3.8), material)
      field.rotation.x = -Math.PI / 2
      field.rotation.z = (fieldRandom() - 0.5) * 0.18
      field.position.set(x, 0.012, z)
      field.receiveShadow = true
      stage.scene.add(field)
      fieldMaterials.push(material)
    }
  }
  const houseWallMaterial = new THREE.MeshStandardMaterial({ color: 0xd8cdb2, roughness: 0.94 })
  const houseRoofMaterial = new THREE.MeshStandardMaterial({ color: 0x4b4a42, roughness: 0.92, flatShading: true })
  for (const [x, z] of [
    [-22, 36],
    [-8, 42],
    [6, 54],
    [26, 34],
    [34, 48],
  ] as const) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 1.8), houseWallMaterial)
    body.position.set(x, 0.7, z)
    body.castShadow = true
    stage.scene.add(body)
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.8, 0.9, 4), houseRoofMaterial)
    roof.position.set(x, 1.75, z)
    roof.rotation.y = Math.PI / 4
    roof.castShadow = true
    stage.scene.add(roof)
  }
  for (const [x, z, scale] of [
    [-26, 28, 1.4],
    [-14, 34, 1.2],
    [2, 26, 1.3],
    [22, 30, 1.2],
    [38, 40, 1.4],
    [-18, 52, 1.3],
    [8, 64, 1.2],
  ] as const) {
    const tree = createTree({ scale, color: 0x647f53 })
    tree.position.set(x, 0, z)
    stage.scene.add(tree)
  }

  // 人物
  const libing = createFigure({ robe: 0x4f6b63, trim: 0x2e3f3b, hat: 'guan', beard: true, tool: 'staff', scale: 1.16 })
  const erlang = createFigure({ robe: 0x6d7761, trim: 0x3b4538, hat: 'headband', scale: 1.08 })
  stage.scene.add(libing.group, erlang.group)
  const gapWorkers: Array<{ group: THREE.Group; rightArm: THREE.Group; head: THREE.Group }> = []
  for (const [x, y, z, rotation] of [
    [GAP.x - 1.6, 2.1, 10.2, 0.6],
    [GAP.x + 1.2, 2.1, 11.0, 0.9],
    [GAP.x - 1.2, 4.2, 10.6, 0.5],
    [GAP.x + 1.4, 4.2, 11.4, 0.8],
  ] as const) {
    const worker = createFigure({ robe: 0x7a6a4f, trim: 0x4e4637, hat: 'douli', tool: 'hammer', scale: 0.92, shadow: false })
    worker.group.position.set(x, y, z)
    worker.group.rotation.y = rotation
    stage.scene.add(worker.group)
    gapWorkers.push(worker)
  }
  const damWorkers: Array<{ group: THREE.Group; rightArm: THREE.Group; head: THREE.Group }> = []
  for (const [x, z, rotation] of [
    [-2.8, 1.2, 0.4],
    [-1.2, -0.8, 0.1],
    [3.4, 1.0, -0.5],
    [5.0, -1.0, -0.3],
  ] as const) {
    const worker = createFigure({ robe: 0x7f6b4d, trim: 0x504737, hat: 'douli', scale: 0.94, shadow: false })
    worker.group.position.set(x, 0.4, z)
    worker.group.rotation.y = rotation
    stage.scene.add(worker.group)
    damWorkers.push(worker)
  }
  const farmers: Array<{ group: THREE.Group; rightArm: THREE.Group; head: THREE.Group }> = []
  for (const [x, z, rotation, robe] of [
    [-18, 34, 0.9, 0x8b7d63],
    [-4, 40, -0.4, 0x7e7058],
    [8, 48, 2.4, 0x8a7c62],
    [26, 36, 1.6, 0x756b58],
  ] as const) {
    const farmer = createFigure({ robe, trim: 0x4b463a, hat: 'headband', scale: 0.92, shadow: false })
    farmer.group.position.set(x, 0, z)
    farmer.group.rotation.y = rotation
    stage.scene.add(farmer.group)
    farmers.push(farmer)
  }
  const dredgeWorkers: Array<{ group: THREE.Group; rightArm: THREE.Group; head: THREE.Group }> = []
  for (const [x, z, rotation] of [
    [CRIB_X + 2.8, 5.2, 1.2],
    [CRIB_X + 4.6, 6.8, 1.5],
    [CRIB_X + 3.4, 7.8, 0.9],
  ] as const) {
    const worker = createFigure({ robe: 0x77674c, trim: 0x4c4436, hat: 'douli', tool: 'staff', scale: 1, shadow: false })
    worker.group.position.set(x, 0.02, z)
    worker.group.rotation.y = rotation
    worker.group.visible = false
    stage.scene.add(worker.group)
    dredgeWorkers.push(worker)
  }

  const castPositions: Record<string, [[number, number, number], [number, number, number]]> = {
    overview: [[-2, 0, 10], [-0.8, 0, 11.2]],
    survey: [[-4, 0, 12], [-2.6, 0, 13.2]],
    bottleneck: [[8, 0, 9], [9.2, 0, 10.1]],
    irrigation: [[8, 0, 26], [9.2, 0, 27.2]],
    fishmouth: [[-2, 0, 3], [-0.8, 0, 4.1]],
    split: [[-2, 0, 3], [-0.8, 0, 4.1]],
    weir: [[24, 0, 4], [25.2, 0, 5.1]],
    maintenance: [[36, 0, 6], [37.2, 0, 7.1]],
    legacy: [[0, 0, 14], [1.2, 0, 15.1]],
  }
  function moveCast(preset: string, immediate = false): void {
    const home = castPositions[preset] ?? castPositions.overview
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

  // 流动粒子与泥沙
  const dummy = new THREE.Object3D()
  const forward = new THREE.Vector3(0, 0, 1)
  const tangent = new THREE.Vector3()
  const side = new THREE.Vector3()
  function bedHeightAt(bed: BedProfile, lane: number): number {
    const cross = 2 * lane
    return bed.center + (bed.edge - bed.center) * cross * cross
  }
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
      const t = (data.offset + elapsed * 0.03 * data.speed) % 1
      const point = channel.curve.getPointAt(t)
      channel.curve.getTangentAt(t, tangent)
      side.set(-tangent.z, 0, tangent.x).normalize()
      const lane = data.lane * channel.widthSampler(t)
      dummy.position.set(point.x + side.x * lane, level + 0.045, point.z + side.z * lane)
      dummy.quaternion.setFromUnitVectors(forward, tangent)
      const submerged = level > bedHeightAt(channel.bed, data.lane) + 0.012 ? 1 : 0
      dummy.scale.set(0.05 * data.size * submerged, 0.017 * data.size * submerged, 0.5 * data.size * submerged)
      dummy.updateMatrix()
      channel.flow.setMatrixAt(index, dummy.matrix)
    }
    channel.flow.instanceMatrix.needsUpdate = true
  }

  const surgeCount = 48
  const surgePositions = new Float32Array(surgeCount * 3)
  const surgeGeometry = new THREE.BufferGeometry()
  surgeGeometry.setAttribute('position', new THREE.BufferAttribute(surgePositions, 3))
  const surgeMaterial = new THREE.PointsMaterial({
    color: 0xeaf8f2,
    size: 0.42,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  })
  const surge = new THREE.Points(surgeGeometry, surgeMaterial)
  surge.frustumCulled = false
  surge.visible = false
  stage.scene.add(surge)
  const surgeRandom = mulberry32(515)
  const surgeData = Array.from({ length: surgeCount }, () => ({
    offset: surgeRandom(),
    speed: 0.55 + surgeRandom() * 0.55,
    lane: (surgeRandom() - 0.5) * 0.5,
  }))
  let surgeTime = 0
  let surgeLife = 0
  function startSurge(): void {
    surgeTime = 0
    surgeLife = 3.2
    surge.visible = true
    surgeMaterial.opacity = 0.85
  }

  // 标签与热点
  const labels = new Map<string, BuildLabel>()
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
  function showLabel(id: string, visible: boolean): void {
    const label = labels.get(id)
    if (label) label.element.style.opacity = visible ? '1' : '0'
  }
  function setLabel(id: string, text: string): void {
    const label = labels.get(id)
    if (label && label.element.textContent !== text) label.element.textContent = text
  }

  addLabel('mountain', '玉垒山', [-2, 10, 16])
  addLabel('minjiang', '岷江', [-42, 3.4, 0])
  addLabel('gap', '宝瓶口', [GAP.x, 7.2, 10])
  addLabel('isle', '离堆', [20, 4.6, 12])
  addLabel('fishmouth', '鱼嘴', [2, 3.2, 0])
  addLabel('cage', '竹笼 · 卵石', [0, 2.6, 0])
  addLabel('split46', '四六分水', [2, 4.2, 4])
  addLabel('sand28', '二八分沙', [5, 2.4, -4])
  addLabel('inner', '内江', [8, 2.6, 6])
  addLabel('outer', '外江', [8, 2.6, -6])
  addLabel('weir', '飞沙堰', [WEIR_X, 2.6, 3.8])
  addLabel('crib', '杩槎 · 截流', [CRIB_X, 2.9, 6])
  addLabel('fqwo', '凤栖窝', [CRIB_X + 4, 2.2, 6])
  addLabel('wotie', '卧铁', [CRIB_X + 5.4, 1.4, 6])
  addLabel('plain', '成都平原', [8, 4, 40])
  addLabel('canals', '左 · 中 · 右 三干渠', [14, 2.6, 28])
  showLabel('mountain', true)
  showLabel('minjiang', true)
  showLabel('plain', true)

  stage.addHotspot({
    id: 'd_spot_ridge',
    label: '玉垒山嘴',
    detail: '山体在岷江北岸，南侧临江；宝瓶口是山体南侧的一条侧向缺口，凿通后江水才会进入成都平原。',
    tone: 'info',
    position: [8, 7, 10],
  })
  stage.addHotspot({
    id: 'd_spot_bend',
    label: '内江弯道',
    detail: '内江沿山脚东流，弯道把表层清水推向宝瓶口，底层泥沙则更容易被飞沙堰甩回外江。',
    tone: 'info',
    position: [6, 3, 6],
  })
  stage.addHotspot({
    id: 'd_spot_plain',
    label: '平原引水口',
    detail: '宝瓶口一旦打开，内江水就从缺口北流，沿三条干渠自流进入成都平原。',
    tone: 'info',
    position: [10, 2.6, 32],
  })
  stage.hideHotspots()

  // 状态
  let currentSeason: 'normal' | 'dry' | 'flood' = 'normal'
  let currentWeir: 'none' | 'low' | 'mid' | 'high' = 'none'
  const overflow = { amount: 0 }
  const gapState = { value: 0 }
  const crackState = { value: 0 }
  let plugFalling = false
  let lastInnerPercent = 60
  let lastRefluxText = ''
  const WEIR_TOP: Record<'low' | 'mid' | 'high', number> = { low: 0.3, mid: 0.45, high: 0.62 }

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
      if (duration === 0) uniform.value.copy(color)
      else tw(uniform.value, { r: color.r, g: color.g, b: color.b, duration })
    }
  }

  function refreshBackwater(): void {
    hydro.targetBackwater = currentWeir === 'high' && currentSeason === 'flood' ? 0.07 : 0
  }
  function refreshSplitLabel(): void {
    if (!levee.visible) return
    setLabel('split46', currentSeason === 'flood' ? '四六分水 · 丰水内四外六' : '四六分水 · 枯水内六外四')
  }
  function setSeason(season: 'normal' | 'dry' | 'flood'): void {
    currentSeason = season
    hydro.targetLevel = SEASON_LEVEL[season]
    hydro.targetInner = season === 'flood' ? 0.4 : 0.6
    hydro.targetFlood = season === 'flood' ? 1 : season === 'dry' ? 0 : 0.35
    refreshBackwater()
    refreshSplitLabel()
  }
  function updateWeirLabel(): void {
    if (currentWeir === 'none') return
    setLabel('weir', currentWeir === 'low' ? '飞沙堰 · 低作堰' : currentWeir === 'mid' ? '飞沙堰 · 堰顶偏高' : '飞沙堰 · 高堰受阻')
  }
  function setWeir(level: 'low' | 'mid' | 'high'): void {
    currentWeir = level
    weirGroup.visible = true
    const top = WEIR_TOP[level]
    tw(weirWall.scale, { y: top, duration: 1.4, ease: 'power2.inOut' })
    tw(weirCap.position, { y: top - 0.035, duration: 1.4, ease: 'power2.inOut' })
    crestFoam.position.y = top
    spillMesh.visible = true
    spillBed.visible = true
    showLabel('weir', true)
    updateWeirLabel()
    refreshBackwater()
  }
  function setCageCount(count: number, animated = false): void {
    updateCageWall(count)
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
        cage.position.set(target.x, target.y + 7, target.z)
        cage.rotation.set(0.5, CAGE_TARGETS[index][3], 0.18)
        tw(cage.position, { y: target.y, duration: 0.9, ease: 'power2.in' })
        tw(cage.rotation, { x: 0, y: CAGE_TARGETS[index][3], z: 0, duration: 0.9 })
        later(480, () => splash(target.x, target.z, 0.75))
      } else {
        cage.position.copy(target)
        cage.rotation.set(0, CAGE_TARGETS[index][3], 0)
        cagePlaced[index] = true
      }
    }
    if (count >= cageGroups.length) {
      gravelBar.visible = false
      gravelNose.visible = false
      levee.visible = true
      tw(levee.scale, { y: 1, duration: 1.4, ease: 'power2.out' })
      showLabel('fishmouth', true)
      showLabel('cage', true)
      showLabel('inner', true)
      showLabel('outer', true)
      showLabel('split46', true)
      showLabel('sand28', true)
      refreshSplitLabel()
    }
  }

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

  const puffs: Array<{
    points: THREE.Points
    geometry: THREE.BufferGeometry
    material: THREE.PointsMaterial
    velocities: number[]
    age: number
    life: number
    rise: number
  }> = []

  const splashMaterial = new THREE.MeshBasicMaterial({
    color: 0xe9f7f1,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
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

  function ignite(): void {
    stage.hideHotspots()
    fireGroup.visible = true
    showLabel('inner', false)
    showLabel('outer', false)
    showLabel('gap', true)
    setLabel('gap', '宝瓶口 · 开凿中')
    tw(fireLight, { intensity: 48, duration: 0.8 })
    tw(crackState, { value: 0.16, duration: 0.9 })
    stage.shake(0.06, 0.35)
    spawnPuff(GAP.x - 0.6, 2.2, 9.2, 0x8b8780, 34, 3.8, 5, 3.8, 1.2)
    spawnPuff(GAP.x + 0.8, 1.4, 8.8, 0x6e6256, 18, 2.6, 3.4, 2.6, 0.9)
  }

  function quench(): void {
    fireGroup.visible = false
    tw(fireLight, { intensity: 0, duration: 0.4 })
    tw(crackState, { value: 1, duration: 0.35 })
    tw(quenchFlash, { intensity: 22, duration: 0.08, yoyo: true, repeat: 2 })
    stage.shake(0.16, 0.55)
    spawnPuff(GAP.x, 1.4, 9.4, 0xf3f7f2, 52, 3.4, 2.6, 4.4, 1.6)
    spawnPuff(GAP.x - 1.4, 1.4, 8.6, 0xe9efea, 24, 2.8, 2.4, 3.0, 1.3)
    spawnPuff(GAP.x + 1.4, 2.2, 9.8, 0xdde8e2, 14, 2.4, 2.2, 2.4, 1.0)
  }

  function chisel(): void {
    stage.hideHotspots()
    plugFalling = true
    tw(crackState, { value: 1, duration: 0.2 })
    tw(gapState, { value: 1, duration: 1.2, ease: 'power2.out' })
    showLabel('gap', true)
    showLabel('isle', true)
    setLabel('gap', '宝瓶口')
    stage.shake(0.2, 0.8)
    later(900, () => stage.shake(0.14, 0.5))
    later(1800, () => stage.shake(0.22, 0.7))
    const random = mulberry32(51)
    plugChunks.forEach((chunk, index) => {
      const dir = chunk.dir === 0 ? (random() > 0.5 ? 1 : -1) : chunk.dir
      tw(chunk.mesh.position, {
        x: chunk.home.x + dir * (2.2 + random() * 3.8),
        y: Math.max(0.2, chunk.home.y - 2.6 - random() * 3),
        z: chunk.home.z + (random() - 0.5) * 4,
        duration: 1.3 + random() * 0.8,
        delay: index * 0.045,
        ease: 'power2.in',
      })
      tw(chunk.mesh.rotation, {
        x: (random() - 0.5) * 1.2,
        y: (random() - 0.5) * 1.0,
        z: (random() - 0.5) * 1.3,
        duration: 1.4 + random() * 0.7,
        delay: index * 0.045,
        ease: 'power2.in',
      })
    })
    later(700, () => {
      gapWater.visible = true
      tw(gapWaterMaterial.uniforms.uOpacity, { value: 0.92, duration: 0.8 })
      gapChannel.flow.visible = true
    })
    later(1100, () => {
      splash(GAP.x, 8.4, 1.5)
      spawnPuff(GAP.x, 1, 9.2, 0xb7ac96, 54, 3.4, 4.2, 0.9, 1.0)
      splash(GAP.x, 6.4, 1.1)
    })
    later(2400, () => {
      scaffold.visible = false
      for (const worker of gapWorkers) worker.group.visible = false
      plugGroup.visible = false
      crackCore.visible = false
    })
  }

  function buildCages(): void {
    stage.hideHotspots()
    setCageCount(0)
    for (let index = 0; index < CAGE_TARGETS.length; index += 1) {
      later(index * 240, () => setCageCount(index + 1, true))
    }
    showLabel('fishmouth', true)
    showLabel('cage', true)
    for (const worker of damWorkers) {
      tw(worker.rightArm.rotation, { x: -1.1, duration: 0.5, repeat: 2, yoyo: true, ease: 'power1.inOut' })
    }
  }

  function installCribs(): void {
    cribGroup.visible = true
    cribGroup.scale.y = 0.001
    tw(cribGroup.scale, { y: 1, duration: 1.1, ease: 'power2.out' })
    tw(cribState, { drop: 0.22, duration: 1.6, ease: 'power2.inOut' })
    stage.shake(0.1, 0.45)
    cribSplashPoints.forEach(([x, y, z], index) => {
      later(180 + index * 60, () => {
        splash(x, z, 0.62)
        spawnPuff(x, y, z, 0xcfe6e2, 6, 1.0, 1.1, 0.6, 0.45)
      })
    })
    currentSeason = 'dry'
    hydro.targetLevel = 0.24
    hydro.targetFlood = 0.28
    refreshBackwater()
    sediment.level = Math.max(sediment.level, 0.75)
    showLabel('fqwo', true)
    showLabel('crib', true)
    showLabel('inner', false)
    showLabel('outer', false)
    showLabel('weir', false)
    exposedBed.visible = true
    for (const worker of dredgeWorkers) worker.group.visible = true
  }

  function dredge(): void {
    tw(sediment, { level: 0, duration: 1.8, ease: 'power2.inOut' })
    for (const [index, mound] of sedimentMounds.entries()) {
      later(320 + index * 90, () => spawnPuff(mound.position.x, 0.15, mound.position.z, 0xa08d6d, 10, 1.6, 2, 1.4, 0.5))
      later(520 + index * 90, () => splash(mound.position.x, mound.position.z, 0.42))
    }
    later(700, () => {
      ironMarker.visible = true
      showLabel('wotie', true)
      tw(ironMarker.scale, { x: 1.35, y: 1.6, z: 1.35, duration: 0.28, yoyo: true, repeat: 1, ease: 'power2.out' })
    })
    for (const worker of dredgeWorkers) {
      tw(worker.rightArm.rotation, { x: -1.2, duration: 0.45, repeat: 4, yoyo: true, ease: 'power1.inOut' })
    }
  }

  function restoreFlow(): void {
    tw(cribState, { drop: 0, duration: 1.2, ease: 'power2.inOut' })
    tw(cribGroup.scale, { y: 0.001, duration: 0.8, onComplete: () => { cribGroup.visible = false } })
    exposedBed.visible = false
    for (const worker of dredgeWorkers) worker.group.visible = false
    showLabel('fqwo', false)
    showLabel('crib', false)
    showLabel('wotie', false)
    showLabel('inner', true)
    showLabel('outer', true)
    showLabel('weir', true)
    stage.shake(0.08, 0.4)
    later(260, startSurge)
    later(300, () => {
      cribSplashPoints.forEach(([x, , z], index) => {
        later(index * 50, () => splash(x, z, 0.7))
      })
    })
  }

  function celebrate(): void {
    if (currentWeir === 'none') setWeir('low')
    currentSeason = 'flood'
    hydro.targetLevel = SEASON_LEVEL.flood
    hydro.targetInner = 0.4
    hydro.targetFlood = 0.75
    refreshBackwater()
    refreshSplitLabel()
    camera('legacy')
    moveCast('legacy')
    later(320, startSurge)
    stage.shake(0.06, 0.4)
    for (const [index, material] of fieldMaterials.entries()) {
      const color = new THREE.Color(fieldGreenColors[index % fieldGreenColors.length])
      tw(material.color, { r: color.r, g: color.g, b: color.b, duration: 2.6, delay: index * 0.03 })
    }
    for (const label of [
      'gap',
      'isle',
      'fishmouth',
      'cage',
      'weir',
      'fqwo',
      'inner',
      'outer',
      'plain',
      'mountain',
      'canals',
      'split46',
      'sand28',
    ]) {
      showLabel(label, true)
    }
    setLabel('gap', '宝瓶口')
  }

  function resetFields(): void {
    for (const [index, material] of fieldMaterials.entries()) {
      material.color.setHex(fieldDryColors[index % fieldDryColors.length])
    }
  }

  function resetScene(): void {
    while (tweens.length) tweens.pop()?.kill()
    for (const object of transient) {
      object.removeFromParent()
      disposeObject(object)
    }
    transient.length = 0
    puffs.length = 0
    plugFalling = false
    fireGroup.visible = false
    fireLight.intensity = 0
    quenchFlash.intensity = 0
    crackState.value = 0
    gapState.value = 0
    emberPoints.visible = false
    smokePoints.visible = false
    scaffold.visible = true
    for (const worker of gapWorkers) worker.group.visible = true
    for (const chunk of plugChunks) {
      chunk.mesh.position.copy(chunk.home)
      chunk.mesh.rotation.copy(chunk.homeRotation)
    }
    plugGroup.visible = true
    crackCore.visible = true
    gapWater.visible = false
    gapWaterMaterial.uniforms.uOpacity.value = 0
    gapChannel.flow.visible = false
    setCageCount(0)
    gravelBar.visible = true
    gravelNose.visible = true
    levee.visible = false
    levee.scale.y = 0.001
    weirGroup.visible = false
    currentWeir = 'none'
    overflow.amount = 0
    spillMesh.visible = false
    spillFlow.visible = false
    spillBed.visible = false
    spillFall.visible = false
    spillMist.visible = false
    mistMaterial.opacity = 0
    spillFallMaterial.opacity = 0
    crestFoamMaterial.opacity = 0
    spillMaterial.uniforms.uOpacity.value = 0
    spillMaterial.uniforms.uFoam.value = 0.02
    cribGroup.visible = false
    cribGroup.scale.y = 1
    cribState.drop = 0
    for (const mound of sedimentMounds) {
      mound.visible = false
      mound.scale.set(1.4, 0.32, 1.0)
    }
    ironMarker.visible = false
    ironMarker.scale.set(1, 1, 1)
    exposedBed.visible = false
    sediment.level = 0.3
    for (const worker of dredgeWorkers) worker.group.visible = false
    canalGroup.visible = false
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
    surge.visible = false
    surgeLife = 0
    surgeMaterial.opacity = 0
    stage.resetHotspots()
    stage.hideHotspots()
    for (const label of labels.keys()) showLabel(label, false)
    for (const label of ['mountain', 'plain', 'minjiang']) showLabel(label, true)
    setLabel('inner', '内江')
    setLabel('outer', '外江')
    moveCast('overview', true)
    applyAmbience('calm', true)
    camera('overview', true)
  }

  // 主循环
  stage.addUpdater((delta, elapsed) => {
    const ease = 1 - Math.exp(-delta * 2.6)
    hydro.level += (hydro.targetLevel - hydro.level) * ease
    hydro.inner += (hydro.targetInner - hydro.inner) * ease
    hydro.flood += (hydro.targetFlood - hydro.flood) * ease
    hydro.backwater += (hydro.targetBackwater - hydro.backwater) * ease
    const innerLevel = hydro.level + hydro.backwater

    for (const channel of [upstreamChannel, outerChannel]) channel.mesh.position.y = hydro.level
    innerChannel.mesh.position.y = innerLevel - cribState.drop
    innerChannel.material.uniforms.uOpacity.value = 0.9 * (1 - (cribState.drop / 0.22) * 0.86)
    gapWater.position.y = hydro.level - 0.02
    const canalLevel = 0.03 + innerLevel * 0.06 + hydro.backwater * 0.8
    for (const canal of canalChannels) canal.mesh.position.y = canalLevel

    for (const material of waterMaterials) {
      material.uniforms.uTime.value += delta * (0.55 + hydro.flood * 0.85)
      material.uniforms.uFlow.value = 0.8 + hydro.flood * 1.5
      if (material !== spillMaterial && material !== gapWaterMaterial) {
        material.uniforms.uFoam.value = 0.1 + hydro.flood * 0.45
      }
    }

    updateFlow(upstreamChannel, elapsed, 1, hydro.level, true)
    updateFlow(innerChannel, elapsed, hydro.inner * (1 - (cribState.drop / 0.22) * 0.94), innerLevel - cribState.drop, true)
    updateFlow(outerChannel, elapsed, 1 - hydro.inner, hydro.level, true)
    updateFlow(gapChannel, elapsed, gapState.value, hydro.level + 0.04, gapWater.visible)
    if (canalGroup.visible) {
      for (const canal of canalChannels) updateFlow(canal, elapsed, 0.9, canalLevel, true)
    } else {
      for (const canal of canalChannels) canal.flow.visible = false
    }

    // 岩塞裂缝：未崩落时，按 crackState 把 12 块岩体向外错开，缝隙即真实裂纹。
    if (!plugFalling) {
      for (const chunk of plugChunks) {
        const offset = crackState.value * 0.46
        chunk.mesh.position.set(
          chunk.home.x + chunk.dir * offset,
          chunk.home.y + Math.sin(chunk.home.z * 3.1) * crackState.value * 0.08,
          chunk.home.z + (chunk.home.z > 12 ? 0.16 : -0.16) * crackState.value,
        )
        chunk.mesh.rotation.set(
          chunk.homeRotation.x + crackState.value * 0.04 * chunk.dir,
          chunk.homeRotation.y,
          chunk.homeRotation.z - crackState.value * 0.055 * chunk.dir,
        )
      }
    }

    // 飞沙堰溢流
    const weirTop = currentWeir === 'none' ? Number.POSITIVE_INFINITY : WEIR_TOP[currentWeir]
    const overflowTarget = currentWeir === 'none' ? 0 : THREE.MathUtils.clamp((innerLevel - weirTop) / 0.3, 0, 1)
    overflow.amount += (overflowTarget - overflow.amount) * ease
    const spilling = overflow.amount > 0.03
    spillMesh.visible = spilling
    spillFlow.visible = spilling
    spillFall.visible = spilling
    spillMist.visible = spilling && overflow.amount > 0.08
    spillMaterial.uniforms.uOpacity.value = 0.85 * overflow.amount
    spillMaterial.uniforms.uFoam.value = 0.05 + overflow.amount * 0.65
    spillFallMaterial.opacity = 0.52 * overflow.amount
    crestFoamMaterial.opacity = 0.62 * overflow.amount
    spillMesh.position.y = hydro.level + 0.04
    spillFall.position.y = 0.06 + Math.max(0.12, innerLevel - 0.06) / 2
    spillFall.scale.y = Math.max(0.12, innerLevel - 0.06) / 1.4
    crestFoam.position.y = Math.max(weirTop === Number.POSITIVE_INFINITY ? 0.3 : weirTop, innerLevel + 0.045)
    if (spilling) {
      for (let index = 0; index < 16; index += 1) {
        const data = spillFlowData[index]
        const t = (data.offset + elapsed * 0.03 * data.speed) % 1
        const point = spillCurve.getPointAt(t)
        spillCurve.getTangentAt(t, tangent)
        side.set(-tangent.z, 0, tangent.x).normalize()
        const lane = data.lane * 5.6
        dummy.position.set(point.x + side.x * lane, hydro.level + 0.06, point.z + side.z * lane)
        dummy.quaternion.setFromUnitVectors(forward, tangent)
        dummy.scale.set(0.06 * data.size, 0.018, 0.45)
        dummy.updateMatrix()
        spillFlow.setMatrixAt(index, dummy.matrix)
      }
      spillFlow.instanceMatrix.needsUpdate = true
      mistMaterial.opacity = 0.14 + overflow.amount * 0.2
      const mistAttr = mistGeometry.getAttribute('position') as THREE.BufferAttribute
      for (let index = 0; index < spillMistCount; index += 1) {
        const data = mistData[index]
        const u = (data.offset + elapsed * data.speed * 0.24) % 1
        const base = index * 3
        mistPositions[base] = data.x + Math.sin(u * 6.2 + index) * 0.45
        mistPositions[base + 1] = 0.3 + u * 2.2
        mistPositions[base + 2] = data.z + Math.cos(u * 4.8 + index) * 0.35
      }
      mistAttr.needsUpdate = true
    }

    // 凤栖窝淤积
    if (levee.visible && cribState.drop < 0.05) {
      const rate = overflow.amount > 0.15
        ? 0.002
        : currentSeason === 'flood'
          ? currentWeir === 'high' ? 0.03 : currentWeir === 'mid' ? 0.024 : 0.012
          : 0.004
      sediment.level = Math.min(1, sediment.level + delta * rate)
    }
    for (const mound of sedimentMounds) {
      mound.visible = levee.visible && sediment.level > 0.04
      const grow = 0.25 + sediment.level * 1.15
      mound.scale.set(1.4 * grow, 0.32 * grow, 1.0 * grow)
    }

    const innerPercent = Math.round(hydro.inner * 100)
    if (innerPercent !== lastInnerPercent) {
      lastInnerPercent = innerPercent
      setLabel('inner', `内江 ${innerPercent}%`)
      setLabel('outer', `外江 ${100 - innerPercent}%`)
    }
    const refluxText = overflow.amount > 0.12 ? '离堆回流 · 二次排沙' : '离堆回流'
    if (refluxText !== lastRefluxText) {
      lastRefluxText = refluxText
      setLabel('isle', refluxText)
    }

    if (fireGroup.visible) {
      for (const [index, flame] of flames.entries()) {
        flame.scale.y = 0.82 + Math.sin(elapsed * 9 + index * 1.7) * 0.22
        flame.scale.x = 0.9 + Math.cos(elapsed * 7 + index) * 0.1
      }
      const emberAttr = emberGeometry.getAttribute('position') as THREE.BufferAttribute
      for (let index = 0; index < emberCount; index += 1) {
        const base = index * 3
        emberPositions[base] += emberVelocities[base] * delta
        emberPositions[base + 1] += emberVelocities[base + 1] * delta
        emberPositions[base + 2] += emberVelocities[base + 2] * delta
        if (emberPositions[base + 1] > 8 || Math.abs(emberPositions[base] - GAP.x) > 4) {
          emberPositions[base] = GAP.x + (emberRandom() - 0.5) * 3.2
          emberPositions[base + 1] = 1 + emberRandom() * 2
          emberPositions[base + 2] = 8.7 + (emberRandom() - 0.5) * 1.6
        }
      }
      emberAttr.needsUpdate = true
      const smokeAttr = smokeGeometry.getAttribute('position') as THREE.BufferAttribute
      for (let index = 0; index < smokeCount; index += 1) {
        const base = index * 3
        smokePositions[base] += Math.sin(elapsed * 0.8 + index) * delta * 0.12
        smokePositions[base + 1] += delta * (0.32 + (index % 5) * 0.07)
        if (smokePositions[base + 1] > 9) {
          smokePositions[base] = GAP.x + (smokeRandom() - 0.5) * 3
          smokePositions[base + 1] = 2 + smokeRandom() * 2
          smokePositions[base + 2] = 8.8 + (smokeRandom() - 0.5) * 1.6
        }
      }
      smokeAttr.needsUpdate = true
    }
    emberPoints.visible = fireGroup.visible
    smokePoints.visible = fireGroup.visible

    for (let index = puffs.length - 1; index >= 0; index -= 1) {
      const puff = puffs[index]
      puff.age += delta
      const attribute = puff.geometry.getAttribute('position') as THREE.BufferAttribute
      const count = puff.velocities.length / 3
      for (let particle = 0; particle < count; particle += 1) {
        attribute.setX(particle, attribute.getX(particle) + puff.velocities[particle * 3] * delta)
        attribute.setY(particle, attribute.getY(particle) + (puff.velocities[particle * 3 + 1] + puff.rise) * delta)
        attribute.setZ(particle, attribute.getZ(particle) + puff.velocities[particle * 3 + 2] * delta)
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

    if (surgeLife > 0) {
      surgeLife -= delta
      surgeTime += delta
      surgeMaterial.opacity = 0.85 * Math.min(1, surgeLife / 1.1)
      const surgeAttr = surgeGeometry.getAttribute('position') as THREE.BufferAttribute
      for (let index = 0; index < surgeCount; index += 1) {
        const data = surgeData[index]
        const u = (data.offset + surgeTime * data.speed * 0.5) % 1
        const point = innerChannel.curve.getPointAt(1 - u)
        innerChannel.curve.getTangentAt(1 - u, tangent)
        side.set(-tangent.z, 0, tangent.x).normalize()
        const lane = data.lane * innerChannel.widthSampler(1 - u)
        const base = index * 3
        surgePositions[base] = point.x + side.x * lane
        surgePositions[base + 1] = hydro.level + 0.08 + Math.sin(u * Math.PI) * 0.06
        surgePositions[base + 2] = point.z + side.z * lane
      }
      surgeAttr.needsUpdate = true
    } else if (surge.visible) {
      surge.visible = false
      surgeMaterial.opacity = 0
    }

    libing.head.rotation.y = Math.sin(elapsed * 0.45) * 0.08
    erlang.head.rotation.y = Math.cos(elapsed * 0.52) * 0.06
    for (const farmer of farmers) {
      farmer.rightArm.rotation.z = 0.14 + Math.sin(elapsed * 0.9 + farmer.group.position.x) * 0.05
    }
  })

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
