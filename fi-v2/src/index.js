const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const sigmoid=x=>1/(1+Math.exp(-x));
function poisson(k,l){let f=1;for(let i=2;i<=k;i++)f*=i;return Math.exp(-l)*Math.pow(l,k)/f;}

const fixtures=[
{id:"demo-1",league:"Premier League",country:"England",kickoff:"19:30",home:"Arsenal",away:"Chelsea",homeRating:88,awayRating:82,homeForm:.78,awayForm:.61,homeXg:2.02,awayXg:1.34},
{id:"demo-2",league:"Premier League",country:"England",kickoff:"20:00",home:"Manchester City",away:"Aston Villa",homeRating:91,awayRating:79,homeForm:.82,awayForm:.58,homeXg:2.31,awayXg:1.22},
{id:"demo-3",league:"La Liga",country:"Spain",kickoff:"20:00",home:"Barcelona",away:"Sevilla",homeRating:90,awayRating:78,homeForm:.81,awayForm:.55,homeXg:2.26,awayXg:1.08},
{id:"demo-4",league:"Bundesliga",country:"Germany",kickoff:"17:30",home:"Bayern Munich",away:"Mainz",homeRating:92,awayRating:73,homeForm:.86,awayForm:.48,homeXg:2.58,awayXg:.94},
{id:"demo-5",league:"Serie A",country:"Italy",kickoff:"18:00",home:"Inter Milan",away:"Torino",homeRating:89,awayRating:76,homeForm:.79,awayForm:.57,homeXg:1.94,awayXg:.92},
{id:"demo-6",league:"Ligue 1",country:"France",kickoff:"20:00",home:"PSG",away:"Lyon",homeRating:89,awayRating:77,homeForm:.84,awayForm:.63,homeXg:2.34,awayXg:1.19}
];

function predict(f){
  const ratingEdge=(f.homeRating-f.awayRating)/20;
  const formEdge=f.homeForm-f.awayForm;
  const attackEdge=f.homeXg-f.awayXg;
  const raw=.95*ratingEdge+.65*formEdge+.55*attackEdge+.18;
  const h0=sigmoid(raw), draw0=clamp(.25-.035*Math.abs(raw),.14,.29), a0=clamp(1-h0-draw0,.05,.72);
  const total=h0+draw0+a0; const probs={home:h0/total,draw:draw0/total,away:a0/total};
  const lh=Math.max(.2,f.homeXg*(1+.08*ratingEdge+.05*formEdge));
  const la=Math.max(.2,f.awayXg*(1-.06*ratingEdge-.03*formEdge));
  let scores=[],hw=0,dr=0,aw=0,over15=0,over25=0,btts=0;
  for(let h=0;h<=8;h++)for(let a=0;a<=8;a++){
    const p=poisson(h,lh)*poisson(a,la); scores.push({h,a,p});
    if(h>a)hw+=p;else if(h===a)dr+=p;else aw+=p;
    if(h+a>=2)over15+=p;if(h+a>=3)over25+=p;if(h>0&&a>0)btts+=p;
  }
  scores.sort((x,y)=>y.p-x.p);
  const markets={over15,under15:1-over15,over25,under25:1-over25,btts,bttsNo:1-btts};
  const verdict=[['Home Win',probs.home],['Draw',probs.draw],['Away Win',probs.away]].sort((a,b)=>b[1]-a[1])[0];
  const confidence=Math.round(clamp(52+Math.abs(verdict[1]-.5)*72+Math.abs(probs.home-probs.away)*28,0,97));
  const modelAgreement=Math.round(clamp(68+confidence*.25,0,95));
  const dataQuality=72;
  const factors=[
    {label:'Team strength',value:clamp(50+(f.homeRating-f.awayRating)*2,0,100),note:'Relative team rating advantage in the current model.'},
    {label:'Recent form',value:clamp(50+(f.homeForm-f.awayForm)*100,0,100),note:'Recent performance signal, normalized for comparison.'},
    {label:'Expected goals',value:clamp(50+(f.homeXg-f.awayXg)*28,0,100),note:'Pre-match attacking expectation differential.'},
    {label:'Home advantage',value:68,note:'Venue effect currently applied as a modest prior.'}
  ];
  const bestMarkets=[['Home Win',probs.home],['Away Win',probs.away],['Draw',probs.draw],['Over 2.5',over25],['BTTS Yes',btts]].sort((a,b)=>b[1]-a[1]).slice(0,3);
  return {...f,verdict:verdict[0],probabilities:probs,expectedGoals:{home:lh,away:la,total:lh+la},markets,topScores:scores.slice(0,6),confidence,modelAgreement,dataQuality,bestMarkets,factors,generatedAt:new Date().toISOString()};
}

export default {async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==='/api/health')return Response.json({ok:true,service:'football-intelligence',version:'2.1.0',mode:'demo'});
  if(url.pathname==='/api/fixtures')return Response.json({mode:'demo',generatedAt:new Date().toISOString(),fixtures:fixtures.map(predict)});
  if(url.pathname.startsWith('/api/match/')){const id=url.pathname.split('/').pop();const f=fixtures.find(x=>x.id===id);return f?Response.json({mode:'demo',match:predict(f)}):Response.json({error:'Match not found'},{status:404});}
  if(env.ASSETS)return env.ASSETS.fetch(request);
  return new Response('Football Intelligence Engine',{headers:{'content-type':'text/plain'}});
}};
