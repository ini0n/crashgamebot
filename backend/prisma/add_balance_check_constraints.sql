-- Эти constraints гарантируют, что баланс НИКОГДА не станет отрицательным на уровне БД.
-- Даже если в коде есть race condition, PostgreSQL отклонит транзакцию.
--
-- Применение:
-- 1. Запустите PostgreSQL
-- 2. Выполните: psql -U postgres -d crashgamebot -f backend/prisma/add_balance_check_constraints.sql
-- 
-- Или через Prisma (когда БД запущена):
-- 1. Создайте пустую миграцию: npx prisma migrate dev --name add_balance_check_constraints --create-only
-- 2. Скопируйте содержимое этого файла в созданную миграцию
-- 3. Примените: npx prisma migrate dev

-- Добавляем CHECK constraint для ton_balance
ALTER TABLE "users"
ADD CONSTRAINT "check_ton_balance_non_negative"
CHECK ("ton_balance" >= 0);

-- Добавляем CHECK constraint для stars_balance
ALTER TABLE "users"
ADD CONSTRAINT "check_stars_balance_non_negative"
CHECK ("stars_balance" >= 0);

-- Проверяем, что constraints созданы
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'users'::regclass
  AND contype = 'c';

