// Particelle senza allocazioni per frame: buffer pre-allocati e riciclati.
import * as THREE from 'three';

const VS = `
attribute float size; attribute float alpha; attribute vec3 pcolor;
varying float vA; varying vec3 vC;
uniform float uScale;
void main(){
  vA = alpha; vC = pcolor;
  vec4 mv = modelViewMatrix * vec4(position,1.0);
  gl_PointSize = size * uScale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const FS_ADD = `
varying float vA; varying vec3 vC;
void main(){
  vec2 p = gl_PointCoord - 0.5; float d = length(p);
  if (d > 0.5) discard;
  float core = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vC * (0.6 + core * 0.9), vA * core);
}`;
const FS_NORM = `
varying float vA; varying vec3 vC;
void main(){
  vec2 p = gl_PointCoord - 0.5; float d = length(p);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.18, d);
  gl_FragColor = vec4(vC, vA * a);
}`;

export class PointPool {
  constructor(scene, n, additive) {
    this.n = n;
    this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3);
    this.col = new Float32Array(n * 3); this.size = new Float32Array(n); this.alpha = new Float32Array(n);
    this.life = new Float32Array(n); this.max = new Float32Array(n); this.s0 = new Float32Array(n); this.s1 = new Float32Array(n);
    this.grav = new Float32Array(n); this.drag = new Float32Array(n); this.a0 = new Float32Array(n);
    this.next = 0;
    const g = new THREE.BufferGeometry();
    this.attrPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.attrSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    this.attrAlpha = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    this.attrCol = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.attrPos); g.setAttribute('size', this.attrSize);
    g.setAttribute('alpha', this.attrAlpha); g.setAttribute('pcolor', this.attrCol);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.uniforms = { uScale: { value: 400 } };
    const m = new THREE.ShaderMaterial({
      vertexShader: VS, fragmentShader: additive ? FS_ADD : FS_NORM, uniforms: this.uniforms,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 20 : 10;
    scene.add(this.points);
  }
  // emette una particella
  emit(x, y, z, vx, vy, vz, life, s0, s1, color, alpha = 1, grav = 0, drag = 0) {
    const i = this.next; this.next = (i + 1) % this.n;
    const i3 = i * 3;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    this.col[i3] = color.r; this.col[i3 + 1] = color.g; this.col[i3 + 2] = color.b;
    this.life[i] = life; this.max[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.a0[i] = alpha;
    this.grav[i] = grav; this.drag[i] = drag;
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const t = 1 - Math.max(0, this.life[i]) / this.max[i];
      const i3 = i * 3;
      const dr = 1 - this.drag[i] * dt;
      this.vel[i3] *= dr; this.vel[i3 + 2] *= dr;
      this.vel[i3 + 1] = this.vel[i3 + 1] * dr - this.grav[i] * dt;
      this.pos[i3] += this.vel[i3] * dt; this.pos[i3 + 1] += this.vel[i3 + 1] * dt; this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      if (this.pos[i3 + 1] < 0.03 && this.grav[i] > 0) { this.pos[i3 + 1] = 0.03; this.vel[i3 + 1] *= -0.3; this.vel[i3] *= 0.6; this.vel[i3 + 2] *= 0.6; }
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
      this.alpha[i] = this.a0[i] * (t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9);
    }
    this.attrPos.needsUpdate = true; this.attrSize.needsUpdate = true; this.attrAlpha.needsUpdate = true; this.attrCol.needsUpdate = true;
  }
  clear() { this.life.fill(0); this.alpha.fill(0); }
}

// schegge di legno (e pezzi di cerchio) come InstancedMesh con fisica semplice
export class Shards {
  constructor(scene, n = 140) {
    this.n = n;
    const g = new THREE.BoxGeometry(0.62, 0.11, 0.2);
    const m = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(g, m, n);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.p = new Float32Array(n * 3); this.v = new Float32Array(n * 3); this.r = new Float32Array(n * 3); this.w = new Float32Array(n * 3);
    this.life = new Float32Array(n); this.sc = new Float32Array(n);
    this.next = 0;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3();
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) { this.mesh.setColorAt(i, c.set(0x9a5c29)); this._hide(i); }
    scene.add(this.mesh);
  }
  _hide(i) { this._m.makeScale(0, 0, 0); this.mesh.setMatrixAt(i, this._m); }
  emit(x, y, z, vx, vy, vz, color, scale = 1, life = 1.6) {
    const i = this.next; this.next = (i + 1) % this.n;
    const i3 = i * 3;
    this.p[i3] = x; this.p[i3 + 1] = y; this.p[i3 + 2] = z;
    this.v[i3] = vx; this.v[i3 + 1] = vy; this.v[i3 + 2] = vz;
    this.r[i3] = Math.random() * 6; this.r[i3 + 1] = Math.random() * 6; this.r[i3 + 2] = Math.random() * 6;
    this.w[i3] = (Math.random() - 0.5) * 18; this.w[i3 + 1] = (Math.random() - 0.5) * 14; this.w[i3 + 2] = (Math.random() - 0.5) * 18;
    this.life[i] = life; this.sc[i] = scale;
    this.mesh.setColorAt(i, color);
    this.mesh.instanceColor.needsUpdate = true;
  }
  update(dt) {
    let any = false;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      const i3 = i * 3;
      this.v[i3 + 1] -= 16 * dt;
      for (let k = 0; k < 3; k++) { this.p[i3 + k] += this.v[i3 + k] * dt; this.r[i3 + k] += this.w[i3 + k] * dt; }
      if (this.p[i3 + 1] < 0.06) {
        this.p[i3 + 1] = 0.06; this.v[i3 + 1] *= -0.35; this.v[i3] *= 0.55; this.v[i3 + 2] *= 0.55;
        for (let k = 0; k < 3; k++) this.w[i3 + k] *= 0.5;
      }
      const s = this.sc[i] * Math.min(1, this.life[i] / 0.35);
      if (this.life[i] <= 0) { this._hide(i); continue; }
      this._e.set(this.r[i3], this.r[i3 + 1], this.r[i3 + 2]);
      this._q.setFromEuler(this._e);
      this._v.set(this.p[i3], this.p[i3 + 1], this.p[i3 + 2]);
      this._s.set(s, s, s);
      this._m.compose(this._v, this._q, this._s);
      this.mesh.setMatrixAt(i, this._m);
    }
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
  }
  clear() { for (let i = 0; i < this.n; i++) { this.life[i] = 0; this._hide(i); } this.mesh.instanceMatrix.needsUpdate = true; }
}
