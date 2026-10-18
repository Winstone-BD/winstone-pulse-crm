-- Read-only-shaped RPC integration checks; synthetic subjects only.
-- Expected: four failures then valid fifth resets; five failures blocks 300s.
WITH RECURSIVE attempts(n,result) AS (
 SELECT 1, public.finish_pin_auth_attempt(repeat('a',64),'leadhub',
  (public.begin_pin_auth_attempt(repeat('a',64),'leadhub')->>'lease')::uuid,false)
 UNION ALL
 SELECT n+1, public.finish_pin_auth_attempt(repeat('a',64),'leadhub',
  (public.begin_pin_auth_attempt(repeat('a',64),'leadhub')->>'lease')::uuid,n=4)
 FROM attempts WHERE n<5
)
SELECT n,result FROM attempts;

WITH RECURSIVE attempts(n,result) AS (
 SELECT 1, public.finish_pin_auth_attempt(repeat('b',64),'leadhub',
  (public.begin_pin_auth_attempt(repeat('b',64),'leadhub')->>'lease')::uuid,false)
 UNION ALL
 SELECT n+1, public.finish_pin_auth_attempt(repeat('b',64),'leadhub',
  (public.begin_pin_auth_attempt(repeat('b',64),'leadhub')->>'lease')::uuid,false)
 FROM attempts WHERE n<5
)
SELECT n,result FROM attempts;