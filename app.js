// ===== 第 3 步：分頁切換 =====
const $ = (s) => document.querySelector(s);
const renders = [];                       // 之後每一步都把自己的「畫面更新」放進來
function refresh() { renders.forEach((f) => f()); }

function go(page) {
  document.querySelectorAll('.page').forEach((p) => (p.hidden = p.id !== page));
  document.querySelectorAll('.menu button').forEach((b) =>
    b.classList.toggle('on', b.dataset.page === page));
  window.scrollTo(0, 0);
}
document.querySelector('.menu').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) go(b.dataset.page);
});

// ===== 第 4 步：冰箱 =====
const DAY = 24 * 60 * 60 * 1000;
function today() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function addDays(n) {                    // 回傳 n 天後的日期，格式 2026-11-21
  const d = new Date(today().getTime() + n * DAY);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function daysLeft(date) { return Math.round((new Date(date + 'T00:00:00') - today()) / DAY); }

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function save() {
  localStorage.setItem('items', JSON.stringify(items));
  localStorage.setItem('shop', JSON.stringify(shop));
  localStorage.setItem('cooked', JSON.stringify(cooked));
}

let items = load('items', [
  { name: '吐司', exp: addDays(0) },
  { name: '香蕉', exp: addDays(1) },
  { name: '鮮奶', exp: addDays(2) },
  { name: '菠菜', exp: addDays(2) },
  { name: '嫩豆腐', exp: addDays(3) },
  { name: '牛番茄', exp: addDays(5) },
  { name: '青蔥', exp: addDays(4) },
  { name: '雞蛋', exp: addDays(14) },
  { name: '洋蔥', exp: addDays(20) },
  { name: '蒜頭', exp: addDays(30) },
]);
let shop = load('shop', []);
let cooked = load('cooked', []);

function color(d) { return d <= 2 ? 'red' : d <= 5 ? 'amber' : 'green'; }
function sorted() { return [...items].sort((a, b) => a.exp.localeCompare(b.exp)); }

function renderFridge() {
  $('#fridgeList').innerHTML = sorted().map((it) => {
    const d = daysLeft(it.exp);
    return `<div class="row">
      <span class="name"><b>${it.name}</b><br><small>${it.exp.slice(5)} 到期</small></span>
      <span class="days">${d}</span><span class="dot ${color(d)}"></span>
      <button class="del" data-name="${it.name}" aria-label="刪除">×</button>
    </div>`;
  }).join('');
}
renders.push(renderFridge);

$('#addForm').addEventListener('submit', (e) => {
  e.preventDefault();                               // 表單預設會重新整理頁面，先擋掉
  items.push({ name: $('#addName').value.trim(), exp: addDays(+$('#addDays').value) });
  $('#addName').value = '';
  save(); refresh();
});
$('#fridgeList').addEventListener('click', (e) => {
  const name = e.target.dataset.name;
  if (!name) return;
  items = items.filter((it) => it.name !== name);
  save(); refresh();
});

// ===== 第 5 步：食譜與兩種推薦 =====
const BOOK = [
  { cat: '正餐', name: '菠菜豆腐蛋花湯', time: 10, need: ['菠菜', '嫩豆腐', '雞蛋', '青蔥'],
    steps: ['水滾後放豆腐丁。', '加菠菜煮一分鐘。', '轉小火淋蛋液，等兩秒再攪。', '加鹽、撒蔥花。'] },
  { cat: '正餐', name: '番茄炒蛋', time: 12, need: ['牛番茄', '雞蛋', '洋蔥', '青蔥'],
    steps: ['蛋炒到半熟先盛起來。', '洋蔥炒軟，下番茄炒到出汁。', '蛋回鍋拌一拌，撒蔥花。'] },
  { cat: '正餐', name: '蒜炒菠菜', time: 5, need: ['菠菜', '蒜頭'],
    steps: ['蒜頭切片爆香。', '下菠菜大火快炒。', '加鹽起鍋。'] },
  { cat: '甜點', name: '法式吐司佐香蕉', time: 15, need: ['吐司', '雞蛋', '鮮奶', '香蕉'],
    steps: ['蛋和鮮奶打勻。', '吐司兩面吸飽蛋液。', '小火煎到金黃，鋪上香蕉片。'] },
  { cat: '甜點', name: '香蕉雞蛋小鬆餅', time: 12, need: ['香蕉', '雞蛋'],
    steps: ['香蕉壓成泥。', '打入雞蛋拌勻。', '小火煎成小圓餅。'] },
  { cat: '飲料', name: '香蕉牛奶', time: 3, need: ['香蕉', '鮮奶'],
    steps: ['香蕉切塊。', '加鮮奶打勻。'] },
];

let mode = 'first';   // first = 快過期優先，all = 整個冰箱
let cat = '正餐';

function find(name) { return items.find((it) => it.name.includes(name) || name.includes(it.name)); }
function urgency(d) { return d <= 0 ? 6 : d <= 2 ? 5 : d <= 5 ? 2 : 1; }

function rank() {
  return BOOK.filter((r) => r.cat === cat).map((r) => {
    const have = r.need.filter(find);
    const buy = r.need.filter((n) => !find(n));
    const score = mode === 'first'
      ? have.reduce((s, n) => s + urgency(daysLeft(find(n).exp)), 0)   // 越快過期分數越高
      : have.length / r.need.length;                                  // 有的比例越高越好
    return { ...r, have, buy, score };
  }).filter((r) => r.have.length > 0)
    .sort((a, b) => b.score - a.score);
}

function renderHome() {
  $('#soon').innerHTML = sorted().filter((it) => daysLeft(it.exp) <= 2).map((it) =>
    `<div class="magnet"><b>${it.name}</b><small>剩 ${daysLeft(it.exp)} 天</small></div>`).join('');

  $('#cats').innerHTML = ['正餐', '甜點', '飲料'].map((c) =>
    `<button class="chip ${c === cat ? 'on' : ''}" data-cat="${c}">${c}</button>`).join('');

  const list = rank();
  $('#recipes').innerHTML = list.map((r, i) => `
    <button class="card" data-i="${i}">
      <h3>${r.name}</h3>
      <small>${r.time} 分鐘・材料有 ${r.have.length}/${r.need.length} 樣</small>
      <span class="tags">
        ${r.have.map((n) => `<span class="tag ${daysLeft(find(n).exp) <= 2 ? 'hot' : ''}">${n}</span>`).join('')}
        ${r.buy.map((n) => `<span class="tag buy">要買 ${n}</span>`).join('')}
      </span>
    </button>`).join('') || '<p>冰箱裡的東西湊不出這一類。</p>';
  $('#recipes').list = list;   // 先記著，點卡片時用得到
}
renders.push(renderHome);

document.querySelector('.seg').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  mode = b.dataset.mode;
  document.querySelectorAll('.seg button').forEach((x) => x.classList.toggle('on', x === b));
  renderHome();
});
$('#cats').addEventListener('click', (e) => {
  if (e.target.dataset.cat) { cat = e.target.dataset.cat; renderHome(); }
});
$('#recipes').addEventListener('click', (e) => {
  const card = e.target.closest('.card');
  if (card) openRecipe($('#recipes').list[card.dataset.i]);
});

function openRecipe(r) {
  const page = $('#recipePage');
  page.innerHTML = `<div class="inner">
    <button class="btn" id="back">← 回到菜單</button>
    <h1>${r.name}</h1>
    <p>約 ${r.time} 分鐘</p>
    <h3>冰箱裡有</h3>
    <p>${r.have.map((n) => `<span class="tag">${n}</span>`).join(' ') || '沒有'}</p>
    <h3>要去買</h3>
    <p>${r.buy.map((n) => `<span class="tag buy">${n}</span>`).join(' ') || '都有了！'}</p>
    ${r.buy.length ? '<button class="btn" id="toShop">缺的加進購物清單</button>' : ''}
    <h3>做法</h3>
    <ol>${r.steps.map((s) => `<li>${s}</li>`).join('')}</ol>
    <button class="btn red" id="done">做好了！扣掉食材</button>
  </div>`;
  page.hidden = false;

  $('#back').onclick = () => (page.hidden = true);
  $('#done').onclick = () => {
    items = items.filter((it) => !r.have.some((n) => find(n) === it));
    save(); refresh();
    page.hidden = true;
    go('cooked');                       // 做好了就去「我煮過的」拍照
  };
  if ($('#toShop')) $('#toShop').onclick = () => {
    r.buy.forEach((n) => { if (!shop.some((s) => s.name === n)) shop.push({ name: n, done: false }); });
    save(); refresh();
    $('#toShop').textContent = '已加進購物清單';
  };
}

// ===== 第 6 步：我想吃… + 購物清單 =====
const WISH = {
  '酸菜魚': { time: 35, need: ['鱸魚片', '酸菜', '雞蛋', '蒜頭', '青蔥', '乾辣椒', '花椒'],
    steps: ['魚片用米酒、鹽、蛋白抓勻，拌太白粉醃十分鐘。', '酸菜切段，蒜頭拍碎。',
            '爆香蒜頭和蔥白，下酸菜炒香。', '加水煮滾，小火煮五分鐘。',
            '魚片一片片放進去，變白就關火。', '熱油爆香乾辣椒和花椒，淋在魚上。'] },
  '麻婆豆腐': { time: 20, need: ['嫩豆腐', '豬絞肉', '豆瓣醬', '蒜頭', '青蔥', '花椒粉'],
    steps: ['豆腐切塊。', '絞肉炒到變色。', '加蒜末、豆瓣醬炒出紅油。', '加水和豆腐煮三分鐘，勾芡。', '撒花椒粉和蔥花。'] },
};

$('#wishForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = $('#wishInput').value.trim();
  const key = Object.keys(WISH).find((k) => q.includes(k) || k.includes(q));
  if (!q || !key) { alert('食譜庫裡還沒有這道菜，試試「酸菜魚」或「麻婆豆腐」'); return; }
  const r = WISH[key];
  openRecipe({ ...r, name: key, have: r.need.filter(find), buy: r.need.filter((n) => !find(n)) });
});

function renderShop() {
  $('#shopList').innerHTML = shop.map((s, i) => `
    <label class="row">
      <input type="checkbox" data-i="${i}" ${s.done ? 'checked' : ''} style="flex:none;width:22px;height:22px">
      <span class="name">${s.name}</span>
    </label>`).join('') || '<p>清單是空的。</p>';
}
renders.push(renderShop);

$('#shopForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $('#shopInput').value.trim();
  if (v) shop.push({ name: v, done: false });
  $('#shopInput').value = '';
  save(); refresh();
});
$('#shopList').addEventListener('change', (e) => {
  shop[e.target.dataset.i].done = e.target.checked;
  save();
});
$('#bought').addEventListener('click', () => {
  shop.filter((s) => s.done).forEach((s) => items.push({ name: s.name, exp: addDays(5) }));
  shop = shop.filter((s) => !s.done);
  save(); refresh();
});

// ===== 第 7 步：我煮過的 =====
function renderCooked() {
  $('#plates').innerHTML = cooked.map((c) => `
    <div class="plate"><img src="${c.photo}" alt="${c.name}"><b>${c.name}</b></div>`).join('');
}
renders.push(renderCooked);

$('#photoInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const img = new Image();
  img.onload = () => {
    // 從照片中間裁一個正方形，縮成 400×400，檔案才不會太大
    const size = Math.min(img.width, img.height);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 400;
    canvas.getContext('2d').drawImage(img,
      (img.width - size) / 2, (img.height - size) / 2, size, size,   // 從原圖裁哪一塊
      0, 0, 400, 400);                                                 // 畫到畫布哪裡
    const name = prompt('這道菜叫什麼？') || '無名料理';
    cooked.unshift({ name, photo: canvas.toDataURL('image/jpeg', 0.8) });
    save(); refresh();
  };
  img.src = URL.createObjectURL(file);
});

// ===== 第 9 步：飲食設定 =====
const MEATS = ['都吃', '不吃紅肉', '只吃海鮮', '吃素'];
const AVOIDS = ['香菜', '海鮮', '豬肉', '牛肉', '奶製品', '蛋', '堅果', '辣', '洋蔥', '菇類'];
const WORDS = {                        // 每個選項會擋掉名字裡有這些字的食材
  紅肉: ['豬', '牛肉', '牛排', '羊肉'],
  雞肉: ['雞肉', '雞胸', '雞腿'],
  海鮮: ['魚', '蝦', '蟹', '蛤', '花枝'],
  豬肉: ['豬'],
  牛肉: ['牛肉', '牛排'],
  奶製品: ['奶', '優格', '起司'],
  蛋: ['蛋'],
  菇類: ['菇'],
};
let prefs = load('prefs', null);       // null = 還沒設定過

function bannedWords() {
  if (!prefs) return [];
  const w = [];
  if (prefs.meat !== '都吃') w.push(...WORDS.紅肉);
  if (prefs.meat === '只吃海鮮' || prefs.meat === '吃素') w.push(...WORDS.雞肉);
  if (prefs.meat === '吃素') w.push(...WORDS.海鮮);
  prefs.avoid.forEach((a) => w.push(...(WORDS[a] || [a])));
  return w;
}
function badIn(r) {                    // 這道菜裡有哪些不吃的食材
  const words = bannedWords();
  return r.need.filter((n) => words.some((w) => n.includes(w)));
}

// 推薦清單：把有不吃食材的菜過濾掉
const rankAll = rank;
rank = () => rankAll().filter((r) => badIn(r).length === 0);

// 打開食譜前先檢查（「我想吃…」查到的菜也會經過這裡）
const openRecipeAll = openRecipe;
openRecipe = (r) => {
  const bad = badIn(r);
  if (bad.length && !confirm(`這道菜有你不吃的：${bad.join('、')}\n還是要看做法嗎？`)) return;
  openRecipeAll(r);
};

function openPrefs() {
  const p = prefs ? { meat: prefs.meat, avoid: [...prefs.avoid] } : { meat: '都吃', avoid: [] };
  const page = $('#recipePage');
  page.innerHTML = `<div class="inner">
    <h1>飲食習慣</h1>
    <h3>吃肉嗎？</h3>
    <div class="chips" id="meatChips">${MEATS.map((m) =>
      `<button class="chip ${m === p.meat ? 'on' : ''}" data-m="${m}">${m}</button>`).join('')}</div>
    <h3>有什麼不吃的？（可以複選）</h3>
    <div class="chips" id="avoidChips">${AVOIDS.map((a) =>
      `<button class="chip ${p.avoid.includes(a) ? 'on' : ''}" data-a="${a}">${a}</button>`).join('')}</div>
    <button class="btn red" id="savePrefs">好了，開始用</button>
  </div>`;
  page.hidden = false;

  $('#meatChips').onclick = (e) => {
    if (!e.target.dataset.m) return;
    p.meat = e.target.dataset.m;
    document.querySelectorAll('#meatChips .chip').forEach((c) => c.classList.toggle('on', c === e.target));
  };
  $('#avoidChips').onclick = (e) => {
    const a = e.target.dataset.a;
    if (!a) return;
    p.avoid = p.avoid.includes(a) ? p.avoid.filter((x) => x !== a) : [...p.avoid, a];
    e.target.classList.toggle('on');
  };
  $('#savePrefs').onclick = () => {
    prefs = p;
    localStorage.setItem('prefs', JSON.stringify(prefs));
    page.hidden = true;
    refresh();
  };
}

// 在推薦食譜的上方顯示目前的設定，旁邊放「修改」按鈕
$('.seg').insertAdjacentHTML('beforebegin', `
  <div class="add" style="align-items:center">
    <span id="prefsText" style="flex:1"></span>
    <button class="btn" id="prefsBtn">修改飲食設定</button>
  </div>`);
$('#prefsBtn').onclick = openPrefs;
function renderPrefs() {
  if (!prefs) return;
  $('#prefsText').textContent = `飲食設定：${prefs.meat}${prefs.avoid.length ? '・不吃' + prefs.avoid.join('、') : ''}`;
}
renders.push(renderPrefs);
if (!prefs) openPrefs();               // 第一次打開就先問

// ===== 第 10 步：食譜和食材變多 =====
// 常見食材：[保存天數, 放哪裡, 分類]
const FOOD = {
  高麗菜: [10, '冷藏', '蔬菜'], 青江菜: [4, '冷藏', '蔬菜'], 菠菜: [3, '冷藏', '蔬菜'], 地瓜葉: [3, '冷藏', '蔬菜'],
  小黃瓜: [5, '冷藏', '蔬菜'], 紅蘿蔔: [14, '冷藏', '蔬菜'], 青椒: [7, '冷藏', '蔬菜'], 茄子: [5, '冷藏', '蔬菜'],
  玉米: [3, '冷藏', '蔬菜'], 香菇: [5, '冷藏', '蔬菜'], 金針菇: [5, '冷藏', '蔬菜'], 豆芽菜: [2, '冷藏', '蔬菜'],
  青蔥: [5, '冷藏', '蔬菜'], 九層塔: [3, '冷藏', '蔬菜'], 牛番茄: [6, '冷藏', '蔬菜'],
  洋蔥: [30, '常溫', '蔬菜'], 蒜頭: [30, '常溫', '蔬菜'], 薑: [21, '常溫', '蔬菜'], 馬鈴薯: [21, '常溫', '蔬菜'], 地瓜: [14, '常溫', '蔬菜'],
  香蕉: [4, '常溫', '水果'], 蘋果: [14, '冷藏', '水果'], 草莓: [3, '冷藏', '水果'], 檸檬: [14, '冷藏', '水果'],
  奇異果: [7, '冷藏', '水果'], 芒果: [4, '冷藏', '水果'],
  雞胸肉: [2, '冷藏', '肉和海鮮'], 雞腿肉: [2, '冷藏', '肉和海鮮'], 豬肉片: [2, '冷藏', '肉和海鮮'], 豬絞肉: [2, '冷藏', '肉和海鮮'],
  牛肉片: [2, '冷藏', '肉和海鮮'], 鮭魚: [2, '冷藏', '肉和海鮮'], 蝦仁: [60, '冷凍', '肉和海鮮'], 培根: [7, '冷藏', '肉和海鮮'],
  雞蛋: [21, '冷藏', '蛋奶豆'], 鮮奶: [7, '冷藏', '蛋奶豆'], 原味優格: [10, '冷藏', '蛋奶豆'], 起司片: [30, '冷藏', '蛋奶豆'],
  奶油: [60, '冷藏', '蛋奶豆'], 嫩豆腐: [4, '冷藏', '蛋奶豆'], 板豆腐: [4, '冷藏', '蛋奶豆'],
  吐司: [4, '常溫', '主食'], 白飯: [3, '冷藏', '主食'], 麵條: [60, '常溫', '主食'], 燕麥片: [90, '常溫', '主食'],
};
function foodInfo(name) {                // 找得到就回傳 [天數, 位置, 分類]，找不到給預設值
  const key = Object.keys(FOOD).find((k) => name.includes(k) || k.includes(name));
  return key ? FOOD[key] : [5, '冷藏', '其他'];
}
// 手動新增時，打完名字就自動帶入保存天數
$('#addName').addEventListener('input', () => {
  if ($('#addName').value.trim()) $('#addDays').value = foodInfo($('#addName').value.trim())[0];
});

const R = (cat, name, time, need, steps) => ({ cat, name, time, need, steps });
BOOK.push(
  R('正餐', '蒜炒高麗菜', 5, ['高麗菜', '蒜頭'], ['高麗菜用手撕成片。', '蒜頭爆香，下高麗菜大火炒。', '加一點水和鹽，炒到軟就起鍋。']),
  R('正餐', '炒地瓜葉', 5, ['地瓜葉', '蒜頭'], ['地瓜葉挑掉粗梗。', '蒜頭爆香，大火快炒一分鐘，加鹽。']),
  R('正餐', '番茄蛋花湯', 10, ['牛番茄', '雞蛋', '青蔥'], ['番茄切塊，炒到出汁。', '加水煮滾五分鐘。', '淋蛋液，加鹽，撒蔥花。']),
  R('正餐', '蛋炒飯', 10, ['白飯', '雞蛋', '青蔥'], ['蛋打散先炒到半熟。', '下白飯大火炒散。', '加鹽、醬油，撒蔥花。']),
  R('正餐', '青椒炒肉絲', 12, ['青椒', '豬肉片', '蒜頭'], ['肉片切絲，用醬油抓醃。', '肉絲炒到變色盛起。', '蒜頭爆香，下青椒炒軟，肉回鍋拌勻。']),
  R('正餐', '洋蔥炒牛肉', 10, ['洋蔥', '牛肉片', '青蔥'], ['牛肉用醬油、太白粉抓醃。', '洋蔥炒到半透明。', '下牛肉大火炒到剛變色，撒蔥段。']),
  R('正餐', '三杯雞', 25, ['雞腿肉', '薑', '蒜頭', '九層塔'], ['麻油小火煸薑片到捲起。', '下雞腿肉煎到上色，加蒜頭。', '加醬油、米酒、糖各一大匙，燜十分鐘。', '收汁後丟九層塔拌一下。']),
  R('正餐', '親子丼', 20, ['雞腿肉', '洋蔥', '雞蛋', '白飯'], ['醬油、味醂、水煮滾，放洋蔥。', '加雞腿肉塊煮熟。', '淋蛋液，半熟就關火。', '整鍋鋪在白飯上。']),
  R('正餐', '肉絲炒麵', 15, ['麵條', '高麗菜', '豬肉片', '紅蘿蔔'], ['麵條燙熟撈起。', '肉絲炒熟，加紅蘿蔔絲、高麗菜炒軟。', '下麵條和醬油拌炒均勻。']),
  R('正餐', '家常豆腐', 15, ['板豆腐', '豬肉片', '紅蘿蔔', '青蔥'], ['豆腐切片煎到兩面金黃。', '炒肉片和紅蘿蔔片。', '豆腐回鍋，加醬油和一點水燒兩分鐘，撒蔥。']),
  R('正餐', '馬鈴薯燉肉', 35, ['馬鈴薯', '紅蘿蔔', '洋蔥', '豬肉片'], ['馬鈴薯、紅蘿蔔切塊。', '炒肉片和洋蔥。', '加蔬菜、水、醬油、糖，小火燉二十分鐘。']),
  R('正餐', '奶油檸檬鮭魚', 15, ['鮭魚', '奶油', '檸檬'], ['鮭魚擦乾，撒鹽。', '皮朝下煎到酥，翻面。', '加奶油融化淋在魚上，擠檸檬汁。']),
  R('正餐', '蝦仁炒蛋', 10, ['蝦仁', '雞蛋', '青蔥'], ['蝦仁退冰擦乾，炒到變紅。', '倒入蛋液，半熟就關火，撒蔥花。']),
  R('正餐', '魚香茄子', 15, ['茄子', '豬絞肉', '蒜頭'], ['茄子切條，用少一點油煎軟。', '絞肉和蒜末炒香，加豆瓣醬。', '茄子回鍋，加醬油、醋、糖拌勻。']),
  R('正餐', '香菇雞湯', 40, ['雞腿肉', '香菇', '薑'], ['雞肉燙過去血水。', '加水、香菇、薑片煮滾。', '轉小火燉三十分鐘，加鹽。']),
  R('正餐', '金針菇培根捲', 15, ['金針菇', '培根'], ['金針菇分成小把。', '用培根捲起來。', '收口朝下煎到焦香。']),
  R('正餐', '玉米濃湯', 25, ['玉米', '鮮奶', '洋蔥', '馬鈴薯'], ['洋蔥、馬鈴薯切丁炒軟。', '加玉米粒和水煮十五分鐘。', '加鮮奶，用果汁機打勻，再加鹽。']),
  R('正餐', '涼拌小黃瓜', 10, ['小黃瓜', '蒜頭'], ['小黃瓜拍裂切段，撒鹽醃十分鐘。', '倒掉水分，加蒜末、醋、糖、香油拌勻。']),
  R('甜點', '烤地瓜', 40, ['地瓜'], ['地瓜洗乾淨不用削皮。', '用烤箱 200 度烤四十分鐘，烤到流蜜。']),
  R('甜點', '優格燕麥杯', 5, ['原味優格', '燕麥片', '香蕉'], ['杯底放燕麥。', '倒優格，鋪香蕉片。']),
  R('甜點', '芒果優格冰', 5, ['芒果', '原味優格'], ['芒果切丁冷凍一小時。', '和優格一起打成冰沙。']),
  R('甜點', '奶油煎蘋果', 10, ['蘋果', '奶油'], ['蘋果切片。', '奶油小火融化，煎蘋果到軟，撒一點糖和肉桂粉。']),
  R('甜點', '鮮奶蒸布丁', 40, ['鮮奶', '雞蛋'], ['鮮奶加糖加熱到微溫。', '慢慢倒進蛋液攪勻，過篩。', '蓋錫箔紙蒸十五分鐘，放涼冷藏。']),
  R('飲料', '檸檬蜂蜜水', 3, ['檸檬'], ['檸檬切半擠汁。', '加溫水和蜂蜜攪勻。']),
  R('飲料', '奇異果香蕉汁', 5, ['奇異果', '香蕉'], ['奇異果去皮切塊。', '和香蕉、冷開水一起打勻。']),
  R('飲料', '蘋果牛奶', 5, ['蘋果', '鮮奶'], ['蘋果去核切塊。', '加鮮奶打勻。']),
  R('飲料', '芒果牛奶', 5, ['芒果', '鮮奶'], ['芒果切塊。', '加鮮奶和冰塊打勻。']),
  R('飲料', '黑糖薑茶', 10, ['薑'], ['薑切片，加水煮五分鐘。', '加黑糖煮到融化。']),
);

Object.assign(WISH, {
  '咖哩飯': { time: 40, need: ['雞腿肉', '洋蔥', '馬鈴薯', '紅蘿蔔', '咖哩塊', '白飯'],
    steps: ['雞肉、馬鈴薯、紅蘿蔔切塊，洋蔥切絲。', '洋蔥炒到微焦。', '下雞肉炒到變色，再加馬鈴薯、紅蘿蔔。', '加水煮二十分鐘。', '關火放咖哩塊攪勻，再小火煮五分鐘。'] },
  '蛋包飯': { time: 25, need: ['雞蛋', '白飯', '洋蔥', '雞胸肉', '鮮奶', '番茄醬'],
    steps: ['洋蔥、雞肉切丁炒熟。', '加白飯和番茄醬炒成番茄炒飯。', '蛋加鮮奶打勻，煎成半熟蛋皮。', '蛋皮蓋在炒飯上，擠番茄醬。'] },
  '宮保雞丁': { time: 20, need: ['雞胸肉', '乾辣椒', '花生', '蒜頭', '青蔥'],
    steps: ['雞肉切丁，用醬油、太白粉抓醃。', '小火煸乾辣椒和花椒。', '下雞丁炒熟，加蒜、蔥段。', '加醬油、醋、糖拌勻，最後丟花生。'] },
  '番茄牛肉麵': { time: 60, need: ['牛肉片', '牛番茄', '洋蔥', '薑', '麵條'],
    steps: ['洋蔥、番茄、薑炒香。', '加牛肉和水、醬油、豆瓣醬。', '小火燉四十分鐘。', '麵條另外煮好，淋上湯和牛肉。'] },
  '滷肉飯': { time: 60, need: ['豬絞肉', '紅蔥頭', '雞蛋', '白飯'],
    steps: ['紅蔥頭切片炸成油蔥酥。', '絞肉炒到出油。', '加醬油、冰糖、水和油蔥酥。', '放水煮蛋，小火滷四十分鐘，淋在白飯上。'] },
  '炸醬麵': { time: 25, need: ['豬絞肉', '豆干', '小黃瓜', '麵條'],
    steps: ['豆干切丁，小黃瓜切絲。', '絞肉炒香，加豆干丁。', '加甜麵醬、豆瓣醬和一點水煮五分鐘。', '麵條煮好，淋炸醬，鋪小黃瓜絲。'] },
});
WORDS.堅果 = ['花生', '核桃', '杏仁', '腰果', '堅果'];   // 補上第 9 步的堅果判斷

// ===== 第 11 步：加食材更快 =====
const PLACES = ['冷藏', '冷凍', '常溫'];
const GROUPS = ['蔬菜', '水果', '肉和海鮮', '蛋奶豆', '主食'];

$('#addForm').insertAdjacentHTML('afterend', `
  <details>
    <summary class="btn">＋ 常用食材，點一下就放進冰箱</summary>
    ${GROUPS.map((g) => `<p><small>${g}</small></p><div class="chips quick">${Object.keys(FOOD)
      .filter((n) => FOOD[n][2] === g).map((n) => `<button class="chip" data-food="${n}">${n}</button>`).join('')}</div>`).join('')}
  </details>
  <p id="quickMsg" class="tagline"></p>
`);

document.querySelectorAll('.quick').forEach((box) => box.addEventListener('click', (e) => {
  const name = e.target.dataset.food;
  if (!name) return;
  const [days, place] = foodInfo(name);
  const old = items.find((it) => it.name === name);
  if (old) {                              // 已經有了：當成剛買新的，更新期限
    old.exp = addDays(days);
    $('#quickMsg').textContent = `${name} 已經在冰箱裡，期限更新成 ${days} 天後`;
  } else {
    items.push({ name, exp: addDays(days), place });
    $('#quickMsg').textContent = `放進${place}：${name}（約可放 ${days} 天）`;
  }
  save(); refresh();
}));

// 冰箱清單改成依「冷藏／冷凍／常溫」分區顯示
function renderFridgeByPlace() {
  $('#fridgeList').innerHTML = PLACES.map((p) => {
    const list = sorted().filter((it) => (it.place || foodInfo(it.name)[1]) === p);
    if (!list.length) return '';
    return `<h3>${p}（${list.length}）</h3><div>${list.map((it) => {
      const d = daysLeft(it.exp);
      return `<div class="row">
        <span class="name"><b>${it.name}</b><br><small>${it.exp.slice(5)} 到期・點數字可改天數</small></span>
        <span class="days" data-edit="${it.name}">${d}</span><span class="dot ${color(d)}"></span>
        <button class="del" data-name="${it.name}" aria-label="刪除">×</button>
      </div>`;
    }).join('')}</div>`;
  }).join('');
}
renders[renders.indexOf(renderFridge)] = renderFridgeByPlace;   // 用新的畫法取代舊的

$('#fridgeList').addEventListener('click', (e) => {
  const name = e.target.dataset.edit;
  if (!name) return;
  const it = items.find((x) => x.name === name);
  const v = prompt(`${name} 還能放幾天？`, daysLeft(it.exp));
  if (v === null || isNaN(+v)) return;
  it.exp = addDays(+v);
  save(); refresh();
});

// 手動新增的食材也記下位置
$('#addForm').addEventListener('submit', () => {
  const last = items[items.length - 1];
  if (last && !last.place) last.place = foodInfo(last.name)[1];
  save();
});

// ===== 第 12 步：找菜更方便 =====
let favs = load('favs', []);              // 收藏的菜名
let query = '';
let onlyFavs = false;

$('#recipes').insertAdjacentHTML('beforebegin', `
  <div class="add">
    <input id="search" placeholder="搜尋菜名或食材，例如：雞蛋">
    <button class="btn red" id="random">隨便來一頓</button>
  </div>
  <div class="chips"><button class="chip" id="favChip">♥ 只看收藏</button></div>
`);

// 推薦清單再加一層：搜尋 + 只看收藏
const rankFiltered = rank;
rank = () => {
  let list;
  if (query) {                            // 搜尋時三個類別一起找
    const keep = cat;
    list = ['正餐', '甜點', '飲料'].flatMap((c) => { cat = c; return rankFiltered(); });
    cat = keep;
    list = list.filter((r) => r.name.includes(query) || r.need.some((n) => n.includes(query)));
  } else {
    list = rankFiltered();
  }
  return onlyFavs ? list.filter((r) => favs.includes(r.name)) : list;
};

$('#search').addEventListener('input', () => { query = $('#search').value.trim(); renderHome(); });
$('#favChip').addEventListener('click', () => {
  onlyFavs = !onlyFavs;
  $('#favChip').classList.toggle('on', onlyFavs);
  renderHome();
});
$('#random').addEventListener('click', () => {
  const list = rank();
  if (!list.length) { alert('目前沒有符合的菜，換個類別或清掉搜尋試試'); return; }
  openRecipe(list[Math.floor(Math.random() * list.length)]);
});

// 食譜頁加一個收藏按鈕
const openRecipeWithCheck = openRecipe;
openRecipe = (r) => {
  openRecipeWithCheck(r);
  if ($('#recipePage').hidden) return;    // 在第 9 步按了取消就不會打開
  $('#recipePage h1').insertAdjacentHTML('afterend', '<button class="btn" id="fav"></button>');
  const paint = () => ($('#fav').textContent = favs.includes(r.name) ? '♥ 已收藏' : '♡ 收藏這道菜');
  paint();
  $('#fav').onclick = () => {
    favs = favs.includes(r.name) ? favs.filter((n) => n !== r.name) : [...favs, r.name];
    localStorage.setItem('favs', JSON.stringify(favs));
    paint();
    renderHome();
  };
};

// ===== 第 13 步：「我想吃…」缺的食材自動加進購物清單 =====
$('#wishForm').addEventListener('submit', () => {
  // 第 6 步已經打開食譜頁了；有「缺的加進購物清單」按鈕，就幫使用者按下去
  if (!$('#recipePage').hidden && $('#toShop')) {
    $('#toShop').click();
    $('#toShop').textContent = '缺的食材已自動加進購物清單 ✓';
  }
});

// ===== 第 14 步：買了新食材，自動推薦新的菜 =====
let known = load('known', null);         // 上次看到的冰箱食材名稱
let fresh = load('fresh', []);           // 剛加進來、還沒看過的食材

$('.wish').insertAdjacentHTML('afterend', '<div id="newBox"></div>');

function recipesWith(name) {             // 用到這樣食材、而且沒有不吃東西的菜，缺最少的排前面
  return BOOK
    .filter((r) => r.need.some((n) => n.includes(name) || name.includes(n)) && badIn(r).length === 0)
    .map((r) => ({ ...r, have: r.need.filter(find), buy: r.need.filter((n) => !find(n)) }))
    .sort((a, b) => a.buy.length - b.buy.length)
    .slice(0, 4);
}

function renderNew() {
  const names = items.map((it) => it.name);
  if (known === null) known = names;     // 第一次打開：示範食材不算新的
  const added = names.filter((n) => !known.includes(n));
  fresh = [...new Set([...added, ...fresh])].filter((n) => names.includes(n)).slice(0, 3);
  known = names;
  localStorage.setItem('known', JSON.stringify(known));
  localStorage.setItem('fresh', JSON.stringify(fresh));

  const groups = fresh.map((n) => ({ name: n, list: recipesWith(n) })).filter((g) => g.list.length);
  if (!groups.length) { $('#newBox').innerHTML = ''; return; }
  $('#newBox').innerHTML = `<div class="newbox">
    <h3>冰箱有新東西！</h3>
    ${groups.map((g, gi) => `<p>剛加的<b>${g.name}</b>可以做：</p>
      <div class="chips">${g.list.map((r, ri) =>
        `<button class="chip" data-g="${gi}" data-r="${ri}">${r.name}${r.buy.length ? `（缺 ${r.buy.length} 樣）` : ''}</button>`).join('')}</div>`).join('')}
    <button class="btn" id="newOk">知道了</button>
  </div>`;
  $('#newBox').groups = groups;
}
renders.push(renderNew);

$('#newBox').addEventListener('click', (e) => {
  if (e.target.id === 'newOk') { fresh = []; localStorage.setItem('fresh', '[]'); renderNew(); return; }
  const b = e.target.closest('[data-r]');
  if (b) openRecipe($('#newBox').groups[b.dataset.g].list[b.dataset.r]);
});

// ===== 第 15 步：水彩插圖 =====
const IMG = (name) => `images/${name}.webp`;

// ① 首頁大標題旁的漂浮插圖
$('#home').insertAdjacentHTML('afterbegin', ['pudding', 'iced-latte', 'roll-cake', 'fried-egg']
  .map((n, i) => `<img class="float f${i + 1}" src="${IMG(n)}" alt="">`).join(''));

// ② 菜名裡有這些字，就配這張圖（由上往下找，先找到先用）
const PICS = [
  ['布丁', 'pudding'], ['鮭魚', 'salmon'], ['牛肉', 'steak'], ['吐司', 'sandwich'],
  ['鬆餅', 'roll-cake'], ['煎蘋果', 'grape-tart'], ['蛋包飯', 'omelette'], ['炒蛋', 'omelette'],
  ['蛋炒飯', 'omelette'], ['蛋花湯', 'fried-egg'], ['親子丼', 'fried-egg'],
  ['牛奶', 'iced-latte'], ['奶昔', 'iced-latte'],
];
function picFor(name) {
  const hit = PICS.find(([word]) => name.includes(word));
  return hit ? IMG(hit[1]) : null;
}

// 食譜卡片：畫完之後，幫有圖的卡片補上插圖
const renderHomePlain = renderHome;
renderHome = () => {
  renderHomePlain();
  document.querySelectorAll('#recipes .card').forEach((card) => {
    const pic = picFor($('#recipes').list[card.dataset.i].name);
    if (!pic) return;
    card.classList.add('has-pic');
    card.insertAdjacentHTML('afterbegin', `<img class="card-pic" src="${pic}" alt="">`);
  });
};
renders[renders.indexOf(renderHomePlain)] = renderHome;

// 食譜頁：標題上面放大張插圖
const openRecipeNoPic = openRecipe;
openRecipe = (r) => {
  openRecipeNoPic(r);
  const pic = picFor(r.name);
  if (pic && !$('#recipePage').hidden) {
    $('#recipePage h1').insertAdjacentHTML('beforebegin', `<img class="recipe-pic" src="${pic}" alt="">`);
  }
};

// ③ 購物清單是空的時候
const renderShopPlain = renderShop;
renderShop = () => {
  renderShopPlain();
  if (!shop.length) {
    $('#shopList').innerHTML = `<div class="empty-art"><img src="${IMG('hotdog')}" alt="">清單空空，冰箱滿滿？</div>`;
  }
};
renders[renders.indexOf(renderShopPlain)] = renderShop;

// ④「我煮過的」還沒有照片時，先擺三盤示範
const renderCookedPlain = renderCooked;
renderCooked = () => {
  renderCookedPlain();
  if (!cooked.length) {
    $('#plates').innerHTML = [['steak', '煎牛排'], ['salmon', '奶油檸檬鮭魚'], ['omelette', '歐姆蛋']]
      .map(([img, name]) => `<div class="plate demo"><img src="${IMG(img)}" alt=""><b>${name}</b></div>`).join('')
      + '<p class="demo-note"><span>這是示範，拍照上傳後就會換成你做的菜</span></p>';
  }
};
renders[renders.indexOf(renderCookedPlain)] = renderCooked;

// ⑤ 飲食設定頁上面放一張三明治
const openPrefsPlain = openPrefs;
function addPrefsPic() {
  $('#recipePage h1').insertAdjacentHTML('beforebegin', `<img class="recipe-pic" src="${IMG('sandwich')}" alt="">`);
}
openPrefs = () => { openPrefsPlain(); addPrefsPic(); };
$('#prefsBtn').onclick = openPrefs;                       // 按鈕改成用新的版本
if ($('#savePrefs') && !$('#recipePage').hidden) addPrefsPic();   // 第一次打開時設定頁已經開著

// ===== 第 16 步：每張插圖都有一道同名的菜 =====
// ① 新食材：加進食材資料庫，也補進「＋ 常用食材」按鈕
const NEW_FOOD = {
  泡菜: [30, '冷藏', '蔬菜'], 櫛瓜: [5, '冷藏', '蔬菜'], 麝香葡萄: [5, '冷藏', '水果'],
  牛排: [2, '冷藏', '肉和海鮮'], 熱狗: [10, '冷藏', '肉和海鮮'],
  莫札瑞拉起司: [14, '冷藏', '蛋奶豆'], 鮮奶油: [7, '冷藏', '蛋奶豆'],
  冷凍水餃: [90, '冷凍', '主食'], 春捲皮: [30, '冷凍', '主食'], 披薩餅皮: [60, '冷凍', '主食'], 熱狗麵包: [3, '常溫', '主食'],
};
Object.assign(FOOD, NEW_FOOD);
Object.entries(NEW_FOOD).forEach(([name, [, , group]]) => {
  document.querySelectorAll('.quick')[GROUPS.indexOf(group)]
    .insertAdjacentHTML('beforeend', `<button class="chip" data-food="${name}">${name}</button>`);
});
WORDS.紅肉.push('熱狗', '培根', '水餃');          // 這些通常有豬肉，吃素時要擋掉
WORDS.豬肉.push('熱狗', '培根', '水餃');

// ② 新食譜：一張圖一道菜
BOOK.push(
  R('正餐', '煎牛排', 15, ['牛排', '奶油', '蒜頭'], ['牛排退冰到室溫，擦乾，撒鹽和黑胡椒。', '鍋子燒到冒煙，每面煎兩分鐘。', '加奶油和拍碎的蒜頭，一邊煎一邊把奶油淋在肉上。', '起鍋靜置五分鐘再切。']),
  R('正餐', '歐姆蛋', 8, ['雞蛋', '鮮奶', '洋蔥', '起司片'], ['洋蔥切丁炒軟盛起。', '蛋加鮮奶、鹽打勻。', '小火倒蛋液，邊緣凝固時鋪洋蔥和起司。', '對折起鍋。']),
  R('正餐', '荷包蛋', 5, ['雞蛋'], ['鍋子熱油，小火打入雞蛋。', '蛋白邊緣變脆、蛋黃還半熟就起鍋，撒鹽和黑胡椒。']),
  R('正餐', '起司菠菜烤吐司', 10, ['吐司', '起司片', '菠菜', '奶油'], ['菠菜燙熟擠乾。', '吐司夾起司和菠菜，外面抹奶油。', '平底鍋小火壓著煎到兩面金黃、起司融化。']),
  R('正餐', '熱狗堡', 10, ['熱狗', '熱狗麵包', '高麗菜'], ['熱狗煎到表面微焦。', '麵包稍微烤熱，鋪高麗菜絲。', '放上熱狗，擠番茄醬和黃芥末。']),
  R('正餐', '煎餃', 12, ['冷凍水餃'], ['平底鍋放油，水餃排好開中火。', '底部微焦時加水到餃子一半高，蓋鍋燜到水乾。', '打開鍋蓋再煎一分鐘，底部脆了就起鍋。']),
  R('正餐', '炸春捲', 25, ['春捲皮', '豬絞肉', '高麗菜', '紅蘿蔔'], ['絞肉炒熟，加高麗菜絲、紅蘿蔔絲炒軟，放涼。', '春捲皮包入餡料，捲緊。', '中火炸到金黃，或用氣炸鍋 200 度 10 分鐘。']),
  R('正餐', '瑪格麗特披薩', 20, ['披薩餅皮', '牛番茄', '莫札瑞拉起司', '九層塔'], ['餅皮抹番茄醬。', '鋪番茄片和撕小塊的起司。', '烤箱 220 度烤 10 分鐘，出爐放九層塔。']),
  R('正餐', '泡菜燉豬肉', 20, ['泡菜', '豬肉片', '洋蔥', '青蔥'], ['豬肉片炒到出油。', '加泡菜和洋蔥炒香。', '加一碗水燉十分鐘，撒蔥段。']),
  R('正餐', '石鍋拌飯', 25, ['白飯', '雞蛋', '菠菜', '豆芽菜', '紅蘿蔔', '豬絞肉'], ['菠菜、豆芽菜燙熟，紅蘿蔔炒軟，絞肉用醬油炒熟。', '碗底抹香油，鋪白飯。', '把配料圍一圈，中間放蛋黃。', '加韓式辣醬，拌勻再吃。']),
  R('正餐', '大醬湯', 20, ['嫩豆腐', '櫛瓜', '洋蔥', '青蔥'], ['水煮滾，拌入兩大匙韓式大醬。', '加洋蔥、櫛瓜煮五分鐘。', '放豆腐塊再煮三分鐘，撒蔥花。']),
  R('正餐', '起司熱狗', 20, ['熱狗', '莫札瑞拉起司', '雞蛋'], ['熱狗和起司條一起插在竹籤上。', '沾麵糊、再滾麵包粉。', '中火炸到金黃，淋番茄醬和黃芥末。']),
  R('正餐', '泡菜煎餅', 15, ['泡菜', '青蔥', '雞蛋'], ['泡菜切碎，和麵粉、蛋、一點泡菜汁、水拌成麵糊。', '加蔥段拌勻。', '平底鍋多放點油，倒麵糊攤平，兩面煎到酥脆。']),
  R('甜點', '草莓蛋糕捲', 60, ['雞蛋', '鮮奶油', '草莓'], ['蛋白打發，加蛋黃和低筋麵粉拌勻。', '倒進烤盤，180 度烤 12 分鐘，放涼。', '抹打發的鮮奶油，放草莓，捲起來冷藏一小時。']),
  R('甜點', '麝香葡萄塔', 30, ['麝香葡萄', '鮮奶油'], ['塔皮烤到金黃放涼（可以買現成的）。', '鮮奶油加糖打發，擠進塔裡。', '鋪滿洗乾淨擦乾的葡萄。']),
  R('飲料', '焦糖冰拿鐵', 5, ['鮮奶'], ['杯子裝冰塊，倒鮮奶到七分滿。', '慢慢倒入濃縮咖啡。', '擠鮮奶油，淋焦糖醬。']),
);

// ③ 插圖改成「菜名完全一樣才配圖」，不再用相近的字湊
PICS.length = 0;
PICS.push(
  ['鮮奶蒸布丁', 'pudding'], ['奶油檸檬鮭魚', 'salmon'], ['煎牛排', 'steak'], ['歐姆蛋', 'omelette'],
  ['荷包蛋', 'fried-egg'], ['起司菠菜烤吐司', 'sandwich'], ['熱狗堡', 'hotdog'], ['煎餃', 'gyoza'],
  ['炸春捲', 'spring-roll'], ['瑪格麗特披薩', 'pizza'], ['泡菜燉豬肉', 'kimchi-stew'], ['石鍋拌飯', 'bibimbap'],
  ['大醬湯', 'doenjang-stew'], ['起司熱狗', 'corn-dog'], ['泡菜煎餅', 'kimchi-pancake'],
  ['草莓蛋糕捲', 'roll-cake'], ['麝香葡萄塔', 'grape-tart'], ['焦糖冰拿鐵', 'iced-latte'],
);
picFor = (name) => {
  const hit = PICS.find(([dish]) => dish === name);
  return hit ? IMG(hit[1]) : null;
};

// ===== 第 17 步：標題拆成一個一個字母 =====
const title = $('.title');
let i = 0;
title.innerHTML = title.innerHTML.split(/(<br>)/).map((part) => part === '<br>' ? part
  : [...part].map((c) => c === ' ' ? ' ' : `<span class="ch" style="--i:${i++}">${c}</span>`).join('')).join('');
// 點一下標題（手機沒有滑鼠，用點的），全部字母跳一波
title.addEventListener('click', () => {
  title.classList.remove('wave');
  void title.offsetWidth;                // 讓動畫可以重新播放的小技巧
  title.classList.add('wave');
});


// ===== 第 19 步：新插圖和新菜 =====
// ① 新食材（保存天數、放哪裡、分類）
Object.assign(FOOD, {
  生菜: [5, '冷藏', '蔬菜'], 牛肉塊: [3, '冷藏', '肉和海鮮'], 豬五花: [3, '冷藏', '肉和海鮮'],
  餛飩皮: [5, '冷藏', '主食'], 味噌: [90, '冷藏', '其他'], 海帶芽: [180, '常溫', '其他'],
});
// ② 新食譜，菜名要和插圖完全一樣
BOOK.push(
  R('正餐', '田園沙拉', 10, ['生菜', '牛番茄', '小黃瓜'], ['生菜洗好撕小片，泡冰水再瀝乾。', '番茄、小黃瓜切片。', '淋橄欖油、檸檬汁、鹽和黑胡椒拌勻。']),
  R('正餐', '鮮肉餛飩湯', 25, ['餛飩皮', '豬絞肉', '青蔥'], ['絞肉加醬油、香油、蔥花拌到有黏性。', '每張餛飩皮包一小匙肉餡，捏緊。', '水滾後下餛飩，浮起再煮一分鐘。', '碗裡放鹽、香油、蔥花，舀入熱湯。']),
  R('正餐', '蔬菜燉牛肉', 60, ['牛肉塊', '馬鈴薯', '紅蘿蔔', '洋蔥'], ['牛肉塊煎到表面上色。', '加洋蔥炒軟，倒水蓋過牛肉。', '小火燉四十分鐘。', '加馬鈴薯、紅蘿蔔再燉二十分鐘，加鹽。']),
  R('正餐', '烤牛肉佐馬鈴薯', 70, ['牛肉塊', '馬鈴薯', '蒜頭', '奶油'], ['牛肉抹鹽和黑胡椒，平底鍋煎到四面焦香。', '馬鈴薯切塊，和蒜頭一起鋪在烤盤。', '牛肉放中間，放幾小塊奶油。', '200 度烤四十五分鐘，靜置十分鐘再切片。']),
  R('正餐', '味噌豆腐湯', 10, ['嫩豆腐', '味噌', '海帶芽', '青蔥'], ['水煮滾，放海帶芽和豆腐丁。', '關小火，用湯勺把味噌化開拌進去。', '不要再煮滾，撒蔥花就好。']),
  R('正餐', '紅燒肉', 60, ['豬五花', '薑', '青蔥'], ['五花肉切塊，冷水下鍋燙過洗乾淨。', '鍋裡放糖炒到焦糖色，下五花肉翻炒上色。', '加薑、蔥、醬油、米酒和水蓋過肉。', '小火燉四十分鐘，大火收汁。']),
  R('正餐', '泰式酸辣蝦湯', 20, ['蝦仁', '香菇', '牛番茄', '檸檬'], ['水煮滾，加香茅、南薑（沒有可以用薑代替）。', '放番茄、香菇煮五分鐘，加泰式酸辣醬。', '下蝦子煮到變紅。', '關火擠檸檬汁，撒香菜。']),
);
// ③ 插圖對照
PICS.push(
  ['田園沙拉', 'salad'], ['鮮肉餛飩湯', 'wonton-soup'], ['蔬菜燉牛肉', 'beef-stew'], ['烤牛肉佐馬鈴薯', 'pot-roast'],
  ['味噌豆腐湯', 'miso-soup'], ['紅燒肉', 'braised-pork'], ['泰式酸辣蝦湯', 'tom-yum'],
);

// ===== 第 20 步：「我煮過的」可以刪掉照片 =====
// ① 每個盤子右上角加一顆 ×（示範的盤子不加）
const renderCookedNoDel = renderCooked;
renderCooked = () => {
  renderCookedNoDel();
  document.querySelectorAll('#plates .plate:not(.demo)').forEach((plate, i) => {
    plate.insertAdjacentHTML('beforeend', `<button class="del" data-i="${i}" aria-label="刪除">×</button>`);
  });
};
renders[renders.indexOf(renderCookedNoDel)] = renderCooked;

// ② 按 × 先問一次，確定才刪
$('#plates').addEventListener('click', (e) => {
  const btn = e.target.closest('.del');
  if (!btn) return;
  const c = cooked[btn.dataset.i];
  if (!confirm(`要刪掉「${c.name}」這張照片嗎？`)) return;
  cooked.splice(btn.dataset.i, 1);
  save(); refresh();
});

// ===== 第 21 步：開場標題 =====
// 格子桌巾鋪開、標題浮出；同一次使用只播一次，3 秒後淡出，點一下可以馬上跳過
const splash = $('#splash');
if (sessionStorage.getItem('splashed')) {
  splash.remove();
} else {
  sessionStorage.setItem('splashed', '1');
  const hideSplash = () => {
    splash.classList.add('hide');
    setTimeout(() => splash.remove(), 500);
  };
  const timer = setTimeout(hideSplash, 3000);
  splash.addEventListener('click', () => { clearTimeout(timer); hideSplash(); });
}

// ===== 第 22 步：「修改飲食設定」改成一顆「飲食設定」按鈕 =====
// 拿掉旁邊的文字，按鈕直接打開設定飲食習慣的畫面
$('#prefsText').remove();
$('#prefsBtn').textContent = '飲食設定';
renders[renders.indexOf(renderPrefs)] = () => {};   // 文字拿掉了，不用再更新

// 第 18 步：冰箱是空的，就先打開冰箱
if (items.length === 0) go('fridge');

refresh();   // ← 永遠放在檔案最後一行：一打開網頁就把畫面畫出來
