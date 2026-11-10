-- server/schema.sql
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  fluffies INTEGER DEFAULT 100,  -- Валюта (Пушистики)
  inventory TEXT DEFAULT '["🍎", "🍣"]', -- Инвентарь (храним как JSON массив)
  friends TEXT DEFAULT '[]', -- Друзья (JSON массив никнеймов)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);