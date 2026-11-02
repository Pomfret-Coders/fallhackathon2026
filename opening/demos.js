// One looping Matter.js scene per feature. Each <canvas data-demo="name">
// gets a fresh world while its slide is showing, rebuilt every LOOP ms.
const { Engine, Render, Runner, Bodies, Body, Composite, Constraint, Events, Query } = Matter;

const W = 600, H = 400, LOOP = 9000;
const INK = "#1a2c34", STEEL = "#2c4652", LINE = "#b7c9d1", MEASURE = "#7a4e08", SOFT = "#5f7f8c";
const look = (fill) => ({ render: { fillStyle: fill, strokeStyle: INK, lineWidth: 0 } });
const wall = (x, y, w, h, angle) => Bodies.rectangle(x, y, w, h, { isStatic: true, angle: angle || 0, ...look(LINE) });
const box = () => [wall(W / 2, H + 20, W + 200, 60), wall(-20, H / 2, 60, H * 2), wall(W + 20, H / 2, 60, H * 2)];
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// Draws a pointer arrow, used where a scene "pretends" to be a user.
function cursor(ctx, x, y, down) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = down ? MEASURE : "#fff";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(0, 26); ctx.lineTo(7, 20); ctx.lineTo(12, 31);
  ctx.lineTo(17, 29); ctx.lineTo(12, 18); ctx.lineTo(21, 18); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

function ring(ctx, x, y, age) {
  ctx.strokeStyle = `rgba(122, 78, 8, ${1 - age})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, 6 + age * 34, 0, Math.PI * 2);
  ctx.stroke();
}

// Each scene gets (engine, world, render) and may return a draw(ctx, t) overlay.
const scenes = {
  title(engine, world, render) {
    // Balls rain onto the floor, then springs pull each one up into a letter of "Matter.js".
    const w = render.options.width, h = render.options.height, gap = 13;
    const text = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    text.canvas.width = w; text.canvas.height = h;
    const font = (size) => `700 ${size}px "Iowan Old Style", Palatino, Georgia, serif`;
    text.font = font(100);
    const size = Math.min(h * 0.8, (100 * w * 0.94) / text.measureText("Matter.js").width);
    text.font = font(size);
    text.textAlign = "center"; text.textBaseline = "middle";
    text.fillText("Matter.js", w / 2, h * 0.5);
    const split = w / 2 - text.measureText("Matter.js").width / 2 + text.measureText("Matter").width;
    const pixels = text.getImageData(0, 0, w, h).data, targets = [];
    for (let y = gap / 2; y < h; y += gap) for (let x = gap / 2; x < w; x += gap) {
      if (pixels[(Math.round(y) * w + Math.round(x)) * 4 + 3] > 128) targets.push({ x, y });
    }

    const balls = targets.map(() => Bodies.circle(20 + Math.random() * (w - 40), -20 - Math.random() * h * 1.6, gap * 0.42, { restitution: 0.3, ...look(STEEL) }));
    const floor = wall(w / 2, h + 25, w * 2, 50);
    Composite.add(world, [floor, wall(-25, 0, 50, h * 6), wall(w + 25, 0, 50, h * 6), ...balls]);

    // Pair balls and letter dots left to right so each ball rises roughly straight up.
    const LIFT = 2300, WAVE = 900;
    let springs = null;
    let falling = false;
    return {
      draw(ctx, t) {
        if (falling || t < LIFT) return;
        if (!springs) {
          engine.gravity.y = 0;
          targets.sort((a, b) => a.x - b.x);
          balls.sort((a, b) => a.position.x - b.position.x);
          springs = balls.map((ball, i) => {
            ball.collisionFilter.group = -1;
            ball.frictionAir = 0.06;
            if (targets[i].x > split) ball.render.fillStyle = MEASURE;
            return { at: LIFT + (targets[i].x / w) * WAVE, c: Constraint.create({ pointA: targets[i], bodyB: ball, length: 0, stiffness: 0, damping: 0.1, render: { visible: false } }), on: false };
          });
        }
        for (const s of springs) {
          if (t < s.at) continue;
          if (!s.on) { s.on = true; Composite.add(world, s.c); }
          s.c.stiffness = Math.min(0.06, 0.002 + (t - s.at) / 25000);
        }
      },
      // Drop the floor and the letter springs so the balls fall off the canvas.
      fall() {
        if (falling) return;
        falling = true;
        if (springs) for (const s of springs) if (s.on) Composite.remove(world, s.c);
        Composite.remove(world, floor);
        engine.gravity.y = 1.8;
        for (const ball of balls) ball.frictionAir = 0.012;
      },
    };
  },

  departments(engine, world, render) {
    // Departments (big, gold) and their classes (small, steel) rain down as labelled blocks and pile up.
    const w = render.options.width, h = render.options.height, ctx0 = render.context;
    const departments = {
      Science: ["Physics", "Chemistry", "Biology", "Environmental Science"],
      Math: ["Algebra", "Geometry", "Precalculus", "Calculus", "Statistics"],
      English: ["Poetry", "Shakespeare", "Creative Writing"],
      History: ["U.S. History", "World History", "Economics", "Government"],
      Arts: ["Music", "Drawing", "Ceramics", "Photography", "Theater"],
      Wellbeing: [],
      "World Languages": ["French", "Spanish", "Latin"],
    };
    const fonts = { dept: '700 30px "Avenir Next", "Segoe UI", sans-serif', cls: '600 21px "Avenir Next", "Segoe UI", sans-serif' };
    // Each department drops just ahead of its classes.
    const queue = [];
    for (const [dept, classes] of Object.entries(departments)) {
      queue.push({ label: dept, kind: "dept" }, ...classes.map((c) => ({ label: c, kind: "cls" })));
    }
    Composite.add(world, [wall(w / 2, h + 25, w * 2, 50), wall(-25, 0, 50, h * 6), wall(w + 25, 0, 50, h * 6)]);
    const blocks = [];
    let n = 0;
    const id = setInterval(() => {
      if (n >= queue.length) return clearInterval(id);
      const { label, kind } = queue[n++];
      ctx0.font = fonts[kind];
      const dept = kind === "dept", bw = ctx0.measureText(label).width + (dept ? 40 : 26), bh = dept ? 56 : 40;
      const b = Bodies.rectangle(bw / 2 + Math.random() * (w - bw), -40, bw, bh, {
        chamfer: { radius: dept ? 10 : 7 }, angle: (Math.random() - 0.5) * 0.6, restitution: 0.2, friction: 0.6,
        ...look(dept ? MEASURE : pick([STEEL, STEEL, SOFT])),
      });
      b.label = label; b.kind = kind;
      blocks.push(b);
      Composite.add(world, b);
    }, 150);
    return {
      stop: () => clearInterval(id),
      draw(ctx) {
        ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        for (const b of blocks) {
          ctx.font = fonts[b.kind];
          ctx.save(); ctx.translate(b.position.x, b.position.y); ctx.rotate(b.angle);
          ctx.fillText(b.label, 0, 1); ctx.restore();
        }
      },
    };
  },

  gravity(engine, world) {
    Composite.add(world, box());
    for (let i = 0; i < 40; i++) {
      Composite.add(world, Bodies.circle(120 + (i % 10) * 36, 40 + Math.floor(i / 10) * 36, 15, { restitution: 0.3, ...look(i % 7 ? STEEL : MEASURE) }));
    }
    return (ctx, t) => {
      // Gravity swings left and right, so the whole pile sloshes.
      engine.gravity.x = Math.sin(t / 900) * 0.8;
      const gx = engine.gravity.x, cx = W / 2, cy = 60;
      ctx.strokeStyle = MEASURE; ctx.fillStyle = MEASURE; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(cx, cy - 30); ctx.lineTo(cx + gx * 40, cy + 20); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx + gx * 40, cy + 20, 7, 0, Math.PI * 2); ctx.fill();
    };
  },

  shapes(engine, world) {
    Composite.add(world, box());
    let n = 0;
    const id = setInterval(() => {
      const x = 60 + Math.random() * 480, kind = n++ % 3;
      const body = kind === 0 ? Bodies.circle(x, -20, 12 + Math.random() * 12, { restitution: 0.8, ...look(MEASURE) })
        : kind === 1 ? Bodies.rectangle(x, -20, 24 + Math.random() * 26, 24 + Math.random() * 20, { ...look(STEEL) })
        : Bodies.polygon(x, -20, 3 + Math.floor(Math.random() * 4), 18, { ...look(SOFT) });
      Composite.add(world, body);
    }, 350);
    return { stop: () => clearInterval(id) };
  },

  drag(engine, world) {
    // Shell game: the cursor swaps three pieces. To swap a and b it lifts a out
    // of the row, slides b into a's slot, then drops a into b's old slot.
    engine.gravity.y = 0;
    const slots = [150, 300, 450], row = 270, park = 130;
    const pieces = slots.map((x, i) => Bodies.rectangle(x, row, 90, 70, {
      chamfer: { radius: 12 }, inertia: Infinity, frictionAir: 0.3, ...look(i === 1 ? MEASURE : STEEL),
    }));
    Composite.add(world, [wall(W / 2, row + 50, W - 60, 6), ...pieces]);

    const order = [0, 1, 2], moves = [];
    let at = [W / 2, 60], t = 600;
    const go = (to, dur, piece) => { moves.push({ from: at, to, t0: t, t1: t + dur, piece }); at = to; t += dur; };
    // Neighbours only, so b never slides through the middle piece.
    for (const [i, j] of [[0, 1], [1, 2], [0, 1]]) {
      const a = pieces[order[i]], b = pieces[order[j]];
      go([slots[i], row], 350);
      go([slots[i], park], 400, a);
      go([slots[j], row], 350);
      go([slots[i], row], 450, b);
      go([slots[i], park], 250);
      go([slots[j], row], 450, a);
      [order[i], order[j]] = [order[j], order[i]];
    }

    const grab = Constraint.create({ pointA: { x: 0, y: 0 }, bodyB: pieces[0], length: 0, stiffness: 0.5, render: { visible: false } });
    const ease = (k) => k * k * (3 - 2 * k);
    let held = null;
    return (ctx, now) => {
      const m = moves.find((mv) => now < mv.t1);
      const k = m ? ease(Math.max(0, (now - m.t0) / (m.t1 - m.t0))) : 1;
      const [x0, y0] = m ? m.from : at, [x1, y1] = m ? m.to : at;
      const x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k;
      const want = m && now >= m.t0 ? m.piece || null : null;
      if (want !== held) {
        if (held) Composite.remove(world, grab);
        if (want) { grab.bodyB = want; Composite.add(world, grab); }
        held = want;
      }
      grab.pointA.x = x; grab.pointA.y = y;
      cursor(ctx, x, y, !!held);
    };
  },

  count(engine, world) {
    Composite.add(world, box());
    const pops = [];
    const id = setInterval(() => {
      const bodies = Composite.allBodies(world).filter((b) => !b.isStatic);
      if (performance.now() - start < 4500) {
        Composite.add(world, Bodies.circle(60 + Math.random() * 480, -20, 14, { ...look(pick([STEEL, STEEL, SOFT])) }));
      } else if (bodies.length) {
        // Click a random spot and remove whatever is under it.
        const b = pick(bodies);
        const hit = Query.point(bodies, b.position)[0];
        if (hit) { Composite.remove(world, hit); pops.push({ x: hit.position.x, y: hit.position.y, at: performance.now() }); }
      }
    }, 110);
    const start = performance.now();
    return {
      stop: () => clearInterval(id),
      draw(ctx) {
        const now = performance.now();
        for (const p of pops) if (now - p.at < 400) ring(ctx, p.x, p.y, (now - p.at) / 400);
        const n = Composite.allBodies(world).filter((b) => !b.isStatic).length;
        ctx.fillStyle = INK; ctx.font = "600 34px Avenir Next, sans-serif"; ctx.textAlign = "right";
        ctx.fillText(n, W - 24, 48);
      },
    };
  },

  collide(engine, world) {
    Composite.add(world, [...box(), wall(160, 230, 120, 14, 0.4), wall(440, 230, 120, 14, -0.4)]);
    const hits = [];
    Events.on(engine, "collisionStart", (event) => {
      for (const pair of event.pairs) {
        const point = pair.collision.supports[0];
        if (point) hits.push({ x: point.x, y: point.y, at: performance.now() });
        for (const b of [pair.bodyA, pair.bodyB]) if (!b.isStatic) { b.render.fillStyle = MEASURE; b.flashAt = performance.now(); }
      }
    });
    const id = setInterval(() => {
      Composite.add(world, Bodies.circle(100 + Math.random() * 400, -20, 13, { restitution: 0.6, ...look(STEEL) }));
    }, 500);
    return {
      stop: () => clearInterval(id),
      draw(ctx) {
        const now = performance.now();
        for (const b of Composite.allBodies(world)) if (b.flashAt && now - b.flashAt > 250) b.render.fillStyle = STEEL;
        for (const h of hits) if (now - h.at < 500) ring(ctx, h.x, h.y, (now - h.at) / 500);
      },
    };
  },

  force(engine, world) {
    engine.gravity.y = 0;
    const sun = Bodies.circle(W / 2, H / 2, 26, { isStatic: true, ...look(MEASURE) });
    const moons = [], G = 1.6;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2, r = 90 + (i % 3) * 45;
      const m = Bodies.circle(W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r, 6 + (i % 3) * 3, { frictionAir: 0, ...look(i % 4 ? STEEL : SOFT) });
      // Circular-orbit speed; Matter scales force by (16.7ms)^2 per step.
      const v = Math.sqrt((G * 16.7 * 16.7) / r);
      Body.setVelocity(m, { x: -Math.sin(a) * v, y: Math.cos(a) * v });
      moons.push(m);
    }
    Composite.add(world, [sun, ...moons]);
    Events.on(engine, "beforeUpdate", () => {
      for (const m of moons) {
        const dx = sun.position.x - m.position.x, dy = sun.position.y - m.position.y;
        const d2 = Math.max(dx * dx + dy * dy, 900), k = G * m.mass / d2 / Math.sqrt(d2);
        Body.applyForce(m, m.position, { x: dx * k, y: dy * k });
      }
    });
    return (ctx) => {
      ctx.strokeStyle = "rgba(122, 78, 8, 0.45)"; ctx.lineWidth = 2;
      for (const m of moons) {
        ctx.beginPath(); ctx.moveTo(m.position.x, m.position.y);
        ctx.lineTo(m.position.x + (sun.position.x - m.position.x) * 0.18, m.position.y + (sun.position.y - m.position.y) * 0.18);
        ctx.stroke();
      }
    };
  },

  connect(engine, world) {
    // Newton's cradle: five balls hung from fixed points.
    const r = 26, top = 60, len = 200, x0 = W / 2 - 4 * r;
    for (let i = 0; i < 5; i++) {
      const ball = Bodies.circle(x0 + i * 2 * r, top + len, r, {
        inertia: Infinity, restitution: 1, friction: 0, frictionAir: 0.0001, slop: 1, ...look(i === 0 ? MEASURE : STEEL),
      });
      Composite.add(world, [ball, Constraint.create({ pointA: { x: ball.position.x, y: top }, bodyB: ball, render: { strokeStyle: SOFT, lineWidth: 2 } })]);
      if (i === 0) Body.translate(ball, { x: -170, y: -110 });
    }
    Composite.add(world, wall(W / 2, top - 8, 320, 10));
  },

  stats(engine, world, render, runner) {
    Composite.add(world, [...box(), wall(150, 250, 260, 14, 0.25)]);
    const ball = Bodies.circle(60, 60, 20, { restitution: 0.85, ...look(MEASURE) });
    Composite.add(world, ball);
    Body.setVelocity(ball, { x: 6, y: 0 });
    const history = [];
    Events.on(engine, "afterUpdate", () => {
      history.push(Body.getSpeed(ball));
      if (history.length > 240) history.shift();
    });
    const id = setTimeout(() => { runner.enabled = false; setTimeout(() => (runner.enabled = true), 1200); }, 5000);
    return {
      stop: () => clearTimeout(id),
      draw(ctx) {
        const s = Body.getSpeed(ball);
        ctx.fillStyle = INK; ctx.font = "600 22px Avenir Next, sans-serif"; ctx.textAlign = "center";
        ctx.fillText(s.toFixed(1), ball.position.x, ball.position.y - 30);
        ctx.strokeStyle = MEASURE; ctx.lineWidth = 2; ctx.beginPath();
        history.forEach((v, i) => ctx[i ? "lineTo" : "moveTo"](W - 260 + i, 70 - Math.min(v, 20) * 2.5));
        ctx.stroke();
        if (!runner.enabled) { ctx.fillStyle = STEEL; ctx.fillRect(W - 60, 90, 10, 30); ctx.fillRect(W - 44, 90, 10, 30); }
      },
    };
  },
};

function mount(canvas) {
  let parts = null, timer = 0;
  const width = canvas.width, height = canvas.height; // Render rescales the canvas, so read once.

  function build() {
    teardown();
    const engine = Engine.create();
    const render = Render.create({ canvas, engine, options: { width, height, wireframes: false, background: "transparent", pixelRatio: window.devicePixelRatio } });
    const runner = Runner.create();
    const out = scenes[canvas.dataset.demo](engine, engine.world, render, runner) || {};
    const draw = typeof out === "function" ? out : out.draw;
    const start = performance.now();
    if (draw) Events.on(render, "afterRender", () => draw(render.context, performance.now() - start));
    Render.run(render);
    Runner.run(runner, engine);
    parts = { engine, render, runner, stop: out.stop };
    canvas.demoFall = typeof out.fall === "function" ? out.fall : null;
    if (canvas.dataset.loop !== "off") timer = setTimeout(build, LOOP);
  }

  function teardown() {
    clearTimeout(timer);
    if (!parts) return;
    if (parts.stop) parts.stop();
    Render.stop(parts.render);
    parts.render.context.clearRect(0, 0, canvas.width, canvas.height);
    Runner.stop(parts.runner);
    Engine.clear(parts.engine);
    parts = null;
  }

  return { build, teardown };
}

const demos = new Map(Array.from(document.querySelectorAll("canvas[data-demo]"), (c) => [c, mount(c)]));

// Called by the deck whenever the visible slide changes.
function playSlide(slide) {
  // A data-hold canvas waits until its slide is marked revealed.
  const live = (canvas) => slide.contains(canvas) && !(canvas.dataset.hold !== undefined && !slide.classList.contains("revealed"));
  demos.forEach((demo, canvas) => (live(canvas) ? demo.build() : demo.teardown()));
}
