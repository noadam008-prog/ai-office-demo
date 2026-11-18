// 画面の欄：左下（担当者からの指示）・右の列（通知・納品フィード・連絡窓口）・上の見出し。
// AI が返した文は、すべて textContent で入れる（HTML として実行させない）。
import { el, iconEl } from './labels.js';

async function post(path, body) {
  try { const r = await fetch('/api/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }); return await r.json(); }
  catch { return { ok: false, reason: 'サーバーにつながっていません' }; }
}
/** 一覧は、id が同じ物を作り直さずに中身だけ変える（書いている途中の文字を消さないため）。 */
function sync(box, items, make, update) {
  const have = new Map([...box.children].map(n => [n.dataset.id, n]));
  items.forEach((it, i) => {
    let n = have.get(String(it.id)); if (!n) { n = make(it); n.dataset.id = it.id; } have.delete(String(it.id));
    update?.(n, it); if (box.children[i] !== n) box.insertBefore(n, box.children[i] || null);
  });
  for (const n of have.values()) n.remove();
}
const btn = (text, cls, fn) => { const b = el('button', cls, text); b.type = 'button'; b.addEventListener('click', () => fn(b)); return b; };
/** ボタンは、押したら返事が来るまで押せなくし、断られたら理由を出して戻す。 */
async function act(b, path, body, warn) { b.disabled = true; const r = await post(path, body); b.disabled = false; if (!r.ok) warn(r.reason || 'できませんでした'); return r.ok; }
const time = t => { const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

function inputBox({ label, max, onSend, cls }) {
  const wrap = el('div', 'inbox ' + (cls || '')), hint = el('button', 'chip', '例文を入れる'), ta = el('textarea'), count = el('span', 'count'), send = el('button', 'send', '送る'), warn = el('div', 'warn'), busy = el('div', 'busy');
  hint.type = send.type = 'button'; ta.rows = 2; ta.maxLength = max; ta.setAttribute('aria-label', label); busy.append(el('span', 'btxt'), el('i', 'dots'));
  const row = el('div', 'inrow'); row.append(ta, send); const foot = el('div', 'infoot'); foot.append(hint, count);
  wrap.append(busy, warn, row, foot);
  const refresh = () => { count.textContent = `あと${max - ta.value.length}文字`; };
  const go = async () => { const text = ta.value.trim(); if (!text || send.disabled) return; warn.textContent = ''; send.disabled = true; const r = await onSend(text); send.disabled = !api.enabled; if (r.ok) { ta.value = ''; refresh(); } else warn.textContent = r.reason || '送れませんでした'; };
  // Enter で送る・Shift+Enter で改行。日本語の変換を決める Enter では送らない
  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); go(); } });
  ta.addEventListener('input', refresh); send.addEventListener('click', go);
  hint.addEventListener('click', () => { if (api.suggest) { ta.value = api.suggest; refresh(); ta.focus(); } });
  const api = { wrap, enabled: true, suggest: '', set({ enabled, placeholder, suggest, busyText }) {
    api.enabled = enabled; api.suggest = suggest || ''; ta.disabled = send.disabled = !enabled; ta.placeholder = placeholder || ''; hint.hidden = !enabled || !suggest;
    busy.hidden = !busyText; busy.firstChild.textContent = busyText || ''; wrap.classList.toggle('off', !enabled);
  } };
  refresh(); return api;
}

export function createPanels(dom, org) {
  const byId = {}; let state = null, toastN = 0;
  // ---------------------------------------------------------------- 左下
  const left = dom.left, lhead = el('header'), chat = el('div', 'list chat');
  const reset = btn('最初から', 'ghost', async b => { if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'もう一度押すと消えます'; setTimeout(() => { b.dataset.sure = ''; b.textContent = '最初から'; }, 3000); return; } b.dataset.sure = ''; b.textContent = '最初から'; await post('reset'); });
  lhead.append(el('b', '', org.bossPanel), reset);
  const bossIn = inputBox({ label: org.bossPanel, max: 2000, onSend: text => post('send', { text }) });
  left.append(lhead, chat, bossIn.wrap);

  function makeChat(c) {
    if (c.type === 'boss') return el('div', 'msg boss', c.text);
    if (c.type === 'pm' || c.type === 'question') { const n = el('div', 'msg pm' + (c.type === 'question' ? ' q' : '')); n.append(iconEl(byId.matome, 'icon mini')); const t = el('div'); if (c.type === 'question') t.append(el('em', '', '質問')); t.append(el('span', '', c.text)); n.append(t); return n; }
    if (c.type === 'stop') { const n = el('div', 'msg stop'); n.append(el('span', '', c.text), btn('もう一度やらせる', 'retry', b => act(b, 'retry', {}, r => { n.lastChild.textContent = r; })), el('div', 'warn')); return n; }
    const by = byId[c.by], n = el('div', 'card'), head = el('div', 'chead'), pre = el('div', 'preview', c.preview), tools = el('div', 'tools'), warn = el('div', 'warn'), rj = el('div', 'rj'), done = el('div', 'decided');
    head.append(iconEl(by, 'icon mini'), el('span', '', `${by.sei}さんから、確認のお願い`)); n.append(head, el('b', 'ctitle', c.title), pre);
    if (c.issues?.length) { const is = el('div', 'issues'); is.append(el('b', '', '機械チェックで残った点')); for (const i of c.issues) is.append(el('div', '', '・' + i)); n.append(is); }
    const ta = el('textarea'); ta.rows = 2; ta.maxLength = 500; ta.placeholder = '直してほしい所'; rj.hidden = true;
    rj.append(ta, btn('この内容で差し戻す', 'ng', b => act(b, 'reject', { id: c.id, text: ta.value }, r => { warn.textContent = r; })));
    tools.append(btn('中身を見る', 'ghost', () => window.open(c.url, '_blank', 'noopener')), btn('OKを出す', 'ok', b => act(b, 'approve', { id: c.id }, r => { warn.textContent = r; })), btn('差し戻す', 'ghost ngline', () => { rj.hidden = !rj.hidden; if (!rj.hidden) ta.focus(); }));
    n.append(tools, rj, warn, done); return n;
  }
  function updateChat(n, c) {
    if (c.type === 'question') n.classList.toggle('open', !c.answered);
    if (c.type === 'stop') { const last = state.chat[state.chat.length - 1] === c && state.phase === 'stopped'; n.querySelector('.retry').hidden = !last; }
    if (c.type !== 'card') return;
    const decided = c.status !== 'pending'; n.dataset.status = c.status;
    n.querySelector('.tools .ok').hidden = n.querySelector('.tools .ngline').hidden = decided; if (decided) n.querySelector('.rj').hidden = true;
    n.querySelector('.decided').textContent = c.status === 'ok' ? 'OK済み' : c.status === 'rejected' ? `差し戻し済み：${c.rejectText || ''}` : '';
  }

  // ---------------------------------------------------------------- 右の列
  const right = dom.right, sec = (title, cls, sub) => { const s = el('section', cls), h = el('header'); h.append(el('b', '', title)); if (sub) h.append(el('small', '', sub)); const list = el('div', 'list'); s.append(h, list); right.append(s); return { s, list, h }; };
  const nt = sec('通知', 'notices'), dl = sec('納品フィード', 'deliveries', 'できた物（押すと、別のタブで開きます）'), wd = sec(org.windowTitle, 'window', org.windowSub);
  const winIn = inputBox({ label: org.windowInput, max: 1000, cls: 'guest', onSend: text => post('inquiry', { text }) }); wd.s.append(el('div', 'inlabel', org.windowInput), winIn.wrap);
  const makeNotice = n => { const d = el('div', 'notice n-' + n.kind); d.append(el('time', '', time(n.t)), el('span', '', n.text)); return d; };
  const makeDelivery = d => { const b = el('button', 'delivery'); b.type = 'button'; b.append(iconEl(byId[d.by], 'icon mini'), el('span', '', d.title), el('small', '', `${byId[d.by].sei}さん`)); b.addEventListener('click', () => window.open(d.url, '_blank', 'noopener')); return b; };
  const makeWin = i => { const n = el('div', 'wmsg ' + i.side + (i.withheld ? ' withheld' : '')); if (i.side === 'org') n.append(el('small', '', `${byId[i.by].sei}さん（${byId[i.by].role}）が作成`)); n.append(el('span', '', i.text)); return n; };

  // ---------------------------------------------------------------- 上の見出し
  const top = dom.top, logo = el('span', 'logo', org.logo), name = el('div', 'oname'), use = el('div', 'usage'), cnt = el('div', 'counts'), badge = el('span', 'badge');
  name.append(el('b', '', org.name), el('small', '', org.unit)); top.append(logo, name, use, cnt);
  dom.note.append(badge, el('span', '', org.note));
  const stat = (box, label) => { const d = el('div', 'stat'), v = el('b', '', '0'); d.append(el('small', '', label), v); box.append(d); return v; };
  const U = { pm: stat(use, 'PM'), staff: stat(use, '担当'), tok: stat(use, 'トークン'), cost: stat(use, '金額の目安'), ms: stat(use, '動いた時間') };
  use.title = '金額は、使った量を API 料金に直した目安です'; use.append(el('small', 'unote', 'API料金に直した目安'));
  const C = { job: stat(cnt, '進行中の案件'), work: stat(cnt, '作業中'), rev: stat(cnt, '確認待ち') };
  const clockText = ms => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}分${String(s % 60).padStart(2, '0')}秒`; };
  setInterval(() => { if (state?.usage.runningSince) U.ms.textContent = clockText(state.usage.ms + Date.now() - state.usage.runningSince); }, 1000);

  function render(s) {
    state = s; for (const m of s.staff) byId[m.id] = m;
    sync(chat, s.chat, makeChat, updateChat); if (render.n !== s.chat.length) { render.n = s.chat.length; chat.scrollTop = chat.scrollHeight; }
    const busyText = s.phase === 'working' ? `${byId.matome.sei}さん（PM）が作業中です` : '';
    bossIn.set({ enabled: s.input.enabled, placeholder: s.input.placeholder, suggest: s.input.suggest, busyText });
    left.classList.toggle('attn', s.phase === 'asking' || s.phase === 'review' || s.phase === 'stopped');
    sync(nt.list, s.notices, makeNotice); sync(dl.list, s.deliveries, makeDelivery);
    dl.list.dataset.empty = s.deliveries.length ? '' : 'OK が出た物が、ここに積まれます'; nt.list.dataset.empty = s.notices.length ? '' : 'まだ、出来事はありません';
    const items = [...s.window.items]; if (items.some(i => i.side === 'guest' && !i.answered)) items.push({ id: 'pending', side: 'org wait', by: 'madoguchi', text: '事務局が、返事を準備しています…' });
    sync(wd.list, items, makeWin); if (render.w !== items.length) { render.w = items.length; wd.list.scrollTop = wd.list.scrollHeight; }
    wd.list.dataset.empty = items.length ? '' : (s.window.enabled ? '委員の立場で、連絡を送ってみてください' : '最初の確認に OK を出すと、窓口が開きます');
    winIn.set({ enabled: s.window.enabled && s.phase !== 'stopped', placeholder: s.window.enabled ? '例：当日はオンライン参加に変更したい' : '', suggest: s.window.suggest });
    wd.s.classList.toggle('closed', !s.window.enabled);
    U.pm.textContent = `${s.usage.pmTurns}回`; U.staff.textContent = `${s.usage.staffRuns}回`; U.tok.textContent = s.usage.tokens.toLocaleString('ja-JP'); U.cost.textContent = `$${s.usage.cost.toFixed(2)}`;
    if (!s.usage.runningSince) U.ms.textContent = clockText(s.usage.ms);
    C.job.textContent = ['working', 'asking', 'review', 'idle', 'stopped'].includes(s.phase) ? 1 : 0; C.work.textContent = s.staff.filter(m => m.status === 'working').length; C.rev.textContent = s.chat.filter(c => c.type === 'card' && c.status === 'pending').length;
    badge.textContent = s.mode === 'demo' ? 'デモ再生' : '本物のAI'; badge.dataset.mode = s.mode;
  }
  /** 上の真ん中のポップ。同時に4つまで縦に並べ、古い物から消す。 */
  function toast(text, kind = '', ms = 3000) { const t = el('div', 'toast ' + kind, text); dom.toasts.append(t); while (dom.toasts.children.length > 4) dom.toasts.firstChild.remove(); setTimeout(() => t.remove(), ms); toastN++; }
  return { render, toast, conn: ok => { dom.conn.hidden = ok; } };
}
