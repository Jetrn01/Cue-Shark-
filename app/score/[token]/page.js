'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

function PottersMateMark(){return <div className="pmScoreBrand"><svg viewBox="0 0 100 82" aria-hidden="true"><path d="M12 64 C24 31 43 12 69 12 C84 12 92 21 92 34 C92 48 81 56 66 56 L43 56 L36 70 L20 70 Z" fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"/><path d="M18 60 C27 40 39 28 52 22" fill="none" stroke="var(--pm-purple)" strokeWidth="8" strokeLinecap="round"/><circle cx="66" cy="34" r="17" fill="#0b0b0d" stroke="currentColor" strokeWidth="5"/><circle cx="66" cy="34" r="10" fill="#fff"/><text x="66" y="39" textAnchor="middle" fontSize="13" fontWeight="900" fill="#0b0b0d">8</text></svg><b>Potters<span>Mate</span></b></div>}

export default function ScorePage() {
  const params = useParams();
  const token = params?.token;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pendingWinner, setPendingWinner] = useState(null);

  useEffect(() => {
    if (token) load(token);
    const timer = token ? setInterval(() => load(token), 5000) : null;
    return () => { if (timer) clearInterval(timer); };
  }, [token]);

  async function load(tableToken) {
    setLoading(true);
    setError('');

    const { data: rawResult, error: rpcError } = await supabase.rpc(
      'get_public_table_match',
      { p_token: String(tableToken) }
    );

    if (rpcError) {
      setData(null);
      setError(rpcError.message);
      setLoading(false);
      return;
    }

    let result = rawResult;
    if (Array.isArray(result)) result = result[0] || null;
    if (typeof result === 'string') {
      try { result = JSON.parse(result); } catch (_) {}
    }

    if (!result || !result.match_id) {
      setData(result || null);
      setError('No current match is assigned to this table');
    } else {
      setData(result);
    }

    setLoading(false);
  }

  async function submitScore(player, winnerBalls = null) {
    if (!data?.match_id || ['completed','pending_confirmation','disputed'].includes(data.status) || busy) return;

    setBusy(true);
    setError('');

    const nextScore1 = score1 + (player === 1 ? 1 : 0);
    const nextScore2 = score2 + (player === 2 ? 1 : 0);

    const { data: rawUpdated, error: rpcError } = await supabase.rpc(
      'submit_public_score',
      {
        p_token: String(token),
        p_score1: nextScore1,
        p_score2: nextScore2,
        p_winner_balls: winnerBalls
      }
    );

    if (rpcError) {
      setError(rpcError.message);
    } else {
      let updated = rawUpdated;
      if (Array.isArray(updated)) updated = updated[0] || null;
      if (typeof updated === 'string') {
        try { updated = JSON.parse(updated); } catch (_) {}
      }

      if (updated?.match_id) {
        setData(updated);
        setPendingWinner(null);
      } else {
        setError('The score was not returned. Please refresh.');
      }
    }

    setBusy(false);
  }

  async function awardFrame(player) {
    if (!data?.match_id || ['completed','pending_confirmation','disputed'].includes(data.status) || busy) return;

    if (raceTo === 1) {
      setError('');
      setPendingWinner(player);
      return;
    }

    await submitScore(player, null);
  }


  const player1 = data?.player1_name || 'Player 1';
  const player2 = data?.player2_name || 'Player 2';
  const score1 = Number(data?.score1 || 0);
  const score2 = Number(data?.score2 || 0);
  const raceTo = Number(data?.race_to || 0);
  const completed = data?.status === 'completed';
  const winner = score1 > score2 ? player1 : score2 > score1 ? player2 : '';

  if (loading) {
    return (
      <>
        <style>{css}</style>
        <main className="scorePage">
          <header className="brand"><PottersMateMark/></header>
          <div className="card loading">Loading table…</div>
        </main>
      </>
    );
  }

  if (!data?.match_id) {
    return (
      <>
        <style>{css}</style>
        <main className="scorePage">
          <header className="brand"><PottersMateMark/></header>
          <div className="tableTitle">
            TABLE {data?.table_number || ''}{data?.is_accessible ? ' ♿' : ''}
          </div>
          <div className="card empty">
            <h1>{error && error !== 'No current match is assigned to this table' ? 'Scoring connection error' : 'No current match'}</h1>
            <p>{error || 'The organiser has not assigned a current match to this table yet.'}</p>
            <button className="secondary" onClick={() => load(token)}>↻ Refresh</button>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <style>{css}</style>
      <main className="scorePage">
        <header className="brand"><PottersMateMark/></header>
        <div className="tableTitle">
          TABLE {data.table_number}{data.is_accessible ? ' ♿' : ''}
        </div>

        <section className="card scoreCard">
          <div className="raceLabel">RACE TO <strong>{raceTo}</strong></div>

          {raceTo === 1 && pendingWinner ? (
            <div className="ballCountPanel">
              <h2>{pendingWinner === 1 ? player1 : player2} won the frame</h2>
              <p>How many balls did the winner have remaining?</p>
              <div className="ballChoices">
                {[0,1,2,3,4,5,6,7].map(n => (
                  <button key={n} className="ballChoice" disabled={busy} onClick={() => submitScore(pendingWinner, n)}>
                    {n}
                  </button>
                ))}
              </div>
              <button className="secondary" onClick={() => setPendingWinner(null)} disabled={busy}>← Back</button>
            </div>
          ) : null}

          <div className="players">
            <div className="playerBox">
              <div className="playerName">{player1}</div>
              <div className="scoreNumber">{score1}</div>
              <button
                className="frameButton"
                disabled={completed || busy}
                onClick={() => awardFrame(1)}
              >
                {busy ? 'Saving…' : 'PLAYER WON FRAME'}
              </button>
            </div>

            <div className="playerBox">
              <div className="playerName">{player2}</div>
              <div className="scoreNumber">{score2}</div>
              <button
                className="frameButton"
                disabled={completed || busy}
                onClick={() => awardFrame(2)}
              >
                {busy ? 'Saving…' : 'PLAYER WON FRAME'}
              </button>
            </div>
          </div>

          <div className="scoreLine">
            <strong>{player1}</strong>
            <span>{score1} — {score2}</span>
            <strong>{player2}</strong>
          </div>

          {completed ? (
            <div className="winner">
              <div className="trophy">🏆</div>
              <div>MATCH COMPLETE</div>
              <strong>{winner} wins {score1}–{score2}{raceTo === 1 && data?.winner_balls !== null && data?.winner_balls !== undefined ? ` · ${data.winner_balls} balls remaining` : ""}</strong>
              <small>Both players have confirmed this result.</small>
            </div>
          ) : data.status === 'pending_confirmation' ? (
            <div className="confirmationPanel">
              <div className="trophy">🔐</div>
              <div><strong>RESULT AWAITING CONFIRMATION</strong></div>
              <p>{winner} wins {score1}–{score2}. Both players must confirm this result before it becomes official.</p>
              <div className="confirmStates">
                <span className={data.p1_confirmed ? 'confirmed' : ''}>{data.player1_name}: {data.p1_confirmed ? '✓ Confirmed' : 'Waiting'}</span>
                <span className={data.p2_confirmed ? 'confirmed' : ''}>{data.player2_name}: {data.p2_confirmed ? '✓ Confirmed' : 'Waiting'}</span>
              </div>
              <a className="loginConfirm" href="/player/login">Player login → Confirm result</a>
            </div>
          ) : data.status === 'disputed' ? (
            <div className="confirmationPanel disputed">
              <div className="trophy">⚠️</div>
              <div><strong>RESULT DISPUTED</strong></div>
              <p>The players did not agree on this result. An organiser needs to review it.</p>
            </div>
          ) : (
            <p className="hint">After each frame, tap the button for the player who won it.</p>
          )}

          {error && <div className="error">{error}</div>}

          <button className="secondary refresh" onClick={() => load(token)} disabled={busy}>
            ↻ Refresh score
          </button>
        </section>
      </main>
    </>
  );
}

const css = `
*{box-sizing:border-box}
body{margin:0;font-family:Arial,Helvetica,sans-serif;background:#f5f7fa;color:#172033}
.scorePage{min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:32px 18px 48px}
.brand{display:flex;align-items:center;gap:12px;font-size:34px;font-weight:800;margin:8px 0 16px}
.ball{width:40px;height:40px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:#20263a;color:#fff;font-size:20px}
.tableTitle{font-size:20px;font-weight:800;letter-spacing:1.5px;margin-bottom:20px}
.card{width:min(760px,96vw);background:#fff;border:1px solid #e1e6ee;border-radius:20px;box-shadow:0 10px 30px #0000000d}
.scoreCard{padding:26px}
.raceLabel{text-align:center;font-size:20px;letter-spacing:1px;margin-bottom:22px}
.raceLabel strong{font-size:26px}
.ballCountPanel{border:1px solid #dfe4ec;border-radius:16px;padding:22px;text-align:center;margin-bottom:20px;background:#fafbfc}.ballCountPanel h2{margin:0 0 8px;font-size:24px}.ballCountPanel p{margin:0 0 18px;color:#667085;font-size:16px}.ballChoices{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px}.ballChoice{min-height:62px;font-size:25px;font-weight:800;border:1px solid #aab3c2;background:#fff;border-radius:12px;cursor:pointer}.ballChoice:disabled{opacity:.55;cursor:not-allowed}
.players{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.playerBox{border:1px solid #dfe4ec;border-radius:16px;padding:22px;text-align:center}
.playerName{font-size:25px;font-weight:800;min-height:58px;display:flex;align-items:center;justify-content:center}
.scoreNumber{font-size:76px;line-height:1;font-weight:900;margin:18px 0 22px}
.frameButton{width:100%;min-height:68px;font-size:19px;font-weight:800;border-radius:12px;border:1px solid #aab3c2;background:#f7f8fa;cursor:pointer}
.frameButton:disabled{opacity:.55;cursor:not-allowed}
.scoreLine{display:flex;align-items:center;justify-content:center;gap:14px;margin:22px 0;font-size:17px;flex-wrap:wrap}
.scoreLine span{font-size:24px;font-weight:900}
.winner{text-align:center;border-radius:14px;padding:18px;margin-top:12px;background:#eef7ee;font-size:20px}
.winner strong{display:block;margin-top:8px;font-size:22px}
.trophy{font-size:32px;margin-bottom:4px}
.hint{text-align:center;color:#667085;font-size:16px}.confirmationPanel{margin-top:12px;border:1px solid #d7c8f4;border-radius:14px;padding:18px;text-align:center;background:#faf7ff}.confirmationPanel p{color:#667085;line-height:1.45}.confirmationPanel small{display:block;color:#667085;margin-top:8px}.confirmationPanel.disputed{border-color:#f2d29a;background:#fffaf0}.confirmStates{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:14px 0}.confirmStates span{padding:9px;border:1px solid #dfe4ec;border-radius:9px;background:#fff;color:#667085;font-size:13px}.confirmStates .confirmed{border-color:#abefc6;background:#ecfdf3;color:#067647;font-weight:800}.loginConfirm{display:inline-block;padding:10px 14px;border-radius:9px;background:#10182a;color:#fff;text-decoration:none;font-weight:800;font-size:14px}
.error{color:#b42318;background:#fff1f0;border:1px solid #f1b7b2;border-radius:10px;padding:12px;margin-top:16px;text-align:center}
.secondary{border:1px solid #aab3c2;background:#fff;border-radius:10px;padding:12px 18px;font-size:16px;cursor:pointer}
.refresh{display:block;margin:18px auto 0}
.loading,.empty{padding:30px;text-align:center}
.empty h1{margin-top:0}
@media(max-width:600px){
  .brand{font-size:29px}
  .players{grid-template-columns:1fr}
  .playerName{min-height:0;font-size:23px}
  .scoreNumber{font-size:68px}
  .frameButton{min-height:74px;font-size:18px}
  .scoreCard{padding:18px}
}
`;
