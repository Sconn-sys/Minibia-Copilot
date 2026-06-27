window.__minibiaCopilotBundle = window.__minibiaCopilotBundle || {};

window.__minibiaCopilotBundle.installTrackerModule = function installTrackerModule(bot) {
  const configStorageKey = "minibiaCopilot.tracker.config";
  const deathsStorageKey = "minibiaCopilot.tracker.deaths";
  const trackedStorageKey = "minibiaCopilot.tracker.tracked";
  const seenDeathsStorageKey = "minibiaCopilot.tracker.seenDeathKeys";

  const state = {
    running: false,
    pollTimerId: null,
    expireTimerId: null,
    lastPollAt: 0,
    lastOnlineSet: new Set(),
    lastError: null,
    pollInFlight: false,
  };

  const config = Object.assign(
    {
      pollIntervalMs: 120000,
      retentionMs: 30 * 60 * 1000,
      onlineUrl: "/online.html",
      characterUrlTemplate: "/character.html?name={name}",
      enabled: false,
    },
    bot.storage.get(configStorageKey, {})
  );

  let trackedNames = normalizeTrackedNames(bot.storage.get(trackedStorageKey, []));
  let recentDeaths = normalizeDeathRecords(bot.storage.get(deathsStorageKey, []));
  let seenDeathKeys = new Set(bot.storage.get(seenDeathsStorageKey, []) || []);

  function normalizeName(value) {
    return String(value || "").trim();
  }

  function normalizeKey(value) {
    return normalizeName(value).toLowerCase();
  }

  function normalizeTrackedNames(value) {
    const list = Array.isArray(value) ? value : [];
    const dedup = new Map();
    list.forEach((entry) => {
      const name = normalizeName(entry);
      const key = normalizeKey(name);
      if (key) dedup.set(key, name);
    });
    return Array.from(dedup.values());
  }

  function normalizeDeathRecords(value) {
    if (!Array.isArray(value)) return [];
    return value
      .map((entry) => {
        if (!entry) return null;
        const name = normalizeName(entry.name);
        const at = Number(entry.at);
        if (!name || !Number.isFinite(at)) return null;
        return {
          name,
          at,
          level: entry.level ?? null,
          description: String(entry.description || ""),
          dedupKey: String(entry.dedupKey || ""),
        };
      })
      .filter(Boolean);
  }

  function persistConfig() {
    bot.storage.set(configStorageKey, { ...config });
  }
  function persistTracked() {
    bot.storage.set(trackedStorageKey, trackedNames);
  }
  function persistDeaths() {
    bot.storage.set(deathsStorageKey, recentDeaths);
  }
  function persistSeenDeathKeys() {
    bot.storage.set(seenDeathsStorageKey, Array.from(seenDeathKeys));
  }

  function expireOldDeaths(now = Date.now()) {
    const cutoff = now - Math.max(60000, Number(config.retentionMs) || 1800000);
    const next = recentDeaths.filter((entry) => entry.at >= cutoff);
    if (next.length !== recentDeaths.length) {
      recentDeaths = next;
      persistDeaths();
      const keep = new Set(next.map((d) => d.dedupKey).filter(Boolean));
      const newSeen = new Set();
      seenDeathKeys.forEach((key) => {
        if (keep.has(key)) newSeen.add(key);
      });
      if (newSeen.size !== seenDeathKeys.size) {
        seenDeathKeys = newSeen;
        persistSeenDeathKeys();
      }
      try { bot.ui?.refreshTrackerStatus?.(); } catch (error) {}
    }
  }

  function buildCharacterUrl(name) {
    const template = String(config.characterUrlTemplate || "/character.html?name={name}");
    return template.replace("{name}", encodeURIComponent(name));
  }

  async function fetchHtml(url) {
    const response = await fetch(url, {
      credentials: "include",
      headers: { "Accept": "text/html" },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} fetching ${url}`);
    }
    return response.text();
  }

  function parseHtml(html) {
    try {
      const parser = new DOMParser();
      return parser.parseFromString(html, "text/html");
    } catch (error) {
      return null;
    }
  }

  function extractOnlineNames(doc) {
    if (!doc) return new Set();
    const names = new Set();
    const anchors = doc.querySelectorAll('a[href*="character.html"]');
    anchors.forEach((anchor) => {
      const href = anchor.getAttribute("href") || "";
      const match = href.match(/[?&]name=([^&#]+)/i);
      const name = match
        ? decodeURIComponent(match[1].replace(/\+/g, " ")).trim()
        : (anchor.textContent || "").trim();
      if (name) names.add(name);
    });
    return names;
  }

  function parseDeathDate(raw) {
    if (!raw) return null;
    const direct = Date.parse(raw);
    if (Number.isFinite(direct)) return direct;
    const isoLike = String(raw).trim().replace(/(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}(:\d{2})?)/, "$1T$2");
    const second = Date.parse(isoLike);
    if (Number.isFinite(second)) return second;
    const monthMatch = String(raw).match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})[ ,]+(\d{1,2}):(\d{2})/);
    if (monthMatch) {
      const probe = Date.parse(`${monthMatch[2]} ${monthMatch[1]} ${monthMatch[3]} ${monthMatch[4]}:${monthMatch[5]}`);
      if (Number.isFinite(probe)) return probe;
    }
    return null;
  }

  function extractCharacterDeaths(doc, name) {
    if (!doc) return [];
    const lowerName = name.toLowerCase();
    const deaths = [];

    const rows = doc.querySelectorAll("tr, li, .death, .death-entry, [data-death]");
    rows.forEach((row) => {
      const text = (row.textContent || "").replace(/\s+/g, " ").trim();
      if (!text) return;

      if (!/(died|killed by|slain|death)/i.test(text)) {
        if (!/\b\d{4}-\d{2}-\d{2}\b/.test(text) && !/\b\d{1,2}\s+\w+\s+\d{4}\b/.test(text)) {
          return;
        }
      }

      let at = null;
      const cells = row.querySelectorAll("td, span, time, .death-date, [data-date]");
      cells.forEach((cell) => {
        if (at != null) return;
        const candidate = cell.getAttribute?.("datetime") || cell.getAttribute?.("data-date") || cell.textContent;
        const parsed = parseDeathDate(candidate);
        if (parsed != null) at = parsed;
      });
      if (at == null) {
        const dateGuess = text.match(/(\d{4}-\d{2}-\d{2}[ T]\d{1,2}:\d{2}(?::\d{2})?)|(\d{1,2}\s+[A-Za-z]+\s+\d{4}[,\s]+\d{1,2}:\d{2})/);
        if (dateGuess) at = parseDeathDate(dateGuess[0]);
      }
      if (at == null) return;

      const levelMatch = text.match(/(?:level|lvl)\s*[:\-]?\s*(\d+)/i);
      const level = levelMatch ? Number(levelMatch[1]) : null;

      let description = text;
      const colonIndex = text.indexOf(",");
      if (colonIndex > 0 && colonIndex < 60) description = text.slice(colonIndex + 1).trim();
      if (description.length > 240) description = description.slice(0, 240) + "…";

      const dedupKey = `${lowerName}|${at}|${description.slice(0, 60).toLowerCase()}`;
      deaths.push({ name, at, level, description, dedupKey });
    });

    const dedup = new Map();
    deaths.forEach((entry) => {
      if (!dedup.has(entry.dedupKey)) dedup.set(entry.dedupKey, entry);
    });
    return Array.from(dedup.values()).sort((a, b) => a.at - b.at);
  }

  async function pollOnce(now = Date.now()) {
    if (state.pollInFlight) return false;
    state.pollInFlight = true;

    try {
      const onlineHtml = await fetchHtml(config.onlineUrl);
      const onlineDoc = parseHtml(onlineHtml);
      const onlineNames = extractOnlineNames(onlineDoc);

      const onlineKeys = new Set();
      onlineNames.forEach((n) => onlineKeys.add(normalizeKey(n)));
      state.lastOnlineSet = onlineKeys;

      const cutoff = now - Math.max(60000, Number(config.retentionMs) || 1800000);
      let appended = 0;

      for (const trackedName of trackedNames) {
        const key = normalizeKey(trackedName);
        if (!onlineKeys.has(key)) continue;

        try {
          const charHtml = await fetchHtml(buildCharacterUrl(trackedName));
          const charDoc = parseHtml(charHtml);
          const deaths = extractCharacterDeaths(charDoc, trackedName);
          for (const death of deaths) {
            if (death.at < cutoff) continue;
            if (seenDeathKeys.has(death.dedupKey)) continue;
            seenDeathKeys.add(death.dedupKey);
            recentDeaths.push(death);
            appended += 1;
            bot.log("tracker: new death observed", {
              name: death.name,
              at: new Date(death.at).toISOString(),
              level: death.level,
              description: death.description.slice(0, 80),
            });
          }
        } catch (error) {
          bot.log("tracker: character fetch failed", {
            name: trackedName,
            error: error?.message || String(error),
          });
        }
      }

      if (appended > 0) {
        recentDeaths.sort((a, b) => a.at - b.at);
        persistDeaths();
        persistSeenDeathKeys();
      }

      state.lastPollAt = now;
      state.lastError = null;
      expireOldDeaths(now);
      try { bot.ui?.refreshTrackerStatus?.(); } catch (error) {}
      return true;
    } catch (error) {
      state.lastError = error?.message || String(error);
      bot.log("tracker: poll failed", { error: state.lastError });
      try { bot.ui?.refreshTrackerStatus?.(); } catch (error2) {}
      return false;
    } finally {
      state.pollInFlight = false;
    }
  }

  function schedulePoll() {
    stopPollTimer();
    if (!state.running) return;
    const interval = Math.max(30000, Math.min(600000, Number(config.pollIntervalMs) || 120000));
    state.pollTimerId = window.setInterval(() => {
      pollOnce().catch((error) => {
        bot.log("tracker: poll exception", error?.message || error);
      });
    }, interval);
  }

  function stopPollTimer() {
    if (state.pollTimerId != null) {
      window.clearInterval(state.pollTimerId);
      state.pollTimerId = null;
    }
  }

  function startExpireTimer() {
    if (state.expireTimerId != null) return;
    state.expireTimerId = window.setInterval(() => expireOldDeaths(), 30000);
  }

  function stopExpireTimer() {
    if (state.expireTimerId != null) {
      window.clearInterval(state.expireTimerId);
      state.expireTimerId = null;
    }
  }

  function start(overrides = {}) {
    Object.assign(config, overrides);
    config.enabled = true;
    persistConfig();
    if (state.running) {
      bot.log("tracker already running");
      return false;
    }
    state.running = true;
    schedulePoll();
    startExpireTimer();
    pollOnce().catch(() => {});
    bot.log("tracker started", {
      pollIntervalMs: config.pollIntervalMs,
      retentionMs: config.retentionMs,
      tracked: trackedNames.length,
    });
    return true;
  }

  function stop(options = {}) {
    const persistEnabled = options.persistEnabled !== false;
    state.running = false;
    stopPollTimer();
    stopExpireTimer();
    if (persistEnabled) {
      config.enabled = false;
      persistConfig();
    }
    bot.log("tracker stopped");
    return true;
  }

  function addTracked(name) {
    const normalized = normalizeName(name);
    if (!normalized) return null;
    const key = normalizeKey(normalized);
    if (trackedNames.some((n) => normalizeKey(n) === key)) return null;
    trackedNames.push(normalized);
    persistTracked();
    bot.log("tracker: added", { name: normalized });
    if (state.running) pollOnce().catch(() => {});
    try { bot.ui?.refreshTrackerStatus?.(); } catch (error) {}
    return normalized;
  }

  function removeTracked(name) {
    const key = normalizeKey(name);
    const before = trackedNames.length;
    trackedNames = trackedNames.filter((n) => normalizeKey(n) !== key);
    if (before === trackedNames.length) return false;
    persistTracked();
    bot.log("tracker: removed", { name });
    try { bot.ui?.refreshTrackerStatus?.(); } catch (error) {}
    return true;
  }

  function getTrackedNames() {
    return trackedNames.slice();
  }

  function isOnline(name) {
    return state.lastOnlineSet.has(normalizeKey(name));
  }

  function getRecentDeaths(now = Date.now()) {
    expireOldDeaths(now);
    return recentDeaths.slice().sort((a, b) => b.at - a.at);
  }

  function status() {
    return {
      running: state.running,
      config: { ...config },
      tracked: trackedNames.slice(),
      online: trackedNames.filter((n) => isOnline(n)),
      offline: trackedNames.filter((n) => !isOnline(n)),
      recentDeaths: getRecentDeaths(),
      lastPollAt: state.lastPollAt,
      lastError: state.lastError,
      pollInFlight: state.pollInFlight,
      onlineCount: state.lastOnlineSet.size,
    };
  }

  function updateConfig(nextConfig = {}) {
    Object.assign(config, nextConfig);
    persistConfig();
    if (state.running) schedulePoll();
    bot.log("tracker config updated", { ...config });
    return { ...config };
  }

  async function debugFetch(name) {
    const url = name ? buildCharacterUrl(name) : config.onlineUrl;
    try {
      const html = await fetchHtml(url);
      const doc = parseHtml(html);
      const meta = {
        url,
        htmlLength: html.length,
        documentTitle: doc?.title || null,
        sample: html.slice(0, 800),
      };
      if (!name) {
        const names = Array.from(extractOnlineNames(doc));
        return { ...meta, onlineSample: names.slice(0, 20), onlineCount: names.length };
      }
      return { ...meta, deaths: extractCharacterDeaths(doc, name) };
    } catch (error) {
      return { url, error: error?.message || String(error) };
    }
  }

  function clearDeaths() {
    recentDeaths = [];
    seenDeathKeys.clear();
    persistDeaths();
    persistSeenDeathKeys();
    try { bot.ui?.refreshTrackerStatus?.(); } catch (error) {}
    return true;
  }

  bot.addCleanup(() => {
    stopPollTimer();
    stopExpireTimer();
  });

  if (config.enabled) start();

  bot.tracker = {
    start,
    stop,
    status,
    updateConfig,
    addTracked,
    removeTracked,
    getTrackedNames,
    isOnline,
    getRecentDeaths,
    pollOnce: () => pollOnce(),
    debugFetch,
    clearDeaths,
    config,
  };
};
