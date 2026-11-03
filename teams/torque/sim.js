const { Engine, Render, Runner, Bodies, Body, Composite, Events } = Matter;

const PX_PER_M = 5;
const WORLD_W = 1240;
const WORLD_H = 540;
const COCK = 1.2;
const RELEASE = 0.75;
const REST = -0.42;
const ALPHA = 0.0000008;

const view = document.querySelector("#view");
const weightInput = document.querySelector("#weight");
const weightLabel = document.querySelector("#weight-label");
const fireButton = document.querySelector("#fire");
const resetButton = document.querySelector("#reset");
const pauseButton = document.querySelector("#pause");
const rangeEl = document.querySelector("#range");
const speedEl = document.querySelector("#speed");
const wallEl = document.querySelector("#wall");
const resultEl = document.querySelector("#result");
const logEl = document.querySelector("#log");

const shots = [];
let session = null;

function metersFrom(px) {
  return px / PX_PER_M;
}

function formatMeters(px) {
  return `${metersFrom(px).toFixed(1)} m`;
}

function weightValue() {
  return Number(weightInput.value);
}

function updateWeightLabel() {
  weightLabel.textContent = `${weightValue()}×`;
}

function rotated(point, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: point.x * c - point.y * s, y: point.x * s + point.y * c };
}

function worldPoint(body, local) {
  const turned = rotated(local, body.angle);
  return { x: body.position.x + turned.x, y: body.position.y + turned.y };
}

function placeBeam(beam, pivot, hingeLocal, angle) {
  const shift = rotated(hingeLocal, angle);
  Body.setAngle(beam, angle);
  Body.setPosition(beam, { x: pivot.x - shift.x, y: pivot.y - shift.y });
  Body.setAngularVelocity(beam, 0);
  Body.setVelocity(beam, { x: 0, y: 0 });
}

function build() {
  if (session) {
    Render.stop(session.render);
    Runner.stop(session.runner);
    Engine.clear(session.engine);
    session.render.canvas.remove();
    session.render.textures = {};
    session = null;
  }

  const engine = Engine.create({ gravity: { x: 0, y: 1, scale: 0.00021 } });
  const world = engine.world;
  const render = Render.create({
    element: view,
    engine,
    options: {
      width: WORLD_W,
      height: WORLD_H,
      wireframes: false,
      background: "#d5e4ee",
      pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    },
  });
  render.canvas.style.width = "100%";
  render.canvas.style.height = "100%";
  const runner = Runner.create();
  const group = -1;
  const pivot = { x: 210, y: 214 };
  const groundTop = 486;
  const wallX = 760;
  const hingeLocal = { x: -60, y: 0 };
  const shortLocal = { x: -150, y: 0 };
  const longLocal = { x: 150, y: 0 };
  const slingLocal = { x: 150, y: 20 };
  const multiple = weightValue();

  const beam = Bodies.rectangle(pivot.x, pivot.y, 300, 18, {
    isStatic: true,
    collisionFilter: { group },
    render: { fillStyle: "#6a4324" },
  });
  placeBeam(beam, pivot, hingeLocal, COCK);

  const counterweight = Bodies.circle(0, 0, 16 + multiple * 6, {
    isStatic: true,
    collisionFilter: { group },
    render: { fillStyle: "#2c2a28" },
  });
  const sling = Bodies.rectangle(0, 0, 22, 4, {
    isStatic: true,
    collisionFilter: { group },
    render: { fillStyle: "#6a4324" },
  });
  const stone = Bodies.circle(0, 0, 11, {
    density: 0.002,
    frictionAir: 0.001,
    restitution: 0.04,
    collisionFilter: { group },
    label: "stone",
    render: { fillStyle: "#7d2a2a" },
  });

  const hang = worldPoint(beam, shortLocal);
  const pouch = worldPoint(beam, slingLocal);
  Body.setPosition(counterweight, hang);
  Body.setPosition(stone, pouch);
  Body.setVelocity(stone, { x: 0, y: 0 });
  Body.setPosition(sling, { x: (worldPoint(beam, longLocal).x + pouch.x) / 2, y: (worldPoint(beam, longLocal).y + pouch.y) / 2 });
  Body.setAngle(sling, beam.angle + Math.PI / 2);

  const frame = [
    Bodies.rectangle(pivot.x - 72, pivot.y + 120, 16, 250, { isStatic: true, collisionFilter: { group }, render: { fillStyle: "#4e3924" } }),
    Bodies.rectangle(pivot.x + 72, pivot.y + 120, 16, 250, { isStatic: true, collisionFilter: { group }, render: { fillStyle: "#4e3924" } }),
    Bodies.rectangle(pivot.x, pivot.y, 164, 14, { isStatic: true, collisionFilter: { group }, render: { fillStyle: "#4e3924" } }),
    Bodies.rectangle(WORLD_W / 2, groundTop + 28, WORLD_W + 40, 56, { isStatic: true, friction: 0.9, label: "ground", render: { fillStyle: "#5f7d45" } }),
    Bodies.rectangle(wallX, groundTop - 92, 34, 184, { isStatic: true, label: "wall", render: { fillStyle: "#8d8a84" } }),
    Bodies.rectangle(wallX, groundTop - 196, 58, 24, { isStatic: true, label: "wall", render: { fillStyle: "#8d8a84" } }),
  ];

  Composite.add(world, [beam, counterweight, sling, stone, ...frame]);
  Render.run(render);
  Runner.run(runner, engine);

  const state = {
    engine,
    render,
    runner,
    beam,
    stone,
    sling,
    counterweight,
    pivot,
    hingeLocal,
    shortLocal,
    longLocal,
    slingLocal,
    multiple,
    wallX,
    angle: COCK,
    omega: 0,
    fired: false,
    released: false,
    settled: false,
    lastSling: pouch,
    started: 0,
  };
  session = state;
  wallEl.textContent = `${metersFrom(wallX - pivot.x).toFixed(0)} m`;

  Events.on(engine, "beforeUpdate", (event) => {
    const delta = event.delta || 16.67;
    if (state.fired && state.angle > REST) {
      if (!state.released) state.omega += ALPHA * state.multiple * delta;
      const next = state.angle - state.omega * delta;
      state.angle = Math.max(REST, next);
      if (state.angle === REST) state.omega = 0;
      placeBeam(state.beam, state.pivot, state.hingeLocal, state.angle);
      const tip = worldPoint(state.beam, state.longLocal);
      const pouchNow = worldPoint(state.beam, state.slingLocal);
      Body.setPosition(state.sling, { x: (tip.x + pouchNow.x) / 2, y: (tip.y + pouchNow.y) / 2 });
      Body.setAngle(state.sling, state.angle + Math.PI / 2);
      if (!state.released) {
        const velocity = {
          x: (pouchNow.x - state.lastSling.x) / delta,
          y: (pouchNow.y - state.lastSling.y) / delta,
        };
        Body.setPosition(state.stone, pouchNow);
        const step = 1000 / 60;
        Body.setVelocity(state.stone, { x: velocity.x * step, y: velocity.y * step });
        Body.setAngularVelocity(state.stone, 0);
        if (state.angle <= RELEASE) {
          state.released = true;
          state.sling.render.visible = false;
          const releaseSpeed = Math.hypot(velocity.x, velocity.y) * 1000 / PX_PER_M;
          speedEl.textContent = Number.isFinite(releaseSpeed) ? `${releaseSpeed.toFixed(1)} m/s` : "—";
        }
      }
      state.lastSling = pouchNow;
    }
    Body.setPosition(state.counterweight, worldPoint(state.beam, state.shortLocal));
    if (!state.fired) state.lastSling = worldPoint(state.beam, state.slingLocal);
  });

  Events.on(engine, "collisionStart", (event) => {
    if (!state.released || state.settled) return;
    for (const pair of event.pairs) {
      const labels = [pair.bodyA.label, pair.bodyB.label];
      if (!labels.includes("stone")) continue;
      const other = pair.bodyA.label === "stone" ? pair.bodyB.label : pair.bodyA.label;
      if (other === "ground" || other === "wall") finishShot(state, other === "wall");
    }
  });

  Events.on(engine, "afterUpdate", () => {
    if (!state.fired || state.settled) return;
    const pos = state.stone.position;
    const left = pos.x < -30 || pos.x > WORLD_W + 30 || pos.y < -30 || pos.y > WORLD_H + 30;
    const tooLong = state.engine.timing.timestamp - state.started > 9000;
    if ((state.released && left) || tooLong) finishShot(state, false);
  });

  rangeEl.textContent = "—";
  speedEl.textContent = "—";
  resultEl.textContent = "Fire to measure a shot. Range is the horizontal distance from the axle to where the stone lands or hits.";
  fireButton.disabled = false;
  pauseButton.textContent = "Pause";
}

function finishShot(state, hitWall) {
  if (state.settled) return;
  state.settled = true;
  const distance = state.stone.position.x - state.pivot.x;
  const rangeText = Number.isFinite(distance) ? formatMeters(Math.max(0, distance)) : "left the field";
  rangeEl.textContent = rangeText;
  const pastWall = distance > state.wallX - state.pivot.x + 20;
  const outcome = hitWall ? "Hit the wall" : pastWall ? "Flew past the wall" : "Landed short of the wall";
  resultEl.textContent = `${outcome}. A ${state.multiple}× counterweight threw ${rangeText}.`;
  shots.unshift({ multiple: state.multiple, rangeText, outcome });
  shots.splice(6);
  logEl.replaceChildren();
  for (const shot of shots) {
    const item = document.createElement("li");
    item.textContent = `${shot.multiple}× · ${shot.rangeText} · ${shot.outcome}`;
    logEl.appendChild(item);
  }
  fireButton.disabled = false;
}

function fire() {
  if (!session || session.fired) return;
  if (!session.runner.enabled) {
    session.runner.enabled = true;
    pauseButton.textContent = "Pause";
  }
  session.fired = true;
  session.started = session.engine.timing.timestamp;
  session.lastSling = worldPoint(session.beam, session.slingLocal);
  fireButton.disabled = true;
  resultEl.textContent = "The counterweight is falling. The sling lets go as the long arm comes up.";
}

function togglePause() {
  if (!session) return;
  session.runner.enabled = !session.runner.enabled;
  pauseButton.textContent = session.runner.enabled ? "Pause" : "Resume";
}

function idle() {
  return !session || !session.fired || session.settled;
}

weightInput.addEventListener("input", () => {
  updateWeightLabel();
  if (idle()) build();
});
fireButton.addEventListener("click", fire);
resetButton.addEventListener("click", () => build());
pauseButton.addEventListener("click", togglePause);
window.addEventListener("keydown", (event) => {
  if (event.target === weightInput) return;
  if (event.key === " ") {
    event.preventDefault();
    fire();
  }
  if (event.key === "r" || event.key === "R") build();
});

updateWeightLabel();
build();
