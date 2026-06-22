/* ===========================================================
   Fusion — core game engine (framework-free)
   Each tile keeps a stable id so the UI can animate movement.
   =========================================================== */
(function (global) {
  "use strict";

  let TILE_SEQ = 1;

  function makeTile(value, row, col) {
    return {
      id: TILE_SEQ++,
      value: value,
      row: row,
      col: col,
      // transient flags used by the renderer
      isNew: true,
      mergedFrom: null,
    };
  }

  class Game {
    constructor(size = 4, winValue = 2048) {
      this.size = size;
      this.winValue = winValue;
      this.reset();
    }

    reset() {
      this.grid = this._emptyGrid();
      this.score = 0;
      this.over = false;
      this.won = false;
      this.keepPlaying = false;
      this.lastAbsorbed = [];
      this._addRandomTile();
      this._addRandomTile();
      return this;
    }

    _emptyGrid() {
      const g = [];
      for (let r = 0; r < this.size; r++) {
        g.push(new Array(this.size).fill(null));
      }
      return g;
    }

    _emptyCells() {
      const cells = [];
      for (let r = 0; r < this.size; r++) {
        for (let c = 0; c < this.size; c++) {
          if (!this.grid[r][c]) cells.push({ r, c });
        }
      }
      return cells;
    }

    _addRandomTile() {
      const empties = this._emptyCells();
      if (!empties.length) return null;
      const { r, c } = empties[Math.floor(Math.random() * empties.length)];
      const value = Math.random() < 0.9 ? 2 : 4;
      const tile = makeTile(value, r, c);
      this.grid[r][c] = tile;
      return tile;
    }

    /* Direction vectors */
    _vector(dir) {
      switch (dir) {
        case "up": return { r: -1, c: 0 };
        case "down": return { r: 1, c: 0 };
        case "left": return { r: 0, c: -1 };
        case "right": return { r: 0, c: 1 };
        default: return { r: 0, c: 0 };
      }
    }

    // Build traversal order so we always process tiles in the
    // direction of motion first.
    _traversals(dir) {
      const order = [];
      for (let i = 0; i < this.size; i++) order.push(i);
      const rows = dir === "down" ? order.slice().reverse() : order.slice();
      const cols = dir === "right" ? order.slice().reverse() : order.slice();
      return { rows, cols };
    }

    _findFarthest(r, c, v) {
      let prev;
      let cur = { r, c };
      do {
        prev = cur;
        cur = { r: prev.r + v.r, c: prev.c + v.c };
      } while (this._inBounds(cur.r, cur.c) && !this.grid[cur.r][cur.c]);
      return { farthest: prev, next: cur };
    }

    _inBounds(r, c) {
      return r >= 0 && r < this.size && c >= 0 && c < this.size;
    }

    _clearFlags() {
      for (let r = 0; r < this.size; r++) {
        for (let c = 0; c < this.size; c++) {
          const t = this.grid[r][c];
          if (t) { t.isNew = false; t.mergedFrom = null; }
        }
      }
    }

    /**
     * Attempt a move. Returns an object describing what happened:
     * { moved, gained, spawned, won }
     */
    move(dir) {
      if (this.over && !this.keepPlaying) return { moved: false };
      const v = this._vector(dir);
      const { rows, cols } = this._traversals(dir);

      this._clearFlags();
      let moved = false;
      let gained = 0;
      const mergedThisMove = {}; // guards against double merges
      this.lastAbsorbed = []; // tiles that merged away this move (for animation)

      for (const r of rows) {
        for (const c of cols) {
          const tile = this.grid[r][c];
          if (!tile) continue;

          const { farthest, next } = this._findFarthest(r, c, v);
          const nextTile = this._inBounds(next.r, next.c) ? this.grid[next.r][next.c] : null;
          const nextKey = next.r + "," + next.c;

          if (
            nextTile &&
            nextTile.value === tile.value &&
            !mergedThisMove[nextKey]
          ) {
            // merge tile into nextTile
            const newValue = tile.value * 2;
            nextTile.value = newValue;
            nextTile.mergedFrom = [tile.id, nextTile.id];
            mergedThisMove[nextKey] = true;

            // remove the moving tile from its old cell
            this.grid[r][c] = null;
            // moving tile visually slides to nextTile's cell
            tile.row = next.r;
            tile.col = next.c;
            tile._absorbedInto = nextTile.id;
            this.lastAbsorbed.push(tile);

            gained += newValue;
            moved = true;

            if (newValue === this.winValue && !this.won) {
              this.won = true;
            }
          } else {
            // just move to farthest empty
            if (farthest.r !== r || farthest.c !== c) {
              this.grid[r][c] = null;
              this.grid[farthest.r][farthest.c] = tile;
              tile.row = farthest.r;
              tile.col = farthest.c;
              moved = true;
            }
          }
        }
      }

      let spawned = null;
      if (moved) {
        this.score += gained;
        spawned = this._addRandomTile();
        if (!this._movesAvailable()) {
          this.over = true;
        }
      }

      return { moved, gained, spawned, won: this.won, over: this.over };
    }

    _movesAvailable() {
      if (this._emptyCells().length) return true;
      // any adjacent equal pair?
      for (let r = 0; r < this.size; r++) {
        for (let c = 0; c < this.size; c++) {
          const t = this.grid[r][c];
          if (!t) continue;
          for (const dir of ["up", "down", "left", "right"]) {
            const v = this._vector(dir);
            const nr = r + v.r, nc = c + v.c;
            if (this._inBounds(nr, nc)) {
              const o = this.grid[nr][nc];
              if (o && o.value === t.value) return true;
            }
          }
        }
      }
      return false;
    }

    // All live tiles (for rendering)
    tiles() {
      const out = [];
      for (let r = 0; r < this.size; r++) {
        for (let c = 0; c < this.size; c++) {
          if (this.grid[r][c]) out.push(this.grid[r][c]);
        }
      }
      return out;
    }

    continueAfterWin() {
      this.keepPlaying = true;
      this.over = false;
    }

    serialize() {
      return JSON.stringify({
        size: this.size,
        winValue: this.winValue,
        score: this.score,
        won: this.won,
        keepPlaying: this.keepPlaying,
        over: this.over,
        seq: TILE_SEQ,
        grid: this.grid.map((row) =>
          row.map((t) => (t ? { id: t.id, value: t.value, row: t.row, col: t.col } : null))
        ),
      });
    }

    static deserialize(str) {
      try {
        const data = JSON.parse(str);
        const g = new Game(data.size || 4, data.winValue || 2048);
        g.score = data.score || 0;
        g.won = !!data.won;
        g.keepPlaying = !!data.keepPlaying;
        g.over = !!data.over;
        TILE_SEQ = Math.max(TILE_SEQ, data.seq || 1);
        g.grid = data.grid.map((row) =>
          row.map((t) => (t ? { ...t, isNew: false, mergedFrom: null } : null))
        );
        if (!g.tiles().length) return new Game(data.size || 4, data.winValue || 2048);
        return g;
      } catch (e) {
        return null;
      }
    }
  }

  global.FusionGame = Game;
})(window);
