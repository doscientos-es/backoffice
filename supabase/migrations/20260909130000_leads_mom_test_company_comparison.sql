-- Adds the manual Mom Test signal that records whether the lead is comparing
-- the offer with other companies. NULL represents an unanswered criterion.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS mom_test_comparing_other_companies boolean;