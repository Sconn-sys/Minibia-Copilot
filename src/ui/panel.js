window.__minibiaCopilotBundle = window.__minibiaCopilotBundle || {};

window.__minibiaCopilotBundle.installPanel = function installPanel(bot) {
  const panelPositionKey = "minibiaCopilot.ui.panelPosition";
  const panelCollapsedKey = "minibiaCopilot.ui.panelCollapsed";

  function destroy() {
    document.getElementById("minibia-copilot-panel")?.remove();
    document.getElementById("minibia-copilot-style")?.remove();
  }

  function savePanelPosition(position, key = panelPositionKey) {
    bot.storage.set(key, position);
  }

  function getSavedPanelPosition(key = panelPositionKey) {
    return bot.storage.get(key, null);
  }

  function savePanelCollapsed(collapsed) {
    bot.storage.set(panelCollapsedKey, !!collapsed);
  }

  function getSavedPanelCollapsed() {
    return !!bot.storage.get(panelCollapsedKey, false);
  }

  function refreshHomeLabel() {
    const homeLabel = document.getElementById("minibia-copilot-home");
    if (!homeLabel) return;

    const home = bot.pz?.getHomePz?.();
    homeLabel.textContent = home
      ? `Panic Runner Home: ${home.x}, ${home.y}, ${home.z}`
      : "Panic Runner Home: not set";
  }

  function refreshPanicStatus() {
    const unknownToggle = document.getElementById("minibia-copilot-panic-unknown");
    const healthToggle = document.getElementById("minibia-copilot-panic-health");
    const returnToggle = document.getElementById("minibia-copilot-panic-return");
    const status = bot.panic?.status?.();

    if (unknownToggle) {
      unknownToggle.checked = !!status?.config?.unknownPlayerEnabled;
    }

    if (healthToggle) {
      healthToggle.checked = !!status?.config?.healthLossEnabled;
    }

    if (returnToggle) {
      returnToggle.checked = !!status?.config?.returnToOriginEnabled;
    }
  }

  function refreshXrayStatus() {
    const status = bot.xray?.status?.();
    const me = bot.getPlayerPosition?.();
    const overlayButton = document.getElementById("minibia-copilot-xray-overlay-toggle");
    const overlayLabel = document.getElementById("minibia-copilot-xray-overlay-status");
    const floorSelect = document.getElementById("minibia-copilot-xray-floor-select");
    const formatFloorOffset = (floor) => {
      if (!me || floor == null) {
        return null;
      }

      const offset = me.z - floor;
      return offset === 0 ? "0" : offset > 0 ? `+${offset}` : `${offset}`;
    };

    if (overlayButton) {
      overlayButton.textContent = status?.config?.overlayEnabled ? "Disable Overlay" : "Enable Overlay";
    }

    if (overlayLabel) {
      const floorLabel = status?.config?.selectedFloor == null
        ? "all floors"
        : `${formatFloorOffset(status.config.selectedFloor) ?? "?"}`;
      overlayLabel.textContent = `${status?.config?.overlayEnabled ? "Overlay: on" : "Overlay: off"} • ${floorLabel}`;
    }

    if (floorSelect) {
      const floors = Array.from(
        new Set(
          (status?.visibleCreatures || [])
            .map((creature) => creature?.position?.z)
            .filter((floor) => floor != null)
        )
      ).sort((a, b) => a - b);
      const selectedFloor = status?.config?.selectedFloor;

      if (selectedFloor != null && !floors.includes(selectedFloor)) {
        floors.push(selectedFloor);
        floors.sort((a, b) => a - b);
      }

      floorSelect.innerHTML = "";

      const allOption = document.createElement("option");
      allOption.value = "all";
      allOption.textContent = "All floors";
      floorSelect.appendChild(allOption);

      floors.forEach((floor) => {
        const option = document.createElement("option");
        option.value = String(floor);
        const offsetLabel = formatFloorOffset(floor);
        option.textContent = offsetLabel == null
          ? String(floor)
          : offsetLabel;
        floorSelect.appendChild(option);
      });

      floorSelect.value = selectedFloor == null ? "all" : String(selectedFloor);
    }
  }

  function renderTrustedNames() {
    const list = document.getElementById("minibia-copilot-panic-trusted-list");
    if (!list) return;

    const trustedNames = bot.panic?.config?.trustedNames || [];
    list.innerHTML = "";

    if (!trustedNames.length) {
      const empty = document.createElement("div");
      empty.className = "mc-small-note";
      empty.textContent = "No trusted names saved.";
      list.appendChild(empty);
      return;
    }

    trustedNames.forEach((name, index) => {
      const row = document.createElement("div");
      row.className = "mc-list-row";

      const label = document.createElement("span");
      label.textContent = name;

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "mc-small-button";
      removeButton.textContent = "Remove";
      removeButton.addEventListener("click", () => {
        const nextNames = trustedNames.filter((_, currentIndex) => currentIndex !== index);
        bot.panic.updateConfig({ trustedNames: nextNames });
        renderTrustedNames();
      });

      row.appendChild(label);
      row.appendChild(removeButton);
      list.appendChild(row);
    });
  }

  function renderGameMasterNames() {
    const list = document.getElementById("minibia-copilot-panic-gm-list");
    if (!list) return;

    const gameMasterNames = bot.panic?.config?.gameMasterNames || [];
    list.innerHTML = "";

    if (!gameMasterNames.length) {
      const empty = document.createElement("div");
      empty.className = "mc-small-note";
      empty.textContent = "No game master names saved.";
      list.appendChild(empty);
      return;
    }

    gameMasterNames.forEach((name, index) => {
      const row = document.createElement("div");
      row.className = "mc-list-row";

      const label = document.createElement("span");
      label.textContent = name;

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "mc-small-button";
      removeButton.textContent = "Remove";
      removeButton.addEventListener("click", () => {
        const nextNames = gameMasterNames.filter((_, currentIndex) => currentIndex !== index);
        bot.panic.updateConfig({ gameMasterNames: nextNames });
        renderGameMasterNames();
      });

      row.appendChild(label);
      row.appendChild(removeButton);
      list.appendChild(row);
    });
  }

  function refreshRuneStatus() {
    const runeToggle = document.getElementById("minibia-copilot-rune-enabled");
    const running = !!bot.rune?.status?.().running;

    if (runeToggle) {
      runeToggle.checked = running;
    }
  }

  function refreshAutoEatStatus() {
    const autoEatToggle = document.getElementById("minibia-copilot-auto-eat-enabled");
    if (!autoEatToggle) return;

    autoEatToggle.checked = !!bot.eat?.status?.().running;
  }

  function refreshAutoHealStatus() {
    const autoHealToggle = document.getElementById("minibia-copilot-auto-heal-enabled");
    if (!autoHealToggle) return;

    autoHealToggle.checked = !!bot.heal?.status?.().running;
  }

  function refreshAutoInvisibleStatus() {
    const autoInvisibleToggle = document.getElementById("minibia-copilot-auto-invisible-enabled");
    if (!autoInvisibleToggle) return;

    autoInvisibleToggle.checked = !!bot.invisible?.status?.().running;
  }

  function refreshAutoMagicShieldStatus() {
    const autoMagicShieldToggle = document.getElementById("minibia-copilot-auto-magic-shield-enabled");
    if (!autoMagicShieldToggle) return;

    autoMagicShieldToggle.checked = !!bot.magicShield?.status?.().running;
  }

  function refreshAutoAttackStatus() {
    const autoAttackToggle = document.getElementById("minibia-copilot-auto-attack-enabled");
    if (!autoAttackToggle) return;

    autoAttackToggle.checked = !!bot.attack?.status?.().running;
  }

  function refreshCaveStatus() {
    const statusLabel = document.getElementById("minibia-copilot-cave-status");
    const startButton = document.getElementById("minibia-copilot-cave-start");
    const stopButton = document.getElementById("minibia-copilot-cave-stop");
    const route = bot.cave?.getRoute?.() || [];
    const status = bot.cave?.status?.();

    if (statusLabel) {
      if (!route.length) {
        statusLabel.textContent = "Status: no waypoints";
      } else if (status?.running) {
        const waypointNumber = (status.currentIndex ?? 0) + 1;
        const distanceLabel =
          Number.isFinite(status?.distanceToWaypoint) && status.distanceToWaypoint >= 0
            ? `, dist ${status.distanceToWaypoint}`
            : "";
        statusLabel.textContent = `Status: running (${waypointNumber}/${route.length}${distanceLabel})`;
      } else {
        statusLabel.textContent = `Status: idle (${route.length} waypoint${route.length === 1 ? "" : "s"})`;
      }
    }

    if (startButton) {
      startButton.disabled = !route.length || !!status?.running;
    }

    if (stopButton) {
      stopButton.disabled = !status?.running;
    }
  }

  function refreshCavePresetControls() {
    const select = document.getElementById("minibia-copilot-cave-preset-select");
    const label = document.getElementById("minibia-copilot-cave-preset-status");
    const deleteButton = document.getElementById("minibia-copilot-cave-preset-delete");
    const status = bot.cave?.status?.();
    const presetNames = status?.presetNames || bot.cave?.getPresetNames?.() || [];
    const activePresetName = status?.activePresetName || bot.cave?.getActivePresetName?.() || "Default";

    if (select) {
      const previousValue = select.value;
      select.innerHTML = "";

      if (!presetNames.length) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "No saved presets";
        select.appendChild(option);
        select.disabled = true;
      } else {
        presetNames.forEach((name) => {
          const option = document.createElement("option");
          option.value = name;
          option.textContent = name;
          select.appendChild(option);
        });
        select.disabled = false;
        const nextValue = presetNames.includes(activePresetName) ? activePresetName : previousValue;
        if (nextValue) {
          select.value = nextValue;
        }
      }
    }

    if (label) {
      label.textContent = presetNames.length
        ? `Preset: ${activePresetName} (${presetNames.length} saved)`
        : `Preset: ${activePresetName}`;
    }

    if (deleteButton) {
      deleteButton.disabled = !presetNames.length || !select?.value;
    }
  }

  function refreshCaveClosestStatus() {
    const label = document.getElementById("minibia-copilot-cave-closest");
    if (!label) return;

    const position = bot.getPlayerPosition?.();
    const route = bot.cave?.getRoute?.() || [];

    if (!position) {
      label.textContent = "Closest start: current position unavailable";
      return;
    }

    if (!route.length) {
      label.textContent = "Closest start: no waypoints";
      return;
    }

    const closestIndex = bot.cave?.findClosestWaypointIndex?.(position) ?? 0;
    const waypoint = route[closestIndex];

    if (!waypoint) {
      label.textContent = "Closest start: unavailable";
      return;
    }

    label.textContent = `Closest start: ${closestIndex + 1}. ${waypoint.x}, ${waypoint.y}, ${waypoint.z}`;
  }

  function refreshCaveTransitionStatus() {
    const label = document.getElementById("minibia-copilot-cave-transition-status");
    if (!label) return;

    const transitions = bot.cave?.getTransitions?.() || [];
    if (!transitions.length) {
      label.textContent = "Transitions learned: none";
      return;
    }

    const latest = transitions
      .slice()
      .sort((a, b) => Number(b?.lastSeenAt || 0) - Number(a?.lastSeenAt || 0))[0];

    if (!latest?.from || !latest?.to) {
      label.textContent = `Transitions learned: ${transitions.length}`;
      return;
    }

    const extra = transitions.length > 1 ? ` (+${transitions.length - 1} more)` : "";
    label.textContent =
      `Transitions learned: ${latest.from.x}, ${latest.from.y}, ${latest.from.z} -> ` +
      `${latest.to.x}, ${latest.to.y}, ${latest.to.z}${extra}`;
  }

  function refreshEquipRingStatus() {
    const equipRingToggle = document.getElementById("minibia-copilot-equip-ring-enabled");
    if (!equipRingToggle) return;

    equipRingToggle.checked = !!bot.equipRing?.status?.().running;
  }

  function refreshMagicWallStatus() {
    const enabledInput = document.getElementById("minibia-copilot-magic-wall-enabled");
    const audioInput = document.getElementById("minibia-copilot-magic-wall-audio");
    const durationInput = document.getElementById("minibia-copilot-magic-wall-duration");
    const leadInput = document.getElementById("minibia-copilot-magic-wall-lead");
    const statusLabel = document.getElementById("minibia-copilot-magic-wall-status");
    const status = bot.magicWall?.status?.();

    if (enabledInput) {
      enabledInput.checked = !!status?.running;
    }
    if (audioInput) {
      audioInput.checked = !!status?.config?.audioOnExpiry;
    }
    if (durationInput && document.activeElement !== durationInput) {
      const primary = status?.config?.patternSpecs?.find((spec) =>
        String(spec?.name || "").toLowerCase().includes("magic wall")
      );
      const seconds = primary ? Math.round((Number(primary.durationMs) || 20000) / 1000) : 20;
      durationInput.value = String(seconds);
    }
    if (leadInput && document.activeElement !== leadInput) {
      const lead = Math.round((Number(status?.config?.flashLeadMs) || 3000) / 1000);
      leadInput.value = String(lead);
    }
    if (statusLabel) {
      const activeCount = Array.isArray(status?.timers) ? status.timers.length : 0;
      if (!status?.running) {
        statusLabel.textContent = "Status: idle";
      } else if (activeCount === 0) {
        statusLabel.textContent = "Status: watching";
      } else {
        statusLabel.textContent = `Status: ${activeCount} active`;
      }
    }
  }

  function refreshTalkStatus() {
    const talkToggle = document.getElementById("minibia-copilot-talk-enabled");
    const statusLabel = document.getElementById("minibia-copilot-talk-status");
    const status = bot.talk?.status?.();

    if (talkToggle) {
      talkToggle.checked = !!status?.running;
    }

    if (statusLabel) {
      if (!status?.config?.apiKey) {
        statusLabel.textContent = "Status: API key missing";
      } else if (status?.pending) {
        statusLabel.textContent = "Status: generating";
      } else if (status?.running) {
        statusLabel.textContent = "Status: listening to Default";
      } else {
        statusLabel.textContent = "Status: idle";
      }
    }
  }

  function refreshVisibleCreatures() {
    const list = document.getElementById("minibia-copilot-visible-creatures-list");
    if (!list) return;

    const me = bot.getPlayerPosition?.();
    const status = bot.xray?.status?.();
    const creatures = status?.visibleCreatures || [];
    const selectedFloor = status?.config?.selectedFloor;
    list.innerHTML = "";

    if (!me) {
      const empty = document.createElement("div");
      empty.className = "mc-small-note";
      empty.textContent = "Current position unavailable.";
      list.appendChild(empty);
      return;
    }

    const getFloorOffset = (creature) => (creature.position?.z || 0) - me.z;
    const getFloorDistance = (creature) => Math.abs(getFloorOffset(creature));

    const visibleCreatures = creatures
      .filter((creature) => {
        const floor = creature?.position?.z;
        if (floor == null) {
          return false;
        }

        if (selectedFloor != null) {
          return floor === selectedFloor;
        }

        return floor !== me.z;
      })
      .sort((a, b) => {
      const floorDistanceDiff = getFloorDistance(a) - getFloorDistance(b);
      if (floorDistanceDiff !== 0) return floorDistanceDiff;

      const floorOffsetDiff = getFloorOffset(a) - getFloorOffset(b);
      if (floorOffsetDiff !== 0) return floorOffsetDiff;

      const aDist = Math.abs((a.position?.x || 0) - me.x) + Math.abs((a.position?.y || 0) - me.y);
      const bDist = Math.abs((b.position?.x || 0) - me.x) + Math.abs((b.position?.y || 0) - me.y);
      return aDist - bDist;
    });

    if (!visibleCreatures.length) {
      const empty = document.createElement("div");
      empty.className = "mc-small-note";
      empty.textContent = selectedFloor == null
        ? "No off-floor creatures."
        : `No creatures on floor ${selectedFloor}.`;
      list.appendChild(empty);
      return;
    }

    let currentFloor = null;

    visibleCreatures.forEach((creature) => {
      const floor = creature.position?.z;
      if (floor !== currentFloor) {
        currentFloor = floor;
        const floorOffset = me.z - floor;
        const floorOffsetLabel =
          floorOffset === 0 ? "0" : floorOffset > 0 ? `+${floorOffset}` : `${floorOffset}`;

        const floorLabel = document.createElement("div");
        floorLabel.className = "mc-floor-label";
        floorLabel.textContent = floorOffsetLabel;
        list.appendChild(floorLabel);
      }

      const row = document.createElement("div");
      row.className = "mc-creature-row";

      const name = document.createElement("div");
      name.className = "mc-creature-name";
      name.textContent = creature.name || (creature.type === 0 ? "Player" : "Mob");

      const meta = document.createElement("div");
      meta.className = "mc-small-note";
      meta.textContent = `${creature.type === 0 ? "Player" : "Mob"} at ${creature.position.x}, ${creature.position.y}, ${creature.position.z}`;

      row.appendChild(name);
      row.appendChild(meta);
      list.appendChild(row);
    });
  }

  function setPanelCollapsed(panel, collapsed) {
    if (!panel) return;

    const body = panel.querySelector(".mc-body");
    const toggle = panel.querySelector("#minibia-copilot-collapse");
    const nextCollapsed = !!collapsed;

    panel.dataset.collapsed = nextCollapsed ? "true" : "false";

    if (body) {
      body.hidden = nextCollapsed;
    }

    if (toggle) {
      toggle.textContent = nextCollapsed ? "+" : "−";
      toggle.setAttribute("aria-label", nextCollapsed ? "Maximize panel" : "Minimize panel");
      toggle.setAttribute("title", nextCollapsed ? "Maximize" : "Minimize");
    }

    savePanelCollapsed(nextCollapsed);
  }

  function applySavedPanelPosition(panel, key = panelPositionKey) {
    const position = getSavedPanelPosition(key);
    if (!position) return;

    if (typeof position.top === "number") {
      panel.style.top = `${position.top}px`;
    }

    if (typeof position.left === "number") {
      panel.style.left = `${position.left}px`;
      panel.style.right = "auto";
    }
  }

  function clampPanelPosition(panel, left, top) {
    const maxLeft = Math.max(0, window.innerWidth - panel.offsetWidth);
    const maxTop = Math.max(0, window.innerHeight - panel.offsetHeight);

    return {
      left: Math.min(Math.max(0, left), maxLeft),
      top: Math.min(Math.max(0, top), maxTop),
    };
  }

  function enableDrag(panel, key = panelPositionKey) {
    const handle = panel.querySelector(".mc-title");
    if (!handle) return;

    let dragState = null;

    const onMouseMove = (event) => {
      if (!dragState) return;

      const next = clampPanelPosition(
        panel,
        event.clientX - dragState.offsetX,
        event.clientY - dragState.offsetY
      );

      panel.style.left = `${next.left}px`;
      panel.style.top = `${next.top}px`;
      panel.style.right = "auto";
    };

    const onMouseUp = () => {
      if (!dragState) return;

      dragState = null;
      const rect = panel.getBoundingClientRect();
      savePanelPosition({ left: rect.left, top: rect.top }, key);
    };

    handle.addEventListener("mousedown", (event) => {
      if (event.button !== 0) return;

      const rect = panel.getBoundingClientRect();
      dragState = {
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
      };

      event.preventDefault();
    });

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    bot.addCleanup(() => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    });
  }

  function inject() {
    destroy();

    const style = document.createElement("style");
    style.id = "minibia-copilot-style";
    style.textContent = `
      #minibia-copilot-panel {
        position: fixed;
        z-index: 999999;
        max-width: calc(100vw - 32px);
        padding: 12px;
        border: 1px solid rgba(224, 200, 148, 0.45);
        border-radius: 10px;
        background: linear-gradient(180deg, rgba(30, 23, 15, 0.95), rgba(15, 11, 8, 0.97));
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
        color: #f1e2b8;
        font: 12px/1.35 Verdana, sans-serif;
        user-select: none;
      }

      #minibia-copilot-panel {
        top: 16px;
        right: 16px;
        width: 960px;
      }

      #minibia-copilot-panel[data-collapsed="true"] {
        width: 220px;
      }

      #minibia-copilot-panel .mc-title {
        margin: 0;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        cursor: move;
      }

      #minibia-copilot-panel .mc-titlebar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin: 0 0 8px;
      }

      #minibia-copilot-panel .mc-icon-button {
        width: 24px;
        min-width: 24px;
        padding: 2px 0;
        border-radius: 6px;
        font-weight: 700;
        line-height: 1;
      }

      #minibia-copilot-panel[data-collapsed="true"] .mc-titlebar {
        margin-bottom: 0;
      }

      #minibia-copilot-panel .mc-body {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 280px 240px;
        gap: 12px;
        align-items: start;
      }

      #minibia-copilot-panel .mc-body[hidden] {
        display: none !important;
      }

      #minibia-copilot-panel .mc-side-column,
      #minibia-copilot-panel .mc-main-column,
      #minibia-copilot-panel .mc-cave-column {
        display: grid;
        gap: 10px;
      }

      #minibia-copilot-panel .mc-section {
        padding-top: 10px;
        border-top: 1px solid rgba(224, 200, 148, 0.16);
      }

      #minibia-copilot-panel .mc-column-section:first-child {
        padding-top: 0;
        border-top: 0;
      }

      #minibia-copilot-panel .mc-label {
        margin: 0 0 8px;
        color: #d3c49d;
        word-break: break-word;
      }

      #minibia-copilot-panel .mc-actions {
        display: grid;
        gap: 6px;
      }

      #minibia-copilot-panel .mc-actions-inline-three {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      #minibia-copilot-panel .mc-actions-inline-two {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      #minibia-copilot-panel button {
        width: 100%;
        padding: 8px 10px;
        border: 1px solid rgba(224, 200, 148, 0.35);
        border-radius: 8px;
        background: linear-gradient(180deg, #635133, #3f321f);
        color: #f7eccf;
        font: inherit;
        cursor: pointer;
      }

      #minibia-copilot-panel button:hover {
        background: linear-gradient(180deg, #755f3d, #4f4028);
      }

      #minibia-copilot-panel input,
      #minibia-copilot-panel textarea {
        width: 100%;
        box-sizing: border-box;
        padding: 8px 10px;
        border: 1px solid rgba(224, 200, 148, 0.35);
        border-radius: 8px;
        background: rgba(16, 12, 8, 0.88);
        color: #f7eccf;
        font: inherit;
      }

      #minibia-copilot-panel textarea {
        min-height: 72px;
        resize: vertical;
      }

      #minibia-copilot-panel .mc-toggle {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #d3c49d;
      }

      #minibia-copilot-panel .mc-toggle input[type="checkbox"] {
        width: auto;
        margin: 0;
      }

      #minibia-copilot-panel .mc-row {
        display: grid;
        grid-template-columns: auto 1fr;
        align-items: center;
        gap: 8px;
      }

      #minibia-copilot-panel .mc-row-compact {
        grid-template-columns: auto auto;
        justify-content: start;
      }

      #minibia-copilot-panel .mc-row .mc-toggle {
        white-space: nowrap;
      }

      #minibia-copilot-panel .mc-row input[type="text"] {
        min-width: 0;
      }

      #minibia-copilot-panel .mc-row-three {
        display: grid;
        grid-template-columns: auto minmax(120px, 1fr) 72px;
        align-items: center;
        gap: 8px;
      }

      #minibia-copilot-panel .mc-row-three input[type="text"],
      #minibia-copilot-panel .mc-row-three input[type="number"] {
        min-width: 0;
      }

      #minibia-copilot-panel .mc-row-five {
        display: grid;
        grid-template-columns: auto 82px 72px 82px 72px;
        align-items: center;
        gap: 8px;
      }

      #minibia-copilot-panel .mc-row-five input[type="number"] {
        min-width: 0;
      }

      #minibia-copilot-panel .mc-field-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }

      #minibia-copilot-panel .mc-field {
        display: grid;
        gap: 4px;
      }

      #minibia-copilot-panel .mc-field-compact {
        width: 96px;
        justify-self: end;
      }

      #minibia-copilot-panel .mc-field-label {
        color: #d3c49d;
        font-size: 11px;
      }

      #minibia-copilot-panel .mc-stack {
        display: grid;
        gap: 8px;
      }

      #minibia-copilot-panel .mc-inline {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 6px;
        align-items: center;
      }

      #minibia-copilot-panel .mc-list {
        display: grid;
        gap: 6px;
      }

      #minibia-copilot-panel .mc-list-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 6px;
        align-items: center;
        color: #d3c49d;
      }

      #minibia-copilot-panel .mc-creature-row {
        padding: 6px 8px;
        border: 1px solid rgba(224, 200, 148, 0.14);
        border-radius: 8px;
        background: rgba(255, 244, 212, 0.04);
      }

      #minibia-copilot-panel .mc-creature-name {
        color: #f7eccf;
        word-break: break-word;
      }

      #minibia-copilot-panel .mc-floor-label {
        margin-top: 4px;
        color: #e2cf9c;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      #minibia-copilot-panel #minibia-copilot-visible-creatures-list {
        max-height: 150px;
        overflow-y: auto;
        padding-right: 2px;
      }

      #minibia-copilot-panel #minibia-copilot-panic-trusted-list {
        max-height: 140px;
        overflow-y: auto;
        padding-right: 2px;
      }

      #minibia-copilot-panel .mc-small-button {
        width: auto;
        padding: 4px 8px;
        border-radius: 6px;
      }

      #minibia-copilot-panel .mc-small-note {
        color: #b7a67d;
        font-size: 11px;
      }

      #minibia-copilot-panel .mc-note {
        margin-top: 8px;
        color: #b7a67d;
        font-size: 11px;
      }

      @media (max-width: 760px) {
        #minibia-copilot-panel {
          width: min(720px, calc(100vw - 32px));
        }

        #minibia-copilot-panel .mc-body {
          grid-template-columns: 1fr;
        }

        #minibia-copilot-panel .mc-field-grid {
          grid-template-columns: 1fr;
        }
      }
    `;
    document.head.appendChild(style);

    const panel = document.createElement("div");
    panel.id = "minibia-copilot-panel";
    panel.innerHTML = `
        <div class="mc-titlebar">
        <div class="mc-title">Minibia Copilot</div>
        <button type="button" class="mc-icon-button" id="minibia-copilot-collapse" aria-label="Minimize panel" title="Minimize">−</button>
      </div>
      <div class="mc-body">
        <div class="mc-main-column">
          <div class="mc-actions mc-column-section">
            <button type="button" id="minibia-copilot-reload">Reload Bot</button>
          </div>
          <div class="mc-section mc-column-section">
            <div class="mc-label" id="minibia-copilot-home">Panic Runner Home: not set</div>
            <div class="mc-stack">
              <button type="button" id="minibia-copilot-set-home">Set Home</button>
              <label class="mc-toggle">
                <input type="checkbox" id="minibia-copilot-panic-unknown" />
                <span>Unknown Player</span>
              </label>
              <label class="mc-toggle">
                <input type="checkbox" id="minibia-copilot-panic-health" />
                <span>Lose Health</span>
              </label>
              <label class="mc-toggle">
                <input type="checkbox" id="minibia-copilot-panic-return" />
                <span>Auto Return</span>
              </label>
              <div class="mc-inline">
                <input type="text" id="minibia-copilot-panic-trusted-input" placeholder="Trusted name" />
                <button type="button" class="mc-small-button" id="minibia-copilot-panic-trusted-add">Add</button>
              </div>
              <div class="mc-list" id="minibia-copilot-panic-trusted-list"></div>
            </div>
          </div>
          <div class="mc-section mc-column-section">
            <div class="mc-label">GM Kill Switch</div>
            <div class="mc-stack">
              <div class="mc-inline">
                <input type="text" id="minibia-copilot-panic-gm-input" placeholder="Game master name" />
                <button type="button" class="mc-small-button" id="minibia-copilot-panic-gm-add">Add</button>
              </div>
              <div class="mc-list" id="minibia-copilot-panic-gm-list"></div>
            </div>
          </div>
          <div class="mc-section mc-column-section">
            <div class="mc-actions">
              <div class="mc-row-three">
                <label class="mc-toggle">
                  <input type="checkbox" id="minibia-copilot-rune-enabled" />
                  <span>Magic Level Trainer</span>
                </label>
                <input type="text" id="minibia-copilot-rune-spell" placeholder="Spell words" />
                <input type="number" id="minibia-copilot-rune-mana" min="0" placeholder="Mana" />
              </div>
              <div class="mc-row mc-row-compact">
                <label class="mc-toggle">
                  <input type="checkbox" id="minibia-copilot-auto-eat-enabled" />
                  <span>Auto Eat</span>
                </label>
                <label class="mc-field mc-field-compact" for="minibia-copilot-auto-eat-hotkey">
                  <span class="mc-field-label">Eat Hotkey (1-12)</span>
                  <input type="number" id="minibia-copilot-auto-eat-hotkey" min="1" max="12" placeholder="10" />
                </label>
              </div>
              <div class="mc-row">
                <label class="mc-toggle">
                  <input type="checkbox" id="minibia-copilot-auto-invisible-enabled" />
                  <span>Auto Invisible</span>
                </label>
                <div class="mc-small-note">Casts utana vid whenever invisibility is not active.</div>
              </div>
              <div class="mc-row">
                <label class="mc-toggle">
                  <input type="checkbox" id="minibia-copilot-auto-magic-shield-enabled" />
                  <span>Auto Utamo Vita</span>
                </label>
                <div class="mc-small-note">Casts utamo vita whenever magic shield is not active.</div>
              </div>
              <div class="mc-row">
                <label class="mc-toggle">
                  <input type="checkbox" id="minibia-copilot-equip-ring-enabled" />
                  <span>Equip Ring</span>
                </label>
                <div></div>
              </div>
            </div>
          </div>
          <div class="mc-section mc-column-section">
            <div class="mc-note">Loaded routines: Panic Runner, magic level trainer, auto eat, auto invisible, auto utamo vita, equip ring, auto heal, auto attack, and talk.</div>
          </div>
        </div>
        <div class="mc-side-column">
          <div class="mc-section mc-column-section">
            <div class="mc-label">Xray</div>
            <button type="button" class="mc-small-button" id="minibia-copilot-xray-overlay-toggle">Disable Overlay</button>
            <div class="mc-small-note" id="minibia-copilot-xray-overlay-status">Overlay: on</div>
            <label class="mc-field" for="minibia-copilot-xray-floor-select">
              <span class="mc-field-label">Floor Filter</span>
              <select id="minibia-copilot-xray-floor-select">
                <option value="all">All floors</option>
              </select>
            </label>
            <div class="mc-list" id="minibia-copilot-visible-creatures-list"></div>
          </div>
          <div class="mc-section mc-column-section">
            <div class="mc-label">Auto Heal</div>
            <div class="mc-stack">
              <label class="mc-toggle">
                <input type="checkbox" id="minibia-copilot-auto-heal-enabled" />
                <span>Enable Auto Heal</span>
              </label>
              <div class="mc-field-grid">
                <label class="mc-field" for="minibia-copilot-auto-heal-min-hp">
                  <span class="mc-field-label">Minimum HP</span>
                  <input type="number" id="minibia-copilot-auto-heal-min-hp" min="0" placeholder="250" />
                </label>
                <label class="mc-field" for="minibia-copilot-auto-heal-hp-hotkey">
                  <span class="mc-field-label">HP Hotkey (1-12)</span>
                  <input type="number" id="minibia-copilot-auto-heal-hp-hotkey" min="1" max="12" placeholder="1" />
                </label>
                <label class="mc-field" for="minibia-copilot-auto-heal-min-mana">
                  <span class="mc-field-label">Minimum Mana</span>
                  <input type="number" id="minibia-copilot-auto-heal-min-mana" min="0" placeholder="150" />
                </label>
                <label class="mc-field" for="minibia-copilot-auto-heal-mana-hotkey">
                  <span class="mc-field-label">Mana Hotkey (1-12)</span>
                  <input type="number" id="minibia-copilot-auto-heal-mana-hotkey" min="1" max="12" placeholder="2" />
                </label>
              </div>
              <div class="mc-small-note">Checks about twenty times per second. HP is used before mana, and unregistered hotkey presses are retried quickly.</div>
            </div>
          </div>
          <div class="mc-section mc-column-section">
            <div class="mc-label">Talk</div>
            <div class="mc-stack">
              <label class="mc-toggle">
                <input type="checkbox" id="minibia-copilot-talk-enabled" />
                <span>Enable Auto Reply</span>
              </label>
              <input type="password" id="minibia-copilot-talk-api-key" placeholder="Gemini API key" />
              <textarea id="minibia-copilot-talk-prompt" placeholder="Reply style prompt"></textarea>
              <div class="mc-small-note" id="minibia-copilot-talk-status">Status: idle</div>
              <div class="mc-small-note">Replies only to the newest unseen message in Default chat.</div>
              <div class="mc-small-note">It will not reply to itself and will not admit it is a bot.</div>
            </div>
          </div>
        </div>
        <div class="mc-cave-column">
          <div class="mc-section mc-column-section">
            <div class="mc-label">Cave Bot</div>
            <div class="mc-stack">
              <div class="mc-field-grid">
                <label class="mc-field" for="minibia-copilot-cave-preset-select">
                  <select id="minibia-copilot-cave-preset-select"></select>
                </label>
              </div>
              <div class="mc-actions mc-actions-inline-two">
                <button type="button" class="mc-small-button" id="minibia-copilot-cave-preset-new">New</button>
                <button type="button" class="mc-small-button" id="minibia-copilot-cave-preset-delete">Delete</button>
              </div>
              <div class="mc-actions mc-actions-inline-two">
                <button type="button" class="mc-small-button" id="minibia-copilot-cave-record">Record Node</button>
                <button type="button" class="mc-small-button" id="minibia-copilot-cave-remove-last">Remove Last</button>
              </div>
              <div class="mc-actions mc-actions-inline-three">
                <button type="button" class="mc-small-button" id="minibia-copilot-cave-record-rope">+ Rope</button>
                <button type="button" class="mc-small-button" id="minibia-copilot-cave-record-ladder">+ Ladder</button>
                <button type="button" class="mc-small-button" id="minibia-copilot-cave-record-shovel">+ Shovel</button>
              </div>
              <div class="mc-actions mc-actions-inline-two">
                <button type="button" class="mc-small-button" id="minibia-copilot-cave-record-use">+ Use Tile</button>
                <button type="button" class="mc-small-button" id="minibia-copilot-cave-record-stand">+ Stand</button>
              </div>
              <div class="mc-small-note" id="minibia-copilot-cave-closest">Closest start: no waypoints</div>
              <div class="mc-small-note" id="minibia-copilot-cave-transition-status">Transitions learned: none</div>
              <div class="mc-actions mc-actions-inline-two">
                <button type="button" class="mc-small-button" id="minibia-copilot-cave-start">Start</button>
                <button type="button" class="mc-small-button" id="minibia-copilot-cave-stop">Stop</button>
              </div>
              <div class="mc-small-note" id="minibia-copilot-cave-status">Status: no waypoints</div>
            </div>
          </div>
          <div class="mc-section mc-column-section">
            <div class="mc-label">Auto Attack</div>
            <div class="mc-stack">
              <label class="mc-toggle">
                <input type="checkbox" id="minibia-copilot-auto-attack-enabled" />
                <span>Enable Auto Attack</span>
              </label>
              <label class="mc-toggle">
                <input type="checkbox" id="minibia-copilot-auto-attack-melee" />
                <span>Melee Mode</span>
              </label>
              <label class="mc-field" for="minibia-copilot-auto-attack-hotkey">
                <span class="mc-field-label">Target Hotkey (1-12)</span>
                <input type="number" id="minibia-copilot-auto-attack-hotkey" min="1" max="12" placeholder="3" />
              </label>
              <label class="mc-field" for="minibia-copilot-auto-attack-rune-hotkey">
                <span class="mc-field-label">Rune Hotkey (1-12)</span>
                <input type="number" id="minibia-copilot-auto-attack-rune-hotkey" min="1" max="12" placeholder="4" />
              </label>
              <div class="mc-small-note">Melee mode uses the target hotkey, then walks adjacent to the target. Non-melee mode uses the target hotkey to acquire a target and the rune hotkey to cast on that target.</div>
            </div>
          </div>
          <div class="mc-section mc-column-section">
            <div class="mc-label">Magic Wall Timer</div>
            <div class="mc-stack">
              <label class="mc-toggle">
                <input type="checkbox" id="minibia-copilot-magic-wall-enabled" />
                <span>Show on-screen MW timer</span>
              </label>
              <label class="mc-toggle">
                <input type="checkbox" id="minibia-copilot-magic-wall-audio" />
                <span>Alarm at lead time</span>
              </label>
              <label class="mc-field" for="minibia-copilot-magic-wall-duration">
                <span class="mc-field-label">Duration (s)</span>
                <input type="number" id="minibia-copilot-magic-wall-duration" min="1" max="120" placeholder="20" />
              </label>
              <label class="mc-field" for="minibia-copilot-magic-wall-lead">
                <span class="mc-field-label">Flash/alarm lead (s)</span>
                <input type="number" id="minibia-copilot-magic-wall-lead" min="0" max="20" placeholder="3" />
              </label>
              <div class="mc-small-note" id="minibia-copilot-magic-wall-status">Status: idle</div>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    const unlockAudio = () => {
      bot.unlockAudio?.();
    };

    panel.addEventListener("pointerdown", unlockAudio, { passive: true });
    panel.addEventListener("keydown", unlockAudio);

    bot.addCleanup(() => {
      panel.removeEventListener("pointerdown", unlockAudio);
      panel.removeEventListener("keydown", unlockAudio);
    });

    applySavedPanelPosition(panel);
    enableDrag(panel);
    setPanelCollapsed(panel, getSavedPanelCollapsed());

    const spellInput = panel.querySelector("#minibia-copilot-rune-spell");
    const manaInput = panel.querySelector("#minibia-copilot-rune-mana");
    const runeEnabledInput = panel.querySelector("#minibia-copilot-rune-enabled");
    const autoEatEnabledInput = panel.querySelector("#minibia-copilot-auto-eat-enabled");
    const autoEatHotkeyInput = panel.querySelector("#minibia-copilot-auto-eat-hotkey");
    const autoInvisibleEnabledInput = panel.querySelector("#minibia-copilot-auto-invisible-enabled");
    const autoMagicShieldEnabledInput = panel.querySelector("#minibia-copilot-auto-magic-shield-enabled");
    const equipRingEnabledInput = panel.querySelector("#minibia-copilot-equip-ring-enabled");
    const autoHealEnabledInput = panel.querySelector("#minibia-copilot-auto-heal-enabled");
    const autoHealMinHpInput = panel.querySelector("#minibia-copilot-auto-heal-min-hp");
    const autoHealHpHotkeyInput = panel.querySelector("#minibia-copilot-auto-heal-hp-hotkey");
    const autoHealMinManaInput = panel.querySelector("#minibia-copilot-auto-heal-min-mana");
    const autoHealManaHotkeyInput = panel.querySelector("#minibia-copilot-auto-heal-mana-hotkey");
    const autoAttackEnabledInput = panel.querySelector("#minibia-copilot-auto-attack-enabled");
    const autoAttackMeleeInput = panel.querySelector("#minibia-copilot-auto-attack-melee");
    const autoAttackHotkeyInput = panel.querySelector("#minibia-copilot-auto-attack-hotkey");
    const autoAttackRuneHotkeyInput = panel.querySelector("#minibia-copilot-auto-attack-rune-hotkey");
    const talkEnabledInput = panel.querySelector("#minibia-copilot-talk-enabled");
    const talkApiKeyInput = panel.querySelector("#minibia-copilot-talk-api-key");
    const talkPromptInput = panel.querySelector("#minibia-copilot-talk-prompt");
    const panicGmNameInput = panel.querySelector("#minibia-copilot-panic-gm-input");
    const panicGmAddButton = panel.querySelector("#minibia-copilot-panic-gm-add");
    const panicUnknownInput = panel.querySelector("#minibia-copilot-panic-unknown");
    const panicHealthInput = panel.querySelector("#minibia-copilot-panic-health");
    const panicReturnInput = panel.querySelector("#minibia-copilot-panic-return");
    const panicTrustedInput = panel.querySelector("#minibia-copilot-panic-trusted-input");
    const panicTrustedAddButton = panel.querySelector("#minibia-copilot-panic-trusted-add");
    const xrayOverlayButton = panel.querySelector("#minibia-copilot-xray-overlay-toggle");
    const xrayFloorSelect = panel.querySelector("#minibia-copilot-xray-floor-select");
    const collapseButton = panel.querySelector("#minibia-copilot-collapse");
    const reloadButton = panel.querySelector("#minibia-copilot-reload");
    const caveRecordButton = panel.querySelector("#minibia-copilot-cave-record");
    const caveRemoveLastButton = panel.querySelector("#minibia-copilot-cave-remove-last");
    const caveStartButton = panel.querySelector("#minibia-copilot-cave-start");
    const caveStopButton = panel.querySelector("#minibia-copilot-cave-stop");
    const cavePresetSelect = panel.querySelector("#minibia-copilot-cave-preset-select");
    const cavePresetNewButton = panel.querySelector("#minibia-copilot-cave-preset-new");
    const cavePresetDeleteButton = panel.querySelector("#minibia-copilot-cave-preset-delete");
    const caveRecordRopeButton = panel.querySelector("#minibia-copilot-cave-record-rope");
    const caveRecordLadderButton = panel.querySelector("#minibia-copilot-cave-record-ladder");
    const caveRecordShovelButton = panel.querySelector("#minibia-copilot-cave-record-shovel");
    const caveRecordUseButton = panel.querySelector("#minibia-copilot-cave-record-use");
    const caveRecordStandButton = panel.querySelector("#minibia-copilot-cave-record-stand");
    const magicWallEnabledInput = panel.querySelector("#minibia-copilot-magic-wall-enabled");
    const magicWallAudioInput = panel.querySelector("#minibia-copilot-magic-wall-audio");
    const magicWallDurationInput = panel.querySelector("#minibia-copilot-magic-wall-duration");
    const magicWallLeadInput = panel.querySelector("#minibia-copilot-magic-wall-lead");

    if (collapseButton) {
      collapseButton.addEventListener("click", () => {
        const isCollapsed = panel.dataset.collapsed === "true";
        setPanelCollapsed(panel, !isCollapsed);
      });
    }

    if (reloadButton) {
      reloadButton.addEventListener("click", () => {
        window.minibiaCopilotReload?.();
      });
    }

    function addTrustedName() {
      const rawName = panicTrustedInput?.value?.trim() || "";
      if (!rawName) {
        return;
      }

      const currentNames = bot.panic?.config?.trustedNames || [];
      const exists = currentNames.some(
        (name) => String(name).trim().toLowerCase() === rawName.toLowerCase()
      );

      if (!exists) {
        bot.panic.updateConfig({ trustedNames: [...currentNames, rawName] });
      }

      if (panicTrustedInput) {
        panicTrustedInput.value = "";
      }

      renderTrustedNames();
    }

    function addGameMasterName() {
      const rawName = panicGmNameInput?.value?.trim() || "";
      if (!rawName) {
        return;
      }

      const currentNames = bot.panic?.config?.gameMasterNames || [];
      const exists = currentNames.some(
        (name) => String(name).trim().toLowerCase() === rawName.toLowerCase()
      );

      if (!exists) {
        bot.panic.updateConfig({ gameMasterNames: [...currentNames, rawName] });
      }

      if (panicGmNameInput) {
        panicGmNameInput.value = "";
      }

      renderGameMasterNames();
    }

    if (panicGmAddButton) {
      panicGmAddButton.addEventListener("click", addGameMasterName);
    }

    if (panicGmNameInput) {
      panicGmNameInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          addGameMasterName();
        }
      });
    }

    if (panicTrustedAddButton) {
      panicTrustedAddButton.addEventListener("click", addTrustedName);
    }

    if (panicTrustedInput) {
      panicTrustedInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          addTrustedName();
        }
      });
    }

    if (spellInput) {
      spellInput.value = bot.rune?.config?.runeSpellWords || "";
      spellInput.addEventListener("change", () => {
        bot.rune.updateConfig({ runeSpellWords: spellInput.value.trim() });
      });
    }

    if (manaInput) {
      manaInput.value = String(bot.rune?.config?.runeManaCost ?? 0);
      manaInput.addEventListener("change", () => {
        const runeManaCost = Math.max(0, Number(manaInput.value) || 0);
        manaInput.value = String(runeManaCost);
        bot.rune.updateConfig({ runeManaCost });
      });
    }

    if (runeEnabledInput) {
      runeEnabledInput.checked = !!bot.rune?.status?.().running;
      runeEnabledInput.addEventListener("change", () => {
        const runeSpellWords = spellInput?.value?.trim() || bot.rune.config.runeSpellWords;
        const runeManaCost = Math.max(0, Number(manaInput?.value) || bot.rune.config.runeManaCost || 0);

        if (runeEnabledInput.checked) {
          bot.rune.start({ runeSpellWords, runeManaCost });
        } else {
          bot.rune.stop();
        }

        refreshRuneStatus();
      });
    }

    if (autoEatHotkeyInput) {
      autoEatHotkeyInput.value = String(bot.eat?.config?.eatHotbarSlot ?? 10);
      autoEatHotkeyInput.addEventListener("change", () => {
        const eatHotbarSlot = Math.min(12, Math.max(1, Number(autoEatHotkeyInput.value) || 1));
        autoEatHotkeyInput.value = String(eatHotbarSlot);
        bot.eat.updateConfig({ eatHotbarSlot });
      });
    }

    if (autoEatEnabledInput) {
      autoEatEnabledInput.checked = !!bot.eat?.status?.().running;
      autoEatEnabledInput.addEventListener("change", () => {
        const eatHotbarSlot = Math.min(
          12,
          Math.max(1, Number(autoEatHotkeyInput?.value) || bot.eat.config.eatHotbarSlot || 1)
        );

        if (autoEatEnabledInput.checked) {
          bot.eat.start({ eatHotbarSlot });
        } else {
          bot.eat.stop();
        }

        refreshAutoEatStatus();
      });
    }

    if (autoInvisibleEnabledInput) {
      autoInvisibleEnabledInput.checked = !!bot.invisible?.status?.().running;
      autoInvisibleEnabledInput.addEventListener("change", () => {
        if (autoInvisibleEnabledInput.checked) {
          bot.invisible.start();
        } else {
          bot.invisible.stop();
        }

        refreshAutoInvisibleStatus();
      });
    }

    if (autoMagicShieldEnabledInput) {
      autoMagicShieldEnabledInput.checked = !!bot.magicShield?.status?.().running;
      autoMagicShieldEnabledInput.addEventListener("change", () => {
        if (autoMagicShieldEnabledInput.checked) {
          bot.magicShield.start();
        } else {
          bot.magicShield.stop();
        }

        refreshAutoMagicShieldStatus();
      });
    }

    if (equipRingEnabledInput) {
      equipRingEnabledInput.checked = !!bot.equipRing?.status?.().running;
      equipRingEnabledInput.addEventListener("change", () => {
        if (equipRingEnabledInput.checked) {
          bot.equipRing.start();
        } else {
          bot.equipRing.stop();
        }

        refreshEquipRingStatus();
      });
    }

    if (caveRecordButton) {
      caveRecordButton.addEventListener("click", () => {
        bot.cave.addWaypointCurrentSpot();
        refreshCavePresetControls();
        refreshCaveClosestStatus();
        refreshCaveTransitionStatus();
      });
    }

    if (caveRemoveLastButton) {
      caveRemoveLastButton.addEventListener("click", () => {
        bot.cave.removeLastWaypoint();
        refreshCavePresetControls();
        refreshCaveStatus();
        refreshCaveClosestStatus();
        refreshCaveTransitionStatus();
      });
    }

    function bindCaveActionRecord(button, recorder) {
      if (!button) return;
      button.addEventListener("click", () => {
        recorder?.();
        refreshCavePresetControls();
        refreshCaveClosestStatus();
        refreshCaveTransitionStatus();
      });
    }

    bindCaveActionRecord(caveRecordRopeButton, () => bot.cave?.addRopeWaypointCurrentSpot?.());
    bindCaveActionRecord(caveRecordLadderButton, () => bot.cave?.addLadderWaypointCurrentSpot?.());
    bindCaveActionRecord(caveRecordShovelButton, () => bot.cave?.addShovelWaypointCurrentSpot?.());
    bindCaveActionRecord(caveRecordUseButton, () => bot.cave?.addUseWaypointCurrentSpot?.());
    bindCaveActionRecord(caveRecordStandButton, () => bot.cave?.addStandWaypointCurrentSpot?.());

    if (magicWallEnabledInput) {
      magicWallEnabledInput.addEventListener("change", () => {
        if (magicWallEnabledInput.checked) {
          bot.magicWall?.start?.();
        } else {
          bot.magicWall?.stop?.();
        }
        refreshMagicWallStatus();
      });
    }

    if (magicWallAudioInput) {
      magicWallAudioInput.addEventListener("change", () => {
        bot.magicWall?.updateConfig?.({ audioOnExpiry: !!magicWallAudioInput.checked });
        refreshMagicWallStatus();
      });
    }

    function applyMagicWallDuration() {
      if (!magicWallDurationInput) return;
      const seconds = Math.max(1, Math.min(120, Number(magicWallDurationInput.value) || 20));
      const status = bot.magicWall?.status?.();
      const next = (status?.config?.patternSpecs || []).map((spec) => {
        if (spec && String(spec.name || "").toLowerCase().includes("magic wall")) {
          return { ...spec, durationMs: seconds * 1000 };
        }
        return spec;
      });
      bot.magicWall?.updateConfig?.({ patternSpecs: next });
      refreshMagicWallStatus();
    }

    if (magicWallDurationInput) {
      magicWallDurationInput.addEventListener("change", applyMagicWallDuration);
    }

    if (magicWallLeadInput) {
      magicWallLeadInput.addEventListener("change", () => {
        const seconds = Math.max(0, Math.min(20, Number(magicWallLeadInput.value) || 3));
        bot.magicWall?.updateConfig?.({ flashLeadMs: seconds * 1000, audioLeadMs: seconds * 1000 });
        refreshMagicWallStatus();
      });
    }

    if (caveStartButton) {
      caveStartButton.addEventListener("click", () => {
        bot.cave.start();
        refreshCavePresetControls();
        refreshCaveStatus();
        refreshCaveClosestStatus();
        refreshCaveTransitionStatus();
      });
    }

    if (caveStopButton) {
      caveStopButton.addEventListener("click", () => {
        bot.cave.stop();
        refreshCavePresetControls();
        refreshCaveStatus();
        refreshCaveClosestStatus();
        refreshCaveTransitionStatus();
      });
    }

    if (cavePresetSelect) {
      cavePresetSelect.addEventListener("change", () => {
        const name = cavePresetSelect.value || "";
        const activePresetName = bot.cave?.getActivePresetName?.() || "";
        if (!name || name === activePresetName) {
          refreshCavePresetControls();
          return;
        }

        const loadedPreset = bot.cave.loadPreset(name);
        refreshCavePresetControls();
        refreshCaveStatus();
        refreshCaveClosestStatus();
        refreshCaveTransitionStatus();
      });
    }

    if (cavePresetNewButton) {
      cavePresetNewButton.addEventListener("click", () => {
        const name = window.prompt("Name the new cave preset:");
        if (name == null) {
          return;
        }

        const createdPreset = bot.cave.createPreset(name);
        if (!createdPreset) {
          return;
        }

        refreshCavePresetControls();
        refreshCaveStatus();
        refreshCaveClosestStatus();
        refreshCaveTransitionStatus();
      });
    }

    if (cavePresetDeleteButton) {
      cavePresetDeleteButton.addEventListener("click", () => {
        const name = cavePresetSelect?.value || "";
        if (!name) {
          return;
        }

        const deleted = bot.cave.deletePreset(name);
        if (!deleted) {
          return;
        }

        refreshCavePresetControls();
        refreshCaveStatus();
        refreshCaveClosestStatus();
        refreshCaveTransitionStatus();
      });
    }

    if (autoHealMinHpInput) {
      autoHealMinHpInput.value = String(bot.heal?.config?.minHp ?? 0);
      autoHealMinHpInput.addEventListener("change", () => {
        const minHp = Math.max(0, Number(autoHealMinHpInput.value) || 0);
        autoHealMinHpInput.value = String(minHp);
        bot.heal.updateConfig({ minHp });
      });
    }

    if (autoHealHpHotkeyInput) {
      autoHealHpHotkeyInput.value = String(bot.heal?.config?.hpHotbarSlot ?? 1);
      autoHealHpHotkeyInput.addEventListener("change", () => {
        const hpHotbarSlot = Math.min(12, Math.max(1, Number(autoHealHpHotkeyInput.value) || 1));
        autoHealHpHotkeyInput.value = String(hpHotbarSlot);
        bot.heal.updateConfig({ hpHotbarSlot });
      });
    }

    if (autoHealMinManaInput) {
      autoHealMinManaInput.value = String(bot.heal?.config?.minMana ?? 0);
      autoHealMinManaInput.addEventListener("change", () => {
        const minMana = Math.max(0, Number(autoHealMinManaInput.value) || 0);
        autoHealMinManaInput.value = String(minMana);
        bot.heal.updateConfig({ minMana });
      });
    }

    if (autoHealManaHotkeyInput) {
      autoHealManaHotkeyInput.value = String(bot.heal?.config?.manaHotbarSlot ?? 1);
      autoHealManaHotkeyInput.addEventListener("change", () => {
        const manaHotbarSlot = Math.min(12, Math.max(1, Number(autoHealManaHotkeyInput.value) || 1));
        autoHealManaHotkeyInput.value = String(manaHotbarSlot);
        bot.heal.updateConfig({ manaHotbarSlot });
      });
    }

    if (autoHealEnabledInput) {
      autoHealEnabledInput.checked = !!bot.heal?.status?.().running;
      autoHealEnabledInput.addEventListener("change", () => {
        const minHp = Math.max(0, Number(autoHealMinHpInput?.value) || bot.heal.config.minHp || 0);
        const hpHotbarSlot = Math.min(
          12,
          Math.max(1, Number(autoHealHpHotkeyInput?.value) || bot.heal.config.hpHotbarSlot || 1)
        );
        const minMana = Math.max(0, Number(autoHealMinManaInput?.value) || bot.heal.config.minMana || 0);
        const manaHotbarSlot = Math.min(
          12,
          Math.max(1, Number(autoHealManaHotkeyInput?.value) || bot.heal.config.manaHotbarSlot || 1)
        );

        if (autoHealEnabledInput.checked) {
          bot.heal.start({ minHp, hpHotbarSlot, minMana, manaHotbarSlot });
        } else {
          bot.heal.stop();
        }

        refreshAutoHealStatus();
      });
    }

    if (autoAttackHotkeyInput) {
      autoAttackHotkeyInput.value = String(bot.attack?.config?.targetHotbarSlot ?? 3);
      autoAttackHotkeyInput.addEventListener("change", () => {
        const targetHotbarSlot = Math.min(12, Math.max(1, Number(autoAttackHotkeyInput.value) || 1));
        autoAttackHotkeyInput.value = String(targetHotbarSlot);
        bot.attack.updateConfig({ targetHotbarSlot });
      });
    }

    if (autoAttackRuneHotkeyInput) {
      autoAttackRuneHotkeyInput.value = bot.attack?.config?.runeHotbarSlot
        ? String(bot.attack.config.runeHotbarSlot)
        : "";
      autoAttackRuneHotkeyInput.addEventListener("change", () => {
        const rawValue = Number(autoAttackRuneHotkeyInput.value);
        const runeHotbarSlot = Number.isFinite(rawValue) && rawValue >= 1 && rawValue <= 12
          ? Math.trunc(rawValue)
          : null;
        autoAttackRuneHotkeyInput.value = runeHotbarSlot ? String(runeHotbarSlot) : "";
        bot.attack.updateConfig({ runeHotbarSlot });
      });
    }

    if (autoAttackMeleeInput) {
      autoAttackMeleeInput.checked = bot.attack?.config?.meleeMode !== false;
      autoAttackMeleeInput.addEventListener("change", () => {
        bot.attack.updateConfig({ meleeMode: autoAttackMeleeInput.checked });
      });
    }

    if (autoAttackEnabledInput) {
      autoAttackEnabledInput.checked = !!bot.attack?.status?.().running;
      autoAttackEnabledInput.addEventListener("change", () => {
        const targetHotbarSlot = Math.min(
          12,
          Math.max(1, Number(autoAttackHotkeyInput?.value) || bot.attack.config.targetHotbarSlot || 1)
        );
        const runeHotbarSlot = (() => {
          const rawValue = Number(autoAttackRuneHotkeyInput?.value);
          if (Number.isFinite(rawValue) && rawValue >= 1 && rawValue <= 12) {
            return Math.trunc(rawValue);
          }

          return bot.attack.config.runeHotbarSlot ?? null;
        })();
        const meleeMode = !!autoAttackMeleeInput?.checked;

        if (autoAttackEnabledInput.checked) {
          bot.attack.start({ targetHotbarSlot, runeHotbarSlot, meleeMode });
        } else {
          bot.attack.stop();
        }

        refreshAutoAttackStatus();
      });
    }

    if (talkApiKeyInput) {
      talkApiKeyInput.value = bot.talk?.config?.apiKey || "";
      talkApiKeyInput.addEventListener("change", () => {
        bot.talk.updateConfig({ apiKey: talkApiKeyInput.value.trim() });
        refreshTalkStatus();
      });
    }

    if (talkPromptInput) {
      talkPromptInput.value = bot.talk?.config?.systemPrompt || "";
      talkPromptInput.addEventListener("change", () => {
        bot.talk.updateConfig({ systemPrompt: talkPromptInput.value.trim() });
      });
    }

    if (talkEnabledInput) {
      talkEnabledInput.checked = !!bot.talk?.status?.().running;
      talkEnabledInput.addEventListener("change", () => {
        if (talkEnabledInput.checked) {
          bot.talk.updateConfig({
            apiKey: talkApiKeyInput?.value?.trim() || "",
            systemPrompt: talkPromptInput?.value?.trim() || bot.talk.config.systemPrompt || "",
          });
          const started = bot.talk.start();
          if (!started) {
            talkEnabledInput.checked = false;
          }
        } else {
          bot.talk.stop();
        }

        refreshTalkStatus();
      });
    }

    if (panicUnknownInput) {
      panicUnknownInput.checked = !!bot.panic?.status?.().config?.unknownPlayerEnabled;
      panicUnknownInput.addEventListener("change", () => {
        bot.panic.updateConfig({ unknownPlayerEnabled: panicUnknownInput.checked });
        refreshPanicStatus();
      });
    }

    if (panicHealthInput) {
      panicHealthInput.checked = !!bot.panic?.status?.().config?.healthLossEnabled;
      panicHealthInput.addEventListener("change", () => {
        bot.panic.updateConfig({ healthLossEnabled: panicHealthInput.checked });
        refreshPanicStatus();
      });
    }

    if (panicReturnInput) {
      panicReturnInput.checked = !!bot.panic?.status?.().config?.returnToOriginEnabled;
      panicReturnInput.addEventListener("change", () => {
        bot.panic.updateConfig({ returnToOriginEnabled: panicReturnInput.checked });
        refreshPanicStatus();
      });
    }

    if (xrayOverlayButton) {
      xrayOverlayButton.addEventListener("click", () => {
        const enabled = !!bot.xray?.status?.().config?.overlayEnabled;
        bot.xray?.setOverlayEnabled?.(!enabled);
        refreshXrayStatus();
      });
    }

    if (xrayFloorSelect) {
      xrayFloorSelect.addEventListener("change", () => {
        const rawValue = xrayFloorSelect.value;
        bot.xray?.setSelectedFloor?.(rawValue === "all" ? null : Number(rawValue));
        refreshXrayStatus();
        refreshVisibleCreatures();
      });
    }

    panel.querySelector("#minibia-copilot-set-home")?.addEventListener("click", () => {
      bot.pz.setHomePzCurrentSpot();
      refreshHomeLabel();
    });

    refreshHomeLabel();
    refreshPanicStatus();
    refreshXrayStatus();
    renderGameMasterNames();
    renderTrustedNames();
    refreshRuneStatus();
    refreshAutoHealStatus();
    refreshAutoInvisibleStatus();
    refreshAutoMagicShieldStatus();
    refreshAutoAttackStatus();
    refreshAutoEatStatus();
    refreshCaveStatus();
    refreshEquipRingStatus();
    refreshTalkStatus();
    refreshMagicWallStatus();
    refreshVisibleCreatures();
    refreshCavePresetControls();
    refreshCaveClosestStatus();
    refreshCaveTransitionStatus();

    const visibleCreaturesTimerId = window.setInterval(refreshVisibleCreatures, 1000);
    bot.addCleanup(() => {
      window.clearInterval(visibleCreaturesTimerId);
    });

    const talkStatusTimerId = window.setInterval(refreshTalkStatus, 1000);
    bot.addCleanup(() => {
      window.clearInterval(talkStatusTimerId);
    });

    const caveStatusTimerId = window.setInterval(() => {
      refreshCaveStatus();
      refreshCavePresetControls();
      refreshCaveClosestStatus();
      refreshCaveTransitionStatus();
    }, 1000);
    bot.addCleanup(() => {
      window.clearInterval(caveStatusTimerId);
    });

    const magicWallStatusTimerId = window.setInterval(refreshMagicWallStatus, 1000);
    bot.addCleanup(() => {
      window.clearInterval(magicWallStatusTimerId);
    });
  }

  bot.ui = {
    inject,
    destroy,
    refreshHomeLabel,
    refreshPanicStatus,
    refreshXrayStatus,
    refreshRuneStatus,
    refreshAutoHealStatus,
    refreshAutoInvisibleStatus,
    refreshAutoMagicShieldStatus,
    refreshAutoAttackStatus,
    refreshAutoEatStatus,
    refreshCaveStatus,
    refreshCavePresetControls,
    refreshEquipRingStatus,
    refreshTalkStatus,
    refreshMagicWallStatus,
    refreshVisibleCreatures,
    refreshCaveClosestStatus,
    refreshCaveTransitionStatus,
    getSavedPanelPosition,
    getSavedPanelCollapsed,
    setPanelCollapsed: (collapsed) => {
      const panel = document.getElementById("minibia-copilot-panel");
      setPanelCollapsed(panel, collapsed);
    },
  };
};
