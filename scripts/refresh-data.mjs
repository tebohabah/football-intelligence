import fs from 'node:fs/promises';
const key=process.env.FOOTBALL_DATA_API_KEY;
const today=new Date().toISOString().slice(0,10);
if(!key){console.log('No API key; retaining existing dataset.');process.exit(0);}
const r=await fetch(`https://api.football-data.org/v4/matches?dateFrom=${today}&dateTo=${today}`,{headers:{'X-Auth-Token':key}});
if(!r.ok) throw new Error(`Provider returned ${r.status}`);
const d=await r.json();
const fixtures=(d.matches||[]).map(m=>({id:String(m.id),competition:m.competition?.name||'Unknown',country:m.area?.name||'',utcDate:m.utcDate,status:m.status,home:m.homeTeam?.name||'Home',away:m.awayTeam?.name||'Away'}));
await fs.writeFile('data/today.json',JSON.stringify({generatedAt:new Date().toISOString(),provider:'football-data.org',fixtures},null,2));
console.log(`Wrote ${fixtures.length} fixtures`);
