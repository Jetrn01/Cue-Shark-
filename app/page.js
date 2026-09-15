'use client';
import {useEffect,useState} from "react";
import {createClient} from "@supabase/supabase-js";
const supabase=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
const blank={name:"",venue:"",start_date:"",end_date:"",format:"",rules:"CNZ Rules"};
export default function Home(){
 const [session,setSession]=useState(null),[loading,setLoading]=useState(true),[mode,setMode]=useState("login");
 const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[message,setMessage]=useState("");
 const [competitions,setCompetitions]=useState([]),[show,setShow]=useState(false),[editing,setEditing]=useState(null),[form,setForm]=useState(blank);
 useEffect(()=>{supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false)});const {data}=supabase.auth.onAuthStateChange((_,s)=>setSession(s));return()=>data.subscription.unsubscribe()},[]);
 useEffect(()=>{if(session)load()},[session]);
 async function load(){const {data,error}=await supabase.from("competitions").select("*").order("start_date",{ascending:true});if(error)setMessage(error.message);else setCompetitions(data||[])}
 async function auth(e){e.preventDefault();setMessage("");const r=mode==="login"?await supabase.auth.signInWithPassword({email,password}):await supabase.auth.signUp({email,password});if(r.error)setMessage(r.error.message);else if(mode==="signup")setMessage("Account created. Check your email if confirmation is required, then log in.")}
 function openCreate(){setEditing(null);setForm(blank);setMessage("");setShow(true)}
 function openEdit(c){setEditing(c);setForm({name:c.name||"",venue:c.venue||"",start_date:c.start_date||"",end_date:c.end_date||"",format:c.format||"",rules:c.rules||"CNZ Rules"});setMessage("");setShow(true)}
 async function save(e){e.preventDefault();setMessage("");let result;
  if(editing) result=await supabase.from("competitions").update(form).eq("id",editing.id);
  else result=await supabase.from("competitions").insert([form]);
  if(result.error){setMessage(result.error.message);return}
  setShow(false);setEditing(null);setForm(blank);await load();
 }
 async function remove(c){if(!confirm(`Delete "${c.name}"? This cannot be undone.`))return;setMessage("");const {error}=await supabase.from("competitions").delete().eq("id",c.id);if(error)setMessage(error.message);else load()}
 if(loading)return <main style={{padding:40}}>Loading Cue Shark…</main>;
 const input={padding:13,border:"1px solid #ccc",borderRadius:9,fontSize:16};
 return <main style={{maxWidth:1000,margin:"0 auto",padding:"28px 20px"}}>
  <header style={{background:"#111",color:"#fff",borderRadius:18,padding:28,marginBottom:24}}>
   <div style={{fontSize:13,letterSpacing:2,textTransform:"uppercase",opacity:.7}}>Cue Sport Tournament Management</div>
   <h1 style={{fontSize:44,margin:"8px 0"}}>🦈 Cue Shark</h1><p style={{fontSize:18,margin:0}}>Run competitions. Track matches. Publish results.</p>
  </header>
  {!session?<section style={{background:"#fff",borderRadius:18,padding:24,maxWidth:520}}>
   <h2>{mode==="login"?"Organiser Login":"Create Organiser Account"}</h2>
   <form onSubmit={auth} style={{display:"grid",gap:12}}>
    <input required type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} style={input}/>
    <input required type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} style={input}/>
    <button style={{...input,background:"#111",color:"#fff",cursor:"pointer"}}>{mode==="login"?"Log In":"Create Account"}</button>
   </form>
   <button onClick={()=>setMode(mode==="login"?"signup":"login")} style={{marginTop:14,border:0,background:"transparent",textDecoration:"underline",cursor:"pointer"}}>{mode==="login"?"Create an organiser account":"Back to login"}</button>
   {message&&<p>{message}</p>}
  </section>:
  <>
   <section style={{background:"#fff",borderRadius:18,padding:24,marginBottom:20,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
    <div><h2 style={{margin:"0 0 5px"}}>Organiser Dashboard</h2><span style={{color:"#666"}}>{session.user.email}</span></div>
    <button onClick={()=>supabase.auth.signOut()} style={{padding:"10px 14px",border:"1px solid #ccc",borderRadius:9,background:"#fff"}}>Log out</button>
   </section>
   <section style={{background:"#fff",borderRadius:18,padding:24}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><h2>Competitions</h2><button onClick={openCreate} style={{padding:"11px 16px",border:0,borderRadius:9,background:"#111",color:"#fff"}}>+ Create Competition</button></div>
    {message&&<p style={{padding:12,background:"#fff4d6",borderRadius:8}}>{message}</p>}
    {competitions.length===0?<p>No competitions yet.</p>:competitions.map(c=><div key={c.id} style={{padding:"16px 0",borderBottom:"1px solid #ddd",display:"flex",justifyContent:"space-between",gap:15,alignItems:"center"}}>
      <div><strong>{c.name}</strong><div>{c.venue||"Venue TBC"} · {c.start_date||"Date TBC"}</div><small>{c.format||"Format TBC"} · {c.rules||"Rules TBC"} · {c.status||"upcoming"}</small></div>
      <div style={{display:"flex",gap:8,flexShrink:0}}><button onClick={()=>openEdit(c)} style={{padding:"8px 12px",border:"1px solid #ccc",borderRadius:8,background:"#fff"}}>Edit</button><button onClick={()=>remove(c)} style={{padding:"8px 12px",border:"1px solid #ccc",borderRadius:8,background:"#fff"}}>Delete</button></div>
    </div>)}
   </section>
   {show&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",display:"grid",placeItems:"center",padding:20}}>
    <form onSubmit={save} style={{background:"#fff",borderRadius:18,padding:24,width:"min(560px,100%)",display:"grid",gap:12}}>
     <h2 style={{marginTop:0}}>{editing?"Edit Competition":"Create Competition"}</h2>
     <input required placeholder="Competition name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} style={input}/>
     <input placeholder="Venue" value={form.venue} onChange={e=>setForm({...form,venue:e.target.value})} style={input}/>
     <label>Start date<input required type="date" value={form.start_date} onChange={e=>setForm({...form,start_date:e.target.value})} style={{...input,width:"100%",boxSizing:"border-box"}}/></label>
     <label>End date<input type="date" value={form.end_date} onChange={e=>setForm({...form,end_date:e.target.value})} style={{...input,width:"100%",boxSizing:"border-box"}}/></label>
     <label>Format<select value={form.format} onChange={e=>setForm({...form,format:e.target.value})} style={{...input,width:"100%",boxSizing:"border-box"}}><option value="">Select format</option><option>Singles</option><option>Doubles</option><option>Teams</option><option>Scotch</option><option>League</option><option>Round Robin</option><option>Speed Pool</option><option>International Rules</option><option>Custom</option></select></label>
     <label>Rules<select value={form.rules} onChange={e=>setForm({...form,rules:e.target.value})} style={{...input,width:"100%",boxSizing:"border-box"}}><option>CNZ Rules</option><option>International Rules</option><option>Custom</option></select></label>
     <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><button type="button" onClick={()=>setShow(false)} style={{padding:"11px 16px"}}>Cancel</button><button type="submit" style={{padding:"11px 16px",background:"#111",color:"#fff"}}>{editing?"Save Changes":"Save Competition"}</button></div>
    </form>
   </div>}
  </>}
 </main>
}