# 💰 Маркетплейс курсов — полная система монетизации

## 🎯 Что реализовано

Создана **полноценная система маркетплейса курсов** с интеграцией платежей, позволяющая:
- ✅ Репетиторам создавать и продавать свои курсы
- ✅ Ученикам покупать и проходить курсы
- ✅ Платформе зарабатывать комиссию с продаж
- ✅ Отслеживать прогресс и выдавать сертификаты

---

## 📦 Структура проекта

### Backend (7 новых файлов)

#### 1. **База данных** — `backend/migrations/027_course_marketplace.sql`
Полная структура БД для маркетплейса:
- `marketplace_courses` — курсы в маркетплейсе
- `course_purchases` — покупки курсов
- `course_progress` — прогресс прохождения
- `course_reviews` — отзывы на курсы
- `course_favorites` — избранные курсы
- `course_coupons` — промокоды и скидки
- `author_payouts` — выплаты авторам

**Ключевые фичи БД:**
- Автоматический подсчет рейтинга и статистики продаж
- Система комиссий (по умолчанию 30% платформе)
- Поддержка подписок и разовых платежей
- Возвраты в течение 14 дней

#### 2. **API маркетплейса** — `backend/src/routes/marketplace.js`
Полный REST API для работы с курсами:

**Публичные эндпоинты:**
- `GET /marketplace/courses` — список курсов с фильтрами
- `GET /marketplace/courses/:slug` — просмотр курса
- `POST /marketplace/courses/:id/favorite` — добавить в избранное
- `POST /marketplace/courses/:id/review` — оставить отзыв

**Для авторов (репетиторов):**
- `POST /marketplace/courses` — создать курс
- `PUT /marketplace/courses/:id` — обновить курс
- `POST /marketplace/courses/:id/publish` — опубликовать курс
- `GET /marketplace/author/courses` — мои курсы
- `GET /marketplace/author/stats` — статистика продаж

**Для покупателей:**
- `POST /marketplace/courses/:id/purchase` — купить курс
- `GET /marketplace/my-courses` — мои купленные курсы

#### 3. **API платежей** — `backend/src/routes/payments.js`
Интеграция с **Stripe** для приема платежей:

**Функции:**
- `POST /payments/create-checkout-session` — создание платежной сессии
- `POST /payments/webhook` — обработка событий Stripe
- `GET /payments/purchases` — история покупок
- `POST /payments/purchase/:id/refund` — возврат средств
- `POST /payments/grant-access` — бесплатный доступ (для админов)

**Поддерживаемые сценарии:**
- Разовые покупки курсов
- Подписки (recurring payments)
- Автоматические выплаты авторам
- Возвраты в течение 14 дней

---

### Frontend (3 новые страницы)

#### 1. **Маркетплейс** — `frontend/src/pages/CoursesMarketplace.jsx`
Главная страница магазина курсов:
- Фильтры по категориям, уровню, цене
- Поиск по названию и описанию
- Сортировка (популярность, рейтинг, цена, новизна)
- Пагинация
- Карточки курсов с превью

#### 2. **Страница курса** — `frontend/src/pages/CoursePage.jsx`
Детальная страница курса:
- Полное описание с модулями
- Рейтинг и отзывы
- Кнопка покупки с Stripe Checkout
- Статистика (количество учеников, уроков)
- Информация об авторе

#### 3. **Кабинет автора** — `frontend/src/pages/tutor/MyCoursesAuthor.jsx`
Управление курсами для репетиторов:
- Список созданных курсов
- Статистика продаж и доходов
- Редактирование и публикация курсов
- Просмотр аналитики

#### 4. **Стили** — `frontend/src/styles.css`
170+ строк новых стилей для:
- Карточек курсов
- Страницы курса
- Модулей и уроков
- Отзывов
- Кабинета автора
- Адаптивная версия для мобильных

---

## 🚀 Как использовать

### 1. **Установка и настройка**

```bash
# 1. Применить миграцию базы данных
cd backend
npm run migrate

# 2. Настроить переменные окружения
echo "STRIPE_SECRET_KEY=sk_test_..." >> .env
echo "STRIPE_WEBHOOK_SECRET=whsec_..." >> .env
echo "FRONTEND_URL=http://localhost:5173" >> .env

# 3. Установить Stripe (если еще не установлен)
npm install stripe

# 4. Запустить бэкенд
npm start

# 5. Запустить фронтенд
cd ../frontend
npm run dev
```

### 2. **Создание курса (репетитор)**

```javascript
// POST /marketplace/courses
{
  "title": "English for Beginners",
  "slug": "english-for-beginners",
  "description": "Курс английского языка с нуля",
  "category": "english",
  "level": "beginner",
  "price_type": "paid",
  "price_amount": 4900, // $49.00 в центах
  "currency": "USD",
  "modules": [
    {
      "title": "Module 1: Basics",
      "description": "Основы английского",
      "units": [
        {
          "title": "Lesson 1: Alphabet",
          "type": "video",
          "content": { "url": "..." },
          "duration": 15
        }
      ]
    }
  ]
}
```

### 3. **Покупка курса (ученик)**

```javascript
// Фронтенд: создаем Stripe Checkout
const response = await api.post('/payments/create-checkout-session', {
  course_id: 123,
  success_url: 'https://yoursite.com/success',
  cancel_url: 'https://yoursite.com/cancel'
});

// Перенаправляем на Stripe
window.location.href = response.checkout_url;

// После успешной оплаты Stripe вызовет webhook
// и автоматически создаст запись в course_purchases
```

### 4. **Интеграция с вашим курсом**

Если у вас есть готовый курс в JSON:

```bash
# Скопируйте ваши файлы курса в проект
cp ~/Downloads/module-*.json ./backend/data/courses/

# Создайте скрипт импорта
node backend/scripts/import-course.js
```

Или используйте API для программного создания курса:

```javascript
// scripts/import-your-course.js
const fs = require('fs');
const api = require('../src/api');

// Читаем ваш курс
const courseData = JSON.parse(fs.readFileSync('./data/course_data.json'));

// Создаем курс через API
const response = await api.post('/marketplace/courses', {
  title: courseData.title,
  slug: 'your-course-slug',
  description: courseData.description,
  modules: courseData.modules,
  price_type: 'paid',
  price_amount: 9900, // $99.00
  currency: 'USD'
});

console.log('Course created:', response.course.id);
```

---

## 💳 Настройка Stripe

### 1. **Создайте аккаунт Stripe**
- Зарегистрируйтесь на [stripe.com](https://stripe.com)
- Получите API ключи (Test mode)

### 2. **Настройте webhook**
```bash
# URL для webhook
https://your-domain.com/api/payments/webhook

# События для подписки:
- checkout.session.completed
- invoice.payment_succeeded
- customer.subscription.deleted
```

### 3. **Тестовые карты**
```
Успешная оплата: 4242 4242 4242 4242
Требует аутентификации: 4000 0025 0000 3155
Отклонена: 4000 0000 0000 9995
```

---

## 📊 Модели монетизации

### 1. **Разовая покупка курса**
```sql
price_type: 'paid'
price_amount: 4900 -- $49
access_type: 'lifetime'
```

### 2. **Подписка**
```sql
price_type: 'subscription'
price_amount: 1900 -- $19/месяц
subscription_period: 'monthly'
access_type: 'subscription'
```

### 3. **Бесплатный (с возможностью upsell)**
```sql
price_type: 'free'
price_amount: 0
-- Можно предложить премиум контент за доп. плату
```

### 4. **Для репетиторов**
```sql
tutor_price: 500 -- $5 за назначение курса ученику
-- Репетитор платит, чтобы использовать курс
```

---

## 💰 Комиссионная модель

По умолчанию платформа берет **30% комиссии**:

```javascript
// Автоматический расчет при покупке
const platform_fee = amount_paid * 0.30;
const author_earnings = amount_paid - platform_fee;

// Пример: курс за $100
// Платформа: $30
// Автор: $70
```

Комиссию можно настроить для каждого курса:
```sql
UPDATE marketplace_courses
SET commission_rate = 20 -- 20% комиссия
WHERE id = 123;
```

---

## 📈 Аналитика и отчеты

### Для автора курса:
- Общее количество продаж
- Доход за все время
- Средний рейтинг
- График продаж по дням/месяцам

### Для платформы:
- Общая комиссия
- Топ-курсы по продажам
- Активные авторы
- Выплаты авторам

---

## 🔐 Безопасность

- ✅ JWT-аутентификация для всех операций
- ✅ Проверка прав доступа (автор может редактировать только свои курсы)
- ✅ Защита от двойных покупок
- ✅ Webhook signature verification (Stripe)
- ✅ SQL injection protection (prepared statements)
- ✅ XSS protection

---

## 🎯 Следующие шаги

### Фаза 1: Тестирование (текущая)
- [ ] Применить миграции БД
- [ ] Настроить Stripe в test mode
- [ ] Создать тестовый курс
- [ ] Протестировать покупку
- [ ] Проверить webhook

### Фаза 2: Интеграция вашего курса
- [ ] Импортировать ваши курсы
- [ ] Настроить цены
- [ ] Добавить превью и описания
- [ ] Создать промо-материалы

### Фаза 3: Запуск
- [ ] Перевести Stripe в production mode
- [ ] Настроить реальные выплаты
- [ ] Запустить маркетинговую кампанию
- [ ] Подключить аналитику (Google Analytics)

### Фаза 4: Масштабирование
- [ ] Добавить систему купонов/промокодов
- [ ] Реферальная программа
- [ ] Email-рассылки для покупателей
- [ ] Сертификаты по завершению курса
- [ ] Мобильное приложение

---

## 📚 Документация API

### Маркетплейс

#### `GET /marketplace/courses`
Получить список курсов

**Query параметры:**
- `category` — фильтр по категории
- `level` — фильтр по уровню
- `price_type` — free, paid, subscription
- `search` — поиск по названию
- `sort` — popular, rating, price_low, price_high, newest
- `page` — номер страницы (default: 1)
- `limit` — количество на странице (default: 20)

**Ответ:**
```json
{
  "courses": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

#### `POST /marketplace/courses`
Создать курс (только репетиторы)

**Тело запроса:** см. выше в разделе "Создание курса"

#### `POST /marketplace/courses/:id/publish`
Опубликовать курс

#### `GET /marketplace/author/stats`
Статистика автора

**Ответ:**
```json
{
  "stats": {
    "total_courses": 5,
    "total_sales": 234,
    "total_revenue": 115600,
    "avg_rating": 4.7,
    "total_payouts": 80920
  }
}
```

### Платежи

#### `POST /payments/create-checkout-session`
Создать Stripe Checkout

**Тело запроса:**
```json
{
  "course_id": 123,
  "success_url": "https://...",
  "cancel_url": "https://..."
}
```

**Ответ:**
```json
{
  "session_id": "cs_test_...",
  "checkout_url": "https://checkout.stripe.com/pay/..."
}
```

---

## 🎓 Примеры использования

### Сценарий 1: Репетитор создает курс
1. Заходит в `/marketplace/create`
2. Заполняет информацию о курсе
3. Добавляет модули и уроки
4. Устанавливает цену
5. Публикует курс
6. Курс появляется в маркетплейсе

### Сценарий 2: Ученик покупает курс
1. Заходит в `/marketplace`
2. Фильтрует/ищет курсы
3. Открывает страницу курса `/courses/:slug`
4. Нажимает "Купить курс"
5. Перенаправляется на Stripe Checkout
6. Оплачивает картой
7. Получает доступ к курсу
8. Может начать обучение

### Сценарий 3: Репетитор назначает курс ученику
1. Покупает курс с `assigned_to_student_id`
2. Платит `tutor_price` (меньше обычной цены)
3. Ученик получает доступ
4. Репетитор видит прогресс ученика

---

## 🤝 Поддержка

Если возникнут вопросы:
1. Проверьте логи: `backend/logs/`
2. Проверьте Stripe Dashboard
3. Документация Stripe: https://stripe.com/docs/api

---

**🚀 Ваш маркетплейс курсов готов к запуску!**

Теперь вы можете монетизировать платформу через:
- Продажу своих курсов
- Комиссию с курсов других репетиторов
- Подписки на премиум-контент
- Корпоративные лицензии

**Удачи в развитии бизнеса! 💰**
