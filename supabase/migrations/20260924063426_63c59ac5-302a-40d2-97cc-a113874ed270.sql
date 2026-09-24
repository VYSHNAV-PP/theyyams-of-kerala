CREATE TABLE public.events (
  id text PRIMARY KEY,
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 100),
  category text NOT NULL CHECK (category IN ('Festival','Music','Workshop','Sports','Food','Art')),
  district text NOT NULL,
  venue text NOT NULL CHECK (char_length(venue) <= 150),
  lat double precision NOT NULL CHECK (lat BETWEEN 8 AND 13),
  lng double precision NOT NULL CHECK (lng BETWEEN 74 AND 78),
  date date NOT NULL,
  time text NOT NULL,
  description text NOT NULL CHECK (char_length(description) <= 1000),
  link text CHECK (link IS NULL OR (link LIKE 'https://%' AND char_length(link) <= 300)),
  upvotes int NOT NULL DEFAULT 0,
  reports int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.events TO anon, authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read events" ON public.events FOR SELECT USING (true);
CREATE POLICY "Anyone can add events" ON public.events FOR INSERT WITH CHECK (upvotes = 0 AND reports = 0);

CREATE TABLE public.event_votes (
  event_id text NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  voter_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('up','report')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, voter_id)
);
GRANT ALL ON public.event_votes TO service_role;
ALTER TABLE public.event_votes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.cast_vote(_event_id text, _voter_id text, _kind text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _kind NOT IN ('up','report') OR char_length(_voter_id) NOT BETWEEN 8 AND 64 THEN
    RAISE EXCEPTION 'invalid vote';
  END IF;
  INSERT INTO event_votes(event_id, voter_id, kind) VALUES (_event_id, _voter_id, _kind)
  ON CONFLICT DO NOTHING;
  IF FOUND THEN
    IF _kind = 'up' THEN UPDATE events SET upvotes = upvotes + 1 WHERE id = _event_id;
    ELSE UPDATE events SET reports = reports + 1 WHERE id = _event_id; END IF;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.cast_vote(text,text,text) TO anon, authenticated;

INSERT INTO public.events (id,title,category,district,venue,lat,lng,date,time,description,link) VALUES
('thrissur-pooram','Thrissur Pooram','Festival','Thrissur','Vadakkunnathan Temple grounds',10.5246,76.2144,'2026-10-18','06:00','Kerala''s grandest temple festival with caparisoned elephants, percussion ensembles and fireworks.',NULL),
('kochi-biennale-talk','Kochi Biennale Artist Talk','Art','Ernakulam','Aspinwall House, Fort Kochi',9.9658,76.2421,'2026-10-02','17:30','An evening conversation with participating artists on contemporary art.','https://www.kochimuzirisbiennale.org'),
('boat-race-practice','Snake Boat Race Practice Run','Sports','Alappuzha','Punnamada Lake',9.5117,76.3458,'2026-09-30','15:00','Watch the chundan vallams warm up on Punnamada Lake.',NULL),
('tvm-indie-night','Indie Night: Local Bands','Music','Thiruvananthapuram','Kanakakkunnu Palace',8.5116,76.9557,'2026-10-05','19:00','Four Malayalam indie bands, open air, free entry.',NULL),
('kozhikode-food-walk','Kozhikode Halwa & Biriyani Walk','Food','Kozhikode','SM Street (Mittai Theruvu)',11.2508,75.7804,'2026-10-03','16:00','A guided evening walk through Kozhikode''s legendary food street.',NULL),
('wayanad-coffee','Coffee Farming Workshop','Workshop','Wayanad','Kalpetta',11.6085,76.083,'2026-10-10','10:00','Hands-on session on shade-grown coffee with local growers.',NULL),
('kannur-theyyam','Theyyam Season Opening','Festival','Kannur','Parassinikkadavu Temple',11.984,75.401,'2026-10-20','05:30','Ritual Theyyam performances at dawn.',NULL),
('munnar-trail','Munnar Trail Run 10K','Sports','Idukki','Munnar Town',10.0889,77.0595,'2026-10-12','06:30','A scenic 10K through tea estates.',NULL);