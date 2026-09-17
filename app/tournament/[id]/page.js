'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

function playerName(players,id){const p=players.find(x=>x.id===id);return p?.display_name||[p?.first_name,p?.last_name].filter(Boolean).join(' ')||'TBC'}
function status(m){if(m.status==='completed')return 'FINAL';if(m.status==='in_progress'||m.status==='active')return 'LIVE';if(m.status==='bye')return 'BYE';if(m.table_id)return 'ON TABLE';if(m.status==='waiting')return 'WAITING';return 'UP NEXT'}

function standings(matches,players){
  const rows={};
  matches.filter(m=>m.group_name&&Number(m.round_number)===1).forEach(m=>{
    [m.player1_id,m.player2_id].forEach(id=>{if(id&&!rows[id])rows[id]={id,played:0,wins:0,losses:0,pts:0,ff:0,fa:0}});
    if(m.status!=='completed'||!m.player1_id||!m.player2_id)return;
    rows[m.player1_id].played++;rows[m.player2_id].played++;
    rows[m.player1_id].ff+=Number(m.score1||0);rows[m.player1_id].fa+=Number(m.score2||0);
    rows[m.player2_id].ff+=Number(m.score2||0);rows[m.player2_id].fa+=Number(m.score1||0);
    if(m.winner_id===m.player1_id){rows[m.player1_id].wins++;rows[m.player2_id].losses++;rows[m.player1_id].pts++}
    if(m.winner_id===m.player2_id){rows[m.player2_id].wins++;rows[m.player1_id].losses++;rows[m.player2_id].pts++}
  });
  return Object.values(rows).sort((a,b)=>b.pts-a.pts||b.wins-a.wins||(b.ff-b.fa)-(a.ff-a.fa)).map((r,i)=>({...r,rank:i+1,name:playerName(players,r.id),fd:r.ff-r.fa}));
}

export default function PublicTournament(){
  const {id}=useParams();
  const [c,setC]=useState(null),[players,setPlayers]=useState([]),[matches,setMatches]=useState([]),[tables,setTables]=useState([]),[error,setError]=useState('');
  async function load(){
    if(!id)return;
    const {data:comp,error:ce}=await supabase.from('competitions').select('*').eq('id',id).single();
    if(ce){setError(ce.message);return}
    setC(comp);
    const [cp,mr,tr]=await Promise.all([
      supabase.from('competition_players').select('player_id').eq('competition_id',id),
      supabase.from('competition_matches').select('*').eq('competition_id',id).order('match_number'),
      supabase.from('tournament_tables').select('id,table_number,is_accessible,status').eq('competition_id',id).order('table_number')
    ]);
    if(mr.error){setError(mr.error.message);return}
    const ids=(cp.data||[]).map(x=>x.player_id).filter(Boolean);
    const pr=ids.length?await supabase.from('players').select('id,first_name,last_name,display_name').in('id',ids):{data:[]};
    setPlayers(pr.data||[]);setMatches(mr.data||[]);setTables(tr.data||[]);
  }
  useEffect(()=>{load();const t=setInterval(load,5000);return()=>clearInterval(t)},[id]);

  const live=useMemo(()=>matches.filter(m=>m.table_id&&m.status!=='completed'),[matches]);
  const ready=useMemo(()=>matches.filter(m=>m.status==='scheduled'&&!m.table_id),[matches]);
  const results=useMemo(()=>matches.filter(m=>m.status==='completed').slice().reverse().slice(0,10),[matches]);
  const groups=useMemo(()=>{const gs=[...new Set(matches.filter(m=>m.group_name).map(m=>m.group_name))].sort();return gs.map(g=>({group:g,rows:standings(matches.filter(m=>m.group_name===g),players)}))},[matches,players]);

  if(error)return <main className="publicPage"><Brand/><div className="publicCard"><h2>Unable to load tournament</h2><p>{error}</p></div><style>{css}</style></main>;
  if(!c)return <main className="publicPage"><Brand/><div className="publicCard">Loading tournament…</div><style>{css}</style></main>;

  return <main className="publicPage">
    <header className="publicHeader"><div><Brand/><h1>{c.name}</h1><p>{c.venue||''}{c.start_date?` · ${c.start_date}`:''}</p></div><a href={`/display/${id}`} target="_blank" rel="noreferrer">📺 TV Display</a></header>
    <div className="publicStats"><div><b>{players.length}</b><span>Players</span></div><div><b>{live.length}</b><span>Live</span></div><div><b>{ready.length}</b><span>Up next</span></div><div><b>{matches.filter(m=>m.status==='completed').length}</b><span>Results</span></div></div>

    <section className="publicCard"><div className="sectionHead"><div><h2>🔴 Live now</h2><span>Updated automatically</span></div></div>
      {live.length===0?<p className="muted">No matches are currently playing.</p>:<div className="liveGrid">{live.map(m=><article className="liveCard" key={m.id}><span className="livePill">LIVE</span><h3>Match {m.match_number}</h3><div className="names"><a href={`/player/${m.player1_id}?competition=${id}`}>{playerName(players,m.player1_id)}</a><strong>{m.score1??0} – {m.score2??0}</strong><a href={`/player/${m.player2_id}?competition=${id}`}>{playerName(players,m.player2_id)}</a></div><small>Table {tables.find(t=>t.id===m.table_id)?.table_number||'—'} · Race to {m.race_to}</small></article>)}</div>}
    </section>

    <section className="publicCard"><div className="sectionHead"><div><h2>⚡ Up next</h2><span>Matches ready to start</span></div></div>
      {ready.length===0?<p className="muted">No matches waiting to start.</p>:<div className="publicList">{ready.slice(0,12).map(m=><div className="publicRow" key={m.id}><strong>Match {m.match_number}</strong><span><a href={`/player/${m.player1_id}?competition=${id}`}>{playerName(players,m.player1_id)}</a> vs <a href={`/player/${m.player2_id}?competition=${id}`}>{playerName(players,m.player2_id)}</a></span><em>{status(m)}</em></div>)}</div>}
    </section>

    {groups.length>0&&<section className="publicCard"><div className="sectionHead"><div><h2>🏆 Group standings</h2><span>Current group-stage results</span></div></div><div className="groupGrid">{groups.map(g=><div className="groupBox" key={g.group}><h3>Group {g.group}</h3><div className="standHead"><span>#</span><span>Player</span><span>W</span><span>L</span><span>Pts</span><span>FD</span></div>{g.rows.map(r=><div className="standRow" key={r.id}><span>{r.rank}</span><a href={`/player/${r.id}?competition=${id}`}>{r.name}</a><span>{r.wins}</span><span>{r.losses}</span><span>{r.pts}</span><span>{r.fd>=0?`+${r.fd}`:r.fd}</span></div>)}</div>)}</div></section>}

    <section className="publicCard"><div className="sectionHead"><div><h2>📋 Latest results</h2><span>Most recent completed matches</span></div></div>
      {results.length===0?<p className="muted">No completed matches yet.</p>:<div className="publicList">{results.map(m=><div className="publicRow" key={m.id}><strong>Match {m.match_number}</strong><span><a href={`/player/${m.player1_id}?competition=${id}`}>{playerName(players,m.player1_id)}</a> vs <a href={`/player/${m.player2_id}?competition=${id}`}>{playerName(players,m.player2_id)}</a></span><b>{m.score1??0} – {m.score2??0}</b><em>Winner: {playerName(players,m.winner_id)}</em></div>)}</div>}
    </section>
    <footer>PottersMate · Competition information updates automatically</footer>
  <style>{css}</style></main>
}

function Brand(){return <div className="brand"><span className="mark">8</span><b>Potters<span>Mate</span></b></div>}

const css=`*{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;background:#f5f7fa;color:#172033}.publicPage{min-height:100vh;max-width:1100px;margin:auto;padding:26px 18px 50px}.brand{display:flex;align-items:center;gap:9px;color:#172033}.brand .mark{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:#101521;color:#fff;font-weight:900}.brand b{font-size:25px;font-weight:900}.brand b span{color:#a020f0}.publicHeader{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:12px 0 22px}.publicHeader h1{margin:18px 0 5px;font-size:32px}.publicHeader p{margin:0;color:#667085}.publicHeader>a{padding:11px 15px;border:1px solid #d7dce5;border-radius:10px;background:#fff;color:#172033;text-decoration:none;font-weight:800}.publicStats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}.publicStats div,.publicCard{background:#fff;border:1px solid #dfe4ec;border-radius:14px}.publicStats div{padding:13px;text-align:center}.publicStats b{display:block;font-size:22px}.publicStats span{color:#667085;font-size:12px}.publicCard{padding:17px;margin-bottom:14px}.sectionHead{display:flex;justify-content:space-between;align-items:center;margin-bottom:13px}.sectionHead h2{margin:0;font-size:20px}.sectionHead span{color:#667085;font-size:12px}.liveGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px}.liveCard{border:1px solid #e3e7ee;border-radius:12px;padding:14px;position:relative}.livePill{font-size:10px;font-weight:900;color:#067647;background:#ecfdf3;border:1px solid #abefc6;border-radius:99px;padding:4px 7px}.liveCard h3{margin:10px 0}.names{display:grid;grid-template-columns:1fr auto 1fr;gap:9px;align-items:center}.names a,.publicRow a,.standRow a{color:#172033;font-weight:800;text-decoration:none}.names strong{font-size:21px}.liveCard small{display:block;color:#667085;margin-top:10px}.publicList{border:1px solid #e3e7ee;border-radius:10px;overflow:hidden}.publicRow{display:grid;grid-template-columns:90px minmax(0,1fr) auto auto;gap:12px;align-items:center;padding:11px 13px;border-top:1px solid #edf0f4}.publicRow:first-child{border-top:0}.publicRow em{font-style:normal;color:#667085;font-size:12px}.groupGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px}.groupBox{border:1px solid #e3e7ee;border-radius:11px;overflow:hidden}.groupBox h3{margin:0;padding:11px;background:#f7f8fb}.standHead,.standRow{display:grid;grid-template-columns:30px minmax(0,1fr) 32px 32px 38px 38px;gap:5px;padding:8px 10px;align-items:center;font-size:12px}.standHead{font-weight:800;color:#667085;background:#fafbfc}.standRow{border-top:1px solid #edf0f4}.muted{color:#667085}.publicPage footer{text-align:center;color:#98a2b3;font-size:11px;margin-top:20px}@media(max-width:700px){.publicHeader{display:grid}.publicStats{grid-template-columns:repeat(2,1fr)}.publicRow{grid-template-columns:1fr auto}.publicRow span{grid-column:1/-1}.publicRow em{grid-column:2}.names{grid-template-columns:1fr auto 1fr;font-size:13px}}
`;
