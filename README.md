# simpleMap

[OpenFreeMap](https://openfreemap.org/) + [MapLibre GL JS](https://maplibre.org/) で作る、
シンプルでおしゃれな地図ビューアのプロトタイプ。

ビルド不要の静的ファイルだけで動きます。

## 機能

- ベクタータイルによる滑らかな地図表示
- スタイル切り替え（Positron / Bright / Liberty / Dark / Fiord）
- カラーテーマ（Paper / Mono / Mint）— Positron をベースに水域・緑地・建物・背景をまとめて上品な配色に
- 建物の立体表示の切り替え（Liberty）— 3D ⇔ 平面
- ラベルの表示/非表示（地名 / 道路名 / 水域名 / 施設）— スタイルを切り替えても設定を保持
- ラベルの言語切り替え（既定の2行表記 ⇔ 英語表記のみ）— 「地名のみ」と「すべてのラベル（道路名・水域名・施設も）」を選べる
- 線をなめらかに（アンチエイリアス＋角を丸める）
- 道路の配色（細道＝薄い白）でエディトリアル風に
- 背景色（下地の色）を任意の色に変更・リセット
- マップの傾き（pitch）と回転（bearing）をスライダーで調整
- 主要都市へのワンタップ移動
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

## ライセンス・出典

地図データ © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors / タイル配信 [OpenFreeMap](https://openfreemap.org/)
