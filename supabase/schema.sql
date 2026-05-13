-- Taula Systems: Schema SQL per Supabase
-- Executar aquest fitxer al SQL Editor de Supabase

-- Crear taula restaurants
CREATE TABLE IF NOT EXISTS restaurants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  phone TEXT,
  email TEXT,
  schedule JSONB DEFAULT '{}',
  max_capacity INTEGER DEFAULT 50,
  group_threshold INTEGER DEFAULT 8,
  whatsapp_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crear taula reservations
CREATE TABLE IF NOT EXISTS reservations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time TEXT NOT NULL,
  party_size INTEGER NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  allergies TEXT[] DEFAULT '{}',
  special_occasion TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índexs
CREATE INDEX IF NOT EXISTS idx_reservations_restaurant_id ON reservations(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_reservations_date ON reservations(date);
CREATE INDEX IF NOT EXISTS idx_restaurants_slug ON restaurants(slug);

-- Inserir restaurant de prova "El Sortidor"
INSERT INTO restaurants (name, slug, phone, email, schedule, max_capacity, group_threshold, whatsapp_number)
VALUES (
  'El Sortidor',
  'el-sortidor',
  '+34 93 000 0000',
  'info@elsortidor.cat',
  '{
    "monday": null,
    "tuesday": null,
    "wednesday": null,
    "thursday": {"lunch": "13:00-17:00", "dinner": "20:00-22:30"},
    "friday": {"lunch": "13:00-17:00", "dinner": "20:00-22:30"},
    "saturday": {"lunch": "13:00-17:00", "dinner": "20:00-22:30"},
    "sunday": {"lunch": "13:00-17:00"}
  }',
  60,
  8,
  '+34930000000'
)
ON CONFLICT (slug) DO NOTHING;

-- RLS (Row Level Security) - opcional per ara
-- ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- Policy per lectura pública de restaurants
-- CREATE POLICY "Restaurants públics" ON restaurants FOR SELECT USING (true);

-- Policy per insertar reservations des del client
-- CREATE POLICY "Crear reserva" ON reservations FOR INSERT WITH CHECK (true);
