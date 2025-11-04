# Техническая документация: Crash Game Bot

### Компоненты системы
1. **Telegram Bot** (Telegraf) - основной интерфейс
2. **WebApp** (React + Vite + Tailwind) - игровой интерфейс
3. **Backend API** (Node.js + Express + Socket.IO) - бизнес-логика
4. **MTProto Client** (GramJS) - работа с Telegram Gifts (НЕ РЕАЛИЗОВАНО)
5. **Database** (PostgreSQL + Prisma) - основные данные
6. **Cache** (Redis) - сессии, очереди, кеш (НЕ РЕАЛИЗОВАНО)

### Технологический стек

**Backend**:
- Node.js + TypeScript
- Express.js (REST API)
- Socket.IO (WebSocket)
- Prisma (ORM)
- PostgreSQL (Database)
- Decimal.js (точные вычисления)
- Winston (логирование)
- Zod (валидация)

**Frontend**:
- React 18
- Vite (сборка)
- TypeScript
- Tailwind CSS
- Zustand (state management)
- Socket.IO Client
- i18next (мультиязычность)

**Shared**:
- Общие типы TypeScript
- Константы игры
- API интерфейсы

## 1. Telegram Bot

### Функциональность
- Команды: `/start`, `/help`
- Inline-клавиатура с кнопками:
  - "Играть" → открывает WebApp
  - "Наш канал" → ссылка на канал
  - "Пополнение" → WebApp/Balance
- Мультиязычность (RU/EN)

## 2. WebApp - структура навигации

#### 2.1 Маркет
**Описание**: Магазин Telegram Gifts с наценкой +10%

**Функциональность**:
- Получение списка подарков через MTProto API
- Отображение по 1 подарку каждого типа
- Карусель случайных превью
- Покупка случайного подарка из серии
- Цена = официальная цена + 10%

**API Endpoints**:
```
⚠️ НЕ РЕАЛИЗОВАНО - функционал в разработке
```

#### 2.2 Кейсы
**Описание**: Рулетка с подарками (аналог CS:GO кейсов)

**Планируемая функциональность**:
- Анимированная рулетка
- Различные типы кейсов с разной стоимостью
- Вероятности выпадения подарков
- История открытий

**API Endpoints**:
```
⚠️ НЕ РЕАЛИЗОВАНО - функционал в разработке
```

#### 2.3 Crash Game (Основная игра)
**Описание**: Игра "ракетка" с real-time мультиплеером

**Игровая механика**:
- **Фаза ставок**: 10 секунд (BETTING_PHASE_DURATION = 10000ms)
- **Фаза полета**: 20 секунд (FLYING_PHASE_DURATION = 20000ms)
- **Общая длительность раунда**: 30 секунд
- Можно ставить на следующий раунд во время текущего
- Ракета летит до заранее рассчитанного crashPoint
- Кнопка "Забрать" доступна только в фазе полета
- Мультипликатор обновляется каждые 100ms

**Валюты ставок**:
- **TON**: мин. 0.1, макс. 100.0 (настраивается через env)
- **Stars**: мин. 10, макс. 1000 (настраивается через env)
- **Gifts**: любой подарок (НЕ РЕАЛИЗОВАНО)

**Расчет выигрышей**:
- TON/Stars: `ставка × cashoutMultiplier - houseFee`
- House Fee: 1% (настраивается через env)
- Gifts: НЕ РЕАЛИЗОВАНО

**Provably Fair**:
- SHA-256 хеширование serverSeed + clientSeed
- HashedServerSeed показывается ДО раунда
- ServerSeed раскрывается ПОСЛЕ раунда
- Возможность верификации через API
- Максимальный мультипликатор: 100.0x (настраивается)

**WebSocket События** (Server → Client):
```
game:round_info - информация об активном раунде
game:round_start - начало нового раунда
game:multiplier_update - обновление мультипликатора
game:round_crashed - ракета упала
game:round_results - результаты раунда
game:bet_placed - ставка размещена
game:cashout_success - успешный кэшаут
game:error - ошибка
```

**WebSocket События** (Client → Server):
```
game:connect - подключиться к игре
game:place_bet - разместить ставку
game:cashout - забрать выигрыш
game:get_bet - получить информацию о ставке
```

#### 2.4 Баланс
**Описание**: Управление средствами пользователя

**Пополнение**:
- TON (через TonConnect)
- Stars (через Telegram Payment API)
- Gifts (отправка на бот-аккаунт)

**API Endpoints**:
```
POST /api/wallet/connect - подключить TON кошелек
POST /api/wallet/disconnect - отключить TON кошелек
GET /api/wallet/status - статус подключения кошелька
GET /api/wallet/balance - получить баланс (TON, Stars)
GET /api/wallet/transactions - история транзакций

POST /api/deposit/get - получить адрес для депозита TON
POST /api/deposit/stars - создать Stars invoice
```

#### 2.5 Заработок (Реферальная программа)
**Описание**: Двухуровневая реферальная система

**Basic рефералка** (по умолчанию):
- 10% с депозитов рефералов
- Доступна всем пользователям

**Plus рефералка** (ручная установка):
- 10% с депозитов рефералов
- 2 раза в месяц: 50% от проигранного рефералами
- Выдача через админ-панель

**API Endpoints**:
```
GET /api/referrals - список рефералов с пагинацией
```

## 3. Backend API

### Реализованные API Routes

**Wallet & Balance** (`/api/wallet/*`):
- `POST /api/wallet/connect` - подключить TON кошелек
- `POST /api/wallet/disconnect` - отключить кошелек
- `GET /api/wallet/status` - статус подключения
- `GET /api/wallet/balance` - баланс пользователя
- `GET /api/wallet/transactions` - история транзакций

**Deposits** (`/api/deposit/*`):
- `POST /api/deposit/get` - получить адрес для депозита TON
- `POST /api/deposit/stars` - создать Stars invoice

**Game** (`/api/game/*`):
- `POST /api/game/round/create` - создать новый раунд
- `GET /api/game/round/active` - получить активный раунд
- `GET /api/game/round/:roundId` - информация о раунде
- `GET /api/game/round/:roundId/bets` - все ставки в раунде
- `POST /api/game/bet/place` - разместить ставку
- `POST /api/game/bet/cashout` - кэшаут ставки
- `GET /api/game/bet/:betId` - информация о ставке

**Referrals** (`/api/referrals/*`):
- `GET /api/referrals` - список рефералов с пагинацией

### Основные модули

#### 3.1 Authentication & Users
```typescript
interface User {
  chatId: string;            // Telegram chat_id (PK)
  username?: string;
  firstname?: string;
  lastname?: string;
  active: boolean;
  status?: string;
  banned: boolean;
  lastActivity: Date;
  referrer?: string;         // chat_id реферера
  taskPoints: number;
  tonBalance: Decimal;       // Decimal(18,9)
  starsBalance: number;
  tonWalletAddress?: string; // Подключенный TON кошелек
  referralType: 'basic' | 'plus';
  tgLangCode?: string;       // Язык пользователя (ru/en)
  createdAt: Date;
  updatedAt: Date;
}
```

**Реализованные API endpoints**:
```
POST /api/wallet/connect - подключить TON кошелек
POST /api/wallet/disconnect - отключить кошелек
GET /api/wallet/status - статус кошелька
GET /api/wallet/balance - баланс пользователя
GET /api/wallet/transactions - история транзакций
```

#### 3.2 Game Engine
```typescript
interface GameRound {
  id: string;                // UUID
  crashPoint: Decimal;       // Decimal(8,2) - 1.00 до 1000.00
  serverSeed: string;        // Для Provably Fair
  hashedServerSeed: string;  // Публичный хеш
  status: 'betting' | 'flying' | 'crashed';
  houseFee: Decimal;         // Decimal(4,3) - 0.01 (1%)
  startTime: Date;
  endTime?: Date;
  createdAt: Date;
}

interface Bet {
  id: string;                // UUID
  chatId: string;            // Telegram chat_id
  roundId: string;           // UUID раунда
  amount: Decimal;           // Decimal(18,9)
  currency: 'ton' | 'stars' | 'gift';
  giftId?: string;           // UUID подарка (если ставка подарком)
  cashoutAt?: Decimal;       // Decimal(8,2) - мультипликатор кэшаута
  cashedOut: boolean;        // Флаг кэшаута
  profit?: Decimal;          // Decimal(18,9) - прибыль
  createdAt: Date;
}
```

**Реализованные API endpoints**:
```
POST /api/game/round/create - создать новый раунд
GET /api/game/round/active - получить активный раунд
GET /api/game/round/:roundId - информация о раунде
GET /api/game/round/:roundId/bets - все ставки в раунде
POST /api/game/bet/place - разместить ставку
POST /api/game/bet/cashout - кэшаут ставки
GET /api/game/bet/:betId - информация о ставке
```

#### 3.3 Gifts Management
```typescript
interface Gift {
  id: string;                    // UUID
  telegramGiftId: bigint;        // Уникальный ID из Telegram
  name: string;
  stickerFileId: string;         // file_id стикера
  originalPrice: number;         // Цена в Stars
  ourPrice: number;              // Наша цена (+10%)
  convertStars: number;          // Цена конвертации в Stars
  limited: boolean;
  availabilityTotal?: number;
  availabilityRemains?: number;
  active: boolean;
  updatedAt: Date;
}

interface UserGift {
  id: string;                    // UUID
  chatId: string;                // Telegram chat_id
  giftId: string;                // UUID подарка
  telegramMessageId: number;     // ID сообщения с подарком
  receivedAt: Date;
  displayOnProfile: boolean;
  converted: boolean;
}
```

**API endpoints**:
```
⚠️ НЕ РЕАЛИЗОВАНО - функционал в разработке
```

### 3.4 Provably Fair Implementation

**Реализованный алгоритм**:

```typescript
// Шаг 1: Генерация seeds
function generateServerSeed(): string {
  return crypto.randomBytes(32).toString('hex'); // 64 символа hex
}

function generateClientSeed(): string {
  return crypto.randomBytes(32).toString('hex'); // 64 символа hex
}

// Шаг 2: Вычисление хеша
function calculateHash(serverSeed: string, clientSeed: string): string {
  const combined = serverSeed + clientSeed;
  return crypto.createHash('sha256').update(combined).digest('hex');
}

// Шаг 3: Нормализация хеша (0-1)
function hashToNormalized(hash: string): number {
  const hashSubstring = hash.substring(0, 8);
  const hashInt = parseInt(hashSubstring, 16);
  const normalized = (hashInt % 10000) / 10000;
  return normalized;
}

// Шаг 4: Преобразование в мультипликатор
function normalizedToMultiplier(n: number): number {
  // Экспоненциальное распределение: multiplier = 1 / (1 - n)
  // n = 0.0  → multiplier = 1.0
  // n = 0.5  → multiplier = 2.0
  // n = 0.9  → multiplier = 10.0
  // n = 0.99 → multiplier = 100.0
  return 1.0 / (1.0 - n);
}

// Полный цикл генерации
function generateCrashMultiplier(serverSeed: string, clientSeed?: string): number {
  const finalClientSeed = clientSeed || '';
  const hash = calculateHash(serverSeed, finalClientSeed);
  const normalized = hashToNormalized(hash);
  let multiplier = normalizedToMultiplier(normalized);

  // Применяем ограничения из конфига
  const maxMult = getMaxMultiplier(); // По умолчанию 100.0
  multiplier = Math.min(multiplier, maxMult);
  multiplier = Math.max(multiplier, 1.0);

  // Округляем до 2 знаков
  return Math.round(multiplier * 100) / 100;
}

// Верификация раунда
function verifyRound(
  serverSeed: string,
  clientSeed: string,
  expectedMultiplier: number
): { verified: boolean; calculatedMultiplier: number } {
  const calculatedMultiplier = generateCrashMultiplier(serverSeed, clientSeed);
  const tolerance = 0.01;
  const verified = Math.abs(calculatedMultiplier - expectedMultiplier) < tolerance;

  return { verified, calculatedMultiplier };
}
```

**Особенности реализации**:
- ServerSeed генерируется на сервере и хешируется (SHA-256)
- HashedServerSeed показывается игрокам ДО начала раунда
- ServerSeed раскрывается ПОСЛЕ завершения раунда
- ClientSeed может быть предоставлен игроком (опционально)
- Мультипликатор ограничен MAX_MULTIPLIER (по умолчанию 100.0x)
- Поддержка динамического MAX_MULTIPLIER (опционально)

## 4. MTProto Integration

### Библиотека: GramJS

### Функциональность
- Получение списка подарков (`payments.getStarGifts`)
- Отправка подарков (`payments.getPaymentForm` с `inputInvoiceStarGift`)
- Конвертация подарков в Stars (`payments.convertStarGift`)

### Рабочий аккаунт
- Отдельный Telegram аккаунт для операций с подарками
- Авторизация через phone + код
- Хранение сессии в защищенном виде

## 5. Database Schema (PostgreSQL + Prisma)

### Enums
```typescript
enum ReferralType {
  basic
  plus
}

enum CurrencyType {
  ton
  stars
  gift
}

enum GameStatus {
  betting
  flying
  crashed
}

enum TransactionType {
  deposit
  withdrawal
  bet
  win
  referral_bonus
  gift_conversion
}

enum TransactionStatus {
  pending
  completed
  failed
  cancelled
}

enum ReferralEarningType {
  deposit_commission
  loss_commission
}
```

### Основные таблицы

#### users
```sql
CREATE TABLE users (
  chat_id VARCHAR(20) PRIMARY KEY,
  username VARCHAR(255),
  firstname VARCHAR(255),
  lastname VARCHAR(255),
  active BOOLEAN DEFAULT TRUE,
  status VARCHAR(100),
  banned BOOLEAN DEFAULT FALSE,
  last_activity TIMESTAMP DEFAULT NOW(),
  referrer VARCHAR(20) REFERENCES users(chat_id),
  task_points INTEGER DEFAULT 0,
  ton_balance DECIMAL(18,9) DEFAULT 0,
  stars_balance INTEGER DEFAULT 0,
  ton_wallet_address VARCHAR(100),              -- Подключенный TON кошелек
  referral_type referral_type_enum DEFAULT 'basic',
  tg_lang_code VARCHAR(10) DEFAULT 'ru',        -- Язык пользователя
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- ✅ CHECK constraints для защиты от отрицательных балансов
  CONSTRAINT check_ton_balance_non_negative CHECK (ton_balance >= 0),
  CONSTRAINT check_stars_balance_non_negative CHECK (stars_balance >= 0)
);
```

#### game_rounds
```sql
CREATE TABLE game_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crash_point DECIMAL(8,2) NOT NULL,
  server_seed VARCHAR(128) NOT NULL,
  hashed_server_seed VARCHAR(128) NOT NULL,
  status game_status_enum NOT NULL,
  house_fee DECIMAL(4,3) DEFAULT 0.01,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### bets
```sql
CREATE TABLE bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id VARCHAR(20) NOT NULL REFERENCES users(chat_id),
  round_id UUID NOT NULL REFERENCES game_rounds(id),
  amount DECIMAL(18,9) NOT NULL,
  currency currency_type_enum NOT NULL,
  gift_id UUID REFERENCES gifts(id),
  cashout_at DECIMAL(8,2),
  cashed_out BOOLEAN DEFAULT FALSE,
  profit DECIMAL(18,9),
  created_at TIMESTAMP DEFAULT NOW(),

  -- ✅ Уникальный индекс: один пользователь = одна ставка в раунде
  CONSTRAINT unique_user_bet_per_round UNIQUE (chat_id, round_id)
);
```

#### gifts
```sql
CREATE TABLE gifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_gift_id BIGINT UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  sticker_file_id VARCHAR(255) NOT NULL,
  original_price INTEGER NOT NULL,
  our_price INTEGER NOT NULL,
  convert_stars INTEGER NOT NULL,
  limited BOOLEAN DEFAULT FALSE,
  availability_total INTEGER,
  availability_remains INTEGER,
  active BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### user_gifts
```sql
CREATE TABLE user_gifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id VARCHAR(20) NOT NULL REFERENCES users(chat_id),
  gift_id UUID NOT NULL REFERENCES gifts(id),
  telegram_message_id INTEGER NOT NULL,
  received_at TIMESTAMP DEFAULT NOW(),
  display_on_profile BOOLEAN DEFAULT FALSE,
  converted BOOLEAN DEFAULT FALSE
);
```

#### transactions
```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id VARCHAR(20) NOT NULL REFERENCES users(chat_id),
  type transaction_type_enum NOT NULL,
  amount DECIMAL(18,9) NOT NULL,
  currency currency_type_enum NOT NULL,
  status transaction_status_enum DEFAULT 'pending',
  external_id VARCHAR(255),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### referral_earnings
```sql
CREATE TABLE referral_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_chat_id VARCHAR(20) NOT NULL REFERENCES users(chat_id),
  referred_chat_id VARCHAR(20) NOT NULL REFERENCES users(chat_id),
  transaction_id UUID NOT NULL REFERENCES transactions(id),
  amount DECIMAL(18,9) NOT NULL,
  currency currency_type_enum NOT NULL,
  type referral_earning_type_enum NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### deposit_monitoring_state
```sql
CREATE TABLE deposit_monitoring_state (
  id VARCHAR PRIMARY KEY DEFAULT 'singleton',
  network VARCHAR(20) NOT NULL,                 -- 'mainnet' | 'testnet'
  start_time INTEGER NOT NULL,                  -- Unix timestamp
  last_check_at TIMESTAMP DEFAULT NOW(),
  is_running BOOLEAN DEFAULT FALSE,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Важные особенности схемы

1. **Безопасность балансов**: CHECK constraints на уровне БД предотвращают отрицательные балансы
2. **Уникальность ставок**: Один пользователь может сделать только одну ставку в раунде
3. **Decimal для денег**: Все денежные суммы используют DECIMAL(18,9) для точности
4. **UUID для ID**: Все первичные ключи (кроме users) используют UUID
5. **Referrer chain**: Поддержка реферальной цепочки через self-reference в users

## 6. Real-time Architecture (Socket.IO)

### Namespace
- `/game` - игровой namespace для всех игровых событий

### Комнаты
- `round:{roundId}` - комната конкретного раунда

### События Server → Client
```typescript
interface ServerToClientEvents {
  // Игровые события
  'game:round_info': (data: {
    roundId: string;
    hashedServerSeed: string;
    status: string;
    serverTime: number;
    startTime: string;
    crashTime: number;
    bettingPhaseDuration: number;
    flyingPhaseDuration: number;
  }) => void;

  'game:round_start': (data: {
    roundId: string;
    hashedServerSeed: string;
    serverTime: number;
    startTime: string;
    crashTime: number;
    bettingPhaseDuration: number;
    flyingPhaseDuration: number;
  }) => void;

  'game:multiplier_update': (data: {
    multiplier: number;
    growthRate: number;
    serverTime: number;
  }) => void;

  'game:round_crashed': (data: {
    crashMultiplier: number;
    serverTime: number;
  }) => void;

  'game:round_results': (data: {
    roundId: string;
    crashMultiplier: number;
    serverTime: number;
  }) => void;

  'game:bet_placed': (data: {
    betId: string;
    amount: number;
    currency: string;
    status: string;
    serverTime: number;
  }) => void;

  'game:cashout_success': (data: {
    betId: string;
    cashoutAt: number;
    profit: string;
    status: string;
    serverTime: number;
  }) => void;

  'game:error': (data: { message: string }) => void;

  // Системные события
  'connect': () => void;
  'disconnect': () => void;
  'error': (error: string) => void;
}
```

### События Client → Server
```typescript
interface ClientToServerEvents {
  'game:connect': () => void;

  'game:place_bet': (data: {
    amount: number;
    currency: string;
  }) => void;

  'game:cashout': (data: {
    multiplier: number;
    clientTime: number;
  }) => void;

  'game:get_bet': (data: {
    betId: string;
  }) => void;
}
```

### Аутентификация
- Используется Telegram initData в `socket.handshake.auth.initData`
- Middleware валидирует initData перед подключением
- После валидации socket привязывается к `chatId` пользователя

---

### Конфигурация игры (Environment Variables)

**Игровые параметры**:
```bash
GAME_MAX_MULTIPLIER=100.0          # Максимальный мультипликатор
GAME_MAX_BET_TON=100.0             # Максимальная ставка в TON
GAME_MAX_BET_STARS=1000            # Максимальная ставка в Stars
MIN_BET_TON=0.1                    # Минимальная ставка в TON
MIN_BET_STARS=10                   # Минимальная ставка в Stars
HOUSE_FEE=0.01                     # Комиссия дома (1%)

# Динамический максимум (опционально)
GAME_ENABLE_DYNAMIC_MAX=false      # Включить динамический максимум
GAME_DYNAMIC_MAX_CYCLE_DAYS=20     # Цикл в днях
GAME_DYNAMIC_MAX_MIN=10.0          # Минимум цикла
GAME_DYNAMIC_MAX_MAX=100.0         # Максимум цикла
```

**Важные константы в коде**:
```typescript
// backend/src/config/gameConfig.ts
BETTING_PHASE_DURATION: 10000      // 10 секунд
FLYING_PHASE_DURATION: 20000       // 20 секунд
TOTAL_ROUND_DURATION: 30000        // 30 секунд
MULTIPLIER_UPDATE_INTERVAL: 100    // 100ms (10 обновлений/сек)
TARGET_RTP: 0.95                   // 95% RTP
```
