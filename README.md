# simpleMap

[OpenFreeMap](https://openfreemap.org/) + [MapLibre GL JS](https://maplibre.org/) で作る、
シンプルでおしゃれな地図ビューアのプロトタイプ。

ビルド不要の静的ファイルだけで動きます。

## 機能

- ベクタータイルによる滑らかな地図表示
- スタイル切り替え（Positron / Bright / Liberty / Dark / Fiord）
- カラーテーマ（Paper / Mono / Mint）— Positron をベースに水域・緑地・建物・背景をまとめて上品な配色に
- ラベルの表示/非表示（地名 / 道路名 / 水域名 / 施設）— スタイルを切り替えても設定を保持
- 地名の言語切り替え（既定の2行表記 ⇔ 英語表記のみ）
- 線をなめらかに（アンチエイリアス＋角を丸める）
- 道路の配色（大通り＝黒の実線／細道＝薄い白）でエディトリアル風に
- 東京都内の陸上競技場（128件）をパルス発光でハイライト
- 背景色（下地の色）を任意の色に変更・リセット
- マップの傾き（pitch）と回転（bearing）をスライダーで調整
- 主要都市へのワンタップ移動
- **動画シーン再生**: 写真をピンとして表示 → ゆっくり引いて世界が広がる → ロゴ表示（動画素材向け）
- 現在地表示・ズーム・スケール・出典表示

## ローカルで確認する

ブラウザの制約（`fetch` の同一オリジン等）があるため、`index.html` を直接開くのではなく
簡易サーバー経由で開きます。どれか一つを実行してください。

```bash
# Python（追加インストール不要）
python3 -m http.server 8000

# もしくは Node.js
npx serve .
```

その後ブラウザで http://localhost:8000 を開きます。

## GitHub Pages で公開する

1. このディレクトリを GitHub リポジトリにプッシュします。
   ```bash
   git init
   git add .
   git commit -m "Initial commit: simpleMap prototype"
   git branch -M main
   git remote add origin https://github.com/<ユーザー名>/<リポジトリ名>.git
   git push -u origin main
   ```
2. リポジトリの **Settings → Pages** を開きます。
3. **Build and deployment → Source** を **Deploy from a branch** にします。
4. Branch を **main / (root)** に設定して保存します。
5. 数分後 `https://<ユーザー名>.github.io/<リポジトリ名>/` で公開されます。

> `.nojekyll` ファイルは Jekyll の処理を無効化し、静的ファイルをそのまま配信するために置いています。

## ファイル構成

```
simpleMap/
├── index.html      # ページ本体とコントロールパネル
├── css/style.css   # 見た目
├── js/app.js       # 地図の初期化と操作
├── .nojekyll       # GitHub Pages 用
└── README.md
```

## カスタマイズのヒント

- 初期表示位置・ズーム: `js/app.js` の `center` / `zoom`
- スタイル: `js/app.js` の `STYLES`（公式紹介は positron / bright / liberty。ほかに dark / fiord も配信中）
- 移動先ボタン: `index.html` の `#place-jumper` 内の `.chip`（`data-lng` / `data-lat` / `data-zoom`）
- 移動アニメーション: `js/app.js` の `FLY_OPTIONS`（速さ・カーブ・傾き・回転・イージング）

## 動画シーン（素材づくり）

パネルの「動画シーン → ▶ 再生」で、次の流れのアニメーションを再生します。画面収録すると動画素材になります。

1. 撮影地に寄って写真をピンとしてドロップ
2. ゆっくり引いていき（ズームアウト）、その場所が世界のどこかを見せる
3. 引き終わりに写真が消え、ロゴがフェードイン

再生中はパネルや地図コントロールが自動で隠れてクリーンな画面になります。**Esc キー**でいつでもリセットできます。

### 差し替え方法

- **写真**: `assets/photo.svg` を自分の写真（`assets/photo.jpg` など）に置き換え、`js/app.js` の `SCENE.photo` をそのパスに変更
- **ロゴ**: `assets/logo.svg` を差し替え
- **撮影地・寄り・引き・各タイミング**: `js/app.js` の `SCENE`（`location` / `closeZoom` / `wideZoom` / `holdAfterPin` / `zoomOutDuration` など）

### きれいに収録するコツ

- ブラウザを全画面にしてから再生し、画面収録（macOS は `⌘⇧5`）で撮る
- 出典表示も隠れるため、公開動画では別途クレジット（地図データ © OpenStreetMap contributors / OpenFreeMap）を入れる

## 陸上競技場のハイライト

パネルの「ハイライト → 陸上競技場を光らせる」で、東京都内の陸上トラックがパルス発光します。

- データ: `assets/stadiums.geojson`（128件）
- 出典: OpenStreetMap の `leisure=track`（陸上系=athletics/running）を、東京都の行政境界でクリップしたもの。競馬・競輪・馬術・野球などは除外
- 発光の色や大きさ: `css/style.css` の `.stadium-glow__dot` / `.stadium-glow__ring`
- データを更新したい場合は Overpass API で `leisure=track` を再取得して GeoJSON に変換

> マーカーは地図スタイルを切り替えても消えません。ズームアウトすると東京の一帯が光って見えるので、動画シーンと組み合わせても映えます。

## ライセンス・出典

地図データ © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors / タイル配信 [OpenFreeMap](https://openfreemap.org/)
