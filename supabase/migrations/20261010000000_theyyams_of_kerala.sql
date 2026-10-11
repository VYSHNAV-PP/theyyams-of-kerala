-- Theyyams of Kerala: schema alignment and taxonomy change.
--
-- Safe to run more than once. Nothing is deleted.
--
-- 1. Brings the repository in line with columns the app already relies on
--    (they existed in the live database but in no earlier migration).
-- 2. Replaces the old event categories with Theyyam families.
-- 3. Archives (hides) listings that belong to the old, generic events site.

-- 1. Columns used by the app ------------------------------------------------------
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS image_candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source_types text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS registration_start date,
  ADD COLUMN IF NOT EXISTS registration_end date,
  ADD COLUMN IF NOT EXISTS downvotes integer NOT NULL DEFAULT 0;

-- The app maps 'ticket' and 'paid' to the same thing, so accept both.
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_entry_status_chk;
ALTER TABLE public.events
  ADD CONSTRAINT events_entry_status_chk CHECK (entry_status IN ('free','paid','registration','ticket'));

-- 2. Theyyam families --------------------------------------------------------------
--    category    = family ("Goddess", "Vishnu & Shiva", ...)
--    subcategory = the named form ("Muchilottu Bhagavathi", ...)
--    The old values stay allowed so existing rows remain valid; they are archived below.
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_category_v2;
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_category_v3;
ALTER TABLE public.events
  ADD CONSTRAINT events_category_v3 CHECK (category IN (
    'Goddess','Vishnu & Shiva','Heroes & Ancestors','Spirits & Guardians','Other',
    -- legacy values from the generic Kerala events site (archived below)
    'Sports','Cultural','Religious','Entertainment','Educational','Community/Public'
  ));

-- 3. Archive the old generic listings ----------------------------------------------
-- The earlier demo "Kannur Theyyam" entry is kept and simply re-labelled.
UPDATE public.events
   SET category = 'Other', subcategory = 'Theyyam'
 WHERE id = 'kannur-theyyam' AND category IN ('Religious','Cultural');

-- Everything else from the old categories is hidden from the public site (status 'rejected').
-- To bring a row back:  UPDATE public.events SET status = 'published', category = 'Other' WHERE id = '...';
UPDATE public.events
   SET status = 'rejected'
 WHERE category IN ('Sports','Cultural','Religious','Entertainment','Educational','Community/Public')
   AND status = 'published';
