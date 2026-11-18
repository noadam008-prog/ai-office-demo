// 壁に掛ける物の絵（案件ボード・開催カレンダー・時計・ロゴ・部署の札）。図形と字だけで描く。
import { clipText } from './layout.js';
const FONT = '"Yu Gothic UI","Yu Gothic","Hiragino Sans","Meiryo",sans-serif';
const COLS = [['idle', '待機', '#8a909c', 0.2], ['working', '作業中', '#2f7fc1', 0.38], ['review', '確認待ち', '#e0484f', 0.21], ['done', '完了', '#2e9f5b', 0.21]];
const colOf = st => st === 'stopped' ? 'working' : st;
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };

export class Board {
  constructor(canvas) { this.cv = canvas; this.c = canvas.getContext('2d'); this.pos = {}; this.dirty = true; this.staff = []; }
  set(staff) { this.staff = staff; this.dirty = true; }
  /** 付箋の行き先を決める。10人が1つの列に入っても、はみ出さないように高さを詰める。 */
  targets() {
    const W = this.cv.width, H = this.cv.height, top = 150, t = {}; let x = 26;
    for (const [key, , , frac] of COLS) {
      const w = (W - 52) * frac, list = this.staff.filter(s => colOf(s.status) === key), step = Math.min(50, (H - top - 16) / Math.max(list.length, 1));
      list.forEach((s, i) => { t[s.id] = { x: x + 8, y: top + i * step, w: w - 16, h: Math.min(44, step - 4), key }; });
      x += w;
    }
    return t;
  }
  /** 列が変わる時は、付箋が0.5秒ですべって移る。動いている間だけ描き直す。 */
  draw(dt) {
    const t = this.targets(); let moving = false;
    for (const s of this.staff) {
      const g = t[s.id], p = this.pos[s.id] ||= { ...g };
      const k = Math.min(1, dt / 0.5 * 3.2);
      for (const a of ['x', 'y', 'w', 'h']) { const d = g[a] - p[a]; if (Math.abs(d) > 0.5) { p[a] += d * k; moving = true; } else p[a] = g[a]; }
    }
    if (!moving && !this.dirty) return false;
    this.dirty = moving;
    const c = this.c, W = this.cv.width, H = this.cv.height;
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#e0484f'; c.fillRect(26, 22, 10, 44);
    c.fillStyle = '#22262e'; c.font = `800 44px ${FONT}`; c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillText('案件ボード', 48, 46);
    c.fillStyle = '#7b818c'; c.font = `600 32px ${FONT}`; c.textAlign = 'right'; c.fillText('いま、だれが何をしているか', W - 26, 48);
    let x = 26;
    for (const [, label, color, frac] of COLS) {
      const w = (W - 52) * frac;
      c.fillStyle = color; rr(c, x + 6, 84, w - 12, 48, 12); c.fill();
      c.fillStyle = '#fff'; c.font = `800 34px ${FONT}`; c.textAlign = 'center'; c.fillText(label, x + w / 2, 110);
      c.fillStyle = '#f5f6f8'; rr(c, x + 6, 140, w - 12, H - 150, 10); c.fill();
      x += w;
    }
    for (const s of this.staff) {
      const p = this.pos[s.id]; if (!p) continue;
      c.fillStyle = '#fffdf2'; rr(c, p.x, p.y, p.w, p.h, 6); c.fill();
      c.lineWidth = s.status === 'stopped' ? 5 : 1.5; c.strokeStyle = s.status === 'stopped' ? '#e0484f' : '#e4dfcf'; c.stroke();
      c.fillStyle = s.color; c.fillRect(p.x, p.y, 10, p.h);
      const fs = Math.max(32, Math.min(34, p.h - 6));
      c.fillStyle = '#22262e'; c.font = `700 ${fs}px ${FONT}`; c.textAlign = 'left';
      const doing = s.status === 'working' && s.doing ? `｜${s.doing}` : '';
      c.fillText(clipText((doing ? s.sei : s.name) + doing, p.w - 26, fs), p.x + 18, p.y + p.h / 2 + 1);
    }
    return true;
  }
}

export function drawNeon(cv, org) {
  const c = cv.getContext('2d'), W = cv.width, H = cv.height; c.clearRect(0, 0, W, H);
  c.font = `italic 900 ${H * 0.62}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.shadowColor = '#ff5fa2'; c.shadowBlur = 34; c.lineWidth = 10; c.strokeStyle = '#ff78b4'; c.strokeText(org.neon, W / 2, H / 2);
  c.shadowBlur = 0; c.lineWidth = 3; c.strokeStyle = '#fff'; c.strokeText(org.neon, W / 2, H / 2);
}
export function drawClock(cv, now = new Date()) {
  const c = cv.getContext('2d'), W = cv.width, H = cv.height;
  c.fillStyle = '#22262e'; c.fillRect(0, 0, W, H);
  c.fillStyle = '#fff'; c.font = `800 ${H * 0.66}px "Consolas","Menlo",monospace`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`, W / 2, H / 2 + 4);
}
/** 今月の本物の並び。今日に印を付け、会議などの予定は、字を書かずに色の付箋で見せる。 */
export function drawCalendar(cv, now = new Date(), colors = ['#2f7fc1', '#d6478d', '#1f9d8a', '#d49a17']) {
  const c = cv.getContext('2d'), W = cv.width, H = cv.height, y = now.getFullYear(), m = now.getMonth();
  c.fillStyle = '#fff'; c.fillRect(0, 0, W, H);
  c.fillStyle = '#22262e'; c.font = `800 40px ${FONT}`; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText('開催カレンダー', 24, 40);
  c.fillStyle = '#e0484f'; c.textAlign = 'right'; c.fillText(`${m + 1}月`, W - 24, 40);
  const cw = (W - 48) / 7, top = 78, rh = (H - top - 62) / 6, first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
  ['日', '月', '火', '水', '木', '金', '土'].forEach((d, i) => { c.fillStyle = i === 0 ? '#e0484f' : i === 6 ? '#2f7fc1' : '#7b818c'; c.font = `700 32px ${FONT}`; c.textAlign = 'center'; c.fillText(d, 24 + cw * (i + 0.5), top + 18); });
  for (let d = 1; d <= days; d++) {
    const i = first + d - 1, cxp = 24 + cw * (i % 7 + 0.5), cy = top + 46 + rh * Math.floor(i / 7) + rh * 0.36;
    if (d === now.getDate()) { c.fillStyle = '#e0484f'; c.beginPath(); c.arc(cxp, cy, 27, 0, 7); c.fill(); }
    c.fillStyle = d === now.getDate() ? '#fff' : i % 7 === 0 ? '#e0484f' : '#22262e'; c.font = `700 34px ${FONT}`; c.fillText(String(d), cxp, cy + 2);
    if ((d * 7 + m * 3) % 5 === 0 && i % 7 !== 0 && i % 7 !== 6) { c.fillStyle = colors[(d + m) % colors.length]; rr(c, cxp - cw * 0.34, cy + 26, cw * 0.68, 11, 4); c.fill(); }
  }
  c.fillStyle = '#7b818c'; c.font = `600 32px ${FONT}`; c.textAlign = 'left'; c.fillText('色の付箋＝会議・締切の予定', 24, H - 26);
}
export function drawSign(cv, text, color) {
  const c = cv.getContext('2d'), W = cv.width, H = cv.height;
  c.fillStyle = color; rr(c, 0, 0, W, H, H / 2); c.fill();
  c.fillStyle = '#fff'; c.font = `800 ${H * 0.56}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, W / 2, H / 2 + 2);
}
