// API для обновления товаров (админка Mini App)
const { Redis } = require('@upstash/redis');

// Белый список ID для доступа к админке
const ADMIN_WHITELIST = [
  'tg_8277531129',
  'tg_8304388891',
  'tg_1211246636',
  // Добавляйте сюда ID других пользователей
];

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { productId, flavorIndex, optionIndex, colorIndex, productEnabled, enabled, userId } = req.body;
    
    console.log('Admin request from user:', userId);
    
    // Проверка прав администратора
    if (!userId || !ADMIN_WHITELIST.includes(userId)) {
      console.log('Access denied for user:', userId);
      return res.status(403).json({ 
        success: false, 
        error: 'Доступ запрещен',
        userId: userId,
        hint: `Добавьте ваш ID в ADMIN_WHITELIST: '${userId}'`
      });
    }
    
    // Подключаемся к Redis
    const redis = Redis.fromEnv();
    
    // Получаем текущие данные из Redis
    const cachedData = await redis.get('products');
    
    if (!cachedData) {
      return res.status(404).json({ 
        success: false, 
        error: 'Данные не найдены в Redis. Сначала загрузите товары.' 
      });
    }
    
    const productsData = typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData;
    
    // Находим продукт
    const product = productsData.products.find(p => p.id === productId);
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        error: 'Товар не найден' 
      });
    }

    // Включаем/выключаем весь товар целиком
    if (productEnabled !== undefined) {
      product.enabled = productEnabled;
      // Также обновляем родительский продукт если есть
      if (product.parentId) {
        const parent = productsData.products.find(p => p.id === product.parentId);
        if (parent) {
          const allSubs = (parent.subProducts || []).map(id => productsData.products.find(p => p.id === id)).filter(Boolean);
          const anyEnabled = allSubs.some(s => s.enabled !== false);
          parent.enabled = anyEnabled;
        }
      }
    }
    // Обновляем colors (цвета)
    else if (colorIndex !== undefined) {
      if (!product.colors || product.colors[colorIndex] === undefined) {
        return res.status(404).json({ success: false, error: 'Цвет не найден' });
      }
      const color = product.colors[colorIndex];
      if (typeof color === 'object') {
        color.enabled = enabled;
      } else {
        product.colors[colorIndex] = { name: color, enabled: enabled };
      }
    }
    // Обновляем options (варианты — 0.4/0.6/0.8 Ом)
    else if (optionIndex !== undefined) {
      if (!product.options || product.options[optionIndex] === undefined) {
        return res.status(404).json({ success: false, error: 'Вариант не найден' });
      }
      const option = product.options[optionIndex];
      if (typeof option === 'object') {
        option.enabled = enabled;
      } else {
        product.options[optionIndex] = { name: option, enabled: enabled };
      }
    }
    // Обновляем flavors (вкусы)
    else {
      if (!product.flavors || !product.flavors[flavorIndex]) {
        return res.status(404).json({ success: false, error: 'Вкус не найден' });
      }
      const flavor = product.flavors[flavorIndex];
      if (typeof flavor === 'object') {
        flavor.enabled = enabled;
      } else {
        product.flavors[flavorIndex] = { name: flavor, stock: '', enabled: enabled };
      }
    }
    
    // Сохраняем обратно в Redis
    await redis.set('products', JSON.stringify(productsData));
    
    console.log('Product updated by user:', userId);
    
    res.status(200).json({ 
      success: true,
      message: 'Товар обновлен',
      product: product
    });
    
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message
    });
  }
}
