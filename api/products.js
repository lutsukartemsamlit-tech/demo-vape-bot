// Serverless функция для получения товаров
export default async function handler(req, res) {
  // Устанавливаем CORS headers
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
    // Динамический импорт для CommonJS модуля
    const productsModule = await import('../../data/products.js');
    const { products, categories } = productsModule;
    
    // Преобразуем Telegram file_id в API пути
    const productsWithImages = products.map(p => {
      if (p.image && p.image.startsWith('AgAC')) {
        return { ...p, image: `/api/photo/${encodeURIComponent(p.image)}` };
      }
      return p;
    });
    
    res.status(200).json({ 
      success: true, 
      products: productsWithImages, 
      categories 
    });
  } catch (error) {
    console.error('Error loading products:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
