export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const orderData = req.body;
    const BOT_TOKEN = process.env.BOT_TOKEN;
    const ADMIN_IDS = process.env.ADMIN_IDS
      ? process.env.ADMIN_IDS.split(',').map(id => id.trim())
      : (process.env.ADMIN_ID ? [process.env.ADMIN_ID.trim()] : []);

    if (!BOT_TOKEN) {
      return res.status(500).json({ ok: false, error: 'BOT_TOKEN not configured' });
    }

    let { orderId, username, userId, firstName, items, total, pickupPoint } = orderData;

    console.log('Order received:', JSON.stringify({ orderId, username, userId, firstName }));

    // Если есть userId но нет имени/username — пробуем достать через Bot API
    if (userId && (!username || !firstName)) {
      try {
        const chatResp = await fetch(
          `https://api.telegram.org/bot${BOT_TOKEN}/getChat?chat_id=${userId}`
        );
        const chatData = await chatResp.json();
        if (chatData.ok && chatData.result) {
          const u = chatData.result;
          if (!firstName) firstName = u.first_name || '';
          if (!username && u.username) username = u.username;
          console.log('Got user from getChat:', { firstName, username });
        }
      } catch (e) {
        console.error('getChat error:', e.message);
      }
    }

    const formatPrice = n => Number(n).toLocaleString('ru-RU') + ' ₽';

    // Формируем строку клиента
    let clientDisplay = firstName || 'Клиент';
    if (username) clientDisplay += ` (@${username})`;
    if (userId) clientDisplay += `\n📝 ID: \`${userId}\``;

    // Текст уведомления для админа
    let adminText = `📦 *Новый заказ!*\n\n`;
    (items || []).forEach((item, i) => {
      adminText += `${i + 1}. ${item.name}`;
      if (item.flavor) adminText += `\n   🎨 ${item.flavor}`;
      adminText += `\n   ${item.qty} × ${formatPrice(item.price)} = ${formatPrice(item.price * item.qty)}\n\n`;
    });
    adminText += `💰 *Итого: ${formatPrice(total)}*\n\n`;
    if (pickupPoint) adminText += `🏪 Точка самовывоза: ${pickupPoint}\n`;
    adminText += `👤 Клиент: ${clientDisplay}\n`;
    adminText += `🆔 Заказ: *#${orderId}*`;

    // Кнопки для админа
    const keyboard = {
      inline_keyboard: [
        [
          { text: '✅ Подтвердить', callback_data: `confirm_${orderId}` },
          { text: '❌ Отменить',    callback_data: `cancel_${orderId}` }
        ]
      ]
    };

    // Кнопка "Написать клиенту" — работает через режим ответа бота (без username)
    if (userId) {
      keyboard.inline_keyboard.push([
        { text: '💬 Написать клиенту', callback_data: `contact_${userId}` }
      ]);
    }

    const results = await Promise.all(
      ADMIN_IDS.map(adminId =>
        fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: adminId,
            text: adminText,
            parse_mode: 'Markdown',
            reply_markup: keyboard
          })
        }).then(r => r.json())
      )
    );

    console.log('Sent to admins:', results.map(r => ({ ok: r.ok, err: r.description })));

    return res.status(200).json({ ok: true, orderId });
  } catch (error) {
    console.error('Order handler error:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
}
