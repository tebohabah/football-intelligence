let fixtures=[];
let mode='demo';
let league='All';
let query='';
let loading=true;

const pct=n=>`${(Number(n)*100).toFixed(1)}%`;

const esc=s=>
  String(s??'').replace(
    /[&<>"']/g,
    c=>({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#039;'
    }[c])
  );

const demoFallback=[
  {
    id:'fallback-1',
    league:'Premier League',
    country:'England',
    kickoff:'19:30',
    home:'Arsenal',
    away:'Chelsea',
    probabilities:{
      home:.62,
      draw:.22,
      away:.16
    },
    expectedGoals:{
      home:1.82,
      away:1.18,
      total:3
    },
    markets:{
      over15:.78,
      over25:.57,
      btts:.59
    },
    confidence:76,
    modelAgreement:83,
    verdict:'Home Win',
    bestMarkets:[
      ['Home Win',.62],
      ['Over 1.5',.78],
      ['BTTS Yes',.59]
    ],
    factors:[
      {
        label:'Team strength',
        value:68,
        note:'Relative team rating advantage.'
      },
      {
        label:'Recent form',
        value:63,
        note:'Recent performance signal.'
      },
      {
        label:'Expected goals',
        value:67,
        note:'Attacking expectation differential.'
      },
      {
        label:'Home advantage',
        value:68,
        note:'Venue effect.'
      }
    ],
    topScores:[
      {h:2,a:1,p:.13},
      {h:1,a:0,p:.12},
      {h:2,a:0,p:.11},
      {h:1,a:1,p:.10},
      {h:3,a:1,p:.08}
    ]
  }
];

function showLoading(){

  document.getElementById(
    'main'
  ).innerHTML=`

    <section class="hero">

      <div>

        <div class="eyebrow">
          Football probability engine
        </div>

        <h1>
          Loading today's football intelligence…
        </h1>

        <p>
          Connecting to the live fixture engine.
          This normally takes only a few seconds.
        </p>

      </div>

      <div class="date-card">
        <small>ENGINE</small>
        <b>CONNECTING</b>
        <small>Please wait</small>
      </div>

    </section>

    <div class="match-grid">

      ${Array(6).fill(0).map(()=>`
        <div class="match loading-card">
          <div class="loading-line"></div>
          <div class="loading-line wide"></div>
          <div class="loading-line"></div>
        </div>
      `).join('')}

    </div>
  `;
}

async function fetchWithTimeout(
  url,
  timeout=7000
){

  const controller=
    new AbortController();

  const timer=
    setTimeout(
      ()=>controller.abort(),
      timeout
    );

  try{

    const r=
      await fetch(
        url,
        {
          signal:
            controller.signal,

          cache:'no-store'
        }
      );

    if(!r.ok){
      throw new Error(
        `HTTP ${r.status}`
      );
    }

    return await r.json();

  }finally{

    clearTimeout(timer);
  }
}

async function load(){

  showLoading();

  try{

    const d=
      await fetchWithTimeout(
        '/api/fixtures',
        7000
      );

    fixtures=
      Array.isArray(d.fixtures)
        ?d.fixtures
        :[];

    mode=
      d.mode||'unknown';

    document.getElementById(
      'modeBadge'
    ).textContent=
      mode.toUpperCase();

    loading=false;

    renderDashboard();

  }catch(e){

    console.warn(
      'Live engine unavailable:',
      e
    );

    fixtures=
      demoFallback;

    mode='fallback';

    document.getElementById(
      'modeBadge'
    ).textContent='FALLBACK';

    loading=false;

    renderDashboard();

    const notice=
      document.createElement(
        'div'
      );

    notice.className=
      'engine-notice';

    notice.innerHTML=`
      <b>Live connection is taking longer than expected.</b>
      Showing the last available demonstration forecast while
      the engine reconnects.
    `;

    document.getElementById(
      'main'
    ).prepend(notice);

    setTimeout(
      silentRefresh,
      15000
    );
  }
}

async function silentRefresh(){

  try{

    const d=
      await fetchWithTimeout(
        '/api/fixtures',
        5000
      );

    if(
      Array.isArray(d.fixtures) &&
      d.fixtures.length
    ){

      fixtures=d.fixtures;
      mode=d.mode||'live';

      document.getElementById(
        'modeBadge'
      ).textContent=
        mode.toUpperCase();

      renderDashboard();
    }

  }catch(_){

    setTimeout(
      silentRefresh,
      30000
    );
  }
}

function filtered(){

  return fixtures.filter(
    f=>
      (league==='All'||
       f.league===league)&&

      `${f.home} ${f.away} ${f.league}`
        .toLowerCase()
        .includes(
          query.toLowerCase()
        )
  );
}

function countries(){

  const map={};

  fixtures.forEach(
    f=>{
      const c=f.country||'Other';

      if(!map[c]){
        map[c]=new Set();
      }

      map[c].add(f.league);
    }
  );

  return map;
}

function renderDashboard(){

  const countryMap=
    countries();

  const countryNames=
    Object.keys(
      countryMap
    ).sort();

  const top=
    [...fixtures]
      .sort(
        (a,b)=>
          Math.max(
            b.probabilities.home,
            b.probabilities.draw,
            b.probabilities.away
          )-
          Math.max(
            a.probabilities.home,
            a.probabilities.draw,
            a.probabilities.away
          )
      )
      .slice(0,3);

  document.getElementById(
    'main'
  ).innerHTML=`

    <section class="hero">

      <div>

        <div class="eyebrow">
          Football probability engine
        </div>

        <h1>
          See the probabilities behind every match.
        </h1>

        <p>
          Team strength, form, expected goals and
          venue effects are combined into an
          explainable statistical forecast.
        </p>

      </div>

      <div class="date-card">

        <small>TODAY</small>

        <b>
          ${new Date().toLocaleDateString(
            'en-GB',
            {
              weekday:'short',
              day:'2-digit',
              month:'short'
            }
          )}
        </b>

        <small>
          ${fixtures.length}
          tracked fixtures
        </small>

      </div>

    </section>

    <div class="toolbar">

      <input
        class="search"
        id="search"
        placeholder="Search team or league…"
        value="${esc(query)}"
      >

      <select
        class="country-select"
        id="countrySelect"
      >

        <option value="All">
          🌍 All countries
        </option>

        ${countryNames.map(
          c=>`
            <option
              value="${esc(c)}"
            >
              ${esc(c)}
            </option>
          `
        ).join('')}

      </select>

      <select
        class="league-select"
        id="leagueSelect"
      >

        <option value="All">
          All leagues
        </option>

      </select>

    </div>

    <div class="section-title">

      <h2>
        🔥 Top opportunities
      </h2>

      <span>
        Highest single-outcome probability
      </span>

    </div>

    <div class="opportunities">

      ${
        top.length
          ?top.map(oppCard).join('')
          :'<div class="empty">No opportunities available.</div>'
      }

    </div>

    <div class="section-title">

      <h2>
        Today's matches
      </h2>

      <span>
        ${filtered().length} matches
      </span>

    </div>

    <div class="match-grid">

      ${
        filtered().map(matchCard).join('')||
        '<div class="empty">No matches match your filters.</div>'
      }

    </div>
  `;

  const searchEl=
    document.getElementById(
      'search'
    );

  searchEl.addEventListener(
    'input',
    e=>{
      query=e.target.value;
      renderDashboard();

      const s=
        document.getElementById(
          'search'
        );

      if(s){
        s.focus();

        s.setSelectionRange(
          query.length,
          query.length
        );
      }
    }
  );

  const countrySelect=
    document.getElementById(
      'countrySelect'
    );

  const leagueSelect=
    document.getElementById(
      'leagueSelect'
    );

  const currentCountry=
    countrySelect.dataset.current||
    'All';

  countrySelect.value=
    currentCountry;

  populateLeagues(
    currentCountry,
    leagueSelect,
    countryMap
  );

  leagueSelect.value=
    league==='All'
      ?'All'
      :league;

  countrySelect.addEventListener(
    'change',
    ()=>{

      const c=
        countrySelect.value;

      countrySelect.dataset.current=
        c;

      league='All';

      populateLeagues(
        c,
        leagueSelect,
        countryMap
      );

      renderDashboard();
    }
  );

  leagueSelect.addEventListener(
    'change',
    ()=>{

      league=
        leagueSelect.value;

      renderDashboard();
    }
  );
}

function populateLeagues(
  country,
  select,
  countryMap
){

  let leagues=[];

  if(country==='All'){

    leagues=
      [
        ...new Set(
          fixtures.map(
            f=>f.league
          )
        )
      ].sort();

  }else{

    leagues=
      [
        ...(countryMap[country]||
          new Set())
      ].sort();
  }

  select.innerHTML=`
    <option value="All">
      All leagues
    </option>

    ${leagues.map(
      l=>`
        <option
          value="${esc(l)}"
        >
          ${esc(l)}
        </option>
      `
    ).join('')}
  `;
}

function leader(f){

  return [
    ['Home Win',
      f.probabilities.home],

    ['Draw',
      f.probabilities.draw],

    ['Away Win',
      f.probabilities.away]

  ].sort(
    (a,b)=>b[1]-a[1]
  )[0];
}

function oppCard(f){

  const l=leader(f);

  return `

    <div
      class="opportunity"
      onclick="openMatch('${esc(f.id)}')"
    >

      <div class="opp-top">

        <span>
          ${esc(f.league)}
        </span>

        <span>
          ${esc(f.kickoff)}
        </span>

      </div>

      <div class="opp-name">
        ${esc(f.home)}
        vs
        ${esc(f.away)}
      </div>

      <div class="opp-market">
        ${esc(l[0])}
      </div>

      <div class="confidence">
        ${pct(l[1])}
      </div>

      <div class="meter">
        <i
          style="width:${l[1]*100}%"
        ></i>
      </div>

      <span class="risk">

        ${
          f.confidence>=75
            ?'HIGH CONFIDENCE'
            :'WATCH'
        }

        ·
        ${f.confidence}/100

      </span>

    </div>
  `;
}

function matchCard(f){

  const l=leader(f);

  return `

    <div
      class="match"
      onclick="openMatch('${esc(f.id)}')"
    >

      <div class="match-head">

        <span>
          ${esc(f.league)}
        </span>

        <span>
          ${esc(f.kickoff)}
        </span>

      </div>

      <div class="teams">

        <div class="team">
          ${esc(f.home)}
        </div>

        <div class="vs">
          VS
        </div>

        <div class="team away">
          ${esc(f.away)}
        </div>

      </div>

      <div class="pick-row">

        <span>
          Model leader
        </span>

        <b>
          ${esc(l[0])}
          ${pct(l[1])}
        </b>

      </div>

      <div class="mini-row">

        <span>
          xG
          ${Number(
            f.expectedGoals?.home||0
          ).toFixed(2)}
          –
          ${Number(
            f.expectedGoals?.away||0
          ).toFixed(2)}
        </span>

        <span>
          Confidence
          ${f.confidence}
        </span>

      </div>

    </div>
  `;
}

async function openMatch(id){

  try{

    const d=
      await fetchWithTimeout(
        '/api/match/'+
        encodeURIComponent(id),
        5000
      );

    if(!d.match)return;

    const p=d.match;

    const b=(
      label,
      v,
      primary=false
    )=>`

      <div
        class="prob ${
          primary
            ?'primary'
            :''
        }"
      >

        <small>
          ${label}
        </small>

        <b>
          ${pct(v)}
        </b>

        <div class="bar">

          <i
            style="width:${v*100}%"
          ></i>

        </div>

      </div>
    `;

    document.getElementById(
      'modalContent'
    ).innerHTML=`

      <div class="modal-title">

        <div class="eyebrow">
          ${esc(p.league)}
          ·
          ${esc(p.kickoff)}
        </div>

        <h1>

          ${esc(p.home)}

          <span
            style="color:var(--muted)"
          >
            vs
          </span>

          ${esc(p.away)}

        </h1>

        <p class="muted">

          Model verdict:

          <b class="accent">
            ${esc(p.verdict)}
          </b>

          · Confidence
          ${p.confidence}/100

          · Agreement
          ${p.modelAgreement}%

        </p>

      </div>

      <div class="prob-grid">

        ${b(
          'Home Win',
          p.probabilities.home,
          p.verdict==='Home Win'
        )}

        ${b(
          'Draw',
          p.probabilities.draw,
          p.verdict==='Draw'
        )}

        ${b(
          'Away Win',
          p.probabilities.away,
          p.verdict==='Away Win'
        )}

        ${b(
          'Over 1.5',
          p.markets.over15
        )}

        ${b(
          'Over 2.5',
          p.markets.over25
        )}

        ${b(
          'BTTS Yes',
          p.markets.btts
        )}

      </div>

      <div class="two-col">

        <div class="subcard">

          <h3>
            📌 Model verdict
          </h3>

          <p class="big-verdict">
            ${esc(p.verdict)}
          </p>

          <p class="muted">
            Expected goals:
            <b>
              ${p.expectedGoals.home.toFixed(2)}
            </b>
            –
            <b>
              ${p.expectedGoals.away.toFixed(2)}
            </b>
          </p>

          <p class="muted">
            Projected total:
            ${p.expectedGoals.total.toFixed(2)}
          </p>

          <p class="muted">
            Data quality:
            ${p.dataQuality}/100
          </p>

        </div>

        <div class="subcard">

          <h3>
            🎯 Highest-probability markets
          </h3>

          ${p.bestMarkets.map(
            x=>`

              <div class="pick-row">

                <span>
                  ${esc(x[0])}
                </span>

                <b>
                  ${pct(x[1])}
                </b>

              </div>

            `
          ).join('')}

        </div>

      </div>

      <div class="subcard space">

        <h3>
          🧠 Why the model leans this way
        </h3>

        ${p.factors.map(
          x=>`

            <div class="factor">

              <div class="factor-top">

                <b>
                  ${esc(x.label)}
                </b>

                <span>
                  ${Math.round(x.value)}/100
                </span>

              </div>

              <div class="meter">

                <i
                  style="width:${x.value}%"
                ></i>

              </div>

              <small>
                ${esc(x.note)}
              </small>

            </div>

          `
        ).join('')}

      </div>

      <div class="subcard space">

        <h3>
          🔢 Most likely scorelines
        </h3>

        <div class="score-list">

          ${p.topScores.map(
            s=>`

              <div class="score">

                <b>
                  ${s.h}–${s.a}
                </b>

                <small>
                  ${pct(s.p)}
                </small>

              </div>

            `
          ).join('')}

        </div>

      </div>

      <p class="warning">

        ⚠️ Probabilities are statistical
        estimates, not guarantees.

      </p>
    `;

    document.getElementById(
      'modal'
    ).classList.remove(
      'hidden'
    );

  }catch(e){

    console.error(e);

  }
}

function closeModal(){

  document.getElementById(
    'modal'
  ).classList.add(
    'hidden'
  );
}

function renderPage(page){

  document.querySelectorAll(
    '.nav'
  ).forEach(
    x=>x.classList.remove(
      'active'
    )
  );

  document.querySelector(
    `.nav[data-page="${page}"]`
  )?.classList.add(
    'active'
  );

  if(page==='dashboard'){
    renderDashboard();
    return;
  }

  if(page==='performance'){

    document.getElementById(
      'main'
    ).innerHTML=`

      <div class="page-head">

        <div class="eyebrow">
          Transparency layer
        </div>

        <h1>
          Model performance
        </h1>

        <p>
          Performance statistics will be
          populated from immutable prediction
          records as historical predictions
          accumulate.
        </p>

      </div>

      <div class="stats">

        <div class="stat">
          <small>
            1X2 accuracy
          </small>
          <b>—</b>
        </div>

        <div class="stat">
          <small>
            Brier score
          </small>
          <b>—</b>
        </div>

        <div class="stat">
          <small>
            Log loss
          </small>
          <b>—</b>
        </div>

        <div class="stat">
          <small>
            Tracked predictions
          </small>
          <b>0</b>
        </div>

      </div>

      <div class="subcard space">

        <h3>
          Why these metrics?
        </h3>

        <p class="muted">

          Accuracy measures hit rate.
          Brier score and log loss evaluate
          probability quality.

          Calibration checks whether a 60%
          forecast actually occurs about 60%
          of the time.

        </p>

      </div>
    `;

    return;
  }

  if(page==='methodology'){

    document.getElementById(
      'main'
    ).innerHTML=`

      <div class="page-head">

        <div class="eyebrow">
          The engine
        </div>

        <h1>
          Transparent by design.
        </h1>

        <p>
          The Football Intelligence Engine
          combines statistical modelling,
          historical data and live football
          context.
        </p>

      </div>

      <div class="method-grid">

        <div class="method-card">

          <h3>
            1. Team strength
          </h3>

          <p>
            Elo-style ratings capture
            persistent differences in
            team quality.
          </p>

          <h3>
            2. Goal model
          </h3>

          <p>
            Expected-goal estimates feed
            a Poisson-style score matrix.
          </p>

          <h3>
            3. Context
          </h3>

          <p>
            Form, home/away splits,
            opponent strength, rest,
            injuries and lineups can
            become model features.
          </p>

        </div>

        <div class="method-card">

          <h3>
            4. Ensemble & calibration
          </h3>

          <p>
            Independent models can be
            combined and calibrated against
            historical outcomes.
          </p>

          <div class="formula">

            data → features → models
            → score matrix → ensemble
            → calibration → probabilities

          </div>

          <h3>
            5. Accountability
          </h3>

          <p>
            Predictions are designed to be
            recorded before kickoff and
            graded after the match.
          </p>

        </div>

      </div>
    `;
  }
}

document.querySelectorAll(
  '.nav'
).forEach(
  b=>b.addEventListener(
    'click',
    ()=>renderPage(
      b.dataset.page
    )
  )
);

load();
