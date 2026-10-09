/**
 * Instanced, procedurally animated deer and wolves. Each body part is one InstancedMesh;
 * per frame every animal's pose is built from its simulated state (interpolated between
 * ticks): gait phase from distance actually walked (so feet do not slide), leg swing with
 * speed, head lowered while grazing, eating or drinking, body lowered while resting.
 */
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useController } from '../runtime/context';
import { DEER, WOLF, isAdult, type Animal, type Species } from '../sim/agents';
import { getWorld } from '../sim/world';

const world = getWorld();
const MAX = { deer: 1400, wolf: 400 };
const lerpAngle = (a: number, b: number, t: number) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

interface Spec {
  bodyH: number; bodyLen: number; bodyR: number;
  legLen: number; hipX: number; shoulderX: number; legZ: number;
  neckLen: number; neckUp: number; neckDown: number;
  stride: number;
  colors: { body: string; head: string; leg: string; tail: string; accent: string };
}
const SPEC: Record<Species, Spec> = {
  deer: { bodyH: 0.95, bodyLen: 0.62, bodyR: 0.26, legLen: 0.9, hipX: -0.34, shoulderX: 0.32, legZ: 0.12, neckLen: 0.55, neckUp: -0.55, neckDown: -2.25, stride: 1.25,
    colors: { body: '#93643a', head: '#86592f', leg: '#6d4a2a', tail: '#f3ece0', accent: '#d9cbb2' } },
  wolf: { bodyH: 0.62, bodyLen: 0.62, bodyR: 0.2, legLen: 0.6, hipX: -0.3, shoulderX: 0.3, legZ: 0.1, neckLen: 0.28, neckUp: -1.0, neckDown: -2.3, stride: 1.05,
    colors: { body: '#8b9097', head: '#7d838a', leg: '#6b7076', tail: '#5c6168', accent: '#3d4249' } },
};

function makeGeometries(species: Species) {
  const s = SPEC[species];
  const body = new THREE.CapsuleGeometry(s.bodyR, s.bodyLen, 4, 10);
  body.rotateZ(Math.PI / 2);
  body.scale(1, 1, species === 'deer' ? 0.82 : 0.86);
  const accent = species === 'deer'
    ? new THREE.SphereGeometry(0.16, 8, 6).translate(-0.48, 0.05, 0) // white rump patch
    : new THREE.CapsuleGeometry(s.bodyR * 0.75, s.bodyLen * 0.8, 3, 8).rotateZ(Math.PI / 2).scale(1, 0.55, 0.8).translate(-0.02, s.bodyR * 0.55, 0); // dark saddle
  const neck = new THREE.CylinderGeometry(species === 'deer' ? 0.07 : 0.11, species === 'deer' ? 0.1 : 0.14, s.neckLen, 7).translate(0, s.neckLen / 2, 0);
  // Head in a neck-tip frame: skull, snout, ears.
  const parts: THREE.BufferGeometry[] = [];
  if (species === 'deer') {
    parts.push(new THREE.CapsuleGeometry(0.085, 0.16, 3, 8).rotateZ(Math.PI / 2).translate(0.1, 0.02, 0));
    parts.push(new THREE.ConeGeometry(0.045, 0.16, 6).rotateZ(Math.PI / 4).translate(-0.02, 0.13, 0.07));
    parts.push(new THREE.ConeGeometry(0.045, 0.16, 6).rotateZ(Math.PI / 4).translate(-0.02, 0.13, -0.07));
  } else {
    parts.push(new THREE.SphereGeometry(0.13, 10, 8).scale(1.1, 0.95, 0.95).translate(0.05, 0.02, 0));
    parts.push(new THREE.ConeGeometry(0.075, 0.24, 7).rotateZ(-Math.PI / 2).translate(0.25, -0.02, 0));
    parts.push(new THREE.ConeGeometry(0.05, 0.13, 4).translate(-0.02, 0.15, 0.065));
    parts.push(new THREE.ConeGeometry(0.05, 0.13, 4).translate(-0.02, 0.15, -0.065));
  }
  const head = mergeGeometries(parts);
  const nose = new THREE.SphereGeometry(species === 'deer' ? 0.03 : 0.035, 6, 5).translate(species === 'deer' ? 0.27 : 0.37, species === 'deer' ? 0.01 : -0.02, 0);
  const leg = new THREE.CylinderGeometry(0.045, 0.032, s.legLen, 5).translate(0, -s.legLen / 2, 0);
  const foot = new THREE.CylinderGeometry(0.04, 0.045, 0.07, 5).translate(0, -s.legLen + 0.03, 0);
  const tail = species === 'deer'
    ? new THREE.ConeGeometry(0.06, 0.18, 6).translate(0, 0.09, 0)
    : new THREE.ConeGeometry(0.07, 0.48, 7).translate(0, -0.24, 0);
  // Antlers (bucks only): a few tines, in the head frame.
  const antler = species === 'deer'
    ? mergeGeometries([
        new THREE.CylinderGeometry(0.012, 0.018, 0.32, 4).rotateZ(-0.3).translate(-0.02, 0.24, 0.06),
        new THREE.CylinderGeometry(0.012, 0.018, 0.32, 4).rotateZ(-0.3).translate(-0.02, 0.24, -0.06),
        new THREE.CylinderGeometry(0.01, 0.014, 0.16, 4).rotateZ(-1.0).translate(0.06, 0.3, 0.07),
        new THREE.CylinderGeometry(0.01, 0.014, 0.16, 4).rotateZ(-1.0).translate(0.06, 0.3, -0.07),
      ])
    : null;
  return { body, accent, neck, head, nose, leg, foot, tail, antler };
}

function mergeGeometries(list: THREE.BufferGeometry[]) {
  const out = new THREE.BufferGeometry();
  const pos: number[] = [], nor: number[] = [], idx: number[] = [];
  let offset = 0;
  for (const g0 of list) {
    const g = g0.index ? g0 : g0;
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + offset);
    else for (let i = 0; i < p.count; i++) idx.push(i + offset);
    offset += p.count;
  }
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setIndex(idx);
  return out;
}

const hash = (n: number) => { const s = Math.sin(n * 91.3 + 17.1) * 43758.5453; return s - Math.floor(s); };

export function AnimalHerd({ species }: { species: Species }) {
  const ctl = useController();
  const geos = useMemo(() => makeGeometries(species), [species]);
  const spec = SPEC[species];
  const T = species === 'deer' ? DEER : WOLF;
  const max = MAX[species];
  const refs = {
    body: useRef<THREE.InstancedMesh>(null), accent: useRef<THREE.InstancedMesh>(null), neck: useRef<THREE.InstancedMesh>(null),
    head: useRef<THREE.InstancedMesh>(null), nose: useRef<THREE.InstancedMesh>(null), legs: useRef<THREE.InstancedMesh>(null),
    feet: useRef<THREE.InstancedMesh>(null), tail: useRef<THREE.InstancedMesh>(null), antler: useRef<THREE.InstancedMesh>(null),
  };
  const ids = useRef<number[]>([]);
  const m = useMemo(() => ({
    root: new THREE.Matrix4(), frame: new THREE.Matrix4(), tmp: new THREE.Matrix4(), zero: new THREE.Matrix4().makeScale(0, 0, 0),
    col: new THREE.Color(), base: new THREE.Color(spec.colors.body),
  }), [spec]);

  const local = (out: THREE.Matrix4, x: number, y: number, z: number, rotZ: number) => {
    out.makeRotationZ(rotZ);
    out.setPosition(x, y, z);
    return out;
  };

  useFrame(({ clock }) => {
    const sim = ctl.sim;
    const a0 = ctl.alpha;
    const list: Animal[] = [];
    for (const a of sim.animals) if (a.species === species) list.push(a);
    const n = Math.min(list.length, max);
    ids.current.length = n;
    const r = refs;
    for (let i = 0; i < n; i++) {
      const a = list[i];
      ids.current[i] = a.id;
      const x = a.px + (a.x - a.px) * a0, z = a.pz + (a.z - a.pz) * a0;
      const heading = lerpAngle(a.pheading, a.heading, a0);
      const y = world.heightAt(x, z);
      const grow = 0.55 + 0.45 * Math.min(1, a.age / T.maturity);
      const resting = a.state === 'rest' || a.state === 'recover';
      const headDown = a.state === 'graze' || a.state === 'drink' || a.state === 'eat' ? 1 : 0;
      const lie = resting ? 0.42 * spec.bodyH : 0;
      // Root: position, yaw (model faces +X), slight pitch with the slope.
      const ahead = world.heightAt(x + Math.cos(heading) * 0.6, z + Math.sin(heading) * 0.6) - world.heightAt(x - Math.cos(heading) * 0.6, z - Math.sin(heading) * 0.6);
      m.root.makeRotationY(-heading);
      m.tmp.makeRotationZ(Math.atan2(ahead, 1.2) * 0.8);
      m.root.multiply(m.tmp);
      m.tmp.makeScale(grow, grow, grow);
      m.root.multiply(m.tmp);
      m.root.setPosition(x, y, z);

      const speed = Math.hypot(a.x - a.px, a.z - a.pz);
      const amp = resting ? 0 : Math.min(0.75, (speed / T.sprint) * 1.15 + (speed > 0.01 ? 0.12 : 0));
      const phase = (a.gait / (spec.stride * grow)) * Math.PI * 2;
      const gallop = speed > T.trot * 1.05;
      const bob = Math.abs(Math.sin(phase)) * 0.05 * amp;
      const bodyY = spec.bodyH - lie + bob;

      // Body and accent
      r.body.current!.setMatrixAt(i, m.frame.multiplyMatrices(m.root, local(m.tmp, 0, bodyY, 0, 0)));
      r.accent.current!.setMatrixAt(i, m.frame);
      const shade = 0.82 + hash(a.id) * 0.3;
      m.col.copy(m.base).multiplyScalar(shade);
      if (ctl.selectedId === a.id) m.col.lerp(new THREE.Color('#ffe066'), 0.45);
      r.body.current!.setColorAt(i, m.col);

      // Neck and head
      const neckRot = spec.neckUp + (spec.neckDown - spec.neckUp) * headDown;
      local(m.tmp, spec.shoulderX + 0.06, bodyY + spec.bodyR * 0.45, 0, neckRot);
      m.frame.multiplyMatrices(m.root, m.tmp);
      r.neck.current!.setMatrixAt(i, m.frame);
      // Neck tip
      m.tmp.makeTranslation(0, spec.neckLen, 0);
      m.frame.multiply(m.tmp);
      m.tmp.makeRotationZ(-neckRot + (headDown ? -1.1 : -0.15) + Math.sin(clock.elapsedTime * 2 + a.id) * 0.04);
      m.frame.multiply(m.tmp);
      r.head.current!.setMatrixAt(i, m.frame);
      r.nose.current!.setMatrixAt(i, m.frame);
      if (r.antler.current) r.antler.current.setMatrixAt(i, a.sex === 'M' && isAdult(a) ? m.frame : m.zero);

      // Legs: diagonal pairs when walking, front/back pairs when galloping.
      const legs: [number, number, number][] = [
        [spec.shoulderX, spec.legZ, 0], [spec.shoulderX, -spec.legZ, Math.PI],
        [spec.hipX, spec.legZ, gallop ? 0.6 : Math.PI], [spec.hipX, -spec.legZ, gallop ? 0.6 + Math.PI * 0.2 : 0],
      ];
      for (let k = 0; k < 4; k++) {
        const [lx, lz, off] = legs[k];
        const swing = resting ? (k < 2 ? -1.35 : 1.35) : amp * Math.sin(phase + off);
        local(m.tmp, lx, bodyY - spec.bodyR * 0.3, lz, swing);
        m.frame.multiplyMatrices(m.root, m.tmp);
        r.legs.current!.setMatrixAt(i * 4 + k, m.frame);
        r.feet.current!.setMatrixAt(i * 4 + k, m.frame);
      }
      // Tail: deer flag it up when fleeing; wolves raise it while chasing.
      const wag = Math.sin(clock.elapsedTime * 6 + a.id) * 0.12;
      const tailRot = species === 'deer' ? (a.state === 'flee' ? -0.1 : 0.9) + wag * 0.5 : (a.state === 'chase' ? -1.75 : -2.5) + wag;
      local(m.tmp, -spec.bodyLen / 2 - spec.bodyR * 0.8, bodyY + spec.bodyR * 0.5, 0, tailRot);
      m.frame.multiplyMatrices(m.root, m.tmp);
      r.tail.current!.setMatrixAt(i, m.frame);
    }
    for (const [key, ref] of Object.entries(r)) {
      const mesh = ref.current;
      if (!mesh) continue;
      mesh.count = key === 'legs' || key === 'feet' ? n * 4 : n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      // Animals move every tick: drop the cached bounds so click raycasts use current positions.
      mesh.boundingSphere = null;
    }
  });

  const onPick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.instanceId === undefined) return;
    const id = ids.current[e.instanceId];
    if (id !== undefined) ctl.select(id);
  };

  const c = spec.colors;
  return (
    <group>
      <instancedMesh ref={refs.body} args={[geos.body, undefined, max]} castShadow onClick={onPick} frustumCulled={false}>
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={refs.accent} args={[geos.accent, undefined, max]} castShadow frustumCulled={false}><meshStandardMaterial color={c.accent} roughness={0.9} /></instancedMesh>
      <instancedMesh ref={refs.neck} args={[geos.neck, undefined, max]} castShadow frustumCulled={false}><meshStandardMaterial color={c.head} roughness={0.85} /></instancedMesh>
      <instancedMesh ref={refs.head} args={[geos.head, undefined, max]} castShadow onClick={onPick} frustumCulled={false}><meshStandardMaterial color={c.head} roughness={0.8} /></instancedMesh>
      <instancedMesh ref={refs.nose} args={[geos.nose, undefined, max]} frustumCulled={false}><meshStandardMaterial color="#1b1b1b" roughness={0.4} /></instancedMesh>
      <instancedMesh ref={refs.legs} args={[geos.leg, undefined, max * 4]} castShadow frustumCulled={false}><meshStandardMaterial color={c.leg} roughness={0.9} /></instancedMesh>
      <instancedMesh ref={refs.feet} args={[geos.foot, undefined, max * 4]} frustumCulled={false}><meshStandardMaterial color="#2a2420" roughness={0.9} /></instancedMesh>
      <instancedMesh ref={refs.tail} args={[geos.tail, undefined, max]} castShadow frustumCulled={false}><meshStandardMaterial color={c.tail} roughness={0.9} /></instancedMesh>
      {geos.antler && (
        <instancedMesh ref={refs.antler} args={[geos.antler, undefined, max]} castShadow frustumCulled={false}><meshStandardMaterial color="#d8c6a2" roughness={0.7} /></instancedMesh>
      )}
    </group>
  );
}

/** Carcasses: dark mounds that shrink as the meat is eaten or decays. */
export function Carcasses() {
  const ctl = useController();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => new THREE.SphereGeometry(0.45, 8, 6).scale(1.5, 0.45, 0.9), []);
  const m = useMemo(() => new THREE.Matrix4(), []);
  useFrame(() => {
    const cs = ctl.sim.carcasses;
    const n = Math.min(cs.length, 200);
    for (let i = 0; i < n; i++) {
      const c = cs[i];
      const s = 0.4 + 0.6 * Math.sqrt(c.meat / c.initialMeat);
      m.makeScale(s, s, s);
      m.setPosition(c.x, world.heightAt(c.x, c.z) + 0.1, c.z);
      mesh.current!.setMatrixAt(i, m);
    }
    if (mesh.current) { mesh.current.count = n; mesh.current.instanceMatrix.needsUpdate = true; }
  });
  return (
    <instancedMesh ref={mesh} args={[geo, undefined, 200]} frustumCulled={false} castShadow>
      <meshStandardMaterial color="#5a2a24" roughness={0.8} />
    </instancedMesh>
  );
}
