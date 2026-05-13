-- Migration v2: Personalització per restaurant
-- Executar al SQL Editor de Supabase

-- Afegir camps de personalització a la taula restaurants
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#2563EB',
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS welcome_message TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT;

-- Restaurant Demo (per ensenyar el producte a clients potencials)
INSERT INTO restaurants (name, slug, phone, email, schedule, max_capacity, group_threshold, whatsapp_number, primary_color, welcome_message, address, city)
VALUES (
  'Restaurant Demo',
  'demo',
  '+34 93 000 0001',
  'info@demo.cat',
  '{
    "monday": null,
    "tuesday": null,
    "wednesday": {"lunch": "13:00-16:00", "dinner": "20:00-22:30"},
    "thursday": {"lunch": "13:00-16:00", "dinner": "20:00-22:30"},
    "friday": {"lunch": "13:00-16:00", "dinner": "20:00-22:30"},
    "saturday": {"lunch": "13:00-16:00", "dinner": "20:00-22:30"},
    "sunday": {"lunch": "13:00-16:00"}
  }',
  50,
  8,
  '+34930000001',
  '#2563EB',
  'Benvingut! Reserva la teva taula de forma fàcil i ràpida.',
  'Carrer de la Demostració, 1',
  'Barcelona'
)
ON CONFLICT (slug) DO NOTHING;

-- Actualitzar El Sortidor amb personalització
UPDATE restaurants SET
  primary_color = '#1B4332',
  welcome_message = 'Cuina de mercat al cor del Poble Sec. Reserva la teva taula.',
  address = 'Plaça de la Font, 15',
  city = 'Barcelona'
WHERE slug = 'el-sortidor';
