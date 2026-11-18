// 部屋・机・社員を、名簿のとおりに組み立てる（ブラウザが無くても組み立てられる。絵は tex が null なら貼らない）。
import { ROOM, layoutDesks } from './layout.js';

export function buildRoom(THREE, st, tex = null) {
  const g = new THREE.Group(), hw = ROOM.w / 2, hd = ROOM.d / 2, cx = ROOM.cx;
  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.86, metalness: 0, ...o });
  const add = (geo, m, x, y, z, parent = g, shadow = true) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = shadow; o.receiveShadow = true; parent.add(o); return o; };
  const box = (w, h, d, m, x, y, z, parent) => add(new THREE.BoxGeometry(w, h, d), m, x, y, z, parent);
  const tint = (hex, k) => new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), k);
  const white = mat('#fbfaf6'), wood = mat('#e9dcc6'), dark = mat('#2d313b'), skin = mat('#f6d2b0'), metal = mat('#c9ccd3', { roughness: 0.4, metalness: 0.5 });

  // 床と壁（横の壁は手前に向かって低くして、手前の席を隠さない）
  box(ROOM.w, 0.3, ROOM.d, mat('#f1eee8'), cx, -0.15, 0).castShadow = false;
  box(ROOM.w + 0.6, ROOM.wallH, 0.3, white, cx, ROOM.wallH / 2, -hd - 0.15);
  const side = new THREE.Shape(); side.moveTo(-hd, 0); side.lineTo(hd, 0); side.lineTo(hd, 0.9); side.lineTo(-hd, ROOM.wallH); side.closePath();
  const sideGeo = new THREE.ExtrudeGeometry(side, { depth: 0.3, bevelEnabled: false });
  for (const s of [-1, 1]) { const w = add(sideGeo, white, cx + s * hw + (s < 0 ? 0 : 0.3), 0, 0); w.rotation.y = -Math.PI / 2; }
  box(ROOM.w, 0.12, 0.08, mat('#d9d4c9'), cx, 0.06, -hd + 0.05);

  const { seats: pos, rugs } = layoutDesks(st.staff, st.depts), seats = {}, signs = [];
  for (const r of rugs) {
    const c = st.depts[r.dept].color, w = r.x1 - r.x0;
    box(w, 0.04, 4.3, mat(tint(c, 0.8)), (r.x0 + r.x1) / 2, 0.02, r.z - 0.2).castShadow = false;
    signs.push({ dept: r.dept, row: r.row, x: (r.x0 + r.x1) / 2, z: r.z, w });
  }

  const lapGeo = new THREE.BoxGeometry(0.74, 0.04, 0.5), lidGeo = new THREE.BoxGeometry(0.74, 0.48, 0.04), handGeo = new THREE.SphereGeometry(0.1, 10, 8);
  const headGeo = new THREE.SphereGeometry(0.37, 22, 16), hairGeo = new THREE.SphereGeometry(0.392, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.44), bodyGeo = new THREE.CylinderGeometry(0.3, 0.4, 0.95, 18);
  for (const s of st.staff) {
    const p = pos[s.id]; if (!p) continue;
    const center = p.row === 'center', grp = new THREE.Group(); grp.position.set(p.x, 0, p.z); g.add(grp);
    if (center) {
      add(new THREE.CylinderGeometry(2.0, 2.0, 0.12, 40), wood, 0, 1.0, 0.45, grp); add(new THREE.CylinderGeometry(0.28, 0.5, 0.95, 16), dark, 0, 0.48, 0.45, grp);
      add(new THREE.CylinderGeometry(2.6, 2.6, 0.04, 40), mat(tint(st.depts[s.dept].color, 0.86)), 0, 0.02, 0.45, grp, false);
    } else {
      box(2.5, 0.1, 1.2, white, 0, 1.0, 0.25, grp);
      for (const [lx, lz] of [[-1.1, -0.2], [1.1, -0.2], [-1.1, 0.7], [1.1, 0.7]]) box(0.08, 0.95, 0.08, metal, lx, 0.48, lz, grp);
      box(2.5, 0.06, 0.08, mat(st.depts[s.dept].color), 0, 0.93, 0.83, grp); // 机の手前のふちに、部署の色
    }
    const person = new THREE.Group(); person.position.set(0, 0, center ? -1.05 : -0.72); grp.add(person);
    const body = add(bodyGeo, mat(s.color), 0, 1.18, 0, person), head = add(headGeo, skin, 0, 2.0, 0, person);
    const hair = add(hairGeo, mat(['#2b2622', '#3a2c22', '#1f2430', '#4a3526'][s.name.length % 4 + (s.yomi.length % 2) - 0 > 3 ? 3 : (s.name.charCodeAt(0) + s.yomi.length) % 4]), 0, 2.03, -0.02, person);
    hair.rotation.x = -0.5;
    for (const ex of [-0.13, 0.13]) add(new THREE.SphereGeometry(0.042, 8, 6), dark, ex, 2.0, 0.348, person, false);
    const hands = [-0.3, 0.3].map(hx => add(handGeo, skin, hx, 1.1, 0.62, person));
    const lz = center ? 0.1 : 0.2;
    add(lapGeo, metal, 0, 1.075, lz, grp);
    const glow = mat('#cfd3da', { roughness: 0.5, emissive: new THREE.Color(s.color), emissiveIntensity: 0 });
    const lid = add(lidGeo, glow, 0, 1.3, lz + 0.27, grp); lid.rotation.x = 0.22;
    if (!center) { const cup = add(new THREE.CylinderGeometry(0.09, 0.075, 0.2, 12), mat(tint(s.color, 0.35)), 0.85, 1.15, 0.2, grp); cup.userData.cup = true; }
    seats[s.id] = { ...p, grp, person, body, head, hair, hands, lid, glow, base: { y: 0 } };
  }

  // 壁の物（絵は、後で貼る）
  const plane = (w, h, x, y) => add(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: '#ffffff' }), x, y, -hd + 0.07, g, false);
  const frame = (w, h, x, y, c = '#3a3f4b') => box(w + 0.22, h + 0.22, 0.08, mat(c), x, y, -hd + 0.0);
  const wall = { board: { w: 12.2, h: 4.5, x: cx - 6.6, y: 3.95 }, neon: { w: 5.0, h: 1.25, x: cx + 3.4, y: 5.2 }, clock: { w: 3.0, h: 1.2, x: cx + 3.4, y: 3.55 }, calendar: { w: 5.6, h: 4.3, x: cx + 9.3, y: 3.75 } };
  for (const [k, w] of Object.entries(wall)) { if (k !== 'neon') frame(w.w, w.h, w.x, w.y, k === 'board' ? '#3a3f4b' : '#d9d4c9'); w.mesh = plane(w.w, w.h, w.x, w.y); }
  wall.neon.mesh.material.transparent = true;

  // 部署の札：奥の列は奥の壁の低い所、手前の列は床に寝かせる、会議テーブルはテーブルの上に立てる
  for (const s of signs) {
    const d = st.depts[s.dept], w = 3.6, h = 0.62, m = new THREE.MeshBasicMaterial({ color: d.color });
    const o = s.row === 'back' ? add(new THREE.PlaneGeometry(w, h), m, s.x, 1.08, -hd + 0.07, g, false) : add(new THREE.PlaneGeometry(w, h), m, s.x, 0.06, s.z + 2.55, g, false);
    if (s.row !== 'back') o.rotation.x = -Math.PI / 2;
    s.mesh = o; s.size = [w, h];
  }
  const pm = Object.values(seats).find(s => s.row === 'center');
  if (pm) { const d = st.depts[pm.dept], o = add(new THREE.PlaneGeometry(2.3, 0.5), new THREE.MeshBasicMaterial({ color: d.color }), pm.x + 0.9, 1.33, pm.z + 1.75, g, false); o.rotation.x = -0.35; signs.push({ dept: pm.dept, row: 'center', mesh: o, size: [2.3, 0.5] }); }

  // 小物：書類の棚、封筒のトレー、案内のスタンド、観葉植物
  const shelfX = cx - hw + 1.3; box(2.0, 2.6, 0.7, wood, shelfX, 1.3, -hd + 0.5);
  ['#2f7fc1', '#d6478d', '#1f9d8a', '#d49a17', '#39414f', '#2f7fc1', '#d6478d'].forEach((c, i) => box(0.2, 0.62, 0.5, mat(c), shelfX - 0.75 + i * 0.25, 2.25 - (i % 2) * 0.86 + 0.0, -hd + 0.55));
  const t = Object.values(seats).filter(s => s.dept === 'touroku')[0];
  if (t) for (let i = 0; i < 4; i++) box(0.5, 0.035, 0.34, mat(i % 2 ? '#ffffff' : '#f4e9d2'), t.x - 0.85 + (i % 2) * 0.03, 1.08 + i * 0.04, t.z + 0.3);
  const ev = signs.find(s => s.dept === 'event');
  if (ev) { box(1.3, 2.5, 0.06, mat(tint(st.depts.event.color, 0.25)), ev.x + ev.w / 2 + 0.2, 1.45, ev.z - 1.9); box(0.08, 0.2, 0.6, dark, ev.x + ev.w / 2 + 0.2, 0.1, ev.z - 1.9); }
  for (const [px, pz] of [[cx - hw + 1.0, hd - 3.6 > 0 ? -1.5 : 0], [cx + hw - 1.0, -hd + 1.0], [cx + hw - 1.1, hd - 1.2]]) {
    add(new THREE.CylinderGeometry(0.34, 0.26, 0.6, 14), mat('#e9e4da'), px, 0.3, pz);
    for (const [ox, oy, r] of [[0, 1.05, 0.5], [-0.28, 0.85, 0.36], [0.3, 0.9, 0.38]]) add(new THREE.SphereGeometry(r, 12, 10), mat('#4fae5b'), px + ox, oy, pz);
  }
  return { group: g, seats, signs, wall };
}
