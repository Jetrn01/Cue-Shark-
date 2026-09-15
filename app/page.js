'use client';

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

const blankCompetition = { name:"", venue:"", start_date:"", end_date:"", format:"", rules:"CNZ Rules" };
const blankPlayer = { first_name:"", last_name:"", phone:"", email:"", club_name:"" };

function playerName(p) {
  return p?.display_name || `${p?.first_name || ""} ${p?.last_name || ""}`.trim() || "Unnamed Player";
}

export default function Home() {
  const [session,setSession]=useState(null), [loading,setLoading]=useState(true), [mode,setMode]=useState("login");
  const [email,setEmail]=useState(""), [password,setPassword]=useState(""), [message,setMessage]=useState("");
  const [competitions,setCompetitions]=useState([]), [selected,setSelected]=useState(null);
  const [showCompetition,setShowCompetition]=useState(false), [editing,setEditing]=useState(null), [competitionForm,setCompetitionForm]=useState(blankCompetition);
  const [players,setPlayers]=useState([]), [showPlayer,setShowPlayer]=useState(false), [playerForm,setPlayerForm]=useState(blankPlayer);
  const [matches,setMatches]=useState([]), [drawOpen,setDrawOpen]=useState(false);
  const [drawSettings,setDrawSettings]=useState({ draw_type:"Random Draw", race_to:3 });
  const [drawLoading,setDrawLoading]=useState(false);

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false)});
    const {data}=supabase.auth.onAuthStateChange((_event,newSession)=>setSession(newSession));
    return ()=>data.subscription.unsubscribe();
  },[]);

  useEffect(()=>{if(session) loadCompetitions()},[session]);
  useEffect(()=>{if(selected){ loadPlayers(selected.id); loadMatches(selected.id)}},[selected]);

  async function loadCompetitions(){
    const {data,error}=await supabase.from("competitions").select("*").order("start_date",{ascending:true});
    if(error)setMessage(error.message); else setCompetitions(data||[]);
  }

  async function loadPlayers(competitionId){
    const {data,error}=await supabase.from("competition_players")
      .select("id,checked_in,players(id,first_name,last_name,display_name,phone,email,club_name)")
      .eq("competition_id",competitionId).order("created_at",{ascending:true});
    if(error)setMessage(error.message); else setPlayers(data||[]);
  }

  async function loadMatches(competitionId){
    const {data,error}=await supabase.from("competition_matches").select("*").eq("competition_id",competitionId).order("match_number",{ascending:true});
    if(error)setMessage(error.message); else setMatches(data||[]);
  }

  async function auth(e){
    e.preventDefault(); setMessage("");
    const result=mode==="login"
      ? await supabase.auth.signInWithPassword({email,password})
      : await supabase.auth.signUp({email,password});
    if(result.error)setMessage(result.error.message);
    else if(mode==="signup")setMessage("Account created. Check your email if confirmation is required, then log in.");
  }

  function openCreate(){setEditing(null);setCompetitionForm(blankCompetition);setMessage("");setShowCompetition(true)}
  function openEdit(c){setEditing(c);setCompetitionForm({name:c.name||"",venue:c.venue||"",start_date:c.start_date||"",end_date:c.end_date||"",format:c.format||"",rules:c.rules||"CNZ Rules"});setMessage("");setShowCompetition(true)}

  async function saveCompetition(e){
    e.preventDefault();setMessage("");
    const result=editing
      ? await supabase.from("competitions").update(competitionForm).eq("id",editing.id)
      : await supabase.from("competitions").insert([competitionForm]);
    if(result.error){setMessage(result.error.message);return}
    setShowCompetition(false);setEditing(null);setCompetitionForm(blankCompetition);await loadCompetitions();
  }

  async function deleteCompetition(c){
    if(!confirm(`Delete "${c.name}"? This cannot be undone.`))return;
    const {error}=await supabase.from("competitions").delete().eq("id",c.id);
    if(error)setMessage(error.message);
    else {if(selected?.id===c.id)setSelected(null);await loadCompetitions()}
  }

  async function addPlayer(e){
    e.preventDefault();setMessage("");
    const {data:player,error:playerError}=await supabase.from("players").insert([playerForm]).select().single();
    if(playerError){setMessage(playerError.message);return}
    const {error:joinError}=await supabase.from("competition_players").insert([{competition_id:selected.id,player_id:player.id}]);
    if(joinError){setMessage(joinError.message);return}
    setPlayerForm(blankPlayer);setShowPlayer(false);await loadPlayers(selected.id);
  }

  async function toggleCheckIn(row){
    const {error}=await supabase.from("competition_players").update({checked_in:!row.checked_in}).eq("id",row.id);
    if(error)setMessage(error.message); else loadPlayers(selected.id);
  }

  const checkedInPlayers = useMemo(()=>players.filter(p=>p.checked_in && p.players),[players]);

  function makeDraw(list, type) {
    const arr=[...list];
    if(type==="Random Draw") {
      for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}
      return arr;
    }
    return arr;
  }

  async function generateDraw(){
    setMessage("");
    if(checkedInPlayers.length < 2){setMessage("You need at least 2 checked-in players to generate a draw.");return}
    setDrawLoading(true);

    const {error:deleteError}=await supabase.from("competition_matches").delete().eq("competition_id",selected.id);
    if(deleteError){setMessage(deleteError.message);setDrawLoading(false);return}

    let ordered=makeDraw(checkedInPlayers,drawSettings.draw_type);
    const rows=[];
    const race=Number(drawSettings.race_to);

    if(drawSettings.draw_type==="Round Robin"){
      let n=ordered.length;
      if(n%2){ordered=[...ordered,{players:{id:null,first_name:"BYE",last_name:""}}];n++}
      for(let r=0;r<n-1;r++){
        for(let i=0;i<n/2;i++){
          const a=ordered[i], b=ordered[n-1-i];
          if(a.players.id && b.players.id){
            rows.push({competition_id:selected.id,match_number:rows.length+1,round_number:r+1,player1_id:a.players.id,player2_id:b.players.id,race_to:race,status:"scheduled"});
          }
        }
        ordered=[ordered[0],ordered[n-1],...ordered.slice(1,n-1)];
      }
    } else {
      for(let i=0;i<ordered.length;i+=2){
        const a=ordered[i], b=ordered[i+1];
        rows.push({
          competition_id:selected.id,match_number:rows.length+1,round_number:1,
          player1_id:a?.players?.id || null,player2_id:b?.players?.id || null,
          race_to:race,status:"scheduled"
        });
      }
    }

    const {error:insertError}=await supabase.from("competition_matches").insert(rows);
    if(insertError)setMessage(insertError.message);
    else {await loadMatches(selected.id);setDrawOpen(false);setMessage(`Draw generated: ${rows.length} matches.`)}
    setDrawLoading(false);
  }

  async function clearDraw(){
    if(!confirm("Clear the current draw for this competition?"))return;
    const {error}=await supabase.from("competition_matches").delete().eq("competition_id",selected.id);
    if(error)setMessage(error.message); else {setMatches([]);setMessage("Draw cleared.")}
  }

  async function deleteMatch(id){
    const {error}=await supabase.from("competition_matches").delete().eq("id",id);
    if(error)setMessage(error.message); else loadMatches(selected.id);
  }

  if(loading)return <main style={{padding:40}}>Loading PottersMate…</main>;
  const input={padding:13,border:"1px solid #ccc",borderRadius:9,fontSize:16};

  return <main style={{maxWidth:1100,margin:"0 auto",padding:"28px 20px",fontFamily:"Arial, sans-serif"}}>
    <header style={{background:"#111",color:"#fff",borderRadius:18,padding:28,marginBottom:24}}>
      <div style={{fontSize:13,letterSpacing:2,textTransform:"uppercase",opacity:.7}}>Cue Sport Tournament Management</div>
      <h1 style={{fontSize:44,margin:"8px 0"}}>🎱 PottersMate</h1>
      <p style={{fontSize:18,margin:0}}>Run competitions. Track players. Run the day.</p>
    </header>

    {!session ? <section style={{background:"#fff",borderRadius:18,padding:24,maxWidth:520}}>
      <h2>{mode==="login"?"Organiser Login":"Create Organiser Account"}</h2>
      <form onSubmit={auth} style={{display:"grid",gap:12}}>
        <input required type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} style={input}/>
        <input required type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} style={input}/>
        <button type="submit" style={{...input,background:"#111",color:"#fff",cursor:"pointer"}}>{mode==="login"?"Log In":"Create Account"}</button>
      </form>
      <button onClick={()=>setMode(mode==="login"?"signup":"login")} style={{marginTop:14,border:0,background:"transparent",textDecoration:"underline",cursor:"pointer"}}>{mode==="login"?"Create an organiser account":"Back to login"}</button>
      {message&&<p>{message}</p>}
    </section> : <>
      <section style={{background:"#fff",borderRadius:18,padding:24,marginBottom:20,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><h2 style={{margin:"0 0 5px"}}>Organiser Dashboard</h2><span style={{color:"#666"}}>{session.user.email}</span></div>
        <button onClick={()=>supabase.auth.signOut()} style={{padding:"10px 14px",border:"1px solid #ccc",borderRadius:9,background:"#fff"}}>Log out</button>
      </section>

      {!selected ? <section style={{background:"#fff",borderRadius:18,padding:24}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}><h2>Competitions</h2><button onClick={openCreate} style={{padding:"11px 16px",border:0,borderRadius:9,background:"#111",color:"#fff"}}>+ Create Competition</button></div>
        {message&&<p style={{padding:12,background:"#fff4d6",borderRadius:8}}>{message}</p>}
        {competitions.length===0?<p>No competitions yet.</p>:competitions.map(c=><div key={c.id} style={{padding:"16px 0",borderBottom:"1px solid #ddd",display:"flex",justifyContent:"space-between",gap:15,alignItems:"center"}}>
          <div style={{cursor:"pointer"}} onClick={()=>setSelected(c)}><strong>{c.name}</strong><div>{c.venue||"Venue TBC"} · {c.start_date||"Date TBC"}</div><small>{c.format||"Format TBC"} · {c.rules||"Rules TBC"} · {c.status||"upcoming"}</small></div>
          <div style={{display:"flex",gap:8}}><button onClick={()=>setSelected(c)} style={{padding:"8px 12px",border:"1px solid #ccc",borderRadius:8,background:"#fff"}}>Open</button><button onClick={()=>openEdit(c)} style={{padding:"8px 12px",border:"1px solid #ccc",borderRadius:8,background:"#fff"}}>Edit</button><button onClick={()=>deleteCompetition(c)} style={{padding:"8px 12px",border:"1px solid #ccc",borderRadius:8,background:"#fff"}}>Delete</button></div>
        </div>)}
      </section> : <section style={{background:"#fff",borderRadius:18,padding:24}}>
        <button onClick={()=>{setSelected(null);setMessage("")}} style={{padding:"8px 12px",border:"1px solid #ccc",borderRadius:8,background:"#fff",marginBottom:15}}>← Back to Competitions</button>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <div><h2 style={{margin:"0 0 5px"}}>{selected.name}</h2><div>{selected.venue||"Venue TBC"} · {selected.start_date||"Date TBC"}</div><small>{selected.format||"Format TBC"} · {selected.rules||"Rules TBC"}</small></div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button onClick={()=>openEdit(selected)} style={{padding:"10px 14px"}}>Edit Competition</button><button onClick={()=>setShowPlayer(true)} style={{padding:"10px 14px",background:"#111",color:"#fff"}}>+ Add Player</button><button onClick={()=>setDrawOpen(true)} style={{padding:"10px 14px",background:"#176b3a",color:"#fff",border:0,borderRadius:8}}>🎱 Build Draw</button></div>
        </div>

        <hr style={{margin:"24px 0"}}/>

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginBottom:24}}>
          <div style={{padding:18,border:"1px solid #ddd",borderRadius:12}}><small>REGISTERED</small><div style={{fontSize:28,fontWeight:700}}>{players.length}</div></div>
          <div style={{padding:18,border:"1px solid #ddd",borderRadius:12}}><small>CHECKED IN</small><div style={{fontSize:28,fontWeight:700}}>{checkedInPlayers.length}</div></div>
          <div style={{padding:18,border:"1px solid #ddd",borderRadius:12}}><small>MATCHES</small><div style={{fontSize:28,fontWeight:700}}>{matches.length}</div></div>
        </div>

        <div style={{marginBottom:30}}>
          <h2>Players</h2>
          {message&&<p style={{padding:12,background:"#fff4d6",borderRadius:8}}>{message}</p>}
          {players.length===0?<p>No players added yet. Click <b>+ Add Player</b> to add your first player.</p>:<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th style={{textAlign:"left",padding:10,borderBottom:"1px solid #ddd"}}>Player</th><th style={{textAlign:"left",padding:10,borderBottom:"1px solid #ddd"}}>Club</th><th style={{textAlign:"left",padding:10,borderBottom:"1px solid #ddd"}}>Contact</th><th style={{padding:10,borderBottom:"1px solid #ddd"}}>Check-in</th></tr></thead><tbody>{players.map(row=>{const p=row.players;return <tr key={row.id}><td style={{padding:10,borderBottom:"1px solid #eee"}}>{playerName(p)}</td><td style={{padding:10,borderBottom:"1px solid #eee"}}>{p?.club_name||"—"}</td><td style={{padding:10,borderBottom:"1px solid #eee"}}>{p?.phone||p?.email||"—"}</td><td style={{padding:10,borderBottom:"1px solid #eee",textAlign:"center"}}><button onClick={()=>toggleCheckIn(row)} style={{padding:"7px 12px",borderRadius:8,border:"1px solid #ccc",background:row.checked_in?"#111":"#fff",color:row.checked_in?"#fff":"#111"}}>{row.checked_in?"Checked In":"Check In"}</button></td></tr>})}</tbody></table></div>}
        </div>

        <div style={{borderTop:"1px solid #ddd",paddingTop:24}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
            <div><h2 style={{margin:"0 0 5px"}}>Draw</h2><p style={{margin:0,color:"#666"}}>V4 currently builds singles draws from checked-in players.</p></div>
            {matches.length>0&&<button onClick={clearDraw} style={{padding:"9px 13px",border:"1px solid #ccc",borderRadius:8,background:"#fff"}}>Clear Draw</button>}
          </div>
          {matches.length===0?<div style={{marginTop:15,padding:20,border:"1px dashed #bbb",borderRadius:12}}><b>No draw generated yet.</b><p style={{marginBottom:0}}>Check in your players, then click <b>Build Draw</b>.</p></div>:
          <div style={{overflowX:"auto",marginTop:15}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th style={{textAlign:"left",padding:10,borderBottom:"1px solid #ddd"}}>#</th><th style={{textAlign:"left",padding:10,borderBottom:"1px solid #ddd"}}>Round</th><th style={{textAlign:"left",padding:10,borderBottom:"1px solid #ddd"}}>Player 1</th><th style={{textAlign:"left",padding:10,borderBottom:"1px solid #ddd"}}>Player 2</th><th style={{padding:10,borderBottom:"1px solid #ddd"}}>Race</th><th></th></tr></thead><tbody>{matches.map(m=>{
            const p1=players.find(x=>x.players?.id===m.player1_id)?.players;
            const p2=players.find(x=>x.players?.id===m.player2_id)?.players;
            return <tr key={m.id}><td style={{padding:10,borderBottom:"1px solid #eee"}}>{m.match_number}</td><td style={{padding:10,borderBottom:"1px solid #eee"}}>{m.round_number}</td><td style={{padding:10,borderBottom:"1px solid #eee",fontWeight:600}}>{playerName(p1)}</td><td style={{padding:10,borderBottom:"1px solid #eee",fontWeight:600}}>{playerName(p2)}</td><td style={{padding:10,borderBottom:"1px solid #eee",textAlign:"center"}}>Race to {m.race_to}</td><td style={{padding:10,borderBottom:"1px solid #eee"}}><button onClick={()=>deleteMatch(m.id)} style={{padding:"6px 9px"}}>Remove</button></td></tr>
          })}</tbody></table></div>}
        </div>
      </section>}

      {showCompetition&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",display:"grid",placeItems:"center",padding:20,zIndex:10}}><form onSubmit={saveCompetition} style={{background:"#fff",borderRadius:18,padding:24,width:"min(560px,100%)",display:"grid",gap:12}}><h2>{editing?"Edit Competition":"Create Competition"}</h2><input required placeholder="Competition name" value={competitionForm.name} onChange={e=>setCompetitionForm({...competitionForm,name:e.target.value})} style={input}/><input placeholder="Venue" value={competitionForm.venue} onChange={e=>setCompetitionForm({...competitionForm,venue:e.target.value})} style={input}/><label>Start date<input required type="date" value={competitionForm.start_date} onChange={e=>setCompetitionForm({...competitionForm,start_date:e.target.value})} style={{...input,width:"100%",boxSizing:"border-box"}}/></label><label>End date<input type="date" value={competitionForm.end_date} onChange={e=>setCompetitionForm({...competitionForm,end_date:e.target.value})} style={{...input,width:"100%",boxSizing:"border-box"}}/></label><label>Format<select value={competitionForm.format} onChange={e=>setCompetitionForm({...competitionForm,format:e.target.value})} style={{...input,width:"100%",boxSizing:"border-box"}}><option value="">Select format</option><option>Singles</option><option>Doubles</option><option>Teams</option><option>Scotch</option><option>League</option><option>Round Robin</option><option>Speed Pool</option><option>International Rules</option><option>Custom</option></select></label><label>Rules<select value={competitionForm.rules} onChange={e=>setCompetitionForm({...competitionForm,rules:e.target.value})} style={{...input,width:"100%",boxSizing:"border-box"}}><option>CNZ Rules</option><option>International Rules</option><option>Custom</option></select></label><div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><button type="button" onClick={()=>setShowCompetition(false)} style={{padding:"11px 16px"}}>Cancel</button><button type="submit" style={{padding:"11px 16px",background:"#111",color:"#fff"}}>{editing?"Save Changes":"Save Competition"}</button></div></form></div>}

      {showPlayer&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",display:"grid",placeItems:"center",padding:20,zIndex:10}}><form onSubmit={addPlayer} style={{background:"#fff",borderRadius:18,padding:24,width:"min(560px,100%)",display:"grid",gap:12}}><h2>Add Player</h2><p style={{marginTop:0,color:"#666"}}>This player will be added to <b>{selected.name}</b>.</p><input required placeholder="First name" value={playerForm.first_name} onChange={e=>setPlayerForm({...playerForm,first_name:e.target.value})} style={input}/><input required placeholder="Last name" value={playerForm.last_name} onChange={e=>setPlayerForm({...playerForm,last_name:e.target.value})} style={input}/><input placeholder="Phone" value={playerForm.phone} onChange={e=>setPlayerForm({...playerForm,phone:e.target.value})} style={input}/><input type="email" placeholder="Email" value={playerForm.email} onChange={e=>setPlayerForm({...playerForm,email:e.target.value})} style={input}/><input placeholder="Club" value={playerForm.club_name} onChange={e=>setPlayerForm({...playerForm,club_name:e.target.value})} style={input}/><div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><button type="button" onClick={()=>setShowPlayer(false)} style={{padding:"11px 16px"}}>Cancel</button><button type="submit" style={{padding:"11px 16px",background:"#111",color:"#fff"}}>Add Player</button></div></form></div>}

      {drawOpen&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",display:"grid",placeItems:"center",padding:20,zIndex:20}}><section style={{background:"#fff",borderRadius:18,padding:24,width:"min(520px,100%)"}}><h2>Build Draw</h2><p style={{color:"#666"}}>{checkedInPlayers.length} checked-in players will be included.</p><label style={{display:"grid",gap:6,marginBottom:14}}>Draw type<select value={drawSettings.draw_type} onChange={e=>setDrawSettings({...drawSettings,draw_type:e.target.value})} style={{...input,width:"100%",boxSizing:"border-box"}}><option>Random Draw</option><option>Round Robin</option><option>Seeded Draw</option></select></label><label style={{display:"grid",gap:6,marginBottom:20}}>Race to<select value={drawSettings.race_to} onChange={e=>setDrawSettings({...drawSettings,race_to:e.target.value})} style={{...input,width:"100%",boxSizing:"border-box"}}><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="5">5</option><option value="7">7</option><option value="9">9</option></select></label><div style={{padding:12,background:"#f5f5f5",borderRadius:10,marginBottom:20}}><b>Preview:</b> {drawSettings.draw_type} · Race to {drawSettings.race_to}</div><div style={{display:"flex",justifyContent:"flex-end",gap:10}}><button onClick={()=>setDrawOpen(false)} style={{padding:"11px 16px"}}>Cancel</button><button disabled={drawLoading} onClick={generateDraw} style={{padding:"11px 16px",background:"#176b3a",color:"#fff",border:0,borderRadius:8}}>{drawLoading?"Generating…":"Generate Draw"}</button></div></section></div>}
    </>}
  </main>;
}
