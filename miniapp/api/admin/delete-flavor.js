// API для удаления вкуса из товара
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
    const { productId, flavorIndex } = req.body;

    if (!productId || flavorIndex === undefined) {
      return res.status(400).json({ success: false, error: 'Invalid request' });
    }

    console.log(`Deleting flavor ${flavorIndex} from product ${productId}`);

    // Подключаемся к Redis
    const redis = Redis.fromEnv();

    // Получаем текущие товары
    const cachedData = await redis.get('products');
    if (!cachedData) {
      return res.status(404).json({ success: false, error: 'Products not found in Redis' });
    }

    let productsData;
    let products = [];
    
    // Redis может вернуть массив или объект {products: [...], categories: [...]}
    if (typeof cachedData === 'string') {
      const parsed = JSON.parse(cachedData);
      if (Array.isArray(parsed)) {
        products = parsed;
        productsData = { products, categories: [] };
      } else {
        productsData = parsed;
        products = parsed.products || [];
      }
    } else if (Array.isArray(cachedData)) {
      products = cachedData;
      productsData = { products, categories: [] };
    } else {
      productsData = cachedData;
      products = cachedData.products || [];
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

    // Проверяем что вкус существует
    if (!product.flavors || !product.flavors[flavorIndex]) {
      return res.status(404).json({ success: false, error: 'Flavor not found' });
    }

    // Удаляем вкус
    const deletedFlavor = product.flavors.splice(flavorIndex, 1)[0];
    const deletedFlavorName = typeof deletedFlavor === 'string' ? deletedFlavor : deletedFlavor.name;
    
    products[productIndex] = product;

    // Обновляем productsData
    if (productsData.products) {
      productsData.products = products;
    }

    // Сохраняем обратно в Redis в правильном формате
    const dataToSave = productsData.products ? productsData : {
      products: products,
      categories: [
        { id: "disposable", name: "Одноразки/подики", icon: "❤️‍🔥" },
        { id: "liquids", name: "Жидкости", icon: "💧" },
        { id: "accessories", name: "Расходники", icon: "📍" },
        { id: "energy", name: "Энергетики", icon: "🧃" }
      ]
    };
    
    await redis.set('products', JSON.stringify(dataToSave));

    console.log(`✅ Deleted flavor "${deletedFlavorName}" from product ${productId}`);

    return res.status(200).json({ 
      success: true, 
      deletedFlavor: deletedFlavorName,
      remainingCount: product.flavors.length
    });
  } catch (error) {
    console.error('Delete flavor error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
