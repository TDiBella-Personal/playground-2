// ============================================================
// KUNG FU 2100 — Minimal Demo
// Inspired by Steve Jackson Games' Kung Fu 2100 (1980)
// ============================================================

// --- Configuration -------------------------------------------

const CONFIG = {
    HEX_SIZE: 20,
    CANVAS_WIDTH: 940,
    CANVAS_HEIGHT: 720,
    OFFSET_X: 230,
    OFFSET_Y: 14,

    COLORS: {
        BG:             '#12121a',
        WALL_FILL:      '#1a1a2a',
        WALL_STROKE:    '#2a2a3a',
        FLOOR_FILL:     '#1a2a2a',
        FLOOR_STROKE:   '#2a4a4a',
        CORRIDOR_FILL:  '#182020',
        CORRIDOR_STROKE:'#2a3a3a',
        ENTRY_FILL:     '#1a2a1a',
        ENTRY_STROKE:   '#00ff88',
        VALID_MOVE:     'rgba(0, 255, 100, 0.25)',
        VALID_MOVE_STROKE: 'rgba(0, 255, 100, 0.5)',
        HOVER:          'rgba(255, 255, 255, 0.08)',
        SELECTION:      '#ffd740',
        TERMINATOR:     '#00e5ff',
        JANIZARY:       '#ff3d00',
        CLONEMASTER:    '#d500f9',
        TEXT:           '#b0e0e0',
        ROOM_LABEL:     'rgba(180, 220, 220, 0.18)',
    },

    SIDES: ['terminator', 'clonemaster'],
    SIDE_LABELS: { terminator: 'TERMINATOR PHASE', clonemaster: 'CLONEMASTER PHASE' },
};

// --- Hex Math (flat-top, axial coordinates) ------------------

const SQRT3 = Math.sqrt(3);

// Flat-top hex: 6 neighbor offsets in axial coords
const HEX_DIRS = [
    { q: +1, r:  0 }, { q: -1, r:  0 },
    { q:  0, r: +1 }, { q:  0, r: -1 },
    { q: +1, r: -1 }, { q: -1, r: +1 },
];

function hexToPixel(q, r) {
    const x = CONFIG.HEX_SIZE * (3 / 2 * q);
    const y = CONFIG.HEX_SIZE * (SQRT3 / 2 * q + SQRT3 * r);
    return { x: x + CONFIG.OFFSET_X, y: y + CONFIG.OFFSET_Y };
}

function pixelToHex(px, py) {
    const x = px - CONFIG.OFFSET_X;
    const y = py - CONFIG.OFFSET_Y;
    const q = (2 / 3 * x) / CONFIG.HEX_SIZE;
    const r = (-1 / 3 * x + SQRT3 / 3 * y) / CONFIG.HEX_SIZE;
    return axialRound(q, r);
}

function axialRound(fq, fr) {
    // Convert to cube, round, snap largest residual
    const fs = -fq - fr;
    let rq = Math.round(fq);
    let rr = Math.round(fr);
    let rs = Math.round(fs);

    const dq = Math.abs(rq - fq);
    const dr = Math.abs(rr - fr);
    const ds = Math.abs(rs - fs);

    if (dq > dr && dq > ds) {
        rq = -rr - rs;
    } else if (dr > ds) {
        rr = -rq - rs;
    }
    // else rs = -rq - rr (implicit, we don't need s)

    return { q: rq, r: rr };
}

function hexDistance(a, b) {
    const dq = a.q - b.q;
    const dr = a.r - b.r;
    const ds = (-a.q - a.r) - (-b.q - b.r);
    return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds));
}

function hexNeighbors(q, r) {
    return HEX_DIRS.map(d => ({ q: q + d.q, r: r + d.r }));
}

function hexCorners(cx, cy, size) {
    const corners = [];
    for (let i = 0; i < 6; i++) {
        const angleDeg = 60 * i;
        const angleRad = Math.PI / 180 * angleDeg;
        corners.push({
            x: cx + size * Math.cos(angleRad),
            y: cy + size * Math.sin(angleRad),
        });
    }
    return corners;
}

function drawHex(ctx, cx, cy, size, fillColor, strokeColor, lineWidth) {
    const corners = hexCorners(cx, cy, size);
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 6; i++) {
        ctx.lineTo(corners[i].x, corners[i].y);
    }
    ctx.closePath();
    if (fillColor) {
        ctx.fillStyle = fillColor;
        ctx.fill();
    }
    if (strokeColor) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth || 1;
        ctx.stroke();
    }
}

function hexKey(q, r) {
    return q + ',' + r;
}

// --- Map Building --------------------------------------------

function buildFortressMap() {
    const map = new Map();

    // Helper: add a rectangular-ish block of floor hexes
    function addRoom(q0, r0, w, h, roomName) {
        for (let dq = 0; dq < w; dq++) {
            for (let dr = 0; dr < h; dr++) {
                map.set(hexKey(q0 + dq, r0 + dr), {
                    terrain: 'floor',
                    room: roomName,
                });
            }
        }
    }

    // Helper: add a single corridor hex
    function addCorridorHex(q, r) {
        if (!map.has(hexKey(q, r))) {
            map.set(hexKey(q, r), { terrain: 'corridor', room: null });
        }
    }

    // Helper: add entry hex
    function addEntry(q, r) {
        map.set(hexKey(q, r), { terrain: 'entry', room: 'entry' });
    }

    // === Rooms ===

    // Entry Hall (top center) — 5 wide, 2 tall
    addRoom(6, 0, 5, 2, 'Entry Hall');

    // Barracks (top-left) — 4 wide, 3 tall
    addRoom(1, 2, 4, 3, 'Barracks');

    // Armory (top-right) — 4 wide, 3 tall
    addRoom(12, 2, 4, 3, 'Armory');

    // Great Hall (center) — 6 wide, 3 tall
    addRoom(5, 5, 7, 3, 'Great Hall');

    // Guard Post West — 3 wide, 2 tall
    addRoom(1, 8, 3, 2, 'Guard Post');

    // Guard Post East — 3 wide, 2 tall
    addRoom(13, 8, 3, 2, 'Guard Post');

    // Clone Chamber (bottom center) — 6 wide, 3 tall
    addRoom(5, 10, 7, 3, 'Clone Chamber');

    // Exit Hall (bottom) — 3 wide, 1 tall
    addRoom(7, 13, 3, 1, 'Exit Hall');

    // === Entry points ===
    addEntry(6, 0);
    addEntry(10, 0);
    addEntry(8, 13);

    // === Corridors ===

    // Entry Hall down to Barracks area
    addCorridorHex(5, 2);
    addCorridorHex(5, 1);

    // Entry Hall down to Armory area
    addCorridorHex(11, 2);
    addCorridorHex(11, 1);

    // Entry Hall down to Great Hall
    addCorridorHex(8, 2);
    addCorridorHex(8, 3);
    addCorridorHex(8, 4);

    // Barracks south to Great Hall connector
    addCorridorHex(4, 5);
    addCorridorHex(4, 4);
    addCorridorHex(3, 5);

    // Armory south to Great Hall connector
    addCorridorHex(12, 5);
    addCorridorHex(12, 4);
    addCorridorHex(13, 5);

    // Great Hall west to Guard Post West
    addCorridorHex(4, 7);
    addCorridorHex(4, 8);
    addCorridorHex(3, 8);
    addCorridorHex(4, 6);

    // Great Hall east to Guard Post East
    addCorridorHex(12, 7);
    addCorridorHex(12, 8);
    addCorridorHex(13, 7);
    addCorridorHex(12, 6);

    // Great Hall south to Clone Chamber
    addCorridorHex(8, 8);
    addCorridorHex(8, 9);

    // Clone Chamber south to Exit Hall
    addCorridorHex(8, 12);

    // === Wall border ===
    addWallBorder(map);

    return map;
}

function addWallBorder(map) {
    const wallHexes = [];
    for (const [key, cell] of map) {
        if (cell.terrain === 'wall') continue;
        const parts = key.split(',');
        const q = parseInt(parts[0]);
        const r = parseInt(parts[1]);
        const neighbors = hexNeighbors(q, r);
        for (const n of neighbors) {
            const nk = hexKey(n.q, n.r);
            if (!map.has(nk)) {
                wallHexes.push(nk);
            }
        }
    }
    for (const wk of wallHexes) {
        if (!map.has(wk)) {
            map.set(wk, { terrain: 'wall', room: null });
        }
    }
}

function isWalkable(map, q, r) {
    const cell = map.get(hexKey(q, r));
    return cell && cell.terrain !== 'wall';
}

// --- Units ---------------------------------------------------

function createUnits() {
    return [
        { id: 'T1', type: 'terminator',  name: 'Ryu',  label: 'R', q: 7, r: 0,  side: 'terminator' },
        { id: 'T2', type: 'terminator',  name: 'Kira', label: 'K', q: 9, r: 0,  side: 'terminator' },
        { id: 'T3', type: 'terminator',  name: 'Zhen', label: 'Z', q: 8, r: 13, side: 'terminator' },
        { id: 'J1', type: 'janizary',    name: 'Jelly', label: 'J', q: 2, r: 3, side: 'clonemaster' },
        { id: 'J2', type: 'janizary',    name: 'Jelly', label: 'J', q: 13, r: 3, side: 'clonemaster' },
        { id: 'J3', type: 'janizary',    name: 'Jelly', label: 'J', q: 2, r: 8, side: 'clonemaster' },
        { id: 'J4', type: 'janizary',    name: 'Jelly', label: 'J', q: 14, r: 8, side: 'clonemaster' },
        { id: 'CM', type: 'clonemaster', name: 'CloneMaster', label: 'CM', q: 8, r: 11, side: 'clonemaster' },
    ];
}

function getUnitAt(units, q, r) {
    return units.find(u => u.q === q && u.r === r) || null;
}

function getValidMoves(map, units, unit) {
    const neighbors = hexNeighbors(unit.q, unit.r);
    return neighbors.filter(n => {
        if (!isWalkable(map, n.q, n.r)) return false;
        if (getUnitAt(units, n.q, n.r)) return false;
        return true;
    });
}

// --- Game State -----------------------------------------------

const gameState = {
    map: null,
    units: null,
    phase: 'selectUnit',     // 'selectUnit' | 'selectDestination'
    selectedUnit: null,
    validMoves: [],
    hoveredHex: null,
    turn: {
        round: 1,
        sideIndex: 0,
        movedUnits: new Set(),
    },
    animTime: 0,
};

function currentSide() {
    return CONFIG.SIDES[gameState.turn.sideIndex];
}

function endTurn() {
    gameState.phase = 'selectUnit';
    gameState.selectedUnit = null;
    gameState.validMoves = [];
    gameState.turn.movedUnits.clear();
    gameState.turn.sideIndex = (gameState.turn.sideIndex + 1) % 2;
    if (gameState.turn.sideIndex === 0) {
        gameState.turn.round++;
    }
    updateHUD();
}

// --- Input Handling -------------------------------------------

function handleClick(q, r) {
    const { map, units } = gameState;
    const side = currentSide();

    if (gameState.phase === 'selectUnit') {
        const unit = getUnitAt(units, q, r);
        if (unit && unit.side === side && !gameState.turn.movedUnits.has(unit.id)) {
            selectUnit(unit);
        }
    } else if (gameState.phase === 'selectDestination') {
        // Check if clicking the selected unit again (deselect)
        if (gameState.selectedUnit.q === q && gameState.selectedUnit.r === r) {
            deselectUnit();
            return;
        }

        // Check if clicking another friendly unit (switch selection)
        const unit = getUnitAt(units, q, r);
        if (unit && unit.side === side && !gameState.turn.movedUnits.has(unit.id)) {
            selectUnit(unit);
            return;
        }

        // Check if clicking a valid move hex
        const isValid = gameState.validMoves.some(m => m.q === q && m.r === r);
        if (isValid) {
            executeMove(gameState.selectedUnit, q, r);
        }
    }
}

function selectUnit(unit) {
    gameState.selectedUnit = unit;
    gameState.validMoves = getValidMoves(gameState.map, gameState.units, unit);
    gameState.phase = 'selectDestination';
    updateHUD();
}

function deselectUnit() {
    gameState.selectedUnit = null;
    gameState.validMoves = [];
    gameState.phase = 'selectUnit';
    updateHUD();
}

function executeMove(unit, q, r) {
    unit.q = q;
    unit.r = r;
    gameState.turn.movedUnits.add(unit.id);
    deselectUnit();
}

function handleHover(px, py) {
    const hex = pixelToHex(px, py);
    const prev = gameState.hoveredHex;
    if (!prev || prev.q !== hex.q || prev.r !== hex.r) {
        gameState.hoveredHex = hex;
    }
}

// --- Rendering ------------------------------------------------

let ctx;
let canvas;

function render() {
    // Clear
    ctx.fillStyle = CONFIG.COLORS.BG;
    ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

    renderMap();
    renderHighlights();
    renderRoomLabels();
    renderUnits();
    renderSelection();
}

function renderMap() {
    for (const [key, cell] of gameState.map) {
        const parts = key.split(',');
        const q = parseInt(parts[0]);
        const r = parseInt(parts[1]);
        const pos = hexToPixel(q, r);

        let fill, stroke;
        switch (cell.terrain) {
            case 'floor':
                fill = CONFIG.COLORS.FLOOR_FILL;
                stroke = CONFIG.COLORS.FLOOR_STROKE;
                break;
            case 'corridor':
                fill = CONFIG.COLORS.CORRIDOR_FILL;
                stroke = CONFIG.COLORS.CORRIDOR_STROKE;
                break;
            case 'wall':
                fill = CONFIG.COLORS.WALL_FILL;
                stroke = CONFIG.COLORS.WALL_STROKE;
                break;
            case 'entry':
                fill = CONFIG.COLORS.ENTRY_FILL;
                stroke = CONFIG.COLORS.ENTRY_STROKE;
                break;
        }

        drawHex(ctx, pos.x, pos.y, CONFIG.HEX_SIZE, fill, stroke, cell.terrain === 'entry' ? 2 : 1);
    }
}

function renderHighlights() {
    // Hover highlight
    if (gameState.hoveredHex) {
        const hk = hexKey(gameState.hoveredHex.q, gameState.hoveredHex.r);
        if (gameState.map.has(hk)) {
            const cell = gameState.map.get(hk);
            if (cell.terrain !== 'wall') {
                const pos = hexToPixel(gameState.hoveredHex.q, gameState.hoveredHex.r);
                drawHex(ctx, pos.x, pos.y, CONFIG.HEX_SIZE, CONFIG.COLORS.HOVER, null);
            }
        }
    }

    // Valid move highlights
    for (const m of gameState.validMoves) {
        const pos = hexToPixel(m.q, m.r);
        drawHex(ctx, pos.x, pos.y, CONFIG.HEX_SIZE, CONFIG.COLORS.VALID_MOVE, CONFIG.COLORS.VALID_MOVE_STROKE, 2);
    }
}

function renderRoomLabels() {
    // Collect room centers
    const roomHexes = {};
    for (const [key, cell] of gameState.map) {
        if (cell.room && cell.terrain === 'floor') {
            if (!roomHexes[cell.room]) roomHexes[cell.room] = [];
            const parts = key.split(',');
            roomHexes[cell.room].push({
                q: parseInt(parts[0]),
                r: parseInt(parts[1]),
            });
        }
    }

    ctx.font = '8px Courier New';
    ctx.fillStyle = CONFIG.COLORS.ROOM_LABEL;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const [room, hexes] of Object.entries(roomHexes)) {
        if (room === 'entry') continue;
        // Average position
        let sx = 0, sy = 0;
        for (const h of hexes) {
            const p = hexToPixel(h.q, h.r);
            sx += p.x;
            sy += p.y;
        }
        ctx.fillText(room.toUpperCase(), sx / hexes.length, sy / hexes.length);
    }
}

function renderUnits() {
    const side = currentSide();

    for (const unit of gameState.units) {
        const pos = hexToPixel(unit.q, unit.r);
        const isMoved = gameState.turn.movedUnits.has(unit.id);
        const isCurrentSide = unit.side === side;

        let color;
        switch (unit.type) {
            case 'terminator':  color = CONFIG.COLORS.TERMINATOR; break;
            case 'janizary':    color = CONFIG.COLORS.JANIZARY; break;
            case 'clonemaster': color = CONFIG.COLORS.CLONEMASTER; break;
        }

        const radius = unit.type === 'clonemaster' ? CONFIG.HEX_SIZE * 0.45
                      : unit.type === 'terminator' ? CONFIG.HEX_SIZE * 0.4
                      : CONFIG.HEX_SIZE * 0.35;

        // Dim units that have already moved or belong to inactive side
        const alpha = (!isCurrentSide || isMoved) ? 0.4 : 1.0;

        // Glow for clonemaster
        if (unit.type === 'clonemaster' && alpha === 1.0) {
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, radius + 4, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(213, 0, 249, 0.15)';
            ctx.fill();
        }

        // Unit circle
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = colorWithAlpha(color, alpha * 0.3);
        ctx.fill();
        ctx.strokeStyle = colorWithAlpha(color, alpha);
        ctx.lineWidth = 2;
        ctx.stroke();

        // Label
        ctx.font = unit.type === 'clonemaster' ? 'bold 7px Courier New' : 'bold 9px Courier New';
        ctx.fillStyle = colorWithAlpha(color, alpha);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(unit.label, pos.x, pos.y);
    }
}

function renderSelection() {
    if (!gameState.selectedUnit) return;

    const unit = gameState.selectedUnit;
    const pos = hexToPixel(unit.q, unit.r);
    const radius = (unit.type === 'clonemaster' ? CONFIG.HEX_SIZE * 0.45
                  : unit.type === 'terminator' ? CONFIG.HEX_SIZE * 0.4
                  : CONFIG.HEX_SIZE * 0.35) + 4;

    // Pulsing selection ring
    const pulse = 0.6 + 0.4 * Math.sin(gameState.animTime * 4);

    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = colorWithAlpha(CONFIG.COLORS.SELECTION, pulse);
    ctx.lineWidth = 2.5;
    ctx.stroke();
}

function colorWithAlpha(hexColor, alpha) {
    // Convert #rrggbb to rgba
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// --- HUD Update -----------------------------------------------

function updateHUD() {
    const side = currentSide();
    const roundEl = document.getElementById('round-display');
    const turnEl = document.getElementById('turn-display');
    const instrEl = document.getElementById('instructions');

    roundEl.textContent = 'Round ' + gameState.turn.round;
    turnEl.textContent = CONFIG.SIDE_LABELS[side];
    turnEl.className = side;

    if (gameState.phase === 'selectUnit') {
        instrEl.textContent = 'Select a unit to move';
    } else if (gameState.phase === 'selectDestination') {
        instrEl.textContent = 'Click a highlighted hex to move, or click unit to deselect';
    }
}

// --- Initialization -------------------------------------------

function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');

    // High-DPI support
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CONFIG.CANVAS_WIDTH * dpr;
    canvas.height = CONFIG.CANVAS_HEIGHT * dpr;
    canvas.style.width = CONFIG.CANVAS_WIDTH + 'px';
    canvas.style.height = CONFIG.CANVAS_HEIGHT + 'px';
    ctx.scale(dpr, dpr);

    // Build game
    gameState.map = buildFortressMap();
    gameState.units = createUnits();

    // Event listeners
    canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();
        const px = (e.clientX - rect.left) * (CONFIG.CANVAS_WIDTH / rect.width);
        const py = (e.clientY - rect.top) * (CONFIG.CANVAS_HEIGHT / rect.height);
        const hex = pixelToHex(px, py);
        handleClick(hex.q, hex.r);
    });

    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const px = (e.clientX - rect.left) * (CONFIG.CANVAS_WIDTH / rect.width);
        const py = (e.clientY - rect.top) * (CONFIG.CANVAS_HEIGHT / rect.height);
        handleHover(px, py);
    });

    document.getElementById('endTurnBtn').addEventListener('click', endTurn);

    // HUD initial state
    updateHUD();

    // Animation loop
    function animate(timestamp) {
        gameState.animTime = timestamp / 1000;
        render();
        requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
}

window.addEventListener('DOMContentLoaded', init);
