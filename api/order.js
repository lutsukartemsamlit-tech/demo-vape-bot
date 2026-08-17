// Serverless функция для приема заказов
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
    const orderData = req.body;
    const BOT_TOKEN = process.env.BOT_TOKEN;
    const ADMIN_IDS = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',') : [];
    
    // Формируем текст заказа
    let orderText = `🛒 *Новый заказ #${orderData.orderId}*\n\n`;
    
    if (orderData.username) {
      orderText += `👤 Клиент: ${orderData.username}\n\n`;
    }
    
    orderText += `📦 *Товары:*\n`;
    orderData.items.forEach(item => {
      orderText += `• ${item.name}`;
      if (item.flavor) orderText += ` (${item.flavor})`;
      orderText += ` × ${item.qty} = ${item.price * item.qty} ₽\n`;
    });
    
    orderText += `\n💰 *Итого: ${orderData.total} ₽*`;
    orderText += `\n📅 ${new Date(orderData.date).toLocaleString('ru-RU')}`;
    
    // Отправляем админам
    const promises = ADMIN_IDS.map(adminId =>
      fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: adminId.trim(),
          text: orderText,
          parse_mode: 'Markdown'
        })
      })
    );
    
    await Promise.all(promises);
    
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Order error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
}
