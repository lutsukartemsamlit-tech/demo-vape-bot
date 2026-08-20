// Serverless webhook handler для Vercel
const TelegramBot = require('node-telegram-bot-api');

// Создаем бота без polling
const bot = new TelegramBot(process.env.BOT_TOKEN);

// Импортируем обработчики из bot.js
// НО src/bot.js создает свой экземпляр с polling, что конфликтует
// Поэтому временно возвращаем простой ответ

module.exports = async (req, res) => {
  if (req.method === 'POST') {
    try {
      const { message } = req.body;
      
      if (message && message.text === '/start') {
        const chatId = message.chat.id;
        const firstName = message.from.first_name || 'Друг';
        
        await bot.sendMessage(
          chatId,
          `Привет, ${firstName}! 👋\n\nДобро пожаловать в Demo_bot! 🏪\n\nБот в процессе настройки...`,
          {
            reply_markup: {
              inline_keyboard: [[
                { text: '🛍️ Открыть каталог', web_app: { url: process.env.WEBAPP_URL || 'https://demo-vape-miniapp.vercel.app' } }
              ]]
            }
          }
        );
      }
      
      res.status(200).json({ ok: true });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(200).json({ ok: true });
    }
  } else {
    res.status(200).json({ status: 'Bot webhook is active' });
  }
};
