// ============================================================
// KUNG FU 2100 — Faithful Recreation
// Based on rules by B. Dennis Sustare (Steve Jackson Games, 1980)
// ============================================================

// --- Section 1: Configuration & Constants --------------------

const CONFIG = {
    CELL: 22,
    W: 940,
    H: 720,
    LOWER: { x: 15, y: 52 },
    UPPER: { x: 365, y: 52 },
    PANEL_X: 630,
    MAX_TURNS: 10,
    COLORS: {
        BG:          '#0d0d14',
        FLOOR:       '#1a2a2a',
        FLOOR_STROKE:'#2a4a4a',
        CORRIDOR:    '#182020',
        WALL:        '#8899aa',
        DOOR_NORMAL: '#556655',
        DOOR_ARMORED:'#cc6600',
        DOOR_DESTROYED:'#443333',
        EQUIP_OK:    '#76ff03',
        EQUIP_DEAD:  '#4a2a2a',
        HOVER:       'rgba(255,255,255,0.12)',
        VALID:       'rgba(0,255,100,0.3)',
        VALID_STROKE:'rgba(0,255,100,0.6)',
        SELECTION:   '#ffd740',
        TERMINATOR:  '#00e5ff',
        JELLY:       '#ff3d00',
        CLONEMASTER: '#d500f9',
        TECH:        '#78909c',
        ARMED_TECH:  '#b0bec5',
        SERVANT:     '#8d6e63',
        LC:          '#ffc107',
        FACEDOWN:    '#5c5c6c',
        TEXT:        '#b0e0e0',
        LABEL:       'rgba(180,220,220,0.22)',
        OVERLOOK:    'rgba(255,200,0,0.4)',
    },
};

const PHASE = {
    TERM_MOVE_1: 0, COMBAT_1: 1, TERM_MOVE_2: 2,
    CM_MOVE: 3, COMBAT_2: 4, RECOVERY: 5, ADVANCE: 6,
};
const PHASE_NAMES = [
    'TERMINATOR MOVE 1','COMBAT 1','TERMINATOR MOVE 2',
    'CLONEMASTER MOVE','COMBAT 2','RECOVERY','ADVANCE TURN',
];

const CRT = {
    fist:   { helpless:5, inactive:4, fist:3, kick:3, soul:0, mist:1 },
    kick:   { helpless:5, inactive:4, fist:3, kick:3, soul:1, mist:0 },
    weapon: { helpless:4, inactive:3, fist:2, kick:2, soul:1, mist:1 },
    spikes: { helpless:3, inactive:3, fist:3, kick:3, soul:3, mist:1 },
    gun:    { helpless:6, inactive:3, fist:0, kick:0, soul:0, mist:0 },
};

const JELLY_PRESETS = {
    1:  { fist:1, kick:2, soul:0, mist:0, heart:1 },
    2:  { fist:0, kick:1, soul:0, mist:1, heart:1 },
    3:  { fist:1, kick:1, soul:1, mist:0, heart:0 },
    4:  { fist:2, kick:0, soul:0, mist:1, heart:0 },
    5:  { fist:0, kick:2, soul:1, mist:0, heart:0 },
    6:  { fist:1, kick:1, soul:0, mist:1, heart:0 },
    7:  { fist:1, kick:1, soul:1, mist:1, heart:0 },
    8:  { fist:2, kick:1, soul:0, mist:0, heart:1 },
    9:  { fist:0, kick:2, soul:0, mist:1, heart:0 },
    10: { fist:1, kick:1, soul:1, mist:0, heart:0 },
};
const JELLY_WEAPONS = { 5:'spikes', 7:'spikes', 9:'weapon', 10:'weapon' };

// --- Section 2: Grid Math ------------------------------------

function cellKey(level, x, y) { return level + ':' + x + ',' + y; }

function parseCellKey(key) {
    const i = key.indexOf(':');
    const level = key.substring(0, i);
    const parts = key.substring(i + 1).split(',');
    return { level, x: +parts[0], y: +parts[1] };
}

function edgeKey(l1, x1, y1, l2, x2, y2) {
    const a = cellKey(l1, x1, y1);
    const b = cellKey(l2, x2, y2);
    return a < b ? a + '|' + b : b + '|' + a;
}

function cellToPixel(level, x, y) {
    const o = level === 'lower' ? CONFIG.LOWER : CONFIG.UPPER;
    return {
        px: o.x + x * CONFIG.CELL + CONFIG.CELL / 2,
        py: o.y + y * CONFIG.CELL + CONFIG.CELL / 2,
    };
}

function pixelToCell(px, py) {
    for (const level of ['lower', 'upper']) {
        const o = level === 'lower' ? CONFIG.LOWER : CONFIG.UPPER;
        const x = Math.floor((px - o.x) / CONFIG.CELL);
        const y = Math.floor((py - o.y) / CONFIG.CELL);
        if (x >= 0 && y >= 0 && gameState.map.cells.has(cellKey(level, x, y))) {
            return { level, x, y };
        }
    }
    return null;
}

function sameCell(a, b) {
    return a && b && a.level === b.level && a.x === b.x && a.y === b.y;
}

// --- Section 3: Map Builder ----------------------------------

// LOWER LEVEL: 14 cols (0-13) x 16 rows (0-15)
const LOWER_ROOMS = [
    ['Servants Quarters',    0, 0, 3, 3, 'S'],     // (0-2, 0-2)
    ['Dining Area',          3, 0, 3, 3, 'STJ'],    // (3-5, 0-2)
    ['Kitchen',              6, 0, 2, 3, ''],        // (6-7, 0-2)
    ['Loo 1',                8, 0, 2, 3, ''],        // (8-9, 0-2)
    ['Jelly Jar',           10, 0, 3, 3, 'J'],      // (10-12, 0-2)
    ['Jelly Ready Room',    13, 0, 1, 3, 'J'],      // (13, 0-2)
    ['Lower Main Corridor',  0, 3, 13, 1, 'STJ'],   // (0-12, 3)
    ['Overlook Corridor',   13, 3, 1, 13, ''],      // (13, 3-15)
    ['Entry Corridor',       0, 4, 1, 5, ''],        // (0, 4-8)
    ['Guard Station',        1, 4, 2, 3, 'J'],      // (1-2, 4-6)
    ['Loo 2',                3, 4, 2, 2, ''],        // (3-4, 4-5)
    ['Electronic Repair',    5, 4, 2, 3, ''],        // (5-6, 4-6)
    ['Central',              8, 4, 5, 5, 'T'],      // (8-12, 4-8)
    ['Technicians Quarters', 1, 9, 3, 2, 'T'],      // (1-3, 9-10)
    ['Loo 3',                4, 9, 2, 2, ''],        // (4-5, 9-10)
    ['Main Bio Lab',         0,12, 4, 4, 'TJ'],     // (0-3, 12-15)
    ['Lab Access Corridor',  4,12, 1, 4, ''],        // (4, 12-15)
    ['Nucleic Surgery',      5,12, 3, 3, 'TJ'],     // (5-7, 12-14)
    ['Biochemistry',         8,12, 5, 4, 'T'],      // (8-12, 12-15)
];

// UPPER LEVEL: 15 cols (0-14) x 10 rows (0-9)
const UPPER_ROOMS = [
    ['Computer Room',        0, 0, 3, 3, 'T'],      // (0-2, 0-2)
    ['Loo 4',                4, 0, 2, 3, ''],        // (4-5, 0-2)
    ['Loo 5',                7, 0, 2, 3, ''],        // (7-8, 0-2)
    ['Servants Work Area',   0, 3, 3, 3, ''],        // (0-2, 3-5)
    ['CM Bedroom',           3, 3, 3, 3, ''],        // (3-5, 3-5)
    ['CM Library',           6, 3, 3, 3, ''],        // (6-8, 3-5)
    ['Dining Nook',          9, 3, 2, 3, 'S'],       // (9-10, 3-5)
    ['Upper Main Corridor',  0, 6, 11, 1, 'SJ'],    // (0-10, 6)
    ['Tele-Recording',       0, 7, 3, 3, 'T'],      // (0-2, 7-9)
    ['Growth Chamber',       4, 7, 3, 3, 'T'],      // (4-6, 7-9)
    ['Exercise Area',        8, 7, 3, 3, 'SJ'],     // (8-10, 7-9)
];

const LOWER_CORRIDORS = [
    [7, 5],                        // bridge ER to Central
    [0, 9], [0, 10], [0, 11],     // bridge EC down to MBL
    [1, 11], [2, 11],             // bridge TQ down to MBL
    [5, 11],                       // bridge L3 down to NS
    [8, 9], [8, 10], [8, 11],    // bridge Central down to Bio
];

const UPPER_CORRIDORS = [];

const LOWER_DOORS = [
    // Top rooms to each other (horizontal)
    [2,1, 3,1, ''],      // SQ ↔ DA
    [5,1, 6,1, ''],      // DA ↔ Kitchen
    [7,1, 8,1, ''],      // Kitchen ↔ Loo 1
    [9,1, 10,1, ''],     // Loo 1 ↔ Jelly Jar
    [12,1, 13,1, ''],    // Jelly Jar ↔ JRR
    // Top rooms to LMC (vertical y=2→3)
    [1,2, 1,3, ''],      // SQ
    [4,2, 4,3, ''],      // DA
    [7,2, 7,3, ''],      // Kitchen
    [8,2, 8,3, ''],      // Loo 1
    [11,2, 11,3, ''],    // Jelly Jar
    // JRR to OC
    [13,2, 13,3, ''],
    // LMC to OC (horizontal)
    [12,3, 13,3, ''],
    // LMC to rooms below (vertical y=3→4)
    [0,3, 0,4, ''],      // LMC ↔ EC
    [1,3, 1,4, ''],      // LMC ↔ GS
    [3,3, 3,4, ''],      // LMC ↔ Loo 2
    [5,3, 5,4, ''],      // LMC ↔ ER
    [8,3, 8,4, ''],      // LMC ↔ Central
    // Middle rooms to each other (horizontal)
    [0,5, 1,5, ''],      // EC ↔ GS
    [2,5, 3,5, ''],      // GS ↔ Loo 2
    [4,5, 5,5, ''],      // Loo 2 ↔ ER
    [6,5, 7,5, ''],      // ER ↔ corridor(7,5)
    [7,5, 8,5, ''],      // corridor(7,5) ↔ Central
    // EC down to corridors
    [0,8, 0,9, ''],      // EC ↔ corridor(0,9)
    [0,11, 0,12, ''],    // corridor ↔ MBL
    // TQ connections
    [0,9, 1,9, ''],      // corridor ↔ TQ
    [1,10, 1,11, ''],    // TQ ↔ corridor(1,11)
    [1,11, 1,12, ''],    // corridor ↔ MBL
    // TQ ↔ Loo 3
    [3,9, 4,9, ''],
    // Loo 3 ↔ corridor down
    [5,10, 5,11, ''],    // L3 ↔ corridor(5,11)
    [5,11, 5,12, ''],    // corridor ↔ NS
    // Central down via corridors
    [8,8, 8,9, ''],      // Central ↔ corridor(8,9)
    [8,11, 8,12, ''],    // corridor ↔ Bio
    // Bottom rooms to each other (horizontal)
    [3,13, 4,13, ''],    // MBL ↔ LAC
    [4,13, 5,13, ''],    // LAC ↔ NS
    [7,13, 8,13, ''],    // NS ↔ Bio
    // Bio to OC
    [12,13, 13,13, ''],  // Bio ↔ OC
];

const UPPER_DOORS = [
    // Top to middle (vertical y=2→3)
    [1,2, 1,3, ''],      // CompRoom ↔ SWA
    [4,2, 4,3, ''],      // Loo 4 ↔ CMBed
    [7,2, 7,3, ''],      // Loo 5 ↔ CMLi
    // Middle rooms to each other (horizontal)
    [2,4, 3,4, ''],      // SWA ↔ CMBed
    [5,4, 6,4, ''],      // CMBed ↔ CMLi
    [8,4, 9,4, ''],      // CMLi ↔ DinNook
    // Middle to UMC (vertical y=5→6)
    [1,5, 1,6, ''],      // SWA ↔ UMC
    [4,5, 4,6, ''],      // CMBed ↔ UMC
    [7,5, 7,6, ''],      // CMLi ↔ UMC
    [10,5, 10,6, ''],    // DinNook ↔ UMC
    // UMC to bottom (vertical y=6→7)
    [1,6, 1,7, ''],      // UMC ↔ TeleRec
    [5,6, 5,7, ''],      // UMC ↔ Growth
    [9,6, 9,7, ''],      // UMC ↔ Exercise
];

const ARMORED_DOORS = [
    ['lower', 0, 6, -1, 6],
];

const EQUIPMENT_DEFS = [
    ['lower', 1, 13, 'clone_tank'], ['lower', 1, 14, 'clone_tank'],
    ['lower', 3, 14, 'clone_tank'],
    ['lower', 10, 14, 'computer'],
    ['upper', 1, 1, 'computer'], ['upper', 2, 1, 'computer'],
    ['upper', 5, 8, 'clone_tank'],
];

const ENTRY_DEFS = [
    { name:'Front Door', level:'lower', x:0, y:6, rate:3, armored:true },
    { name:'Sewage Outlet', level:'lower', x:8, y:0, rate:1, armored:false },
    { name:'Garbage Disp.', level:'lower', x:6, y:0, rate:2, armored:false },
    { name:'Loo 2 Sewer', level:'lower', x:4, y:5, rate:1, armored:false },
    { name:'Loo 3 Sewer', level:'lower', x:5, y:10, rate:1, armored:false },
];

const CROSS_LEVEL_LINKS = [
    { lower:{x:13, y:3}, upper:{x:0, y:0} },
    { lower:{x:13, y:6}, upper:{x:0, y:6} },
];

const OVERLOOK_RANGE = { x: 12, yMin: 4, yMax: 8 };

function buildFortressMap() {
    const map = {
        cells: new Map(),
        walls: new Set(),
        doors: new Map(),
        equipment: new Map(),
        entryPoints: ENTRY_DEFS,
        overlookEdges: new Set(),
    };

    function addRoom(name, level, x0, y0, w, h, setup) {
        for (let x = x0; x < x0 + w; x++) {
            for (let y = y0; y < y0 + h; y++) {
                map.cells.set(cellKey(level, x, y), {
                    room: name, level, terrain: 'floor', setupTypes: setup,
                });
            }
        }
    }

    function addCorridor(level, x, y) {
        const k = cellKey(level, x, y);
        if (!map.cells.has(k)) {
            map.cells.set(k, { room: 'corridor', level, terrain: 'corridor', setupTypes: '' });
        }
    }

    LOWER_ROOMS.forEach(r => addRoom(r[0], 'lower', r[1], r[2], r[3], r[4], r[5]));
    UPPER_ROOMS.forEach(r => addRoom(r[0], 'upper', r[1], r[2], r[3], r[4], r[5]));
    LOWER_CORRIDORS.forEach(c => addCorridor('lower', c[0], c[1]));
    UPPER_CORRIDORS.forEach(c => addCorridor('upper', c[0], c[1]));

    for (const [key, cell] of map.cells) {
        const { level, x, y } = parseCellKey(key);
        for (const nb of [{x:x+1,y},{x:x-1,y},{x,y:y+1},{x,y:y-1}]) {
            const nk = cellKey(level, nb.x, nb.y);
            const nc = map.cells.get(nk);
            if (!nc || nc.room !== cell.room) {
                map.walls.add(edgeKey(level, x, y, level, nb.x, nb.y));
            }
        }
    }

    function addDoor(level, x1, y1, x2, y2) {
        const ek = edgeKey(level, x1, y1, level, x2, y2);
        map.walls.delete(ek);
    }

    LOWER_DOORS.forEach(d => addDoor('lower', d[0], d[1], d[2], d[3]));
    UPPER_DOORS.forEach(d => addDoor('upper', d[0], d[1], d[2], d[3]));

    ARMORED_DOORS.forEach(d => {
        const ek = edgeKey(d[0], d[1], d[2], d[0], d[3], d[4]);
        map.walls.add(ek);
        map.doors.set(ek, { type: 'armored', destroyed: false, level: d[0] });
    });

    EQUIPMENT_DEFS.forEach(e => {
        map.equipment.set(cellKey(e[0], e[1], e[2]), {
            type: e[3], destroyed: false, level: e[0],
        });
    });

    for (let y = OVERLOOK_RANGE.yMin; y <= OVERLOOK_RANGE.yMax; y++) {
        const ek = edgeKey('lower', OVERLOOK_RANGE.x, y, 'lower', OVERLOOK_RANGE.x + 1, y);
        map.overlookEdges.add(ek);
        map.walls.add(ek);
    }

    CROSS_LEVEL_LINKS.forEach(link => {
        const ek = edgeKey('lower', link.lower.x, link.lower.y,
                           'upper', link.upper.x, link.upper.y);
        map.doors.set(ek, { type: 'cross_level', destroyed: false });
    });

    return map;
}

// --- Section 4: Unit Factory ---------------------------------

function getMP(unit) {
    if (unit.type === 'terminator') return 5;
    if (unit.type === 'servant') return 3;
    return 4;
}

function totalAbilities(unit) {
    const a = unit.abilities;
    return a.fist + a.kick + a.soul + a.mist + a.heart;
}

function makeAbilities(fist, kick, soul, mist, heart) {
    return { fist, kick, soul, mist, heart };
}

function cloneAbilities(a) {
    return { fist:a.fist, kick:a.kick, soul:a.soul, mist:a.mist, heart:a.heart };
}

function createUnits(map) {
    const units = [];

    units.push({
        id:'T1', type:'terminator', name:'Rising Dream', label:'RD',
        side:'terminator', level:null, x:-1, y:-1,
        abilities: makeAbilities(1,3,1,1,1),
        maxAbilities: makeAbilities(1,3,1,1,1),
        faceDown:false, conscious:true, alive:true,
        hasWeapon:false, hasGun:false, hasSpikes:false,
        mp:0, enteredMap:false,
    });
    units.push({
        id:'T2', type:'terminator', name:'Shadow Lotus', label:'SL',
        side:'terminator', level:null, x:-1, y:-1,
        abilities: makeAbilities(2,1,1,1,2),
        maxAbilities: makeAbilities(2,1,1,1,2),
        faceDown:false, conscious:true, alive:true,
        hasWeapon:false, hasGun:false, hasSpikes:false,
        mp:0, enteredMap:false,
    });
    units.push({
        id:'T3', type:'terminator', name:'Golden Song', label:'GS',
        side:'terminator', level:null, x:-1, y:-1,
        abilities: makeAbilities(1,3,1,1,1),
        maxAbilities: makeAbilities(1,3,1,1,1),
        faceDown:false, conscious:true, alive:true,
        hasWeapon:false, hasGun:false, hasSpikes:false,
        mp:0, enteredMap:false,
    });

    units.push({
        id:'CM', type:'clonemaster', name:'CloneMaster', label:'CM',
        side:'clonemaster', level:null, x:-1, y:-1,
        abilities: makeAbilities(0,0,0,0,0),
        maxAbilities: makeAbilities(0,0,0,0,0),
        faceDown:true, conscious:true, alive:true,
        hasWeapon:true, hasGun:false, hasSpikes:false,
        mp:0, enteredMap:true,
    });

    const jellyNums = [1,2,3,4,5,6,7,8];
    for (const n of jellyNums) {
        const preset = JELLY_PRESETS[n];
        const wpn = JELLY_WEAPONS[n] || null;
        units.push({
            id:'J'+n, type:'jelly', name:'Jelly '+n, label:'J'+n,
            side:'clonemaster', level:null, x:-1, y:-1,
            abilities: cloneAbilities(preset),
            maxAbilities: cloneAbilities(preset),
            faceDown:true, conscious:true, alive:true,
            hasWeapon: wpn === 'weapon', hasGun:false,
            hasSpikes: wpn === 'spikes',
            mp:0, enteredMap:true,
        });
    }

    for (let i = 1; i <= 2; i++) {
        units.push({
            id:'AT'+i, type:'armed_tech', name:'Armed Tech '+i, label:'AT',
            side:'clonemaster', level:null, x:-1, y:-1,
            abilities: makeAbilities(0,0,0,0,0),
            maxAbilities: makeAbilities(0,0,0,0,0),
            faceDown:true, conscious:true, alive:true,
            hasWeapon:false, hasGun:true, hasSpikes:false,
            mp:0, enteredMap:true,
        });
    }

    for (let i = 1; i <= 10; i++) {
        units.push({
            id:'UT'+i, type:'unarmed_tech', name:'Tech '+i, label:'T',
            side:'clonemaster', level:null, x:-1, y:-1,
            abilities: makeAbilities(0,0,0,0,0),
            maxAbilities: makeAbilities(0,0,0,0,0),
            faceDown:true, conscious:true, alive:true,
            hasWeapon:false, hasGun:false, hasSpikes:false,
            mp:0, enteredMap:true,
        });
    }

    for (let i = 1; i <= 12; i++) {
        units.push({
            id:'S'+i, type:'servant', name:'Servant '+i, label:'S',
            side:'clonemaster', level:null, x:-1, y:-1,
            abilities: makeAbilities(0,0,0,0,0),
            maxAbilities: makeAbilities(0,0,0,0,0),
            faceDown:true, conscious:true, alive:true,
            hasWeapon:false, hasGun:false, hasSpikes:false,
            mp:0, enteredMap:true,
        });
    }

    placeCloneMasterUnits(map, units);
    return units;
}

function isAdjacentToDoor(map, level, x, y) {
    const cell = map.cells.get(cellKey(level, x, y));
    if (!cell) return false;
    for (const nb of [{x:x+1,y},{x:x-1,y},{x,y:y+1},{x,y:y-1}]) {
        const nk = cellKey(level, nb.x, nb.y);
        const nc = map.cells.get(nk);
        if (!nc) continue;
        if (nc.room !== cell.room) {
            const ek = edgeKey(level, x, y, level, nb.x, nb.y);
            if (!map.walls.has(ek) || map.doors.has(ek)) return true;
        }
    }
    return false;
}

function getSetupCells(map, units, setupChar, level) {
    const cells = [];
    for (const [key, cell] of map.cells) {
        if (cell.level !== level) continue;
        if (setupChar !== '*' && !cell.setupTypes.includes(setupChar)) continue;
        if (cell.terrain === 'corridor') continue;
        const { x, y } = parseCellKey(key);
        if (isAdjacentToDoor(map, level, x, y)) continue;
        if (getUnitAt(units, level, x, y)) continue;
        cells.push({ level, x, y });
    }
    return cells;
}

function placeCloneMasterUnits(map, units) {
    const cmUnits = units.filter(u => u.side === 'clonemaster');

    function placeUnit(unit, setupChar) {
        const both = [
            ...getSetupCells(map, units, setupChar, 'lower'),
            ...getSetupCells(map, units, setupChar, 'upper'),
        ];
        if (both.length === 0) {
            const fallback = [
                ...getSetupCells(map, units, '*', 'lower'),
                ...getSetupCells(map, units, '*', 'upper'),
            ];
            if (fallback.length === 0) return;
            const c = fallback[Math.floor(Math.random() * fallback.length)];
            unit.level = c.level; unit.x = c.x; unit.y = c.y;
            return;
        }
        const c = both[Math.floor(Math.random() * both.length)];
        unit.level = c.level; unit.x = c.x; unit.y = c.y;
    }

    const cm = cmUnits.find(u => u.type === 'clonemaster');
    if (cm) placeUnit(cm, '*');

    const jellies = cmUnits.filter(u => u.type === 'jelly');
    for (const j of jellies) placeUnit(j, 'J');

    const armedTechs = cmUnits.filter(u => u.type === 'armed_tech');
    for (const t of armedTechs) placeUnit(t, '*');

    const servants = cmUnits.filter(u => u.type === 'servant');
    for (const s of servants) placeUnit(s, 'S');

    const unarmedTechs = cmUnits.filter(u => u.type === 'unarmed_tech');
    for (const t of unarmedTechs) placeUnit(t, 'T');
}

function getUnitAt(units, level, x, y) {
    return units.find(u => u.alive && u.level === level && u.x === x && u.y === y) || null;
}

function getUnitsInRoom(units, map, level, x, y) {
    const cell = map.cells.get(cellKey(level, x, y));
    if (!cell) return [];
    return units.filter(u => {
        if (!u.alive || u.level !== level) return false;
        const uc = map.cells.get(cellKey(u.level, u.x, u.y));
        return uc && uc.room === cell.room;
    });
}

// --- Section 5: Game State -----------------------------------

const gameState = {
    map: null,
    units: [],
    turn: 1,
    phase: PHASE.TERM_MOVE_1,
    selectedUnit: null,
    validMoves: [],
    hoveredCell: null,
    combatTarget: null,
    entryUsed: {},
    gameOver: false,
    winner: null,
    log: [],
    animTime: 0,
    showCombatResult: null,
    frontDoorDestroyed: false,
};

function addLog(msg) {
    gameState.log.push(msg);
    if (gameState.log.length > 50) gameState.log.shift();
}

// --- Section 6: Turn & Phase Management ----------------------

function advancePhase() {
    deselectUnit();
    const gs = gameState;

    switch (gs.phase) {
        case PHASE.TERM_MOVE_1:
            gs.phase = PHASE.COMBAT_1;
            autoCombatCheck();
            break;
        case PHASE.COMBAT_1:
            gs.phase = PHASE.TERM_MOVE_2;
            resetMP('terminator');
            break;
        case PHASE.TERM_MOVE_2:
            gs.phase = PHASE.CM_MOVE;
            resetMP('clonemaster');
            executeCMMovement();
            gs.phase = PHASE.COMBAT_2;
            autoCombatCheck();
            break;
        case PHASE.COMBAT_2:
            gs.phase = PHASE.RECOVERY;
            executeRecovery();
            gs.phase = PHASE.ADVANCE;
            break;
        case PHASE.RECOVERY:
            gs.phase = PHASE.ADVANCE;
            break;
        case PHASE.ADVANCE:
            gs.turn++;
            if (gs.turn > CONFIG.MAX_TURNS) {
                gs.gameOver = true;
                gs.winner = 'clonemaster';
                addLog('Turn limit reached. CloneMaster wins!');
            }
            gs.phase = PHASE.TERM_MOVE_1;
            resetMP('terminator');
            gs.entryUsed = {};
            checkVictory();
            break;
    }
    updateHUD();
}

function resetMP(side) {
    for (const u of gameState.units) {
        if (u.side === side && u.alive && u.conscious) {
            u.mp = getMP(u);
        }
    }
}

function autoCombatCheck() {
    const combats = findAdjacentEnemies();
    if (combats.length === 0) {
        addLog('No combats to resolve.');
    }
}

function executeRecovery() {
    for (const u of gameState.units) {
        if (!u.alive || u.type !== 'terminator') continue;
        if (u.abilities.heart <= 0) continue;
        if (!u.conscious) {
            const roll = rollD6();
            if (roll <= 2) {
                u.conscious = true;
                addLog(u.name + ' regains consciousness! (rolled ' + roll + ')');
            }
            continue;
        }
        const lost = [];
        for (const ab of ['fist','kick','soul','mist','heart']) {
            if (u.abilities[ab] < u.maxAbilities[ab]) lost.push(ab);
        }
        if (lost.length > 0) {
            const roll = rollD6();
            if (roll <= 2) {
                const recover = lost[Math.floor(Math.random() * lost.length)];
                u.abilities[recover]++;
                addLog(u.name + ' recovers 1 ' + recover + ' (rolled ' + roll + ')');
            }
        }
    }
}

function checkVictory() {
    const gs = gameState;
    const termsAlive = gs.units.filter(u => u.type === 'terminator' && u.alive);
    const cm = gs.units.find(u => u.type === 'clonemaster');
    let equipDestroyed = 0;
    for (const [, eq] of gs.map.equipment) {
        if (eq.destroyed) equipDestroyed++;
    }

    if (termsAlive.length === 0) {
        gs.gameOver = true;
        gs.winner = 'clonemaster';
        addLog('All Terminators eliminated. CloneMaster wins!');
        return;
    }
    if (cm && !cm.alive && equipDestroyed >= 7) {
        gs.gameOver = true;
        gs.winner = 'terminator';
        addLog('CloneMaster dead and all equipment destroyed. Total Terminator victory!');
        return;
    }
    if (cm && !cm.alive) {
        addLog('CloneMaster is dead! Destroy remaining equipment to win.');
    }
    if (equipDestroyed >= 7) {
        gs.gameOver = true;
        gs.winner = 'terminator';
        addLog('All vital equipment destroyed. Terminator victory!');
    }
}

function rollD6() {
    return Math.floor(Math.random() * 6) + 1;
}

// --- Section 7: Movement -------------------------------------

function getCellNeighbors(level, x, y) {
    const nbs = [
        { level, x: x - 1, y },
        { level, x: x + 1, y },
        { level, x, y: y - 1 },
        { level, x, y: y + 1 },
    ];
    for (const link of CROSS_LEVEL_LINKS) {
        if (level === 'lower' && link.lower.x === x && link.lower.y === y) {
            nbs.push({ level: 'upper', x: link.upper.x, y: link.upper.y });
        }
        if (level === 'upper' && link.upper.x === x && link.upper.y === y) {
            nbs.push({ level: 'lower', x: link.lower.x, y: link.lower.y });
        }
    }
    return nbs;
}

function canPass(map, fromLevel, fromX, fromY, toLevel, toX, toY) {
    const ek = edgeKey(fromLevel, fromX, fromY, toLevel, toX, toY);
    if (map.overlookEdges.has(ek)) return false;
    if (map.walls.has(ek)) {
        const door = map.doors.get(ek);
        if (door && door.type === 'armored' && door.destroyed) return true;
        if (door && door.type === 'cross_level') return true;
        return false;
    }
    return true;
}

function getValidMoves(map, units, unit) {
    if (!unit.alive || !unit.conscious || unit.mp <= 0) return [];
    if (unit.level === null) return [];

    const start = cellKey(unit.level, unit.x, unit.y);
    const visited = new Map();
    visited.set(start, unit.mp);
    const queue = [{ level: unit.level, x: unit.x, y: unit.y, mp: unit.mp }];
    const reachable = [];

    while (queue.length > 0) {
        const cur = queue.shift();
        if (cur.mp <= 0) continue;

        for (const nb of getCellNeighbors(cur.level, cur.x, cur.y)) {
            const nk = cellKey(nb.level, nb.x, nb.y);
            if (!map.cells.has(nk)) continue;
            if (!canPass(map, cur.level, cur.x, cur.y, nb.level, nb.x, nb.y)) continue;

            const newMp = cur.mp - 1;
            if (visited.has(nk) && visited.get(nk) >= newMp) continue;
            visited.set(nk, newMp);

            if (!getUnitAt(units, nb.level, nb.x, nb.y)) {
                reachable.push({ level: nb.level, x: nb.x, y: nb.y });
            }
            queue.push({ level: nb.level, x: nb.x, y: nb.y, mp: newMp });
        }
    }
    return reachable;
}

function getEntryMoves(map, units, unit) {
    if (unit.enteredMap || unit.level !== null) return [];
    const moves = [];
    for (const entry of map.entryPoints) {
        if (entry.armored && !gameState.frontDoorDestroyed) continue;
        const used = gameState.entryUsed[entry.name] || 0;
        if (used >= entry.rate) continue;
        if (!getUnitAt(units, entry.level, entry.x, entry.y)) {
            moves.push({ level: entry.level, x: entry.x, y: entry.y, entry: entry.name });
        }
    }
    return moves;
}

function executeMove(unit, target) {
    const oldRoom = unit.level ? getRoomAt(gameState.map, unit.level, unit.x, unit.y) : null;
    unit.level = target.level;
    unit.x = target.x;
    unit.y = target.y;
    unit.mp = Math.max(0, unit.mp - 1);

    if (target.entry) {
        gameState.entryUsed[target.entry] = (gameState.entryUsed[target.entry] || 0) + 1;
        unit.enteredMap = true;
        unit.mp = getMP(unit) - 1;
        addLog(unit.name + ' enters via ' + target.entry);
    }

    if (unit.side === 'terminator') {
        revealRoom(unit.level, unit.x, unit.y);
    }

    const newRoom = getRoomAt(gameState.map, unit.level, unit.x, unit.y);
    if (newRoom !== oldRoom && unit.side === 'terminator') {
        revealRoom(unit.level, unit.x, unit.y);
    }
}

function getRoomAt(map, level, x, y) {
    const cell = map.cells.get(cellKey(level, x, y));
    return cell ? cell.room : null;
}

function revealRoom(level, x, y) {
    const room = getRoomAt(gameState.map, level, x, y);
    if (!room) return;
    for (const u of gameState.units) {
        if (u.faceDown && u.alive && u.level === level) {
            const uRoom = getRoomAt(gameState.map, u.level, u.x, u.y);
            if (uRoom === room) {
                u.faceDown = false;
                addLog(u.name + ' revealed in ' + room + '!');
            }
        }
    }
}

// --- Section 8: Combat & CRT ---------------------------------

function findAdjacentEnemies() {
    const pairs = [];
    for (const t of gameState.units) {
        if (t.type !== 'terminator' || !t.alive || !t.conscious || t.level === null) continue;
        for (const nb of getCellNeighbors(t.level, t.x, t.y)) {
            const enemy = getUnitAt(gameState.units, nb.level, nb.x, nb.y);
            if (!enemy || enemy.side === 'terminator' || !enemy.alive) continue;
            const ek = edgeKey(t.level, t.x, t.y, nb.level, nb.x, nb.y);
            if (gameState.map.overlookEdges.has(ek)) continue;
            if (gameState.map.walls.has(ek) && !canPass(gameState.map, t.level, t.x, t.y, nb.level, nb.x, nb.y)) continue;
            pairs.push({ terminator: t, enemy });
        }
    }
    return pairs;
}

function getAttackOptions(unit) {
    const opts = [];
    if (unit.abilities.fist > 0) opts.push('fist');
    if (unit.abilities.kick > 0) opts.push('kick');
    if (unit.hasWeapon) opts.push('weapon');
    if (unit.hasSpikes) opts.push('spikes');
    if (unit.hasGun) opts.push('gun');
    return opts;
}

function getDefenseType(unit) {
    if (unit.type === 'servant') return 'helpless';
    if (!unit.conscious) return 'helpless';
    if (unit.type === 'clonemaster' || unit.type === 'armed_tech' ||
        unit.type === 'unarmed_tech' || unit.type === 'lc') return 'inactive';
    const opts = [];
    if (unit.abilities.fist > 0) opts.push({ type:'fist', val:unit.abilities.fist });
    if (unit.abilities.kick > 0) opts.push({ type:'kick', val:unit.abilities.kick });
    if (unit.abilities.soul > 0) opts.push({ type:'soul', val:unit.abilities.soul });
    if (unit.abilities.mist > 0) opts.push({ type:'mist', val:unit.abilities.mist });
    if (opts.length === 0) return 'inactive';
    return opts[Math.floor(Math.random() * opts.length)].type;
}

function getBestDefense(unit, attackType) {
    if (unit.type === 'servant') return 'helpless';
    if (!unit.conscious) return 'helpless';
    if (unit.type !== 'jelly' && unit.type !== 'terminator') return 'inactive';

    const available = [];
    if (unit.abilities.fist > 0) available.push('fist');
    if (unit.abilities.kick > 0) available.push('kick');
    if (unit.abilities.soul > 0) available.push('soul');
    if (unit.abilities.mist > 0) available.push('mist');
    if (available.length === 0) return 'inactive';

    let best = 'inactive';
    let bestThresh = CRT[attackType] ? CRT[attackType]['inactive'] : 6;
    for (const def of available) {
        const thresh = CRT[attackType] ? (CRT[attackType][def] || 0) : 0;
        if (thresh < bestThresh) {
            bestThresh = thresh;
            best = def;
        }
    }
    return best;
}

function resolveCombat(attacker, defender, attackType) {
    const defType = attacker.side === 'terminator'
        ? getBestDefense(defender, attackType)
        : getDefenseType(attacker);

    const threshold = CRT[attackType] ? CRT[attackType][defType] : 0;
    if (threshold === 0) {
        addLog(attacker.name + ' attacks with ' + attackType + ' vs ' + defType + ' — no effect!');
        return { hit: false, roll: 0 };
    }

    const roll = rollD6();
    const hit = roll <= threshold;

    addLog(attacker.name + ' attacks ' + defender.name + ' (' + attackType +
           ' vs ' + defType + ') — roll ' + roll + '/' + threshold +
           (hit ? ' — HIT!' : ' — miss'));

    if (hit) {
        applyDamage(defender);
    }

    return { hit, roll, threshold };
}

function applyDamage(unit) {
    if (unit.type === 'servant' || unit.type === 'unarmed_tech' ||
        unit.type === 'armed_tech' || unit.type === 'lc') {
        unit.alive = false;
        addLog(unit.name + ' is eliminated!');
        return;
    }
    if (unit.type === 'clonemaster') {
        unit.alive = false;
        addLog('CloneMaster is killed!');
        checkVictory();
        return;
    }

    const abilities = ['fist','kick','soul','mist','heart'];
    const available = abilities.filter(a => unit.abilities[a] > 0);
    if (available.length === 0) {
        if (unit.conscious) {
            unit.conscious = false;
            addLog(unit.name + ' falls unconscious!');
        } else {
            unit.alive = false;
            addLog(unit.name + ' is killed!');
            if (unit.type === 'terminator') checkVictory();
        }
        return;
    }
    const lose = available[Math.floor(Math.random() * available.length)];
    unit.abilities[lose]--;
    addLog(unit.name + ' loses 1 ' + lose + ' (now ' + unit.abilities[lose] + ')');

    if (totalAbilities(unit) === 0 && unit.conscious) {
        unit.conscious = false;
        addLog(unit.name + ' falls unconscious!');
    }
}

function resolveUntrainedAttacks(terminator) {
    const attackers = [];
    for (const nb of getCellNeighbors(terminator.level, terminator.x, terminator.y)) {
        const u = getUnitAt(gameState.units, nb.level, nb.x, nb.y);
        if (u && u.alive && u.side === 'clonemaster' &&
            (u.type === 'servant' || u.type === 'unarmed_tech')) {
            attackers.push(u);
        }
    }
    if (attackers.length === 0) return;

    const roll = rollD6();
    const hit = roll <= attackers.length;
    addLog(attackers.length + ' servants/techs make untrained attack — roll ' +
           roll + '/' + attackers.length + (hit ? ' — HIT!' : ' — miss'));
    if (hit) {
        applyDamage(terminator);
    }
}

function resolveGunfire(terminator) {
    const shooters = gameState.units.filter(u =>
        u.alive && u.conscious && u.hasGun && u.side === 'clonemaster' && u.level === terminator.level
    );
    for (const shooter of shooters) {
        const dist = Math.abs(shooter.x - terminator.x) + Math.abs(shooter.y - terminator.y);
        if (dist > 8) continue;
        const defType = terminator.abilities.soul > 0 ? 'soul' : 'inactive';
        const threshold = CRT.gun[defType === 'soul' ? 'soul' : 'inactive'];
        if (threshold === 0) {
            addLog(shooter.name + ' fires at ' + terminator.name + ' — no effect (Monkey Soul)');
            continue;
        }
        const roll = rollD6();
        const hit = roll <= threshold;
        addLog(shooter.name + ' fires at ' + terminator.name + ' — roll ' +
               roll + '/' + threshold + (hit ? ' — HIT!' : ' — miss'));
        if (hit) {
            applyDamage(terminator);
        }
    }
}

function destroyEquipment(level, x, y) {
    const ek = cellKey(level, x, y);
    const eq = gameState.map.equipment.get(ek);
    if (eq && !eq.destroyed) {
        eq.destroyed = true;
        let count = 0;
        for (const [, e] of gameState.map.equipment) {
            if (e.destroyed) count++;
        }
        addLog(eq.type.replace('_',' ') + ' destroyed! (' + count + '/7)');
        checkVictory();
    }
}

function attackArmoredDoor() {
    const roll = rollD6();
    if (roll <= 2) {
        gameState.frontDoorDestroyed = true;
        addLog('Front Door destroyed! (rolled ' + roll + ')');

        for (const [ek, door] of gameState.map.doors) {
            if (door.type === 'armored' && door.level === 'lower') {
                door.destroyed = true;
            }
        }
    } else {
        addLog('Failed to break Front Door (rolled ' + roll + ', needed 1-2)');
    }
}

// --- Section 9: AI -------------------------------------------

function executeCMMovement() {
    const units = gameState.units;
    const map = gameState.map;
    const terms = units.filter(u => u.type === 'terminator' && u.alive && u.level !== null);

    const cmUnits = units.filter(u =>
        u.side === 'clonemaster' && u.alive && u.conscious && u.level !== null
    );

    for (const unit of cmUnits) {
        unit.mp = getMP(unit);
    }

    for (const unit of cmUnits) {
        if (terms.length === 0) break;

        const nearestTerm = terms.reduce((best, t) => {
            if (t.level !== unit.level) return best;
            const d = Math.abs(t.x - unit.x) + Math.abs(t.y - unit.y);
            return (!best || d < best.d) ? { t, d } : best;
        }, null);

        if (!nearestTerm) continue;

        if (unit.type === 'clonemaster') {
            aiMoveAway(unit, nearestTerm.t);
        } else if (unit.type === 'jelly') {
            aiMoveToward(unit, nearestTerm.t);
        } else if (unit.type === 'armed_tech') {
            if (nearestTerm.d <= 3) {
                aiMoveAway(unit, nearestTerm.t);
            }
        } else if (unit.type === 'servant') {
            aiMoveToward(unit, nearestTerm.t);
        }
    }

    addLog('CloneMaster units move.');
}

function aiMoveToward(unit, target) {
    let steps = unit.mp;
    while (steps > 0) {
        const nbs = getCellNeighbors(unit.level, unit.x, unit.y);
        let best = null;
        let bestDist = Math.abs(target.x - unit.x) + Math.abs(target.y - unit.y);

        for (const nb of nbs) {
            if (!gameState.map.cells.has(cellKey(nb.level, nb.x, nb.y))) continue;
            if (!canPass(gameState.map, unit.level, unit.x, unit.y, nb.level, nb.x, nb.y)) continue;
            if (getUnitAt(gameState.units, nb.level, nb.x, nb.y)) continue;
            if (nb.level !== target.level) continue;
            const d = Math.abs(target.x - nb.x) + Math.abs(target.y - nb.y);
            if (d < bestDist) { bestDist = d; best = nb; }
        }
        if (!best) break;
        unit.level = best.level; unit.x = best.x; unit.y = best.y;
        steps--;
    }
    unit.mp = 0;
}

function aiMoveAway(unit, threat) {
    let steps = unit.mp;
    while (steps > 0) {
        const nbs = getCellNeighbors(unit.level, unit.x, unit.y);
        let best = null;
        let bestDist = Math.abs(threat.x - unit.x) + Math.abs(threat.y - unit.y);

        for (const nb of nbs) {
            if (!gameState.map.cells.has(cellKey(nb.level, nb.x, nb.y))) continue;
            if (!canPass(gameState.map, unit.level, unit.x, unit.y, nb.level, nb.x, nb.y)) continue;
            if (getUnitAt(gameState.units, nb.level, nb.x, nb.y)) continue;
            const d = Math.abs(threat.x - nb.x) + Math.abs(threat.y - nb.y);
            if (d > bestDist) { bestDist = d; best = nb; }
        }
        if (!best) break;
        unit.level = best.level; unit.x = best.x; unit.y = best.y;
        steps--;
    }
    unit.mp = 0;
}

// --- Section 10: Input Handling ------------------------------

function handleClick(px, py) {
    if (gameState.gameOver) return;

    const panelAction = handlePanelClick(px, py);
    if (panelAction) return;

    const cell = pixelToCell(px, py);
    if (!cell) return;

    const phase = gameState.phase;

    if (phase === PHASE.TERM_MOVE_1 || phase === PHASE.TERM_MOVE_2) {
        handleMovementClick(cell);
    } else if (phase === PHASE.COMBAT_1 || phase === PHASE.COMBAT_2) {
        handleCombatClick(cell);
    }
}

function handleMovementClick(cell) {
    const { map, units } = gameState;
    const sel = gameState.selectedUnit;

    if (!sel) {
        const unit = getUnitAt(units, cell.level, cell.x, cell.y);
        if (unit && unit.side === 'terminator' && unit.alive && unit.conscious && unit.mp > 0) {
            selectUnit(unit);
            return;
        }
        const offMap = units.filter(u =>
            u.type === 'terminator' && u.alive && !u.enteredMap && u.level === null
        );
        if (offMap.length > 0) {
            for (const entry of map.entryPoints) {
                if (entry.level === cell.level && entry.x === cell.x && entry.y === cell.y) {
                    if (entry.armored && !gameState.frontDoorDestroyed) {
                        addLog('Front Door must be destroyed first.');
                        return;
                    }
                    const used = gameState.entryUsed[entry.name] || 0;
                    if (used >= entry.rate) {
                        addLog(entry.name + ' entry limit reached this turn.');
                        return;
                    }
                    if (getUnitAt(units, cell.level, cell.x, cell.y)) {
                        addLog('Entry point occupied.');
                        return;
                    }
                    const t = offMap[0];
                    executeMove(t, { level: cell.level, x: cell.x, y: cell.y, entry: entry.name });
                    updateHUD();
                    return;
                }
            }
        }
        return;
    }

    if (sameCell({ level: sel.level, x: sel.x, y: sel.y }, cell)) {
        const ek = cellKey(cell.level, cell.x, cell.y);
        const eq = map.equipment.get(ek);
        if (eq && !eq.destroyed && sel.type === 'terminator') {
            destroyEquipment(cell.level, cell.x, cell.y);
            sel.mp = Math.max(0, sel.mp - 1);
            deselectUnit();
            return;
        }
        deselectUnit();
        return;
    }

    const other = getUnitAt(units, cell.level, cell.x, cell.y);
    if (other && other.side === 'terminator' && other.alive && other.mp > 0) {
        selectUnit(other);
        return;
    }

    const isValid = gameState.validMoves.some(m => sameCell(m, cell));
    if (isValid) {
        executeMove(sel, cell);
        if (sel.mp > 0) {
            selectUnit(sel);
        } else {
            deselectUnit();
        }
        updateHUD();
    }
}

function handleCombatClick(cell) {
    const unit = getUnitAt(gameState.units, cell.level, cell.x, cell.y);
    if (!unit) return;

    if (unit.side === 'clonemaster' && unit.alive) {
        const adjacentTerms = [];
        for (const nb of getCellNeighbors(unit.level, unit.x, unit.y)) {
            const t = getUnitAt(gameState.units, nb.level, nb.x, nb.y);
            if (t && t.type === 'terminator' && t.alive && t.conscious) {
                const ek = edgeKey(unit.level, unit.x, unit.y, nb.level, nb.x, nb.y);
                if (!gameState.map.overlookEdges.has(ek)) {
                    adjacentTerms.push(t);
                }
            }
        }
        if (adjacentTerms.length > 0) {
            const term = adjacentTerms[0];
            const termAttacks = getAttackOptions(term);
            if (termAttacks.length > 0) {
                const attack = termAttacks[0];
                resolveCombat(term, unit, attack);
            }

            if (unit.alive && unit.conscious) {
                const enemyAttacks = getAttackOptions(unit);
                if (enemyAttacks.length > 0) {
                    const counterAttack = enemyAttacks[0];
                    resolveCombat(unit, term, counterAttack);
                }
            }

            resolveUntrainedAttacks(term);
            resolveGunfire(term);
            updateHUD();
        }
    }
}

function handlePanelClick(px, py) {
    if (px < CONFIG.PANEL_X || px > CONFIG.W - 10) return false;

    const gs = gameState;

    if (px >= CONFIG.PANEL_X + 5 && px <= CONFIG.PANEL_X + 145 &&
        py >= CONFIG.H - 85 && py <= CONFIG.H - 55) {
        if (!gs.frontDoorDestroyed) {
            const term = gs.units.find(u =>
                u.type === 'terminator' && u.alive && u.conscious && u.level === 'lower' &&
                u.x === 0 && u.y >= 4 && u.y <= 8
            );
            if (term) {
                attackArmoredDoor();
                term.mp = 0;
                deselectUnit();
                updateHUD();
                return true;
            }
        }
    }

    return false;
}

function selectUnit(unit) {
    gameState.selectedUnit = unit;
    if (unit.level === null) {
        gameState.validMoves = getEntryMoves(gameState.map, gameState.units, unit);
    } else {
        gameState.validMoves = getValidMoves(gameState.map, gameState.units, unit);
    }
    updateHUD();
}

function deselectUnit() {
    gameState.selectedUnit = null;
    gameState.validMoves = [];
    updateHUD();
}

function handleHover(px, py) {
    gameState.hoveredCell = pixelToCell(px, py);
}

// --- Section 11: Rendering -----------------------------------

let ctx, canvas;

function render() {
    ctx.fillStyle = CONFIG.COLORS.BG;
    ctx.fillRect(0, 0, CONFIG.W, CONFIG.H);

    renderLevel('lower');
    renderLevel('upper');
    renderLevelLabels();
    renderCrossLevelLinks();
    renderHighlights();
    renderEquipment();
    renderUnits();
    renderSelection();
    renderPanel();
    renderLog();
}

function renderLevel(level) {
    const o = level === 'lower' ? CONFIG.LOWER : CONFIG.UPPER;
    const cs = CONFIG.CELL;

    for (const [key, cell] of gameState.map.cells) {
        if (cell.level !== level) continue;
        const { x, y } = parseCellKey(key);
        const px = o.x + x * cs;
        const py = o.y + y * cs;

        ctx.fillStyle = cell.terrain === 'corridor' ? CONFIG.COLORS.CORRIDOR : CONFIG.COLORS.FLOOR;
        ctx.fillRect(px, py, cs, cs);
        ctx.strokeStyle = CONFIG.COLORS.FLOOR_STROKE;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(px + 0.5, py + 0.5, cs - 1, cs - 1);
    }

    for (const wallKey of gameState.map.walls) {
        const parts = wallKey.split('|');
        const a = parseCellKey(parts[0]);
        const b = parseCellKey(parts[1]);
        if (a.level !== level || b.level !== level) continue;
        if (!gameState.map.cells.has(parts[0]) && !gameState.map.cells.has(parts[1])) continue;
        if (!gameState.map.cells.has(parts[0]) || !gameState.map.cells.has(parts[1])) {
            if (!gameState.map.cells.has(parts[0]) && !gameState.map.cells.has(parts[1])) continue;
        }

        const door = gameState.map.doors.get(wallKey);
        if (door && door.destroyed) {
            drawWallSegment(a, b, level, CONFIG.COLORS.DOOR_DESTROYED, 1, true);
            continue;
        }
        if (door && door.type === 'armored') {
            drawWallSegment(a, b, level, CONFIG.COLORS.DOOR_ARMORED, 3, false);
            continue;
        }

        if (gameState.map.overlookEdges.has(wallKey)) {
            drawWallSegment(a, b, level, CONFIG.COLORS.OVERLOOK, 2, true);
            continue;
        }

        const cellA = gameState.map.cells.has(parts[0]);
        const cellB = gameState.map.cells.has(parts[1]);
        if (cellA || cellB) {
            drawWallSegment(a, b, level, CONFIG.COLORS.WALL, 2, false);
        }
    }

    renderRoomLabels(level);
    renderEntryMarkers(level);
}

function drawWallSegment(a, b, level, color, width, dashed) {
    const o = level === 'lower' ? CONFIG.LOWER : CONFIG.UPPER;
    const cs = CONFIG.CELL;

    let x1, y1, x2, y2;
    if (a.x === b.x) {
        const wallY = o.y + Math.max(a.y, b.y) * cs;
        x1 = o.x + a.x * cs;
        x2 = x1 + cs;
        y1 = y2 = wallY;
    } else {
        const wallX = o.x + Math.max(a.x, b.x) * cs;
        y1 = o.y + Math.min(a.y, b.y) * cs;
        y2 = y1 + cs;
        x1 = x2 = wallX;
    }

    ctx.beginPath();
    if (dashed) ctx.setLineDash([3, 3]);
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
    if (dashed) ctx.setLineDash([]);
}

function renderRoomLabels(level) {
    const o = level === 'lower' ? CONFIG.LOWER : CONFIG.UPPER;
    const cs = CONFIG.CELL;
    const rooms = {};

    for (const [key, cell] of gameState.map.cells) {
        if (cell.level !== level || !cell.room || cell.room === 'corridor') continue;
        if (!rooms[cell.room]) rooms[cell.room] = [];
        const { x, y } = parseCellKey(key);
        rooms[cell.room].push({ x, y });
    }

    ctx.font = '7px "Courier New"';
    ctx.fillStyle = CONFIG.COLORS.LABEL;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const [name, cells] of Object.entries(rooms)) {
        let sx = 0, sy = 0;
        for (const c of cells) {
            sx += o.x + c.x * cs + cs / 2;
            sy += o.y + c.y * cs + cs / 2;
        }
        const short = name.length > 12 ? name.substring(0, 12) : name;
        ctx.fillText(short.toUpperCase(), sx / cells.length, sy / cells.length);
    }
}

function renderEntryMarkers(level) {
    const o = level === 'lower' ? CONFIG.LOWER : CONFIG.UPPER;
    const cs = CONFIG.CELL;

    for (const entry of gameState.map.entryPoints) {
        if (entry.level !== level) continue;
        const px = o.x + entry.x * cs;
        const py = o.y + entry.y * cs;

        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 1, py + 1, cs - 2, cs - 2);

        ctx.font = '6px "Courier New"';
        ctx.fillStyle = 'rgba(0,255,136,0.6)';
        ctx.textAlign = 'center';
        ctx.fillText(entry.name, px + cs / 2, py - 4);
    }
}

function renderLevelLabels() {
    ctx.font = 'bold 12px "Courier New"';
    ctx.fillStyle = CONFIG.COLORS.TEXT;
    ctx.textAlign = 'center';

    const lw = 14 * CONFIG.CELL;
    ctx.fillText('LOWER LEVEL', CONFIG.LOWER.x + lw / 2, CONFIG.LOWER.y - 8);
    const uw = 11 * CONFIG.CELL;
    ctx.fillText('UPPER LEVEL', CONFIG.UPPER.x + uw / 2, CONFIG.UPPER.y - 8);
}

function renderCrossLevelLinks() {
    for (const link of CROSS_LEVEL_LINKS) {
        const from = cellToPixel('lower', link.lower.x, link.lower.y);
        const to = cellToPixel('upper', link.upper.x, link.upper.y);

        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.moveTo(from.px + CONFIG.CELL / 2, from.py);
        ctx.lineTo(to.px - CONFIG.CELL / 2, to.py);
        ctx.strokeStyle = 'rgba(255,200,0,0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);
    }
}

function renderHighlights() {
    if (gameState.hoveredCell) {
        const h = gameState.hoveredCell;
        const k = cellKey(h.level, h.x, h.y);
        if (gameState.map.cells.has(k)) {
            const o = h.level === 'lower' ? CONFIG.LOWER : CONFIG.UPPER;
            ctx.fillStyle = CONFIG.COLORS.HOVER;
            ctx.fillRect(o.x + h.x * CONFIG.CELL, o.y + h.y * CONFIG.CELL,
                         CONFIG.CELL, CONFIG.CELL);
        }
    }

    for (const m of gameState.validMoves) {
        const o = m.level === 'lower' ? CONFIG.LOWER : CONFIG.UPPER;
        ctx.fillStyle = CONFIG.COLORS.VALID;
        ctx.fillRect(o.x + m.x * CONFIG.CELL, o.y + m.y * CONFIG.CELL,
                     CONFIG.CELL, CONFIG.CELL);
        ctx.strokeStyle = CONFIG.COLORS.VALID_STROKE;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(o.x + m.x * CONFIG.CELL + 1, o.y + m.y * CONFIG.CELL + 1,
                       CONFIG.CELL - 2, CONFIG.CELL - 2);
    }
}

function renderEquipment() {
    for (const [key, eq] of gameState.map.equipment) {
        const { level, x, y } = parseCellKey(key);
        const pos = cellToPixel(level, x, y);
        const color = eq.destroyed ? CONFIG.COLORS.EQUIP_DEAD : CONFIG.COLORS.EQUIP_OK;
        const r = CONFIG.CELL * 0.3;

        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        if (eq.type === 'clone_tank') {
            ctx.beginPath();
            ctx.arc(pos.px, pos.py, r, 0, Math.PI * 2);
            ctx.stroke();
            if (eq.destroyed) {
                ctx.beginPath();
                ctx.moveTo(pos.px - r, pos.py - r);
                ctx.lineTo(pos.px + r, pos.py + r);
                ctx.stroke();
            }
        } else {
            ctx.strokeRect(pos.px - r, pos.py - r * 0.7, r * 2, r * 1.4);
            if (eq.destroyed) {
                ctx.beginPath();
                ctx.moveTo(pos.px - r, pos.py - r * 0.7);
                ctx.lineTo(pos.px + r, pos.py + r * 0.7);
                ctx.stroke();
            }
        }
    }
}

function renderUnits() {
    const phase = gameState.phase;
    const isTermPhase = phase === PHASE.TERM_MOVE_1 || phase === PHASE.TERM_MOVE_2;
    const isCombatPhase = phase === PHASE.COMBAT_1 || phase === PHASE.COMBAT_2;

    for (const unit of gameState.units) {
        if (!unit.alive || unit.level === null) continue;
        const pos = cellToPixel(unit.level, unit.x, unit.y);
        const r = CONFIG.CELL * 0.38;

        let color;
        if (unit.faceDown) {
            color = CONFIG.COLORS.FACEDOWN;
        } else {
            switch (unit.type) {
                case 'terminator': color = CONFIG.COLORS.TERMINATOR; break;
                case 'jelly': color = CONFIG.COLORS.JELLY; break;
                case 'clonemaster': color = CONFIG.COLORS.CLONEMASTER; break;
                case 'armed_tech': color = CONFIG.COLORS.ARMED_TECH; break;
                case 'unarmed_tech': color = CONFIG.COLORS.TECH; break;
                case 'servant': color = CONFIG.COLORS.SERVANT; break;
                case 'lc': color = CONFIG.COLORS.LC; break;
                default: color = '#ffffff';
            }
        }

        let alpha = 1.0;
        if (isTermPhase && unit.side === 'clonemaster') alpha = 0.5;
        if (isTermPhase && unit.side === 'terminator' && unit.mp <= 0) alpha = 0.5;

        if (!unit.conscious) {
            ctx.beginPath();
            ctx.arc(pos.px, pos.py, r, 0, Math.PI * 2);
            ctx.strokeStyle = colorAlpha(color, alpha * 0.5);
            ctx.lineWidth = 1.5;
            ctx.stroke();
        } else {
            if (unit.type === 'clonemaster' && !unit.faceDown) {
                ctx.beginPath();
                ctx.arc(pos.px, pos.py, r + 3, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(213,0,249,0.15)';
                ctx.fill();
            }

            ctx.beginPath();
            ctx.arc(pos.px, pos.py, r, 0, Math.PI * 2);
            ctx.fillStyle = colorAlpha(color, alpha * 0.35);
            ctx.fill();
            ctx.strokeStyle = colorAlpha(color, alpha);
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        const label = unit.faceDown ? '?' : (unit.label.length > 2 ? unit.label.substring(0, 2) : unit.label);
        ctx.font = 'bold 8px "Courier New"';
        ctx.fillStyle = colorAlpha(color, alpha);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, pos.px, pos.py);
    }
}

function renderSelection() {
    const sel = gameState.selectedUnit;
    if (!sel || sel.level === null) return;

    const pos = cellToPixel(sel.level, sel.x, sel.y);
    const r = CONFIG.CELL * 0.38 + 3;
    const pulse = 0.5 + 0.5 * Math.sin(gameState.animTime * 5);

    ctx.beginPath();
    ctx.arc(pos.px, pos.py, r, 0, Math.PI * 2);
    ctx.strokeStyle = colorAlpha(CONFIG.COLORS.SELECTION, pulse);
    ctx.lineWidth = 2;
    ctx.stroke();
}

function colorAlpha(hex, a) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
}

function renderPanel() {
    const px = CONFIG.PANEL_X;
    const py = 50;
    const pw = CONFIG.W - px - 10;

    ctx.fillStyle = 'rgba(20,20,30,0.9)';
    ctx.fillRect(px, py, pw, CONFIG.H - py - 10);
    ctx.strokeStyle = '#334';
    ctx.lineWidth = 1;
    ctx.strokeRect(px, py, pw, CONFIG.H - py - 10);

    ctx.font = 'bold 11px "Courier New"';
    ctx.fillStyle = CONFIG.COLORS.TEXT;
    ctx.textAlign = 'left';

    let y = py + 20;
    ctx.fillText('Turn: ' + gameState.turn + '/' + CONFIG.MAX_TURNS, px + 10, y);
    y += 18;

    const phaseColor = gameState.phase <= 2 ? CONFIG.COLORS.TERMINATOR : CONFIG.COLORS.CLONEMASTER;
    ctx.fillStyle = phaseColor;
    ctx.fillText(PHASE_NAMES[gameState.phase], px + 10, y);
    y += 25;

    ctx.fillStyle = CONFIG.COLORS.TEXT;
    ctx.font = '9px "Courier New"';

    let equipDestroyed = 0;
    for (const [, e] of gameState.map.equipment) {
        if (e.destroyed) equipDestroyed++;
    }
    ctx.fillText('Equipment: ' + equipDestroyed + '/7 destroyed', px + 10, y);
    y += 15;

    const termsAlive = gameState.units.filter(u => u.type === 'terminator' && u.alive).length;
    ctx.fillText('Terminators: ' + termsAlive + '/3 alive', px + 10, y);
    y += 15;

    const cm = gameState.units.find(u => u.type === 'clonemaster');
    ctx.fillText('CloneMaster: ' + (cm && cm.alive ? 'Alive' : 'Dead'), px + 10, y);
    y += 20;

    const sel = gameState.selectedUnit;
    if (sel) {
        ctx.font = 'bold 10px "Courier New"';
        ctx.fillStyle = CONFIG.COLORS.SELECTION;
        ctx.fillText(sel.name, px + 10, y);
        y += 15;

        ctx.font = '9px "Courier New"';
        ctx.fillStyle = CONFIG.COLORS.TEXT;
        ctx.fillText('MP: ' + sel.mp + '/' + getMP(sel), px + 10, y);
        y += 13;

        if (sel.type === 'terminator' || sel.type === 'jelly') {
            const abs = sel.abilities;
            const maxAbs = sel.maxAbilities;
            for (const ab of ['fist','kick','soul','mist','heart']) {
                const cur = abs[ab];
                const max = maxAbs[ab];
                if (max === 0) continue;
                const barW = 60;
                const filled = max > 0 ? (cur / max) * barW : 0;

                ctx.fillStyle = '#333';
                ctx.fillRect(px + 60, y - 7, barW, 9);
                ctx.fillStyle = cur > 0 ? '#4a9' : '#633';
                ctx.fillRect(px + 60, y - 7, filled, 9);

                ctx.fillStyle = CONFIG.COLORS.TEXT;
                ctx.fillText(ab + ': ' + cur, px + 10, y);
                y += 13;
            }
        }
        y += 5;
    }

    const offMap = gameState.units.filter(u =>
        u.type === 'terminator' && u.alive && !u.enteredMap
    );
    if (offMap.length > 0 && (gameState.phase === PHASE.TERM_MOVE_1 || gameState.phase === PHASE.TERM_MOVE_2)) {
        ctx.font = 'bold 9px "Courier New"';
        ctx.fillStyle = '#00ff88';
        ctx.fillText('Awaiting entry:', px + 10, y);
        y += 13;
        ctx.font = '9px "Courier New"';
        for (const u of offMap) {
            ctx.fillText('  ' + u.name, px + 10, y);
            y += 12;
        }
        y += 5;
    }

    if (!gameState.frontDoorDestroyed) {
        const adjTerm = gameState.units.find(u =>
            u.type === 'terminator' && u.alive && u.conscious && u.level === 'lower' &&
            u.x === 0 && u.y >= 4 && u.y <= 8
        );
        if (adjTerm && (gameState.phase === PHASE.TERM_MOVE_1 || gameState.phase === PHASE.TERM_MOVE_2)) {
            ctx.fillStyle = CONFIG.COLORS.DOOR_ARMORED;
            ctx.fillRect(px + 5, CONFIG.H - 85, 140, 25);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 9px "Courier New"';
            ctx.textAlign = 'center';
            ctx.fillText('ATTACK FRONT DOOR', px + 75, CONFIG.H - 70);
            ctx.textAlign = 'left';
        }
    }

    if (gameState.gameOver) {
        ctx.font = 'bold 14px "Courier New"';
        ctx.fillStyle = gameState.winner === 'terminator' ? CONFIG.COLORS.TERMINATOR : CONFIG.COLORS.CLONEMASTER;
        ctx.textAlign = 'center';
        ctx.fillText(gameState.winner === 'terminator' ? 'TERMINATOR VICTORY!' : 'CLONEMASTER WINS!',
                     px + pw / 2, CONFIG.H / 2);
        ctx.textAlign = 'left';
    }
}

function renderLog() {
    const px = CONFIG.PANEL_X + 5;
    const maxLines = 12;
    const startY = CONFIG.H - 40 - maxLines * 12;

    ctx.font = '8px "Courier New"';
    ctx.fillStyle = 'rgba(180,220,220,0.5)';
    ctx.textAlign = 'left';

    const lines = gameState.log.slice(-maxLines);
    for (let i = 0; i < lines.length; i++) {
        const text = lines[i].length > 38 ? lines[i].substring(0, 38) + '...' : lines[i];
        ctx.fillText(text, px, startY + i * 12);
    }
}

// --- Section 12: HUD ----------------------------------------

function updateHUD() {
    const turnEl = document.getElementById('turn-display');
    const phaseEl = document.getElementById('phase-display');
    const instrEl = document.getElementById('instructions');

    if (turnEl) turnEl.textContent = 'Turn ' + gameState.turn + '/' + CONFIG.MAX_TURNS;
    if (phaseEl) {
        phaseEl.textContent = PHASE_NAMES[gameState.phase];
        phaseEl.className = gameState.phase <= 2 ? 'terminator' : 'clonemaster';
    }

    if (!instrEl) return;

    const phase = gameState.phase;
    const offMap = gameState.units.filter(u =>
        u.type === 'terminator' && u.alive && !u.enteredMap
    );

    if (gameState.gameOver) {
        instrEl.textContent = gameState.winner === 'terminator'
            ? 'Terminator Victory! Refresh to play again.'
            : 'CloneMaster Wins! Refresh to play again.';
    } else if (phase === PHASE.TERM_MOVE_1 || phase === PHASE.TERM_MOVE_2) {
        if (offMap.length > 0) {
            instrEl.textContent = 'Click entry point to deploy ' + offMap[0].name + ', or click a Terminator to move';
        } else {
            instrEl.textContent = 'Click Terminators to move (5 MP each). End Phase when done.';
        }
    } else if (phase === PHASE.COMBAT_1 || phase === PHASE.COMBAT_2) {
        instrEl.textContent = 'Click adjacent enemies to resolve combat. End Phase when done.';
    } else {
        instrEl.textContent = 'Processing...';
    }
}

// --- Section 13: Initialization ------------------------------

function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');

    const dpr = window.devicePixelRatio || 1;
    canvas.width = CONFIG.W * dpr;
    canvas.height = CONFIG.H * dpr;
    canvas.style.width = CONFIG.W + 'px';
    canvas.style.height = CONFIG.H + 'px';
    ctx.scale(dpr, dpr);

    gameState.map = buildFortressMap();
    gameState.units = createUnits(gameState.map);

    resetMP('terminator');

    canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();
        const px = (e.clientX - rect.left) * (CONFIG.W / rect.width);
        const py = (e.clientY - rect.top) * (CONFIG.H / rect.height);
        handleClick(px, py);
    });

    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const px = (e.clientX - rect.left) * (CONFIG.W / rect.width);
        const py = (e.clientY - rect.top) * (CONFIG.H / rect.height);
        handleHover(px, py);
    });

    document.getElementById('endPhaseBtn').addEventListener('click', () => {
        if (!gameState.gameOver) advancePhase();
    });

    addLog('KUNG FU 2100 — Click entry points to deploy Terminators.');
    addLog('Destroy the CloneMaster and 7 pieces of vital equipment!');
    updateHUD();

    function animate(ts) {
        gameState.animTime = ts / 1000;
        render();
        requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
}

window.addEventListener('DOMContentLoaded', init);
