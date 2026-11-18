// 位置と大きさの計算だけを集めた所（ブラウザに聞かずに計算するので、テストでも同じ物を使える）。
export const ROOM = { w: 27, d: 14.5, wallH: 6.4, cx: 0.9 };
export const VIEW = { dir: [0, 0.56, 0.83], target: [0.9, 1.6, -0.4], fov: 32 };
const ROWS = { back: { z: -3.9, step: 4.3 }, front: { z: 4.1, step: 3.8 } };

/** 名簿のとおりに、机を奥の列と手前の列に並べる。真ん中のテーブルは PM。 */
export function layoutDesks(staff, depts) {
  const seats = {}, rugs = [];
  for (const [row, r] of Object.entries(ROWS)) {
    const groups = Object.keys(depts).filter(d => depts[d].row === row).map(d => ({ d, m: staff.filter(s => s.dept === d) })).filter(g => g.m.length);
    const n = groups.reduce((a, g) => a + g.m.length, 0), gap = 0.25;
    const total = (n - 1) * r.step + (groups.length - 1) * gap;
    let col = row === 'front' ? 1 : 0, x = (row === 'front' ? ROOM.cx + 3.6 : ROOM.cx + 0.2) - total / 2;
    for (const g of groups) {
      const x0 = x;
      for (const s of g.m) { seats[s.id] = { x, z: r.z, row, dept: g.d, col: col++ }; x += r.step; }
      rugs.push({ dept: g.d, row, x0: x0 - 1.7, x1: x - r.step + 1.7, z: r.z });
      x += gap;
    }
  }
  for (const s of staff.filter(s => depts[s.dept]?.row === 'center')) seats[s.id] = { x: ROOM.cx + 0.4, z: -0.1, row: 'center', dept: s.dept };
  return { seats, rugs };
}

/** 文字の幅の見積もり：全角1文字＝字の大きさ、半角はその0.6倍。 */
export function textWidth(text, px) { let w = 0; for (const ch of String(text)) w += ch.codePointAt(0) > 0xff ? px : px * 0.6; return w; }
export function clipText(text, maxW, px) {
  text = String(text); if (textWidth(text, px) <= maxW) return text;
  let out = ''; for (const ch of text) { if (textWidth(out + ch + '…', px) > maxW) break; out += ch; } return out + '…';
}
export const roleLabel = s => s.idle || s.role;
export const PLATE = { h: 38, icon: 30, name: 14, role: 11, pad: 7, gap: 6 };
export const MOBILE_W = 820;
export function plateSize(s, compact = false) { if (compact) return { w: 40, h: 42 }; return { w: Math.ceil(PLATE.pad * 2 + PLATE.icon + PLATE.gap + Math.max(textWidth(s.name, PLATE.name), textWidth(roleLabel(s), PLATE.role))), h: PLATE.h }; }
export const BUBBLE = { h: 24, px: 13, maxW: 210, pad: 10, icon: 20 };
export function bubbleSize(text, withIcon) { const w = Math.min(BUBBLE.maxW, Math.ceil(textWidth(text, BUBBLE.px) + BUBBLE.pad * 2 + (withIcon ? BUBBLE.icon + 5 : 0))); return { w, h: BUBBLE.h }; }
/** カードの中に入る字の幅（入りきらない一言は「…」で切る）。 */
export const bubbleText = (text, withIcon) => clipText(text, BUBBLE.maxW - BUBBLE.pad * 2 - (withIcon ? BUBBLE.icon + 5 : 0), BUBBLE.px);

/** 画面の欄（左下・右の列・上の見出し）の場所。CSS の clamp と同じ計算。 */
export function panels(W, H) {
  const clamp = (a, v, b) => Math.max(a, Math.min(v, b));
  const none = { x: -9, y: -9, w: 0, h: 0 };
  if (W <= MOBILE_W) return { left: none, right: none, top: { x: 0, y: 0, w: W, h: 44 }, free: { x0: 2, x1: W - 2, y0: 48, y1: H - 6 } }; // スマホ：欄は3Dの下に並ぶ
  const lw = clamp(320, W * 0.25, 400), lh = clamp(300, H * 0.4, 420), m = 14, rw = 320;
  return { left: { x: m, y: H - m - lh, w: lw, h: lh }, right: { x: W - m - rw, y: m, w: rw, h: H - m * 2 }, top: { x: (W - rw) / 2 - 330, y: m, w: 660, h: 58 },
    free: { x0: 6, x1: W - rw - m * 2, y0: 74, y1: H - 30 } };
}
export const hit = (a, b, pad = 0) => a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;

/** 部屋の全体が、欄に隠れていない所にちょうど収まる距離にカメラを合わせる。 */
export function fitCamera(THREE, camera, W, H, points, zoom = 1, yaw = 0) {
  const f = panels(W, H).free, dir = new THREE.Vector3(...VIEW.dir).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw), target = new THREE.Vector3(...VIEW.target);
  camera.fov = VIEW.fov; camera.aspect = W / H;
  camera.setViewOffset(W, H, -((f.x0 + f.x1) / 2 - W / 2), -((f.y0 + f.y1) / 2 - H / 2), W, H);
  const fits = d => {
    camera.position.copy(target).addScaledVector(dir, d); camera.lookAt(target); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    return points.every(p => { const s = toScreen(THREE, camera, p, W, H); return s.x >= f.x0 && s.x <= f.x1 && s.y >= f.y0 && s.y <= f.y1; });
  };
  let lo = 6, hi = 120;
  for (let i = 0; i < 22; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
  const d = hi / zoom; fits(d);
  return d;
}
const _v = { v: null };
export function toScreen(THREE, camera, p, W, H) {
  const v = (_v.v ||= new THREE.Vector3()).set(p.x ?? p[0], p.y ?? p[1], p.z ?? p[2]).project(camera);
  return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H, behind: v.z > 1 };
}
/** 名札と、頭の上の文の場所。となりどうしの席は、頭の上の文を1つおきに1段上へずらす。 */
export function seatAnchors(seat, index) {
  const center = seat.row === 'center';
  return { plate: center ? [seat.x, 0.3, seat.z + 2.5] : [seat.x, 0.78, seat.z + 1.0], head: center ? [seat.x, 3.0, seat.z - 1.25] : [seat.x, 2.5 + ((seat.col ?? index) % 2) * 0.95, seat.z - 0.55] };
}
export function roomCorners() {
  const hw = ROOM.w / 2, hd = ROOM.d / 2, c = ROOM.cx;
  return [[c - hw, 0, hd], [c + hw, 0, hd], [c - hw, ROOM.wallH + 0.3, -hd], [c + hw, ROOM.wallH + 0.3, -hd], [c - hw, 0, -hd], [c + hw, 0, -hd]];
}
