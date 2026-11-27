import * as THREE from 'three'

type Point = readonly [number, number, number]
interface Piece {
  position: Point
  scale: Point
  color: number
  rotation?: THREE.Euler | THREE.Quaternion
}

const UP = new THREE.Vector3(0, 1, 0)
const TAU = Math.PI * 2
const BAMBOO = [0xb49758, 0x947344, 0xc2a76c] as const
const STONE = [0x667378, 0x858b81, 0x949088, 0x737574, 0xa29b88] as const
const TIMBER = [0x765538, 0x886447, 0x634a35] as const
const LASHING = 0xc4a36b

const cobbleGeometry = new THREE.IcosahedronGeometry(1, 0)
const poleGeometry = new THREE.CylinderGeometry(0.82, 1, 1, 7)
const hoopGeometry = new THREE.TorusGeometry(1, 0.046, 5, 24)
const material = new THREE.MeshStandardMaterial({ roughness: 0.93, flatShading: true })
const xyToYZ = new THREE.Euler(0, Math.PI / 2, 0)
const xyToXZ = new THREE.Euler(Math.PI / 2, 0, 0)

function instanced(name: string, geometry: THREE.BufferGeometry, pieces: Piece[]) {
  const mesh = new THREE.InstancedMesh(geometry, material, pieces.length)
  const shape = new THREE.Object3D()
  const color = new THREE.Color()
  for (const [index, piece] of pieces.entries()) {
    shape.position.set(...piece.position)
    shape.scale.set(...piece.scale)
    if (piece.rotation instanceof THREE.Quaternion) {
      shape.quaternion.copy(piece.rotation)
    } else {
      shape.rotation.copy(piece.rotation ?? new THREE.Euler())
    }
    shape.updateMatrix()
    mesh.setMatrixAt(index, shape.matrix)
    mesh.setColorAt(index, color.setHex(piece.color))
  }
  mesh.name = name
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function rod(from: Point, to: Point, radius: number, color: number): Piece {
  const start = new THREE.Vector3(...from)
  const end = new THREE.Vector3(...to)
  const axis = end.clone().sub(start)
  return {
    position: start.lerp(end, 0.5).toArray(),
    scale: [radius, axis.length(), radius],
    rotation: new THREE.Quaternion().setFromUnitVectors(UP, axis.normalize()),
    color,
  }
}

function gabionParts() {
  const weave: Piece[] = []
  const strandCount = 12
  const segmentCount = 18
  // Opposing diagonals pass over and under at each intersection.
  for (const direction of [-1, 1]) {
    for (let strand = 0; strand < strandCount; strand++) {
      const point = (step: number): Point => {
        const t = step / segmentCount
        const angle = TAU * (strand / strandCount + direction * t * 0.75)
        const radius = 0.493 + direction * 0.009 * Math.cos(Math.PI * step)
        return [(t - 0.5) * 2.45, radius * Math.cos(angle), radius * Math.sin(angle)]
      }
      for (let step = 0; step < segmentCount; step++) {
        weave.push(rod(point(step), point(step + 1), 0.016, BAMBOO[direction === 1 ? 0 : 1]))
      }
    }
  }
  const hoops: Piece[] = []
  for (const x of [-1.226, -0.65, 0, 0.65, 1.226]) {
    hoops.push({ position: [x, 0, 0], scale: [0.497, 0.497, 0.51], rotation: xyToYZ, color: BAMBOO[2] })
  }
  // A woven end cap keeps the individual end stones visible between the slats.
  for (const x of [-1.228, 1.228]) {
    for (const offset of [-0.34, -0.17, 0, 0.17, 0.34]) {
      const span = Math.sqrt(0.488 ** 2 - offset ** 2)
      weave.push(rod([x - 0.006, offset, -span], [x - 0.006, offset, span], 0.015, BAMBOO[0]))
      weave.push(rod([x + 0.006, -span, offset], [x + 0.006, span, offset], 0.015, BAMBOO[1]))
    }
  }

  const stones: Piece[] = []
  for (let course = 0; course < 8; course++) {
    for (let stone = 0; stone < 8; stone++) {
      const angle = TAU * (stone / 8 + (course % 2) / 16)
      const radius = 0.327 + 0.01 * Math.cos(course + stone * 2)
      const x = -0.98 + course * 0.28 + 0.025 * Math.sin(stone * 2.9)
      stones.push({
        position: [x, radius * Math.cos(angle), radius * Math.sin(angle)],
        scale: [0.17, 0.16, 0.16],
        rotation: new THREE.Euler(stone * 0.7, course * 0.63, stone * 1.2),
        color: STONE[(course * 7 + stone * 3) % STONE.length]!,
      })
    }
    stones.push({
      position: [-0.98 + course * 0.28, 0, 0],
      scale: [0.23, 0.25, 0.25],
      rotation: new THREE.Euler(course * 0.8, 0.54, 0.1),
      color: STONE[3],
    })
  }
  return { weave, hoops, stones }
}

const cage = gabionParts()
const gabionBounds = new Map<string, THREE.Box3>()

function gabionBatch(name: string, geometry: THREE.BufferGeometry, pieces: Piece[]) {
  const mesh = instanced(name, geometry, pieces)
  let box = gabionBounds.get(name)
  if (!box) {
    // Three's default instance bounds rotate each geometry's coarse bounding box.
    // Use transformed vertices once so the cage's dimensions reflect its curved silhouette.
    const vertex = new THREE.Vector3()
    const matrix = new THREE.Matrix4()
    const positions = geometry.getAttribute('position')
    box = new THREE.Box3()
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix)
      for (let j = 0; j < positions.count; j++) {
        box.expandByPoint(vertex.fromBufferAttribute(positions, j).applyMatrix4(matrix))
      }
    }
    gabionBounds.set(name, box)
  }
  mesh.boundingBox = box.clone()
  return mesh
}

/** Centered bamboo cage with its long axis pointing along local X. */
export function createGabion(): THREE.Group {
  const group = new THREE.Group()
  group.name = 'bamboo-gabion'
  group.add(
    gabionBatch('gabion-weave', poleGeometry, cage.weave),
    gabionBatch('gabion-hoops', hoopGeometry, cage.hoops),
    gabionBatch('gabion-cobbles', cobbleGeometry, cage.stones),
  )
  return group
}

/** A tripod with two facing poles on upstream (local -X) and one rear pole. */
export function createMacha(): THREE.Group {
  const group = new THREE.Group()
  group.name = 'macha-tripod'
  const poles = [
    rod([-0.68, 0.08, -0.77], [-0.12, 2.08, -0.045], 0.083, TIMBER[0]),
    rod([-0.68, 0.08, 0.77], [-0.10, 2.11, 0.06], 0.085, TIMBER[1]),
    rod([0.92, 0.08, 0], [0.025, 2.06, 0], 0.090, TIMBER[2]),
  ]
  const bracing = [
    rod([-0.47, 0.82, -0.6], [-0.47, 0.82, 0.6], 0.054, TIMBER[1]),
    rod([-0.46, 0.82, -0.51], [0.59, 0.82, 0], 0.048, TIMBER[0]),
    rod([-0.46, 0.82, 0.51], [0.59, 0.82, 0], 0.048, TIMBER[0]),
    rod([-0.28, 0.87, -0.43], [-0.28, 0.87, 0.43], 0.043, TIMBER[2]),
    rod([0.055, 0.87, -0.33], [0.055, 0.87, 0.33], 0.043, TIMBER[2]),
  ]
  const lashings: Piece[] = []
  for (let wrap = 0; wrap < 6; wrap++) {
    lashings.push({
      position: [-0.059, 1.79 + wrap * 0.040, 0],
      scale: [0.23 - wrap * 0.011, 0.17 - wrap * 0.009, 0.25],
      rotation: new THREE.Euler(1.53, 0.10, 0.03),
      color: wrap % 2 ? LASHING : BAMBOO[1],
    })
  }

  const mat: Piece[] = []
  const matTop = 1.30
  const matBottom = 0.12
  const matX = (y: number) => -0.80 + 0.32 * y
  for (let i = 0; i < 19; i++) {
    const t = i / 18 * 2 - 1
    mat.push(rod([matX(matBottom), matBottom, t * 0.78], [matX(matTop), matTop, t * 0.53], 0.031, BAMBOO[i % 3]!))
  }
  for (let i = 0; i < 8; i++) {
    const t = i / 7
    const y = THREE.MathUtils.lerp(matBottom, matTop, t)
    const width = THREE.MathUtils.lerp(0.81, 0.56, t)
    mat.push(rod([matX(y) - 0.025, y, -width], [matX(y) - 0.025, y, width], 0.022, BAMBOO[i % 7 === 0 ? 1 : 2]))
  }

  const basket: Piece[] = []
  const ballast: Piece[] = [{ position: [-0.112, 1.06, 0.015], scale: [0.18, 0.16, 0.17], color: STONE[1] }]
  for (let i = 0; i < 14; i++) {
    const angle = i * TAU / 14
    const x = Math.cos(angle)
    const z = Math.sin(angle)
    basket.push(rod([-0.112 + x * 0.20, 0.91, z * 0.20], [-0.112 + x * 0.315, 1.19, z * 0.315], 0.023, BAMBOO[i % 3]!))
    if (i % 2 === 0) {
      ballast.push({
        position: [-0.112 + x * 0.17, 1.15 + 0.025 * Math.sin(i), z * 0.17],
        scale: [0.118, 0.116, 0.118],
        rotation: new THREE.Euler(i * 0.25, angle, 0),
        color: STONE[i % STONE.length]!,
      })
    }
  }
  const basketBands = [0.22, 0.24, 0.267, 0.294, 0.318].map((radius, i): Piece => ({
    position: [-0.112, 0.94 + i * 0.062, 0],
    scale: [radius, radius, i === 4 ? 0.43 : 0.28],
    rotation: xyToXZ,
    color: BAMBOO[i === 4 ? 2 : 1],
  }))

  group.add(
    instanced('macha-poles', poleGeometry, poles),
    instanced('macha-braces', poleGeometry, bracing),
    instanced('macha-apex-lashings', hoopGeometry, lashings),
    instanced('macha-upstream-mat', poleGeometry, mat),
    instanced('macha-basket-staves', poleGeometry, basket),
    instanced('macha-basket-bands', hoopGeometry, basketBands),
    instanced('macha-ballast-stones', cobbleGeometry, ballast),
  )
  return group
}

/** Three hearth stones and crossed fuelwood beneath the scene's animated fire. */
export function createFireBed(): THREE.Group {
  const group = new THREE.Group()
  group.name = 'stone-and-wood-fire-bed'
  const stones: Piece[] = [
    { position: [-0.43, 0.13, 0.07], scale: [0.31, 0.16, 0.29], color: STONE[0] },
    { position: [0.44, 0.13, 0.08], scale: [0.28, 0.16, 0.26], rotation: new THREE.Euler(0, 0.63, 0), color: STONE[3] },
    { position: [0.03, 0.15, 0.43], scale: [0.35, 0.18, 0.27], rotation: new THREE.Euler(0, -0.37, 0), color: STONE[1] },
  ]
  const logs = [
    rod([-0.38, 0.10, -0.16], [0.37, 0.10, -0.22], 0.075, TIMBER[0]),
    rod([-0.36, 0.10, 0.06], [0.41, 0.10, 0.01], 0.078, TIMBER[1]),
    rod([-0.40, 0.10, 0.24], [0.35, 0.10, 0.22], 0.069, TIMBER[2]),
    rod([-0.20, 0.235, -0.33], [-0.15, 0.235, 0.31], 0.070, TIMBER[2]),
    rod([0.06, 0.235, 0.32], [0.12, 0.235, -0.35], 0.079, TIMBER[0]),
    rod([0.25, 0.235, -0.27], [0.28, 0.235, 0.32], 0.065, TIMBER[1]),
  ]
  group.add(
    instanced('fire-hearth-stones', cobbleGeometry, stones),
    instanced('fire-stacked-logs', poleGeometry, logs),
  )
  return group
}

/** A row of cages with a ground-level pivot for staging and scaling. */
export function createWeirGabionCourse(): THREE.Group {
  const group = new THREE.Group()
  group.name = 'weir-gabion-course'
  for (const x of [-2, 0, 2]) {
    const gabion = createGabion()
    gabion.scale.set(0.8, 0.9615, 1.154)
    gabion.position.set(x, 0.5, 0)
    group.add(gabion)
  }
  return group
}
