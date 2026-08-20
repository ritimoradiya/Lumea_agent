-- Remember what someone's skin is like, not just their name.
--
-- Cross-channel identity worked and carried nothing useful. A customer had a
-- full web conversation - oily, acne breakouts - and when he replied to the
-- routine email an hour later, the new conversation knew his name and nothing
-- else, so the owner got an alert reading "no concern given" with a transcript
-- of "This is perfect, thank you!".
--
-- The concern is the single most useful thing to carry forward, and there was
-- nowhere to put it.
alter table contacts add column if not exists description text;
alter table contacts add column if not exists experience  text;
