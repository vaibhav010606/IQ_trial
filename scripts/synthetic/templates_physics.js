// JEE Physics question templates. Each template computes its own answer, so the
// key is correct by construction; wrong options are typical student slips.
// gen(r) -> { text, ans, unit, wrongs, difficulty? } (ans: number)
const { fmt } = require('./util');

const G = 10;

module.exports = [
  // ── Kinematics ───────────────────────────────────────────────────────────
  {
    topic: 'Kinematics', sub: 'Distance in nth second', difficulty: 'easy',
    gen: (r) => {
      const u = r.int(0, 10), a = r.pick([2, 4, 6, 8, 10]), n = r.int(3, 12);
      const ans = u + (a * (2 * n - 1)) / 2;
      return {
        text: `A particle moving in a straight line has initial velocity $${u}\\ \\text{m/s}$ and uniform acceleration $${a}\\ \\text{m/s}^2$. The distance covered by it in the ${n}th second is`,
        ans, unit: 'm',
        wrongs: [u + (a * (2 * n + 1)) / 2, u * n + (a * n * n) / 2, (a * (2 * n - 1)) / 2 + 2 * u],
      };
    },
  },
  {
    topic: 'Kinematics', sub: 'Equations of motion', difficulty: 'easy',
    gen: (r) => {
      const a = r.pick([2, 4, 5, 10]), t = r.int(2, 12), u = r.int(0, 20);
      const ans = u * t + (a * t * t) / 2;
      return {
        text: `A car starts with a speed of $${u}\\ \\text{m/s}$ and accelerates uniformly at $${a}\\ \\text{m/s}^2$ for $${t}\\ \\text{s}$. The distance travelled in this time is`,
        ans, unit: 'm',
        wrongs: [u * t + a * t * t, u * t, (u + a * t) * t],
      };
    },
  },
  {
    topic: 'Kinematics', sub: 'Stopping distance', difficulty: 'medium',
    gen: (r) => {
      const v = r.pick([10, 20, 30, 40, 50, 60]), a = r.pick([2, 4, 5, 8, 10]);
      const ans = (v * v) / (2 * a);
      return {
        text: `A vehicle moving at $${v}\\ \\text{m/s}$ applies brakes producing a uniform retardation of $${a}\\ \\text{m/s}^2$. The distance it travels before stopping is`,
        ans, unit: 'm',
        wrongs: [(v * v) / a, v / a, (v * v) / (4 * a)],
      };
    },
  },
  {
    topic: 'Kinematics', sub: 'Projectile range', difficulty: 'medium',
    gen: (r) => {
      const u = r.pick([10, 20, 30, 40, 50]), th = r.pick([15, 45, 75]);
      const s2 = th === 45 ? 1 : 0.5;
      const ans = (u * u * s2) / G;
      return {
        text: `A ball is projected with speed $${u}\\ \\text{m/s}$ at $${th}^\\circ$ to the horizontal. Taking $g = 10\\ \\text{m/s}^2$, its horizontal range is`,
        ans, unit: 'm',
        wrongs: [(u * u) / G, (u * u * s2) / (2 * G), (2 * u * u * s2) / G],
      };
    },
  },
  {
    topic: 'Kinematics', sub: 'Projectile maximum height', difficulty: 'medium',
    gen: (r) => {
      const u = r.pick([20, 40, 60, 80, 100]), th = r.pick([30, 90]);
      const sin2 = th === 30 ? 0.25 : 1;
      const ans = (u * u * sin2) / (2 * G);
      return {
        text: `A projectile is fired with speed $${u}\\ \\text{m/s}$ at $${th}^\\circ$ with the horizontal ($g = 10\\ \\text{m/s}^2$). The maximum height reached is`,
        ans, unit: 'm',
        wrongs: [(u * u * sin2) / G, (u * u) / (2 * G), (u * u * Math.sqrt(sin2)) / (2 * G)],
      };
    },
  },
  {
    topic: 'Kinematics', sub: 'Time of flight', difficulty: 'easy',
    gen: (r) => {
      const u = r.pick([10, 20, 30, 40, 50, 60]), th = r.pick([30, 90]);
      const s = th === 30 ? 0.5 : 1;
      const ans = (2 * u * s) / G;
      return {
        text: `A body is projected with velocity $${u}\\ \\text{m/s}$ at an angle of $${th}^\\circ$ with the horizontal. With $g = 10\\ \\text{m/s}^2$, its time of flight is`,
        ans, unit: 's',
        wrongs: [(u * s) / G, (2 * u) / G === ans ? (4 * u * s) / G : (2 * u) / G, (u * u * s) / (G * 10)],
      };
    },
  },
  {
    topic: 'Kinematics', sub: 'River crossing', difficulty: 'easy',
    gen: (r) => {
      const d = r.pick([100, 120, 150, 200, 240, 300, 400, 600]), vb = r.pick([2, 3, 4, 5, 6]), vr = r.pick([1, 2, 3]);
      const ans = d / vb;
      return {
        text: `A boat can move at $${vb}\\ \\text{m/s}$ in still water. It crosses a river of width $${d}\\ \\text{m}$ flowing at $${vr}\\ \\text{m/s}$, heading perpendicular to the current. The time taken to cross is`,
        ans, unit: 's',
        wrongs: [d / (vb + vr), d / Math.abs(vb - vr || 1) + 1, d / Math.sqrt(vb * vb + vr * vr)],
      };
    },
  },
  {
    topic: 'Kinematics', sub: 'Free fall', difficulty: 'easy',
    gen: (r) => {
      const t = r.int(1, 10);
      const ans = (G * t * t) / 2;
      return {
        text: `A stone is dropped from rest from the top of a tower and reaches the ground in $${t}\\ \\text{s}$. Neglecting air resistance and taking $g = 10\\ \\text{m/s}^2$, the height of the tower is`,
        ans, unit: 'm',
        wrongs: [G * t * t, G * t, (G * t * t) / 4],
      };
    },
  },
  // ── Dynamics ─────────────────────────────────────────────────────────────
  {
    topic: 'Dynamics of a Particle', sub: 'Atwood machine acceleration', difficulty: 'medium',
    gen: (r) => {
      let m1 = r.int(2, 12), m2 = r.int(1, m1 - 1);
      const ans = ((m1 - m2) * G) / (m1 + m2);
      return {
        text: `Two blocks of masses $${m1}\\ \\text{kg}$ and $${m2}\\ \\text{kg}$ hang over a light frictionless pulley by a light string. Taking $g = 10\\ \\text{m/s}^2$, the acceleration of the system is`,
        ans, unit: 'm/s²',
        wrongs: [((m1 + m2) * G) / (m1 - m2), ((m1 - m2) * G) / m1, (m1 * G) / (m1 + m2)],
      };
    },
  },
  {
    topic: 'Dynamics of a Particle', sub: 'Atwood machine tension', difficulty: 'medium',
    gen: (r) => {
      const m1 = r.int(2, 10), m2 = r.int(1, 10);
      if (m1 === m2) return null;
      const ans = (2 * m1 * m2 * G) / (m1 + m2);
      return {
        text: `Masses of $${m1}\\ \\text{kg}$ and $${m2}\\ \\text{kg}$ are connected by a light inextensible string over a smooth fixed pulley ($g = 10\\ \\text{m/s}^2$). The tension in the string is`,
        ans, unit: 'N',
        wrongs: [(m1 * m2 * G) / (m1 + m2), ((m1 + m2) * G) / 2, Math.abs(m1 - m2) * G],
      };
    },
  },
  {
    topic: 'Dynamics of a Particle', sub: 'Incline with friction', difficulty: 'medium',
    gen: (r) => {
      const th = r.pick([37, 53]), mu = r.pick([0.1, 0.2, 0.25, 0.5]);
      const [s, c] = th === 37 ? [0.6, 0.8] : [0.8, 0.6];
      const ans = G * (s - mu * c);
      if (ans <= 0) return null;
      return {
        text: `A block slides down a rough incline of angle $${th}^\\circ$ ($\\sin ${th}^\\circ = ${s}$). The coefficient of kinetic friction is $${mu}$. Taking $g = 10\\ \\text{m/s}^2$, the acceleration of the block is`,
        ans, unit: 'm/s²',
        wrongs: [G * (s + mu * c), G * s, G * (c - mu * s)],
      };
    },
  },
  {
    topic: 'Dynamics of a Particle', sub: 'Apparent weight in a lift', difficulty: 'easy',
    gen: (r) => {
      const m = r.pick([40, 50, 60, 70, 80]), a = r.pick([1, 2, 2.5, 4, 5]), up = r.chance(0.5);
      const ans = m * (G + (up ? a : -a));
      return {
        text: `A person of mass $${m}\\ \\text{kg}$ stands on a weighing machine in a lift ${up ? 'accelerating upward' : 'accelerating downward'} at $${a}\\ \\text{m/s}^2$. With $g = 10\\ \\text{m/s}^2$, the reading of the machine (in newton) is`,
        ans, unit: 'N',
        wrongs: [m * (G + (up ? -a : a)), m * G, m * a],
      };
    },
  },
  {
    topic: 'Dynamics of a Particle', sub: 'Impulse and force', difficulty: 'easy',
    gen: (r) => {
      const m = r.pick([0.1, 0.2, 0.5, 1, 2]), v = r.pick([10, 20, 30, 40]), t = r.pick([0.01, 0.02, 0.05, 0.1]);
      const ans = (2 * m * v) / t;
      return {
        text: `A ball of mass $${m}\\ \\text{kg}$ hits a wall normally at $${v}\\ \\text{m/s}$ and rebounds with the same speed. If contact lasts $${t}\\ \\text{s}$, the average force on the wall is`,
        ans, unit: 'N',
        wrongs: [(m * v) / t, 0 + (m * v * t) || 1, (4 * m * v) / t],
      };
    },
  },
  {
    topic: 'Dynamics of a Particle', sub: 'Circular motion', difficulty: 'easy',
    gen: (r) => {
      const m = r.pick([1, 2, 3, 4, 5]), v = r.pick([2, 4, 5, 6, 10]), rad = r.pick([1, 2, 4, 5]);
      const ans = (m * v * v) / rad;
      return {
        text: `A body of mass $${m}\\ \\text{kg}$ moves uniformly in a circle of radius $${rad}\\ \\text{m}$ with speed $${v}\\ \\text{m/s}$. The centripetal force on it is`,
        ans, unit: 'N',
        wrongs: [(m * v) / rad, (m * v * v) / (2 * rad), m * v * v * rad],
      };
    },
  },
  {
    topic: 'Dynamics of a Particle', sub: 'Banking and friction on curves', difficulty: 'medium',
    gen: (r) => {
      const mu = r.pick([0.1, 0.2, 0.4, 0.5, 0.8]), rad = r.pick([10, 20, 40, 50, 80, 100, 160, 200]);
      const v2 = mu * G * rad;
      const v = Math.sqrt(v2);
      if (!Number.isInteger(v)) return null;
      return {
        text: `A car takes an unbanked circular turn of radius $${rad}\\ \\text{m}$. If the coefficient of static friction is $${mu}$ and $g = 10\\ \\text{m/s}^2$, the maximum safe speed is`,
        ans: v, unit: 'm/s',
        wrongs: [v2, Math.sqrt(2) * v, v / 2],
      };
    },
  },
  // ── Work, power, energy ──────────────────────────────────────────────────
  {
    topic: 'Work, Power and Energy', sub: 'Kinetic energy', difficulty: 'easy',
    gen: (r) => {
      const m = r.pick([1, 2, 4, 5, 10, 20]), v = r.int(2, 20);
      const ans = (m * v * v) / 2;
      return {
        text: `The kinetic energy of a body of mass $${m}\\ \\text{kg}$ moving at $${v}\\ \\text{m/s}$ is`,
        ans, unit: 'J',
        wrongs: [m * v * v, (m * v) / 2, m * v],
      };
    },
  },
  {
    topic: 'Work, Power and Energy', sub: 'Spring potential energy', difficulty: 'easy',
    gen: (r) => {
      const k = r.pick([100, 200, 400, 500, 800, 1000]), x = r.pick([0.1, 0.2, 0.3, 0.4, 0.5]);
      const ans = (k * x * x) / 2;
      return {
        text: `A spring of force constant $${k}\\ \\text{N/m}$ is compressed by $${x * 100}\\ \\text{cm}$. The elastic potential energy stored is`,
        ans, unit: 'J',
        wrongs: [k * x * x, (k * x) / 2, k * x],
      };
    },
  },
  {
    topic: 'Work, Power and Energy', sub: 'Power', difficulty: 'easy',
    gen: (r) => {
      const m = r.pick([50, 60, 80, 100, 200]), h = r.pick([5, 10, 15, 20]), t = r.pick([5, 10, 20, 25]);
      const ans = (m * G * h) / t;
      return {
        text: `A motor lifts a load of $${m}\\ \\text{kg}$ through a height of $${h}\\ \\text{m}$ in $${t}\\ \\text{s}$ at constant speed ($g = 10\\ \\text{m/s}^2$). The power delivered is`,
        ans, unit: 'W',
        wrongs: [m * G * h, (m * h) / t, (m * G * h) / (2 * t)],
      };
    },
  },
  {
    topic: 'Work, Power and Energy', sub: 'Energy conservation', difficulty: 'medium',
    gen: (r) => {
      const v = r.pick([10, 20, 30, 40]);
      const h = (v * v) / (2 * G);
      return {
        text: `A body slides from rest down a smooth curved track from a height of $${fmt(h)}\\ \\text{m}$. Taking $g = 10\\ \\text{m/s}^2$, its speed at the bottom is`,
        ans: v, unit: 'm/s',
        wrongs: [v * Math.SQRT2, v / 2, 2 * h],
      };
    },
  },
  {
    topic: 'Work, Power and Energy', sub: 'Work by a constant force', difficulty: 'easy',
    gen: (r) => {
      const F = r.pick([10, 20, 25, 40, 50]), d = r.pick([2, 4, 5, 8, 10]), th = r.pick([0, 60]);
      const ans = F * d * (th === 0 ? 1 : 0.5);
      return {
        text: `A force of $${F}\\ \\text{N}$ acting at $${th}^\\circ$ to the direction of motion displaces a body by $${d}\\ \\text{m}$. The work done by the force is`,
        ans, unit: 'J',
        wrongs: [th === 0 ? F * d * 0.5 : F * d, (F * d) / 4, F + d],
      };
    },
  },
  // ── Rotation & gravitation ───────────────────────────────────────────────
  {
    topic: 'Rotation and Gravitation', sub: 'Moment of inertia', difficulty: 'medium',
    gen: (r) => {
      const M = r.pick([2, 3, 4, 6, 8, 12]), L = r.pick([1, 2, 3]);
      const body = r.pick(['rod-centre', 'rod-end', 'ring', 'disc']);
      const map = {
        'rod-centre': [1 / 12, `a uniform rod of mass $${M}\\ \\text{kg}$ and length $${L}\\ \\text{m}$ about a perpendicular axis through its centre`],
        'rod-end': [1 / 3, `a uniform rod of mass $${M}\\ \\text{kg}$ and length $${L}\\ \\text{m}$ about a perpendicular axis through one end`],
        ring: [1, `a thin ring of mass $${M}\\ \\text{kg}$ and radius $${L}\\ \\text{m}$ about its central axis`],
        disc: [1 / 2, `a uniform disc of mass $${M}\\ \\text{kg}$ and radius $${L}\\ \\text{m}$ about its central axis`],
      };
      const [k, desc] = map[body];
      const ans = k * M * L * L;
      const others = [1 / 12, 1 / 3, 1, 1 / 2, 2 / 5].filter((x) => x !== k).map((x) => x * M * L * L);
      return { text: `The moment of inertia of ${desc} is`, ans, unit: 'kg m²', wrongs: others };
    },
  },
  {
    topic: 'Rotation and Gravitation', sub: 'Torque and angular acceleration', difficulty: 'medium',
    gen: (r) => {
      const I = r.pick([2, 4, 5, 8, 10]), alpha = r.pick([2, 3, 4, 5, 6]);
      return {
        text: `A torque acts on a wheel of moment of inertia $${I}\\ \\text{kg m}^2$ and gives it an angular acceleration of $${alpha}\\ \\text{rad/s}^2$. The magnitude of the torque is`,
        ans: I * alpha, unit: 'N m',
        wrongs: [I / alpha, (I * alpha) / 2, I + alpha],
      };
    },
  },
  {
    topic: 'Rotation and Gravitation', sub: 'Rolling kinetic energy', difficulty: 'hard',
    gen: (r) => {
      const m = r.pick([1, 2, 4, 5, 10]), v = r.pick([2, 4, 6, 10]);
      const body = r.pick(['ring', 'disc', 'solid sphere']);
      const k2 = { ring: 1, disc: 0.5, 'solid sphere': 0.4 }[body];
      const ans = 0.5 * m * v * v * (1 + k2);
      return {
        text: `A ${body} of mass $${m}\\ \\text{kg}$ rolls without slipping with speed $${v}\\ \\text{m/s}$ on its centre of mass. Its total kinetic energy is`,
        ans, unit: 'J',
        wrongs: [0.5 * m * v * v, m * v * v * (1 + k2), 0.5 * m * v * v * k2],
      };
    },
  },
  {
    topic: 'Universal Gravitation', sub: 'g on another planet', difficulty: 'medium',
    gen: (r) => {
      const km = r.pick([2, 3, 4, 8, 9, 16]), kr = r.pick([2, 3, 4]);
      const ratio = km / (kr * kr);
      const ans = 10 * ratio;
      return {
        text: `A planet has ${km} times the mass and ${kr} times the radius of the Earth. If $g = 10\\ \\text{m/s}^2$ on Earth, the acceleration due to gravity on the planet is`,
        ans, unit: 'm/s²',
        wrongs: [(10 * km) / kr, 10 * km * kr * kr, (10 * kr * kr) / km],
      };
    },
  },
  {
    topic: 'Universal Gravitation', sub: "Kepler's third law", difficulty: 'medium',
    gen: (r) => {
      const n = r.pick([4, 9, 16]), T = r.pick([1, 2, 3, 5, 10, 24]);
      const ans = T * Math.pow(n, 1.5);
      return {
        text: `Two satellites orbit a planet. The orbital radius of the second is ${n} times that of the first, whose period is $${T}$ hours. The period of the second satellite is`,
        ans, unit: 'hours',
        wrongs: [T * n, T * n * n, T * Math.sqrt(n)],
      };
    },
  },
  {
    topic: 'Universal Gravitation', sub: 'Escape velocity', difficulty: 'medium',
    gen: (r) => {
      const ve = 11.2, km = r.pick([4, 9, 16]), kr = r.pick([1, 4]);
      const ans = ve * Math.sqrt(km / kr);
      return {
        text: `The escape velocity from Earth is $11.2\\ \\text{km/s}$. For a planet with ${km} times the mass of Earth and ${kr === 1 ? 'the same radius' : `${kr} times its radius`}, the escape velocity is`,
        ans, unit: 'km/s',
        wrongs: [(ve * km) / kr, ve * Math.sqrt(kr / km), ve * Math.sqrt(km * kr)],
      };
    },
  },
  // ── SHM & waves ──────────────────────────────────────────────────────────
  {
    topic: 'SHM', sub: 'Maximum speed', difficulty: 'easy',
    gen: (r) => {
      const A = r.pick([2, 3, 4, 5, 10]), w = r.pick([2, 4, 5, 10, 20]);
      return {
        text: `A particle executes SHM with amplitude $${A}\\ \\text{cm}$ and angular frequency $${w}\\ \\text{rad/s}$. Its maximum speed is`,
        ans: A * w, unit: 'cm/s',
        wrongs: [A * w * w, (A * w) / 2, A / w],
      };
    },
  },
  {
    topic: 'SHM', sub: 'Energy in SHM', difficulty: 'medium',
    gen: (r) => {
      const k = r.pick([100, 200, 400, 800]), A = r.pick([0.1, 0.2, 0.5]);
      const ans = 0.5 * k * A * A;
      return {
        text: `A mass on a spring of constant $${k}\\ \\text{N/m}$ oscillates with amplitude $${A * 100}\\ \\text{cm}$. The total mechanical energy of oscillation is`,
        ans, unit: 'J',
        wrongs: [k * A * A, 0.25 * k * A * A, 0.5 * k * A],
      };
    },
  },
  {
    topic: 'SHM', sub: 'Spring-mass period', difficulty: 'medium',
    gen: (r) => {
      const n = r.pick([1, 2, 3, 4]), k = r.pick([25, 100, 400]);
      const m = (k * n * n) / 4; // T = 2π√(m/k) = nπ
      return {
        text: `A block of mass $${fmt(m)}\\ \\text{kg}$ is attached to a spring of force constant $${k}\\ \\text{N/m}$. The time period of oscillation, in units of $\\pi$ seconds, is`,
        ans: n, unit: 'π s',
        wrongs: [2 * n, n / 2, n * n],
      };
    },
  },
  {
    topic: 'Wave Motion', sub: 'Wave speed', difficulty: 'easy',
    gen: (r) => {
      const f = r.pick([50, 100, 200, 250, 400, 500]), lam = r.pick([0.2, 0.5, 1, 1.5, 2]);
      return {
        text: `A wave of frequency $${f}\\ \\text{Hz}$ has a wavelength of $${lam}\\ \\text{m}$. Its speed is`,
        ans: f * lam, unit: 'm/s',
        wrongs: [f / lam, (f * lam) / 2, 2 * f * lam],
      };
    },
  },
  {
    topic: 'Wave Motion', sub: 'Fundamental of a string', difficulty: 'medium',
    gen: (r) => {
      const v = r.pick([100, 200, 300, 400]), L = r.pick([0.5, 1, 2]);
      return {
        text: `Transverse waves travel at $${v}\\ \\text{m/s}$ on a string of length $${L}\\ \\text{m}$ fixed at both ends. The fundamental frequency is`,
        ans: v / (2 * L), unit: 'Hz',
        wrongs: [v / L, v / (4 * L), (2 * v) / L],
      };
    },
  },
  {
    topic: 'Wave Motion', sub: 'Closed organ pipe', difficulty: 'medium',
    gen: (r) => {
      const v = r.pick([320, 340, 360]), L = r.pick([0.4, 0.5, 0.8, 1]);
      return {
        text: `A pipe of length $${L * 100}\\ \\text{cm}$ is closed at one end. If the speed of sound is $${v}\\ \\text{m/s}$, its fundamental frequency is`,
        ans: v / (4 * L), unit: 'Hz',
        wrongs: [v / (2 * L), v / L, (3 * v) / (4 * L)],
      };
    },
  },
  {
    topic: 'Wave Motion', sub: 'Beats', difficulty: 'easy',
    gen: (r) => {
      const f1 = r.int(200, 520), d = r.int(2, 9);
      return {
        text: `Two tuning forks of frequencies $${f1}\\ \\text{Hz}$ and $${f1 + d}\\ \\text{Hz}$ are sounded together. The number of beats heard per second is`,
        ans: d, unit: '',
        wrongs: [2 * d, d / 2, d + 1],
      };
    },
  },
  // ── Thermal physics ──────────────────────────────────────────────────────
  {
    topic: 'Thermodynamics', sub: 'Carnot efficiency', difficulty: 'easy',
    gen: (r) => {
      const Th = r.pick([400, 500, 600, 800, 1000]), Tc = r.pick([200, 300, 400]);
      if (Tc >= Th) return null;
      const ans = (1 - Tc / Th) * 100;
      return {
        text: `A Carnot engine works between a source at $${Th}\\ \\text{K}$ and a sink at $${Tc}\\ \\text{K}$. Its efficiency (in percent) is`,
        ans, unit: '%',
        wrongs: [(Tc / Th) * 100, (1 - Tc / (Th + Tc)) * 100, ((Th - Tc) / Tc) * 100],
      };
    },
  },
  {
    topic: 'Thermodynamics', sub: 'First law', difficulty: 'easy',
    gen: (r) => {
      const Q = r.pick([200, 300, 500, 800, 1000]), W = r.pick([50, 100, 150, 200]);
      return {
        text: `A gas absorbs $${Q}\\ \\text{J}$ of heat and does $${W}\\ \\text{J}$ of work on its surroundings. The change in its internal energy is`,
        ans: Q - W, unit: 'J',
        wrongs: [Q + W, W - Q, Q],
      };
    },
  },
  {
    topic: 'Thermodynamics', sub: 'Isobaric work', difficulty: 'easy',
    gen: (r) => {
      const P = r.pick([1, 2, 3, 5]), V1 = r.pick([1, 2, 3]), dV = r.pick([1, 2, 4]);
      const ans = P * 1e5 * dV * 1e-3;
      return {
        text: `A gas at a constant pressure of $${P}\\times10^5\\ \\text{Pa}$ expands from $${V1}\\ \\text{L}$ to $${V1 + dV}\\ \\text{L}$. The work done by the gas is`,
        ans, unit: 'J',
        wrongs: [ans * 10, ans / 10, P * 1e5 * (V1 + dV) * 1e-3],
      };
    },
  },
  {
    topic: 'Thermodynamics', sub: 'Heat capacity', difficulty: 'easy',
    gen: (r) => {
      const m = r.pick([0.5, 1, 2, 5]), dT = r.pick([10, 20, 25, 40, 50]);
      const c = 4200;
      return {
        text: `The heat needed to raise the temperature of $${m}\\ \\text{kg}$ of water by $${dT}^\\circ\\text{C}$ (specific heat $4200\\ \\text{J kg}^{-1}\\text{K}^{-1}$) is`,
        ans: m * c * dT, unit: 'J',
        wrongs: [(c * dT) / m, m * c, m * dT * 4.2],
      };
    },
  },
  {
    topic: "Kinetic Theory of Gases. Boltzmann's Law and Maxwell's Distribution", sub: 'rms speed and temperature', difficulty: 'medium',
    gen: (r) => {
      const v = r.pick([200, 300, 400, 500]), k = r.pick([4, 9, 16]);
      return {
        text: `The rms speed of the molecules of a gas is $${v}\\ \\text{m/s}$. If its absolute temperature is made ${k} times, the rms speed becomes`,
        ans: v * Math.sqrt(k), unit: 'm/s',
        wrongs: [v * k, v / Math.sqrt(k), v * k * k],
      };
    },
  },
  // ── Properties of matter, fluids ─────────────────────────────────────────
  {
    topic: 'Properties of Matter', sub: "Young's modulus", difficulty: 'medium',
    gen: (r) => {
      const F = r.pick([100, 200, 400, 500, 1000]), L = r.pick([1, 2, 4]), A = r.pick([1, 2, 5]), Y = r.pick([1, 2, 4]);
      const dL = (F * L) / (A * 1e-6 * Y * 1e11) * 1000; // mm
      return {
        text: `A wire of length $${L}\\ \\text{m}$ and cross-section $${A}\\ \\text{mm}^2$ ($Y = ${Y}\\times10^{11}\\ \\text{N/m}^2$) is stretched by a force of $${F}\\ \\text{N}$. Its extension, in mm, is`,
        ans: dL, unit: 'mm',
        wrongs: [dL * 10, dL / 2, dL * 2],
      };
    },
  },
  {
    topic: 'Hydrodynamics', sub: 'Pressure at depth', difficulty: 'easy',
    gen: (r) => {
      const h = r.pick([2, 5, 10, 20, 50]);
      const ans = 1000 * G * h;
      return {
        text: `The pressure due to water alone ($\\rho = 1000\\ \\text{kg/m}^3$, $g = 10\\ \\text{m/s}^2$) at a depth of $${h}\\ \\text{m}$ below the surface is`,
        ans, unit: 'Pa',
        wrongs: [ans / G, ans * 2, ans + 1e5],
      };
    },
  },
  {
    topic: 'Hydrodynamics', sub: "Torricelli's theorem", difficulty: 'easy',
    gen: (r) => {
      const v = r.pick([2, 4, 6, 8, 10, 20]);
      const h = (v * v) / (2 * G);
      return {
        text: `Water flows out of a small hole at a depth of $${fmt(h)}\\ \\text{m}$ below the free surface of a large open tank ($g = 10\\ \\text{m/s}^2$). The speed of efflux is`,
        ans: v, unit: 'm/s',
        wrongs: [v * Math.SQRT2, v / 2, v * v],
      };
    },
  },
  {
    topic: 'Hydrodynamics', sub: 'Equation of continuity', difficulty: 'easy',
    gen: (r) => {
      const A1 = r.pick([2, 4, 6, 8, 10]), A2 = r.pick([1, 2, 4, 5]), v1 = r.pick([1, 2, 3, 5]);
      if (A1 === A2) return null;
      return {
        text: `Water flows at $${v1}\\ \\text{m/s}$ through a pipe of cross-section $${A1}\\ \\text{cm}^2$, which narrows to $${A2}\\ \\text{cm}^2$. The speed in the narrow part is`,
        ans: (A1 * v1) / A2, unit: 'm/s',
        wrongs: [(A2 * v1) / A1, v1 * Math.sqrt(A1 / A2), A1 * A2 * v1],
      };
    },
  },
  // ── Electricity & magnetism ──────────────────────────────────────────────
  {
    topic: 'Electrostatics', sub: "Coulomb's law", difficulty: 'easy',
    gen: (r) => {
      const q1 = r.int(1, 9), q2 = r.int(1, 9), d = r.pick([1, 3]);
      const ans = (9 * q1 * q2) / (d * d); // mN
      return {
        text: `Two point charges of $${q1}\\ \\mu\\text{C}$ and $${q2}\\ \\mu\\text{C}$ are placed $${d}\\ \\text{m}$ apart in air ($k = 9\\times10^9\\ \\text{N m}^2/\\text{C}^2$). The force between them, in millinewton, is`,
        ans, unit: 'mN',
        wrongs: [(9 * q1 * q2) / d, ans * 10, (9 * (q1 + q2)) / (d * d)],
      };
    },
  },
  {
    topic: 'Electrostatics', sub: 'Potential of a point charge', difficulty: 'easy',
    gen: (r) => {
      const q = r.int(1, 10), d = r.pick([1, 3, 9]);
      const ans = (9 * q) / d; // kV
      return {
        text: `The electric potential at a distance of $${d}\\ \\text{m}$ from a point charge of $${q}\\ \\mu\\text{C}$ in air ($k = 9\\times10^9$ SI units), in kilovolt, is`,
        ans, unit: 'kV',
        wrongs: [(9 * q) / (d * d), ans * 10, (9 * q * d)],
      };
    },
  },
  {
    topic: 'DC Circuits and Capacitors', sub: 'Capacitor energy', difficulty: 'easy',
    gen: (r) => {
      const C = r.pick([2, 4, 5, 10, 20]), V = r.pick([10, 20, 50, 100]);
      const ans = (0.5 * C * V * V) / 1000; // mJ (C in μF)
      return {
        text: `A capacitor of $${C}\\ \\mu\\text{F}$ is charged to $${V}\\ \\text{V}$. The energy stored in it, in millijoule, is`,
        ans, unit: 'mJ',
        wrongs: [ans * 2, (C * V) / 1000, ans / 2],
      };
    },
  },
  {
    topic: 'DC Circuits and Capacitors', sub: 'Capacitors in series and parallel', difficulty: 'medium',
    gen: (r) => {
      const a = r.pick([2, 3, 4, 6, 12]), b = r.pick([3, 4, 6, 12]), series = r.chance(0.5);
      const ans = series ? (a * b) / (a + b) : a + b;
      return {
        text: `Capacitors of $${a}\\ \\mu\\text{F}$ and $${b}\\ \\mu\\text{F}$ are connected in ${series ? 'series' : 'parallel'}. The equivalent capacitance is`,
        ans, unit: 'μF',
        wrongs: [series ? a + b : (a * b) / (a + b), Math.abs(a - b) || a * 2, (a + b) / 2 + (series ? 1 : 0.5)],
      };
    },
  },
  {
    topic: 'DC Circuits and Capacitors', sub: 'Resistors in combination', difficulty: 'easy',
    gen: (r) => {
      const a = r.pick([2, 3, 4, 6, 12]), b = r.pick([3, 4, 6, 12]), c = r.pick([1, 2, 4, 5]);
      const ans = (a * b) / (a + b) + c;
      return {
        text: `Resistors of $${a}\\ \\Omega$ and $${b}\\ \\Omega$ in parallel are connected in series with a $${c}\\ \\Omega$ resistor. The equivalent resistance is`,
        ans, unit: 'Ω',
        wrongs: [a + b + c, (a * b * c) / (a * b + b * c + c * a), (a * b) / (a + b)],
      };
    },
  },
  {
    topic: 'DC Circuits and Capacitors', sub: 'Internal resistance', difficulty: 'medium',
    gen: (r) => {
      const E = r.pick([6, 9, 12, 24]), R = r.pick([2, 4, 5, 10]), rin = r.pick([1, 2]);
      const ans = E / (R + rin);
      return {
        text: `A cell of emf $${E}\\ \\text{V}$ and internal resistance $${rin}\\ \\Omega$ is connected across a $${R}\\ \\Omega$ resistor. The current drawn is`,
        ans, unit: 'A',
        wrongs: [E / R, E / rin, E / (R - rin || 1) + 0.5],
      };
    },
  },
  {
    topic: 'DC Circuits and Capacitors', sub: 'Electrical power', difficulty: 'easy',
    gen: (r) => {
      const V = r.pick([100, 200, 220, 240]), R = r.pick([10, 20, 40, 50, 100]);
      return {
        text: `A heater of resistance $${R}\\ \\Omega$ is connected to a $${V}\\ \\text{V}$ supply. The power consumed is`,
        ans: (V * V) / R, unit: 'W',
        wrongs: [V / R, V * R, (V * V) / (2 * R)],
      };
    },
  },
  {
    topic: 'Magnetic Effects of Current', sub: 'Force on a moving charge', difficulty: 'easy',
    gen: (r) => {
      const q = r.pick([1, 2, 4, 5]), v = r.pick([1, 2, 5, 10]), B = r.pick([0.1, 0.2, 0.5, 1]);
      const ans = q * v * B; // q μC, v 10^6 m/s -> N
      return {
        text: `A charge of $${q}\\ \\mu\\text{C}$ moves at $${v}\\times10^6\\ \\text{m/s}$ perpendicular to a uniform magnetic field of $${B}\\ \\text{T}$. The magnetic force on it is`,
        ans, unit: 'N',
        wrongs: [ans * 10, ans / 2, (q * v) / B],
      };
    },
  },
  {
    topic: 'Magnetic Effects of Current', sub: 'Force on a current-carrying wire', difficulty: 'easy',
    gen: (r) => {
      const I = r.pick([1, 2, 5, 10]), L = r.pick([0.5, 1, 2]), B = r.pick([0.2, 0.5, 1, 2]), th = r.pick([30, 90]);
      const ans = I * L * B * (th === 90 ? 1 : 0.5);
      return {
        text: `A straight wire of length $${L}\\ \\text{m}$ carrying $${I}\\ \\text{A}$ is placed at $${th}^\\circ$ to a uniform magnetic field of $${B}\\ \\text{T}$. The force on the wire is`,
        ans, unit: 'N',
        wrongs: [th === 90 ? ans / 2 : ans * 2, (I * B) / L, I * L * B * (Math.sqrt(3) / 2)],
      };
    },
  },
  {
    topic: 'EMI and AC Circuits', sub: 'Motional emf', difficulty: 'easy',
    gen: (r) => {
      const B = r.pick([0.1, 0.2, 0.5, 1]), l = r.pick([0.5, 1, 2]), v = r.pick([2, 5, 10, 20]);
      return {
        text: `A conducting rod of length $${l}\\ \\text{m}$ moves at $${v}\\ \\text{m/s}$ perpendicular to a magnetic field of $${B}\\ \\text{T}$. The emf induced across its ends is`,
        ans: B * l * v, unit: 'V',
        wrongs: [(B * l * v) / 2, (B * v) / l, B * l * v * v],
      };
    },
  },
  {
    topic: 'EMI and AC Circuits', sub: 'Transformer', difficulty: 'easy',
    gen: (r) => {
      const Vp = r.pick([110, 220, 240]), Np = r.pick([100, 200, 500]), Ns = r.pick([1000, 2000, 50, 25]);
      return {
        text: `A transformer has $${Np}$ turns in the primary and $${Ns}$ turns in the secondary. If $${Vp}\\ \\text{V}$ AC is applied to the primary, the secondary voltage is`,
        ans: (Vp * Ns) / Np, unit: 'V',
        wrongs: [(Vp * Np) / Ns, Vp, Vp * (Ns + Np) / Np],
      };
    },
  },
  {
    topic: 'EMI and AC Circuits', sub: 'Faraday’s law', difficulty: 'medium',
    gen: (r) => {
      const N = r.pick([50, 100, 200, 500]), dPhi = r.pick([0.01, 0.02, 0.05, 0.1]), dt = r.pick([0.1, 0.2, 0.5]);
      return {
        text: `The magnetic flux through each turn of a $${N}$-turn coil changes by $${dPhi}\\ \\text{Wb}$ in $${dt}\\ \\text{s}$. The average induced emf is`,
        ans: (N * dPhi) / dt, unit: 'V',
        wrongs: [dPhi / dt, N * dPhi * dt, (N * dt) / dPhi],
      };
    },
  },
  // ── Optics ───────────────────────────────────────────────────────────────
  {
    topic: 'Ray Optics and Wave Optics', sub: 'Lens power', difficulty: 'easy',
    gen: (r) => {
      const f = r.pick([10, 20, 25, 40, 50, 100]), conv = r.chance(0.6);
      const ans = (conv ? 1 : -1) * (100 / f);
      return {
        text: `The power of a ${conv ? 'convex' : 'concave'} lens of focal length $${f}\\ \\text{cm}$ is`,
        ans, unit: 'D',
        wrongs: [-ans, f / 100 * (conv ? 1 : -1), (conv ? 1 : -1) * (10 / f)],
      };
    },
  },
  {
    topic: 'Ray Optics and Wave Optics', sub: 'Lens formula', difficulty: 'medium',
    gen: (r) => {
      // integer image distances for a convex lens: v = uf/(u-f) with u > f (real object at -u)
      const f = r.pick([10, 12, 15, 20]), u = r.pick([15, 20, 24, 30, 36, 40, 60]);
      if (u <= f) return null;
      const v = (u * f) / (u - f);
      if (!Number.isInteger(v)) return null;
      return {
        text: `An object is placed $${u}\\ \\text{cm}$ in front of a convex lens of focal length $${f}\\ \\text{cm}$. The distance of the image from the lens is`,
        ans: v, unit: 'cm',
        wrongs: [(u * f) / (u + f), u - f, u + f],
      };
    },
  },
  {
    topic: 'Ray Optics and Wave Optics', sub: 'Mirror formula', difficulty: 'medium',
    gen: (r) => {
      const f = r.pick([10, 12, 15, 20]), u = r.pick([15, 20, 24, 30, 36, 40, 60]);
      if (u <= f) return null;
      const v = (u * f) / (u - f);
      if (!Number.isInteger(v)) return null;
      return {
        text: `An object is placed $${u}\\ \\text{cm}$ in front of a concave mirror of focal length $${f}\\ \\text{cm}$. The distance of the real image from the mirror is`,
        ans: v, unit: 'cm',
        wrongs: [(u * f) / (u + f), u - f, 2 * f],
      };
    },
  },
  {
    topic: 'Ray Optics and Wave Optics', sub: "Young's double slit", difficulty: 'medium',
    gen: (r) => {
      const lam = r.pick([400, 500, 600, 700]), D = r.pick([1, 1.5, 2]), d = r.pick([0.1, 0.2, 0.5, 1]);
      const ans = (lam * 1e-9 * D) / (d * 1e-3) * 1e3; // mm
      return {
        text: `In Young's double-slit experiment, light of wavelength $${lam}\\ \\text{nm}$ is used, the slits are $${d}\\ \\text{mm}$ apart and the screen is $${D}\\ \\text{m}$ away. The fringe width, in mm, is`,
        ans, unit: 'mm',
        wrongs: [ans * 2, ans / 2, ans * 10],
      };
    },
  },
  {
    topic: 'Ray Optics and Wave Optics', sub: 'Refractive index', difficulty: 'easy',
    gen: (r) => {
      const n = r.pick([1.25, 1.5, 2, 2.5]);
      return {
        text: `The speed of light in a medium is $${fmt(3 / n)}\\times10^8\\ \\text{m/s}$. Taking $c = 3\\times10^8\\ \\text{m/s}$, the refractive index of the medium is`,
        ans: n, unit: '',
        wrongs: [1 / n, n * n, n + 0.5],
      };
    },
  },
  // ── Modern physics ───────────────────────────────────────────────────────
  {
    topic: 'Modern Physics', sub: 'Photon energy', difficulty: 'easy',
    gen: (r) => {
      const lam = r.pick([124, 155, 248, 310, 413.3, 620]);
      const E = 1240 / lam;
      if (!Number.isInteger(Math.round(E * 100) / 100 * 1)) return null;
      return {
        text: `Using $hc = 1240\\ \\text{eV nm}$, the energy of a photon of wavelength $${lam}\\ \\text{nm}$ is`,
        ans: E, unit: 'eV',
        wrongs: [E * 2, E / 2, 1240 * lam / 1e5],
      };
    },
  },
  {
    topic: 'Modern Physics', sub: 'Photoelectric effect', difficulty: 'medium',
    gen: (r) => {
      const lam = r.pick([124, 155, 248, 310]), phi = r.pick([1, 1.5, 2, 2.5]);
      const K = 1240 / lam - phi;
      if (K <= 0) return null;
      return {
        text: `Light of wavelength $${lam}\\ \\text{nm}$ falls on a metal of work function $${phi}\\ \\text{eV}$ ($hc = 1240\\ \\text{eV nm}$). The stopping potential is`,
        ans: K, unit: 'V',
        wrongs: [1240 / lam + phi, 1240 / lam, phi],
      };
    },
  },
  {
    topic: 'Modern Physics', sub: 'Bohr model energy', difficulty: 'easy',
    gen: (r) => {
      const n = r.pick([2, 3, 4]), Z = r.pick([1, 2, 3]);
      const ans = (13.6 * Z * Z) / (n * n);
      const ion = { 1: 'hydrogen atom', 2: 'He$^+$ ion', 3: 'Li$^{2+}$ ion' }[Z];
      return {
        text: `The energy needed to remove the electron from the $n = ${n}$ state of a ${ion} is`,
        ans, unit: 'eV',
        wrongs: [(13.6 * Z) / (n * n), (13.6 * Z * Z) / n, 13.6 * Z * Z],
      };
    },
  },
  {
    topic: 'Modern Physics', sub: 'Radioactive decay', difficulty: 'medium',
    gen: (r) => {
      const T = r.pick([2, 5, 10, 20]), n = r.pick([2, 3, 4, 5]), N0 = r.pick([800, 1600, 3200, 6400]);
      const ans = N0 / Math.pow(2, n);
      return {
        text: `A radioactive sample initially has $${N0}$ undecayed nuclei and a half-life of $${T}$ days. The number of nuclei left undecayed after $${n * T}$ days is`,
        ans, unit: '',
        wrongs: [N0 / (2 * n), N0 - ans, N0 / Math.pow(2, n - 1)],
      };
    },
  },
];
