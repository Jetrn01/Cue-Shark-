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
  const [qrData,setQrData]=useState(null);

  useEffect(()=>{supabase.auth.getSession().then(({data})=>setSession(data.session));
    const {data:s}=supabase.auth.onAuthStateChange((_e,x)=>setSession(x)); return()=>s.subscription.unsubscribe()},[]);
  useEffect(()=>{if(session) loadCompetitions()},[session]);

  async function loadCompetitions(){const {data,error}=await supabase.from('competitions').select('*').order('start_date',{ascending:true}); if(error)setMsg(error.message);else setCompetitions(data||[])}
  async function load(c){setSelected(c);
    const [p,m,t]=await Promise.all([
      supabase.from('competition_players').select('id,player_id,checked_in,players(id,first_name,last_name,display_name,phone,email,club_name)').eq('competition_id',c.id),
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
    const data={first_name:f.first_name.trim(),last_name:f.last_name.trim(),display_name:`${f.first_name.trim()} ${f.last_name.trim()}`.trim(),phone:f.phone.trim(),email:f.email.trim(),club_name:f.club_name.trim()};
    if(f.playerId) ({error}=await supabase.from('players').update(data).eq('id',f.playerId));
    else {const r=await supabase.from('players').insert(data).select().single();error=r.error;if(!error)({error}=await supabase.from('competition_players').insert({competition_id:selected.id,player_id:r.data.id,checked_in:false}))}
    if(error)setMsg(error.message);else{setModal(null);load(selected)}
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
  async function assign(m,id){const r=await supabase.from('competition_matches').update({table_id:id||null}).eq('id',m.id);if(r.error)setMsg(r.error.message);else load(selected)}

  if(!session)return <><style>{css}</style><main className="auth"><div className="card"><h1>🎱 PottersMate</h1><p>Competition management for cue-sport clubs.</p><form onSubmit={auth}><input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required/><input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required/><button className="primary">{mode==='login'?'Log in':'Create organiser account'}</button></form>{authMsg&&<p className="error">{authMsg}</p>}<button className="link" onClick={()=>setMode(mode==='login'?'signup':'login')}>{mode==='login'?'Need an organiser account?':'Already have an account? Log in'}</button></div></main></>;

  const checked=players.filter(p=>p.checked_in).length;
  return <><style>{css}</style><header><div><h1>🎱 PottersMate</h1><small>Organiser Dashboard</small></div><button onClick={()=>supabase.auth.signOut()}>Log out</button></header>
  {msg&&<div className="notice">{msg}<button onClick={()=>setMsg('')}>✕</button></div>}
  <div className="layout"><aside><b>Competitions</b>{competitions.map(c=><button className={selected?.id===c.id?'sel':''} key={c.id} onClick={()=>load(c)}>{c.name}<small>{c.date} · {c.venue||''}</small></button>)}</aside>
  {!selected?<section className="empty"><h2>Select a competition</h2><p>Manage players, tables and match assignments.</p></section>:
  <section className="content"><div className="hero"><div><h2>{selected.name}</h2><p>{selected.venue} · {selected.start_date||'Date TBC'}</p><div className="settingsSummary"><span><b>Format:</b> {selected.format||'Not set'}</span><span><b>Rules:</b> {selected.rules||'Not set'}</span><span><b>Default race:</b> Race to {selected.default_race_to||3}</span></div></div><div className="heroRight"><button className="primary" onClick={()=>setModal({type:'competition',c:selected})}>⚙️ Edit competition</button><button className="danger" onClick={deleteCompetition}>🗑️ Delete competition</button><div className="stats"><b>{players.length} players</b><b>{checked} checked in</b><b>{tables.length} tables</b></div></div></div>

  <Panel title="Players" add={()=>setModal({type:'player'})} addText="＋ Add player">
    {players.map(p=><div className="row" key={p.id}><div><b>{p.players?.display_name || `${p.players?.first_name||''} ${p.players?.last_name||''}`.trim() || 'Unnamed Player'}</b><small>{p.players?.club_name||'No club'}{p.players?.phone?` · ${p.players.phone}`:''}</small></div><div className="actions"><button onClick={()=>setModal({type:'player',p})}>✏️ Edit</button><button onClick={()=>checkin(p)}>{p.checked_in?'✓ Checked in':'Check in'}</button><button className="danger" onClick={()=>removePlayer(p)}>🗑️ Remove</button></div></div>)}
  </Panel>

  <Panel title="Tables" add={()=>setModal({type:'table'})} addText="＋ Add table">
    {tables.length===0&&<p className="muted">No tables added yet.</p>}
    {tables.map(t=><div className="row" key={t.id}><div><b>Table {t.table_number} {t.is_accessible?'♿':''}</b><small>{t.table_type||'Standard'} · {t.status||'available'}{t.notes?` · ${t.notes}`:''}</small></div><div className="actions"><select value={t.status||'available'} onChange={e=>saveTable({...t,status:e.target.value},t)}><option value="available">Available</option><option value="occupied">Occupied</option><option value="unavailable">Unavailable</option></select><button onClick={()=>setModal({type:'table',t})}>✏️ Edit</button><a className="scoreLink" href={`/score/${t.table_token||t.id}`} target="_blank" rel="noreferrer">📱 Scoring</a><button onClick={()=>showQR(t)}>▦ QR Code</button><button className="danger" onClick={()=>delTable(t)}>🗑️ Delete</button></div></div>)}
  </Panel>

  <Panel title="Matches & Table Assignment">
    {matches.map(m=><div className="row" key={m.id}><div><b>Match {m.match_number}</b><small>Race to {m.race_to} · {m.status}</small></div><select value={m.table_id||''} onChange={e=>assign(m,e.target.value)}><option value="">Unassigned</option>{tables.filter(t=>t.status!=='unavailable').map(t=><option key={t.id} value={t.id}>Table {t.table_number}{t.is_accessible?' ♿':''}</option>)}</select></div>)}
  </Panel>
  </section>}</div>
  {qrData&&<QRModal data={qrData} close={()=>setQrData(null)}/>}
  {modal?.type==='player'&&<PlayerModal p={modal.p} close={()=>setModal(null)} save={savePlayer}/>}
  {modal?.type==='table'&&<TableModal t={modal.t} close={()=>setModal(null)} save={saveTable}/>}
  {modal?.type==='competition'&&<CompetitionModal c={modal.c} close={()=>setModal(null)} save={saveCompetition}/>}
  </>;
}

function Panel({title,add,addText,children}){return <div className="panel"><div className="ph"><h3>{title}</h3>{add&&<button className="primary" onClick={add}>{addText}</button>}</div>{children}</div>}
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

function PlayerModal({p,close,save}){const x=p?.players||{};const[f,setF]=useState({playerId:x.id||'',first_name:x.first_name||'',last_name:x.last_name||'',phone:x.phone||'',email:x.email||'',club_name:x.club_name||''});return <Modal title={p?'Edit player':'Add player'} close={close}><form onSubmit={e=>{e.preventDefault();save(f)}}><label>First name<input required value={f.first_name} onChange={e=>setF({...f,first_name:e.target.value})}/></label><label>Last name<input required value={f.last_name} onChange={e=>setF({...f,last_name:e.target.value})}/></label><label>Phone<input value={f.phone} onChange={e=>setF({...f,phone:e.target.value})}/></label><label>Email<input type="email" value={f.email} onChange={e=>setF({...f,email:e.target.value})}/></label><label>Club<input value={f.club_name} onChange={e=>setF({...f,club_name:e.target.value})}/></label><div className="ma"><button type="button" onClick={close}>Cancel</button><button className="primary">Save changes</button></div></form></Modal>}
function CompetitionModal({c,close,save}){
  const[f,setF]=useState({
    name:c?.name||'',venue:c?.venue||'',start_date:c?.start_date||'',
    format:c?.format||'Singles',rules:c?.rules||'CNZ Rules',
    status:c?.status||'active',default_race_to:c?.default_race_to||3
  });
  return <Modal title="Edit competition" close={close}>
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
      <div className="ma"><button type="button" onClick={close}>Cancel</button><button className="primary">Save competition</button></div>
    </form>
  </Modal>
}

function TableModal({t,close,save}){const[f,setF]=useState({table_number:t?.table_number||'',table_type:t?.table_type||'Standard',notes:t?.notes||'',is_accessible:!!t?.is_accessible,status:t?.status||'available'});return <Modal title={t?'Edit table':'Add table'} close={close}><form onSubmit={e=>{e.preventDefault();save(f,t)}}><label>Table number<input required type="number" min="1" value={f.table_number} onChange={e=>setF({...f,table_number:e.target.value})}/></label><label>Table type<select value={f.table_type} onChange={e=>setF({...f,table_type:e.target.value})}><option>Standard</option><option>Accessible</option><option>Reserved / Unavailable</option></select></label><label className="check"><input type="checkbox" checked={f.is_accessible} onChange={e=>setF({...f,is_accessible:e.target.checked})}/> Accessible table ♿</label><label>Table notes<textarea value={f.notes} onChange={e=>setF({...f,notes:e.target.value})}/></label><div className="ma"><button type="button" onClick={close}>Cancel</button><button className="primary">Save</button></div></form></Modal>}

const css=`*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;background:#f5f7fa;color:#172033}button,input,select,textarea{font:inherit}button{cursor:pointer;border:1px solid #d8dee8;background:#fff;border-radius:8px;padding:9px 12px}.primary{background:#172033;color:#fff;border-color:#172033}.danger{color:#b42318}.link{border:0;background:none;color:#315fdb}.auth{min-height:100vh;display:grid;place-items:center}.card{background:#fff;padding:36px;border-radius:18px;box-shadow:0 12px 40px #0001;width:min(430px,92vw)}.card form{display:grid;gap:12px}.card input{padding:12px;border:1px solid #ccd3df;border-radius:8px}.error{color:#b42318}header{background:#fff;border-bottom:1px solid #e4e8ef;padding:15px 24px;display:flex;justify-content:space-between;align-items:center}header h1{margin:0;font-size:25px}.layout{display:grid;grid-template-columns:260px 1fr;max-width:1400px;margin:auto;min-height:calc(100vh - 72px)}aside{background:#fff;border-right:1px solid #e4e8ef;padding:15px}aside button{display:block;width:100%;text-align:left;border:0;margin-top:6px}aside small{display:block;color:#758096;margin-top:4px}.sel{background:#eef2ff}.content{padding:22px;max-width:1100px}.hero{background:#fff;border:1px solid #e3e7ee;border-radius:14px;padding:20px;display:flex;justify-content:space-between;margin-bottom:18px}.hero h2{margin:0 0 6px}.hero p{margin:0;color:#6a7587}.heroRight{display:flex;flex-direction:column;align-items:flex-end;gap:12px}.settingsSummary{display:flex;gap:12px;flex-wrap:wrap;margin-top:12px;color:#667085;font-size:13px}.settingsSummary span{background:#f5f7fa;padding:7px 9px;border-radius:7px}.settingNote{background:#f5f7fa;border:1px solid #e3e7ee;border-radius:8px;padding:10px;color:#667085;font-size:13px;line-height:1.4}.stats{display:flex;gap:15px;align-items:center;flex-wrap:wrap}.stats b{background:#f5f7fa;padding:10px 12px;border-radius:8px}.panel{background:#fff;border:1px solid #e3e7ee;border-radius:14px;margin-bottom:18px;padding:16px}.ph{display:flex;justify-content:space-between;align-items:center}.ph h3{margin:0}.row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid #edf0f4}.row small{display:block;color:#707b8d;margin-top:4px}.actions{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.qr{border:1px dashed #aab3c2;border-radius:6px;padding:8px;text-align:center;font-size:11px}.qrLarge{display:flex;justify-content:center;align-items:center;padding:8px}.qrLarge img{width:320px;height:320px;max-width:100%;image-rendering:auto}.scoreLink{padding:9px 12px;border:1px solid #d8dee8;border-radius:8px;text-decoration:none;color:#172033;background:#fff}.muted{color:#778194}.empty{padding:70px 30px}.notice{margin:14px auto;padding:10px 14px;background:#fff4e5;border:1px solid #ffd7a3;width:94%;border-radius:8px}.notice button{float:right;padding:2px 7px}.backdrop{position:fixed;inset:0;background:#0006;display:grid;place-items:center;padding:18px}.modal{background:#fff;width:min(520px,95vw);border-radius:14px;padding:18px}.mh{display:flex;justify-content:space-between;align-items:center}.modal form{display:grid;gap:12px}.modal label{display:grid;gap:5px;font-weight:600}.modal input,.modal select,.modal textarea{padding:10px;border:1px solid #ccd3df;border-radius:8px}.modal textarea{min-height:80px}.check{display:flex!important;align-items:center;gap:8px}.ma{display:flex;justify-content:flex-end;gap:8px}@media(max-width:850px){.heroRight{align-items:flex-start;margin-top:15px}.layout{grid-template-columns:1fr}aside{border-right:0;border-bottom:1px solid #e4e8ef}.hero{display:block}.row{flex-direction:column;align-items:flex-start}.actions{width:100%}}`;
