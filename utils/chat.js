// Модуль для управления чатами между пользователями и админами
const fs = require('fs');
const path = require('path');

const CHAT_FILE = path.join(__dirname, '..', 'data', 'chats.json');

// Хранилище активных чатов в памяти
const activeChats = {};
const adminReplyMode = {};

// Инициализация
function initChats() {
  try {
    if (fs.existsSync(CHAT_FILE)) {
      const data = JSON.parse(fs.readFileSync(CHAT_FILE, 'utf8'));
      Object.assign(activeChats, data.activeChats || {});
    }
  } catch (e) {
    console.error('Ошибка загрузки чатов:', e.message);
  }
}

// Сохранение в файл
function saveChats() {
  try {
    const dir = path.dirname(CHAT_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CHAT_FILE, JSON.stringify({ activeChats }, null, 2));
  } catch (e) {
    console.error('Ошибка сохранения чатов:', e.message);
  }
}

// Открыть чат (пользователь начинает диалог)
function openChat(userId, chatId, username, firstName) {
  activeChats[userId] = {
    chatId,
    username: username || '',
    firstName: firstName || 'Пользователь',
    startedAt: new Date().toISOString(),
    messages: []
  };
  saveChats();
  return activeChats[userId];
}

// Закрыть чат
function closeChat(userId) {
  if (activeChats[userId]) {
    delete activeChats[userId];
    saveChats();
    return true;
  }
  return false;
}

// Проверить, открыт ли чат
function isChatOpen(userId) {
  return !!activeChats[userId];
}

// Получить инфо о чате
function getChat(userId) {
  return activeChats[userId];
}

// Добавить сообщение в историю
function addMessage(userId, fromUser, text) {
  if (activeChats[userId]) {
    activeChats[userId].messages.push({
      from: fromUser ? 'user' : 'admin',
      text,
      timestamp: new Date().toISOString()
    });
    // Храним только последние 50 сообщений
    if (activeChats[userId].messages.length > 50) {
      activeChats[userId].messages = activeChats[userId].messages.slice(-50);
    }
    saveChats();
  }
}

// Получить историю сообщений
function getMessages(userId, limit = 10) {
  if (activeChats[userId]) {
    return activeChats[userId].messages.slice(-limit);
  }
  return [];
}

// Получить все активные чаты
function getAllActiveChats() {
  return Object.entries(activeChats).map(([userId, data]) => ({
    userId,
    ...data
  }));
}

// Режим ответа админа
function setAdminReplyMode(adminId, targetUserId) {
  adminReplyMode[adminId] = targetUserId;
}

function getAdminReplyTarget(adminId) {
  return adminReplyMode[adminId];
}

function clearAdminReplyMode(adminId) {
  delete adminReplyMode[adminId];
}

function isAdminInReplyMode(adminId) {
  return !!adminReplyMode[adminId];
}

// Инициализация при загрузке модуля
initChats();

module.exports = {
  openChat,
  closeChat,
  isChatOpen,
  getChat,
  addMessage,
  getMessages,
  getAllActiveChats,
  setAdminReplyMode,
  getAdminReplyTarget,
  clearAdminReplyMode,
  isAdminInReplyMode
};
