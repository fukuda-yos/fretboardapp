// Fretboard Pitch Map — Service Worker
// キャッシュ戦略（HANDOFF.md「PWA化 仕様」）:
//  - index.html(ナビゲーション): ネットワーク優先 + 失敗時キャッシュ
//    → push した新版が「次回起動時」に反映され、オフラインでは前回版で動く
//  - その他の自前ファイル(アイコン等): キャッシュファースト
//  - Google Fonts: ネットワーク優先 + 取得成功時キャッシュ + 失敗許容
//    （フォントが無くても全機能が動く）
// 自前ファイルを変更したら CACHE_NAME のバージョンを上げること
// （activate 時に旧キャッシュは自動削除される）
const CACHE_NAME = 'fpm-v1';
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // ナビゲーション(= index.html): ネットワーク優先。成功したらキャッシュを更新
  if (req.mode === 'navigate' || (url.origin === location.origin && url.pathname.endsWith('/index.html'))) {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put('./index.html', copy));
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Google Fonts: ネットワーク優先 + キャッシュ保存。オフラインならキャッシュ、無ければ失敗許容
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then((r) => r || Response.error()))
    );
    return;
  }

  // その他の自前ファイル: キャッシュファースト
  if (url.origin === location.origin) {
    e.respondWith(caches.match(req).then((r) => r || fetch(req)));
  }
});
