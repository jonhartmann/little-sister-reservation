CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,
  email      VARCHAR(255) UNIQUE NOT NULL,
  first_name VARCHAR(100),
  last_name  VARCHAR(100),
  is_admin   BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_tokens (
  id         SERIAL PRIMARY KEY,
  email      VARCHAR(255) NOT NULL,
  token      VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at    TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reservations (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  description TEXT,
  status      VARCHAR(20) DEFAULT 'pending'
                CHECK (status IN ('pending','approved','denied','cancelled','expired','complete')),
  admin_note  TEXT,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservations_calendar
  ON reservations (start_date, end_date)
  WHERE status = 'approved';

CREATE INDEX IF NOT EXISTS idx_reservations_status_end
  ON reservations (status, end_date);

CREATE INDEX IF NOT EXISTS idx_sessions_token
  ON sessions (token)
  WHERE expires_at > NOW();
