const fs = require('fs');
const path = require('path');

const REVIEWS_FILE = path.join(__dirname, '..', 'data', 'reviews.json');

function ensureFile() {
  const dir = path.dirname(REVIEWS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(REVIEWS_FILE)) fs.writeFileSync(REVIEWS_FILE, JSON.stringify([], null, 2));
}

function getReviews() {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(REVIEWS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function saveReview(review) {
  const reviews = getReviews();
  reviews.unshift(review); // новые сверху
  fs.writeFileSync(REVIEWS_FILE, JSON.stringify(reviews, null, 2));
}

function deleteReview(id) {
  const reviews = getReviews();
  const filtered = reviews.filter(r => r.id !== id);
  fs.writeFileSync(REVIEWS_FILE, JSON.stringify(filtered, null, 2));
  return reviews.length !== filtered.length;
}

function getStats() {
  const reviews = getReviews();
  if (reviews.length === 0) return { count: 0, avg: 0 };
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  return {
    count: reviews.length,
    avg: (sum / reviews.length).toFixed(1)
  };
}

// Проверяем, оставлял ли пользователь отзыв за последние N дней
function hasRecentReview(userId, days = 30) {
  const reviews = getReviews();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return reviews.some(r => r.userId === userId && new Date(r.date).getTime() > cutoff);
}

module.exports = { getReviews, saveReview, deleteReview, getStats, hasRecentReview };
