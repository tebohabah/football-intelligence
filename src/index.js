const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const sigmoid=x=>1/(1+Math.exp(-x));

function poisson(k,l){
  let f=1;
  for(let i=2;i<=k;i++)f*=i;
  return Math.exp(-l)*Math.pow(l,k)/f;
}

const demoFixtures=[
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

  const h0=sigmoid(raw);
  const draw0=clamp(.25-.035*Math.abs(raw),.14,.29);
  const a0=clamp(1-h0-draw0,.05,.72);

  const total=h0+draw0+a0;

  const probabilities={
    home:h0/total,
    draw:draw0/total,
    away:a0/total
  };

  const lh=Math.max(.2,f.homeXg*(1+.08*ratingEdge+.05*formEdge));
  const la=Math.max(.2,f.awayXg*(1-.06*ratingEdge-.03*formEdge));

  let scores=[];
  let over15=0;
  let over25=0;
  let btts=0;

  for(let h=0;h<=8;h++){
    for(let a=0;a<=8;a++){
      const p=poisson(h,lh)*poisson(a,la);

      scores.push({h,a,p});

      if(h+a>=2)over15+=p;
      if(h+a>=3)over25+=p;
      if(h>0&&a>0)btts+=p;
    }
  }

  scores.sort((x,y)=>y.p-x.p);

  const markets={
    over15,
    under15:1-over15,
    over25,
    under25:1-over25,
    btts,
    bttsNo:1-btts
  };

  const verdict=[
    ["Home Win",probabilities.home],
    ["Draw",probabilities.draw],
    ["Away Win",probabilities.away]
  ].sort((a,b)=>b[1]-a[1])[0];

  const confidence=Math.round(
    clamp(
      52+
      Math.abs(verdict[1]-.5)*72+
      Math.abs(probabilities.home-probabilities.away)*28,
      0,
      97
    )
  );

  const modelAgreement=Math.round(clamp(68+confidence*.25,0,95));

  const factors=[
    {
      label:"Team strength",
      value:clamp(50+(f.homeRating-f.awayRating)*2,0,100),
      note:"Relative team rating advantage in the current model."
    },
    {
      label:"Recent form",
      value:clamp(50+(f.homeForm-f.awayForm)*100,0,100),
      note:"Recent performance signal, normalized for comparison."
    },
    {
      label:"Expected goals",
      value:clamp(50+(f.homeXg-f.awayXg)*28,0,100),
      note:"Pre-match attacking expectation differential."
    },
    {
      label:"Home advantage",
      value:68,
      note:"Venue effect currently applied as a modest prior."
    }
  ];

  const bestMarkets=[
    ["Home Win",probabilities.home],
    ["Away Win",probabilities.away],
    ["Draw",probabilities.draw],
    ["Over 2.5",over25],
    ["BTTS Yes",btts]
  ]
  .sort((a,b)=>b[1]-a[1])
  .slice(0,3);

  return {
    ...f,
    verdict:verdict[0],
    probabilities,
    expectedGoals:{
      home:lh,
      away:la,
      total:lh+la
    },
    markets,
    topScores:scores.slice(0,6),
    confidence,
    modelAgreement,
    dataQuality:f.dataQuality??72,
    bestMarkets,
    factors,
    generatedAt:new Date().toISOString(),
    modelVersion:"FI-BASE-3.0"
  };
}

function json(data,status=200){
  return Response.json(data,{
    status,
    headers:{
      "cache-control":"no-store",
      "content-type":"application/json;charset=UTF-8"
    }
  });
}

function todayISO(offset=0){
  const d=new Date(Date.now()+offset*86400000);
  return d.toISOString().slice(0,10);
}

function apiHeaders(env){
  return {
    "x-apisports-key":env.API_FOOTBALL_KEY,
    "Accept":"application/json"
  };
}

async function fetchProvider(url,env){
  if(!env.API_FOOTBALL_KEY){
    throw new Error("API_FOOTBALL_KEY is missing");
  }

  const r=await fetch(url,{
    headers:apiHeaders(env)
  });

  const text=await r.text();

  let d;

  try{
    d=JSON.parse(text);
  }catch{
    throw new Error(`API-Football returned invalid JSON (${r.status})`);
  }

  if(!r.ok){
    throw new Error(`API-Football HTTP ${r.status}: ${text.slice(0,300)}`);
  }

  if(d.errors && Object.keys(d.errors).length){
    throw new Error(JSON.stringify(d.errors));
  }

  return d;
}

function normalizeFixture(x){
  return {
    id:String(x.fixture?.id),
    leagueId:x.league?.id??null,
    league:x.league?.name??"Unknown",
    country:x.league?.country??"Unknown",
    kickoffUtc:x.fixture?.date??null,
    status:x.fixture?.status?.short??"NS",
    statusLong:x.fixture?.status?.long??"",
    homeId:x.teams?.home?.id??null,
    home:x.teams?.home?.name??"Home",
    awayId:x.teams?.away?.id??null,
    away:x.teams?.away?.name??"Away",
    homeGoals:x.goals?.home??null,
    awayGoals:x.goals?.away??null,
    logoHome:x.teams?.home?.logo??null,
    logoAway:x.teams?.away?.logo??null
  };
}

function apiPredictionToModel(f,p){
  const response=p?.response?.[0];

  if(!response){
    return null;
  }

  const percent=response.predictions?.percent||{};

  const home=parsePercent(percent.home);
  const draw=parsePercent(percent.draw);
  const away=parsePercent(percent.away);

  if(home===null||draw===null||away===null){
    return null;
  }

  const total=home+draw+away;

  if(total<=0){
    return null;
  }

  const probabilities={
    home:home/total,
    draw:draw/total,
    away:away/total
  };

  let verdict="Draw";

  if(probabilities.home>=probabilities.draw &&
     probabilities.home>=probabilities.away){
    verdict="Home Win";
  }else if(probabilities.away>=probabilities.home &&
           probabilities.away>=probabilities.draw){
    verdict="Away Win";
  }

  const goals=response.predictions?.goals||{};

  const estimatedHome=Number(goals.home)||1.2;
  const estimatedAway=Number(goals.away)||1.0;

  const advice=response.predictions?.advice||"API-Football prediction";

  const underOver=response.predictions?.under_over||"";

  const over25=underOver.toLowerCase().includes("over 2.5")
    ? .60
    : .50;

  const btts=response.predictions?.btts?.yes
    ? .55
    : .45;

  const topScore=response.predictions?.score?.fulltime;

  const topScores=[];

  if(topScore?.home!=null&&topScore?.away!=null){
    topScores.push({
      h:Number(topScore.home),
      a:Number(topScore.away),
      p:Math.max(probabilities.home,probabilities.draw,probabilities.away)*.55
    });
  }

  const confidence=Math.round(
    clamp(
      Math.max(
        probabilities.home,
        probabilities.draw,
        probabilities.away
      )*100,
      50,
      96
    )
  );

  const factors=[
    {
      label:"API-Football model",
      value:Math.round(
        Math.max(
          probabilities.home,
          probabilities.draw,
          probabilities.away
        )*100
      ),
      note:advice
    },
    {
      label:"Predicted goals",
      value:clamp(
        50+(estimatedHome-estimatedAway)*25,
        0,
        100
      ),
      note:`Estimated score tendency: ${estimatedHome.toFixed(2)}–${estimatedAway.toFixed(2)}`
    },
    {
      label:"Prediction coverage",
      value:85,
      note:"Prediction generated from the live API provider."
    },
    {
      label:"Match context",
      value:75,
      note:"Provider incorporates form, historical data and team context."
    }
  ];

  const bestMarkets=[
    ["Home Win",probabilities.home],
    ["Draw",probabilities.draw],
    ["Away Win",probabilities.away],
    ["Over 2.5",over25],
    ["BTTS Yes",btts]
  ]
  .sort((a,b)=>b[1]-a[1])
  .slice(0,3);

  return {
    id:f.id,
    league:f.league,
    country:f.country,
    kickoff:new Date(f.kickoffUtc).toLocaleTimeString(
      "en-GB",
      {
        hour:"2-digit",
        minute:"2-digit",
        timeZone:"Africa/Lagos"
      }
    ),
    kickoffUtc:f.kickoffUtc,
    home:f.home,
    away:f.away,
    verdict,
    probabilities,
    expectedGoals:{
      home:estimatedHome,
      away:estimatedAway,
      total:estimatedHome+estimatedAway
    },
    markets:{
      over15:Math.min(.95,over25+.20),
      under15:Math.max(.05,1-(over25+.20)),
      over25,
      under25:1-over25,
      btts,
      bttsNo:1-btts
    },
    topScores,
    confidence,
    modelAgreement:Math.round(
      clamp(65+confidence*.25,0,95)
    ),
    dataQuality:90,
    bestMarkets,
    factors,
    generatedAt:new Date().toISOString(),
    modelVersion:"FI-LIVE-API-3.0",
    provider:"API-Football",
    providerFixtureId:f.id,
    providerStatus:f.status,
    providerStatusLong:f.statusLong,
    advice,
    warning:"Live provider prediction. This is a probability estimate, not a guarantee."
  };
}

function parsePercent(v){
  if(v===null||v===undefined)return null;

  const n=parseFloat(String(v).replace("%",""));

  if(!Number.isFinite(n))return null;

  return n/100;
}

function baselineLivePrediction(f){
  const kickoff=new Date(f.kickoffUtc);

  const base={
    id:f.id,
    league:f.league,
    country:f.country,
    kickoff:kickoff.toLocaleTimeString(
      "en-GB",
      {
        hour:"2-digit",
        minute:"2-digit",
        timeZone:"Africa/Lagos"
      }
    ),
    kickoffUtc:f.kickoffUtc,
    home:f.home,
    away:f.away,
    homeRating:75,
    awayRating:75,
    homeForm:.5,
    awayForm:.5,
    homeXg:1.45,
    awayXg:1.15,
    dataQuality:40
  };

  const p=predict(base);

  return {
    ...p,
    providerFixtureId:f.id,
    providerStatus:f.status,
    providerStatusLong:f.statusLong,
    logos:{
      home:f.logoHome,
      away:f.logoAway
    },
    provider:"API-Football fixtures",
    warning:"Live fixture feed connected. Provider prediction data was unavailable for this fixture, so the local baseline model is being used."
  };
}

async function upsertFixtures(db,items){
  if(!db)return;

  const now=new Date().toISOString();

  const stmts=items.map(f=>
    db.prepare(`
      INSERT INTO fixtures(
        id,
        league_id,
        league_name,
        country,
        kickoff_utc,
        status,
        home_team_id,
        home_team,
        away_team_id,
        away_team,
        home_goals,
        away_goals,
        raw_json,
        updated_at
      )
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        league_id=excluded.league_id,
        league_name=excluded.league_name,
        country=excluded.country,
        kickoff_utc=excluded.kickoff_utc,
        status=excluded.status,
        home_team_id=excluded.home_team_id,
        home_team=excluded.home_team,
        away_team_id=excluded.away_team_id,
        away_team=excluded.away_team,
        home_goals=excluded.home_goals,
        away_goals=excluded.away_goals,
        raw_json=excluded.raw_json,
        updated_at=excluded.updated_at
    `).bind(
      f.id,
      f.leagueId,
      f.league,
      f.country,
      f.kickoffUtc,
      f.status,
      f.homeId,
      f.home,
      f.awayId,
      f.away,
      f.homeGoals,
      f.awayGoals,
      JSON.stringify(f),
      now
    )
  );

  for(let i=0;i<stmts.length;i+=20){
    await db.batch(stmts.slice(i,i+20));
  }
}

async function sync(env){
  if(!env.API_FOOTBALL_KEY){
    return {
      mode:"demo",
      reason:"API_FOOTBALL_KEY missing",
      fixtures:[],
      syncedAt:new Date().toISOString()
    };
  }

  const today=todayISO();
  const tomorrow=todayISO(1);

  const [a,b]=await Promise.all([
    fetchProvider(
      `https://v3.football.api-sports.io/fixtures?date=${today}`,
      env
    ),
    fetchProvider(
      `https://v3.football.api-sports.io/fixtures?date=${tomorrow}`,
      env
    )
  ]);

  const items=[
    ...(a.response||[]),
    ...(b.response||[])
  ].map(normalizeFixture);

  const unique=[
    ...new Map(items.map(x=>[x.id,x])).values()
  ];

  await upsertFixtures(env.DB,unique);

  const syncedAt=new Date().toISOString();

  if(env.DB){
    await env.DB.prepare(`
      INSERT INTO sync_runs(
        run_at,
        provider,
        fixtures_seen,
        fixtures_written
      )
      VALUES(?,?,?,?)
    `)
    .bind(
      syncedAt,
      "api-football",
      unique.length,
      unique.length
    )
    .run();
  }

  return {
    mode:"live",
    fixtures:unique,
    fixturesCount:unique.length,
    syncedAt
  };
}

async function readFixtures(env){
  if(!env.DB){
    return [];
  }

  const start=new Date(
    `${todayISO()}T00:00:00Z`
  ).toISOString();

  const end=new Date(
    `${todayISO(2)}T00:00:00Z`
  ).toISOString();

  const r=await env.DB.prepare(`
    SELECT
      id,
      league_id leagueId,
      league_name league,
      country,
      kickoff_utc kickoffUtc,
      status,
      home_team_id homeId,
      home_team home,
      away_team_id awayId,
      away_team away,
      home_goals homeGoals,
      away_goals awayGoals,
      raw_json rawJson
    FROM fixtures
    WHERE kickoff_utc>=?
      AND kickoff_utc<?
    ORDER BY kickoff_utc
  `)
  .bind(start,end)
  .all();

  return (r.results||[]).map(x=>{

    let raw={};

    try{
      raw=JSON.parse(x.rawJson||"{}");
    }catch{}

    return {
      ...x,
      statusLong:raw.statusLong||"",
      logoHome:raw.logoHome||null,
      logoAway:raw.logoAway||null
    };
  });
}

async function enrichPredictions(env,fixtures){
  const output=[];

  /*
   * We deliberately limit concurrent requests.
   * This prevents the dashboard from becoming slow and reduces API usage.
   */
  const concurrency=5;

  for(let i=0;i<fixtures.length;i+=concurrency){

    const batch=fixtures.slice(i,i+concurrency);

    const results=await Promise.all(
      batch.map(async f=>{
        try{
          const prediction=await fetchProvider(
            `https://v3.football.api-sports.io/predictions?fixture=${encodeURIComponent(f.id)}`,
            env
          );

          const model=apiPredictionToModel(f,prediction);

          if(model){
            return {
              ...model,
              logos:{
                home:f.logoHome,
                away:f.logoAway
              }
            };
          }

          return baselineLivePrediction(f);

        }catch{
          return baselineLivePrediction(f);
        }
      })
    );

    output.push(...results);
  }

  return output;
}

async function getLiveFixtures(env){
  const rows=await readFixtures(env);

  if(rows.length){
    const ageCheck=rows
      .map(r=>r.kickoffUtc)
      .filter(Boolean);

    return {
      rows,
      ageCheck
    };
  }

  return {
    rows:[],
    ageCheck:[]
  };
}

export default {

  async fetch(request,env){

    const url=new URL(request.url);

    try{

      if(url.pathname==="/api/health"){

        const rows=await readFixtures(env);

        return json({
          ok:true,
          service:"football-intelligence",
          version:"3.0.0",
          apiFootballConfigured:Boolean(env.API_FOOTBALL_KEY),
          databaseConfigured:Boolean(env.DB),
          storedFixtures:rows.length,
          mode:env.API_FOOTBALL_KEY?"live-ready":"demo"
        });
      }

      if(url.pathname==="/api/sync"){

        if(request.method!=="POST"){
          return json(
            {error:"Use POST"},
            405
          );
        }

        const expected=env.SYNC_SECRET;

        if(
          !expected ||
          request.headers.get("x-sync-secret")!==expected
        ){
          return json(
            {error:"Unauthorized"},
            401
          );
        }

        const result=await sync(env);

        return json({
          ok:true,
          ...result
        });
      }

      if(url.pathname==="/api/fixtures"){

        /*
         * First use the database.
         * This keeps normal page loads fast.
         */
        let stored=await getLiveFixtures(env);

        /*
         * If there is no stored live data, synchronize immediately.
         * This is the important fix that prevents a fresh deployment
         * from automatically falling back to demo mode.
         */
        if(
          env.API_FOOTBALL_KEY &&
          stored.rows.length===0
        ){
          try{
            await sync(env);
            stored=await getLiveFixtures(env);
          }catch(e){
            return json({
              mode:"demo",
              liveAttempted:true,
              liveError:e?.message||String(e),
              generatedAt:new Date().toISOString(),
              fixtures:demoFixtures.map(predict)
            });
          }
        }

        if(stored.rows.length){

          const matches=await enrichPredictions(
            env,
            stored.rows
          );

          return json({
            mode:"live",
            provider:"API-Football",
            generatedAt:new Date().toISOString(),
            fixtures:matches,
            count:matches.length
          });
        }

        return json({
          mode:"demo",
          generatedAt:new Date().toISOString(),
          fixtures:demoFixtures.map(predict)
        });
      }

      if(url.pathname.startsWith("/api/match/")){

        const id=url.pathname.split("/").pop();

        const rows=await readFixtures(env);

        const f=rows.find(
          x=>String(x.id)===String(id)
        );

        if(f){

          try{

            const prediction=await fetchProvider(
              `https://v3.football.api-sports.io/predictions?fixture=${encodeURIComponent(f.id)}`,
              env
            );

            const model=apiPredictionToModel(
              f,
              prediction
            );

            if(model){
              return json({
                mode:"live",
                match:{
                  ...model,
                  logos:{
                    home:f.logoHome,
                    away:f.logoAway
                  }
                }
              });
            }

          }catch{}

          return json({
            mode:"live",
            match:baselineLivePrediction(f)
          });
        }

        const demo=demoFixtures.find(
          x=>x.id===id
        );

        return demo
          ? json({
              mode:"demo",
              match:predict(demo)
            })
          : json({
              error:"Match not found"
            },404);
      }

      if(url.pathname==="/api/status"){

        const rows=await readFixtures(env);

        return json({
          live:Boolean(env.API_FOOTBALL_KEY),
          database:Boolean(env.DB),
          fixtures:rows.length,
          checkedAt:new Date().toISOString()
        });
      }

      if(env.ASSETS){
        return env.ASSETS.fetch(request);
      }

      return new Response(
        "Football Intelligence Engine",
        {
          headers:{
            "content-type":"text/plain"
          }
        }
      );

    }catch(e){

      return json({
        error:"Engine error",
        message:e?.message||String(e)
      },500);
    }
  },

  async scheduled(controller,env,ctx){

    ctx.waitUntil(
      (async()=>{

        try{

          /*
           * Refresh fixture database automatically.
           * Cloudflare Cron invokes this handler.
           */
          await sync(env);

        }catch(e){

          if(env.DB){

            await env.DB.prepare(`
              INSERT INTO sync_runs(
                run_at,
                provider,
                fixtures_seen,
                fixtures_written,
                error
              )
              VALUES(?,?,?,?,?)
            `)
            .bind(
              new Date().toISOString(),
              "api-football",
              0,
              0,
              e?.message||String(e)
            )
            .run();

          }

        }

      })()
    );
  }

};
