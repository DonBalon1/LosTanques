const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQawlREOP-I6-QFRHvQ21YrPRFOEkPiQ9znqvQfppgCsWPS1ytH0135bvyHZQbQYwO_04rYmsKIk3qb/pub?gid=0&single=true&output=csv";

const state = {
  rawRows: [],
  activePage: "tables",
  filters: {
    year: "",
    tournament: "",
  },
  activeTab: "individual",
  sort: {
    individual: {
      key: "tournamentsWon",
      direction: "desc",
      tieBreakers: [
        { key: "points", direction: "desc" },
        { key: "lifeDiff", direction: "desc" },
        { key: "name", direction: "asc" },
      ],
    },
    teams: {
      key: "tournamentsWon",
      direction: "desc",
      tieBreakers: [
        { key: "points", direction: "desc" },
        { key: "lifeDiff", direction: "desc" },
        { key: "name", direction: "asc" },
      ],
    },
  },
};

const el = {
  status: document.getElementById("status"),
  content: document.getElementById("content"),
  pageTabs: Array.from(document.querySelectorAll(".page-tab")),
  pageViews: {
    tables: document.getElementById("page-view-tables"),
    "streaks-records": document.getElementById("page-view-streaks-records"),
    players: document.getElementById("page-view-players"),
  },
  tabs: Array.from(document.querySelectorAll(".stats-tab")),
  tabViews: {
    individual: document.getElementById("view-individual"),
    teams: document.getElementById("view-teams"),
  },
  filterYear: document.getElementById("filter-year"),
  filterTournament: document.getElementById("filter-tournament"),
  clearFilters: document.getElementById("clear-filters"),
  individualTable: document.getElementById("individual-table"),
  teamsTable: document.getElementById("teams-table"),
  streaksList: document.getElementById("streaks-list"),
  recordsList: document.getElementById("records-list"),
  teamRecordsList: document.getElementById("team-records-list"),
  playersList: document.getElementById("players-list"),
};

const individualColumns = [
  { key: "position", label: "#", type: "rank" },
  { key: "name", label: "Jugador", type: "string" },
  { key: "tournamentsPlayed", label: "Torneos jugados", type: "number" },
  { key: "tournamentsWon", label: "Torneos ganados", type: "number" },
  { key: "points", label: "Puntos", type: "number" },
  { key: "gamesPlayed", label: "Partidos jugados", type: "number" },
  { key: "ved", label: "V-E-D", type: "record" },
  { key: "livesFC", label: "Vidas (F-C)", type: "record" },
  { key: "lifeDiff", label: "Diferencia de vidas", type: "number" },
  { key: "ratio", label: "Ratio", type: "decimal" },
  { key: "winPct", label: "% victorias", type: "percent" },
];

const teamColumns = [
  { key: "position", label: "#", type: "rank" },
  { key: "name", label: "Equipo", type: "string" },
  { key: "tournamentsPlayed", label: "Torneos jugados", type: "number" },
  { key: "tournamentsWon", label: "Torneos ganados", type: "number" },
  { key: "points", label: "Puntos", type: "number" },
  { key: "gamesPlayed", label: "Partidos jugados", type: "number" },
  { key: "ved", label: "V-E-D", type: "record" },
  { key: "livesFC", label: "Vidas (F-C)", type: "record" },
  { key: "lifeDiff", label: "Diferencia de vidas", type: "number" },
  { key: "ratio", label: "Ratio", type: "decimal" },
  { key: "winPct", label: "% victorias", type: "percent" },
  { key: "avgLifeDiff", label: "Promedio dif. vidas", type: "decimal" },
];

init();

async function init() {
  bindEvents();
  await loadData();
}

function bindEvents() {
  el.pageTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      setActivePage(tab.dataset.page);
    });
  });

  el.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      setActiveTab(tab.dataset.tab);
    });
  });

  el.filterYear.addEventListener("change", () => {
    state.filters.year = el.filterYear.value;
    syncTournamentOptions();
    refreshUI();
  });

  el.filterTournament.addEventListener("change", () => {
    state.filters.tournament = el.filterTournament.value;
    refreshUI();
  });

  el.clearFilters.addEventListener("click", () => {
    state.filters.year = "";
    state.filters.tournament = "";
    el.filterYear.value = "";
    syncTournamentOptions();
    el.filterTournament.value = "";
    refreshUI();
  });
}

async function loadData() {
  setStatus("Cargando datos...", false);

  try {
    const response = await fetch(CSV_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const csvText = await response.text();
    const parsedRows = parseCSV(csvText);
    const cleanedRows = normalizeRows(parsedRows);

    state.rawRows = cleanedRows;

    if (!state.rawRows.length) {
      throw new Error("No hay filas validas luego del procesamiento");
    }

    renderYearOptions();
  renderTournamentOptions();
    refreshUI();
    hideStatus();
  } catch (error) {
    console.error(error);
    setStatus("No se pudieron cargar los datos. Verifica la conexion o la publicacion del CSV.", true);
    el.content.classList.add("is-hidden");
  }
}

function setStatus(message, isError) {
  el.status.textContent = message;
  el.status.classList.remove("is-hidden");
  el.status.classList.toggle("is-error", Boolean(isError));
}

function hideStatus() {
  el.status.classList.add("is-hidden");
}

function parseCSV(text) {
  const input = String(text || "").replace(/^\uFEFF/, "").replace(/\r/g, "").trim();
  if (!input) {
    return [];
  }

  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const nextChar = input[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if (char === "\n" && !inQuotes) {
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  row.push(current);
  rows.push(row);

  if (rows.length <= 1) {
    return [];
  }

  const headers = rows[0].map((value) => cleanCell(value));
  const records = [];

  for (let i = 1; i < rows.length; i += 1) {
    const cells = rows[i];
    if (!cells || cells.every((cell) => !cleanCell(cell))) {
      continue;
    }

    const record = {};
    for (let j = 0; j < headers.length; j += 1) {
      record[headers[j] || `col_${j}`] = cleanCell(cells[j] ?? "");
    }
    records.push(record);
  }

  return records;
}

function normalizeRows(records) {
  const dateHeader = findHeader(records, ["fecha"]);
  const tournamentHeader = findHeader(records, ["torneo"]);
  const teamHeader = findHeader(records, ["equipo"]);
  const pointsHeader = findHeader(records, ["puntos"]);
  const winsHeader = findHeader(records, ["v"]);
  const lossesHeader = findHeader(records, ["d"]);
  const drawsHeader = findHeader(records, ["e"]);
  const livesForHeader = findHeader(records, ["vidas a favor", "vidas favor"]);
  const livesAgainstHeader = findHeader(records, ["vidas en contra", "vidas contra"]);

  return records
    .map((record) => {
      const rawDate = getCell(record, dateHeader);
      const parsedDate = parseDateFlexible(rawDate);

      const rawTeam = getCell(record, teamHeader);
      const players = getPlayersFromTeam(rawTeam);
      if (players.length < 1) {
        return null;
      }

      return {
        rawDate,
        dateObj: parsedDate,
        dateValue: parsedDate ? Number(parsedDate) : null,
        year: parsedDate ? String(parsedDate.getUTCFullYear()) : "",
        tournament: getCell(record, tournamentHeader),
        teamRaw: rawTeam,
        players,
        format: players.length >= 2 ? "teams" : "individual",
        teamNormalized: normalizeTeam(players),
        points: parseNumber(getCell(record, pointsHeader)),
        wins: parseNumber(getCell(record, winsHeader)),
        losses: parseNumber(getCell(record, lossesHeader)),
        draws: parseNumber(getCell(record, drawsHeader)),
        livesFor: parseNumber(getCell(record, livesForHeader)),
        livesAgainst: parseNumber(getCell(record, livesAgainstHeader)),
      };
    })
    .filter((row) => {
      return (
        row &&
        row.tournament !== "" &&
        row.teamNormalized !== "" &&
        Number.isFinite(row.points) &&
        Number.isFinite(row.wins) &&
        Number.isFinite(row.losses) &&
        Number.isFinite(row.draws) &&
        Number.isFinite(row.livesFor) &&
        Number.isFinite(row.livesAgainst)
      );
    });
}

function findHeader(records, aliases) {
  if (!records.length) {
    return "";
  }

  const keys = Object.keys(records[0]);
  const normalizedAliases = aliases.map((alias) => normalizeHeader(alias));

  const exactMatch = keys.find((key) => normalizedAliases.includes(normalizeHeader(key)));
  if (exactMatch) {
    return exactMatch;
  }

  const partialMatch = keys.find((key) => {
    const normalizedKey = normalizeHeader(key);
    return normalizedAliases.some((alias) => normalizedKey.includes(alias));
  });

  return partialMatch || "";
}

function normalizeHeader(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getCell(record, key) {
  if (!key) {
    return "";
  }
  return cleanCell(record[key]);
}

function cleanCell(value) {
  return String(value ?? "")
    .replace(/\uFEFF/g, "")
    .trim();
}

function parseNumber(value) {
  const normalized = cleanCell(value).replace(/\./g, "").replace(",", ".");
  if (!normalized) {
    return 0;
  }

  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : 0;
}

function parseDateFlexible(value) {
  const raw = cleanCell(value);
  if (!raw) {
    return null;
  }

  const isoCandidate = new Date(raw);
  if (!Number.isNaN(isoCandidate.getTime()) && /^\d{4}-\d{1,2}-\d{1,2}/.test(raw)) {
    return buildUTCDate(
      isoCandidate.getUTCFullYear(),
      isoCandidate.getUTCMonth() + 1,
      isoCandidate.getUTCDate()
    );
  }

  const parts = raw.split(/[\/\.\-]/).map((part) => part.trim()).filter(Boolean);
  if (parts.length === 3) {
    let day;
    let month;
    let year;

    if (parts[0].length === 4) {
      year = Number(parts[0]);
      month = Number(parts[1]);
      day = Number(parts[2]);
    } else {
      const first = Number(parts[0]);
      const second = Number(parts[1]);
      const third = Number(parts[2]);

      if (first > 12 && second <= 12) {
        day = first;
        month = second;
      } else if (second > 12 && first <= 12) {
        day = second;
        month = first;
      } else {
        day = first;
        month = second;
      }

      year = third;
    }

    if (year < 100) {
      year += year >= 70 ? 1900 : 2000;
    }

    return buildUTCDate(year, month, day);
  }

  if (!Number.isNaN(isoCandidate.getTime())) {
    return buildUTCDate(
      isoCandidate.getFullYear(),
      isoCandidate.getMonth() + 1,
      isoCandidate.getDate()
    );
  }

  return null;
}

function buildUTCDate(year, month, day) {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function getPlayersFromTeam(teamText) {
  const cleaned = cleanCell(teamText).replace(/^"|"$/g, "").trim();
  if (!cleaned) {
    return [];
  }

  const separatorPatterns = [
    /\s*,\s*/,
    /\s*\+\s*/,
    /\s*&\s*/,
    /\s+and\s+/i,
    /\s+y\s+/i,
    /\s*\/\s*/,
    /\s*\|\s*/,
    /\s+-\s+/,
  ];

  for (const pattern of separatorPatterns) {
    const parts = cleaned
      .split(pattern)
      .map((name) => name.trim())
      .filter(Boolean);

    if (parts.length >= 2) {
      const unique = Array.from(new Set(parts));
      return unique.slice(0, 2);
    }
  }

  return [cleaned];
}

function normalizeTeam(players) {
  return players
    .map((name) => normalizeName(name))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }))
    .join(" + ");
}

function normalizeName(name) {
  return cleanCell(name).replace(/\s+/g, " ");
}

function renderYearOptions() {
  const allYears = Array.from(new Set(state.rawRows.map((row) => row.year)))
    .filter(Boolean)
    .sort((a, b) => compareMixed(a, b));

  el.filterYear.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "Todos";
  el.filterYear.appendChild(allOption);

  allYears.forEach((year) => {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    el.filterYear.appendChild(option);
  });

  syncTournamentOptions();
}

function renderTournamentOptions() {
  syncTournamentOptions();
}

function syncTournamentOptions() {
  const rowsByYear = state.rawRows.filter(
    (row) => !state.filters.year || row.year === state.filters.year
  );

  const tournamentsInfo = new Map();

  rowsByYear.forEach((row) => {
    if (!row.tournament) {
      return;
    }

    const existing = tournamentsInfo.get(row.tournament);
    if (!existing || (!existing.dateValue && row.dateValue)) {
      tournamentsInfo.set(row.tournament, {
        dateValue: row.dateValue,
        dateLabel: row.dateObj ? formatDate(row.dateObj) : cleanCell(row.rawDate),
      });
    }
  });

  const tournaments = Array.from(tournamentsInfo.keys()).sort((a, b) => compareMixed(a, b));

  const current = state.filters.tournament;
  el.filterTournament.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "Todos";
  el.filterTournament.appendChild(allOption);

  tournaments.forEach((tournament) => {
    const info = tournamentsInfo.get(tournament);
    const dateSuffix = info?.dateLabel ? ` - ${info.dateLabel}` : "";
    const option = document.createElement("option");
    option.value = tournament;
    option.textContent = `Torneo ${tournament}${dateSuffix}`;
    el.filterTournament.appendChild(option);
  });

  if (current && tournaments.includes(current)) {
    el.filterTournament.value = current;
    state.filters.tournament = current;
  } else {
    el.filterTournament.value = "";
    state.filters.tournament = "";
  }
}

function formatDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function applyFilters(rows) {
  return rows.filter((row) => {
    if (state.filters.year && row.year !== state.filters.year) {
      return false;
    }

    if (state.filters.tournament && row.tournament !== state.filters.tournament) {
      return false;
    }

    return true;
  });
}

function calculateTournamentWinners(rows) {
  const byTournament = new Map();

  rows.forEach((row) => {
    if (!byTournament.has(row.tournament)) {
      byTournament.set(row.tournament, []);
    }
    byTournament.get(row.tournament).push(row);
  });

  const winnerTeams = new Set();

  byTournament.forEach((tournamentRows) => {
    const maxPoints = Math.max(...tournamentRows.map((entry) => entry.points));
    const pointLeaders = tournamentRows.filter((entry) => entry.points === maxPoints);

    // Si hay empate en puntos, desempata por mayor diferencia de vidas.
    const maxLifeDiff = Math.max(
      ...pointLeaders.map((entry) => entry.livesFor - entry.livesAgainst)
    );

    pointLeaders
      .filter((entry) => entry.livesFor - entry.livesAgainst === maxLifeDiff)
      .forEach((entry) => winnerTeams.add(`${entry.tournament}:::${entry.teamNormalized}`));
  });

  return winnerTeams;
}

function calculateIndividualStats(rows, winnerTeams) {
  const map = new Map();

  rows.forEach((row) => {
    row.players.forEach((player) => {
      const name = normalizeName(player);
      if (!map.has(name)) {
        map.set(name, baseStat(name));
      }

      const stat = map.get(name);
      stat.tournamentsPlayed += 1;
      stat.points += row.points;
      stat.wins += row.wins;
      stat.losses += row.losses;
      stat.draws += row.draws;
      stat.livesFor += row.livesFor;
      stat.livesAgainst += row.livesAgainst;

      if (winnerTeams.has(`${row.tournament}:::${row.teamNormalized}`)) {
        stat.tournamentsWon += 1;
      }
    });
  });

  return Array.from(map.values()).map(enrichStat);
}

function calculateTeamStats(rows, winnerTeams) {
  const map = new Map();

  rows.forEach((row) => {
    if (row.format !== "teams") {
      return;
    }

    const teamName = row.teamNormalized;

    if (!map.has(teamName)) {
      map.set(teamName, baseStat(teamName));
    }

    const stat = map.get(teamName);
    stat.tournamentsPlayed += 1;
    stat.points += row.points;
    stat.wins += row.wins;
    stat.losses += row.losses;
    stat.draws += row.draws;
    stat.livesFor += row.livesFor;
    stat.livesAgainst += row.livesAgainst;

    if (winnerTeams.has(`${row.tournament}:::${row.teamNormalized}`)) {
      stat.tournamentsWon += 1;
    }
  });

  return Array.from(map.values()).map(enrichStat);
}

function baseStat(name) {
  return {
    name,
    tournamentsPlayed: 0,
    tournamentsWon: 0,
    points: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    livesFor: 0,
    livesAgainst: 0,
  };
}

function enrichStat(stat) {
  const games = stat.wins + stat.draws + stat.losses;
  const lifeDiff = stat.livesFor - stat.livesAgainst;
  const ratio = calculateLifeRatio(stat.livesFor, stat.livesAgainst);
  const ved = `${stat.wins} - ${stat.draws} - ${stat.losses}`;
  const livesFC = `${stat.livesFor} - ${stat.livesAgainst}`;

  return {
    ...stat,
    gamesPlayed: games,
    ved,
    livesFC,
    lifeDiff,
    ratio,
    winPct: games ? (stat.wins / games) * 100 : 0,
    drawPct: games ? (stat.draws / games) * 100 : 0,
    lossPct: games ? (stat.losses / games) * 100 : 0,
    notLosePct: games ? ((stat.wins + stat.draws) / games) * 100 : 0,
    avgPoints: stat.tournamentsPlayed ? stat.points / stat.tournamentsPlayed : 0,
    avgLifeDiff: stat.tournamentsPlayed ? lifeDiff / stat.tournamentsPlayed : 0,
  };
}

function calculateLifeRatio(livesFor, livesAgainst) {
  const favor = Number(livesFor) || 0;
  const contra = Number(livesAgainst) || 0;

  if (contra === 0) {
    return favor === 0 ? 1 : favor;
  }

  return favor / contra;
}

function renderStreaksAndRecords(rows) {
  const timeline = buildTournamentTimeline(rows);
  const players = getAllPlayers(rows);
  const championStreakRanking = rankStreaksByKind(timeline, players, "champion");
  const lastPlaceStreakRanking = rankStreaksByKind(timeline, players, "last");
  const playerRecords = buildPlayerRecords(rows);
  const teamRecords = buildTeamRecords(rows);

  const streakCards = [
    {
      title: "Torneos seguidos saliendo campeon",
      ranking: championStreakRanking,
      sentiment: "positive",
      formatValue: (entry) => `${entry.value} torneos`,
      formatDetail: (entry) => formatStreakDetail(entry),
    },
    {
      title: "Torneos seguidos saliendo ultimo",
      ranking: lastPlaceStreakRanking,
      sentiment: "negative",
      formatValue: (entry) => `${entry.value} torneos`,
      formatDetail: (entry) => formatStreakDetail(entry),
    },
  ];

  const recordCards = [
    {
      title: "Cantidad de torneos jugados totales",
      ranking: rankOwnersByValue(playerRecords, "tournamentsPlayed", "player"),
      sentiment: "positive",
      formatValue: (entry) => `${entry.value}`,
    },
    {
      title: "Cantidad de partidos ganados totales",
      ranking: rankOwnersByValue(playerRecords, "wins", "player"),
      sentiment: "positive",
      formatValue: (entry) => `${entry.value}`,
    },
    {
      title: "Cantidad de partidos empatados totales",
      ranking: rankOwnersByValue(playerRecords, "draws", "player"),
      sentiment: "neutral",
      formatValue: (entry) => `${entry.value}`,
    },
    {
      title: "Cantidad de partidos perdidos totales",
      ranking: rankOwnersByValue(playerRecords, "losses", "player"),
      sentiment: "negative",
      formatValue: (entry) => `${entry.value}`,
    },
    {
      title: "Cantidad de puntos totales",
      ranking: rankOwnersByValue(playerRecords, "points", "player"),
      sentiment: "positive",
      formatValue: (entry) => `${entry.value}`,
    },
    {
      title: "Cantidad de torneos completados sin derrotas",
      ranking: rankOwnersByValue(playerRecords, "withoutLosses", "player"),
      sentiment: "positive",
      formatValue: (entry) => `${entry.value}`,
    },
    {
      title: "Cantidad de torneos completados sin victorias",
      ranking: rankOwnersByValue(playerRecords, "withoutWins", "player"),
      sentiment: "negative",
      formatValue: (entry) => `${entry.value}`,
    },
  ];

  const teamRecordCards = [
    {
      title: "Equipo con mas torneos ganados",
      ranking: rankOwnersByValue(teamRecords, "tournamentsWon", "team"),
      sentiment: "positive",
      formatValue: (entry) => `${entry.value}`,
    },
    {
      title: "Equipo con mas partidos ganados",
      ranking: rankOwnersByValue(teamRecords, "wins", "team"),
      sentiment: "positive",
      formatValue: (entry) => `${entry.value}`,
    },
    {
      title: "Equipo con mas partidos perdidos",
      ranking: rankOwnersByValue(teamRecords, "losses", "team"),
      sentiment: "negative",
      formatValue: (entry) => `${entry.value}`,
    },
    {
      title: "Equipo con mas puntos totales",
      ranking: rankOwnersByValue(teamRecords, "points", "team"),
      sentiment: "positive",
      formatValue: (entry) => `${entry.value}`,
    },
  ];

  el.streaksList.innerHTML = renderTopCards(streakCards);
  el.recordsList.innerHTML = renderTopCards(recordCards);
  el.teamRecordsList.innerHTML = renderTopCards(teamRecordCards);
}

function buildTournamentTimeline(rows) {
  const tournaments = new Map();

  rows.forEach((row) => {
    const key = String(row.tournament || "").trim();
    if (!key) {
      return;
    }

    if (!tournaments.has(key)) {
      tournaments.set(key, {
        key,
        tournament: key,
        dateObj: row.dateObj || null,
        dateValue: row.dateValue || null,
        rows: [],
      });
    }

    const bucket = tournaments.get(key);
    bucket.rows.push(row);

    if (!bucket.dateValue && row.dateValue) {
      bucket.dateObj = row.dateObj || null;
      bucket.dateValue = row.dateValue;
    }
  });

  const sorted = Array.from(tournaments.values()).sort((a, b) => {
    const aDate = a.dateValue || 0;
    const bDate = b.dateValue || 0;
    if (aDate !== bDate) {
      return aDate - bDate;
    }
    return compareMixed(a.tournament, b.tournament);
  });

  return sorted.map((entry) => {
    const winnerTeams = resolveTournamentTeams(entry.rows, "winner");
    const lastTeams = resolveTournamentTeams(entry.rows, "last");

    return {
      ...entry,
      label: entry.dateObj ? formatDate(entry.dateObj) : entry.tournament,
      winnerPlayers: mapTeamsToPlayers(entry.rows, winnerTeams),
      lastPlayers: mapTeamsToPlayers(entry.rows, lastTeams),
    };
  });
}

function resolveTournamentTeams(rows, mode) {
  if (!rows.length) {
    return new Set();
  }

  const scored = rows.map((row) => ({
    team: row.teamNormalized,
    points: Number(row.points) || 0,
    lifeDiff: (Number(row.livesFor) || 0) - (Number(row.livesAgainst) || 0),
  }));

  if (mode === "winner") {
    const maxPoints = Math.max(...scored.map((item) => item.points));
    const pointLeaders = scored.filter((item) => item.points === maxPoints);
    const maxLifeDiff = Math.max(...pointLeaders.map((item) => item.lifeDiff));
    return new Set(pointLeaders.filter((item) => item.lifeDiff === maxLifeDiff).map((item) => item.team));
  }

  const minPoints = Math.min(...scored.map((item) => item.points));
  const pointBottom = scored.filter((item) => item.points === minPoints);
  const minLifeDiff = Math.min(...pointBottom.map((item) => item.lifeDiff));
  return new Set(pointBottom.filter((item) => item.lifeDiff === minLifeDiff).map((item) => item.team));
}

function mapTeamsToPlayers(rows, teamsSet) {
  const players = new Set();

  rows.forEach((row) => {
    if (!teamsSet.has(row.teamNormalized)) {
      return;
    }

    row.players.forEach((player) => {
      players.add(normalizeName(player));
    });
  });

  return players;
}

function getAllPlayers(rows) {
  const players = new Set();

  rows.forEach((row) => {
    row.players.forEach((player) => players.add(normalizeName(player)));
  });

  return Array.from(players).sort((a, b) => compareMixed(a, b));
}

function rankStreaksByKind(timeline, players, kind) {
  const key = kind === "champion" ? "winnerPlayers" : "lastPlayers";
  const streaks = players
    .map((player) => calculateBestStreak(timeline, player, key))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => {
      if (b.value !== a.value) {
        return b.value - a.value;
      }

      const aEnd = a.endIndex ?? -1;
      const bEnd = b.endIndex ?? -1;
      if (bEnd !== aEnd) {
        return bEnd - aEnd;
      }

      return compareMixed(a.player, b.player);
    });

  return streaks;
}

function calculateBestStreak(timeline, player, playerSetKey) {
  let currentStart = -1;
  let currentLength = 0;
  let bestStart = -1;
  let bestEnd = -1;
  let bestLength = 0;

  timeline.forEach((tournament, index) => {
    const hasMark = tournament[playerSetKey].has(player);

    if (hasMark) {
      if (currentLength === 0) {
        currentStart = index;
      }
      currentLength += 1;

      if (currentLength > bestLength) {
        bestLength = currentLength;
        bestStart = currentStart;
        bestEnd = index;
      }
      return;
    }

    currentLength = 0;
    currentStart = -1;
  });

  const isCurrent = bestLength > 0 && bestEnd === timeline.length - 1;

  return {
    player,
    value: bestLength,
    startIndex: bestStart,
    endIndex: bestEnd,
    startLabel: bestStart >= 0 ? timeline[bestStart].label : "",
    endLabel: bestEnd >= 0 ? timeline[bestEnd].label : "",
    isCurrent,
  };
}

function formatStreakDetail(entry) {
  if (!entry || !entry.value) {
    return "";
  }

  const range = `Del ${entry.startLabel} al ${entry.endLabel}`;
  return entry.isCurrent ? `${range}. Vigente.` : range;
}

function buildPlayerRecords(rows) {
  const map = new Map();

  rows.forEach((row) => {
    row.players.forEach((playerRaw) => {
      const player = normalizeName(playerRaw);
      if (!map.has(player)) {
        map.set(player, {
          player,
          tournamentsPlayed: 0,
          points: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          withoutLosses: 0,
          withoutWins: 0,
        });
      }

      const record = map.get(player);
      const points = Number(row.points) || 0;
      const wins = Number(row.wins) || 0;
      const draws = Number(row.draws) || 0;
      const losses = Number(row.losses) || 0;

      record.tournamentsPlayed += 1;
      record.points += points;
      record.wins += wins;
      record.draws += draws;
      record.losses += losses;
      if (losses === 0) {
        record.withoutLosses += 1;
      }
      if (wins === 0) {
        record.withoutWins += 1;
      }
    });
  });

  return Array.from(map.values());
}

function buildTeamRecords(rows) {
  const winnerTeams = calculateTournamentWinners(rows);
  const map = new Map();

  rows.forEach((row) => {
    if (row.format !== "teams") {
      return;
    }

    const team = row.teamNormalized;
    if (!team) {
      return;
    }

    if (!map.has(team)) {
      map.set(team, {
        team,
        tournamentsWon: 0,
        points: 0,
        wins: 0,
        losses: 0,
      });
    }

    const record = map.get(team);
    record.points += Number(row.points) || 0;
    record.wins += Number(row.wins) || 0;
    record.losses += Number(row.losses) || 0;

    if (winnerTeams.has(`${row.tournament}:::${row.teamNormalized}`)) {
      record.tournamentsWon += 1;
    }
  });

  return Array.from(map.values());
}

function rankOwnersByValue(records, key, ownerField) {
  return [...records]
    .map((item) => ({ player: item[ownerField], value: Number(item[key]) || 0 }))
    .filter((item) => item.value > 0)
    .sort((a, b) => {
      if (b.value !== a.value) {
        return b.value - a.value;
      }
      return compareMixed(a.player, b.player);
    });
}

function renderTopCards(cards) {
  if (!cards.length) {
    return "";
  }

  return cards
    .map((card) => {
      const sentimentClass = card.sentiment === "negative"
        ? "record-card--negative"
        : card.sentiment === "positive"
          ? "record-card--positive"
          : "record-card--neutral";
      const podium = buildPodiumGroups(card.ranking);
      const topGroup = podium[0];
      const secondGroup = podium[1];
      const thirdGroup = podium[2];

      if (!topGroup || !topGroup.entries.length) {
        return `
          <article class="record-card ${sentimentClass}">
            <h4>${card.title}</h4>
            <p class="record-empty">Sin datos suficientes.</p>
          </article>
        `;
      }

      const topRows = renderRecordGroupRows("1ro", topGroup.entries, card, false);
      const extraGroups = [secondGroup, thirdGroup].filter((group) => group && group.entries.length);
      const extraHtml = extraGroups.length
        ? `
          <details class="record-details">
            <summary>Ver 2do y 3er puesto</summary>
            <ul>
              ${extraGroups
                .map((group, index) => renderRecordGroupRows(index === 0 ? "2do" : "3ro", group.entries, card, true))
                .join("")}
            </ul>
          </details>
        `
        : "";

      return `
        <article class="record-card ${sentimentClass}">
          <h4>${card.title}</h4>
          <div class="record-top-list">
            ${topRows}
          </div>
          ${extraHtml}
        </article>
      `;
    })
    .join("");
}

function buildPodiumGroups(ranking) {
  const groups = [];

  ranking.forEach((entry) => {
    if (!groups.length || groups[groups.length - 1].value !== entry.value) {
      groups.push({ value: entry.value, entries: [entry] });
      return;
    }

    groups[groups.length - 1].entries.push(entry);
  });

  return groups.slice(0, 3);
}

function renderRecordGroupRows(label, entries, card, asListItem) {
  const wrapperTag = asListItem ? "li" : "div";

  return entries
    .map((entry) => {
      const detail = card.formatDetail ? card.formatDetail(entry) : "";
      return `
        <${wrapperTag} class="record-row">
          <span class="record-rank">${label}</span>
          <span class="record-player">${renderOwnerWithAvatar(entry.player)}</span>
          <span class="record-value">${card.formatValue(entry)}</span>
          ${detail ? `<span class="record-meta">${detail}</span>` : ""}
        </${wrapperTag}>
      `;
    })
    .join("");
}

function renderPlayersProfiles(rows) {
  const profiles = buildPlayersProfileData(rows);
  if (!profiles.length) {
    el.playersList.innerHTML = `<p class="record-empty">Sin datos suficientes.</p>`;
    return;
  }

  el.playersList.innerHTML = profiles.map((profile) => renderPlayerProfileCard(profile)).join("");
}

function buildPlayersProfileData(rows) {
  const timeline = buildTournamentTimeline(rows);
  const playerRecords = buildPlayerRecords(rows);
  const winnerTeams = calculateTournamentWinners(rows);
  const recordBadgesByPlayer = buildPlayerRecordBadges(rows, timeline, playerRecords);
  const timelineByTournament = new Map(timeline.map((entry) => [entry.tournament, entry]));
  const map = new Map();

  rows.forEach((row) => {
    const tournamentKey = String(row.tournament || "").trim();
    const timelineEntry = timelineByTournament.get(tournamentKey);
    const isChampion = winnerTeams.has(`${row.tournament}:::${row.teamNormalized}`);
    const isLast = Boolean(timelineEntry && timelineEntry.lastPlayers && row.players.some((player) => timelineEntry.lastPlayers.has(normalizeName(player))));

    row.players.forEach((playerRaw) => {
      const player = normalizeName(playerRaw);
      if (!map.has(player)) {
        map.set(player, {
          player,
          tournamentsPlayed: 0,
          tournamentsWon: 0,
          points: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          livesFor: 0,
          livesAgainst: 0,
          years: new Set(),
          participations: [],
        });
      }

      const profile = map.get(player);
      const wins = Number(row.wins) || 0;
      const draws = Number(row.draws) || 0;
      const losses = Number(row.losses) || 0;
      const points = Number(row.points) || 0;
      const livesFor = Number(row.livesFor) || 0;
      const livesAgainst = Number(row.livesAgainst) || 0;

      profile.tournamentsPlayed += 1;
      profile.tournamentsWon += isChampion ? 1 : 0;
      profile.points += points;
      profile.wins += wins;
      profile.draws += draws;
      profile.losses += losses;
      profile.livesFor += livesFor;
      profile.livesAgainst += livesAgainst;
      if (row.year) {
        profile.years.add(row.year);
      }

      profile.participations.push({
        tournament: tournamentKey,
        tournamentLabel: tournamentKey,
        dateLabel: timelineEntry ? timelineEntry.label : "",
        dateValue: row.dateValue || 0,
        team: row.teamNormalized,
        points,
        wins,
        draws,
        losses,
        isChampion,
        isLast,
      });
    });
  });

  const profiles = Array.from(map.values()).map((profile) => {
    const sortedParticipation = [...profile.participations].sort((a, b) => {
      if (b.dateValue !== a.dateValue) {
        return b.dateValue - a.dateValue;
      }
      return compareMixed(b.tournament, a.tournament);
    });

    const oldestParticipation = sortedParticipation[sortedParticipation.length - 1] || null;
    const latestParticipation = sortedParticipation[0] || null;
    const gamesPlayed = profile.wins + profile.draws + profile.losses;
    const ratio = calculateLifeRatio(profile.livesFor, profile.livesAgainst);

    return {
      ...profile,
      years: Array.from(profile.years).sort((a, b) => compareMixed(a, b)),
      recent: sortedParticipation.slice(0, 5),
      firstParticipation: oldestParticipation,
      lastParticipation: latestParticipation,
      gamesPlayed,
      winPct: gamesPlayed ? (profile.wins / gamesPlayed) * 100 : 0,
      ratio,
      recordBadges: recordBadgesByPlayer.get(profile.player) || [],
    };
  });

  return profiles.sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }
    if (b.tournamentsWon !== a.tournamentsWon) {
      return b.tournamentsWon - a.tournamentsWon;
    }
    return compareMixed(a.player, b.player);
  });
}

function buildPlayerRecordBadges(rows, timeline, playerRecords) {
  const badges = new Map();
  const players = getAllPlayers(rows);
  const championStreakRanking = rankStreaksByKind(timeline, players, "champion");
  const lastStreakRanking = rankStreaksByKind(timeline, players, "last");

  const addBadge = (player, label, sentiment) => {
    if (!player || !label || !sentiment) {
      return;
    }
    if (!badges.has(player)) {
      badges.set(player, []);
    }
    const bucket = badges.get(player);
    if (!bucket.some((item) => item.label === label)) {
      bucket.push({ label, sentiment });
    }
  };

  const awardTopRanking = (ranking, labelBuilder, sentiment) => {
    if (!ranking.length) {
      return;
    }

    const topValue = ranking[0].value;
    ranking
      .filter((entry) => entry.value === topValue)
      .forEach((entry) => {
        addBadge(entry.player, labelBuilder(entry), sentiment);
      });
  };

  awardTopRanking(championStreakRanking, (entry) => `Racha campeon (${entry.value})`, "positive");
  awardTopRanking(lastStreakRanking, (entry) => `Racha ultimo (${entry.value})`, "negative");

  const metricLabels = [
    { key: "points", label: "Mas puntos totales", sentiment: "positive" },
    { key: "wins", label: "Mas partidos ganados", sentiment: "positive" },
    { key: "draws", label: "Mas partidos empatados", sentiment: "neutral" },
    { key: "losses", label: "Mas partidos perdidos", sentiment: "negative" },
    { key: "tournamentsPlayed", label: "Mas torneos jugados", sentiment: "positive" },
    { key: "withoutLosses", label: "Mas torneos sin derrotas", sentiment: "positive" },
    { key: "withoutWins", label: "Mas torneos sin victorias", sentiment: "negative" },
  ];

  metricLabels.forEach((metric) => {
    const ranking = rankOwnersByValue(playerRecords, metric.key, "player");
    awardTopRanking(ranking, () => metric.label, metric.sentiment);
  });

  return badges;
}

function renderPlayerProfileCard(profile) {
  const lastTournamentText = profile.lastParticipation
    ? formatShortDateLabel(profile.lastParticipation.dateLabel || profile.lastParticipation.tournamentLabel)
    : "Sin datos";

  const badgesHtml = profile.recordBadges.length
    ? `
      <div class="player-badges">
        ${profile.recordBadges
          .map((badge) => {
            const badgeClass = badge.sentiment === "negative"
              ? "player-badge player-badge--negative"
              : badge.sentiment === "positive"
                ? "player-badge player-badge--positive"
                : "player-badge player-badge--neutral";
            return `<span class="${badgeClass}">${escapeHtml(badge.label)}</span>`;
          })
          .join("")}
      </div>
    `
    : `<p class="player-muted">Sin records historicos en primer puesto actualmente.</p>`;

  const recentHtml = profile.recent.length
    ? profile.recent
      .map((entry) => {
        const outcome = entry.isChampion ? "Campeon" : entry.isLast ? "Ultimo" : "Participacion";
        return `
          <li>
            <span>${escapeHtml(entry.dateLabel || entry.tournamentLabel)}</span>
            <span>${escapeHtml(entry.team)}</span>
            <span>${entry.points} pts</span>
            <span>${entry.wins}-${entry.draws}-${entry.losses}</span>
            <span class="recent-tag">${outcome}</span>
          </li>
        `;
      })
      .join("")
    : `<li><span>Sin participaciones recientes.</span></li>`;

  return `
    <article class="player-profile-card">
      <header class="player-profile-header">
        ${renderAvatarImage(profile.player, "avatar-xl")}
        <div>
          <h3>${escapeHtml(profile.player)}</h3>
          <p>Ultimo torneo jugado: ${lastTournamentText}</p>
        </div>
      </header>

      <div class="player-stats-grid">
        <div><span>Torneos</span><strong>${profile.tournamentsPlayed}</strong></div>
        <div><span>Campeonatos</span><strong>${profile.tournamentsWon}</strong></div>
        <div><span>Puntos</span><strong>${profile.points}</strong></div>
        <div><span>Partidos</span><strong>${profile.gamesPlayed}</strong></div>
        <div><span>V-E-D</span><strong>${profile.wins} - ${profile.draws} - ${profile.losses}</strong></div>
        <div><span>% victorias</span><strong>${profile.winPct.toFixed(1)}%</strong></div>
        <div><span>Vidas (F-C)</span><strong>${profile.livesFor} - ${profile.livesAgainst}</strong></div>
        <div><span>Ratio vidas</span><strong>${profile.ratio.toFixed(2)}</strong></div>
      </div>

      <section class="player-profile-section">
        <h4>Records donde es dueño</h4>
        ${badgesHtml}
      </section>

      <section class="player-profile-section">
        <h4>Participacion reciente</h4>
        <ul class="recent-list">
          ${recentHtml}
        </ul>
      </section>
    </article>
  `;
}

function formatShortDateLabel(label) {
  const raw = String(label || "").trim();
  const parts = raw.split("/");

  if (parts.length === 3 && parts[2].length >= 2) {
    const day = parts[0].padStart(2, "0");
    const month = parts[1].padStart(2, "0");
    const yearShort = parts[2].slice(-2);
    return `${day}/${month}/${yearShort}`;
  }

  return raw;
}

function refreshUI() {
  const filteredRows = applyFilters(state.rawRows);
  const winnerTeams = calculateTournamentWinners(filteredRows);
  const individualStats = calculateIndividualStats(filteredRows, winnerTeams);
  const teamStats = calculateTeamStats(filteredRows, winnerTeams);
  renderStreaksAndRecords(state.rawRows);
  renderPlayersProfiles(state.rawRows);

  const sortedIndividuals = withPointsPositions(sortStats(individualStats, state.sort.individual));
  const sortedTeams = withPointsPositions(sortStats(teamStats, state.sort.teams));

  renderStatsTable({
    table: el.individualTable,
    columns: individualColumns,
    rows: sortedIndividuals,
    sortState: state.sort.individual,
    sortScope: "individual",
  });

  renderStatsTable({
    table: el.teamsTable,
    columns: teamColumns,
    rows: sortedTeams,
    sortState: state.sort.teams,
    sortScope: "teams",
  });

  el.content.classList.remove("is-hidden");
}

function withPointsPositions(rows) {
  const scoreKey = (row) => {
    return `${Number(row.tournamentsWon) || 0}:::${Number(row.points) || 0}:::${Number(row.lifeDiff) || 0}`;
  };

  const uniqueScoresDesc = Array.from(
    new Set(
      rows.map((row) => {
        return scoreKey(row);
      })
    )
  ).sort((a, b) => {
    const [aWon, aPoints, aLifeDiff] = a.split(":::").map(Number);
    const [bWon, bPoints, bLifeDiff] = b.split(":::").map(Number);

    if (bWon !== aWon) {
      return bWon - aWon;
    }

    if (bPoints !== aPoints) {
      return bPoints - aPoints;
    }

    return bLifeDiff - aLifeDiff;
  });

  const rankByScore = new Map(uniqueScoresDesc.map((score, index) => [score, index + 1]));

  return rows.map((row) => ({
    ...row,
    position: rankByScore.get(scoreKey(row)) || 0,
  }));
}

function sortStats(rows, sortState) {
  return [...rows].sort((a, b) => {
    const primaryResult = compareValues(a[sortState.key], b[sortState.key], sortState.direction);
    if (primaryResult !== 0) {
      return primaryResult;
    }

    for (const tieBreaker of sortState.tieBreakers || []) {
      const tieResult = compareValues(a[tieBreaker.key], b[tieBreaker.key], tieBreaker.direction);
      if (tieResult !== 0) {
        return tieResult;
      }
    }

    return compareValues(a.name, b.name, "asc");
  });
}

function compareValues(a, b, direction) {
  const left = a ?? 0;
  const right = b ?? 0;
  const base =
    typeof left === "string" || typeof right === "string"
      ? String(left).localeCompare(String(right), "es", { sensitivity: "base", numeric: true })
      : Number(left) - Number(right);

  return direction === "asc" ? base : -base;
}

function compareMixed(a, b) {
  return String(a).localeCompare(String(b), "es", { numeric: true, sensitivity: "base" });
}

function renderStatsTable({ table, columns, rows, sortState, sortScope }) {
  const thead = table.querySelector("thead");
  const tbody = table.querySelector("tbody");
  const columnRamp = buildColumnRamp(rows);

  const headerHtml = columns
    .map((column) => {
      const isActive = sortState.key === column.key;
      const marker = isActive ? (sortState.direction === "asc" ? "▲" : "▼") : "↕";
      const isPrimary = column.key === "points" || column.key === "tournamentsWon";
      const thClasses = [];
      if (isPrimary) {
        thClasses.push("primary-col-header");
      }
      if (column.key === "lifeDiff") {
        thClasses.push("divider-before");
      }
      if (isActive) {
        thClasses.push("sorted-col-header");
      }
      const thClass = thClasses.length ? ` class="${thClasses.join(" ")}"` : "";
      return `<th${thClass}><button class="sort-btn" type="button" data-scope="${sortScope}" data-key="${column.key}">${column.label}<span class="sort-indicator">${marker}</span></button></th>`;
    })
    .join("");

  thead.innerHTML = `<tr>${headerHtml}</tr>`;

  if (!rows.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="${columns.length}">No hay datos para los filtros seleccionados.</td></tr>`;
  } else {
    const bodyHtml = rows
      .map((row) => {
        const cells = columns
          .map((column) => {
            const value = row[column.key];
            const valueText = formatValue(value, column.type, column.key, sortScope);
            const classNames = getCellClasses({ key: column.key, type: column.type, value, sortScope });
            if (sortState.key === column.key) {
              classNames.push("sorted-col-cell");
            }
            const classAttribute = classNames.length ? ` class="${classNames.join(" ")}"` : "";
            const colorStyle = getMetricRampStyle(column.key, value, columnRamp);
            const styleAttribute = colorStyle ? ` style="${colorStyle}"` : "";
            return `<td data-label="${column.label}"${classAttribute}${styleAttribute}>${valueText}</td>`;
          })
          .join("");
        return `<tr>${cells}</tr>`;
      })
      .join("");

    tbody.innerHTML = bodyHtml;
  }

  table.querySelectorAll(".sort-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const scope = button.dataset.scope;
      const key = button.dataset.key;
      toggleSort(scope, key);
    });
  });
}

function formatValue(value, type, key, sortScope) {
  if (sortScope === "individual" && key === "name") {
    return formatPlayerName(value);
  }

  if (sortScope === "teams" && key === "name") {
    return formatTeamName(value);
  }

  if (type === "record") {
    return String(value ?? "0-0-0");
  }

  if (type === "rank") {
    const rank = Number(value || 0);
    return rank ? `${getRankEmoji(rank)} ${rank}` : "-";
  }

  if (type === "percent") {
    return `${Number(value || 0).toFixed(1)}%`;
  }

  if (type === "decimal") {
    return Number(value || 0).toFixed(2);
  }

  if (type === "number") {
    return Number(value || 0).toLocaleString("es-AR");
  }

  return String(value ?? "");
}

function formatTeamName(value) {
  const text = String(value ?? "").trim();
  if (!text) {
    return "";
  }

  const players = text.split(/\s*\+\s*/).map((name) => name.trim()).filter(Boolean);
  if (!players.length) {
    return escapeHtml(text);
  }

  return `
    <div class="team-cell-content">
      ${players
        .map((player) => {
          return `
            <div class="team-member-row">
              ${renderAvatarImage(player, "avatar-sm")}
              <span class="name-text">${escapeHtml(player)}</span>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function formatPlayerName(value) {
  const player = String(value ?? "").trim();
  if (!player) {
    return "";
  }

  return `
    <div class="player-cell-content">
      ${renderAvatarImage(player, "avatar-sm")}
      <span class="name-text">${escapeHtml(player)}</span>
    </div>
  `;
}

function renderOwnerWithAvatar(ownerText) {
  const text = String(ownerText ?? "").trim();
  if (!text) {
    return "";
  }

  const teamParts = text.split(/\s*\+\s*/).map((name) => name.trim()).filter(Boolean);
  if (teamParts.length >= 2) {
    return `
      <span class="owner-team-block">
        ${teamParts
          .map((player) => {
            return `
              <span class="owner-member">
                ${renderAvatarImage(player, "avatar-xs")}
                <span class="name-text">${escapeHtml(player)}</span>
              </span>
            `;
          })
          .join("")}
      </span>
    `;
  }

  return `
    <span class="owner-member owner-member-single">
      ${renderAvatarImage(text, "avatar-xs")}
      <span class="name-text">${escapeHtml(text)}</span>
    </span>
  `;
}

function renderAvatarImage(name, sizeClass) {
  const label = String(name ?? "").trim();
  const candidates = buildAvatarCandidates(label);
  const size = String(sizeClass || "avatar-sm").trim();
  const wrapClass = size === "avatar-xl"
    ? "avatar-wrap avatar-wrap-xl"
    : size === "avatar-xs"
      ? "avatar-wrap avatar-wrap-xs"
      : "avatar-wrap avatar-wrap-sm";

  return `<span class="${wrapClass}"><img class="avatar ${size}" src="${candidates[0]}" data-avatar-index="0" data-candidates="${candidates.join("|")}" onerror="handleAvatarError(this)" alt="${escapeHtml(label)}"></span>`;
}

function buildAvatarCandidates(name) {
  const compactOriginal = normalizeAvatarBase(name, false);
  const compactLower = normalizeAvatarBase(name, true);
  const bases = Array.from(new Set([compactOriginal, compactLower].filter(Boolean)));
  const exts = [".jpg", ".jpeg", ".png", ".JPG", ".JPEG", ".PNG"];
  const urls = [];

  bases.forEach((base) => {
    exts.forEach((ext) => {
      urls.push(`imagenes/${encodeURIComponent(base)}${ext}`);
    });
  });

  urls.push("imagenes/jugador.jpg");
  return Array.from(new Set(urls));
}

function normalizeAvatarBase(name, toLowerCase) {
  const raw = String(name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "");

  return toLowerCase ? raw.toLowerCase() : raw;
}

function handleAvatarError(imageElement) {
  if (!imageElement) {
    return;
  }

  const candidates = String(imageElement.dataset.candidates || "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!candidates.length) {
    imageElement.onerror = null;
    return;
  }

  const currentIndex = Number(imageElement.dataset.avatarIndex || 0);
  const nextIndex = currentIndex + 1;

  if (nextIndex >= candidates.length) {
    imageElement.onerror = null;
    return;
  }

  imageElement.dataset.avatarIndex = String(nextIndex);
  imageElement.src = candidates[nextIndex];
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getRankEmoji(rank) {
  if (rank === 1) {
    return "🥇";
  }
  if (rank === 2) {
    return "🥈";
  }
  if (rank === 3) {
    return "🥉";
  }
  return "";
}

function getCellClasses({ key, type, value, sortScope }) {
  const classes = [];

  if (key === "name") {
    classes.push(sortScope === "individual" ? "player-name" : "team-name");
  }

  if (key === "points") {
    classes.push("points-cell");
  }

  if (key === "tournamentsWon") {
    classes.push("wins-col-cell");
  }

  if (key === "lifeDiff") {
    classes.push("divider-before");
  }

  const metricClass = getMetricClass(key, type, value);
  if (metricClass) {
    classes.push(metricClass);
  }

  return classes;
}

function buildColumnRamp(rows) {
  const keys = ["avgPoints", "avgLifeDiff"];
  const map = {};

  keys.forEach((key) => {
    const values = rows
      .map((row) => Number(row[key]))
      .filter((value) => Number.isFinite(value));

    if (!values.length) {
      map[key] = null;
      return;
    }

    map[key] = {
      min: Math.min(...values),
      max: Math.max(...values),
      higherIsBetter: true,
    };
  });

  return map;
}

function getMetricRampStyle(key, value, columnRamp) {
  const numeric = Number(value);

  const semanticStyle = getSemanticMetricStyle(key, numeric);
  if (semanticStyle) {
    return semanticStyle;
  }

  const ramp = columnRamp[key];

  if (!ramp || !Number.isFinite(numeric)) {
    return "";
  }

  let ratio;
  if (ramp.max === ramp.min) {
    ratio = 0.5;
  } else {
    ratio = (numeric - ramp.min) / (ramp.max - ramp.min);
  }

  if (!ramp.higherIsBetter) {
    ratio = 1 - ratio;
  }

  const clamped = Math.max(0, Math.min(1, ratio));
  const hue = 8 + (145 - 8) * clamped;
  const saturation = 88;
  const lightness = 36;

  return `color:hsl(${hue.toFixed(0)} ${saturation}% ${lightness}%);background-color:hsl(${hue.toFixed(0)} 86% 96%);font-weight:700;`;
}

function getSemanticMetricStyle(key, numeric) {
  if (!Number.isFinite(numeric)) {
    return "";
  }

  if (key === "ratio") {
    const safe = Math.max(0.01, numeric);
    const score = Math.tanh(Math.log(safe) / 0.5);
    return divergingToneFromScore(score);
  }

  if (key === "lifeDiff") {
    const score = Math.tanh(numeric / 12);
    return divergingToneFromScore(score);
  }

  if (key === "winPct") {
    if (numeric >= 75) {
      return metricTone("#0a6b2f", "#dff5e7");
    }
    if (numeric >= 50) {
      return metricTone("#1b8350", "#ecfaf1");
    }
    if (numeric >= 35) {
      return metricTone("#9b7a05", "#fff8d9");
    }
    if (numeric >= 15) {
      return metricTone("#c2412d", "#fff1ed");
    }
    return metricTone("#b42318", "#fdeeed");
  }

  if (key === "drawPct") {
    if (numeric >= 12) {
      return metricTone("#0f6a9e", "#eaf5ff");
    }
    if (numeric >= 7) {
      return metricTone("#3a6b95", "#f1f7ff");
    }
    return metricTone("#5f6b7a", "#f3f5f7");
  }

  if (key === "lossPct") {
    if (numeric <= 30) {
      return metricTone("#0f7a3c", "#e9f8ef");
    }
    if (numeric <= 45) {
      return metricTone("#b54708", "#fff4e8");
    }
    return metricTone("#b42318", "#fdeeed");
  }

  return "";
}

function metricTone(textColor, bgColor) {
  return `color:${textColor};background-color:${bgColor};font-weight:700;`;
}

function divergingToneFromScore(score) {
  const textStops = ["#b42318", "#c2412d", "#9b7a05", "#5f6b7a", "#1b8350", "#0a6b2f"];
  const bgStops = ["#fdeeed", "#fff1ed", "#fff8d9", "#f3f5f7", "#ecfaf1", "#dff5e7"];
  const normalized = clamp01((score + 1) / 2);

  return metricTone(
    blendByStops(textStops, normalized),
    blendByStops(bgStops, normalized)
  );
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function blendByStops(stops, t) {
  if (!Array.isArray(stops) || stops.length === 0) {
    return "#000000";
  }
  if (stops.length === 1) {
    return stops[0];
  }

  const clamped = clamp01(t);
  const segments = stops.length - 1;
  const scaled = clamped * segments;
  const index = Math.min(segments - 1, Math.floor(scaled));
  const localT = scaled - index;

  return blendHex(stops[index], stops[index + 1], localT);
}

function blendHex(startHex, endHex, t) {
  const a = hexToRgb(startHex);
  const b = hexToRgb(endHex);
  const ratio = clamp01(t);

  const r = Math.round(a.r + (b.r - a.r) * ratio);
  const g = Math.round(a.g + (b.g - a.g) * ratio);
  const bChannel = Math.round(a.b + (b.b - a.b) * ratio);

  return rgbToHex(r, g, bChannel);
}

function hexToRgb(hex) {
  const normalized = String(hex || "").replace("#", "").trim();
  const safe = normalized.length === 3
    ? normalized.split("").map((char) => `${char}${char}`).join("")
    : normalized;

  const parsed = Number.parseInt(safe, 16);
  if (!Number.isFinite(parsed)) {
    return { r: 0, g: 0, b: 0 };
  }

  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  };
}

function rgbToHex(r, g, b) {
  const toHex = (channel) => {
    const clamped = Math.max(0, Math.min(255, channel));
    return clamped.toString(16).padStart(2, "0");
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function getMetricClass(key, type, value) {
  const numeric = Number(value);
  const isMetric =
    type === "percent" || key === "lifeDiff" || key === "avgPoints" || key === "avgLifeDiff" || key === "ratio";

  if (!isMetric || !Number.isFinite(numeric)) {
    return "";
  }

  if (key === "ratio") {
    if (numeric === 1) {
      return "metric-neutral";
    }
    return numeric > 1 ? "metric-pos" : "metric-neg";
  }

  if (numeric === 0) {
    return "metric-neutral";
  }

  if (key === "lossPct") {
    return "metric-neg";
  }

  return numeric > 0 ? "metric-pos" : "metric-neg";
}

function toggleSort(scope, key) {
  const current = state.sort[scope];

  if (current.key === key) {
    current.direction = current.direction === "asc" ? "desc" : "asc";
  } else {
    current.key = key;
    current.direction = key === "name" ? "asc" : "desc";
  }

  refreshUI();
}

function setActivePage(pageKey) {
  state.activePage = pageKey;

  el.pageTabs.forEach((tab) => {
    const isActive = tab.dataset.page === pageKey;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  Object.entries(el.pageViews).forEach(([key, view]) => {
    view.classList.toggle("is-active", key === pageKey);
  });
}

function setActiveTab(tabKey) {
  state.activeTab = tabKey;

  el.tabs.forEach((tab) => {
    const isActive = tab.dataset.tab === tabKey;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  Object.entries(el.tabViews).forEach(([key, view]) => {
    view.classList.toggle("is-active", key === tabKey);
  });
}
