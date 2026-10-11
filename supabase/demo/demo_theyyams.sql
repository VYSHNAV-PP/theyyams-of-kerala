-- DEMO DATA, FOR TESTING THE INTERFACE ONLY.
--
-- These are NOT real schedules. Dates are relative to the moment you run this file so that the
-- Now / Tonight / Upcoming tabs all have something in them. Do not leave it on a public site.
--
-- Run in the Supabase SQL editor (it is deliberately not in supabase/migrations).
-- Remove again with:   DELETE FROM public.events WHERE id LIKE 'demo-%';

INSERT INTO public.events
  (id, title, category, subcategory, description, date, end_date, start_time, end_time,
   venue, locality, district, lat, lng, entry_status, status)
SELECT
  v.id, v.title, v.category, v.subcategory,
  'Sample entry for testing the interface, not a real schedule. ' || v.note,
  (now() AT TIME ZONE 'Asia/Kolkata' + v.starts_in)::date,
  (now() AT TIME ZONE 'Asia/Kolkata' + v.starts_in + v.lasts)::date,
  (now() AT TIME ZONE 'Asia/Kolkata' + v.starts_in)::time,
  (now() AT TIME ZONE 'Asia/Kolkata' + v.starts_in + v.lasts)::time,
  v.venue, v.locality, v.district, v.lat, v.lng, 'free', 'published'
FROM (VALUES
  ('demo-gulikan-azhikode',   'Gulikan Theyyam',                'Spirits & Guardians', 'Gulikan',               'Late-night performance.',        interval '-1 hour',   interval '5 hours', 'Sample Kavu',    'Azhikode',         'Kannur',     11.9333, 75.3333),
  ('demo-muchilottu-kottiyoor','Muchilottu Bhagavathi Theyyam', 'Goddess',             'Muchilottu Bhagavathi','Kaliyattam night.',              interval '-2 hours',  interval '6 hours', 'Sample Kavu',    'Kottiyoor',        'Kannur',     11.8667, 75.9167),
  ('demo-muthappan-parassini','Muthappan Vellattam',            'Vishnu & Shiva',      'Muthappan',            'Vellattam at the temple.',       interval '1 hour',    interval '7 hours', 'Sample Madappura','Parassinikkadavu', 'Kannur',     11.9667, 75.3667),
  ('demo-vishnumoorthi-payyanur','Vishnumoorthi Theyyam',       'Vishnu & Shiva',      'Vishnumoorthi',        'Annual festival.',               interval '2 hours',   interval '8 hours', 'Sample Kavu',    'Payyanur',         'Kannur',     12.1000, 75.2000),
  ('demo-chamundi-nileshwar', 'Raktha Chamundi Theyyam',        'Goddess',             'Raktha Chamundi',      'Two-night Kaliyattam.',          interval '1 day',     interval '26 hours','Sample Kavu',    'Nileshwar',        'Kasaragod',  12.2556, 75.1333),
  ('demo-pottan-kanhangad',   'Pottan Theyyam',                 'Vishnu & Shiva',      'Pottan Theyyam',       'Morning performance.',           interval '3 days',    interval '4 hours', 'Sample Kavu',    'Kanhangad',        'Kasaragod',  12.3000, 75.0833),
  ('demo-kelan-mattannur',    'Kandanar Kelan Theyyam',         'Heroes & Ancestors',  'Kandanar Kelan',       'Evening performance.',           interval '5 days',    interval '7 hours', 'Sample Tharavad','Mattannur',        'Kannur',     11.9333, 75.5667),
  ('demo-bhadrakali-kozhikode','Bhadrakali Theyyam',            'Goddess',             'Bhadrakali',           'Annual festival.',               interval '9 days',    interval '8 hours', 'Sample Kavu',    'Kozhikode',        'Kozhikode',  11.2500, 75.7800)
) AS v(id, title, category, subcategory, note, starts_in, lasts, venue, locality, district, lat, lng)
ON CONFLICT (id) DO NOTHING;
