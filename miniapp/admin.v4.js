// ─── Telegram WebApp init ────────────────────────────────────────────────────
const tg = window.Telegram && window.Telegram.WebApp;
if (tg) { 
  tg.ready(); 
  tg.expand();
}

// ─── API Configuration ───────────────────────────────────────────────────────
const API_BASE = '';
let userId = null;
let categories = [];
let products = [];
let currentCategoryId = null;
let currentProductId = null;

// Получаем userId из Telegram
if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
  userId = `tg_${tg.initDataUnsafe.user.id}`;
  console.log('User ID:', userId);
  console.log('User Info:', tg.initDataUnsafe.user);
} else {
  console.log('No Telegram user data available');
}

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
  if (!userId) {
    showToast('Не удалось получить ID пользователя', '#e74c3c');
    const loginScreen = document.getElementById('screen-login');
    loginScreen.innerHTML = `
      <div class="screen-header">
        <h1>🔐 Админ-панель</h1>
      </div>
      <div class="screen-content">
        <div style="padding: 20px; text-align: center;">
          <div style="font-size: 48px; margin-bottom: 20px;">❌</div>
          <div style="font-size: 16px; font-weight: 600; margin-bottom: 10px; color: var(--accent);">
            Ошибка доступа
          </div>
          <div style="font-size: 13px; color: var(--text2); line-height: 1.6;">
            Не удалось получить ваш Telegram ID.<br>
            Убедитесь, что открываете приложение через Telegram.
          </div>
        </div>
      </div>
    `;
    return;
  }
  
  // Загружаем данные
  const loaded = await fetchProducts();
  if (loaded) {
    showAdminMain();
  } else {
    showToast('Ошибка загрузки данных', '#e74c3c');
    const loginScreen = document.getElementById('screen-login');
    loginScreen.innerHTML = `
      <div class="screen-header">
        <h1>🔐 Админ-панель</h1>
      </div>
      <div class="screen-content">
        <div style="padding: 20px; text-align: center;">
          <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
          <div style="font-size: 16px; font-weight: 600; margin-bottom: 10px; color: var(--accent2);">
            Ошибка загрузки
          </div>
          <div style="font-size: 13px; color: var(--text2); line-height: 1.6; margin-bottom: 16px;">
            Не удалось загрузить данные.<br>
            Проверьте подключение к интернету.
          </div>
          <button class="submit-btn" onclick="login()" style="margin-top: 12px;">
            Попробовать снова
          </button>
        </div>
      </div>
    `;
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
  if (p.colors && p.colors.length) {
    return `${p.colors.length} цветов`;
  }
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
  
  // Заголовок с эмодзи и названием
  const headerTitle = `${product.icon || '📦'} Управление вкусами: ${product.name}`;
  document.getElementById('admin-product-title').textContent = headerTitle;
  
  const content = document.getElementById('admin-flavors-content');
  content.innerHTML = '';

  // ── Options (например картриджи 0.4/0.6/0.8 Ом) ──
  if (product.options && product.options.length > 0) {
    const title = document.createElement('div');
    title.className = 'flavors-title';
    title.textContent = 'Нажмите на вариант чтобы включить/выключить его в магазине:';
    title.style.padding = '20px';
    title.style.fontSize = '14px';
    title.style.color = 'var(--text-secondary)';
    content.appendChild(title);

    const list = document.createElement('div');
    list.style.padding = '0 10px 20px 10px';

    product.options.forEach((option, index) => {
      const optionName = typeof option === 'string' ? option : option.name;
      const isEnabled = typeof option === 'string' ? true : (option.enabled === undefined || option.enabled === true);

      const item = document.createElement('div');
      item.style.cssText = `
        display: flex;
        align-items: center;
        padding: 12px 15px;
        margin-bottom: 8px;
        background: var(--bg-secondary);
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.2s;
      `;
      item.innerHTML = `
        <span style="font-size: 20px; margin-right: 12px;">${isEnabled ? '✅' : '❌'}</span>
        <span style="flex: 1; font-size: 15px;">${optionName}</span>
      `;
      item.onclick = () => toggleOptionAdmin(productId, index, !isEnabled);
      
      item.onmouseenter = () => item.style.opacity = '0.7';
      item.onmouseleave = () => item.style.opacity = '1';
      
      list.appendChild(item);
    });

    content.appendChild(list);
    showScreen('screen-admin-flavors');
    return;
  }

  // ── Colors ──
  if (product.colors && product.colors.length > 0) {
    const title = document.createElement('div');
    title.className = 'flavors-title';
    title.textContent = 'Доступные цвета:';
    title.style.padding = '20px';
    title.style.fontSize = '14px';
    title.style.color = 'var(--text-secondary)';
    content.appendChild(title);

    const list = document.createElement('div');
    list.style.padding = '0 10px 20px 10px';

    product.colors.forEach((color) => {
      const item = document.createElement('div');
      item.style.cssText = `
        display: flex;
        align-items: center;
        padding: 12px 15px;
        margin-bottom: 8px;
        background: var(--bg-secondary);
        border-radius: 12px;
      `;
      item.innerHTML = `
        <span style="font-size: 20px; margin-right: 12px;">✅</span>
        <span style="flex: 1; font-size: 15px;">${color}</span>
      `;
      list.appendChild(item);
    });

    content.appendChild(list);
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
  title.textContent = 'Нажмите на вкус чтобы включить/выключить его в магазине:';
  title.style.padding = '20px';
  title.style.fontSize = '14px';
  title.style.color = 'var(--text-secondary)';
  content.appendChild(title);
  
  const list = document.createElement('div');
  list.style.padding = '0 10px 20px 10px';
  
  product.flavors.forEach((flavor, index) => {
    const flavorName = typeof flavor === 'string' ? flavor : flavor.name;
    const isEnabled = typeof flavor === 'string' ? true : (flavor.enabled === undefined || flavor.enabled === true);
    
    const item = document.createElement('div');
    item.style.cssText = `
      display: flex;
      align-items: center;
      padding: 12px 15px;
      margin-bottom: 8px;
      background: var(--bg-secondary);
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s;
    `;
    item.innerHTML = `
      <span style="font-size: 20px; margin-right: 12px;">${isEnabled ? '✅' : '❌'}</span>
      <span style="flex: 1; font-size: 15px;">${flavorName}</span>
    `;
    item.onclick = () => toggleFlavorAdmin(productId, index, !isEnabled);
    
    item.onmouseenter = () => item.style.opacity = '0.7';
    item.onmouseleave = () => item.style.opacity = '1';
    
    list.appendChild(item);
  });
  
  content.appendChild(list);
  showScreen('screen-admin-flavors');
}

// ─── Toggle Option ───────────────────────────────────────────────────────────
async function toggleOptionAdmin(productId, optionIndex, enabled) {
  if (!userId) {
    showToast('❌ Не удалось получить ID пользователя', '#e74c3c');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/api/admin/update-product`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, optionIndex, enabled, userId })
    });
    const data = await response.json();
    if (data.success) {
      showToast(`${enabled ? '✅ Включено' : '❌ Выключено'}`);
      await fetchProducts();
      showAdminFlavors(productId);
    } else {
      showToast(`❌ ${data.error}`, '#e74c3c');
      console.error('Toggle error:', data);
      if (data.hint) {
        console.log('Hint:', data.hint);
      }
      if (data.error.includes('Доступ запрещен')) {
        // Показываем экран с информацией о недостаточных правах
        const content = document.getElementById('admin-flavors-content');
        content.innerHTML = `
          <div style="padding: 40px 20px; text-align: center;">
            <div style="font-size: 64px; margin-bottom: 16px;">🔒</div>
            <div style="font-size: 18px; font-weight: 600; margin-bottom: 12px; color: var(--accent);">
              Доступ запрещен
            </div>
            <div style="font-size: 14px; color: var(--text2); line-height: 1.6; margin-bottom: 16px;">
              У вас нет прав администратора для изменения вкусов.<br><br>
              Ваш ID: <strong style="color: var(--accent2);">${userId}</strong>
            </div>
            <div style="font-size: 12px; color: var(--text2); padding: 12px; background: var(--bg3); border-radius: 8px;">
              Обратитесь к администратору для получения доступа
            </div>
          </div>
        `;
      }
    }
  } catch (error) {
    console.error('Toggle option error:', error);
    showToast('❌ Ошибка обновления', '#e74c3c');
  }
}

// ─── Toggle Flavor ───────────────────────────────────────────────────────────
async function toggleFlavorAdmin(productId, flavorIndex, enabled) {
  if (!userId) {
    showToast('❌ Не удалось получить ID пользователя', '#e74c3c');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/api/admin/update-product`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        productId, 
        flavorIndex, 
        enabled,
        userId 
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast(`${enabled ? '✅ Включено' : '❌ Выключено'}`);
      // Обновляем локальные данные
      await fetchProducts();
      // Перерисовываем экран
      showAdminFlavors(productId);
    } else {
      showToast(`❌ ${data.error}`, '#e74c3c');
      console.error('Toggle error:', data);
      if (data.hint) {
        console.log('Hint:', data.hint);
      }
      if (data.error.includes('Доступ запрещен')) {
        // Показываем экран с информацией о недостаточных правах
        const content = document.getElementById('admin-flavors-content');
        content.innerHTML = `
          <div style="padding: 40px 20px; text-align: center;">
            <div style="font-size: 64px; margin-bottom: 16px;">🔒</div>
            <div style="font-size: 18px; font-weight: 600; margin-bottom: 12px; color: var(--accent);">
              Доступ запрещен
            </div>
            <div style="font-size: 14px; color: var(--text2); line-height: 1.6; margin-bottom: 16px;">
              У вас нет прав администратора для изменения вкусов.<br><br>
              Ваш ID: <strong style="color: var(--accent2);">${userId}</strong>
            </div>
            <div style="font-size: 12px; color: var(--text2); padding: 12px; background: var(--bg3); border-radius: 8px;">
              Обратитесь к администратору для получения доступа
            </div>
          </div>
        `;
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
// Автоматически входим если есть userId
if (userId) {
  login();
} else {
  showScreen('screen-login');
}

