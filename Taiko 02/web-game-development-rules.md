# Webゲーム開発・共通プロンプト（AI用・ジャンル横断）

**目的**: HTML/Canvasベースのゲームを、ジャンルを問わず一貫した設計・見た目・拡張性で実装させるための共通ルール。  
**前提**: Vanilla JS + Canvas2D + DOM（必要に応じてWebGL系へ切替）／ES Modules。

## 0) ゴールと品質基準

- **60fps維持**（平均16.6ms/フレーム、p95 < 22ms）
- **入力→反応遅延は0ms**（ロジック的に即時）。視覚・音の演出は短尺で調整
- **画面は16:9の論理座標 1280x720**。黒帯許容。DPR対応でぼやけ禁止
- **1画面に表示する情報は目的/操作/フィードバックの3系統まで**

## 1) デザイン・見た目（トークン方式）

- **CSS変数（:root）で色/余白/角丸/影/フォントを一括管理**。見た目変更はトークン値のみ
- **色は「背景/文字/アクセント」の最大3色**（濃淡はOK）。角丸・影は各1種類のみ
- **余白は8pxグリッド**。フォントは見出し/本文/等幅の最大3種
- **テキストや数値表示は可能な限りDOMで、ゲーム画はCanvasで描く**

### 必須トークン雛形

```css
:root{
  --c-bg:#0e0e12; --c-fg:#e7e7ee; --c-accent:#6be675;
  --space-1:4px; --space-2:8px; --space-3:16px; --space-4:24px;
  --radius:12px; --elev:0 10px 30px rgba(0,0,0,.25);
  --font-ui:ui-sans-serif,system-ui; --font-num:"Roboto Mono",monospace;
}
```

## 2) レイアウト/スケーリング

- **論理座標を1280x720に固定**。実ピクセルはdevicePixelRatioとウィンドウ比で算出
- **ピクセルアートは整数拡大＋image-rendering: pixelated;、imageSmoothingEnabled=false**
- **HUDは四隅の「安全エリア」へ配置**。DOMはCanvasに重ねる

### Canvas調整の必須API

```javascript
function fitCanvas(canvas, baseW=1280, baseH=720){
  const dpr = Math.min(window.devicePixelRatio||1, 2);
  const scale = Math.min(innerWidth/baseW, innerHeight/baseH);
  canvas.style.width  = baseW*scale+'px';
  canvas.style.height = baseH*scale+'px';
  canvas.width  = Math.round(baseW*scale*dpr);
  canvas.height = Math.round(baseH*scale*dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr*scale,0,0,dpr*scale,0,0); // 論理座標を基準サイズに固定
  return ctx;
}
```

## 3) 時間管理・ゲームループ

- **描画はrequestAnimationFrame**。dtは秒単位、0.016〜0.033にclamp
- **物理/判定がシビアなジャンル（音ゲー/格闘など）は固定タイムステップを採用**
- **ループは1箇所に集約（main.js）**。各システムはupdate(dt)/render(ctx)を実装

### 固定タイムステップ雛形

```javascript
let acc=0, last=performance.now();
function loop(now){
  acc += Math.min(0.1, (now-last)/1000); last=now;
  while(acc >= 1/120){ update(1/120); acc -= 1/120; } // 120Hzでロジック更新
  render(); requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
```

## 4) 入力抽象化

- **Inputモジュールでデバイス非依存にする**（キーボード/タッチ/ゲームパッド）
- **ゲーム側はアクション名で参照**（例：Input.isDown('Jump')）
- **リピート/同時押し/長押しはInput側で正規化**

## 5) オーディオ

- **AudioContextベース**。**context.currentTime**を唯一の正とする（Date.nowと混在禁止）
- **SEは短尺・低レイテンシ**。再生は先読みし、同時多発はボイス数を制限
- **音ゲー等での同期は「譜面時間t → currentTimeへの相対」で処理**（ドリフト補正必須）

## 6) レンダリング規約

- **レイヤ順**：背景 → 中景 → キャラ/敵 → 弾 → UIガイド → エフェクト
- **エフェクトの合成はglobalCompositeOperationで加算/乗算の2種まで**
- **テキストはCanvas直描きよりDOM重ねを優先**（可変・AA品質のため）

## 7) モジュール構成（JSは分割、ESM）

- **単一巨大ファイルは禁止**。ドメインごとにES Modulesで分割
- **依存関係はDAG（循環依存禁止）**。main.jsが唯一のオーケストレーター

### 標準ディレクトリ

```
/src
  /core          # 低レベル：Input, Audio, Time, Assets, Math
  /systems       # ゲームロジック：Spawner, Combat, Rhythm, Physics 等
  /scenes        # タイトル, ゲーム, リザルトの状態遷移
  /ui            # DOM UI（HUD, メニュー）
  main.js        # ループ/DI/シーン管理の起点
/assets          # 画像, 音, データ（JSON譜面等）
index.html
styles.css
```

### インターフェース規約

- **すべてのSystemはinit(ctx), update(dt), render(ctx), dispose()を任意実装**
- **シーンはenter(params)/leave()/update(dt)/render(ctx)/handleEvent(e)**

## 8) ライブラリ方針

- **原則ゼロ依存**（標準Web APIで賄える場合は使わない）
- **採用する場合は単機能・軽量・撤去容易を条件にする**。型やAPIが明示的であること

### 推奨カテゴリ（必要時のみ）

- **2D描画を強化**：PixiJS（大量スプライト/パーティクルが必要な時）
- **オーディオ補助**：Howler.js（簡易・クロスブラウザ重視時）
- **物理**：Matter.js（衝突/拘束が多い時。軽量優先なら自前AABB）
- **小規模状態管理**：nanostores 等（UI側の状態同期が複雑な場合）

### 採用チェックリスト

- 体験の中核に効くか？
- 置き換え可能か？
- バンドルサイズは許容内か？
- 更新止まりでも動くか？

## 9) データ/アセット

- **画像はスプライトシート化**（Atlas JSON）。音は事前デコード
- **セーブデータはlocalStorage**（キーはプレフィックス付き）
- **i18nは外部JSONへ分離**。UIテキストは直接埋め込まない

## 10) パフォーマンス予算

- **1フレームのupdate+render合計を< 12ms目標**
- **Canvasはパス生成回数/状態変更を削減**（save/restore乱用禁止）
- **同時アクタ数は上限を設ける**
- **requestAnimationFrame外のsetTimeout/Intervalは禁止**

## 11) テレメトリ/ログ

- **ログのカテゴリ名を統一**（例：[Input]）
- **重要イベントをリングバッファに記録、?debug=1で表示**

## 12) アクセシビリティ

- **prefers-reduced-motion対応**
- **文字コントラスト（WCAG AA）準拠**
- **キーコンフィグAPIをInput層で提供**

## 13) セーフティ/制限

- **見た目変更はトークンのみ**
- **DPR対応の削除禁止**
- **巨大JS単一ファイル禁止**
- **外部ライブラリは抽象インターフェース越しに利用**

## 14) 最小スターター（骨組み）

### index.html

```html
<div id="wrap">
  <canvas id="game" width="1280" height="720"></canvas>
  <div id="hud" class="safe">
    <button class="btn primary">Start</button>
  </div>
</div>
<script type="module" src="/src/main.js"></script>
```

### styles.css

```css
@charset "UTF-8";
:root{
  --c-bg:#0e0e12; --c-fg:#e7e7ee; --c-accent:#6be675;
  --space-1:4px; --space-2:8px; --space-3:16px; --space-4:24px;
  --radius:12px; --elev:0 10px 30px rgba(0,0,0,.25);
  --font-ui:ui-sans-serif,system-ui; --font-num:"Roboto Mono",monospace;
}
html,body,#wrap{height:100%;margin:0;background:var(--c-bg);color:var(--c-fg);font-family:var(--font-ui);}
#wrap{display:grid;place-items:center;}
#game{background:#14141a;border-radius:var(--radius);box-shadow:var(--elev);}
.safe{position:absolute;inset:0;padding:var(--space-3);pointer-events:none;}
.btn{pointer-events:auto; height:44px; padding:0 16px; border:0; border-radius:var(--radius);}
.btn.primary{background:var(--c-accent); color:#08140b; font-weight:700;}
```

### /src/main.js

```javascript
import {createInput} from './core/input.js';
import {createAudio} from './core/audio.js';
const cvs = document.getElementById('game');
const ctx = fitCanvas(cvs); // fitCanvasは下に定義

const Input = createInput(window, cvs);
const Audio = createAudio();

let acc=0, last=performance.now();
function loop(now){
  acc += Math.min(0.1, (now-last)/1000); last=now;
  while(acc >= 1/120){ update(1/120); acc -= 1/120; }
  render(ctx); requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function update(dt){
  Input.update(dt);
}
function render(ctx){
  ctx.clearRect(0,0,1280,720);
}

function fitCanvas(canvas, baseW=1280, baseH=720){
  const dpr = Math.min(devicePixelRatio||1,2);
  const scale = Math.min(innerWidth/baseW, innerHeight/baseH);
  canvas.style.width = baseW*scale+'px'; canvas.style.height = baseH*scale+'px';
  canvas.width = Math.round(baseW*scale*dpr); canvas.height = Math.round(baseH*scale*dpr);
  const ctx = canvas.getContext('2d'); ctx.setTransform(dpr*scale,0,0,dpr*scale,0,0);
  addEventListener('resize',()=>fitCanvas(canvas, baseW, baseH),{passive:true});
  return ctx;
}
```

### /src/core/input.js

```javascript
export function createInput(win, canvas){
  const map = new Map();
  const state = new Map();
  win.addEventListener('keydown', e=>{ state.set(map.get(e.code), true); });
  win.addEventListener('keyup',   e=>{ state.set(map.get(e.code), false); });
  return {
    isDown(name){ return !!state.get(name); },
    update(){ }
  };
}
```

### /src/core/audio.js

```javascript
export function createAudio(){
  const ctx = new (window.AudioContext||window.webkitAudioContext)();
  return {
    ctx,
    now(){ return ctx.currentTime; },
    play(buffer, when=0){ const s=ctx.createBufferSource(); s.buffer=buffer; s.connect(ctx.destination); s.start(ctx.currentTime+when); }
  };
}
```

## 15) チェックリスト

- [ ] CSSトークン以外で見た目を変更していない
- [ ] Canvasの論理座標は1280x720で固定
- [ ] 入力はInput経由
- [ ] ループはmain.jsで一元管理
- [ ] 循環依存なし
- [ ] 外部ライブラリ利用は抽象化
- [ ] 1フレーム時間が予算内
