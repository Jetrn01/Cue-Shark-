'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

function nameFor(players, id) {
  const p = players.find(x => x.id === id);
  return p?.display_name || [p?.first_name, p?.last_name].filter(Boolean).join(' ') || 'TBC';
}

function statusLabel(m) {
  if (m.status === 'completed') return 'FINAL';
  if (m.status === 'in_progress' || m.status === 'active') return 'LIVE';
  if (m.table_id) return 'ON TABLE';
  if (m.status === 'bye') return 'BYE';
  if (m.status === 'waiting') return 'WAITING';
  return 'UP NEXT';
}

function statusClass(m) {
  if (m.status === 'completed') return 'final';
  if (m.status === 'in_progress' || m.status === 'active') return 'live';
  if (m.table_id) return 'ontable';
  return 'upnext';
}

function groupStandings(matches, players) {
  const groupMatches = matches.filter(m => m.group_name && m.round_number === 1);
  const names = [...new Set(groupMatches.map(m => m.group_name))].sort();
  return names.map(group => {
    const rows = {};
    groupMatches.filter(m => m.group_name === group).forEach(m => {
      [m.player1_id, m.player2_id].forEach(id => {
        if (!id) return;
        if (!rows[id]) rows[id] = { id, played: 0, wins: 0, losses: 0, points: 0, ff: 0, fa: 0 };
      });
      if (m.status !== 'completed' || !m.player1_id || !m.player2_id) return;
      rows[m.player1_id].played++;
      rows[m.player2_id].played++;
      rows[m.player1_id].ff += Number(m.score1 || 0);
      rows[m.player1_id].fa += Number(m.score2 || 0);
      rows[m.player2_id].ff += Number(m.score2 || 0);
      rows[m.player2_id].fa += Number(m.score1 || 0);
      if (m.winner_id === m.player1_id) {
        rows[m.player1_id].wins++; rows[m.player2_id].losses++; rows[m.player1_id].points++;
      } else if (m.winner_id === m.player2_id) {
        rows[m.player2_id].wins++; rows[m.player1_id].losses++; rows[m.player2_id].points++;
      }
    });
    const ordered = Object.values(rows).sort((a,b) =>
      b.points-a.points || b.wins-a.wins || (b.ff-b.fa)-(a.ff-a.fa) || b.ff-a.ff
    );
    return { group, rows: ordered.map((r,i) => ({...r, rank:i+1, name:nameFor(players,r.id), fd:r.ff-r.fa})) };
  });
}

function PottersMateDisplayBrand(){return <div className="pmDisplayBrand"><svg viewBox="0 0 100 82" aria-hidden="true"><path d="M12 64 C24 31 43 12 69 12 C84 12 92 21 92 34 C92 48 81 56 66 56 L43 56 L36 70 L20 70 Z" fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"/><path d="M18 60 C27 40 39 28 52 22" fill="none" stroke="var(--pm-purple)" strokeWidth="8" strokeLinecap="round"/><circle cx="66" cy="34" r="17" fill="#0b0b0d" stroke="currentColor" strokeWidth="5"/><circle cx="66" cy="34" r="10" fill="#fff"/><text x="66" y="39" textAnchor="middle" fontSize="13" fontWeight="900" fill="#0b0b0d">8</text></svg><b>Potters<span>Mate</span></b></div>}

export default function DisplayPage() {
  const params = useParams();
  const competitionId = params?.id;
  const [competition, setCompetition] = useState(null);
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [tables, setTables] = useState([]);
  const [error, setError] = useState('');
  const [slide, setSlide] = useState(0);
  const [hasLiveMatch, setHasLiveMatch] = useState(false);

  async function load() {
    if (!competitionId) return;
    const { data: c, error: ce } = await supabase.from('competitions').select('*').eq('id', competitionId).single();
    if (ce) { setError(ce.message); return; }
    setCompetition(c);

    const [pRes, mRes, tRes] = await Promise.all([
      supabase.from('competition_players').select('player_id').eq('competition_id', competitionId),
      supabase.from('competition_matches').select('*').eq('competition_id', competitionId).order('match_number'),
      supabase.from('tournament_tables').select('*').eq('competition_id', competitionId).order('table_number')
    ]);
    if (mRes.error) { setError(mRes.error.message); return; }

    const playerIds = (pRes.data || []).map(x => x.player_id).filter(Boolean);
    let playerRows = [];
    if (playerIds.length) {
      const { data: pr, error: pe } = await supabase.from('players').select('id,first_name,last_name,display_name').in('id', playerIds);
      if (!pe) playerRows = pr || [];
    }

    let tableRows = tRes.data || [];
    if (c.recurring_template_id) {
      const { data: shared } = await supabase.from('tournament_tables').select('*').eq('recurring_template_id', c.recurring_template_id).order('table_number');
      if ((shared || []).length) tableRows = shared;
    }
    setPlayers(playerRows);
    setMatches(mRes.data || []);
    const liveNow = (mRes.data || []).some(m => m.table_id && m.status !== 'completed');
    if (liveNow && !hasLiveMatch) setSlide(0);
    setHasLiveMatch(liveNow);
    setTables(tableRows);
  }

  useEffect(() => { load(); }, [competitionId]);
  useEffect(() => {
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [competitionId]);

  const playerName = id => nameFor(players,id);
  const tableName = id => tables.find(t => t.id === id)?.table_number;
  const live = useMemo(() => matches.filter(m => m.table_id && m.status !== 'completed'), [matches]);
  const upcoming = useMemo(() => matches.filter(m => m.status === 'scheduled' && !m.table_id), [matches]);
  const completed = useMemo(() => matches.filter(m => m.status === 'completed').slice().reverse().slice(0,8), [matches]);
  const groups = useMemo(() => groupStandings(matches, players), [matches, players]);

  const hasGroups = groups.length > 0;
  const screens = hasGroups ? ['live','groups','upcoming','results'] : ['live','upcoming','results'];
  const currentScreen = screens[slide % screens.length];

  useEffect(() => {
    const timer = setInterval(() => setSlide(s => s + 1), 15000);
    return () => clearInterval(timer);
  }, [screens.length]);

  if (error) return <main className="displayError"><h1>PottersMate</h1><p>Could not load this competition.</p><small>{error}</small></main>;
  if (!competition) return <main className="displayLoading"><div>🎱</div><h1>PottersMate</h1><p>Loading tournament display…</p></main>;

  return <main className="tv">
    <header className="tvHeader">
      <div>
        <div className="brand">🎱 POTTERSMATE</div>
        <h1>{competition.name}</h1>
        <div className="sub">{competition.venue || ''}{competition.session_type === 'casual' ? ' · Casual night' : competition.season_week ? ` · Season Week ${competition.season_week}` : ''}</div>
      </div>
      <div className="liveClock"><span>● LIVE</span><small>Updates automatically</small></div>
    </header>

    <div className="screenTitle">
      <strong>{currentScreen === 'live' ? 'LIVE NOW' : currentScreen === 'groups' ? 'GROUP STANDINGS' : currentScreen === 'upcoming' ? 'UP NEXT' : 'RECENT RESULTS'}</strong>
      <span>{slide % screens.length + 1} / {screens.length}</span>
    </div>

    {currentScreen === 'live' && <section className="liveGrid">
      {tables.map(t => {
        const m = live.find(x => x.table_id === t.id);
        return <article className={`liveCard ${m ? 'hasMatch' : ''}`} key={t.id}>
          <div className="tableHead"><span>TABLE {t.table_number}</span>{t.is_accessible && <span>♿</span>}</div>
          {m ? <>
            <div className="matchNo">MATCH {m.match_number} · {statusLabel(m)}</div>
            <div className="tvPlayers"><strong>{playerName(m.player1_id)}</strong><strong>{playerName(m.player2_id)}</strong></div>
            <div className="tvScore"><span>{m.score1 ?? 0}</span><i>–</i><span>{m.score2 ?? 0}</span></div>
            <div className="race">Race to {m.race_to}</div>
          </> : <div className="tableFree">AVAILABLE</div>}
        </article>;
      })}
      {tables.length === 0 && <div className="emptyTv">No tables configured.</div>}
    </section>}

    {currentScreen === 'groups' && <section className="groupsGrid">
      {groups.map(g => <article className="groupCard" key={g.group}>
        <h2>GROUP {g.group}</h2>
        <div className="groupRow groupHead"><span>#</span><span>PLAYER</span><span>P</span><span>W</span><span>L</span><span>PTS</span><span>FD</span></div>
        {g.rows.map(r => <div className="groupRow" key={r.id}><span>{r.rank}</span><strong>{r.name}</strong><span>{r.played}</span><span>{r.wins}</span><span>{r.losses}</span><strong>{r.points}</strong><span>{r.fd > 0 ? '+' : ''}{r.fd}</span></div>)}
      </article>)}
    </section>}

    {currentScreen === 'upcoming' && <section className="listScreen">
      {upcoming.length ? upcoming.slice(0,12).map(m => <article className="bigListRow" key={m.id}><div><span className="matchTag">MATCH {m.match_number}</span><strong>{playerName(m.player1_id)} <em>vs</em> {playerName(m.player2_id)}</strong></div><div>Race to {m.race_to}</div></article>) : <div className="emptyTv"><strong>No matches waiting.</strong><span>All ready matches are either on a table or complete.</span></div>}
    </section>}

    {currentScreen === 'results' && <section className="listScreen">
      {completed.length ? completed.map(m => <article className="bigListRow resultRow" key={m.id}><div><span className="matchTag">MATCH {m.match_number}</span><strong>{playerName(m.player1_id)} <em>vs</em> {playerName(m.player2_id)}</strong><small>Winner: {playerName(m.winner_id)}</small></div><div className="resultBig">{m.score1 ?? 0} – {m.score2 ?? 0}</div></article>) : <div className="emptyTv"><strong>No completed matches yet.</strong><span>Results will appear here as matches finish.</span></div>}
    </section>}

    <footer className="tvFooter"><span>PottersMate · Tournament display</span><span>Screen changes every 15 seconds</span></footer>
    <style>{css}</style>
  </main>;
}

const css = `
*{box-sizing:border-box}html,body{margin:0;padding:0;background:#0b1020;color:#f8fafc;font-family:Arial,Helvetica,sans-serif}body{min-height:100vh}.tv{min-height:100vh;background:radial-gradient(circle at top,#17213d 0,#0b1020 45%,#070b15 100%);padding:2.2vw 3vw 1.3vw;display:flex;flex-direction:column}.tvHeader{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #ffffff20;padding-bottom:1.4vw}.brand{font-size:clamp(12px,1.1vw,20px);font-weight:900;letter-spacing:.16em;opacity:.7}.tvHeader h1{font-size:clamp(28px,3.1vw,58px);margin:.35vw 0 .15vw;line-height:1.05}.sub{font-size:clamp(14px,1.2vw,23px);opacity:.7}.liveClock{text-align:right}.liveClock span{display:inline-block;font-size:clamp(11px,1vw,18px);font-weight:900;letter-spacing:.08em;padding:.45vw .7vw;border-radius:999px;background:#153d2c;color:#86efac}.liveClock small{display:block;margin-top:.45vw;opacity:.55;font-size:clamp(10px,.9vw,15px)}.screenTitle{display:flex;justify-content:space-between;align-items:center;margin:1.5vw 0 1vw}.screenTitle strong{font-size:clamp(18px,1.6vw,30px);letter-spacing:.08em}.screenTitle span{font-size:clamp(11px,.9vw,16px);opacity:.45}.liveGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.1vw;flex:1}.liveCard{min-height:240px;border:1px solid #ffffff16;border-radius:18px;background:#111a2e;padding:1.2vw;display:flex;flex-direction:column;box-shadow:0 12px 30px #0003}.liveCard.hasMatch{border-color:#ffffff32}.tableHead{display:flex;justify-content:space-between;font-weight:900;font-size:clamp(15px,1.25vw,24px);letter-spacing:.08em;opacity:.75}.matchNo{margin-top:1.5vw;font-size:clamp(11px,.9vw,16px);font-weight:900;opacity:.55}.tvPlayers{display:grid;gap:.6vw;margin-top:1.3vw;font-size:clamp(20px,2vw,39px);line-height:1.05}.tvScore{display:flex;justify-content:center;align-items:center;gap:1vw;margin-top:auto;font-size:clamp(44px,5vw,94px);font-weight:900}.tvScore i{font-style:normal;opacity:.35}.race{text-align:center;font-size:clamp(12px,1vw,18px);opacity:.55;margin-top:.5vw}.tableFree{margin:auto;font-size:clamp(18px,1.7vw,31px);font-weight:900;letter-spacing:.12em;opacity:.25}.groupsGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1vw;flex:1}.groupCard{background:#111a2e;border:1px solid #ffffff16;border-radius:16px;padding:1vw;min-width:0}.groupCard h2{margin:0 0 .7vw;font-size:clamp(18px,1.6vw,30px)}.groupRow{display:grid;grid-template-columns:34px minmax(0,1fr) 45px 45px 45px 55px 55px;gap:.35vw;align-items:center;padding:.6vw .5vw;border-top:1px solid #ffffff10;font-size:clamp(13px,1.1vw,20px)}.groupHead{border-top:0;opacity:.45;font-size:clamp(9px,.75vw,13px);font-weight:900}.groupRow strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.listScreen{flex:1;display:flex;flex-direction:column;gap:.7vw}.bigListRow{display:flex;justify-content:space-between;align-items:center;gap:20px;background:#111a2e;border:1px solid #ffffff16;border-radius:15px;padding:1vw 1.2vw;font-size:clamp(15px,1.3vw,25px)}.bigListRow>div:first-child{display:grid;gap:.35vw;min-width:0}.bigListRow strong{font-size:clamp(20px,1.8vw,34px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bigListRow em{font-style:normal;opacity:.35}.bigListRow small{opacity:.5}.matchTag{font-size:clamp(10px,.8vw,14px);font-weight:900;opacity:.45;letter-spacing:.08em}.resultBig{font-size:clamp(28px,2.5vw,48px);font-weight:900;white-space:nowrap}.emptyTv{flex:1;display:grid;place-content:center;text-align:center;gap:8px;opacity:.55;font-size:clamp(15px,1.2vw,22px)}.emptyTv strong{font-size:clamp(24px,2vw,38px);opacity:.9}.tvFooter{display:flex;justify-content:space-between;padding-top:1vw;margin-top:1vw;border-top:1px solid #ffffff12;font-size:clamp(9px,.75vw,13px);opacity:.35}@media(max-width:900px){.groupsGrid{grid-template-columns:1fr}.liveGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.groupRow{grid-template-columns:28px minmax(0,1fr) 32px 32px 32px 42px 42px}}@media(max-width:600px){.tv{padding:18px}.tvHeader{display:block}.liveClock{text-align:left;margin-top:12px}.liveGrid{grid-template-columns:1fr}.bigListRow{padding:14px}.groupRow{font-size:12px}}
.displayLoading,.displayError{min-height:100vh;background:#0b1020;color:#fff;display:grid;place-content:center;text-align:center;font-family:Arial,sans-serif}.displayLoading>div{font-size:50px}.displayLoading h1,.displayError h1{font-size:34px;margin:10px 0}.displayLoading p,.displayError p{opacity:.7}.displayError small{opacity:.45;max-width:600px}
`;
