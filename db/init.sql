-- ===============================
-- Extensions
-- ===============================
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- ===============================
-- Collections table
-- ===============================
CREATE TABLE IF NOT EXISTS collections (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Default collection
INSERT INTO collections (name)
VALUES ('Default')
ON CONFLICT (name) DO NOTHING;

-- ===============================
-- Events table
-- ===============================
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    type VARCHAR(100),
    date DATE NOT NULL,
    description TEXT,
    address TEXT,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    position INT DEFAULT 0,
    collection_id INT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    favorite BOOLEAN DEFAULT FALSE
);

-- Sample event
INSERT INTO events (title, type, date, description, address, location, position, collection_id, favorite)
VALUES (
    'Concert de Jazz',
    'Concert',
    CURRENT_DATE + INTERVAL '7 days',
    'Concert en plein air au centre-ville',
    'Paris, France',
    ST_GeogFromText('SRID=4326;POINT(2.3522 48.8566)'),
    1,
    (SELECT id FROM collections WHERE name='Default'),
    FALSE
)
ON CONFLICT DO NOTHING;

-- ===============================
-- Users table
-- ===============================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL
);

-- Admin user (password: password)
INSERT INTO users (username, password_hash, role)
VALUES (
    'admin',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'admin'
)
ON CONFLICT (username) DO NOTHING;


CREATE TABLE IF NOT EXISTS active_collection (
  id SERIAL PRIMARY KEY,
  collection_name TEXT UNIQUE NOT NULL
);
INSERT INTO active_collection (collection_name) VALUES ('Default') ON CONFLICT DO NOTHING;

