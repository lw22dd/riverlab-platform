/**
 * 程序化贴图与几何合批——完全离线，零外部资源。
 * 竹笼的斜纹编法与粒子光斑都靠 canvas 现场画，产物只依赖分辨率。
 */
import * as THREE from 'three'
export function makeBambooTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#b59760';
  g.fillRect(0, 0, 64, 64);
  for (const [col, w, step] of ([['#8c6f3e', 3, 10], ['#d6bc87', 2, 13]] as Array<[string, number, number]>)) {
    g.strokeStyle = col; g.lineWidth = w;
    for (let k = -64; k < 128; k += step) {
      g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 64, 64); g.stroke();
      g.beginPath(); g.moveTo(k, 64); g.lineTo(k + 64, 0); g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2.4, 1.1);
  return tex;
}

export function makeSoftParticleTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  gr.addColorStop(0, 'rgba(255,255,255,0.95)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0.42)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// 合并多个简单 BufferGeometry（统一 non-indexed，供低模合批）
export function mergeGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const expanded = geos.map(g => g.index ? g.toNonIndexed() : g.clone());
  let totalVerts = 0;
  for (const g of expanded) totalVerts += g.attributes.position.count;
  const pos = new Float32Array(totalVerts * 3);
  const norm = new Float32Array(totalVerts * 3);
  let off = 0;
  for (const g of expanded) {
    if (!g.attributes.normal) g.computeVertexNormals();
    pos.set(g.attributes.position.array, off);
    norm.set(g.attributes.normal.array, off);
    off += g.attributes.position.count * 3;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
  return out;
}

