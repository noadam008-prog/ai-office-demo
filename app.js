// 画面の入口：サーバーから state（画面の中身の全部）と fx（一回きりの演出）を受け取って、欄と3Dに渡す。
import { createPanels } from './panels.js';

const $ = id => document.getElementById(id);
const dom = { left: $('boss'), right: $('side'), top: $('top'), note: $('note'), toasts: $('toasts'), conn: $('conn') };
let panels = null, office = null, started = false, lastPhase = '';

// スマホの幅では、欄を1つずつ切りかえて見せる
const tabs = {};
function setTab(t) { document.body.dataset.tab = t; for (const [k, b] of Object.entries(tabs)) b.setAttribute('aria-selected', String(k === t)); if (t === 'boss') tabs.boss.classList.remove('dot'); if (t === 'window') tabs.window.classList.remove('dot'); }
function makeTabs(org) {
  for (const [k, label] of [['boss', org.bossPanel], ['feed', '通知・納品'], ['window', '連絡窓口']]) { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.addEventListener('click', () => setTab(k)); $('tabs').append(b); tabs[k] = b; }
  setTab('boss');
}

async function start(state) {
  started = true;
  document.title = `${state.org.short}｜AIバーチャルオフィス`;
  panels = createPanels(dom, state.org); makeTabs(state.org);
  try {
    const { createOffice } = await import('./office3d.js');
    office = createOffice($('gl'), $('labels'), state);
  } catch { office = null; }
  if (!office) $('no3d').hidden = false; // 3D が作れないブラウザでも、欄と一覧はそのまま使える
  else { const b = $('cam'); b.hidden = false; const label = a => { b.textContent = a ? '視点を固定' : '自動で動かす'; }; label(false); office.onAuto(label); b.addEventListener('click', () => office.toggleAuto()); }
}
function onState(state) {
  if (!started) return start(state).then(() => onState(state)); if (!panels) return;
  panels.render(state); office?.update(state);
  // 質問や確認のカードが来たら、指示の欄に切りかえる
  if (state.phase !== lastPhase) { if (['asking', 'review', 'stopped'].includes(state.phase) && document.body.dataset.tab === 'feed') setTab('boss'); else if (['asking', 'review', 'stopped'].includes(state.phase) && document.body.dataset.tab !== 'boss') tabs.boss?.classList.add('dot'); lastPhase = state.phase; }
}
function onFx(f) {
  if (!panels) return;
  office?.fx(f);
  if (f.type === 'wrote') panels.toast(f.text, '', 3000);
  if (f.type === 'inquiry') panels.toast('委員から、連絡が届きました', 'inq', 5000);
  if (f.type === 'replyOut') { panels.toast('連絡窓口に、返事を出しました', 'inq', 5000); if (document.body.dataset.tab !== 'window') tabs.window?.classList.add('dot'); }
}
// つながりが切れたら知らせて、自分でつなぎ直す（EventSource が自動でやり直す）
const es = new EventSource('/api/events');
es.addEventListener('state', e => { dom.conn.hidden = true; onState(JSON.parse(e.data)); });
es.addEventListener('fx', e => onFx(JSON.parse(e.data)));
es.onerror = () => { dom.conn.hidden = false; };
