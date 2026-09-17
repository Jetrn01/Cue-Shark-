'use client';

import {useEffect,useMemo,useState} from 'react';
import {createClient} from '@supabase/supabase-js';

const supabase=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

function displayName(p){return p?.display_name||[p?.first_name,p?.last_name].filter(Boolean).join(' ')||'Player'}

export default function PlayerLogin(){
 const [session,setSession]=useState(null),[player,setPlayer]=useState(null),[mode,setMode]=useState('login');
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[first,setFirst]=useState(''),[last,setLast]=useState(''),[clubId,setClubId]=useState(''),[clubs,setClubs]=useState([]),[clubSearch,setClubSearch]=useState(''),[clubRequest,setClubRequest]=useState(false);
 const [msg,setMsg]=useState(''),[busy,setBusy]=useState(false),[matches,setMatches]=useState([]),[competitions,setCompetitions]=useState([]),[tables,setTables]=useState([]),[people,setPeople]=useState({});

 useEffect(()=>{
  supabase.auth.getSession().then(({data})=>setSession(data.session));
  const {data}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));
  return()=>data.subscription.unsubscribe();
 },[]);

 useEffect(()=>{loadClubs();if(session) loadPlayer()},[session]);
 async function loadClubs(){
  const {data,error}=await supabase.from('clubs').select('id,name,city,region').eq('status','active').order('name');
  if(!error)setClubs(data||[]);
 }

 async function loadPlayer(){
  const {data,error}=await supabase.rpc('claim_player_account',{p_first_name:first.trim()||null,p_last_name:last.trim()||null});
  if(error){setMsg(error.message);return}
  setPlayer(data?.[0]||data||null);
  await loadMatches(data?.[0]?.id||data?.id);
 }

 async function loadMatches(pid){
  if(!pid)return;
  const {data,error}=await supabase.from('competition_matches').select('*').or(`player1_id.eq.${pid},player2_id.eq.${pid}`).order('created_at',{ascending:false});
  if(error){setMsg(error.message);return}
  const ms=data||[];setMatches(ms);
  const personIds=[...new Set(ms.flatMap(m=>[m.player1_id,m.player2_id]).filter(Boolean))];
  if(personIds.length){const pr=await supabase.from('players').select('id,first_name,last_name,display_name').in('id',personIds);const map={};(pr.data||[]).forEach(p=>map[p.id]=p);setPeople(map)}
  const ids=[...new Set(ms.map(m=>m.competition_id).filter(Boolean))];
  if(ids.length){
    const cr=await supabase.from('competitions').select('id,name,start_date,venue,format,session_type,season_week').in('id',ids);setCompetitions(cr.data||[]);
    const tr=await supabase.from('tournament_tables').select('id,table_number,table_token').in('competition_id',ids);setTables(tr.data||[]);
  }
 }

 async function submit(e){
  e.preventDefault();setMsg('');setBusy(true);
  try{
   if(mode==='signup'){
    if(!first.trim()||!last.trim()){setMsg('Please enter your first and last name.');return}
    const {data,error}=await supabase.auth.signUp({email:email.trim(),password,options:{data:{first_name:first.trim(),last_name:last.trim(),club_id:clubId||null}}});
    if(error){setMsg(error.message);return}
    if(data.session){
      const r=await supabase.rpc('claim_player_account',{p_first_name:first.trim(),p_last_name:last.trim(),p_club_id:clubId||null});
      if(r.error)setMsg(r.error.message);else{setPlayer(r.data?.[0]||r.data||null);setMsg('Your player account is ready.')}
    }else setMsg('Account created. Check your email to confirm your account, then return here to log in.');
   }else{
    const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password});
    if(error)setMsg(error.message);
   }
  }finally{setBusy(false)}
 }

 async function confirmResult(matchId){
  setMsg(''); setBusy(true);
  const {error}=await supabase.rpc('confirm_match_result',{p_match_id:matchId});
  if(error){setMsg(error.message);}else{setMsg('Your confirmation has been recorded. The result becomes official once both players confirm.');await loadMatches(player?.id);}
  setBusy(false);
 }
 async function disputeResult(matchId){
  const reason=window.prompt('Optional: tell the organiser what is wrong with the result.');
  setMsg(''); setBusy(true);
  const {error}=await supabase.rpc('dispute_match_result',{p_match_id:matchId,p_reason:reason||null});
  if(error){setMsg(error.message);}else{setMsg('The result has been disputed and sent to the organiser for review.');await loadMatches(player?.id);}
  setBusy(false);
 }

 async function logout(){await supabase.auth.signOut();setPlayer(null);setMatches([]);setCompetitions([]);setTables([]);setPeople({})}

 const played=matches.filter(m=>m.status==='completed'&&m.winner_id);const wins=played.filter(m=>m.winner_id===player?.id).length;const losses=played.filter(m=>m.loser_id===player?.id).length;
 const current=useMemo(()=>matches.find(m=>m.status!=='completed'&&m.status!=='bye'),[matches]);
 const compMap=Object.fromEntries(competitions.map(c=>[c.id,c]));
 const opponent=current?(current.player1_id===player?.id?current.player2_id:current.player1_id):null;
 const opponentName=opponent?displayName(people[opponent]):'TBC';
 const currentTable=tables.find(t=>t.id===current?.table_id);
 const scoringUrl=currentTable?.table_token?`/score/${currentTable.table_token}`:'#';

 if(!session)return <><style>{css}</style><main className="playerLogin"><div className="loginCard"><Brand/><div className="tag">PLAYER AREA</div><h1>{mode==='login'?'Welcome back':'Create your player account'}</h1><p className="muted">{mode==='login'?'Log in to see your matches, tables and results.':'Register once and use PottersMate without needing a QR code.'}</p>{mode==='signup'&&<><input placeholder="First name" value={first} onChange={e=>setFirst(e.target.value)} required/><input placeholder="Last name" value={last} onChange={e=>setLast(e.target.value)} required/><div className="clubPicker"><label>Club</label><input placeholder="Search your club..." value={clubSearch} onChange={e=>{setClubSearch(e.target.value);setClubId('')}}/><div className="clubOptions">{clubs.filter(c=>`${c.name} ${c.city||''} ${c.region||''}`.toLowerCase().includes(clubSearch.toLowerCase())).slice(0,8).map(c=><button type="button" key={c.id} className={clubId===c.id?'selectedClub':''} onClick={()=>{setClubId(c.id);setClubSearch(c.name)}}>{c.name}{c.city?` · ${c.city}`:''}</button>)}</div>{clubRequest?<div className="clubRequest"><input placeholder="Club name" id="requestedClubName"/><input placeholder="City / region" id="requestedClubLocation"/></div>:<button type="button" className="link clubMissing" onClick={()=>setClubRequest(true)}>My club isn't listed</button>}</div></>}<form onSubmit={submit}><input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required/><input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} minLength={6} required/><button className="primary" disabled={busy}>{busy?'Please wait…':mode==='login'?'Log in':'Create player account'}</button></form>{msg&&<div className="message">{msg}</div>}<button className="link" onClick={()=>{setMode(mode==='login'?'signup':'login');setMsg('')}}>{mode==='login'?'New player? Create an account':'Already registered? Log in'}</button><a className="back" href="/">← Organiser login</a></div></main></>;

 return <><style>{css}</style><main className="playerDash"><header><Brand/><div><button onClick={logout}>Log out</button></div></header><section className="hero"><div><span className="tag">MY POTTERSMATE</span><h1>Hi, {displayName(player).split(' ')[0]} 👋</h1><p>See your matches, tables and results in one place.</p><div className="playerClub">{player?.club_name?`🏠 ${player.club_name}`:"🏠 Club not set"}</div></div><div className="stats"><div><b>{played.length}</b><span>Played</span></div><div><b>{wins}</b><span>Wins</span></div><div><b>{losses}</b><span>Losses</span></div></div></section>
 {matches.filter(m=>m.status==='pending_confirmation'||m.status==='disputed').map(m=>{
   const isP1=m.player1_id===player?.id; const oppId=isP1?m.player2_id:m.player1_id; const opp=displayName(people[oppId]);
   return <section className="card confirmationCard" key={m.id}><div className="head"><h2>🔐 Confirm match result</h2><span>Match {m.match_number}</span></div>
    <div className="confirmationResult"><strong>{displayName(player)} {isP1?m.score1:m.score2} – {isP1?m.score2:m.score1} {opp}</strong><small>{m.status==='disputed'?'⚠️ Result disputed — organiser review required.':'Please check the score carefully before confirming.'}</small></div>
    {m.status==='pending_confirmation'&&<div className="confirmActions"><button className="primary" disabled={busy} onClick={()=>confirmResult(m.id)}>✓ Confirm result</button><button disabled={busy} onClick={()=>disputeResult(m.id)}>⚠️ Result is incorrect</button></div>}
   </section>
  })}
 {msg&&<div className="message dashMessage">{msg}</div>}
 <section className="card"><div className="head"><h2>🎱 My next match</h2><button onClick={()=>loadMatches(player?.id)}>↻ Refresh</button></div>{current?<div className="matchHero"><span className={current.table_id?'live':'next'}>{current.table_id?'LIVE':'UP NEXT'}</span><h2>Match {current.match_number}</h2><div className="versus"><strong>{displayName(player)}</strong><span>vs</span><strong>{opponentName}</strong></div><p>{current.table_id?`🎱 Table ${currentTable?.table_number||'assigned'}`:'Waiting for table assignment'} · Race to {current.race_to}</p><a className="button" href={scoringUrl}>{current.table_id?'Open scoring':'View tournament'}</a></div>:<p className="muted">You don't currently have a live or upcoming match.</p>}</section>
 <section className="card"><div className="head"><h2>📋 My recent results</h2><span>{played.length} completed</span></div>{played.slice(0,10).map(m=>{const c=compMap[m.competition_id];const won=m.winner_id===player.id;return <div className="result" key={m.id}><div><b className={won?'win':'loss'}>{won?'WIN':'LOSS'}</b><span>{c?.name||'Competition'}</span><small>{c?.start_date||''}{c?.season_week?` · Week ${c.season_week}`:''}</small></div><strong>{m.player1_id===player.id?m.score1:m.score2} – {m.player1_id===player.id?m.score2:m.score1}</strong></div>})}{played.length===0&&<p className="muted">Your completed matches will appear here.</p>}</section>
 <section className="card"><h2>🏆 My competitions</h2>{competitions.length===0?<p className="muted">You haven't played any recorded competitions yet.</p>:competitions.map(c=><div className="comp" key={c.id}><div><b>{c.name}</b><small>{c.venue||''}{c.start_date?` · ${c.start_date}`:''}</small></div><a href={`/tournament/${c.id}`}>View tournament →</a></div>)}</section>
 <footer>PottersMate · Player area</footer></main></>;
}

function Brand(){return <div className="brand"><span className="mark">8</span><b>Potters<span>Mate</span></b></div>}
const css=`*{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;background:#f5f7fa;color:#172033}.brand{display:flex;align-items:center;gap:9px}.brand .mark{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:#101521;color:#fff;font-weight:900}.brand b{font-size:27px}.brand b span{color:#a020f0}.playerLogin{min-height:100vh;display:grid;place-items:center;padding:25px}.loginCard{width:min(430px,100%);background:#fff;border:1px solid #dfe4ec;border-radius:18px;padding:26px}.tag{display:block;color:#7b3fc6;font-size:10px;font-weight:900;letter-spacing:1.4px;margin-top:24px}.loginCard h1{margin:7px 0}.muted{color:#667085}.loginCard form,.loginCard>input{display:grid;gap:10px;margin-top:12px}.clubPicker{margin-top:12px}.clubPicker>label{display:block;font-size:12px;font-weight:800;margin-bottom:5px}.clubOptions{display:grid;border:1px solid #e3e7ee;border-radius:9px;overflow:hidden;margin-top:6px}.clubOptions button{border:0;background:#fff;text-align:left;padding:10px 11px;border-top:1px solid #edf0f4;cursor:pointer}.clubOptions button:first-child{border-top:0}.clubOptions button:hover,.clubOptions .selectedClub{background:#f7f2ff}.clubMissing{font-size:12px;padding:0;margin-top:8px}.clubRequest{display:grid;gap:8px;margin-top:8px}.playerClub{display:inline-block;margin-top:10px;padding:6px 9px;border-radius:99px;background:#1b2130;color:#d8dce5;font-size:11px}.loginCard input{width:100%;padding:12px;border:1px solid #d7dce5;border-radius:9px;font-size:15px}.primary,.button{display:inline-block;padding:12px 15px;border:0;border-radius:9px;background:#10182a;color:#fff;font-weight:800;text-decoration:none;cursor:pointer}.loginCard form .primary{margin-top:2px}.link{border:0;background:none;color:#6f2dbd;font-weight:800;cursor:pointer;margin-top:13px}.back{display:block;text-align:center;color:#667085;text-decoration:none;font-size:12px;margin-top:18px}.message{margin-top:12px;padding:10px;border-radius:9px;background:#f7f8fb;font-size:12px}.playerDash{max-width:1000px;margin:auto;padding:24px 18px 50px}.playerDash header{display:flex;justify-content:space-between;align-items:center;margin-bottom:25px}.playerDash header button,.head button{padding:9px 12px;border:1px solid #d7dce5;border-radius:9px;background:#fff;cursor:pointer}.hero{background:#101521;color:#fff;border-radius:18px;padding:24px;display:flex;justify-content:space-between;gap:20px;margin-bottom:14px}.hero h1{margin:7px 0 4px;font-size:32px}.hero p{margin:0;color:#c5cad5}.stats{display:grid;grid-template-columns:repeat(3,90px);gap:8px;align-content:center}.stats div{background:#1b2130;border-radius:10px;padding:10px;text-align:center}.stats b{display:block;font-size:22px}.stats span{font-size:10px;color:#aeb6c6}.card{background:#fff;border:1px solid #dfe4ec;border-radius:14px;padding:18px;margin-bottom:14px}.head{display:flex;justify-content:space-between;align-items:center}.head h2,.card>h2{margin:0 0 12px}.matchHero{text-align:center;padding:12px}.matchHero .live,.matchHero .next{display:inline-block;border-radius:99px;padding:5px 9px;font-size:10px;font-weight:900}.live{color:#067647;background:#ecfdf3;border:1px solid #abefc6}.next{color:#7a4b00;background:#fff7e6;border:1px solid #f2d29a}.matchHero h2{margin:10px}.versus{display:flex;justify-content:center;gap:18px;align-items:center;font-size:20px}.versus span{font-size:12px;color:#98a2b3}.matchHero p{color:#667085}.result,.comp{display:flex;justify-content:space-between;gap:15px;padding:11px 0;border-top:1px solid #edf0f4}.result:first-of-type,.comp:first-of-type{border-top:0}.result div,.comp div{display:grid;gap:2px}.result small,.comp small{color:#667085}.win{color:#067647;font-size:10px}.loss{color:#b42318;font-size:10px}.comp a{color:#6f2dbd;text-decoration:none;font-weight:800;font-size:12px}.confirmationCard{border-color:#d7c8f4;background:#faf7ff}.confirmationResult{text-align:center;padding:12px}.confirmationResult strong{display:block;font-size:19px}.confirmationResult small{display:block;color:#667085;margin-top:7px}.confirmActions{display:flex;justify-content:center;gap:9px;flex-wrap:wrap;margin-top:8px}.dashMessage{margin-bottom:14px}.playerDash footer{text-align:center;color:#98a2b3;font-size:11px;margin-top:20px}@media(max-width:700px){.hero{display:grid}.stats{grid-template-columns:repeat(3,1fr)}.versus{font-size:16px}}`;
