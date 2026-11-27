import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createSealNose } from './dujiangyan-seal'

const height = (x: number, z: number) => 4 + 0.3 * z + 0.4 * Math.sin(x * 0.6)

function create() {
  return createSealNose({
    start: { x: 0, z: 0 },
    end: { x: 6, z: 0 },
    sampleHeight: height,
    halfWidth: 1,
    acrossColumns: 6,
  })
}

function positions(mesh: THREE.Mesh): THREE.BufferAttribute {
  return mesh.geometry.getAttribute('position') as THREE.BufferAttribute
}

describe('Dujiangyan rock nose', () => {
  it('cuts the throat into five slabs that meet edge to edge', () => {
    const seal = create()
    expect(seal.slabs).toHaveLength(5)
    expect(seal.group.getObjectByName('rock-nose-slab-0')).toBeInstanceOf(THREE.Mesh)
    expect(seal.group.getObjectByName('rock-nose-slab-4')).toBeInstanceOf(THREE.Mesh)

    const boxes = seal.slabs.map(slab => new THREE.Box3().setFromBufferAttribute(positions(slab.mesh)))
    for (let index = 1; index < boxes.length; index++) {
      // 相邻两片在同一条切面上收边：前一片的 max.x 与后一片的 min.x 应当重合。
      expect(boxes[index]!.min.x).toBeCloseTo(boxes[index - 1]!.max.x, 5)
    }
    expect(boxes[0]!.min.x).toBeLessThan(0)
    expect(boxes[4]!.max.x).toBeGreaterThan(6)
  })

  it('meets the cut mountain walls at their own height and keeps the crest between them', () => {
    const seal = create()
    const all = new THREE.Box3()
    for (const slab of seal.slabs) all.union(new THREE.Box3().setFromBufferAttribute(positions(slab.mesh)))
    // 底裙埋在地面以下，顶面不超过两侧山壁。
    expect(all.min.y).toBeCloseTo(-1.15, 5)
    for (const slab of seal.slabs) {
      const attribute = positions(slab.mesh)
      for (let index = 0; index < attribute.count; index++) {
        const x = attribute.getX(index)
        const y = attribute.getY(index)
        const z = attribute.getZ(index)
        // 落在峡口切槽之外的顶点（rim 列）必须贴在原始地形上，误差只允许 0.02 的埋入量。
        if (Math.abs(z) > 1.2 * 1.02 - 1e-6 && y > -1) {
          expect(Math.abs(y - (height(x, z) - 0.02))).toBeLessThan(0.03)
        }
      }
    }
  })

  it('raises a ridge through the middle of the throat instead of leaving a flat bridge', () => {
    const seal = create()
    const first = seal.slabs[0]!
    const attribute = positions(first.mesh)
    let crest = -Infinity
    let crestZ = 0
    for (let index = 0; index < attribute.count; index++) {
      if (attribute.getY(index) < -0.5) continue
      const z = attribute.getZ(index)
      if (Math.abs(z) < 0.2 && attribute.getY(index) > crest) {
        crest = attribute.getY(index)
        crestZ = z
      }
    }
    expect(Math.abs(crestZ)).toBeLessThan(0.2)
    const left = height(0.3, -1.02 * 1.22)
    const right = height(0.3, 1.02 * 1.22)
    // 中央的拱必须高过两侧山壁（否则就是一座平桥），但也不能拱成一座塔。
    expect(crest).toBeGreaterThan(Math.max(left, right))
    expect(crest).toBeLessThan(Math.max(left, right) + 1.3)
  })

  it('opens real joints when cracked and lets every slab fall forward when peeled', () => {
    const seal = create()
    const home = seal.slabs.map(slab => slab.mesh.position.clone())
    expect(seal.fissures.visible).toBe(false)

    seal.setCrack(1)
    expect(seal.fissures.visible).toBe(true)
    expect(seal.slabs[4]!.mesh.position.length()).toBeGreaterThan(seal.slabs[0]!.mesh.position.length())
    // 迎水侧是 -x，裂开时岩片朝这一侧外错。
    expect(seal.slabs[0]!.mesh.position.x).toBeLessThan(0)

    seal.setCrack(0)
    for (const [index, slab] of seal.slabs.entries()) {
      expect(slab.mesh.position.distanceTo(home[index]!)).toBeLessThan(1e-6)
    }
    expect(seal.fissures.visible).toBe(false)

    seal.peel(0, 1)
    expect(seal.slabs[0]!.mesh.position.y).toBeLessThan(-1.5)
    expect(seal.slabs[0]!.mesh.position.x).toBeLessThan(-1)
    expect(Math.abs(seal.slabs[0]!.mesh.rotation.x) + Math.abs(seal.slabs[0]!.mesh.rotation.z)).toBeGreaterThan(0.05)
    expect(seal.slabs[1]!.mesh.position.y).toBe(0)

    seal.reset()
    for (const [index, slab] of seal.slabs.entries()) {
      expect(slab.mesh.position.distanceTo(home[index]!)).toBeLessThan(1e-6)
      const rotation = slab.mesh.rotation
      expect(Math.abs(rotation.x) + Math.abs(rotation.y) + Math.abs(rotation.z)).toBeLessThan(1e-6)
    }
  })

  it('keeps the joints inside the rock face so they never float in the air', () => {
    const seal = create()
    const fissure = seal.fissures.getObjectByName('joint-crack') as THREE.Mesh
    const attribute = positions(fissure)
    expect(attribute.count).toBe(6 * 6)
    // 岩面本身的高程：取各片顶面在同一 x 上的最大值，缝顶不得超过它。
    const crestAt = (x: number) => {
      let crest = -Infinity
      for (const slab of seal.slabs) {
        const slabAttribute = positions(slab.mesh)
        for (let index = 0; index < slabAttribute.count; index++) {
          if (Math.abs(slabAttribute.getX(index) - x) < 0.45 && slabAttribute.getY(index) > crest) {
            crest = slabAttribute.getY(index)
          }
        }
      }
      return crest
    }
    for (let index = 0; index < attribute.count; index++) {
      const x = attribute.getX(index)
      const z = attribute.getZ(index)
      const y = attribute.getY(index)
      // 缝贴在峡口内侧的岩面上：横向不出切槽，纵向不低于地面、不冲出岩面。
      expect(Math.abs(z)).toBeLessThan(1.1)
      expect(x).toBeGreaterThan(-1)
      expect(x).toBeLessThan(7)
      expect(y).toBeGreaterThan(-0.1)
      expect(y).toBeLessThan(crestAt(x) + 0.06)
    }
  })
})
