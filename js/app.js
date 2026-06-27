// 公式ドキュメントでは positron / bright / liberty の3つが紹介されているが、
// dark / fiord も実際に配信されている
const STYLES = {
  positron: 'https://tiles.openfreemap.org/styles/positron',
  bright: 'https://tiles.openfreemap.org/styles/bright',
  liberty: 'https://tiles.openfreemap.org/styles/liberty',
  dark: 'https://tiles.openfreemap.org/styles/dark',
  fiord: 'https://tiles.openfreemap.org/styles/fiord',
};

// ラベルの種類は OpenMapTiles の source-layer で判別できる（全スタイル共通）
const SOURCE_LAYER_TO_CATEGORY = {
  place: 'place', // 国・都道府県・市区町村などの地名
  transportation_name: 'road', // 道路名
  poi: 'poi', // 施設
  aerodrome_label: 'poi', // 空港
  water_name: 'water', // 川・湖・海などの水域名
  waterway: 'water', // 河川名
};

// 非表示にしているラベル種別（スタイルを切り替えても保持される）
const hiddenLabels = new Set();

const map = new maplibregl.Map({
  container: 'map',
  style: STYLES.positron, // 既定はミニマルな Positron
  center: [139.7671, 35.6812], // 東京駅あたり
  zoom: 12,
  maxPitch: 85, // 傾きスライダーで深く倒せるように（既定は60）
  antialias: true, // 斜め線などのギザギザを減らしてなめらかに（MSAA）
  attributionControl: false,
});

// ナビゲーション（ズーム・コンパス）と現在地、スケール、出典表示
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
map.addControl(
  new maplibregl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true },
    trackUserLocation: true,
  }),
  'top-right'
);
map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

// --- ラベルの表示/非表示 ---
let applyingLabels = false;
function applyLabelVisibility() {
  if (applyingLabels || !map.isStyleLoaded()) return;
  applyingLabels = true;

  for (const layer of map.getStyle().layers || []) {
    if (layer.type !== 'symbol') continue;
    const category = SOURCE_LAYER_TO_CATEGORY[layer['source-layer']];
    if (!category) continue;

    const want = hiddenLabels.has(category) ? 'none' : 'visible';
    const current = map.getLayoutProperty(layer.id, 'visibility') || 'visible';
    // 変化がある時だけ更新（styledata の無限ループを防ぐ）
    if (current !== want) map.setLayoutProperty(layer.id, 'visibility', want);
  }

  applyingLabels = false;
}

// スタイルを差し替えるとラベルは初期化されるので、毎回ここで再適用する
map.on('styledata', applyLabelVisibility);

const labelToggler = document.getElementById('label-toggler');
labelToggler.addEventListener('click', (e) => {
  const btn = e.target.closest('.chip');
  if (!btn) return;

  const category = btn.dataset.label;
  if (hiddenLabels.has(category)) {
    hiddenLabels.delete(category);
    btn.classList.add('is-active'); // 表示中
  } else {
    hiddenLabels.add(category);
    btn.classList.remove('is-active'); // 非表示
  }
  applyLabelVisibility();
});

// --- 線をなめらかに（角を丸める line-join: round） ---
let smoothLines = true; // 既定でなめらか
let applyingLines = false;
// スタイルごとの既定の line-join を覚えておき、戻せるようにする
const lineJoinDefaults = new Map();

function applyLineSmoothing() {
  if (applyingLines || !map.isStyleLoaded()) return;
  applyingLines = true;

  for (const layer of map.getStyle().layers || []) {
    if (layer.type !== 'line') continue;

    if (!lineJoinDefaults.has(layer.id)) {
      lineJoinDefaults.set(layer.id, map.getLayoutProperty(layer.id, 'line-join'));
    }

    const want = smoothLines ? 'round' : lineJoinDefaults.get(layer.id);
    if (map.getLayoutProperty(layer.id, 'line-join') !== want) {
      map.setLayoutProperty(layer.id, 'line-join', want);
    }
  }

  applyingLines = false;
}

map.on('styledata', applyLineSmoothing);

const smoothBtn = document.getElementById('smooth-lines');
smoothBtn.addEventListener('click', () => {
  smoothLines = !smoothLines;
  smoothBtn.classList.toggle('is-active', smoothLines);
  applyLineSmoothing();
});

// --- 道路の配色（大通り=黒の実線 / 細道=薄い白） ---
// OpenMapTiles の class で判別する（全スタイル共通）。大通りは casing/inner を
// どちらも黒にすることで太い実線に、それ以外は白で統一する。
const MAJOR_ROAD_CLASSES = ['motorway', 'trunk', 'primary', 'secondary'];
const ROAD_MAJOR_COLOR = '#4a4a4a'; // 黒すぎないダークグレー
const ROAD_MINOR_COLOR = '#ffffff';
const roadColorExpr = ['match', ['get', 'class'], MAJOR_ROAD_CLASSES, ROAD_MAJOR_COLOR, ROAD_MINOR_COLOR];

let fancyRoads = true; // 既定でおしゃれ配色ON
let applyingRoads = false;
const roadColorDefaults = new Map();

function applyRoadColors() {
  if (applyingRoads || !map.isStyleLoaded()) return;
  applyingRoads = true;

  for (const layer of map.getStyle().layers || []) {
    if (layer.type !== 'line' || layer['source-layer'] !== 'transportation') continue;
    // 鉄道・桟橋は道路ではないので対象外
    if (layer.id.includes('rail') || layer.id.includes('pier')) continue;

    if (!roadColorDefaults.has(layer.id)) {
      roadColorDefaults.set(layer.id, map.getPaintProperty(layer.id, 'line-color'));
    }

    const want = fancyRoads ? roadColorExpr : roadColorDefaults.get(layer.id);
    const current = map.getPaintProperty(layer.id, 'line-color');
    if (JSON.stringify(current) !== JSON.stringify(want)) {
      map.setPaintProperty(layer.id, 'line-color', want);
    }
  }

  applyingRoads = false;
}

map.on('styledata', applyRoadColors);

const fancyRoadsBtn = document.getElementById('fancy-roads');
fancyRoadsBtn.addEventListener('click', () => {
  fancyRoads = !fancyRoads;
  fancyRoadsBtn.classList.toggle('is-active', fancyRoads);
  applyRoadColors();
});

// --- 背景色 ---
// null のときはスタイル本来の色を使う。色を指定すると全スタイルで上書きする。
let customBackground = null;
let applyingBackground = false;
// スタイルごとの既定の背景色を覚えておき、リセット時に戻す
const defaultBackgrounds = new Map();

function applyBackground() {
  if (applyingBackground || !map.isStyleLoaded()) return;
  applyingBackground = true;

  for (const layer of map.getStyle().layers || []) {
    if (layer.type !== 'background') continue;

    // このスタイルでの既定色を初回だけ記録
    if (!defaultBackgrounds.has(layer.id)) {
      defaultBackgrounds.set(layer.id, map.getPaintProperty(layer.id, 'background-color'));
    }

    const want = customBackground || defaultBackgrounds.get(layer.id);
    const current = map.getPaintProperty(layer.id, 'background-color');
    if (JSON.stringify(current) !== JSON.stringify(want)) {
      map.setPaintProperty(layer.id, 'background-color', want);
    }
  }

  applyingBackground = false;
}

map.on('styledata', applyBackground);

const bgColor = document.getElementById('bg-color');
const bgReset = document.getElementById('bg-reset');

bgColor.addEventListener('input', () => {
  customBackground = bgColor.value;
  applyBackground();
});

bgReset.addEventListener('click', () => {
  customBackground = null;
  applyBackground();
});

// --- 傾き（pitch）スライダー ---
const pitchSlider = document.getElementById('pitch-slider');
const pitchVal = document.getElementById('pitch-val');

pitchSlider.addEventListener('input', () => {
  map.setPitch(Number(pitchSlider.value));
});

// flyTo・シーン再生・コンパス操作など、地図側で傾きが変わったら表示を同期
map.on('pitch', () => {
  const p = Math.round(map.getPitch());
  pitchSlider.value = p;
  pitchVal.textContent = `${p}°`;
});

// --- 回転（bearing）スライダー ---
const bearingSlider = document.getElementById('bearing-slider');
const bearingVal = document.getElementById('bearing-val');

bearingSlider.addEventListener('input', () => {
  map.setBearing(Number(bearingSlider.value));
});

// 地図側で向きが変わったら表示を同期（bearing は -180〜180 に正規化）
map.on('rotate', () => {
  let b = Math.round(map.getBearing());
  if (b > 180) b -= 360;
  if (b < -180) b += 360;
  bearingSlider.value = b;
  bearingVal.textContent = `${b}°`;
});

// --- 地名の言語（既定の2行表記 ⇔ 英語のみ） ---
// 既定は「ローマ字 + 日本語」の2行。英語名(name_en)→ローマ字(name:latin)→現地名の順で英語優先に。
const ENGLISH_TEXT_FIELD = ['coalesce', ['get', 'name_en'], ['get', 'name:latin'], ['get', 'name']];
let placeEnglishOnly = false;
let applyingPlaceLang = false;
// スタイルごとの既定の text-field を覚えておき、戻せるようにする
const placeTextDefaults = new Map();

function applyPlaceLanguage() {
  if (applyingPlaceLang || !map.isStyleLoaded()) return;
  applyingPlaceLang = true;

  for (const layer of map.getStyle().layers || []) {
    if (layer.type !== 'symbol' || layer['source-layer'] !== 'place') continue;

    if (!placeTextDefaults.has(layer.id)) {
      placeTextDefaults.set(layer.id, map.getLayoutProperty(layer.id, 'text-field'));
    }

    const want = placeEnglishOnly ? ENGLISH_TEXT_FIELD : placeTextDefaults.get(layer.id);
    const current = map.getLayoutProperty(layer.id, 'text-field');
    if (JSON.stringify(current) !== JSON.stringify(want)) {
      map.setLayoutProperty(layer.id, 'text-field', want);
    }
  }

  applyingPlaceLang = false;
}

map.on('styledata', applyPlaceLanguage);

const langEnBtn = document.getElementById('lang-en');
langEnBtn.addEventListener('click', () => {
  placeEnglishOnly = !placeEnglishOnly;
  langEnBtn.classList.toggle('is-active', placeEnglishOnly);
  applyPlaceLanguage();
});

// --- 地名フォントの調整（斜体→Bold、少し小さく） ---
// OpenFreeMap のグリフは Regular / Bold / Italic のみ（Medium は無い）。
// そのため「普通＆少し太め」は Bold に統一する。サイズは既定値を一律に縮小。
const PLACE_FONT = ['Noto Sans Bold'];
const PLACE_SIZE_SCALE = 0.8; // 文字サイズの倍率（小さく）
let applyingFont = false;
const placeSizeDefaults = new Map();

// text-size の式（interpolate）のサイズ値だけを倍率で縮小する
function scaleTextSize(expr, factor) {
  if (typeof expr === 'number') return Math.round(expr * factor * 10) / 10;
  if (Array.isArray(expr) && expr[0] === 'interpolate') {
    const out = expr.slice();
    for (let i = 4; i < out.length; i += 2) {
      if (typeof out[i] === 'number') out[i] = Math.round(out[i] * factor * 10) / 10;
    }
    return out;
  }
  return expr; // 想定外の形式はそのまま
}

function applyPlaceFont() {
  if (applyingFont || !map.isStyleLoaded()) return;
  applyingFont = true;

  for (const layer of map.getStyle().layers || []) {
    if (layer.type !== 'symbol' || layer['source-layer'] !== 'place') continue;

    // フォント: 斜体・標準・太字が混在 → Bold に統一（非斜体＆少し太め）
    if (JSON.stringify(map.getLayoutProperty(layer.id, 'text-font')) !== JSON.stringify(PLACE_FONT)) {
      map.setLayoutProperty(layer.id, 'text-font', PLACE_FONT);
    }

    // サイズ: 既定値を覚えてから縮小（二重縮小しないように）
    if (!placeSizeDefaults.has(layer.id)) {
      placeSizeDefaults.set(layer.id, map.getLayoutProperty(layer.id, 'text-size'));
    }
    const want = scaleTextSize(placeSizeDefaults.get(layer.id), PLACE_SIZE_SCALE);
    if (JSON.stringify(map.getLayoutProperty(layer.id, 'text-size')) !== JSON.stringify(want)) {
      map.setLayoutProperty(layer.id, 'text-size', want);
    }
  }

  applyingFont = false;
}

map.on('styledata', applyPlaceFont);

// --- カラーテーマ（Positron をベースに配色だけ上品に上書き） ---
const THEMES = {
  paper: { bg: '#f4f0e6', water: '#c9d6d8', green: '#dbe3cc', building: '#eae4d6' }, // 温かみのある紙
  mono: { bg: '#ececec', water: '#d8d8d8', green: '#e2e2e2', building: '#e6e6e6' }, // モノトーン
  mint: { bg: '#eef3f1', water: '#bbd7d4', green: '#d3e4d7', building: '#e6ece9' }, // 涼しげなミント
};
let currentTheme = null;
let applyingTheme = false;
const themeColorDefaults = new Map();

function themeRole(layer) {
  const sl = layer['source-layer'];
  if (sl === 'water' || sl === 'waterway') return 'water';
  if (sl === 'building') return 'building';
  if (sl === 'park') return 'green';
  if (sl === 'landcover' && /wood|grass|forest|park/.test(layer.id)) return 'green';
  return null;
}

function colorProp(layer) {
  if (layer.type === 'line') return 'line-color';
  if (layer.type === 'fill-extrusion') return 'fill-extrusion-color';
  return 'fill-color';
}

function applyThemeColors() {
  if (applyingTheme || !map.isStyleLoaded()) return;
  applyingTheme = true;

  for (const layer of map.getStyle().layers || []) {
    const role = themeRole(layer);
    if (!role) continue;

    const prop = colorProp(layer);
    const key = `${layer.id}|${prop}`;
    if (!themeColorDefaults.has(key)) {
      themeColorDefaults.set(key, map.getPaintProperty(layer.id, prop));
    }

    const want = currentTheme ? THEMES[currentTheme][role] : themeColorDefaults.get(key);
    const current = map.getPaintProperty(layer.id, prop);
    if (JSON.stringify(current) !== JSON.stringify(want)) {
      map.setPaintProperty(layer.id, prop, want);
    }
  }

  applyingTheme = false;
}

map.on('styledata', applyThemeColors);

const themeSwitcher = document.getElementById('theme-switcher');
function selectTheme(key) {
  currentTheme = key === 'none' ? null : key;
  // 背景色は既存の「背景色」コントロールに反映させる
  customBackground = currentTheme ? THEMES[currentTheme].bg : null;
  if (currentTheme) bgColor.value = THEMES[currentTheme].bg;
  themeSwitcher.querySelectorAll('.chip').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.theme === key);
  });
  applyBackground();
  applyThemeColors();
}
themeSwitcher.addEventListener('click', (e) => {
  const btn = e.target.closest('.chip');
  if (btn) selectTheme(btn.dataset.theme);
});

// 初期テーマ（おしゃれな Paper を既定に）
selectTheme('paper');

// --- スタイル切り替え ---
const styleSwitcher = document.getElementById('style-switcher');
styleSwitcher.addEventListener('click', (e) => {
  const btn = e.target.closest('.chip');
  if (!btn) return;

  const styleKey = btn.dataset.style;
  if (!STYLES[styleKey]) return;

  // スタイルごとに既定値が違うので、記録をクリアして次の styledata で取り直す
  defaultBackgrounds.clear();
  placeTextDefaults.clear();
  lineJoinDefaults.clear();
  roadColorDefaults.clear();
  themeColorDefaults.clear();
  placeSizeDefaults.clear();

  // 視点を保ったままスタイルだけ差し替える
  map.setStyle(STYLES[styleKey]);

  styleSwitcher.querySelectorAll('.chip').forEach((b) => b.classList.remove('is-active'));
  btn.classList.add('is-active');
});

// --- 場所へ移動するときのアニメーション設定 ---
// ここを書き換えると移動の見た目を自由に調整できる。
const FLY_OPTIONS = {
  speed: 1.2, // 移動の速さ。大きいほど速い
  curve: 1.6, // 飛行カーブの高さ。大きいほど一度大きく引いてから寄る（おしゃれ度↑）
  pitch: 50, // 到着時の傾き（0=真上、最大約85）。斜めから見下ろすと立体的
  bearing: -18, // 到着時の回転（北からの角度）。少し傾けると動きが出る
  maxDuration: 4500, // 最長の所要時間(ms)。遠距離でも長くなりすぎないように
  // イージング（0→1）。緩急のカーブ。これは easeInOutCubic（ゆっくり→速く→ゆっくり）
  easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
};

const placeJumper = document.getElementById('place-jumper');
placeJumper.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;

  map.flyTo({
    center: [Number(chip.dataset.lng), Number(chip.dataset.lat)],
    zoom: Number(chip.dataset.zoom) || 12,
    ...FLY_OPTIONS,
    essential: true, // 「視差効果を減らす」設定の端末でもアニメーションする
  });
});

// --- 動画用シーン再生 ---
// 写真をピンとして表示 → ゆっくり引いていく → 最後にロゴ、という流れ。
// 数値や素材を書き換えれば、自分の動画に合わせて自由に調整できる。
const SCENE = {
  location: [139.7454, 35.6586], // 東京タワー（撮影地に合わせて変更）
  photo: 'assets/photo.svg', // 自分の写真(jpg/png)に差し替える
  closeZoom: 16, // 写真を出すときの寄り
  wideZoom: 4.3, // 最後に引いたときのズーム
  pitchStart: 55, // 寄ったときの傾き（立体感）
  bearingStart: -20, // 寄ったときの向き
  holdAfterPin: 1600, // 写真を見せておく時間(ms)
  zoomOutDuration: 6500, // 引いていく時間(ms)
  pinLeaveBefore: 1200, // 引き終わりの何ms前に写真を消し始めるか
  logoDelay: 300, // 引き終わってからロゴを出すまで(ms)
};

const logoOverlay = document.getElementById('logo-overlay');
let sceneMarker = null;
let sceneTimers = [];

function resetScene() {
  sceneTimers.forEach(clearTimeout);
  sceneTimers = [];
  if (sceneMarker) {
    sceneMarker.remove();
    sceneMarker = null;
  }
  logoOverlay.classList.remove('is-visible');
  document.body.classList.remove('is-playing');
}

function playScene() {
  resetScene();
  document.body.classList.add('is-playing'); // パネル等を隠してクリーンな画面に

  const center = SCENE.location;

  // 1) その場所へ寄る（傾けて立体的に）
  map.jumpTo({
    center,
    zoom: SCENE.closeZoom,
    pitch: SCENE.pitchStart,
    bearing: SCENE.bearingStart,
  });

  // 2) 写真をピンとしてドロップ
  const el = document.createElement('div');
  el.className = 'photo-pin';
  el.innerHTML = `<img src="${SCENE.photo}" alt="" />`;
  sceneMarker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
    .setLngLat(center)
    .addTo(map);

  // 3) 少し見せてから、ゆっくり引いていく（ズームアウト）
  sceneTimers.push(
    setTimeout(() => {
      map.flyTo({
        center,
        zoom: SCENE.wideZoom,
        pitch: 0,
        bearing: 0,
        duration: SCENE.zoomOutDuration,
        essential: true,
        easing: (t) => 1 - Math.pow(1 - t, 3), // easeOutCubic（最後ふわっと止まる）
      });
    }, SCENE.holdAfterPin)
  );

  // 4) 引き終わりの少し前に写真をフェードアウト
  sceneTimers.push(
    setTimeout(() => {
      el.classList.add('is-leaving');
    }, SCENE.holdAfterPin + SCENE.zoomOutDuration - SCENE.pinLeaveBefore)
  );

  // 5) 引き終わったらロゴを表示
  sceneTimers.push(
    setTimeout(() => {
      logoOverlay.classList.add('is-visible');
    }, SCENE.holdAfterPin + SCENE.zoomOutDuration + SCENE.logoDelay)
  );
}

// --- 東京都内の陸上競技場を光らせる ---
// データは OpenStreetMap（leisure=track の陸上系）を東京都の境界でクリップしたもの。
// マーカーはスタイルを切り替えても消えないので、一度読み込めばそのまま光り続ける。
let stadiumsLoaded = false;
let stadiumsOn = false;
const stadiumBtn = document.getElementById('stadium-toggle');

async function loadStadiums() {
  const res = await fetch('assets/stadiums.geojson');
  const data = await res.json();
  for (const f of data.features) {
    const el = document.createElement('div');
    el.className = 'stadium-glow';
    el.innerHTML = '<span class="stadium-glow__ring"></span><span class="stadium-glow__dot"></span>';
    new maplibregl.Marker({ element: el }).setLngLat(f.geometry.coordinates).addTo(map);
  }
}

stadiumBtn.addEventListener('click', async () => {
  if (!stadiumsLoaded) {
    stadiumBtn.disabled = true;
    try {
      await loadStadiums();
      stadiumsLoaded = true;
    } finally {
      stadiumBtn.disabled = false;
    }
  }
  stadiumsOn = !stadiumsOn;
  document.body.classList.toggle('stadiums-on', stadiumsOn);
  stadiumBtn.classList.toggle('is-active', stadiumsOn);
});

document.getElementById('scene-play').addEventListener('click', playScene);
document.getElementById('scene-reset').addEventListener('click', resetScene);
// 再生中はパネルが隠れるので、Esc キーでいつでもリセットできる
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') resetScene();
});
