-- =========================
-- 1. Ensure PostGIS is enabled
-- =========================
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- =========================
-- 2. Create collections table if missing
-- =========================
CREATE TABLE IF NOT EXISTS collections (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =========================
-- 3. Add collection_id column if missing
-- =========================
ALTER TABLE events ADD COLUMN IF NOT EXISTS collection_id INT;

-- =========================
-- 4. Ensure 'Default' collection exists
-- =========================
INSERT INTO collections (name)
VALUES ('Default')
ON CONFLICT (name) DO NOTHING;

-- =========================
-- 5. Link existing events to 'Default' collection
-- =========================
UPDATE events
SET collection_id = (SELECT id FROM collections WHERE name = 'Default')
WHERE collection_id IS NULL;

-- =========================
-- 6. Add foreign key constraint if not exists
-- =========================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_collection'
    ) THEN
        ALTER TABLE events
          ADD CONSTRAINT fk_collection
          FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE;
    END IF;
END$$;

-- =========================
-- 7. Optional: Create default admin user (password: "password")
-- =========================
INSERT INTO users (username, password_hash, role)
VALUES (
    'admin',
    '$2b$10$lMwzskQjgQjBT39rTjUpueMZ4AC9KXaPJuHQg.YTXh7aEIFcDuRo.',
    'admin'
)
ON CONFLICT (username) DO NOTHING;
