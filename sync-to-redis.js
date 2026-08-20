// Скрипт для синхронизации products.js в Redis
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { Redis } = require('@upstash/redis');
const { products } = require('./data/products');

async function syncToRedis() {
  try {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      console.error('❌ Redis credentials not found in .env');
      console.log('UPSTASH_REDIS_REST_URL:', process.env.UPSTASH_REDIS_REST_URL ? 'set' : 'missing');
      console.log('UPSTASH_REDIS_REST_TOKEN:', process.env.UPSTASH_REDIS_REST_TOKEN ? 'set' : 'missing');
      process.exit(1);
    }
    
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    
    await redis.set('products', JSON.stringify(products));
    console.log('✅ Товары синхронизированы в Redis:', products.length, 'товаров');
    
    // Проверяем что сохранилось
    const saved = await redis.get('products');
    const savedProducts = typeof saved === 'string' ? JSON.parse(saved) : saved;
    console.log('✅ Проверка: в Redis сохранено', savedProducts.length, 'товаров');
    
    process.exit(0);
  } catch (e) {
    console.error('❌ Ошибка:', e);
    process.exit(1);
  }
}

syncToRedis();
