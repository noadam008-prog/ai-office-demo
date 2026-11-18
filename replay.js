// 公開用（サーバーなし）：録っておいたデモの流れを、画面の操作に合わせて再生する。
// 画面のプログラム（app.js など）は、サーバーにつないでいるつもりのまま動く。
const SPEED = 1.5; // 再生の速さ（録った時の何倍か）
const data = await fetch('./data.json').then(r => r.json());
const clone = o => JSON.parse(JSON.stringify(o));
const listeners = { state: [], fx: [] }, over = {}, seenNotice = {}, timers = [];
let state = clone(data.initial), line = 'A', idx = 0, playing = false, runStart = 0, quote = null;
const excerpt = t => t.replace(/\s+/g, ' ').slice(0, 38) + (t.length > 38 ? '…' : ''); // 返事が引用する、相手の言葉の頭

const emit = (type, payload) => { for (const f of listeners[type]) f({ data: JSON.stringify(payload) }); };
function view() {
  const s = clone(state); delete s._docs;
  for (const c of s.chat) if (over[c.id]) c.text = over[c.id];
  for (const w of s.window.items) { if (over[w.id]) w.text = over[w.id]; else if (quote && w.side.startsWith('org')) w.text = w.text.replace(quote.rec, quote.user); }
  for (const n of s.notices) n.t = seenNotice[n.id] ||= Date.now();
  if (s.usage.runningSince) s.usage.runningSince = runStart;
  s.mode = 'demo'; s.org = { ...s.org, note: '録画の再生です（サーバーなしの公開版）。団体・委員・データはすべて架空です。' };
  return s;
}
class Source {
  constructor() { setTimeout(() => emit('state', view()), 0); }
  addEventListener(type, fn) { listeners[type]?.push(fn); }
  set onerror(_) { /* 切れない */ }
  close() {}
}
globalThis.EventSource = Source;

const seg = () => (line === 'B' && idx >= data.branch ? data.B[idx - data.branch] : data.A[idx]);
const pending = () => state.chat.findLast(c => c.type === 'card' && c.status === 'pending');
const refuse = reason => ({ ok: false, reason });
function play(s, text, kind) {
  playing = true; runStart = Date.now();
  const known = new Set([...state.chat.map(c => c.id), ...state.window.items.map(w => w.id)]);
  let last = 0;
  for (const e of s.events) {
    last = Math.max(last, e.t);
    timers.push(setTimeout(() => {
      if (e.k === 'fx') return emit('fx', e.d);
      Object.assign(state, clone(e.d));
      if (text) { // 録った文の代わりに、打った文を出す
        const fresh = kind === 'inquiry' ? state.window.items.find(w => w.side === 'guest' && !known.has(w.id)) : state.chat.find(c => c.type === 'boss' && !known.has(c.id));
        if (fresh) { over[fresh.id] = text; known.add(fresh.id); text = ''; }
      }
      emit('state', view());
    }, e.t / SPEED));
  }
  timers.push(setTimeout(() => { playing = false; idx++; }, last / SPEED + 30));
  return { ok: true };
}
function handle(act, body) {
  if (act === 'reset') { timers.splice(0).forEach(clearTimeout); state = clone(data.initial); line = 'A'; idx = 0; playing = false; quote = null; emit('state', view()); return { ok: true }; }
  if (playing) return refuse('作業中です。終わるまで待ってください');
  if (act === 'reject') return refuse('この公開版では、差し戻しは再生できません（パソコン版で試せます）');
  if (act === 'retry') return refuse('止まっていません');
  if (idx === data.branch && act === 'approve') line = 'B'; // 連絡窓口を使わずに進む道
  const s = seg(), text = String(body.text || '').trim();
  if (!s) return refuse('デモはここまでです。「最初から」を2回押すと、やり直せます');
  if (act === 'inquiry') {
    if (!state.window.enabled) return refuse('最初の確認に OK を出すと、窓口が開きます');
    if (s.act !== 'inquiry') return refuse('この公開版では、連絡窓口は「出欠の集計」のカードが出ている間に1回だけ試せます');
    if (!text) return refuse('文が空です');
    quote = { rec: excerpt(data.initial.window.suggest), user: excerpt(text) };
    return play(s, text, 'inquiry');
  }
  if (act === 'approve') {
    if (pending()?.id !== body.id) return refuse('このカードは、もう決まっています');
    return s.act === 'approve' ? play(s) : refuse('先に、連絡窓口の返事を待ってください');
  }
  if (act === 'send') {
    if (!text) return refuse('文が空です');
    if (s.act !== 'send') return refuse(s.act === 'approve' ? '確認のカードで、OK を選んでください' : '次は、右下の連絡窓口か、確認のカードです');
    return play(s, text, 'send');
  }
  return refuse('無い操作です');
}
const realFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = (url, opt = {}) => {
  const u = String(url); if (!u.startsWith('/api/')) return realFetch(url, opt);
  const r = u === '/api/state' ? view() : handle(u.slice(5), opt.body ? JSON.parse(opt.body) : {});
  return Promise.resolve({ ok: r.ok !== false, json: async () => r });
};

// 「中身を見る」：別のタブを開かずに、この画面の上に重ねて出す（文字として入れる）
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
function inline(parent, text) {
  for (const part of String(text).split(/(【確認：[^】]*】)/)) { if (!part) continue; parent.append(part.startsWith('【確認：') ? el('mark', '', part) : document.createTextNode(part)); }
  return parent;
}
function render(md) {
  const doc = el('div', 'doc'); let list = null, table = null, para = null;
  const flush = () => { list = table = para = null; };
  for (const l of md.split(/\r?\n/)) {
    let m;
    if ((m = l.match(/^(#{1,3})\s+(.*)$/))) { flush(); doc.append(inline(el('h' + m[1].length), m[2])); }
    else if (/^\s*\|.*\|\s*$/.test(l)) { const cells = l.trim().slice(1, -1).split('|').map(c => c.trim()); if (cells.every(c => /^-+$/.test(c))) continue; const first = !table; if (first) { const w = el('div', 'tablewrap'); table = el('table'); w.append(table); doc.append(w); list = para = null; } const tr = el('tr'); for (const c of cells) tr.append(inline(el(first ? 'th' : 'td'), c)); table.append(tr); }
    else if ((m = l.match(/^\s*(?:[-*]|\d+\.)\s+(.*)$/))) { if (!list) { list = el(/^\s*\d/.test(l) ? 'ol' : 'ul'); doc.append(list); table = para = null; } list.append(inline(el('li'), m[1])); }
    else if (/^---+\s*$/.test(l)) { flush(); doc.append(el('hr')); }
    else if (!l.trim()) flush();
    else { if (!para) { para = el('p'); doc.append(para); list = table = null; } else para.append(el('br')); inline(para, l.replace(/^>\s?/, '')); }
  }
  return doc;
}
globalThis.open = url => {
  const kind = String(url).match(/^\/view\/(\w+)/)?.[1], text = kind && state._docs?.[kind]; if (!text) return null;
  const card = state.chat.findLast(c => c.type === 'card' && c.kind === kind), back = el('div', 'viewer'), box = el('div', 'vbox'), head = el('header'), close = el('button', 'ghost', '閉じる');
  close.type = 'button'; close.addEventListener('click', () => back.remove()); back.addEventListener('click', e => { if (e.target === back) back.remove(); });
  head.append(el('b', '', card?.title || ''), el('span', 'vtag ' + (card?.status || ''), card?.status === 'ok' ? 'OK済み' : '確認待ち'), close);
  box.append(head, render(text), el('footer', '', 'AI が作った下書きです。送る前に、人が内容を確かめます。')); back.append(box); document.body.append(back);
  return null;
};
