const canvas = document.getElementById('arena');
const ctx = canvas.getContext('2d');
const cardsNode = document.getElementById('cards');
const elixirFill = document.getElementById('elixirFill');
const elixirValue = document.getElementById('elixirValue');
const enemyHpNode = document.getElementById('enemyHp');
const playerHpNode = document.getElementById('playerHp');
const resultNode = document.getElementById('result');

const LANE_Y = [175, 385];
const BRIDGE_X = 450;

const CARD_POOL = [
  { name: 'Knight', cost: 3, hp: 520, damage: 82, speed: 48, range: 24, radius: 18, color: '#f59e0b' },
  { name: 'Archer', cost: 3, hp: 270, damage: 52, speed: 44, range: 115, radius: 14, color: '#10b981' },
  { name: 'Giant', cost: 5, hp: 980, damage: 130, speed: 28, range: 26, radius: 22, color: '#f97316' },
  { name: 'Fireball', cost: 4, spell: true, radius: 72, damage: 210, color: '#ef4444' }
];

const state = {
  playerTower: { x: 80, y: 280, hp: 3000, maxHp: 3000 },
  enemyTower: { x: 820, y: 280, hp: 3000, maxHp: 3000 },
  units: [],
  projectiles: [],
  elixir: 5,
  selectedCard: null,
  gameOver: false,
  aiTimer: 0
};

const dragState = {
  active: false,
  cardIndex: null,
  clientX: 0,
  clientY: 0,
  overArena: false,
  isValidDrop: false,
  lane: 0,
  canvasX: 0,
  canvasY: 0
};

function renderCards() {
  cardsNode.innerHTML = '';
  CARD_POOL.forEach((card, i) => {
    const btn = document.createElement('button');
    btn.className = 'card';
    btn.dataset.index = i;
    btn.innerHTML = `<h3>${card.name} <small>(${card.cost})</small></h3><p>${card.spell ? 'Spell damage' : `HP ${card.hp} • DMG ${card.damage}`}</p>`;

    if (state.elixir < card.cost) btn.classList.add('disabled');
    if (state.selectedCard === i) btn.classList.add('active');
    if (dragState.active && dragState.cardIndex === i) btn.classList.add('dragging');

    btn.addEventListener('click', () => {
      if (state.elixir < card.cost || state.gameOver || dragState.active) return;
      state.selectedCard = i;
      renderCards();
    });

    btn.addEventListener('pointerdown', (event) => {
      if (state.elixir < card.cost || state.gameOver) return;
      event.preventDefault();
      startDrag(i, event.clientX, event.clientY);
    });

    cardsNode.appendChild(btn);
  });
}

function startDrag(cardIndex, clientX, clientY) {
  dragState.active = true;
  dragState.cardIndex = cardIndex;
  state.selectedCard = cardIndex;
  document.body.classList.add('dragging');
  updateDrag(clientX, clientY);
  renderCards();
}

function stopDrag(clientX, clientY) {
  if (!dragState.active) return;
  updateDrag(clientX, clientY);

  if (dragState.isValidDrop) {
    const card = CARD_POOL[dragState.cardIndex];
    if (state.elixir >= card.cost) {
      state.elixir -= card.cost;
      deploy('player', dragState.cardIndex, dragState.lane);
    }
  }

  dragState.active = false;
  dragState.cardIndex = null;
  dragState.overArena = false;
  dragState.isValidDrop = false;
  state.selectedCard = null;
  document.body.classList.remove('dragging');
  renderCards();
}

function updateDrag(clientX, clientY) {
  dragState.clientX = clientX;
  dragState.clientY = clientY;

  const rect = canvas.getBoundingClientRect();
  const inside = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;

  dragState.overArena = inside;
  if (!inside) {
    dragState.isValidDrop = false;
    return;
  }

  const x = ((clientX - rect.left) / rect.width) * canvas.width;
  const y = ((clientY - rect.top) / rect.height) * canvas.height;
  dragState.canvasX = x;
  dragState.canvasY = y;
  dragState.lane = Math.abs(y - LANE_Y[0]) < Math.abs(y - LANE_Y[1]) ? 0 : 1;

  const card = CARD_POOL[dragState.cardIndex];
  dragState.isValidDrop = x <= BRIDGE_X - 5 && state.elixir >= card.cost && !state.gameOver;
}

document.addEventListener('pointermove', (event) => {
  if (!dragState.active) return;
  updateDrag(event.clientX, event.clientY);
});

document.addEventListener('pointerup', (event) => {
  if (!dragState.active) return;
  stopDrag(event.clientX, event.clientY);
});

function spawnUnit(typeIndex, side, lane) {
  const type = CARD_POOL[typeIndex];
  if (type.spell) return;
  const x = side === 'player' ? 130 : 770;
  state.units.push({
    side,
    lane,
    x,
    y: LANE_Y[lane],
    hp: type.hp,
    maxHp: type.hp,
    damage: type.damage,
    speed: type.speed,
    range: type.range,
    radius: type.radius,
    color: type.color,
    cooldown: 0
  });
}

function castFireball(side, lane) {
  const y = LANE_Y[lane];
  const x = side === 'player' ? BRIDGE_X + 150 : BRIDGE_X - 150;
  state.projectiles.push({ x, y, life: 0.45, maxLife: 0.45, side });

  const targetSide = side === 'player' ? 'enemy' : 'player';
  const damage = CARD_POOL[3].damage;
  for (const u of state.units) {
    if (u.side === targetSide && u.lane === lane && Math.abs(u.x - x) < CARD_POOL[3].radius) {
      u.hp -= damage;
    }
  }

  const tower = side === 'player' ? state.enemyTower : state.playerTower;
  if (Math.abs(tower.y - y) < 120 && Math.abs(tower.x - x) < 140) {
    tower.hp -= Math.floor(damage * 0.6);
  }
}

function deploy(side, cardIndex, lane) {
  const card = CARD_POOL[cardIndex];
  if (card.spell) {
    castFireball(side, lane);
  } else {
    spawnUnit(cardIndex, side, lane);
  }
}

canvas.addEventListener('click', (event) => {
  if (state.selectedCard === null || state.gameOver || dragState.active) return;

  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((event.clientY - rect.top) / rect.height) * canvas.height;

  if (x > BRIDGE_X - 5) return;
  const lane = Math.abs(y - LANE_Y[0]) < Math.abs(y - LANE_Y[1]) ? 0 : 1;

  const card = CARD_POOL[state.selectedCard];
  if (state.elixir < card.cost) return;

  state.elixir -= card.cost;
  deploy('player', state.selectedCard, lane);
  state.selectedCard = null;
  renderCards();
});

function drawArena() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#14532d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#334155';
  ctx.fillRect(BRIDGE_X - 30, 0, 60, canvas.height);

  ctx.strokeStyle = 'rgba(248,250,252,0.25)';
  ctx.lineWidth = 2;
  for (const y of LANE_Y) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function drawTower(tower, side) {
  ctx.fillStyle = side === 'player' ? '#38bdf8' : '#f43f5e';
  ctx.fillRect(tower.x - 35, tower.y - 48, 70, 96);

  const hpPct = Math.max(0, tower.hp) / tower.maxHp;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(tower.x - 36, tower.y - 62, 72, 9);
  ctx.fillStyle = '#22c55e';
  ctx.fillRect(tower.x - 36, tower.y - 62, 72 * hpPct, 9);
}

function updateUnits(dt) {
  for (const unit of state.units) {
    unit.cooldown -= dt;

    const enemySide = unit.side === 'player' ? 'enemy' : 'player';
    const targetTower = enemySide === 'enemy' ? state.enemyTower : state.playerTower;

    let closest = null;
    let minDist = Infinity;
    for (const other of state.units) {
      if (other.side !== enemySide || other.lane !== unit.lane) continue;
      const d = Math.abs(other.x - unit.x);
      if (d < minDist) {
        minDist = d;
        closest = other;
      }
    }

    if (closest && minDist <= unit.range + unit.radius) {
      if (unit.cooldown <= 0) {
        closest.hp -= unit.damage;
        unit.cooldown = 0.75;
      }
      continue;
    }

    const distToTower = Math.abs(targetTower.x - unit.x);
    if (distToTower <= unit.range + 40) {
      if (unit.cooldown <= 0) {
        targetTower.hp -= unit.damage;
        unit.cooldown = 0.85;
      }
      continue;
    }

    const dir = unit.side === 'player' ? 1 : -1;
    unit.x += dir * unit.speed * dt;
  }

  state.units = state.units.filter((u) => u.hp > 0 && u.x > -30 && u.x < canvas.width + 30);
}

function drawUnits() {
  for (const unit of state.units) {
    ctx.fillStyle = unit.color;
    ctx.beginPath();
    ctx.arc(unit.x, unit.y, unit.radius, 0, Math.PI * 2);
    ctx.fill();

    const hpPct = Math.max(0, unit.hp) / unit.maxHp;
    ctx.fillStyle = '#111827';
    ctx.fillRect(unit.x - 20, unit.y - unit.radius - 12, 40, 5);
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(unit.x - 20, unit.y - unit.radius - 12, 40 * hpPct, 5);
  }
}

function updateProjectiles(dt) {
  state.projectiles.forEach((p) => (p.life -= dt));
  state.projectiles = state.projectiles.filter((p) => p.life > 0);
}

function drawProjectiles() {
  for (const p of state.projectiles) {
    const alpha = p.life / p.maxLife;
    ctx.fillStyle = `rgba(239,68,68,${alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 80 * (1 - alpha + 0.2), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawDragPreview() {
  if (!dragState.active || !dragState.overArena) return;

  const card = CARD_POOL[dragState.cardIndex];
  const laneY = LANE_Y[dragState.lane];
  const x = Math.min(BRIDGE_X - 5, Math.max(35, dragState.canvasX));
  const valid = dragState.isValidDrop;
  const radius = card.spell ? 30 : card.radius;

  ctx.fillStyle = valid ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)';
  ctx.fillRect(0, laneY - 42, BRIDGE_X - 5, 84);

  ctx.beginPath();
  ctx.arc(x, laneY, radius + 8, 0, Math.PI * 2);
  ctx.fillStyle = valid ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, laneY, radius, 0, Math.PI * 2);
  ctx.fillStyle = card.color;
  ctx.globalAlpha = valid ? 0.85 : 0.6;
  ctx.fill();
  ctx.globalAlpha = 1;
}

function runAI(dt) {
  state.aiTimer -= dt;
  if (state.aiTimer > 0 || state.gameOver) return;

  state.aiTimer = 1.1 + Math.random() * 1.4;
  const budget = Math.min(10, 4 + Math.random() * 6);
  const choices = CARD_POOL.map((c, i) => ({ ...c, i })).filter((c) => c.cost <= budget);
  const pick = choices[Math.floor(Math.random() * choices.length)];
  const lane = Math.random() < 0.5 ? 0 : 1;
  deploy('enemy', pick.i, lane);
}

function checkEnd() {
  if (state.playerTower.hp <= 0 || state.enemyTower.hp <= 0) {
    state.gameOver = true;
    const won = state.enemyTower.hp <= 0 && state.playerTower.hp > 0;
    const text = won ? 'Victory!' : state.playerTower.hp <= 0 && state.enemyTower.hp > 0 ? 'Defeat!' : 'Draw!';
    resultNode.textContent = text;
    resultNode.classList.remove('hidden');
  }
}

let last = performance.now();
function gameLoop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  if (!state.gameOver) {
    state.elixir = Math.min(10, state.elixir + dt * 0.9);
    runAI(dt);
    updateUnits(dt);
    updateProjectiles(dt);
    checkEnd();
  }

  drawArena();
  drawTower(state.playerTower, 'player');
  drawTower(state.enemyTower, 'enemy');
  drawProjectiles();
  drawUnits();
  drawDragPreview();

  enemyHpNode.textContent = Math.max(0, Math.floor(state.enemyTower.hp));
  playerHpNode.textContent = Math.max(0, Math.floor(state.playerTower.hp));
  elixirFill.style.width = `${(state.elixir / 10) * 100}%`;
  elixirValue.textContent = `${state.elixir.toFixed(1)} / 10`;
  renderCards();

  requestAnimationFrame(gameLoop);
}

renderCards();
requestAnimationFrame(gameLoop);
