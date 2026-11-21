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
refresh();   // ← 永遠放在檔案最後一行：一打開網頁就把畫面畫出來