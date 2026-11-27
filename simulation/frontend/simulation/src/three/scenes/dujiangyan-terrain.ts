import * as THREE from 'three'
import { anchors, mapLand, polygonGeometry, waterways, type XZ } from './dujiangyan-geography'

const GROUND_Y = -0.04
const SHORE_Y = -0.03
const CELL_SIZE = 4

type Triangle<T> = [T, T, T]
type Vertex = [x: number, y: number, z: number]

const mix = THREE.MathUtils.lerp
const smooth = THREE.MathUtils.smoothstep
const cross = ([ax, az]: XZ, [bx, bz]: XZ, [cx, cz]: XZ) =>
  (bx - ax) * (cz - az) - (bz - az) * (cx - ax)

function edgeDistanceSquared(x: number, z: number, [ax, az]: XZ, [bx, bz]: XZ): number {
  const dx = bx - ax
  const dz = bz - az
  const t = THREE.MathUtils.clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1), 0, 1)
  return (x - ax - t * dx) ** 2 + (z - az - t * dz) ** 2
}

function boundaryDistance(x: number, z: number, rings: XZ[][]): number {
  let nearest = Infinity
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      nearest = Math.min(nearest, edgeDistanceSquared(x, z, ring[i]!, ring[(i + 1) % ring.length]!))
    }
  }
  return Math.sqrt(nearest)
}

// The source map marks, rather than opens, the engineered intake. Cut its short throat
// separately instead of letting the eastern mountain close the channel.
const intakeStart = waterways.outlet.path[0]!
const intakeEnd = waterways.outlet.path[1]!
const intakeLength = Math.hypot(intakeEnd[0] - intakeStart[0], intakeEnd[1] - intakeStart[1])
const intakeX = (intakeEnd[0] - intakeStart[0]) / intakeLength
const intakeZ = (intakeEnd[1] - intakeStart[1]) / intakeLength
const intakeCorners: XZ[] = [[-0.95, -0.7], [intakeLength + 0.15, -1.02], [intakeLength + 0.15, 1.02], [-0.95, 0.7]]
  .map(([along, across]) => [intakeStart[0] + along! * intakeX - across! * intakeZ,
    intakeStart[1] + along! * intakeZ + across! * intakeX])
const intakeMinX = Math.min(...intakeCorners.map(p => p[0]))
const intakeMaxX = Math.max(...intakeCorners.map(p => p[0]))
const intakeMinZ = Math.min(...intakeCorners.map(p => p[1]))
const intakeMaxZ = Math.max(...intakeCorners.map(p => p[1]))

function cutIntake(triangle: Triangle<XZ>): XZ[][] {
  if (triangle.every(p => p[0] < intakeMinX) || triangle.every(p => p[0] > intakeMaxX) ||
      triangle.every(p => p[1] < intakeMinZ) || triangle.every(p => p[1] > intakeMaxZ)) return [triangle]

  // Peel off the outside of each half-plane. The remainder is inside the convex throat.
  let rest: XZ[] = triangle
  const pieces: XZ[][] = []
  for (let edge = 0; edge < intakeCorners.length && rest.length >= 3; edge++) {
    const a = intakeCorners[edge]!
    const b = intakeCorners[(edge + 1) % intakeCorners.length]!
    const inside: XZ[] = []
    const outside: XZ[] = []
    for (let i = 0; i < rest.length; i++) {
      const p = rest[i]!
      const q = rest[(i + 1) % rest.length]!
      const d = cross(a, b, p)
      const e = cross(a, b, q)
      ;(d >= 0 ? inside : outside).push(p)
      if ((d > 0 && e < 0) || (d < 0 && e > 0)) {
        const t = d / (d - e)
        const intersection: XZ = [mix(p[0], q[0], t), mix(p[1], q[1], t)]
        inside.push(intersection)
        outside.push(intersection)
      }
    }
    if (outside.length >= 3) pieces.push(outside)
    rest = inside
  }
  return pieces
}

function refine(triangle: Triangle<XZ>, maxEdge: number, add: (face: Triangle<XZ>) => void): void {
  const rim: XZ[] = []
  for (let i = 0; i < 3; i++) {
    const a = triangle[i]!
    const b = triangle[(i + 1) % 3]!
    rim.push(a)
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) > maxEdge) {
      rim.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])
    }
  }
  if (rim.length === 3) {
    add(triangle)
    return
  }
  const [a, b, c] = triangle
  const center: XZ = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3]
  for (let i = 0; i < rim.length; i++) refine([rim[i]!, rim[(i + 1) % rim.length]!, center], maxEdge, add)
}

function landHeight(index: number, x: number, z: number, distance: number): number {
  const bank = index === 2 || index === 5 ? 0.59 : index === 1 ? 0.52 : 0.37
  const roll = Math.sin(x * 0.52 + z * 0.37) * Math.cos(z * 0.31 - x * 0.2)
  const lowland = SHORE_Y + (bank + roll * 0.08) * smooth(distance, 0, 1.35)
  if (index !== 0) return lowland

  const [mx, mz] = anchors.mountain
  const dx = x - mx
  const dz = z - mz
  const spur = (a: number, b: number, width: number, depth: number) =>
    Math.exp(-(((dx - a) / width) ** 2 + ((dz - b) / depth) ** 2))
  const ridge = 8.6 * spur(0, 0, 7.2, 6.7) + 3.7 * spur(5.7, -4.6, 5.2, 5.0) +
    2.4 * spur(4.6, 5.9, 5.0, 4.4)
  const folds = 1 + 0.12 * Math.sin(x * 1.31 + z * 0.58) + 0.09 * Math.cos(x * 0.32 - z * 1.16)
  return lowland + ridge * folds * smooth(distance, 0.25, 5.4)
}

const sand = new THREE.Color(0xb29c76)
const grass = new THREE.Color(0x859365)
const islandGrass = new THREE.Color(0x738757)
const jade = new THREE.Color(0x5d765c)
const rock = new THREE.Color(0x7c7964)

function surfaceColor(index: number, x: number, y: number, z: number, slope: number): THREE.Color {
  const shore = smooth(y, 0.08, 0.48)
  const variation = 1 + 0.08 * Math.sin(x * 1.6 + z * 2.1) + 0.04 * Math.sin(x * 4.1 - z * 1.7)
  const color = sand.clone().lerp(index === 2 || index === 5 ? islandGrass : grass, shore)
  color.lerp(jade, smooth(y, 0.8, 4.4))
  color.lerp(rock, smooth(slope, 0.38, 1.2) * smooth(y, 1.1, 4.5) * 0.73)
  return color.multiplyScalar(variation)
}

function buildRelief() {
  const positions: number[] = []
  const colors: number[] = []
  const cells = new Map<string, Triangle<Vertex>[]>()
  for (const [index, polygon] of mapLand.entries()) {
    const rings = [polygon.outer, ...polygon.holes]
    const footprint = polygonGeometry(polygon)
    const p = footprint.getAttribute('position')
    const indices = footprint.getIndex()!
    const sample = ([x, z]: XZ): Vertex => {
      let distance = boundaryDistance(x, z, rings)
      if (index === 0 && x >= intakeMinX - 5.4 && x <= intakeMaxX + 5.4 &&
          z >= intakeMinZ - 5.4 && z <= intakeMaxZ + 5.4) {
        distance = Math.min(distance, boundaryDistance(x, z, [intakeCorners]))
      }
      return [x, landHeight(index, x, z, distance), z]
    }
    const add = (face: Triangle<XZ>) => {
      const area = cross(...face)
      if (Math.abs(area) < 1e-8) return
      const [a, b, c] = face
      const triangle: Triangle<Vertex> = area < 0 ? [sample(a), sample(b), sample(c)] : [sample(a), sample(c), sample(b)]
      const [u, v, w] = triangle
      const rise = Math.max(u[1], v[1], w[1]) - Math.min(u[1], v[1], w[1])
      const run = Math.max(Math.hypot(u[0] - v[0], u[2] - v[2]), Math.hypot(u[0] - w[0], u[2] - w[2]),
        Math.hypot(v[0] - w[0], v[2] - w[2]))
      const color = surfaceColor(index, (u[0] + v[0] + w[0]) / 3, (u[1] + v[1] + w[1]) / 3,
        (u[2] + v[2] + w[2]) / 3, rise / run)
      for (const point of triangle) {
        positions.push(...point)
        colors.push(color.r, color.g, color.b)
      }
      for (let gx = cellOf(Math.min(u[0], v[0], w[0])); gx <= cellOf(Math.max(u[0], v[0], w[0])); gx++) {
        for (let gz = cellOf(Math.min(u[2], v[2], w[2])); gz <= cellOf(Math.max(u[2], v[2], w[2])); gz++) {
          const key = `${gx},${gz}`
          const cell = cells.get(key)
          if (cell) cell.push(triangle)
          else cells.set(key, [triangle])
        }
      }
    }
    for (let i = 0; i < indices.count; i += 3) {
      const point = (j: number): XZ => [p.getX(indices.getX(j)), p.getZ(indices.getX(j))]
      const face: Triangle<XZ> = [point(i), point(i + 1), point(i + 2)]
      const bankStrip = index === 1 || index === 2 || index === 5
      refine(face, bankStrip ? 2.1 : index === 0 ? 4.8 : 6, refined => {
        const pieces = index === 0 ? cutIntake(refined) : [refined]
        for (const piece of pieces) {
          for (let corner = 1; corner < piece.length - 1; corner++) add([piece[0]!, piece[corner]!, piece[corner + 1]!])
        }
      })
    }
    footprint.dispose()
  }
  return { positions: new Float32Array(positions), colors: new Float32Array(colors), cells }
}

const cellOf = (coord: number) => Math.floor(coord / CELL_SIZE)
let relief: ReturnType<typeof buildRelief> | undefined
const mapRelief = () => relief ??= buildRelief()

export function getTerrainHeight(x: number, z: number): number {
  let y = GROUND_Y
  for (const [a, b, c] of mapRelief().cells.get(`${cellOf(x)},${cellOf(z)}`) ?? []) {
    const origin: XZ = [a[0], a[2]]
    const u: XZ = [b[0], b[2]]
    const v: XZ = [c[0], c[2]]
    const q: XZ = [x, z]
    const area = cross(origin, u, v)
    const s = cross(origin, q, v) / area
    const t = cross(origin, u, q) / area
    if (s >= -1e-8 && t >= -1e-8 && s + t <= 1 + 1e-8) {
      y = Math.max(y, a[1] + s * (b[1] - a[1]) + t * (c[1] - a[1]))
    }
  }
  return y
}

/**
 * 没有被工程切开的原生地表高度（只算玉垒山那一片）。
 *
 * `getTerrainHeight` 读的是已经开凿过的地形：峡口那一段根本没有三角形，回到 `GROUND_Y`。
 * 宝瓶口岩塞要长成「山嘴」，顶面必须取这条没被凿断的脊线，否则它会贴在槽底、变成一道矮埂。
 */
export function getRidgeHeight(x: number, z: number): number {
  const ridge = mapLand[0]
  if (!ridge) return GROUND_Y
  return landHeight(0, x, z, boundaryDistance(x, z, [ridge.outer, ...ridge.holes]))
}

export function createMapTerrain(): THREE.Group {  const { positions, colors } = mapRelief()
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'Mapped land and Yulei ridge'
  mesh.castShadow = true
  mesh.receiveShadow = true
  const group = new THREE.Group()
  group.name = 'Dujiangyan terrain'
  group.add(mesh)
  return group
}
