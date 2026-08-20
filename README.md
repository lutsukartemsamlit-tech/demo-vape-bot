# Demo_bot — Telegram Bot

Бот для магазина вейп-продукции с админ-панелью.

## Деплой на Render.com (24/7)

### Шаг 1 — Загрузи код на GitHub

1. Зайди на [github.com](https://github.com) и создай новый репозиторий (New repository)
2. Назови его `tg_bot`, сделай **Private**
3. Открой терминал в папке с ботом и выполни:

```bash
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/ТВО_ИМЯ/tg_bot.git
git push -u origin main
```

---

### Шаг 2 — Создай Background Worker на Render

1. Зайди на [render.com](https://render.com)
2. Нажми **New +** → **Background Worker**
3. Подключи GitHub и выбери репозиторий `tg_bot`
4. Заполни настройки:

| Поле | Значение |
|------|----------|
| Name | tg-bot |
| Runtime | Node |
| Build Command | `npm install` |
| Start Command | `![alt text](image.png)` |

---

### Шаг 3 — Добавь переменные окружения

В разделе **Environment Variables** добавь:

| Key | Value |
|-----|-------|
| `BOT_TOKEN` | токен от @BotFather |
| `ADMIN_ID` | твой Telegram ID |
| `WEBAPP_URL` | ссылка на мини-апп (с Vercel) |
| `UPSTASH_REDIS_REST_URL` | URL из Upstash |
| `UPSTASH_REDIS_REST_TOKEN` | токен из Upstash |

> ⚠️ `PROXY_URL` **не добавляй** — на Render серверы в США, Telegram доступен напрямую

---

### Шаг 4 — Запусти деплой

1. Нажми **Create Background Worker**
2. Подожди 2-3 минуты пока Render установит зависимости
3. В логах должно появиться: `🤖 Бот запущен!`

---

### Обновление бота

Когда меняешь код — просто сделай push в GitHub:

```bash
git add .
git commit -m "обновление"
git push
```

Render автоматически задеплоит новую версию.

---

### Локальный запуск (для разработки)

1. Скопируй `.env.example` в `.env`:
```bash
copy .env.example .env
```

2. Заполни `.env` своими данными

3. Запусти:
```bash
npm start
```
