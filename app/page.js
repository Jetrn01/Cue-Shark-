'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

function PottersMateBrand({compact=false}){
  return <div className={`pmBrand ${compact?'pmBrandCompact':''}`} aria-label="PottersMate">
    <svg className="pmMark" viewBox="0 0 100 82" aria-hidden="true">
      <path d="M12 64 C24 31 43 12 69 12 C84 12 92 21 92 34 C92 48 81 56 66 56 L43 56 L36 70 L20 70 Z" fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M18 60 C27 40 39 28 52 22" fill="none" stroke="var(--pm-purple)" strokeWidth="8" strokeLinecap="round"/>
      <circle cx="66" cy="34" r="17" fill="#0b0b0d" stroke="currentColor" strokeWidth="5"/>
      <circle cx="66" cy="34" r="10" fill="#fff"/>
      <text x="66" y="39" textAnchor="middle" fontSize="13" fontWeight="900" fill="#0b0b0d">8</text>
    </svg>
    {!compact && <span className="pmWordmark"><b>Potters</b><strong>Mate</strong><small>TOURNAMENT MANAGEMENT</small></span>}
  </div>
}

function Modal({title, children, close}) {
  return <div className="backdrop"><div className="modal">
    <div className="mh"><h3>{title}</h3><button onClick={close}>✕</button></div>{children}
  </div></div>
}


function ReverseCrossoverPreview({players = [], groupCount = 2}) {
  const n = players.length;
  const g = Math.max(2, Math.min(groupCount || 2, Math.max(2, n || 2)));
  const groups = Array.from({length:g},()=>[]);
  players.forEach((p,i)=>groups[i % g].push(p));

  const pairGroups = [];
  for(let i=0;i<Math.floor(g/2);i++) pairGroups.push([groups[i], groups[g-1-i]]);
  if(g % 2) pairGroups.push([groups[Math.floor(g/2)], []]);

  const matches=[];
  pairGroups.forEach(([left,right],pi)=>{
    const len=Math.max(left.length,right.length);
    for(let i=0;i<len;i++){
      const a=left[i] || null;
      const b=right[right.length-1-i] || null;
      if(a || b) matches.push({a,b,label:`Crossover ${pi+1}.${i+1}`});
    }
  });

  return <div className="reverseCrossoverPreview">
    <div className="previewHeader">
      <div><strong>Reverse Crossover Preview</strong>
        <span>{n} players · {g} groups · {matches.filter(m=>m.a&&m.b).length} matches · {matches.filter(m=>!m.a||!m.b).length} bye{matches.filter(m=>!m.a||!m.b).length===1?'':'s'}</span>
      </div>
      <span className="previewRule">1st vs last · 2nd vs second-last</span>
    </div>
    <div className="previewMatches">
      {matches.map((m,i)=><div className={`previewMatch ${(!m.a||!m.b)?'hasBye':''}`} key={i}>
        <strong>{i+1}</strong>
        <span>{m.a?.name || m.a?.full_name || 'BYE'}</span>
        <b>vs</b>
        <span>{m.b?.name || m.b?.full_name || 'BYE'}</span>
        {(!m.a||!m.b)&&<em>BYE</em>}
      </div>)}
    </div>
    <small>Preview only — the organiser confirms the crossover after group standings are final.</small>
  </div>
}


function rankGroupPlayers(groupMatches){
  const standings={};
  for(const m of groupMatches){
    for(const id of [m.player1_id,m.player2_id]){
      if(id && !standings[id]) standings[id]={id,wins:0,losses:0,ballDiff:0,for:0,against:0};
    }
    if(m.winner_id && standings[m.winner_id]) standings[m.winner_id].wins++;
    const loserId=m.winner_id===m.player1_id?m.player2_id:(m.winner_id===m.player2_id?m.player1_id:null);
    if(loserId && standings[loserId]) standings[loserId].losses++;

    // For Race to 1, winner_balls is the number of balls remaining for the winner.
    // The winner gets +N and the loser gets -N, giving every player a signed
    // cumulative ball differential across the group stage.
    if(Number(m.race_to)===1 && m.winner_id && m.winner_balls!==null && m.winner_balls!==undefined){
      const n=Number(m.winner_balls)||0;
      if(standings[m.winner_id]) standings[m.winner_id].ballDiff+=n;
      if(loserId && standings[loserId]) standings[loserId].ballDiff-=n;
    }

    // Keep frame totals as a secondary informational statistic.
    if(m.player1_id && standings[m.player1_id]){
      standings[m.player1_id].for+=Number(m.score1||0);
      standings[m.player1_id].against+=Number(m.score2||0);
    }
    if(m.player2_id && standings[m.player2_id]){
      standings[m.player2_id].for+=Number(m.score2||0);
      standings[m.player2_id].against+=Number(m.score1||0);
    }
  }
  return Object.values(standings).sort((a,b)=>
    b.wins-a.wins ||
    b.ballDiff-a.ballDiff ||
    (b.for-b.against)-(a.for-a.against) ||
    b.for-a.for ||
    a.id.localeCompare(b.id)
  );
}

function qualificationPlan(groupCount, qualifiersPerGroup){
  const automatic=Math.max(0, Number(groupCount||0)*Number(qualifiersPerGroup||0));
  const targets=[2,4,8,16,32,64];
  const target=targets.find(n=>n>=automatic) || (automatic>0 ? 2**Math.ceil(Math.log2(automatic)) : 0);
  return {automatic,target,wildcards:Math.max(0,target-automatic)};
}

function buildEmptyKnockoutRows(competitionId,startMatchNo,targetSize,race){
  const size=Number(targetSize)||0;
  if(size<2 || (size & (size-1))!==0) return [];
  const rounds=[];
  let matchNo=Number(startMatchNo)||1;
  for(let count=size/2,roundNumber=2;count>=1;count=Math.floor(count/2),roundNumber++){
    const round=[];
    for(let i=0;i<count;i++) round.push({
      id:crypto.randomUUID(),
      competition_id:competitionId,
      match_number:matchNo++,
      round_number:roundNumber,
      group_name:null,
      player1_id:null,
      player2_id:null,
      race_to:Number(race)||1,
      status:'waiting',
      score1:0,
      score2:0,
      table_id:null,
      next_match_id:null,
      next_slot:null,
      winner_id:null,
      loser_id:null
    });
    rounds.push(round);
  }
  for(let r=0;r<rounds.length-1;r++){
    for(let i=0;i<rounds[r].length;i++){
      rounds[r][i].next_match_id=rounds[r+1][Math.floor(i/2)].id;
      rounds[r][i].next_slot=(i%2)+1;
    }
  }
  return rounds.flat();
}

function groupKnockoutPairs(ranked, groupNames, mode='group_crossover'){
  const qualifiers=[];
  if(mode==='random'){
    groupNames.forEach(g=>ranked[g].forEach((p,pos)=>qualifiers.push({...p,group:g,position:pos+1})));
    qualifiers.sort(()=>Math.random()-0.5);
    return qualifiers;
  }
  // Group crossover: A1 vs B4, A2 vs B3, etc.; C vs D, E vs F...
  if(mode==='group_crossover') return qualifiers;
  groupNames.forEach(g=>ranked[g].forEach((p,pos)=>qualifiers.push({...p,group:g,position:pos+1})));
  return qualifiers;
}


function sessionScoreIncluded(value){
  return value !== 'casual';
}
function SessionTypeControl({value, onChange}){
  return <div className="sessionTypeControl">
    <label>Session type</label>
    <select value={value || 'season'} onChange={e=>onChange(e.target.value)}>
      <option value="season">🏆 Season / Points session</option>
      <option value="casual">🎱 Casual night — excluded from season score</option>
    </select>
    <small>Casual results are still saved in match history, but wins, losses and points are not counted toward the recurring season standings.</small>
  </div>
}


function SeasonLengthControl({value, onChange}){
  const n = Math.max(1, Math.min(52, Number(value) || 8));
  return <div className="seasonLengthControl">
    <label>Season length</label>
    <div className="seasonLengthRow">
      <input type="number" min="1" max="52" value={n}
        onChange={e=>onChange(Math.max(1, Math.min(52, Number(e.target.value)||1)))}/>
      <span>weeks</span>
    </div>
    <small>Choose any season length from 1 to 52 weeks. Casual sessions can still be run between or after season weeks without affecting the season score.</small>
  </div>
}


function buildSeasonStandings(players, seasonMatches, points){
  const rows={};
  const add=(id,name)=>{ if(!id) return; if(!rows[id]) rows[id]={id,name,played:0,wins:0,losses:0,points:0,framesFor:0,framesAgainst:0}; };
  seasonMatches.forEach(m=>{
    const p1=players.find(x=>x.player_id===m.player1_id)?.players;
    const p2=players.find(x=>x.player_id===m.player2_id)?.players;
    const n=(p)=>p?.display_name || [p?.first_name,p?.last_name].filter(Boolean).join(' ') || 'Player';
    add(m.player1_id,n(p1)); add(m.player2_id,n(p2));
    if(!rows[m.player1_id]||!rows[m.player2_id]) return;
    rows[m.player1_id].played++; rows[m.player2_id].played++;
    rows[m.player1_id].framesFor += Number(m.score1||0); rows[m.player1_id].framesAgainst += Number(m.score2||0);
    rows[m.player2_id].framesFor += Number(m.score2||0); rows[m.player2_id].framesAgainst += Number(m.score1||0);
    if(m.winner_id===m.player1_id){ rows[m.player1_id].wins++; rows[m.player2_id].losses++; rows[m.player1_id].points+=Number(points.win); rows[m.player2_id].points+=Number(points.loss); }
    else if(m.winner_id===m.player2_id){ rows[m.player2_id].wins++; rows[m.player1_id].losses++; rows[m.player2_id].points+=Number(points.win); rows[m.player1_id].points+=Number(points.loss); }
  });
  return Object.values(rows).sort((a,b)=>b.points-a.points||b.wins-a.wins||(b.framesFor-b.framesAgainst)-(a.framesFor-a.framesAgainst)||b.framesFor-a.framesFor);
}

export default function Home() {
  const [session,setSession]=useState(null), [mode,setMode]=useState('login');
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[authMsg,setAuthMsg]=useState('');
  const [competitions,setCompetitions]=useState([]),[selected,setSelected]=useState(null);
  const [templates,setTemplates]=useState([]), [seasonCompetitions,setSeasonCompetitions]=useState([]),
    [seasonMatches,setSeasonMatches]=useState([]), [pointsSettings,setPointsSettings]=useState({win:1,loss:0});
  const [templateTables,setTemplateTables]=useState([]);
  const [players,setPlayers]=useState([]),[tables,setTables]=useState([]),[matches,setMatches]=useState([]);
  const [modal,setModal]=useState(null),[msg,setMsg]=useState('');
  const [drawSettings,setDrawSettings]=useState({type:'Knockout',race_to:3,group_race_to:1,knockout_race_to:2,group_count:4,qualifiers_per_group:4,group_knockout_mode:'group_crossover'});
  const autoPopulateInFlight=useRef(false);
  const [qrData,setQrData]=useState(null);
  const [playerDB,setPlayerDB]=useState([]),[clubs,setClubs]=useState([]);
  const [profileData,setProfileData]=useState({player:null,matches:[],competitions:[],templates:[],loading:false});

  useEffect(()=>{supabase.auth.getSession().then(({data})=>setSession(data.session));
    const {data:s}=supabase.auth.onAuthStateChange((_e,x)=>setSession(x)); return()=>s.subscription.unsubscribe()},[]);
  useEffect(()=>{if(session) loadCompetitions()},[session]);
  useEffect(()=>{if(session) loadPlayerDB()},[session]);
  useEffect(()=>{if(session) loadTemplates()},[session]);
  useEffect(()=>{if(session) loadClubs()},[session]);

  useEffect(()=>{
    if(!session || !selected) return;
    const timer=setInterval(()=>load(selected),5000);
    return()=>clearInterval(timer);
  },[session,selected]);

  useEffect(()=>{
    if(!session || !selected || autoPopulateInFlight.current) return;
    const groupMatches=matches.filter(m=>m.group_name && Number(m.round_number)===1);
    const knockoutMatches=matches.filter(m=>Number(m.round_number)>1 && !m.group_name);
    if(!groupMatches.length || !knockoutMatches.length || !groupMatches.every(m=>m.status==='completed')) return;
    const firstRound=knockoutMatches.filter(m=>Number(m.round_number)===2);
    if(!firstRound.length || firstRound.some(m=>m.player1_id || m.player2_id)) return;
    autoPopulateInFlight.current=true;
    const format=(selected.format||'').toLowerCase();
    const effectiveSettings=(drawSettings.type==='Knockout' && ['groups → knockout','reverse cross','seeded 16'].includes(format))
      ? {...drawSettings,type:format==='groups → knockout'?'Groups → Knockout':format==='reverse cross'?'Reverse Cross':'Seeded 16',group_count:format==='seeded 16'?4:drawSettings.group_count,qualifiers_per_group:format==='seeded 16'?4:drawSettings.qualifiers_per_group,group_knockout_mode:format==='seeded 16'?'top16_overall':drawSettings.group_knockout_mode}
      : drawSettings;
    generateGroupKnockout(effectiveSettings).finally(()=>{autoPopulateInFlight.current=false;});
  },[session,selected,matches,drawSettings]);

  async function loadPlayerDB(){const {data,error}=await supabase.from('players').select('id,first_name,last_name,display_name,phone,email,club_name,primary_club_id,requires_accessible_table').order('display_name',{ascending:true});if(error)setMsg(error.message);else setPlayerDB(data||[])}
  async function loadClubs(){const {data,error}=await supabase.from('clubs').select('id,name,city,region,status').order('name');if(error)setMsg(error.message);else setClubs(data||[])}

  async function loadCompetitions(){const {data,error}=await supabase.from('competitions').select('*').order('start_date',{ascending:true}); if(error)setMsg(error.message);else setCompetitions(data||[])}
  async function loadTemplates(){const {data,error}=await supabase.from('competition_templates').select('*').eq('is_active',true).order('name'); if(error)setMsg(error.message);else setTemplates(data||[])}
  async function load(c){setSelected(c);
    const [p,m,tDirect]=await Promise.all([
      supabase.from('competition_players').select('id,player_id,checked_in,players(id,first_name,last_name,display_name,phone,email,club_name,primary_club_id,requires_accessible_table)').eq('competition_id',c.id),
      supabase.from('competition_matches').select('*').eq('competition_id',c.id).order('match_number'),
      supabase.from('tournament_tables').select('*').eq('competition_id',c.id).order('table_number')
    ]);
    let sessionTables=tDirect.data||[];
    if(c.recurring_template_id){
      const {data:shared,error:sharedError}=await supabase.from('tournament_tables').select('*').eq('recurring_template_id',c.recurring_template_id).order('table_number');
      if(!sharedError && (shared||[]).length>0) sessionTables=shared||[];
    }
    setPlayers(p.data||[]);setMatches(m.data||[]);setTables(sessionTables);
    if(c.recurring_template_id && c.season_id){
      const {data:sc}=await supabase.from('competitions').select('*').eq('recurring_template_id',c.recurring_template_id).eq('season_id',c.season_id).order('season_week',{ascending:true});
      setSeasonCompetitions(sc||[]);
      const seasonIds=(sc||[]).filter(x=>x.session_type==='season').map(x=>x.id);
      if(seasonIds.length){
        const {data:sm}=await supabase.from('competition_matches').select('competition_id,status,winner_id,loser_id,score1,score2,player1_id,player2_id').in('competition_id',seasonIds).eq('status','completed');
        setSeasonMatches(sm||[]);
      } else setSeasonMatches([]);
      const tpl=templates.find(x=>x.id===c.recurring_template_id);
      if(tpl) setPointsSettings({win:Number(tpl.win_points ?? 1),loss:Number(tpl.loss_points ?? 0)});
    } else { setSeasonCompetitions([]); setSeasonMatches([]); }
  }

  async function saveCompetition(f){
    const data={
      name:f.name.trim(),
      venue:f.venue.trim(),
      start_date:f.start_date || null,
      format:f.format,
      rules:f.rules,
      status:f.status,
      default_race_to:Number(f.default_race_to)
    };

    if(!selected){
      const {data:created,error}=await supabase.from('competitions').insert(data).select('*').single();
      if(error){setMsg(`Could not create competition: ${error.message}`);return;}
      setModal(null);
      await loadCompetitions();
      if(created) await load(created);
      setMsg(`"${created.name}" was created.`);
      return;
    }

    const {error}=await supabase.from('competitions').update(data).eq('id',selected.id);
    if(error){setMsg(error.message);return;}
    setModal(null);
    const {data:updated}=await supabase.from('competitions').select('*').eq('id',selected.id).single();
    if(updated){setSelected(updated);setCompetitions(prev=>prev.map(c=>c.id===updated.id?updated:c));}
  }

  function nextRecurringDate(day){
    const today=new Date();
    const target=Number(day);
    const diff=(target-today.getDay()+7)%7;
    const d=new Date(today);
    d.setDate(today.getDate()+diff);
    const pad=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }

  async function saveTemplate(f,old){
    const data={
      name:f.name.trim(), venue:f.venue.trim(), day_of_week:Number(f.day_of_week),
      format:f.format, rules:f.rules, default_race_to:Number(f.default_race_to),
      status:f.status, is_active:true, organiser_id:session.user.id,
      season_enabled:!!f.season_enabled,
      season_length_weeks:Math.max(1,Math.min(52,Number(f.season_length_weeks)||8)),
      season_id:old?.season_id || undefined
    };
    if(!data.season_id) delete data.season_id;
    const r=old
      ? await supabase.from('competition_templates').update(data).eq('id',old.id)
      : await supabase.from('competition_templates').insert(data);
    if(r.error){setMsg(`Could not save recurring tournament: ${r.error.message}`);return;}
    setModal(null); await loadTemplates(); setMsg(`Recurring tournament "${data.name}" saved.`);
  }

  async function startFromTemplate(t,sessionType='season'){
    const startDate=nextRecurringDate(t.day_of_week);
    let seasonWeek=null;
    const seasonId=t.season_id||null;
    if(sessionType==='season' && t.season_enabled!==false){
      const {data:prior,error:priorError}=await supabase.from('competitions').select('season_week').eq('recurring_template_id',t.id).eq('season_id',seasonId).eq('session_type','season').order('season_week',{ascending:false}).limit(1);
      if(priorError){setMsg(`Could not check season progress: ${priorError.message}`);return;}
      seasonWeek=(prior?.[0]?.season_week||0)+1;
      const total=Number(t.season_length_weeks||8);
      if(seasonWeek>total){setMsg(`The ${total}-week season is complete. Start a casual night or begin a new season.`);return;}
    }
    const data={
      name:sessionType==='casual'?`${t.name} — Casual`:t.name,
      venue:t.venue,start_date:startDate,format:t.format,rules:t.rules,status:'active',
      default_race_to:t.default_race_to,recurring_template_id:t.id,
      session_type:sessionType,season_week:sessionType==='season'?seasonWeek:null,
      season_id:sessionType==='season'?seasonId:null
    };
    const {data:created,error}=await supabase.from('competitions').insert(data).select('*').single();
    if(error){setMsg(`Could not start tournament: ${error.message}`);return;}
    if(created && t.id){
      await supabase.from('tournament_tables').update({status:'available'}).eq('recurring_template_id',t.id);
    }
    await loadCompetitions();
    if(created) await load(created);
    setModal(null);
    if(sessionType==='casual') setMsg(`Casual night started for ${created.start_date}. Results will be saved but excluded from the season score.`);
    else setMsg(`Season week ${seasonWeek} of ${t.season_length_weeks||8} started for ${created.start_date}. Add this week's players, check them in, then create the draw.`);
  }

  async function startNewSeason(t){
    const seasonId=crypto.randomUUID();
    const {error}=await supabase.from('competition_templates').update({season_id:seasonId}).eq('id',t.id);
    if(error){setMsg(`Could not start a new season: ${error.message}`);return;}
    await loadTemplates();
    await startFromTemplate({...t,season_id:seasonId},'season');
  }

  async function deactivateTemplate(t){
    if(!window.confirm(`Hide recurring tournament "${t.name}"? Existing competitions will not be affected.`))return;
    const {error}=await supabase.from('competition_templates').update({is_active:false}).eq('id',t.id);
    if(error)setMsg(error.message);else{await loadTemplates();setMsg(`"${t.name}" was removed from recurring tournaments.`)}
  }

  async function deleteCompetition(){
    if(!selected)return;
    const name=selected.name||'this competition';
    if(!window.confirm(`Delete "${name}"? This will permanently delete this competition and its associated tournament data. This cannot be undone.`))return;
    setMsg('');
    const {error}=await supabase.from('competitions').delete().eq('id',selected.id);
    if(error){setMsg(`Could not delete competition: ${error.message}`);return;}
    setModal(null);
    setSelected(null);
    setPlayers([]);
    setTables([]);
    setMatches([]);
    await loadCompetitions();
    setMsg(`"${name}" was deleted.`);
  }

  async function auth(e){e.preventDefault();setAuthMsg('');
    const r=mode==='login'?await supabase.auth.signInWithPassword({email,password}):await supabase.auth.signUp({email,password});
    if(r.error)setAuthMsg(r.error.message)
  }
  async function saveClub(f){
    const {data,error}=await supabase.rpc('organiser_save_club',{p_id:f.id==='new'?null:f.id,p_name:f.name,p_city:f.city,p_region:f.region,p_status:f.status||'active'});
    if(error){setMsg(error.message);return;}
    await loadClubs();
    setMsg(f.id==='new'?'Club created.':'Club updated.');
  }

  async function savePlayer(f){let error;
    const chosen=clubs.find(c=>c.id===f.club_id);
    const data={first_name:f.first_name.trim(),last_name:f.last_name.trim(),display_name:`${f.first_name.trim()} ${f.last_name.trim()}`.trim(),phone:f.phone.trim(),email:f.email.trim(),club_name:chosen?.name||f.club_name.trim(),primary_club_id:f.club_id||null,requires_accessible_table:!!f.requires_accessible_table};
    if(f.playerId) ({error}=await supabase.from('players').update(data).eq('id',f.playerId));
    else {
      let existing=null;
      if(data.email){const q=await supabase.from('players').select('*').ilike('email',data.email).limit(1);existing=q.data?.[0]||null;if(q.error){error=q.error}}
      const r=existing?{data:existing,error:null}:await supabase.from('players').insert(data).select().single();
      error=error||r.error;
      if(!error)({error}=await supabase.from('competition_players').insert({competition_id:selected.id,player_id:r.data.id,checked_in:false}))
    }
    if(error)setMsg(error.message);else{setModal(null);load(selected)}
  }
  async function addExistingPlayerToCompetition(p){
    if(!selected)return;
    const already=players.some(x=>x.player_id===p.id);
    if(already){setMsg(`${p.display_name||`${p.first_name||''} ${p.last_name||''}`.trim()} is already in this competition.`);return;}
    const {error}=await supabase.from('competition_players').insert({competition_id:selected.id,player_id:p.id,checked_in:false});
    if(error){setMsg(error.message);return;}
    await load(selected);
    setMsg(`${p.display_name||`${p.first_name||''} ${p.last_name||''}`.trim()} added to ${selected.name}.`);
  }

  async function deleteMasterPlayer(p){
    const name=p.display_name||`${p.first_name||''} ${p.last_name||''}`.trim()||'this player';
    if(!window.confirm(`Delete ${name} from the player database? This removes the player record and may also remove their competition entries. This cannot be undone.`))return;
    const {error}=await supabase.from('players').delete().eq('id',p.id);
    if(error){setMsg(`Could not delete ${name}: ${error.message}`);return;}
    await loadPlayerDB();
    if(selected) await load(selected);
    setMsg(`${name} deleted from the player database.`);
  }

  async function saveMasterPlayer(f){
    const chosen=clubs.find(c=>c.id===f.club_id);
    const data={first_name:f.first_name.trim(),last_name:f.last_name.trim(),display_name:`${f.first_name.trim()} ${f.last_name.trim()}`.trim(),phone:f.phone.trim(),email:f.email.trim(),club_name:chosen?.name||f.club_name.trim(),primary_club_id:f.club_id||null,requires_accessible_table:!!f.requires_accessible_table};
    const r=f.playerId
      ? await supabase.from('players').update(data).eq('id',f.playerId)
      : await supabase.from('players').insert(data);
    if(r.error){setMsg(r.error.message);return;}
    setModal(null);await loadPlayerDB();
    if(selected&&f.addToCompetition){
      const pid=f.playerId || r.data?.[0]?.id;
      if(pid) await addExistingPlayerToCompetition({...data,id:pid});
    } else setMsg(f.playerId?'Player updated.':'Player added to player database.');
  }

  async function openPlayerProfile(p){
    const player = p?.players ? p.players : p;
    if(!player?.id)return;
    setProfileData({player,matches:[],competitions:[],templates:[],loading:true});
    setModal({type:'playerProfile'});
    const {data:matchData,error:matchError}=await supabase
      .from('competition_matches')
      .select('id,competition_id,match_number,round_number,player1_id,player2_id,race_to,score1,score2,status,winner_id,loser_id,winner_balls,created_at')
      .eq('status','completed')
      .or(`player1_id.eq.${player.id},player2_id.eq.${player.id}`)
      .order('created_at',{ascending:false});
    if(matchError){
      setMsg(`Could not load ${player.display_name||'player'} history: ${matchError.message}`);
      setProfileData({player,matches:[],competitions:[],templates:[],loading:false});
      return;
    }
    const matchesHistory=matchData||[];
    const ids=[...new Set(matchesHistory.map(m=>m.competition_id).filter(Boolean))];
    let competitionsHistory=[];
    if(ids.length){
      const {data:cd}=await supabase.from('competitions')
        .select('id,name,start_date,venue,session_type,season_week,season_id,recurring_template_id')
        .in('id',ids);
      competitionsHistory=cd||[];
    }
    const templateIds=[...new Set(competitionsHistory.map(c=>c.recurring_template_id).filter(Boolean))];
    let templatesHistory=[];
    if(templateIds.length){
      const {data:td}=await supabase.from('competition_templates')
        .select('id,name,win_points,loss_points')
        .in('id',templateIds);
      templatesHistory=td||[];
    }
    setProfileData({player,matches:matchesHistory,competitions:competitionsHistory,templates:templatesHistory,loading:false});
  }

  async function removePlayer(p){if(!confirm(`Remove ${p.players?.display_name || `${p.players?.first_name||''} ${p.players?.last_name||''}`.trim() || 'this player'} from this competition?`))return;
    const {error}=await supabase.from('competition_players').delete().eq('id',p.id);if(error)setMsg(error.message);else load(selected)}
  async function checkin(p){await supabase.from('competition_players').update({checked_in:!p.checked_in}).eq('id',p.id);load(selected)}
  async function showQR(t){
    if(!t.table_token){setMsg('This table does not have a scoring token yet. Run the updated V6 QR SQL in Supabase.');return;}
    const url=`${window.location.origin}/score/${t.table_token}`;
    const image=await QRCode.toDataURL(url,{width:260,margin:2});
    setQrData({table:t,url,image});
  }

  async function saveTable(f,old){let r;
    const data={table_number:Number(f.table_number),table_type:f.table_type,notes:f.notes,is_accessible:f.is_accessible,status:f.status};
    if(selected?.recurring_template_id){
      if(old)r=await supabase.from('tournament_tables').update(data).eq('id',old.id).eq('recurring_template_id',selected.recurring_template_id);
      else r=await supabase.from('tournament_tables').insert({...data,competition_id:null,recurring_template_id:selected.recurring_template_id}).select('*').single();
    } else {
      if(old)r=await supabase.from('tournament_tables').update(data).eq('id',old.id);else r=await supabase.from('tournament_tables').insert({...data,competition_id:selected.id});
    }
    if(r.error)setMsg(r.error.message);else{setModal(null);load(selected)}
  }
  async function delTable(t){if(!confirm(`Delete Table ${t.table_number}?`))return;const r=await supabase.from('tournament_tables').delete().eq('id',t.id);if(r.error)setMsg(r.error.message);else load(selected)}
  async function openTemplateTables(t){
    const {data,error}=await supabase.from('tournament_tables').select('*').eq('recurring_template_id',t.id).order('table_number');
    if(error){setMsg(`Could not load recurring tables: ${error.message}`);return;}
    setTemplateTables(data||[]);setModal({type:'templateTables',t});
  }
  async function saveTemplateTable(f,old,t){
    const data={table_number:Number(f.table_number),table_type:f.table_type,notes:f.notes,is_accessible:f.is_accessible,status:f.status,competition_id:null,recurring_template_id:t.id};
    const r=old
      ? await supabase.from('tournament_tables').update({table_number:data.table_number,table_type:data.table_type,notes:data.notes,is_accessible:data.is_accessible,status:data.status}).eq('id',old.id).eq('recurring_template_id',t.id)
      : await supabase.from('tournament_tables').insert(data).select('*').single();
    if(r.error){setMsg(`Could not save recurring table: ${r.error.message}`);return;}
    const {data:rows}=await supabase.from('tournament_tables').select('*').eq('recurring_template_id',t.id).order('table_number');
    setTemplateTables(rows||[]);setMsg(`Table ${data.table_number} saved to the recurring tournament.`);
  }
  async function delTemplateTable(t){
    if(!confirm(`Delete Table ${t.table_number} from the recurring tournament?`))return;
    const {error}=await supabase.from('tournament_tables').delete().eq('id',t.id).eq('recurring_template_id',t.recurring_template_id);
    if(error)setMsg(error.message);else{setTemplateTables(prev=>prev.filter(x=>x.id!==t.id));setMsg(`Table ${t.table_number} removed from the recurring tournament.`)}
  }
  async function assign(m,id){
    if(id){
      const t=tables.find(x=>x.id===id);
      const needsAccessible=[m.player1_id,m.player2_id].some(pid=>players.find(x=>x.player_id===pid)?.players?.requires_accessible_table);
      if(needsAccessible && !t?.is_accessible){
        setMsg('This match includes a player who requires an accessible table. Please assign an accessible table.');
        return false;
      }

      // Prevent a player from being assigned to two live matches at once.
      const playerIds=[m.player1_id,m.player2_id].filter(Boolean);
      const playerConflict=matches.find(x=>
        x.id!==m.id &&
        x.table_id &&
        x.status!=='completed' &&
        playerIds.some(pid=>pid===x.player1_id || pid===x.player2_id)
      );
      if(playerConflict){
        const conflictPlayer=playerIds.find(pid=>pid===playerConflict.player1_id || pid===playerConflict.player2_id);
        setMsg(playerName(conflictPlayer)+' is already playing Match '+playerConflict.match_number+' on another table.');
        return false;
      }

      // Prevent two matches from being assigned to the same table.
      const tableConflict=matches.find(x=>x.id!==m.id && x.table_id===id && x.status!=='completed');
      if(tableConflict){
        setMsg('Table '+(t?.table_number||'')+' is already occupied by Match '+tableConflict.match_number+'.');
        return false;
      }
    }

    const previous=m.table_id;
    if(previous===id)return true;
    if(previous)await supabase.from('tournament_tables').update({status:'available'}).eq('id',previous);
    if(id)await supabase.from('tournament_tables').update({status:'occupied'}).eq('id',id);
    const r=await supabase.from('competition_matches').update({table_id:id||null}).eq('id',m.id);
    if(r.error){setMsg(r.error.message);return false;}
    await load(selected);
    return true;
  }

  async function approveMatchResult(m){
    if(!m)return;
    const name=`${playerName(m.player1_id)} ${m.score1??0}–${m.score2??0} ${playerName(m.player2_id)}`;
    if(!window.confirm(`Approve this result as official?\n\n${name}`))return;
    const {error}=await supabase.rpc('organiser_approve_match_result',{p_match_id:m.id});
    if(error)setMsg(`Could not approve result: ${error.message}`);else{await load(selected);setMsg(`Result for Match ${m.match_number} is now official.`);}
  }
  async function reopenMatchResult(m){
    if(!m)return;
    if(!window.confirm(`Reopen Match ${m.match_number} for score correction? The current result will remain visible but the match can be edited again.`))return;
    const {error}=await supabase.rpc('organiser_reopen_match_result',{p_match_id:m.id});
    if(error)setMsg(`Could not reopen result: ${error.message}`);else{await load(selected);setMsg(`Match ${m.match_number} has been reopened for correction.`);}
  }

  function openCorrection(m){
    if(!m)return;
    setMsg('');
    setModal({type:'resultCorrection',m});
  }

  async function correctMatchResult(f,m){
    if(!m)return;
    const score1=Number(f.score1), score2=Number(f.score2);
    const balls=f.winner_balls===''||f.winner_balls===null||f.winner_balls===undefined?null:Number(f.winner_balls);
    if(!Number.isInteger(score1)||!Number.isInteger(score2)||score1<0||score2<0){setMsg('Scores must be whole numbers of 0 or more.');return false;}
    if(Number(m.race_to)===1 && (balls===null||!Number.isInteger(balls)||balls<0||balls>7)){setMsg('For Race to 1, balls remaining must be a whole number from 0 to 7.');return false;}
    if(score1>Number(m.race_to)||score2>Number(m.race_to)){setMsg(`Score cannot exceed the race length (Race to ${m.race_to}).`);return false;}
    if(score1===score2 && (score1>=Number(m.race_to)||score2>=Number(m.race_to))){setMsg('A completed match cannot finish tied.');return false;}
    if(score1!==Number(m.race_to) && score2!==Number(m.race_to)){setMsg(`A final result must have one player reaching Race to ${m.race_to}.`);return false;}
    if(!window.confirm(`Make this corrected result official?\n\n${playerName(m.player1_id)} ${score1}–${score2} ${playerName(m.player2_id)}${Number(m.race_to)===1?`\nWinner balls remaining: ${balls}`:''}`))return false;
    const {error}=await supabase.rpc('organiser_correct_match_result',{p_match_id:m.id,p_score1:score1,p_score2:score2,p_winner_balls:balls});
    if(error){setMsg(`Could not correct result: ${error.message}`);return false;}
    setModal(null);
    await load(selected);
    setMsg(`Match ${m.match_number} corrected and made official.`);
    return true;
  }

  async function quickAssign(m,t){
    if(!m || !t || t.status==='unavailable' || m.status!=='scheduled') return;
    const needsAccessible=[m.player1_id,m.player2_id].some(pid=>players.find(x=>x.player_id===pid)?.players?.requires_accessible_table);
    if(needsAccessible && !t.is_accessible){setMsg(`Match ${m.match_number} requires an accessible table.`);return;}
    const assigned=await assign(m,t.id);
    if(assigned) setMsg(`Match ${m.match_number} assigned to Table ${t.table_number}.`);
  }

  async function assignNextReady(){
    const ready=matches.filter(m=>m.status==='scheduled' && !m.table_id);
    const free=tables.filter(t=>t.status==='available');

    // Accessibility gets priority: matches containing a player who requires
    // an accessible table are queued before all other ready matches.
    // This prevents a standard match from taking an accessible table when
    // an accessibility-required match is waiting for it.
    const needsAccessible=(m)=>[m.player1_id,m.player2_id]
      .some(pid=>players.find(x=>x.player_id===pid)?.players?.requires_accessible_table);
    const accessibleReady=ready.filter(needsAccessible);
    const standardReady=ready.filter(m=>!needsAccessible(m));
    const queue=[...accessibleReady,...standardReady];

    let assigned=0;
    for(const m of queue){
      const needs=needsAccessible(m);
      // Required-access matches can ONLY use an accessible table.
      // Standard matches prefer a standard table, but may use a remaining
      // accessible table when no accessibility-required match needs it.
      const t=needs
        ? free.find(x=>x.is_accessible)
        : free.find(x=>!x.is_accessible) || free.find(x=>x.is_accessible);
      if(!t) continue;

      const r=await supabase.from('competition_matches').update({table_id:t.id}).eq('id',m.id);
      if(r.error){setMsg(r.error.message);return;}
      const tr=await supabase.from('tournament_tables').update({status:'occupied'}).eq('id',t.id);
      if(tr.error){setMsg(tr.error.message);return;}
      free.splice(free.indexOf(t),1);
      assigned++;
    }

    await load(selected);
    setMsg(assigned
      ? `${assigned} ready match${assigned===1?'':'es'} assigned with accessibility priority.`
      : 'No ready match could be assigned. Check that a suitable available table is available.');
  }

  function playerName(id){
    const p=players.find(x=>x.player_id===id)?.players;
    return p?.display_name || `${p?.first_name||''} ${p?.last_name||''}`.trim() || 'TBC';
  }

  async function generateDraw(settings=drawSettings){
    if(!selected)return;
    const checkedPlayers=players.filter(p=>p.checked_in).map(p=>p.player_id).filter(Boolean);
    if(checkedPlayers.length<2){setMsg('Check in at least 2 players before generating matches.');return;}

    if(matches.length){
      if(matches.some(m=>['completed','in_progress','active'].includes(m.status))){
        setMsg('This competition already has matches in progress or completed. A new draw cannot replace them.');
        return;
      }
      if(!window.confirm('Replace the existing scheduled draw? This removes the current scheduled matches and creates a new draw.'))return;
      const {error}=await supabase.from('competition_matches').delete().eq('competition_id',selected.id);
      if(error){setMsg(error.message);return;}
    }

    const race=Number(settings.race_to||selected.default_race_to||3);
    let ordered=[...checkedPlayers];
    if(settings.type==='Random Draw') ordered.sort(()=>Math.random()-0.5);

    if(settings.type==='Round Robin'){
      const rows=[]; let n=1;
      for(let i=0;i<ordered.length;i++) for(let j=i+1;j<ordered.length;j++)
        rows.push({competition_id:selected.id,match_number:n++,round_number:1,player1_id:ordered[i],player2_id:ordered[j],race_to:race,status:'scheduled',score1:0,score2:0,table_id:null});
      const {error}=await supabase.from('competition_matches').insert(rows);
      if(error){setMsg(`Could not create draw: ${error.message}`);return;}
      await load(selected);setModal(null);setMsg(`Round Robin created for ${ordered.length} players.`);return;
    }

    const size=2**Math.ceil(Math.log2(ordered.length));
    const rounds=Math.log2(size);
    const byRound=[];
    let n=1;
    for(let r=1;r<=rounds;r++){
      const count=size/(2**r), arr=[];
      for(let k=0;k<count;k++){
        const row={id:crypto.randomUUID(),competition_id:selected.id,match_number:n++,round_number:r,player1_id:null,player2_id:null,race_to:race,status:'waiting',score1:0,score2:0,table_id:null,winner_id:null,loser_id:null,next_match_id:null,next_slot:null};
        arr.push(row);
      }
      byRound.push(arr);
    }
    for(let i=0;i<byRound[0].length;i++){
      const row=byRound[0][i];
      row.player1_id=ordered[i*2]||null; row.player2_id=ordered[i*2+1]||null;
      if(row.player1_id && row.player2_id) row.status='scheduled';
      else if(row.player1_id || row.player2_id){row.status='bye';row.winner_id=row.player1_id||row.player2_id;}
    }
    // Link the bracket and track whether each branch can ever produce a real player.
    // An empty feeder is only a true padding bye when its entire subtree is empty.
    const potential = new Map();
    for(const m of byRound[0]) potential.set(m.id, !!(m.player1_id || m.player2_id));
    for(let r=0;r<byRound.length-1;r++){
      for(let k=0;k<byRound[r].length;k++){
        const feeder=byRound[r][k];
        const target=byRound[r+1][Math.floor(k/2)];
        feeder.next_match_id=target.id; feeder.next_slot=(k%2)+1;
        if(feeder.status==='bye' && feeder.winner_id){
          if(feeder.next_slot===1) target.player1_id=feeder.winner_id;
          else target.player2_id=feeder.winner_id;
        }
      }
      for(const target of byRound[r+1]){
        const feeders=byRound[r].filter(f=>f.next_match_id===target.id).sort((a,b)=>a.next_slot-b.next_slot);
        potential.set(target.id, feeders.some(f=>potential.get(f.id)));
        if(target.player1_id && target.player2_id){
          target.status='scheduled';
          continue;
        }
        const sole=target.player1_id || target.player2_id;
        if(!sole) continue;
        const missingSlot=target.player1_id ? 2 : 1;
        const paddingFeeder=feeders.find(f=>f.next_slot===missingSlot);
        // Only cascade a bye when the missing side has no possible player at all.
        if(paddingFeeder && !potential.get(paddingFeeder.id)){
          target.status='bye';
          target.winner_id=sole;
        }
      }
    }
    const final=byRound.at(-1)[0];
    if(final.player1_id&&final.player2_id) final.status='scheduled';

    const {error}=await supabase.from('competition_matches').insert(byRound.flat());
    if(error){setMsg(`Could not create draw: ${error.message}`);return;}
    await load(selected);setModal(null);setMsg(`${settings.type} draw created for ${ordered.length} players.`);
  }

  async function generateGroupsReverseCrossover(settings=drawSettings){
    if(!selected)return;
    const checkedPlayers=players.filter(p=>p.checked_in).map(p=>p.player_id).filter(Boolean);
    const groupCount=settings.type==='Seeded 16'?4:Number(settings.group_count||4);
    if(checkedPlayers.length<2){setMsg('Check in at least 2 players before creating groups.');return;}
    if(settings.type==='Seeded 16' && checkedPlayers.length<16){setMsg('Seeded 16 requires at least 16 checked-in players.');return;}
    if(groupCount<2 || groupCount>Math.floor(checkedPlayers.length/2)){setMsg(`Choose between 2 and ${Math.floor(checkedPlayers.length/2)} groups for ${checkedPlayers.length} players.`);return;}
    if(settings.type==='Reverse Cross' && (groupCount<2 || groupCount>5)){setMsg('Reverse Cross supports 2 to 5 groups.');return;}
    if(matches.length){
      if(matches.some(m=>['completed','in_progress','active'].includes(m.status))){setMsg('This competition already has matches in progress or completed. A new draw cannot replace them.');return;}
      if(!window.confirm('Replace the existing draw? This removes the current scheduled matches and creates the new group-stage draw.'))return;
      const {error}=await supabase.from('competition_matches').delete().eq('competition_id',selected.id);
      if(error){setMsg(error.message);return;}
    }
    const groupRace=Number(settings.group_race_to||settings.race_to||selected.default_race_to||3);
    const groups=Array.from({length:groupCount},()=>[]);
    checkedPlayers.forEach((id,i)=>groups[i%groupCount].push(id));
    const rows=[]; let n=1;
    groups.forEach((group,gi)=>{
      for(let i=0;i<group.length;i++) for(let j=i+1;j<group.length;j++) rows.push({
        competition_id:selected.id,match_number:n++,round_number:1,group_name:String.fromCharCode(65+gi),
        player1_id:group[i],player2_id:group[j],race_to:groupRace,status:'scheduled',score1:0,score2:0,table_id:null
      });
    });
    if(!rows.length){setMsg('Could not create group matches.');return;}
    const {error}=await supabase.from('competition_matches').insert(rows);
    if(error){setMsg(`Could not create group draw: ${error.message}`);return;}

    if(settings.type==='Seeded 16' || settings.type==='Reverse Cross'){
      if(checkedPlayers.length<16){setMsg(settings.type+' requires at least 16 checked-in players.');return;}
      const knockoutRace=Number(settings.knockout_race_to||settings.race_to||selected.default_race_to||3);
      const bracket=buildEmptyKnockoutRows(selected.id,rows.length+1,16,knockoutRace);
      if(!bracket.length){setMsg('Could not create the 16-player knockout bracket for '+settings.type+'.');return;}
      const {error:bracketError}=await supabase.from('competition_matches').insert(bracket);
      if(bracketError){await load(selected);setModal(null);setMsg('Group draw created, but the 16-player knockout bracket could not be created: '+bracketError.message);return;}
      await load(selected);setModal(null);
      setMsg(settings.type==='Seeded 16'
        ? checkedPlayers.length+' players placed into 4 groups. All players play the group stage; the top 16 overall will advance to the Seeded 16 knockout after the group stage is complete.'
        : checkedPlayers.length+' players placed into 4 groups. All players play the group stage; the top 4 from each group will make the Reverse Cross 16-player knockout after the group stage is complete.');
      return;
    }

    if(settings.type==='Groups → Knockout'){
      const maxPlayersPerGroup=Math.max(...groups.map(g=>g.length));
      const qualifiersPerGroup=Math.max(1,Math.min(Number(settings.qualifiers_per_group||1),maxPlayersPerGroup));
      const plan=qualificationPlan(groupCount,qualifiersPerGroup);
      const knockoutRace=Number(settings.knockout_race_to||settings.race_to||selected.default_race_to||3);
      if(plan.target>=2){
        const bracket=buildEmptyKnockoutRows(selected.id,rows.length+1,plan.target,knockoutRace);
        if(bracket.length){
          const {error:bracketError}=await supabase.from('competition_matches').insert(bracket);
          if(bracketError){
            await load(selected);
            setModal(null);
            setMsg(`Group draw created, but the knockout bracket could not be created: ${bracketError.message}`);
            return;
          }
        }
        await load(selected);
        setModal(null);
        setMsg(`${checkedPlayers.length} players placed into ${groupCount} balanced groups. The ${plan.target}-player knockout bracket is ready and will be populated from qualifiers when the group stage is complete.`);
        return;
      }
    }

    await load(selected);
    setModal(null);
    setMsg(`${checkedPlayers.length} players placed into ${groupCount} balanced groups. Complete the group stage, then generate the Reverse Cross.`);
  }

  async function testCompleteGroupStageWithConfirmations(){
    if(!selected)return;
    const groupMatches=matches.filter(m=>m.group_name && Number(m.round_number)===1);
    const knockoutMatches=matches.filter(m=>Number(m.round_number)>1 && !m.group_name);
    if(!groupMatches.length || !knockoutMatches.length){setMsg('Create a Groups → Knockout draw first.');return;}
    const remaining=groupMatches.filter(m=>m.status!=='completed');
    if(!remaining.length){setMsg('All group matches are already completed. The automatic knockout population should run.');return;}
    if(!window.confirm(`TEST ONLY: Simulate the remaining ${remaining.length} group matches as completed with BOTH players confirmed. Any result you already entered will be preserved. Continue?`))return;
    for(const m of remaining){
      const u={
        score1:1,score2:0,winner_balls:Number(m.race_to)===1?0:null,winner_id:m.player1_id,loser_id:m.player2_id,
        status:'completed',p1_confirmed:true,p2_confirmed:true,dispute_reason:null
      };
      const {error}=await supabase.from('competition_matches').update(u).eq('id',m.id);
      if(error){setMsg(`Test failed on Match ${m.match_number}: ${error.message}`);await load(selected);return;}
    }
    const {data:freshMatches,error:freshError}=await supabase.from('competition_matches').select('*').eq('competition_id',selected.id).order('match_number');
    if(freshError){setMsg(`TEST COMPLETE, but could not refresh matches for automatic knockout population: ${freshError.message}`);await load(selected);return;}
    await generateGroupKnockout(drawSettings,freshMatches||[]);
    await load(selected);
    setMsg(`TEST COMPLETE: The ${remaining.length} remaining group results were simulated as confirmed by both players. Your existing completed result was preserved, and automatic knockout population was triggered.`);
  }

  async function generateGroupKnockout(settings=drawSettings,sourceMatches=null){
    const workingMatches=sourceMatches||matches;
    if(!selected)return;
    const groupMatches=workingMatches.filter(m=>m.group_name && Number(m.round_number)===1);
    if(!groupMatches.length){setMsg('Create the group stage first.');return;}

    const groupNames=[...new Set(groupMatches.map(m=>m.group_name))].sort();
    const groupComplete=groupMatches.every(m=>m.status==='completed');
    const existingKnockout=workingMatches.filter(m=>Number(m.round_number)>1 && !m.group_name).sort((a,b)=>(a.match_number||0)-(b.match_number||0));

    if(!groupComplete && existingKnockout.length){
      setMsg('The knockout bracket is already created. Complete all group-stage matches and then populate it from the qualifiers.');
      return;
    }

    const playerCounts=groupNames.map(g=>groupMatches.filter(m=>m.group_name===g).reduce((ids,m)=>{ids.add(m.player1_id);ids.add(m.player2_id);return ids;},new Set()).size);
    const existingTarget=existingKnockout.length ? existingKnockout.length+1 : 0;
    const bracketImpliedQualifiers=(existingTarget===16 && groupNames.length===5) ? 3 : null;
    const requestedQualifiers=bracketImpliedQualifiers || Number(settings.qualifiers_per_group||1);
    const qualifiersPerGroup=Math.max(1,Math.min(requestedQualifiers,Math.min(...playerCounts)));
    const plan=qualificationPlan(groupNames.length,qualifiersPerGroup);
    const targetSize=plan.target;
    const race=Number(settings.knockout_race_to||settings.race_to||selected.default_race_to||3);

    if(!groupComplete){
      if(targetSize<2){setMsg('Not enough players to create a knockout bracket.');return;}
      const startMatchNo=Math.max(...workingMatches.map(m=>Number(m.match_number)||0),0)+1;
      const bracket=buildEmptyKnockoutRows(selected.id,startMatchNo,targetSize,race);
      if(!bracket.length){setMsg(`Could not create the ${targetSize}-player knockout bracket.`);return;}
      const {error}=await supabase.from('competition_matches').insert(bracket);
      if(error){setMsg(`Could not create knockout bracket: ${error.message}`);return;}
      await load(selected);
      setMsg(`The ${targetSize}-player knockout bracket has been created. It will be populated after the group stage is complete.`);
      return;
    }

    const ranked={};
    for(const g of groupNames){
      const rows=groupMatches.filter(m=>m.group_name===g);
      ranked[g]=rankGroupPlayers(rows);
      if(ranked[g].length<qualifiersPerGroup){setMsg(`Group ${g} does not contain enough players for ${qualifiersPerGroup} qualifiers.`);return;}
    }

    if(settings.type==='Reverse Cross'){
      const topByGroup=groupNames.map(g=>ranked[g].slice(0,qualifiersPerGroup));
      if(topByGroup.some(q=>q.length<qualifiersPerGroup)){setMsg('Each Reverse Cross group must contain enough eligible players for the selected qualifiers.');return;}

      const firstPairs=[];
      if(groupNames.length===4 && qualifiersPerGroup===4){
        // Standard Reverse Cross 16: A1 v B4, A2 v B3, B1 v A4, B2 v A3,
        // then the same pattern for C/D.
        for(let i=0;i<groupNames.length;i+=2){
          const left=topByGroup[i], right=topByGroup[i+1];
          firstPairs.push([left[0]?.id||null,right[3]?.id||null]);
          firstPairs.push([left[1]?.id||null,right[2]?.id||null]);
          firstPairs.push([right[0]?.id||null,left[3]?.id||null]);
          firstPairs.push([right[1]?.id||null,left[2]?.id||null]);
        }
      } else if(groupNames.length===5 && qualifiersPerGroup===3){
        // Five-group Reverse Cross: 15 automatic qualifiers plus the best
        // fourth-place finisher as a floating wildcard. Every Round 1
        // matchup remains cross-group, and the wildcard cannot face their
        // own group.
        const q1=groupNames.map(g=>ranked[g][0]);
        const q2=groupNames.map(g=>ranked[g][1]);
        const q3=groupNames.map(g=>ranked[g][2]);
        for(let i=0;i<5;i++) firstPairs.push([q1[i]?.id||null,q3[(i+1)%5]?.id||null]);

        const wildcardCandidates=[];
        groupNames.forEach(g=>{
          ranked[g].slice(qualifiersPerGroup).forEach(p=>wildcardCandidates.push({...p,group:g}));
        });
        wildcardCandidates.sort((a,b)=>b.wins-a.wins || b.ballDiff-a.ballDiff || (b.for-b.against)-(a.for-a.against) || b.for-a.for || a.id.localeCompare(b.id));
        const wildcard=wildcardCandidates[0];
        const wi=groupNames.indexOf(wildcard?.group);
        const wildcardOpponentGroup=(wi+1)%5;
        firstPairs.push([q2[wildcardOpponentGroup]?.id||null,wildcard?.id||null]);

        const remainingQ2=[];
        for(let offset=2;offset<=5;offset++) remainingQ2.push(q2[(wi+offset)%5]);
        firstPairs.push([remainingQ2[0]?.id||null,remainingQ2[2]?.id||null]);
        firstPairs.push([remainingQ2[1]?.id||null,remainingQ2[3]?.id||null]);
      } else {
        setMsg('Reverse Cross currently supports 4 groups / Top 4 or 5 groups / Top 3.');return;
      }

      const race=Number(settings.knockout_race_to||settings.race_to||selected.default_race_to||3);
      if(existingKnockout.length){
        const firstRound=existingKnockout.filter(m=>Number(m.round_number)===2).sort((a,b)=>(a.match_number||0)-(b.match_number||0));
        if(existingKnockout.length!==15 || firstRound.length!==8){setMsg('The existing Reverse Cross bracket is not a 16-player bracket. Create a new group draw to rebuild it.');return;}
        for(let i=0;i<firstRound.length;i++){
          const [p1,p2]=firstPairs[i];
          const {error}=await supabase.from('competition_matches').update({player1_id:p1,player2_id:p2,race_to:race,status:'scheduled',score1:0,score2:0,table_id:null,winner_id:null,loser_id:null}).eq('id',firstRound[i].id);
          if(error){setMsg('Could not populate Reverse Cross Match '+firstRound[i].match_number+': '+error.message);return;}
        }
        await load(selected);
        setMsg('Reverse Cross populated: the top 4 from each group qualify, then the groups cross in reverse order (A1 v B4, A2 v B3, B1 v A4, B2 v A3, and C/D the same).');
        return;
      }
      const startMatchNo=Math.max(...workingMatches.map(m=>Number(m.match_number)||0),0)+1;
      const bracket=buildEmptyKnockoutRows(selected.id,startMatchNo,16,race);
      if(!bracket.length){setMsg('Could not create the 16-player Reverse Cross knockout bracket.');return;}
      const firstRound=bracket.filter(m=>Number(m.round_number)===2).sort((a,b)=>a.match_number-b.match_number);
      firstRound.forEach((m,i)=>{const [p1,p2]=firstPairs[i];m.player1_id=p1;m.player2_id=p2;m.status='scheduled';});
      const {error}=await supabase.from('competition_matches').insert(bracket);
      if(error){setMsg('Could not create Reverse Cross knockout: '+error.message);return;}
      await load(selected);
      setMsg('Reverse Cross created from the top 4 of each group: A1 v B4, A2 v B3, B1 v A4, B2 v A3, with the same pattern for C/D.');
      return;
    }

    if(settings.type==='Seeded 16' || settings.group_knockout_mode==='top16_overall'){
      const overall=rankGroupPlayers(groupMatches).slice(0,16);
      if(overall.length<16){setMsg(`There are only ${overall.length} eligible players. Seeded 16 requires at least 16 players.`);return;}
      const firstPairs=[];
      for(let i=0;i<8;i++) firstPairs.push([overall[i].id,overall[15-i].id]);
      const race=Number(settings.knockout_race_to||settings.race_to||selected.default_race_to||3);
      if(existingKnockout.length){
        const firstRound=existingKnockout.filter(m=>Number(m.round_number)===2).sort((a,b)=>(a.match_number||0)-(b.match_number||0));
        if(existingKnockout.length!==15 || firstRound.length!==8){setMsg('The existing knockout bracket is not a 16-player bracket. Create a new group draw to rebuild it.');return;}
        for(let i=0;i<firstRound.length;i++){
          const [p1,p2]=firstPairs[i];
          const {error}=await supabase.from('competition_matches').update({player1_id:p1,player2_id:p2,race_to:race,status:'scheduled',score1:0,score2:0,table_id:null,winner_id:null,loser_id:null}).eq('id',firstRound[i].id);
          if(error){setMsg(`Could not populate Seeded 16 Match ${firstRound[i].match_number}: ${error.message}`);return;}
        }
        await load(selected);setMsg('Seeded 16 populated: the top 16 overall are ranked by wins, then ball differential, and seeded 1–16.');return;
      }
      const startMatchNo=Math.max(...workingMatches.map(m=>Number(m.match_number)||0),0)+1;
      const bracket=buildEmptyKnockoutRows(selected.id,startMatchNo,16,race);
      if(!bracket.length){setMsg('Could not create the 16-player knockout bracket.');return;}
      const firstRound=bracket.filter(m=>Number(m.round_number)===2).sort((a,b)=>a.match_number-b.match_number);
      firstRound.forEach((m,i)=>{const [p1,p2]=firstPairs[i];m.player1_id=p1;m.player2_id=p2;m.status='scheduled';});
      const {error}=await supabase.from('competition_matches').insert(bracket);
      if(error){setMsg(`Could not create Seeded 16 knockout: ${error.message}`);return;}
      await load(selected);setMsg('Seeded 16 created from the top 16 overall, ranked by wins then ball differential.');return;
    }

    const qualified=[];
    groupNames.forEach(g=>ranked[g].slice(0,qualifiersPerGroup).forEach((p,pos)=>qualified.push({...p,group:g,position:pos+1,qualificationType:'automatic'})));

    const wildcardCount=plan.wildcards;
    if(wildcardCount>0){
      const candidates=[];
      groupNames.forEach(g=>{
        ranked[g].slice(qualifiersPerGroup).forEach((p,pos)=>candidates.push({...p,group:g,position:qualifiersPerGroup+pos+1,qualificationType:'wildcard'}));
      });
      candidates.sort((a,b)=>b.wins-a.wins || b.ballDiff-a.ballDiff || (b.for-b.against)-(a.for-a.against) || b.for-a.for || a.id.localeCompare(b.id));
      for(const candidate of candidates.slice(0,wildcardCount)){
        if(!qualified.some(q=>q.id===candidate.id)) qualified.push(candidate);
      }
      if(qualified.length<targetSize){setMsg(`There are not enough eligible non-qualifiers to fill the ${targetSize}-player knockout. Reduce the number of groups or qualifiers per group.`);return;}
    }
    if(qualified.length<2){setMsg('Not enough qualified players to create a knockout.');return;}

    let firstPairs=[];
    const mode=settings.group_knockout_mode||'group_crossover';
    if((mode==='group_crossover' || mode==='five_group_reverse') && groupNames.length===5 && qualifiersPerGroup===3 && qualified.length===16){
      const q1=groupNames.map(g=>ranked[g][0]);
      const q2=groupNames.map(g=>ranked[g][1]);
      const q3=groupNames.map(g=>ranked[g][2]);
      for(let i=0;i<5;i++) firstPairs.push([q1[i]?.id||null,q3[(i+1)%5]?.id||null]);
      const wildcard=qualified.find(p=>p.qualificationType==='wildcard');
      const wi=Math.max(0,groupNames.indexOf(wildcard?.group));
      const wildcardOpponent=(wi+1)%5;
      firstPairs.push([q2[wildcardOpponent]?.id||null,wildcard?.id||null]);
      const remaining=[];
      for(let offset=2;offset<=5;offset++) remaining.push(q2[(wi+offset)%5]);
      firstPairs.push([remaining[0]?.id||null,remaining[2]?.id||null]);
      firstPairs.push([remaining[1]?.id||null,remaining[3]?.id||null]);
    } else if(mode==='group_crossover' && groupNames.length%2===0 && qualified.length===groupNames.length*qualifiersPerGroup){
      for(let i=0;i<groupNames.length;i+=2){
        const left=groupNames[i], right=groupNames[i+1];
        const leftQ=ranked[left].slice(0,qualifiersPerGroup), rightQ=ranked[right].slice(0,qualifiersPerGroup);
        for(let pos=0;pos<qualifiersPerGroup;pos++) firstPairs.push([leftQ[pos]?.id||null,rightQ[qualifiersPerGroup-1-pos]?.id||null]);
      }
    } else if(mode==='random'){
      const shuffled=[...qualified].sort(()=>Math.random()-0.5).map(p=>p.id);
      for(let i=0;i<shuffled.length;i+=2) firstPairs.push([shuffled[i]||null,shuffled[i+1]||null]);
    } else {
      for(let i=0;i<qualified.length;i+=2) firstPairs.push([qualified[i]?.id||null,qualified[i+1]?.id||null]);
    }

    if(firstPairs.length*2!==targetSize){
      setMsg(`The selected qualification settings require a ${targetSize}-player bracket, but the generated qualifier pairings contain ${firstPairs.length*2} places.`);
      return;
    }

    if(existingKnockout.length){
      const firstRound=existingKnockout.filter(m=>Number(m.round_number)===2).sort((a,b)=>(a.match_number||0)-(b.match_number||0));
      const expectedMatches=targetSize-1;
      if(existingKnockout.length!==expectedMatches || firstRound.length!==firstPairs.length){
        setMsg(`The existing knockout bracket does not match the current ${targetSize}-player qualification settings. Create a new group draw to rebuild the bracket.`);
        return;
      }
      for(let i=0;i<firstRound.length;i++){
        const [p1,p2]=firstPairs[i];
        const {error}=await supabase.from('competition_matches').update({
          player1_id:p1,player2_id:p2,race_to:race,status:(p1&&p2)?'scheduled':'bye',
          score1:0,score2:0,table_id:null,winner_id:(p1&&!p2)?p1:(!p1&&p2)?p2:null,loser_id:null
        }).eq('id',firstRound[i].id);
        if(error){setMsg(`Could not populate knockout Match ${firstRound[i].match_number}: ${error.message}`);return;}
      }
      await load(selected);
      const wildcardText=wildcardCount>0?` plus ${wildcardCount} wildcard qualifier${wildcardCount===1?'':'s'} (most wins, then highest cumulative ball differential).`:'';
      setMsg(`Knockout populated from ${qualified.length} qualifiers: top ${qualifiersPerGroup} from each of ${groupNames.length} groups${wildcardText}`);
      return;
    }

    const startMatchNo=Math.max(...workingMatches.map(m=>Number(m.match_number)||0),0)+1;
    const bracket=buildEmptyKnockoutRows(selected.id,startMatchNo,targetSize,race);
    if(!bracket.length){setMsg(`Could not create the ${targetSize}-player knockout bracket.`);return;}
    const firstRound=bracket.filter(m=>Number(m.round_number)===2).sort((a,b)=>a.match_number-b.match_number);
    firstRound.forEach((m,i)=>{
      const [p1,p2]=firstPairs[i]||[null,null];
      m.player1_id=p1;m.player2_id=p2;m.status=(p1&&p2)?'scheduled':'bye';m.winner_id=(p1&&!p2)?p1:(!p1&&p2)?p2:null;
    });
    const {error}=await supabase.from('competition_matches').insert(bracket);
    if(error){setMsg(`Could not create knockout: ${error.message}`);return;}
    await load(selected);
    const wildcardText=wildcardCount>0?` plus ${wildcardCount} wildcard qualifier${wildcardCount===1?'':'s'} (most wins, then highest cumulative ball differential).`:'';
    setMsg(`Knockout created from ${qualified.length} qualifiers: top ${qualifiersPerGroup} from each of ${groupNames.length} groups${wildcardText}`);
  }

  async function generateReverseCrossover(){
    if(!selected)return;
    // A reverse crossover is a one-time transition from the completed
    // group stage into the fixed knockout bracket.
    const existingCrossover=matches.some(m=>Number(m.round_number)>1 && !m.group_name);
    if(existingCrossover){
      setMsg('The Reverse Crossover has already been generated for this competition.');
      return;
    }
    const groupMatches=matches.filter(m=>m.round_number===1 && m.group_name);
    if(!groupMatches.length || groupMatches.some(m=>m.status!=='completed')){setMsg('Complete all group-stage matches before generating the reverse crossover.');return;}
    const groupNames=[...new Set(groupMatches.map(m=>m.group_name))].sort();
    if(groupNames.length<2 || groupNames.length%2!==0){setMsg('Reverse Crossover requires an even number of groups so each group can be paired with another group.');return;}
    const standings={}; groupNames.forEach(g=>standings[g]={});
    for(const m of groupMatches){
      const group=standings[m.group_name];
      for(const id of [m.player1_id,m.player2_id]){if(id&&!group[id])group[id]={id,wins:0,for:0,against:0};}
      if(m.winner_id&&group[m.winner_id])group[m.winner_id].wins++;
      if(m.player1_id&&group[m.player1_id]){group[m.player1_id].for+=Number(m.score1||0);group[m.player1_id].against+=Number(m.score2||0);}
      if(m.player2_id&&group[m.player2_id]){group[m.player2_id].for+=Number(m.score2||0);group[m.player2_id].against+=Number(m.score1||0);}
    }
    const ranked={};
    for(const g of groupNames){
      const vals=Object.values(standings[g]);
      if(vals.length<2){setMsg(`Group ${g} does not contain enough players for a crossover.`);return;}
      vals.sort((a,b)=>b.wins-a.wins || (b.for-b.against)-(a.for-a.against) || b.for-a.for || a.id.localeCompare(b.id));
      ranked[g]=vals;
    }
    const pairs=[]; for(let i=0;i<groupNames.length;i+=2)pairs.push([groupNames[i],groupNames[i+1]]);
    const crossover=[]; let matchNo=Math.max(...matches.map(m=>m.match_number||0))+1;
    for(const [g1,g2] of pairs){
      const left=ranked[g1],right=ranked[g2],len=Math.max(left.length,right.length);
      for(let pos=0;pos<len;pos++){
        const p1=left[pos]?.id||null,p2=right[right.length-1-pos]?.id||null,bye=!!p1!==!!p2;
        crossover.push({id:crypto.randomUUID(),competition_id:selected.id,match_number:matchNo++,round_number:2,group_name:null,player1_id:p1,player2_id:p2,race_to:Number(drawSettings.knockout_race_to||drawSettings.race_to||selected.default_race_to||3),status:bye?'bye':'scheduled',score1:0,score2:0,table_id:null,next_match_id:null,next_slot:null,winner_id:bye?(p1||p2):null,loser_id:null});
      }
    }
    const target=2**Math.ceil(Math.log2(crossover.length));
    while(crossover.length<target)crossover.push({id:crypto.randomUUID(),competition_id:selected.id,match_number:matchNo++,round_number:2,group_name:null,player1_id:null,player2_id:null,race_to:Number(drawSettings.knockout_race_to||drawSettings.race_to||selected.default_race_to||3),status:'waiting',score1:0,score2:0,table_id:null,next_match_id:null,next_slot:null,winner_id:null,loser_id:null});
    const rounds=[crossover]; let prev=crossover,roundNo=3;
    while(prev.length>1){const cur=[];for(let i=0;i<prev.length/2;i++)cur.push({id:crypto.randomUUID(),competition_id:selected.id,match_number:matchNo++,round_number:roundNo,group_name:null,player1_id:null,player2_id:null,race_to:Number(drawSettings.knockout_race_to||drawSettings.race_to||selected.default_race_to||3),status:'waiting',score1:0,score2:0,table_id:null,next_match_id:null,next_slot:null,winner_id:null,loser_id:null});rounds.push(cur);prev=cur;roundNo++;}
    const all=rounds.flat();
    for(let r=0;r<rounds.length-1;r++)for(let i=0;i<rounds[r].length;i++){rounds[r][i].next_match_id=rounds[r+1][Math.floor(i/2)].id;rounds[r][i].next_slot=(i%2)+1;}
    const possible=new Map(rounds[0].map(m=>[m.id,!!(m.player1_id||m.player2_id)]));
    for(let r=0;r<rounds.length-1;r++){
      for(const feeder of rounds[r])if(feeder.status==='bye'&&feeder.winner_id){const targetMatch=all.find(x=>x.id===feeder.next_match_id);if(targetMatch){if(feeder.next_slot===1)targetMatch.player1_id=feeder.winner_id;else targetMatch.player2_id=feeder.winner_id;}}
      for(const targetMatch of rounds[r+1]){const feeders=rounds[r].filter(f=>f.next_match_id===targetMatch.id);possible.set(targetMatch.id,feeders.some(f=>possible.get(f.id)));if(targetMatch.player1_id&&targetMatch.player2_id){targetMatch.status='scheduled';continue;}const sole=targetMatch.player1_id||targetMatch.player2_id;if(!sole)continue;const missingSlot=targetMatch.player1_id?2:1,missing=feeders.find(f=>f.next_slot===missingSlot);if(missing&&!possible.get(missing.id)){targetMatch.status='bye';targetMatch.winner_id=sole;}}
    }
    const {error}=await supabase.from('competition_matches').insert(all);
    if(error){setMsg(`Could not create reverse crossover: ${error.message}`);return;}
    await load(selected);setMsg(`Reverse crossover created for ${groupNames.length} groups. Groups are paired A vs B, C vs D, etc., with highest finishes playing lowest finishes in the opposing group.`);
  }

  async function generateKnockout(){
    if(!selected)return;
    if((selected.format||'').toLowerCase()!=='knockout'){
      setMsg('Set the competition format to Knockout before generating a knockout draw.');
      return;
    }
    const checkedPlayers=players.filter(p=>p.checked_in).map(p=>p.player_id).filter(Boolean);
    if(checkedPlayers.length<2){setMsg('Check in at least 2 players before generating the knockout draw.');return;}
    if(matches.length){
      if(matches.some(m=>['completed','in_progress','active'].includes(m.status))){
        setMsg('This competition already has matches in progress or completed. A new draw cannot replace them.');return;
      }
      if(!window.confirm('Replace the existing knockout draw? This removes the current scheduled draw and creates a new one.'))return;
      const {error}=await supabase.from('competition_matches').delete().eq('competition_id',selected.id);
      if(error){setMsg(error.message);return;}
    }

    const size=2**Math.ceil(Math.log2(checkedPlayers.length));
    const rounds=Math.log2(size);
    const all=[]; const roundLists=[]; let matchNumber=1;
    let first=[];
    for(let i=0;i<size/2;i++){
      const p1=checkedPlayers[i*2]||null;
      const p2=checkedPlayers[i*2+1]||null;
      const bye=!!p1!==!!p2;
      const row={id:crypto.randomUUID(),competition_id:selected.id,match_number:matchNumber++,round_number:1,player1_id:p1,player2_id:p2,race_to:Number(selected.default_race_to||3),status:bye?'bye':'scheduled',score1:0,score2:0,next_match_id:null,next_slot:null,winner_id:bye?(p1||p2):null,loser_id:null,table_id:null};
      first.push(row);all.push(row);
    }
    roundLists.push(first);
    for(let r=2;r<=rounds;r++){
      const prev=roundLists[r-2]; const current=[];
      for(let i=0;i<prev.length/2;i++){
        const row={id:crypto.randomUUID(),competition_id:selected.id,match_number:matchNumber++,round_number:r,player1_id:null,player2_id:null,race_to:Number(selected.default_race_to||3),status:'waiting',score1:0,score2:0,next_match_id:null,next_slot:null,winner_id:null,loser_id:null,table_id:null};
        current.push(row);all.push(row);
        prev[i*2].next_match_id=row.id;prev[i*2].next_slot=1;
        prev[i*2+1].next_match_id=row.id;prev[i*2+1].next_slot=2;
      }
      roundLists.push(current);
    }
    // Propagate byes only through branches that are genuinely empty.
    const potentialKO = new Map();
    for(const m of roundLists[0]) potentialKO.set(m.id, !!(m.player1_id || m.player2_id));
    for(let r=0;r<roundLists.length-1;r++){
      for(const feeder of roundLists[r]){
        const target=all.find(x=>x.id===feeder.next_match_id);
        if(!target) continue;
        if(feeder.status==='bye' && feeder.winner_id){
          if(feeder.next_slot===1)target.player1_id=feeder.winner_id;
          else target.player2_id=feeder.winner_id;
        }
      }
      for(const m of roundLists[r+1]){
        const feeders=roundLists[r].filter(f=>f.next_match_id===m.id).sort((a,b)=>a.next_slot-b.next_slot);
        potentialKO.set(m.id, feeders.some(f=>potentialKO.get(f.id)));
        if(m.player1_id && m.player2_id){m.status='scheduled';continue;}
        const sole=m.player1_id||m.player2_id;
        if(!sole) continue;
        const missingSlot=m.player1_id?2:1;
        const missing=feeders.find(f=>f.next_slot===missingSlot);
        if(missing && !potentialKO.get(missing.id)){
          m.status='bye';
          m.winner_id=sole;
        }
      }
    }
    const finalMatch=roundLists[roundLists.length-1][0];
    finalMatch.status=finalMatch.player1_id&&finalMatch.player2_id?'scheduled':'waiting';

    const {error}=await supabase.from('competition_matches').insert(all);
    if(error){setMsg(error.message);return;}
    await load(selected);
    setMsg(`Knockout draw created for ${checkedPlayers.length} players.`);
  }

  function matchStatusLabel(m){
    if(m.status==='completed') return 'Completed';
    if(m.status==='pending_confirmation') return 'Awaiting player confirmation';
    if(m.status==='disputed') return 'Result disputed';
    if(m.status==='scheduled') return 'Ready to play';
    if(m.status==='in_progress' || m.status==='active') return 'Playing';
    if(m.status==='bye') return 'Bye — advances automatically';
    return 'Waiting';
  }

  function matchPlayersLabel(m){
    if(m.status==='bye' && m.winner_id) return `${playerName(m.winner_id)} advances`;
    return `${playerName(m.player1_id)} vs ${playerName(m.player2_id)}`;
  }

  function roundName(round,totalRounds,matchCount){
    if(matchCount===1) return 'Final';
    if(matchCount===2) return 'Semi-Finals';
    if(matchCount===4) return 'Quarter-Finals';
    if(matchCount===8) return 'Round of 16';
    return `Round ${round}`;
  }

  function KnockoutBracket({matches,playerName}){
    const maxRound=Math.max(...matches.map(m=>Number(m.round_number)||1));
    const rounds=[];
    for(let r=1;r<=maxRound;r++) rounds.push(matches.filter(m=>Number(m.round_number)===r).sort((a,b)=>a.match_number-b.match_number));
    return <div className="bracket">
      {rounds.map((round,i)=><div className="bracketRound" key={i}>
        <h4>{roundName(i+1,maxRound,round.length)}</h4>
        <div className="bracketMatches">
          {round.map(m=><div className={`bracketMatch ${m.status==='completed'?'done':''}`} key={m.id}>
            <div className="bracketMatchNo">Match {m.match_number}</div>
            {m.status==='bye'
              ? <div className="bracketBye"><strong>{playerName(m.winner_id)} advances</strong><span>BYE</span></div>
              : <>
                  <div className={m.winner_id===m.player1_id?'winnerLine':''}>{playerName(m.player1_id)} <b>{m.status==='completed'?m.score1:''}</b></div>
                  <div className={m.winner_id===m.player2_id?'winnerLine':''}>{playerName(m.player2_id)} <b>{m.status==='completed'?m.score2:''}</b></div>
                </>}
            <small>{matchStatusLabel(m)}{m.status==='completed' && m.winner_id ? ` · ${playerName(m.winner_id)} advances` : ''}</small>
          </div>)}
        </div>
      </div>)}
    </div>
  }

  function TournamentControl({tables,matches,playerName}){
    const activeMatches=matches.filter(m=>m.table_id && m.status!=='completed');
    const ready=matches.filter(m=>m.status==='scheduled' && !m.table_id);
    const waiting=matches.filter(m=>m.status==='waiting');
    const completed=matches.filter(m=>m.status==='completed').sort((a,b)=>(b.match_number||0)-(a.match_number||0));
    const confirmationPending=matches.filter(m=>m.status==='pending_confirmation');
    const disputed=matches.filter(m=>m.status==='disputed');
    const available=tables.filter(t=>t.status==='available');
    const inaccessible=tables.filter(t=>t.status==='unavailable');
    const needsAccessible=(m)=>[m.player1_id,m.player2_id].some(pid=>players.find(x=>x.player_id===pid)?.players?.requires_accessible_table);
    const accessibleReady=ready.filter(needsAccessible);
    const standardReady=ready.filter(m=>!needsAccessible(m));
    const orderedReady=[...accessibleReady,...standardReady];
    const eligibleAvailable=(m)=>available.filter(t=>!needsAccessible(m) || t.is_accessible);
    const assignedTable=(m)=>tables.find(t=>t.id===m.table_id);
    const tableState=(t)=>{
      const active=matches.find(m=>m.table_id===t.id && m.status!=='completed');
      if(active) return {active,label:matchStatusLabel(active),className:'occupied'};
      if(t.status==='unavailable') return {active:null,label:'Unavailable',className:'unavailable'};
      return {active:null,label:'Available',className:'available'};
    };
    return <div>
      <div className="controlIntro">
        <div>
          <strong>Live tournament command centre</strong>
          <span>Updates automatically every 5 seconds. Use this screen to run the tournament from the tables through to the results.</span>
        </div>
        <span className="liveBadge">● LIVE</span>
      </div>

      <div className="controlSummary">
        <div className="summaryPlaying"><strong>{activeMatches.length}</strong><span>Playing now</span></div>
        <div className="summaryReady"><strong>{ready.length}</strong><span>Ready next</span></div>
        <div><strong>{waiting.length}</strong><span>Waiting</span></div>
        <div><strong>{available.length}</strong><span>Tables free</span></div>
        <div><strong>{completed.length}</strong><span>Completed</span></div>
        <div><strong>{confirmationPending.length+disputed.length}</strong><span>Needs result review</span></div>
        <button onClick={()=>load(selected)}>↻ Refresh now</button>
        <button className="primary" onClick={assignNextReady} disabled={!ready.length || !available.length}>⚡ Assign next ready</button>
      </div>

      <div className="commandProgress">
        <div className="commandProgressTop">
          <div><strong>Tournament progress</strong><span>{completed.length} of {matches.length} matches completed</span></div>
          <strong>{matches.length ? Math.round((completed.length/matches.length)*100) : 0}%</strong>
        </div>
        <div className="progressTrack"><div className="progressFill" style={{width:`${matches.length ? Math.round((completed.length/matches.length)*100) : 0}%`}} /></div>
      </div>

      {(confirmationPending.length>0 || disputed.length>0 || accessibleReady.length>0 || (ready.length>0 && available.length===0) || inaccessible.length>0) &&
        <div className="attentionPanel">
          <div className="attentionTitle">⚠️ Needs attention</div>
          {confirmationPending.map(m=><div className="attentionItem resultReviewItem" key={`confirm-${m.id}`}><div><strong>🔐 Match {m.match_number} awaiting confirmation</strong><span>{playerName(m.player1_id)} {m.score1??0}–{m.score2??0} {playerName(m.player2_id)} · {m.p1_confirmed?'✓ P1 confirmed':'P1 waiting'} · {m.p2_confirmed?'✓ P2 confirmed':'P2 waiting'}</span></div><div className="reviewActions"><button className="primary" onClick={()=>approveMatchResult(m)}>Approve</button><button onClick={()=>openCorrection(m)}>Correct result</button><button onClick={()=>reopenMatchResult(m)}>Reopen</button></div></div>)}
          {disputed.map(m=><div className="attentionItem resultReviewItem" key={`dispute-${m.id}`}><div><strong>⚠️ Match {m.match_number} disputed</strong><span>{playerName(m.player1_id)} {m.score1??0}–{m.score2??0} {playerName(m.player2_id)}{m.dispute_reason?` · ${m.dispute_reason}`:''}</span></div><div className="reviewActions"><button className="primary" onClick={()=>openCorrection(m)}>Correct result</button><button onClick={()=>approveMatchResult(m)}>Approve stored result</button><button onClick={()=>reopenMatchResult(m)}>Reopen</button></div></div>)}
          {accessibleReady.length>0 && eligibleAvailable(accessibleReady[0]).length===0 &&
            <div className="attentionItem"><strong>♿ {accessibleReady.length} accessibility-priority match{accessibleReady.length===1?'':'es'}</strong><span>No suitable accessible table is currently available.</span></div>}
          {ready.length>0 && available.length===0 &&
            <div className="attentionItem"><strong>🎱 {ready.length} match{ready.length===1?' is':'es are'} ready</strong><span>All tables are currently occupied or unavailable.</span></div>}
          {inaccessible.length>0 &&
            <div className="attentionItem"><strong>🔧 {inaccessible.length} table{inaccessible.length===1?' is':'s are'} unavailable</strong><span>Check the table status if you need more capacity.</span></div>}
        </div>}

      <div className="controlSectionHead">
        <div><h4>What’s happening now</h4><span>Live table status and the match currently on each table.</span></div>
      </div>
      <div className="controlSectionHead controlTablesSubhead">
        <div><h4>Tables</h4><span>{tables.length} table{tables.length===1?'':'s'} configured{inaccessible.length?` · ${inaccessible.length} unavailable`:''}</span></div>
      </div>

      <div className="controlGrid">
        {tables.length===0 ? <p className="muted">Add tables to see tournament control.</p> :
          tables.map(t=>{
            const state=tableState(t), active=state.active;
            const nextForTable=!active && t.status!=='unavailable'
              ? orderedReady.find(m=>!needsAccessible(m) || t.is_accessible)
              : null;
            return <div className={`controlCard ${active?'isPlaying':''} ${t.is_accessible?'isAccessible':''}`} key={t.id}>
              <div className="controlTop">
                <strong>Table {t.table_number}{t.is_accessible?' ♿':''}</strong>
                <span className={`statusPill ${state.className}`}>{state.label}</span>
              </div>
              {active ? <div>
                <div className="controlMatch">Match {active.match_number}</div>
                <div className="controlPlayers">{playerName(active.player1_id)} <b>vs</b> {playerName(active.player2_id)}</div>
                <div className="scoreLine">Race to {active.race_to} · <strong>{active.score1??0} – {active.score2??0}</strong></div>
                {needsAccessible(active)&&<div className="accessNote">♿ Accessible table required</div>}
                {active.status==='pending_confirmation'&&<div className="accessNote resultPendingNote">🔐 Waiting for both players to confirm</div>}
                {active.status==='disputed'&&<div className="accessNote resultDisputedNote">⚠️ Result disputed — organiser review required</div>}
                {active.status!=='pending_confirmation'&&active.status!=='disputed'&&<a className="scoreLink controlScore" href={`/score/${t.table_token||t.id}`} target="_blank" rel="noreferrer">📱 Open scoring</a>}
              </div> :
              <div className="controlEmpty">
                {t.status==='unavailable'
                  ? <><strong>Unavailable</strong>{t.notes&&<small>{t.notes}</small>}</>
                  : <><strong>Ready for next match</strong>{t.notes&&<small>{t.notes}</small>}
                      {nextForTable && <button className="tableAssignBtn" onClick={()=>quickAssign(nextForTable,t)}>⚡ Assign Match {nextForTable.match_number}</button>}
                    </>}
              </div>}
            </div>
          })
        }
      </div>

      <div className="nextUpPanel">
        <div className="queueHead">
          <div><h4>Next up</h4><span>The next matches PottersMate is ready to put on a table.</span></div>
          <span className="countBadge">{orderedReady.length}</span>
        </div>
        {orderedReady.length===0
          ? <div className="nextEmpty">{matches.length && matches.every(m=>m.status==='completed'||m.status==='bye') ? '🏆 Tournament complete.' : 'Waiting for the next match to become ready.'}</div>
          : <div className="nextUpGrid">{orderedReady.slice(0,3).map((m,index)=>{
              const options=eligibleAvailable(m);
              return <div className={`nextCard ${needsAccessible(m)?'priorityRow':''}`} key={m.id}>
                <div className="nextNumber">#{index+1}</div>
                <div className="nextDetails">
                  <strong>Match {m.match_number}</strong>
                  <span>{playerName(m.player1_id)} <b>vs</b> {playerName(m.player2_id)}</span>
                  <small>Race to {m.race_to}{needsAccessible(m)?' · ♿ Accessible table required':''}</small>
                </div>
                {options[0] ? <button className="primary nextAssign" onClick={()=>quickAssign(m,options[0])}>⚡ Assign Table {options[0].table_number}</button> : <span className="nextWaiting">{needsAccessible(m)?'Waiting for accessible table':'Waiting for a table'}</span>}
              </div>
            })}</div>}
      </div>

      {orderedReady.length>0 && <div className="readyQueue">
        <div className="queueHead">
          <div><h4>Ready to play</h4><span>Matches are ordered with accessibility-required players first.</span></div>
          {accessibleReady.length>0&&<span className="priorityBadge">♿ {accessibleReady.length} priority</span>}
        </div>
        {orderedReady.map((m,index)=>{
          const options=eligibleAvailable(m);
          return <div className={`readyRow ${needsAccessible(m)?'priorityRow':''}`} key={m.id}>
            <div className="readyInfo">
              <div><strong>#{index+1} · Match {m.match_number}</strong>{needsAccessible(m)&&<span className="priorityBadge small">♿ Priority</span>}</div>
              <span>{playerName(m.player1_id)} vs {playerName(m.player2_id)} · Race to {m.race_to}</span>
              {options.length>0 && <small className="readyHint">Can be assigned now</small>}
              {!options.length && <small className="waitReason">{needsAccessible(m)?'Waiting for an accessible table.':'Waiting for an available table.'}</small>}
            </div>
            <div className="actions">
              {options[0] && <button onClick={()=>quickAssign(m,options[0])}>Assign Table {options[0].table_number}{options[0].is_accessible?' ♿':''}</button>}
              <select defaultValue="" disabled={!options.length} onChange={e=>{if(e.target.value){const t=tables.find(x=>x.id===e.target.value);quickAssign(m,t)}}}>
                <option value="">{options.length?'Choose table…':'No suitable table'}</option>
                {options.map(t=><option key={t.id} value={t.id}>Table {t.table_number}{t.is_accessible?' ♿':''}</option>)}
              </select>
            </div>
          </div>
        })}
      </div>}

      {waiting.length>0 && <div className="waitingPanel">
        <div className="queueHead">
          <div><h4>Waiting for earlier matches</h4><span>These matches cannot start until their players are determined.</span></div>
          <span className="countBadge">{waiting.length}</span>
        </div>
        <div className="waitingList">
          {waiting.map(m=><div className="waitingItem" key={m.id}>
            <strong>Match {m.match_number}</strong>
            <span>Round {m.round_number} · {playerName(m.player1_id)} vs {playerName(m.player2_id)}</span>
          </div>)}
        </div>
      </div>}

      {completed.length>0 && <div className="resultsPanel">
        <div className="queueHead">
          <div><h4>Latest results</h4><span>Completed matches are kept here for quick reference.</span></div>
          <span className="countBadge">{completed.length}</span>
        </div>
        <div className="resultsList">
          {completed.slice(0,8).map(m=><div className="resultItem" key={m.id}>
            <div><strong>Match {m.match_number}</strong><span>{playerName(m.player1_id)} vs {playerName(m.player2_id)}</span></div>
            <div className="resultScore"><strong>{m.score1??0} – {m.score2??0}</strong><span>Winner: {playerName(m.winner_id)}</span></div>
          </div>)}
        </div>
      </div>}
    </div>
  }


  if(!session)return <><style>{css}</style><main className="auth"><div className="card"><div className="authBrandBox"><PottersMateBrand/><div className="authBrandTag">TOURNAMENT MANAGEMENT FOR CUE SPORTS</div></div><p>Competition management for cue-sport clubs.</p><form onSubmit={auth}><input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required/><input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required/><button className="primary">{mode==='login'?'Log in':'Create organiser account'}</button></form>{authMsg&&<p className="error">{authMsg}</p>}<button className="link" onClick={()=>setMode(mode==='login'?'signup':'login')}>{mode==='login'?'Need an organiser account?':'Already have an account? Log in'}</button><div className="playerEntry"><span>Are you a player?</span><a href="/player/login">Player login / registration →</a></div></div></main></>;

  const checked=players.filter(p=>p.checked_in).length;
  return <><style>{css}</style><header><div className="appBrand"><PottersMateBrand compact/><span><h1>PottersMate</h1><small>Organiser Dashboard</small></span></div><button onClick={()=>supabase.auth.signOut()}>Log out</button></header>
  {msg&&<div className="notice">{msg}<button onClick={()=>setMsg('')}>✕</button></div>}
  <div className="layout"><aside><div className="asideTitle"><b>Competitions</b><button className="primary createBtn" onClick={()=>{setSelected(null);setModal({type:'competition',c:null})}}>＋ Create competition</button><button onClick={()=>setModal({type:'templates'})}>🔄 Recurring tournaments</button><button onClick={()=>setModal({type:'playerdb'})}>👥 Player database</button><button onClick={()=>setModal({type:'clubs'})}>🏠 Clubs</button></div>{competitions.map(c=><button className={selected?.id===c.id?'sel':''} key={c.id} onClick={()=>load(c)}>{c.name}<small>{c.start_date||'Date TBC'} · {c.venue||''}</small></button>)}</aside>
  {!selected?<section className="empty"><h2>Select a competition</h2><p>Manage players, tables and match assignments.</p></section>:
  <section className="content"><div className="hero"><div><h2>{selected.name}</h2><p>{selected.venue} · {selected.start_date||'Date TBC'}</p><div className="settingsSummary"><span><b>Format:</b> {selected.format||'Not set'}</span><span><b>Rules:</b> {selected.rules||'Not set'}</span><span><b>Default race:</b> Race to {selected.default_race_to||3}</span></div>
<div className="tournamentStatusStrip">
  <span className="phaseDot"></span>
  <div><b>{matches.length===0?'Ready to set up':matches.some(m=>m.status==='in_progress'||m.status==='active')?'Tournament live':matches.some(m=>m.group_name && Number(m.round_number)===1 && m.status!=='completed')?'Group stage in progress':matches.some(m=>Number(m.round_number)>1 && m.status!=='completed' && m.status!=='bye')?'Knockout in progress':matches.length>0 && matches.every(m=>m.status==='completed'||m.status==='bye')?'Tournament complete':'Draw ready'}</b>
  <small>{matches.length===0?'Add players, check them in, then create the draw.':`${matches.filter(m=>m.status==='completed').length} of ${matches.length} matches completed · ${players.length} players · ${tables.length} tables`}</small></div>
</div>{selected.recurring_template_id&&<div className="sessionBanner">{selected.session_type==='casual'?<><strong>🎱 Casual night</strong><span>Excluded from season standings</span></>:<><strong>🏆 Season week {selected.season_week||'?'}</strong><span>Counts toward season standings</span></>}</div>}</div><div className="heroRight"><button className="primary" onClick={()=>window.open(`/display/${selected.id}`,'_blank','noopener,noreferrer')}>📺 TV Display</button><button onClick={()=>window.open(`/tournament/${selected.id}`,'_blank','noopener,noreferrer')}>🌐 Public tournament</button><button onClick={()=>setModal({type:'competition',c:selected})}>⚙️ Edit competition</button><button className="danger" onClick={deleteCompetition}>🗑️ Delete competition</button><div className="stats"><b>{players.length} players</b><b>{checked} checked in</b><b>{tables.length} tables</b></div></div></div>

  {selected.recurring_template_id&&<Panel title="Season">
    <div className="seasonPanelIntro"><strong>{selected.session_type==='casual'?'🎱 Casual night':'🏆 Season session'}</strong><span>{selected.session_type==='casual'?'Results are saved in match history but excluded from season standings.':'Only season sessions count toward this recurring season.'}</span></div>
    {seasonCompetitions.length>0&&<div className="seasonSessionList">
      {seasonCompetitions.filter(c=>c.session_type==='season').map(c=><div className={`seasonSession ${c.id===selected.id?'current':''}`} key={c.id}><strong>Week {c.season_week||'?'}</strong><span>{c.start_date||'Date TBC'}</span><em>{c.id===selected.id?'Current':'Season session'}</em></div>)}
    </div>}
    {selected.session_type==='casual'&&<div className="casualNote">Casual results do <b>not</b> alter season wins, losses or points.</div>}
  </Panel>}

  {selected.recurring_template_id&&selected.session_type!=='casual'&&<Panel title="Season standings">
    <div className="seasonStandingsHead">
      <div><strong>🏆 {templates.find(t=>t.id===selected.recurring_template_id)?.name||'Season'}</strong>
      <span>Week {selected.season_week||'?'} of {templates.find(t=>t.id===selected.recurring_template_id)?.season_length_weeks||8}</span></div>
      <span>{pointsSettings.win} point{pointsSettings.win===1?'':'s'} for a win</span>
    </div>
    {buildSeasonStandings(players,seasonMatches,pointsSettings).length===0
      ? <p className="muted">No completed season matches yet. Standings will appear after results are recorded.</p>
      : <div className="standingsTableWrap"><table className="standingsTable"><thead><tr><th>#</th><th>Player</th><th>Played</th><th>W</th><th>L</th><th>Pts</th><th>FD</th></tr></thead><tbody>
        {buildSeasonStandings(players,seasonMatches,pointsSettings).map((r,i)=><tr key={r.id}><td>{i+1}</td><td><strong>{r.name}</strong></td><td>{r.played}</td><td>{r.wins}</td><td>{r.losses}</td><td><strong>{r.points}</strong></td><td>{r.framesFor-r.framesAgainst>0?'+':''}{r.framesFor-r.framesAgainst}</td></tr>)}
      </tbody></table></div>}
    <small className="muted">Only completed matches from season sessions count. Casual nights are excluded.</small>
  </Panel>}

  <Panel title="Players" add={()=>setModal({type:'player'})} addText="＋ Add player">
    <div className="drawTools"><button onClick={()=>setModal({type:'playerdb'})}>👥 Add from player database</button></div>
    {players.map(p=><div className="row" key={p.id}><div><button className="playerNameButton" onClick={()=>openPlayerProfile(p)}><b>{p.players?.display_name || `${p.players?.first_name||''} ${p.players?.last_name||''}`.trim() || 'Unnamed Player'}</b></button><small>{p.players?.club_name||'No club'}{p.players?.phone?` · ${p.players.phone}`:''}{p.players?.requires_accessible_table?' · ♿ Accessible table required':''}</small></div><div className="actions"><button onClick={()=>openPlayerProfile(p)}>📊 Profile</button><button onClick={()=>setModal({type:'player',p})}>✏️ Edit</button><button onClick={()=>checkin(p)}>{p.checked_in?'✓ Checked in':'Check in'}</button><button className="danger" onClick={()=>removePlayer(p)}>🗑️ Remove</button></div></div>)}
  </Panel>

  <Panel title="Tables" add={()=>setModal({type:'table'})} addText="＋ Add table">
    {tables.length===0&&<p className="muted">No tables added yet.</p>}
    {tables.map(t=><div className="row" key={t.id}><div><b>Table {t.table_number} {t.is_accessible?'♿':''}</b><small>{t.table_type||'Standard'} · {t.status||'available'}{t.notes?` · ${t.notes}`:''}</small></div><div className="actions"><select value={t.status||'available'} onChange={e=>saveTable({...t,status:e.target.value},t)}><option value="available">Available</option><option value="occupied">Occupied</option><option value="unavailable">Unavailable</option></select><button onClick={()=>setModal({type:'table',t})}>✏️ Edit</button><a className="scoreLink" href={`/score/${t.table_token||t.id}`} target="_blank" rel="noreferrer">📱 Scoring</a><button onClick={()=>showQR(t)}>▦ QR Code</button><button className="danger" onClick={()=>delTable(t)}>🗑️ Delete</button></div></div>)}
  </Panel>

  {matches.some(m=>m.group_name)&&<GroupStandingsPanel matches={matches} playerName={playerName} qualifiers={Math.max(1,Number(drawSettings.qualifiers_per_group||4))}/>}

  <Panel title="Matches & Table Assignment">
    <div className="drawTools">
      {matches.some(m=>m.group_name && Number(m.round_number)===1) && matches.some(m=>Number(m.round_number)>1 && !m.group_name) && <button onClick={testCompleteGroupStageWithConfirmations}>🧪 TEST: Complete Groups + Both Confirm</button>}
      <button className="primary" onClick={()=>{if((selected.format||'').toLowerCase()==='groups → knockout')setDrawSettings(s=>({...s,type:'Groups → Knockout'}));else if((selected.format||'').toLowerCase()==='reverse cross')setDrawSettings(s=>({...s,type:'Reverse Cross'}));else if((selected.format||'').toLowerCase()==='seeded 16')setDrawSettings(s=>({...s,type:'Seeded 16',group_count:4,qualifiers_per_group:4,group_knockout_mode:'top16_overall'}));setModal({type:'draw'})}}>🎱 {matches.length?'Edit / Regenerate Draw':'Create Draw'}</button>
      {matches.some(m=>m.group_name)&&<>{matches.some(m=>Number(m.round_number)>1 && !m.group_name)?<button onClick={()=>generateGroupKnockout(drawSettings)} disabled={matches.some(m=>Number(m.round_number)>1 && !m.group_name && m.status!=='waiting')}>🏆 {matches.some(m=>Number(m.round_number)>1 && !m.group_name && m.status==='waiting')?'Populate':'Generate'} {Math.max(2, Number(drawSettings.group_count||4))*Math.max(1,Number(drawSettings.qualifiers_per_group||4))===16?'Round of 16':'Knockout'} from qualifiers</button>:<button onClick={generateReverseCrossover} disabled={matches.some(m=>Number(m.round_number)>1 && !m.group_name)}>🏆 Generate Reverse Cross</button>}</>}
      {matches.length===0&&<p className="muted">No matches created yet.</p>}
    </div>
    {matches.map(m=><div className={`row ${m.status==='bye'?'byeRow':''}`} key={m.id}>
      <div><b>Match {m.match_number} · {m.group_name?`Group ${m.group_name} · `:''}Round {m.round_number}</b><small>
        {m.status==='bye' && m.winner_id
          ? <><strong>{playerName(m.winner_id)} — BYE</strong> · Advances automatically</>
          : <>{matchPlayersLabel(m)} · Race to {m.race_to} · {matchStatusLabel(m)}</>}
        {m.status==='completed' && <> · <strong>Result: {m.score1 ?? 0} – {m.score2 ?? 0}</strong>{m.winner_id ? <> · Winner: {playerName(m.winner_id)}</> : null}{Number(m.race_to)===1 && m.winner_balls !== null && m.winner_balls !== undefined ? <> · {m.winner_balls} balls remaining</> : null}</>}
      </small></div>
      {m.status==='bye'
        ? <span className="byeBadge">BYE</span>
        : <select value={m.table_id||''} onChange={e=>assign(m,e.target.value)} disabled={m.status==='completed'}><option value="">Unassigned</option>{tables.filter(t=>{if(t.status==='unavailable')return false;const needs=[m.player1_id,m.player2_id].some(pid=>players.find(x=>x.player_id===pid)?.players?.requires_accessible_table);return !needs || t.is_accessible;}).map(t=><option key={t.id} value={t.id}>Table {t.table_number}{t.is_accessible?' ♿':''}</option>)}</select>}
    </div>)}
  </Panel>
  {matches.length>0 && <Panel title="Live Tournament Control">
    <TournamentControl tables={tables} matches={matches} playerName={playerName}/>
  </Panel>}
  {matches.length>0 && ['knockout','groups → knockout','reverse cross','seeded 16'].includes((selected.format||'').toLowerCase()) && <Panel title="Knockout Bracket">
    <p className="muted">Winners advance automatically when their match is completed.</p>
    <KnockoutBracket matches={['groups → knockout','reverse cross','seeded 16'].includes((selected.format||'').toLowerCase()) ? matches.filter(m=>!m.group_name) : matches} playerName={playerName}/>
  </Panel>}
  </section>}</div>
  {qrData&&<QRModal data={qrData} close={()=>setQrData(null)}/>}
  {modal?.type==='clubs'&&<ClubsModal clubs={clubs} close={()=>setModal(null)} save={saveClub}/>}
  {modal?.type==='playerdb'&&<PlayerDatabaseModal players={playerDB} currentPlayers={players} close={()=>setModal(null)} add={addExistingPlayerToCompetition} edit={(p)=>setModal({type:'masterPlayer',p})} deletePlayer={deleteMasterPlayer} newPlayer={()=>setModal({type:'masterPlayer',p:null})} profile={openPlayerProfile}/>}
  {modal?.type==='playerProfile'&&<PlayerProfileModal data={profileData} close={()=>setModal(null)} playerName={playerName}/>}
  {modal?.type==='draw'&&<DrawModal selected={selected} players={players} matches={matches} settings={drawSettings} setSettings={setDrawSettings} close={()=>setModal(null)} generate={generateDraw} generateGroups={generateGroupsReverseCrossover}/>}
  {modal?.type==='masterPlayer'&&<MasterPlayerModal p={modal.p} clubs={clubs} allowAdd={!!selected} close={()=>setModal(null)} save={saveMasterPlayer}/>}
  {modal?.type==='player'&&<PlayerModal p={modal.p} clubs={clubs} close={()=>setModal(null)} save={savePlayer}/>}
  {modal?.type==='resultCorrection'&&<ResultCorrectionModal m={modal.m} close={()=>setModal(null)} save={correctMatchResult} playerName={playerName}/>}
  {modal?.type==='table'&&<TableModal t={modal.t} close={()=>setModal(null)} save={saveTable}/>}
  {modal?.type==='competition'&&<CompetitionModal c={modal.c} close={()=>setModal(null)} save={saveCompetition}/>}
  {modal?.type==='templates'&&<RecurringModal templates={templates} close={()=>setModal(null)} newTemplate={()=>setModal({type:'template'})} edit={t=>setModal({type:'template',t})} start={startFromTemplate} newSeason={startNewSeason} deactivate={deactivateTemplate} openTables={openTemplateTables}/>}
  {modal?.type==='template'&&<TemplateModal t={modal.t} close={()=>setModal(null)} save={saveTemplate}/>}
  {modal?.type==='templateTables'&&<TemplateTablesModal t={modal.t} tables={templateTables} close={()=>setModal(null)} add={()=>setModal({type:'templateTable',t:modal.t,table:null})} edit={table=>setModal({type:'templateTable',t:modal.t,table})} del={delTemplateTable}/>}
  {modal?.type==='templateTable'&&<TableModal t={modal.table} close={()=>setModal({type:'templateTables',t:modal.t})} save={(f,old)=>saveTemplateTable(f,old,modal.t)}/>}
  </>;
}

function Panel({title,add,addText,children}){return <div className="panel"><div className="ph"><h3>{title}</h3>{add&&<button className="primary" onClick={add}>{addText}</button>}</div>{children}</div>}
function GroupStandingsPanel({matches=[],playerName,qualifiers=4}){
  const groups=[...new Set(matches.filter(m=>m.group_name&&Number(m.round_number)===1).map(m=>m.group_name))].sort();
  if(!groups.length)return null;
  return <Panel title="Group standings">
    <div className="groupStandingsGrid">
      {groups.map(g=>{
        const rows=rankGroupPlayers(matches.filter(m=>m.group_name===g));
        return <div className="groupCard" key={g}>
          <div className="groupCardHead"><strong>Group {g}</strong><span>Top {qualifiers} advance</span></div>
          {rows.map((r,i)=><div className={`groupStandingRow ${i<qualifiers?'qualifier':''}`} key={r.id}>
            <b>{i+1}</b><span>{playerName(r.id)}</span><strong>{r.wins}W</strong><small>{r.ballDiff>=0?`+${r.ballDiff}`:r.ballDiff} balls</small>
          </div>)}
        </div>
      })}
    </div>
    <small className="muted">Ranking order: wins → cumulative signed ball differential (winner +N, loser −N) → frame difference → frames for. If the next knockout field needs extra places, PottersMate selects wildcard qualifiers from the non-qualifiers using most wins, then highest cumulative ball differential.</small>
  </Panel>
}

function DrawModal({selected,players,matches=[],settings,setSettings,close,generate,generateGroups}){
  const checked=players.filter(p=>p.checked_in).length;
  const drawLocked=matches.some(m=>['completed','in_progress','active'].includes(m.status));
  const maxEvenGroups=Math.min(8,Math.floor(checked/2));
  const groupOptions=[2,3,4,5,6,7,8].filter(n=>n<=Math.floor(checked/2));
  const isGroupsKO=settings.type==='Groups → Knockout';
  const isReverse=settings.type==='Reverse Cross';
  const isSeeded16=settings.type==='Seeded 16';
  const isGroups=isGroupsKO||isReverse||isSeeded16;
  const groupCount=isSeeded16?4:(groupOptions.includes(Number(settings.group_count))?Number(settings.group_count):(groupOptions[0]||2));
  const maxGroupSize=groupCount>0?Math.ceil(checked/groupCount):0;
  const qualifierOptions=Array.from({length:Math.max(1,maxGroupSize)},(_,i)=>i+1);
  const qualifiers=Math.min(Number(settings.qualifiers_per_group)||Math.min(4,maxGroupSize||1),maxGroupSize||1);
  const knockoutSize=groupCount*qualifiers;
  return <Modal title="Draw Builder" close={close}>
    <p className="muted"><b>{checked}</b> checked-in players.</p>
    <label>Draw type<select disabled={drawLocked} value={settings.type} onChange={e=>setSettings({...settings,type:e.target.value})}>
      <option>Knockout</option><option>Round Robin</option><option>Random Draw</option><option>Groups → Knockout</option><option>Reverse Cross</option><option>Seeded 16</option>
    </select></label>
    {isGroups && <label>Number of groups<select disabled={drawLocked || isSeeded16} value={isSeeded16?4:groupCount} onChange={e=>setSettings({...settings,group_count:Number(e.target.value)})}>
      {isSeeded16?<option value="4">4 groups</option>:groupOptions.length?groupOptions.map(n=><option key={n} value={n}>{n} groups</option>):<option value="2">2 groups</option>}
    </select></label>}
    {(isGroupsKO || isReverse) && <>
      <label>Players advancing from each group<select disabled={drawLocked} value={qualifiers} onChange={e=>setSettings({...settings,qualifiers_per_group:Number(e.target.value)})}>
        {qualifierOptions.map(n=><option key={n} value={n}>Top {n}</option>)}
      </select></label>
      <label>Knockout draw<select disabled={drawLocked} value={settings.group_knockout_mode||'group_crossover'} onChange={e=>setSettings({...settings,group_knockout_mode:e.target.value})}>
        <option value="group_crossover">Group crossover — A1 vs B4, A2 vs B3</option>
        <option value="five_group_reverse">Five-group reverse crossover — 5 groups / Top 3 / 1 wildcard</option>
        <option value="seeded">Seeded qualification order</option>
        <option value="random">Randomise qualifiers</option>
      </select></label>
    </>}
    {isGroups ? <>
  <label>Group stage race length<select disabled={drawLocked} value={settings.group_race_to||1} onChange={e=>setSettings({...settings,group_race_to:Number(e.target.value)})}>
    {[1,2,3,5,7,9].map(n=><option key={n} value={n}>Race to {n}</option>)}
  </select></label>
  <label>Knockout race length<select disabled={drawLocked} value={settings.knockout_race_to||2} onChange={e=>setSettings({...settings,knockout_race_to:Number(e.target.value)})}>
    {[1,2,3,5,7,9].map(n=><option key={n} value={n}>Race to {n}</option>)}
  </select></label>
</> : <label>Race length<select disabled={drawLocked} value={settings.race_to} onChange={e=>setSettings({...settings,race_to:Number(e.target.value)})}>
  {[1,2,3,5,7,9].map(n=><option key={n} value={n}>Race to {n}</option>)}
</select></label>}
    {drawLocked && <div className="drawLockedNote">🔒 <strong>Draw locked.</strong> Matches have already been completed or are in progress, so draw settings cannot be changed.</div>}
    {!drawLocked && matches.length>0 && <div className="drawWarningNote">⚠️ <strong>Existing draw:</strong> generating again will replace the current scheduled draw. This is only available before play has started.</div>}
    <div className="settingNote">
      {settings.type==='Knockout'&&'Players are paired in the current checked-in order. Once generated, the bracket is fixed and winners progress automatically.'}
      {settings.type==='Round Robin'&&'Every checked-in player plays every other player once.'}
      {settings.type==='Random Draw'&&'Players are shuffled before the knockout draw.'}
      {isGroupsKO&&`Group stage first: ${groupCount} groups, then the top ${qualifiers} from each group advance. PottersMate automatically calculates the next power-of-two knockout field and any wildcard places needed. Wildcards are ranked by most wins, then highest cumulative ball differential.`}
      {isReverse&&'Reverse Cross keeps group positions as the basis of the draw. The highest qualifier plays the lowest qualifier from another group, then 2nd vs 2nd-lowest, etc. With 5 groups and Top 3, the 15 automatic qualifiers are joined by the best 4th-place finisher; that wildcard is always drawn against a player from a different group.'}
      {isSeeded16&&'Seeded 16 is for 16 or more players. All checked-in players enter the group stage across 4 groups; there is no maximum group-stage player count. After the group stage, the top 16 overall are selected using wins first, then ball differential, and seeded 1–16 for the knockout.'}
    </div>
    {isGroupsKO && checked>=2 && <div className="drawPreviewNote">{(() => { const plan=qualificationPlan(groupCount,qualifiers); const stage=plan.target===16?'Round of 16':plan.target===8?'Quarter-final / 8-player knockout':plan.target===4?'4-player knockout':plan.target===32?'Round of 32':`${plan.target}-player knockout`; return <><strong>{checked} players → {groupCount} groups → {plan.automatic} automatic qualifiers.</strong> Top {qualifiers} from every group advance. {plan.wildcards>0 ? <>{plan.wildcards} wildcard{plan.wildcards===1?'':'s'} will be selected from the non-qualifiers using <strong>most wins → highest cumulative ball differential</strong>. Then {plan.target} players enter the {stage}.</> : <>No wildcard is required. The {plan.target}-player field proceeds directly to the {stage}.</>}</>; })()}</div>}
    {isReverse && checked>=2 && <div className="drawPreviewNote"><strong>{checked} players → {groupCount} groups → Top {qualifiers} from each group.</strong> All checked-in players play the group stage. {qualificationPlan(groupCount,qualifiers).wildcards>0 ? <>The extra knockout place{qualificationPlan(groupCount,qualifiers).wildcards===1?' is':'s are'} filled by the best non-qualifier{qualificationPlan(groupCount,qualifiers).wildcards===1?'':'s'}, while keeping Round 1 cross-group.</> : <>The qualifiers fill the knockout field directly.</>}</div>}
    {isSeeded16 && checked>=16 && <div className="drawPreviewNote"><strong>{checked} players → 4 groups → top 16 overall.</strong> All {checked} players take part in the group stage. The group size adjusts automatically; only the final top 16 progress to the knockout. Knockout: 1 vs 16, 2 vs 15, 3 vs 14, and so on.</div>}
    <div className="ma"><button type="button" onClick={close}>Close</button><button className="primary" disabled={drawLocked || checked<2 || (isGroups && (groupOptions.length===0 || !groupOptions.includes(groupCount)))} onClick={()=>isGroups?generateGroups({...settings,type:isGroupsKO?'Groups → Knockout':isSeeded16?'Seeded 16':'Reverse Cross',group_count:isSeeded16?4:groupCount,qualifiers_per_group:isSeeded16?4:qualifiers,group_knockout_mode:isSeeded16?'top16_overall':(settings.group_knockout_mode||'group_crossover')}):generate(settings)}>{matches.length?'Regenerate Draw':'Generate Draw'}</button></div>
  </Modal>
}

function QRModal({data,close}){
  function printQR(){
    const w=window.open('', '_blank', 'width=500,height=650');
    if(!w)return;
    w.document.write(`<!doctype html><html><head><title>PottersMate Table ${data.table.table_number} QR</title><style>body{font-family:Arial;text-align:center;padding:30px}h1{font-size:28px}img{width:320px;height:320px}.url{font-size:11px;word-break:break-all;color:#555;margin-top:18px}@media print{button{display:none}}</style></head><body><h1>🎱 PottersMate</h1><h2>TABLE ${data.table.table_number}</h2><img src="${data.image}" /><h3>SCAN TO SCORE</h3><p class="url">${data.url}</p><button onclick="window.print()">Print</button></body></html>`);
    w.document.close();
  }
  return <Modal title={`Table ${data.table.table_number} QR code`} close={close}>
    <div style={{textAlign:'center'}}>
      <div className="qrLarge"><img src={data.image} alt={`QR code for Table ${data.table.table_number}`} /></div>
      <h3>TABLE {data.table.table_number}</h3>
      <p><strong>Scan this QR code to score matches on this table.</strong></p>
      <p style={{wordBreak:'break-all',fontSize:12,color:'#667085'}}>{data.url}</p>
      <div className="ma">
        <button className="primary" onClick={printQR}>🖨️ Print QR</button>
        <button onClick={()=>window.open(data.url,'_blank')}>Open scoring page</button>
        <button onClick={close}>Close</button>
      </div>
    </div>
  </Modal>
}


function PlayerProfileModal({data,close,playerName}){
  const {player,matches,competitions,templates,loading}=data;
  const name=player?.display_name||`${player?.first_name||''} ${player?.last_name||''}`.trim()||'Player';
  const byId=Object.fromEntries((competitions||[]).map(c=>[c.id,c]));
  const templateById=Object.fromEntries((templates||[]).map(t=>[t.id,t]));
  const otherName=(id)=>playerName?.(id)||'Player';
  const wins=(matches||[]).filter(m=>m.winner_id===player?.id).length;
  const losses=(matches||[]).filter(m=>m.loser_id===player?.id).length;
  const played=wins+losses;
  const framesFor=(matches||[]).reduce((n,m)=>n+Number(m.player1_id===player?.id?m.score1||0:m.score2||0),0);
  const framesAgainst=(matches||[]).reduce((n,m)=>n+Number(m.player1_id===player?.id?m.score2||0:m.score1||0),0);
  const fd=framesFor-framesAgainst;
  const winPct=played?Math.round((wins/played)*100):0;
  const seasonMatches=(matches||[]).filter(m=>byId[m.competition_id]?.session_type==='season');
  const seasonGroups={};
  seasonMatches.forEach(m=>{
    const c=byId[m.competition_id]; const key=c?.season_id||c?.id;
    if(!seasonGroups[key])seasonGroups[key]={name:c?.name||'Season',played:0,wins:0,losses:0,points:0,fd:0,weeks:new Set()};
    const g=seasonGroups[key]; g.played++; if(m.winner_id===player?.id)g.wins++; if(m.loser_id===player?.id)g.losses++;
    g.fd += Number(m.player1_id===player?.id?(m.score1||0)-(m.score2||0):(m.score2||0)-(m.score1||0));
    const tpl=templateById[c?.recurring_template_id]; g.points += m.winner_id===player?.id?Number(tpl?.win_points??1):Number(tpl?.loss_points??0);
    if(c?.season_week)g.weeks.add(c.season_week);
  });
  const seasonRows=Object.values(seasonGroups).sort((a,b)=>b.points-a.points||b.wins-a.wins);
  const compGroups={};
  (matches||[]).forEach(m=>{
    const c=byId[m.competition_id]; const key=m.competition_id;
    if(!compGroups[key])compGroups[key]={name:c?.name||'Competition',date:c?.start_date||'',type:c?.session_type||'single',played:0,wins:0,losses:0,fd:0};
    const g=compGroups[key];g.played++;if(m.winner_id===player?.id)g.wins++;if(m.loser_id===player?.id)g.losses++;
    g.fd+=Number(m.player1_id===player?.id?(m.score1||0)-(m.score2||0):(m.score2||0)-(m.score1||0));
  });
  return <Modal title={`${name} — Player profile`} close={close}>
    {loading?<p className="muted">Loading player history…</p>:<>
      <div className="profileHero">
        <div><h2>{name}</h2><p>{player?.club_name||'No club'}{player?.requires_accessible_table?' · ♿ Accessible table required':''}</p></div>
        <div className="profileStats">
          <div><b>{played}</b><span>Matches</span></div><div><b>{wins}</b><span>Wins</span></div><div><b>{losses}</b><span>Losses</span></div><div><b>{winPct}%</b><span>Win rate</span></div><div><b>{framesFor}</b><span>Frames for</span></div><div><b>{fd>=0?`+${fd}`:fd}</b><span>Frame diff.</span></div>
        </div>
      </div>
      <section className="profileSection"><h4>🏆 Season history</h4>
        {seasonRows.length===0?<p className="muted">No completed season matches yet.</p>:<div className="profileTable"><div className="profileTableHead"><span>Season</span><span>Played</span><span>W–L</span><span>Pts</span><span>FD</span></div>{seasonRows.map((g,i)=><div className="profileTableRow" key={i}><span><b>{g.name}</b></span><span>{g.played}</span><span>{g.wins}–{g.losses}</span><span>{g.points}</span><span>{g.fd>=0?`+${g.fd}`:g.fd}</span></div>)}</div>}
      </section>
      <section className="profileSection"><h4>🎱 Competition history</h4>
        {Object.values(compGroups).length===0?<p className="muted">No completed matches yet.</p>:<div className="profileTable"><div className="profileTableHead"><span>Competition</span><span>Played</span><span>W–L</span><span>FD</span></div>{Object.values(compGroups).map((g,i)=><div className="profileTableRow" key={i}><span><b>{g.name}</b><small>{g.date}{g.type==='casual'?' · 🎱 Casual':g.type==='season'?' · 🏆 Season':''}</small></span><span>{g.played}</span><span>{g.wins}–{g.losses}</span><span>{g.fd>=0?`+${g.fd}`:g.fd}</span></div>)}</div>}
      </section>
      <section className="profileSection"><h4>🕐 Recent matches</h4>
        {(matches||[]).length===0?<p className="muted">No completed matches yet.</p>:<div className="profileMatches">{matches.slice(0,10).map(m=>{const c=byId[m.competition_id];const isP1=m.player1_id===player?.id;const opponent=otherName(isP1?m.player2_id:m.player1_id);const won=m.winner_id===player?.id;return <div className="profileMatch" key={m.id}><div><b>{name} {won?'defeated':'lost to'} {opponent}</b><small>{c?.name||'Competition'}{c?.session_type==='casual'?' · 🎱 Casual':c?.season_week?` · 🏆 Week ${c.season_week}`:''}</small></div><strong>{m.score1??0} – {m.score2??0}</strong></div>})}</div>}
      </section>
    </>}
  </Modal>
}

function PlayerDatabaseModal({players,currentPlayers,close,add,edit,deletePlayer,newPlayer,profile}){
  const [q,setQ]=useState('');
  const current=new Set(currentPlayers.map(x=>x.player_id));
  const filtered=players.filter(p=>{
    const text=`${p.display_name||''} ${p.first_name||''} ${p.last_name||''} ${p.club_name||''} ${p.phone||''}`.toLowerCase();
    return text.includes(q.toLowerCase());
  });
  return <Modal title="Player database" close={close}>
    <div className="dbTop"><input placeholder="Search players..." value={q} onChange={e=>setQ(e.target.value)}/><button className="primary" onClick={newPlayer}>＋ New player</button></div>
    <p className="muted">{players.length} player{players.length===1?'':'s'} in your database.</p>
    <div className="dbList">
      {filtered.length===0&&<p className="muted">No players found.</p>}
      {filtered.map(p=><div className="row" key={p.id}>
        <div><b>{p.display_name||`${p.first_name||''} ${p.last_name||''}`.trim()}</b><small>{p.club_name||'No club'}{p.phone?` · ${p.phone}`:''}{p.email?` · ${p.email}`:''}{p.requires_accessible_table?' · ♿ Accessible table required':''}</small></div>
        <div className="actions"><button onClick={()=>profile(p)}>📊 Profile</button><button onClick={()=>edit(p)}>✏️ Edit</button>{current.has(p.id)?<button disabled>✓ In competition</button>:<button className="primary" onClick={()=>add(p)}>＋ Add</button>}<button className="danger" onClick={()=>deletePlayer(p)}>🗑️ Delete</button></div>
      </div>)}
    </div>
  </Modal>
}

function ClubPicker({clubs,value,onChange}){const [q,setQ]=useState('');const filtered=clubs.filter(c=>c.status==='active'&&`${c.name} ${c.city||''} ${c.region||''}`.toLowerCase().includes(q.toLowerCase())).slice(0,8);return <div className="clubPicker"><label>Primary club</label><input placeholder="Search clubs..." value={q||clubs.find(c=>c.id===value)?.name||''} onChange={e=>{setQ(e.target.value);onChange('')}}/><div className="clubOptions">{filtered.map(c=><button type="button" key={c.id} className={value===c.id?'selectedClub':''} onClick={()=>{onChange(c.id);setQ(c.name)}}>{c.name}{c.city?` · ${c.city}`:''}</button>)}</div>{clubs.length===0&&<small className="muted">No clubs have been created yet. Use Clubs to add one.</small>}</div>}
function PlayerModal({p,clubs,close,save}){const x=p?.players||{};const[f,setF]=useState({playerId:x.id||'',first_name:x.first_name||'',last_name:x.last_name||'',phone:x.phone||'',email:x.email||'',club_name:x.club_name||'',club_id:x.primary_club_id||'',requires_accessible_table:!!x.requires_accessible_table});return <Modal title={p?'Edit player':'Add player'} close={close}><form onSubmit={e=>{e.preventDefault();save(f)}}><label>First name<input required value={f.first_name} onChange={e=>setF({...f,first_name:e.target.value})}/></label><label>Last name<input required value={f.last_name} onChange={e=>setF({...f,last_name:e.target.value})}/></label><label>Phone<input value={f.phone} onChange={e=>setF({...f,phone:e.target.value})}/></label><label>Email<input type="email" value={f.email} onChange={e=>setF({...f,email:e.target.value})}/></label><ClubPicker clubs={clubs} value={f.club_id} onChange={v=>setF({...f,club_id:v})}/><label className="check"><input type="checkbox" checked={f.requires_accessible_table} onChange={e=>setF({...f,requires_accessible_table:e.target.checked})}/> Requires accessible table ♿</label><div className="ma"><button type="button" onClick={close}>Cancel</button><button className="primary">Save changes</button></div></form></Modal>}
function MasterPlayerModal({p,clubs,close,save,allowAdd}){const[f,setF]=useState({playerId:p?.id||'',first_name:p?.first_name||'',last_name:p?.last_name||'',phone:p?.phone||'',email:p?.email||'',club_name:p?.club_name||'',club_id:p?.primary_club_id||'',requires_accessible_table:!!p?.requires_accessible_table,addToCompetition:false});return <Modal title={p?'Edit player':'New player'} close={close}><form onSubmit={e=>{e.preventDefault();save(f)}}><label>First name<input required value={f.first_name} onChange={e=>setF({...f,first_name:e.target.value})}/></label><label>Last name<input required value={f.last_name} onChange={e=>setF({...f,last_name:e.target.value})}/></label><label>Phone<input value={f.phone} onChange={e=>setF({...f,phone:e.target.value})}/></label><label>Email<input type="email" value={f.email} onChange={e=>setF({...f,email:e.target.value})}/></label><ClubPicker clubs={clubs} value={f.club_id} onChange={v=>setF({...f,club_id:v})}/><label className="check"><input type="checkbox" checked={f.requires_accessible_table} onChange={e=>setF({...f,requires_accessible_table:e.target.checked})}/> Requires accessible table ♿</label>{allowAdd&&<label className="check"><input type="checkbox" checked={f.addToCompetition} onChange={e=>setF({...f,addToCompetition:e.target.checked})}/> Add to current competition</label>}<div className="ma"><button type="button" onClick={close}>Cancel</button><button className="primary">{p?'Save player':'Create player'}</button></div></form></Modal>}
function ClubsModal({clubs,close,save}){const [edit,setEdit]=useState(null);const [f,setF]=useState({name:'',city:'',region:'',status:'active'});function start(c){setEdit(c?.id||'new');setF({name:c?.name||'',city:c?.city||'',region:c?.region||'',status:c?.status||'active'})}return <Modal title="Club management" close={close}><div className="dbTop"><div><b>{clubs.length} club{clubs.length===1?'':'s'}</b><small className="muted">Manage the clubs available to PottersMate players.</small></div><button className="primary" onClick={()=>start(null)}>＋ New club</button></div>{edit!==null&&<form className="clubForm" onSubmit={e=>{e.preventDefault();save({...f,id:edit})}}><label>Club name<input required value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></label><label>City<input value={f.city} onChange={e=>setF({...f,city:e.target.value})}/></label><label>Region<input value={f.region} onChange={e=>setF({...f,region:e.target.value})}/></label><label>Status<select value={f.status} onChange={e=>setF({...f,status:e.target.value})}><option value="active">Active</option><option value="inactive">Inactive</option></select></label><div className="ma"><button type="button" onClick={()=>setEdit(null)}>Cancel</button><button className="primary">{edit==='new'?'Create club':'Save club'}</button></div></form>}{clubs.map(c=><div className="row" key={c.id}><div><b>{c.name}</b><small>{[c.city,c.region].filter(Boolean).join(' · ')||'Location not set'} · {c.status}</small></div><div className="actions"><button onClick={()=>start(c)}>✏️ Edit</button></div></div>)}</Modal>}

function CompetitionModal({c,close,save}){
  const[f,setF]=useState({
    name:c?.name||'',venue:c?.venue||'',start_date:c?.start_date||'',
    format:c?.format||'Singles',rules:c?.rules||'CNZ Rules',
    status:c?.status||'active',default_race_to:c?.default_race_to||3
  });
  const isNew=!c;
  return <Modal title={isNew?'Create competition':'Edit competition'} close={close}>
    <form onSubmit={e=>{e.preventDefault();save(f)}}>
      <label>Competition name<input required value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></label>
      <label>Venue<input value={f.venue} onChange={e=>setF({...f,venue:e.target.value})}/></label>
      <label>Date<input type="date" value={f.start_date||''} onChange={e=>setF({...f,start_date:e.target.value})}/></label>
      <label>Format<select value={f.format} onChange={e=>setF({...f,format:e.target.value})}>
        <option>Singles</option><option>Knockout</option><option>Round Robin</option><option>Random Draw</option><option>Reverse Cross</option><option>Seeded 16</option><option>Groups → Knockout</option><option>Doubles</option><option>Teams</option><option>Custom</option>
      </select></label>
      <label>Rules<select value={f.rules} onChange={e=>setF({...f,rules:e.target.value})}><option>CNZ Rules</option><option>International Rules</option><option>Custom</option></select></label>
      <label>Default race length<select value={f.default_race_to} onChange={e=>setF({...f,default_race_to:Number(e.target.value)})}>{[1,2,3,5,7,9].map(n=><option key={n} value={n}>Race to {n}</option>)}</select></label>
      <label>Status<select value={f.status} onChange={e=>setF({...f,status:e.target.value})}><option value="active">Active</option><option value="draft">Draft</option><option value="completed">Completed</option></select></label>
      <div className="settingNote"><b>Race length note:</b> changing this setting changes the default for future matches. Existing match race lengths are not changed automatically.</div>
      <div className="ma"><button type="button" onClick={close}>Cancel</button><button className="primary">{isNew?'Create competition':'Save competition'}</button></div>
    </form>
  </Modal>
}

function dayName(n){return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][Number(n)]}
function RecurringModal({templates,close,newTemplate,edit,start,deactivate,newSeason,openTables}){
  return <Modal title="Recurring tournaments" close={close}>
    <div className="templateIntro"><strong>Run a season from the same recurring format.</strong><span>Players, check-ins, draws and results are new each session. Tables are shared by the recurring tournament, including casual nights, so your physical table setup and QR codes stay the same.</span></div>
    {templates.length===0&&<p className="muted">No recurring tournaments yet.</p>}
    {templates.map(t=><div className="templateCard" key={t.id}>
      <div><strong>{t.name}</strong><span>{dayName(t.day_of_week)} · {t.venue||'Venue TBC'}</span><small>{t.format} · {t.rules} · Race to {t.default_race_to}</small>
      {t.season_enabled!==false&&<small className="seasonMeta">🏆 {t.season_length_weeks||8}-week season</small>}</div>
      <div className="actions">
        {t.season_enabled!==false&&<button className="primary" onClick={()=>start(t,'season')}>▶ Start season week</button>}
        <button onClick={()=>start(t,'casual')}>🎱 Start casual night</button>
        <button onClick={()=>openTables(t)}>🎱 Tables</button>
        {t.season_enabled!==false&&<button onClick={()=>newSeason(t)}>🔄 New season</button>}
        <button onClick={()=>edit(t)}>✏️ Edit</button><button className="danger" onClick={()=>deactivate(t)}>Remove</button>
      </div>
    </div>)}
    <div className="ma"><button type="button" onClick={newTemplate} className="primary">＋ Create recurring tournament</button></div>
  </Modal>
}

function TemplateTablesModal({t,tables,close,add,edit,del}){
  return <Modal title={`Recurring tables — ${t.name}`} close={close}>
    <div className="templateIntro"><strong>These tables are shared by every session.</strong><span>Table numbers, accessibility settings, notes and permanent QR scoring links carry through each season week and casual night.</span></div>
    {tables.length===0&&<p className="muted">No recurring tables set up yet.</p>}
    {tables.map(x=><div className="row" key={x.id}><div><b>Table {x.table_number} {x.is_accessible?'♿':''}</b><small>{x.table_type||'Standard'} · {x.status||'available'}{x.notes?` · ${x.notes}`:''}</small></div><div className="actions"><button onClick={()=>edit(x)}>✏️ Edit</button><button onClick={()=>del(x)} className="danger">🗑️ Delete</button></div></div>)}
    <div className="ma"><button type="button" onClick={close}>Done</button><button className="primary" onClick={add}>＋ Add table</button></div>
  </Modal>
}

function TemplateModal({t,close,save}){
  const[f,setF]=useState({
    name:t?.name||'',venue:t?.venue||'',day_of_week:t?.day_of_week??4,
    format:t?.format||'Knockout',rules:t?.rules||'CNZ Rules',
    default_race_to:t?.default_race_to||3,status:t?.status||'active',
    season_enabled:t?.season_enabled!==false,season_length_weeks:t?.season_length_weeks||8
  });
  return <Modal title={t?'Edit recurring tournament':'Create recurring tournament'} close={close}>
    <form onSubmit={e=>{e.preventDefault();save(f,t)}}>
      <label>Tournament name<input required value={f.name} placeholder="Thursday Night 8-Ball" onChange={e=>setF({...f,name:e.target.value})}/></label>
      <label>Venue<input value={f.venue} placeholder="Cambridge Cossie Club" onChange={e=>setF({...f,venue:e.target.value})}/></label>
      <label>Repeats every<select value={f.day_of_week} onChange={e=>setF({...f,day_of_week:Number(e.target.value)})}>{['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((d,i)=><option key={d} value={i}>{d}</option>)}</select></label>
      <label>Format<select value={f.format} onChange={e=>setF({...f,format:e.target.value})}><option>Knockout</option><option>Round Robin</option><option>Random Draw</option><option>Reverse Cross</option><option>Groups → Knockout</option><option>Singles</option><option>Doubles</option><option>Teams</option><option>Custom</option></select></label>
      <label>Rules<select value={f.rules} onChange={e=>setF({...f,rules:e.target.value})}><option>CNZ Rules</option><option>International Rules</option><option>Custom</option></select></label>
      <label>Default race length<select value={f.default_race_to} onChange={e=>setF({...f,default_race_to:Number(e.target.value)})}>{[1,2,3,5,7,9].map(n=><option key={n} value={n}>Race to {n}</option>)}</select></label>
      <label className="checkLine"><input type="checkbox" checked={f.season_enabled} onChange={e=>setF({...f,season_enabled:e.target.checked})}/> Run this as a season</label>
      {f.season_enabled&&<label>Season length<input type="number" min="1" max="52" value={f.season_length_weeks} onChange={e=>setF({...f,season_length_weeks:Math.max(1,Math.min(52,Number(e.target.value)||1))})}/><small>Choose how many season sessions count toward this season.</small></label>}
      <div className="settingNote"><b>Each session:</b> players, check-ins, draws and results are new. Casual sessions remain in history but do not count toward season standings.</div>
      <div className="ma"><button type="button" onClick={close}>Cancel</button><button className="primary">{t?'Save recurring tournament':'Create recurring tournament'}</button></div>
    </form>
  </Modal>
}

function ResultCorrectionModal({m,close,save,playerName}){
  const [f,setF]=useState({score1:String(m?.score1??''),score2:String(m?.score2??''),winner_balls:m?.winner_balls===null||m?.winner_balls===undefined?'':String(m.winner_balls)});
  const [localError,setLocalError]=useState('');
  if(!m)return null;
  const race=Number(m.race_to)||1;
  const winnerId=Number(f.score1)>Number(f.score2)?m.player1_id:Number(f.score2)>Number(f.score1)?m.player2_id:null;
  const submit=async e=>{e.preventDefault();setLocalError('');const ok=await save(f,m);if(!ok)setLocalError('Please correct the highlighted result and try again.');};
  return <Modal title={`Correct disputed result · Match ${m.match_number}`} close={close}>
    <div className="correctionAlert"><strong>⚠️ Organiser correction</strong><span>The player-submitted result is not official. Correct it here without using the live scoring screen.</span></div>
    <div className="correctionMatch"><strong>{playerName(m.player1_id)} <span>vs</span> {playerName(m.player2_id)}</strong><small>Race to {race}{m.dispute_reason?` · Dispute: ${m.dispute_reason}`:''}</small></div>
    {(localError)&&<div className="formError">{localError}</div>}
    <form onSubmit={submit}>
      <div className="scoreEditGrid">
        <label>{playerName(m.player1_id)}<input type="number" min="0" max={race} step="1" value={f.score1} onChange={e=>setF({...f,score1:e.target.value})}/></label>
        <div className="scoreDash">–</div>
        <label>{playerName(m.player2_id)}<input type="number" min="0" max={race} step="1" value={f.score2} onChange={e=>setF({...f,score2:e.target.value})}/></label>
      </div>
      {race===1&&<label>Winner's balls remaining<select value={f.winner_balls} onChange={e=>setF({...f,winner_balls:e.target.value})}><option value="">Select…</option>{[0,1,2,3,4,5,6,7].map(n=><option key={n} value={n}>{n}</option>)}</select></label>}
      <div className="correctionWinner"><span>Winner</span><strong>{winnerId?playerName(winnerId):'Enter a valid final score'}</strong></div>
      <div className="ma"><button type="button" onClick={close}>Cancel</button><button className="primary" type="submit">Save corrected result &amp; make official</button></div>
    </form>
  </Modal>
}

function TableModal({t,close,save}){const[f,setF]=useState({table_number:t?.table_number||'',table_type:t?.table_type||'Standard',notes:t?.notes||'',is_accessible:!!t?.is_accessible,status:t?.status||'available'});return <Modal title={t?'Edit table':'Add table'} close={close}><form onSubmit={e=>{e.preventDefault();save(f,t)}}><label>Table number<input required type="number" min="1" value={f.table_number} onChange={e=>setF({...f,table_number:e.target.value})}/></label><label>Table type<select value={f.table_type} onChange={e=>setF({...f,table_type:e.target.value})}><option>Standard</option><option>Accessible</option><option>Reserved / Unavailable</option></select></label><label className="check"><input type="checkbox" checked={f.is_accessible} onChange={e=>setF({...f,is_accessible:e.target.checked})}/> Accessible table ♿</label><label>Table notes<textarea value={f.notes} onChange={e=>setF({...f,notes:e.target.value})}/></label><div className="ma"><button type="button" onClick={close}>Cancel</button><button className="primary">Save</button></div></form></Modal>}


const css=`*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;background:#f5f7fa;color:#172033}button,input,select,textarea{font:inherit}button{cursor:pointer;border:1px solid #d8dee8;background:#fff;border-radius:8px;padding:9px 12px}.primary{background:#172033;color:#fff;border-color:#172033}.danger{color:#b42318}.link{border:0;background:none;color:#315fdb}.auth{min-height:100vh;display:grid;place-items:center}.card{background:#fff;padding:36px;border-radius:18px;box-shadow:0 12px 40px #0001;width:min(430px,92vw)}.card form{display:grid;gap:12px}.card input{padding:12px;border:1px solid #ccd3df;border-radius:8px}.error{color:#b42318}header{background:#fff;border-bottom:1px solid #e4e8ef;padding:15px 24px;display:flex;justify-content:space-between;align-items:center}header h1{margin:0;font-size:25px}.layout{display:grid;grid-template-columns:260px 1fr;max-width:1400px;margin:auto;min-height:calc(100vh - 72px)}aside{background:#fff;border-right:1px solid #e4e8ef;padding:15px}.asideTitle{display:flex;flex-direction:column;gap:10px;margin-bottom:10px}.createBtn{width:100%;font-weight:700}aside button{display:block;width:100%;text-align:left;border:0;margin-top:6px}aside small{display:block;color:#758096;margin-top:4px}.sel{background:#eef2ff}.content{padding:22px;max-width:1100px}.hero{background:#fff;border:1px solid #e3e7ee;border-radius:14px;padding:20px;display:flex;justify-content:space-between;margin-bottom:18px}.hero h2{margin:0 0 6px}.hero p{margin:0;color:#6a7587}.heroRight{display:flex;flex-direction:column;align-items:flex-end;gap:12px}.settingsSummary{display:flex;gap:12px;flex-wrap:wrap;margin-top:12px;color:#667085;font-size:13px}.settingsSummary span{background:#f5f7fa;padding:7px 9px;border-radius:7px}.dbTop{display:flex;gap:8px;margin-bottom:10px}.dbTop input{flex:1}.dbList{max-height:55vh;overflow:auto}.settingNote{background:#f5f7fa;border:1px solid #e3e7ee;border-radius:8px;padding:10px;color:#667085;font-size:13px;line-height:1.4}.stats{display:flex;gap:15px;align-items:center;flex-wrap:wrap}.stats b{background:#f5f7fa;padding:10px 12px;border-radius:8px}.panel{background:#fff;border:1px solid #e3e7ee;border-radius:14px;margin-bottom:18px;padding:16px}.ph{display:flex;justify-content:space-between;align-items:center}.ph h3{margin:0}.row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid #edf0f4}.row small{display:block;color:#707b8d;margin-top:4px}.actions{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.qr{border:1px dashed #aab3c2;border-radius:6px;padding:8px;text-align:center;font-size:11px}.qrLarge{display:flex;justify-content:center;align-items:center;padding:8px}.qrLarge img{width:320px;height:320px;max-width:100%;image-rendering:auto}.scoreLink{padding:9px 12px;border:1px solid #d8dee8;border-radius:8px;text-decoration:none;color:#172033;background:#fff}.muted{color:#778194}.drawTools{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}.empty{padding:70px 30px}.notice{margin:14px auto;padding:10px 14px;background:#fff4e5;border:1px solid #ffd7a3;width:94%;border-radius:8px}.notice button{float:right;padding:2px 7px}.backdrop{position:fixed;inset:0;background:#0006;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:18px}.modal{background:#fff;width:min(520px,95vw);max-height:calc(100vh - 36px);overflow-y:auto;border-radius:14px;padding:18px;margin:auto 0}.mh{display:flex;justify-content:space-between;align-items:center}.modal form{display:grid;gap:12px}.modal label{display:grid;gap:5px;font-weight:600}.modal input,.modal select,.modal textarea{padding:10px;border:1px solid #ccd3df;border-radius:8px}.modal textarea{min-height:80px}.check{display:flex!important;align-items:center;gap:8px}.ma{display:flex;justify-content:flex-end;gap:8px}.groupStandingsGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}.groupCard{border:1px solid #e3e7ee;border-radius:10px;overflow:hidden;background:#fff}.groupCardHead{display:flex;justify-content:space-between;gap:8px;padding:10px 12px;background:#f8fafc;border-bottom:1px solid #e3e7ee}.groupCardHead span{font-size:12px;color:#667085}.groupStandingRow{display:grid;grid-template-columns:24px 1fr 34px 42px;gap:6px;align-items:center;padding:8px 12px;border-bottom:1px solid #edf0f4;font-size:13px}.groupStandingRow:last-child{border-bottom:0}.groupStandingRow.qualifier{background:#f7f4ff}.groupStandingRow small{color:#667085;text-align:right}.groupStandingRow span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}@media(max-width:850px){.heroRight{align-items:flex-start;margin-top:15px}.layout{grid-template-columns:1fr}aside{border-right:0;border-bottom:1px solid #e4e8ef}.hero{display:block}.row{flex-direction:column;align-items:flex-start}.actions{width:100%}}
.controlIntro{display:flex;justify-content:space-between;gap:14px;align-items:center;background:#f7f8fb;border:1px solid #e3e7ee;border-radius:12px;padding:13px 15px;margin:10px 0 14px}
.controlIntro strong{display:block}.controlIntro span{display:block;color:#667085;font-size:13px;margin-top:3px}.liveBadge{font-size:11px!important;font-weight:800;color:#087443!important;background:#ecfdf3;border:1px solid #abefc6;border-radius:999px;padding:6px 9px;white-space:nowrap}
.controlSummary{display:flex;gap:10px;align-items:stretch;flex-wrap:wrap;margin:10px 0 18px}
.controlSummary>div{border:1px solid #dfe4ec;border-radius:12px;background:#fafbfc;padding:10px 14px;min-width:118px}
.controlSummary strong{display:block;font-size:22px}.controlSummary span{display:block;color:#667085;font-size:12px;margin-top:3px}
.controlSummary button{align-self:center}.controlSummary button:disabled{opacity:.5;cursor:not-allowed}
.summaryPlaying{border-left:4px solid #f79009!important}.summaryReady{border-left:4px solid #2e90fa!important}
.controlSectionHead{display:flex;justify-content:space-between;align-items:end;border-top:1px solid #edf0f4;padding-top:15px;margin-top:3px}.controlSectionHead h4{margin:0}.controlSectionHead span{color:#667085;font-size:12px}
.readyQueue{margin-top:20px;border-top:1px solid #edf0f4;padding-top:15px}.readyQueue h4,.waitingPanel h4,.resultsPanel h4{margin:0}
.queueHead{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:10px}.queueHead>div span{display:block;color:#667085;font-size:12px;margin-top:4px}
.readyRow{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:12px 10px;border-top:1px solid #edf0f4}
.readyRow:first-of-type{border-top:0}.readyRow span{display:block;color:#667085;margin-top:4px}
.priorityRow{background:#fffaf0;border-radius:10px}.readyInfo>div{display:flex;gap:7px;align-items:center}.waitReason{color:#b54708!important;font-size:12px}
.priorityBadge,.countBadge{font-size:11px;font-weight:800;border-radius:999px;padding:5px 8px;background:#fff4e5;border:1px solid #fedf89;color:#b54708;white-space:nowrap}.priorityBadge.small{display:inline-block!important;margin-top:0!important}
.countBadge{background:#f2f4f7;border-color:#d0d5dd;color:#475467}
.controlScore{display:inline-block;margin-top:10px}
@media(max-width:700px){.readyRow{flex-direction:column;align-items:flex-start}.controlSummary>div{min-width:105px}.controlIntro{align-items:flex-start}}
.controlGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
.controlCard{border:1px solid #dfe4ec;border-radius:14px;padding:16px;background:#fafbfc}.controlCard.isPlaying{box-shadow:0 2px 10px #0000000a}.controlCard.isAccessible{border-left:4px solid #7f56d9}
.controlTop{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.controlMatch{font-size:18px;font-weight:800;margin-bottom:4px}.controlPlayers{line-height:1.4}.scoreLine{color:#667085;font-size:13px;margin-top:6px}.accessNote{font-size:12px;font-weight:700;margin-top:8px}
.controlEmpty{color:#667085;padding:10px 0}.controlEmpty strong{display:block;color:#475467}.controlEmpty small{display:block;margin-top:5px}
.statusPill{font-size:12px;font-weight:800;text-transform:uppercase;border:1px solid #d0d5dd;border-radius:999px;padding:5px 8px}
.statusPill.available{background:#fff}.statusPill.occupied{background:#f5f5f5}.statusPill.unavailable{background:#eee}
.waitingPanel,.resultsPanel{margin-top:20px;border-top:1px solid #edf0f4;padding-top:15px}.waitingList,.resultsList{border:1px solid #e3e7ee;border-radius:12px;overflow:hidden}.waitingItem,.resultItem{display:flex;justify-content:space-between;gap:12px;padding:11px 13px;border-top:1px solid #edf0f4;background:#fff}.waitingItem:first-child,.resultItem:first-child{border-top:0}.waitingItem span,.resultItem span{color:#667085;font-size:13px}.resultItem>div{display:flex;flex-direction:column;gap:3px}.resultScore{text-align:right}.resultScore span{font-size:12px}
.templateIntro{background:#f7f8fb;border:1px solid #e3e7ee;border-radius:10px;padding:12px;margin-bottom:12px}.templateIntro strong,.templateIntro span{display:block}.templateIntro span{color:#667085;font-size:13px;margin-top:4px}.templateCard{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:13px 0;border-top:1px solid #edf0f4}.templateCard>div:first-child strong,.templateCard>div:first-child span,.templateCard>div:first-child small{display:block}.templateCard span,.templateCard small{color:#667085;margin-top:4px}.templateCard small{font-size:12px}.templateCard .actions{justify-content:flex-end}@media(max-width:700px){.templateCard{flex-direction:column;align-items:flex-start}.templateCard .actions{width:100%;justify-content:flex-start}}

.reverseCrossoverPreview{margin:16px 0;border:1px solid #dfe4ec;border-radius:14px;padding:15px;background:#fafbfc}
.previewHeader{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:11px}
.previewHeader strong{display:block}.previewHeader span{display:block;color:#667085;font-size:12px;margin-top:4px}
.previewRule{font-size:11px!important;font-weight:800;color:#475467!important;background:#fff;border:1px solid #d0d5dd;border-radius:999px;padding:5px 8px;white-space:nowrap}
.previewMatches{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
.previewMatch{display:grid;grid-template-columns:25px minmax(0,1fr) 24px minmax(0,1fr);gap:6px;align-items:center;padding:9px;border:1px solid #e4e7ec;border-radius:9px;background:#fff;font-size:13px}
.previewMatch>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.previewMatch b{text-align:center;color:#667085;font-size:11px}.previewMatch em{grid-column:4;font-size:10px;font-style:normal;font-weight:800;color:#b54708}
.previewMatch.hasBye{background:#fffaf0}
.reverseCrossoverPreview>small{display:block;color:#667085;font-size:11px;margin-top:10px}
@media(max-width:650px){.previewMatches{grid-template-columns:1fr}.previewHeader{flex-direction:column}.previewRule{white-space:normal}}

.drawPreviewNote{margin-top:8px;border:1px solid #e4e7ec;border-radius:8px;padding:8px 10px;background:#f8fafc;color:#667085;font-size:12px}.drawPreviewNote strong{color:#344054}

.sessionTypeControl{margin-top:10px;padding:11px 12px;border:1px solid #dfe4ec;border-radius:10px;background:#fafbfc}
.sessionTypeControl label{display:block;font-weight:800;font-size:13px;margin-bottom:5px}
.sessionTypeControl select{width:100%;max-width:430px}
.sessionTypeControl small{display:block;color:#667085;font-size:11px;margin-top:5px;line-height:1.4}


.seasonLengthControl{margin-top:10px;padding:11px 12px;border:1px solid #dfe4ec;border-radius:10px;background:#fafbfc}
.seasonLengthControl label{display:block;font-weight:800;font-size:13px;margin-bottom:5px}
.seasonLengthRow{display:flex;align-items:center;gap:8px}.seasonLengthRow input{width:90px}.seasonLengthRow span{font-size:13px;color:#667085}
.seasonLengthControl small{display:block;color:#667085;font-size:11px;margin-top:5px;line-height:1.4}


.seasonMeta{display:block!important;font-weight:700;margin-top:4px;color:#475467!important}
.sessionBanner{display:inline-flex;flex-wrap:wrap;gap:8px;margin-top:9px;padding:7px 10px;border-radius:9px;background:#f8f9fc;border:1px solid #e1e5ec;font-size:12px}
.sessionBanner span{color:#667085}.checkLine{display:flex!important;flex-direction:row!important;align-items:center;gap:7px}.checkLine input{width:auto!important}
.seasonPanelIntro{padding:10px 12px;border:1px solid #e3e7ee;border-radius:10px;background:#fafbfc}.seasonPanelIntro strong{display:block}.seasonPanelIntro span{display:block;color:#667085;font-size:12px;margin-top:3px}
.seasonSessionList{margin-top:10px;border:1px solid #e3e7ee;border-radius:10px;overflow:hidden}.seasonSession{display:grid;grid-template-columns:90px 1fr auto;gap:10px;align-items:center;padding:9px 11px;border-top:1px solid #edf0f4}.seasonSession:first-child{border-top:0}.seasonSession span{color:#667085;font-size:12px}.seasonSession em{font-style:normal;font-size:11px;color:#667085}.seasonSession.current{background:#f8f9fc}.casualNote{margin-top:10px;padding:9px 11px;border-left:3px solid #b54708;background:#fffaf0;font-size:12px}


.seasonStandingsHead{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:10px 12px;border:1px solid #e3e7ee;border-radius:10px;background:#fafbfc;margin-bottom:10px}
.seasonStandingsHead strong{display:block}.seasonStandingsHead span{display:block;color:#667085;font-size:12px;margin-top:3px}
.standingsTableWrap{overflow-x:auto;border:1px solid #e3e7ee;border-radius:10px}
.standingsTable{width:100%;border-collapse:collapse;font-size:13px}.standingsTable th,.standingsTable td{padding:9px 10px;border-top:1px solid #edf0f4;text-align:left}.standingsTable th{border-top:0;background:#f8f9fc;font-size:11px;color:#667085}.standingsTable tr:first-child td{background:#fbfcff}
@media(max-width:650px){.seasonStandingsHead{align-items:flex-start;flex-direction:column}}

.bracket{display:flex;gap:18px;overflow-x:auto;padding:8px 2px 14px}
.bracketRound{min-width:220px;flex:1}.bracketRound h4{text-align:center;margin:4px 0 12px;font-size:16px}
.bracketMatches{display:flex;flex-direction:column;justify-content:space-around;gap:16px;height:100%}
.bracketMatch{border:1px solid #dfe4ec;border-radius:12px;background:#fff;padding:10px 12px;box-shadow:0 2px 8px #00000008}
.bracketMatch.done{border-color:#b7c9b7}.bracketMatchNo{font-size:11px;color:#667085;margin-bottom:7px}
.bracketMatch>div:not(.bracketMatchNo){display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px solid #eef0f3}
.bracketMatch>div:last-of-type{border-bottom:0}.winnerLine{font-weight:800}.bracketMatch small{display:block;color:#667085;margin-top:7px}
@media(max-width:700px){.bracket{gap:12px}.bracketRound{min-width:200px}}

.playerNameButton{border:0;background:transparent;padding:0;text-align:left;color:#172033}.playerNameButton:hover{text-decoration:underline}
.profileHero{background:#f7f8fb;border:1px solid #e3e7ee;border-radius:14px;padding:16px;margin-bottom:18px}.profileHero h2{margin:0 0 5px}.profileHero p{margin:0;color:#667085}
.profileStats{display:grid;grid-template-columns:repeat(6,minmax(80px,1fr));gap:8px;margin-top:16px}.profileStats>div{background:#fff;border:1px solid #e3e7ee;border-radius:10px;padding:10px;text-align:center}.profileStats b{display:block;font-size:21px}.profileStats span{display:block;color:#667085;font-size:11px;margin-top:3px}
.profileSection{border-top:1px solid #edf0f4;padding-top:15px;margin-top:15px}.profileSection h4{margin:0 0 10px}.profileTable{border:1px solid #e3e7ee;border-radius:10px;overflow:hidden}.profileTableHead,.profileTableRow{display:grid;grid-template-columns:2fr .7fr .7fr .7fr .7fr;gap:8px;padding:10px 12px;align-items:center}.profileTableHead{background:#f7f8fb;font-size:12px;font-weight:800;color:#667085}.profileTableRow{border-top:1px solid #edf0f4}.profileTableRow small{display:block;color:#667085;font-size:11px;margin-top:3px}
.profileMatches{display:grid;gap:7px}.profileMatch{display:flex;justify-content:space-between;gap:15px;align-items:center;border:1px solid #e3e7ee;border-radius:10px;padding:11px 12px}.profileMatch small{display:block;color:#667085;margin-top:3px}.profileMatch strong{font-size:18px;white-space:nowrap}
@media(max-width:700px){.profileStats{grid-template-columns:repeat(3,1fr)}.profileTableHead,.profileTableRow{grid-template-columns:1.7fr .6fr .7fr .7fr .7fr}.profileMatch{align-items:flex-start}}

.byeRow{background:#fafbfc}.byeBadge{display:inline-flex;align-items:center;border:1px solid #d8dee8;border-radius:999px;padding:6px 10px;font-size:11px;font-weight:800;color:#667085}.bracketBye{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px;border:1px dashed #d8dee8;border-radius:8px;background:#fafbfc}.bracketBye span{font-size:10px;font-weight:800;color:#667085}

.tournamentStatusStrip{display:flex;align-items:center;gap:10px;margin-top:10px;padding:9px 11px;border:1px solid #dfe4ec;border-radius:10px;background:#fafbfc;max-width:620px}.tournamentStatusStrip b{display:block;color:#344054}.tournamentStatusStrip small{display:block;color:#667085;margin-top:2px}.phaseDot{width:9px;height:9px;border-radius:50%;background:#12b76a;flex:0 0 auto}.drawLockedNote{margin:10px 0;padding:10px 12px;border:1px solid #d0d5dd;border-radius:9px;background:#f2f4f7;color:#475467;font-size:12px}.drawWarningNote{margin:10px 0;padding:10px 12px;border:1px solid #fedf89;border-radius:9px;background:#fffaf0;color:#7a4b00;font-size:12px}

.brandLockup,.appBrand{display:flex;align-items:center;gap:11px}.brandBall{width:34px;height:34px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:#151d32;color:#fff;font-weight:900;font-size:17px;border:3px solid #eef1f6;box-shadow:0 2px 5px rgba(16,24,40,.16);flex:0 0 auto}.brandLockup b,.appBrand b{font-weight:900;color:#151d32}.brandLockup strong,.appBrand strong{font-weight:900;color:#6f42d9}.brandLockup span:last-child,.appBrand span:last-child{display:flex;flex-direction:column}.brandLockup small{display:block;font-size:8px;letter-spacing:1.6px;color:#667085;font-weight:800;margin-top:2px}.appBrand h1{margin:0;font-size:28px;line-height:1}.appBrand small{display:block;margin-top:5px;color:#667085}.tableAssignBtn{display:block;margin-top:10px;width:100%;padding:8px 10px;border:1px solid #d7c8f4;border-radius:8px;background:#f7f3ff;color:#53319c;font-weight:800;cursor:pointer}.tableAssignBtn:hover{background:#efe8ff}.readyHint{display:block;color:#12b76a;font-weight:700;margin-top:3px}

:root{--pm-purple:#a020f0}.pmBrand{display:flex;align-items:center;gap:10px}.pmMark{width:58px;height:48px;color:#fff;flex:0 0 auto}.pmBrandCompact .pmMark{width:39px;height:33px}.pmWordmark{display:flex;flex-direction:column;line-height:1}.pmWordmark b{font-size:28px;letter-spacing:-.8px;color:#fff;font-weight:900}.pmWordmark strong{font-size:28px;letter-spacing:-.8px;color:var(--pm-purple);font-weight:900}.pmWordmark small{font-size:7px;letter-spacing:1.45px;color:#98a2b3;font-weight:800;margin-top:5px}.appBrand{display:flex;align-items:center;gap:9px}.appBrand h1{margin:0;font-size:20px;letter-spacing:-.4px}.appBrand small{display:block;margin-top:4px;color:#667085}.authBrand{display:flex;flex-direction:column;align-items:center;gap:7px;background:transparent}.authBrandTag{font-size:8px;letter-spacing:1.3px;color:#667085;font-weight:800}.controlBrandHeader{display:flex;align-items:center;gap:10px;margin-bottom:12px}.controlBrandHeader strong{font-size:18px}.controlBrandHeader small{display:block;color:#667085;margin-top:2px}

.authBrandBox{background:#0b0d14;border-radius:14px;padding:18px 16px 15px;margin:-4px -4px 16px;text-align:center}.authBrandBox .pmBrand{justify-content:center}.authBrandBox .pmWordmark b,.authBrandBox .pmWordmark strong{font-size:30px}.authBrandTag{font-size:8px;letter-spacing:1.35px;color:#aeb6c6;font-weight:800;margin-top:7px}
.nextUpPanel{margin-top:18px;border:1px solid #dfe4ec;border-radius:14px;background:#fff;overflow:hidden}.nextUpPanel .queueHead{padding:13px 15px;background:#f7f8fb;border-bottom:1px solid #e7eaf0}.nextUpGrid{display:grid;gap:0}.nextCard{display:grid;grid-template-columns:42px minmax(0,1fr) auto;gap:12px;align-items:center;padding:13px 15px;border-top:1px solid #edf0f4}.nextCard:first-child{border-top:0}.nextCard.priorityRow{background:#fffaf0}.nextNumber{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:#f2f4f7;color:#344054;font-weight:900}.nextDetails{display:grid;gap:2px;min-width:0}.nextDetails strong{font-size:14px}.nextDetails span{font-weight:700;color:#344054;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.nextDetails small{color:#667085}.nextAssign{white-space:nowrap}.nextWaiting{font-size:12px;color:#b54708;font-weight:700}.nextEmpty{padding:17px 15px;color:#667085}.controlCard{min-height:170px}.controlCard.isPlaying{box-shadow:0 0 0 2px #d7c8f4 inset}.controlScore{display:inline-block;margin-top:10px}
@media(max-width:800px){.nextCard{grid-template-columns:34px minmax(0,1fr)}.nextAssign,.nextWaiting{grid-column:2;justify-self:start}.nextAssign{width:100%}}

.commandProgress{margin-top:12px;padding:13px 15px;border:1px solid #e1e6ee;border-radius:12px;background:#fff}.commandProgressTop{display:flex;justify-content:space-between;align-items:end;gap:12px}.commandProgressTop div{display:grid;gap:2px}.commandProgressTop span{font-size:12px;color:#667085}.progressTrack{height:7px;border-radius:99px;background:#edf0f4;overflow:hidden;margin-top:9px}.progressFill{height:100%;border-radius:99px;background:var(--pm-purple);transition:width .3s ease}.attentionPanel{margin-top:12px;border:1px solid #f2d29a;border-radius:12px;background:#fffaf0;overflow:hidden}.attentionTitle{font-weight:900;padding:11px 14px;border-bottom:1px solid #f2d29a}.attentionItem{display:flex;justify-content:space-between;gap:15px;padding:9px 14px;border-top:1px solid #f7e3be;font-size:12px}.attentionItem:first-of-type{border-top:0}.attentionItem strong{color:#7a4b00}.attentionItem span{color:#8a5a10;text-align:right}.resultReviewItem{align-items:center}.resultReviewItem>div:first-child{display:grid;gap:3px;min-width:0}.reviewActions{display:flex;gap:6px;flex-wrap:wrap}.resultPendingNote{color:#7a4b00}.resultDisputedNote{color:#b42318}@media(max-width:800px){.resultReviewItem{display:grid}.reviewActions{justify-content:flex-start}}.controlTablesSubhead{margin-top:13px}.controlTablesSubhead h4{margin-bottom:0}
@media(max-width:800px){.attentionItem{display:grid;gap:3px}.attentionItem span{text-align:left}.commandProgressTop{align-items:center}}
.playerEntry{margin-top:16px;padding-top:14px;border-top:1px solid #edf0f4;display:grid;gap:4px;text-align:center;font-size:12px;color:#667085}.playerEntry a{color:#6f2dbd;font-weight:800;text-decoration:none}
.correctionAlert{padding:11px 12px;border:1px solid #f2d29a;border-radius:10px;background:#fffaf0;color:#7a4b00;display:grid;gap:3px;margin-bottom:12px}.correctionAlert span{font-size:12px;color:#8a5a10}.correctionMatch{padding:12px;border:1px solid #e3e7ee;border-radius:10px;background:#f8f9fc;text-align:center;margin-bottom:12px}.correctionMatch strong{display:block;font-size:18px}.correctionMatch strong span{color:#667085;padding:0 5px}.correctionMatch small{display:block;color:#667085;margin-top:4px}.formError{padding:10px 12px;border:1px solid #f3b4b4;border-radius:9px;background:#fff1f1;color:#b42318;font-weight:700;margin-bottom:12px}.scoreEditGrid{display:grid;grid-template-columns:1fr 34px 1fr;gap:8px;align-items:end}.scoreEditGrid label{margin:0}.scoreDash{text-align:center;font-size:24px;font-weight:900;padding-bottom:9px}.correctionWinner{margin-top:10px;padding:10px 12px;border-radius:9px;background:#f7f3ff;border:1px solid #d7c8f4}.correctionWinner span{display:block;color:#667085;font-size:11px}.correctionWinner strong{display:block;color:#53319c;margin-top:3px}.reviewActions button{white-space:nowrap}@media(max-width:600px){.scoreEditGrid{grid-template-columns:1fr 24px 1fr}.scoreEditGrid input{font-size:18px}}
`;
