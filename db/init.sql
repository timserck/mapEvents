CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Table des événements
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    type VARCHAR(100),
    date DATE NOT NULL,
    description TEXT,
    location GEOGRAPHY(POINT, 4326) NOT NULL  -- géolocalisation
);

-- Exemple d’événement inséré automatiquement
INSERT INTO events (title, type, date, description, location)
VALUES (
    'Concert de Jazz',
    'Concert',
    CURRENT_DATE + INTERVAL '7 days',
    'Concert en plein air au centre-ville',
    ST_GeogFromText('SRID=4326;POINT(2.3522 48.8566)')
);
