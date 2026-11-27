import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createGabion, createMacha, createFireBed, createWeirGabionCourse } from './dujiangyan-structures'

function bounds(object: THREE.Object3D) {
  return new THREE.Box3().setFromObject(object)
}

function part(group: THREE.Group, name: string): THREE.Object3D {
  const object = group.getObjectByName(name)
  expect(object, `missing ${name}`).toBeDefined()
  return object!
}

function meshInstances(group: THREE.Group, name: string) {
  const object = part(group, name)
  expect(object).toBeInstanceOf(THREE.InstancedMesh)
  return object as THREE.InstancedMesh
}

describe('Dujiangyan construction models', () => {
  it('builds a centered, X-aligned gabion with open bamboo weave and separately modeled cobbles', () => {
    const gabion = createGabion()
    const box = bounds(gabion)
    const size = box.getSize(new THREE.Vector3())
    expect(size.x).toBeCloseTo(2.5, 1)
    expect(size.y).toBeCloseTo(1.04, 1)
    expect(size.z).toBeCloseTo(1.04, 1)
    expect(box.getCenter(new THREE.Vector3()).length()).toBeLessThan(0.025)

    const bamboo = part(gabion, 'gabion-weave')
    const cobbles = meshInstances(gabion, 'gabion-cobbles')
    expect(cobbles.count).toBeGreaterThan(20)
    expect(bounds(cobbles).max.y).toBeLessThan(bounds(bamboo).max.y)
    expect(bounds(cobbles).max.y).toBeGreaterThan(0.40)
  })

  it('builds two upstream wooden legs and one downstream leg meeting near the lashed apex', () => {
    const macha = createMacha()
    const poles = meshInstances(macha, 'macha-poles')
    const matrix = new THREE.Matrix4()
    const feet = []
    expect(poles.count).toBe(3)
    for (let i = 0; i < poles.count; i++) {
      poles.getMatrixAt(i, matrix)
      feet.push(new THREE.Vector3(0, -0.5, 0).applyMatrix4(matrix))
      const tip = new THREE.Vector3(0, 0.5, 0).applyMatrix4(matrix)
      expect(tip.distanceTo(new THREE.Vector3(-0.05, 2.1, 0))).toBeLessThan(0.16)
    }
    expect(feet.filter(foot => foot.x < 0)).toHaveLength(2)
    expect(feet.filter(foot => foot.x > 0)).toHaveLength(1)
    expect(feet.every(foot => Math.abs(foot.y) < 0.1)).toBe(true)
    expect(bounds(part(macha, 'macha-apex-lashings')).min.y).toBeGreaterThan(1.6)
    expect(bounds(part(macha, 'macha-upstream-mat')).max.x).toBeLessThan(-0.2)
    expect(bounds(part(macha, 'macha-ballast-stones')).min.y).toBeGreaterThan(0.75)
  })

  it('supports the fire with three stones and two compact courses of stacked logs', () => {
    const bed = createFireBed()
    const box = bounds(bed)
    expect(box.min.y).toBeCloseTo(0, 1)
    expect(box.max.y).toBeLessThan(0.37)
    expect(meshInstances(bed, 'fire-hearth-stones').count).toBe(3)
    const logs = meshInstances(bed, 'fire-stacked-logs')
    const heights = new Set<number>()
    for (let i = 0; i < logs.count; i++) {
      const matrix = new THREE.Matrix4()
      logs.getMatrixAt(i, matrix)
      heights.add(new THREE.Vector3().setFromMatrixPosition(matrix).y)
    }
    expect(heights.size).toBe(2)
  })

  it('builds a six-unit course of three cages with a ground-level pivot and unit height', () => {
    const course = createWeirGabionCourse()
    const box = bounds(course)
    const size = box.getSize(new THREE.Vector3())
    expect(course.children).toHaveLength(3)
    expect(box.min.y).toBeCloseTo(0, 2)
    expect(size.y).toBeCloseTo(1, 2)
    expect(size.x).toBeCloseTo(6, 1)
    expect(size.z).toBeCloseTo(1.2, 2)
  })

  it('shares geometry while leaving independent transforms for staged animation', () => {
    const first = createGabion()
    const second = createGabion()
    first.position.x = 5
    expect(second.position.x).toBe(0)
    expect(meshInstances(first, 'gabion-cobbles').geometry)
      .toBe(meshInstances(second, 'gabion-cobbles').geometry)
  })
})
