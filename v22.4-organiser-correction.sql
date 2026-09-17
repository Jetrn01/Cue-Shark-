-- PottersMate V22.4 — organiser result correction
-- Run after the V22 score-confirmation SQL.
-- Adds a dedicated organiser correction workflow for disputed/pending results.
-- No player, competition, match or table data is deleted.

alter table public.competition_matches
  add column if not exists original_score1 integer,
  add column if not exists original_score2 integer,
  add column if not exists original_winner_balls integer,
  add column if not exists organiser_corrected_at timestamptz,
  add column if not exists organiser_corrected_by uuid references auth.users(id) on delete set null;

create or replace function public.organiser_correct_match_result(
  p_match_id uuid,
  p_score1 integer,
  p_score2 integer,
  p_winner_balls integer default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid := auth.uid();
  r record;
  v_winner uuid;
  v_loser uuid;
  v_original_score1 integer;
  v_original_score2 integer;
  v_original_balls integer;
begin
  if not exists (select 1 from public.organisers where id=v_uid) then
    raise exception 'Organiser access required';
  end if;

  select * into r
  from public.competition_matches
  where id=p_match_id
  for update;

  if not found then
    raise exception 'Match not found';
  end if;

  if r.status not in ('pending_confirmation','disputed') then
    raise exception 'This match is not awaiting organiser review';
  end if;

  if p_score1 < 0 or p_score2 < 0 then
    raise exception 'Scores cannot be negative';
  end if;

  if p_score1 > r.race_to or p_score2 > r.race_to then
    raise exception 'Score cannot exceed the race length (Race to %).', r.race_to;
  end if;

  if p_score1 = p_score2 and (p_score1 >= r.race_to or p_score2 >= r.race_to) then
    raise exception 'A completed match cannot finish tied';
  end if;

  if p_score1 <> r.race_to and p_score2 <> r.race_to then
    raise exception 'A final result must have one player reaching Race to %.', r.race_to;
  end if;

  if r.race_to = 1 then
    if p_winner_balls is null then
      raise exception 'For Race to 1, please enter the winner''s balls remaining';
    end if;
    if p_winner_balls < 0 or p_winner_balls > 7 then
      raise exception 'Balls remaining must be between 0 and 7';
    end if;
  else
    p_winner_balls := null;
  end if;

  if p_score1 > p_score2 then
    v_winner := r.player1_id;
    v_loser := r.player2_id;
  else
    v_winner := r.player2_id;
    v_loser := r.player1_id;
  end if;

  v_original_score1 := coalesce(r.original_score1, r.score1);
  v_original_score2 := coalesce(r.original_score2, r.score2);
  v_original_balls := coalesce(r.original_winner_balls, r.winner_balls);

  update public.competition_matches as cm
  set
    original_score1 = v_original_score1,
    original_score2 = v_original_score2,
    original_winner_balls = v_original_balls,
    score1 = p_score1,
    score2 = p_score2,
    winner_id = v_winner,
    loser_id = v_loser,
    winner_balls = p_winner_balls,
    status = 'pending_confirmation',
    p1_confirmed = true,
    p2_confirmed = true,
    result_submitted_at = now(),
    result_submitted_by = v_uid,
    organiser_corrected_at = now(),
    organiser_corrected_by = v_uid,
    disputed_at = null,
    disputed_by = null,
    dispute_reason = null
  where cm.id = p_match_id;

  perform public.finalize_confirmed_match(p_match_id);

  return jsonb_build_object(
    'match_id', p_match_id,
    'status', 'completed',
    'score1', p_score1,
    'score2', p_score2,
    'winner_id', v_winner,
    'winner_balls', p_winner_balls,
    'original_score1', v_original_score1,
    'original_score2', v_original_score2,
    'original_winner_balls', v_original_balls
  );
end;
$$;

grant execute on function public.organiser_correct_match_result(uuid,integer,integer,integer) to authenticated;
