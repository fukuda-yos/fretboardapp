# Fretboard Pitch Map — 引き継ぎドキュメント v2.1

最終更新: 2026-07-18
本体バージョン: **fretboard.html v1.1**

> **2026-07-18 方針更新**
> - UIレイアウトの案選択は**リセットして未決定に戻した**（案2の選択は誤操作。実装は未着手のまま、本体は v1.1 でクリーン）
> - 新方針: 開発環境を **Claude Code** へ移行し、iOS/Android は **PWA** で対応する
> - Claude Code 用のプロジェクト規約として **CLAUDE.md** を追加（本書と併読すること）

v1 からの主な差分:
1. コード全体レビューを実施し、**実バグ2件を含む8件を修正**（→「v1.1 変更履歴」）
2. v1 ドキュメントの記載誤りを訂正（→「主要データ構造」の pcCells 注意書き）
3. UIレイアウト改善（案4）の**詳細実装仕様**を追加 — 後続モデルはこの仕様に従えば実装可能
4. アルペジオ/メトロノームの **BPMシンク実装仕様**を追加
5. **回帰テストチェックリスト**を追加 — 変更のたびにこれを回すこと

---

## プロジェクト概要

ギター・ベースの音名確認、コード理論学習、作曲支援、練習支援を目的とした
**シングルHTMLファイル**のWebアプリ。ビルドツール不要。ブラウザで直接開いて使う。

### 成果物
- `fretboard.html` — 本体（v1.1、約1,390行）
- `ui-mockup.html` — UIレイアウト改善案の比較モック（4案、参考用・変更不要）
- `HANDOFF.md` — このファイル

---

## 開発者について

- ギター中級者、ロカビリー・日本語ロック・80年代洋楽が好み
- 音楽制作にハードウェアシンセを使用（Roland MC-707, SP-404mk2, Korg Drumlogue など）
- HTML/JSのシングルファイル開発スタイルを好む
- 理論は詳しくないが、耳が良い（リズムの違和感をBPM換算で正確に指摘できるレベル）
  → **音のタイミングに関わる実装は絶対に妥協しないこと**（後述の「発音時刻の原則」）
- 段階的実装を好む。一度に全部作らず、フェーズごとに動作確認を依頼すること

---

## v1.1 変更履歴（2026-07-13 の修正 8件）

すべてロジック層のみ。**UIレイアウトには一切手を付けていない**（案の選択待ちのため）。
各項目に理由と戻し方を記載。ユーザーが音の変化を気に入らない場合は個別に戻せる。

### 修正① 【実バグ】拍子セレクタが音に反映されていなかった
- **症状**: 3/4 や 6/8 を選んでもドットの数が変わるだけで、クリック音は4拍グルーピングのまま。
  さらに4拍目で `flashBeat(3)` が存在しないドットを指すため点滅も欠けていた。
- **原因**: `metroScheduler()` が拍数に `def.beatsPerBar`（パターン定義値=常に4）を使い、
  ユーザー選択値 `metroBeatsPerBar` は `renderMetroBeats()`（表示）にしか使われていなかった。
- **修正**: クリックモード（`pattern===null`）のときだけ `metroBeatsPerBar` に従うよう分岐。
  ドラムパターンは4/4前提で作られているため、パターン再生時は従来どおり定義値を使う。
- **場所**: `metroScheduler()` 冒頭の `beatsPerBar` / `totalSteps` / `beatIdx` の算出。

### 修正② 【実バグ予防】拍子3/4のままドラムパターンを選べてしまう穴を塞いだ
- 既存実装は「拍子を4/4以外へ変更 → リズムをclickへ戻す」の片方向だけだった。
  逆順（3/4にしてからロカビリー等を選ぶ）だと修正①以前と同じ表示/音の不整合が再発する。
- **修正**: リズムボタンのハンドラで、パターン選択時に拍子セレクタを4/4へ戻す（対称化）。

### 修正③ アルペジオのタイミング精度（setTimeout発音 → オーディオクロック発音）
- **症状**: `playSequence()` が各音を `setTimeout` 内の `playNote(freq)`（=呼び出し時刻で発音）
  で鳴らしていたため、メインスレッドのジッタがそのまま音のヨレになる。高BPMほど顕著。
  メトロノーム側は正しくAudioContext時刻でスケジュールしていたのに、試聴側だけ甘かった。
- **修正**: 起点 `t0 = ctx.currentTime + 0.08` から等間隔の**絶対時刻グリッド**を作り、
  `playNote(freq, 0.75, target)` で発音時刻を確定。`setTimeout` は各音の約60ms前に
  発火する「トリガー」に格下げ（これによりキャンセル機構 `cancelArp()` はそのまま生きる）。
- **効果**: BPM300でもサンプル精度で等間隔。ユーザーの耳の基準に耐える。

### 修正④ コード試聴にボイスリーディングを実装（未解決課題#1「終止感がない」への対応）
- **旧実装**: `getChordMidis()` が毎回ルートポジション（C3付近から密集積み）で組むため、
  コードを続けて押すと音域が飛び、V→I の解決感が出なかった。
- **新実装**:
  - ベース = ルート固定、F#2(42)〜F3(53) のウィンドウに収める
  - 上声部 = **直前のボイシングに最も近いオクターブ**を選ぶ（共通音は保持される）
  - 直前の和音がない場合（起動直後・クリア直後）は従来どおりルートから密集で積む
  - `lastVoicing` はクリア時（`selectChord(null)`）にリセット
- **検証済み**（Node単体テスト）: Am7→Dm7→G7→Cmaj7 で
  `A2C3E3G3 → D3F3A3C4 → G2F3B3D4 → C3E3G3B3`。C4→B3、F3→E3 など教科書どおりの解決。
  昇順・重複なし・音域(40–84)内を全ケースで確認済み。
- **戻し方**: ユーザーが「ルートポジションの方が学習用途に分かりやすい」と感じた場合は
  `getChordMidis` を以下の旧実装に戻すだけでよい（他への影響なし）:
  ```javascript
  function getChordMidis(parsed){
    const rootBase=parsed.rootPc;
    let baseMidi=rootBase+48;
    if(baseMidi<40)baseMidi+=12;
    const midis=[baseMidi];
    parsed.intervals.slice(1).forEach(iv=>{
      let m=baseMidi+(iv%12);
      while(m<=midis[midis.length-1])m+=12;
      midis.push(m);
    });
    return midis;
  }
  ```
  ※戻す場合は `lastVoicing` 参照2箇所（selectChord内のリセット）も削除。

### 修正⑤ コード入力の小文字許容
- `am7` `bb7` など小文字始まりを先頭1文字だけ大文字化して受理（`parseChord` 冒頭に1行）。

### 修正⑥ 死んだ関数 `addFooterRow()` を削除
- どこからも呼ばれておらず、しかもスコープ外の `FRET_COUNT` を参照していたため、
  後続モデルが「便利そう」と呼び出した瞬間に ReferenceError になる罠だった。
  下段フレット番号行は `buildFretboard()` 内にインライン実装済みなので純粋な削除。

### 修正⑦ 再描画時の古いDOM参照の破棄
- `buildFretboard()` で `clearTimeout(ringTimer); lastRingCell=null;` を追加。
  クリック後700ms以内に楽器切替すると、破棄済みセルへの参照が残っていた（実害は軽微だが衛生面）。

### 修正⑧ 細かい音質・正確性
- `drumHat(now, open, vel)` にベロシティ引数を追加し、pops16 に定義済みだった
  拍頭アクセントフラグ `ha` を有効化（accent時 gain×1.5）。16ビートの拍感が出る。
- ランダムアルペジオを `sort(()=>Math.random()-.5)`（偏る）→ Fisher–Yates に変更。

---

## 実装済みの機能（v1.1時点）

### 1. フレットボード表示
- 標準チューニング、フレット0〜24。音高を色で表現（低音ダークブルー→高音白金）
- 各セルに音名+オクターブ / MIDI番号。フレット番号・開放弦ラベルを上下両端に表示
- ナットは開放弦とフレット1の間の縦線（`nut-gap-cell`）。ドットマーカー、弦の上下反転スイッチ

### 2. 楽器モード
```javascript
const INSTRUMENTS = {
  guitar: { openMidi:[40,45,50,55,59,64], nameMap:['E','A','D','G','B','e'], fretCount:24, midiMin:40, midiMax:88, timbre:'guitar' },
  bass:   { openMidi:[28,33,38,43],       nameMap:['E','A','D','G'],          fretCount:20, midiMin:28, midiMax:76, timbre:'bass' },
}
```
セレクター切替 → 再描画 + 音色自動切替。

### 3. 音色 `TIMBRES = { guitar, bass, piano, synth }`
- 各プリセット: osc1/osc2、フィルター、エンベロープ等。`playNote(freq, velocity, startTime)` が共通入口。
- **`startTime` を渡すと必ずその AudioContext 時刻で発音される**（v1.1でアルペジオもこれを利用）。

### 4. クリックで発音 + 同音ハイライト（同MIDI=金強リング / 同音名別オクターブ=金薄リング）

### 5. コードハイライト（構成音=青枠、ルート=紫枠、非構成音=dimmed、右下にインターバル名）

### 6. キー & ダイアトニックコードパネル
- 12キー × Major/Minor。三和音・四和音を2段同時表示。
- セカンダリドミナント / 借用和音 / Sus / Add9。**ボタンクリックで即発音**（v1.1からボイスリーディング付き）。

### 7. コード試聴パネル
- 同時（≋）+ アルペジオ6種（↑↓⇅⁂⊃⊂⊂⊃）。BPMスライダー 40〜300。
- v1.1でタイミングをオーディオクロック化。メトロノームとのBPMシンクは未実装（仕様は本書後半）。

### 8. スケール表示（12種、緑枠。コードハイライトと同時表示可）

### 9. メトロノーム & リズム
- Web Audioスケジューラ方式（lookAhead 150ms / setInterval 25ms）。
- **発音は必ず AudioContext 未来時刻へ直接スケジュール。setTimeout は視覚のみ**（絶対原則）。
- ノイズバッファはキャッシュ済み（`_snareBufCache` 等）。
- パターン: click / rock8 / pops16 / house4on4 / rockabilly / shuffle(12step三連) / bossa。
  ステップ書式 `{k,s,h,hatOpen?,ha?}`（ha=ハットアクセント、v1.1で有効化）。
- ロカビリーはBPM170がちょうどいい（ユーザー確認済み）。
- 拍子は 4/4, 3/4, 2/4, 6/8。**clickモードのみ拍子に追従**。パターンは4/4固定
  （4/4以外へ変更→clickへ自動リセット、パターン選択→4/4へ自動リセット。双方向・v1.1）。

---

## 主要データ構造

```javascript
const cellMidi = new Map();                       // DOM要素 → MIDIノート番号
const pcCells  = Array.from({length:12},()=>[]);  // ピッチクラス(0-11) → セル配列
let currentHighlight = null;   // コードparse結果
let currentScaleKey  = null;   // スケールのルートPC
let currentScaleType = null;   // スケール種類キー
let lastVoicing      = null;   // 直前の試聴ボイシング（v1.1、MIDI昇順配列）
```

> ⚠️ **v1ドキュメントの訂正**: v1 には `pcCells = Array(12).fill([])` と書かれていたが、
> 実コードは上記のとおり `Array.from({length:12},()=>[])`。
> `Array(12).fill([])` は**全要素が同一の配列を共有する典型バグ**なので、
> リファクタ時に v1 の記載を写経しないこと。

### CSS クラスの意味
| クラス | 意味 |
|--------|------|
| `.chord-tone` / `.chord-root` | コード構成音（青枠）/ ルート（紫枠） |
| `.dimmed` | コード非構成音（暗く） |
| `.scale-tone` / `.scale-root` | スケール構成音（緑枠）/ ルート（明緑枠） |
| `.same-pitch` / `.same-pc` | クリック音と同MIDI（金強）/ 同音名別オクターブ（金薄） |
| `.ringing` | クリック直後のアニメーション |

---

## 既知の制限（バグではなく現状仕様）

1. **異名同音**: `noteName(pc)` はキー文脈なしの固定マップ（`FLAT_KEYS`、pc6=Gb扱い）。
   キーボタンは「F#」なのにパネル表示が「Gb」になる等の不一致がある。
   正しい表記にはキー文脈が必要で、対応するなら `noteName(pc, keyPc)` 化が必要（優先度低）。
2. **スラッシュコード**: `C/G` はベース指定 `/G` を無視して `C` として解釈（parseChordで除去）。
3. **アルペジオの内部モード名**: `'down'`=低→高（ボタン表記は↑）。名前が直感と逆だが既存のまま。
4. **クリック以外のリズムは4/4固定**（上記の双方向リセットで担保）。

---

## 未解決の課題

1. ~~コード試聴の終止感がない~~ → **v1.1 修正④で対応済み。ユーザーの耳での確認待ち。**
   NGなら変更履歴の旧コードで即戻せる。
2. **アルペジオBPMとメトロノームBPMの非シンク** → 未実装。仕様は本書「BPMシンク実装仕様」。
   UIレイアウト改善と同時にやるのが自然（スライダーを1本化するため）。

---

## 今後の開発ロードマップ（優先順位順）

| # | 機能 | 状態 / 備考 |
|---|------|------|
| 5a | Claude Code への開発移行 | **最優先**。CLAUDE.md 整備済み。初回セッションで git 化〜GitHub Pages 公開まで行う |
| 5b | PWA化（iOS/Android対応） | 移行直後に着手。仕様は「PWA化 仕様」参照 |
| 6 | UIレイアウト改善 | 案は**再検討中**（案2選択は取り消し済み）。モバイル前提なら案4が有利。スマホ実機で現行UIを触ってから決定を推奨 |
| 7 | カポ位置シミュレーター | 既存ロジック流用で軽い（openMidiに+capoするだけが基本） |
| 8 | BPMシンク | 仕様確定済み（下記）。UI改善に同梱推奨 |
| 9 | トランスポーズ機能 | キー全体を半音単位でシフト |
| 10 | コード進行ビルダー + アウフタクト対応 | ボイスリーディング基盤(修正④)は先行実装済み |
| 11 | カポ込みコードフォーム逆引き | |
| 12 | オープンチューニング対応 | INSTRUMENTS定義の拡張で対応可 |
| 13 | 鍵盤モード | 保留（優先度低） |

---

## 実機フィードバック（2026-07-19、スマホ・縦横両方で使用）

UI案決定の前提となる実機評価。ユーザーへのヒアリングで以下の2点に絞られた:

1. **盤面が遠い・同時に見えない（最重要）**: パネル群が上、フレットボードが最下部のため、
   コード/スケールを選んでもハイライト結果が画面外。毎回スクロール往復が必要。
   → 案4（ツールバー+ドロワー、盤面常時表示）が直接解決する。
2. **フレットボードのタップ精度が悪い**: セル幅 minmax(36px,1fr) で隣接セルが密着
   （grid に column-gap なし）。隣のセルを押してしまう。
   → UI案とは独立の盤面側修正（セル幅・gap の拡大、モバイルでは MIDI 番号非表示で
   音名を大きく等）。案実装と同時期に対応するのが自然。

**該当しなかった項目**（コード上は怪しいが実機では不満なし）: ボタン/文字の小ささ、
BPMスライダーの操作性、アルペジオ記号の意味不明さ（ツールチップ非表示）。

## UI改善 実装仕様（案4: ツールバー + ドロワー）

> 2026-07-18: 案の選択は**未決定に戻った**。モバイル対応（PWA）方針が加わったため、
> スマホ実機で現行UIを試してから再決定するのを推奨
> （ui-mockup.html の注記どおり案4がモバイル向き、案2は最小工数）。
> **後続モデルへ: ユーザーの決定なしにUI実装へ着手しないこと。**

ユーザーが案4を選んだ場合、後続モデルは以下に**そのまま**従うこと。
案1〜3を選んだ場合の要点は末尾に付記。

### 大原則（全案共通・違反厳禁）

1. **既存の id / 関数名 / CSSクラス名を一切変更しない。**
   JSは末尾で一度だけ実行され、`getElementById` で約30箇所の要素にリスナーを張る。
   idが変わると無言で壊れる。
2. **パネルのHTMLブロックは「一字一句変えずに移動」する。**
   `<div class="panel">…</div>` を丸ごと切り取り、ドロワーの器の中へ貼るだけ。
   中身を書き直したり再生成したりしない（scriptはbody末尾なので、移動先でも
   ロード時にリスナーは正常に張られる）。
3. **ドロワーの開閉は表示/非表示のみ。**要素の生成/破棄をしない。
   → ドロワーを閉じてもメトロノームは鳴り続ける（これが正しい挙動）。
4. 1フェーズ終わるごとに回帰テスト（後述）を回し、ユーザーに動作確認を依頼する。

### Phase 0: 準備（見た目の変化ゼロ）
- 無名の2パネルにidを付与:
  - キー&ダイアトニックのパネル → `id="keyPanel"`
  - コード直接入力のパネル → `id="inputPanel"`
- `node --check` → 表示確認。ここまでで1コミット相当。

### Phase 1: ツールバー骨格とパネル移設
- `<header>`〜`.legend` の直後に以下を追加（クラス名は新規なので自由だが例に従うのを推奨）:
  ```html
  <div class="toolbar" id="toolbar">
    <button class="toolbar-btn" data-drawer="drawerInst">🎸 楽器・音色</button>
    <button class="toolbar-btn" data-drawer="drawerChord">♩ コード</button>
    <button class="toolbar-btn" data-drawer="drawerScale">〜 スケール</button>
    <button class="toolbar-btn" data-drawer="drawerListen">▶ 試聴</button>
    <button class="toolbar-btn" data-drawer="drawerRhythm">🥁 リズム</button>
  </div>
  <div class="drawer-area" id="drawerArea">
    <div class="drawer" id="drawerInst"   hidden></div>
    <div class="drawer" id="drawerChord"  hidden></div>
    <div class="drawer" id="drawerScale"  hidden></div>
    <div class="drawer" id="drawerListen" hidden></div>
    <div class="drawer" id="drawerRhythm" hidden></div>
  </div>
  ```
- 既存パネルを各ドロワー内へ**静的に移動**（HTML編集で切り貼り）:
  - drawerInst ← `.controls-bar` の中の楽器/音色/反転（`.controls-bar` ごと移動でよい。
    ただし `#playingBar` はPhase 2でトップバーへ移すので、その時に分離）
  - drawerChord ← `#keyPanel` と `#inputPanel`（縦に2つ並べてよい）
  - drawerScale ← `#scalePanel`
  - drawerListen ← `#listenPanel`
  - drawerRhythm ← `#metronomePanel`
- `.board-wrapper`（フレットボード）はドロワー直下に置き、常時表示・最大面積。
- 開閉ロジック（script末尾のINITの直前に追加、~25行）:
  ```javascript
  // ---- Drawer toggle (案4) ----
  let openDrawer=null;
  document.querySelectorAll('.toolbar-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const id=btn.dataset.drawer, d=document.getElementById(id);
      const willOpen=(openDrawer!==d);
      document.querySelectorAll('.drawer').forEach(x=>x.hidden=true);
      document.querySelectorAll('.toolbar-btn').forEach(b=>b.classList.remove('active'));
      openDrawer=null;
      if(willOpen){d.hidden=false;btn.classList.add('active');openDrawer=d;}
    });
  });
  ```
- CSS方針: `.toolbar-btn` は既存 `.rbtn` の見た目を踏襲。`.drawer` は既存 `.panel` の
  背景/枠を流用し `max-width:1200px` に広げる。デフォルト全閉。
- **受け入れ基準**: 全ドロワー閉でもフレットボードのクリック発音が動く /
  ドロワーを開いて従来操作がすべて動く / リズム再生中にドロワーを閉じても音が続く。

### Phase 2: トップバー（ステータス表示）
- ヘッダーをコンパクト化し、右側にステータスチップを置く:
  - `#playingBar` を `.controls-bar` からトップバーへ移動（id維持）
  - 選択中コード表示: 新規spanを置き、`selectChord()` の末尾で textContent 更新
    （`#listenChordName` と同じ値。既存関数への追記は最小限の1行に留める）
  - メトロノーム動作中インジケータ: `startMetronome()/stopMetronome()` にクラス付替え1行ずつ
- 受け入れ基準: コード選択・セルクリック・メトロ開始停止がトップバーに反映される。

### Phase 3: モバイル対応
- `@media (max-width:720px)`:
  - `.toolbar` を横スクロール可（`overflow-x:auto; flex-wrap:nowrap;`）
  - `.drawer` を画面下固定のボトムシート化
    （`position:fixed; left:0; right:0; bottom:0; max-height:60vh; overflow-y:auto;`）
  - フレットボードは従来どおり横スクロール
- 受け入れ基準: iPhone幅(390px)エミュレーションで全機能に到達できる。

### Phase 4: 磨き（任意）
- 開閉トランジション、Escキーで閉じる、ドロワー外クリックで閉じる、
  ツールバーボタンに選択中コード名の小チップ（モック参照）。

### 他の案を選んだ場合の要点
- **案1 タブ式**: ドロワーの代わりにタブコンテンツdivを常設し1つだけ表示。移設原則は同じ。
  フレットボードはタブの外（常時表示）に置くこと。
- **案2 アコーディオン**: 各`.panel`の`.panel-title`をbutton化して開閉。移動不要で最も低リスク。
  ただし「ごちゃごちゃ感」の解消効果は最小。
- **案3 サイドバー**: 960px未満で破綻しやすい。採用時はモバイルでは案4のドロワーに
  フォールバックする2段構えにすること。

---

## PWA化 仕様（ロードマップ#5b）

**ゴール**: GitHub Pages で公開し、スマホの「ホーム画面に追加」からオフラインでも全機能が動くこと。

- 構成: `index.html`（= fretboard.html。ファイル単体で開いても動く状態は維持）+ `manifest.webmanifest` + `sw.js` + `icons/`（192px / 512px）
- **ルール改訂**: 「シングルHTMLファイル」の原則は「**本体1ファイル + PWA付帯ファイルのみ許可（ビルドツールは引き続き不可）**」に緩和する
- manifest: `display:"standalone"`、`theme_color` / `background_color` は CSS変数 `--bg`(#0a0e1a) に合わせる。`orientation` は固定しない（フレットボードは横向きが見やすいが、パネル操作は縦でも使うため端末の回転に任せる）
- sw.js: キャッシュファースト。プリキャッシュは自前ファイルのみ。Google Fonts はネットワーク優先+失敗許容（フォントが無くても全機能が動くこと）。キャッシュ名にバージョン文字列を入れ、activate 時に旧キャッシュを削除
- iOS の注意点:
  1. 発音はユーザー操作起点（実装済み）だが、バックグラウンド復帰後に AudioContext が suspended になることがある → `getCtx()` の resume で概ね吸収できる想定。**実機確認必須**
  2. 端末側面のサイレント（消音）スイッチで Web Audio が消音される OS バージョンがある → 直せない仕様としてユーザーに案内
  3. `apple-touch-icon` の link タグを追加
- 受け入れ基準: ①機内モードで起動して回帰テスト全項目が通る ②ホーム画面からフルスクリーン起動できる ③Android Chrome でインストール可能 ④更新を push したら次回起動時に新版へ切り替わる

## BPMシンク実装仕様（ロードマップ#8）

- **方針**: BPMは全体でひとつ（練習ツールとしてはグローバルテンポが自然）。
- UI改善後、`#arpSpeed` と `#metroSpeed` の2本を **`#globalBpm` 1本**（range 40–300）に統合し、
  トップバーかツールバー右端に常時表示する。
- コード変更は2点だけ:
  1. `bpmToMs()` の参照先を `#globalBpm` へ
  2. `metroScheduler()` 内の `metroSpeedInput` 参照を `#globalBpm` へ
     （スケジューラは毎tick BPMを読み直す設計なので、再生中の変更も即反映される）
- リズムパターン選択時の `defaultBpm` 適用先も `#globalBpm` へ。
- 旧スライダー2本のHTMLは削除。`metroSpeedVal`/`arpSpeedVal` は統合表示1つに。
- 注意: メトロノームのBPM上限が240→300に広がる。問題なし（クリック音は短いので破綻しない）。

---

## 回帰テストチェックリスト（変更のたびに実施）

| # | 操作 | 期待 |
|---|------|------|
| 1 | 起動 | 6弦24F表示、ナット縦線、上下にフレット番号、コンソールにエラーなし |
| 2 | セルをクリック | 発音+白リング。同MIDIに金強、同音名別オクターブに金薄。playingBar更新 |
| 3 | 楽器→ベース | 4弦20F、音色がベースに、表示崩れなし |
| 4 | 「低弦を上に」ON/OFF | 反転する。コード/スケールのハイライトが維持される |
| 5 | キーC Major選択 | 三和音+四和音の2段、下に借用等のグループ表示 |
| 6 | I→IV→V7→I と順にクリック | 各回発音。**音の高さが滑らかに繋がり、最後に着地感がある**(v1.1) |
| 7 | 入力欄に `am7` | 小文字でも受理されAm7として表示(v1.1)。`C/G` はCとして通る。`Xyz` はエラー表示 |
| 8 | クリア | ハイライト解除、試聴ボタンがdisabledに戻る |
| 9 | スケール: A + マイナーペンタ | 緑枠表示。コードハイライトと同時表示できる |
| 10 | 試聴 ≋ と各アルペジオ | 全パターン鳴る。BPM 40と300で**間隔が正確に等間隔**(v1.1) |
| 11 | メトロノーム 4/4 click | 1拍目だけ高音アクセント、ドット4つが同期 |
| 12 | 拍子を3/4に | **3つ打ち**になりドット3つと一致(v1.1の実バグ修正点) |
| 13 | 拍子を6/8に | 6つ打ち、ドット6つ |
| 14 | 3/4のままロカビリー選択 | 拍子が自動で4/4へ戻ってから再生(v1.1) |
| 15 | 各リズムパターン再生 | 破綻なし。pops16は拍頭のハットが強め(v1.1)。ロカビリーBPM170 |
| 16 | パターン再生中に拍子を3/4へ | リズムがclickへ自動リセット（既存挙動の維持確認） |

---

## 後続モデルへの開発ルール（厳守）

1. **シングルHTMLファイル厳守**。外部ライブラリ・ビルドツール不可
   （Google Fontsの`@import`のみ例外。オフラインでも機能自体は動くこと）。
2. **発音時刻の原則**: 音は必ず `AudioContext` の未来時刻へスケジュールする
   （`playNote(freq, vel, startTime)` / `drumKick(now)` 等）。
   `setTimeout` / `requestAnimationFrame` は視覚とトリガーにのみ使う。
   このユーザーはリズムのヨレを必ず聴き分ける。
3. **既存の id・関数名・グローバル変数名を変えない**。リスナーはロード時に一度だけ張られる。
   UI再構成は「要素の移動」であって「再生成」ではない。
4. `str_replace` 編集後は必ず構文確認:
   ```bash
   sed -n '/<script>/,/<\/script>/p' fretboard.html | sed '1d;$d' > /tmp/check.js && node --check /tmp/check.js
   ```
5. リズムパターンを追加・変更するときは **BPMと音価（何分音符か）をセットで確認**。
   shuffleのように steps=12（三連系）もあり得る。4/4以外なら拍子まわりのロジックを必ず確認。
6. 実装前に優先順位をユーザーに確認する。**一度に作り込まず、フェーズごとに動作確認を依頼**。
7. 機能追加・修正をしたら、この HANDOFF.md の変更履歴・ロードマップ・テスト表を更新すること。
8. ユーザーの音の好みに関わる変更（ボイシング、ドラム音量バランス等）は
   「戻し方」を必ず変更履歴に残すこと。

---

## ファイル構成

```
index.html       ← メイン v1.1（これだけあれば動く。旧 fretboard.html、2026-07-19 リネーム）
ui-mockup.html   ← UIレイアウト案比較モック（参考用・触らない）
HANDOFF.md       ← このファイル（v2.1）
CLAUDE.md        ← Claude Code 用プロジェクト規約（セッション開始時に自動で読み込まれる）
README.md        ← GitHub 用の概要（個人開発・無断転載/改変/再配布はご遠慮くださいの注記あり）
```

## 変更履歴（git 化以降）

### 2026-07-19 git 化・GitHub Pages 公開（ロードマップ 5a）
- リポジトリ: https://github.com/fukuda-yos/fretboardapp （public / master ブランチ）
- 公開URL: **https://fukuda-yos.github.io/fretboardapp/** （Pages: master ルート、legacy build）
- git リポジトリ化し初回コミット（本体コードは v1.1 のまま無変更）
- `fretboard.html` → `index.html` にリネーム（GitHub Pages 直下表示のため。PWA仕様と整合）
- README.md 追加、CLAUDE.md に「やり取りは常に日本語」ルールを追記
- **コードには一切手を付けていないため、回帰テストは目視スモーク（起動+クリック発音）のみでよい**
