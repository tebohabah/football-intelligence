function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
function sigmoid(x){return 1/(1+Math.exp(-x));}
function poisson(k,l){let f=1;for(let i=2;i<=k;i++)f*=i;return Math.exp(-l)*Math.pow(l,k)/f;}

function predict(f){
  const ratingEdge=(f.homeRating-f.awayRating)/20;
  const formEdge=f.homeForm-f.awayForm;
  const attackEdge=f.homeXg-f.awayXg;
  const homeAdv=.18;
  const raw=0.95*ratingEdge+0.65*formEdge+0.8*attackEdge+homeAdv;
  const home=sigmoid(raw);
  const drawBase=.24-clamp(Math.abs(raw)*.035,0,.10);
  const draw=clamp(drawBase, .12,.30);
  const away=clamp(1-home-draw,.05,.75);
  const total=home+draw+away;
  const probs={home:home/total,draw:draw/total,away:away/total};
  const lh=Math.max(.2,f.homeXg*(1+0.10*ratingEdge+0.06*formEdge));
  const la=Math.max(.2,f.awayXg*(1-0.08*ratingEdge-0.04*formEdge));
  let scores=[], hw=0,dr=0,aw=0,over25=0,btts=0;
  for(let h=0;h<=7;h++) for(let a=0;a<=7;a++){
    const p=poisson(h,lh)*poisson(a,la);
    scores.push({h,a,p});
    if(h>a)hw+=p; else if(h===a)dr+=p; else aw+=p;
    if(h+a>=3)over25+=p;
    if(h>0&&a>0)btts+=p;
  }
  scores.sort((x,y)=>y.p-x.p);
  const confidence=Math.round(clamp(50+Math.abs(probs.home-probs.away)*70+Math.abs(probs.home-.5)*25,0,97));
  return {
    ...f,
    probabilities:{home:probs.home,draw:probs.draw,away:probs.away},
    xg:{home:lh,away:la},
    markets:{over25,under25:1-over25,btts,bttsNo:1-btts},
    topScores:scores.slice(0,5),
    confidence,
    modelAgreement:Math.round(clamp(62+confidence*.30,0,96)),
    generatedAt:new Date().toISOString()
  };
}

const fixtures=[
{id:"demo-1",league:"Premier League",country:"England",kickoff:"19:30",home:"Arsenal",away:"Chelsea",homeRating:88,awayRating:82,homeForm:.78,awayForm:.61,homeXg:2.02,awayXg:1.34},
{id:"demo-2",league:"Premier League",country:"England",kickoff:"20:00",home:"Manchester City",away:"Aston Villa",homeRating:91,awayRating:79,homeForm:.82,awayForm:.58,homeXg:2.31,awayXg:1.22},
{id:"demo-3",league:"La Liga",country:"Spain",kickoff:"20:00",home:"Barcelona",away:"Sevilla",homeRating:90,awayRating:78,homeForm:.81,awayForm:.55,homeXg:2.26,awayXg:1.08},
{id:"demo-4",league:"Bundesliga",country:"Germany",kickoff:"17:30",home:"Bayern Munich",away:"Mainz",homeRating:92,awayRating:73,homeForm:.86,awayForm:.48,homeXg:2.58,awayXg:.94},
{id:"demo-5",league:"Serie A",country:"Italy",kickoff:"18:00",home:"Inter Milan",away:"Torino",homeRating:89,awayRating:76,homeForm:.79,awayForm:.57,homeXg:1.94,awayXg:.92},
{id:"demo-6",league:"Ligue 1",country:"France",kickoff:"20:00",home:"PSG",away:"Lyon",homeRating:89,awayRating:77,homeForm:.84,awayForm:.63,homeXg:2.34,awayXg:1.19}
];

export default {
  async fetch(request, env) {
    const url=new URL(request.url);
    if(url.pathname==="/api/health") return Response.json({ok:true,service:"football-intelligence",version:"2.0-worker"});
    if(url.pathname==="/api/fixtures"){
      const data=fixtures.map(predict);
      return Response.json({mode:"demo",generatedAt:new Date().toISOString(),fixtures:data});
    }
    if(url.pathname.startsWith("/api/match/")){
      const id=url.pathname.split("/").pop();
      const f=fixtures.find(x=>x.id===id);
      return f ? Response.json({mode:"demo",match:predict(f)}) : Response.json({error:"Match not found"},{status:404});
    }
    if(env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("Football Intelligence Engine");
  }
};
