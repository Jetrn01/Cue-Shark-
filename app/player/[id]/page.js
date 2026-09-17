'use client';

import {useEffect,useMemo,useState} from 'react';
import {useParams,useSearchParams} from 'next/navigation';
import {createClient} from '@supabase/supabase-js';

const supabase=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

function name(p){return p?.display_name||[p?.first_name,p?.last_name].filter(Boolean).join(' ')||'Player'}

export default function PublicPlayer(){
 const {id}=useParams();const qs=useSearchParams();const competitionId=qs?.get('competition');
 const [player,setPlayer]=useState(null),[matches,setMatches]=useState([]),[competitions,setCompetitions]=useState([]),[tables,setTables]=useState([]),[people,setPeople]=useState({}),[error,setError]=useState('');
 async function load(){
  if(!id)return;
  const pr=await supabase.from('players').select('id,first_name,last_name,display_name,club_name').eq('id',id).single();
  if(pr.error){setError(pr.error.message);return} setPlayer(pr.data);
  const mr=await supabase.from('competition_matches').select('*').or(`player1_id.eq.${id},player2_id.eq.${id}`).order('created_at',{ascending:false});
  if(mr.error){setError(mr.error.message);return}
  const ms=mr.data||[];setMatches(ms);
  const opponentIds=[...new Set(ms.flatMap(m=>[m.player1_id,m.player2_id]).filter(Boolean))];
  if(opponentIds.length){const peopleRes=await supabase.from('players').select('id,first_name,last_name,display_name').in('id',opponentIds);const map={};(peopleRes.data||[]).forEach(p=>map[p.id]=p);setPeople(map)}
  const cids=[...new Set(ms.map(m=>m.competition_id).filter(Boolean))];
  if(cids.length){const cr=await supabase.from('competitions').select('id,name,start_date,venue,session_type,season_week').in('id',cids);setCompetitions(cr.data||[])}
  if(competitionId){const tr=await supabase.from('tournament_tables').select('id,table_number').eq('competition_id',competitionId);setTables(tr.data||[])}
 }
 useEffect(()=>{load();const t=setInterval(load,5000);return()=>clearInterval(t)},[id,competitionId]);

 const played=matches.filter(m=>m.status==='completed'&&m.winner_id);const wins=played.filter(m=>m.winner_id===id).length;const losses=played.filter(m=>m.loser_id===id).length;
 const current=useMemo(()=>matches.find(m=>m.competition_id===competitionId&&(m.status!=='completed')&&(m.status!=='bye')&&(m.player1_id===id||m.player2_id===id)),[matches,competitionId,id]);
 const opponent=current?(current.player1_id===id?current.player2_id:current.player1_id):null;
 const compMap=Object.fromEntries(competitions.map(c=>[c.id,c]));
 const recent=matches.filter(m=>m.status==='completed').slice(0,12);

 if(error)return <main className="playerPage"><Brand/><div className="playerCard"><h2>Unable to load player</h2><p>{error}</p></div></main>;
 if(!player)return <main className="playerPage"><Brand/><div className="playerCard">Loading player…</div></main>;
 return <main className="playerPage">
  <header><Brand/><a href={competitionId?`/tournament/${competitionId}`:'/'}>{competitionId?'← Back to tournament':'PottersMate'}</a></header>
  <section className="profileHero"><div><div className="eyebrow">PLAYER PROFILE</div><h1>{name(player)}</h1><p>{player.club_name||'Club not listed'}</p></div><div className="profileStats"><div><b>{played.length}</b><span>Matches</span></div><div><b>{wins}</b><span>Wins</span></div><div><b>{losses}</b><span>Losses</span></div><div><b>{played.length?Math.round(wins/played.length*100):0}%</b><span>Win rate</span></div></div></section>
  {competitionId&&<section className="playerCard currentCard"><div className="sectionHead"><h2>🎱 Your tournament</h2></div>{current?<div className="currentMatch"><span className="livePill">{current.table_id?'LIVE / ON TABLE':'UP NEXT'}</span><h3>Match {current.match_number}</h3><div><strong>{name(player)}</strong><span>vs</span><strong>{opponent?name(people[opponent]):'TBC'}</strong></div><p>{current.table_id?`Table ${tables.find(t=>t.id===current.table_id)?.table_number||'—'} · `:''}Race to {current.race_to}</p></div>:<p className="muted">You do not currently have a live or upcoming match in this tournament.</p>}</section>}
  <section className="playerCard"><div className="sectionHead"><h2>📋 Match history</h2><span>{matches.length} recorded</span></div>{recent.length===0?<p className="muted">No completed matches yet.</p>:<div className="history">{recent.map(m=>{const won=m.winner_id===id;const opp=m.player1_id===id?m.player2_id:m.player1_id;const c=compMap[m.competition_id];const oppName=name(people[opp]);return <div className="historyRow" key={m.id}><div><strong className={won?'win':'loss'}>{won?'WIN':'LOSS'}</strong><span>{oppName||'Opponent'} · {c?.name||'Competition'}</span><small>{c?.start_date||''}{c?.season_week?` · Week ${c.season_week}`:''}{c?.session_type==='casual'?' · Casual':''}</small></div><b>{m.player1_id===id?m.score1:m.score2} – {m.player1_id===id?m.score2:m.score1}</b></div>})}</div>}</section>
  <footer>PottersMate · Player information</footer>
 </main>
}
function Brand(){return <div className="brand"><span className="mark">8</span><b>Potters<span>Mate</span></b></div>}
const css=`*{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;background:#f5f7fa;color:#172033}.playerPage{max-width:900px;margin:auto;padding:25px 18px 50px}.playerPage header{display:flex;justify-content:space-between;align-items:center;margin-bottom:25px}.playerPage header>a{color:#172033;text-decoration:none;font-weight:800}.brand{display:flex;align-items:center;gap:9px}.mark{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:#101521;color:#fff;font-weight:900}.brand b{font-size:25px}.brand b span{color:#a020f0}.profileHero{background:#101521;color:#fff;border-radius:18px;padding:24px;margin-bottom:14px;display:flex;justify-content:space-between;gap:20px}.eyebrow{color:#b88cff;font-size:10px;font-weight:900;letter-spacing:1.5px}.profileHero h1{margin:7px 0 4px;font-size:32px}.profileHero p{margin:0;color:#c5cad5}.profileStats{display:grid;grid-template-columns:repeat(4,90px);gap:8px;align-content:center}.profileStats div{background:#1b2130;border-radius:10px;padding:9px;text-align:center}.profileStats b{display:block;font-size:20px}.profileStats span{font-size:10px;color:#aeb6c6}.playerCard{background:#fff;border:1px solid #dfe4ec;border-radius:14px;padding:17px;margin-bottom:14px}.sectionHead{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.sectionHead h2{margin:0;font-size:19px}.sectionHead span{color:#667085;font-size:12px}.currentCard{border-color:#d7c8f4}.currentMatch{text-align:center;padding:12px}.livePill{display:inline-block;font-size:10px;font-weight:900;color:#067647;background:#ecfdf3;border:1px solid #abefc6;border-radius:99px;padding:4px 8px}.currentMatch h3{margin:10px}.currentMatch>div{display:flex;justify-content:center;gap:15px;align-items:center;font-size:20px}.currentMatch>div span{color:#98a2b3;font-size:13px}.currentMatch p{color:#667085}.history{border:1px solid #e3e7ee;border-radius:10px;overflow:hidden}.historyRow{display:flex;justify-content:space-between;align-items:center;gap:15px;padding:11px 13px;border-top:1px solid #edf0f4}.historyRow:first-child{border-top:0}.historyRow>div{display:grid;gap:2px}.historyRow span{font-weight:700}.historyRow small{color:#667085}.historyRow>b{font-size:18px}.win{color:#067647;font-size:10px}.loss{color:#b42318;font-size:10px}.muted{color:#667085}.playerPage footer{text-align:center;color:#98a2b3;font-size:11px;margin-top:20px}@media(max-width:700px){.profileHero{display:grid}.profileStats{grid-template-columns:repeat(4,1fr)}.currentMatch>div{font-size:16px}.historyRow{align-items:start}}
`;
