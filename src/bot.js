require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
// ������������� IPv4 (IPv6 ����� �� �������� � ��������� �����������)
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
const TelegramBot = require('node-telegram-bot-api');
const { saveOrder, getOrders, clearOrders } = require('../utils/storage');
const { formatPrice, generateOrderId } = require('../utils/helpers');
const { getReviews, saveReview, deleteReview, getStats, hasRecentReview } = require('../utils/reviews');
const { addProduct } = require('../utils/productManager');

// Redis client ��� �������� �������
let redis = null;
let products = [];
let categories = [];

// ������������� Redis � �������� �������
async function loadProductsFromRedis() {
  try {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      const { Redis } = require('@upstash/redis');
      redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
      
      const cachedData = await redis.get('products');
      
      if (cachedData) {
        const parsedData = typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData;
        
        // Redis ������ ������ ������ products, categories ����� �� �����
        if (Array.isArray(parsedData)) {
          products = parsedData;
          console.log('? ������ ��������� �� Redis:', products.length);
        } else {
          console.log('?? �������� ������ ������ � Redis, ��������� �� �����');
          const fileData = require('../data/products');
          products = fileData.products;
          categories = fileData.categories;
        }
      } else {
        console.log('?? ��� ������ � Redis, ��������� �� �����');
        const fileData = require('../data/products');
        products = fileData.products;
        categories = fileData.categories;
        // ��������� � Redis
        await redis.set('products', JSON.stringify(products));
      }
    } else {
      console.log('?? Redis �� ��������, ��������� �� �����');
      const fileData = require('../data/products');
      products = fileData.products;
      categories = fileData.categories;
    }
  } catch (e) {
    console.error('? ������ �������� �� Redis:', e);
    const fileData = require('../data/products');
    products = fileData.products;
    categories = fileData.categories;
  }
  
  // ��������� categories �� ����� ���� ��� �� ���������
  if (categories.length === 0) {
    const fileData = require('../data/products');
    categories = fileData.categories;
  }
}

const token = process.env.BOT_TOKEN;
const adminId = process.env.ADMIN_ID;
const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => id.trim()) : [adminId];
const WEBAPP_URL = process.env.WEBAPP_URL || ''; // URL ������ Mini App
const REQUIRED_CHANNEL = process.env.REQUIRED_CHANNEL || ''; // Username ��� ID ������ ��� ������������ ��������

// �������� �������� ������������ �� �����
// ���������� true ���� �������� (��� ����� �� ����� / ������������ � �����)
async function isSubscribed(userId) {
  if (!REQUIRED_CHANNEL) return true;
  if (isAdmin(userId)) return true;
  try {
    const member = await bot.getChatMember(
      REQUIRED_CHANNEL.startsWith('-') ? Number(REQUIRED_CHANNEL) : `@${REQUIRED_CHANNEL}`,
      userId
    );
    return ['member', 'administrator', 'creator'].includes(member.status);
  } catch (e) {
    console.error('������ �������� ��������:', e.message);
    // ��� ������ (����� ����������) � ���������� ��������
    return true;
  }
}

// ���������� ��������� � ����������� ��������
function sendSubscribeMessage(chatId) {
  const channelLink = REQUIRED_CHANNEL.startsWith('-')
    ? `https://t.me/c/${REQUIRED_CHANNEL.slice(4)}`
    : `https://t.me/${REQUIRED_CHANNEL}`;

  bot.sendMessage(chatId,
    `?? ��� ������������� ���� ���������� ����������� �� ��� �����!\n\n` +
    `����� �������� ������� ������ ���� ??`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔋 Под-система (с цветами)', callback_data: 'device_type_pod' }],
              [{ text: '💨 Одноразка (с вкусами)', callback_data: 'device_type_disposable' }]
            ]
          }
        }
      );
      return;
    }

    if (state.step === 'device_variants') {
      const variants = text.split('\n').map(v => v.trim()).filter(v => v.length > 0);
      
      if (variants.length === 0) {
        bot.sendMessage(chatId, '? ������� ���� �� ���� �������');
        return;
      }

      // ���������� ���� ��� ���������
      if (state.variantType === 'colors') {
        state.data.colors = variants.map(name => ({ name, enabled: true }));
      } else {
        state.data.flavors = variants.map(name => ({ name, stock: '', enabled: true }));
      }

      // ���������� ID
      const baseId = state.data.name.toLowerCase()
        .replace(/[^a-z�-��0-9\s]/gi, '')
        .trim()
        .replace(/\s+/g, '_')
        .substring(0, 20);
      state.data.id = products.find(p => p.id === baseId)
        ? `${baseId}_${Date.now().toString(36)}`
        : baseId;
      
      state.data.stock = 50;
      state.data.location = '��� �����';
      state.data.enabled = true;

      // ��������� � ������
      products.push(state.data);

      // ��������� � Redis
      if (redis) {
        try {
          const dataToSave = { products, categories };
          await redis.set('products', JSON.stringify(dataToSave));
          console.log('? ���������� ��������� � Redis:', state.data.name);
        } catch (e) {
          console.error('? ������ ���������� � Redis:', e);
        }
      }

      // ��������� � ����
      try {
        const fs = require('fs');
        const path = require('path');
        const contentJs = '// ��������� �������\nconst categories = ' + JSON.stringify(categories, null, 2) + ';\n\n// ������\nconst products = ' + JSON.stringify(products, null, 2) + ';\n\nmodule.exports = { products, categories };\n';
        fs.writeFileSync(path.join(__dirname, '..', 'data', 'products.js'), contentJs, 'utf8');
      } catch (e) {
        console.error('? ������ ���������� � ����:', e);
      }

      const summary = 
        `? *���������� ���������!*\n\n` +
        `?? ��������: ${state.data.name}\n` +
        `?? ����: ${formatPrice(state.data.price)}\n` +
        `${state.variantType === 'colors' ? '??' : '??'} ���������: ${variants.length}\n` +
        `?? ID: \`${state.data.id}\``;

      delete addProductState[userId];

      bot.sendMessage(chatId, summary, {
        parse_mode: 'Markdown',
        ...adminMenuObj
      });
      return;
    }

    // ���������� ������ � ������������ ��������
    if (state.step === 'add_flavors') {
      // ������������� ������ �� Redis ����� �������� ���������� ������
      await loadProductsFromRedis();
      
      const product = products.find(p => p.id === state.productId);
      if (!product) {
        bot.sendMessage(chatId, '? ����� �� ������', adminMenuObj);
        delete addProductState[userId];
        return;
      }
      
      const newFlavors = text.split(',').map(f => f.trim()).filter(f => f.length > 0);
      
      if (newFlavors.length === 0) {
        bot.sendMessage(chatId, '? ������� ���� �� ���� ����');
        return;
      }
      
      // ��������� ����� ����� � ������������
      const currentFlavors = product.flavors || [];
      const updatedFlavors = [
        ...currentFlavors,
        ...newFlavors.map(name => ({ name, stock: '', enabled: true }))
      ];
      
      // ��������� ����� � ���������� �������
      const productIndex = products.findIndex(p => p.id === state.productId);
      if (productIndex !== -1) {
        products[productIndex].flavors = updatedFlavors;
      }
      
      // ��������� � Redis
      if (redis) {
        try {
          await redis.set('products', JSON.stringify(products));
          console.log('? ������ ��������� � Redis');
        } catch (e) {
          console.error('? ������ ���������� � Redis:', e);
        }
      }
      
      // ����� ��������� ����� productManager (��� fallback � ����)
      const { updateProduct } = require('../utils/productManager');
      updateProduct(state.productId, { flavors: updatedFlavors });
      
      delete addProductState[userId];
      
      bot.sendMessage(chatId,
        `? *����� ���������!*\n\n` +
        `?? ��������: ${state.productName}\n` +
        `?? ��������� ������: ${newFlavors.length}\n` +
        `?? ����� ������: ${updatedFlavors.length}`,
        {
          parse_mode: 'Markdown',
          ...adminMenuObj
        }
      );
      return;
    }

    if (state.step === 'device_name') {
      state.data.name = text;
      state.step = 'device_price';
      bot.sendMessage(chatId, 'Введите цену (например: 2500)');
      return;
    }

    if (state.step === 'device_price') {
      const price = parseInt(text);
      if (isNaN(price) || price <= 0) {
        bot.sendMessage(chatId, 'Неверная цена');
        return;
      }
      state.data.price = price;
      state.data.cashPrice = price;
      state.step = 'device_desc';
      bot.sendMessage(chatId, 'Введите описание:');
      return;
    }

    if (state.step === 'device_desc') {
      state.data.description = text;
      state.step = 'device_type';
      bot.sendMessage(chatId, 'Выберите тип:', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔋 Под', callback_data: 'device_type_pod' }],
            [{ text: '💨 Одноразка', callback_data: 'device_type_disposable' }]
          ]
        }
      });
      return;
    }

    if (state.step === 'name') {
      state.data.name = text;
      state.step = 'price';
      bot.sendMessage(chatId, 
        `? ��������: *${text}*\n\n` +
        `������ ������� ���� � ������ (��������: 450)`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    if (state.step === 'price') {
      const price = parseInt(text);
      if (isNaN(price) || price <= 0) {
        bot.sendMessage(chatId, '? �������� ������ ����. ������� ����� (��������: 450)');
        return;
      }
      state.data.price = price;
      state.data.cashPrice = price;
      state.step = 'description';
      bot.sendMessage(chatId,
        `? ����: ${formatPrice(price)}\n\n` +
        `������� �������� (��������: "������� ������� ��������\\n�������: 80��\\n�����: 30��")`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    if (state.step === 'description') {
      state.data.description = text;
      state.step = 'flavors';
      bot.sendMessage(chatId,
        `? �������� ���������\n\n` +
        `������ ������� ����� ����� ������� (��������: "����� ���, �����, ��������")`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    if (state.step === 'flavors') {
      const flavors = text.split(',').map(f => f.trim()).filter(f => f.length > 0);
      
      if (flavors.length === 0) {
        bot.sendMessage(chatId, '? ������� ���� �� ���� ����');
        return;
      }

      state.data.flavors = flavors.map(name => ({ name, stock: '', enabled: true }));
      state.step = 'image';

      bot.sendMessage(chatId,
        `? ��������� ������: ${flavors.length}\n\n` +
        `������ ��������� ���� ������ ��� ������� "����������"`,
        {
          reply_markup: {
            inline_keyboard: [[
              { text: '?? ���������� ����', callback_data: 'skip_product_image' }
            ]]
          }
        }
      );
      return;
    }
  }

  // ���� ����� � ������ ������ � ���������� ��� ��������� ������������
  if (isAdmin(userId) && chat.isAdminInReplyMode(userId)) {
    const targetUserId = chat.getAdminReplyTarget(userId);
    const targetChat = chat.getChat(targetUserId);
    if (targetChat) {
      const targetUserMainMenu = buildMainMenu(WEBAPP_URL, targetUserId);
      
      bot.sendMessage(targetChat.chatId,
        `????? *��������:*\n${text}`,
        {
          parse_mode: 'Markdown',
          reply_markup: targetUserMainMenu.reply_markup
        }
      ).catch(() => {});
      
      // ��������� � �������
      chat.addMessage(targetUserId, false, text);
      
      const adminMenuForSender = buildAdminMenu(WEBAPP_URL, userId);
      bot.sendMessage(chatId, `? ��������� ���������� ������������ ${targetChat.firstName}`,
        {
          reply_markup: adminMenuForSender.reply_markup
        }
      );
    }
    chat.clearAdminReplyMode(userId);
    return;
  }

  // ���� ������������ � ������ ��������� � ���������� ��� ��������� ���� �������
  if (chat.isChatOpen(userId) && !isAdmin(userId)) {
    const userChat = chat.getChat(userId);
    
    // ��������� � �������
    chat.addMessage(userId, true, text);
    
    adminIds.forEach(adminId => {
      bot.sendMessage(adminId,
        `?? *${userChat.firstName}* (@${userChat.username || '���'})\n?? ID: \`${userId}\`\n\n${text}`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '?? ��������', callback_data: `reply_${userId}` },
              { text: '?? �������', callback_data: `history_${userId}` }
            ]]
          }
        }
      ).catch(() => {});
    });
    bot.sendMessage(chatId, '? ��������� ���������� ���������');
    return;
  }

  // ���� ������������ ������ ����� ������
  if (reviewState[userId] && reviewState[userId].step === 'text') {
    const state = reviewState[userId];
    const firstName = msg.from.first_name || '����������';

    // ��������� ����� � ��������� � ���� ����
    reviewState[userId].text = text.slice(0, 500);
    reviewState[userId].step = 'photo';

    bot.sendMessage(chatId,
      `?? ������ ���������� ���� � ������?\n\n��������� �������� ��� ������� ������������`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '?? ����������', callback_data: 'review_skip_photo' },
            { text: '? ������',     callback_data: 'review_cancel' }
          ]]
        }
      }
    );
    return;
  }

  switch (text) {
    case '?? �����������':
      showAssortment(chatId);
      break;
    case '?? �������':
      showCart(chatId);
      break;
    case '?? ���������':
      showManagers(chatId);
      break;
    case '? ������':
      showReviews(chatId, userId);
      break;
    case '?? �����-������':
      if (isAdmin(userId)) {
        showAdminPanel(chatId);
      }
      break;
  }
});

// �������� ����������� (��� ������ �������)
function showAssortment(chatId, messageId = null) {
  const keyboard = {
    inline_keyboard: [
      [{ text: '????? ���������/������', callback_data: 'cat_disposable' }],
      [{ text: '?? ��������', callback_data: 'cat_liquids' }],
      [{ text: '?? ����������', callback_data: 'cat_accessories' }],
      [{ text: '?? ����������', callback_data: 'cat_energy' }]
    ]
  };

  if (messageId) {
    bot.editMessageText('?? *�������� ���������:*', {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    }).catch(() => {
      // ���� ���� ���� � ������� � ���������� �����
      bot.deleteMessage(chatId, messageId).catch(() => {});
      bot.sendMessage(chatId, '?? *�������� ���������:*', {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    });
  } else {
    bot.sendMessage(chatId, '?? *�������� ���������:*', {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }
}

// �������� ������ ��������� (������� ������ ������)
function showCategoryProducts(chatId, categoryId, messageId = null) {
  const category = categories.find(c => c.id === categoryId);
  const categoryProducts = products.filter(p => p.categoryId === categoryId);

  if (categoryProducts.length === 0) {
    const keyboard = [[{ text: '� � ����������', callback_data: 'back_categories' }]];
    
    if (messageId) {
      bot.editMessageText('???>? � ���� ��������� ���� ��� �������', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: keyboard }
      }).catch(() => {
        bot.deleteMessage(chatId, messageId).catch(() => {});
        bot.sendMessage(chatId, '???>? � ���� ��������� ���� ��� �������', {
          reply_markup: { inline_keyboard: keyboard }
        });
      });
    } else {
      bot.sendMessage(chatId, '???>? � ���� ��������� ���� ��� �������', {
        reply_markup: { inline_keyboard: keyboard }
      });
    }
    return;
  }

  const keyboard = [];
  
  // ���������� ������ ������ ��� parentId (�� ��������)
  categoryProducts.filter(p => !p.parentId).forEach(product => {
    keyboard.push([{ 
      text: `${product.name} - ${formatPrice(product.price)}`.toUpperCase(), 
      callback_data: `view_${product.id}` 
    }]);
  });
  
  keyboard.push([{ text: '� � ����������', callback_data: 'back_categories' }]);

  const text = `*������ ��������� ${category.name}:*`;

  if (messageId) {
    // ������� editMessageText (���� ���� ��������� ���������)
    bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard }
    }).catch(() => {
      // ���� ���� ���� � ������� � ���������� �����
      bot.deleteMessage(chatId, messageId).catch(() => {});
      bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    });
  } else {
    bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard }
    });
  }
}

// �������� ��������� �������� ������
function showProductDetail(chatId, productId, messageId = null) {
  const product = products.find(p => p.id === productId);
  
  if (!product) {
    bot.answerCallbackQuery(chatId, { text: '? ����� �� ������' });
    return;
  }

  // ���� ��� ������������ ����� � ���������� ������ �������� ������
  if (product.isParent && product.subProducts) {
    const subItems = product.subProducts.map(id => products.find(p => p.id === id)).filter(Boolean);
    
    const keyboard = [];
    subItems.forEach(sub => {
      keyboard.push([{ text: sub.name, callback_data: `view_${sub.id}` }]);
    });
    keyboard.push([
      { text: '?? �����', callback_data: `cat_${product.categoryId}` }
    ]);

    const caption = `*${product.name.toUpperCase()}*\n\n�������� �������:`;
    
    // ��������� ��� image ��� file_id, � �� URL
    const isTelegramFileId = product.image && !product.image.startsWith('http');

    if (isTelegramFileId && messageId) {
      bot.editMessageMedia({
        type: 'photo',
        media: product.image,
        caption: caption,
        parse_mode: 'Markdown'
      }, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: keyboard }
      }).catch(() => {
        bot.deleteMessage(chatId, messageId).catch(() => {});
        bot.sendPhoto(chatId, product.image, {
          caption: caption,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        });
      });
    } else if (isTelegramFileId) {
      bot.sendPhoto(chatId, product.image, {
        caption: caption,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    } else {
      // ��� ���� - ������ �����
      if (messageId) {
        bot.editMessageText(caption, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        }).catch(() => {
          bot.deleteMessage(chatId, messageId).catch(() => {});
          bot.sendMessage(chatId, caption, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard }
          });
        });
      } else {
        bot.sendMessage(chatId, caption, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        });
      }
    }
    return;
  }

  let caption = `*${product.name.toUpperCase()}*\n\n`;

  // ���� ���� ����� � �����������
  if (product.flavors && product.flavors.length > 0) {
    const enabledFlavors = product.flavors.filter(f => {
      if (typeof f === 'object') {
        // ���� enabled �� ��������� ��� true - �������
        return f.enabled === undefined || f.enabled === true;
      }
      return true;
    });

    enabledFlavors.forEach((flavor, index) => {
      const flavorText = typeof flavor === 'string' ? flavor : flavor.name;
      const flavorStock = typeof flavor === 'object' ? flavor.stock : '';
      
      caption += `? ${flavorText}${flavorStock ? ` � ${flavorStock}` : ''}\n`;
    });
  }
  // ���� ���� �����
  else if (product.colors && product.colors.length > 0) {
    const enabledColors = product.colors.filter(c =>
      typeof c === 'string' || c.enabled === undefined || c.enabled === true
    );
    enabledColors.forEach((color) => {
      const colorName = typeof color === 'object' ? color.name : color;
      caption += `? ${colorName}\n`;
    });
  }
  // ���� ���� �����
  else if (product.options && product.options.length > 0) {
    product.options.forEach((option) => {
      const optionData = typeof option === 'object' ? option : { name: option, enabled: true };
      const isEnabled = optionData.enabled === undefined || optionData.enabled === true;
      if (isEnabled) {
        const name = typeof option === 'object' ? option.name : option;
        caption += `? ${name}\n`;
      }
    });
  }

  caption += `\n`;
  
  // ����
  const price = product.cashPrice || product.price;
  
  caption += `����: ${formatPrice(price)}`;

  const keyboard = [];

  // ������ �������� � �������
  keyboard.push([{ 
    text: '?? �������� � �������', 
    callback_data: `add_${product.id}` 
  }]);

  keyboard.push([
    { text: '?? �����', callback_data: product.parentId ? `view_${product.parentId}` : `cat_${product.categoryId}` }
  ]);

  // ���� ���� ����������� - ����������/����������� ����
  // �����: Telegram bot API ����� �������� ������ � file_id, �� � �������� URL
  // ������� ��������� ��� image ��� file_id (���������� � ����), � �� URL
  const isTelegramFileId = product.image && !product.image.startsWith('http');
  
  if (isTelegramFileId) {
    if (messageId) {
      // �������� ������������� ������������ ��������� � ����
      bot.editMessageMedia({
        type: 'photo',
        media: product.image,
        caption: caption,
        parse_mode: 'Markdown'
      }, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: keyboard }
      }).catch((err) => {
        // ���� �� ���������� ��������������� (���� ��������� ���������) - ������� � ���������� �����
        bot.deleteMessage(chatId, messageId).catch(() => {});
        bot.sendPhoto(chatId, product.image, {
          caption: caption,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        });
      });
    } else {
      // ���������� ����� ����
      bot.sendPhoto(chatId, product.image, {
        caption: caption,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      }).catch((err) => {
        // ���� �� ������� ��������� ���� - ���������� �����
        bot.sendMessage(chatId, caption, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        });
      });
    }
  } else {
    // ��� ����
    if (messageId) {
      // ������� editMessageText (���� ���� ��������� ���������)
      bot.editMessageText(caption, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      }).catch(() => {
        // ���� ���� � ���������� ����� ���������, ����� ������� ������
        bot.sendMessage(chatId, caption, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        }).then(() => {
          bot.deleteMessage(chatId, messageId).catch(() => {});
        }).catch(() => {});
      });
    } else {
      bot.sendMessage(chatId, caption, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    }
  }
}

// �������� �������
function showCart(chatId) {
  const cart = userCarts[chatId] || [];

  if (cart.length === 0) {
    bot.sendMessage(chatId, '?? ���� ������� �����', {
      reply_markup: {
        inline_keyboard: [[{ text: '?? ������� � �������', callback_data: 'categories' }]]
      }
    });
    return;
  }

  let total = 0;
  let message = '?? *���� �������:*\n\n';

  cart.forEach((item, index) => {
    const product = products.find(p => p.id === item.productId);
    if (!product) return;
    
    const itemTotal = product.price * item.quantity;
    total += itemTotal;

    message += `${index + 1}. ${product.icon} ${product.name}`;
    if (item.flavor) {
      message += `\n   ?? ${item.flavor}`;
    }
    message += `\n   ${item.quantity} ? ${formatPrice(product.price)} = ${formatPrice(itemTotal)}\n\n`;
  });

  message += `?? *�����: ${formatPrice(total)}*`;

  const keyboard = [
    [{ text: '? �������� �����', callback_data: 'checkout' }],
    [{ text: '?? �������� �������', callback_data: 'clear_cart' }],
    [{ text: '?? ���������� �������', callback_data: 'back_categories' }]
  ];

  bot.sendMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard }
  });
}

// �������� ����� � ������� (��� �����)
function addToCart(queryId, chatId, productId) {
  if (!userCarts[chatId]) {
    userCarts[chatId] = [];
  }

  const product = products.find(p => p.id === productId);
  if (!product || product.stock === 0) {
    bot.answerCallbackQuery(queryId, { text: '? ����� ����������' });
    return;
  }

  const existingItem = userCarts[chatId].find(item => item.productId === productId && !item.flavor);
  if (existingItem) {
    existingItem.quantity++;
  } else {
    userCarts[chatId].push({ productId, quantity: 1, flavor: null });
  }

  bot.answerCallbackQuery(queryId, { 
    text: `? ${product.name} �������� � �������!`,
    show_alert: false
  });
}

// �������� ���� ������ �����/�����/�����
function showFlavorSelection(chatId, productId, messageId, selectedFlavors = []) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  // ���������� ��� ��������� (flavors, colors, options)
  let variants = [];
  let variantType = '����';
  let variantIcon = '??';
  
  if (product.flavors) {
    // ��������� ������ enabled �����
    const enabledFlavors = product.flavors.filter(f => {
      if (typeof f === 'object') return f.enabled === undefined || f.enabled === true;
      return true;
    });
    variants = enabledFlavors.map(f => typeof f === 'object' ? f.name : f);
    variantType = '����';
    variantIcon = '??';
  } else if (product.colors) {
    const enabledColors = product.colors.filter(c =>
      typeof c === 'string' || c.enabled === undefined || c.enabled === true
    );
    variants = enabledColors.map(c => typeof c === 'object' ? c.name : c);
    variantType = '����';
    variantIcon = '??';
  } else if (product.options) {
    const enabledOptions = product.options.filter(o => {
      if (typeof o === 'object') return o.enabled === undefined || o.enabled === true;
      return true;
    });
    variants = enabledOptions.map(o => typeof o === 'object' ? o.name : o);
    variantType = '�������';
    variantIcon = '??';
  }

  const keyboard = [];

  variants.forEach((variant, index) => {
    const isSelected = selectedFlavors.includes(index);
    keyboard.push([{
      text: `${isSelected ? '? ' : ''}${variant}`,
      callback_data: `flavorpick_${product.id}_${index}`
    }]);
  });

  // ������ �����������
  const hasSelection = selectedFlavors.length > 0;
  keyboard.push([{
    text: hasSelection ? `?? ����������� (${selectedFlavors.length} ��.)` : '?? �����������',
    callback_data: `flavorconfirm_${product.id}`
  }]);
  keyboard.push([{ text: '? ������', callback_data: `view_${product.id}` }]);

  const selectedNames = selectedFlavors.map(i => variants[i]);

  let text = `${variantIcon} *�������� ${variantType} ��� ${product.name}:*\n\n`;
  if (selectedNames.length > 0) {
    text += `�������:\n${selectedNames.map(n => `? ${n}`).join('\n')}\n\n`;
  }
  text += `������� �� ${variantType} ����� �������/����� �����`;

  // ������� ������� editMessageText (���� ���� ��������� ���������)
  // ���� �� ����� (���� ����) � ������� � ���������� �����
  bot.editMessageText(text, {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard }
  }).catch(() => {
    // editMessageText �� ��������� � ������ ���� ����, ���������� ����� ���������
    bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard }
    }).then(newMsg => {
      // ������� ������ ����-��������� ����� �������� ������
      bot.deleteMessage(chatId, messageId).catch(() => {});
    }).catch(err => {
      console.error('showFlavorSelection sendMessage error:', err.message);
    });
  });
}

// ����� ����������
const PICKUP_POINTS = [
  { id: 'metro_pobedy', name: '?? ����� ������', address: '����� ������' }
];

// �������� ����� ����� ����������
function showPickupSelection(chatId, messageId) {
  const keyboard = [];

  PICKUP_POINTS.forEach(point => {
    keyboard.push([{
      text: `${point.name}`,
      callback_data: `pickup_${point.id}`
    }]);
  });

  keyboard.push([{ text: '? ������', callback_data: 'show_cart' }]);

  const text = `?? *�������� ����� ����������:*\n\n?? *����� ������*`;

  bot.editMessageText(text, {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard }
  }).catch(() => {
    bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard }
    });
  });
}

// ���������� ������
function checkout(chatId, userId, username, firstName, pickupPoint) {
  const cart = userCarts[chatId] || [];

  if (cart.length === 0) {
    bot.sendMessage(chatId, '? ������� �����');
    return;
  }

  // ������� ��� ������������� Markdown ����. ��������
  function escapeMarkdown(text) {
    if (!text) return '';
    return String(text).replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
  }

  let total = 0;
  let orderDetails = '?? *����� �����!*\n\n';

  cart.forEach((item, index) => {
    const product = products.find(p => p.id === item.productId);
    const itemTotal = product.price * item.quantity;
    total += itemTotal;

    orderDetails += `${index + 1}\\. ${escapeMarkdown(product.name)}`;
    if (item.flavor) {
      orderDetails += `\n   ?? ${escapeMarkdown(item.flavor)}`;
    }
    orderDetails += `\n   ${item.quantity} ? ${formatPrice(product.price)} = ${formatPrice(itemTotal)}\n\n`;
  });

  orderDetails += `?? *�����: ${formatPrice(total)}*`;

  const orderId = generateOrderId();
  const order = {
    id: orderId,
    userId,
    username: username || '�� ������',
    firstName: firstName || '������',
    chatId,
    items: cart,
    total,
    date: new Date().toISOString(),
    status: 'pending'
  };

  saveOrder(order);

  // ����������� ������� (���� ���������� HTML ��� ���������)
  const clientOrderText = `? ������� �� �����!\n\n` +
    `����� ������: <b>#${orderId}</b>\n\n` +
    `?? <b>����� �����!</b>\n\n` +
    cart.map((item, index) => {
      const product = products.find(p => p.id === item.productId);
      const itemTotal = product.price * item.quantity;
      let itemText = `${index + 1}. ${product.name}`;
      if (item.flavor) {
        itemText += `\n   ?? ${item.flavor}`;
      }
      itemText += `\n   ${item.quantity} ? ${formatPrice(product.price)} = ${formatPrice(itemTotal)}`;
      return itemText;
    }).join('\n\n') + '\n\n' +
    `?? <b>�����: ${formatPrice(total)}</b>\n\n` +
    `?? <b>����� ����������:</b> ${pickupPoint}\n\n` +
    `?? ������ ��� ��������� ���������, ��� ������ ��������� ������������� � ����������\n\n` +
    `��� �������� ����� �������� � ����!`;

  bot.sendMessage(
    chatId,
    clientOrderText,
    { parse_mode: 'HTML' }
  );

  // ����������� ���� ���������������
  // ��������� ���������� � ������� (��� ������������� - ����� ������������ HTML)
  let clientInfo = `?? ������: ${firstName || '������'}`;
  if (username) {
    clientInfo += ` (@${username})`;
  }
  clientInfo += `\n?? ID: ${userId}`;
  
  // ��������� ������� - ���������� HTML ������ Markdown ��� ���������
  const adminMessage = `?? <b>����� �����!</b>\n\n` +
    cart.map((item, index) => {
      const product = products.find(p => p.id === item.productId);
      const itemTotal = product.price * item.quantity;
      let itemText = `${index + 1}. ${product.name}`;
      if (item.flavor) {
        itemText += `\n   ?? ${item.flavor}`;
      }
      itemText += `\n   ${item.quantity} ? ${formatPrice(product.price)} = ${formatPrice(itemTotal)}`;
      return itemText;
    }).join('\n\n') + '\n\n' +
    `?? <b>�����: ${formatPrice(total)}</b>\n\n` +
    `${clientInfo}\n` +
    `?? ����� ����������: ${pickupPoint}\n` +
    `?? �����: #${orderId}`;

  // ������� �������� � retry ��� ������� ������
  async function sendToAdmin(adminId, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await bot.sendMessage(
          adminId,
          adminMessage,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '? �����������', callback_data: `confirm_${orderId}` },
                  { text: '? ��������', callback_data: `cancel_${orderId}` }
                ],
                [
                  { text: '?? ��������� �����', callback_data: `complete_${orderId}` }
                ],
                [
                  { text: '?? �������� �������', callback_data: `contact_${userId}` }
                ]
              ]
            }
          }
        );
        console.log(`? ����� ${orderId} ��������� ������ ${adminId} (������� ${attempt})`);
        return true;
      } catch (err) {
        console.error(`? �� ������� ��������� ����� ${orderId} ������ ${adminId} (������� ${attempt}/${retries}):`, err.message);
        if (attempt < retries) {
          // ��� ����� ��������� �������� (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
    return false;
  }

  // ���������� ���� ������� ����������� � retry
  Promise.all(adminIds.map(id => sendToAdmin(id)))
    .then(results => {
      const successCount = results.filter(r => r).length;
      console.log(`?? ����� ${orderId}: ���������� ${successCount}/${adminIds.length} �������`);
    })
    .catch(err => console.error('? ������ ��� �������� ������ �������:', err));

  // �������� �������
  userCarts[chatId] = [];
}

// �������� ���������� � ��������
function showAbout(chatId) {
  bot.sendMessage(
    chatId,
    `?? *PuffNow_63*\n\n` +
    `�� ����������:\n` +
    `?? ������������ ���������\n` +
    `?? ������� �������� �� �����\n` +
    `?? ������ ��� ���������\n` +
    `? �������� ��������\n` +
    `?? ������������ �����������\n` +
    `?? ������ ���������� ��������\n\n` +
    `?? �������: ������� ������ ��� ��������!`,
    { parse_mode: 'Markdown' }
  );
}

// �������� ������� ������������
function showProfile(chatId, userId, user) {
  const orders = getOrders().filter(o => o.userId === userId);
  const totalOrders = orders.length;
  const completedOrders = orders.filter(o => o.status === 'confirmed').length;
  
  let totalSpent = 0;
  orders.filter(o => o.status === 'confirmed').forEach(order => {
    totalSpent += order.total;
  });

  const username = user.username ? `@${user.username}` : '�� ������';
  const firstName = user.first_name || '������������';

  bot.sendMessage(
    chatId,
    `?? *��� �������*\n\n` +
    `���: ${firstName}\n` +
    `Username: ${username}\n` +
    `ID: \`${userId}\`\n\n` +
    `?? *����������:*\n` +
    `����� �������: ${totalOrders}\n` +
    `���������: ${completedOrders}\n` +
    `���������: ${formatPrice(totalSpent)}\n\n` +
    `?? ���� �������: /cart`,
    { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '?? ��� ������', callback_data: 'my_orders' }],
          [{ text: '?? �������', callback_data: 'show_cart' }]
        ]
      }
    }
  );
}

// �������� ����������
function showManagers(chatId) {
  bot.sendMessage(
    chatId,
    `?? *���������*\n\n` +
    `�� ���� �������� ������ ������ ���������:\n\n` +
    `????? @PuffNow\\_63\n\n` +
    `����� ��� � ����?\n\n????? @neresu`,
    { parse_mode: 'Markdown' }
  );
}

// �������� ������
function buildReviewCaption(reviews, stats, page) {
  const total = reviews.length;
  const r = reviews[page];
  const stars = '?'.repeat(r.rating);
  const date = new Date(r.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const name = r.firstName || '����������';

  let text = `${stars} *${name}*\n`;
  text += `?? ${date}\n`;
  if (r.text) text += `\n?? _${r.text}_\n`;
  text += `\n??????????????????????\n`;
  text += `? *������ �����������* � ${'?'.repeat(Math.round(stats.avg))} *${stats.avg}* (${total})\n`;
  text += `_${page + 1} �� ${total}_`;
  return text;
}

function buildReviewPageKeyboard(reviews, page, hasPurchase) {
  const total = reviews.length;
  const navRow = [];
  if (page > 0)          navRow.push({ text: '??',  callback_data: `review_page_${page - 1}` });
  if (page < total - 1)  navRow.push({ text: '??',  callback_data: `review_page_${page + 1}` });

  const keyboard = { inline_keyboard: [] };
  if (navRow.length) keyboard.inline_keyboard.push(navRow);
  if (hasPurchase)   keyboard.inline_keyboard.push([{ text: '?? �������� �����', callback_data: 'review_start' }]);
  return keyboard;
}

// ��������� ���� �������� ������ (����� ���������� ��� ������� ������)
async function sendReviewPage(chatId, reviews, stats, page, hasPurchase, deleteMsgId = null) {
  const r = reviews[page];
  const text = buildReviewCaption(reviews, stats, page);
  const keyboard = buildReviewPageKeyboard(reviews, page, hasPurchase);

  if (deleteMsgId) {
    await bot.deleteMessage(chatId, deleteMsgId).catch(() => {});
  }

  if (r.photoFileId) {
    await bot.sendPhoto(chatId, r.photoFileId, {
      caption: text,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  } else {
    await bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }
}

function showReviews(chatId, userId) {
  const reviews = getReviews();
  const stats = getStats();
  const orders = getOrders();
  const hasPurchase = orders.some(o => o.userId === userId && o.status === 'confirmed');

  if (stats.count === 0) {
    let text = `? *������ �����������*\n\n���� ������� ���. ������ ������! ??`;
    if (!hasPurchase) text += `\n\n_�������� ����� ����� ������ ���������� � �������������� ��������._`;
    const keyboard = { inline_keyboard: hasPurchase ? [[{ text: '?? �������� �����', callback_data: 'review_start' }]] : [] };
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: keyboard });
    return;
  }

  sendReviewPage(chatId, reviews, stats, 0, hasPurchase);
}



// ������ ���� ������ (������ ������)
function askReviewRating(chatId, userId, orderId = null) {
  reviewState[userId] = { step: 'rating', orderId };

  const keyboard = {
    inline_keyboard: [[
      { text: '?',     callback_data: 'review_rate_1' },
      { text: '??',   callback_data: 'review_rate_2' },
      { text: '???', callback_data: 'review_rate_3' },
    ], [
      { text: '????',   callback_data: 'review_rate_4' },
      { text: '?????', callback_data: 'review_rate_5' },
    ], [
      { text: '? ������', callback_data: 'review_cancel' }
    ]]
  };

  bot.sendMessage(chatId,
    `?? *�������� �����*\n\n��������� ������ ������ ��������:`,
    { parse_mode: 'Markdown', reply_markup: keyboard }
  );
}



// ���������� ������� ��� ������
function showAdminStats(chatId, messageId = null) {
  const orders = getOrders();

  const total = orders.length;
  const pending   = orders.filter(o => o.status === 'pending').length;
  const confirmed = orders.filter(o => o.status === 'confirmed').length;
  const cancelled = orders.filter(o => o.status === 'cancelled').length;

  const totalRevenue = orders
    .filter(o => o.status === 'confirmed')
    .reduce((sum, o) => sum + (o.total || 0), 0);

  // ������ �� �������
  const today = new Date().toDateString();
  const todayOrders = orders.filter(o => new Date(o.date).toDateString() === today);
  const todayRevenue = todayOrders
    .filter(o => o.status === 'confirmed')
    .reduce((sum, o) => sum + (o.total || 0), 0);

  // ��������� 5 �������
  const recent = [...orders]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  let text = `?? *���������� �������*\n\n`;
  text += `?? ����� �������: *${total}*\n`;
  text += `? �������: *${pending}*\n`;
  text += `? ������������: *${confirmed}*\n`;
  text += `? ��������: *${cancelled}*\n\n`;
  text += `?? ������� (�����.): *${formatPrice(totalRevenue)}*\n`;
  text += `?? ������� �������: *${todayOrders.length}* �� *${formatPrice(todayRevenue)}*\n`;

  if (recent.length > 0) {
    text += `\n?? *��������� ������:*\n`;
    recent.forEach(o => {
      const statusIcon = o.status === 'confirmed' ? '?' : o.status === 'cancelled' ? '?' : '?';
      const date = new Date(o.date).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      text += `${statusIcon} #${o.id} � ${formatPrice(o.total)} � @${o.username || '���'} (${date})\n`;
    });
  }

  const keyboard = {
    inline_keyboard: [
      [{ text: '?? �������� ��� ������', callback_data: 'admin_stats_clear_confirm' }],
      [{ text: '?? �����', callback_data: 'admin_panel' }]
    ]
  };

  if (messageId) {
    bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    }).catch(() => {
      bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: keyboard });
    });
  } else {
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }
}

// ������ ��� ������
function showAdminReviews(chatId, messageId = null, page = 0) {
  const reviews = getReviews();
  const stats = getStats();
  const perPage = 5;
  const totalPages = Math.max(1, Math.ceil(reviews.length / perPage));
  const slice = reviews.slice(page * perPage, page * perPage + perPage);

  let text = `? *������ �����������*\n`;
  text += `�����: *${stats.count}* | ������� ������: *${stats.avg}*\n\n`;

  if (slice.length === 0) {
    text += '_������� ���� ���_';
  } else {
    slice.forEach((r, i) => {
      const stars = '?'.repeat(r.rating);
      const date = new Date(r.date).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      const name = r.username ? `@${r.username}` : (r.firstName || '����������');
      const photoMark = r.photoFileId ? ' ??' : '';
      text += `${page * perPage + i + 1}. ${stars} *${name}*${photoMark} � ${date}\n`;
      if (r.text) text += `   _${r.text}_\n`;
      text += `\n`;
    });
  }

  // ������ �������� + ��������� ���� ��� ������� ������ �� ��������
  const deleteButtons = slice.map((r, i) => {
    const row = [{ text: `?? ������� #${page * perPage + i + 1}`, callback_data: `review_delete_${r.id}` }];
    if (r.photoFileId) {
      row.unshift({ text: `?? ���� #${page * perPage + i + 1}`, callback_data: `review_photo_${r.id}` });
    }
    return row;
  });

  // ���������
  const navRow = [];
  if (page > 0)               navRow.push({ text: '??', callback_data: `admin_reviews_page_${page - 1}` });
  if (page < totalPages - 1)  navRow.push({ text: '??', callback_data: `admin_reviews_page_${page + 1}` });

  const keyboard = {
    inline_keyboard: [
      ...deleteButtons,
      ...(navRow.length ? [navRow] : []),
      [{ text: '?? �����', callback_data: 'admin_panel' }]
    ]
  };

  if (messageId) {
    bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    }).catch(() => {
      bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: keyboard });
    });
  } else {
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }
}

// �����-������
function showAdminPanel(chatId, messageId = null) {
  const keyboard = [
  if (categoryId === 'disposable') {
    keyboard.push([{ text: 'Add', callback_data: 'add_device_start' }]);
  }
    [{ text: '?? ���������� ��������', callback_data: 'admin_products' }],
    [{ text: '?? ���������� �������',  callback_data: 'admin_stats' }],
    [{ text: '? ������',              callback_data: 'admin_reviews' }],
    [{ text: '?? ������� ����',        callback_data: 'main_menu' }]
  ];

  const text = '?? *�����-������*\n\n�������� ��������:';

  if (messageId) {
    bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard }
    }).catch(() => {
      bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    });
  } else {
    bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard }
    });
  }
}

// ���������� �������� - ����� ���������
function showAdminProducts(chatId, messageId = null) {
  const keyboard = [
    [{ text: '?? ��������', callback_data: 'admin_cat_liquids' }],
    [{ text: '????? ���������/������', callback_data: 'admin_cat_disposable' }],
    [{ text: '?? ����������', callback_data: 'admin_cat_accessories' }],
    [{ text: '?? ����������', callback_data: 'admin_cat_energy' }],
    [{ text: '?? �����', callback_data: 'admin_panel' }]
  ];

  const text = '?? *���������� ��������*\n\n�������� ���������:';

  if (messageId) {
    bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard }
    });
  } else {
    bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard }
    });
  }
}

// ������ ������� ��������� ��� ������
function showAdminCategoryProducts(chatId, categoryId, messageId = null) {
  const category = categories.find(c => c.id === categoryId);
  const categoryProducts = products.filter(p => p.categoryId === categoryId);

  const keyboard = [];
  
  categoryProducts.forEach(product => {
    const stockIcon = product.enabled === false ? '?' : '?';
    keyboard.push([{ 
      text: `${stockIcon} ${product.name}`, 
      callback_data: `admin_product_${product.id}` 
    }]);
  });
  
  keyboard.push([{ text: '?? �����', callback_data: 'admin_products' }]);

  const text = `?? *${category.name}*\n\n�������� ����� ��� ����������:`;

  bot.editMessageText(text, {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard }
  });
}

// ���������� ���������� �������
function showAdminProductDetail(chatId, productId, messageId = null) {
  const product = products.find(p => p.id === productId);
  
  if (!product) return;

  let text = `?? *${product.name}*\n\n`;
  text += `?? ����: ${formatPrice(product.price)}\n\n`;

  // ���� ���� ����� - ���������� ��
  if (product.colors && product.colors.length > 0) {
    const enabledCount = product.colors.filter(c =>
      typeof c === 'string' || c.enabled === undefined || c.enabled === true
    ).length;
    const total = product.colors.length;
    text += `*����� (${enabledCount} / ${total} �������):*\n`;
    product.colors.slice(0, 8).forEach((color) => {
      const colorName = typeof color === 'object' ? color.name : color;
      const isEnabled = typeof color === 'object' ? (color.enabled === undefined || color.enabled === true) : true;
      text += `${isEnabled ? '?' : '?'} ${colorName}\n`;
    });
    if (product.colors.length > 8) {
      text += `... � ��� ${product.colors.length - 8}\n`;
    }
  }
  // ���� ���� ����� - ���������� �� ������
  else if (product.flavors && product.flavors.length > 0) {
    text += `*�����:*\n`;
    product.flavors.forEach((flavor, index) => {
      const flavorData = typeof flavor === 'object' ? flavor : { name: flavor, stock: '', enabled: true };
      const isEnabled = flavorData.enabled === undefined || flavorData.enabled === true;
      const status = isEnabled ? '?' : '?';
      text += `${status} ${flavorData.name}`;
      if (flavorData.stock) text += ` � ${flavorData.stock}`;
      text += `\n`;
    });
  }

  const keyboard = [];

  // ������ ���������� �������
  if (product.colors && product.colors.length > 0) {
    keyboard.push([{ text: '?? ���������� �������', callback_data: `admin_flavors_${product.id}` }]);
  }
  // ������ ���������� �������
  else if (product.flavors && product.flavors.length > 0) {
    keyboard.push([{ text: '?? ���������� �������', callback_data: `admin_flavors_${product.id}` }]);
  }

  // ������ ���������� ���������� (options � �������� 0.4/0.6/0.8 ��)
  if (product.options && product.options.length > 0) {
    keyboard.push([{ text: '?? ���������� ����������', callback_data: `admin_options_${product.id}` }]);
  }

  // ������ ���/���� ��� ������� ��� ������/������ (������� ������ � ����� enabled)
  if (!product.flavors && !product.colors && product.enabled !== undefined) {
    const isOn = product.enabled;
    keyboard.push([{
      text: isOn ? '?? ��������� �����' : '?? �������� �����',
      callback_data: `admin_producttoggle_${product.id}`
    }]);
  }

  keyboard.push([
    { text: '?? �����', callback_data: `admin_cat_${product.categoryId}` }
  ]);

  bot.editMessageText(text, {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard }
  });
}

// ���������� ������� ������
function showAdminFlavors(chatId, productId, messageId = null) {
  const product = products.find(p => p.id === productId);
  
  if (!product) return;

  // ��������� ������ � ������ � toggle (��� � ������)
  if (product.colors && product.colors.length > 0) {
    let text = `?? *���������� �������: ${product.name}*\n\n`;
    text += `������� �� ���� ����� ��������/��������� ��� � ��������:\n\n`;

    const keyboard = [];

    product.colors.forEach((color, index) => {
      const colorName = typeof color === 'object' ? color.name : color;
      const isEnabled = typeof color === 'object' ? (color.enabled === undefined || color.enabled === true) : true;
      const status = isEnabled ? '?' : '?';

      text += `${status} ${colorName}\n`;

      keyboard.push([{
        text: `${status} ${colorName}`,
        callback_data: `admin_colortoggle_${product.id}_${index}`
      }]);
    });

    keyboard.push([{ text: '?? �����', callback_data: `admin_product_${product.id}` }]);

    if (messageId) {
      bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      }).catch(() => {
        bot.deleteMessage(chatId, messageId).catch(() => {});
        bot.sendMessage(chatId, text, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        });
      });
    } else {
      bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    }
    return;
  }

  // ��������� ������
  if (!product.flavors) return;

  let text = `?? *���������� �������: ${product.name}*\n\n`;
  text += `������� �� ���� ����� ��������/��������� ��� � ��������:\n\n`;

  const keyboard = [];

  product.flavors.forEach((flavor, index) => {
    const flavorData = typeof flavor === 'object' ? flavor : { name: flavor, stock: '', enabled: true };
    // ���� enabled �� ��������� ��� true - ������� ����������
    const isEnabled = flavorData.enabled === undefined || flavorData.enabled === true;
    const status = isEnabled ? '?' : '?';
    const buttonText = `${status} ${flavorData.name}`;
    
    text += `${status} ${flavorData.name}`;
    if (flavorData.stock) text += ` � ${flavorData.stock}`;
    text += `\n`;

    // ������ ���/���� + ������ �������� �����
    keyboard.push([
      { 
        text: buttonText, 
        callback_data: `admin_toggle_${product.id}_${index}` 
      },
      {
        text: '???',
        callback_data: `admin_deleteflavor_${product.id}_${index}`
      }
    ]);
  });

  // ������ "��������� ���" ������ ��� ���������
  if (product.categoryId === 'liquids') {
    keyboard.push([{ text: '?? ��������� ���', callback_data: `admin_disableall_${product.id}` }]);
    keyboard.push([{ text: '? �������� �����', callback_data: `admin_addflavors_${product.id}` }]);
  }

  keyboard.push([{ text: '?? �����', callback_data: `admin_product_${product.id}` }]);

  if (messageId) {
    bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard }
    }).catch(() => {
      // editMessageText �� ��������� � ������� ������ � ���������� �����
      bot.deleteMessage(chatId, messageId).catch(() => {});
      bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    });
  } else {
    bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard }
    });
  }
}

// ���������� ���������� ������ (options � 0.4/0.6/0.8 �� � �.�.)
function showAdminOptions(chatId, productId, messageId = null) {
  const product = products.find(p => p.id === productId);
  if (!product || !product.options) return;

  let text = `?? *��������: ${product.name}*\n\n`;
  text += `������� �� ������� ����� ��������/��������� ��� � ��������:\n\n`;

  const keyboard = [];

  product.options.forEach((option, index) => {
    const optionData = typeof option === 'object' ? option : { name: option, enabled: true };
    const isEnabled = optionData.enabled === undefined || optionData.enabled === true;
    const status = isEnabled ? '?' : '?';
    const optionName = typeof option === 'object' ? option.name : option;

    text += `${status} ${optionName}\n`;

    keyboard.push([{
      text: `${status} ${optionName}`,
      callback_data: `admin_optiontoggle_${product.id}_${index}`
    }]);
  });

  keyboard.push([{ text: '?? �����', callback_data: `admin_product_${product.id}` }]);

  if (messageId) {
    bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard }
    }).catch(() => {
      bot.editMessageReplyMarkup({ inline_keyboard: keyboard }, {
        chat_id: chatId,
        message_id: messageId
      }).catch(() => {});
    });
  } else {
    bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard }
    });
  }
}

// ��������/��������� ����� ������� (��� ������� ������� ��� ������/������)
function toggleProduct(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return false;

  product.enabled = product.enabled === false ? true : false;

  try {
    const fs = require('fs');
    const path = require('path');
    const contentJs = '// ��������� �������\nconst categories = ' + JSON.stringify(categories, null, 2) + ';\n\n// ������\nconst products = ' + JSON.stringify(products, null, 2) + ';\n\nmodule.exports = { products, categories };\n';
    fs.writeFileSync(path.join(__dirname, '..', 'data', 'products.js'), contentJs, 'utf8');
    console.log(`? ����� ${productId} ������ ${product.enabled ? '�������' : '��������'}`);
  } catch(e) { console.error('Save error:', e.message); }

  return true;
}

// ��������� ��� ����� � ��������
function disableAllFlavors(productId) {
  const product = products.find(p => p.id === productId);
  if (!product || !product.flavors) return false;

  product.flavors.forEach((flavor, index) => {
    if (typeof flavor === 'object') {
      flavor.enabled = false;
    } else {
      product.flavors[index] = { name: flavor, stock: '', enabled: false };
    }
  });

  // ��������� � ����
  try {
    const fs = require('fs');
    const path = require('path');
    const contentJs = '// ��������� �������\nconst categories = ' + JSON.stringify(categories, null, 2) + ';\n\n// ������\nconst products = ' + JSON.stringify(products, null, 2) + ';\n\nmodule.exports = { products, categories };\n';
    fs.writeFileSync(path.join(__dirname, '..', 'data', 'products.js'), contentJs, 'utf8');
    console.log(`? ��� ����� ���������: ${productId}`);
  } catch(e) { console.error('Save products error:', e.message); }

  return true;
}

// ����������� ������� (���/����)
function toggleOption(productId, optionIndex) {
  const product = products.find(p => p.id === productId);
  if (!product || !product.options || isNaN(optionIndex) || product.options[optionIndex] === undefined) return false;

  const option = product.options[optionIndex];
  if (typeof option === 'object') {
    option.enabled = !(option.enabled === undefined || option.enabled === true);
  } else {
    // ������������ ������ � ������
    product.options[optionIndex] = {
      name: option,
      enabled: false // ������ ���� � ���������
    };
  }

  // ��������� � data/products.js
  try {
    const fs = require('fs');
    const path = require('path');
    const contentJs = '// ��������� �������\nconst categories = ' + JSON.stringify(categories, null, 2) + ';\n\n// ������\nconst products = ' + JSON.stringify(products, null, 2) + ';\n\nmodule.exports = { products, categories };\n';
    fs.writeFileSync(path.join(__dirname, '..', 'data', 'products.js'), contentJs, 'utf8');
    console.log(`? ���������: ${productId}, ������� ${optionIndex}`);
  } catch(e) { console.error('Save options error:', e.message); }

  return true;
}

// ����������� ���� (���/����)
function toggleFlavor(productId, flavorIndex) {
  const product = products.find(p => p.id === productId);
  
  if (!product || !product.flavors || isNaN(flavorIndex) || !product.flavors[flavorIndex]) return false;

  const flavor = product.flavors[flavorIndex];
  
  if (typeof flavor === 'object') {
    // ����������� enabled
    if (flavor.enabled === undefined || flavor.enabled === true) {
      flavor.enabled = false;
    } else {
      flavor.enabled = true;
    }
  } else {
    // ������������ ������ � ������
    product.flavors[flavorIndex] = {
      name: flavor,
      stock: '',
      enabled: false
    };
  }

  // ��������� � ���� data/products.js (������ ��� ����)
  try {
    const fs = require('fs');
    const path = require('path');
    
    const contentJs = '// ��������� �������\nconst categories = ' + JSON.stringify(categories, null, 2) + ';\n\n// ������\nconst products = ' + JSON.stringify(products, null, 2) + ';\n\nmodule.exports = { products, categories };\n';
    fs.writeFileSync(path.join(__dirname, '..', 'data', 'products.js'), contentJs, 'utf8');
    
    console.log(`? ��������� � ����: ${productId}, ���� ${flavorIndex}`);
  } catch(e) { console.error('Save products error:', e.message); }
  
  // �������������� � Redis � ���� (�� ���������)
  if (redis) {
    redis.set('products', JSON.stringify({ products, categories }))
      .then(() => console.log('? Redis ������� ����� toggle �����'))
      .catch(e => console.error('? ������ Redis ��� toggle:', e.message));
  }

  return true;
}

// ������� ���� � ���������������� � Redis
async function deleteFlavor(productId, flavorIndex) {
  const product = products.find(p => p.id === productId);
  if (!product || !product.flavors || isNaN(flavorIndex) || !product.flavors[flavorIndex]) {
    return { success: false, error: '���� �� ������' };
  }

  const deletedFlavor = product.flavors.splice(flavorIndex, 1)[0];
  const deletedFlavorName = typeof deletedFlavor === 'string' ? deletedFlavor : deletedFlavor.name;

  // ��������� � ���� data/products.js
  try {
    const fs = require('fs');
    const path = require('path');
    const contentJs = '// ��������� �������\nconst categories = ' + JSON.stringify(categories, null, 2) + ';\n\n// ������\nconst products = ' + JSON.stringify(products, null, 2) + ';\n\nmodule.exports = { products, categories };\n';
    fs.writeFileSync(path.join(__dirname, '..', 'data', 'products.js'), contentJs, 'utf8');
    console.log(`? ���� "${deletedFlavorName}" ����� �� �����`);
  } catch(e) { console.error('Save products error:', e.message); }

  // �������������� � Redis (��� Mini App)
  if (redis) {
    try {
      const dataToSave = {
        products: products,
        categories: categories
      };
      await redis.set('products', JSON.stringify(dataToSave));
      console.log(`? Redis ������� ����� �������� ����� "${deletedFlavorName}"`);
    } catch(e) {
      console.error('? ������ ���������� � Redis:', e.message);
    }
  }

  return { success: true, deletedFlavor: deletedFlavorName };
}

// ����������� ���� (���/����)
function toggleColor(productId, colorIndex) {
  const product = products.find(p => p.id === productId);
  if (!product || !product.colors || isNaN(colorIndex) || product.colors[colorIndex] === undefined) return false;

  const color = product.colors[colorIndex];

  if (typeof color === 'object') {
    color.enabled = !(color.enabled === undefined || color.enabled === true);
  } else {
    // ������������ ������ � ������
    product.colors[colorIndex] = {
      name: color,
      enabled: false // ������ ���� � ���������
    };
  }

  // ��������� � data/products.js
  try {
    const fs = require('fs');
    const path = require('path');
    const contentJs = '// ��������� �������\nconst categories = ' + JSON.stringify(categories, null, 2) + ';\n\n// ������\nconst products = ' + JSON.stringify(products, null, 2) + ';\n\nmodule.exports = { products, categories };\n';
    fs.writeFileSync(path.join(__dirname, '..', 'data', 'products.js'), contentJs, 'utf8');
    console.log(`? ���������: ${productId}, ���� ${colorIndex}`);
  } catch(e) { console.error('Save colors error:', e.message); }

  return true;
}

// �������� ������ ������������
function showUserOrders(chatId, userId) {
  const orders = getOrders().filter(o => o.userId === userId);

  if (orders.length === 0) {
    bot.sendMessage(chatId, '?? � ��� ���� ��� �������');
    return;
  }

  let message = '?? *���� ������:*\n\n';

  orders.forEach(order => {
    const status = order.status === 'confirmed' ? '?' : order.status === 'cancelled' ? '?' : '?';
    message += `${status} ����� #${order.id}\n`;
    message += `?? �����: ${formatPrice(order.total)}\n`;
    message += `?? ����: ${new Date(order.date).toLocaleString('ru-RU')}\n\n`;
  });

  bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
}

// ��������� callback ��������
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  const userId = query.from.id;
  const username = query.from.username;

  // ��������� ������ "� ����������" � ��������� ��� ����������
  if (data === 'check_subscription') {
    if (await isSubscribed(userId)) {
      bot.answerCallbackQuery(query.id, { text: '? �������� ������������!' });
      // ������� ��������� � �������� ����������� � ��������� /start
      bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
      const firstName = (query.from.first_name || '����').replace(/[*_`\[\]()~>#+=|{}.!\\-]/g, '\\$&');
      const isAdminUser = isAdmin(userId);
      const mainMenu  = buildMainMenu(WEBAPP_URL, userId);
      const adminMenu = buildAdminMenu(WEBAPP_URL, userId);
      const welcomeText =
        `������, ${firstName}! ??\n\n` +
        `����� ���������� � PuffNow_63! ??\n\n` +
        `?? � ��� ������� ����������� ����-���������:\n` +
        `� ���������/������\n` +
        `� ��������\n` +
        `� ����������\n` +
        `� ����������\n\n` +
        `�������� �������� �� ���� ����:`;
      bot.sendPhoto(chatId, 'AgACAgIAAxkBAAIBbGpsZeQTcBF6z6O3yS6CO_2eq75mAALvHWsbFE5hS_nvyP8d07FrAQADAgADeQADPQQ', {
        caption: welcomeText,
        ...(isAdminUser ? adminMenu : mainMenu)
      });
    } else {
      bot.answerCallbackQuery(query.id, { text: '? �� ��� �� ����������� �� �����!', show_alert: true });
    }
    return;
  }

  // ���������� ���������� ���� ������
  if (data === 'skip_product_image') {
    if (addProductState[userId] && addProductState[userId].step === 'image') {
      const state = addProductState[userId];
      state.data.location = '��� �����';

      // ��������� ����� ��� ����
      const result = addProduct(state.data);
      
      delete addProductState[userId];

      if (result.success) {
        const summary = 
          `? *����� ������� ��������!*\n\n` +
          `?? ��������: ${state.data.name}\n` +
          `?? ����: ${formatPrice(state.data.price)}\n` +
          `?? ������: ${state.data.flavors.length}\n` +
          `?? ID: \`${result.product.id}\``;

        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        bot.sendMessage(chatId, summary, {
          parse_mode: 'Markdown',
          ...buildAdminMenu(WEBAPP_URL, userId)
        });
      } else {
        bot.answerCallbackQuery(query.id, { text: `? ${result.error}`, show_alert: true });
      }
    }
    return;
  }

  // ����� �������� ��� ���������� ������
  if (data.startsWith('addflavor_')) {
    const productId = data.replace('addflavor_', '');
    const product = products.find(p => p.id === productId);
    
    if (!product) {
      bot.answerCallbackQuery(query.id, { text: '? ����� �� ������', show_alert: true });
      return;
    }
    
    // �������������� ��������� ��� ���������� ������
    addProductState[userId] = {
      step: 'add_flavors',
      productId: productId,
      productName: product.name
    };
    
    bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
    bot.sendMessage(chatId,
      `?? *${product.name}*\n\n` +
      `������� ����� ����� ����� ������� (��������: "����� ���, ��������, ����")\n\n` +
      `��� ������ ����������� /cancel`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // ��� ���� ��������� callback � ��������� ��������
  if (!(await isSubscribed(userId))) {
    bot.answerCallbackQuery(query.id);
    sendSubscribeMessage(chatId);
    return;
  }

  if (data === 'main_menu') {
    const mainMenuObj = buildMainMenu(WEBAPP_URL, userId);
    bot.editMessageText('������� ����:', {
      chat_id: chatId,
      message_id: query.message.message_id,
      reply_markup: mainMenuObj.reply_markup
    }).catch(() => {
      bot.sendMessage(chatId, '������� ����:', mainMenuObj);
    });
    bot.answerCallbackQuery(query.id);
  } else if (data === 'categories' || data === 'back_categories') {
    showAssortment(chatId, query.message.message_id);
    bot.answerCallbackQuery(query.id);
  } else if (data.startsWith('cat_')) {
    const categoryId = data.replace('cat_', '');
    showCategoryProducts(chatId, categoryId, query.message.message_id);
    bot.answerCallbackQuery(query.id);
  } else if (data.startsWith('reply_')) {
    const targetUserId = parseInt(data.replace('reply_', ''));
    const targetChat = chat.getChat(targetUserId);
    if (targetChat) {
      chat.setAdminReplyMode(userId, targetUserId);
      bot.answerCallbackQuery(query.id, { text: '?? ������� ����� � ���' });
      bot.sendMessage(chatId,
        `?? *����� ������������:*\n?? ${targetChat.firstName} (@${targetChat.username || '���'})\n?? ID: \`${targetUserId}\`\n\n�������� ��������� ��� /cancel ��� ������`,
        { parse_mode: 'Markdown', reply_markup: { remove_keyboard: true } }
      );
    } else {
      bot.answerCallbackQuery(query.id, { text: '? ������������ ������ ���' });
    }
  } else if (data.startsWith('history_')) {
    const targetUserId = parseInt(data.replace('history_', ''));
    const targetChat = chat.getChat(targetUserId);
    if (targetChat) {
      const messages = chat.getMessages(targetUserId, 10);
      let historyText = `?? *������� ����*\n?? ${targetChat.firstName} (@${targetChat.username || '���'})\n\n`;
      
      if (messages.length === 0) {
        historyText += '��������� ���� ���';
      } else {
        messages.forEach(msg => {
          const time = new Date(msg.timestamp).toLocaleString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit' 
          });
          const icon = msg.from === 'user' ? '??' : '?????';
          historyText += `${icon} _${time}_\n${msg.text}\n\n`;
        });
      }
      
      bot.sendMessage(chatId, historyText, { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '?? ��������', callback_data: `reply_${targetUserId}` }
          ]]
        }
      });
      bot.answerCallbackQuery(query.id);
    } else {
      bot.answerCallbackQuery(query.id, { text: '? ��� �� ������' });
    }

  } else if (data === 'show_cart') {
    showCart(chatId);
    bot.answerCallbackQuery(query.id);
  } else if (data === 'admin_panel') {
    showAdminPanel(chatId, query.message.message_id);
    bot.answerCallbackQuery(query.id);
  } else if (data === 'admin_products') {
    showAdminProducts(chatId, query.message.message_id);
    bot.answerCallbackQuery(query.id);
  } else if (data === 'admin_stats') {
    showAdminStats(chatId, query.message.message_id);
    bot.answerCallbackQuery(query.id);
  } else if (data === 'admin_reviews') {
    if (!isAdmin(userId)) { bot.answerCallbackQuery(query.id, { text: '? ������ ��������' }); return; }
    showAdminReviews(chatId, query.message.message_id, 0);
    bot.answerCallbackQuery(query.id);
  } else if (data.startsWith('admin_reviews_page_')) {
    if (!isAdmin(userId)) { bot.answerCallbackQuery(query.id, { text: '? ������ ��������' }); return; }
    const page = parseInt(data.replace('admin_reviews_page_', '')) || 0;
    showAdminReviews(chatId, query.message.message_id, page);
    bot.answerCallbackQuery(query.id);
  } else if (data === 'admin_stats_clear_confirm') {
    // ���������� ������������� �������
    const text = `?? *��������!*\n\n�� �������, ��� ������ ������� *��� ������*?\n\n��� �������� ������ ��������!`;
    const keyboard = {
      inline_keyboard: [
        [
          { text: '? ��, ������� ��', callback_data: 'admin_stats_clear_do' },
          { text: '? ������', callback_data: 'admin_stats' }
        ]
      ]
    };
    bot.editMessageText(text, {
      chat_id: chatId,
      message_id: query.message.message_id,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    }).catch(() => {});
    bot.answerCallbackQuery(query.id);
  } else if (data === 'admin_stats_clear_do') {
    // ��������� �������
    clearOrders();
    bot.answerCallbackQuery(query.id, { text: '? ��� ������ �������', show_alert: true });
    // ������������ � ����������
    showAdminStats(chatId, query.message.message_id);
  } else if (data === 'add_device_start') {
    addProductState[userId] = { step: 'device_name', data: { categoryId: 'disposable' } };
    bot.editMessageText(
      'Add device\n\nEnter name:',
      { chat_id: chatId, message_id: query.message.message_id }
    );
    bot.answerCallbackQuery(query.id);
  } else if (data.startsWith('admin_cat_')) {
    const categoryId = data.replace('admin_cat_', '');
    showAdminCategoryProducts(chatId, categoryId, query.message.message_id);
    bot.answerCallbackQuery(query.id);
  } else if (data.startsWith('admin_product_')) {
    const productId = data.replace('admin_product_', '');
    showAdminProductDetail(chatId, productId, query.message.message_id);
    bot.answerCallbackQuery(query.id);
  } else if (data.startsWith('admin_options_')) {
    const productId = data.replace('admin_options_', '');
    showAdminOptions(chatId, productId, query.message.message_id);
    bot.answerCallbackQuery(query.id);
  } else if (data.startsWith('admin_producttoggle_')) {
    const productId = data.replace('admin_producttoggle_', '');
    if (toggleProduct(productId)) {
      const product = products.find(p => p.id === productId);
      showAdminProductDetail(chatId, productId, query.message.message_id);
      bot.answerCallbackQuery(query.id, { text: product.enabled ? '?? ����� �������' : '?? ����� ��������' });
    } else {
      bot.answerCallbackQuery(query.id, { text: '? ������' });
    }
  } else if (data.startsWith('admin_optiontoggle_')) {
    try {
      const toggleData = data.replace('admin_optiontoggle_', '');
      // ������� ������ - ��� �� ��� ����� ���������� _
      const parts = toggleData.split('_');
      const optionIndex = parseInt(parts[parts.length - 1]);
      // productId - ��� ��, ����� ���������� ��������
      const productId = parts.slice(0, -1).join('_');
      
      if (toggleOption(productId, optionIndex)) {
        showAdminOptions(chatId, productId, query.message.message_id);
        bot.answerCallbackQuery(query.id, { text: '? ������ �������' });
      } else {
        bot.answerCallbackQuery(query.id, { text: '? ������' });
      }
    } catch (err) {
      bot.answerCallbackQuery(query.id, { text: '? ������: ' + err.message });
    }
  } else if (data.startsWith('admin_colortoggle_')) {
    try {
      const toggleData = data.replace('admin_colortoggle_', '');
      // ������� ������ - ��� �� ��� ����� ���������� _
      const parts = toggleData.split('_');
      const colorIndex = parseInt(parts[parts.length - 1]);
      // productId - ��� ��, ����� ���������� ��������
      const productId = parts.slice(0, -1).join('_');
      
      if (toggleColor(productId, colorIndex)) {
        showAdminFlavors(chatId, productId, query.message.message_id);
        bot.answerCallbackQuery(query.id, { text: '? ������ �������' });
      } else {
        bot.answerCallbackQuery(query.id, { text: '? ������' });
      }
    } catch (err) {
      bot.answerCallbackQuery(query.id, { text: '? ������: ' + err.message });
    }
  } else if (data.startsWith('admin_flavors_')) {
    const productId = data.replace('admin_flavors_', '');
    showAdminFlavors(chatId, productId, query.message.message_id);
    bot.answerCallbackQuery(query.id);
  } else if (data.startsWith('admin_disableall_')) {
    const productId = data.replace('admin_disableall_', '');
    if (disableAllFlavors(productId)) {
      showAdminFlavors(chatId, productId, query.message.message_id);
      bot.answerCallbackQuery(query.id, { text: '?? ��� ����� ���������' });
    } else {
      bot.answerCallbackQuery(query.id, { text: '? ������' });
    }
  } else if (data.startsWith('admin_addflavors_')) {
    // ������ "�������� �����" �� �����-������
    const productId = data.replace('admin_addflavors_', '');
    const product = products.find(p => p.id === productId);
    
    if (!product) {
      bot.answerCallbackQuery(query.id, { text: '? ����� �� ������', show_alert: true });
      return;
    }
    
    // �������������� ��������� ��� ���������� ������
    addProductState[userId] = {
      step: 'add_flavors',
      productId: productId,
      productName: product.name
    };
    
    bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
    bot.sendMessage(chatId,
      `?? *${product.name}*\n\n` +
      `������� ����� ����� ����� ������� (��������: "����� ���, ��������, ����")\n\n` +
      `��� ������ ����������� /cancel`,
      { parse_mode: 'Markdown' }
    );
    bot.answerCallbackQuery(query.id);
  } else if (data.startsWith('admin_toggle_')) {
    try {
      const toggleData = data.replace('admin_toggle_', '');
      // ������� ������ - ��� �� ��� ����� ���������� _
      const parts = toggleData.split('_');
      const flavorIndex = parseInt(parts[parts.length - 1]);
      // productId - ��� ��, ����� ���������� ��������
      const productId = parts.slice(0, -1).join('_');
      
      console.log('Toggle flavor:', productId, flavorIndex);
      
      if (toggleFlavor(productId, flavorIndex)) {
        showAdminFlavors(chatId, productId, query.message.message_id);
        bot.answerCallbackQuery(query.id, { text: '? ������ �������' });
      } else {
        bot.answerCallbackQuery(query.id, { text: '? ������' });
      }
    } catch (err) {
      console.error('Error toggling flavor:', err);
      bot.answerCallbackQuery(query.id, { text: '? ������: ' + err.message });
    }
  } else if (data.startsWith('admin_deleteflavor_')) {
    try {
      const deleteData = data.replace('admin_deleteflavor_', '');
      // ������� ������ - ��� �� ��� ����� ���������� _
      const parts = deleteData.split('_');
      const flavorIndex = parseInt(parts[parts.length - 1]);
      // productId - ��� ��, ����� ���������� ��������
      const productId = parts.slice(0, -1).join('_');
      
      console.log('Delete flavor:', productId, flavorIndex);
      
      const result = await deleteFlavor(productId, flavorIndex);
      if (result.success) {
        showAdminFlavors(chatId, productId, query.message.message_id);
        bot.answerCallbackQuery(query.id, { text: `? ���� "${result.deletedFlavor}" �����` });
      } else {
        bot.answerCallbackQuery(query.id, { text: '? ������ ��������' });
      }
    } catch (err) {
      console.error('Error deleting flavor:', err);
      bot.answerCallbackQuery(query.id, { text: '? ������: ' + err.message });
    }
  } else if (data === 'my_orders') {
    showUserOrders(chatId, userId);
    bot.answerCallbackQuery(query.id);
  } else if (data.startsWith('view_')) {
    const productId = data.replace('view_', '');
    showProductDetail(chatId, productId, query.message.message_id);
    bot.answerCallbackQuery(query.id);
  } else if (data.startsWith('add_')) {
    const productId = data.replace('add_', '');
    const product = products.find(p => p.id === productId);
    
    // ���� � ������ ���� �����, ����� ��� ����� � ���������� �����
    if (product && (product.flavors || product.colors || product.options)) {
      // ���������� ���������� �����
      userCarts[`flavors_${chatId}_${productId}`] = [];
      showFlavorSelection(chatId, productId, query.message.message_id, []);
      bot.answerCallbackQuery(query.id);
    } else {
      // ��� ��������� � ����� ���������
      addToCart(query.id, chatId, productId);
    }
  } else if (data.startsWith('flavorpick_')) {
    // �����/������ �����
    const pickData = data.replace('flavorpick_', '');
    // ������� ������ - ��� �� ��� ����� ���������� _
    const parts = pickData.split('_');
    const flavorIndex = parseInt(parts[parts.length - 1]);
    // productId - ��� ��, ����� ���������� ��������
    const productId = parts.slice(0, -1).join('_');
    
    const key = `flavors_${chatId}_${productId}`;
    if (!userCarts[key]) userCarts[key] = [];
    
    const idx = userCarts[key].indexOf(flavorIndex);
    if (idx === -1) {
      userCarts[key].push(flavorIndex); // ��������
    } else {
      userCarts[key].splice(idx, 1); // ������
    }
    
    showFlavorSelection(chatId, productId, query.message.message_id, userCarts[key]);
    bot.answerCallbackQuery(query.id);

  } else if (data.startsWith('flavorconfirm_')) {
    const productId = data.replace('flavorconfirm_', '');
    const key = `flavors_${chatId}_${productId}`;
    const selectedIndexes = userCarts[key] || [];
    const product = products.find(p => p.id === productId);

    if (!product) {
      bot.answerCallbackQuery(query.id, { text: '? ����� �� ������' });
      return;
    }

    if (selectedIndexes.length === 0) {
      bot.answerCallbackQuery(query.id, { text: '?? �������� ���� �� ���� �������!', show_alert: true });
      return;
    }

    // ���������� ��� ��������� � �������� ������
    let variants = [];
    if (product.flavors) {
      const enabledFlavors = product.flavors.filter(f => {
        if (typeof f === 'object') return f.enabled === undefined || f.enabled === true;
        return true;
      });
      variants = enabledFlavors.map(f => typeof f === 'object' ? f.name : f);
    } else if (product.colors) {
      const enabledColors = product.colors.filter(c =>
        typeof c === 'string' || c.enabled === undefined || c.enabled === true
      );
      variants = enabledColors.map(c => typeof c === 'object' ? c.name : c);
    } else if (product.options) {
      variants = product.options;
    }

    if (!userCarts[chatId]) userCarts[chatId] = [];

    // ��������� ������ ��������� ������� ��������� ��������
    selectedIndexes.forEach(i => {
      const variantName = variants[i];
      
      const existing = userCarts[chatId].find(item => item.productId === productId && item.flavor === variantName);
      if (existing) {
        existing.quantity++;
      } else {
        userCarts[chatId].push({ productId, quantity: 1, flavor: variantName });
      }
    });

    // ������� ��������� �����
    delete userCarts[key];

    bot.answerCallbackQuery(query.id, { 
      text: `? ��������� � �������: ${selectedIndexes.length} �������(��)!`,
      show_alert: false
    });

    // ������������ � �������� ������
    showProductDetail(chatId, productId, query.message.message_id);

  } else if (data === 'clear_cart') {
    userCarts[chatId] = [];
    bot.answerCallbackQuery(query.id, { text: '?? ������� �������' });
    bot.editMessageText('?? ������� �����', {
      chat_id: chatId,
      message_id: query.message.message_id
    });
  } else if (data === 'checkout') {
    showPickupSelection(chatId, query.message.message_id);
    bot.answerCallbackQuery(query.id);
  } else if (data.startsWith('pickup_')) {
    const pointId = data.replace('pickup_', '');
    const point = PICKUP_POINTS.find(p => p.id === pointId);
    if (!point) {
      bot.answerCallbackQuery(query.id, { text: '? ����� �� �������' });
      return;
    }
    const firstName = query.from.first_name || '������';
    checkout(chatId, userId, username, firstName, point.address);
    bot.answerCallbackQuery(query.id);
  } else if (data.startsWith('complete_')) {
    // ��������� ����� � ��������� ��������� ����� � ������������
    if (!isAdmin(userId)) {
      bot.answerCallbackQuery(query.id, { text: '? ������ ��������' });
      return;
    }

    const orderId = data.replace('complete_', '');
    const orders = getOrders();
    const order = orders.find(o => o.id === orderId);

    if (!order) {
      bot.answerCallbackQuery(query.id, { text: '? ����� �� ������', show_alert: true });
      return;
    }

    // ��������� ����� ��� ������� ������ � ������
    const disabledFlavors = [];
    const orderItems = order.items || [];

    for (const item of orderItems) {
      if (!item.flavor) continue; // ����� ��� ����� � ����������

      const product = products.find(p => p.id === item.productId);
      if (!product || !product.flavors) continue;

      // ���� ���� �� �����
      const flavorIndex = product.flavors.findIndex(f => {
        const name = typeof f === 'string' ? f : f.name;
        return name === item.flavor;
      });

      if (flavorIndex !== -1) {
        const flavor = product.flavors[flavorIndex];
        if (typeof flavor === 'object') {
          flavor.enabled = false;
        } else {
          product.flavors[flavorIndex] = { name: flavor, stock: '', enabled: false };
        }
        disabledFlavors.push(`${product.name} � ${item.flavor}`);
        console.log(`? ���� ��������: ${product.name} / ${item.flavor}`);
      }
    }

    // ��������� � ����
    try {
      const fs = require('fs');
      const path = require('path');
      const contentJs = '// ��������� �������\nconst categories = ' + JSON.stringify(categories, null, 2) + ';\n\n// ������\nconst products = ' + JSON.stringify(products, null, 2) + ';\n\nmodule.exports = { products, categories };\n';
      fs.writeFileSync(path.join(__dirname, '..', 'data', 'products.js'), contentJs, 'utf8');
    } catch(e) { console.error('Save products error:', e.message); }

    // �������������� � Redis
    if (redis) {
      redis.set('products', JSON.stringify({ products, categories }))
        .then(() => console.log('? Redis ������� ����� ���������� ������'))
        .catch(e => console.error('? ������ Redis:', e.message));
    }

    // ��������� ������ ������
    order.status = 'completed';
    saveOrder(order);

    const disabledText = disabledFlavors.length > 0
      ? `\n\n?? ��������� ������: ${disabledFlavors.length}\n${disabledFlavors.map(f => `� ${f}`).join('\n')}`
      : '\n\n(������ ��� ������ � ������ �� ���������)';

    bot.answerCallbackQuery(query.id, { text: `?? ����� ��������!${disabledFlavors.length > 0 ? ` ���������: ${disabledFlavors.length} ������` : ''}`, show_alert: true });

    // ��������� ���������
    const originalText = query.message.text || query.message.caption || '';
    bot.editMessageText(
      `${originalText}\n\n?? <b>����� �����ب�</b>${disabledText}`,
      {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'HTML'
      }
    ).catch(() => {});

  } else if (data.startsWith('confirm_') || data.startsWith('cancel_')) {
    if (!isAdmin(userId)) {
      bot.answerCallbackQuery(query.id, { text: '? ������ ��������' });
      return;
    }

    const orderId = data.split('_')[1];
    const action = data.startsWith('confirm_') ? 'confirmed' : 'cancelled';
    const orders = getOrders();
    const order = orders.find(o => o.id === orderId);

    if (order) {
      order.status = action;
      saveOrder(order);

      const statusText = action === 'confirmed' ? '? �����������' : '? �������';
      bot.answerCallbackQuery(query.id, { text: `����� ${statusText}` });

      // ��� ������������� ��������� ������ "���������", ��� ������ � ������� ��� ������
      const editOptions = {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'Markdown'
      };

      if (action === 'confirmed') {
        editOptions.reply_markup = {
          inline_keyboard: [
            [{ text: '?? ��������� �����', callback_data: `complete_${orderId}` }],
            [{ text: '?? �������� �������', callback_data: `contact_${order.userId}` }]
          ]
        };
      }

      bot.editMessageText(
        `${query.message.text}\n\n*������: ${statusText.toUpperCase()}*`,
        editOptions
      ).catch(() => {});

      // ��������� �������
      bot.sendMessage(
        order.chatId,
        `��� ����� #${orderId} ${statusText}!`
      );

      // ���������� ������ � ������ ��� �������������, � ������ ���� �� �������� � ��������� 30 ����
      if (action === 'confirmed' && !hasRecentReview(order.userId)) {
        setTimeout(() => {
          bot.sendMessage(
            order.chatId,
            `?? ����, ��� �� ������� ���!\n\n����������, �������� ����� � ����� ������ � ��� ����� ������ ������ � ����� ������� ��� ����� ����� ??`,
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: '?',     callback_data: 'review_rate_1' },
                    { text: '??',   callback_data: 'review_rate_2' },
                    { text: '???', callback_data: 'review_rate_3' },
                  ],
                  [
                    { text: '????',   callback_data: 'review_rate_4' },
                    { text: '?????', callback_data: 'review_rate_5' },
                  ],
                  [
                    { text: '?? �� ������', callback_data: 'review_cancel' }
                  ]
                ]
              }
            }
          ).then(() => {
            // �������������� ��������� ������ ��� ����� ������������
            reviewState[order.userId] = { step: 'rating', orderId };
          }).catch(() => {});
        }, 5000); // ��������� �������� ����� ��������� ������ ����� ����������� � �������
      }
    }
  } else if (data.startsWith('contact_')) {
    if (!isAdmin(userId)) {
      bot.answerCallbackQuery(query.id, { text: '? ������ ��������' });
      return;
    }
    
    const clientUserId = parseInt(data.replace('contact_', ''));
    
    // ���� �����, ����� �������� chatId �������
    const orders = getOrders();
    const clientOrder = orders.find(o => o.userId === clientUserId);
    
    if (!clientOrder) {
      bot.answerCallbackQuery(query.id, { text: '? �� ������� ����� �������', show_alert: true });
      return;
    }
    
    // ��������� ��� � ��������
    const clientFirstName = clientOrder.firstName || '������';
    const clientUsername = clientOrder.username !== '�� ������' ? clientOrder.username : '';
    
    chat.openChat(clientUserId, clientOrder.chatId, clientUsername, clientFirstName);
    chat.setAdminReplyMode(userId, clientUserId);
    
    bot.answerCallbackQuery(query.id, { text: '?? ������� ��������� �������' });
    bot.sendMessage(chatId, 
      `?? *����� ������ ������� �����������*\n\n` +
      `������: ${clientFirstName}${clientUsername ? ` (@${clientUsername})` : ''}\n` +
      `ID: \`${clientUserId}\`\n\n` +
      `������� ���� ���������, � ��� ����� ���������� �������.\n\n` +
      `��� ������ ����������� /cancel`,
      { parse_mode: 'Markdown' }
    );

  // --- ������ ---------------------------------------------------------------
  } else if (data.startsWith('review_page_')) {
    const page = parseInt(data.replace('review_page_', ''), 10);
    const reviews = getReviews();
    const stats = getStats();
    const orders = getOrders();
    const hasPurchase = orders.some(o => o.userId === userId && o.status === 'confirmed');

    if (reviews.length === 0 || page < 0 || page >= reviews.length) {
      bot.answerCallbackQuery(query.id);
      return;
    }

    bot.answerCallbackQuery(query.id);
    await sendReviewPage(chatId, reviews, stats, page, hasPurchase, query.message.message_id);

  } else if (data === 'review_start') {
    const orders = getOrders();
    const hasPurchase = orders.some(o => o.userId === userId && o.status === 'confirmed');
    if (!hasPurchase) {
      bot.answerCallbackQuery(query.id, {
        text: '? �������� ����� ����� ������ ���������� � �������������� ��������',
        show_alert: true
      });
      return;
    }
    askReviewRating(chatId, userId);
    bot.answerCallbackQuery(query.id);

  } else if (data.startsWith('review_rate_')) {
    const rating = parseInt(data.replace('review_rate_', ''));
    if (!reviewState[userId]) reviewState[userId] = {};
    reviewState[userId].rating = rating;
    reviewState[userId].step = 'text';

    const stars = '?'.repeat(rating);
    bot.editMessageText(
      `${stars} ������ ${rating}/5 �������!\n\n������ �������� �������� ����� � ����� �����:\n_(��� ������� ������������)_`,
      {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '?? ����������', callback_data: 'review_skip' },
            { text: '? ������',     callback_data: 'review_cancel' }
          ]]
        }
      }
    );
    bot.answerCallbackQuery(query.id);

  } else if (data === 'review_skip') {
    // ���������� ����� � ��������� � ���� ����
    if (!reviewState[userId]) reviewState[userId] = {};
    reviewState[userId].step = 'photo';

    bot.editMessageText(
      `?? ������ ���������� ���� � ������?\n\n��������� �������� ��� ������� ������������`,
      {
        chat_id: chatId,
        message_id: query.message.message_id,
        reply_markup: {
          inline_keyboard: [[
            { text: '?? ����������', callback_data: 'review_skip_photo' },
            { text: '? ������',     callback_data: 'review_cancel' }
          ]]
        }
      }
    );
    bot.answerCallbackQuery(query.id);

  } else if (data === 'review_skip_photo') {
    // ��������� ����� ��� ����
    if (reviewState[userId] && reviewState[userId].rating) {
      const state = reviewState[userId];
      const firstName = query.from.first_name || '����������';
      const reviewId = `r${Date.now()}`;
      saveReview({
        id: reviewId,
        userId,
        firstName,
        username: query.from.username || null,
        rating: state.rating,
        text: state.text || null,
        photoFileId: null,
        orderId: state.orderId || null,
        date: new Date().toISOString()
      });
      delete reviewState[userId];

      bot.editMessageText(
        `? ������� �� �����, ${firstName}! ??`,
        { chat_id: chatId, message_id: query.message.message_id }
      );

      // ���������� �������
      const stars = '?'.repeat(state.rating);
      const notifText =
        `${stars} *����� ����� �� ${firstName}*${query.from.username ? ` (@${query.from.username})` : ''}` +
        (state.text ? `\n\n_${state.text}_` : '\n_(��� ������)_');
      adminIds.forEach(id => {
        bot.sendMessage(id, notifText, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: '?? �������', callback_data: `review_delete_${reviewId}` }]]
          }
        }).catch(() => {});
      });
    }
    bot.answerCallbackQuery(query.id);

  } else if (data === 'review_cancel') {
    delete reviewState[userId];
    bot.editMessageText('? ����� �������', {
      chat_id: chatId,
      message_id: query.message.message_id
    });
    bot.answerCallbackQuery(query.id);

  } else if (data.startsWith('review_delete_')) {
    if (!isAdmin(userId)) {
      bot.answerCallbackQuery(query.id, { text: '? ������ ��������' });
      return;
    }
    const reviewId = data.replace('review_delete_', '');
    const deleted = deleteReview(reviewId);
    bot.answerCallbackQuery(query.id, { text: deleted ? '?? ����� �����' : '? ����� �� ������', show_alert: true });
    if (deleted) {
      bot.editMessageText(
        `?? _����� �����_`,
        { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'Markdown' }
      ).catch(() => {});
    }

  } else if (data.startsWith('review_photo_')) {
    if (!isAdmin(userId)) {
      bot.answerCallbackQuery(query.id, { text: '? ������ ��������' });
      return;
    }
    const reviewId = data.replace('review_photo_', '');
    const reviews = getReviews();
    const review = reviews.find(r => r.id === reviewId);
    if (review && review.photoFileId) {
      const stars = '?'.repeat(review.rating);
      const name = review.username ? `@${review.username}` : (review.firstName || '����������');
      bot.sendPhoto(chatId, review.photoFileId, {
        caption: `${stars} *${name}*${review.text ? `\n_${review.text}_` : ''}`,
        parse_mode: 'Markdown'
      });
      bot.answerCallbackQuery(query.id);
    } else {
      bot.answerCallbackQuery(query.id, { text: '? ���� �� �������', show_alert: true });
    }
  }
});

// --- ��������� ������� �� Mini App ------------------------------------------
bot.on('message', (msg) => {
  if (!msg.web_app_data) return;

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username;
  const firstName = msg.from.first_name || '������';

  let orderData;
  try {
    orderData = JSON.parse(msg.web_app_data.data);
  } catch (e) {
    bot.sendMessage(chatId, '? ������ ��������� ������');
    return;
  }

  const { orderId, username: orderUsername, items, total, pickupPoint } = orderData;

  // ��������� �����
  const order = {
    id: orderId,
    userId,
    username: orderUsername || username || '�� ������',
    firstName: firstName,
    chatId,
    items,
    total,
    pickupPoint: pickupPoint || '�� �������',
    date: new Date().toISOString(),
    status: 'pending',
    source: 'miniapp'
  };
  saveOrder(order);

  // ������������� �������
  let confirmText = `? ����� ������!\n\n����� ������: *#${orderId}*\n\n`;
  items.forEach((item, i) => {
    confirmText += `${i + 1}. ${item.name}`;
    if (item.flavor) confirmText += ` � ${item.flavor}`;
    confirmText += `\n   ${item.qty} ? ${formatPrice(item.price)} = ${formatPrice(item.price * item.qty)}\n`;
  });
  confirmText += `\n?? *�����: ${formatPrice(total)}*\n`;
  if (pickupPoint) confirmText += `?? *����� ����������:* ${pickupPoint}\n`;
  confirmText += `\n`;
  if (orderUsername) confirmText += `?? Username: ${orderUsername}\n`;
  confirmText += `?? ������ ��� ��������� ���������, ��� ������ ��������� ������������� � ����������\n�������� �������� � ����!`;

  bot.sendMessage(chatId, confirmText, { parse_mode: 'Markdown' });

  // ����������� ���������������
  let adminText = `?? *����� ����� �� Mini App!*\n\n`;
  adminText += `?? �����: #${orderId}\n`;
  
  // ��������� ���������� � �������
  adminText += `?? ������: ${firstName}`;
  if (username) {
    adminText += ` (@${username})`;
  }
  adminText += `\n?? ID: \`${userId}\`\n`;
  
  if (orderUsername && orderUsername !== '@' + username) adminText += `?? ������ username: ${orderUsername}\n`;
  if (pickupPoint) adminText += `?? ����� ����������: ${pickupPoint}\n`;
  adminText += `\n`;

  items.forEach((item, i) => {
    adminText += `${i + 1}. ${item.name}`;
    if (item.flavor) adminText += ` (${item.flavor})`;
    adminText += ` ? ${item.qty} = ${formatPrice(item.price * item.qty)}\n`;
  });

  adminText += `\n?? *�����: ${formatPrice(total)}*`;

  adminIds.forEach(id => {
    bot.sendMessage(id, adminText, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '? �����������', callback_data: `confirm_${orderId}` },
            { text: '? ��������',    callback_data: `cancel_${orderId}` }
          ],
          [
            { text: '?? ��������� �����', callback_data: `complete_${orderId}` }
          ],
          [
            { text: '?? �������� �������', callback_data: `contact_${userId}` }
          ]
        ]
      }
    }).catch(err => console.log(`? �� ������� ��������� ������ ${id}:`, err.message));
  });
});

console.log('?? ��� �������!');
