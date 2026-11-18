// 名札と、頭の上の文（今やっている事・社内チャットのカード・ひとりごと）。字は textContent で入れる。
import { plateSize, bubbleSize, bubbleText, roleLabel, seatAnchors, toScreen } from './layout.js';

export const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
export function iconEl(s, cls = 'icon') { const i = el('span', cls, s.mark); i.style.setProperty('--c', s.color); return i; }

export class Labels {
  constructor(layer, staff) {
    this.layer = layer; this.items = {};
    staff.forEach((s, index) => {
      const plate = el('div', 'plate'), size = plateSize(s);
      plate.style.width = size.w + 'px';
      const ring = el('span', 'ring'); ring.append(iconEl(s));
      const nameEl = el('b', '', s.name), txt = el('span', 'ptxt'); txt.append(nameEl, el('small', '', roleLabel(s)));
      plate.append(ring, txt);
      const bubble = el('div', 'bubble'); bubble.hidden = true;
      const heart = el('div', 'heart', '♥'); heart.hidden = true;
      layer.append(plate, bubble, heart);
      this.items[s.id] = { s, index, plate, bubble, heart, size, nameEl, queue: [], cur: null, doing: '', status: 'idle', chat: null };
    });
  }
  /** スマホの幅では、名札を「丸いアイコン＋名字」だけにする。 */
  setCompact(on) {
    if (this.compact === on) return; this.compact = on; this.layer.classList.toggle('compact', on);
    for (const it of Object.values(this.items)) { it.size = plateSize(it.s, on); it.plate.style.width = it.size.w + 'px'; it.nameEl.textContent = on ? it.s.sei : it.s.name; }
  }
  setState(staff) {
    for (const s of staff) { const it = this.items[s.id]; if (!it) continue; it.status = s.status; it.doing = s.status === 'working' ? s.doing : ''; it.plate.dataset.status = s.status; }
  }
  /** 社内チャットのカード。同じ席に続けて届いたカードは、重ねずに順番に出す（1枚目は少なくとも2秒）。 */
  card(id, from, text, ms = 4000, cls = '') { this.items[id]?.queue.push({ from, text, ms, cls, min: 2000 }); }
  say(id, text, ms = 4000) { const it = this.items[id]; if (it && !it.cur && !it.doing && !it.queue.length) it.chat = { text, until: performance.now() + ms }; }
  love(id) { const it = this.items[id]; if (!it) return; it.heart.hidden = false; it.heart.classList.remove('up'); void it.heart.offsetWidth; it.heart.classList.add('up'); setTimeout(() => { it.heart.hidden = true; }, 1500); }
  busy(id) { const it = this.items[id]; return !it || !!it.cur || !!it.doing || it.queue.length > 0 || !!it.chat; }

  show(it, key, text, from, cls) {
    if (it.shown === key) return;
    it.shown = key; it.bubble.replaceChildren(); it.bubble.className = 'bubble ' + (cls || '');
    if (!key) { it.bubble.hidden = true; return; }
    const t = bubbleText(text, !!from), size = bubbleSize(t, !!from);
    if (from) it.bubble.append(iconEl(from, 'icon mini'));
    it.bubble.append(el('span', '', t)); it.bubble.style.width = size.w + 'px'; it.bw = size.w; it.bubble.hidden = false;
  }
  tick(now, THREE, camera, seats, W, H) {
    for (const [id, it] of Object.entries(this.items)) {
      const seat = seats[id]; if (!seat) continue;
      if (it.cur && now > it.cur.start + (it.queue.length ? it.cur.min : it.cur.ms)) it.cur = null;
      if (!it.cur && it.queue.length) { it.cur = it.queue.shift(); it.cur.start = now; it.chat = null; }
      if (it.chat && now > it.chat.until) it.chat = null;
      if (it.cur) this.show(it, 'c' + it.cur.start, it.cur.text, it.cur.from, 'memo ' + it.cur.cls);
      else if (it.doing) this.show(it, 'd' + it.doing, it.doing, null, 'doing');
      else if (it.chat) this.show(it, 't' + it.chat.text, it.chat.text, null, 'chat');
      else this.show(it, '', '');
      const a = seatAnchors(seat, it.index), p = toScreen(THREE, camera, a.plate, W, H), h = toScreen(THREE, camera, a.head, W, H);
      it.plate.style.transform = `translate(${Math.round(p.x - it.size.w / 2)}px,${Math.round(p.y - it.size.h / 2)}px)`;
      if (!it.bubble.hidden) it.bubble.style.transform = `translate(${Math.round(h.x - (it.bw || 0) / 2)}px,${Math.round(h.y - 12)}px)`;
      if (!it.heart.hidden) it.heart.style.left = Math.round(h.x + 34) + 'px', it.heart.style.top = Math.round(h.y - 6) + 'px';
    }
  }
}

// ひとりごと（状況ごと。20文字まで）
export const CHATTER = {
  idle: ['次の会議はいつだったかな', 'お茶をいれてこようかな', '名簿、最新になってるかな', '書式をそろえておこう', '会議室の空きを見ておこう', '今日は静かだなあ', '机の上を片づけよう', '手が空いています', 'フォルダを整理しておこう', '出欠フォーム、動いてるかな', '通知番号の台帳、確認よし'],
  working: ['元データと数を合わせて…', '書式どおりに、と', '曜日を入れ忘れないように', '宛名は1文字も変えない', 'あいまいな所は印を付ける', '番号は台帳の続き、と', 'もう一度、読み返そう', '人数を数え直します', '見出しの順番、よし', '約束の言葉は書かない'],
  review: ['確認、お願いします', '直す所があれば言ってください', 'どきどき…', '印の所を見てもらえると', '数字は合っているはず', '返事を待っています', '差し戻しでも大丈夫です', 'お時間のある時に', '見てもらえるかな', '準備はできています'],
  done: ['できました', '次の出番を待ちます', '送るのは人にお任せ', 'ひと区切りです', '台帳に書いておきたいな', 'お疲れさまでした', '確認ありがとうございます', '次は何だろう', '少し休憩', '片づけておきます'],
  pm: ['だれに頼むのがいいかな', '担当者に確かめておこう', '順番を整理して、と', 'みんなの手は空いてるかな', '確認の印、見落とさない', '頼む文は具体的に、と', '言葉はそのまま写す', '次は出欠だな', '止まる所では止まる', '進み具合、よし'],
  evening: ['そろそろ夕方ですね', '今日の分は見えてきた', '明日の準備もしておこう', '夕日がきれいだなあ', 'もうひとがんばり', '今日はよく進んだ', '帰る前に確認しよう', '戸じまりを忘れずに', '明日は会議の日だ', 'おなかがすいたなあ'],
};
export function pickChatter(s, status, hour = new Date().getHours()) {
  const key = hour >= 17 && Math.random() < 0.3 ? 'evening' : s.dept === 'center' && Math.random() < 0.6 ? 'pm' : status === 'working' ? 'working' : status === 'review' ? 'review' : status === 'done' ? 'done' : 'idle';
  const list = CHATTER[key]; return list[Math.floor(Math.random() * list.length)];
}
