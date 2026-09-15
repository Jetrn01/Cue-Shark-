'use client';

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

const blankCompetition={name:"",venue:"",start_date:"",end_date:"",format:"Singles",rules:"CNZ Rules"};
const blankPlayer={first_name:"",last_name:"",phone:"",email:"",club_name:""};

function pname(p){return p?(`${p.first_name||""} ${p.last_name||""}`.trim()||"Unnamed Player"):"BYE"}

export default function Home(){
 const [session,setSession]=useState(null),[loading,setLoading]=useState(true),[mode,setMode]=useState("login");
 const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[message,setMessage]=useState("");
 const [competitions,setCompetitions]=useState([]),[selected,setSelected]=useState(null);
 const [compModal,setCompModal]=useState(false),[editing,setEditing]=useState(null),[cf,setCf]=useState(blankCompetition);
 const [players,setPlayers]=useState([]),[playerModal,setPlayerModal]=useState(false),[pf,setPf]=useState(blankPlayer);
 const [matches,setMatches]=useState([]),[drawModal,setDrawModal]=useState(false),[drawBusy,setDrawBusy]=useState(false);
 const [settings,setSettings]=useState({draw_type:"Knockout",race_to:3});
 const [expanded,setExpanded]=useState(false);

 useEffect(()=>{supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false)});const {data}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));return()=>data.subscription.unsubscribe()},[]);
 useEffect(()=>{if(session)loadCompetitions()},[session]);
 useEffect(()=>{if(selected){loadPlayers(selected.id);loadMatches(selected.id)}},[selected]);

 async function loadCompetitions(){const {data,error}=await supabase.from("competitions").select("*").order("start_date",{ascending:true});if(error)setMessage(error.message);else setCompetitions(data||[])}
 async function loadPlayers(cid){const {data,error}=await supabase.from("competition_players").select("id,checked_in,players(id,first_name,last_name,display_name,phone,email,club_name)").eq("competition_id",cid).order("created_at",{ascending:true});if(error)setMessage(error.message);else setPlayers(data||[])}
 async function loadMatches(cid){const {data,error}=await supabase.from("competition_matches").select("*").eq("competition_id",cid).order("round_number",{ascending:true}).order("match_number",{ascending:true});if(error)setMessage(error.message);else setMatches(data||[])}

 async function auth(e){e.preventDefault();setMessage("");const r=mode==="login"?await supabase.auth.signInWithPassword({email,password}):await supabase.auth.signUp({email,password});if(r.error)setMessage(r.error.message);else if(mode==="signup")setMessage("Account created. Check your email if confirmation is required, then log in.")}

 function openCreate(){setEditing(null);setCf(blankCompetition);setCompModal(true)}
 function openEdit(c){setEditing(c);setCf({name:c.name||"",venue:c.venue||"",start_date:c.start_date||"",end_date:c.end_date||"",format:c.format||"Singles",rules:c.rules||"CNZ Rules"});setCompModal(true)}
 async function saveComp(e){e.preventDefault();const r=editing?await supabase.from("competitions").update(cf).eq("id",editing.id):await supabase.from("competitions").insert([cf]);if(r.error)setMessage(r.error.message);else{setCompModal(false);await loadCompetitions()}}

 async function addPlayer(e){e.preventDefault();const {data:p,error}=await supabase.from("players").insert([pf]).select().single();if(error){setMessage(error.message);return}const {error:j}=await supabase.from("competition_players").insert([{competition_id:selected.id,player_id:p.id}]);if(j){setMessage(j.message);return}setPf(blankPlayer);setPlayerModal(false);loadPlayers(selected.id)}
 async function toggleCheck(row){const {error}=await supabase.from("competition_players").update({checked_in:!row.checked_in}).eq("id",row.id);if(error)setMessage(error.message);else loadPlayers(selected.id)}
 const checked=useMemo(()=>players.filter(x=>x.checked_in&&x.players),[players]);

 function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
 function orderedPlayers(list,type){if(type==="Random Draw")return shuffle(list);if(type==="Seeded Draw")return [...list];return [...list]}

 async function generateDraw(){
  if(checked.length<2){setMessage("At least 2 checked-in players are required.");return}
  setDrawBusy(true);setMessage("");
  const del=await supabase.from("competition_matches").delete().eq("competition_id",selected.id);
  if(del.error){setMessage(del.error.message);setDrawBusy(false);return}
  const race=Number(settings.race_to), type=settings.draw_type, list=orderedPlayers(checked,type), rows=[];
  if(type==="Round Robin"){
   let a=list.map(x=>x.players), n=a.length; if(n%2){a=[...a,null];n++}
   for(let r=0;r<n-1;r++){
    for(let i=0;i<n/2;i++){const p1=a[i],p2=a[n-1-i];if(p1&&p2)rows.push({competition_id:selected.id,match_number:rows.length+1,round_number:r+1,player1_id:p1.id,player2_id:p2.id,race_to:race,status:"scheduled"})}
    a=[a[0],a[n-1],...a.slice(1,n-1)]
   }
  } else {
   let roundPlayers=list.map(x=>x.players), round=1;
   while(roundPlayers.length>1){
    if(roundPlayers.length%2)roundPlayers=[...roundPlayers,null];
    const next=[];
    for(let i=0;i<roundPlayers.length;i+=2){
      const a=roundPlayers[i],b=roundPlayers[i+1];
      rows.push({competition_id:selected.id,match_number:rows.length+1,round_number:round,player1_id:a?.id||null,player2_id:b?.id||null,race_to:race,status:"scheduled"});
      next.push(null); // placeholder: progression is completed when results are entered in the live engine
    }
    if(roundPlayers.length<=2)break;
    roundPlayers=new Array(Math.ceil(roundPlayers.length/2)).fill(null);round++;
   }
  }
  const ins=await supabase.from("competition_matches").insert(rows);
  if(ins.error)setMessage(ins.error.message);else{await loadMatches(selected.id);setDrawModal(false);setMessage(`Draw generated: ${rows.length} matches.`)}
  setDrawBusy(false);
 }
 async function clearDraw(){if(!confirm("Clear the current draw?"))return;const r=await supabase.from("competition_matches").delete().eq("competition_id",selected.id);if(r.error)setMessage(r.error.message);else loadMatches(selected.id)}

 if(loading)return <main style={{padding:40}}>Loading PottersMate…</main>;
 const input={padding:12,border:"1px solid #ccc",borderRadius:8,fontSize:16};
 return <main style={{maxWidth:1100,margin:"0 auto",padding:"28px 20px",fontFamily:"Arial,sans-serif"}}>
  <header style={{background:"#111",color:"#fff",borderRadius:18,padding:28,marginBottom:22}}><div style={{fontSize:12,letterSpacing:2,opacity:.7}}>CUE SPORT TOURNAMENT MANAGEMENT</div><h1 style={{fontSize:42,margin:"7px 0"}}>🎱 PottersMate</h1><p style={{margin:0,fontSize:17}}>Run competitions. Track players. Run the day.</p></header>
  {!session?<section style={{background:"#fff",padding:24,borderRadius:18,maxWidth:500}}><h2>{mode==="login"?"Organiser Login":"Create Organiser Account"}</h2><form onSubmit={auth} style={{display:"grid",gap:12}}><input required type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} style={input}/><input required type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} style={input}/><button style={{...input,background:"#111",color:"#fff"}}>{mode==="login"?"Log In":"Create Account"}</button></form><button onClick={()=>setMode(mode==="login"?"signup":"login")} style={{marginTop:12,border:0,background:"none",textDecoration:"underline"}}>{mode==="login"?"Create an organiser account":"Back to login"}</button>{message&&<p>{message}</p>}</section>:
  <>
   <section style={{background:"#fff",padding:20,borderRadius:18,marginBottom:18,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><h2 style={{margin:0}}>Organiser Dashboard</h2><small>{session.user.email}</small></div><button onClick={()=>supabase.auth.signOut()}>Log out</button></section>
   {!selected?<section style={{background:"#fff",padding:24,borderRadius:18}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><h2>Competitions</h2><button onClick={openCreate} style={{padding:10,background:"#111",color:"#fff"}}>+ Create Competition</button></div>{message&&<p>{message}</p>}{competitions.map(c=><div key={c.id} style={{padding:"16px 0",borderBottom:"1px solid #ddd",display:"flex",justifyContent:"space-between",gap:10}}><div><b>{c.name}</b><div>{c.venue||"Venue TBC"} · {c.start_date||"Date TBC"}</div><small>{c.format||"Singles"} · {c.rules||"CNZ Rules"}</small></div><div><button onClick={()=>setSelected(c)}>Open</button> <button onClick={()=>openEdit(c)}>Edit</button></div></div>)}</section>:
   <section style={{background:"#fff",padding:24,borderRadius:18}}><button onClick={()=>setSelected(null)}>← Competitions</button><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginTop:12,flexWrap:"wrap"}}><div><h2 style={{margin:"0 0 5px"}}>{selected.name}</h2><div>{selected.venue} · {selected.start_date}</div><small>{selected.format} · {selected.rules}</small></div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button onClick={()=>setPlayerModal(true)}>+ Add Player</button><button onClick={()=>setDrawModal(true)} style={{background:"#176b3a",color:"#fff",border:0,padding:"9px 14px",borderRadius:8}}>🎱 Build Draw</button></div></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,margin:"22px 0"}}><div style={{padding:15,border:"1px solid #ddd",borderRadius:10}}>REGISTERED<br/><b style={{fontSize:28}}>{players.length}</b></div><div style={{padding:15,border:"1px solid #ddd",borderRadius:10}}>CHECKED IN<br/><b style={{fontSize:28}}>{checked.length}</b></div><div style={{padding:15,border:"1px solid #ddd",borderRadius:10}}>MATCHES<br/><b style={{fontSize:28}}>{matches.length}</b></div></div>
    <h2>Players</h2>{players.length?<table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th align="left">Player</th><th align="left">Club</th><th>Check-in</th></tr></thead><tbody>{players.map(r=><tr key={r.id}><td style={{padding:9,borderBottom:"1px solid #eee"}}>{pname(r.players)}</td><td style={{padding:9,borderBottom:"1px solid #eee"}}>{r.players?.club_name||"—"}</td><td style={{padding:9,borderBottom:"1px solid #eee",textAlign:"center"}}><button onClick={()=>toggleCheck(r)}>{r.checked_in?"Checked In":"Check In"}</button></td></tr>)}</tbody></table>:<p>No players yet.</p>}
    <hr style={{margin:"28px 0"}}/><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><h2>Draw & Matches</h2><small>V5 supports the core draw styles and race lengths. Match results will drive progression in the live scoring version.</small></div>{matches.length>0&&<button onClick={clearDraw}>Clear Draw</button>}</div>
    {matches.length===0?<p>No draw generated.</p>:<div style={{display:"grid",gap:9,marginTop:12}}>{matches.map(m=>{const p1=players.find(x=>x.players?.id===m.player1_id)?.players,p2=players.find(x=>x.players?.id===m.player2_id)?.players;return <div key={m.id} style={{padding:14,border:"1px solid #ddd",borderRadius:10,display:"grid",gridTemplateColumns:"80px 1fr 1fr 100px",gap:10,alignItems:"center"}}><b>R{m.round_number} · #{m.match_number}</b><span>{pname(p1)}</span><span>{pname(p2)}</span><span>Race to {m.race_to}</span></div>})}</div>}
   </section>}
  </>}
  {compModal&&<div style={modal}><form onSubmit={saveComp} style={box}><h2>{editing?"Edit":"Create"} Competition</h2><input required placeholder="Competition name" value={cf.name} onChange={e=>setCf({...cf,name:e.target.value})} style={input}/><input placeholder="Venue" value={cf.venue} onChange={e=>setCf({...cf,venue:e.target.value})} style={input}/><label>Start date<input required type="date" value={cf.start_date} onChange={e=>setCf({...cf,start_date:e.target.value})} style={{...input,width:"100%"}}/></label><label>End date<input type="date" value={cf.end_date} onChange={e=>setCf({...cf,end_date:e.target.value})} style={{...input,width:"100%"}}/></label><label>Format<select value={cf.format} onChange={e=>setCf({...cf,format:e.target.value})} style={{...input,width:"100%"}}>{["Singles","Doubles","Teams","Scotch","Round Robin","League","Speed Pool","Custom"].map(x=><option key={x}>{x}</option>)}</select></label><label>Rules<select value={cf.rules} onChange={e=>setCf({...cf,rules:e.target.value})} style={{...input,width:"100%"}}><option>CNZ Rules</option><option>International Rules</option><option>Custom</option></select></label><div><button type="button" onClick={()=>setCompModal(false)}>Cancel</button> <button>Save</button></div></form></div>}
  {playerModal&&<div style={modal}><form onSubmit={addPlayer} style={box}><h2>Add Player</h2><input required placeholder="First name" value={pf.first_name} onChange={e=>setPf({...pf,first_name:e.target.value})} style={input}/><input required placeholder="Last name" value={pf.last_name} onChange={e=>setPf({...pf,last_name:e.target.value})} style={input}/><input placeholder="Phone" value={pf.phone} onChange={e=>setPf({...pf,phone:e.target.value})} style={input}/><input type="email" placeholder="Email" value={pf.email} onChange={e=>setPf({...pf,email:e.target.value})} style={input}/><input placeholder="Club" value={pf.club_name} onChange={e=>setPf({...pf,club_name:e.target.value})} style={input}/><div><button type="button" onClick={()=>setPlayerModal(false)}>Cancel</button> <button>Add Player</button></div></form></div>}
  {drawModal&&<div style={modal}><section style={box}><h2>Build Draw</h2><p>{checked.length} checked-in players</p><label style={{display:"grid",gap:6}}>Draw style<select value={settings.draw_type} onChange={e=>setSettings({...settings,draw_type:e.target.value})} style={{...input,width:"100%"}}><option>Knockout</option><option>Random Draw</option><option>Seeded Draw</option><option>Round Robin</option></select></label><label style={{display:"grid",gap:6,marginTop:12}}>Race to<select value={settings.race_to} onChange={e=>setSettings({...settings,race_to:e.target.value})} style={{...input,width:"100%"}}>{[1,2,3,5,7,9].map(n=><option key={n} value={n}>{n}</option>)}</select></label><p style={{background:"#f4f4f4",padding:12,borderRadius:8}}>Format: <b>{selected.format}</b> · {settings.draw_type} · Race to {settings.race_to}</p><div><button onClick={()=>setDrawModal(false)}>Cancel</button> <button disabled={drawBusy} onClick={generateDraw}>{drawBusy?"Generating…":"Generate Draw"}</button></div></section></div>}
 </main>
}
const modal={position:"fixed",inset:0,background:"rgba(0,0,0,.45)",display:"grid",placeItems:"center",padding:20,zIndex:20};
const box={background:"#fff",borderRadius:18,padding:24,width:"min(540px,100%)",display:"grid",gap:12};
