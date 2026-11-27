import { describe, expect, it } from 'vitest'
import { Mesh, Raycaster, Vector3 } from 'three'
import { anchors } from './dujiangyan-geography'
import { createMapTerrain, getTerrainHeight } from './dujiangyan-terrain'

function surface() {
  const terrain = createMapTerrain()
  terrain.updateMatrixWorld(true)
  return (x: number, z: number) => new Raycaster(
    new Vector3(x, 30, z), new Vector3(0, -1, 0),
  ).intersectObject(terrain)[0]?.point.y
}

describe('Dujiangyan terrain', () => {
  it('renders representative ground from all nine mapped polygons', () => {
    const y = surface()
    const points = [
      [21, 7.8], [-10, 14], [0.78, -8.1], [36, 17], [-49, -48],
      [10.3, 17.5], [20, 46], [8, 43], [27, 40.8],
    ] as const
    for (const [x, z] of points) expect(y(x, z), `land at ${x}, ${z}`).toBeGreaterThan(-0.04)
  })

  it('keeps mapped holes, river branches, and the historical intake open', () => {
    const y = surface()
    const points = [
      [-2, 0], [7, 0], anchors.gap, [18.1, 18.6],
      [42.539, -8.326], [-7.9, 34.86], [-0.98, -11.92],
    ] as const
    for (const [x, z] of points) {
      expect(y(x, z), `opening at ${x}, ${z}`).toBeUndefined()
      expect(getTerrainHeight(x, z)).toBe(-0.04)
    }
  })

  it('rises into a faceted eastern ridge and keeps island and west banks low', () => {
    const y = surface()
    const summit = y(...anchors.mountain)!
    expect(summit).toBeGreaterThan(6)
    expect(summit - y(12, 8)!).toBeGreaterThan(3)
    expect(Math.abs(summit - y(24, 9)!)).toBeGreaterThan(0.4)
    expect(y(...anchors.isle)).toBeGreaterThan(0.15)
    expect(y(...anchors.isle)).toBeLessThan(1)
    expect(y(-10, 14)).toBeGreaterThan(0.15)
    expect(y(-10, 14)).toBeLessThan(1)
  })

  it('returns the actual rendered triangle height and batches relief into one draw mesh', () => {
    const y = surface()
    for (const [x, z] of [[21, 7.8], [17, 15], [25, 10], [-10, 14], [10.3, 17.5]] as const) {
      expect(getTerrainHeight(x, z)).toBeCloseTo(y(x, z)!, 5)
    }
    const meshes: Mesh[] = []
    createMapTerrain().traverse(object => { if (object instanceof Mesh) meshes.push(object) })
    expect(meshes).toHaveLength(1)
    const position = meshes[0]!.geometry.getAttribute('position')
    expect(meshes[0]!.geometry.getAttribute('color').count).toBe(position.count)
    expect(position.count / 3).toBeLessThan(30_000)
  })
})
