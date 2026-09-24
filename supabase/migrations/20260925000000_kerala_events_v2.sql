-- Kerala Events v2: new taxonomy, richer event model, reports, lifecycle, posters.
-- Additive: existing rows are migrated in place.

-- 1. Columns ---------------------------------------------------------------
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_category_check;
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS subcategory text,
  ADD COLUMN IF NOT EXISTS locality text,
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS end_time time,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS entry_status text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS entry_fee text,
  ADD COLUMN IF NOT EXISTS contact text,
  ADD COLUMN IF NOT EXISTS ticket_url text,
  ADD COLUMN IF NOT EXISTS instagram text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS other_url text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published';

-- 2. Map old categories into the new system (specific events first) -------------
UPDATE public.events e SET category = m.c, subcategory = m.s
FROM (VALUES
  ('thrissur-pooram','Religious','Religious Festival'),
  ('kannur-theyyam','Religious','Temple Programme'),
  ('kochi-biennale-talk','Cultural','Art'),
  ('boat-race-practice','Sports','Other Sports'),
  ('munnar-trail','Sports','Athletics'),
  ('tvm-indie-night','Entertainment','Live Music'),
  ('kozhikode-food-walk','Community/Public','Community Gathering'),
  ('wayanad-coffee','Educational','Workshop')
) AS m(id,c,s) WHERE e.id = m.id;

UPDATE public.events SET category='Community/Public', subcategory='Local Festival' WHERE subcategory IS NULL AND category='Festival';
UPDATE public.events SET category='Entertainment',    subcategory='Live Music'     WHERE subcategory IS NULL AND category='Music';
UPDATE public.events SET category='Educational',      subcategory='Workshop'       WHERE subcategory IS NULL AND category='Workshop';
UPDATE public.events SET category='Sports',           subcategory='Other Sports'   WHERE subcategory IS NULL AND category='Sports';
UPDATE public.events SET category='Community/Public', subcategory='Community Gathering' WHERE subcategory IS NULL AND category='Food';
UPDATE public.events SET category='Cultural',         subcategory='Art'            WHERE subcategory IS NULL AND category='Art';
UPDATE public.events SET category='Other',            subcategory='Other'          WHERE subcategory IS NULL;

-- 3. Backfill the rest ---------------------------------------------------------
UPDATE public.events e SET locality = m.l
FROM (VALUES
  ('thrissur-pooram','Thrissur'),('kochi-biennale-talk','Fort Kochi'),('boat-race-practice','Alappuzha'),
  ('tvm-indie-night','Kanakakkunnu'),('kozhikode-food-walk','Kozhikode'),('wayanad-coffee','Kalpetta'),
  ('kannur-theyyam','Parassinikkadavu'),('munnar-trail','Munnar')
) AS m(id,l) WHERE e.id = m.id;
UPDATE public.events SET locality = district WHERE locality IS NULL;
UPDATE public.events SET start_time = time::time WHERE start_time IS NULL;
UPDATE public.events SET end_time = (start_time + interval '3 hours')::time WHERE end_time IS NULL AND start_time < time '21:00';
UPDATE public.events SET website = link WHERE website IS NULL AND link IS NOT NULL;
UPDATE public.events SET end_date = date WHERE end_date IS NULL;

-- 4. Trigger: derive starts_at / ends_at (Asia/Kolkata) and validate -----------
CREATE OR REPLACE FUNCTION public.events_derive_times() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.start_time := COALESCE(NEW.start_time, NEW.time::time);
  NEW.time := to_char(NEW.start_time, 'HH24:MI');
  NEW.end_date := COALESCE(NEW.end_date, NEW.date);
  NEW.starts_at := (NEW.date + NEW.start_time) AT TIME ZONE 'Asia/Kolkata';
  NEW.ends_at := CASE WHEN NEW.end_time IS NULL
    THEN NEW.starts_at + interval '3 hours'
    ELSE (NEW.end_date + NEW.end_time) AT TIME ZONE 'Asia/Kolkata' END;
  IF NEW.ends_at < NEW.starts_at THEN RAISE EXCEPTION 'event must end after it starts'; END IF;
  IF TG_OP = 'INSERT' AND NEW.ends_at < now() THEN RAISE EXCEPTION 'event is already over'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS events_derive_times ON public.events;
CREATE TRIGGER events_derive_times BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.events_derive_times();
UPDATE public.events SET id = id; -- fire trigger for existing rows (ended-guard only applies on INSERT)

-- 5. Constraints ---------------------------------------------------------------
ALTER TABLE public.events
  ALTER COLUMN subcategory SET NOT NULL,
  ALTER COLUMN locality SET NOT NULL,
  ALTER COLUMN start_time SET NOT NULL,
  ALTER COLUMN starts_at SET NOT NULL,
  ALTER COLUMN ends_at SET NOT NULL,
  ADD CONSTRAINT events_category_v2 CHECK (category IN ('Sports','Cultural','Religious','Entertainment','Educational','Community/Public','Other')),
  ADD CONSTRAINT events_subcategory_len CHECK (char_length(subcategory) BETWEEN 2 AND 50),
  ADD CONSTRAINT events_locality_len CHECK (char_length(locality) BETWEEN 2 AND 100),
  ADD CONSTRAINT events_entry_status_chk CHECK (entry_status IN ('free','paid','registration')),
  ADD CONSTRAINT events_entry_fee_len CHECK (entry_fee IS NULL OR char_length(entry_fee) <= 60),
  ADD CONSTRAINT events_contact_len CHECK (contact IS NULL OR char_length(contact) <= 100),
  ADD CONSTRAINT events_status_chk CHECK (status IN ('pending','published','rejected')),
  ADD CONSTRAINT events_district_chk CHECK (district IN ('Thiruvananthapuram','Kollam','Pathanamthitta','Alappuzha','Kottayam','Idukki','Ernakulam','Thrissur','Palakkad','Malappuram','Kozhikode','Wayanad','Kannur','Kasaragod')),
  ADD CONSTRAINT events_urls_chk CHECK (
    (ticket_url IS NULL OR (ticket_url LIKE 'https://%' AND char_length(ticket_url) <= 300)) AND
    (instagram  IS NULL OR (instagram  LIKE 'https://%' AND char_length(instagram)  <= 300)) AND
    (website    IS NULL OR (website    LIKE 'https://%' AND char_length(website)    <= 300)) AND
    (other_url  IS NULL OR (other_url  LIKE 'https://%' AND char_length(other_url)  <= 300)) AND
    (image_url  IS NULL OR (image_url  LIKE 'https://%' AND char_length(image_url)  <= 500)));

-- 6. Indexes -------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS events_ends_at_idx ON public.events (ends_at);
CREATE INDEX IF NOT EXISTS events_starts_at_idx ON public.events (starts_at);
CREATE INDEX IF NOT EXISTS events_district_idx ON public.events (district, starts_at);
CREATE INDEX IF NOT EXISTS events_category_idx ON public.events (category, subcategory);
CREATE INDEX IF NOT EXISTS events_geo_idx ON public.events (lat, lng);

-- 7. RLS: only published rows are public; inserts cannot forge counters/status -
DROP POLICY IF EXISTS "Anyone can read events" ON public.events;
DROP POLICY IF EXISTS "Anyone can add events" ON public.events;
CREATE POLICY "Public reads published events" ON public.events FOR SELECT USING (status = 'published');
CREATE POLICY "Public adds events" ON public.events FOR INSERT
  WITH CHECK (upvotes = 0 AND reports = 0 AND status = 'published'); -- switch to 'pending' when moderation is enabled

-- 8. Confirmations (existing cast_vote, now confirm-only) and reports ------------
CREATE OR REPLACE FUNCTION public.cast_vote(_event_id text, _voter_id text, _kind text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _kind <> 'up' OR char_length(_voter_id) NOT BETWEEN 8 AND 64 THEN RAISE EXCEPTION 'invalid confirmation'; END IF;
  INSERT INTO event_votes(event_id, voter_id, kind) VALUES (_event_id, _voter_id, 'up') ON CONFLICT DO NOTHING;
  IF FOUND THEN UPDATE events SET upvotes = upvotes + 1 WHERE id = _event_id; END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.event_reports (
  event_id text NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  reporter_id text NOT NULL,
  reason text NOT NULL CHECK (reason IN ('cancelled','wrong_datetime','wrong_location','incorrect_info','duplicate','ended','spam','other')),
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, reporter_id)
);
ALTER TABLE public.event_reports ENABLE ROW LEVEL SECURITY; -- no policies: writable only via report_event()
GRANT ALL ON public.event_reports TO service_role;

CREATE OR REPLACE FUNCTION public.report_event(_event_id text, _reporter_id text, _reason text, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF char_length(_reporter_id) NOT BETWEEN 8 AND 64 THEN RAISE EXCEPTION 'invalid reporter'; END IF;
  INSERT INTO event_reports(event_id, reporter_id, reason, note) VALUES (_event_id, _reporter_id, _reason, left(_note, 500))
  ON CONFLICT DO NOTHING;
  IF FOUND THEN UPDATE events SET reports = reports + 1 WHERE id = _event_id; END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.report_event(text,text,text,text) TO anon, authenticated;

-- 9. Poster storage ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('event-posters','event-posters',true, 2097152, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Anyone can upload posters" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'event-posters');
CREATE POLICY "Anyone can view posters" ON storage.objects FOR SELECT USING (bucket_id = 'event-posters');
