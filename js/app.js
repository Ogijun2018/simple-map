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

// --- 道路の配色（細道だけ薄い白に。大通りは元のスタイル色のまま） ---
// OpenMapTiles の class で判別する（全スタイル共通）。大通り(MAJOR_ROAD_CLASSES)は
// 元のスタイルの色を保ち、それ以外の細道だけ白で統一してエディトリアル風に。
const MAJOR_ROAD_CLASSES = ['motorway', 'trunk', 'primary', 'secondary'];
const ROAD_MINOR_COLOR = '#ffffff';

let whiteMinorRoads = true; // 既定で細道=白ON
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
    const def = roadColorDefaults.get(layer.id);

    // 大通りは既定色のまま、それ以外（細道）だけ白に。
    const want = whiteMinorRoads
      ? ['match', ['get', 'class'], MAJOR_ROAD_CLASSES, def ?? '#000000', ROAD_MINOR_COLOR]
      : def;
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
  whiteMinorRoads = !whiteMinorRoads;
  fancyRoadsBtn.classList.toggle('is-active', whiteMinorRoads);
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

// flyTo・コンパス操作など、地図側で傾きが変わったら表示を同期
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

// --- ラベルの言語（既定の2行表記 ⇔ 英語のみ） ---
// 既定は「ローマ字 + 日本語」の2行。英語名(name_en)→ローマ字(name:latin)→現地名の順で英語優先に。
const ENGLISH_TEXT_FIELD = ['coalesce', ['get', 'name_en'], ['get', 'name:latin'], ['get', 'name']];
// 英語表記の対象範囲: 'none'（既定の表記）/ 'place'（地名のみ）/ 'all'（すべてのラベル）
let englishScope = 'none';
let applyingLang = false;
// スタイルごとの既定の text-field を覚えておき、戻せるようにする
const labelTextDefaults = new Map();

// このラベルを英語表記にするか（スコープ別）。名前を持つラベルだけが対象。
function wantsEnglish(layer) {
  const category = SOURCE_LAYER_TO_CATEGORY[layer['source-layer']];
  if (!category) return false;
  if (englishScope === 'all') return true;
  if (englishScope === 'place') return category === 'place';
  return false;
}

// 高速道路などの番号シールド（ref: E1 / C2 等）は名前ではなく短縮表記なので、
// 英語化せず元の表記のまま残す。判定は「既定の text-field が ref を参照するか」。
function isShieldLabel(layer) {
  return JSON.stringify(labelTextDefaults.get(layer.id) ?? null).includes('["get","ref"]');
}

function applyLabelLanguage() {
  if (applyingLang || !map.isStyleLoaded()) return;
  applyingLang = true;

  for (const layer of map.getStyle().layers || []) {
    if (layer.type !== 'symbol') continue;
    // 名前ラベル以外（アイコンのみ等）は触らない
    if (!SOURCE_LAYER_TO_CATEGORY[layer['source-layer']]) continue;

    if (!labelTextDefaults.has(layer.id)) {
      labelTextDefaults.set(layer.id, map.getLayoutProperty(layer.id, 'text-field'));
    }

    const toEnglish = wantsEnglish(layer) && !isShieldLabel(layer);
    const want = toEnglish ? ENGLISH_TEXT_FIELD : labelTextDefaults.get(layer.id);
    const current = map.getLayoutProperty(layer.id, 'text-field');
    if (JSON.stringify(current) !== JSON.stringify(want)) {
      map.setLayoutProperty(layer.id, 'text-field', want);
    }
  }

  applyingLang = false;
}

map.on('styledata', applyLabelLanguage);

// 「地名のみ」「すべて」は排他。アクティブなものを再クリックすると既定表記に戻す。
const langSwitcher = document.getElementById('lang-switcher');
langSwitcher.addEventListener('click', (e) => {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  const scope = btn.dataset.langScope;
  englishScope = englishScope === scope ? 'none' : scope;
  langSwitcher.querySelectorAll('.chip').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.langScope === englishScope);
  });
  applyLabelLanguage();
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

// --- 建物の立体表現（Liberty 向け、立体 ⇔ 平面の切り替え） ---
// Liberty の建物は fill-extrusion（building-3d）。高さ(height)と基準(base)を 0 にすると
// 立体（壁面と影）が消えて平面になる。3D建物を持つスタイルは Liberty だけなので、
// 他スタイルには該当レイヤーが無く無害。
let buildings3D = false; // 既定は平面（立体OFF）
let applyingBuildings = false;
// スタイルごとの既定の高さ/基準の式を覚えておき、立体に戻せるようにする
const buildingHeightDefaults = new Map();

function applyBuildingHeight() {
  if (applyingBuildings || !map.isStyleLoaded()) return;
  applyingBuildings = true;

  for (const layer of map.getStyle().layers || []) {
    if (layer.type !== 'fill-extrusion' || layer['source-layer'] !== 'building') continue;

    if (!buildingHeightDefaults.has(layer.id)) {
      buildingHeightDefaults.set(layer.id, {
        height: map.getPaintProperty(layer.id, 'fill-extrusion-height'),
        base: map.getPaintProperty(layer.id, 'fill-extrusion-base'),
      });
    }
    const def = buildingHeightDefaults.get(layer.id);

    const height = buildings3D ? def.height : 0;
    const base = buildings3D ? def.base : 0;
    if (JSON.stringify(map.getPaintProperty(layer.id, 'fill-extrusion-height')) !== JSON.stringify(height)) {
      map.setPaintProperty(layer.id, 'fill-extrusion-height', height);
    }
    if (JSON.stringify(map.getPaintProperty(layer.id, 'fill-extrusion-base')) !== JSON.stringify(base)) {
      map.setPaintProperty(layer.id, 'fill-extrusion-base', base);
    }
  }

  applyingBuildings = false;
}

map.on('styledata', applyBuildingHeight);

const building3dBtn = document.getElementById('building-3d-toggle');
building3dBtn.addEventListener('click', () => {
  buildings3D = !buildings3D;
  building3dBtn.classList.toggle('is-active', buildings3D);
  applyBuildingHeight();
});

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
  labelTextDefaults.clear();
  lineJoinDefaults.clear();
  roadColorDefaults.clear();
  themeColorDefaults.clear();
  placeSizeDefaults.clear();
  buildingHeightDefaults.clear();

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
