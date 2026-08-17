// Serverless функция для получения истории сообщений
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ ok: false, error: 'Missing userId' });
    }
    
    // Здесь нужна база данных для хранения истории
    // Пока возвращаем пустой массив
    res.status(200).json({ 
      ok: true, 
      messages: [] 
    });
  } catch (error) {
    console.error('Chat messages error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
}
