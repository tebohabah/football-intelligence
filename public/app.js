let fixtures=[];
let mode="demo";
let country="All";
let league="All";
let query="";
let lastUpdated=null;
let refreshTimer=null;

const pct=n=>`${(Number(n)*100).toFixed(1)}%`;

const esc=s=>String(s??"").replace(
  /[&<>"']/g,
  c=>({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#039;"
  }[c])
);

function formatDate(){
  return new Date().toLocaleDateString(
    "en-GB",
    {
      weekday:"short",
      day:"2-digit",
      month:"short"
    }
  );
}

function formatUpdated(date){
  if(!date)return "Not available";

  return new Date(date).toLocaleTimeString(
    "en-GB",
    {
      hour:"2-digit",
      minute:"2-digit",
      second:"2-digit"
    }
  );
}

async function load(){

  try{

    const r=await fetch(
      "/api/fixtures?_="+Date.now(),
      {
        cache:"no-store"
      }
    );

    if(!r.ok){
      throw Error("API error "+r.status);
    }

    const d=await r.json();

    fixtures=d.fixtures||[];
    mode=d.mode||"unknown";
    lastUpdated=d.generatedAt||new Date().toISOString();

    const badge=document.getElementById("modeBadge");

    if(badge){
      badge.textContent=
        mode==="live"
        ? "LIVE DATA"
        : "DEMO DATA";
    }

    renderDashboard();

    scheduleRefresh();

  }catch(e){

    const main=document.getElementById("main");

    if(main){

      main.innerHTML=`
        <div class="error-card">
          <h2>Engine connection problem</h2>
          <p>
            The dashboard could not load prediction data.
            Check the Worker deployment and refresh.
          </p>
          <small>${esc(e.message)}</small>
        </div>
      `;
    }

  }
}

function scheduleRefresh(){

  if(refreshTimer){
    clearInterval(refreshTimer);
  }

  /*
   * Refresh every 3 minutes.
   * The database/cache prevents unnecessary heavy work.
   */
  refreshTimer=setInterval(
    load,
    180000
  );
}

function countries(){

  return [
    "All",
    ...new Set(
      fixtures
        .map(f=>f.country)
        .filter(Boolean)
        .sort()
    )
  ];
}

function leaguesForCountry(){

  const source=
    country==="All"
    ? fixtures
    : fixtures.filter(
        f=>f.country===country
      );

  return [
    "All",
    ...new Set(
      source
        .map(f=>f.league)
        .filter(Boolean)
        .sort()
    )
  ];
}

function filtered(){

  return fixtures.filter(f=>{

    const countryMatch=
      country==="All" ||
      f.country===country;

    const leagueMatch=
      league==="All" ||
      f.league===league;

    const searchText=
      `${f.home} ${f.away} ${f.league} ${f.country}`
      .toLowerCase();

    const queryMatch=
      searchText.includes(
        query.toLowerCase()
      );

    return countryMatch &&
           leagueMatch &&
           queryMatch;
  });
}

function leader(f){

  return [
    ["Home Win",f.probabilities.home],
    ["Draw",f.probabilities.draw],
    ["Away Win",f.probabilities.away]
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
          ${esc(f.country)} · ${esc(f.league)}
        </span>

        <span>
          ${esc(f.kickoff)}
        </span>
      </div>

      <div class="opp-name">
        ${esc(f.home)} vs ${esc(f.away)}
      </div>

      <div class="opp-market">
        ${esc(l[0])}
      </div>

      <div class="confidence">
        ${pct(l[1])}
      </div>

      <div class="meter">
        <i style="width:${l[1]*100}%"></i>
      </div>

      <span class="risk">
        ${f.confidence>=75
          ?"HIGH CONFIDENCE"
          :"WATCH"}
        · ${f.confidence}/100
      </span>

    </div>
  `;
}

function matchCard(f){

  const l=leader(f);

  const status=f.providerStatusLong||f.status||"Scheduled";

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
          ${f.logos?.home
            ? `<img
                 src="${esc(f.logos.home)}"
                 style="width:28px;height:28px;object-fit:contain;vertical-align:middle;margin-right:7px"
               >`
            :""
          }

          ${esc(f.home)}
        </div>

        <div class="vs">
          VS
        </div>

        <div class="team away">

          ${esc(f.away)}

          ${f.logos?.away
            ? `<img
                 src="${esc(f.logos.away)}"
                 style="width:28px;height:28px;object-fit:contain;vertical-align:middle;margin-left:7px"
               >`
            :""
          }

        </div>

      </div>

      <div class="pick-row">
        <span>Model leader</span>
        <b>
          ${esc(l[0])}
          ${pct(l[1])}
        </b>
      </div>

      <div class="mini-row">

        <span>
          xG
          ${Number(f.expectedGoals.home).toFixed(2)}
          –
          ${Number(f.expectedGoals.away).toFixed(2)}
        </span>

        <span>
          Confidence ${f.confidence}
        </span>

      </div>

      <div
        style="
          margin-top:10px;
          font-size:10px;
          color:var(--muted);
        "
      >
        ${esc(status)}
      </div>

    </div>
  `;
}

function renderCountryLeagueControls(){

  const cList=countries();
  const lList=leaguesForCountry();

  return `
    <div class="toolbar">

      <input
        class="search"
        id="search"
        placeholder="Search team, country or league…"
        value="${esc(query)}"
      >

      <select
        id="countrySelect"
        class="search"
        style="flex:0 1 220px"
      >

        ${cList.map(c=>`
          <option
            value="${esc(c)}"
            ${country===c?"selected":""}
          >
            ${esc(c)}
          </option>
        `).join("")}

      </select>

      <select
        id="leagueSelect"
        class="search"
        style="flex:0 1 260px"
      >

        ${lList.map(l=>`
          <option
            value="${esc(l)}"
            ${league===l?"selected":""}
          >
            ${esc(l)}
          </option>
        `).join("")}

      </select>

    </div>
  `;
}

function renderDashboard(){

  const visible=filtered();

  const top=[
    ...visible
  ]
  .sort(
    (a,b)=>
      Math.max(
        b.probabilities.home,
        b.probabilities.draw,
        b.probabilities.away
      )
      -
      Math.max(
        a.probabilities.home,
        a.probabilities.draw,
        a.probabilities.away
      )
  )
  .slice(0,3);

  const liveText=
    mode==="live"
    ? "LIVE DATA CONNECTED"
    : "DEMO MODE";

  document.getElementById("main").innerHTML=`

    <section class="hero">

      <div>

        <div class="eyebrow">
          Football probability engine
        </div>

        <h1>
          See the probabilities behind every match.
        </h1>

        <p>
          Football Intelligence combines live fixtures,
          statistical forecasting and probability analysis
          to identify the most likely outcomes.
        </p>

      </div>

      <div class="date-card">

        <small>TODAY</small>

        <b>
          ${formatDate()}
        </b>

        <small>
          ${fixtures.length}
          tracked fixtures
        </small>

        <small
          style="
            margin-top:10px;
            color:${mode==="live"
              ?"var(--accent)"
              :"var(--warn)"};
            font-weight:800;
          "
        >
          ● ${liveText}
        </small>

        <small>
          Updated ${formatUpdated(lastUpdated)}
        </small>

      </div>

    </section>

    ${renderCountryLeagueControls()}

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
        top.map(oppCard).join("")
        ||
        `
          <div class="empty">
            No prediction opportunities found.
          </div>
        `
      }

    </div>

    <div class="section-title">

      <h2>
        Today's matches
      </h2>

      <span>
        ${visible.length} matches
      </span>

    </div>

    <div class="match-grid">

      ${
        visible.map(matchCard).join("")
        ||
        `
          <div class="empty">
            No matches match your filters.
          </div>
        `
      }

    </div>
  `;

  const searchEl=
    document.getElementById("search");

  if(searchEl){

    searchEl.addEventListener(
      "input",
      e=>{
        query=e.target.value;
        renderDashboard();

        const searchAgain=
          document.getElementById("search");

        if(searchAgain){
          searchAgain.focus();

          try{
            searchAgain.setSelectionRange(
              query.length,
              query.length
            );
          }catch{}
        }
      }
    );
  }

  const countryEl=
    document.getElementById("countrySelect");

  if(countryEl){

    countryEl.addEventListener(
      "change",
      e=>{

        country=e.target.value;

        /*
         * Whenever the country changes,
         * reset the league because the old league
         * may not exist in the new country.
         */
        league="All";

        renderDashboard();
      }
    );
  }

  const leagueEl=
    document.getElementById("leagueSelect");

  if(leagueEl){

    leagueEl.addEventListener(
      "change",
      e=>{
        league=e.target.value;
        renderDashboard();
      }
    );
  }
}

async function openMatch(id){

  try{

    const r=await fetch(
      "/api/match/"+
      encodeURIComponent(id)+
      "?_="+Date.now(),
      {
        cache:"no-store"
      }
    );

    const d=await r.json();

    if(!d.match)return;

    const p=d.match;

    const b=(
      label,
      v,
      primary=false
    )=>`

      <div class="prob ${primary?"primary":""}">

        <small>
          ${esc(label)}
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
      "modalContent"
    ).innerHTML=`

      <div class="modal-title">

        <div class="eyebrow">
          ${esc(p.country||"")}
          ·
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

        <p
          style="
            font-size:11px;
            color:${d.mode==="live"
              ?"var(--accent)"
              :"var(--warn)"};
          "
        >

          ●

          ${
            d.mode==="live"
            ? "LIVE PROVIDER DATA"
            : "DEMO MODEL"
          }

        </p>

      </div>

      <div class="prob-grid">

        ${b(
          "Home Win",
          p.probabilities.home,
          p.verdict==="Home Win"
        )}

        ${b(
          "Draw",
          p.probabilities.draw,
          p.verdict==="Draw"
        )}

        ${b(
          "Away Win",
          p.probabilities.away,
          p.verdict==="Away Win"
        )}

        ${b(
          "Over 1.5",
          p.markets.over15
        )}

        ${b(
          "Over 2.5",
          p.markets.over25
        )}

        ${b(
          "BTTS Yes",
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
              ${Number(
                p.expectedGoals.home
              ).toFixed(2)}
            </b>

            –

            <b>
              ${Number(
                p.expectedGoals.away
              ).toFixed(2)}
            </b>

          </p>

          <p class="muted">
            Projected total:
            ${Number(
              p.expectedGoals.total
            ).toFixed(2)}
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

          ${
            (p.bestMarkets||[])
            .map(x=>`

              <div class="pick-row">

                <span>
                  ${esc(x[0])}
                </span>

                <b>
                  ${pct(x[1])}
                </b>

              </div>

            `)
            .join("")
          }

        </div>

      </div>

      <div class="subcard space">

        <h3>
          🧠 Why the model leans this way
        </h3>

        ${
          (p.factors||[])
          .map(x=>`

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

          `)
          .join("")
        }

      </div>

      <div class="subcard space">

        <h3>
          🔢 Most likely scorelines
        </h3>

        <div class="score-list">

          ${
            (p.topScores||[])
            .map(s=>`

              <div class="score">

                <b>
                  ${s.h}–${s.a}
                </b>

                <small>
                  ${pct(s.p)}
                </small>

              </div>

            `)
            .join("")
          }

        </div>

      </div>

      ${
        p.advice
        ? `
          <div class="subcard space">

            <h3>
              💡 Provider insight
            </h3>

            <p class="muted">
              ${esc(p.advice)}
            </p>

          </div>
        `
        :""
      }

      <p class="warning">

        ⚠️

        ${
          esc(
            p.warning||
            "Predictions are statistical estimates. No outcome is guaranteed."
          )
        }

      </p>
    `;

    document
      .getElementById("modal")
      .classList
      .remove("hidden");

  }catch(e){

    console.error(e);

  }
}

function closeModal(){

  document
    .getElementById("modal")
    .classList
    .add("hidden");
}

function renderPage(page){

  document
    .querySelectorAll(".nav")
    .forEach(
      x=>x.classList.remove("active")
    );

  document
    .querySelector(
      `.nav[data-page="${page}"]`
    )
    ?.classList
    .add("active");

  if(page==="dashboard"){
    renderDashboard();
    return;
  }

  if(page==="performance"){

    document.getElementById(
      "main"
    ).innerHTML=`

      <div class="page-head">

        <div class="eyebrow">
          Transparency layer
        </div>

        <h1>
          Model performance
        </h1>

        <p>
          Performance statistics will be populated
          from immutable prediction records as the
          historical evaluation layer is built.
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
          Calibration checks whether a 60% forecast
          actually occurs about 60% of the time.

        </p>

      </div>
    `;

    return;
  }

  if(page==="methodology"){

    document.getElementById(
      "main"
    ).innerHTML=`

      <div class="page-head">

        <div class="eyebrow">
          The engine
        </div>

        <h1>
          Transparent by design.
        </h1>

        <p>
          Football Intelligence combines live
          football data with statistical modelling
          and probability analysis.
        </p>

      </div>

      <div class="method-grid">

        <div class="method-card">

          <h3>
            1. Live fixture intelligence
          </h3>

          <p>
            Fixtures are retrieved from the live
            football data provider and stored in
            the Cloudflare database.
          </p>

          <h3>
            2. Prediction layer
          </h3>

          <p>
            Provider predictions are combined with
            our local statistical framework.
          </p>

          <h3>
            3. Match context
          </h3>

          <p>
            Form, historical performance, expected
            goals and other contextual variables
            become progressively richer as the
            intelligence engine develops.
          </p>

        </div>

        <div class="method-card">

          <h3>
            4. Probability, not certainty
          </h3>

          <p>
            Every output is expressed as a probability.
            No prediction is presented as guaranteed.
          </p>

          <div class="formula">

            live data
            →
            features
            →
            models
            →
            probabilities
            →
            calibration
            →
            evaluation

          </div>

          <h3>
            5. Accountability
          </h3>

          <p>
            Future versions will retain predictions
            before kickoff and grade them against
            actual results.
          </p>

        </div>

      </div>
    `;
  }
}

document
  .querySelectorAll(".nav")
  .forEach(
    b=>b.addEventListener(
      "click",
      ()=>renderPage(
        b.dataset.page
      )
    )
  );

document
  .getElementById("modal")
  ?.addEventListener(
    "click",
    e=>{
      if(e.target.id==="modal"){
        closeModal();
      }
    }
  );

load();
