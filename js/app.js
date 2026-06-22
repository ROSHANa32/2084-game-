/* ===========================================================
   Fusion — UI, rendering & input
   =========================================================== */
(function () {
  "use strict";

  const SIZE = 4;
  const WIN = 2048;
  const STORE_KEY = "fusion.save.v1";
  const BEST_KEY = "fusion.best.v1";

  const els = {
    board: document.getElementById("board"),
    gridBg: document.getElementById("grid-bg"),
    tiles: document.getElementById("tiles"),
    score: document.getElementById("score"),
    best: document.getElementById("best"),
    newGame: document.getElementById("new-game"),
    soundToggle: document.getElementById("sound-toggle"),
    overlay: document.getElementById("overlay"),
    overlayTitle: document.getElementById("overlay-title"),
    overlayText: document.getElementById("overlay-text"),
    overlayActions: document.getElementById("overlay-actions"),
    hint: document.getElementById("hint"),
  };

  let game;
  const tileEls = new Map(); // id -> DOM element
  let best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10) || 0;
  let prevScore = 0;

  /* ---------- responsive board sizing ---------- */
  function sizeBoard() {
    const styles = getComputedStyle(document.documentElement);
    const gap = parseInt(styles.getPropertyValue("--gap"), 10) || 12;
    const frame = parseInt(styles.getPropertyValue("--frame"), 10) || 16;
    // available width: app padding is 18 each side; cap board width
    const available = Math.min(window.innerWidth - 36, 416);
    // also respect viewport height so the board never overflows
    const maxByHeight = Math.min(window.innerHeight * 0.6, 416);
    const target = Math.max(220, Math.min(available, maxByHeight));
    // outer target = SIZE*cell + (SIZE-1)*gap + 2*frame  →  solve for cell
    const cell = Math.floor((target - 2 * frame - (SIZE - 1) * gap) / SIZE);
    document.documentElement.style.setProperty("--cell", cell + "px");
    document.documentElement.style.setProperty("--board-size", SIZE);
    repositionAll();
  }

  function cellMetrics() {
    const styles = getComputedStyle(document.documentElement);
    const gap = parseInt(styles.getPropertyValue("--gap"), 10) || 12;
    const cell = parseInt(styles.getPropertyValue("--cell"), 10) || 72;
    return { gap, cell };
  }

  function translateFor(row, col) {
    const { gap, cell } = cellMetrics();
    const x = col * (cell + gap);
    const y = row * (cell + gap);
    return { x, y };
  }

  /* ---------- build static grid background ---------- */
  function buildGridBackground() {
    els.gridBg.innerHTML = "";
    for (let i = 0; i < SIZE * SIZE; i++) {
      const c = document.createElement("div");
      c.className = "grid-cell";
      els.gridBg.appendChild(c);
    }
  }

  /* ---------- tile DOM helpers ---------- */
  function createTileEl(tile) {
    const el = document.createElement("div");
    el.className = "tile";
    el.dataset.id = tile.id;
    const inner = document.createElement("span");
    inner.className = "tile-inner";
    el.appendChild(inner);
    setTileVisual(el, tile);
    positionEl(el, tile.row, tile.col);
    els.tiles.appendChild(el);
    tileEls.set(tile.id, el);
    return el;
  }

  function setTileVisual(el, tile) {
    el.dataset.v = tile.value;
    el.querySelector(".tile-inner").textContent = tile.value;
  }

  function positionEl(el, row, col) {
    const { x, y } = translateFor(row, col);
    el.style.setProperty("--x", x + "px");
    el.style.setProperty("--y", y + "px");
  }

  function repositionAll() {
    if (!game) return;
    for (const tile of game.tiles()) {
      const el = tileEls.get(tile.id);
      if (el) positionEl(el, tile.row, tile.col);
    }
  }

  /* ---------- main render ---------- */
  function render(opts) {
    opts = opts || {};

    // 1) animate absorbed (ghost) tiles sliding into their merge cell
    const absorbed = (game.lastAbsorbed || []).slice();
    for (const ghost of absorbed) {
      let el = tileEls.get(ghost.id);
      if (!el) continue;
      el.style.zIndex = "1";
      positionEl(el, ghost.row, ghost.col);
      const gEl = el;
      const gId = ghost.id;
      setTimeout(() => {
        if (gEl.parentNode) gEl.parentNode.removeChild(gEl);
        tileEls.delete(gId);
      }, 150);
    }
    game.lastAbsorbed = [];

    // 2) render / update live tiles
    const live = game.tiles();
    const seen = new Set();
    let mergeIdx = 0;
    let maxMerged = 0;
    for (const tile of live) {
      seen.add(tile.id);
      let el = tileEls.get(tile.id);
      if (!el) {
        el = createTileEl(tile);
        if (!opts.silent) {
          el.classList.add("spawn");
          setTimeout(() => el.classList.remove("spawn"), 200);
          if (opts.sound && window.Sound) Sound.spawn();
        }
      } else {
        setTileVisual(el, tile);
        positionEl(el, tile.row, tile.col);
        if (tile.mergedFrom && !opts.silent) {
          el.classList.remove("merged");
          // force reflow to restart animation
          void el.offsetWidth;
          el.classList.add("merged");
          setTimeout(() => el.classList.remove("merged"), 200);
          if (opts.sound && window.Sound) Sound.merge(tile.value, mergeIdx++);
          if (tile.value > maxMerged) maxMerged = tile.value;
        }
      }
    }

    // play one glass shatter per move when a big tile (128+) is formed
    if (!opts.silent && opts.sound && window.Sound && maxMerged >= 128) {
      Sound.glassShatter(maxMerged);
    }

    // 3) remove any stale elements (shouldn't normally happen)
    for (const [id, el] of tileEls) {
      if (!seen.has(id) && !absorbed.find((g) => g.id === id)) {
        if (el.parentNode) el.parentNode.removeChild(el);
        tileEls.delete(id);
      }
    }

    updateHud(opts);
  }

  function clearAllTiles() {
    els.tiles.innerHTML = "";
    tileEls.clear();
  }

  /* ---------- HUD ---------- */
  function updateHud(opts) {
    els.score.textContent = game.score;
    if (game.score > best) {
      best = game.score;
      localStorage.setItem(BEST_KEY, String(best));
    }
    els.best.textContent = best;

    const gained = game.score - prevScore;
    if (gained > 0 && opts && opts.showGain) {
      showScorePop(gained);
    }
    prevScore = game.score;
  }

  function showScorePop(amount) {
    const pop = document.createElement("div");
    pop.className = "score-pop";
    pop.textContent = "+" + amount;
    const card = els.score.closest(".score-card");
    card.style.position = "relative";
    pop.style.left = "50%";
    pop.style.top = "0";
    pop.style.transform = "translateX(-50%)";
    card.appendChild(pop);
    setTimeout(() => pop.remove(), 720);
  }

  /* ---------- overlays ---------- */
  function showOverlay(title, text, actions) {
    els.overlayTitle.textContent = title;
    els.overlayText.textContent = text;
    els.overlayActions.innerHTML = "";
    actions.forEach((a) => {
      const b = document.createElement("button");
      b.className = "btn " + (a.primary ? "btn-primary" : "btn-ghost-wide");
      if (!a.primary) {
        b.className = "btn btn-primary";
        b.style.background = "var(--panel)";
      }
      b.textContent = a.label;
      b.addEventListener("click", a.onClick);
      els.overlayActions.appendChild(b);
    });
    els.overlay.hidden = false;
  }

  function hideOverlay() {
    els.overlay.hidden = true;
  }

  function checkEndStates(result) {
    if (game.won && !game.keepPlaying && result && result.won) {
      if (window.Sound) Sound.win();
      showOverlay("You made 2048!", "Beautiful fusion. Keep going for a higher score?", [
        { label: "Keep Playing", primary: true, onClick: () => { if (window.Sound) Sound.click(); game.continueAfterWin(); hideOverlay(); persist(); } },
        { label: "New Game", primary: false, onClick: () => { startNew(); } },
      ]);
      return;
    }
    if (game.over) {
      if (result && result.moved && window.Sound) Sound.gameover();
      showOverlay("No more moves", "The board is full. Final score: " + game.score + ".", [
        { label: "Try Again", primary: true, onClick: () => { startNew(); } },
      ]);
    }
  }

  /* ---------- actions ---------- */
  function persist() {
    try { localStorage.setItem(STORE_KEY, game.serialize()); } catch (e) {}
  }

  function startNew() {
    if (window.Sound) { Sound.resume(); Sound.click(); }
    hideOverlay();
    clearAllTiles();
    game = new FusionGame(SIZE, WIN);
    prevScore = 0;
    render({ silent: false });
    persist();
    flashHint("New board ready — good luck!");
  }

  function doMove(dir) {
    if (!els.overlay.hidden && !(game.over || game.won)) return;
    if (window.Sound) Sound.resume();
    const result = game.move(dir);
    if (!result.moved) return;
    if (window.Sound) Sound.move();
    render({ showGain: true, sound: true });
    persist();
    checkEndStates(result);
  }

  let hintTimer = null;
  const DEFAULT_HINT = "Swipe to move tiles. Equal numbers fuse into one!";
  function flashHint(msg) {
    els.hint.textContent = msg;
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => { els.hint.textContent = DEFAULT_HINT; }, 2200);
  }

  /* ---------- input: keyboard ---------- */
  const KEY_MAP = {
    ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
    w: "up", s: "down", a: "left", d: "right",
    W: "up", S: "down", A: "left", D: "right",
  };
  window.addEventListener("keydown", (e) => {
    const dir = KEY_MAP[e.key];
    if (dir) { e.preventDefault(); doMove(dir); }
  });

  /* ---------- input: touch / swipe ---------- */
  let touchStart = null;
  const SWIPE_MIN = 24;

  els.board.addEventListener("touchstart", (e) => {
    const t = e.changedTouches[0];
    touchStart = { x: t.clientX, y: t.clientY, time: Date.now() };
  }, { passive: true });

  els.board.addEventListener("touchmove", (e) => {
    // prevent page scroll while interacting with the board
    if (touchStart) e.preventDefault();
  }, { passive: false });

  els.board.addEventListener("touchend", (e) => {
    if (!touchStart) return;
    const t = e.changedTouches[0];
    handleSwipe(t.clientX - touchStart.x, t.clientY - touchStart.y);
    touchStart = null;
  }, { passive: true });

  // Pointer-based swipe (desktop drag + fallback)
  let pointerStart = null;
  els.board.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch") return; // handled by touch events
    pointerStart = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener("pointerup", (e) => {
    if (!pointerStart) return;
    handleSwipe(e.clientX - pointerStart.x, e.clientY - pointerStart.y);
    pointerStart = null;
  });

  function handleSwipe(dx, dy) {
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (Math.max(absX, absY) < SWIPE_MIN) return;
    if (absX > absY) {
      doMove(dx > 0 ? "right" : "left");
    } else {
      doMove(dy > 0 ? "down" : "up");
    }
  }

  /* ---------- buttons ---------- */
  els.newGame.addEventListener("click", startNew);

  const ICON_ON =
    '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M4 9v6h4l5 4V5L8 9H4z"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"/></svg>';
  const ICON_OFF =
    '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M4 9v6h4l5 4V5L8 9H4z"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';

  function updateSoundIcon() {
    if (!els.soundToggle) return;
    const m = window.Sound ? Sound.muted : true;
    els.soundToggle.innerHTML = m ? ICON_OFF : ICON_ON;
    els.soundToggle.setAttribute("aria-pressed", String(!m));
    els.soundToggle.setAttribute("aria-label", m ? "Unmute sound" : "Mute sound");
    els.soundToggle.classList.toggle("is-muted", m);
  }

  if (els.soundToggle) {
    els.soundToggle.addEventListener("click", () => {
      if (window.Sound) Sound.toggle();
      updateSoundIcon();
    });
  }

  window.addEventListener("resize", sizeBoard);
  window.addEventListener("orientationchange", () => setTimeout(sizeBoard, 200));

  /* ---------- boot ---------- */
  function boot() {
    buildGridBackground();
    const saved = localStorage.getItem(STORE_KEY);
    game = saved ? FusionGame.deserialize(saved) : null;
    if (!game) game = new FusionGame(SIZE, WIN);
    prevScore = game.score;
    sizeBoard();
    updateSoundIcon();
    render({ silent: true });
    if (game.over) checkEndStates({});
  }

  boot();
})();
