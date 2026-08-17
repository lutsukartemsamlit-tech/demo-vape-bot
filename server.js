require('dotenv').config();
const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const PORT      = process.env.PORT || 3000;
const ROOT      = path.join(__dirname, 'miniapp');
const BOT_TOKEN = process.env.BOT_TOKEN;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
  '.svg':  'image/svg+xml'
};

// ─── Telegram photo proxy cache ───────────────────────────────────────────────
const photoCache = {};

function getTelegramFileUrl(fileId) {
  return new Promise((resolve, reject) => {
    if (photoCache[fileId]) return resolve(photoCache[fileId]);
    const apiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`;
    https.get(apiUrl, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.ok) {
            const url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${json.result.file_path}`;
            photoCache[fileId] = url;
            resolve(url);
          } else {
            reject(new Error(json.description));
          }
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function setCORSHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // Required for Telegram WebApp to load the page
  res.setHeader('X-Frame-Options', 'ALLOWALL');
  res.setHeader('Content-Security-Policy', "frame-ancestors *");
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

// ─── HTTP server ──────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];

  setCORSHeaders(res);

  // Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // ── GET /api/products ─────────────────────────────────────────────────────
  if (urlPath === '/api/products' && req.method === 'GET') {
    try {
      const pPath = require.resolve('./data/products');
      delete require.cache[pPath];
      const { products, categories } = require('./data/products');
      
      // Получаем публичный URL (туннель или localhost)
      const publicUrl = process.env.PUBLIC_URL || process.env.WEBAPP_URL || `http://localhost:${PORT}`;
      
      // Преобразуем Telegram file_id в proxy URL для изображений
      const productsWithProxyImages = products.map(p => {
        if (p.image && p.image.startsWith('AgAC')) {
          // Это Telegram file_id, создаем полный proxy URL
          return { ...p, image: `${publicUrl}/photo/${encodeURIComponent(p.image)}` };
        }
        return p;
      });
      
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' });
      res.end(JSON.stringify({ success: true, products: productsWithProxyImages, categories }));
    } catch(e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // ── Health check ──────────────────────────────────────────────────────────
  if (urlPath === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, ts: Date.now() }));
  }

  // ── POST /api/order  (fallback когда sendData недоступен) ─────────────────
  if (urlPath === '/api/order' && req.method === 'POST') {
    readBody(req)
      .then(async orderData => {
        // Сохраняем заказ в orders.json через наш модуль storage
        try {
          const { saveOrder } = require('./utils/storage');
          const order = {
            ...orderData,
            source: 'miniapp_api',
            status: 'pending',
            date: orderData.date || new Date().toISOString()
          };
          saveOrder(order);
          console.log(`📦 Заказ из Mini App (API): #${order.orderId}`);
        } catch (e) {
          console.error('Ошибка сохранения заказа:', e.message);
        }

        // Отправляем уведомление админам через Bot API
        try {
          const adminIds = process.env.ADMIN_IDS
            ? process.env.ADMIN_IDS.split(',').map(id => id.trim())
            : (process.env.ADMIN_ID ? [process.env.ADMIN_ID.trim()] : []);

          const { orderId, username, firstName, userId, items, total } = orderData;

          // Форматируем сообщение как в bot.js (web_app_data handler)
          const formatPrice = n => Number(n).toLocaleString('ru-RU') + ' ₽';

          let adminText = `📦 *Новый заказ!*\n\n`;
          (items || []).forEach((item, i) => {
            adminText += `${i + 1}. ${item.name}`;
            if (item.flavor) adminText += `\n   🎨 ${item.flavor}`;
            adminText += `\n   ${item.qty} × ${formatPrice(item.price)} = ${formatPrice(item.price * item.qty)}\n\n`;
          });
          adminText += `💰 *Итого: ${formatPrice(total)}*\n\n`;
          
          // Формируем информацию о клиенте
          if (firstName || username) {
            adminText += `👤 Клиент: ${firstName || 'Клиент'}`;
            if (username) {
              adminText += ` (@${username})`;
            }
            adminText += `\n`;
          }
          if (userId) {
            adminText += `📝 ID: \`${userId}\`\n`;
          }
          adminText += `🆔 Заказ: *#${orderId}*`;

          const inlineKeyboard = {
            inline_keyboard: [
              [
                { text: '✅ Подтвердить', callback_data: `confirm_${orderId}` },
                { text: '❌ Отменить',    callback_data: `cancel_${orderId}` }
              ]
            ]
          };
          
          // Добавляем кнопку связи с клиентом, если есть userId
          if (userId) {
            inlineKeyboard.inline_keyboard.push([
              { text: '💬 Написать клиенту', callback_data: `contact_${userId}` }
            ]);
          }

          const sendPromises = adminIds.map(adminId =>
            fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: adminId,
                text: adminText,
                parse_mode: 'Markdown',
                reply_markup: inlineKeyboard
              })
            })
            .then(r => r.json())
            .then(r => {
              if (!r.ok) console.error(`❌ Telegram sendMessage error для ${adminId}:`, r.description);
              else console.log(`✅ Уведомление о заказе #${orderId} отправлено админу ${adminId}`);
            })
            .catch(e => console.error(`❌ fetch error для ${adminId}:`, e.message))
          );

          await Promise.all(sendPromises);
        } catch (e) {
          console.error('Ошибка отправки уведомления в Telegram:', e.message);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      })
      .catch(() => {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Bad JSON' }));
      });
    return;
  }

  // ── POST /api/chat/send  (отправка сообщения) ────────────────────────────
  if (urlPath === '/api/chat/send' && req.method === 'POST') {
    readBody(req)
      .then(data => {
        const { userId, text } = data;
        if (!userId || !text) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ ok: false, error: 'Missing userId or text' }));
        }

        try {
          const chat = require('./utils/chat');
          const userChat = chat.getChat(userId);
          
          if (!userChat) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ ok: false, error: 'Chat not found' }));
          }

          // Сохраняем сообщение
          chat.addMessage(userId, true, text);
          
          // Отправляем админам через бота
          const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => id.trim()) : [];
          const TelegramBot = require('node-telegram-bot-api');
          const bot = new TelegramBot(process.env.BOT_TOKEN);
          
          adminIds.forEach(adminId => {
            bot.sendMessage(adminId,
              `💬 *${userChat.firstName}* (@${userChat.username || 'нет'})\n📱 Из Mini App\n📝 ID: \`${userId}\`\n\n${text}`,
              {
                parse_mode: 'Markdown',
                reply_markup: {
                  inline_keyboard: [[
                    { text: '✍️ Ответить', callback_data: `reply_${userId}` },
                    { text: '📜 История', callback_data: `history_${userId}` }
                  ]]
                }
              }
            ).catch(() => {});
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          console.error('Ошибка отправки сообщения:', e.message);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      })
      .catch(() => {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Bad JSON' }));
      });
    return;
  }

  // ── GET /api/chat/messages  (получение истории) ──────────────────────────
  if (urlPath.startsWith('/api/chat/messages') && req.method === 'GET') {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const userId = url.searchParams.get('userId');
      
      if (!userId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, error: 'Missing userId' }));
      }

      const chat = require('./utils/chat');
      const messages = chat.getMessages(parseInt(userId), 20);
      
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ ok: true, messages }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  // ── POST /api/chat/open  (открытие чата) ─────────────────────────────────
  if (urlPath === '/api/chat/open' && req.method === 'POST') {
    readBody(req)
      .then(data => {
        const { userId, username, firstName } = data;
        if (!userId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ ok: false, error: 'Missing userId' }));
        }

        try {
          const chat = require('./utils/chat');
          
          // Открываем или получаем существующий чат
          let userChat = chat.getChat(userId);
          if (!userChat) {
            userChat = chat.openChat(userId, userId, username, firstName);
            
            // Уведомляем админов
            const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => id.trim()) : [];
            const TelegramBot = require('node-telegram-bot-api');
            const bot = new TelegramBot(process.env.BOT_TOKEN);
            
            adminIds.forEach(adminId => {
              bot.sendMessage(adminId,
                `📩 *${firstName || 'Пользователь'}* (@${username || 'нет'}) открыл чат из Mini App\n📝 ID: \`${userId}\``,
                {
                  parse_mode: 'Markdown',
                  reply_markup: {
                    inline_keyboard: [[
                      { text: '✍️ Ответить', callback_data: `reply_${userId}` }
                    ]]
                  }
                }
              ).catch(() => {});
            });
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, chat: userChat }));
        } catch (e) {
          console.error('Ошибка открытия чата:', e.message);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      })
      .catch(() => {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Bad JSON' }));
      });
    return;
  }

  // ── Telegram photo proxy: /photo/<file_id> ────────────────────────────────
  if (urlPath.startsWith('/photo/')) {
    if (!BOT_TOKEN) {
      res.writeHead(500);
      return res.end('No BOT_TOKEN');
    }
    const fileId = decodeURIComponent(urlPath.slice(7));
    getTelegramFileUrl(fileId)
      .then(fileUrl => {
        https.get(fileUrl, tgRes => {
          res.writeHead(200, {
            'Content-Type': tgRes.headers['content-type'] || 'image/jpeg',
            'Cache-Control': 'public, max-age=86400',
            'Access-Control-Allow-Origin': '*'
          });
          tgRes.pipe(res);
        }).on('error', () => { res.writeHead(502); res.end(); });
      })
      .catch(err => {
        console.error('Photo proxy error:', err.message);
        res.writeHead(404);
        res.end();
      });
    return;
  }

  // ── Static files ──────────────────────────────────────────────────────────
  let filePath = urlPath === '/' ? '/index.html' : urlPath;
  filePath = path.join(ROOT, filePath);

  // Защита от path traversal
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not found');
    }
    const ext = path.extname(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'X-Frame-Options': 'ALLOWALL',
      'Content-Security-Policy': 'frame-ancestors *',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('🌐 Mini App сервер запущен: http://localhost:' + PORT);
  console.log('');
  console.log('📡 Чтобы открыть Mini App из Telegram, нужен публичный HTTPS-адрес.');
  console.log('   Запустите в отдельном окне:');
  console.log('');
  console.log('   node start_tunnel.js');
  console.log('   — или —');
  console.log('   npx cloudflared tunnel --url http://localhost:' + PORT);
  console.log('');
  console.log('   Скопируйте полученный https://... адрес в .env → WEBAPP_URL=');
  console.log('   и перезапустите бот (node bot.js)');
  console.log('');
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Порт ${PORT} уже занят. Измените PORT= в .env`);
  } else {
    console.error('❌ Ошибка сервера:', err.message);
  }
  process.exit(1);
});
