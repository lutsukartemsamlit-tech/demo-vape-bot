// Serverless функция для открытия чата
export default async function handler(req, res) {
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
    const { userId, username, firstName } = req.body;
    
    if (!userId) {
      return res.status(400).json({ ok: false, error: 'Missing userId' });
    }
    
    // Здесь нужна база данных для хранения чатов
    // Пока возвращаем success
    res.status(200).json({ 
      ok: true, 
      chat: { 
        userId, 
        username, 
        firstName,
        opened: new Date().toISOString()
      } 
    });
  } catch (error) {
    console.error('Chat open error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
}
