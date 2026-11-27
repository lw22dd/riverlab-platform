import * as THREE from 'three'

/**
 * 玉垒山嘴：宝瓶口未开凿前封住峡口的那一道连续岩体。
 *
 * 参考件（tmp/reference-case/497663211.html）里它是「填满 V 形槽的实心岩塞」：顶面直接取未凿时的
 * 山脊解析面，所以和两侧山体严丝合缝。应用里的地形是地图多边形 + 分形高地，峡口是被
 * `cutIntake()` 真的切开的（没有「未凿解析面」可查），因此这里改用等价做法：
 * 在峡口两侧的原生山坡上各取一个高程，用一条带拱度的曲面把两壁连起来——顶面在最外一列
 * 回落到地形等高、峡口中央微微隆起成山脊，于是岩塞与山体读作同一座山，而不是插了一块方石。
 *
 * 岩塞沿峡口轴向切成若干片（slabs），互不重叠、共用边界顶点：未凿时拼成整块岩体；
 * `setCrack()` 让各片沿法向外错开一点点、缝隙里露出深色岩芯与余烬；
 * 凿通时逐片外倾下落（`peel`），露出地形本身已经切好的峡口。
 */

export interface XZ {
  x: number
  z: number
}

export interface SealNoseOptions {
  /** 峡口轴向：start 是迎水一侧（内江来水），end 是下游出峡一侧。 */
  start: XZ
  end: XZ
  /** 该点地形高程（世界坐标）。用来取两壁 rim 与把岩塞外缘埋回山体。 */
  sampleHeight: (x: number, z: number) => number
  /** 峡口半宽（沿 across 方向）。 */
  halfWidth?: number
  /**
   * 山嘴在峡口中央抬起的高度。
   *
   * 默认 0 时岩塞只比原生地表高一点点——这只在「两侧本来就是高耸山壁」的地形里成立。
   * 本项目的地图里玉垒山到宝瓶口只剩一段矮坡，照抄原生地表会变成一道几乎看不见的矮埂，
   * 所以要显式给一个抬升值，让它读作横在江心、把水堵死的山嘴。
   */
  crestLift?: number
  /** 岩塞沿轴向覆盖范围：默认略超出峡口切槽两端，保证切口被埋住。 */
  extendStart?: number
  extendEnd?: number
  /** 轴向切片数。 */
  slabs?: number
  /** 每片沿轴向的列数。 */
  columnsPerSlab?: number
  /** 沿 across 方向的采样列数（偶数，保证中线落在两列之间）。 */
  acrossColumns?: number
  /** 岩塞底标高（要低于河床，靠地形遮挡底裙）。 */
  bottom?: number
  /** 火塘中心（世界坐标），用于崖根炙烤的衰减。 */
  heatCenter?: THREE.Vector3
  /** 岩面基色，与地形山脊同一族颜色。 */
  colors?: { lo: THREE.ColorRepresentation; mid: THREE.ColorRepresentation; hi: THREE.ColorRepresentation }
}

export interface SealSlab {
  mesh: THREE.Mesh
  /** 外倾旋转支点：该片迎水侧底部的中点（世界坐标）。 */
  pivot: THREE.Vector3
  /** 外倾方向水平单位向量（朝内江一侧）。 */
  outward: THREE.Vector3
  /** 轴向序号，越小越先被撬落。 */
  order: number
}

export interface SealNose {
  group: THREE.Group
  slabs: SealSlab[]
  /** 节理缝（深色窄带 + 余烬芯）。 */
  fissures: THREE.Group
  /** 峡口内壁：岩塞被凿掉之后露出的 V 形槽壁，始终可见。 */
  lining: THREE.Group
  /** 0 = 未凿整块，1 = 节理全开。 */
  setCrack(value: number): void
  /** 崖根炙烤强度 0–1：越烤缝里越红。 */
  setHeat(value: number): void
  /** 熏黑程度 0–1（浇水后热度退了、焦痕还在）。 */
  setChar(value: number): void
  /** 该片的外倾位移 0–1（凿通时逐片用）。 */
  peel(index: number, amount: number): void
  /** 恢复未凿状态。 */
  reset(): void
  dispose(): void
}

const smooth01 = (x: number) => {
  const t = THREE.MathUtils.clamp(x, 0, 1)
  return t * t * (3 - 2 * t)
}

/** 稳定伪随机：同一份构建每次都一样，便于测试断言。 */
function hash(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
  return s - Math.floor(s)
}

export function createSealNose(options: SealNoseOptions): SealNose {
  const {
    start,
    end,
    sampleHeight,
    halfWidth = 1.02,
    crestLift = 0,
    extendStart = 0.7,
    extendEnd = 0.7,
    slabs: slabCount = 5,
    columnsPerSlab = 3,
    acrossColumns = 6,
    bottom = -1.15,
    heatCenter = new THREE.Vector3(start.x, 1.2, start.z),
    colors: palette,
  } = options

  const colorLo = new THREE.Color(palette?.lo ?? 0x6f6b57)
  const colorMid = new THREE.Color(palette?.mid ?? 0x7c7861)
  const colorHi = new THREE.Color(palette?.hi ?? 0x8a9068)

  const axis = new THREE.Vector3(end.x - start.x, 0, end.z - start.z)
  const length = axis.length()
  axis.normalize()
  const across = new THREE.Vector3(-axis.z, 0, axis.x)
  /** 迎水侧（-axis 方向）朝内江：岩片朝这一侧倒。 */
  const outward = axis.clone().multiplyScalar(-1)

  const s0 = -extendStart
  const s1 = length + extendEnd
  const totalColumns = slabCount * columnsPerSlab
  const cols = acrossColumns
  /** 最外一列贴到峡口切槽之外 0.22 倍半宽，正好落在被切开之前的山壁上。 */
  const rimScale = 1.22

  const station = (s: number, t: number): { x: number; z: number } => {
    const offset = t * halfWidth * rimScale
    return {
      x: start.x + axis.x * s + across.x * offset,
      z: start.z + axis.z * s + across.z * offset,
    }
  }

  /** 顶面高程：两壁 rim 之间平滑插值 + 中部拱度，读作被水切开的山嘴。 */
  const surfaceAt = (s: number, t: number): number => {
    const left = sampleHeight(station(s, -1).x, station(s, -1).z)
    const right = sampleHeight(station(s, 1).x, station(s, 1).z)
    const ridge = THREE.MathUtils.lerp(left, right, smooth01((t + 1) * 0.5))
    const lateral = Math.max(0, 1 - Math.abs(t) ** 1.6)
    // 沿轴两端收敛到原生地表，否则山嘴会在峡口上下游各留下一道断崖。
    const taper = Math.min(1, Math.min(s / Math.max(0.001, length * 0.22), (length - s) / Math.max(0.001, length * 0.22)))
    const bump = (0.22 + 0.16 * Math.min(left, right)) * lateral
    const lift = crestLift * Math.max(0, Math.min(1, taper)) * lateral
    return ridge + bump + lift
  }

  const grid: Array<Array<{ x: number; y: number; z: number; rim: boolean }>> = []
  for (let column = 0; column <= totalColumns; column++) {
    const s = THREE.MathUtils.lerp(s0, s1, column / totalColumns)
    const row: Array<{ x: number; y: number; z: number; rim: boolean }> = []
    for (let j = 0; j <= cols; j++) {
      const t = -1 + (2 * j) / cols
      const point = station(s, t)
      const rim = j === 0 || j === cols
      // 最外一列回落到地形（-0.02 埋进去一点），保证与山壁无缝；内侧用山脊曲面。
      const y = rim
        ? sampleHeight(point.x, point.z) - 0.02
        : surfaceAt(s, t)
      row.push({ x: point.x, y, z: point.z, rim })
    }
    grid.push(row)
  }

  // 顶点色按「整座山嘴自身的高差」归一：谷底取岩石色，脊线顶端过渡到草色。
  let colorLow = Infinity
  let colorHigh = -Infinity
  for (const row of grid) {
    for (const point of row) {
      colorLow = Math.min(colorLow, point.y)
      colorHigh = Math.max(colorHigh, point.y)
    }
  }

  const group = new THREE.Group()
  group.name = 'Baopingkou rock nose'

  const heatUniform = { value: 0 }
  const charUniform = { value: 0 }
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.97,
    metalness: 0,
    flatShading: true,
  })
  material.name = 'rock-nose'
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uHeat = heatUniform
    shader.uniforms.uChar = charUniform
    shader.uniforms.uHeatCenter = { value: heatCenter }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n  varying vec3 vSealWorld;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n  vSealWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uHeat;
        uniform float uChar;
        uniform vec3 uHeatCenter;
        varying vec3 vSealWorld;`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float sealDistance = length(vSealWorld.xz - uHeatCenter.xz);
        float scorch = (1.0 - smoothstep(0.9, 5.4, sealDistance))
                     * (1.0 - smoothstep(0.7, 4.2, vSealWorld.y))
                     * smoothstep(-0.6, 0.5, vSealWorld.y);
        float grain = fract(sin(dot(floor(vSealWorld * 3.1), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        float mottle = 0.45 + 1.05 * grain;
        float charAmount = clamp(scorch * (0.30 + uChar * 0.95) * mottle, 0.0, 0.92);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.16, 0.13, 0.11), charAmount);
        totalEmissiveRadiance += vec3(1.0, 0.34, 0.08) * (uHeat * scorch * mottle * 0.85);`,
      )
  }

  const slabs: SealSlab[] = []

  for (let slabIndex = 0; slabIndex < slabCount; slabIndex++) {
    const positions: number[] = []
    const vertexColors: number[] = []
    const columnFrom = slabIndex * columnsPerSlab
    const columnTo = columnFrom + columnsPerSlab

    const point = (column: number, j: number): THREE.Vector3 => {
      const p = grid[column]![j]!
      return new THREE.Vector3(p.x, p.y, p.z)
    }

    const addQuad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, hint: THREE.Vector3, rim: boolean) => {
      const normal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a))
      const [v0, v1, v2, v3] = normal.dot(hint) < 0 ? [a, d, c, b] : [a, b, c, d]
      for (const [p, q, r] of [[v0, v1, v2], [v0, v2, v3]] as const) {
        for (const vertex of [p, q, r]) {
          positions.push(vertex.x, vertex.y, vertex.z)
          const grain = hash(vertex.x * 0.7 + slabIndex * 3.1, vertex.z * 0.9 - 1.7)
          // 按岩塞自身的高差上色：不同场景里山嘴的高度差几倍，写死 1.4~5.6 会让矮的岩体整片压在基色上。
          const height = smooth01((vertex.y - colorLow) / Math.max(0.5, colorHigh - colorLow))
          const color = colorLo.clone().lerp(colorMid, 0.55).lerp(colorHi, height * 0.85)
          if (rim) color.multiplyScalar(0.9)
          color.multiplyScalar(0.9 + grain * 0.22)
          vertexColors.push(color.r, color.g, color.b)
        }
      }
    }

    // 顶面（两三角一格的四边形带）
    for (let column = columnFrom; column < columnTo; column++) {
      for (let j = 0; j < cols; j++) {
        const rim = grid[column]![j]!.rim || grid[column]![j + 1]!.rim
        addQuad(point(column, j), point(column + 1, j), point(column + 1, j + 1), point(column, j + 1),
          new THREE.Vector3(0, 1, 0), rim)
      }
    }

    // 两长边裙边：从顶面沿 j 的外缘竖直落到 bottom（埋进地形）
    for (const [jEdge, side] of [[0, -1], [cols, 1]] as const) {
      for (let column = columnFrom; column < columnTo; column++) {
        const a = point(column, jEdge)
        const b = point(column + 1, jEdge)
        const aLow = new THREE.Vector3(a.x, bottom, a.z)
        const bLow = new THREE.Vector3(b.x, bottom, b.z)
        addQuad(a, b, bLow, aLow, across.clone().multiplyScalar(side), true)
      }
    }

    // 两端口面：切片之间共用同一列顶点，合起来严丝合缝
    for (const [column, side] of [[columnFrom, -1], [columnTo, 1]] as const) {
      for (let j = 0; j < cols; j++) {
        const a = point(column, j)
        const b = point(column, j + 1)
        const aLow = new THREE.Vector3(a.x, bottom, a.z)
        const bLow = new THREE.Vector3(b.x, bottom, b.z)
        addQuad(a, b, bLow, aLow, axis.clone().multiplyScalar(side), true)
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(vertexColors, 3))
    geometry.computeVertexNormals()

    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = `rock-nose-slab-${slabIndex}`
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)

    const pivotColumn = columnFrom + Math.max(1, Math.floor(columnsPerSlab / 2))
    const pivotPoint = grid[pivotColumn]![0]!
    slabs.push({
      mesh,
      pivot: new THREE.Vector3(pivotPoint.x, bottom + 0.2, pivotPoint.z),
      outward: outward.clone(),
      order: slabIndex,
    })
  }

  // 峡口内壁：地形是用多边形三角化出来的高度场，`cutIntake()` 切开峡口后那一段只剩一个洞，
  // 没有竖直的槽壁。岩塞在的时候看不出来（它把洞堵住了），一旦逐片撬落就必须有东西露出来——
  // 所以这里顺手做出 V 形槽壁，始终可见，凿通后看到的就是它。
  const liningPositions: number[] = []
  const liningColors: number[] = []
  const bedY = bottom + 1.05
  const pushLining = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, hint: THREE.Vector3) => {
    const normal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a))
    const [v0, v1, v2, v3] = normal.dot(hint) < 0 ? [a, d, c, b] : [a, b, c, d]
    for (const [p, q, r] of [[v0, v1, v2], [v0, v2, v3]] as const) {
      for (const vertex of [p, q, r]) {
        liningPositions.push(vertex.x, vertex.y, vertex.z)
        const grain = hash(vertex.x * 1.7, vertex.z * 1.3)
        const color = colorLo.clone().multiplyScalar(0.72 + grain * 0.2)
        liningColors.push(color.r, color.g, color.b)
      }
    }
  }
  for (const side of [-1, 1] as const) {
    for (let column = 0; column < totalColumns; column++) {
      const rimA = grid[column]![side < 0 ? 0 : cols]!
      const rimB = grid[column + 1]![side < 0 ? 0 : cols]!
      const bedA = station(THREE.MathUtils.lerp(s0, s1, column / totalColumns), side * 0.42)
      const bedB = station(THREE.MathUtils.lerp(s0, s1, (column + 1) / totalColumns), side * 0.42)
      pushLining(
        new THREE.Vector3(rimA.x, rimA.y, rimA.z),
        new THREE.Vector3(rimB.x, rimB.y, rimB.z),
        new THREE.Vector3(bedB.x, bedY, bedB.z),
        new THREE.Vector3(bedA.x, bedY, bedA.z),
        new THREE.Vector3(-across.x * side, 0.35, -across.z * side),
      )
    }
  }
  const lining = new THREE.Group()
  lining.name = 'Baopingkou throat'
  {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(liningPositions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(liningColors, 3))
    geometry.computeVertexNormals()
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = 'throat-lining'
    mesh.receiveShadow = true
    lining.add(mesh)
  }
  group.add(lining)

  // 节理缝：贴迎水崖面的深色窄带 + 内侧余烬芯
  const fissures = new THREE.Group()
  fissures.name = 'Baopingkou joints'
  // 未凿时装态不画缝：缝只用来表现「裂开了」，开凿前整块山嘴必须是连续的。
  fissures.visible = false
  const crackMaterial = new THREE.MeshBasicMaterial({ color: 0x1b1512, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })
  const emberMaterial = new THREE.MeshBasicMaterial({ color: 0xff6a1e, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
  const crackPositions: number[] = []
  const emberPositions: number[] = []
  const stations = [0.14, 0.27, 0.4, 0.54, 0.67, 0.8]
  for (const [index, fraction] of stations.entries()) {
    const s = THREE.MathUtils.lerp(s0, s1, fraction)
    const t = -0.58 + ((index * 0.37) % 1) * 0.85
    const top = station(s, t)
    const topY = surfaceAt(s, t)
    const lowY = Math.max(0.02, topY - 2.8 - index * 0.16)
    const halfLength = (0.07 + 0.04 * (index % 3))
    const push = (target: number[]) => {
      const dx = axis.x * halfLength
      const dz = axis.z * halfLength
      target.push(
        top.x - dx, lowY, top.z - dz,
        top.x + dx, lowY, top.z + dz,
        top.x + dx, topY + 0.02, top.z + dz,
        top.x - dx, lowY, top.z - dz,
        top.x + dx, topY + 0.02, top.z + dz,
        top.x - dx, topY + 0.02, top.z - dz,
      )
    }
    push(crackPositions)
    push(emberPositions)
  }
  for (const [positions, material, name] of [
    [crackPositions, crackMaterial, 'joint-crack'],
    [emberPositions, emberMaterial, 'joint-ember'],
  ] as const) {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = name
    mesh.renderOrder = 3
    fissures.add(mesh)
  }
  group.add(fissures)

  return {
    group,
    slabs,
    fissures,
    lining,
    setCrack(value: number) {
      const amount = THREE.MathUtils.clamp(value, 0, 1)
      crackMaterial.opacity = amount > 0.02 ? 0.5 + amount * 0.45 : 0
      emberMaterial.opacity = amount > 0.02 ? amount * 0.8 : 0
      fissures.visible = amount > 0.02
      for (const slab of slabs) {
        const shift = amount * (0.09 + slab.order * 0.012)
        slab.mesh.position.set(slab.outward.x * shift, amount * 0.02, slab.outward.z * shift)
      }
    },
    setHeat(value: number) {
      heatUniform.value = THREE.MathUtils.clamp(value, 0, 1)
    },
    setChar(value: number) {
      charUniform.value = THREE.MathUtils.clamp(value, 0, 1)
    },
    peel(index: number, amount: number) {
      const slab = slabs[index]
      if (!slab) return
      const t = THREE.MathUtils.clamp(amount, 0, 1)
      const tilt = smooth01(t / 0.55) * (0.34 + index * 0.05)
      slab.mesh.position.set(
        slab.outward.x * t * t * (1.5 + index * 0.2),
        -t * t * (1.9 + index * 0.5),
        slab.outward.z * t * t * (1.5 + index * 0.2),
      )
      // 绕「水平面内垂直于 outward」的轴倾倒：X 转 outward.z、Z 转 -outward.x。
      slab.mesh.rotation.set(
        slab.outward.z * tilt,
        0,
        -slab.outward.x * tilt,
      )
    },
    reset() {
      for (const slab of slabs) {
        slab.mesh.position.set(0, 0, 0)
        slab.mesh.rotation.set(0, 0, 0)
      }
      crackMaterial.opacity = 0
      emberMaterial.opacity = 0
      fissures.visible = false
      heatUniform.value = 0
      charUniform.value = 0
    },
    dispose() {
      material.dispose()
      crackMaterial.dispose()
      emberMaterial.dispose()
      for (const slab of slabs) slab.mesh.geometry.dispose()
      for (const child of fissures.children) {
        if (child instanceof THREE.Mesh) child.geometry.dispose()
      }
    },
  }
}
