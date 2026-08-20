// API для добавления вкусов к товару
const { Redis } = require('@upstash/redis');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { productId, flavors } = req.body;

    if (!productId || !flavors || !Array.isArray(flavors) || flavors.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid request' });
    }

    console.log(`Adding ${flavors.length} flavors to product ${productId}`);

    // Подключаемся к Redis
    const redis = Redis.fromEnv();

    // Получаем текущие товары
    const cachedData = await redis.get('products');
    if (!cachedData) {
      return res.status(404).json({ success: false, error: 'Products not found in Redis' });
    }

    let products = [];
    
    // Redis может вернуть массив или объект {products: [...], categories: [...]}
    if (typeof cachedData === 'string') {
      const parsed = JSON.parse(cachedData);
      products = Array.isArray(parsed) ? parsed : (parsed.products || []);
    } else if (Array.isArray(cachedData)) {
      products = cachedData;
    } else if (cachedData.products) {
      products = cachedData.products;
    }

    if (products.length === 0) {
      return res.status(404).json({ success: false, error: 'No products found' });
    }

    // Находим товар
    const productIndex = products.findIndex(p => p.id === productId);
    if (productIndex === -1) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const product = products[productIndex];

    // Добавляем новые вкусы
    const currentFlavors = product.flavors || [];
    const newFlavorObjects = flavors.map(name => ({
      name: name.trim(),
      stock: '',
      enabled: true
    }));

    product.flavors = [...currentFlavors, ...newFlavorObjects];
    products[productIndex] = product;

    // Сохраняем обратно в Redis в правильном формате
    // ВАЖНО: сохраняем объект {products, categories}, а не просто массив
    const dataToSave = {
      products: products,
      categories: [
        { id: "disposable", name: "Одноразки/подики", icon: "❤️‍🔥" },
        { id: "liquids", name: "Жидкости", icon: "💧" },
        { id: "accessories", name: "Расходники", icon: "📍" },
        { id: "energy", name: "Энергетики", icon: "🧃" }
      ]
    };
    
    await redis.set('products', JSON.stringify(dataToSave));

    console.log(`✅ Added ${flavors.length} flavors to product ${productId}`);

    return res.status(200).json({ 
      success: true, 
      product,
      addedCount: flavors.length,
      totalCount: product.flavors.length
    });
  } catch (error) {
    console.error('Add flavors error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
