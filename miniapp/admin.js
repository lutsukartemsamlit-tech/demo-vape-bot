// ─── Telegram WebApp init ────────────────────────────────────────────────────
const tg = window.Telegram && window.Telegram.WebApp;
if (tg) { 
  tg.ready(); 
  tg.expand();
}

// ─── API Configuration ───────────────────────────────────────────────────────
const API_BASE = '';
let adminPassword = '';
let categories = [];
let products = [];
let currentCategoryId = null;
let currentProductId = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function showToast(msg, color) {
  let t = document.querySelector('.toast');
  if (!t) { 
    t = document.createElement('div'); 
    t.className = 'toast'; 
    document.body.appendChild(t); 
  }
  t.textContent = msg;
  t.style.background = color || '#27ae60';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('active');
    el.scrollTop = 0;
  }
}

// ─── Login ───────────────────────────────────────────────────────────────────
async function login() {
  const input = document.getElementById('admin-password');
  const password = input.value.trim();
  
  if (!password) {
    showToast('Введите пароль', '#e67e22');
    return;
  }
  
  adminPassword = password;
  
  // Проверяем пароль через загрузку данных
  const loaded = await fetchProducts();
  if (loaded) {
    showAdminMain();
  } else {
    showToast('Неверный пароль', '#e74c3c');
    adminPassword = '';
  }
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const activeScreen = document.querySelector('.screen.active');
    if (activeScreen && activeScreen.id === 'screen-login') {
      login();
    }
  }
});

// ─── Load Products ───────────────────────────────────────────────────────────
async function fetchProducts() {
  try {
    const response = await fetch(`${API_BASE}/api/products`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.success) {
      categories = data.categories;
      products = data.products;
      return true;
    }
    throw new Error(data.error || 'Failed to load products');
  } catch (error) {
    console.error('Error fetching products:', error);
    showToast('Ошибка загрузки товаров', '#e74c3c');
    return false;
  }
}

// ─── Admin Main ──────────────────────────────────────────────────────────────
function showAdminMain() {
  const grid = document.getElementById('admin-categories');
  grid.innerHTML = '';
  
  categories.forEach(cat => {
    const count = products.filter(p => p.categoryId === cat.id && !p.parentId).length;
    const card = document.createElement('div');
    card.className = 'cat-card';
    card.innerHTML = `
      <div class="cat-icon">${cat.icon}</div>
      <div class="cat-name">${cat.name}</div>
      <div class="cat-count">${count} товаров</div>
    `;
    card.onclick = () => showAdminCategory(cat.id);
    grid.appendChild(card);
  });
  
  showScreen('screen-admin-main');
}

// ─── Admin Category ──────────────────────────────────────────────────────────
function showAdminCategory(catId) {
  currentCategoryId = catId;
  const cat = categories.find(c => c.id === catId);
  document.getElementById('admin-category-title').textContent = `${cat.icon} ${cat.name}`;

  const list = document.getElementById('admin-products-list');
  list.innerHTML = '';

  products
    .filter(p => p.categoryId === catId && !p.parentId)
    .forEach(p => {
      const card = document.createElement('div');
      card.className = 'product-card';
      
      const thumb = document.createElement('div');
      thumb.className = 'product-thumb';
      thumb.textContent = p.icon || '📦';
      
      const info = document.createElement('div');
      info.className = 'product-info';
      info.innerHTML = `
        <div class="product-name">${p.name}</div>
        <div class="product-desc">${getFlavorCount(p)}</div>
      `;
      
      const arrow = document.createElement('span');
      arrow.className = 'product-arrow';
      arrow.textContent = '›';
      
      card.appendChild(thumb);
      card.appendChild(info);
      card.appendChild(arrow);
      card.onclick = () => {
        if (p.isParent) {
          showAdminSubProducts(p.id);
        } else {
          showAdminFlavors(p.id);
        }
      };
      list.appendChild(card);
    });

  showScreen('screen-admin-products');
}

function getFlavorCount(p) {
  if (p.isParent) return 'Несколько линеек';
  if (p.flavors && p.flavors.length) {
    const enabled = p.flavors.filter(f => 
      typeof f === 'string' || f.enabled === undefined || f.enabled === true
    ).length;
    const total = p.flavors.length;
    return `${enabled} / ${total} вкусов активно`;
  }
  if (p.options && p.options.length) {
    const enabled = p.options.filter(o =>
      typeof o === 'string' || o.enabled === undefined || o.enabled === true
    ).length;
    const total = p.options.length;
    return `${enabled} / ${total} вариантов активно`;
  }
  return '';
}

// ─── Admin Sub-Products ──────────────────────────────────────────────────────
function showAdminSubProducts(parentId) {
  const parent = products.find(p => p.id === parentId);
  if (!parent) return;
  
  currentProductId = parentId;
  document.getElementById('admin-product-title').textContent = parent.name;
  
  const content = document.getElementById('admin-flavors-content');
  content.innerHTML = '';
  
  const list = document.createElement('div');
  list.className = 'products-list';
  
  (parent.subProducts || [])
    .map(id => products.find(p => p.id === id))
    .filter(Boolean)
    .forEach(p => {
      const card = document.createElement('div');
      card.className = 'product-card';
      
      const thumb = document.createElement('div');
      thumb.className = 'product-thumb';
      thumb.textContent = p.icon || '📦';
      
      const info = document.createElement('div');
      info.className = 'product-info';
      info.innerHTML = `
        <div class="product-name">${p.name}</div>
        <div class="product-desc">${getFlavorCount(p)}</div>
      `;
      
      const arrow = document.createElement('span');
      arrow.className = 'product-arrow';
      arrow.textContent = '›';
      
      card.appendChild(thumb);
      card.appendChild(info);
      card.appendChild(arrow);
      card.onclick = () => showAdminFlavors(p.id);
      list.appendChild(card);
    });
  
  content.appendChild(list);
  showScreen('screen-admin-flavors');
}

// ─── Admin Flavors ───────────────────────────────────────────────────────────
function showAdminFlavors(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;
  
  currentProductId = productId;
  document.getElementById('admin-product-title').textContent = product.name;
  
  const content = document.getElementById('admin-flavors-content');
  content.innerHTML = '';

  // ── Options (например картриджи 0.4/0.6/0.8 Ом) ──
  if (product.options && product.options.length > 0) {
    const title = document.createElement('div');
    title.className = 'flavors-title';
    title.textContent = 'Нажмите на вариант чтобы вкл/выкл:';
    title.style.padding = '20px';
    content.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'flavors-grid';
    grid.style.padding = '0 20px 20px 20px';

    product.options.forEach((option, index) => {
      const optionName = typeof option === 'string' ? option : option.name;
      const isEnabled = typeof option === 'string' ? true : (option.enabled === undefined || option.enabled === true);

      const chip = document.createElement('div');
      chip.className = 'flavor-chip';
      if (isEnabled) chip.classList.add('selected');
      chip.textContent = `${isEnabled ? '✅' : '❌'} ${optionName}`;
      chip.onclick = () => toggleOptionAdmin(productId, index, !isEnabled);
      grid.appendChild(chip);
    });

    content.appendChild(grid);
    showScreen('screen-admin-flavors');
    return;
  }

  // ── Flavors ──
  if (!product.flavors || product.flavors.length === 0) {
    content.innerHTML = '<div style="padding: 20px; text-align: center;">У этого товара нет вкусов</div>';
    showScreen('screen-admin-flavors');
    return;
  }
  
  const title = document.createElement('div');
  title.className = 'flavors-title';
  title.textContent = 'Нажмите на вкус чтобы вкл/выкл:';
  title.style.padding = '20px';
  content.appendChild(title);
  
  const grid = document.createElement('div');
  grid.className = 'flavors-grid';
  grid.style.padding = '0 20px 20px 20px';
  
  product.flavors.forEach((flavor, index) => {
    const flavorName = typeof flavor === 'string' ? flavor : flavor.name;
    const isEnabled = typeof flavor === 'string' ? true : (flavor.enabled === undefined || flavor.enabled === true);
    
    const chip = document.createElement('div');
    chip.className = 'flavor-chip';
    if (isEnabled) chip.classList.add('selected');
    chip.textContent = `${isEnabled ? '✅' : '❌'} ${flavorName}`;
    chip.onclick = () => toggleFlavorAdmin(productId, index, !isEnabled);
    grid.appendChild(chip);
  });
  
  content.appendChild(grid);
  showScreen('screen-admin-flavors');
}

// ─── Toggle Option ───────────────────────────────────────────────────────────
async function toggleOptionAdmin(productId, optionIndex, enabled) {
  try {
    const response = await fetch(`${API_BASE}/api/admin/update-product`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, optionIndex, enabled, adminPassword })
    });
    const data = await response.json();
    if (data.success) {
      showToast(`✅ ${enabled ? 'Включено' : 'Выключено'}`);
      await fetchProducts();
      showAdminFlavors(productId);
    } else {
      showToast(`❌ ${data.error}`, '#e74c3c');
      if (data.error.includes('пароль')) showScreen('screen-login');
    }
  } catch (error) {
    console.error('Toggle option error:', error);
    showToast('❌ Ошибка обновления', '#e74c3c');
  }
}

// ─── Toggle Flavor ───────────────────────────────────────────────────────────
async function toggleFlavorAdmin(productId, flavorIndex, enabled) {
  try {
    const response = await fetch(`${API_BASE}/api/admin/update-product`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        productId, 
        flavorIndex, 
        enabled,
        adminPassword 
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast(`✅ ${enabled ? 'Включено' : 'Выключено'}`);
      // Обновляем локальные данные
      await fetchProducts();
      // Перерисовываем экран
      showAdminFlavors(productId);
    } else {
      showToast(`❌ ${data.error}`, '#e74c3c');
      if (data.error.includes('пароль')) {
        // Неверный пароль - возвращаемся на логин
        showScreen('screen-login');
      }
    }
  } catch (error) {
    console.error('Toggle error:', error);
    showToast('❌ Ошибка обновления', '#e74c3c');
  }
}

// ─── Navigation ──────────────────────────────────────────────────────────────
function goBackAdmin() {
  const product = products.find(p => p.id === currentProductId);
  if (product && product.parentId) {
    // Это дочерний товар - возвращаемся к родителю
    showAdminSubProducts(product.parentId);
  } else {
    // Обычный товар - возвращаемся к категории
    showAdminCategory(currentCategoryId);
  }
}

// ─── Boot ────────────────────────────────────────────────────────────────────
showScreen('screen-login');
document.getElementById('admin-password').focus();
