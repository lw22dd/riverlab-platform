import { describe, expect, it } from 'vitest'
import { Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three'
import { anchors, frames, inFrame, mapWater, polygonGeometry, toWorld, waterways } from './dujiangyan-geography'

const hit = (mesh: Mesh, x: number, z: number) =>
  new Raycaster(new Vector3(x, 10, z), new Vector3(0, -1, 0)).intersectObject(mesh).length > 0

describe('Dujiangyan map registration', () => {
  it('keeps east to the right and north toward negative Z', () => {
    expect(toWorld([7, 12])).toEqual([7, -12])
    expect(anchors.gap).toEqual([16.151, 16.97])
    expect(anchors.fishmouth[1]).toBeLessThan(anchors.weir[1])
    expect(anchors.weir[0]).toBeLessThan(anchors.gap[0])
  })

  it('places the legacy props at their geographic construction anchors', () => {
    expect(inFrame(frames.gap, [14.5, 11.8])).toEqual(anchors.gap)
    expect(inFrame(frames.weir, [27, 3.2])).toEqual(anchors.weir)
    expect(inFrame(frames.maintenance, [38, 6])).toEqual(anchors.macha)
  })

  it('retains the outer river, leaves the island dry, and isolates the inner surface', () => {
    const outer = new Mesh(polygonGeometry(mapWater.outer), new MeshBasicMaterial())
    const inner = new Mesh(polygonGeometry(mapWater.inner), new MeshBasicMaterial())
    expect(hit(outer, -5, 0)).toBe(false)
    expect(hit(outer, -2, 0)).toBe(true)
    expect(hit(inner, 7, 0)).toBe(true)
    expect(hit(outer, 7, 0)).toBe(false)
    expect(hit(inner, 7, 20)).toBe(false)
    expect(waterways.outlet.path[0]).toEqual(anchors.gap)
  })
})
