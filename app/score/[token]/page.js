'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

export default function ScorePage() {
  const { token } = useParams();
  const [match, setMatch] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (token) loadMatch();
  }, [token]);

  async function loadMatch() {
    setLoading(true);
    setMessage('');
    const { data, error } = await supabase.rpc('get_table_score', {
      p_token: token
    });
    if (error) {
      setMessage(error.message);
      setMatch(null);
    } else {
      setMatch(data);
    }
    setLoading(false);
  }

  async function addPoint(player) {
    if (!match || match.status === 'completed' || saving) return;
    setSaving(true);
    setMessage('');

    const { data, error } = await supabase.rpc('record_table_score', {
      p_token: token,
      p_player: player
    });

    if (error) setMessage(error.message);
    else setMatch(data);

    setSaving(false);
  }

  if (loading) return <><style>{css}</style><main className="score"><h1>🎱 PottersMate</h1><p>Loading table…</p></main></>;

  if (!match) return <><style>{css}</style><main className="score"><h1>🎱 PottersMate</h1><div className="card"><h2>No current match</h2><p>{message || 'The organiser has not assigned a current match to this table yet.'}</p><button onClick={loadMatch}>↻ Refresh</button></div></main></>;

  const done = match.status === 'completed';
  const winner = Number(match.score1) > Number(match.score2) ? match.player1_name : match.player2_name;

  return (
    <>
      <style>{css}</style>
      <main className="score">
        <h1>🎱 PottersMate</h1>
        <div className="tableTag">TABLE {match.table_number}{match.is_accessible ? ' ♿' : ''}</div>

        <div className="card">
          <p className="race">Race to {match.race_to}</p>

          <div className="players">
            <div className="player">
              <strong>{match.player1_name || 'Player 1'}</strong>
              <span>{match.score1}</span>
              <button disabled={done || saving} onClick={() => addPoint(1)}>+1</button>
            </div>

            <div className="player">
              <strong>{match.player2_name || 'Player 2'}</strong>
              <span>{match.score2}</span>
              <button disabled={done || saving} onClick={() => addPoint(2)}>+1</button>
            </div>
          </div>

          {done && <div className="winner">🏆 Match complete — {winner || 'Winner'} wins</div>}

          {!done && (
            <p className="hint">
              After each frame, tap +1 for the player who won the frame.
            </p>
          )}

          {message && <p className="error">{message}</p>}
          <button onClick={loadMatch} disabled={saving}>↻ Refresh</button>
        </div>
      </main>
    </>
  );
}

const css = `
body{margin:0;font-family:Arial,sans-serif;background:#f5f7fa;color:#172033}
.score{min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:30px 18px}
.score h1{margin:10px 0 8px;font-size:30px}
.tableTag{font-weight:800;letter-spacing:1px;margin:0 0 18px}
.card{background:#fff;border:1px solid #e1e6ee;border-radius:18px;padding:22px;width:min(620px,94vw);box-shadow:0 10px 30px #0000000d}
.race{text-align:center;font-weight:700}
.players{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:22px 0}
.player{border:1px solid #dfe4ec;border-radius:14px;padding:18px;text-align:center;display:grid;gap:10px}
.player strong{font-size:21px}
.player span{font-size:54px;font-weight:800}
.player button{font-size:22px;padding:15px}
.winner{text-align:center;font-weight:800;padding:15px;margin-bottom:15px;border-radius:10px;background:#eef7ee}
.hint{text-align:center;color:#667085}
.error{color:#b42318}
@media(max-width:520px){.players{grid-template-columns:1fr}.player span{font-size:46px}}
`;
