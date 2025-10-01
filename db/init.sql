-- Extensions PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Table des événements
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    type VARCHAR(100),
    date DATE NOT NULL,
    description TEXT,
    address TEXT, -- Adresse de l'événement
    location GEOGRAPHY(POINT, 4326) NOT NULL, -- Coordonnées GPS
    position INT DEFAULT 0 -- Position/ordre pour numérotation des pins
);

-- Exemple d’événement
INSERT INTO events (title, type, date, description, address, location, position)
VALUES (
    'Concert de Jazz',
    'Concert',
    CURRENT_DATE + INTERVAL '7 days',
    'Concert en plein air au centre-ville',
    'Paris, France',
    ST_GeogFromText('SRID=4326;POINT(2.3522 48.8566)'),
    1
);

-- Table des utilisateurs
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL
);

-- Ajouter un utilisateur admin
-- Mot de passe : password
INSERT INTO users (username, password_hash, role)
VALUES (
    'admin',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'admin'
);
