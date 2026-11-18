// 公開用の入口：先に「録画の再生」を用意し終えてから、いつもの画面を動かす（順番が大事）。
await import('./replay.js');
await import('./app.js');
