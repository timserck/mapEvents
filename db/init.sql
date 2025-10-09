-- Extensions PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Table des collections
CREATE TABLE IF NOT EXISTS collections (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Table des événements
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    type VARCHAR(100),
    date DATE NOT NULL,
    description TEXT,
    address TEXT, -- Adresse de l'événement
    location GEOGRAPHY(POINT, 4326) NOT NULL, -- Coordonnées GPS
    position INT DEFAULT 0, -- Position/ordre pour numérotation des pins
    collection_id INT NOT NULL REFERENCES collections(id) ON DELETE CASCADE
);

-- Exemple de collection
INSERT INTO collections (name)
VALUES ('Default')
ON CONFLICT (name) DO NOTHING;

-- Exemple d’événement
INSERT INTO events (title, type, date, description, address, location, position, collection_id)
VALUES (
    'Concert de Jazz',
    'Concert',
    CURRENT_DATE + INTERVAL '7 days',
    'Concert en plein air au centre-ville',
    'Paris, France',
    ST_GeogFromText('SRID=4326;POINT(2.3522 48.8566)'),
    1,
    (SELECT id FROM collections WHERE name = 'Default')
)
ON CONFLICT DO NOTHING;

-- Table des utilisateurs
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL
);

-- Ajouter un utilisateur admin (mot de passe : password)
INSERT INTO users (username, password_hash, role)
VALUES (
    'admin',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'admin'
)
ON CONFLICT (username) DO NOTHING;

-- Étape 1 : Ajouter la colonne collection_id si elle n'existe pas
ALTER TABLE events ADD COLUMN IF NOT EXISTS collection_id INT;

-- Étape 2 : Mettre à jour tous les événements pour les rattacher à la collection Default
UPDATE events
SET collection_id = (SELECT id FROM collections WHERE name = 'Default')
WHERE collection_id IS NULL;

-- Étape 3 : Supprimer l'ancienne colonne collection si elle existe
ALTER TABLE events DROP COLUMN IF EXISTS collection;

-- Étape 4 : Ajouter la contrainte de clé étrangère si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_collection'
    ) THEN
        ALTER TABLE events
        ADD CONSTRAINT fk_collection
        FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE;
    END IF;
END$$;
