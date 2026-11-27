import * as THREE from 'three'
import source from '../../assets/geography/dujiangyan_map.json'

export type XZ = [number, number]
export interface Polygon { outer: XZ[]; holes: XZ[][] }
export interface Frame { origin: XZ; anchor: XZ; yaw: number; scale: number }

export function toWorld([x, north]: readonly number[]): XZ {
  return [x!, -north!]
}

export function inFrame({ origin, anchor, yaw, scale }: Frame, [x, z]: XZ): XZ {
  const dx = (x - origin[0]) * scale
  const dz = (z - origin[1]) * scale
  return [anchor[0] + dx * Math.cos(yaw) + dz * Math.sin(yaw), anchor[1] - dx * Math.sin(yaw) + dz * Math.cos(yaw)]
}

function mapped(ring: number[][]): XZ[] { return ring.map(toWorld) }
function polygon(p: { outer_plan: number[][]; holes_plan: number[][][] }): Polygon {
  return { outer: mapped(p.outer_plan), holes: p.holes_plan.map(mapped) }
}

const main = polygon(source.layers.water[0]!)
const shore = main.outer
// Split the undivided guide-map water at the nose and the spill gap so each branch can have its own stage.
// Vertices 84–102 are broken by modern guide-map markers; the historical mouth is bridged separately.
export const mapWater = {
  outer: { outer: [...shore.slice(0, 62), ...shore.slice(128, 140), ...shore.slice(143)], holes: main.holes },
  inner: { outer: [...shore.slice(103, 114).reverse(), shore[101]!, shore[74]!, ...shore.slice(61, 64).reverse(), ...shore.slice(128, 140), shore[143]!], holes: [] },
  side: source.layers.water.filter(({ id }) => ['water_02', 'water_06', 'water_08', 'water_09'].includes(id)).map(polygon),
} satisfies { outer: Polygon; inner: Polygon; side: Polygon[] }

export const mapLand = source.layers.mountain.map(polygon)
export const anchors = {
  gap: toWorld(source.poi.find(({ name }) => name === '宝瓶口')!.plan),
  fishmouth: shore[139]!,
  weir: [4.45, 17.25] as XZ,
  macha: [0.78, -8.1] as XZ,
  dredge: [7.15, 5.5] as XZ,
  isle: [10.3, 17.5] as XZ,
  mountain: [21, 7.8] as XZ,
  plain: [38, 40] as XZ,
  minjiang: [-28, -41] as XZ,
}

export const frames = {
  gap: { origin: [14.5, 11.8], anchor: anchors.gap, yaw: 0.92, scale: 0.43 },
  fishmouth: { origin: [-10.5, 0], anchor: anchors.fishmouth, yaw: -1.04, scale: 0.78 },
  weir: { origin: [27, 3.2], anchor: anchors.weir, yaw: -1.47, scale: 0.72 },
  maintenance: { origin: [38, 6], anchor: anchors.macha, yaw: -1.18, scale: 0.72 },
  dredge: { origin: [42, 6], anchor: anchors.dredge, yaw: -1.1, scale: 0.6 },
} satisfies Record<string, Frame>

export function polygonGeometry({ outer, holes }: Polygon): THREE.ShapeGeometry {
  const ring = (points: XZ[]) => points.map(([x, z]) => new THREE.Vector2(x, -z))
  const shape = new THREE.Shape(ring(outer))
  shape.holes = holes.map(points => new THREE.Path(ring(points)))
  return new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2) as THREE.ShapeGeometry
}

function ringContains(ring: XZ[], x: number, z: number): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [a, b] = ring[i]!
    const [c, d] = ring[j]!
    if ((b > z) !== (d > z) && x < (c - a) * (z - b) / (d - b) + a) inside = !inside
  }
  return inside
}

export function contains(p: Polygon, x: number, z: number): boolean {
  return ringContains(p.outer, x, z) && !p.holes.some(ring => ringContains(ring, x, z))
}

type Route = { path: XZ[]; widths: number[] }
export const waterways = {
  upstream: { path: [[-44,-51],[-35,-44],[-25,-36],[-18,-29],[-13.3,-27]], widths: [7,8,9,9,7] },
  inner: { path: [[-12,-27],[-6,-23],[-1.3,-16],[2.8,-9],[6.4,-3],[7.6,3],[7.3,8],[7.9,12.5],[10.2,15],[13.7,16.7],anchors.gap], widths: [4,5,5,4,3.6,3.4,3.4,3.3,4,2.5,1] },
  outer: { path: [[-14,-27],[-16,-22],[-13,-14],[-8,-5],[-4,5],[-4.8,12],[-5.3,20],[-5.4,29],[-3,39],[0,50]], widths: [6,7,7,7,7,9,11,9,6,6] },
  outlet: { path: [anchors.gap,[20,20.2],[25,24.5],[31,27.8],[39,30.5],[49,33],[59,38]], widths: [1,1.8,2.4,2.2,2.4,2.4,2] },
  canals: [
    { path: [[31,27.8],[33,34],[37,43],[39,55]], widths: [1.8,1.5,1.2,1.1] },
    { path: [[39,30.5],[45,37],[51,47],[58,56]], widths: [1.8,1.5,1.3,1.1] },
  ],
} satisfies Record<'upstream' | 'inner' | 'outer' | 'outlet', Route> & { canals: Route[] }
