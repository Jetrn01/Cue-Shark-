'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

export default function ScorePage({ params }) {
  const [token,setToken]=useState(''),[data,setData]=useState(null),[loading,setLoading]=useState(true),[msg,setMsg]=useState('');
  useEffect(()=>{Promise.resolve(params).then(p=>{setToken(p.token);load(p.token)})},[]);
  async function load(t){setLoading(true);const {data,error}=await supabase.rpc('get_public_table_match',{p_token:t});if(error)setMsg(error.message);else setData(data?.[0]||null);setLoading(false)}
  async function addPoint(side){if(!data)return;setMsg('');const s1=Number(data.score1||0)+(side===1?1:0),s2=Number(data.score2||0)+(side===2?1:0);if(s1>data.race_to||s2>data.race_to)return;const {data:r,error}=await supabase.rpc('submit_public_score',{p_token:token,p_score1:s1,p_score2:s2});if(error)setMsg(error.message);else setData(r?.[0]||null)}
  if(loading)return <><style>{css}</style><main className="score"><h1>🎱 PottersMate</h1><p>Loading table…</p></main>;
  if(!data)return <><style>{css}</style><main className="score"><h1>🎱 PottersMate</h1><div className="card"><h2>No match on this table</h2><p>{msg||'The organiser has not assigned a current match yet.'}</p><button onClick={()=>load(token)}>Refresh</button></div></main>;
  const done=data.status==='completed';
  return <><style>{css}</style><main className="score"><h1>🎱 PottersMate</h1><div className="tableTag">TABLE {data.table_number}{data.is_accessible?' ♿':''}</div><div className="match card"><p className="race">Race to {data.race_to}</p><div className="players"><div><strong>{data.player1_name||'Player 1'}</strong><span>{data.score1||0}</span><button disabled={done} onClick={()=>addPoint(1)}>+1</button></div><div><strong>{data.player2_name||'Player 2'}</strong><span>{data.score2||0}</span><button disabled={done} onClick={()=>addPoint(2)}>+1</button></div></div>{done?<div className="winner">🏆 Match complete — {data.score1>data.score2?data.player1_name:data.player2_name} wins</div>:<p className="hint">After each frame, tap the button for the player who won it.</p>}<button onClick={()=>load(token)}>↻ Refresh</button>{msg&&<p className="error">{msg}</p>}</div></main></>}

const css=`body{margin:0;font-family:Arial,sans-serif;background:#f5f7fa;color:#172033}.score{min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:30px 18px}.score h1{margin:10px 0 8px;font-size:30px}.tableTag{font-weight:800;letter-spacing:1px;margin:0 0 18px}.card{background:#fff;border:1px solid #e1e6ee;border-radius:18px;padding:22px;width:min(620px,94vw);box-shadow:0 10px 30px #0000000d}.race{text-align:center;font-weight:700}.players{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:22px 0}.players>div{border:1px solid #dfe4ec;border-radius:14px;padding:18px;text-align:center;display:grid;gap:10px}.players strong{font-size:21px}.players span{font-size:54px;font-weight:800}.players button{font-size:20px;padding:13px}.winner{text-align:center;font-weight:800;padding:15px;margin-bottom:15px;border-radius:10px;background:#eef7ee}.hint{text-align:center;color:#667085}.error{color:#b42318}@media(max-width:520px){.players{grid-template-columns:1fr}.players span{font-size:46px}}`;
