# 🚀 Crash Game Bot

Telegram мини-приложение с crash игрой, поддержкой TON, Telegram Stars и подарков.

## 🏗️ Архитектура

- **Backend**: Node.js + TypeScript + Express + Socket.IO + Prisma
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Database**: PostgreSQL + Redis
- **Интеграции**: Telegram Bot API, MTProto (подарки), TON blockchain

## 🚀 Быстрый старт

### Предварительные требования

- Node.js 18+
- Docker & Docker Compose
- Git

### 1. Клонирование и настройка

```bash
git clone <repository-url>
cd CrashGameBot

# Копирование примера конфигурации
cp backend/env.example backend/.env
```

### 2. Настройка переменных окружения

Отредактируйте `backend/.env`:

```env
# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_API_ID=your_api_id
TELEGRAM_API_HASH=your_api_hash

# Остальные переменные...
```

### 3. Запуск с Docker

```bash
# Запуск базы данных и Redis
docker-compose up -d postgres redis

# Проверка статуса
docker-compose ps
```

### 4. Установка зависимостей

```bash
# Backend
cd backend
npm install
npm run prisma:generate
npm run prisma:push

# Frontend  
cd ../frontend
npm install
```

### 5. Запуск в режиме разработки

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

## 🛠️ Разработка

### Полезные команды

```bash
# Prisma
npm run prisma:generate    # Генерация клиента
npm run prisma:push        # Синхронизация схемы
npm run prisma:studio      # GUI для БД
```

### База данных

Подключение к PostgreSQL:
```bash
# Через Docker
docker exec -it crashgamebot-postgres psql -U crashgamebot -d crashgamebot

# Локально (если установлен PostgreSQL)
psql postgresql://crashgamebot:password123@localhost:5432/crashgamebot
```

### Redis

```bash
# Подключение к Redis
docker exec -it crashgamebot-redis redis-cli -a redis123
```

## 🔧 Конфигурация

### Backend порты
- API сервер: `3000`
- Socket.IO: `3000` (тот же порт)

### Frontend порты  
- Dev server: `5173`
- Preview: `4173`

### База данных
- PostgreSQL: `5432`
- Redis: `6379`
