// Blockbuster Video — a static Stremio add-on (built into docs/) that turns Stremio into a 1985–2004 video store.
// Every week the store jumps to a random year and restocks ten shelves with that year's films.
// Data: IMDb's official non-commercial datasets. No dependencies: Node 18+ only.
const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');
const readline = require('readline');

// ---- Tuning ---------------------------------------------------------------------------------------
const FIRST_YEAR = 1985, LAST_YEAR = 2004;   // the store's range: 20 years, one full cycle before any repeat
const PER_ROW = 25;                          // up to 25 films per shelf
const MIN_RUNTIME = 60;                      // minutes; drops shorts and featurettes
const SHELF_MIN_VOTES = 3000;                // genre shelves: films people actually rented
const BEST_MIN_VOTES = 5000, BEST_MIN_RATING = 6.5; // "Best of the Year"
const SHELF_MIN_RATING = 5.5;                // genre shelves skip the real stinkers (Biggest Hits doesn't — that's the point)
const SCHEDULE_EPOCH = '2026-01-05';         // a Monday; week numbers count from here
const TIME_ZONE = 'Australia/Melbourne';     // the store restocks on Monday, Melbourne time
// ---------------------------------------------------------------------------------------------------

const OUT = path.join(__dirname, 'docs');
const BASE = 'https://momoneymoproblemo.github.io/rewind-video';
const DATA = 'https://datasets.imdbws.com/';
const CATALOG_ID = 'blockbuster-video';

// Ten internal aisles feed one Blockbuster Video catalogue with a genre dropdown.
const has = (...gs) => (f) => gs.some((g) => f.genres.includes(g));
const ROWS = [
  { id: 'rewind-biggest', name: 'Blockbuster · Biggest Hits', label: 'Biggest Hits', kind: 'biggest' },
  { id: 'rewind-best', name: 'Blockbuster · Best of the Year', label: 'Best of the Year', kind: 'best' },
  { id: 'rewind-action', name: 'Blockbuster · Action', label: 'Action', kind: 'shelf', match: has('Action') },
  { id: 'rewind-comedy', name: 'Blockbuster · Comedy', label: 'Comedy', kind: 'shelf', match: has('Comedy') },
  { id: 'rewind-drama', name: 'Blockbuster · Drama', label: 'Drama', kind: 'shelf', match: has('Drama') },
  { id: 'rewind-horror', name: 'Blockbuster · Horror', label: 'Horror', kind: 'shelf', match: has('Horror') },
  { id: 'rewind-scifi', name: 'Blockbuster · Sci-Fi & Fantasy', label: 'Sci-Fi & Fantasy', kind: 'shelf', match: has('Sci-Fi', 'Fantasy') },
  { id: 'rewind-thriller', name: 'Blockbuster · Thriller & Crime', label: 'Thriller & Crime', kind: 'shelf', match: has('Thriller', 'Crime', 'Mystery') },
  { id: 'rewind-family', name: 'Blockbuster · Family & Animation', label: 'Family & Animation', kind: 'shelf', match: has('Family', 'Animation') },
  { id: 'rewind-romance', name: 'Blockbuster · Romance', label: 'Romance', kind: 'shelf', match: has('Romance') },
];

// ---- Which year is the store in this week? -----------------------------------------------------------
// Deterministic: the same week always gives the same year, so reruns never reshuffle mid-week.
// Each block of 20 weeks visits every year once, in a shuffled order; no year repeats across blocks either.
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffledYears(cycle) {
  const years = [];
  for (let y = FIRST_YEAR; y <= LAST_YEAR; y++) years.push(y);
  const r = mulberry32(19850000 + cycle);
  for (let i = years.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [years[i], years[j]] = [years[j], years[i]]; }
  return years;
}
function cycleOrder(cycle) {
  const years = shuffledYears(cycle);
  // Don't let a block start with the year the previous block ended on (the fix only ever swaps slots 0 and 1).
  if (cycle > 0 && years[0] === shuffledYears(cycle - 1).at(-1)) [years[0], years[1]] = [years[1], years[0]];
  return years;
}
function localDate(d) { // YYYY-MM-DD in the store's time zone
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
function thisWeek(now = new Date()) {
  const today = new Date(localDate(now) + 'T00:00:00Z');
  const monday = new Date(today.getTime() - ((today.getUTCDay() + 6) % 7) * 864e5);
  const week = Math.floor((monday - new Date(SCHEDULE_EPOCH + 'T00:00:00Z')) / (7 * 864e5));
  const n = LAST_YEAR - FIRST_YEAR + 1;
  const cycle = Math.floor(week / n), pos = ((week % n) + n) % n;
  return { monday: monday.toISOString().slice(0, 10), week, year: cycleOrder(cycle)[pos] };
}

// ---- IMDb data ---------------------------------------------------------------------------------------
function lines(file) {
  if (process.env.IMDB_DIR) { // local copies, for testing
    return Promise.resolve(readline.createInterface({ input: fs.createReadStream(path.join(process.env.IMDB_DIR, file)).pipe(zlib.createGunzip()), crlfDelay: Infinity }));
  }
  return new Promise((resolve, reject) => {
    https.get(DATA + file, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`${file}: HTTP ${res.statusCode}`));
      resolve(readline.createInterface({ input: res.pipe(zlib.createGunzip()), crlfDelay: Infinity }));
    }).on('error', reject);
  });
}

// Enrich the six display sleeves with genuine film information from Cinemeta.
// If it is unavailable, IMDb runtime, genres and rating still populate the reverse.
async function filmDetails(id) {
  try {
    let data;
    if (process.env.METADATA_DIR) {
      data = JSON.parse(fs.readFileSync(path.join(process.env.METADATA_DIR, `${id}.json`), 'utf8'));
    } else {
      data = await new Promise((resolve, reject) => {
        const req = https.get(`https://v3-cinemeta.strem.io/meta/movie/${id}.json`, (res) => {
          if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
          let body = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => { body += chunk; });
          res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
          res.on('error', reject);
        });
        req.setTimeout(10000, () => req.destroy(new Error('Cinemeta timed out')));
        req.on('error', reject);
      });
    }
    const m = data.meta || {};
    const list = (value) => Array.isArray(value) ? value.filter((v) => typeof v === 'string') : typeof value === 'string' ? [value] : [];
    return { synopsis: typeof m.description === 'string' ? m.description : '', directors: list(m.director), cast: list(m.cast).slice(0, 3) };
  } catch (e) {
    console.warn(`Film information for ${id} unavailable; retaining IMDb details.`);
    return {};
  }
}

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x || lo));
const fmtVotes = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'K' : String(n));
const fmtRuntime = (m) => (m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`);

function write(rel, data) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data));
}

async function main() {
  const week = thisWeek();
  const year = process.env.YEAR ? +process.env.YEAR : week.year;
  if (!(year >= FIRST_YEAR && year <= LAST_YEAR)) throw new Error(`Year ${year} is outside ${FIRST_YEAR}–${LAST_YEAR}`);
  console.log(`Week of ${week.monday}: the store is in ${year}${process.env.YEAR ? ' (set by hand)' : ''}`);

  console.log('Reading ratings…');
  const ratings = new Map();
  let first = true;
  for await (const l of await lines('title.ratings.tsv.gz')) {
    if (first) { first = false; continue; }
    const [id, avg, votes] = l.split('\t');
    if (+votes >= 500) ratings.set(id, [+avg, +votes]);
  }

  console.log('Reading titles…');
  const films = [];
  first = true;
  for await (const l of await lines('title.basics.tsv.gz')) {
    if (first) { first = false; continue; }
    const f = l.split('\t'); // tconst type primary original isAdult start end runtime genres
    if (f[1] !== 'movie' || f[4] !== '0' || +f[5] !== year) continue;
    const r = ratings.get(f[0]);
    if (!r) continue;
    const runtime = +f[7] || 0;
    const genres = f[8] === '\\N' ? [] : f[8].split(',');
    if (runtime < MIN_RUNTIME || genres.includes('Documentary')) continue;
    films.push({ id: f[0], name: f[2], runtime, genres, rating: r[0], votes: r[1] });
  }
  console.log(`  ${films.length} films from ${year}`);
  if (films.length < 100) throw new Error('Too few films — check the IMDb download.');

  // Biggest Hits and the genre aisles lead with what everyone rented (most votes).
  // Best of the Year uses IMDb Top 250-style weighting, so it's about quality, not just popularity.
  const votesDesc = films.map((f) => f.votes).sort((a, b) => b - a);
  const m = clamp(votesDesc[49] / 2, 2000, 50000);
  const known = films.filter((f) => f.votes >= SHELF_MIN_VOTES);
  const C = known.reduce((s, f) => s + f.rating, 0) / known.length;
  const score = (f) => (f.votes / (f.votes + m)) * f.rating + (m / (f.votes + m)) * C;
  const byScore = (a, b) => score(b) - score(a) || b.votes - a.votes;

  const shelves = {};
  for (const row of ROWS) {
    let picks;
    if (row.kind === 'biggest') picks = [...films].sort((a, b) => b.votes - a.votes);
    else if (row.kind === 'best') picks = films.filter((f) => f.votes >= BEST_MIN_VOTES && f.rating >= BEST_MIN_RATING).sort(byScore);
    else picks = films.filter((f) => f.votes >= SHELF_MIN_VOTES && f.rating >= SHELF_MIN_RATING && row.match(f)).sort((a, b) => b.votes - a.votes);
    shelves[row.id] = picks.slice(0, PER_ROW);
  }

  const details = new Map(await Promise.all(shelves[ROWS[0].id].slice(0, 6).map(async (f) => [f.id, await filmDetails(f.id)])));
  const yy = String(year).slice(2);
  fs.rmSync(path.join(OUT, 'catalog'), { recursive: true, force: true });
  const summary = { updated: new Date().toISOString(), weekOf: week.monday, year, rows: [] };
  for (const row of ROWS) {
    const metas = shelves[row.id].map((f, i) => ({
      id: f.id,
      type: 'movie',
      name: f.name,
      poster: `https://images.metahub.space/poster/medium/${f.id}/img`,
      posterShape: 'poster',
      background: `https://images.metahub.space/background/medium/${f.id}/img`,
      releaseInfo: String(year),
      imdbRating: f.rating.toFixed(1),
      genres: f.genres,
      runtime: fmtRuntime(f.runtime),
      description: `Blockbuster '${yy} · #${i + 1} ${row.label} · IMDb ${f.rating.toFixed(1)} from ${fmtVotes(f.votes)} votes.`,
    }));
    // Stremio's genre extra is a URL-encoded path segment, not a query parameter.
    // The decoded filename is used by static hosts such as GitHub Pages.
    if (row.kind === 'biggest') {
      // An unfiltered visit always opens Biggest Hits; compatibility aliases do too.
      write(`catalog/movie/${CATALOG_ID}.json`, { metas });
      for (const filter of ['', 'Top', 'All']) write(`catalog/movie/${CATALOG_ID}/genre=${filter}.json`, { metas });
    }
    write(`catalog/movie/${CATALOG_ID}/genre=${row.label}.json`, { metas });
    // Form encoders can use '+' for spaces; serve the equivalent path as well.
    const formLabel = row.label.replace(/ /g, '+');
    if (formLabel !== row.label) write(`catalog/movie/${CATALOG_ID}/genre=${formLabel}.json`, { metas });
    summary.rows.push({ id: row.id, label: row.label, count: metas.length, films: metas.slice(0, 6).map((x) => ({ id: x.id, name: x.name, poster: x.poster, year, runtime: x.runtime, genres: x.genres, imdbRating: x.imdbRating, ...details.get(x.id) })) });
    console.log(`${row.label}: ${metas.length} — ${metas.slice(0, 4).map((x) => x.name).join(', ')}`);
  }

  write('manifest.json', {
    id: 'community.rewindvideo',
    version: '1.3.1',
    name: 'Blockbuster Video',
    description: `A ${FIRST_YEAR}–${LAST_YEAR} video store in your Stremio. Every Monday the store jumps to a random year and restocks one Blockbuster Video catalogue. Use the genre dropdown in Discover to browse Biggest Hits, Best of the Year and eight genre aisles. Be kind, rewind. Unofficial fan project; film data from IMDb.`,
    logo: `${BASE}/logo.png`,
    background: `${BASE}/background.jpg`,
    resources: ['catalog'],
    types: ['movie'],
    idPrefixes: ['tt'],
    catalogs: [{
      type: 'movie',
      id: CATALOG_ID,
      name: 'Blockbuster Video',
      extra: [{ name: 'genre', isRequired: false, options: ROWS.map((r) => r.label), optionsLimit: 1 }],
    }],
  });
  write('summary.json', summary);
  console.log('Done.');
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
module.exports = { thisWeek, cycleOrder };
