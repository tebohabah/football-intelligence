/* =========================================================
   FOOTBALL INTELLIGENCE ENGINE
   FRONTEND APPLICATION
   ========================================================= */

let fixtures = [];
let countries = [];
let leagues = [];

let mode = "demo";

let selectedCountry = "";
let selectedLeague = "";
let selectedDate = getTodayISO();

let query = "";
let currentPage = "dashboard";

let refreshTimer = null;


/* =========================================================
   HELPERS
   ========================================================= */

const pct = n =>
  `${(Number(n || 0) * 100).toFixed(1)}%`;

const num = n =>
  Number(n || 0);

const esc = s =>
  String(s ?? "")
    .replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[c]));


function getTodayISO() {
  const d = new Date();

  return d.toISOString().slice(0, 10);
}


function formatDate(date) {
  const d = new Date(`${date}T12:00:00`);

  return d.toLocaleDateString(
    "en-GB",
    {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric"
    }
  );
}


function formatKickoff(utc) {

  if (!utc) return "--:--";

  const d = new Date(utc);

  if (Number.isNaN(d.getTime())) {
    return "--:--";
  }

  return d.toLocaleTimeString(
    "en-GB",
    {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Africa/Lagos"
    }
  );
}


function statusLabel(status) {

  const map = {
    NS: "Not Started",
    TBD: "Time TBD",
    LIVE: "LIVE",
    1H: "1st Half",
    HT: "Half Time",
    2H: "2nd Half",
    ET: "Extra Time",
    PEN: "Penalties",
    FT: "Full Time",
    AET: "After Extra Time",
    PST: "Postponed",
    CANC: "Cancelled",
    ABD: "Abandoned"
  };

  return map[status] || status || "Scheduled";
}


function statusClass(status) {

  if (
    ["LIVE", "1H", "2H", "ET", "PEN"].includes(status)
  ) {
    return "status-live";
  }

  if (
    ["FT", "AET"].includes(status)
  ) {
    return "status-finished";
  }

  if (
    ["PST", "CANC", "ABD"].includes(status)
  ) {
    return "status-danger";
  }

  return "status-scheduled";
}


/* =========================================================
   API
   ========================================================= */

async function api(url) {

  const r = await fetch(url, {
    cache: "no-store"
  });

  if (!r.ok) {
    throw new Error(
      `Request failed (${r.status})`
    );
  }

  return await r.json();
}


/* =========================================================
   INITIAL LOAD
   ========================================================= */

async function load() {

  try {

    setMode("CONNECTING");

    await Promise.all([
      loadCountries(),
      loadFixtures()
    ]);

    renderDashboard();

    startAutoRefresh();

  } catch (e) {

    console.error(e);

    renderError(e);

  }

}


/* =========================================================
   LOAD COUNTRIES
   ========================================================= */

async function loadCountries() {

  const data =
    await api("/api/countries");

  countries =
    data.countries || [];

}


/* =========================================================
   LOAD LEAGUES
   ========================================================= */

async function loadLeagues(country = "") {

  const url =
    country
      ? `/api/leagues?country=${encodeURIComponent(country)}`
      : "/api/leagues";

  const data =
    await api(url);

  leagues =
    data.leagues || [];

}


/* =========================================================
   LOAD FIXTURES
   ========================================================= */

async function loadFixtures() {

  let url =
    `/api/fixtures?date=${encodeURIComponent(
      selectedDate
    )}`;

  if (selectedCountry) {

    url +=
      `&country=${encodeURIComponent(
        selectedCountry
      )}`;

  }

  if (selectedLeague) {

    url +=
      `&league=${encodeURIComponent(
        selectedLeague
      )}`;

  }

  const data =
    await api(url);

  fixtures =
    data.fixtures || [];

  mode =
    data.mode || "unknown";

  setMode(mode.toUpperCase());

}


/* =========================================================
   MODE BADGE
   ========================================================= */

function setMode(value) {

  const badge =
    document.getElementById(
      "modeBadge"
    );

  if (!badge) return;

  badge.textContent =
    value;

}


/* =========================================================
   AUTO REFRESH
   ========================================================= */

function startAutoRefresh() {

  if (refreshTimer) {
    clearInterval(refreshTimer);
  }

  refreshTimer =
    setInterval(
      async () => {

        if (
          currentPage !==
          "dashboard"
        ) {
          return;
        }

        try {

          await loadFixtures();

          renderDashboard();

        } catch (e) {

          console.error(
            "Auto refresh failed:",
            e
          );

        }

      },
      120000
    );

}


/* =========================================================
   FILTERED FIXTURES
   ========================================================= */

function filtered() {

  return fixtures.filter(f => {

    const searchText =
      `${f.home} ${f.away} ${f.league} ${f.country}`
        .toLowerCase();

    const matchesQuery =
      searchText.includes(
        query.toLowerCase()
      );

    const matchesCountry =
      !selectedCountry ||
      String(f.country).toLowerCase() ===
        String(selectedCountry).toLowerCase();

    const matchesLeague =
      !selectedLeague ||
      String(f.league).toLowerCase() ===
        String(selectedLeague).toLowerCase();

    return (
      matchesQuery &&
      matchesCountry &&
      matchesLeague
    );

  });

}


/* =========================================================
   LEAGUE GROUPING
   ========================================================= */

function groupedLeagues() {

  const groups = {};

  leagues.forEach(l => {

    const country =
      l.country || "Other";

    if (!groups[country]) {
      groups[country] = [];
    }

    groups[country].push(l);

  });

  return groups;

}


/* =========================================================
   PREDICTION LEADER
   ========================================================= */

function leader(f) {

  return [
    [
      "Home Win",
      num(f.probabilities?.home)
    ],

    [
      "Draw",
      num(f.probabilities?.draw)
    ],

    [
      "Away Win",
      num(f.probabilities?.away)
    ]
  ].sort(
    (a, b) => b[1] - a[1]
  )[0];

}


/* =========================================================
   CONFIDENCE LABEL
   ========================================================= */

function confidenceLabel(value) {

  value =
    Number(value || 0);

  if (value >= 80) {
    return {
      label: "Very Strong",
      className: "very-strong"
    };
  }

  if (value >= 70) {
    return {
      label: "Strong",
      className: "strong"
    };
  }

  if (value >= 60) {
    return {
      label: "Moderate",
      className: "moderate"
    };
  }

  return {
    label: "Watch",
    className: "watch"
  };

}


/* =========================================================
   DASHBOARD
   ========================================================= */

function renderDashboard() {

  currentPage =
    "dashboard";

  activateNav(
    "dashboard"
  );

  const list =
    filtered();

  const top =
    [...list]
      .sort(
        (a, b) =>
          Math.max(
            num(b.probabilities?.home),
            num(b.probabilities?.draw),
            num(b.probabilities?.away)
          ) -
          Math.max(
            num(a.probabilities?.home),
            num(a.probabilities?.draw),
            num(a.probabilities?.away)
          )
      )
      .slice(0, 3);


  document.getElementById(
    "main"
  ).innerHTML = `

    <section class="hero">

      <div class="hero-copy">

        <div class="eyebrow">
          FOOTBALL PROBABILITY ENGINE
        </div>

        <h1>
          Football intelligence,
          <span>before kickoff.</span>
        </h1>

        <p>
          Explore statistical probabilities, expected goals,
          scoreline simulations and model confidence across
          today's football fixtures.
        </p>

        <div class="hero-status">

          <span class="status-pill">
            <i></i>
            ${mode === "live" ? "LIVE DATA CONNECTED" : "DEMO DATA"}
          </span>

          <span class="updated">
            Updated ${new Date().toLocaleTimeString(
              "en-GB",
              {
                hour: "2-digit",
                minute: "2-digit"
              }
            )}
          </span>

        </div>

      </div>


      <div class="date-card">

        <small>ANALYSIS DATE</small>

        <strong>
          ${esc(formatDate(selectedDate))}
        </strong>

        <span>
          ${list.length} fixtures available
        </span>

      </div>

    </section>


    ${renderControls()}


    <section class="engine-summary">

      <div class="summary-card">

        <span class="summary-icon">⚽</span>

        <div>
          <small>FIXTURES</small>
          <strong>${list.length}</strong>
        </div>

      </div>


      <div class="summary-card">

        <span class="summary-icon">🎯</span>

        <div>
          <small>HIGH CONFIDENCE</small>
          <strong>
            ${
              list.filter(
                x => num(x.confidence) >= 75
              ).length
            }
          </strong>
        </div>

      </div>


      <div class="summary-card">

        <span class="summary-icon">📊</span>

        <div>
          <small>LEAGUES</small>
          <strong>
            ${
              new Set(
                list.map(x => x.league)
              ).size
            }
          </strong>
        </div>

      </div>


      <div class="summary-card">

        <span class="summary-icon">🧠</span>

        <div>
          <small>MODEL</small>
          <strong>FI 3.0</strong>
        </div>

      </div>

    </section>


    ${
      top.length
        ? `

        <div class="section-title">

          <div>
            <div class="eyebrow">
              MODEL WATCHLIST
            </div>

            <h2>
              Highest probability opportunities
            </h2>
          </div>

          <span>
            Ranked by strongest single probability
          </span>

        </div>

        <div class="opportunities">

          ${top.map(
            opportunityCard
          ).join("")}

        </div>

      `
        : ""
    }


    <div class="section-title matches-heading">

      <div>
        <div class="eyebrow">
          FIXTURE INTELLIGENCE
        </div>

        <h2>
          ${selectedLeague || "Today's matches"}
        </h2>
      </div>

      <span>
        ${list.length} matches
      </span>

    </div>


    <div class="match-grid">

      ${
        list.length
          ? list.map(
              matchCard
            ).join("")
          : `
            <div class="empty">

              <div class="empty-icon">
                🔎
              </div>

              <h3>
                No fixtures found
              </h3>

              <p>
                Try another country, league,
                date or search term.
              </p>

            </div>
          `
      }

    </div>

  `;


  attachDashboardEvents();

}


/* =========================================================
   CONTROLS
   ========================================================= */

function renderControls() {

  const groups =
    groupedLeagues();

  let leagueOptions =
    `<option value="">All leagues</option>`;

  Object.keys(groups)
    .sort()
    .forEach(country => {

      leagueOptions += `
        <optgroup label="${esc(country)}">
          ${groups[country]
            .sort(
              (a, b) =>
                String(a.league)
                  .localeCompare(
                    String(b.league)
                  )
            )
            .map(
              l => `
                <option
                  value="${esc(l.league)}"
                  ${
                    selectedLeague ===
                    l.league
                      ? "selected"
                      : ""
                  }
                >
                  ${esc(l.league)}
                </option>
              `
            )
            .join("")}
        </optgroup>
      `;

    });


  return `

    <section class="control-panel">

      <div class="control-top">

        <div>

          <div class="eyebrow">
            MATCH EXPLORER
          </div>

          <h3>
            Find the matches you want to analyse
          </h3>

        </div>

        <button
          class="refresh-btn"
          id="refreshBtn"
        >
          ↻ Refresh
        </button>

      </div>


      <div class="controls">

        <div class="control search-control">

          <label>
            Search
          </label>

          <div class="input-wrap">

            <span>⌕</span>

            <input
              id="search"
              placeholder="Team, league or country..."
              value="${esc(query)}"
            >

          </div>

        </div>


        <div class="control">

          <label>
            Date
          </label>

          <input
            type="date"
            id="dateSelect"
            value="${esc(selectedDate)}"
          >

        </div>


        <div class="control">

          <label>
            Country
          </label>

          <select id="countrySelect">

            <option value="">
              All countries
            </option>

            ${countries
              .sort(
                (a, b) =>
                  a.localeCompare(b)
              )
              .map(
                country => `
                  <option
                    value="${esc(country)}"
                    ${
                      selectedCountry ===
                      country
                        ? "selected"
                        : ""
                    }
                  >
                    ${esc(country)}
                  </option>
                `
              )
              .join("")}

          </select>

        </div>


        <div class="control">

          <label>
            League
          </label>

          <select id="leagueSelect">

            ${leagueOptions}

          </select>

        </div>

      </div>


      <div class="filter-info">

        <span>
          ${
            selectedCountry
              ? `🌍 ${esc(selectedCountry)}`
              : "🌍 All countries"
          }
        </span>

        <span>
          ${
            selectedLeague
              ? `🏆 ${esc(selectedLeague)}`
              : "🏆 All leagues"
          }
        </span>

        <button
          class="clear-filters"
          id="clearFilters"
        >
          Clear filters
        </button>

      </div>

    </section>

  `;

}


/* =========================================================
   DASHBOARD EVENTS
   ========================================================= */

function attachDashboardEvents() {

  const search =
    document.getElementById(
      "search"
    );

  const date =
    document.getElementById(
      "dateSelect"
    );

  const country =
    document.getElementById(
      "countrySelect"
    );

  const leagueSelect =
    document.getElementById(
      "leagueSelect"
    );

  const refresh =
    document.getElementById(
      "refreshBtn"
    );

  const clear =
    document.getElementById(
      "clearFilters"
    );


  search?.addEventListener(
    "input",
    e => {

      query =
        e.target.value;

      renderDashboard();

      const input =
        document.getElementById(
          "search"
        );

      if (input) {

        input.focus();

        input.setSelectionRange(
          query.length,
          query.length
        );

      }

    }
  );


  date?.addEventListener(
    "change",
    async e => {

      selectedDate =
        e.target.value ||
        getTodayISO();

      await reloadDashboard();

    }
  );


  country?.addEventListener(
    "change",
    async e => {

      selectedCountry =
        e.target.value;

      selectedLeague = "";

      try {

        await loadLeagues(
          selectedCountry
        );

        await loadFixtures();

        renderDashboard();

      } catch (err) {

        renderError(err);

      }

    }
  );


  leagueSelect?.addEventListener(
    "change",
    async e => {

      selectedLeague =
        e.target.value;

      try {

        await loadFixtures();

        renderDashboard();

      } catch (err) {

        renderError(err);

      }

    }
  );


  refresh?.addEventListener(
    "click",
    async () => {

      await reloadDashboard();

    }
  );


  clear?.addEventListener(
    "click",
    async () => {

      selectedCountry = "";
      selectedLeague = "";
      query = "";

      await loadLeagues("");

      await reloadDashboard();

    }
  );

}


/* =========================================================
   RELOAD
   ========================================================= */

async function reloadDashboard() {

  const btn =
    document.getElementById(
      "refreshBtn"
    );

  if (btn) {

    btn.disabled = true;

    btn.innerHTML =
      "↻ Updating...";

  }

  try {

    await loadFixtures();

    renderDashboard();

  } catch (e) {

    renderError(e);

  } finally {

    const newBtn =
      document.getElementById(
        "refreshBtn"
      );

    if (newBtn) {

      newBtn.disabled =
        false;

      newBtn.innerHTML =
        "↻ Refresh";

    }

  }

}


/* =========================================================
   OPPORTUNITY CARD
   ========================================================= */

function opportunityCard(f) {

  const l =
    leader(f);

  const confidence =
    confidenceLabel(
      f.confidence
    );


  return `

    <article
      class="opportunity ${confidence.className}"
      onclick="openMatch('${esc(f.id)}')"
    >

      <div class="opp-top">

        <span>
          ${esc(f.country || "")}
          ·
          ${esc(f.league || "")}
        </span>

        <span>
          ${esc(
            f.kickoff ||
            formatKickoff(
              f.providerKickoffUtc
            )
          )}
        </span>

      </div>


      <div class="opp-name">

        ${esc(f.home)}

        <span>vs</span>

        ${esc(f.away)}

      </div>


      <div class="opp-analysis">

        <div>

          <small>
            MODEL LEADER
          </small>

          <strong>
            ${esc(l[0])}
          </strong>

        </div>

        <div class="opp-prob">
          ${pct(l[1])}
        </div>

      </div>


      <div class="meter">

        <i
          style="width:${Math.min(
            100,
            l[1] * 100
          )}%"
        ></i>

      </div>


      <div class="opp-bottom">

        <span
          class="confidence-badge ${confidence.className}"
        >
          ${confidence.label}
        </span>

        <span>
          Model confidence
          <b>${num(f.confidence)}/100</b>
        </span>

      </div>

    </article>

  `;

}


/* =========================================================
   MATCH CARD
   ========================================================= */

function matchCard(f) {

  const l =
    leader(f);

  const confidence =
    confidenceLabel(
      f.confidence
    );

  const status =
    f.providerStatus ||
    f.status ||
    "NS";

  const kickoff =
    f.kickoff ||
    formatKickoff(
      f.providerKickoffUtc
    );


  return `

    <article
      class="match"
      onclick="openMatch('${esc(f.id)}')"
    >

      <div class="match-head">

        <span class="league-label">

          ${
            f.country
              ? `${esc(f.country)} · `
              : ""
          }

          ${esc(f.league)}

        </span>

        <span
          class="fixture-status ${statusClass(status)}"
        >
          ${esc(
            statusLabel(status)
          )}
        </span>

      </div>


      <div class="match-time">
        ${esc(kickoff)}
      </div>


      <div class="teams">

        <div class="team">

          ${
            f.logos?.home
              ? `
                <img
                  src="${esc(f.logos.home)}"
                  alt=""
                  class="team-logo"
                >
              `
              : `
                <span class="team-logo-placeholder">
                  ⚽
                </span>
              `
          }

          <span>
            ${esc(f.home)}
          </span>

        </div>


        <div class="vs">
          VS
        </div>


        <div class="team away">

          <span>
            ${esc(f.away)}
          </span>

          ${
            f.logos?.away
              ? `
                <img
                  src="${esc(f.logos.away)}"
                  alt=""
                  class="team-logo"
                >
              `
              : `
                <span class="team-logo-placeholder">
                  ⚽
                </span>
              `
          }

        </div>

      </div>


      <div class="prediction-strip">

        <div>

          <small>
            PREDICTION
          </small>

          <strong>
            ${esc(l[0])}
          </strong>

        </div>

        <div class="prediction-number">
          ${pct(l[1])}
        </div>

      </div>


      <div class="card-stats">

        <span>
          xG
          <b>
            ${num(
              f.expectedGoals?.home
            ).toFixed(2)}
            –
            ${num(
              f.expectedGoals?.away
            ).toFixed(2)}
          </b>
        </span>

        <span>
          Confidence
          <b>
            ${num(f.confidence)}
          </b>
        </span>

        <span>
          Data
          <b>
            ${num(f.dataQuality)}
          </b>
        </span>

      </div>


      <div class="card-footer">

        <span
          class="confidence-badge ${confidence.className}"
        >
          ${confidence.label}
        </span>

        <span class="view-analysis">
          View full analysis →
        </span>

      </div>

    </article>

  `;

}


/* =========================================================
   MATCH DETAIL
   ========================================================= */

async function openMatch(id) {

  const modal =
    document.getElementById(
      "modal"
    );

  const content =
    document.getElementById(
      "modalContent"
    );


  modal.classList.remove(
    "hidden"
  );


  content.innerHTML = `

    <div class="modal-loading">

      <div class="loader"></div>

      <h3>
        Running match analysis...
      </h3>

      <p>
        Building the probability profile.
      </p>

    </div>

  `;


  try {

    const data =
      await api(
        "/api/match/" +
        encodeURIComponent(id)
      );

    if (!data.match) {
      throw new Error(
        "Match not found"
      );
    }

    renderMatchModal(
      data.match
    );

  } catch (e) {

    content.innerHTML = `

      <div class="error-card">

        <h2>
          Analysis unavailable
        </h2>

        <p>
          ${esc(e.message)}
        </p>

      </div>

    `;

  }

}


/* =========================================================
   RENDER MATCH MODAL
   ========================================================= */

function renderMatchModal(p) {

  const leaderPick =
    leader(p);

  const confidence =
    confidenceLabel(
      p.confidence
    );


  const probabilityBox =
    (label, value, primary = false) => `

      <div
        class="prob ${
          primary ? "primary" : ""
        }"
      >

        <small>
          ${esc(label)}
        </small>

        <b>
          ${pct(value)}
        </b>

        <div class="bar">
          <i
            style="width:${Math.min(
              100,
              num(value) * 100
            )}%"
          ></i>
        </div>

      </div>

    `;


  const marketBox =
    (label, value) => `

      <div class="market-box">

        <div>

          <span>
            ${esc(label)}
          </span>

          <small>
            Probability
          </small>

        </div>

        <strong>
          ${pct(value)}
        </strong>

      </div>

    `;


  document.getElementById(
    "modalContent"
  ).innerHTML = `

    <div class="modal-header">

      <div>

        <div class="eyebrow">
          ${esc(p.country || "")}
          ${p.country ? " · " : ""}
          ${esc(p.league)}
        </div>

        <h1>

          ${esc(p.home)}

          <span>
            vs
          </span>

          ${esc(p.away)}

        </h1>

        <p class="modal-kickoff">

          ${esc(
            p.kickoff ||
            formatKickoff(
              p.providerKickoffUtc
            )
          )}

          ·

          ${esc(
            statusLabel(
              p.providerStatus
            )
          )}

        </p>

      </div>


      <div class="modal-confidence">

        <span>
          MODEL CONFIDENCE
        </span>

        <strong>
          ${num(p.confidence)}
        </strong>

        <small>
          ${confidence.label}
        </small>

      </div>

    </div>


    <!-- PRIMARY VERDICT -->

    <section class="verdict-banner">

      <div>

        <small>
          PRIMARY MODEL VERDICT
        </small>

        <strong>
          ${esc(p.verdict)}
        </strong>

        <span>
          Highest probability outcome
        </span>

      </div>


      <div class="verdict-number">
        ${pct(leaderPick[1])}
      </div>

    </section>


    <!-- 1X2 -->

    <div class="analysis-section">

      <div class="section-heading">

        <div>
          <div class="eyebrow">
            RESULT PROBABILITIES
          </div>

          <h3>
            Match outcome
          </h3>
        </div>

        <span>
          Model ${esc(
            p.modelVersion ||
            "FI"
          )}
        </span>

      </div>


      <div class="prob-grid">

        ${probabilityBox(
          "Home Win",
          p.probabilities?.home,
          p.verdict ===
            "Home Win"
        )}

        ${probabilityBox(
          "Draw",
          p.probabilities?.draw,
          p.verdict ===
            "Draw"
        )}

        ${probabilityBox(
          "Away Win",
          p.probabilities?.away,
          p.verdict ===
            "Away Win"
        )}

      </div>

    </div>


    <!-- EXPECTED GOALS -->

    <div class="two-col">

      <div class="subcard">

        <div class="subcard-title">
          <span class="icon-box">
            ⚽
          </span>

          <div>
            <small>
              EXPECTED GOALS
            </small>

            <h3>
              Goal projection
            </h3>
          </div>
        </div>


        <div class="xg-display">

          <div>

            <small>
              ${esc(p.home)}
            </small>

            <strong>
              ${num(
                p.expectedGoals?.home
              ).toFixed(2)}
            </strong>

          </div>

          <span>
            –
          </span>

          <div>

            <small>
              ${esc(p.away)}
            </small>

            <strong>
              ${num(
                p.expectedGoals?.away
              ).toFixed(2)}
            </strong>

          </div>

        </div>


        <div class="total-xg">

          Projected total

          <b>
            ${num(
              p.expectedGoals?.total
            ).toFixed(2)}
          </b>

        </div>

      </div>


      <div class="subcard">

        <div class="subcard-title">

          <span class="icon-box">
            🎯
          </span>

          <div>
            <small>
              MODEL AGREEMENT
            </small>

            <h3>
              Signal strength
            </h3>
          </div>

        </div>


        <div class="agreement">

          <div class="agreement-circle">

            <strong>
              ${num(
                p.modelAgreement
              )}%
            </strong>

          </div>

          <div>

            <strong>
              ${confidence.label}
            </strong>

            <p>
              Agreement between the
              current statistical signals.
            </p>

          </div>

        </div>

      </div>

    </div>


    <!-- BETTING / MARKET PROBABILITIES -->

    <div class="analysis-section">

      <div class="section-heading">

        <div>

          <div class="eyebrow">
            GOALS & BOTH TEAMS TO SCORE
          </div>

          <h3>
            Market probabilities
          </h3>

        </div>

      </div>


      <div class="market-grid">

        ${marketBox(
          "Over 0.5 Goals",
          p.markets?.over05
        )}

        ${marketBox(
          "Over 1.5 Goals",
          p.markets?.over15
        )}

        ${marketBox(
          "Over 2.5 Goals",
          p.markets?.over25
        )}

        ${marketBox(
          "Over 3.5 Goals",
          p.markets?.over35
        )}

        ${marketBox(
          "BTTS — Yes",
          p.markets?.btts
        )}

        ${marketBox(
          "BTTS — No",
          p.markets?.bttsNo
        )}

      </div>

    </div>


    <!-- BEST MARKETS -->

    <div class="subcard space">

      <div class="section-heading">

        <div>

          <div class="eyebrow">
            MODEL SHORTLIST
          </div>

          <h3>
            Highest-probability signals
          </h3>

        </div>

      </div>


      <div class="best-markets">

        ${
          (p.bestMarkets || [])
            .map(
              (x, index) => `

                <div class="best-market">

                  <span class="rank">
                    ${index + 1}
                  </span>

                  <div>

                    <strong>
                      ${esc(x[0])}
                    </strong>

                    <small>
                      Current model probability
                    </small>

                  </div>

                  <b>
                    ${pct(x[1])}
                  </b>

                </div>

              `
            )
            .join("")
        }

      </div>

    </div>


    <!-- MODEL FACTORS -->

    <div class="subcard space">

      <div class="section-heading">

        <div>

          <div class="eyebrow">
            EXPLAINABLE AI LAYER
          </div>

          <h3>
            Why the model leans this way
          </h3>

        </div>

      </div>


      ${
        (p.factors || [])
          .map(
            factor => `

              <div class="factor">

                <div class="factor-top">

                  <strong>
                    ${esc(factor.label)}
                  </strong>

                  <span>
                    ${Math.round(
                      factor.value
                    )}/100
                  </span>

                </div>

                <div class="factor-bar">

                  <i
                    style="width:${Math.min(
                      100,
                      factor.value
                    )}%"
                  ></i>

                </div>

                <small>
                  ${esc(factor.note)}
                </small>

              </div>

            `
          )
          .join("")
      }

    </div>


    <!-- SCORELINES -->

    <div class="subcard space">

      <div class="section-heading">

        <div>

          <div class="eyebrow">
            SCORE SIMULATION
          </div>

          <h3>
            Most likely scorelines
          </h3>

        </div>

      </div>


      <div class="score-list">

        ${
          (p.topScores || [])
            .map(
              s => `

                <div class="score">

                  <strong>
                    ${s.h} – ${s.a}
                  </strong>

                  <span>
                    ${pct(s.p)}
                  </span>

                </div>

              `
            )
            .join("")
        }

      </div>

    </div>


    <!-- DATA QUALITY -->

    <div class="data-quality">

      <div>

        <span>
          DATA QUALITY
        </span>

        <strong>
          ${num(
            p.dataQuality
          )}/100
        </strong>

      </div>


      <div class="quality-bar">

        <i
          style="width:${Math.min(
            100,
            num(p.dataQuality)
          )}%"
        ></i>

      </div>


      ${
        p.warning
          ? `
            <p>
              ⚠️ ${esc(p.warning)}
            </p>
          `
          : ""
      }

    </div>


    <div class="responsible-note">

      <strong>
        Statistical forecast
      </strong>

      <span>
        Probabilities describe model estimates,
        not guaranteed outcomes. Football contains
        substantial uncertainty and variance.
      </span>

    </div>

  `;

}


/* =========================================================
   CLOSE MODAL
   ========================================================= */

function closeModal() {

  document
    .getElementById("modal")
    .classList.add(
      "hidden"
    );

}


/* =========================================================
   ESC KEY
   ========================================================= */

document.addEventListener(
  "keydown",
  e => {

    if (
      e.key === "Escape"
    ) {
      closeModal();
    }

  }
);


/* =========================================================
   NAVIGATION
   ========================================================= */

function activateNav(page) {

  document
    .querySelectorAll(".nav")
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.page ===
          page
      );

    });

}


function renderPage(page) {

  currentPage =
    page;

  activateNav(
    page
  );


  if (
    page ===
    "dashboard"
  ) {

    renderDashboard();

    return;

  }


  if (
    page ===
    "performance"
  ) {

    renderPerformance();

    return;

  }


  if (
    page ===
    "methodology"
  ) {

    renderMethodology();

    return;

  }

}


/* =========================================================
   PERFORMANCE PAGE
   ========================================================= */

function renderPerformance() {

  document.getElementById(
    "main"
  ).innerHTML = `

    <div class="page-head">

      <div class="eyebrow">
        TRANSPARENCY LAYER
      </div>

      <h1>
        Model performance
      </h1>

      <p>
        The intelligence engine is being built with
        a permanent prediction ledger so forecasts can
        eventually be measured against actual outcomes.
      </p>

    </div>


    <div class="stats">

      <div class="stat">

        <small>
          1X2 accuracy
        </small>

        <b>—</b>

        <span>
          Awaiting graded predictions
        </span>

      </div>


      <div class="stat">

        <small>
          Brier score
        </small>

        <b>—</b>

        <span>
          Probability quality
        </span>

      </div>


      <div class="stat">

        <small>
          Log loss
        </small>

        <b>—</b>

        <span>
          Forecast sharpness
        </span>

      </div>


      <div class="stat">

        <small>
          Tracked predictions
        </small>

        <b>0</b>

        <span>
          Prediction ledger
        </span>

      </div>

    </div>


    <div class="method-grid">

      <div class="method-card">

        <div class="eyebrow">
          CALIBRATION
        </div>

        <h2>
          Accuracy isn't enough.
        </h2>

        <p>
          A serious prediction system must evaluate
          whether its probabilities are reliable,
          not merely whether the most likely outcome
          happened.
        </p>

        <div class="metric-explanation">

          <div>
            <strong>
              Brier Score
            </strong>

            <span>
              Measures the quality of probabilistic
              forecasts.
            </span>
          </div>

          <div>
            <strong>
              Log Loss
            </strong>

            <span>
              Penalizes confident incorrect predictions.
            </span>
          </div>

          <div>
            <strong>
              Calibration
            </strong>

            <span>
              Checks whether 70% predictions happen
              approximately 70% of the time.
            </span>
          </div>

        </div>

      </div>


      <div class="method-card">

        <div class="eyebrow">
          ACCOUNTABILITY
        </div>

        <h2>
          Every prediction should be testable.
        </h2>

        <p>
          The next stages of the engine will permanently
          record predictions before kickoff and grade
          them after the match.
        </p>

        <div class="formula">
          prediction → kickoff → result → grading → calibration
        </div>

      </div>

    </div>

  `;

}


/* =========================================================
   METHODOLOGY PAGE
   ========================================================= */

function renderMethodology() {

  document.getElementById(
    "main"
  ).innerHTML = `

    <div class="page-head">

      <div class="eyebrow">
        THE ENGINE
      </div>

      <h1>
        Transparent by design.
      </h1>

      <p>
        Football Intelligence is designed around
        probabilities rather than exaggerated certainty.
        Each forecast is generated from multiple statistical
        signals that can be independently evaluated.
      </p>

    </div>


    <div class="method-grid">

      <div class="method-card">

        <div class="method-number">
          01
        </div>

        <h2>
          Team strength
        </h2>

        <p>
          Team ratings provide a persistent measure of
          relative football strength. Over time these
          ratings can incorporate results, opponent quality
          and home/away performance.
        </p>

      </div>


      <div class="method-card">

        <div class="method-number">
          02
        </div>

        <h2>
          Goal modelling
        </h2>

        <p>
          Expected-goal estimates feed a probability
          distribution of possible scorelines. From this
          distribution the engine derives match results,
          totals, BTTS and correct-score probabilities.
        </p>

      </div>


      <div class="method-card">

        <div class="method-number">
          03
        </div>

        <h2>
          Match context
        </h2>

        <p>
          The architecture is designed to incorporate
          recent form, home/away splits, injuries,
          projected lineups, rest, fixture congestion,
          opponent strength and other contextual variables.
        </p>

      </div>


      <div class="method-card">

        <div class="method-number">
          04
        </div>

        <h2>
          Ensemble modelling
        </h2>

        <p>
          Multiple independent signals can be combined
          into a single calibrated forecast rather than
          allowing one statistic to dominate the prediction.
        </p>

        <div class="formula">
          data → features → models → score matrix → ensemble → calibration
        </div>

      </div>


      <div class="method-card">

        <div class="method-number">
          05
        </div>

        <h2>
          Walk-forward validation
        </h2>

        <p>
          Historical evaluation must respect time. The
          model should only use information that would
          genuinely have been available before each match,
          preventing future-information leakage.
        </p>

      </div>


      <div class="method-card">

        <div class="method-number">
          06
        </div>

        <h2>
          Prediction accountability
        </h2>

        <p>
          Predictions should be stored before kickoff,
          then compared with actual results. This creates
          a genuine performance record instead of allowing
          forecasts to be rewritten after the fact.
        </p>

      </div>

    </div>

  `;

}


/* =========================================================
   ERROR PAGE
   ========================================================= */

function renderError(e) {

  document.getElementById(
    "main"
  ).innerHTML = `

    <div class="error-card">

      <div class="error-icon">
        ⚠️
      </div>

      <h2>
        Engine connection problem
      </h2>

      <p>
        The dashboard could not retrieve prediction data.
        Check that the Cloudflare Worker and database
        connection are online.
      </p>

      <small>
        ${esc(e?.message || "Unknown error")}
      </small>

      <button
        class="refresh-btn"
        onclick="load()"
      >
        Try again
      </button>

    </div>

  `;

}


/* =========================================================
   NAV EVENTS
   ========================================================= */

document
  .querySelectorAll(".nav")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        renderPage(
          button.dataset.page
        );

      }
    );

  });


/* =========================================================
   START
   ========================================================= */

load();
