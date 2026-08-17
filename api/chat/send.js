// Serverless функция для отправки сообщения в чат
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
    const { userId, text } = req.body;
    
    if (!userId || !text) {
      return res.status(400).json({ ok: false, error: 'Missing parameters' });
    }
    
    const BOT_TOKEN = process.env.BOT_TOKEN;
    const ADMIN_IDS = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',') : [];
    
    // Отправляем сообщение админам через Telegram Bot API
    const promises = ADMIN_IDS.map(adminId => 
      fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: adminId.trim(),
          text: `💬 Сообщение из Mini App\n📝 User ID: ${userId}\n\n${text}`,
          parse_mode: 'Markdown'
        })
      })
    );
    
    await Promise.all(promises);
    
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Chat send error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
}
