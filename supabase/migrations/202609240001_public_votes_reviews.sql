-- ============================================================
-- Kerala Events: Public Upvotes, Downvotes & Community Feedback
-- ============================================================

-- 1. Change old vote types from up/report to up/down
ALTER TABLE public.event_votes
  DROP CONSTRAINT IF EXISTS event_votes_kind_check;

ALTER TABLE public.event_votes
  ADD CONSTRAINT event_votes_kind_check
  CHECK (kind IN ('up', 'down'));

-- Remove any old report-type votes
DELETE FROM public.event_votes
WHERE kind = 'report';


-- 2. Add public downvote counter
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS downvotes integer NOT NULL DEFAULT 0;


-- 3. Recalculate existing upvote/downvote counters
UPDATE public.events e
SET
  upvotes = (
    SELECT COUNT(*)
    FROM public.event_votes v
    WHERE v.event_id = e.id
      AND v.kind = 'up'
  ),
  downvotes = (
    SELECT COUNT(*)
    FROM public.event_votes v
    WHERE v.event_id = e.id
      AND v.kind = 'down'
  );


-- ============================================================
-- 4. Community feedback table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.event_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  event_id text NOT NULL
    REFERENCES public.events(id)
    ON DELETE CASCADE,

  author_id text NOT NULL,

  type text NOT NULL
    CHECK (type IN ('downvote', 'report')),

  reason text NOT NULL
    CHECK (
      reason IN (
        'cancelled',
        'wrong_datetime',
        'wrong_location',
        'incorrect_info',
        'duplicate',
        'ended',
        'not_happening',
        'spam',
        'other'
      )
    ),

  note text
    CHECK (
      note IS NULL
      OR char_length(note) <= 500
    ),

  created_at timestamptz NOT NULL DEFAULT now()
);


-- 5. Prevent duplicate feedback of the same type
--    from the same person on the same event
CREATE UNIQUE INDEX IF NOT EXISTS
event_feedback_one_type_per_author
ON public.event_feedback(event_id, author_id, type);


-- 6. Index for quickly loading event reviews
CREATE INDEX IF NOT EXISTS
event_feedback_event_idx
ON public.event_feedback(event_id, created_at DESC);


-- ============================================================
-- 7. Row Level Security
-- ============================================================

ALTER TABLE public.event_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read event feedback"
ON public.event_feedback;

CREATE POLICY "Public can read event feedback"
ON public.event_feedback
FOR SELECT
USING (true);


-- ============================================================
-- 8. PUBLIC UPVOTE / DOWNVOTE
--
-- One vote per person per event.
-- Voting again with the same choice does nothing.
-- Changing up -> down or down -> up changes the counters.
-- ============================================================

CREATE OR REPLACE FUNCTION public.vote_event(
  _event_id text,
  _voter_id text,
  _kind text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_kind text;
BEGIN

  IF _kind NOT IN ('up', 'down') THEN
    RAISE EXCEPTION 'invalid vote';
  END IF;

  IF char_length(_voter_id) NOT BETWEEN 8 AND 64 THEN
    RAISE EXCEPTION 'invalid voter';
  END IF;

  SELECT kind
  INTO old_kind
  FROM public.event_votes
  WHERE event_id = _event_id
    AND voter_id = _voter_id;

  -- First vote
  IF old_kind IS NULL THEN

    INSERT INTO public.event_votes(
      event_id,
      voter_id,
      kind
    )
    VALUES (
      _event_id,
      _voter_id,
      _kind
    );

    IF _kind = 'up' THEN

      UPDATE public.events
      SET upvotes = upvotes + 1
      WHERE id = _event_id;

    ELSE

      UPDATE public.events
      SET downvotes = downvotes + 1
      WHERE id = _event_id;

    END IF;

    RETURN;
  END IF;


  -- Same vote again: do nothing
  IF old_kind = _kind THEN
    RETURN;
  END IF;


  -- Change UP -> DOWN
  IF old_kind = 'up'
     AND _kind = 'down'
  THEN

    UPDATE public.event_votes
    SET kind = 'down'
    WHERE event_id = _event_id
      AND voter_id = _voter_id;

    UPDATE public.events
    SET
      upvotes = GREATEST(upvotes - 1, 0),
      downvotes = downvotes + 1
    WHERE id = _event_id;

    RETURN;
  END IF;


  -- Change DOWN -> UP
  IF old_kind = 'down'
     AND _kind = 'up'
  THEN

    UPDATE public.event_votes
    SET kind = 'up'
    WHERE event_id = _event_id
      AND voter_id = _voter_id;

    UPDATE public.events
    SET
      downvotes = GREATEST(downvotes - 1, 0),
      upvotes = upvotes + 1
    WHERE id = _event_id;

    RETURN;
  END IF;

END;
$$;

GRANT EXECUTE
ON FUNCTION public.vote_event(text, text, text)
TO anon, authenticated;


-- ============================================================
-- 9. DOWNVOTE WITH PUBLIC EXPLANATION
-- ============================================================

CREATE OR REPLACE FUNCTION public.submit_downvote(
  _event_id text,
  _author_id text,
  _reason text,
  _note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN

  IF char_length(_author_id) NOT BETWEEN 8 AND 64 THEN
    RAISE EXCEPTION 'invalid author';
  END IF;

  IF _reason NOT IN (
    'cancelled',
    'wrong_datetime',
    'wrong_location',
    'incorrect_info',
    'duplicate',
    'ended',
    'not_happening',
    'other'
  ) THEN
    RAISE EXCEPTION 'invalid reason';
  END IF;


  INSERT INTO public.event_feedback(
    event_id,
    author_id,
    type,
    reason,
    note
  )
  VALUES (
    _event_id,
    _author_id,
    'downvote',
    _reason,
    left(_note, 500)
  )
  ON CONFLICT (
    event_id,
    author_id,
    type
  )
  DO UPDATE SET
    reason = EXCLUDED.reason,
    note = EXCLUDED.note,
    created_at = now();

END;
$$;

GRANT EXECUTE
ON FUNCTION public.submit_downvote(text,text,text,text)
TO anon, authenticated;


-- ============================================================
-- 10. REPORT WITH PUBLIC EXPLANATION
-- ============================================================

CREATE OR REPLACE FUNCTION public.submit_event_report(
  _event_id text,
  _author_id text,
  _reason text,
  _note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN

  IF char_length(_author_id) NOT BETWEEN 8 AND 64 THEN
    RAISE EXCEPTION 'invalid author';
  END IF;

  IF _reason NOT IN (
    'cancelled',
    'wrong_datetime',
    'wrong_location',
    'incorrect_info',
    'duplicate',
    'ended',
    'not_happening',
    'spam',
    'other'
  ) THEN
    RAISE EXCEPTION 'invalid reason';
  END IF;


  INSERT INTO public.event_feedback(
    event_id,
    author_id,
    type,
    reason,
    note
  )
  VALUES (
    _event_id,
    _author_id,
    'report',
    _reason,
    left(_note, 500)
  )
  ON CONFLICT (
    event_id,
    author_id,
    type
  )
  DO NOTHING;


  -- Increase report counter only for a NEW report
  IF FOUND THEN

    UPDATE public.events
    SET reports = reports + 1
    WHERE id = _event_id;

  END IF;

END;
$$;

GRANT EXECUTE
ON FUNCTION public.submit_event_report(text,text,text,text)
TO anon, authenticated;


-- ============================================================
-- 11. Keep old report_event function working temporarily
--    so the current frontend does not immediately break.
-- ============================================================

CREATE OR REPLACE FUNCTION public.report_event(
  _event_id text,
  _reporter_id text,
  _reason text,
  _note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN

  PERFORM public.submit_event_report(
    _event_id,
    _reporter_id,
    _reason,
    _note
  );

END;
$$;

GRANT EXECUTE
ON FUNCTION public.report_event(text,text,text,text)
TO anon, authenticated;


-- ============================================================
-- DONE
-- ============================================================