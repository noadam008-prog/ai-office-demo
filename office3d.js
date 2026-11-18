// 3Dのオフィス：描く・動かす・カメラ。state と fx を受け取って動く。
import * as THREE from './vendor/three.module.js';
import { buildRoom } from './scene.js';
import { Board, drawNeon, drawClock, drawCalendar, drawSign } from './board.js';
import { Labels, pickChatter } from './labels.js';
import { fitCamera, roomCorners, ROOM, MOBILE_W } from './layout.js';

export function createOffice(canvas, layer, st) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch { return null; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(32, 1, 0.5, 300);
  const cvTex = (w, h) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return { cv, t }; };
  const room = buildRoom(THREE, st); scene.add(room.group);
  scene.add(new THREE.HemisphereLight('#ffffff', '#e8e2d6', 1.9));
  const sun = new THREE.DirectionalLight('#fff6ea', 1.7); sun.position.set(ROOM.cx - 6, 16, 9); sun.target.position.set(ROOM.cx, 0, 0); // 影は、この1つの明かりだけに落とさせる
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 12, bottom: -12, near: 1, far: 50 }); sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);

  // 壁の絵
  const put = (w, name, cw, ch) => { const x = cvTex(cw, ch); w.mesh.material.map = x.t; w.mesh.material.needsUpdate = true; return x; };
  const boardTex = put(room.wall.board, 'board', 1464, 540), board = new Board(boardTex.cv); board.set(st.staff);
  const neon = put(room.wall.neon, 'neon', 800, 200); drawNeon(neon.cv, st.org);
  const clock = put(room.wall.clock, 'clock', 480, 192), cal = put(room.wall.calendar, 'cal', 728, 560);
  const wallTime = () => { drawClock(clock.cv); clock.t.needsUpdate = true; drawCalendar(cal.cv, new Date(), Object.values(st.depts).map(d => d.color)); cal.t.needsUpdate = true; };
  wallTime(); setInterval(wallTime, 20000);
  for (const s of room.signs) { const x = cvTex(Math.round(s.size[0] * 150), Math.round(s.size[1] * 150)); drawSign(x.cv, st.depts[s.dept].name, st.depts[s.dept].color); s.mesh.material.map = x.t; s.mesh.material.color.set('#ffffff'); s.mesh.material.transparent = true; s.mesh.material.needsUpdate = true; }

  const labels = new Labels(layer, st.staff), byId = Object.fromEntries(st.staff.map(s => [s.id, s]));
  let staff = st.staff, W = 1, H = 1, zoom = 1, yaw = 0, auto = false, t0 = performance.now(), chatterCfg = st.chatter;
  const corners = roomCorners().map(p => new THREE.Vector3(...p));
  const fit = () => fitCamera(THREE, camera, W, H, corners, zoom, yaw + (auto ? Math.sin(performance.now() / 5200) * 0.22 : 0));
  function resize() { const r = canvas.parentElement.getBoundingClientRect(); W = Math.max(320, r.width); H = Math.max(240, r.height); renderer.setSize(W, H, false); labels.setCompact(W <= MOBILE_W); fit(); }
  new ResizeObserver(resize).observe(canvas.parentElement); resize();

  // カメラ：ドラッグで回す・ホイールで寄る（角度と距離に上限）。ダブルクリックで最初の視点に戻す
  let drag = null; const onAuto = [];
  const setAuto = v => { auto = v; onAuto.forEach(f => f(auto)); };
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, yaw }; canvas.setPointerCapture(e.pointerId); if (auto) setAuto(false); });
  canvas.addEventListener('pointermove', e => { if (drag) { yaw = Math.max(-0.6, Math.min(0.6, drag.yaw - (e.clientX - drag.x) * 0.004)); fit(); } });
  canvas.addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('wheel', e => { e.preventDefault(); zoom = Math.max(1, Math.min(2.6, zoom * (e.deltaY < 0 ? 1.08 : 0.93))); fit(); }, { passive: false });
  canvas.addEventListener('dblclick', () => { zoom = 1; yaw = 0; fit(); });

  // 演出
  const glows = [], rings = [], confetti = [];
  const glow = (id, delay = 0) => glows.push({ m: room.seats[id]?.glow, at: performance.now() + delay });
  const ringGeo = new THREE.RingGeometry(0.92, 1, 48);
  function ring(color) { const pm = Object.values(room.seats).find(s => s.row === 'center'); const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.set(pm.x, 0.07, pm.z); scene.add(m); rings.push({ m, at: performance.now() }); }
  function party() { const pm = Object.values(room.seats).find(s => s.row === 'center'), cols = Object.values(st.depts).map(d => d.color), geo = new THREE.PlaneGeometry(0.16, 0.1);
    for (let i = 0; i < 110; i++) { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide })); m.position.set(pm.x + (Math.random() - 0.5) * 3, 3.2 + Math.random() * 2.5, pm.z + 0.4 + (Math.random() - 0.5) * 3); scene.add(m); confetti.push({ m, vx: (Math.random() - 0.5) * 1.6, vy: -0.6 - Math.random(), vz: (Math.random() - 0.5) * 1.6, r: Math.random() * 6, at: performance.now() }); } }
  function fx(f) {
    if (f.type === 'call') { glow(f.from); glow(f.to, 350); setTimeout(() => labels.card(f.to, byId[f.from], f.text || '頼みます'), 350); }
    if (f.type === 'return') { glow(f.from); labels.card(f.to, byId[f.from], f.text, 2600); labels.love(f.from); }
    if (f.type === 'inquiry') { glow(f.to); labels.card(f.to, null, '新しい連絡が届きました', 4000, 'inq'); }
    if (f.type === 'check') { glow(f.to); labels.card(f.to, null, f.text, 3500, 'ng'); }
    if (f.type === 'replyOut') glow(f.from);
    if (f.type === 'ok') ring('#2e9f5b');
    if (f.type === 'reject') ring('#e0484f');
    if (f.type === 'done') party();
  }
  function update(s) { staff = s.staff; chatterCfg = s.chatter; labels.setState(staff); board.set(staff); }
  labels.setState(staff);

  // ひとりごと：1人につき25〜60秒に1回、同時に2人まで。仕事の文が出ている人は言わない
  const nextTalk = Object.fromEntries(staff.map(s => [s.id, performance.now() + 6000 + Math.random() * 30000]));
  let talking = 0;
  function chatter(now) {
    if (!chatterCfg?.enabled) return;
    for (const s of staff) if (now > nextTalk[s.id]) {
      nextTalk[s.id] = now + (chatterCfg.minSeconds + Math.random() * (chatterCfg.maxSeconds - chatterCfg.minSeconds)) * 1000;
      if (talking < 2 && !labels.busy(s.id)) { talking++; labels.say(s.id, pickChatter(s, s.status)); setTimeout(() => talking--, 4000); }
    }
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000), t = (now - t0) / 1000; last = now;
    if (auto) fit();
    staff.forEach((s, i) => {
      const seat = room.seats[s.id]; if (!seat) return;
      const typing = s.status === 'working', ph = t * 1.3 + i * 1.7;
      seat.hands[0].position.y = 1.1 + (typing ? Math.max(0, Math.sin(t * 17 + i)) * 0.07 : 0); seat.hands[1].position.y = 1.1 + (typing ? Math.max(0, Math.sin(t * 17 + i + 1.6)) * 0.07 : 0);
      seat.person.rotation.x = typing ? 0.07 + Math.sin(t * 3 + i) * 0.012 : 0;
      // 待機中の小さな動き（人ごとに時間をずらす）：伸び・首をかしげる
      const cyc = (t + i * 5.3) % 23, stretch = !typing && cyc < 1.6 ? Math.sin(cyc / 1.6 * Math.PI) : 0;
      seat.person.scale.y = 1 + stretch * 0.07 + Math.sin(ph) * 0.006; seat.person.rotation.z = !typing && cyc > 11 && cyc < 12.5 ? Math.sin((cyc - 11) / 1.5 * Math.PI) * 0.09 : 0;
      seat.person.rotation.y = s.status === 'review' ? Math.sin(t * 0.8 + i) * 0.12 : 0;
    });
    for (let i = glows.length - 1; i >= 0; i--) { const g = glows[i], k = (now - g.at) / 1300; if (!g.m) { glows.splice(i, 1); continue; } if (k < 0) continue; g.m.emissiveIntensity = k > 1 ? 0 : Math.sin(Math.min(1, k) * Math.PI) * 1.6; if (k > 1) glows.splice(i, 1); }
    for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i], k = (now - r.at) / 1400; r.m.scale.setScalar(1 + k * 9); r.m.material.opacity = Math.max(0, 0.75 * (1 - k)); if (k > 1) { scene.remove(r.m); r.m.material.dispose(); rings.splice(i, 1); } }
    for (let i = confetti.length - 1; i >= 0; i--) { const c = confetti[i]; c.m.position.x += c.vx * dt; c.m.position.y += c.vy * dt; c.m.position.z += c.vz * dt; c.m.rotation.x = c.r + t * 5; c.m.rotation.z = c.r + t * 3; if (c.m.position.y < 1.1 || now - c.at > 6000) { scene.remove(c.m); c.m.material.dispose(); confetti.splice(i, 1); } }
    if (board.draw(dt)) boardTex.t.needsUpdate = true;
    chatter(now); labels.tick(now, THREE, camera, room.seats, W, H);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return { update, fx, toggleAuto: () => { setAuto(!auto); if (!auto) fit(); return auto; }, onAuto: f => onAuto.push(f) };
}
