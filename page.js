import { createClient } from "@supabase/supabase-js";

export default async function Home() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  let competitions = [];
  let error = null;

  if (url && key) {
    const supabase = createClient(url, key);
    const result = await supabase.from("competitions").select("*").order("start_date", { ascending: true });
    competitions = result.data || [];
    error = result.error?.message || null;
  }

  return (
    <main style={{maxWidth:1000,margin:"0 auto",padding:"28px 20px"}}>
      <header style={{background:"#111",color:"#fff",borderRadius:18,padding:28,marginBottom:24}}>
        <div style={{fontSize:14,letterSpacing:2,textTransform:"uppercase",opacity:.75}}>Cue Sport Tournament Management</div>
        <h1 style={{fontSize:44,margin:"8px 0"}}>🦈 Cue Shark</h1>
        <p style={{fontSize:18,margin:0}}>Run competitions. Track matches. Publish results.</p>
      </header>

      <section style={{background:"#fff",borderRadius:18,padding:24}}>
        <h2 style={{marginTop:0}}>Competitions</h2>
        {!url || !key ? (
          <p>Supabase connection is not configured yet.</p>
        ) : error ? (
          <p>Database connection error: {error}</p>
        ) : competitions.length === 0 ? (
          <p>No competitions yet. We'll add Cambridge vs New Plymouth next.</p>
        ) : (
          competitions.map(c => (
            <div key={c.id} style={{padding:"16px 0",borderBottom:"1px solid #ddd"}}>
              <strong>{c.name}</strong>
              <div>{c.venue || "Venue TBC"} · {c.start_date || "Date TBC"}</div>
              <small>{c.format || "Format TBC"} · {c.status || "upcoming"}</small>
            </div>
          ))
        )}
      </section>
    </main>
  );
}