# Fretboard Pitch Map — プロジェクト規約（Claude Code 用）

ギター/ベースのフレットボード可視化・コード理論学習・練習支援アプリ。
**単一の index.html（HTML/CSS/JS 約1,390行）で完結**。ビルドツールなし。
（旧ファイル名 fretboard.html。GitHub Pages 公開のため 2026-07-19 にリネーム）
経緯・詳細仕様・ロードマップ・回帰テスト表は `HANDOFF.md` を必ず併読すること。

## 絶対ルール

0. **ユーザーとのやり取りは常に日本語で行う。**
1. **発音時刻は必ず AudioContext クロックで確定させる。**
   `playNote(freq, vel, startTime)` / `drumKick(now)` のように未来の絶対時刻を渡す。
   `setTimeout` / `requestAnimationFrame` は視覚更新とトリガーにのみ使用可。
   開発者はリズムのヨレをBPM換算で聴き分ける耳を持つ。ここで妥協すると必ず指摘される。
2. **既存の id・関数名・グローバル変数名・CSSクラス名を変更しない。**
   リスナーは body 末尾のスクリプトで一度だけ張られる。
   UI再構成は「要素の移動」であり「再生成」ではない。
3. **シングルファイル原則**: 本体は index.html 1枚。外部ライブラリ・ビルドツール禁止。
   例外は PWA 付帯ファイル（manifest.webmanifest / sw.js / icons/）のみ。
4. 編集後は毎回構文チェックを実行:
   `sed -n '/<script>/,/<\/script>/p' index.html | sed '1d;$d' > /tmp/check.js && node --check /tmp/check.js`
   PowerShell 環境では（**UTF-8 指定を忘れない**。忘れると日本語文字列が化けて誤検出する）:
   `$h = Get-Content index.html -Raw -Encoding UTF8; [regex]::Match($h,'(?s)<script>\r?\n(.*)\r?\n</script>').Groups[1].Value | Out-File $env:TEMP\check.js -Encoding utf8; node --check $env:TEMP\check.js`
5. **段階的に進める**: 大きな変更はフェーズ分割し、各フェーズ後にユーザーへ動作確認を依頼する。
   実装前に優先順位を確認する。頼まれていない機能を勝手に足さない。
6. 変更のたびに `HANDOFF.md` の「変更履歴」と「回帰テストチェックリスト」を更新し、
   該当範囲の回帰テストを実施する。
7. 音の性格が変わる変更（ボイシング、ドラム音量バランス等）は**戻し方を変更履歴に併記**する。
8. リズムパターンを触るときは BPM と音価（何分音符か）をセットで確認する。
   shuffle は steps=12（三連系）。クリック以外のパターンは 4/4 前提。

## アーキテクチャ最短マップ

- 定義データ: `INSTRUMENTS` / `TIMBRES` / `CHORD_TYPES` / `SCALE_DEFS` / `RHYTHM_PATTERNS`
- セル管理: `cellMidi`（Map: DOM要素→MIDI）と `pcCells`（`Array.from({length:12},()=>[])`）
  ※ `Array(12).fill([])` に書き換えるのは全要素が同一配列を共有する典型バグ。禁止。
- 発音: `playNote()` が全音色の共通入口。メトロノームは lookahead 150ms のスケジューラ方式
- 試聴ボイシング: `getChordMidis()` はボイスリーディング付き（`lastVoicing` を保持、クリアでリセット）
- ハイライト: `applyHighlight()`（コード）と `applyScaleHighlight()`（スケール）は同時表示可

## 現在地（2026-07-18）

- 本体は v1.1（バグ修正8件適用済み。内容は HANDOFF.md「v1.1 変更履歴」）
- UIレイアウト改善は**案が未決定**（ui-mockup.html に4案）。
  **ユーザーの決定なしにUI実装へ着手しないこと。**
- タスク順: ① git 化 → GitHub Pages 公開 → ② PWA化（HANDOFF.md「PWA化 仕様」どおり）
  → ③ UI案の決定 → 実装 → ④ 以降は HANDOFF.md のロードマップに従う

## コミット規約

- 機能単位で小さくコミット。メッセージは日本語で「何を・なぜ」
- 構文チェックと主要動作の確認が済んだ、動く状態でのみコミットする
