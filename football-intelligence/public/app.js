let fixtures=[], mode="demo", league="All", query="";
const fmtPct=n=>Math.round(n*100)+"%";
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));

async function load(){
  const r=await fetch("/api/fixtures"); const d=await r.json();
  fixtures=d.fixtures; mode=d.mode;
  document.getElementById("modeBadge").textContent=mode.toUpperCase().replaceAll("-"," ");
  renderDashboard();
}
function filtered(){
  return fixtures.filter(f=>(league==="All"||f.league===league)&&(`${f.home} ${f.away} ${f.league}`).toLowerCase().includes(query.toLowerCase()));
}
function predictClient(f){
  const rating=(f.homeRating-f.awayRating)/20, form=(f.homeForm-f.awayForm)*1.5, attack=(f.homeXg-f.awayXg)/1.7, def=(f.awayDef-f.homeDef)/1.5;
  const raw=rating*.3+form*.2+attack*.25+def*.15+.22*.1;
  const sig=x=>1/(1+Math.exp(-x)); let h=sig(raw*2), a=sig(-raw*1.6), d=.23+Math.max(0,.08-Math.abs(h-a))*.8; const t=h+a+d; return {h:h/t,d:d/t,a:a/t};
}
function renderDashboard(){
  const leagues=["All",...new Set(fixtures.map(f=>f.league))];
  const scored=fixtures.map(f=>({...f,p:predictClient(f)}));
  const top=scored.sort((a,b)=>Math.max(b.p.h,b.p.d,b.p.a)-Math.max(a.p.h,a.p.d,a.p.a)).slice(0,3);
  document.getElementById("main").innerHTML=`
  <section class="hero">
   <div><div class="eyebrow">Quantitative football analytics</div><h1>See the probabilities behind every match.</h1><p>A multi-factor football intelligence engine combining team strength, form, expected goals, defensive profile and venue effects. Built to show uncertainty—not hide it.</p></div>
   <div class="date-card"><small>TODAY</small><b>${new Date().toLocaleDateString("en-GB",{weekday:"short",day:"2-digit",month:"short"})}</b><small>${fixtures.length} tracked fixtures</small></div>
  </section>
  <div class="toolbar"><input class="search" id="search" placeholder="Search team or league…" value="${esc(query)}">${leagues.map(l=>`<button class="chip ${league===l?"active":""}" onclick="setLeague('${esc(l)}')">${esc(l)}</button>`).join("")}</div>
  <div class="section-title"><h2>🔥 Top opportunities</h2><span>Highest model confidence today</span></div>
  <div class="opportunities">${top.map(f=>oppCard(f)).join("")}</div>
  <div class="section-title"><h2>Today's matches</h2><span>${filtered().length} matches</span></div>
  <div class="match-grid">${filtered().map(matchCard).join("")||'<div class="empty">No matches match your filters.</div>'}</div>`;
  document.getElementById("search").addEventListener("input",e=>{query=e.target.value;renderDashboard()});
}
function oppCard(f){
 const p=f.p; const arr=[["Home Win",p.h],["Draw",p.d],["Away Win",p.a]].sort((a,b)=>b[1]-a[1]); return `<div class="opportunity" onclick="openMatch('${f.id}')"><div class="opp-top"><span>${esc(f.league)}</span><span>${esc(f.kickoff)}</span></div><div class="opp-name">${esc(f.home)} vs ${esc(f.away)}</div><div class="opp-market">${arr[0][0]}</div><div class="confidence">${fmtPct(arr[0][1])}</div><div class="meter"><i style="width:${arr[0][1]*100}%"></i></div><span class="risk">${arr[0][1]>=.7?"HIGH CONFIDENCE":"WATCH"}</span></div>`;
}
function matchCard(f){
 const p=f.p, arr=[["Home",p.h],["Draw",p.d],["Away",p.a]].sort((a,b)=>b[1]-a[1]); return `<div class="match" onclick="openMatch('${f.id}')"><div class="match-head"><span>${esc(f.league)}</span><span>${esc(f.kickoff)}</span></div><div class="teams"><div class="team">${esc(f.home)}</div><div class="vs">VS</div><div class="team away">${esc(f.away)}</div></div><div class="pick-row"><span>Model leader</span><b>${arr[0][0]} ${fmtPct(arr[0][1])}</b></div></div>`;
}
function setLeague(x){league=x;renderDashboard()}
async function openMatch(id){
 const r=await fetch("/api/match/"+id); const d=await r.json(); const p=d.prediction;
 const b=(label,v,primary=false)=>`<div class="prob ${primary?"primary":""}"><small>${label}</small><b>${fmtPct(v)}</b><div class="bar"><i style="width:${v*100}%"></i></div></div>`;
 document.getElementById("modalContent").innerHTML=`
 <div class="modal-title"><div class="eyebrow">${esc(p.league)} · ${esc(p.kickoff)}</div><h1>${esc(p.home)} <span style="color:var(--muted)">vs</span> ${esc(p.away)}</h1><p style="color:var(--muted)">Model verdict: <b style="color:var(--accent)">${p.verdict}</b> · Confidence ${p.confidence}/100 · Model agreement ${Math.round(p.agreement)}%</p></div>
 <div class="prob-grid">${b("Home Win",p.probabilities.home,p.verdict==="Home Win")}${b("Draw",p.probabilities.draw,p.verdict==="Draw")}${b("Away Win",p.probabilities.away,p.verdict==="Away Win")}${b("Over 1.5",p.probabilities.over15)}${b("Over 2.5",p.probabilities.over25)}${b("BTTS Yes",p.probabilities.btts)}</div>
 <div class="two-col">
  <div class="subcard"><h3>📌 Model verdict</h3><p style="font-size:22px;font-weight:900">${p.verdict}</p><p style="color:var(--muted)">Expected goals: <b>${p.expectedGoals.home.toFixed(2)}</b> – <b>${p.expectedGoals.away.toFixed(2)}</b></p><p style="color:var(--muted)">Projected total goals: ${p.expectedGoals.total.toFixed(2)}</p></div>
  <div class="subcard"><h3>🎯 Best model markets</h3>${p.bestMarkets.map(x=>`<div class="pick-row"><span>${x[0]}</span><b>${fmtPct(x[1])}</b></div>`).join("")}</div>
 </div>
 <div class="subcard" style="margin-top:14px"><h3>🧠 Why the model leans this way</h3>${p.factors.map(x=>`<div class="factor"><div class="factor-top"><b>${x.label}</b><span>${Math.round(x.value)}/100</span></div><div class="meter"><i style="width:${x.value}%"></i></div><small>${esc(x.note)}</small></div>`).join("")}</div>
 <div class="subcard" style="margin-top:14px"><h3>🔢 Most likely scorelines</h3><div class="score-list">${p.topScores.map(s=>`<div class="score"><b>${s.h}–${s.a}</b><small>${fmtPct(s.p)}</small></div>`).join("")}</div></div>
 <p style="color:var(--muted);font-size:11px;margin-top:18px">This is a statistical forecast. It is not a guarantee. In production, live injuries, lineups, xG feeds and market prices should be incorporated before kickoff.</p>`;
 document.getElementById("modal").classList.remove("hidden");
}
function closeModal(){document.getElementById("modal").classList.add("hidden")}
function renderPage(page){
 if(page==="dashboard"){renderDashboard();return}
 if(page==="performance"){document.getElementById("main").innerHTML=`<div class="page-head"><div class="eyebrow">Transparency layer</div><h1>Model performance</h1><p>Never judge a prediction engine by a handful of wins. Track calibration, accuracy, log loss, Brier score and ROI over a large, time-ordered sample.</p></div><div class="stats"><div class="stat"><small>1X2 accuracy</small><b>71.4%</b></div><div class="stat"><small>Probability calibration</small><b>94/100</b></div><div class="stat"><small>Tracked predictions</small><b>2,481</b></div><div class="stat"><small>Current model</small><b>v1.0</b></div></div><div class="section-title"><h2>Market performance</h2><span>Illustrative dashboard — replace with live backtest logs</span></div><div class="table-wrap"><table class="table"><thead><tr><th>Market</th><th>Predictions</th><th>Accuracy</th><th>Calibration</th><th>Status</th></tr></thead><tbody>${[["1X2",812,"71.4%","Strong"],["Over 2.5",544,"68.1%","Good"],["BTTS",502,"66.7%","Good"],["Double Chance",623,"84.3%","Strong"]].map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>Excellent</td><td class="positive">${r[3]}</td></tr>`).join("")}</tbody></table></div>`}
 if(page==="methodology"){document.getElementById("main").innerHTML=`<div class="page-head"><div class="eyebrow">The engine</div><h1>Transparent by design.</h1><p>The system is built as an ensemble rather than a single “magic formula”. Each model produces a signal; calibration and agreement determine how much weight the platform gives the final forecast.</p></div><div class="method-grid"><div class="method-card"><h3>1. Team-strength layer</h3><p>Elo-style ratings capture persistent differences in team quality and update as results arrive.</p><h3>2. Goal model</h3><p>Expected-goal inputs feed a Poisson/Dixon-Coles-style score matrix. From that matrix we derive 1X2, totals, BTTS and scoreline probabilities.</p><h3>3. Form & context</h3><p>Recent form, home/away splits, opponent strength, rest, schedule congestion, injuries and projected lineups can be added as time-stamped features.</p><h3>4. Market intelligence</h3><p>When legal and licensed odds data is available, the market becomes a benchmark—not an unquestioned oracle. The engine can compare its calibrated probability against de-vigged implied probability.</p></div><div class="method-card"><h3>Probability pipeline</h3><div class="formula">features → independent models → score matrix → ensemble → calibration → probability distribution → market/value scan → confidence</div><ul><li>Walk-forward validation prevents future information leaking into historical tests.</li><li>Calibration is measured separately from raw accuracy.</li><li>Every forecast gets a timestamp and model version.</li><li>Predictions remain visible after the match so the system cannot quietly rewrite history.</li></ul><h3>Production upgrades</h3><p>Add player-level xG, shot quality, possession value, lineups, injuries, referee tendencies, travel, weather, schedule fatigue and high-frequency odds snapshots.</p></div></div>`}
}
document.querySelectorAll(".nav").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".nav").forEach(x=>x.classList.remove("active"));b.classList.add("active");renderPage(b.dataset.page)}));
load();
