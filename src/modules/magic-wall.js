window.__minibiaBotBundle = window.__minibiaBotBundle || {};

window.__minibiaBotBundle.installMagicWallModule = function installMagicWallModule(bot) {
  const configStorageKey = "minibiaBot.magicWall.config";
  const overlayRootId = "minibia-bot-magic-wall-overlay";
  const overlayStyleId = "minibia-bot-magic-wall-overlay-style";

  const defaultPatternSpecs = [
    { name: "magic wall", durationMs: 20000, color: "#7ec8ff" },
    { name: "wild growth", durationMs: 30000, color: "#9be38c" },
  ];

  const state = {
    enabled: false,
    rafId: null,
    overlayTimerId: null,
    timers: new Map(),
    patches: null,
    alarmedFor: new Set(),
  };

  const config = Object.assign(
    {
      enabled: false,
      patternSpecs: defaultPatternSpecs.map((spec) => ({ ...spec })),
      audioOnExpiry: false,
      audioLeadMs: 3000,
      flashLeadMs: 3000,
      showFloorChanges: false,
    },
    bot.storage.get(configStorageKey, {})
  );

  if (!Array.isArray(config.patternSpecs) || !config.patternSpecs.length) {
    config.patternSpecs = defaultPatternSpecs.map((spec) => ({ ...spec }));
  }

  function persistConfig() {
    bot.storage.set(configStorageKey, { ...config });
  }

  function normalizeItemName(value) {
    return String(value || "").trim().toLowerCase();
  }

  function getItemName(item) {
    if (!item) return "";
    const defs =
      window.gameClient?.itemDefinitionsByCid ||
      window.gameClient?.itemDefinitions ||
      null;
    const def = defs ? defs[item.id] : null;
    return normalizeItemName(def?.properties?.name || item?.name);
  }

  function matchPatternSpec(itemName) {
    if (!itemName) return null;
    for (const spec of config.patternSpecs) {
      const needle = normalizeItemName(spec?.name);
      if (needle && itemName.includes(needle)) {
        return spec;
      }
    }
    return null;
  }

  function getTilePosition(tile) {
    const candidate =
      tile?.__position ||
      tile?.position ||
      (typeof tile?.getPosition === "function" ? tile.getPosition() : null);
    if (!candidate) return null;
    const x = Number(candidate.x);
    const y = Number(candidate.y);
    const z = Number(candidate.z);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      return null;
    }
    return { x: Math.trunc(x), y: Math.trunc(y), z: Math.trunc(z) };
  }

  function positionKey(position) {
    return position ? `${position.x},${position.y},${position.z}` : null;
  }

  function recordTimer(position, item, spec, now = Date.now()) {
    const key = positionKey(position);
    if (!key || !spec) return;

    const existing = state.timers.get(key);
    const durationMs = Math.max(1000, Math.trunc(Number(spec.durationMs) || 20000));
    if (existing && existing.expiresAt > now) {
      existing.expiresAt = now + durationMs;
      existing.spec = spec;
      existing.itemId = item?.id ?? existing.itemId;
      return;
    }

    state.timers.set(key, {
      position,
      itemId: item?.id ?? null,
      itemName: getItemName(item),
      spec,
      startedAt: now,
      expiresAt: now + durationMs,
    });
    state.alarmedFor.delete(key);
  }

  function clearExpired(now = Date.now()) {
    for (const [key, entry] of state.timers) {
      if (entry.expiresAt <= now) {
        state.timers.delete(key);
        state.alarmedFor.delete(key);
      }
    }
  }

  function handleAddItem(position, item) {
    if (!config.enabled || !position || !item) return;
    const itemName = getItemName(item);
    const spec = matchPatternSpec(itemName);
    if (!spec) return;
    const normalized = getTilePosition({ __position: position });
    if (!normalized) return;
    recordTimer(normalized, item, spec);
  }

  function handleRemovedTile(tile, index) {
    if (!state.timers.size) return;
    const tilePosition = getTilePosition(tile);
    const key = positionKey(tilePosition);
    if (!key || !state.timers.has(key)) return;
    const items = Array.isArray(tile?.items) ? tile.items : [];
    const remaining = items.filter((_, itemIndex) => itemIndex !== index);
    const stillThere = remaining.some((item) => !!matchPatternSpec(getItemName(item)));
    if (!stillThere) {
      state.timers.delete(key);
      state.alarmedFor.delete(key);
    }
  }

  function installPatches() {
    if (state.patches) return;

    const World = window.World?.prototype;
    const Tile = window.Tile?.prototype;
    if (!World || !Tile) {
      bot.log("magic wall: cannot install hooks, World/Tile prototypes unavailable");
      return;
    }

    const originalAddItem = World.addItem;
    const originalRemoveItem = Tile.removeItem;

    World.addItem = function patchedAddItem(position, item, slot) {
      const result = originalAddItem.call(this, position, item, slot);
      try {
        handleAddItem(position, item);
      } catch (error) {
        console.error("[minibia-bot] magic-wall addItem hook failed", error);
      }
      return result;
    };

    Tile.removeItem = function patchedRemoveItem(index, count) {
      let resolvedIndex = index;
      if (resolvedIndex === 0xFF) {
        resolvedIndex = Array.isArray(this.items) ? this.items.length - 1 : -1;
      }
      try {
        handleRemovedTile(this, resolvedIndex);
      } catch (error) {
        console.error("[minibia-bot] magic-wall removeItem hook failed", error);
      }
      return originalRemoveItem.call(this, index, count);
    };

    state.patches = { World, originalAddItem, Tile, originalRemoveItem };
  }

  function uninstallPatches() {
    if (!state.patches) return;
    const { World, originalAddItem, Tile, originalRemoveItem } = state.patches;
    if (World.addItem !== originalAddItem) World.addItem = originalAddItem;
    if (Tile.removeItem !== originalRemoveItem) Tile.removeItem = originalRemoveItem;
    state.patches = null;
  }

  function ensureOverlayStyle() {
    if (document.getElementById(overlayStyleId)) return;
    const style = document.createElement("style");
    style.id = overlayStyleId;
    style.textContent = `
      #${overlayRootId} {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 999996;
      }
      #${overlayRootId} canvas {
        position: fixed;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureOverlayRoot() {
    let root = document.getElementById(overlayRootId);
    if (root) return root;
    root = document.createElement("div");
    root.id = overlayRootId;
    root.innerHTML = '<canvas></canvas>';
    document.body.appendChild(root);
    return root;
  }

  function destroyOverlay() {
    document.getElementById(overlayRootId)?.remove();
    document.getElementById(overlayStyleId)?.remove();
  }

  function getGameViewport() {
    const canvas = window.gameClient?.renderer?.screen?.canvas;
    if (!(canvas instanceof HTMLCanvasElement)) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return { canvas, rect };
  }

  function getScalingVector() {
    const scaling = window.gameClient?.interface?.getSpriteScalingVector?.();
    if (scaling && Number.isFinite(scaling.x) && Number.isFinite(scaling.y) && scaling.x > 0 && scaling.y > 0) {
      return { x: scaling.x, y: scaling.y };
    }
    return { x: 32, y: 32 };
  }

  function getPlayerMoveOffset() {
    const offset = window.gameClient?.player?.getMoveOffset?.();
    if (offset && Number.isFinite(offset.x) && Number.isFinite(offset.y)) {
      return { x: offset.x, y: offset.y };
    }
    return { x: 0, y: 0 };
  }

  function worldToCanvasTile(position, playerPosition, moveOffset) {
    const tileX = 7 + moveOffset.x + (position.x - playerPosition.x);
    const tileY = 5 + moveOffset.y + (position.y - playerPosition.y);
    return { tileX, tileY };
  }

  function render() {
    const root = ensureOverlayRoot();
    const canvas = root.querySelector("canvas");
    if (!(canvas instanceof HTMLCanvasElement)) return;

    const viewport = getGameViewport();
    const playerPosition = window.gameClient?.player?.getPosition?.();

    if (!viewport || !playerPosition || !state.timers.size) {
      if (canvas.width !== 0) {
        canvas.width = 0;
        canvas.height = 0;
      }
      return;
    }

    const rect = viewport.rect;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    canvas.style.left = `${Math.round(rect.left)}px`;
    canvas.style.top = `${Math.round(rect.top)}px`;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);

    const internalWidth = Number(viewport.canvas.width) || 480;
    const internalHeight = Number(viewport.canvas.height) || 352;
    const scaling = getScalingVector();
    const moveOffset = getPlayerMoveOffset();
    const tilePixelWidth = scaling.x;
    const tilePixelHeight = scaling.y;
    const renderScaleX = width / internalWidth;
    const renderScaleY = height / internalHeight;
    const now = Date.now();

    context.save();
    context.font = "bold 14px Verdana, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.lineWidth = 3;

    for (const entry of state.timers.values()) {
      if (entry.position.z !== playerPosition.z && !config.showFloorChanges) continue;

      const { tileX, tileY } = worldToCanvasTile(entry.position, playerPosition, moveOffset);
      if (tileX < -1 || tileX > 16 || tileY < -1 || tileY > 12) continue;

      const internalCenterX = (tileX + 0.5) * tilePixelWidth;
      const internalCenterY = (tileY + 0.5) * tilePixelHeight;
      const cx = internalCenterX * renderScaleX;
      const cy = internalCenterY * renderScaleY;
      const remainingMs = Math.max(0, entry.expiresAt - now);
      const secondsLeft = Math.ceil(remainingMs / 1000);
      const isExpiring = remainingMs <= Math.max(0, Number(config.flashLeadMs) || 0);
      const flashOn = isExpiring && Math.floor(now / 250) % 2 === 0;
      const color = isExpiring && flashOn ? "#ff4d4d" : (entry.spec?.color || "#7ec8ff");

      const radius = 16 * Math.min(renderScaleX, renderScaleY);
      context.beginPath();
      context.arc(cx, cy, radius, 0, Math.PI * 2);
      context.fillStyle = "rgba(0, 0, 0, 0.55)";
      context.fill();
      context.strokeStyle = color;
      context.stroke();

      context.fillStyle = color;
      context.fillText(String(secondsLeft), cx, cy);
    }

    context.restore();

    if (config.audioOnExpiry && Number.isFinite(config.audioLeadMs)) {
      for (const [key, entry] of state.timers) {
        const lead = Math.max(0, Number(config.audioLeadMs) || 0);
        if (entry.expiresAt - now <= lead && !state.alarmedFor.has(key)) {
          state.alarmedFor.add(key);
          bot.playAlarm?.();
        }
      }
    }
  }

  function tickOverlay() {
    try {
      clearExpired();
      render();
    } catch (error) {
      console.error("[minibia-bot] magic-wall render failed", error);
    }
  }

  function startOverlay() {
    if (state.overlayTimerId != null) return;
    ensureOverlayStyle();
    tickOverlay();
    state.overlayTimerId = window.setInterval(tickOverlay, 200);
  }

  function stopOverlay() {
    if (state.overlayTimerId != null) {
      window.clearInterval(state.overlayTimerId);
      state.overlayTimerId = null;
    }
    destroyOverlay();
  }

  function start(overrides = {}) {
    Object.assign(config, overrides, { enabled: true });
    persistConfig();
    if (state.enabled) {
      bot.log("magic wall timer already running");
      return false;
    }
    state.enabled = true;
    installPatches();
    startOverlay();
    bot.log("magic wall timer started", { patternSpecs: config.patternSpecs });
    return true;
  }

  function stop(options = {}) {
    const persistEnabled = options.persistEnabled !== false;
    state.enabled = false;
    stopOverlay();
    uninstallPatches();
    state.timers.clear();
    state.alarmedFor.clear();
    if (persistEnabled) {
      config.enabled = false;
      persistConfig();
    }
    bot.log("magic wall timer stopped");
    return true;
  }

  function clear() {
    state.timers.clear();
    state.alarmedFor.clear();
    return true;
  }

  function list() {
    const now = Date.now();
    return Array.from(state.timers.values()).map((entry) => ({
      position: { ...entry.position },
      itemId: entry.itemId,
      itemName: entry.itemName,
      remainingMs: Math.max(0, entry.expiresAt - now),
      expiresAt: entry.expiresAt,
      durationMs: entry.expiresAt - entry.startedAt,
      spec: entry.spec ? { ...entry.spec } : null,
    }));
  }

  function status() {
    return {
      running: state.enabled,
      config: { ...config },
      timers: list(),
    };
  }

  function updateConfig(nextConfig = {}) {
    if (Array.isArray(nextConfig.patternSpecs)) {
      nextConfig.patternSpecs = nextConfig.patternSpecs
        .map((spec) => spec && typeof spec === "object" ? { ...spec } : null)
        .filter(Boolean);
      if (!nextConfig.patternSpecs.length) {
        delete nextConfig.patternSpecs;
      }
    }
    Object.assign(config, nextConfig);
    persistConfig();
    bot.log("magic wall config updated", { ...config });
    return { ...config };
  }

  bot.addCleanup(() => {
    stopOverlay();
    uninstallPatches();
    state.timers.clear();
  });

  if (config.enabled) {
    start();
  }

  bot.magicWall = {
    start,
    stop,
    status,
    list,
    clear,
    updateConfig,
    config,
  };
};
