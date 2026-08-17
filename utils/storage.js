const fs   = require('fs');
const path = require('path');

const ORDERS_FILE = path.join(__dirname, '../data/orders.json');

function ensureDataDir() {
  const dataDir = path.join(__dirname, '../data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}

function getOrders() {
  ensureDataDir();
  try {
    if (fs.existsSync(ORDERS_FILE)) {
      const data = fs.readFileSync(ORDERS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Ошибка чтения заказов:', e);
  }
  return [];
}

function saveOrder(order) {
  ensureDataDir();
  try {
    const orders = getOrders();
    // Поддержка обоих форматов: order.id (бот) и order.orderId (mini app)
    const uid = order.id || order.orderId;
    const idx = orders.findIndex(o => (o.id || o.orderId) === uid);
    if (idx >= 0) orders[idx] = order;
    else orders.push(order);
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
    return true;
  } catch (e) {
    console.error('Ошибка сохранения заказа:', e);
    return false;
  }
}

module.exports = { getOrders, saveOrder, clearOrders };

function clearOrders() {
  ensureDataDir();
  try {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify([], null, 2));
    return true;
  } catch (e) {
    console.error('Ошибка очистки заказов:', e);
    return false;
  }
}
