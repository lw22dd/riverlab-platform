// @ts-nocheck
/**
 * 「都江堰：开山导江记」的三维场景内核。
 *
 * 移植自 standalone 参考实现（tmp/reference-case/497663211.html 的 module script），
 * 几何、材质、水理与镜头语法保持一致：仍是低模、白天、无现代景物，
 * 只是把「整页脚本」收成一个可挂载、可卸载的工厂函数。
 *
 * 为什么整段保留而不是逐函数重写：这套世界代码有一层共享可变状态
 * （branch / lastGabKey / curTime …）与 2000 余行顺序相关的建模步骤，
 * 拆开重写的风险远大于收益。真正需要被论文引用的数字全部搬进了
 * spec.ts（几何与剧本）与 hydraulics.ts（水理解析式），并各自有单测。
 *
 * 这里 @ts-nocheck 只覆盖「建模与每帧动画」这一段；对外句柄由 types.ts 的
 * ChronicleScene 接口严格约束，视图侧仍然全程有类型。
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { clamp, hash2, lerp, p2w, smoothstep, distToPolyline } from './math'
import {
  CANALS,
  DEFAULT_BRANCH,
  DIKE_AXIS,
  GAP,
  GAP_LEN,
  GAP_UX,
  GAP_UZ,
  LABEL_DEFS,
  PHASES,
  PRESETS,
  SANDBARS,
  TOTAL_SEC,
  WEIR_AXIS,
  getPhaseAt,
  sampleProfile,
} from './spec'
import { evalGapDist, GAP_MOUTH, POOL_R, sampleTerrain } from './terrain'
import { makeBambooTexture, makeSoftParticleTexture, mergeGeometries } from './textures'
import { floodLevelAt, solveHydraulics } from './hydraulics'
import type {
  Branch,
  ChronicleFrame,
  ChronicleScene,
  ChronicleSceneOptions,
  PresetKey,
  WorldPoint,
} from './types'

export function createChronicleScene(opts: ChronicleSceneOptions): ChronicleScene {
  const stageEl = opts.stage
  const labelsEl = opts.labels
  const isMobile = opts.mobile === true

  // —— 播放状态：原脚本挂在模块顶层，收进工厂后每次挂载都是干净的一份 ——
  let curTime = 0.001
  // 环境时钟：与剧情时间轴分开。剧情可以停在某一幕等玩家决策，
  // 但江水、火焰、蒸汽、粒子这些"世界本身在动"的东西不能跟着停摆。
  let animTime = 0
  let playing = true
  let speed = 1
  let followCam = true
  let liveFps = 60
  let fpsFrames = 0
  let fpsLast = performance.now()
  let degraded = false
  let frameOut: ChronicleFrame
  let branch: Branch = { ...DEFAULT_BRANCH }
  let lastGabKey = ''
  let lastPaddyKey = ''

  // 视口尺寸跟随容器：宿主是页面里的一块区域，不再是整页
  const vp = {
    w: Math.max(1, stageEl.clientWidth || window.innerWidth),
    h: Math.max(1, stageEl.clientHeight || window.innerHeight),
  }

  // 金刚堤中轴总长由下文 §8 的 DIKE_LEN 提供（同一次折线积分），此处不再重复声明

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
renderer.setSize(vp.w, vp.h);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.04;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap; // r186 推荐 PCFShadowMap
stageEl.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#dfe7df');
scene.fog = new THREE.Fog('#e4e8dc', 135, 310);

const camera = new THREE.PerspectiveCamera(38, vp.w / vp.h, 1.0, 360);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.minDistance = 8;
controls.maxDistance = 165;
controls.maxPolarAngle = Math.PI * 0.482;
controls.screenSpacePanning = false;

// 天空渐变穹顶
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false,
  uniforms: {
    uTop: { value: new THREE.Color('#97b8c9') },
    uMid: { value: new THREE.Color('#d7e2d9') },
    uBot: { value: new THREE.Color('#efe7d4') },
  },
  vertexShader: `varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform vec3 uTop,uMid,uBot; varying vec3 vP;
    void main(){ float h=normalize(vP).y; vec3 c=mix(uBot,uMid,smoothstep(-0.04,0.22,h)); c=mix(c,uTop,smoothstep(0.18,0.78,h)); gl_FragColor=vec4(c,1.0); }`,
});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(260, 20, 12), skyMat));

// 灯光：侧斜日光突出玉垒山西侧 60° 陡崖与宝瓶口深槽暗影
scene.add(new THREE.HemisphereLight('#edf3e8', '#8d8267', 1.08));
const sun = new THREE.DirectionalLight('#fff6e1', 2.05);
sun.position.set(-42, 76, -48);
sun.castShadow = true;
const shadowRes = isMobile ? 512 : 1024;
sun.shadow.mapSize.set(shadowRes, shadowRes);
sun.shadow.camera.left = -68;
sun.shadow.camera.right = 68;
sun.shadow.camera.top = 68;
sun.shadow.camera.bottom = -68;
sun.shadow.camera.near = 18;
sun.shadow.camera.far = 210;
sun.shadow.bias = -0.0007;
scene.add(sun, sun.target);

// 远景承托大地板
const farGround = new THREE.Mesh(
  new THREE.CircleGeometry(240, 32).rotateX(-Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: '#c4ba9b', roughness: 1.0 })
);
farGround.position.y = -4.2;
scene.add(farGround);

/* ============================================================================
 * 5. 构建主低多边形地形 + 博物沙盘底座
 * ========================================================================== */
const MAP_W = 100, MAP_H = 106.2;
const SEG_X = 112, SEG_Z = 118; // ~26.4k 三角面（远低于 58k 预算）

const terrainGeo = new THREE.PlaneGeometry(MAP_W, MAP_H, SEG_X, SEG_Z);
terrainGeo.rotateX(-Math.PI / 2);
const tPos = terrainGeo.attributes.position;
const tCol = new Float32Array(tPos.count * 3);
const tmpCol = new THREE.Color();

const C_BED      = new THREE.Color('#8f8266');
const C_W_FLOOD  = new THREE.Color('#aa9d79');
const C_W_HILL   = new THREE.Color('#778861');
const C_CLIFF    = new THREE.Color('#7c7668');
const C_GORGE    = new THREE.Color('#8e8270');
const C_GORGE_DK = new THREE.Color('#473b32');
const C_MOUNT_LO = new THREE.Color('#69815a');
const C_MOUNT_HI = new THREE.Color('#869a74');
const C_PLAIN    = new THREE.Color('#b8a77b');
const C_CANAL_B  = new THREE.Color('#978a68');

for (let i = 0; i < tPos.count; i++) {
  let x = tPos.getX(i);
  let zW = tPos.getZ(i);
  const edge = Math.abs(x) > MAP_W * 0.492 || Math.abs(zW) > MAP_H * 0.492;
  const Z = -zW;
  const nearGap = evalGapDist(x, Z).d < 3.5 && Math.abs(Z + 17.5) < 5.5;
  // 有机低模顶点微扰（边缘与宝瓶口内壁不扰动以保锐利边界）
  if (!edge && !nearGap) {
    x += (hash2(i * 1.13, 3.7) - 0.5) * 0.34;
    zW += (hash2(7.1, i * 0.89) - 0.5) * 0.34;
  }
  const res = sampleTerrain(x, -zW);
  tPos.setXYZ(i, x, res.y, zW);

  const tone = 0.94 + hash2(x * 0.6, zW * 0.6) * 0.12;
  if (res.zone === 'bed') {
    tmpCol.copy(C_BED);
  } else if (res.zone === 'westFlood') {
    tmpCol.copy(C_W_FLOOD).lerp(C_W_HILL, smoothstep(res.y, 0.55, 1.3));
  } else if (res.zone === 'westHill') {
    tmpCol.copy(C_W_HILL);
  } else if (res.zone === 'gorgeWall') {
    // 宝瓶口新断面 + 上部熏焦带 + 底部湿岩
    tmpCol.copy(C_GORGE);
    const scorch = smoothstep(res.y, 1.2, 2.0) * (1 - smoothstep(res.y, 2.5, 3.6));
    tmpCol.lerp(C_GORGE_DK, scorch * 0.55);
    if (res.y < 0.75) tmpCol.multiplyScalar(0.76);
  } else if (res.zone === 'cliff') {
    tmpCol.copy(C_CLIFF).lerp(C_MOUNT_LO, smoothstep(res.y, 3.8, 7.8) * 0.45);
  } else if (res.zone === 'mountain') {
    tmpCol.copy(C_MOUNT_LO).lerp(C_MOUNT_HI, smoothstep(res.y, 4.5, 11.2));
    if (res.y < 1.2) tmpCol.lerp(C_PLAIN, (1 - smoothstep(res.y, 0.35, 1.2)) * 0.55);
  } else if (res.zone === 'canalBed') {
    tmpCol.copy(C_CANAL_B);
  } else {
    tmpCol.copy(C_PLAIN);
  }
  tmpCol.multiplyScalar(tone);
  tCol[i * 3] = tmpCol.r;
  tCol[i * 3 + 1] = tmpCol.g;
  tCol[i * 3 + 2] = tmpCol.b;
}
terrainGeo.setAttribute('color', new THREE.BufferAttribute(tCol, 3));
terrainGeo.computeVertexNormals();

// —— 渲染高度场 ——
// 解析高程 sampleTerrain 与屏幕上那张地形网格之间差着顶点抖动与 0.9 的格距：
// 渠网、潭面若按解析高程摆放，会整条被网格压到地里（实测 334 个渠顶点 329 个被埋），
// 于是"宝瓶口开了水却看不见进平原"。这里把网格实际高度存成场，水一律按它抬升。
const HF_W = SEG_X + 1, HF_H = SEG_Z + 1;
const HF_SX = MAP_W / SEG_X, HF_SZ = MAP_H / SEG_Z;
const heightField = new Float32Array(HF_W * HF_H);
for (let i = 0; i < tPos.count; i++) heightField[i] = tPos.getY(i);
/** 双线性采样地形网格高度（入参为世界坐标 X / Z）。 */
function terrainSurfaceAt(X: number, Z: number): number {
  const fx = clamp((X + MAP_W / 2) / HF_SX, 0, HF_W - 1.001);
  const fz = clamp((MAP_H / 2 - Z) / HF_SZ, 0, HF_H - 1.001);
  const ix = Math.floor(fx), iz = Math.floor(fz);
  const tx = fx - ix, tz = fz - iz;
  const row = iz * HF_W + ix, row2 = row + HF_W;
  return lerp(
    lerp(heightField[row], heightField[row + 1], tx),
    lerp(heightField[row2], heightField[row2 + 1], tx),
    tz
  );
}

const terrainMesh = new THREE.Mesh(
  terrainGeo,
  new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0.0 })
);
terrainMesh.receiveShadow = true;
terrainMesh.castShadow = true;
terrainMesh.name = 'terrain';
scene.add(terrainMesh);

// 沙盘厚底座
const plinthTop = new THREE.Mesh(
  new THREE.BoxGeometry(MAP_W + 0.4, 3.8, MAP_H + 0.4),
  new THREE.MeshStandardMaterial({ color: '#7d6e58', roughness: 1.0 })
);
plinthTop.position.set(0, -2.25, 0);
const plinthBot = new THREE.Mesh(
  new THREE.BoxGeometry(MAP_W + 1.2, 1.0, MAP_H + 1.2),
  new THREE.MeshStandardMaterial({ color: '#4c4337', roughness: 1.0 })
);
plinthBot.position.set(0, -4.45, 0);
scene.add(plinthTop, plinthBot);

/* ============================================================================
 * 6. 单张连续水体 Shader（单股→双股 / 枯洪四六分水 / 飞沙堰溢流 / 岁修断流）
 * ========================================================================== */
const waterGeo = new THREE.PlaneGeometry(MAP_W, MAP_H, 116, 122);
waterGeo.rotateX(-Math.PI / 2);

const waterUniforms = {
  uTime:       { value: 0 },
  uFlood:      { value: 0 },     // 0 枯水 (0.00) → 1 洪水 (+0.72)
  uDikeBuilt:  { value: 0 },     // 0 单股大河 → 1 鱼嘴/金刚堤分水
  uGapOpen:    { value: 0 },     // 0 宝瓶口封堵 → 1 宝瓶口贯通
  uWeirBuilt:  { value: 0 },     // 0 无飞沙堰 → 1 飞沙堰建成
  uWeirHigh:   { value: 0 },     // 0 低堰 (+0.62，洪水位 0.72 会漫顶) → 1 高堰 (+1.24 不溢流)
  uMacha:      { value: 0 },     // 0 正常 → 1 岁修截断内江
  uSplitBias:  { value: 0 },     // 0 居中 / -1 偏东内江枯 / +1 偏西内江过载
  uShallowDredge: { value: 0 },  // 1 浅淘导致内江流弱
  uEarthBreach:{ value: 0 },     // 1 土堤遇洪溃口
  uSunDir:     { value: new THREE.Vector3(-42, 76, -48).normalize() },
  uFogColor:   { value: new THREE.Color('#e4e8dc') },
  uFogNear:    { value: 135.0 },
  uFogFar:     { value: 310.0 },
  uDikePts:    { value: DIKE_AXIS.map(p => new THREE.Vector2(p[0], p[1])) },
};

const waterMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: true,
  uniforms: waterUniforms,
  vertexShader: /* glsl */`
    uniform float uTime, uFlood, uDikeBuilt, uGapOpen, uWeirBuilt, uWeirHigh, uMacha;
    uniform vec2 uDikePts[6];
    varying vec3 vWorld;
    varying vec2 vPlan;
    varying float vSide;      // +东(内江) / -西(外江)
    varying float vDikeDist;
    varying float vSplitMask;
    varying float vEastCliff;
    varying float vInGap;
    varying float vFeisha;
    varying float vDewater;
    varying float vPoolM;

    // 东岸山崖封口线 X(Z) 近似，杜绝洪水穿透山脊浮到东侧平原
    float eastBankX(float Z) {
      if (Z > 41.0) return mix(-20.8, -31.8, clamp((Z - 41.0)/12.5, 0.0, 1.0));
      if (Z > 26.25) return mix(-5.6, -20.8, (Z - 26.25)/14.75);
      if (Z > 10.0) return mix(5.5, -5.6, (Z - 10.0)/16.25);
      if (Z > -7.8) return mix(10.8, 5.5, (Z + 7.8)/17.8);
      if (Z > -17.0) return mix(14.8, 10.8, (Z + 17.0)/9.2);
      if (Z > -25.0) return mix(12.3, 14.8, (Z + 25.0)/8.0);
      return mix(9.0, 12.3, clamp((Z + 53.5)/28.5, 0.0, 1.0));
    }

    vec3 dikeSignedDist(vec2 p) {
      float bestD = 999.0;
      float bestSign = 1.0;
      for (int i = 0; i < 5; i++) {
        vec2 a = uDikePts[i];
        vec2 b = uDikePts[i + 1];
        vec2 ab = b - a;
        float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 0.0001), 0.0, 1.0);
        vec2 q = a + ab * t;
        float d = length(p - q);
        if (d < bestD) {
          bestD = d;
          vec2 tang = normalize(ab);
          vec2 nEast = vec2(-tang.y, tang.x);
          bestSign = dot(p - q, nEast) >= 0.0 ? 1.0 : -1.0;
        }
      }
      return vec3(bestD, bestSign, 0.0);
    }

    void main() {
      vec3 pos = position;
      float X = pos.x;
      float Z = -pos.z;
      vPlan = vec2(X, Z);

      vec3 dk = dikeSignedDist(vPlan);
      vDikeDist = dk.x;
      vSide = dk.y;
      vSplitMask = smoothstep(26.8, 23.5, Z) * smoothstep(-21.5, -16.8, Z) * uDikeBuilt;

      float xE = eastBankX(Z);
      vEastCliff = xE;

      // 宝瓶口通道掩码
      vec2 gFrom = vec2(13.4, -15.6);
      vec2 gDir  = normalize(vec2(8.0, -4.2));
      vec2 gr = vPlan - gFrom;
      float gs = dot(gr, gDir);
      float gd = abs(-gr.x * gDir.y + gr.y * gDir.x);
      vInGap = smoothstep(-0.8, 0.4, gs) * (1.0 - smoothstep(7.8, 9.2, gs)) * (1.0 - smoothstep(1.1, 2.2, gd));

      // 宝瓶口出水口深潭（离堆东脚）：江水出峡后先在这里摊成一汪，再向东进干渠
      vec2 gOut = vec2(${GAP_MOUTH[0].toFixed(2)}, ${GAP_MOUTH[1].toFixed(2)});
      float poolD = length(vPlan - gOut);
      vPoolM = (1.0 - smoothstep(1.7, ${(POOL_R - 0.2).toFixed(2)}, poolD)) * smoothstep(0.10, 0.45, uGapOpen);

      // 飞沙堰溢流带掩码（X in [2.2, 10.6], Z in [-19.8, -15.2]）
      vFeisha = smoothstep(1.6, 3.0, X) * (1.0 - smoothstep(9.6, 11.4, X))
              * smoothstep(-20.4, -18.2, Z) * (1.0 - smoothstep(-16.2, -14.8, Z));

      // 基础水位：枯水 0.00 → 洪水 +0.72
      float level = mix(0.0, 0.72, uFlood);
      // 枯水外江浅（-0.05），内江深满（+0.04）
      level += vSplitMask * mix(-0.05, 0.04, step(0.0, vSide)) * (1.0 - uFlood);

      // 岁修杩槎（Z = +8.1）截断内江，下游 Z < +7.6 退水露河床
      float isInnerDown = smoothstep(8.2, 6.2, Z) * smoothstep(-19.5, -16.5, Z) * smoothstep(-0.5, 1.2, vSide);
      vDewater = uMacha * isInnerDown * uDikeBuilt;
      level = mix(level, -0.78, vDewater);

      // 飞沙堰不再抬高水面：堰顶(0.78)略高于洪水位(0.72)，漫顶由背水舌面上的白水层变现，
      // 否则整片水把堰顶埋掉，"漫顶"就看不见了
      float spillOn = uWeirBuilt * (1.0 - uWeirHigh) * smoothstep(0.55, 0.85, uFlood);

      // 山脊东侧非宝瓶口处强制压到地下 -1.6，严防洪水穿透山体淹到东平原
      float behindRidge = smoothstep(xE + 0.5, xE + 2.2, X);
      float allowGap = max(vInGap * smoothstep(0.05, 0.35, uGapOpen), vPoolM);
      float suppress = behindRidge * (1.0 - allowGap);
      level = mix(level, -1.6, suppress);
      // 潭面不随洪水抬升：封顶 0.24，否则汛期会在平原上浮出一张水盘
      level = mix(level, min(level, 0.24), vPoolM);

      // 轻微水流波浪
      float wave = sin(X * 0.65 + uTime * 2.2) * 0.025 + cos(Z * 0.55 + uTime * 1.9) * 0.02;
      pos.y = level + wave * (1.0 - suppress) * (1.0 - vDewater);

      vec4 wp = modelMatrix * vec4(pos, 1.0);
      vWorld = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
  fragmentShader: /* glsl */`
    uniform float uTime, uFlood, uDikeBuilt, uGapOpen, uWeirBuilt, uWeirHigh, uMacha;
    uniform float uSplitBias, uShallowDredge, uEarthBreach;
    uniform vec3 uSunDir, uFogColor;
    uniform float uFogNear, uFogFar;
    varying vec3 vWorld;
    varying vec2 vPlan;
    varying float vSide, vDikeDist, vSplitMask, vEastCliff, vInGap, vFeisha, vDewater, vPoolM;

    float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vnoise(vec2 p){
      vec2 i = floor(p), f = fract(p);
      vec2 u = f*f*(3.0-2.0*f);
      return mix(mix(h2(i), h2(i+vec2(1,0)), u.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), u.x), u.y);
    }

    void main() {
      // 山后隐藏区域直接丢弃
      if (vWorld.y < -1.15) discard;

      float X = vPlan.x, Z = vPlan.y;
      float isInner = smoothstep(-0.35, 0.35, vSide) * vSplitMask;
      float isOuter = (1.0 - smoothstep(-0.35, 0.35, vSide)) * vSplitMask;

      // 四六分水：内江 vs 外江流速与流纹密度差异
      float innerShare = clamp(0.62 - 0.24 * uFlood + uSplitBias * 0.28 - uShallowDredge * 0.24, 0.15, 0.85);
      float outerShare = 1.0 - innerShare;
      float speed = 1.05 + uFlood * 0.65;
      float density = 1.0;
      if (vSplitMask > 0.05) {
        speed = mix(0.72 + outerShare * 1.35, 0.65 + innerShare * 1.45, isInner);
        density = mix(0.65 + outerShare * 1.1, 0.65 + innerShare * 1.15, isInner);
      }

      // 近似流向坐标（上游 SE 下行，撞山嘴后折向南；宝瓶口内向东冲）
      vec2 flowDir = normalize(vec2(Z > -17.0 ? 0.56 : -0.10, -0.84));
      if (vInGap > 0.3) flowDir = normalize(vec2(0.88, -0.47));
      vec2 perpDir = vec2(-flowDir.y, flowDir.x);

      float along = dot(vPlan, flowDir);
      float across = dot(vPlan, perpDir);

      // 风格化低模流纹条带（视觉一眼分辨主次流量！）
      float sCoord = across * (1.25 * density);
      float tCoord = along * 0.22 - uTime * speed * 1.15;
      float streak = vnoise(vec2(sCoord, tCoord));
      float ribbon = smoothstep(0.64 - 0.14 * density, 0.86, streak);

      // 水色：枯水内江深碧青、外江浅灰蓝；洪水外江转浑黄排沙、内江维持较清绿
      vec3 cClearDeep  = vec3(0.16, 0.41, 0.47);
      vec3 cClearShal  = vec3(0.41, 0.63, 0.67);
      vec3 cOuterDry   = vec3(0.38, 0.56, 0.61);
      vec3 cMudFlood   = vec3(0.55, 0.47, 0.32);
      vec3 cInnerFlood = vec3(0.28, 0.48, 0.45);

      float depthTint = vnoise(vPlan * 0.09 + 1.5);
      vec3 baseCol = mix(cClearShal, cClearDeep, depthTint);

      // 洪水混沙
      vec3 floodCol = mix(cMudFlood, cInnerFlood, isInner * 0.88);
      baseCol = mix(baseCol, floodCol, smoothstep(0.15, 0.92, uFlood));
      // 枯水内外江深浅差
      baseCol = mix(baseCol, cOuterDry, isOuter * (1.0 - uFlood) * 0.55);

      // 叠加流向白纹
      vec3 streakCol = mix(vec3(0.86, 0.93, 0.93), vec3(0.92, 0.88, 0.76), uFlood * (1.0 - isInner * 0.6));
      baseCol = mix(baseCol, streakCol, ribbon * (0.18 + 0.22 * density));

      // 1) 鱼嘴迎水 V 形分水白浪（-12.78, +26.25）
      vec2 fm = vPlan - vec2(-12.78, 26.25);
      float fmDown = -fm.y * 0.83 + fm.x * 0.55;
      float fmLat  = abs(fm.x * 0.83 + fm.y * 0.55);
      float vWake = smoothstep(0.0, 1.0, fmDown) * (1.0 - smoothstep(2.5, 9.5, fmDown))
                  * (1.0 - smoothstep(0.2, 1.35, abs(fmLat - fmDown * 0.48)));
      float wakeFoam = vWake * uDikeBuilt * (0.65 + 0.35 * sin(fmDown * 3.0 - uTime * 7.0));

      // 2) 玉垒山西崖撞岸浪沫（强化“江水撞山拐弯”直觉！）
      float cliffDist = abs(X - vEastCliff);
      float cliffFoam = (1.0 - smoothstep(0.2, 1.15, cliffDist)) * smoothstep(-28.0, -18.0, Z) * (1.0 - smoothstep(10.0, 28.0, Z));
      cliffFoam *= (0.45 + 0.55 * vnoise(vec2(Z * 1.4, uTime * 2.2)));

      // 3) 飞沙堰溢流翻沙白黄水幕（仅低堰+洪水）
      float spillActive = uWeirBuilt * (1.0 - uWeirHigh) * smoothstep(0.50, 0.88, uFlood);
      float spillWave = vnoise(vec2(X * 1.3 + uTime * 2.0, Z * 1.8 + uTime * 4.5));
      float spillFoam = vFeisha * spillActive * (0.55 + 0.45 * smoothstep(0.3, 0.8, spillWave));

      // 4) 土堤遇洪溃口混水白沫
      float breachSpot = (1.0 - smoothstep(0.6, 2.8, length(vPlan - vec2(-3.5, 11.5))))
                       + (1.0 - smoothstep(0.6, 2.8, length(vPlan - vec2(1.4, -2.5))));
      float breachFoam = clamp(breachSpot, 0.0, 1.0) * uEarthBreach * smoothstep(0.55, 0.85, uFlood);

      // 5) 宝瓶口冲水白浪
      float gapFoam = vInGap * smoothstep(0.2, 0.8, uGapOpen) * (0.28 + 0.35 * vnoise(vec2(along * 1.6 - uTime * 5.0, across * 2.0)));

      // 6) 出水潭摊水白沫：出峡急流落进潭面翻白
      float poolD = length(vPlan - vec2(${GAP_MOUTH[0].toFixed(2)}, ${GAP_MOUTH[1].toFixed(2)}));
      float poolFoam = vPoolM * smoothstep(0.2, 0.75, uGapOpen)
        * (0.26 + 0.40 * vnoise(vec2(poolD * 2.3 - uTime * 3.6, along * 0.7 + uTime * 1.1)));

      float totalFoam = clamp(wakeFoam * 0.9 + cliffFoam * 0.55 + spillFoam * 0.95 + breachFoam * 0.9 + gapFoam * 0.7 + poolFoam * 0.8, 0.0, 1.0);
      vec3 foamCol = mix(vec3(0.94, 0.96, 0.95), vec3(0.95, 0.88, 0.72), spillFoam * 0.55);
      baseCol = mix(baseCol, foamCol, totalFoam);

      // 太阳镜面高光
      vec3 N = normalize(vec3(
        (vnoise(vPlan * 1.1 + uTime * 0.6) - 0.5) * 0.14,
        1.0,
        (vnoise(vPlan * 1.1 - uTime * 0.5 + 9.0) - 0.5) * 0.14
      ));
      vec3 V = normalize(cameraPosition - vWorld);
      vec3 H = normalize(uSunDir + V);
      float spec = pow(max(dot(N, H), 0.0), 42.0) * (0.34 - uFlood * 0.18);
      baseCol += vec3(1.0, 0.97, 0.88) * spec;

      // 线性雾融合
      float dist = length(cameraPosition - vWorld);
      float fogF = smoothstep(uFogNear, uFogFar, dist);
      baseCol = mix(baseCol, uFogColor, fogF);

      float alpha = mix(0.90, 0.97, uFlood) * (1.0 - vDewater * 0.85);
      gl_FragColor = vec4(baseCol, alpha);
    }
  `,
});

const waterMesh = new THREE.Mesh(waterGeo, waterMat);
waterMesh.name = 'water';
waterMesh.renderOrder = 2;
scene.add(waterMesh);

/* ============================================================================
 * 7. 天然江心洲 + 玉垒山嘴连续岩体（火烧→激裂→逐片坍落）
 * ========================================================================== */
const sandbarGroup = new THREE.Group();
const sandbarMeshes = [];
const sandbarMat = new THREE.MeshStandardMaterial({
  color: '#bba578', roughness: 0.95, flatShading: true,
  polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
});

for (const sb of SANDBARS) {
  const g = new THREE.IcosahedronGeometry(1, 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const j = 1 + (hash2(x * 4 + sb.len, z * 4) - 0.5) * 0.14;
    // 上半扁平缓洲，边缘渐薄贴合河床
    y = y > 0 ? Math.pow(y, 0.65) : y * 0.25;
    p.setXYZ(i, x * (sb.len * 0.5) * j, y * 0.72, z * (sb.wid * 0.5) * j);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, sandbarMat);
  m.position.copy(p2w(sb.xy[0], sb.xy[1], sb.crest - 0.48));
  m.rotation.y = THREE.MathUtils.degToRad(sb.deg - 90);
  m.receiveShadow = true;
  m.userData = { ...sb, baseY: sb.crest - 0.48 };
  sandbarGroup.add(m);
  sandbarMeshes.push(m);
}

// 依洲筑堤时连成一体的卵石垫基（初始隐藏在河床下，随阶段 4 抬升与沙洲融合）
function makeRibbonMesh(ptsPlan, widthArr, yHeight, mat) {
  const curve = new THREE.CatmullRomCurve3(ptsPlan.map(p => p2w(p[0], p[1], yHeight)));
  const segs = 36;
  const pos = [], uvs = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const pt = curve.getPointAt(t);
    const tg = curve.getTangentAt(t);
    const nx = -tg.z, nz = tg.x;
    const nl = Math.hypot(nx, nz) || 1;
    const w = Array.isArray(widthArr) ? lerp(widthArr[0], widthArr[1], t) : widthArr;
    // 梯形低模截面（4点：左下、左上、右上、右下）
    const hwTop = w * 0.42, hwBot = w * 0.68;
    const topY = pt.y, botY = -0.85;
    pos.push(
      pt.x - (nx / nl) * hwBot, botY, pt.z - (nz / nl) * hwBot,
      pt.x - (nx / nl) * hwTop, topY, pt.z - (nz / nl) * hwTop,
      pt.x + (nx / nl) * hwTop, topY, pt.z + (nz / nl) * hwTop,
      pt.x + (nx / nl) * hwBot, botY, pt.z + (nz / nl) * hwBot
    );
    uvs.push(0, t, 0.3, t, 0.7, t, 1, t);
    if (i < segs) {
      const b = i * 4;
      for (let k = 0; k < 3; k++) {
        idx.push(b + k, b + k + 4, b + k + 1, b + k + 1, b + k + 4, b + k + 5);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

const dikeBaseMesh = makeRibbonMesh(DIKE_AXIS, [2.8, 3.6], 0.58, sandbarMat);
dikeBaseMesh.position.y = -1.2;
sandbarGroup.add(dikeBaseMesh);
scene.add(sandbarGroup);

/* ============================================================================
 * 7.4 玉垒山嘴：与两侧山体连续的可剥离岩体（取代原 5×2 方盒岩塞）
 *   · 顶面取“未开凿”的山脊解析面 → 与南北山脊严丝合缝，是一整条山嘴而非方块堆；
 *   · 底面探到宝瓶口 V 形槽底以下 → 它本身就是当年被凿掉的那块岩体；
 *   · 沿走廊 s 切成 5 片：重合时无缝成山，浇裂后逐片向河侧外倾坠入内江。
 * ========================================================================== */
const SEAL = {
  // s 覆盖整段被开凿的走廊（-1.2 → GAP_LEN+1.2）：两端正好落在 carve=0 的原生山面上，
  // 所以岩塞与南北山体之间不存在任何切割缝；西端在水面以下，东端没入成都平原。
  s0: -0.60, s1: 10.20,
  slabs: 5, nsPerSlab: 3, nd: 12,
  edge: 0.985, bottom: -1.7,   // 横向收边 / 岩体底面
};
const SEAL_COLS = SEAL.slabs * SEAL.nsPerSlab;
const sealFissureMeshes = [];   // 供 audit() 回读裂隙几何
let dbgState = {};              // applyFrame 每帧写入的派生状态（供 state()/测试断言）
const GAP_PERP = [-GAP_UZ, GAP_UX];   // PLAN 横向单位向量（指北偏东）

function corridorPoint(s, d) {
  return [GAP.from[0] + GAP_UX * s + GAP_PERP[0] * d,
          GAP.from[1] + GAP_UZ * s + GAP_PERP[1] * d];
}
function gapHalfWidth(s) {
  return GAP.wBot + 0.75 * (smoothstep(s, 2.2, 0.0) + smoothstep(s, GAP_LEN - 2.2, GAP_LEN));
}
function ridgeSurfaceY(X, Z) { return sampleTerrain(X, Z, { carve: false }).y; }

// 数值求「槽壁 ∩ 原生山面」的横向半宽 = 岩塞在该处的横宽
function solveSealRim(s, side) {
  const hw = gapHalfWidth(s);
  let d = hw * 0.55;
  for (let k = 0; k < 320; k++, d += 0.03) {
    const p = corridorPoint(s, d * side);
    const wallY = -0.68 + Math.max(0, d - hw) * 3.45;
    if (wallY >= ridgeSurfaceY(p[0], p[1]) - 0.02) break;
  }
  return Math.max(d, 0.3);
}
const sealRimN = [], sealRimS = [], sealSCols = [];
for (let gi = 0; gi <= SEAL_COLS; gi++) {
  const s = lerp(SEAL.s0, SEAL.s1, gi / SEAL_COLS);
  sealSCols.push(s);
  sealRimN.push(solveSealRim(s, +1));
  sealRimS.push(solveSealRim(s, -1));
}
function sealRimAt(s, side) {
  const f = clamp((s - SEAL.s0) / (SEAL.s1 - SEAL.s0), 0, 1) * SEAL_COLS;
  const i0 = Math.min(SEAL_COLS - 1, Math.floor(f));
  const arr = side > 0 ? sealRimN : sealRimS;
  return lerp(arr[i0], arr[i0 + 1], f - i0);
}
function sealSurfacePoint(s, d) {
  const p = corridorPoint(s, d);
  return [p[0], ridgeSurfaceY(p[0], p[1]), p[1]];
}
function sealSurfNormal(s, d) {
  const e = 0.14;
  const a = sealSurfacePoint(s + e, d), b = sealSurfacePoint(s - e, d);
  const c = sealSurfacePoint(s, d + e), f = sealSurfacePoint(s, d - e);
  const ux = a[0] - b[0], uy = a[1] - b[1], uz = a[2] - b[2];
  const vx = c[0] - f[0], vy = c[1] - f[1], vz = c[2] - f[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const l = Math.hypot(nx, ny, nz) || 1;
  nx /= l; ny /= l; nz /= l;
  if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
  return [nx, ny, nz];
}

const sealTmp = new THREE.Color();
// 顶面配色：沿用玉垒山“西崖灰岩 / 山脊青绿”的同一套分区，接缝处才看不出拼贴
function sealSurfColor(X, Z, y) {
  const [, , xE, xR] = sampleProfile(Z);
  const t = clamp((X - xE) / Math.max(0.5, xR - xE), 0, 1);
  if (t < 0.72) sealTmp.copy(C_CLIFF).lerp(C_MOUNT_LO, smoothstep(y, 3.8, 7.8) * 0.45);
  else sealTmp.copy(C_MOUNT_LO).lerp(C_MOUNT_HI, smoothstep(y, 4.5, 11.2));
  if (y < 1.2) sealTmp.lerp(C_PLAIN, (1 - smoothstep(y, 0.35, 1.2)) * 0.45);
  if (y < 0.7) sealTmp.multiplyScalar(0.8);
  sealTmp.multiplyScalar(0.94 + hash2(X * 0.61 + 3.3, Z * 0.57 + 1.9) * 0.12);
  return sealTmp;
}
// 撬断面配色：与地形 gorgeWall 同源（下部湿岩、上部熏焦带）
function sealCutColor(X, Z, y) {
  sealTmp.copy(C_GORGE).lerp(C_CLIFF, 0.22);
  sealTmp.lerp(C_GORGE_DK, 0.06 + 0.26 * (1 - smoothstep(y, 0.2, 3.2)));
  if (y < 0.7) sealTmp.multiplyScalar(0.76);
  sealTmp.multiplyScalar(0.92 + hash2(X * 0.7 + 8.1, Z * 0.53 + 4.7) * 0.10);
  return sealTmp;
}

/* ---- 岩塞材质：注入「崖根炙烤」的局部熏黑 + 余烬自发光（不是整体换色） ---- */
const sealHeatU = { value: 0 };
const sealCharU = { value: 0 };
const sealCenterU = { value: new THREE.Vector3(14.20, 0.9, 15.95) };  // 崖根火线中心（PLAN 14.20,-15.95）
const sealMat = new THREE.MeshStandardMaterial({
  vertexColors: true, roughness: 0.97, metalness: 0.0, flatShading: true,
});
sealMat.onBeforeCompile = (sh) => {
  sh.uniforms.uSealHeat = sealHeatU;
  sh.uniforms.uSealChar = sealCharU;
  sh.uniforms.uSealC = sealCenterU;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vSealW;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vSealW = (modelMatrix * vec4(position, 1.0)).xyz;');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vSealW;\nuniform float uSealHeat;\nuniform float uSealChar;\nuniform vec3 uSealC;')
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      {
        // 崖根火线：以火塘为中心的扁椭圆，只烧到离水面两三米的一条带，不是整面山壁泛光
        float rad = length(vSealW.xz - uSealC.xz);
        float hz = (1.0 - smoothstep(0.25, 1.55, rad))
                 * (1.0 - smoothstep(0.35, 1.75, vSealW.y))
                 * smoothstep(-1.60, 0.10, vSealW.y);
        // 逐块抖动：把光滑的径向渐变打散成一块块独立的余烬斑，避免"内部有个灯泡"的观感
        float hb = fract(sin(dot(floor(vSealW * 2.7), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        float mott = 0.16 + 1.28 * hb;
        float charF = clamp(hz * (0.42 + uSealChar * 1.02) * (0.55 + 0.75 * hb), 0.0, 0.94);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.15, 0.12, 0.10), charF);
        totalEmissiveRadiance += vec3(1.0, 0.34, 0.08) * (uSealHeat * hz * mott * 0.72);
      }`);
};

const sealGroup = new THREE.Group();
scene.add(sealGroup);
const sealSlabs = [];
const sealAxisD = new THREE.Vector3(GAP_PERP[0], 0, -GAP_PERP[1]).normalize(); // 沿山脊的横向轴
const sealOutS = new THREE.Vector3(-GAP_UX, 0, GAP_UZ).normalize();             // 指向内江（河侧）

function sealGridPoint(gi, j) {
  const s = sealSCols[gi];
  const t = -1 + 2 * j / SEAL.nd;
  const at = Math.abs(t);
  const side = t < 0 ? -1 : 1;
  const rim = side > 0 ? sealRimN[gi] : sealRimS[gi];
  const r0 = rim * SEAL.edge;
  // 分三段：
  //  ① 内侧顶面 —— 直接取「未凿」原生山面，和两侧山体同一条解析曲面
  //  ② 外侧檐带（宽 1.35）—— 仍取原生山面（+0.06 抬起，避免共面闪烁）。
  //     作用是盖住地形网格按 0.89 间距离散后被削平的槽壁折线（实测那圈比原生面低 0.3~1.0），
  //     否则岩塞顶面收边处会留下一条高于地形的悬空唇口/阴影缝。
  //  ③ 最外一列 —— 陡降 3.2 埋进山体，于是岩塞与山体的交界落在原生面齐平处，看不出接缝。
  const FR = 0.72, BR = 0.95, BAND = 1.35, LIFT = 0.06;
  let d, y, p;
  if (at <= FR) {
    d = (at / FR) * r0;
    p = corridorPoint(s, d);
    y = ridgeSurfaceY(p[0], p[1]);
    // 只抖高度（横向不抖）：保证崖面上的裂隙带能与岩面贴死、且横向收边处严丝合缝
    if (j > 0 && j < SEAL.nd) y += (hash2(gi * 3.17 + 9.7, j * 0.77 + 4.3) - 0.5) * 0.14;
    return [p[0], y, p[1]];
  }
  if (at <= BR) {
    d = side * (r0 + ((at - FR) / (BR - FR)) * BAND);
    p = corridorPoint(s, d);
    y = ridgeSurfaceY(p[0], p[1]) + LIFT;
    return [p[0], y, p[1]];
  }
  d = side * (r0 + BAND + 0.30 * (at - BR) / (1 - BR));
  p = corridorPoint(s, d);
  y = Math.max(ridgeSurfaceY(p[0], p[1]) + LIFT - 3.2, SEAL.bottom + 0.55);
  return [p[0], y, p[1]];
}

function buildSealSlab(l) {
  const NS = SEAL.nsPerSlab, ND = SEAL.nd;
  const gi0 = l * NS;
  const pos = [], col = [], idx = [];
  const coord = [], top = [], bot = [];
  const addV = (X, y, Z, c) => {
    pos.push(X, y, -Z); col.push(c.r, c.g, c.b);   // PLAN → World（z 取反）
    return pos.length / 3 - 1;
  };
  for (let i = 0; i <= NS; i++) {
    const rowC = [], rowT = [], rowB = [];
    for (let j = 0; j <= ND; j++) {
      const p = sealGridPoint(gi0 + i, j);
      rowC.push(p);
      rowT.push(addV(p[0], p[1], p[2], sealSurfColor(p[0], p[2], p[1])));
      rowB.push(addV(p[0], SEAL.bottom, p[2], sealCutColor(p[0], p[2], SEAL.bottom)));
    }
    coord.push(rowC); top.push(rowT); bot.push(rowB);
  }
  const UP = [0, 1, 0], DN = [0, -1, 0];
  const OD = [GAP_PERP[0], 0, -GAP_PERP[1]], ODn = [-OD[0], 0, -OD[2]];
  const OS = [GAP_UX, 0, -GAP_UZ], OSn = [-OS[0], 0, -OS[2]];
  const push3 = (a, b, c, o) => {
    const ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2];
    const ux = pos[b * 3] - ax, uy = pos[b * 3 + 1] - ay, uz = pos[b * 3 + 2] - az;
    const vx = pos[c * 3] - ax, vy = pos[c * 3 + 1] - ay, vz = pos[c * 3 + 2] - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * o[0] + ny * o[1] + nz * o[2] >= 0) idx.push(a, b, c); else idx.push(a, c, b);
  };
  const quad = (a, b, c, d2, o) => { push3(a, b, c, o); push3(a, c, d2, o); };
  for (let i = 0; i < NS; i++) for (let j = 0; j < ND; j++) {
    quad(top[i][j], top[i + 1][j], top[i + 1][j + 1], top[i][j + 1], UP);
    quad(bot[i][j], bot[i + 1][j], bot[i + 1][j + 1], bot[i][j + 1], DN);
  }
  for (let i = 0; i < NS; i++) {
    quad(top[i][0], top[i + 1][0], bot[i + 1][0], bot[i][0], ODn);
    quad(top[i][ND], top[i + 1][ND], bot[i + 1][ND], bot[i][ND], OD);
  }
  for (let j = 0; j < ND; j++) {
    quad(top[0][j], top[0][j + 1], bot[0][j + 1], bot[0][j], OSn);
    quad(top[NS][j], top[NS][j + 1], bot[NS][j + 1], bot[NS][j], OS);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // 轴心放在“河侧底部中点”：绕横向轴外倾 → 像整片岩壁朝内江方向倒
  const c0 = coord[0][Math.floor(ND / 2)];
  const pivot = new THREE.Vector3(c0[0], 0.1, -c0[2]);   // PLAN → World
  g.translate(-pivot.x, -pivot.y, -pivot.z);
  const mesh = new THREE.Mesh(g, sealMat);
  mesh.name = 'seal-' + l;
  mesh.castShadow = true; mesh.receiveShadow = true;
  const grp = new THREE.Group();
  grp.position.copy(pivot);
  grp.add(mesh);
  sealGroup.add(grp);
  return { grp, mesh, pivot, surf: coord };
}
for (let l = 0; l < SEAL.slabs; l++) sealSlabs.push(buildSealSlab(l));

/* ---- 竖向节理：贴着崖面生长的「黑缝 + 余烬芯」，全部合批成 2 个 draw call ---- */
const fisUniforms = { uGrow: { value: 0 }, uHot: { value: 0 }, uFade: { value: 1 }, uFrontS: { value: -99 } };
const fisVert = `
  attribute float aDelay;
  attribute float aS;
  varying float vT; varying float vU; varying float vD; varying float vS;
  void main() {
    vT = uv.x; vU = uv.y; vD = aDelay; vS = aS;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const fisCrackMat = new THREE.ShaderMaterial({
  uniforms: fisUniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  vertexShader: fisVert,
  fragmentShader: `
    uniform float uGrow; uniform float uFade; uniform float uFrontS;
    varying float vT; varying float vU; varying float vD; varying float vS;
    void main() {
      // 缝只长在还没被撬掉的岩体上：前锋推过后，悬在半空的缝必须一起消失
      if (vS < uFrontS) discard;
      float g = smoothstep(0.0, 1.0, (uGrow - vD) / 0.30);
      float a = (1.0 - smoothstep(0.30, 1.0, abs(vU))) * uFade * clamp(uGrow * 2.4, 0.0, 1.0);
      if (vT > g || a < 0.02) discard;
      gl_FragColor = vec4(0.095, 0.072, 0.060, a * 0.95);
    }`,
});
const fisCoreMat = new THREE.ShaderMaterial({
  uniforms: fisUniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  blending: THREE.AdditiveBlending,
  vertexShader: fisVert,
  fragmentShader: `
    uniform float uGrow; uniform float uHot; uniform float uFade; uniform float uFrontS;
    varying float vT; varying float vU; varying float vD; varying float vS;
    void main() {
      if (vS < uFrontS) discard;
      float g = smoothstep(0.0, 1.0, (uGrow - vD) / 0.30);
      float c = 1.0 - abs(vU);
      float a = (1.0 - smoothstep(0.10, 1.0, abs(vU))) * uHot * uFade;
      if (vT > g || a < 0.01) discard;
      vec3 hot = mix(vec3(0.95, 0.24, 0.05), vec3(1.0, 0.84, 0.42), c * c);
      // 缝芯只是「透出的余烬」，压到 1.05 免得像霓虹灯管
      gl_FragColor = vec4(hot * a * 1.05, a * 0.88);
    }`,
});

function buildFissures() {
  const crack = { p: [], uv: [], del: [], i: [], surfY: [], ss: [] };
  const core  = { p: [], uv: [], del: [], i: [], surfY: [], ss: [] };
  const defs = [
    { d: -1.90, yTop: 3.2, delay: 0.02, w: 0.21 },
    { d: -1.22, yTop: 4.7, delay: 0.17, w: 0.17 },
    { d: -0.48, yTop: 5.6, delay: 0.31, w: 0.23 },
    { d:  0.26, yTop: 5.2, delay: 0.10, w: 0.19 },
    { d:  1.02, yTop: 4.3, delay: 0.25, w: 0.17 },
    { d:  1.82, yTop: 3.0, delay: 0.39, w: 0.15 },
  ];
  defs.forEach((def, fi) => {
    const path = [];
    for (let s = SEAL.s0 + 0.05; s <= SEAL.s1 - 1.0; s += 0.16) {
      const limN = sealRimAt(s, 1) * 0.90, limS = sealRimAt(s, -1) * 0.90;
      const d = clamp(def.d + 0.14 * Math.sin(s * 2.7 + fi * 1.9), -limS, limN);
      const p = sealSurfacePoint(s, d);
      if (path.length === 0 && p[1] < -0.10) continue;   // 水面以下的岩面不画缝
      if (path.length > 3 && p[1] > def.yTop) break;
      if (path.length > 3 && p[1] < path[path.length - 1].p[1] - 0.03) break;
      path.push({ s, d, p });
    }
    if (path.length < 4) return;
    const n = path.length;
    const baseC = crack.p.length / 3, baseK = core.p.length / 3;
    for (let k = 0; k < n; k++) {
      const cur = path[k];
      const nrm = sealSurfNormal(cur.s, cur.d);
      const pa = path[Math.max(0, k - 1)].p, pb = path[Math.min(n - 1, k + 1)].p;
      let tx = pb[0] - pa[0], ty = pb[1] - pa[1], tz = pb[2] - pa[2];
      const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      let ax = nrm[1] * tz - nrm[2] * ty, ay = nrm[2] * tx - nrm[0] * tz, az = nrm[0] * ty - nrm[1] * tx;
      const al = Math.hypot(ax, ay, az) || 1; ax /= al; ay /= al; az /= al;
      const u = k / (n - 1);
      const wC = def.w * (1 - u * 0.86) + 0.022;
      const wK = wC * 0.40;
      const offC = 0.11, offK = 0.135;
      // PLAN → World：z 分量整体取反（与岩体同一镜像）
      crack.p.push(
        cur.p[0] + nrm[0] * offC - ax * wC * 0.5, cur.p[1] + nrm[1] * offC - ay * wC * 0.5, -(cur.p[2] + nrm[2] * offC - az * wC * 0.5),
        cur.p[0] + nrm[0] * offC + ax * wC * 0.5, cur.p[1] + nrm[1] * offC + ay * wC * 0.5, -(cur.p[2] + nrm[2] * offC + az * wC * 0.5)
      );
      crack.uv.push(u, -1, u, 1);
      crack.del.push(def.delay, def.delay);
      crack.ss.push(cur.s, cur.s);   // 该顶点所在走廊里程，供着色器按「开凿前锋」裁掉已坍落的缝
      crack.surfY.push(cur.p[1]);   // 该对顶点的「解析岩面高程」，供 audit() 校验法向偏移量
      core.p.push(
        cur.p[0] + nrm[0] * offK - ax * wK * 0.5, cur.p[1] + nrm[1] * offK - ay * wK * 0.5, -(cur.p[2] + nrm[2] * offK - az * wK * 0.5),
        cur.p[0] + nrm[0] * offK + ax * wK * 0.5, cur.p[1] + nrm[1] * offK + ay * wK * 0.5, -(cur.p[2] + nrm[2] * offK + az * wK * 0.5)
      );
      core.uv.push(u, -1, u, 1);
      core.del.push(def.delay, def.delay);
      core.ss.push(cur.s, cur.s);
      core.surfY.push(cur.p[1]);
    }
    for (let k = 0; k < n - 1; k++) {
      const a = baseC + k * 2;
      crack.i.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      const b = baseK + k * 2;
      core.i.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
  });
  const mk = (buf, mat) => {
    if (!buf.p.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(buf.p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(buf.uv, 2));
    g.setAttribute('aDelay', new THREE.Float32BufferAttribute(buf.del, 1));
    g.setAttribute('aS', new THREE.Float32BufferAttribute(buf.ss, 1));
    g.setIndex(buf.i);
    const m = new THREE.Mesh(g, mat);
    m.name = 'seal-fissure';
    m.userData.surfY = buf.surfY;
    m.userData.off = buf === crack ? 0.11 : 0.135;
    m.frustumCulled = false;
    m.renderOrder = 3;
    scene.add(m);
    sealFissureMeshes.push(m);
    return m;
  };
  mk(crack, fisCrackMat);
  mk(core, fisCoreMat);
}
buildFissures();
// 泼水沃裂：三股引水细流（quench 阶段自崖顶浇下，正对三堆柴薪）
const quenchGroup = new THREE.Group();
const quenchMat = new THREE.MeshBasicMaterial({ color: '#dceff8', transparent: true, opacity: 0, depthWrite: false });
const quenchStreams = [];
[[0.98, -1.18, 0.10], [1.04, 0.06, -0.04], [0.98, 1.24, 0.12]].forEach(([s, d, tilt], i) => {
  const [X, Z] = corridorPoint(s, d);
  const h = 5.2;
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.020, h, 5, 1, true), quenchMat);
  cyl.position.copy(p2w(X, Z, 2.72 + i * 0.06));
  cyl.rotation.z = tilt;
  cyl.rotation.x = tilt * 0.5;
  quenchGroup.add(cyl);
  quenchStreams.push(cyl);
});
quenchGroup.visible = false;
scene.add(quenchGroup);

// 绕山南引（错误分支 #1）显示的试挖浅干沟
const bypassDitch = makeRibbonMesh(
  [[11.8, -33.5], [16.5, -36.5], [22.0, -37.2]],
  [1.4, 1.0], 0.25,
  new THREE.MeshStandardMaterial({ color: '#7a684d', roughness: 1.0, flatShading: true })
);
bypassDitch.visible = false;
scene.add(bypassDitch);

/* ============================================================================
 * 8. 规范部件库：竹笼 InstancedMesh(×3)、鱼嘴、飞沙堰、杩槎、火塘、石人水则、分支替代件
 * ========================================================================== */
const bambooTex = makeBambooTexture();

// --- 8.1 全局合批竹笼池（仅 3 个 InstancedMesh = 3 draw calls!） ---
const gabionItems = []; // { x, y, z, rotY, scale, group: 'dike'|'weirLow'|'weirHigh', order }
function samplePolylineWithAngle(pts, step) {
  const out = [];
  let rem = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const angle = Math.atan2(bz - az, bx - ax); // World rotY (since world z = -Z)
    const nx = -(bz - az) / len, nz = (bx - ax) / len; // East normal in PLAN
    for (let d = rem; d < len; d += step) {
      const t = d / len;
      out.push({ X: ax + (bx - ax) * t, Z: az + (bz - az) * t, angle, nx, nz });
    }
    rem = ((rem - len) % step + step) % step;
  }
  return out;
}

// ---- 金刚堤中轴的弧长参数化（s = 沿堤里程，n = 横向偏移，n>0 指向内江/东侧）----
const DIKE_LEN = (() => {
  let L = 0;
  for (let i = 0; i < DIKE_AXIS.length - 1; i++) {
    L += Math.hypot(DIKE_AXIS[i + 1][0] - DIKE_AXIS[i][0], DIKE_AXIS[i + 1][1] - DIKE_AXIS[i][1]);
  }
  return L;
})();
function dikeFrameAt(s) {
  const t = clamp(s, 0, DIKE_LEN);
  let acc = 0;
  for (let i = 0; i < DIKE_AXIS.length - 1; i++) {
    const [ax, az] = DIKE_AXIS[i], [bx, bz] = DIKE_AXIS[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    if (acc + len >= t || i === DIKE_AXIS.length - 2) {
      const dx = (bx - ax) / len, dz = (bz - az) / len;
      return {
        X: ax + dx * (t - acc), Z: az + dz * (t - acc),
        dx, dz, nx: -dz, nz: dx,               // 东法向（n>0 即内江侧）
        angle: Math.atan2(dz, dx),             // World rotY（z 取反后仍成立）
      };
    }
    acc += len;
  }
}

// 三种用料的断面配置：坡比 = 水平进深 / 竖直高度（tan 的倒数）
// 竹笼束缚可做陡坡窄堤；散抛石受水下休止角限制；夯土需缓坡宽底防渗
// 三套用料断面：内江坡陡（迎溜抗冲）、外江坡缓（泄流落淤）
// 坡比由 hMax 与 sIn/sOut 共同决定：tanθ = (hCrest+0.62) / s，故改高度必须同步改坡比
const C_DIKE_CREST = new THREE.Color('#bda582');   // 堤顶压实黄土（比坡面亮，避免顶面被读成一块黑板）
const DIKE_PROFILES = {
  // 堤顶必须常年露出水面（洪水位 0.72 → 堤顶压在 1.0 以上）：金刚堤是内外江之间的陆上长堤，
  // 只有鱼嘴鼻端破水，堤身不是"半沉在水里的一道坎"。飞沙堰才是近水面的矮堰。
  gabion: { wTop: 1.20, sIn: 0.782, sOut: 1.600, hMax: 1.30, hTail: 1.12, jitter: 0.055, colA: '#8c8574', colB: '#4a4536' },
  stone:  { wTop: 0.85, sIn: 1.351, sOut: 2.052, hMax: 1.18, hTail: 1.04, jitter: 0.170, colA: '#8b877c', colB: '#4b4942' },
  earth:  { wTop: 1.85, sIn: 1.794, sOut: 2.454, hMax: 1.36, hTail: 1.18, jitter: 0.025, colA: '#a68d5e', colB: '#6b5a3e' },
};

// 某里程处的断面：堤顶高、堤顶半宽、内外坡脚横向位置
function dikeProfileAt(s, cfg) {
  const u = clamp(s / DIKE_LEN, 0, 1);
  const head = smoothstep(clamp(s / 4.6, 0, 1), 0, 1);            // 鱼嘴鼻部纵向爬升
  const crestAt = lerp(cfg.hMax, cfg.hTail, Math.pow(u, 0.85));    // 顺河缓降至堰尾
  const hCrest = lerp(-0.48, crestAt, head);                       // 鼻尖没入水中
  const wMul = Math.max(0.10, Math.pow(clamp(s / 5.2, 0, 1), 0.62)); // 60° 楔形收分
  const hwTop = 0.5 * cfg.wTop * wMul;
  const rise = Math.max(0.12, hCrest + 0.62);
  const nOut = -(hwTop + rise * cfg.sOut * (0.45 + 0.55 * wMul));
  const nIn  =  (hwTop + rise * cfg.sIn  * (0.45 + 0.55 * wMul));
  return { hCrest, hwTop, nOut, nIn, wMul };
}

// 核体：6 顶点非对称断面沿堤轴扫掠（内江陡、外江缓），底裙埋到 -1.10 防悬空
function buildDikeCoreGeo(cfg, ns = 46) {
  const pos = [], col = [], idx = [];
  const cA = new THREE.Color(cfg.colA), cB = new THREE.Color(cfg.colB);
  const c = new THREE.Color();
  const meta = { slopeIn: 0, slopeOut: 0, wBot: 0, crestMax: -9, count: 0 };
  const ring = (s) => {
    const f = dikeFrameAt(s), pr = dikeProfileAt(s, cfg);
    const j = (k) => (hash2(s * 1.7 + k * 0.31, k * 3.1 + 0.7) - 0.5) * cfg.jitter;
    const pts = [
      [pr.nOut - 0.34, -1.10, 0],
      [pr.nOut, -0.62, 1],
      [-pr.hwTop, pr.hCrest + j(2), 2],
      [ pr.hwTop, pr.hCrest + j(3), 3],
      [pr.nIn, -0.62, 4],
      [pr.nIn + 0.34, -1.10, 5],
    ];
    return pts.map(([n, y, k]) => {
      const X = f.X + f.nx * n, Z = f.Z + f.nz * n;
      pos.push(X, y, -Z);                                   // PLAN → World（z 取反）
      const wet = smoothstep(y, -0.55, 0.40);
      c.copy(cB).lerp(cA, wet);
      // 堤顶是被踩实压光的黄土/碎石路面，比两侧坡面亮一档，否则整条堤读成一块黑板
      const crestLift = 1 - smoothstep(y, pr.hCrest - 0.42, pr.hCrest);
      if (crestLift > 0.001) c.lerp(C_DIKE_CREST, crestLift * 0.72);
      // 石料感：高频斑驳 + 少量深色块石，避免整条堤读成「沙丘」
      const hs = hash2(X * 3.1, Z * 3.7);
      const tone = 0.88 + hs * 0.24;
      if (hs > 0.90) c.multiplyScalar(0.72);
      col.push(c.r * tone, c.g * tone, c.b * tone);
      return { X, Z, y };
    });
  };
  for (let i = 0; i <= ns; i++) {
    const s = (i / ns) * DIKE_LEN;
    ring(s);
    if (i > 0) {
      for (let k = 0; k < 5; k++) {
        const a = (i - 1) * 6 + k, b = a + 1, cc = i * 6 + k, d = cc + 1;
        idx.push(a, cc, b, b, cc, d);
      }
    }
    const u = clamp(s / DIKE_LEN, 0, 1);
    const pr = dikeProfileAt(s, cfg);
    // 只统计直堤段（u 0.35~0.85）：鼻部是收分爬升段，坡角由收分决定，混进来会拉低平均值
    if (u > 0.35 && u < 0.85) {
      const rise = Math.max(0.2, pr.hCrest + 0.62);
      meta.slopeIn += (Math.atan2(rise, pr.nIn - pr.hwTop) * 180) / Math.PI;
      meta.slopeOut += (Math.atan2(rise, -pr.nOut - pr.hwTop) * 180) / Math.PI;
      meta.count++;
    }
    if (u > 0.12 && u < 0.80) {
      meta.wBot = Math.max(meta.wBot, pr.nIn - pr.nOut);
      meta.crestMax = Math.max(meta.crestMax, pr.hCrest);
    }
  }
  // 尾端封盖（鼻端退化为一尖，无需封）
  const tail = ns * 6;
  for (let k = 1; k < 4; k++) idx.push(tail + 2, tail + k + 1, tail + k);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  meta.slopeIn = +(meta.slopeIn / Math.max(1, meta.count)).toFixed(1);
  meta.slopeOut = +(meta.slopeOut / Math.max(1, meta.count)).toFixed(1);
  meta.wBot = +meta.wBot.toFixed(2);
  meta.crestMax = +meta.crestMax.toFixed(3);
  return { geo, meta };
}

// 三种用料各建一套（几何只建一次，运行时只切 visible）
const dikeCoreMat = new THREE.MeshStandardMaterial({
  vertexColors: true, flatShading: true, roughness: 0.97, metalness: 0.0, side: THREE.DoubleSide,
});
const dikeCoreMeshes = {};
const dikeCoreMeta = {};
for (const key of Object.keys(DIKE_PROFILES)) {
  const { geo, meta } = buildDikeCoreGeo(DIKE_PROFILES[key]);
  const m = new THREE.Mesh(geo, dikeCoreMat);
  m.name = 'dike-core-' + key;
  m.castShadow = m.receiveShadow = true;
  m.visible = key === 'gabion';
  scene.add(m);
  dikeCoreMeshes[key] = m;
  dikeCoreMeta[key] = meta;
}

// 护面竹笼：贴着核体坡面分层错缝铺放，鱼嘴鼻端用左右交替小角度笼帽收尖。
// 尺寸按 c.l / c.r 做非等比缩放（长 ~1.05、径 ~0.52），相邻层沿堤轴错开半笼，避免「三排香肠」。
const DIKE_CFG = DIKE_PROFILES.gabion;
(function placeDikeArmor() {
  const step = 0.78;
  const courses = [
    { side: 'out', t: 0.22, r: 0.24, l: 0.66, dy: 0.11 },  // 坡脚护脚笼
    { side: 'out', t: 0.62, r: 0.23, l: 0.64, dy: 0.12 },
    { side: 'in',  t: 0.58, r: 0.23, l: 0.64, dy: 0.12 },  // 内江陡坡
    { side: 'crest', t: 0.0, r: 0.24, l: 0.68, dy: 0.13, n: -0.30 }, // 堤顶压盖（三排错缝）
    { side: 'crest', t: 0.0, r: 0.24, l: 0.68, dy: 0.13, n: 0.00 },
    { side: 'crest', t: 0.0, r: 0.24, l: 0.68, dy: 0.13, n: 0.30 },
  ];
  for (let s = 0.55; s < DIKE_LEN - 0.20; s += step) {
    const u = clamp(s / DIKE_LEN, 0, 1);
    courses.forEach((c, ci) => {
      const ss = s + (ci % 2 ? step * 0.5 : 0);       // 错缝
      if (ss >= DIKE_LEN - 0.12) return;
      const f = dikeFrameAt(ss), pr = dikeProfileAt(ss, DIKE_CFG);
      let n, y;
      if (c.side === 'crest') {
        n = c.n * (0.6 + 0.4 * pr.wMul);
        y = pr.hCrest + c.dy;
      } else if (c.side === 'out') {
        n = Math.max(lerp(pr.nOut, -pr.hwTop, c.t), pr.nOut + 0.16);
        y = lerp(-0.50, pr.hCrest, c.t) + c.dy;
      } else {
        n = Math.min(lerp(pr.nIn, pr.hwTop, c.t), pr.nIn - 0.16);
        y = lerp(-0.50, pr.hCrest, c.t) + c.dy;
      }
      const j = hash2(ss * 2.3 + ci * 1.7, ci * 3.1 + 0.5);
      gabionItems.push({
        X: f.X + f.nx * n, Z: f.Z + f.nz * n,
        y: y + (j - 0.5) * 0.05,
        rotY: f.angle + (j - 0.5) * 0.10,
        scale: 1.0, r: c.r * (0.96 + j * 0.08), l: c.l * (0.96 + j * 0.08),
        kind: 'dike', order: clamp(u + ci * 0.010, 0, 1),
      });
    });
  }
  // 鱼嘴破水尖：两层放射压盖笼收成 60° 楔形尖
  for (let i = 0; i < 2; i++) {
    const s = 0.28 + i * 0.52;
    const f = dikeFrameAt(s), pr = dikeProfileAt(s, DIKE_CFG);
    for (const side of [-1, 1]) {
      gabionItems.push({
        X: f.X + f.nx * side * (0.30 + i * 0.14), Z: f.Z + f.nz * side * (0.30 + i * 0.14),
        y: pr.hCrest + 0.14 + i * 0.04,
        rotY: f.angle + side * (0.42 - i * 0.10), scale: 0.86 + i * 0.04,
        r: 0.62, l: 0.70, kind: 'dike', order: 0.004 * (i + 1),
      });
    }
  }
})();

// --- 8.4 飞沙堰 ------------------------------------------------------------
// 形态学特征：迎水坡极缓（1:3.5 ≈ 16°），宽顶，背水舌面 1:4.2（13°）——这是「溢流堰」
// 与「挡水堤」的根本区别；堰后设冲刷坑与排沙卵石扇，东端以人字堤闭气接离堆崖脚。
const WEIR_LOW  = { zCrest: 0.62, zTongue: -0.42, wTop: 1.60, sUp: 3.5, sDown: 4.2, colA: '#8c8372', colB: '#464033' };
const WEIR_HIGH = { zCrest: 1.24, zTongue: -0.42, wTop: 1.60, sUp: 2.4, sDown: 4.2, colA: '#8c8372', colB: '#464033' };

function weirFrameAt(w) {
  let acc = 0;
  for (let i = 0; i < WEIR_AXIS.length - 1; i++) {
    const [ax, az] = WEIR_AXIS[i], [bx, bz] = WEIR_AXIS[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    if (w <= acc + len || i === WEIR_AXIS.length - 2) {
      const t = clamp((w - acc) / len, 0, 1);
      const dx = (bx - ax) / len, dz = (bz - az) / len;
      return { X: ax + (bx - ax) * t, Z: az + (bz - az) * t, dx, dz,
               nx: -dz, nz: dx, angle: Math.atan2(dz, dx) };
    }
    acc += len;
  }
}
const WEIR_LEN = (() => {
  let L = 0;
  for (let i = 0; i < WEIR_AXIS.length - 1; i++) L += Math.hypot(WEIR_AXIS[i + 1][0] - WEIR_AXIS[i][0], WEIR_AXIS[i + 1][1] - WEIR_AXIS[i][1]);
  return L;
})();

function buildWeirGeo(cfg, withStops = true) {
  const ns = Math.max(24, Math.round(WEIR_LEN * 5));
  const pos = [], col = [], idx = [];
  const cA = new THREE.Color(cfg.colA), cB = new THREE.Color(cfg.colB), c = new THREE.Color();
  const hwTop = cfg.wTop * 0.5;
  const upToe = hwTop + (cfg.zCrest + 0.55) * cfg.sUp;   // 迎水坡（北侧，来水）
  const dnToe = hwTop + (cfg.zCrest + 0.42) * cfg.sDown; // 背水舌面（南侧，排洪）
  const ring = (w) => {
    const f = weirFrameAt(w);
    const j = (hash2(w * 3.7, 11.3) - 0.5) * 0.05;
    const pts = [
      [-upToe - 0.30, -0.62], // 迎水坡脚
      [-upToe, -0.10],        // 迎水坡（极缓，堰体没入水中）
      [-hwTop, cfg.zCrest + j],
      [ hwTop, cfg.zCrest + j],
      [ dnToe, -0.10],        // 舌面
      [ dnToe + 0.30, -0.62],
    ];
    for (const [n, y] of pts) {
      const X = f.X + f.nx * n, Z = f.Z + f.nz * n;
      pos.push(X, y, -Z);
      const wet = smoothstep(y, -0.55, 0.40);
      c.copy(cB).lerp(cA, wet);
      const tone = 0.80 + hash2(X * 3.1, Z * 3.7) * 0.30;
      col.push(c.r * tone, c.g * tone, c.b * tone);
    }
    return f;
  };
  for (let i = 0; i <= ns; i++) {
    ring((i / ns) * WEIR_LEN);
    if (i > 0) {
      for (let k = 0; k < 5; k++) {
        const a = (i - 1) * 6 + k, b = a + 1, cc = i * 6 + k, d = cc + 1;
        idx.push(a, cc, b, b, cc, d);
      }
    }
  }
  if (withStops) { // 两端封盖
    for (let k = 1; k < 5; k++) idx.push(0, k, k + 1);
    const t0 = ns * 6;
    for (let k = 1; k < 5; k++) idx.push(t0, t0 + k + 1, t0 + k);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

const weirBodyMat = new THREE.MeshStandardMaterial({
  vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0.0, side: THREE.DoubleSide,
});
const weirLowMesh  = new THREE.Mesh(buildWeirGeo(WEIR_LOW),  weirBodyMat);
const weirHighMesh = new THREE.Mesh(buildWeirGeo(WEIR_HIGH), weirBodyMat);
weirLowMesh.name = 'weir-body-low';  weirHighMesh.name = 'weir-body-high';
weirLowMesh.receiveShadow = weirHighMesh.receiveShadow = true;
weirLowMesh.castShadow = weirHighMesh.castShadow = true;
weirLowMesh.visible = true; weirHighMesh.visible = false;
scene.add(weirLowMesh); scene.add(weirHighMesh);

/* 漫堰白水：低堰顶托到洪水位时，堰顶溢流在背水舌面外侧铺开的一层白水/泡沫带。
 * 这不是装饰 —— 枯水期它必须看不见（水位低于堰顶，堰把江水挡进宝瓶口），
 * 只有 floodLvl 越过堰顶才出现，配合飞沫表现「多余洪水连沙一起漫顶甩回外江」。
 * 几何做在 y=0 的平面上，运行时由 applyFrame 抬到当前水面之上 —— 跟着水位走，
 * 枯水/洪水过渡时不会出现"白水浮在半空"的穿帮。 */
const spillGeo = (() => {
  const pos = [], uv = [], idx = [];
  const ns = 34, hw = WEIR_LOW.wTop * 0.5;
  // 注意：+n 指向上游（内江来水侧），漫顶水舌必须铺在 -n（下游/外江）侧，否则白水会藏在堰顶背后
  const rows = [{ n: -(hw + 0.02), v: 0.0 }, { n: -(hw + 0.95), v: 0.45 }, { n: -(hw + 2.45), v: 1.0 }];
  for (let i = 0; i <= ns; i++) {
    const f = weirFrameAt((i / ns) * WEIR_LEN);
    for (const r of rows) {
      const X = f.X + f.nx * r.n, Z = f.Z + f.nz * r.n;
      pos.push(X, 0, -Z);
      uv.push(i / ns, r.v);
    }
    if (i > 0) {
      for (let k = 0; k < rows.length - 1; k++) {
        const a = (i - 1) * rows.length + k, b = a + 1;
        const c = i * rows.length + k, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
})();
const spillUniforms = { uTime: { value: 0 }, uAmt: { value: 0 } };
const spillSheet = new THREE.Mesh(spillGeo, new THREE.ShaderMaterial({
  uniforms: spillUniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  vertexShader: `varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform float uTime, uAmt; varying vec2 vUv;
    void main() {
      if (uAmt < 0.01) discard;
      // 顺流方向（vUv.y 0→1 由堰顶向外江）滚动的泡沫条纹
      float s = fract(vUv.y * 2.2 - uTime * 0.95 + vUv.x * 6.0);
      float streak = 0.40 + 0.60 * smoothstep(0.22, 0.0, abs(s - 0.5));
      // 堰顶一侧最白（刚翻过堰顶），往外江逐渐散开变淡
      float lip  = 1.0 - smoothstep(0.02, 0.20, vUv.y);
      float fade = 1.0 - smoothstep(0.35, 1.0, vUv.y);
      float a = uAmt * (0.62 * lip + 0.52 * fade) * streak;
      if (a < 0.012) discard;
      gl_FragColor = vec4(0.92, 0.96, 0.97, a);
    }`,
}));
spillSheet.name = 'weir-spill';
spillSheet.renderOrder = 2;
spillSheet.frustumCulled = false;
spillSheet.visible = false;
scene.add(spillSheet);

// 人字堤：堰东端 → 离堆崖脚（闭气段，顶高 +0.95），把飞沙堰与山体之间约 4 单位的缺口堵上
const RENZI_AXIS = [[9.60, -17.05], [11.55, -17.55], [13.35, -18.15]];
const renziGeo = (() => {
  const pos = [], idx = [], ns = 18;
  const ringN = (t) => {
    const seg = t < 0.5 ? 0 : 1;
    const [ax, az] = RENZI_AXIS[seg], [bx, bz] = RENZI_AXIS[seg + 1];
    const u = (t - seg * 0.5) * 2;
    return { X: ax + (bx - ax) * u, Z: az + (bz - az) * u,
             nx: -((bz - az) / Math.hypot(bx - ax, bz - az)), nz: (bx - ax) / Math.hypot(bx - ax, bz - az) };
  };
  for (let i = 0; i <= ns; i++) {
    const t = i / ns, f = ringN(t), h = 0.95, hw = 0.55;
    const pts = [[-hw - 1.05, -0.55], [-hw, h], [hw, h], [hw + 1.05, -0.55]];
    for (const [n, y] of pts) pos.push(f.X + f.nx * n, y, -(f.Z + f.nz * n));
    if (i > 0) {
      for (let k = 0; k < 3; k++) {
        const a = (i - 1) * 4 + k, b = a + 1, cc = i * 4 + k, d = cc + 1;
        idx.push(a, cc, b, b, cc, d);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
})();
const renziMesh = new THREE.Mesh(renziGeo, new THREE.MeshStandardMaterial({
  color: 0x6f6a5c, flatShading: true, roughness: 0.96, side: THREE.DoubleSide,
}));
renziMesh.name = 'renzi-dike';
renziMesh.visible = false;
scene.add(renziMesh);

// 堰后冲刷坑（n_w ∈ [3.4, 5.8]，坑底 −0.98）与排沙卵石扇
const scourGroup = new THREE.Group();
scourGroup.name = 'scour';
const pitGeo = new THREE.CircleGeometry(2.6, 14);
pitGeo.rotateX(-Math.PI / 2);
const pitMesh = new THREE.Mesh(pitGeo, new THREE.MeshStandardMaterial({
  color: 0x2f3a38, roughness: 0.55, metalness: 0.0, transparent: true, opacity: 0.72,
}));
pitMesh.position.copy(p2w(7.4, -21.2, -0.92));
pitMesh.scale.set(1.25, 1, 0.78);
scourGroup.add(pitMesh);
const pebbleGeo = new THREE.IcosahedronGeometry(0.16, 0);
pebbleGeo.scale(1.5, 0.34, 1.1);
const pebbleMat = new THREE.MeshStandardMaterial({ color: 0x9c9180, roughness: 0.95, flatShading: true });
{ // 26 颗卵石合批成一个 mesh（省 25 个 draw call）
  const list = [];
  for (let i = 0; i < 26; i++) {
    const a = hash2(i * 2.7, 5.1), b = hash2(i * 1.3, 9.7);
    const m = new THREE.Matrix4();
    m.compose(
      p2w(5.2 + a * 5.6, -19.6 - b * 3.4, -0.34 + b * 0.10),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a * 6.28, 0)),
      new THREE.Vector3(1, 1, 1).multiplyScalar(0.7 + b * 0.9)
    );
    list.push({ geo: pebbleGeo, m });
  }
  scourGroup.add(new THREE.Mesh(mergeGeos(list), pebbleMat));
}
scourGroup.visible = false;
scene.add(scourGroup);

// 飞沙堰堰顶竹笼（正常低堰 2 排 + 错误分支高堰额外 2 层）
const weirSamples = samplePolylineWithAngle(WEIR_AXIS, 1.05);
weirSamples.forEach((s, idx) => {
  for (const lat of [-0.42, 0.42]) {
    gabionItems.push({
      X: s.X + s.nx * lat, Z: s.Z + s.nz * lat, y: WEIR_LOW.zCrest + 0.10,
      rotY: s.angle, scale: 0.92, r: 0.34, l: 0.74, kind: 'weirLow', order: idx / weirSamples.length,
    });
  }
  // 高堰错误分支（+1.24 顶高封死溢流）：把低堰顶再压两层笼
  for (const hExtra of [WEIR_HIGH.zCrest - 0.20, WEIR_HIGH.zCrest + 0.18]) {
    gabionItems.push({
      X: s.X, Z: s.Z, y: hExtra,
      rotY: s.angle, scale: 0.92, r: 0.30, l: 0.70, kind: 'weirHigh', order: idx / weirSamples.length,
    });
  }
});

// 3 层竹笼几何（§E.3 样例 1：9 边圆筒 + 4 道合批箍 + 两端石簇）
const gabShellGeo = new THREE.CylinderGeometry(0.40, 0.40, 1.42, 9, 1, false);
gabShellGeo.rotateZ(Math.PI / 2);
gabShellGeo.translate(0, 0.40, 0);

const hoopGeos = [-0.54, -0.18, 0.18, 0.54].map(ox => {
  const t = new THREE.TorusGeometry(0.415, 0.036, 4, 10);
  t.rotateY(Math.PI / 2);
  t.translate(ox, 0.40, 0);
  return t;
});
const gabHoopGeo = mergeGeometries(hoopGeos);

const endStoneGeos = [];
for (const side of [-1, 1]) {
  for (let k = 0; k < 3; k++) {
    const a = k * 2.1 + side;
    const st = new THREE.IcosahedronGeometry(0.15, 0);
    st.scale(0.65, 1.0, 1.0);
    st.translate(side * 0.72, 0.40 + Math.sin(a) * 0.14, Math.cos(a) * 0.14);
    endStoneGeos.push(st);
  }
}
const gabStoneGeo = mergeGeometries(endStoneGeos);

const gabShellMat = new THREE.MeshStandardMaterial({ map: bambooTex, color: '#dfcca3', roughness: 0.94, flatShading: false });
const gabHoopMat  = new THREE.MeshStandardMaterial({ color: '#6e5633', roughness: 0.96, flatShading: true });
const gabStoneMat = new THREE.MeshStandardMaterial({ color: '#8f897d', roughness: 0.94, flatShading: true });

const gabShellIM = new THREE.InstancedMesh(gabShellGeo, gabShellMat, gabionItems.length);
const gabHoopIM  = new THREE.InstancedMesh(gabHoopGeo, gabHoopMat, gabionItems.length);
const gabStoneIM = new THREE.InstancedMesh(gabStoneGeo, gabStoneMat, gabionItems.length);
gabShellIM.castShadow = gabShellIM.receiveShadow = true;
gabHoopIM.castShadow = true;
gabShellIM.frustumCulled = gabHoopIM.frustumCulled = gabStoneIM.frustumCulled = false;

const gabionGroup = new THREE.Group();
gabionGroup.add(gabShellIM, gabHoopIM, gabStoneIM);
scene.add(gabionGroup);

// 分支替代件：三种用料各有一套核体（几何已建好，只切 visible），散石另加表层乱石
const earthDikeMesh = null;   // 已被 dike-core-earth 取代，保留变量名兼容旧引用

// 散石堤复用竹笼点位，换无箍灰岩块 InstancedMesh
const looseStoneGeo = new THREE.IcosahedronGeometry(0.62, 0);
looseStoneGeo.scale(1.15, 0.85, 0.95);
looseStoneGeo.translate(0, 0.35, 0);
const looseStoneIM = new THREE.InstancedMesh(
  looseStoneGeo,
  new THREE.MeshStandardMaterial({ color: '#87837a', roughness: 0.96, flatShading: true }),
  gabionItems.length
);
looseStoneIM.castShadow = looseStoneIM.receiveShadow = true;
looseStoneIM.visible = false;
looseStoneIM.frustumCulled = false;
scene.add(looseStoneIM);

// --- 8.2 传统截流木架（后世称杩槎，§E.3 样例 2，修正坐标至内江槽中 +4.20, +8.10） ---
function buildMachaUnit() {
  const g = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: '#8b6c43', roughness: 0.95, flatShading: true });
  const ropeMat = new THREE.MeshStandardMaterial({ color: '#6b5332', roughness: 0.98, flatShading: true });
  const matMat  = new THREE.MeshStandardMaterial({ map: bambooTex, color: '#a88f5e', roughness: 0.94, side: THREE.DoubleSide });
  const rockMat = new THREE.MeshStandardMaterial({ color: '#7d7a72', roughness: 0.93, flatShading: true });

  const apex = new THREE.Vector3(0, 2.65, 0);
  const poleGeos = [];
  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * Math.PI * 2 + Math.PI / 6;
    const base = new THREE.Vector3(Math.cos(ang) * 1.35, 0, Math.sin(ang) * 1.35);
    const dir = apex.clone().sub(base);
    const len = dir.length() + 0.35; // 顶叉伸出 0.35
    const cyl = new THREE.CylinderGeometry(0.065, 0.088, len, 5);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    const m = new THREE.Matrix4().compose(base.clone().addScaledVector(dir.normalize(), len * 0.5), q, new THREE.Vector3(1, 1, 1));
    cyl.applyMatrix4(m);
    poleGeos.push(cyl);
  }
  // 2 根迎水横木（朝局部 -Z）
  for (const hy of [0.85, 1.85]) {
    const bar = new THREE.CylinderGeometry(0.055, 0.06, 2.25, 5);
    bar.rotateZ(Math.PI / 2);
    bar.translate(0, hy, -0.68 + (hy - 0.85) * 0.25);
    poleGeos.push(bar);
  }
  const frameMesh = new THREE.Mesh(mergeGeometries(poleGeos), woodMat);
  frameMesh.castShadow = true;
  g.add(frameMesh);

  const lashing = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.055, 4, 8), ropeMat);
  lashing.position.copy(apex);
  lashing.rotation.x = Math.PI / 2;
  g.add(lashing);

  // 迎水竹席（局部 -Z 朝上游，后倾 18°）
  const matMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.1, 3, 2), matMat);
  matMesh.position.set(0, 1.05, -0.58);
  matMesh.rotation.x = -0.31;
  matMesh.castShadow = true;
  matMesh.name = 'mat';
  g.add(matMesh);

  // 底部 6 块压脚石合并
  const rGeos = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const st = new THREE.IcosahedronGeometry(0.24 + (i % 2) * 0.06, 0);
    st.translate(Math.cos(a) * 1.05, 0.16, Math.sin(a) * 1.05);
    rGeos.push(st);
  }
  const stones = new THREE.Mesh(mergeGeometries(rGeos), rockMat);
  stones.castShadow = true;
  stones.name = 'ballast';
  g.add(stones);
  return g;
}

const machaGroup = new THREE.Group();
const machaUnits = [
  [2.3, 8.6], [4.2, 8.1], [6.1, 7.6], // 横跨内江槽中
].map(([X, Z]) => {
  const u = buildMachaUnit();
  u.position.copy(p2w(X, Z, -0.52));
  u.rotation.y = 0.42; // 迎水竹席 -Z 指向西北上游来水
  machaGroup.add(u);
  return u;
});
scene.add(machaGroup);

// 凤栖窝淤沙堆 + 天然基岩标石（替代明清卧铁！）+ 4 名低模堰工
const siltMound = new THREE.Mesh(
  new THREE.IcosahedronGeometry(1.0, 1),
  new THREE.MeshStandardMaterial({ color: '#9c8b68', roughness: 0.98, flatShading: true })
);
siltMound.position.copy(p2w(7.15, -5.50, -0.55));
siltMound.scale.set(2.8, 0.72, 2.1);
siltMound.receiveShadow = true;
scene.add(siltMound);

// 基岩底界标石（深淘滩后显露）
const bedrockMarker = new THREE.Mesh(
  new THREE.BoxGeometry(1.8, 0.25, 0.75),
  new THREE.MeshStandardMaterial({ color: '#5f625c', roughness: 0.95, flatShading: true })
);
bedrockMarker.position.copy(p2w(7.15, -5.50, -0.60));
bedrockMarker.rotation.y = 0.25;
scene.add(bedrockMarker);

// 秦代三石人水则（岸畔浅滩立柱，枯水露足、洪水及肩）
function buildStoneGauge() {
  const mat = new THREE.MeshStandardMaterial({ color: '#8a8d85', roughness: 0.95, flatShading: true });
  const parts = [];
  const base = new THREE.BoxGeometry(0.65, 0.30, 0.55); base.translate(0, 0.15, 0); parts.push(base);
  const body = new THREE.CylinderGeometry(0.18, 0.24, 0.85, 6); body.translate(0, 0.68, 0); parts.push(body);
  const head = new THREE.IcosahedronGeometry(0.16, 0); head.translate(0, 1.24, 0); parts.push(head);
  const m = new THREE.Mesh(mergeGeometries(parts), mat);
  m.castShadow = true;
  return m;
}
for (const [X, Z] of [[12.3, -13.5], [9.2, -2.5]]) {
  const sg = buildStoneGauge();
  sg.position.copy(p2w(X, Z, -0.20)); // 足部约 y=0.05，肩部约 y=0.85
  scene.add(sg);
}

// 堰工低模剪影（合批 Group，仅 4 人）
function buildWorker() {
  const g = new THREE.Group();
  const cloth = new THREE.MeshStandardMaterial({ color: '#8c7958', roughness: 1.0, flatShading: true });
  const hat   = new THREE.MeshStandardMaterial({ color: '#b89d6b', roughness: 1.0, flatShading: true });
  const body  = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.75, 5), cloth); body.position.y = 0.52;
  const h     = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.18, 6), hat); h.position.y = 1.05;
  body.castShadow = h.castShadow = true;
  g.add(body, h);
  return g;
}
const workersGroup = new THREE.Group();
const workers = [[5.8, -5.0], [8.1, -6.1], [6.6, -6.7], [7.8, -4.3]].map(([X, Z]) => {
  const w = buildWorker();
  w.position.copy(p2w(X, Z, -0.58));
  workersGroup.add(w);
  return w;
});
scene.add(workersGroup);

// --- 8.3 积薪火塘（临水石台 + 金字塔状柴薪 + 双层火焰） ---
const fireGroup = new THREE.Group();
const flameCones = [];
// 崖根在 corridorPoint(s≈1.3, ·) 处陡起 → 三堆柴薪沿崖脚 s≈0.92 的临水石台一线铺开
const fireSpots = [[0.92, -1.18], [1.00, 0.06], [0.92, 1.24]];
const firePositions = fireSpots.map(([s, d]) => corridorPoint(s, d));
const flameOuterMat = new THREE.MeshBasicMaterial({ color: '#ff8a2b', transparent: true, opacity: 0.88, depthWrite: false });
const flameInnerMat = new THREE.MeshBasicMaterial({ color: '#ffe57a', transparent: true, opacity: 0.95, depthWrite: false });
const charWoodMat   = new THREE.MeshStandardMaterial({ color: '#3f2c1d', roughness: 1.0, flatShading: true });
const ledgeMat = new THREE.MeshStandardMaterial({ color: '#77705f', roughness: 0.98, metalness: 0.0, flatShading: true });
const emberMat = new THREE.MeshBasicMaterial({ color: '#ff7b28', transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending });

// 把一组「几何 + 变换」合并成 1 个网格：三堆火塘全部零件因此只占 4 个 draw call
function mergeGeos(list) {
  const pos = [], nrm = [];
  const nm = new THREE.Matrix3();
  const v = new THREE.Vector3(), w = new THREE.Vector3();
  for (const { geo, m } of list) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const p = g.attributes.position, n = g.attributes.normal;
    nm.getNormalMatrix(m);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m); pos.push(v.x, v.y, v.z);
      w.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); nrm.push(w.x, w.y, w.z);
    }
    if (g !== geo) g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  return out;
}

for (const [X, Z] of firePositions) {
  const wx = X, wz = -Z;                     // PLAN → World
  const ty = sampleTerrain(X, Z).y;
  const baseY = Math.max(0.20, ty + 0.26);   // 河床上 = 半露出水面的石台；落在坡上则贴坡面
  // 石台：3 根错落的矮岩柱合批，半埋进河床 —— 柴薪要有真实的落脚处，不能像石板漂在水面
  const shelf = [];
  for (let k = 0; k < 3; k++) {
    const a = hash2(X * 5.1 + k, Z * 3.3 - k) * 6.283;
    const r = 0.40 + hash2(X + k * 1.7, Z - k * 2.3) * 0.30;
    const h = 1.05 + hash2(X - k, Z + k) * 0.35;
    const m = new THREE.Matrix4()
      .makeTranslation(wx + Math.cos(a) * 0.34, baseY - h * 0.5 + 0.06, wz + Math.sin(a) * 0.34)
      .multiply(new THREE.Matrix4().makeRotationY(a * 1.7))
      .multiply(new THREE.Matrix4().makeRotationZ(0.04 - hash2(k * 2.1, k * 0.7) * 0.10));
    shelf.push({ geo: new THREE.CylinderGeometry(r * 0.80, r, h, 6), m });
  }
  const shelfMesh = new THREE.Mesh(mergeGeos(shelf), ledgeMat);
  shelfMesh.castShadow = shelfMesh.receiveShadow = true;
  fireGroup.add(shelfMesh);

  // 积薪：金字塔状堆叠的焦木（3 + 3 + 2），外层一圈横置、越往上越收
  const pile = [];
  const logGeo = new THREE.CylinderGeometry(0.085, 0.105, 1.15, 6);
  let li = 0;
  for (const [n, dy, spread] of [[3, 0.00, 0.28], [3, 0.18, 0.19], [2, 0.34, 0.09]]) {
    for (let k = 0; k < n; k++) {
      const off = (k - (n - 1) / 2) * spread;
      const yaw = (hash2(li * 3.1, li * 1.9) - 0.5) * 0.30;
      const m = new THREE.Matrix4()
        .makeTranslation(wx + Math.sin(yaw) * off, baseY + 0.12 + dy, wz + Math.cos(yaw) * off)
        .multiply(new THREE.Matrix4().makeRotationY(yaw))
        .multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2));
      pile.push({ geo: logGeo, m });
      li++;
    }
  }
  const pileMesh = new THREE.Mesh(mergeGeos(pile), charWoodMat);
  pileMesh.castShadow = pileMesh.receiveShadow = true;
  fireGroup.add(pileMesh);

  // 余烬堆：加色发光圆丘（强度由 fireHeat 驱动），柴薪之间透出的火光
  const ember = new THREE.Mesh(new THREE.SphereGeometry(0.52, 7, 4), emberMat);
  ember.position.set(wx, baseY + 0.10, wz);
  ember.scale.set(1, 0.40, 1);
  fireGroup.add(ember);

  // 双层火焰锥（外橙内黄，颤动由 applyFrame 驱动）
  const f1 = new THREE.Mesh(new THREE.ConeGeometry(0.46, 2.30, 6, 1, true), flameOuterMat);
  f1.position.set(wx, baseY + 1.10, wz);
  const f2 = new THREE.Mesh(new THREE.ConeGeometry(0.26, 1.45, 5, 1, true), flameInnerMat);
  f2.position.set(wx, baseY + 0.74, wz);
  fireGroup.add(f1, f2);
  flameCones.push(f1, f2);
}
scene.add(fireGroup);

/* ============================================================================
 * 9. 东侧四级自流渠网（1 单合并 Shader Mesh）+ 36 块合批田块 + 40 棵合批低模树
 * ========================================================================== */
function buildMergedCanals() {
  const pos = [], uvs = [], idx = [];
  let vBase = 0;
  for (const c of CANALS) {
    const curve = new THREE.CatmullRomCurve3(c.pts.map(p => p2w(p[0], p[1], 0)));
    const segs = c.level === 1 ? 30 : 16;
    for (let i = 0; i <= segs; i++) {
      const f = i / segs;
      const pt = curve.getPointAt(f);
      const tg = curve.getTangentAt(f);
      const nx = -tg.z, nz = tg.x;
      const nl = Math.hypot(nx, nz) || 1;
      const hw = c.width * 0.5;
      const tWater = lerp(c.t0, c.t1, f); // 沿水力波前的精确到达进度
      const ox = (nx / nl) * hw, oz = (nz / nl) * hw;
      // 按"渲染高度场"逐顶点取面：平原自北向南抬升，渠水整条共用一个中轴高程时，
      // 抬得低的那一侧会被地形慢慢吃掉（远段看起来像"水只流了一小截"）。两侧各取各的高度，
      // 再抬 0.10 露出水面。
      const yL = terrainSurfaceAt(pt.x - ox, -(pt.z - oz)) + 0.10;
      const yR = terrainSurfaceAt(pt.x + ox, -(pt.z + oz)) + 0.10;
      pos.push(pt.x - ox, yL, pt.z - oz);
      pos.push(pt.x + ox, yR, pt.z + oz);
      uvs.push(0, tWater, 1, tWater);
      if (i < segs) {
        const b = vBase + i * 2;
        idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
      }
    }
    vBase += (segs + 1) * 2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const canalUniforms = {
  uTime: { value: 0 },
  uFront: { value: 0 }, // 0→1 水头推进波前
  uMuddy: { value: 0 }, // 高堰错误分支导致干渠泛浑
};
const canalMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  // 渠水是一条没有厚度的带子，顶点绕序朝下；单面渲染会被背面剔除吃掉，
  // 于是"宝瓶口开了、渠网算出了波前，平原上却一滴水都看不见"。这里用双面渲染兜住。
  side: THREE.DoubleSide,
  uniforms: canalUniforms,
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: /* glsl */`
    uniform float uTime, uFront, uMuddy;
    varying vec2 vUv;
    void main() {
      if (uFront <= 0.005 || vUv.y > uFront) discard;
      float head = smoothstep(uFront - 0.06, uFront, vUv.y);
      float flow = 0.5 + 0.5 * sin(vUv.y * 55.0 - uTime * 7.0);
      float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
      vec3 col = mix(vec3(0.22, 0.52, 0.58), vec3(0.56, 0.48, 0.33), uMuddy);
      col = mix(col, vec3(0.88, 0.95, 0.95), flow * 0.22 + head * 0.72);
      gl_FragColor = vec4(col, edge * 0.92);
    }
  `,
});
const canalsMesh = new THREE.Mesh(buildMergedCanals(), canalMat);
canalsMesh.renderOrder = 3;
scene.add(canalsMesh);

// 36 块田块（仅 1 个 InstancedMesh + 1 个水光 InstancedMesh，彻底修复原型的 40 draw call 泄漏！）
const paddies = [];
for (let gx = 23; gx <= 47; gx += 4.6) {
  for (let gz = -48; gz <= -22; gz += 4.6) {
    const [, , , , xEast] = sampleProfile(gz);
    if (gx < xEast + 1.8) continue;
    const h = sampleTerrain(gx, gz);
    if (h.y > 0.75 || h.zone === 'canalBed') continue;
    // 计算到最近支渠的水力到达时间 tArrive
    let bestArrive = 1.0, bestDist = 99;
    for (const c of CANALS) {
      const r = distToPolyline(gx, gz, c.pts);
      if (r.dist < bestDist) {
        bestDist = r.dist;
        const frac = (r.seg + r.t) / (c.pts.length - 1);
        bestArrive = lerp(c.t0, c.t1, frac) + r.dist * 0.018;
      }
    }
    paddies.push({
      X: gx + (hash2(gx, gz) - 0.5) * 0.7,
      Z: gz + (hash2(gz, gx) - 0.5) * 0.7,
      y: h.y + 0.03,
      rot: (hash2(gx * 2, gz * 3) - 0.5) * 0.18,
      arrive: clamp(bestArrive, 0.25, 0.96),
      hueShift: (hash2(gx * 5, gz * 7) - 0.5) * 0.10,
    });
  }
}

const paddyGeo = new THREE.BoxGeometry(3.8, 0.08, 3.4);
const paddyMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.78, flatShading: true });
const paddyIM  = new THREE.InstancedMesh(paddyGeo, paddyMat, paddies.length);
paddyIM.receiveShadow = true;

// 田块薄水镜（得水后泛起低粗糙度水光反照）
const sheenGeo = new THREE.PlaneGeometry(3.5, 3.1).rotateX(-Math.PI / 2);
const sheenMat = new THREE.MeshStandardMaterial({
  color: '#6ca09d', roughness: 0.22, metalness: 0.08, transparent: true, opacity: 0.0, depthWrite: false,
});
const sheenIM = new THREE.InstancedMesh(sheenGeo, sheenMat, paddies.length);

// 低模禾苗簇（1 个 InstancedMesh，随得水拔节）
const shootGeos = [];
for (let k = 0; k < 5; k++) {
  const c = new THREE.ConeGeometry(0.14, 0.45, 4);
  c.translate(((k % 3) - 1) * 0.95, 0.22, (Math.floor(k / 3) - 0.5) * 1.1);
  shootGeos.push(c);
}
const shootIM = new THREE.InstancedMesh(
  mergeGeometries(shootGeos),
  new THREE.MeshStandardMaterial({ color: '#699449', roughness: 0.9, flatShading: true }),
  paddies.length
);

const dummy = new THREE.Object3D();
const dryCol = new THREE.Color('#b8a77b');
const floodErrCol = new THREE.Color('#8e7a4e');
const lushCol = new THREE.Color();

paddies.forEach((pd, i) => {
  dummy.position.copy(p2w(pd.X, pd.Z, pd.y));
  dummy.rotation.set(0, pd.rot, 0);
  dummy.scale.set(1, 1, 1);
  dummy.updateMatrix();
  paddyIM.setMatrixAt(i, dummy.matrix);
  paddyIM.setColorAt(i, dryCol);

  dummy.position.y = pd.y + 0.06;
  dummy.updateMatrix();
  sheenIM.setMatrixAt(i, dummy.matrix);
});
paddyIM.instanceMatrix.needsUpdate = true;
paddyIM.instanceColor.needsUpdate = true;
sheenIM.instanceMatrix.needsUpdate = true;
scene.add(paddyIM, sheenIM, shootIM);

// 高堰错误分支：东侧平原涝灾浑水淹没层
const eastFloodMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(28, 34).rotateX(-Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: '#8f7b52', transparent: true, opacity: 0.0, roughness: 0.35, depthWrite: false })
);
eastFloodMesh.position.copy(p2w(35, -35, 0.48));
scene.add(eastFloodMesh);

// 40 棵低模树（仅 2 个 InstancedMesh：树干 + 树冠）+ 5 座古朴农舍
const treeCoords = [];
for (let i = 0; i < 42; i++) {
  const X = 18 + hash2(i * 3.1, 1.7) * 30;
  const Z = -49 + hash2(2.3, i * 4.7) * 32;
  const [, , , , xEast] = sampleProfile(Z);
  if (X < xEast + 0.8) continue;
  const h = sampleTerrain(X, Z);
  if (h.zone === 'canalBed') continue;
  treeCoords.push({ X, Z, y: h.y, s: 0.72 + hash2(X, Z) * 0.55 });
}
const trunkGeo = new THREE.CylinderGeometry(0.11, 0.16, 0.85, 5); trunkGeo.translate(0, 0.42, 0);
const crownGeo = new THREE.ConeGeometry(0.82, 2.2, 6); crownGeo.translate(0, 1.65, 0);
const trunkIM = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: '#6d563c', roughness: 1, flatShading: true }), treeCoords.length);
const crownIM = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.94, flatShading: true }), treeCoords.length);
crownIM.castShadow = true;
const dryTreeCol = new THREE.Color('#7a7d5c'), lushTreeCol = new THREE.Color('#476b3f');
treeCoords.forEach((tr, i) => {
  dummy.position.copy(p2w(tr.X, tr.Z, tr.y));
  dummy.rotation.set(0, tr.X, 0);
  dummy.scale.setScalar(tr.s);
  dummy.updateMatrix();
  trunkIM.setMatrixAt(i, dummy.matrix);
  crownIM.setMatrixAt(i, dummy.matrix);
  crownIM.setColorAt(i, dryTreeCol);
});
trunkIM.instanceMatrix.needsUpdate = crownIM.instanceMatrix.needsUpdate = crownIM.instanceColor.needsUpdate = true;
scene.add(trunkIM, crownIM);

// 4 座简朴夯土茅屋
const hutWallMat = new THREE.MeshStandardMaterial({ color: '#b4a07d', roughness: 1, flatShading: true });
const hutRoofMat = new THREE.MeshStandardMaterial({ color: '#6b5741', roughness: 1, flatShading: true });
for (const [X, Z] of [[25.5, -31.5], [33.5, -38.5], [42.0, -25.5], [43.5, -45.5]]) {
  const hy = sampleTerrain(X, Z).y;
  const wall = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.25, 1.65), hutWallMat);
  wall.position.copy(p2w(X, Z, hy + 0.62)); wall.castShadow = true;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.75, 1.0, 4), hutRoofMat);
  roof.position.copy(p2w(X, Z, hy + 1.72)); roof.rotation.y = Math.PI / 4; roof.castShadow = true;
  scene.add(wall, roof);
}

/* ============================================================================
 * 10. 轻量级粒子系统（总量 340 颗，非激活阶段自动停更）
 * ========================================================================== */
const softDotTex = makeSoftParticleTexture();
class ParticleCloud {
  constructor({ count, origins, spread, height, speed, size, color }) {
    this.opts = { count, origins, spread, height, speed };
    this.seeds = new Float32Array(count * 3);
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      this.seeds[i * 3]     = (Math.random() - 0.5) * spread;
      this.seeds[i * 3 + 1] = Math.random();
      this.seeds[i * 3 + 2] = (Math.random() - 0.5) * spread;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      size, map: softDotTex, color, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }
  update(time, opacity, baseY = 0.2) {
    this.points.material.opacity = opacity;
    this.points.visible = opacity > 0.015;
    if (!this.points.visible) return;
    const attr = this.points.geometry.getAttribute('position');
    const { count, origins, height, speed } = this.opts;
    for (let i = 0; i < count; i++) {
      const life = (this.seeds[i * 3 + 1] + time * speed) % 1;
      const o = origins[i % origins.length];
      const expand = 0.4 + life * 1.45;
      attr.setXYZ(i, o[0] + this.seeds[i * 3] * expand, baseY + life * height, -o[1] + this.seeds[i * 3 + 2] * expand);
    }
    attr.needsUpdate = true;
  }
}

const fireSmoke  = new ParticleCloud({ count: 70,  origins: firePositions, spread: 1.1, height: 4.2, speed: 0.35, size: 0.92, color: '#8f887d' });
const steamCloud = new ParticleCloud({ count: 90,  origins: [[1.14, -1.02], [1.20, 0.08], [1.14, 1.12]].map(([s, d]) => corridorPoint(s, d)), spread: 2.8, height: 4.8, speed: 0.52, size: 1.65, color: '#f2f5f3' });
const rockDust   = new ParticleCloud({ count: 80,  origins: [[15.6,-16.8],[17.0,-17.5],[18.2,-18.2]], spread: 3.4, height: 4.4, speed: 0.42, size: 1.55, color: '#c4b89e' });
const sprayMist  = new ParticleCloud({ count: 100, origins: [[-12.5,25.5],[5.5,-17.4],[7.5,-17.2],[16.8,-17.3]], spread: 2.2, height: 2.6, speed: 0.65, size: 0.95, color: '#eef5f6' });

/* ============================================================================
 * 11. 三级屏幕标签（含 AABB 防遮挡与安全区裁切）
 * ========================================================================== */
const LABEL_DEFS = [
  // L1 常驻锚
  { key: 'yulei',       tier: 1, text: '玉垒山',             at: [21.0, 12.6,  7.8] },
  { key: 'minjiang',    tier: 1, text: '岷江（单股正流）',   at: [-20.0, 3.0,-32.0] },
  { key: 'inner',       tier: 1, text: '内江',               at: [  5.5, 2.8,  2.0] },
  { key: 'outer',       tier: 1, text: '外江',               at: [ -1.8, 2.8, 12.0] },
  // L2 阶段主角
  { key: 'shoal',       tier: 2, text: '天然浅洲（洪期没顶）',at: [ -7.2, 2.0,-18.2] },
  { key: 'west-flood',  tier: 2, text: '西侧低地 · 汛期漫涝',at: [-16.0, 2.5, 16.0] },
  { key: 'plain-dry',   tier: 2, text: '成都平原 · 无渠易旱',at: [ 36.0, 2.6, 36.0] },
  { key: 'gap-sealed',  tier: 2, text: '玉垒山嘴（完整阻水）',at: [ 16.4, 6.8, 17.2] },
  { key: 'baoping',     tier: 2, text: '宝瓶口',             at: [ 16.5, 6.6, 17.2] },
  { key: 'lidui',       tier: 2, text: '离堆',               at: [ 16.5, 5.8, 23.8] },
  { key: 'fishmouth',   tier: 2, text: '鱼嘴（60°分水尖）',  at: [-12.8, 3.2,-26.3] },
  { key: 'shoal-base',  tier: 2, text: '依天然洲叠笼成堤',   at: [ -3.5, 2.6,-11.5] },
  { key: 'feishayan',   tier: 2, text: '飞沙堰',             at: [  5.6, 2.8, 17.5] },
  { key: 'dredge',      tier: 2, text: '凤栖窝 · 深淘见基岩',at: [  7.2, 2.2,  5.5] },
  { key: 'canals',      tier: 2, text: '总干渠 → 扇形支渠',  at: [ 31.5, 2.6, 28.0] },
  { key: 'plain-green', tier: 2, text: '天府之国 · 得水沃野',at: [ 37.5, 2.6, 38.5] },
  // L3 史实/沿革注脚
  { key: 'fire-note',   tier: 3, text: '崖根炙烤·引槽激裂',  badge: '推论', at: [14.2, 3.8, 16.2] },
  { key: 'gabion-note', tier: 3, text: '竹笼装卵石',         badge: '史实', at: [ 0.5, 2.8, -3.5] },
  { key: 'macha',       tier: 3, text: '截流木架（后世称杩槎）',badge: '沿革', at: [4.2, 4.2, -8.1] },
  { key: 'stone-gauge', tier: 3, text: '石人水则（秦代标尺）', badge: '史实', at: [12.3, 2.8, 13.5] },
  { key: 'time-lapse',  tier: 3, text: '多轮循环 · 历岁缩时', badge: '缩时', at: [17.2, 8.5, 15.0] },
  // L4 历史分期角标（同一工程被后世不断改造：秦凿离堆 → 汉唐竹笼 → 明清砌石与定名）
  { key: 'period-qin',  tier: 4, text: '战国秦 · 凿离堆（《史记·河渠书》）', badge: '分期 1', at: [13.0, 5.4, 17.0] },
  { key: 'period-tang', tier: 4, text: '汉唐 · 竹笼壅水 / 侍郎堰', badge: '分期 2', at: [-8.0, 6.2, -24.0] },
  { key: 'period-ming', tier: 4, text: '明清 · 砌石鱼嘴 / 定名飞沙堰', badge: '分期 3', at: [6.4, 6.4, 15.5] },
];

const labelNodes = new Map();
for (const d of LABEL_DEFS) {
  const el = document.createElement('div');
  el.className = `scene-label tier-${d.tier}`;
  el.innerHTML = `<i></i><span>${d.text}</span>${d.badge ? `<b>[${d.badge}]</b>` : ''}`;
  labelsEl.appendChild(el);
  labelNodes.set(d.key, { def: d, el, vec: new THREE.Vector3(...d.at) });
}

const projV = new THREE.Vector3();
function updateLabels(activeKeys, w, h) {
  const placed = [];
  const topSafe = h * 0.13, botSafe = h * 0.77;
  // 按优先级 L2 > L1 > L3 排序放置防遮挡
  const order = [...LABEL_DEFS].sort((a, b) => (a.tier === 2 ? 0 : a.tier === 1 ? 1 : 2) - (b.tier === 2 ? 0 : b.tier === 1 ? 1 : 2));
  for (const d of order) {
    const item = labelNodes.get(d.key);
    if (!activeKeys.has(d.key)) { item.el.style.opacity = '0'; continue; }
    projV.copy(item.vec).project(camera);
    const sx = (projV.x * 0.5 + 0.5) * w;
    const sy = (-projV.y * 0.5 + 0.5) * h;
    if (projV.z > 1 || sx < 40 || sx > w - 40 || sy < topSafe || sy > botSafe) {
      item.el.style.opacity = '0'; continue;
    }
    const bw = Math.max(82, d.text.length * 12 + 24), bh = 24;
    let fy = sy, hidden = false;
    for (const r of placed) {
      if (Math.abs(sx - r.x) < (bw + r.w) * 0.52 && Math.abs(fy - r.y) < (bh + r.h) * 0.62) {
        fy = r.y - 26;
        if (fy < topSafe) { hidden = true; break; }
      }
    }
    if (hidden) { item.el.style.opacity = '0'; continue; }
    placed.push({ x: sx, y: fy, w: bw, h: bh });
    item.el.style.transform = `translate(-50%,-50%) translate(${sx.toFixed(1)}px,${fy.toFixed(1)}px)`;
    item.el.style.opacity = '1';
  }
}

/* ============================================================================
 * 12. 确定性状态归约与每帧求解（无不可逆累积，随时跳转/复位结果唯一）
 * ========================================================================== */
function updateGabionPool(dikeBuild, weirBuild, highWeir, matMode, floodLvl) {
  // 仅当关键参数变动时才重传实例矩阵（避免每帧无效 GPU 上传）
  const key = `${dikeBuild.toFixed(3)}|${weirBuild.toFixed(3)}|${highWeir}|${matMode}|${matMode === 'stone' ? floodLvl.toFixed(2) : 0}`;
  if (key === lastGabKey) return;
  lastGabKey = key;

  const isGabion = matMode === 'gabion';
  const isStone  = matMode === 'stone';
  const isEarth  = matMode === 'earth';
  gabionGroup.visible = isGabion || weirBuild > 0.01;
  looseStoneIM.visible = isStone && dikeBuild > 0.01;
  // 核体：随筑堤进度从水下升起（三套预建几何，只切 visible）
  const coreRise = lerp(-1.55, 0, smoothstep(dikeBuild, 0, 0.82));
  for (const k of Object.keys(dikeCoreMeshes)) {
    const m = dikeCoreMeshes[k];
    const on = (k === 'gabion' && isGabion) || (k === 'stone' && isStone) || (k === 'earth' && isEarth);
    m.visible = on && dikeBuild > 0.015;
    m.position.y = coreRise;
  }

  let gabCount = 0, stoneCount = 0;
  for (let i = 0; i < gabionItems.length; i++) {
    const it = gabionItems[i];
    let prog = 0;
    let showAsGab = false, showAsStone = false;

    if (it.kind === 'dike') {
      prog = clamp((dikeBuild * 1.18 - it.order) / 0.16, 0, 1);
      showAsGab = isGabion && prog > 0.001;
      showAsStone = isStone && prog > 0.001;
    } else if (it.kind === 'weirLow') {
      prog = clamp((weirBuild * 1.2 - it.order) / 0.2, 0, 1);
      showAsGab = prog > 0.001;
    } else if (it.kind === 'weirHigh') {
      prog = highWeir ? clamp((weirBuild * 1.2 - it.order) / 0.2, 0, 1) : 0;
      showAsGab = prog > 0.001;
    }

    if (showAsGab) {
      const drop = (1 - smoothstep(prog, 0, 1)) * 3.2;
      dummy.position.copy(p2w(it.X, it.Z, it.y + drop));
      dummy.rotation.set(0, it.rotY, 0);
      // 非等比缩放：l 沿堤轴、r 横向 —— 让竹笼回到「径 0.5~0.9 m 的笼」比例，而不是 16 m 粗的桶
      const pop = smoothstep(prog, 0, 0.15);
      dummy.scale.set(it.scale * (it.l || 1) * pop, it.scale * (it.r || 1) * pop, it.scale * (it.r || 1) * pop);
      dummy.updateMatrix();
      gabShellIM.setMatrixAt(gabCount, dummy.matrix);
      gabHoopIM.setMatrixAt(gabCount, dummy.matrix);
      gabStoneIM.setMatrixAt(gabCount, dummy.matrix);
      gabCount++;
    }
    if (showAsStone) {
      const drop = (1 - smoothstep(prog, 0, 1)) * 2.8;
      // 洪水下散石顶层滚石移位
      const shift = floodLvl * 0.45 * (it.y > 0.8 ? 1 : 0.2);
      dummy.position.copy(p2w(it.X - shift, it.Z - shift, it.y + drop - shift * 0.35));
      dummy.rotation.set(shift * 0.7, it.rotY + i, shift * 0.4);
      dummy.scale.setScalar(it.scale);
      dummy.updateMatrix();
      looseStoneIM.setMatrixAt(stoneCount++, dummy.matrix);
    }
  }
  gabShellIM.count = gabHoopIM.count = gabStoneIM.count = gabCount;
  looseStoneIM.count = stoneCount;
  gabShellIM.instanceMatrix.needsUpdate = gabHoopIM.instanceMatrix.needsUpdate = gabStoneIM.instanceMatrix.needsUpdate = true;
  if (isStone) looseStoneIM.instanceMatrix.needsUpdate = true;
}

const camPosA = new THREE.Vector3(), camPosB = new THREE.Vector3(), camLookV = new THREE.Vector3();
let lastCamPhase = -1;

function applyFrame(tSec, followCamera, vp) {
  const { idx, u, phase } = getPhaseAt(tSec);
  // 装饰动画一律走环境时钟：故事暂停（等玩家选择）时江水照流、火照烧、汽照腾
  const aT = animTime;
  // 水情强度：堤/堰/岩塞/粒子各段都要用，且必须在堰体溢流判断之前就有值
  const floodLvl = floodLevelAt(tSec, branch.season);

  // 1) 推导当前物理状态（全部由时间轴 tSec + 分支配置 branch 确定性算出）
  const fireHeat  = branch.carve === 'fire'
    ? (idx === 1 ? smoothstep(u, 0.04, 0.42) * (1 - smoothstep(u, 0.72, 1.0)) : 0) : 0;
  const quench    = branch.carve === 'fire'
    ? (idx === 1 ? smoothstep(u, 0.42, 0.65) : (idx === 2 ? 1 - smoothstep(u, 0, 0.35) : 0)) : 0;
  const crackAmt  = branch.carve === 'bypass' ? 0 : (idx === 1 ? smoothstep(u, 0.48, 0.95) : (idx > 1 ? 1 : 0));

  let rawChisel   = idx === 2 ? smoothstep(u, 0.05, 0.85) : (idx > 2 ? 1 : 0);
  if (branch.carve === 'chisel') rawChisel = Math.min(rawChisel, 0.24); // 纯铁锤凿无法贯通
  if (branch.carve === 'bypass') rawChisel = 0;
  const gapOpen   = smoothstep(rawChisel, 0.58, 0.92);

  const dikeBuild = idx === 3 ? smoothstep(u, 0.06, 0.92) : (idx > 3 ? 1 : 0);
  const weirBuild = idx === 5 ? smoothstep(u, 0.02, 0.34) : (idx > 5 ? 1 : 0);
  // 堰体：随 weirBuild 从水下升起；低堰/高堰按分支切换（几何各一套，离散切换即可）
  {
    const high = branch.weirHeight === 'high';
    // 中堰没有独立的一套几何：把高堰整体下沉 0.36，堰顶落在低堰与高堰之间
    const mid = branch.weirHeight === 'mid';
    const rise = lerp(-1.25, 0, smoothstep(weirBuild, 0, 0.85));
    weirLowMesh.visible = !high && !mid && weirBuild > 0.02;
    weirHighMesh.visible = (high || mid) && weirBuild > 0.02;
    weirLowMesh.position.y = rise;
    weirHighMesh.position.y = rise - (mid ? 0.36 : 0);
    renziMesh.visible = weirBuild > 0.30;
    scourGroup.visible = weirBuild > 0.55;
    // 漫堰白水只属于「矮堰 + 水位越顶」：高堰封死水道时不漫顶，枯水时水位低于堰顶也不漫顶
    const spillAmt = (weirBuild > 0.55 && !high) ? smoothstep(floodLvl, 0.50, 0.86) : 0;
    spillSheet.visible = spillAmt > 0.02;
    if (spillSheet.visible) {
      spillUniforms.uAmt.value = spillAmt;
      spillUniforms.uTime.value = aT;
      spillSheet.position.y = rise + floodLvl * 0.72 + 0.018;   // 白水贴着当前水面铺开
    }
  }
  const machaAmt  = idx === 6 ? smoothstep(u, 0.05, 0.28) * (1 - smoothstep(u, 0.78, 0.98)) : 0;
  const dredgeAmt = branch.dredge === 'shallow'
    ? (idx >= 6 ? 0.22 : 0)
    : (idx === 6 ? smoothstep(u, 0.28, 0.76) : (idx > 6 ? 1 : 0));

  // 自动水情（阶段 1 末尾演示汛期淹洲与西涝；阶段 5 前枯后洪；阶段 6 洪水漫堰溢流）
  // ↑ 这个量在堰/堤/岩塞各段都要用，已提前到 applyFrame 开头计算（见函数首行）

  // 2) 更新水体 Shader Uniforms
  waterUniforms.uTime.value = aT;
  waterUniforms.uFlood.value = floodLvl;
  waterUniforms.uDikeBuilt.value = smoothstep(dikeBuild, 0.35, 0.88);
  waterUniforms.uGapOpen.value = gapOpen;
  waterUniforms.uWeirBuilt.value = weirBuild;
  waterUniforms.uWeirHigh.value = branch.weirHeight === 'high' ? 1 : (branch.weirHeight === 'mid' ? 0.5 : 0);
  waterUniforms.uMacha.value = machaAmt;
  waterUniforms.uSplitBias.value = branch.splitPos === 'east' ? -1 : (branch.splitPos === 'west' ? 1 : 0);
  waterUniforms.uShallowDredge.value = branch.dredge === 'shallow' && idx >= 6 ? 1 : 0;
  waterUniforms.uEarthBreach.value = branch.dikeMat === 'earth' && dikeBuild > 0.5 ? 1 : 0;

  // 3) 玉垒山嘴：崖根炙烤 → 节理生长 → 泼水沃裂 → 五片岩壁逐层外倾坍落 + 绕山试挖沟
  bypassDitch.visible = branch.carve === 'bypass' && idx >= 1;
  const fireMode = branch.carve === 'fire';
  // 余烬：火烧时最亮，泼水激裂时被水汽映着反而更刺眼，凿贯通后熄灭
  const emberGlow = fireMode ? Math.max(fireHeat, quench * 0.6) : 0;
  sealHeatU.value = emberGlow * (1 - smoothstep(rawChisel, 0.30, 0.72));
  sealCharU.value = fireMode ? clamp(fireHeat * 0.5 + crackAmt * 0.55, 0, 1) : 0;
  fisUniforms.uGrow.value = fireMode ? clamp(crackAmt * 1.04 + rawChisel * 0.25, 0, 1) : 0;
  fisUniforms.uHot.value = emberGlow * (1 - smoothstep(rawChisel, 0.5, 0.9)) * 0.9;
  fisUniforms.uFade.value = 1 - smoothstep(rawChisel, 0.55, 0.95);

  // 余烬光斑跟着「当前正在撬的那一片」往东推进 → 表现史实里"多轮循环、逐段开凿"的工序前移，
  // 而不是整面崖根从头亮到尾（缩时演示：一段炙烧—激裂—撬剥—清出，再挪到下一段）
  {
    const slabW = (SEAL.s1 - SEAL.s0) / SEAL.slabs;
    // 已经坍落掉的片数：peel = clamp((rawChisel-0.06-l*0.15)/0.20) 过半即算「这块岩壁已经倒下来了」
    const clearedL = clamp(Math.ceil((rawChisel - 0.13) / 0.15), 0, SEAL.slabs);
    const clipS = SEAL.s0 + clearedL * slabW;
    const glowS = clamp(clipS + slabW * 0.5, SEAL.s0, SEAL.s1);
    const fp = corridorPoint(glowS, 0);
    sealCenterU.value.set(fp[0], 0.55, -fp[1]);
    // 节理缝只留在还没被撬走的岩体上：前锋推过之处一律裁掉，
    // 否则岩块坍落后那些缝会悬在峡口上空，像插在空气里的黑刺。
    // 未开凿（rawChisel≈0）时不能裁，否则燃烧阶段的缝会被切掉。
    fisUniforms.uFrontS.value = rawChisel <= 0.02 ? -99 : clipS;
  }

  // 泼水：三股引水自上而下浇淋崖根
  quenchGroup.visible = quench > 0.03;
  quenchMat.opacity = clamp(quench * 0.62, 0, 0.52);
  for (let i = 0; i < quenchStreams.length; i++) {
    const st = quenchStreams[i];
    const scl = clamp(quench * 2.2 - i * 0.15, 0, 1);
    st.scale.set(1, Math.max(0.02, scl), 1);
    st.rotation.z = 0.10 * (i - 1) + Math.sin(aT * 7 + i) * 0.015;
  }

  // 五片岩壁：先微微外倾（受力），再整片朝内江坍落、沉入凿开的峡口
  let visSlabs = 0, peelMax = 0, minSlabY = 0, maxSlabY = 0;
  for (let l = 0; l < sealSlabs.length; l++) {
    const sl = sealSlabs[l];
    const peel = clamp((rawChisel - 0.06 - l * 0.15) / 0.20, 0, 1);
    sl.grp.visible = peel < 0.985;
    if (!sl.grp.visible) continue;
    visSlabs++; peelMax = Math.max(peelMax, peel);
    minSlabY = Math.min(minSlabY, sl.grp.position.y - sl.pivot.y);
    maxSlabY = Math.max(maxSlabY, sl.grp.position.y - sl.pivot.y);
    // 逐片撬剥：先绕沿脊轴外倾（顶层先动），再整体朝内江一侧下坠、沉进河床，
    // 落到底时恰好淡出 → 五片落完，峡口就是地形本身的 V 形槽。
    // 下坠量必须大于片高（≈5.5）且横移要小：横移大了，岩块会横铺在水面上像一块斜面甲板。
    const tip = smoothstep(peel, 0, 0.62);
    const fall = peel * peel;
    sl.grp.quaternion.setFromAxisAngle(sealAxisD, -tip * (0.30 + l * 0.04));
    sl.grp.position.copy(sl.pivot).addScaledVector(sealOutS, fall * (0.40 + l * 0.12));
    sl.grp.position.y = sl.pivot.y - fall * (5.6 + l * 0.55);
  }
  // 派生状态快照（供 window.dujiangyan.state() / audit() 断言，不参与渲染）
  dbgState = {
    tSec: +tSec.toFixed(3), idx, phaseKey: PHASES[idx].key,
    fireHeat: +fireHeat.toFixed(4), quench: +quench.toFixed(4),
    crackAmt: +crackAmt.toFixed(4), rawChisel: +rawChisel.toFixed(4),
    gapOpen: +gapOpen.toFixed(4), sealHeat: +sealHeatU.value.toFixed(4),
    sealChar: +sealCharU.value.toFixed(4), fissGrow: +fisUniforms.uGrow.value.toFixed(4),
    fissHot: +fisUniforms.uHot.value.toFixed(4), fissFade: +fisUniforms.uFade.value.toFixed(4),
    visSlabs, peelMax: +peelMax.toFixed(4),
    slabDropMin: +minSlabY.toFixed(3), slabDropMax: +maxSlabY.toFixed(3),
    quenchVis: quenchGroup.visible, quenchOpacity: +(quenchMat.opacity || 0).toFixed(3),
    fireVisible: fireGroup.visible, bypaDitch: bypassDitch.visible,
  };

  // 4) 火塘与火焰颤动（积薪在「火烧水激」阶段才登场，未凿时装态保持山嘴原貌）
  fireGroup.visible = branch.carve === 'fire' && idx >= 1 && idx <= 2 && rawChisel < 0.35;
  emberMat.opacity = clamp(fireHeat * 0.52, 0, 0.58);
  flameCones.forEach((fc, i) => {
    fc.visible = fireHeat > 0.03;
    const flick = 0.84 + Math.sin(aT * 12 + i * 2.1) * 0.14 + Math.sin(aT * 21 + i) * 0.06;
    fc.scale.set(1, (0.35 + fireHeat * 0.75) * flick, 1);
  });

  // 5) 天然沙洲（枯露洪淹；阶段 4 依洲筑堤时 2 处主洲抬升与垫基连片）
  // 堤体核体建起后，两处「筑堤用」沙洲被核体吞没 → 逐渐收平，只留水下垫基，
  // 否则会看到扁平的沙洲叶片从堤身里横着支出来
  const baseRise = smoothstep(dikeBuild, 0.0, 0.65);
  dikeBaseMesh.position.y = lerp(-1.35, -0.06, baseRise);
  dikeBaseMesh.visible = dikeBuild < 0.55;   // 核体建起后由核体自身充当垫基，避免扁带从水里支出来
  for (const sb of sandbarMeshes) {
    const sink = sb.userData.forDike ? smoothstep(dikeBuild, 0.25, 0.75) : 0;
    sb.position.y = sb.userData.baseY + (sb.userData.forDike ? baseRise * 0.38 : 0) - sink * 0.85;
    sb.scale.set(1, 1, 1);
    // 堤体建起后，筑堤用的两处沙洲被核体完全覆盖 → 直接隐藏，避免残角从水里支出来
    sb.visible = !(sb.userData.forDike && dikeBuild > 0.5);
  }

  // 6) 竹笼/土堤/散石池更新（带脏标记防无效上传）
  updateGabionPool(dikeBuild, weirBuild, branch.weirHeight === 'high', branch.dikeMat, floodLvl);

  // 7) 岁修截流木架（杩槎）+ 淤沙堆 + 堰工
  machaGroup.visible = machaAmt > 0.02;
  machaUnits.forEach((mu, i) => {
    const p = clamp(machaAmt * 1.4 - i * 0.15, 0, 1);
    mu.scale.setScalar(Math.max(0.01, smoothstep(p, 0, 0.5)));
    const mat = mu.getObjectByName('mat');
    if (mat) mat.position.y = lerp(2.2, 1.05, smoothstep(p, 0.4, 0.85));
  });
  siltMound.visible = idx >= 6 || (idx === 5 && u > 0.8);
  const siltRem = 1 - dredgeAmt * 0.85;
  siltMound.scale.set(2.8 * (0.45 + 0.55 * siltRem), 0.72 * siltRem + 0.04, 2.1 * (0.45 + 0.55 * siltRem));
  bedrockMarker.visible = dredgeAmt > 0.55 && idx >= 6;
  workersGroup.visible = idx === 6 && u > 0.22 && u < 0.80;
  workers.forEach((w, i) => {
    w.rotation.z = Math.sin(aT * 4.5 + i * 1.7) * 0.16;
    w.position.y = -0.58 + Math.abs(Math.sin(aT * 4.5 + i)) * 0.06;
  });

  // 8) 东侧四级渠网波前推进 + 田块按测地距离泛绿 + 高堰洪涝警示
  const canWaterReach = gapOpen > 0.5 && !(branch.splitPos === 'east' && floodLvl < 0.4);
  let canalFront = 0;
  if (canWaterReach) {
    // 宝瓶口凿通那一刻水就该见着了：起波从 0.40 就开始，幕末总干渠（t1=0.42）已经走到头，
    // 之后每一幕再往前推一级分干渠/支渠，末幕全网灌满。
    if (idx === 2) canalFront = smoothstep(u, 0.4, 1.0) * 0.42;
    else if (idx > 2 && idx < 7) canalFront = 0.42 + (idx - 3) * 0.10;
    else if (idx === 7) canalFront = lerp(0.82, 1.04, smoothstep(u, 0.0, 0.8));
  }
  if (branch.dredge === 'shallow' && idx >= 6 && floodLvl < 0.4) canalFront *= 0.52;

  const eastFloodErr = branch.weirHeight === 'high' && floodLvl > 0.65 && gapOpen > 0.5 ? smoothstep(floodLvl, 0.65, 0.95) : 0;
  canalUniforms.uTime.value = aT;
  canalUniforms.uFront.value = canalFront;
  canalUniforms.uMuddy.value = eastFloodErr;
  eastFloodMesh.material.opacity = eastFloodErr * 0.62;
  eastFloodMesh.visible = eastFloodErr > 0.02;

  const pKey = `${canalFront.toFixed(3)}|${eastFloodErr.toFixed(2)}`;
  if (pKey !== lastPaddyKey) {
    lastPaddyKey = pKey;
    sheenMat.opacity = clamp((canalFront - 0.35) * 0.48, 0, 0.36);
    paddies.forEach((pd, i) => {
      const wet = smoothstep(canalFront, pd.arrive - 0.08, pd.arrive + 0.16);
      lushCol.setRGB(0.35 + pd.hueShift, 0.54 + pd.hueShift * 0.6, 0.28);
      tmpCol.copy(dryCol).lerp(lushCol, wet);
      if (eastFloodErr > 0.05) tmpCol.lerp(floodErrCol, eastFloodErr * 0.78);
      paddyIM.setColorAt(i, tmpCol);

      const shootH = wet * (1 - eastFloodErr * 0.7);
      dummy.position.copy(p2w(pd.X, pd.Z, pd.y + 0.04));
      dummy.rotation.set(0, pd.rot, 0);
      dummy.scale.set(1, Math.max(0.001, shootH), 1);
      dummy.updateMatrix();
      shootIM.setMatrixAt(i, dummy.matrix);
    });
    paddyIM.instanceColor.needsUpdate = true;
    shootIM.instanceMatrix.needsUpdate = true;

    const treeWet = smoothstep(canalFront, 0.45, 0.95);
    treeCoords.forEach((_, i) => {
      tmpCol.copy(dryTreeCol).lerp(lushTreeCol, treeWet);
      crownIM.setColorAt(i, tmpCol);
    });
    crownIM.instanceColor.needsUpdate = true;
  }

  // 9) 粒子更新（按需唤醒；同样走环境时钟，暂停时蒸汽烟尘继续飘）
  fireSmoke.update(aT, fireHeat * 0.34, 0.8);
  steamCloud.update(aT, quench * 0.68, 0.9);
  rockDust.update(aT, idx === 2 && rawChisel > 0.05 && rawChisel < 0.95 ? 0.58 : 0, 0.8);
  const sprayAmt = Math.max(
    waterUniforms.uWeirBuilt.value * (1 - waterUniforms.uWeirHigh.value) * floodLvl * 0.72,
    idx === 3 && dikeBuild > 0.75 ? 0.45 : 0,
    idx === 2 && gapOpen > 0.3 ? 0.42 : 0
  );
  sprayMist.update(aT, sprayAmt, 0.2);

  // 10) 镜头语法（跨工区干脆切镜 + 同区缓推 + 竖屏 9:16 自动适配）
  if (followCamera) {
    const moveU = smoothstep(u, 0.0, 0.78); // 后 22%（约 1.5–2.0 s）停机供判读
    camPosA.set(...phase.camFrom);
    camPosB.set(...phase.camTo);
    camLookV.set(...phase.look);
    const desiredPos = camPosA.lerp(camPosB, moveU);

    // 竖屏补偿：拉远距离并微抬焦点避开底部字幕
    const aspect = vp.w / Math.max(1, vp.h);
    if (aspect < 1.0) {
      const distMul = clamp(1.15 / aspect, 1.0, 1.58);
      const offset = desiredPos.clone().sub(camLookV).multiplyScalar(distMul);
      desiredPos.copy(camLookV).add(offset);
      camera.fov = lerp(38, 48, clamp((1 - aspect) * 1.6, 0, 1));
    } else {
      camera.fov = 38;
    }
    camera.updateProjectionMatrix();

    // 跨阶段硬切防穿山眩晕；同阶段丝滑推进
    if (lastCamPhase !== idx) {
      camera.position.copy(desiredPos);
      controls.target.copy(camLookV);
      lastCamPhase = idx;
    } else {
      camera.position.lerp(desiredPos, 0.14);
      controls.target.lerp(camLookV, 0.14);
    }
  }
  controls.update();

  // 11) 远距隐藏竹笼端石 LOD
  gabStoneIM.visible = camera.position.distanceTo(controls.target) < 58;

  // 12) 三级屏幕标签（含 AABB 防遮挡）
  updateLabels(new Set(phase.labels), vp.w, vp.h);

  // 12.5) 分支异常警示与派生状态（原脚本写进 #branch-alert，这里随帧交还视图）
  let alert = '';
  if (eastFloodErr > 0.2) alert = '⚠ 高堰阻泄 · 洪水冲淹东侧平原！';
  else if (branch.dikeMat === 'earth' && floodLvl > 0.5 && dikeBuild > 0.5) alert = '⚠ 夯土堤遇洪溃口！';
  else if (branch.carve === 'chisel' && idx >= 2) alert = '⚠ 纯锤凿受阻 · 宝瓶口未贯通';
  else if (branch.carve === 'bypass' && idx >= 1) alert = '⚠ 南端绕行标高受限 · 无法自流';
  else if (branch.splitPos === 'east' && idx >= 4 && floodLvl < 0.4) alert = '⚠ 鱼嘴偏东 · 枯水内江断流';
  else if (branch.weirHeight === 'mid' && floodLvl > 0.6) alert = '⚠ 中堰折中 · 洪水漫顶余量不足';
  else if (branch.dredge === 'shallow' && idx >= 6) alert = '⚠ 浅淘留淤 · 远端田块春旱';

  frameOut = {
    time: tSec, idx, u, phase, floodLevel: floodLvl,
    hydraulics: solveHydraulics(branch, floodLvl), alert,
  };
  return frameOut;
}
  /* ==========================================================================
   * 15. 挂载与对外句柄（原 §13/§14 的 UI 与渲染循环，交给 Vue 与 rAF 驱动）
   * ======================================================================== */
  renderer.domElement.style.display = 'block'
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
  renderer.domElement.style.outline = 'none'
  renderer.domElement.style.touchAction = 'none'

  /** 跳到某一时刻并立即重绘（拖动进度条、点阶段按钮都走这里） */
  function seek(seconds: number): ChronicleFrame {
    curTime = clamp(seconds, 0, TOTAL_SEC - 0.001)
    lastCamPhase = -1
    applyFrame(curTime, followCam, vp)
    renderer.render(scene, camera)
    return frameOut
  }

  /** 改方案后立刻用当前时刻重算，避免等到下一帧才看到结果 */
  function refresh(): ChronicleFrame {
    return seek(curTime)
  }

  // 落点记在这里：窗口从竖屏切回横屏时要按新宽高比重新拉一次距离
  let presetFrom: WorldPoint = PRESETS.overview.pos
  let presetLook: WorldPoint = PRESETS.overview.look

  /** 竖屏补偿：拉远机位并放宽视场，否则 9:16 只截到山谷中间一条 */
  function fitCamera(from: WorldPoint, look: WorldPoint): { pos: WorldPoint; fov: number } {
    const aspect = vp.w / Math.max(1, vp.h)
    if (aspect >= 1) return { pos: from, fov: 38 }
    const distMul = clamp(1.15 / aspect, 1.0, 1.58)
    const pos: WorldPoint = [
      look[0] + (from[0] - look[0]) * distMul,
      look[1] + (from[1] - look[1]) * distMul,
      look[2] + (from[2] - look[2]) * distMul,
    ]
    return { pos, fov: lerp(38, 48, clamp((1 - aspect) * 1.6, 0, 1)) }
  }

  function placeCamera(from: WorldPoint, look: WorldPoint): void {
    presetFrom = from
    presetLook = look
    const fit = fitCamera(from, look)
    camera.position.set(fit.pos[0], fit.pos[1], fit.pos[2])
    camera.fov = fit.fov
    camera.updateProjectionMatrix()
    controls.target.set(look[0], look[1], look[2])
    controls.update()
    followCam = false
    lastCamPhase = -1
    renderer.render(scene, camera)
  }

  return {
    scene,
    camera,
    controls,

    seek,

    setBranch(patch: Partial<Branch>): ChronicleFrame {
      branch = { ...branch, ...patch }
      return refresh()
    },
    resetBranch(): ChronicleFrame {
      branch = { ...DEFAULT_BRANCH }
      return refresh()
    },
    setSeason(season): ChronicleFrame {
      branch = { ...branch, season }
      return refresh()
    },
    setPlaying(next: boolean): void {
      playing = next
    },
    setSpeed(next: number): void {
      speed = clamp(next, 0.1, 3)
    },
    setFollowCamera(next: boolean): void {
      followCam = next
      if (next) lastCamPhase = -1
    },
    setPreset(name: PresetKey): void {
      const preset = PRESETS[name]
      placeCamera(preset.pos, preset.look)
    },
    setCamera(from: WorldPoint, look: WorldPoint): void {
      placeCamera(from, look)
    },

    /** 推进一帧并绘制；playing=false 时只按当前时刻重绘（暂停也能拖时间轴） */
    tick(deltaSeconds: number): ChronicleFrame {
      const dt = Math.min(0.06, Math.max(0, deltaSeconds))
      // 环境时钟永远走：剧情停在某一幕等玩家决策，江水和火光也不会静止
      animTime += dt
      if (playing) {
        curTime += dt * speed
        if (curTime >= TOTAL_SEC) {
          curTime = 0.001
          lastCamPhase = -1
        }
      }
      applyFrame(curTime, followCam, vp)
      renderer.render(scene, camera)

      // 轻量 FPS 采样 + 一次性降级保护（低端设备先砍像素比）
      fpsFrames++
      const now = performance.now()
      if (now - fpsLast > 1200) {
        liveFps = (fpsFrames * 1000) / (now - fpsLast)
        fpsFrames = 0
        fpsLast = now
        if (!degraded && liveFps < 36 && renderer.getPixelRatio() > 1) {
          renderer.setPixelRatio(1)
          degraded = true
        }
      }
      return frameOut
    },

    resize(width: number, height: number): void {
      vp.w = Math.max(1, Math.round(width))
      vp.h = Math.max(1, Math.round(height))
      camera.aspect = vp.w / vp.h
      camera.updateProjectionMatrix()
      renderer.setSize(vp.w, vp.h, false)
      // 固定机位也要跟着宽高比走：竖屏拉远，转回横屏复位
      if (!followCam) placeCamera(presetFrom, presetLook)
    },

    ledger() {
      return {
        triangles: renderer.info.render.triangles,
        drawCalls: renderer.info.render.calls,
        fps: Math.round(liveFps),
        dikeLength: DIKE_LEN,
      }
    },

    dispose(): void {
      controls.dispose()
      scene.traverse((object) => {
        const mesh = object
        if (mesh.geometry) mesh.geometry.dispose()
        const material = mesh.material
        if (Array.isArray(material)) material.forEach((item) => item.dispose())
        else if (material) material.dispose()
      })
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
