// API для синхронизации products.json с Redis при деплое
const { Redis } = require('@upstash/redis');
const { readFileSync } = require('fs');
const { join } = require('path');

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  try {
    // Подключаемся к Redis
    const redis = Redis.fromEnv();
    
    // Читаем products.json из файловой системы
    const filePath = join(process.cwd(), 'products.json');
    const fileContent = readFileSync(filePath, 'utf8');
    const productsData = JSON.parse(fileContent);
    
    // Сохраняем в Redis
    await redis.set('products', JSON.stringify(productsData));
    
    console.log('Products synced to Redis');
    
    res.status(200).json({ 
      success: true,
      message: 'Products synced to Redis',
      categories: productsData.categories?.length || 0,
      products: productsData.products?.length || 0
    });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message
    });
  }
}
