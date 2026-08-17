// Форматирование цены
function formatPrice(price) {
  return `${price.toLocaleString('ru-RU')} ₽`;
}

// Генерация ID заказа
function generateOrderId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `${timestamp}${random}`.toUpperCase();
}

module.exports = { formatPrice, generateOrderId };
