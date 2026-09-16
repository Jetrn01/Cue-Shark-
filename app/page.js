'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

function Modal({title, children, close}) {
  return <div className="backdrop"><div className="modal">
    <div className="mh"><h3>{title}</h3><button onClick={close}>✕</button></div>{children}
  </div></div>
}

export default function Home() {
  const [session,setSession]=useState(null), [mode,setMode]=useState('login');
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[authMsg,setAuthMsg]=useState('');
  const [competitions,setCompetitions]=useState([]),[selected,setSelected]=useState(null);
  const [players,setPlayers]=useState([]),[tables,setTables]=useState([]),[matches,setMatches]=useState([]);
  const [modal,setModal]=useState(null),[msg,setMsg]=useState('');
  const [drawSettings,setDrawSettings]=useState({type:'Knockout',race_to:3});
  const [qrData,setQrData]=useState(null);
  const [playerDB,setPlayerDB]=useState([]);

  useEffect(()=>{supabase.auth.getSession().then(({data})=>setSession(data.session));
    const {data:s}=supabase.auth.onAuthStateChange((_e,x)=>setSession(x)); return()=>s.subscription.unsubscribe()},[]);
  useEffect(()=>{if(session) loadCompetitions()},[session]);
  useEffect(()=>{if(session) loadPlayerDB()},[session]);

  useEffect(()=>{
    if(!session || !selected) return;
    const timer=setInterval(()=>load(selected),5000);
    return()=>clearInterval(timer);
  },[session,selected]);

  async function loadPlayerDB(){const {data,error}=await supabase.from('players').select('id,first_name,last_name,display_name,phone,email,club_name,requires_accessible_table').order('display_name',{ascending:true});if(error)setMsg(error.message);else setPlayerDB(data||[])}

  async function loadCompetitions(){const {data,error}=await supabase.from('competitions').select('*').order('start_date',{ascending:true}); if(error)setMsg(error.message);else setCompetitions(data||[])}
  async function load(c){setSelected(c);
    const [p,m,t]=await Promise.all([
      supabase.from('competition_players').select('id,player_id,checked_in,players(id,first_name,last_name,display_name,phone,email,club_name,requires_accessible_table)').eq('competition_id',c.id),
      supabase.from('competition_matches').select('*').eq('competition_id',c.id).order('match_number'),
      supabase.from('tournament_tables').select('*').eq('competition_id',c.id).order('table_number')
    ]); setPlayers(p.data||[]);setMatches(m.data||[]);setTables(t.data||[])}

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
  async function savePlayer(f){let error;
    const data={first_name:f.first_name.trim(),last_name:f.last_name.trim(),display_name:`${f.first_name.trim()} ${f.last_name.trim()}`.trim(),phone:f.phone.trim(),email:f.email.trim(),club_name:f.club_name.trim(),requires_accessible_table:!!f.requires_accessible_table};
    if(f.playerId) ({error}=await supabase.from('players').update(data).eq('id',f.playerId));
    else {const r=await supabase.from('players').insert(data).select().single();error=r.error;if(!error)({error}=await supabase.from('competition_players').insert({competition_id:selected.id,player_id:r.data.id,checked_in:false}))}
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
    const data={first_name:f.first_name.trim(),last_name:f.last_name.trim(),display_name:`${f.first_name.trim()} ${f.last_name.trim()}`.trim(),phone:f.phone.trim(),email:f.email.trim(),club_name:f.club_name.trim(),requires_accessible_table:!!f.requires_accessible_table};
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
    if(old)r=await supabase.from('tournament_tables').update(data).eq('id',old.id);else r=await supabase.from('tournament_tables').insert({...data,competition_id:selected.id});
    if(r.error)setMsg(r.error.message);else{setModal(null);load(selected)}
  }
  async function delTable(t){if(!confirm(`Delete Table ${t.table_number}?`))return;const r=await supabase.from('tournament_tables').delete().eq('id',t.id);if(r.error)setMsg(r.error.message);else load(selected)}
  async function assign(m,id){
    if(id){
      const t=tables.find(x=>x.id===id);
      const needsAccessible=[m.player1_id,m.player2_id].some(pid=>players.find(x=>x.player_id===pid)?.players?.requires_accessible_table);
      if(needsAccessible && !t?.is_accessible){setMsg('This match includes a player who requires an accessible table. Please assign an accessible table.');return;}
    }
    const previous=m.table_id;
    if(previous===id)return;
    if(previous)await supabase.from('tournament_tables').update({status:'available'}).eq('id',previous);
    if(id)await supabase.from('tournament_tables').update({status:'occupied'}).eq('id',id);
    const r=await supabase.from('competition_matches').update({table_id:id||null}).eq('id',m.id);
    if(r.error)setMsg(r.error.message);else load(selected)
  }

  async function quickAssign(m,t){
    if(!m || !t || t.status==='unavailable' || m.status!=='scheduled') return;
    const needsAccessible=[m.player1_id,m.player2_id].some(pid=>players.find(x=>x.player_id===pid)?.players?.requires_accessible_table);
    if(needsAccessible && !t.is_accessible){setMsg(`Match ${m.match_number} requires an accessible table.`);return;}
    await assign(m,t.id);
    setMsg(`Match ${m.match_number} assigned to Table ${t.table_number}.`);
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
        if(target.player1_id && target.player2_id){
          target.status='scheduled';
          continue;
        }

        const sole=target.player1_id || target.player2_id;
        if(!sole) continue;

        const missingSlot=target.player1_id ? 2 : 1;
        const paddingFeeder=byRound[r].find(
          feeder=>feeder.next_match_id===target.id &&
                   feeder.next_slot===missingSlot &&
                   feeder.status==='waiting' &&
                   !feeder.player1_id &&
                   !feeder.player2_id
        );

        if(paddingFeeder){
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
    // Propagate any first-round byes into their next-round slots.
    for(let r=0;r<roundLists.length-1;r++){
      for(const feeder of roundLists[r]){
        if(feeder.status==='bye' && feeder.winner_id && feeder.next_match_id){
          const target=all.find(x=>x.id===feeder.next_match_id);
          if(target){
            if(feeder.next_slot===1)target.player1_id=feeder.winner_id;
            else target.player2_id=feeder.winner_id;
          }
        }
      }
      for(const m of roundLists[r+1]){
        if(m.player1_id && m.player2_id)m.status='scheduled';
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
    if(m.status==='scheduled') return 'Ready to play';
    if(m.status==='in_progress' || m.status==='active') return 'Playing';
    if(m.status==='bye') return 'Bye';
    return 'Waiting';
  }

  function roundName(round,totalRounds){
    if(round===totalRounds) return 'Final';
    if(round===totalRounds-1) return 'Semi-Finals';
    if(round===totalRounds-2) return 'Quarter-Finals';
    return `Round ${round}`;
  }

  function KnockoutBracket({matches,playerName}){
    const maxRound=Math.max(...matches.map(m=>Number(m.round_number)||1));
    const rounds=[];
    for(let r=1;r<=maxRound;r++) rounds.push(matches.filter(m=>Number(m.round_number)===r).sort((a,b)=>a.match_number-b.match_number));
    return <div className="bracket">
      {rounds.map((round,i)=><div className="bracketRound" key={i}>
        <h4>{roundName(i+1,maxRound)}</h4>
        <div className="bracketMatches">
          {round.map(m=><div className={`bracketMatch ${m.status==='completed'?'done':''}`} key={m.id}>
            <div className="bracketMatchNo">Match {m.match_number}</div>
            <div className={m.winner_id===m.player1_id?'winnerLine':''}>{playerName(m.player1_id)} <b>{m.status==='completed'?m.score1:''}</b></div>
            <div className={m.winner_id===m.player2_id?'winnerLine':''}>{playerName(m.player2_id)} <b>{m.status==='completed'?m.score2:''}</b></div>
            <small>{matchStatusLabel(m)}{m.status==='completed' && m.winner_id ? ` · ${playerName(m.winner_id)} advances` : ''}</small>
          </div>)}
        </div>
      </div>)}
    </div>
  }

  function TournamentControl({tables,matches,playerName}){
    const activeMatches=matches.filter(m=>m.table_id && m.status!=='completed');
    const ready=matches.filter(m=>m.status==='scheduled' && !m.table_id);
    const available=tables.filter(t=>t.status==='available');
    const eligibleAvailable=(m)=>available.filter(t=>{const needs=[m.player1_id,m.player2_id].some(pid=>players.find(x=>x.player_id===pid)?.players?.requires_accessible_table);return !needs || t.is_accessible;});
    return <div>
      <div className="controlSummary">
        <div><strong>{activeMatches.length}</strong><span>Playing / assigned</span></div>
        <div><strong>{ready.length}</strong><span>Ready to play</span></div>
        <div><strong>{available.length}</strong><span>Available tables</span></div>
        <button onClick={()=>load(selected)}>↻ Refresh now</button>
        <button className="primary" onClick={assignNextReady}>⚡ Assign next ready</button>
      </div>

      <div className="controlGrid">
        {tables.length===0 ? <p className="muted">Add tables to see tournament control.</p> :
          tables.map(t=>{
            const active=matches.find(m=>m.table_id===t.id && m.status!=='completed');
            return <div className="controlCard" key={t.id}>
              <div className="controlTop">
                <strong>Table {t.table_number}{t.is_accessible?' ♿':''}</strong>
                <span className={`statusPill ${active?'occupied':(t.status||'available')}`}>{active ? matchStatusLabel(active) : (t.status||'available')}</span>
              </div>
              {active ? <div>
                <div className="controlMatch">Match {active.match_number}</div>
                <div>{playerName(active.player1_id)} <b>vs</b> {playerName(active.player2_id)}</div>
                <small>Race to {active.race_to} · Score {active.score1??0}–{active.score2??0}{[active.player1_id,active.player2_id].some(pid=>players.find(x=>x.player_id===pid)?.players?.requires_accessible_table)?' · ♿ Accessible table required':''}</small>
                <a className="scoreLink controlScore" href={`/score/${t.table_token||t.id}`} target="_blank" rel="noreferrer">📱 Open scoring</a>
              </div> :
              <div className="controlEmpty">{t.status==='unavailable'?'Unavailable':'No match assigned'}</div>}
            </div>
          })
        }
      </div>

      {ready.length>0 && <div className="readyQueue">
        <h4>Ready to play</h4>
        {ready.map(m=><div className="readyRow" key={m.id}>
          <div><strong>Match {m.match_number}</strong><span>{playerName(m.player1_id)} vs {playerName(m.player2_id)} · Race to {m.race_to}</span></div>
          <div className="actions">
            {eligibleAvailable(m)[0] && <button onClick={()=>quickAssign(m,eligibleAvailable(m)[0])}>Assign Table {eligibleAvailable(m)[0].table_number}{eligibleAvailable(m)[0].is_accessible?' ♿':''}</button>}
            <select defaultValue="" onChange={e=>{if(e.target.value){const t=tables.find(x=>x.id===e.target.value);quickAssign(m,t)}}}>
              <option value="">Choose table…</option>
              {eligibleAvailable(m).map(t=><option key={t.id} value={t.id}>Table {t.table_number}{t.is_accessible?' ♿':''}</option>)}
            </select>
          </div>
        </div>)}
      </div>}
    </div>
  }


  if(!session)return <><style>{css}</style><main className="auth"><div className="card"><h1>🎱 PottersMate</h1><p>Competition management for cue-sport clubs.</p><form onSubmit={auth}><input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required/><input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required/><button className="primary">{mode==='login'?'Log in':'Create organiser account'}</button></form>{authMsg&&<p className="error">{authMsg}</p>}<button className="link" onClick={()=>setMode(mode==='login'?'signup':'login')}>{mode==='login'?'Need an organiser account?':'Already have an account? Log in'}</button></div></main></>;

  const checked=players.filter(p=>p.checked_in).length;
  return <><style>{css}</style><header><div><h1>🎱 PottersMate</h1><small>Organiser Dashboard</small></div><button onClick={()=>supabase.auth.signOut()}>Log out</button></header>
  {msg&&<div className="notice">{msg}<button onClick={()=>setMsg('')}>✕</button></div>}
  <div className="layout"><aside><div className="asideTitle"><b>Competitions</b><button className="primary createBtn" onClick={()=>{setSelected(null);setModal({type:'competition',c:null})}}>＋ Create competition</button><button onClick={()=>setModal({type:'playerdb'})}>👥 Player database</button></div>{competitions.map(c=><button className={selected?.id===c.id?'sel':''} key={c.id} onClick={()=>load(c)}>{c.name}<small>{c.start_date||'Date TBC'} · {c.venue||''}</small></button>)}</aside>
  {!selected?<section className="empty"><h2>Select a competition</h2><p>Manage players, tables and match assignments.</p></section>:
  <section className="content"><div className="hero"><div><h2>{selected.name}</h2><p>{selected.venue} · {selected.start_date||'Date TBC'}</p><div className="settingsSummary"><span><b>Format:</b> {selected.format||'Not set'}</span><span><b>Rules:</b> {selected.rules||'Not set'}</span><span><b>Default race:</b> Race to {selected.default_race_to||3}</span></div></div><div className="heroRight"><button className="primary" onClick={()=>setModal({type:'competition',c:selected})}>⚙️ Edit competition</button><button className="danger" onClick={deleteCompetition}>🗑️ Delete competition</button><div className="stats"><b>{players.length} players</b><b>{checked} checked in</b><b>{tables.length} tables</b></div></div></div>

  <Panel title="Players" add={()=>setModal({type:'player'})} addText="＋ Add player">
    <div className="drawTools"><button onClick={()=>setModal({type:'playerdb'})}>👥 Add from player database</button></div>
    {players.map(p=><div className="row" key={p.id}><div><b>{p.players?.display_name || `${p.players?.first_name||''} ${p.players?.last_name||''}`.trim() || 'Unnamed Player'}</b><small>{p.players?.club_name||'No club'}{p.players?.phone?` · ${p.players.phone}`:''}{p.players?.requires_accessible_table?' · ♿ Accessible table required':''}</small></div><div className="actions"><button onClick={()=>setModal({type:'player',p})}>✏️ Edit</button><button onClick={()=>checkin(p)}>{p.checked_in?'✓ Checked in':'Check in'}</button><button className="danger" onClick={()=>removePlayer(p)}>🗑️ Remove</button></div></div>)}
  </Panel>

  <Panel title="Tables" add={()=>setModal({type:'table'})} addText="＋ Add table">
    {tables.length===0&&<p className="muted">No tables added yet.</p>}
    {tables.map(t=><div className="row" key={t.id}><div><b>Table {t.table_number} {t.is_accessible?'♿':''}</b><small>{t.table_type||'Standard'} · {t.status||'available'}{t.notes?` · ${t.notes}`:''}</small></div><div className="actions"><select value={t.status||'available'} onChange={e=>saveTable({...t,status:e.target.value},t)}><option value="available">Available</option><option value="occupied">Occupied</option><option value="unavailable">Unavailable</option></select><button onClick={()=>setModal({type:'table',t})}>✏️ Edit</button><a className="scoreLink" href={`/score/${t.table_token||t.id}`} target="_blank" rel="noreferrer">📱 Scoring</a><button onClick={()=>showQR(t)}>▦ QR Code</button><button className="danger" onClick={()=>delTable(t)}>🗑️ Delete</button></div></div>)}
  </Panel>

  <Panel title="Matches & Table Assignment">
    <div className="drawTools">
      <button className="primary" onClick={()=>setModal({type:'draw'})}>🎱 {matches.length?'Edit / Regenerate Draw':'Create Draw'}</button>
      {matches.length===0&&<p className="muted">No matches created yet.</p>}
    </div>
    {matches.map(m=><div className="row" key={m.id}>
      <div><b>Match {m.match_number} · Round {m.round_number}</b><small>
        {playerName(m.player1_id)} vs {playerName(m.player2_id)} · Race to {m.race_to} · {m.status}
        {m.status==='completed' && <> · <strong>Result: {m.score1 ?? 0} – {m.score2 ?? 0}</strong>{m.winner_id ? <> · Winner: {playerName(m.winner_id)}</> : null}{Number(m.race_to)===1 && m.winner_balls !== null && m.winner_balls !== undefined ? <> · {m.winner_balls} balls remaining</> : null}</>}
        {m.status==='bye' && m.winner_id && <> · <strong>Bye: {playerName(m.winner_id)} advances</strong></>}
      </small></div>
      <select value={m.table_id||''} onChange={e=>assign(m,e.target.value)} disabled={m.status==='completed'}><option value="">Unassigned</option>{tables.filter(t=>{if(t.status==='unavailable')return false;const needs=[m.player1_id,m.player2_id].some(pid=>players.find(x=>x.player_id===pid)?.players?.requires_accessible_table);return !needs || t.is_accessible;}).map(t=><option key={t.id} value={t.id}>Table {t.table_number}{t.is_accessible?' ♿':''}</option>)}</select>
    </div>)}
  </Panel>
  {matches.length>0 && <Panel title="Tournament Control">
    <TournamentControl tables={tables} matches={matches} playerName={playerName}/>
  </Panel>}
  {matches.length>0 && (selected.format||'').toLowerCase()==='knockout' && <Panel title="Knockout Bracket">
    <p className="muted">Winners advance automatically when their match is completed.</p>
    <KnockoutBracket matches={matches} playerName={playerName}/>
  </Panel>}
  </section>}</div>
  {qrData&&<QRModal data={qrData} close={()=>setQrData(null)}/>}
  {modal?.type==='playerdb'&&<PlayerDatabaseModal players={playerDB} currentPlayers={players} close={()=>setModal(null)} add={addExistingPlayerToCompetition} edit={(p)=>setModal({type:'masterPlayer',p})} deletePlayer={deleteMasterPlayer} newPlayer={()=>setModal({type:'masterPlayer',p:null})}/>}
  {modal?.type==='draw'&&<DrawModal selected={selected} players={players} settings={drawSettings} setSettings={setDrawSettings} close={()=>setModal(null)} generate={generateDraw}/>}
  {modal?.type==='masterPlayer'&&<MasterPlayerModal p={modal.p} allowAdd={!!selected} close={()=>setModal(null)} save={saveMasterPlayer}/>}
  {modal?.type==='player'&&<PlayerModal p={modal.p} close={()=>setModal(null)} save={savePlayer}/>}
  {modal?.type==='table'&&<TableModal t={modal.t} close={()=>setModal(null)} save={saveTable}/>}
  {modal?.type==='competition'&&<CompetitionModal c={modal.c} close={()=>setModal(null)} save={saveCompetition}/>}
  </>;
}

function Panel({title,add,addText,children}){return <div className="panel"><div className="ph"><h3>{title}</h3>{add&&<button className="primary" onClick={add}>{addText}</button>}</div>{children}</div>}
function DrawModal({selected,players,settings,setSettings,close,generate}){
  const checked=players.filter(p=>p.checked_in).length;
  return <Modal title="Draw Builder" close={close}>
    <p className="muted"><b>{checked}</b> checked-in players.</p>
    <label>Draw type<select value={settings.type} onChange={e=>setSettings({...settings,type:e.target.value})}>
      <option>Knockout</option><option>Round Robin</option><option>Random Draw</option><option>Seeded Draw</option>
    </select></label>
    <label>Race length<select value={settings.race_to} onChange={e=>setSettings({...settings,race_to:Number(e.target.value)})}>
      {[1,2,3,5,7,9].map(n=><option key={n} value={n}>Race to {n}</option>)}
    </select></label>
    <div className="settingNote">
      {settings.type==='Knockout'&&'Winners automatically progress through later rounds.'}
      {settings.type==='Round Robin'&&'Every checked-in player plays every other player once.'}
      {settings.type==='Random Draw'&&'Players are shuffled before the knockout draw.'}
      {settings.type==='Seeded Draw'&&'Players stay in their current checked-in order as the seed order.'}
    </div>
    <div className="ma"><button type="button" onClick={close}>Cancel</button><button className="primary" disabled={checked<2} onClick={()=>generate(settings)}>Generate Draw</button></div>
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

function PlayerDatabaseModal({players,currentPlayers,close,add,edit,deletePlayer,newPlayer}){
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
        <div className="actions"><button onClick={()=>edit(p)}>✏️ Edit</button>{current.has(p.id)?<button disabled>✓ In competition</button>:<button className="primary" onClick={()=>add(p)}>＋ Add</button>}<button className="danger" onClick={()=>deletePlayer(p)}>🗑️ Delete</button></div>
      </div>)}
    </div>
  </Modal>
}

function PlayerModal({p,close,save}){const x=p?.players||{};const[f,setF]=useState({playerId:x.id||'',first_name:x.first_name||'',last_name:x.last_name||'',phone:x.phone||'',email:x.email||'',club_name:x.club_name||''});return <Modal title={p?'Edit player':'Add player'} close={close}><form onSubmit={e=>{e.preventDefault();save(f)}}><label>First name<input required value={f.first_name} onChange={e=>setF({...f,first_name:e.target.value})}/></label><label>Last name<input required value={f.last_name} onChange={e=>setF({...f,last_name:e.target.value})}/></label><label>Phone<input value={f.phone} onChange={e=>setF({...f,phone:e.target.value})}/></label><label>Email<input type="email" value={f.email} onChange={e=>setF({...f,email:e.target.value})}/></label><label>Club<input value={f.club_name} onChange={e=>setF({...f,club_name:e.target.value})}/></label><label className="check"><input type="checkbox" checked={f.requires_accessible_table} onChange={e=>setF({...f,requires_accessible_table:e.target.checked})}/> Requires accessible table ♿</label><div className="ma"><button type="button" onClick={close}>Cancel</button><button className="primary">Save changes</button></div></form></Modal>}
function MasterPlayerModal({p,close,save,allowAdd}){
  const[f,setF]=useState({playerId:p?.id||'',first_name:p?.first_name||'',last_name:p?.last_name||'',phone:p?.phone||'',email:p?.email||'',club_name:p?.club_name||'',requires_accessible_table:!!p?.requires_accessible_table,addToCompetition:false});
  return <Modal title={p?'Edit player':'New player'} close={close}>
    <form onSubmit={e=>{e.preventDefault();save(f)}}>
      <label>First name<input required value={f.first_name} onChange={e=>setF({...f,first_name:e.target.value})}/></label>
      <label>Last name<input required value={f.last_name} onChange={e=>setF({...f,last_name:e.target.value})}/></label>
      <label>Phone<input value={f.phone} onChange={e=>setF({...f,phone:e.target.value})}/></label>
      <label>Email<input type="email" value={f.email} onChange={e=>setF({...f,email:e.target.value})}/></label>
      <label>Club<input value={f.club_name} onChange={e=>setF({...f,club_name:e.target.value})}/></label>
       <label className="check"><input type="checkbox" checked={f.requires_accessible_table} onChange={e=>setF({...f,requires_accessible_table:e.target.checked})}/> Requires accessible table ♿</label>
      {allowAdd&&<label className="check"><input type="checkbox" checked={f.addToCompetition} onChange={e=>setF({...f,addToCompetition:e.target.checked})}/> Add to current competition</label>}
      <div className="ma"><button type="button" onClick={close}>Cancel</button><button className="primary">{p?'Save player':'Create player'}</button></div>
    </form>
  </Modal>
}

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
        <option>Singles</option><option>Knockout</option><option>Round Robin</option><option>Random Draw</option><option>Seeded Draw</option><option>Doubles</option><option>Teams</option><option>Custom</option>
      </select></label>
      <label>Rules<select value={f.rules} onChange={e=>setF({...f,rules:e.target.value})}><option>CNZ Rules</option><option>International Rules</option><option>Custom</option></select></label>
      <label>Default race length<select value={f.default_race_to} onChange={e=>setF({...f,default_race_to:Number(e.target.value)})}>{[1,2,3,5,7,9].map(n=><option key={n} value={n}>Race to {n}</option>)}</select></label>
      <label>Status<select value={f.status} onChange={e=>setF({...f,status:e.target.value})}><option value="active">Active</option><option value="draft">Draft</option><option value="completed">Completed</option></select></label>
      <div className="settingNote"><b>Race length note:</b> changing this setting changes the default for future matches. Existing match race lengths are not changed automatically.</div>
      <div className="ma"><button type="button" onClick={close}>Cancel</button><button className="primary">{isNew?'Create competition':'Save competition'}</button></div>
    </form>
  </Modal>
}

function TableModal({t,close,save}){const[f,setF]=useState({table_number:t?.table_number||'',table_type:t?.table_type||'Standard',notes:t?.notes||'',is_accessible:!!t?.is_accessible,status:t?.status||'available'});return <Modal title={t?'Edit table':'Add table'} close={close}><form onSubmit={e=>{e.preventDefault();save(f,t)}}><label>Table number<input required type="number" min="1" value={f.table_number} onChange={e=>setF({...f,table_number:e.target.value})}/></label><label>Table type<select value={f.table_type} onChange={e=>setF({...f,table_type:e.target.value})}><option>Standard</option><option>Accessible</option><option>Reserved / Unavailable</option></select></label><label className="check"><input type="checkbox" checked={f.is_accessible} onChange={e=>setF({...f,is_accessible:e.target.checked})}/> Accessible table ♿</label><label>Table notes<textarea value={f.notes} onChange={e=>setF({...f,notes:e.target.value})}/></label><div className="ma"><button type="button" onClick={close}>Cancel</button><button className="primary">Save</button></div></form></Modal>}

const css=`*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;background:#f5f7fa;color:#172033}button,input,select,textarea{font:inherit}button{cursor:pointer;border:1px solid #d8dee8;background:#fff;border-radius:8px;padding:9px 12px}.primary{background:#172033;color:#fff;border-color:#172033}.danger{color:#b42318}.link{border:0;background:none;color:#315fdb}.auth{min-height:100vh;display:grid;place-items:center}.card{background:#fff;padding:36px;border-radius:18px;box-shadow:0 12px 40px #0001;width:min(430px,92vw)}.card form{display:grid;gap:12px}.card input{padding:12px;border:1px solid #ccd3df;border-radius:8px}.error{color:#b42318}header{background:#fff;border-bottom:1px solid #e4e8ef;padding:15px 24px;display:flex;justify-content:space-between;align-items:center}header h1{margin:0;font-size:25px}.layout{display:grid;grid-template-columns:260px 1fr;max-width:1400px;margin:auto;min-height:calc(100vh - 72px)}aside{background:#fff;border-right:1px solid #e4e8ef;padding:15px}.asideTitle{display:flex;flex-direction:column;gap:10px;margin-bottom:10px}.createBtn{width:100%;font-weight:700}aside button{display:block;width:100%;text-align:left;border:0;margin-top:6px}aside small{display:block;color:#758096;margin-top:4px}.sel{background:#eef2ff}.content{padding:22px;max-width:1100px}.hero{background:#fff;border:1px solid #e3e7ee;border-radius:14px;padding:20px;display:flex;justify-content:space-between;margin-bottom:18px}.hero h2{margin:0 0 6px}.hero p{margin:0;color:#6a7587}.heroRight{display:flex;flex-direction:column;align-items:flex-end;gap:12px}.settingsSummary{display:flex;gap:12px;flex-wrap:wrap;margin-top:12px;color:#667085;font-size:13px}.settingsSummary span{background:#f5f7fa;padding:7px 9px;border-radius:7px}.dbTop{display:flex;gap:8px;margin-bottom:10px}.dbTop input{flex:1}.dbList{max-height:55vh;overflow:auto}.settingNote{background:#f5f7fa;border:1px solid #e3e7ee;border-radius:8px;padding:10px;color:#667085;font-size:13px;line-height:1.4}.stats{display:flex;gap:15px;align-items:center;flex-wrap:wrap}.stats b{background:#f5f7fa;padding:10px 12px;border-radius:8px}.panel{background:#fff;border:1px solid #e3e7ee;border-radius:14px;margin-bottom:18px;padding:16px}.ph{display:flex;justify-content:space-between;align-items:center}.ph h3{margin:0}.row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid #edf0f4}.row small{display:block;color:#707b8d;margin-top:4px}.actions{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.qr{border:1px dashed #aab3c2;border-radius:6px;padding:8px;text-align:center;font-size:11px}.qrLarge{display:flex;justify-content:center;align-items:center;padding:8px}.qrLarge img{width:320px;height:320px;max-width:100%;image-rendering:auto}.scoreLink{padding:9px 12px;border:1px solid #d8dee8;border-radius:8px;text-decoration:none;color:#172033;background:#fff}.muted{color:#778194}.drawTools{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}.empty{padding:70px 30px}.notice{margin:14px auto;padding:10px 14px;background:#fff4e5;border:1px solid #ffd7a3;width:94%;border-radius:8px}.notice button{float:right;padding:2px 7px}.backdrop{position:fixed;inset:0;background:#0006;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:18px}.modal{background:#fff;width:min(520px,95vw);max-height:calc(100vh - 36px);overflow-y:auto;border-radius:14px;padding:18px;margin:auto 0}.mh{display:flex;justify-content:space-between;align-items:center}.modal form{display:grid;gap:12px}.modal label{display:grid;gap:5px;font-weight:600}.modal input,.modal select,.modal textarea{padding:10px;border:1px solid #ccd3df;border-radius:8px}.modal textarea{min-height:80px}.check{display:flex!important;align-items:center;gap:8px}.ma{display:flex;justify-content:flex-end;gap:8px}@media(max-width:850px){.heroRight{align-items:flex-start;margin-top:15px}.layout{grid-template-columns:1fr}aside{border-right:0;border-bottom:1px solid #e4e8ef}.hero{display:block}.row{flex-direction:column;align-items:flex-start}.actions{width:100%}}
.controlSummary{display:flex;gap:10px;align-items:stretch;flex-wrap:wrap;margin:10px 0 14px}
.controlSummary>div{border:1px solid #dfe4ec;border-radius:12px;background:#fafbfc;padding:10px 14px;min-width:145px}
.controlSummary strong{display:block;font-size:22px}.controlSummary span{display:block;color:#667085;font-size:12px;margin-top:3px}
.controlSummary button{align-self:center}.readyQueue{margin-top:18px;border-top:1px solid #edf0f4;padding-top:14px}.readyQueue h4{margin:0 0 10px}
.readyRow{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:11px 0;border-top:1px solid #edf0f4}
.readyRow:first-of-type{border-top:0}.readyRow span{display:block;color:#667085;margin-top:4px}
.controlScore{display:inline-block;margin-top:10px}
@media(max-width:700px){.readyRow{flex-direction:column;align-items:flex-start}.controlSummary>div{min-width:125px}}
.controlGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
.controlCard{border:1px solid #dfe4ec;border-radius:14px;padding:16px;background:#fafbfc}
.controlTop{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.controlMatch{font-size:18px;font-weight:800;margin-bottom:4px}
.controlEmpty{color:#667085;padding:10px 0}
.statusPill{font-size:12px;font-weight:800;text-transform:uppercase;border:1px solid #d0d5dd;border-radius:999px;padding:5px 8px}
.statusPill.available{background:#fff}.statusPill.occupied{background:#f5f5f5}.statusPill.unavailable{background:#eee}
.bracket{display:flex;gap:18px;overflow-x:auto;padding:8px 2px 14px}
.bracketRound{min-width:220px;flex:1}.bracketRound h4{text-align:center;margin:4px 0 12px;font-size:16px}
.bracketMatches{display:flex;flex-direction:column;justify-content:space-around;gap:16px;height:100%}
.bracketMatch{border:1px solid #dfe4ec;border-radius:12px;background:#fff;padding:10px 12px;box-shadow:0 2px 8px #00000008}
.bracketMatch.done{border-color:#b7c9b7}.bracketMatchNo{font-size:11px;color:#667085;margin-bottom:7px}
.bracketMatch>div:not(.bracketMatchNo){display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px solid #eef0f3}
.bracketMatch>div:last-of-type{border-bottom:0}.winnerLine{font-weight:800}.bracketMatch small{display:block;color:#667085;margin-top:7px}
@media(max-width:700px){.bracket{gap:12px}.bracketRound{min-width:200px}}
`;
