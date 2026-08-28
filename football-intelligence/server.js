import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const demoFixtures = [
  {id:"demo-1", league:"Premier League", country:"England", kickoff:"19:30", home:"Arsenal", away:"Chelsea", homeRating:88, awayRating:82, homeForm:0.78, awayForm:0.61, homeXg:2.02, awayXg:1.34, homeDef:0.91, awayDef:1.28},
  {id:"demo-2", league:"Premier League", country:"England", kickoff:"20:00", home:"Manchester City", away:"Aston Villa", homeRating:91, awayRating:79, homeForm:0.82, awayForm:0.58, homeXg:2.31, awayXg:1.22, homeDef:0.72, awayDef:1.41},
  {id:"demo-3", league:"La Liga", country:"Spain", kickoff:"20:00", home:"Barcelona", away:"Sevilla", homeRating:90, awayRating:78, homeForm:0.81, awayForm:0.55, homeXg:2.26, awayXg:1.08, homeDef:0.76, awayDef:1.46},
  {id:"demo-4", league:"Bundesliga", country:"Germany", kickoff:"17:30", home:"Bayern Munich", away:"Mainz", homeRating:92, awayRating:73, homeForm:0.86, awayForm:0.48, homeXg:2.58, awayXg:0.94, homeDef:0.69, awayDef:1.63},
  {id:"demo-5", league:"Serie A", country:"Italy", kickoff:"18:00", home:"Inter Milan", away:"Torino", homeRating:89, awayRating:76, homeForm:0.79, awayForm:0.57, homeXg:1.94, awayXg:0.92, homeDef:0.71, awayDef:1.12},
  {id:"demo-6", league:"Ligue 1", country:"France", kickoff:"20:00", home:"PSG", away:"Lyon", homeRating:89, awayRating:77, homeForm:0.84, awayForm:0.63, homeXg:2.34, awayXg:1.19, homeDef:0.83, awayDef:1.36}
];

function clamp(n,a,b){ return Math.max(a,Math.min(b,n)); }
function sigmoid(x){ return 1/(1+Math.exp(-x)); }

function poisson(k, lambda){
  let fact=1;
  for(let i=2;i<=k;i++) fact*=i;
  return Math.exp(-lambda)*Math.pow(lambda,k)/fact;
}

function predict(f){
  const ratingEdge=(f.homeRating-f.awayRating)/20;
  const formEdge=(f.homeForm-f.awayForm)*1.5;
  const attackEdge=(f.homeXg-f.awayXg)/1.7;
  const defensiveEdge=(f.awayDef-f.homeDef)/1.5;
  const homeAdv=0.22;

  const raw = ratingEdge*0.30 + formEdge*0.20 + attackEdge*0.25 + defensiveEdge*0.15 + homeAdv*0.10;
  let homeP=sigmoid(raw*2.0);
  let awayP=sigmoid(-raw*1.6);
  const drawBase=0.23;
  let drawP=drawBase + Math.max(0, 0.08-Math.abs(homeP-awayP))*0.8;
  const total=homeP+awayP+drawP;
  homeP/=total; awayP/=total; drawP/=total;

  const lambdaH=clamp((f.homeXg*0.68 + (1/f.awayDef)*0.32) * (1+ratingEdge*0.08),0.25,4.2);
  const lambdaA=clamp((f.awayXg*0.68 + (1/f.homeDef)*0.32) * (1-ratingEdge*0.05),0.18,3.4);

  const scores=[];
  let over25=0, over15=0, btts=0;
  for(let h=0;h<=7;h++){
    for(let a=0;a<=7;a++){
      const p=poisson(h,lambdaH)*poisson(a,lambdaA);
      scores.push({h,a,p});
      if(h+a>=3) over25+=p;
      if(h+a>=2) over15+=p;
      if(h>0 && a>0) btts+=p;
    }
  }
  scores.sort((x,y)=>y.p-x.p);
  const top=scores.slice(0,5);

  const best = [
    ["Home Win",homeP],["Draw",drawP],["Away Win",awayP],
    ["Over 1.5",over15],["Over 2.5",over25],["BTTS Yes",btts],
    ["BTTS No",1-btts]
  ].sort((a,b)=>b[1]-a[1]);

  const agreement = clamp(
    55 + Math.abs(homeP-awayP)*65 + Math.abs(lambdaH-lambdaA)*7,
    52, 94
  );
  const confidence = clamp(Math.round(agreement*0.72 + Math.max(homeP,awayP,drawP)*28), 50, 94);

  return {
    ...f,
    probabilities:{
      home:homeP, draw:drawP, away:awayP,
      over15:over15, over25:over25, over35:1-(scores.filter(s=>s.h+s.a<=3).reduce((x,s)=>x+s.p,0)),
      btts, bttsNo:1-btts
    },
    expectedGoals:{home:lambdaH,away:lambdaA,total:lambdaH+lambdaA},
    topScores:top,
    bestMarkets:best.slice(0,5),
    confidence,
    agreement,
    verdict: homeP>=drawP && homeP>=awayP ? "Home Win" : awayP>=drawP ? "Away Win" : "Draw",
    factors:[
      {label:"Team strength",value:clamp(50+(f.homeRating-f.awayRating)*2.1,20,95),note:`Elo-style rating edge favors ${f.homeRating>=f.awayRating?f.home:"the away side"}.`},
      {label:"Recent form",value:clamp(50+(f.homeForm-f.awayForm)*100,20,95),note:`Recent performance profile is stronger for ${f.homeForm>=f.awayForm?f.home:f.away}.`},
      {label:"Expected goals",value:clamp(50+(f.homeXg-f.awayXg)*24,20,95),note:`Projected attacking output is ${lambdaH.toFixed(2)}–${lambdaA.toFixed(2)} goals.`},
      {label:"Defensive profile",value:clamp(50+(f.awayDef-f.homeDef)*30,20,95),note:"Lower defensive-concession rate receives a positive adjustment."},
      {label:"Home advantage",value:57,note:"Venue effect is included as a modest, league-calibrated prior."}
    ]
  };
}

async function getLiveFixtures(){
  const key=process.env.FOOTBALL_DATA_API_KEY;
  if(!key) return {mode:"demo",fixtures:demoFixtures};
  try{
    const d=new Date().toISOString().slice(0,10);
    const url=`https://api.football-data.org/v4/matches?dateFrom=${d}&dateTo=${d}`;
    const r=await fetch(url,{headers:{"X-Auth-Token":key}});
    if(!r.ok) throw new Error(`provider ${r.status}`);
    const data=await r.json();
    const fixtures=(data.matches||[]).map((m,i)=>({
      id:String(m.id), league:m.competition?.name||"Unknown", country:m.area?.name||"",
      kickoff:new Date(m.utcDate).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}),
      home:m.homeTeam?.name||"Home", away:m.awayTeam?.name||"Away",
      homeRating:80,awayRating:80,homeForm:.5,awayForm:.5,homeXg:1.4,awayXg:1.2,homeDef:1.1,awayDef:1.2
    }));
    return {mode:"live-fixtures-demo-model",fixtures};
  }catch(e){
    return {mode:"demo-fallback",fixtures:demoFixtures,error:e.message};
  }
}

app.get("/api/fixtures",async(req,res)=>{
  const result=await getLiveFixtures();
  res.json({date:new Date().toISOString().slice(0,10),...result});
});
app.get("/api/match/:id",async(req,res)=>{
  const result=await getLiveFixtures();
  const f=result.fixtures.find(x=>x.id===req.params.id);
  if(!f) return res.status(404).json({error:"Match not found"});
  res.json({mode:result.mode,prediction:predict(f)});
});

app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log(`Football Intelligence running on http://localhost:${PORT}`));
