// API для добавления нового товара (одноразка/под/жидкость/расходник)
const { Redis } = require('@upstash/redis');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const { name, description, price, categoryId, variantType, variants, icon } = req.body;

    if (!name || !price || !categoryId) {
      return res.status(400).json({ success: false, error: 'name, price, categoryId обязательны' });
    }

    const redis = Redis.fromEnv();
    const cachedData = await redis.get('products');
    if (!cachedData) {
      return res.status(404).json({ success: false, error: 'Products not found in Redis' });
    }

    let data = typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData;
    let products = Array.isArray(data) ? data : (data.products || []);
    const categories = Array.isArray(data) ? [] : (data.categories || []);

    // Генерируем уникальный ID на основе имени
    const baseId = name
      .toLowerCase()
      .replace(/[^a-zа-яё0-9\s]/gi, '')
      .trim()
      .replace(/\s+/g, '_')
      .substring(0, 20);
    // Если ID уже занят — добавляем timestamp
    const id = products.find(p => p.id === baseId)
      ? `${baseId}_${Date.now().toString(36)}`
      : baseId;

    // Строим массив вариантов
    const variantList = (variants || [])
      .map(v => v.trim())
      .filter(v => v.length > 0)
      .map(v => ({ name: v, enabled: true }));

    const newProduct = {
      id,
      categoryId,
      name: name.trim(),
      description: (description || '').trim(),
      price: Number(price),
      cashPrice: Number(price),
      stock: 50,
      icon: icon || (categoryId === 'disposable' ? '💨' : categoryId === 'liquids' ? '💧' : '📦'),
      location: 'Все точки',
      enabled: true,
    };

    // Добавляем поле вариантов в зависимости от типа
    if (variantType === 'colors' && variantList.length > 0) {
      newProduct.colors = variantList;
    } else if (variantType === 'flavors' && variantList.length > 0) {
      newProduct.flavors = variantList;
    }

    products.push(newProduct);

    const dataToSave = { products, categories };
    await redis.set('products', JSON.stringify(dataToSave));

    console.log(`✅ Добавлен товар: ${name} (${id}) в категорию ${categoryId}`);

    return res.status(200).json({
      success: true,
      product: newProduct,
      totalProducts: products.length
    });
  } catch (error) {
    console.error('Add product error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
