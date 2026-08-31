const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const sigmoid = x => 1 / (1 + Math.exp(-x));

function poisson(k, l) {
  let f = 1;
  for (let i = 2; i <= k; i++) f *= i;
  return Math.exp(-l) * Math.pow(l, k) / f;
}

/* =========================================================
   DEMO FIXTURES
   ========================================================= */

const demoFixtures = [
  {
    id: "demo-1",
    league: "Premier League",
    country: "England",
    leagueId: 39,
    kickoff: "19:30",
    home: "Arsenal",
    away: "Chelsea",
    homeRating: 88,
    awayRating: 82,
    homeForm: 0.78,
    awayForm: 0.61,
    homeXg: 2.02,
    awayXg: 1.34
  },
  {
    id: "demo-2",
    league: "Premier League",
    country: "England",
    leagueId: 39,
    kickoff: "20:00",
    home: "Manchester City",
    away: "Aston Villa",
    homeRating: 91,
    awayRating: 79,
    homeForm: 0.82,
    awayForm: 0.58,
    homeXg: 2.31,
    awayXg: 1.22
  },
  {
    id: "demo-3",
    league: "La Liga",
    country: "Spain",
    leagueId: 140,
    kickoff: "20:00",
    home: "Barcelona",
    away: "Sevilla",
    homeRating: 90,
    awayRating: 78,
    homeForm: 0.81,
    awayForm: 0.55,
    homeXg: 2.26,
    awayXg: 1.08
  },
  {
    id: "demo-4",
    league: "Bundesliga",
    country: "Germany",
    leagueId: 78,
    kickoff: "17:30",
    home: "Bayern Munich",
    away: "Mainz",
    homeRating: 92,
    awayRating: 73,
    homeForm: 0.86,
    awayForm: 0.48,
    homeXg: 2.58,
    awayXg: 0.94
  },
  {
    id: "demo-5",
    league: "Serie A",
    country: "Italy",
    leagueId: 135,
    kickoff: "18:00",
    home: "Inter Milan",
    away: "Torino",
    homeRating: 89,
    awayRating: 76,
    homeForm: 0.79,
    awayForm: 0.57,
    homeXg: 1.94,
    awayXg: 0.92
  },
  {
    id: "demo-6",
    league: "Ligue 1",
    country: "France",
    leagueId: 61,
    kickoff: "20:00",
    home: "PSG",
    away: "Lyon",
    homeRating: 89,
    awayRating: 77,
    homeForm: 0.84,
    awayForm: 0.63,
    homeXg: 2.34,
    awayXg: 1.19
  }
];

/* =========================================================
   PREDICTION ENGINE
   ========================================================= */

function predict(f) {
  const ratingEdge =
    (f.homeRating - f.awayRating) / 20;

  const formEdge =
    f.homeForm - f.awayForm;

  const attackEdge =
    f.homeXg - f.awayXg;

  const raw =
    0.95 * ratingEdge +
    0.65 * formEdge +
    0.55 * attackEdge +
    0.18;

  const h0 = sigmoid(raw);

  const draw0 = clamp(
    0.25 - 0.035 * Math.abs(raw),
    0.14,
    0.29
  );

  const a0 = clamp(
    1 - h0 - draw0,
    0.05,
    0.72
  );

  const total =
    h0 + draw0 + a0;

  const probabilities = {
    home: h0 / total,
    draw: draw0 / total,
    away: a0 / total
  };

  const expectedHomeGoals =
    Math.max(
      0.2,
      f.homeXg *
        (1 +
          0.08 * ratingEdge +
          0.05 * formEdge)
    );

  const expectedAwayGoals =
    Math.max(
      0.2,
      f.awayXg *
        (1 -
          0.06 * ratingEdge -
          0.03 * formEdge)
    );

  let scores = [];

  let over15 = 0;
  let over25 = 0;
  let over35 = 0;
  let btts = 0;

  for (let h = 0; h <= 8; h++) {
    for (let a = 0; a <= 8; a++) {
      const p =
        poisson(h, expectedHomeGoals) *
        poisson(a, expectedAwayGoals);

      scores.push({
        h,
        a,
        p
      });

      if (h + a >= 2) {
        over15 += p;
      }

      if (h + a >= 3) {
        over25 += p;
      }

      if (h + a >= 4) {
        over35 += p;
      }

      if (h > 0 && a > 0) {
        btts += p;
      }
    }
  }

  scores.sort(
    (x, y) => y.p - x.p
  );

  const markets = {
    over05:
      1 -
      poisson(0, expectedHomeGoals) *
      poisson(0, expectedAwayGoals),

    under05:
      poisson(0, expectedHomeGoals) *
      poisson(0, expectedAwayGoals),

    over15,
    under15: 1 - over15,

    over25,
    under25: 1 - over25,

    over35,
    under35: 1 - over35,

    btts,
    bttsNo: 1 - btts
  };

  const verdict = [
    ["Home Win", probabilities.home],
    ["Draw", probabilities.draw],
    ["Away Win", probabilities.away]
  ].sort(
    (a, b) => b[1] - a[1]
  )[0];

  const confidence = Math.round(
    clamp(
      52 +
        Math.abs(verdict[1] - 0.5) * 72 +
        Math.abs(
          probabilities.home -
          probabilities.away
        ) * 28,
      0,
      97
    )
  );

  const modelAgreement =
    Math.round(
      clamp(
        68 +
          confidence * 0.25,
        0,
        95
      )
    );

  const factors = [
    {
      label: "Team strength",
      value: clamp(
        50 +
          (f.homeRating -
            f.awayRating) *
            2,
        0,
        100
      ),
      note:
        "Relative team rating advantage in the current model."
    },
    {
      label: "Recent form",
      value: clamp(
        50 +
          (f.homeForm -
            f.awayForm) *
            100,
        0,
        100
      ),
      note:
        "Recent performance signal, normalized for comparison."
    },
    {
      label: "Expected goals",
      value: clamp(
        50 +
          (f.homeXg -
            f.awayXg) *
            28,
        0,
        100
      ),
      note:
        "Pre-match attacking expectation differential."
    },
    {
      label: "Home advantage",
      value: 68,
      note:
        "Venue effect currently applied as a modest prior."
    }
  ];

  const bestMarkets = [
    [
      "Home Win",
      probabilities.home
    ],
    [
      "Away Win",
      probabilities.away
    ],
    [
      "Draw",
      probabilities.draw
    ],
    [
      "Over 2.5",
      over25
    ],
    [
      "BTTS Yes",
      btts
    ]
  ]
    .sort(
      (a, b) => b[1] - a[1]
    )
    .slice(0, 3);

  return {
    ...f,

    verdict: verdict[0],

    probabilities,

    expectedGoals: {
      home: expectedHomeGoals,
      away: expectedAwayGoals,
      total:
        expectedHomeGoals +
        expectedAwayGoals
    },

    markets,

    topScores:
      scores.slice(0, 6),

    confidence,

    modelAgreement,

    dataQuality: 72,

    bestMarkets,

    factors,

    generatedAt:
      new Date().toISOString(),

    modelVersion:
      "FI-INTELLIGENCE-3.0"
  };
}

/* =========================================================
   RESPONSE HELPERS
   ========================================================= */

function json(
  data,
  status = 200
) {
  return Response.json(
    data,
    {
      status,
      headers: {
        "cache-control":
          "no-store"
      }
    }
  );
}

function todayISO(
  offset = 0
) {
  const d = new Date(
    Date.now() +
      offset *
        86400000
  );

  return d
    .toISOString()
    .slice(0, 10);
}

function apiHeaders(env) {
  return {
    "x-apisports-key":
      env.API_FOOTBALL_KEY,

    Accept:
      "application/json"
  };
}

/* =========================================================
   API-FOOTBALL
   ========================================================= */

async function fetchProvider(
  url,
  env
) {
  const r =
    await fetch(url, {
      headers:
        apiHeaders(env)
    });

  if (!r.ok) {
    throw new Error(
      `API-Football HTTP ${r.status}`
    );
  }

  const d =
    await r.json();

  if (
    d.errors &&
    Object.keys(
      d.errors
    ).length
  ) {
    throw new Error(
      JSON.stringify(
        d.errors
      )
    );
  }

  return d;
}

/* =========================================================
   FIXTURE NORMALIZATION
   ========================================================= */

function normalizeFixture(x) {
  return {
    id: String(
      x.fixture?.id
    ),

    leagueId:
      x.league?.id ??
      null,

    league:
      x.league?.name ??
      "Unknown",

    country:
      x.league?.country ??
      "",

    kickoffUtc:
      x.fixture?.date,

    status:
      x.fixture?.status
        ?.short ?? "NS",

    homeId:
      x.teams?.home?.id ??
      null,

    home:
      x.teams?.home?.name ??
      "Home",

    awayId:
      x.teams?.away?.id ??
      null,

    away:
      x.teams?.away?.name ??
      "Away",

    homeGoals:
      x.goals?.home ??
      null,

    awayGoals:
      x.goals?.away ??
      null,

    logoHome:
      x.teams?.home?.logo ??
      null,

    logoAway:
      x.teams?.away?.logo ??
      null
  };
}

/* =========================================================
   LIVE BASELINE PREDICTION
   ========================================================= */

function liveBaselinePrediction(f) {
  const kickoff =
    new Date(
      f.kickoffUtc
    );

  const base = {
    id: f.id,

    league:
      f.league,

    country:
      f.country,

    leagueId:
      f.leagueId,

    kickoff:
      kickoff.toLocaleTimeString(
        "en-GB",
        {
          hour: "2-digit",
          minute: "2-digit",
          timeZone:
            "Africa/Lagos"
        }
      ),

    home:
      f.home,

    away:
      f.away,

    homeRating: 75,
    awayRating: 75,

    homeForm: 0.5,
    awayForm: 0.5,

    homeXg: 1.45,
    awayXg: 1.15
  };

  const p =
    predict(base);

  return {
    ...p,

    providerFixtureId:
      f.id,

    providerStatus:
      f.status,

    providerKickoffUtc:
      f.kickoffUtc,

    logos: {
      home:
        f.logoHome,
      away:
        f.logoAway
    },

    dataQuality: 40,

    warning:
      "Live fixture feed connected; historical team features are still being accumulated."
  };
}

/* =========================================================
   DATABASE
   ========================================================= */

async function upsertFixtures(
  db,
  items
) {
  if (!db) return;

  const now =
    new Date()
      .toISOString();

  const stmts =
    items.map(f =>
      db
        .prepare(`
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
          VALUES(
            ?,?,?,?,?,?,?,?,?,?,?,?,?,?
          )

          ON CONFLICT(id)
          DO UPDATE SET
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
        `)
        .bind(
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

  for (
    let i = 0;
    i < stmts.length;
    i += 20
  ) {
    await db.batch(
      stmts.slice(
        i,
        i + 20
      )
    );
  }
}

/* =========================================================
   SYNCHRONIZATION
   ========================================================= */

async function sync(env) {
  if (
    !env.API_FOOTBALL_KEY
  ) {
    return {
      mode: "demo",
      reason:
        "API_FOOTBALL_KEY missing",
      fixtures: []
    };
  }

  const [a, b] =
    await Promise.all([
      fetchProvider(
        `https://v3.football.api-sports.io/fixtures?date=${todayISO()}`,
        env
      ),

      fetchProvider(
        `https://v3.football.api-sports.io/fixtures?date=${todayISO(
          1
        )}`,
        env
      )
    ]);

  const items = [
    ...(a.response || []),
    ...(b.response || [])
  ].map(
    normalizeFixture
  );

  const unique = [
    ...new Map(
      items.map(x => [
        x.id,
        x
      ])
    ).values()
  ];

  await upsertFixtures(
    env.DB,
    unique
  );

  if (env.DB) {
    await env.DB
      .prepare(`
        INSERT INTO sync_runs(
          run_at,
          provider,
          fixtures_seen,
          fixtures_written
        )
        VALUES(?,?,?,?)
      `)
      .bind(
        new Date().toISOString(),
        "api-football",
        unique.length,
        unique.length
      )
      .run();
  }

  return {
    mode: "live",
    fixtures: unique
  };
}

/* =========================================================
   DATE RANGE
   ========================================================= */

function dateRange(date) {
  const start =
    new Date(
      `${date}T00:00:00.000Z`
    );

  const end =
    new Date(
      start.getTime() +
        86400000
    );

  return {
    start:
      start.toISOString(),
    end:
      end.toISOString()
  };
}

/* =========================================================
   READ FIXTURES
   ========================================================= */

async function readFixtures(
  env,
  filters = {}
) {
  if (env.DB) {
    const date =
      filters.date ||
      todayISO();

    const range =
      dateRange(date);

    const conditions = [
      `kickoff_utc>=?`,
      `kickoff_utc<?`
    ];

    const params = [
      range.start,
      range.end
    ];

    if (filters.country) {
      conditions.push(
        `LOWER(country)=LOWER(?)`
      );

      params.push(
        filters.country
      );
    }

    if (filters.leagueId) {
      conditions.push(
        `league_id=?`
      );

      params.push(
        Number(
          filters.leagueId
        )
      );
    }

    if (filters.league) {
      conditions.push(
        `LOWER(league_name)=LOWER(?)`
      );

      params.push(
        filters.league
      );
    }

    const r =
      await env.DB
        .prepare(`
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
          WHERE ${conditions.join(
            " AND "
          )}
          ORDER BY kickoff_utc
        `)
        .bind(
          ...params
        )
        .all();

    return (
      r.results || []
    ).map(x => ({
      ...x,
      logos: {}
    }));
  }

  let demo =
    demoFixtures;

  if (
    filters.country
  ) {
    demo =
      demo.filter(
        x =>
          x.country.toLowerCase() ===
          filters.country.toLowerCase()
      );
  }

  if (
    filters.leagueId
  ) {
    demo =
      demo.filter(
        x =>
          String(
            x.leagueId
          ) ===
          String(
            filters.leagueId
          )
      );
  }

  if (
    filters.league
  ) {
    demo =
      demo.filter(
        x =>
          x.league.toLowerCase() ===
          filters.league.toLowerCase()
      );
  }

  return demo;
}

/* =========================================================
   COUNTRIES
   ========================================================= */

async function readCountries(
  env
) {
  if (!env.DB) {
    return [
      ...new Set(
        demoFixtures.map(
          f => f.country
        )
      )
    ].sort();
  }

  const r =
    await env.DB
      .prepare(`
        SELECT DISTINCT country
        FROM fixtures
        WHERE country IS NOT NULL
          AND country!=''
        ORDER BY country
      `)
      .all();

  return (
    r.results || []
  ).map(
    x => x.country
  );
}

/* =========================================================
   LEAGUES BY COUNTRY
   ========================================================= */

async function readLeagues(
  env,
  country
) {
  if (!env.DB) {
    return [
      ...new Map(
        demoFixtures
          .filter(
            f =>
              !country ||
              f.country.toLowerCase() ===
                country.toLowerCase()
          )
          .map(f => [
            f.leagueId,
            {
              leagueId:
                f.leagueId,
              league:
                f.league,
              country:
                f.country,
              fixtureCount: 1
            }
          ])
      ).values()
    ];
  }

  if (country) {
    const r =
      await env.DB
        .prepare(`
          SELECT
            league_id leagueId,
            league_name league,
            country,
            COUNT(*) fixtureCount
          FROM fixtures
          WHERE LOWER(country)=LOWER(?)
            AND league_name IS NOT NULL
            AND league_name!=''
          GROUP BY
            league_id,
            league_name,
            country
          ORDER BY league_name
        `)
        .bind(country)
        .all();

    return (
      r.results || []
    );
  }

  const r =
    await env.DB
      .prepare(`
        SELECT
          league_id leagueId,
          league_name league,
          country,
          COUNT(*) fixtureCount
        FROM fixtures
        WHERE league_name IS NOT NULL
          AND league_name!=''
        GROUP BY
          league_id,
          league_name,
          country
        ORDER BY
          country,
          league_name
      `)
      .all();

  return (
    r.results || []
  );
}

/* =========================================================
   MAIN WORKER
   ========================================================= */

export default {
  async fetch(
    request,
    env
  ) {
    const url =
      new URL(
        request.url
      );

    try {
      /* -------------------------
         HEALTH
         ------------------------- */

      if (
        url.pathname ===
        "/api/health"
      ) {
        return json({
          ok: true,

          service:
            "football-intelligence",

          version:
            "3.0.0",

          mode:
            env.API_FOOTBALL_KEY
              ? "live-ready"
              : "demo"
        });
      }

      /* -------------------------
         SYNC
         ------------------------- */

      if (
        url.pathname ===
        "/api/sync"
      ) {
        if (
          request.method !==
          "POST"
        ) {
          return json(
            {
              error:
                "Use POST"
            },
            405
          );
        }

        const expected =
          env.SYNC_SECRET;

        if (
          !expected ||
          request.headers.get(
            "x-sync-secret"
          ) !== expected
        ) {
          return json(
            {
              error:
                "Unauthorized"
            },
            401
          );
        }

        const result =
          await sync(env);

        return json({
          ok: true,
          ...result
        });
      }

      /* -------------------------
         COUNTRIES
         ------------------------- */

      if (
        url.pathname ===
        "/api/countries"
      ) {
        const countries =
          await readCountries(
            env
          );

        return json({
          mode:
            env.API_FOOTBALL_KEY
              ? "live"
              : "demo",

          countries,

          count:
            countries.length
        });
      }

      /* -------------------------
         LEAGUES
         ------------------------- */

      if (
        url.pathname ===
        "/api/leagues"
      ) {
        const country =
          url.searchParams.get(
            "country"
          ) || "";

        const leagues =
          await readLeagues(
            env,
            country
          );

        return json({
          mode:
            env.API_FOOTBALL_KEY
              ? "live"
              : "demo",

          country:
            country || null,

          leagues,

          count:
            leagues.length
        });
      }

      /* -------------------------
         FIXTURES
         ------------------------- */

      if (
        url.pathname ===
        "/api/fixtures"
      ) {
        const filters = {
          date:
            url.searchParams.get(
              "date"
            ) || todayISO(),

          country:
            url.searchParams.get(
              "country"
            ) || "",

          leagueId:
            url.searchParams.get(
              "leagueId"
            ) || "",

          league:
            url.searchParams.get(
              "league"
            ) || ""
        };

        const rows =
          await readFixtures(
            env,
            filters
          );

        if (
          rows.length
        ) {
          return json({
            mode: "live",

            generatedAt:
              new Date().toISOString(),

            filters,

            count:
              rows.length,

            fixtures:
              rows.map(
                liveBaselinePrediction
              )
          });
        }

        return json({
          mode: "demo",

          generatedAt:
            new Date().toISOString(),

          filters,

          count:
            demoFixtures.length,

          fixtures:
            demoFixtures
              .filter(
                f =>
                  !filters.country ||
                  f.country.toLowerCase() ===
                    filters.country.toLowerCase()
              )
              .filter(
                f =>
                  !filters.leagueId ||
                  String(
                    f.leagueId
                  ) ===
                    String(
                      filters.leagueId
                    )
              )
              .filter(
                f =>
                  !filters.league ||
                  f.league.toLowerCase() ===
                    filters.league.toLowerCase()
              )
              .map(predict)
        });
      }

      /* -------------------------
         SINGLE MATCH
         ------------------------- */

      if (
        url.pathname.startsWith(
          "/api/match/"
        )
      ) {
        const id =
          url.pathname
            .split("/")
            .pop();

        const rows =
          await readFixtures(
            env,
            {
              date:
                todayISO()
            }
          );

        const f =
          rows.find(
            x =>
              String(x.id) ===
              String(id)
          );

        if (f) {
          return json({
            mode: "live",

            match:
              liveBaselinePrediction(
                f
              )
          });
        }

        const demo =
          demoFixtures.find(
            x =>
              x.id === id
          );

        return demo
          ? json({
              mode: "demo",

              match:
                predict(
                  demo
                )
            })
          : json(
              {
                error:
                  "Match not found"
              },
              404
            );
      }

      /* -------------------------
         STATIC FRONTEND
         ------------------------- */

      if (env.ASSETS) {
        return env.ASSETS.fetch(
          request
        );
      }

      return new Response(
        "Football Intelligence Engine",
        {
          headers: {
            "content-type":
              "text/plain"
          }
        }
      );
    } catch (e) {
      return json(
        {
          error:
            "Engine error",

          message:
            e?.message ||
            String(e)
        },
        500
      );
    }
  },

  /* =======================================================
     SCHEDULED SYNCHRONIZATION
     ======================================================= */

  async scheduled(
    controller,
    env,
    ctx
  ) {
    ctx.waitUntil(
      (async () => {
        try {
          await sync(env);
        } catch (e) {
          if (env.DB) {
            await env.DB
              .prepare(`
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
                e?.message ||
                  String(e)
              )
              .run();
          }
        }
      })()
    );
  }
};
