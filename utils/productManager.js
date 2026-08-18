const fs = require('fs');
const path = require('path');

const PRODUCTS_FILE = path.join(__dirname, '../data/products.js');

/**
 * Читает текущий файл products.js и возвращает массивы категорий и товаров
 */
function readProductsFile() {
  try {
    const content = fs.readFileSync(PRODUCTS_FILE, 'utf8');
    
    // Извлекаем массив categories
    const categoriesMatch = content.match(/const categories = (\[[\s\S]*?\]);/);
    const categories = categoriesMatch ? eval(categoriesMatch[1]) : [];
    
    // Извлекаем массив products
    const productsMatch = content.match(/const products = (\[[\s\S]*?\]);[\s\S]*?module\.exports/);
    const products = productsMatch ? eval(productsMatch[1]) : [];
    
    return { categories, products };
  } catch (e) {
    console.error('Ошибка чтения products.js:', e);
    return { categories: [], products: [] };
  }
}

/**
 * Сохраняет массивы категорий и товаров обратно в products.js
 */
function saveProductsFile(categories, products) {
  try {
    const content = `// Категории товаров
const categories = ${JSON.stringify(categories, null, 2)};

// Товары
const products = ${JSON.stringify(products, null, 2)};

module.exports = { categories, products };
`;
    
    fs.writeFileSync(PRODUCTS_FILE, content, 'utf8');
    
    // Инвалидируем кеш require чтобы изменения подтянулись
    delete require.cache[require.resolve('../data/products.js')];
    
    return true;
  } catch (e) {
    console.error('Ошибка сохранения products.js:', e);
    return false;
  }
}

/**
 * Добавляет новый товар в массив products
 */
function addProduct(newProduct) {
  const { categories, products } = readProductsFile();
  
  // Генерируем уникальный ID если не передан
  if (!newProduct.id) {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    newProduct.id = `product_${timestamp}_${random}`;
  }
  
  // Проверяем что товар с таким ID не существует
  const exists = products.find(p => p.id === newProduct.id);
  if (exists) {
    return { success: false, error: 'Товар с таким ID уже существует' };
  }
  
  products.push(newProduct);
  
  const saved = saveProductsFile(categories, products);
  
  return saved 
    ? { success: true, product: newProduct }
    : { success: false, error: 'Не удалось сохранить файл' };
}

/**
 * Обновляет существующий товар
 */
function updateProduct(productId, updates) {
  const { categories, products } = readProductsFile();
  
  const index = products.findIndex(p => p.id === productId);
  if (index === -1) {
    return { success: false, error: 'Товар не найден' };
  }
  
  products[index] = { ...products[index], ...updates };
  
  const saved = saveProductsFile(categories, products);
  
  return saved
    ? { success: true, product: products[index] }
    : { success: false, error: 'Не удалось сохранить файл' };
}

/**
 * Удаляет товар по ID
 */
function deleteProduct(productId) {
  const { categories, products } = readProductsFile();
  
  const index = products.findIndex(p => p.id === productId);
  if (index === -1) {
    return { success: false, error: 'Товар не найден' };
  }
  
  const deleted = products.splice(index, 1)[0];
  
  const saved = saveProductsFile(categories, products);
  
  return saved
    ? { success: true, product: deleted }
    : { success: false, error: 'Не удалось сохранить файл' };
}

module.exports = {
  readProductsFile,
  saveProductsFile,
  addProduct,
  updateProduct,
  deleteProduct
};
