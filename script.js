const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQawlREOP-I6-QFRHvQ21YrPRFOEkPiQ9znqvQfppgCsWPS1ytH0135bvyHZQbQYwO_04rYmsKIk3qb/pub?gid=0&single=true&output=csv";

const state = {
  rawRows: [],
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
  tabs: Array.from(document.querySelectorAll(".tab")),
  tabViews: {
    individual: document.getElementById("view-individual"),
    teams: document.getElementById("view-teams"),
  },
  filterYear: document.getElementById("filter-year"),
  filterTournament: document.getElementById("filter-tournament"),
  clearFilters: document.getElementById("clear-filters"),
  individualTable: document.getElementById("individual-table"),
  teamsTable: document.getElementById("teams-table"),
};

const individualColumns = [
  { key: "position", label: "#", type: "rank" },
  { key: "name", label: "Jugador", type: "string" },
  { key: "tournamentsPlayed", label: "Torneos jugados", type: "number" },
  { key: "tournamentsWon", label: "Torneos ganados", type: "number" },
  { key: "points", label: "Puntos", type: "number" },
  { key: "wins", label: "Victorias", type: "number" },
  { key: "draws", label: "Empates", type: "number" },
  { key: "losses", label: "Derrotas", type: "number" },
  { key: "livesFor", label: "Vidas a favor", type: "number" },
  { key: "livesAgainst", label: "Vidas en contra", type: "number" },
  { key: "lifeDiff", label: "Diferencia de vidas", type: "number" },
  { key: "winPct", label: "% victorias", type: "percent" },
  { key: "drawPct", label: "% empates", type: "percent" },
  { key: "lossPct", label: "% derrotas", type: "percent" },
  { key: "avgPoints", label: "Promedio puntos/torneo", type: "decimal" },
];

const teamColumns = [
  { key: "position", label: "#", type: "rank" },
  { key: "name", label: "Equipo", type: "string" },
  { key: "tournamentsPlayed", label: "Torneos jugados", type: "number" },
  { key: "tournamentsWon", label: "Torneos ganados", type: "number" },
  { key: "points", label: "Puntos", type: "number" },
  { key: "wins", label: "Victorias", type: "number" },
  { key: "draws", label: "Empates", type: "number" },
  { key: "losses", label: "Derrotas", type: "number" },
  { key: "livesFor", label: "Vidas a favor", type: "number" },
  { key: "livesAgainst", label: "Vidas en contra", type: "number" },
  { key: "lifeDiff", label: "Diferencia de vidas", type: "number" },
  { key: "winPct", label: "% victorias", type: "percent" },
  { key: "drawPct", label: "% empates", type: "percent" },
  { key: "lossPct", label: "% derrotas", type: "percent" },
  { key: "avgPoints", label: "Promedio puntos/torneo", type: "decimal" },
  { key: "avgLifeDiff", label: "Promedio dif. vidas", type: "decimal" },
];

init();

async function init() {
  bindEvents();
  await loadData();
}

function bindEvents() {
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
      if (players.length < 2) {
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

  return {
    ...stat,
    lifeDiff,
    winPct: games ? (stat.wins / games) * 100 : 0,
    drawPct: games ? (stat.draws / games) * 100 : 0,
    lossPct: games ? (stat.losses / games) * 100 : 0,
    notLosePct: games ? ((stat.wins + stat.draws) / games) * 100 : 0,
    avgPoints: stat.tournamentsPlayed ? stat.points / stat.tournamentsPlayed : 0,
    avgLifeDiff: stat.tournamentsPlayed ? lifeDiff / stat.tournamentsPlayed : 0,
  };
}

function refreshUI() {
  const filteredRows = applyFilters(state.rawRows);
  const winnerTeams = calculateTournamentWinners(filteredRows);
  const individualStats = calculateIndividualStats(filteredRows, winnerTeams);
  const teamStats = calculateTeamStats(filteredRows, winnerTeams);

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
      const thClass = isPrimary ? " class=\"primary-col-header\"" : "";
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
  if (sortScope === "teams" && key === "name") {
    return formatTeamName(value);
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
  if (players.length < 2) {
    return text;
  }

  return `${players[0]}<br>${players[1]}`;
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

  const metricClass = getMetricClass(key, type, value);
  if (metricClass) {
    classes.push(metricClass);
  }

  return classes;
}

function buildColumnRamp(rows) {
  const keys = ["winPct", "drawPct", "lossPct", "notLosePct", "avgPoints", "avgLifeDiff", "lifeDiff"];
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
      higherIsBetter: key !== "lossPct",
    };
  });

  return map;
}

function getMetricRampStyle(key, value, columnRamp) {
  const ramp = columnRamp[key];
  const numeric = Number(value);

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

  return `color:hsl(${hue.toFixed(0)} ${saturation}% ${lightness}%);font-weight:700;`;
}

function getMetricClass(key, type, value) {
  const numeric = Number(value);
  const isMetric = type === "percent" || key === "lifeDiff" || key === "avgPoints" || key === "avgLifeDiff";

  if (!isMetric || !Number.isFinite(numeric)) {
    return "";
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
