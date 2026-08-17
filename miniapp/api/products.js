// Загрузка данных из Redis (Upstash)
const { Redis } = require('@upstash/redis');
const { readFileSync } = require('fs');
const { join } = require('path');

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache');
  
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Подключаемся к Redis
    const redis = Redis.fromEnv();
    
    // Пробуем получить из Redis
    const cachedData = await redis.get('products');
    
    if (cachedData) {
      console.log('Products loaded from Redis');
      const data = typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData;
      
      return res.status(200).json({ 
        success: true, 
        products: data.products || [], 
        categories: data.categories || [],
        source: 'redis'
      });
    }
    
    // Если в Redis нет данных - читаем из файла и сохраняем в Redis
    console.log('Products not in Redis, loading from file');
    const filePath = join(process.cwd(), 'products.json');
    const fileContent = readFileSync(filePath, 'utf8');
    const productsData = JSON.parse(fileContent);
    
    // Сохраняем в Redis для следующих запросов
    await redis.set('products', JSON.stringify(productsData));
    
    const { products, categories } = productsData;
    
    res.status(200).json({ 
      success: true, 
      products: products, 
      categories: categories,
      source: 'file'
    });
  } catch (error) {
    console.error('Error loading products:', error);
    
    // Fallback - читаем из файла если Redis недоступен
    try {
      const filePath = join(process.cwd(), 'products.json');
      const fileContent = readFileSync(filePath, 'utf8');
      const productsData = JSON.parse(fileContent);
      
      res.status(200).json({ 
        success: true, 
        products: productsData.products, 
        categories: productsData.categories,
        source: 'file-fallback'
      });
    } catch (fallbackError) {
      res.status(500).json({ 
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
}
