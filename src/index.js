/***** CONFIG *****/
const WIP = { print: 2, audio: 2, family: 2 };
const NEXT_LIMIT = 5; // cap for Next queue
const LATER_LIMIT = 50; // display cap for Later

/***** helpers (ES5 + FP-leaning) *****/
const lower = s => String(s || "").toLowerCase();
const trim = s => String(s || "").replace(/^[ \t\r]+|[ \t\r]+$/g, "");
const startsWith = (s, pre) =>
  String(s).slice(0, String(pre || "").length) === String(pre || "");
const isDigit = ch => !!(ch && ch.length === 1 && ch >= "0" && ch <= "9");
const stripCodeFences = txt => {
  const lines = String(txt || "").split("\n");
  return lines
    .reduce(
      ([inCode, out], ln) => {
        const t = ln || "";
        if (startsWith(t, "```")) {
          return [!inCode, inCode ? out : out.concat([""])];
        }
        return inCode ? [inCode, out] : [inCode, out.concat([ln])];
      },
      [false, []]
    )[1]
    .join("\n");
};
const stripListMarker = s => {
  let t = s || "";
  let j = 0;
  while (j < t.length && isDigit(t[j])) j++;
  t = j > 0 && t[j] === "." && t[j + 1] === " " ? t.slice(j + 2) : t;
  t = startsWith(t, "- ") ? t.slice(2) : t;
  t = startsWith(t, "* ") ? t.slice(2) : t;
  return t;
};
const findTag = (tokens, prefix) =>
  (tokens.find(t => startsWith(t, prefix)) || "").slice(prefix.length);

const inlineField = (line, key) => {
  const lineStr = String(line || "");
  const i = lineStr.indexOf(key + "::");
  if (i === -1) return "";
  const tail = lineStr.slice(i + key.length + 2);
  const m = tail.match(/^\s*([^\s\t\r\n]+)/);
  return trim(m ? m[1] : "");
};

const extractTitle = body => {
  const bodyStr = String(body || "");
  const a = bodyStr.indexOf("[[");
  if (a >= 0) {
    const b = bodyStr.indexOf("]]", a + 2);
    if (b > a) {
      const content = bodyStr.slice(a + 2, b);
      const pipe = content.indexOf("|");
      return trim(pipe >= 0 ? content.slice(0, pipe) : content);
    }
  }
  const lb = lower(bodyStr);
  const cut = [bodyStr.indexOf(" #"), lb.indexOf(" by ")]
    .filter(i => i >= 0)
    .concat([bodyStr.length])
    .reduce((m, i) => Math.min(m, i), bodyStr.length);
  return trim(bodyStr.slice(0, cut));
};

const looksLikeBookLine = s => {
  const body = stripListMarker(trim(s || ""));
  return (
    !!body &&
    ((body.indexOf("[[") !== -1 && body.indexOf("]]") !== -1) ||
      body.indexOf(" #") !== -1 ||
      lower(body).indexOf(" by ") !== -1 ||
      body.indexOf("::") !== -1) // Support inline fields
  );
};

const statusFrom = line =>
  lower(inlineField(line, "status")) ||
  lower(findTag(String(line || "").split(" "), "#📚/status/")) ||
  "to-read";

const mediaFrom = line =>
  lower(inlineField(line, "media-type")) ||
  lower(inlineField(line, "slot")) ||
  lower(findTag(String(line || "").split(" "), "#media-type/")) ||
  lower(findTag(String(line || "").split(" "), "#slot/")) ||
  "print";

const scoreFrom = line => {
  const tagVal = findTag(String(line || "").split(" "), "#priority/");
  const n = tagVal ? +tagVal : +(inlineField(line, "priority") || NaN);
  return isNaN(n) ? 1 : Math.max(1, Math.min(5, Math.floor(n)));
};

const takeTop = (arr, n) => arr.slice(0, Math.max(0, n));
const sortByScoreDesc = arr => arr.slice().sort((a, b) => b.score - a.score);
const uniqByTitle = arr => {
  const seen = new Set();
  return arr.filter(x => !seen.has(x.title) && seen.add(x.title));
};

const linkOrText = title => {
  try {
    const p = dv.page(title);
    return p ? dv.fileLink(title) : title;
  } catch {
    return title;
  }
};

const renderTable = (cols, rows) =>
  rows.length ? dv.table(cols, rows) : dv.paragraph("_(none)_");

// Extracted common book processing logic
const processBooks = (dv, path, txt) => {
  const src = stripCodeFences(txt);
  const lines = src.split("\n");
  let section = "";

  const books = lines.reduce((acc, s) => {
    if (startsWith(s, "## ")) {
      section = trim(s.slice(3));
      return acc;
    }
    if (!looksLikeBookLine(s)) return acc;
    const body = stripListMarker(trim(s));
    const title = extractTitle(body);
    if (!title) return acc;

    const status = statusFrom(s);
    const media = mediaFrom(s);
    const score = scoreFrom(s);

    return acc.concat([{ title, status, media, score, section, note: path }]);
  }, []);

  dv.paragraph("Parsed books: " + books.length + " from " + path);

  /***** NOW (WIP): currently-reading, sorted by score desc per media type *****/
  const now = books.filter(b => b.status === "currently-reading");
  dv.header(2, "Currently Reading");
  ["print", "audio", "family"].forEach(mt => {
    const cap = WIP[mt] || 0;
    const rows = takeTop(
      sortByScoreDesc(now.filter(b => b.media === mt)),
      cap
    ).map(b => [linkOrText(b.title), String(b.score), b.media, b.section]);
    dv.header(3, mt + " — " + rows.length + "/" + cap);
    renderTable(["Book", "Priority", "Media Type", "Section"], rows);
  });

  /***** NEXT: up-next first (sorted), then top to-read (sorted) until NEXT_LIMIT *****/
  const upnext = sortByScoreDesc(books.filter(b => b.status === "up-next"));
  const toread = sortByScoreDesc(books.filter(b => b.status === "to-read"));
  const next = takeTop(
    upnext.concat(toread.filter(b => !upnext.some(u => u.title === b.title))),
    NEXT_LIMIT
  );
  dv.header(2, "Next (" + next.length + "/" + NEXT_LIMIT + ")");
  renderTable(
    ["Book", "Priority", "Media Type", "Section/Note"],
    next.map(b => [
      linkOrText(b.title),
      String(b.score),
      b.media,
      b.section || b.note,
    ])
  );

  /***** LATER: remaining to-read not in Next (sorted), limited *****/
  const nextTitles = next.map(b => b.title);
  const later = takeTop(
    sortByScoreDesc(
      uniqByTitle(toread.filter(b => nextTitles.indexOf(b.title) === -1))
    ),
    LATER_LIMIT
  );
  dv.header(2, "Later (" + later.length + " shown)");
  renderTable(
    ["Book", "Priority", "Media Type", "Section/Note"],
    later.map(b => [linkOrText(b.title), String(b.score), b.media, b.section])
  );
};

/***** Main script execution - assumes Obsidian DataView context *****/
// Main execution function that can be tested
const runMainExecution = dvObj => {
  if (typeof dvObj !== "undefined" && dvObj && dvObj.current) {
    const path = dvObj.current().file.path;
    dvObj.io
      .load(path)
      .then(txt => processBooks(dvObj, path, txt))
      .catch(err =>
        dvObj.paragraph("Load error: " + ((err && err.message) || err))
      );
  }
};

// Only execute if we're in Obsidian (dv is available)
if (typeof dv !== "undefined" && dv?.current) runMainExecution(dv);

/***** For testing only - executeScript function that uses provided dv *****/
const executeScript = dvObj => {
  if (!dvObj) return;
  const path = dvObj.current().file.path;
  return dvObj.io
    .load(path)
    .then(txt => processBooks(dvObj, path, txt))
    .catch(err =>
      dvObj.paragraph("Load error: " + ((err && err.message) || err))
    );
};

// Export functions for testing (CommonJS compatible)
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    // Configuration
    WIP,
    NEXT_LIMIT,
    LATER_LIMIT,

    // Helper functions
    lower,
    trim,
    startsWith,
    isDigit,
    stripCodeFences,
    stripListMarker,
    findTag,
    inlineField,
    extractTitle,
    looksLikeBookLine,
    statusFrom,
    mediaFrom,
    scoreFrom,
    takeTop,
    sortByScoreDesc,
    uniqByTitle,

    // Main execution functions
    executeScript,
    processBooks,
    linkOrText,
    renderTable,
    runMainExecution,
  };
}
