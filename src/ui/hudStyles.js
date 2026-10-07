// All HUD CSS lives here and is injected once from JS (we may not touch index.html).
export const HUD_CSS = `
:root { --vb-pink:#ff2d95; --vb-cyan:#19e3ff; --vb-gold:#ffd24a; --vb-ink:#0b0618; --vb-font: Impact, Haettenschweiler, "Arial Narrow Bold", "Franklin Gothic Medium", "Arial Narrow", sans-serif; }
#hud-root { position:absolute; inset:0; overflow:hidden; font-family:var(--vb-font); color:#fff; text-transform:uppercase; user-select:none; -webkit-user-select:none; }
#hud-root .vb-skew { font-style:italic; letter-spacing:.06em; }
#hud-root.vb-hidden .vb-hud { opacity:0; }
.vb-hud { transition:opacity .5s; }

/* top-right stack */
.vb-tr { position:absolute; top:18px; right:22px; display:flex; flex-direction:column; align-items:flex-end; gap:4px; text-shadow:0 2px 0 rgba(0,0,0,.7), 0 0 12px rgba(0,0,0,.6); }
.vb-clock { font-size:20px; letter-spacing:.14em; color:var(--vb-cyan); font-style:italic; }
.vb-money { font-size:44px; line-height:1; font-style:italic; letter-spacing:.04em; color:#fff; -webkit-text-stroke:1px rgba(0,0,0,.5); position:relative; }
.vb-money b { color:var(--vb-gold); font-weight:normal; margin-right:2px; }
.vb-money.pulse { animation:vbMoney .5s ease-out; }
@keyframes vbMoney { 0%{transform:scale(1.18); color:var(--vb-gold)} 100%{transform:scale(1)} }
.vb-delta { position:absolute; right:0; top:100%; font-size:20px; color:#7dff9b; opacity:0; white-space:nowrap; }
.vb-delta.show { animation:vbDelta 1.6s ease-out; }
.vb-delta.neg { color:#ff5c7a; }
@keyframes vbDelta { 0%{opacity:0; transform:translateY(-6px)} 12%{opacity:1} 80%{opacity:1} 100%{opacity:0; transform:translateY(8px)} }
.vb-stars { font-size:30px; letter-spacing:.12em; margin-top:10px; display:flex; gap:2px; min-height:34px; }
.vb-stars span { color:rgba(255,255,255,.18); text-shadow:none; transition:color .2s; }
.vb-stars span.on { color:var(--vb-gold); text-shadow:0 0 10px rgba(255,210,74,.8), 0 2px 0 rgba(0,0,0,.6); }
.vb-stars.flash span.on { animation:vbStar .22s steps(2) 8; }
@keyframes vbStar { 0%{color:#ff2d55; text-shadow:0 0 12px #ff2d55} 100%{color:#2d6bff; text-shadow:0 0 12px #2d6bff} }
.vb-weapon { margin-top:4px; padding:4px 12px 4px 16px; background:linear-gradient(90deg, rgba(11,6,24,0), rgba(11,6,24,.72) 30%); border-right:3px solid var(--vb-pink); font-size:20px; letter-spacing:.1em; font-style:italic; }
.vb-weapon i { color:var(--vb-cyan); font-style:normal; margin-left:10px; }

/* minimap + bars */
.vb-mapwrap { position:absolute; left:22px; bottom:22px; width:210px; }
.vb-map { width:210px; height:210px; border-radius:50%; border:3px solid var(--vb-pink); box-shadow:0 0 0 3px rgba(11,6,24,.85), 0 0 22px rgba(255,45,149,.55), inset 0 0 18px rgba(0,0,0,.6); background:#0a2440; display:block; }
.vb-bars { margin-top:10px; display:flex; flex-direction:column; gap:5px; }
.vb-bar { height:12px; background:rgba(11,6,24,.8); border:2px solid rgba(255,255,255,.85); transform:skewX(-18deg); overflow:hidden; box-shadow:0 2px 6px rgba(0,0,0,.5); }
.vb-bar > div { height:100%; width:100%; transition:width .25s; }
.vb-hp > div { background:linear-gradient(90deg,#ff2d55,#ff7aa8); }
.vb-ar > div { background:linear-gradient(90deg,#19a9ff,#19e3ff); }
.vb-hp.low { animation:vbLow .6s infinite alternate; }
@keyframes vbLow { to { border-color:#ff2d55; box-shadow:0 0 14px #ff2d55; } }

/* speedometer */
.vb-speed { position:absolute; right:26px; bottom:26px; text-align:right; text-shadow:0 2px 0 rgba(0,0,0,.7), 0 0 14px rgba(0,0,0,.6); transition:opacity .25s, transform .25s; opacity:0; transform:translateY(10px); }
.vb-speed.on { opacity:1; transform:none; }
.vb-speed .n { font-size:78px; line-height:.9; font-style:italic; color:#fff; }
.vb-speed .u { font-size:20px; letter-spacing:.2em; color:var(--vb-cyan); font-style:italic; }
.vb-speed .bar { width:180px; height:6px; margin:6px 0 0 auto; background:rgba(255,255,255,.18); transform:skewX(-25deg); }
.vb-speed .bar div { height:100%; width:0; background:linear-gradient(90deg,var(--vb-cyan),var(--vb-pink)); }

/* district */
.vb-district { position:absolute; left:50%; bottom:14%; transform:translateX(-50%); font-size:54px; font-style:italic; letter-spacing:.16em; white-space:nowrap; color:#fff; opacity:0; text-shadow:0 0 18px var(--vb-pink), 0 3px 0 rgba(0,0,0,.7); }
.vb-district.show { animation:vbDist 3.6s ease-out; }
@keyframes vbDist { 0%{opacity:0; transform:translateX(-50%) translateY(14px)} 15%{opacity:1; transform:translateX(-50%)} 75%{opacity:1} 100%{opacity:0} }

/* mission panel */
.vb-mission { position:absolute; top:18px; left:50%; transform:translateX(-50%); min-width:300px; max-width:520px; text-align:center; padding:8px 22px 10px; background:linear-gradient(180deg, rgba(11,6,24,.78), rgba(11,6,24,.5)); border-bottom:3px solid var(--vb-cyan); display:none; text-shadow:0 2px 0 rgba(0,0,0,.6); }
.vb-mission.on { display:block; }
.vb-mission .t { font-size:14px; letter-spacing:.3em; color:var(--vb-pink); }
.vb-mission .o { font-size:24px; letter-spacing:.06em; font-style:italic; margin-top:2px; }
.vb-mission .p { font-size:15px; letter-spacing:.2em; color:var(--vb-cyan); }
.vb-mission .tm { font-size:38px; font-style:italic; color:var(--vb-gold); line-height:1.1; }
.vb-mission .tm.low { color:#ff3355; animation:vbLow2 .5s infinite alternate; }
@keyframes vbLow2 { to { transform:scale(1.12); } }

/* messages */
.vb-msgs { position:absolute; left:22px; top:18px; width:380px; display:flex; flex-direction:column; gap:6px; }
.vb-msg { padding:7px 14px; background:rgba(11,6,24,.78); border-left:4px solid var(--vb-cyan); font-size:19px; letter-spacing:.05em; font-style:italic; animation:vbIn .25s ease-out; transition:opacity .5s, transform .5s; text-shadow:0 1px 0 #000; }
.vb-msg.out { opacity:0; transform:translateX(-30px); }
@keyframes vbIn { from{opacity:0; transform:translateX(-30px)} }

/* big text */
.vb-big { position:absolute; left:0; right:0; top:34%; text-align:center; font-size:128px; font-style:italic; letter-spacing:.08em; line-height:1; pointer-events:none; opacity:0; -webkit-text-stroke:2px rgba(0,0,0,.55); text-shadow:0 6px 0 rgba(0,0,0,.55), 0 0 40px currentColor; }
.vb-big.show { animation:vbBig var(--dur,3s) ease-out forwards; }
@keyframes vbBig { 0%{opacity:0; transform:scale(2.2)} 8%{opacity:1; transform:scale(1)} 85%{opacity:1; transform:scale(1.04)} 100%{opacity:0; transform:scale(1.1)} }

/* title screen */
.vb-title { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; background:radial-gradient(ellipse at 50% 40%, rgba(255,45,149,.28), rgba(11,6,24,.82) 70%), linear-gradient(180deg, rgba(25,227,255,.12), rgba(11,6,24,.65)); transition:opacity .6s; z-index:5; }
.vb-title.gone { opacity:0; }
.vb-title .g { font-size:34px; letter-spacing:.5em; color:var(--vb-cyan); font-style:italic; text-shadow:0 0 14px var(--vb-cyan); }
.vb-title h1 { margin:0; font-weight:normal; font-size:150px; line-height:.95; font-style:italic; letter-spacing:.04em; background:linear-gradient(180deg,#fff 0%,#ffb8dd 35%,var(--vb-pink) 60%,#7a1fff 100%); -webkit-background-clip:text; background-clip:text; color:transparent; filter:drop-shadow(0 6px 0 rgba(0,0,0,.6)) drop-shadow(0 0 30px rgba(255,45,149,.55)); }
.vb-title h2 { margin:6px 0 0; font-weight:normal; font-size:62px; letter-spacing:.7em; margin-right:-.7em; color:#fff; font-style:italic; text-shadow:0 0 20px var(--vb-cyan), 0 4px 0 rgba(0,0,0,.6); }
.vb-title .play { margin-top:34px; font-size:30px; letter-spacing:.3em; color:var(--vb-gold); animation:vbBlink 1.1s infinite alternate; text-shadow:0 0 14px rgba(255,210,74,.7); }
@keyframes vbBlink { from{opacity:1} to{opacity:.25} }
.vb-keys { margin-top:30px; display:grid; grid-template-columns:repeat(2, auto); gap:6px 34px; font-size:17px; letter-spacing:.1em; color:rgba(255,255,255,.88); }
.vb-keys b { color:var(--vb-cyan); font-weight:normal; display:inline-block; min-width:110px; }

/* pause menu */
.vb-pause { position:absolute; inset:0; display:none; align-items:center; justify-content:center; flex-direction:column; background:rgba(11,6,24,.72); backdrop-filter:blur(4px); z-index:6; }
.vb-pause.on { display:flex; }
.vb-pause h3 { margin:0 0 18px; font-weight:normal; font-size:76px; font-style:italic; letter-spacing:.2em; color:var(--vb-pink); text-shadow:0 0 24px rgba(255,45,149,.7), 0 4px 0 #000; }
.vb-btn { display:block; width:340px; margin:6px 0; padding:11px 0; text-align:center; font-family:var(--vb-font); font-size:26px; letter-spacing:.2em; font-style:italic; text-transform:uppercase; color:#fff; background:rgba(255,255,255,.06); border:2px solid rgba(255,255,255,.55); transform:skewX(-14deg); cursor:pointer; transition:background .12s, border-color .12s, color .12s; }
.vb-btn:hover { background:var(--vb-pink); border-color:var(--vb-pink); }
.vb-pause .vb-keys { background:rgba(11,6,24,.8); padding:16px 26px; border:2px solid var(--vb-cyan); margin-top:14px; display:none; }
.vb-pause .vb-keys.on { display:grid; }
`;
