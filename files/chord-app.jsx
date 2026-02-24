import { useState } from "react";

const FEED = [
  { id: "1", username: "maren.k", displayName: "Maren", bio: "vinyl collector. always looking for the next sound.", distance: 45, visibility: "open", isConnected: false, requestSent: false, nowPlaying: { trackName: "Everything In Its Right Place", artistName: "Radiohead", albumArt: "https://i.scdn.co/image/ab67616d0000b273c8b444df094c68cf1c4e2327", genres: ["art rock", "alternative"] }, compatibility: 87, tasteProfile: { top_genres: { "art rock": 0.32, "alternative": 0.28, "shoegaze": 0.18, "post-punk": 0.12, "dream pop": 0.10 } }, recentTracks: [{ trackName: "Only Shallow", artistName: "My Bloody Valentine" }, { trackName: "Ceremony", artistName: "New Order" }, { trackName: "Silver Soul", artistName: "Beach House" }], connectionCount: 18 },
  { id: "2", username: "julius.wav", displayName: "Julius", bio: "producer. night owl. always in the studio.", distance: 120, visibility: "closed", isConnected: false, requestSent: false, nowPlaying: { trackName: "Voyager", artistName: "Daft Punk", albumArt: "https://i.scdn.co/image/ab67616d0000b2739b9b36b0e22870b9f542d937", genres: ["electronic", "french house"] }, compatibility: 74 },
  { id: "3", username: "ava.mp3", displayName: "Ava", bio: "if the bass isn't hitting i'm leaving.", distance: 200, visibility: "open", isConnected: true, requestSent: false, nowPlaying: { trackName: "Cellophane", artistName: "FKA twigs", albumArt: "https://i.scdn.co/image/ab67616d0000b2732b26462e76e1418b0a6a16bb", genres: ["art pop", "electronic", "experimental"] }, compatibility: 91, tasteProfile: { top_genres: { "art pop": 0.30, "electronic": 0.25, "r&b": 0.20, "experimental": 0.15, "trip-hop": 0.10 } }, recentTracks: [{ trackName: "Teardrop", artistName: "Massive Attack" }, { trackName: "Honey", artistName: "Robyn" }, { trackName: "Two Weeks", artistName: "Grizzly Bear" }], connectionCount: 23 },
  { id: "4", username: "tk_listens", displayName: "TK", bio: "coltrane forever.", distance: 310, visibility: "open", isConnected: false, requestSent: true, nowPlaying: { trackName: "A Love Supreme Pt. I", artistName: "John Coltrane", genres: ["jazz", "spiritual jazz"] }, compatibility: 62, tasteProfile: { top_genres: { "jazz": 0.45, "bebop": 0.20, "soul": 0.15, "blues": 0.12, "funk": 0.08 } }, recentTracks: [{ trackName: "So What", artistName: "Miles Davis" }], connectionCount: 9 },
  { id: "5", username: "sol.wav", displayName: "Sol", bio: "catching frequencies.", distance: 85, visibility: "closed", isConnected: true, requestSent: false, nowPlaying: { trackName: "Pink + White", artistName: "Frank Ocean", albumArt: "https://i.scdn.co/image/ab67616d0000b273c5649add07ed3720be9d5526", genres: ["r&b", "neo-soul"] }, compatibility: 79, tasteProfile: { top_genres: { "r&b": 0.35, "neo-soul": 0.25, "hip-hop": 0.20, "jazz": 0.12, "funk": 0.08 } }, recentTracks: [{ trackName: "Best Part", artistName: "Daniel Caesar" }, { trackName: "Redbone", artistName: "Childish Gambino" }], connectionCount: 41 },
];

const CONNECTIONS = [
  { id: "c1", user: { displayName: "Ava", username: "ava.mp3" }, lastMessage: "that bonobo track was insane", time: "2m", unread: 1 },
  { id: "c2", user: { displayName: "Sol", username: "sol.wav" }, lastMessage: "you going to that show friday?", time: "1h", unread: 0 },
  { id: "c3", user: { displayName: "Diana", username: "diana.flx" }, lastMessage: "just discovered this band omg", time: "3h", unread: 0 },
];

const REQUESTS = [{ id: "r1", user: { displayName: "Reece", username: "reece.h", bio: "ambient everything" } }];

const ACTIVITY = [
  { type: "artist", text: "maren.k is listening to Radiohead — 45m away", time: "now" },
  { type: "connection", text: "You and Sol are now connected", time: "8m" },
  { type: "genre", text: "3 people nearby are into electronic", time: "22m" },
  { type: "request", text: "reece.h wants to connect", time: "34m" },
];

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=IBM+Plex+Mono:wght@400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0b0b0e;--s1:#111114;--s2:#18181c;--bd:#1f1f25;--bd2:#2a2a32;--t:#f0f0f2;--t2:#9898a4;--t3:#5c5c68;--g:#34d399;--gd:#34d39918;--a:#fbbf24;--ad:#fbbf2418}
@keyframes e1{0%,100%{height:3px}50%{height:13px}}
@keyframes e2{0%,100%{height:7px}50%{height:3px}}
@keyframes e3{0%,100%{height:5px}50%{height:15px}}
@keyframes up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes sin{from{transform:translateX(100%)}to{transform:translateX(0)}}
@keyframes sout{from{transform:translateX(0)}to{transform:translateX(100%)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.eq{display:flex;gap:2px;align-items:flex-end;height:16px}
.eb{width:2.5px;border-radius:1px;background:var(--g)}
.eb:nth-child(1){animation:e1 .8s ease-in-out infinite}
.eb:nth-child(2){animation:e2 .65s ease-in-out infinite .1s}
.eb:nth-child(3){animation:e3 .75s ease-in-out infinite .2s}
.fi{animation:up .35s ease-out both}
.fi:nth-child(1){animation-delay:0s}.fi:nth-child(2){animation-delay:.04s}.fi:nth-child(3){animation-delay:.08s}.fi:nth-child(4){animation-delay:.12s}.fi:nth-child(5){animation-delay:.16s}
.din{animation:sin .32s cubic-bezier(.32,.72,0,1) both}
.dout{animation:sout .28s cubic-bezier(.32,.72,0,1) both}
`;

const m = "'IBM Plex Mono',monospace";
const sf = "'Instrument Sans',sans-serif";
const se = "'Instrument Serif',serif";

function Eq() { return <div className="eq"><div className="eb"/><div className="eb"/><div className="eb"/></div>; }

function Art({ src, sz = 52 }) {
  const [e, setE] = useState(false);
  const base = { width: sz, height: sz, borderRadius: 8, objectFit: "cover", background: "var(--s2)", flexShrink: 0 };
  if (!src || e) return <div style={{ ...base, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--t3)", fontSize: sz * .35 }}>♪</div>;
  return <img src={src} alt="" style={base} onError={() => setE(true)} />;
}

function Ini({ n, sz = 44 }) {
  return <div style={{ width: sz, height: sz, borderRadius: "50%", background: "var(--s2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: sz * .38, fontWeight: 600, color: "var(--t3)", flexShrink: 0 }}>{n?.[0]?.toUpperCase()}</div>;
}

function Cpill({ s }) {
  const bg = s >= 80 ? "var(--gd)" : s >= 65 ? "var(--ad)" : "var(--s2)";
  const c = s >= 80 ? "var(--g)" : s >= 65 ? "var(--a)" : "var(--t3)";
  return <span style={{ fontSize: 11, fontFamily: m, padding: "3px 9px", borderRadius: 20, background: bg, color: c }}>{s}%</span>;
}

function Gp({ g }) { return <span style={{ fontSize: 10, fontFamily: m, padding: "3px 10px", borderRadius: 20, background: "var(--s2)", color: "var(--t3)" }}>{g}</span>; }

function Lock() {
  return <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="var(--t3)" strokeWidth="1.5" style={{ verticalAlign: -1 }}><rect x="3" y="8" width="10" height="6" rx="1.5"/><path d="M5 8V5.5a3 3 0 016 0V8"/></svg>;
}

function Vis({ v }) { return v === "closed" ? <span style={{ fontSize: 10, fontFamily: m, color: "var(--t3)", display: "flex", alignItems: "center", gap: 3 }}><Lock/> closed</span> : null; }

function Cbar({ pct }) {
  const c = pct >= 80 ? "var(--g)" : pct >= 65 ? "var(--a)" : "var(--t3)";
  return <div style={{ height: 3, background: "var(--s2)", borderRadius: 2, overflow: "hidden" }}><div style={{ height: 3, borderRadius: 2, width: `${pct}%`, background: c, transition: "width .8s cubic-bezier(.32,.72,0,1)" }}/></div>;
}

function Label({ children }) { return <div style={{ fontSize: 11, fontFamily: m, color: "var(--t3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>{children}</div>; }

function FeedItem({ u, onTap, onConnect }) {
  return (
    <div className="fi" style={{ borderBottom: "1px solid var(--bd)" }}>
      <div style={{ display: "flex", gap: 14, padding: "16px 20px", cursor: "pointer" }} onClick={() => onTap(u)}>
        <Art src={u.nowPlaying?.albumArt} sz={52} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: "var(--t)" }}>{u.displayName}</span>
              <span style={{ fontSize: 12, fontFamily: m, color: "var(--t3)" }}>@{u.username}</span>
              <Vis v={u.visibility} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <Cpill s={u.compatibility} />
              <span style={{ fontSize: 11, fontFamily: m, color: "var(--t3)" }}>{u.distance}m</span>
            </div>
          </div>
          <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
            <Eq />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, color: "var(--t2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.nowPlaying?.trackName}</div>
              <div style={{ fontSize: 12, color: "var(--t3)" }}>{u.nowPlaying?.artistName}</div>
            </div>
          </div>
          {u.nowPlaying?.genres && <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>{u.nowPlaying.genres.slice(0, 3).map(g => <Gp key={g} g={g} />)}</div>}
        </div>
      </div>
      <div style={{ padding: "0 20px 14px" }}>
        {u.isConnected ? (
          <span style={{ fontSize: 12, fontFamily: m, color: "var(--g)", display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--g)" }}/> Connected</span>
        ) : u.requestSent ? (
          <span style={{ fontSize: 12, fontFamily: m, color: "var(--t3)" }}>Requested</span>
        ) : (
          <button onClick={e => { e.stopPropagation(); onConnect(u.id); }} style={{ fontSize: 12, fontWeight: 600, fontFamily: sf, padding: "7px 16px", background: "var(--t)", color: "var(--bg)", border: "none", borderRadius: 8, cursor: "pointer" }}>Connect</button>
        )}
      </div>
    </div>
  );
}

function Drawer({ u, onClose, onConnect, closing }) {
  if (!u) return null;
  const open = u.visibility === "open" || u.isConnected;
  return (
    <div className={closing ? "dout" : "din"} style={{ position: "absolute", inset: 0, background: "var(--bg)", zIndex: 100, overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", position: "sticky", top: 0, background: "var(--bg)", zIndex: 2, borderBottom: "1px solid var(--bd)" }}>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--t3)", fontSize: 13, fontFamily: sf, cursor: "pointer" }}>← Back</button>
        <span style={{ fontSize: 11, fontFamily: m, color: "var(--t3)" }}>{u.distance}m</span>
      </div>

      <div style={{ padding: "24px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
          <Ini n={u.displayName} sz={60} />
          <div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{u.displayName}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
              <span style={{ fontSize: 13, fontFamily: m, color: "var(--t3)" }}>@{u.username}</span>
              <Vis v={u.visibility} />
            </div>
          </div>
        </div>
        {u.bio && <p style={{ fontSize: 14, color: "var(--t2)", lineHeight: 1.6, marginBottom: 12 }}>{u.bio}</p>}
        {u.connectionCount != null && <span style={{ fontSize: 12, fontFamily: m, color: "var(--t3)" }}>{u.connectionCount} connections</span>}
      </div>

      {u.nowPlaying && (
        <div style={{ padding: 20, borderTop: "1px solid var(--bd)", marginTop: 16 }}>
          <Label>Now Playing</Label>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <Art src={u.nowPlaying.albumArt} sz={56} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 500 }}>{u.nowPlaying.trackName}</div>
              <div style={{ fontSize: 13, color: "var(--t3)", marginTop: 2 }}>{u.nowPlaying.artistName}</div>
            </div>
            <Eq />
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 10, flexWrap: "wrap" }}>{u.nowPlaying.genres?.map(g => <Gp key={g} g={g} />)}</div>
        </div>
      )}

      <div style={{ padding: 20, borderTop: "1px solid var(--bd)" }}>
        <Label>Compatibility</Label>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 36, fontWeight: 300, fontFamily: se, fontStyle: "italic" }}>{u.compatibility}%</span>
          <span style={{ fontSize: 12, color: "var(--t3)" }}>taste match</span>
        </div>
        <Cbar pct={u.compatibility} />
      </div>

      {open ? (
        <>
          {u.tasteProfile && (
            <div style={{ padding: 20, borderTop: "1px solid var(--bd)" }}>
              <Label>Taste DNA</Label>
              {Object.entries(u.tasteProfile.top_genres).slice(0, 5).map(([g, w]) => (
                <div key={g} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--t2)", width: 100 }}>{g}</span>
                  <div style={{ flex: 1, height: 3, background: "var(--s2)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: 3, borderRadius: 2, width: `${w * 100}%`, background: "var(--t3)", transition: "width .6s" }} />
                  </div>
                  <span style={{ fontSize: 11, fontFamily: m, color: "var(--t3)", width: 32, textAlign: "right" }}>{Math.round(w * 100)}%</span>
                </div>
              ))}
            </div>
          )}
          {u.recentTracks && (
            <div style={{ padding: 20, borderTop: "1px solid var(--bd)" }}>
              <Label>Recent</Label>
              {u.recentTracks.map((t, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                  <Art src={t.albumArt} sz={36} />
                  <div><div style={{ fontSize: 13, color: "var(--t2)" }}>{t.trackName}</div><div style={{ fontSize: 11, color: "var(--t3)" }}>{t.artistName}</div></div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div style={{ padding: "30px 20px", borderTop: "1px solid var(--bd)", textAlign: "center" }}>
          <div style={{ fontSize: 13, color: "var(--t3)", marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Lock /> This account is closed</div>
          <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 16 }}>Connect to see their full listening history and taste profile</div>
          {!u.isConnected && !u.requestSent && (
            <button onClick={() => onConnect(u.id)} style={{ fontSize: 13, fontWeight: 600, fontFamily: sf, padding: "10px 24px", background: "var(--t)", color: "var(--bg)", border: "none", borderRadius: 8, cursor: "pointer" }}>Connect to Unlock</button>
          )}
        </div>
      )}

      <div style={{ padding: 20, borderTop: "1px solid var(--bd)", display: "flex", gap: 8 }}>
        {u.isConnected ? (
          <button style={{ flex: 1, fontSize: 14, fontWeight: 600, fontFamily: sf, padding: "12px", background: "var(--t)", color: "var(--bg)", border: "none", borderRadius: 10, cursor: "pointer" }}>Message</button>
        ) : u.requestSent ? (
          <button style={{ flex: 1, fontSize: 14, fontFamily: sf, padding: "12px", background: "var(--s2)", color: "var(--t3)", border: "1px solid var(--bd)", borderRadius: 10 }} disabled>Requested</button>
        ) : (
          <button onClick={() => onConnect(u.id)} style={{ flex: 1, fontSize: 14, fontWeight: 600, fontFamily: sf, padding: "12px", background: "var(--t)", color: "var(--bg)", border: "none", borderRadius: 10, cursor: "pointer" }}>Connect</button>
        )}
      </div>
      <div style={{ height: 40 }} />
    </div>
  );
}

export default function Chord() {
  const [tab, setTab] = useState("frequency");
  const [sel, setSel] = useState(null);
  const [closing, setClosing] = useState(false);
  const [sent, setSent] = useState(new Set());
  const [feed, setFeed] = useState(FEED);

  const connect = (id) => { setSent(p => new Set([...p, id])); setFeed(p => p.map(u => u.id === id ? { ...u, requestSent: true } : u)); };
  const close = () => { setClosing(true); setTimeout(() => { setSel(null); setClosing(false); }, 280); };
  const unread = CONNECTIONS.reduce((s, c) => s + c.unread, 0) + REQUESTS.length;

  return (
    <div style={{ fontFamily: sf, background: "var(--bg)", color: "var(--t)", minHeight: "100vh", maxWidth: 430, margin: "0 auto", position: "relative", overflow: "hidden" }}>
      <style>{CSS}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 20px", borderBottom: "1px solid var(--bd)" }}>
        <span style={{ fontFamily: se, fontSize: 24, fontStyle: "italic" }}>chord</span>
        <span style={{ fontSize: 11, fontFamily: m, color: "var(--g)", display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--g)", animation: "pulse 2s infinite" }} />
          {feed.length} nearby
        </span>
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid var(--bd)" }}>
        {[["frequency", "Frequency"], ["connections", "Connections"], ["activity", "Activity"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            flex: 1, padding: "13px 0", textAlign: "center", fontSize: 12, fontFamily: m,
            letterSpacing: .8, textTransform: "uppercase",
            color: tab === k ? "var(--t)" : "var(--t3)",
            background: "none", border: "none",
            borderBottom: tab === k ? "1.5px solid var(--t)" : "1.5px solid transparent",
            cursor: "pointer", position: "relative",
          }}>
            {l}
            {k === "connections" && unread > 0 && <span style={{ position: "absolute", top: 10, marginLeft: 4, width: 6, height: 6, borderRadius: "50%", background: "var(--t)" }} />}
          </button>
        ))}
      </div>

      {tab === "frequency" && feed.map(u => <FeedItem key={u.id} u={{ ...u, requestSent: u.requestSent || sent.has(u.id) }} onTap={setSel} onConnect={connect} />)}

      {tab === "connections" && (
        <>
          {REQUESTS.length > 0 && (
            <div style={{ borderBottom: "1px solid var(--bd)" }}>
              <div style={{ padding: "14px 20px 8px", fontSize: 11, fontFamily: m, color: "var(--t3)", textTransform: "uppercase", letterSpacing: 1 }}>Requests</div>
              {REQUESTS.map(r => (
                <div key={r.id} className="fi" style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 20px" }}>
                  <Ini n={r.user.displayName} sz={40} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{r.user.displayName} <span style={{ fontWeight: 400, fontSize: 12, color: "var(--t3)" }}>@{r.user.username}</span></div>
                    <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 1 }}>{r.user.bio}</div>
                  </div>
                  <button style={{ fontSize: 12, fontWeight: 600, fontFamily: sf, padding: "6px 12px", background: "var(--t)", color: "var(--bg)", border: "none", borderRadius: 8, cursor: "pointer" }}>Accept</button>
                </div>
              ))}
            </div>
          )}
          <div style={{ padding: "14px 20px 8px", fontSize: 11, fontFamily: m, color: "var(--t3)", textTransform: "uppercase", letterSpacing: 1 }}>Messages</div>
          {CONNECTIONS.map(c => (
            <div key={c.id} className="fi" style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", borderBottom: "1px solid var(--bd)", cursor: "pointer" }}>
              <Ini n={c.user.displayName} sz={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 14, fontWeight: c.unread ? 600 : 500 }}>{c.user.displayName}</span>
                  <span style={{ fontSize: 11, fontFamily: m, color: "var(--t3)" }}>{c.time}</span>
                </div>
                <div style={{ fontSize: 13, color: c.unread ? "var(--t2)" : "var(--t3)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: c.unread ? 500 : 400 }}>{c.lastMessage}</div>
              </div>
              {c.unread > 0 && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--t)" }} />}
            </div>
          ))}
        </>
      )}

      {tab === "activity" && ACTIVITY.map((n, i) => (
        <div key={i} className="fi" style={{ display: "flex", gap: 12, padding: "14px 20px", borderBottom: "1px solid var(--bd)", alignItems: "flex-start" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", marginTop: 6, flexShrink: 0, background: n.type === "connection" ? "var(--g)" : n.type === "artist" ? "var(--t)" : n.type === "request" ? "var(--a)" : "var(--t3)" }} />
          <div style={{ flex: 1 }}><div style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.5 }}>{n.text}</div><div style={{ fontSize: 11, fontFamily: m, color: "var(--t3)", marginTop: 4 }}>{n.time}</div></div>
        </div>
      ))}

      <div style={{ position: "sticky", bottom: 0, background: `linear-gradient(transparent, var(--bg) 30%)`, padding: "28px 16px 14px", pointerEvents: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", background: "var(--s1)", borderRadius: 12, border: "1px solid var(--bd)", pointerEvents: "auto" }}>
          <Art src="https://i.scdn.co/image/ab67616d0000b273c8b444df094c68cf1c4e2327" sz={38} />
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Everything In Its Right Place</div><div style={{ fontSize: 11, color: "var(--t3)" }}>Radiohead</div></div>
          <Eq />
        </div>
      </div>

      {sel && <Drawer u={{ ...sel, requestSent: sel.requestSent || sent.has(sel.id) }} onClose={close} onConnect={(id) => { connect(id); close(); }} closing={closing} />}
    </div>
  );
}
