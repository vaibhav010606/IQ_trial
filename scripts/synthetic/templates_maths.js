// JEE Mathematics numerical (integer-answer) templates. Every answer is computed.
// gen(r) -> { text, ans } with integer ans.
function C(n, k) {
  if (k < 0 || k > n) return 0;
  let v = 1;
  for (let i = 1; i <= k; i++) v = (v * (n - k + i)) / i;
  return Math.round(v);
}
const fact = (n) => (n <= 1 ? 1 : n * fact(n - 1));
const det3 = (m) =>
  m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
  m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
  m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
const PYTH = [[3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17], [7, 24, 25], [9, 12, 15], [12, 16, 20], [20, 21, 29]];
const mat = (m) => `\\begin{vmatrix} ${m.map((row) => row.join(' & ')).join(' \\\\ ')} \\end{vmatrix}`;

module.exports = [
  {
    topic: 'Sequence and Series', sub: 'Sum of an AP', difficulty: 'easy',
    gen: (r) => {
      const a = r.int(-10, 15), d = r.int(1, 9), n = r.int(5, 30);
      return { text: `The sum of the first $${n}$ terms of an arithmetic progression with first term $${a}$ and common difference $${d}$ is`, ans: (n * (2 * a + (n - 1) * d)) / 2 };
    },
  },
  {
    topic: 'Sequence and Series', sub: 'nth term of an AP', difficulty: 'easy',
    gen: (r) => {
      const a = r.int(-20, 20), d = r.int(-6, 9), n = r.int(10, 60);
      if (d === 0) return null;
      return { text: `The ${n}th term of the AP $${a}, ${a + d}, ${a + 2 * d}, \\dots$ is`, ans: a + (n - 1) * d };
    },
  },
  {
    topic: 'Sequence and Series', sub: 'Sum of a GP', difficulty: 'easy',
    gen: (r) => {
      const a = r.int(1, 6), q = r.pick([2, 3]), n = r.int(3, 9);
      return { text: `The sum of the first $${n}$ terms of the geometric progression $${a}, ${a * q}, ${a * q * q}, \\dots$ is`, ans: (a * (Math.pow(q, n) - 1)) / (q - 1) };
    },
  },
  {
    topic: 'Sequence and Series', sub: 'Sum of squares', difficulty: 'medium',
    gen: (r) => {
      const n = r.int(5, 30), kind = r.pick(['squares', 'cubes']);
      const ans = kind === 'squares' ? (n * (n + 1) * (2 * n + 1)) / 6 : Math.pow((n * (n + 1)) / 2, 2);
      return { text: `The value of $\\displaystyle\\sum_{k=1}^{${n}} k^{${kind === 'squares' ? 2 : 3}}$ is`, ans };
    },
  },
  {
    topic: 'Permutation and Combination', sub: 'Combinations', difficulty: 'easy',
    gen: (r) => {
      const n = r.int(6, 16), k = r.int(2, 5);
      return { text: `The number of ways of choosing $${k}$ students from a group of $${n}$ students is`, ans: C(n, k) };
    },
  },
  {
    topic: 'Permutation and Combination', sub: 'Committee with restriction', difficulty: 'medium',
    gen: (r) => {
      const men = r.int(4, 9), women = r.int(3, 7), m = r.int(1, 3), w = r.int(1, 3);
      if (m > men || w > women) return null;
      return { text: `A committee of $${m}$ men and $${w}$ women is to be formed from $${men}$ men and $${women}$ women. The number of ways is`, ans: C(men, m) * C(women, w) };
    },
  },
  {
    topic: 'Permutation and Combination', sub: 'Arrangements of letters', difficulty: 'medium',
    gen: (r) => {
      const words = ['BANANA', 'APPLE', 'LETTER', 'SCHOOL', 'COFFEE', 'PEPPER', 'ASSESS', 'ALGEBRA', 'MATHS', 'PHYSICS', 'GARDEN', 'BALLOON', 'COMMITTEE', 'ENGINEER', 'TATTOO', 'CALCULUS'];
      const w = r.pick(words);
      const counts = {};
      for (const ch of w) counts[ch] = (counts[ch] || 0) + 1;
      const ans = Object.values(counts).reduce((acc, c) => acc / fact(c), fact(w.length));
      if (ans > 1e7) return null;
      return { text: `The number of distinct arrangements of all the letters of the word ${w} is`, ans };
    },
  },
  {
    topic: 'Permutation and Combination', sub: 'Permutations', difficulty: 'easy',
    gen: (r) => {
      const n = r.int(5, 10), k = r.int(2, 4);
      return { text: `The number of ways of arranging $${k}$ out of $${n}$ distinct books in a row is`, ans: fact(n) / fact(n - k) };
    },
  },
  {
    topic: 'Binomial Theorem', sub: 'Coefficient', difficulty: 'medium',
    gen: (r) => {
      const n = r.int(4, 9), k = r.int(1, n - 1), a = r.pick([1, 2]), b = r.pick([1, 2, 3]);
      const ans = C(n, k) * Math.pow(a, k) * Math.pow(b, n - k);
      if (ans > 1e6) return null;
      return { text: `The coefficient of $x^{${k}}$ in the expansion of $(${a === 1 ? '' : a}x + ${b})^{${n}}$ is`, ans };
    },
  },
  {
    topic: 'Binomial Theorem', sub: 'Sum of coefficients', difficulty: 'easy',
    gen: (r) => {
      const a = r.pick([1, 2, 3]), b = r.pick([1, 2]), n = r.int(2, 8);
      const ans = Math.pow(a + b, n);
      if (ans > 1e6) return null;
      return { text: `The sum of the coefficients in the expansion of $(${a}x + ${b}y)^{${n}}$ is`, ans };
    },
  },
  {
    topic: 'Binomial Theorem', sub: 'Middle term', difficulty: 'medium',
    gen: (r) => {
      const half = r.int(2, 6), n = 2 * half;
      return { text: `The coefficient of the middle term in the expansion of $(1 + x)^{${n}}$ is`, ans: C(n, half) };
    },
  },
  {
    topic: 'Determinants', sub: '3×3 determinant', difficulty: 'easy',
    gen: (r) => {
      const m = [0, 1, 2].map(() => [0, 1, 2].map(() => r.int(-3, 5)));
      return { text: `The value of the determinant $${mat(m)}$ is`, ans: det3(m) };
    },
  },
  {
    topic: 'Determinants', sub: 'Scaling a determinant', difficulty: 'medium',
    gen: (r) => {
      const d = r.int(-6, 9), k = r.pick([2, 3]), n = 3;
      if (d === 0) return null;
      return { text: `If $A$ is a $3 \\times 3$ matrix with $|A| = ${d}$, then $|${k}A|$ equals`, ans: Math.pow(k, n) * d };
    },
  },
  {
    topic: 'Determinants', sub: 'Adjoint', difficulty: 'hard',
    gen: (r) => {
      const d = r.int(2, 6), n = r.pick([2, 3]);
      return { text: `If $A$ is an invertible ${n} × ${n} matrix with $|A| = ${d}$, then $|\\operatorname{adj} A|$ equals`, ans: Math.pow(d, n - 1) };
    },
  },
  {
    topic: 'Matrices', sub: 'Trace of a product', difficulty: 'medium',
    gen: (r) => {
      const a = r.int(-3, 5), b = r.int(-3, 5), c = r.int(-3, 5), d = r.int(-3, 5);
      const tr = a * a + 2 * b * c + d * d; // trace of A^2
      return { text: `If $A = \\begin{pmatrix} ${a} & ${b} \\\\ ${c} & ${d} \\end{pmatrix}$, then the trace of $A^2$ is`, ans: tr };
    },
  },
  {
    topic: 'Quadratic Equations', sub: 'Symmetric functions of roots', difficulty: 'medium',
    gen: (r) => {
      const s = r.int(-8, 10), p = r.int(-10, 12), kind = r.pick(['squares', 'cubes']);
      const ans = kind === 'squares' ? s * s - 2 * p : s * s * s - 3 * s * p;
      const lin = s >= 0 ? `- ${s}x` : `+ ${-s}x`;
      const con = p >= 0 ? `+ ${p}` : `- ${-p}`;
      return { text: `If $\\alpha$ and $\\beta$ are the roots of $x^2 ${lin} ${con} = 0$, then $\\alpha^${kind === 'squares' ? 2 : 3} + \\beta^${kind === 'squares' ? 2 : 3}$ equals`, ans };
    },
  },
  {
    topic: 'Quadratic Equations', sub: 'Integer roots', difficulty: 'easy',
    gen: (r) => {
      const a = r.int(1, 9), b = r.int(1, 9);
      if (a === b) return null;
      return { text: `The sum of the squares of the roots of $x^2 - ${a + b}x + ${a * b} = 0$ is`, ans: a * a + b * b };
    },
  },
  {
    topic: 'Indefinite and Definite Integration', sub: 'Definite integral of a polynomial', difficulty: 'easy',
    gen: (r) => {
      const a = r.int(1, 4), p = r.int(1, 4), q = r.int(0, 6);
      // ∫0^a (3p x^2 + 2q x) dx = p a^3 + q a^2
      const integrand = q ? `${3 * p}x^2 + ${2 * q}x` : `${3 * p}x^2`;
      return { text: `The value of $\\displaystyle\\int_0^{${a}} (${integrand})\\,dx$ is`, ans: p * a * a * a + q * a * a };
    },
  },
  {
    topic: 'Indefinite and Definite Integration', sub: 'Integral of an odd function', difficulty: 'medium',
    gen: (r) => {
      const a = r.int(1, 5), c = r.int(1, 6), k = r.int(1, 9);
      // ∫_{-a}^{a} (k x^3 + c) dx = 2ac
      return { text: `The value of $\\displaystyle\\int_{-${a}}^{${a}} (${k}x^3 + ${c})\\,dx$ is`, ans: 2 * a * c };
    },
  },
  {
    topic: 'Continuity, Differentiability and Differentiation', sub: 'Derivative at a point', difficulty: 'easy',
    gen: (r) => {
      const a = r.int(1, 4), b = r.int(-5, 5), c = r.int(-9, 9), x0 = r.int(-3, 4);
      // f(x) = a x^3 + b x^2 + c x
      const ans = 3 * a * x0 * x0 + 2 * b * x0 + c;
      return { text: `If $f(x) = ${a}x^3 ${b >= 0 ? '+' : '-'} ${Math.abs(b)}x^2 ${c >= 0 ? '+' : '-'} ${Math.abs(c)}x$, then $f'(${x0})$ equals`, ans };
    },
  },
  {
    topic: 'Limit', sub: 'Standard limit', difficulty: 'easy',
    gen: (r) => {
      const a = r.int(1, 5), n = r.int(2, 6);
      return { text: `The value of $\\displaystyle\\lim_{x \\to ${a}} \\frac{x^{${n}} - ${Math.pow(a, n)}}{x - ${a}}$ is`, ans: n * Math.pow(a, n - 1) };
    },
  },
  {
    topic: 'Limit', sub: 'Trigonometric limit', difficulty: 'medium',
    gen: (r) => {
      const a = r.int(2, 9), b = r.int(1, 9), k = r.pick([1, 2, 3, 4, 6, 12]);
      // lim sin(ax)/(bx) * k  -> we require integer: k*a/b
      if ((k * a) % b !== 0) return null;
      return { text: `The value of $\\displaystyle\\lim_{x \\to 0} \\frac{${k}\\sin(${a}x)}{${b}x}$ is`, ans: (k * a) / b };
    },
  },
  {
    topic: 'Application of Derivatives', sub: 'Maximum of a quadratic', difficulty: 'medium',
    gen: (r) => {
      const h = r.int(-4, 6), kk = r.int(-5, 20), a = r.int(1, 4);
      // f(x) = -a(x-h)^2 + k  -> expanded
      const b = 2 * a * h, c = kk - a * h * h;
      return { text: `The maximum value of $f(x) = -${a}x^2 ${b >= 0 ? '+' : '-'} ${Math.abs(b)}x ${c >= 0 ? '+' : '-'} ${Math.abs(c)}$ is`, ans: kk };
    },
  },
  {
    topic: 'Straight Lines', sub: 'Distance between points', difficulty: 'easy',
    gen: (r) => {
      const [p, q, h] = r.pick(PYTH), x1 = r.int(-5, 5), y1 = r.int(-5, 5), sx = r.pick([1, -1]), sy = r.pick([1, -1]);
      return { text: `The distance between the points $(${x1}, ${y1})$ and $(${x1 + sx * p}, ${y1 + sy * q})$ is`, ans: h };
    },
  },
  {
    topic: 'Straight Lines', sub: 'Area of a triangle', difficulty: 'medium',
    gen: (r) => {
      const pts = [0, 1, 2].map(() => [r.int(-5, 6), r.int(-5, 6)]);
      const [[x1, y1], [x2, y2], [x3, y3]] = pts;
      const twice = Math.abs(x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
      if (twice === 0 || twice % 2) return null;
      return { text: `The area of the triangle with vertices $(${x1}, ${y1})$, $(${x2}, ${y2})$ and $(${x3}, ${y3})$ is`, ans: twice / 2 };
    },
  },
  {
    topic: 'Straight Lines', sub: 'Distance of a point from a line', difficulty: 'medium',
    gen: (r) => {
      const [a, b, h] = r.pick(PYTH.filter((t) => t[2] <= 17)), dist = r.int(1, 6), x0 = r.int(-4, 4), y0 = r.int(-4, 4);
      const c = dist * h - (a * x0 + b * y0);
      return { text: `The perpendicular distance of the point $(${x0}, ${y0})$ from the line $${a}x + ${b}y ${c >= 0 ? '+' : '-'} ${Math.abs(c)} = 0$ is`, ans: dist };
    },
  },
  {
    topic: 'Circle', sub: 'Radius from the general equation', difficulty: 'easy',
    gen: (r) => {
      const g = r.int(-6, 6), f = r.int(-6, 6), rad = r.int(1, 9);
      const c = g * g + f * f - rad * rad;
      const t = (v, s) => (v === 0 ? '' : ` ${v > 0 ? '+' : '-'} ${Math.abs(v)}${s}`);
      return { text: `The radius of the circle $x^2 + y^2${t(2 * g, 'x')}${t(2 * f, 'y')}${t(c, '')} = 0$ is`, ans: rad };
    },
  },
  {
    topic: 'Complex Numbers', sub: 'Modulus', difficulty: 'easy',
    gen: (r) => {
      const [a, b, h] = r.pick(PYTH), k = r.pick([1, 2, 3]);
      return { text: `The modulus of the complex number $${a * k} ${r.chance(0.5) ? '+' : '-'} ${b * k}i$ is`, ans: h * k };
    },
  },
  {
    topic: 'Complex Numbers', sub: 'Product', difficulty: 'easy',
    gen: (r) => {
      const a = r.int(-5, 6), b = r.int(-5, 6), c = r.int(-5, 6), d = r.int(-5, 6);
      const fmtC = (x, y) => `${x} ${y >= 0 ? '+' : '-'} ${Math.abs(y)}i`;
      return { text: `The real part of $(${fmtC(a, b)})(${fmtC(c, d)})$ is`, ans: a * c - b * d };
    },
  },
  {
    topic: 'Vector & 3Dimensional Geometry', sub: 'Dot product', difficulty: 'easy',
    gen: (r) => {
      const u = [r.int(-5, 6), r.int(-5, 6), r.int(-5, 6)], v = [r.int(-5, 6), r.int(-5, 6), r.int(-5, 6)];
      const vec = (w) => `${w[0]}\\hat{i} ${w[1] >= 0 ? '+' : '-'} ${Math.abs(w[1])}\\hat{j} ${w[2] >= 0 ? '+' : '-'} ${Math.abs(w[2])}\\hat{k}`;
      return { text: `If $\\vec{a} = ${vec(u)}$ and $\\vec{b} = ${vec(v)}$, then $\\vec{a} \\cdot \\vec{b}$ equals`, ans: u[0] * v[0] + u[1] * v[1] + u[2] * v[2] };
    },
  },
  {
    topic: 'Vector & 3Dimensional Geometry', sub: 'Magnitude of a cross product', difficulty: 'medium',
    gen: (r) => {
      const u = [r.int(-3, 4), r.int(-3, 4), r.int(-3, 4)], v = [r.int(-3, 4), r.int(-3, 4), r.int(-3, 4)];
      const cx = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const sq = cx[0] ** 2 + cx[1] ** 2 + cx[2] ** 2;
      if (sq === 0) return null;
      const vec = (w) => `${w[0]}\\hat{i} ${w[1] >= 0 ? '+' : '-'} ${Math.abs(w[1])}\\hat{j} ${w[2] >= 0 ? '+' : '-'} ${Math.abs(w[2])}\\hat{k}`;
      return { text: `If $\\vec{a} = ${vec(u)}$ and $\\vec{b} = ${vec(v)}$, then $|\\vec{a} \\times \\vec{b}|^2$ equals`, ans: sq };
    },
  },
  {
    topic: 'Sets Relations Functions', sub: 'Counting functions', difficulty: 'medium',
    gen: (r) => {
      const m = r.int(2, 5), n = r.int(2, 6), kind = r.pick(['all', 'one-one']);
      if (kind === 'one-one' && m > n) return null;
      const ans = kind === 'all' ? Math.pow(n, m) : fact(n) / fact(n - m);
      return { text: `The number of ${kind === 'all' ? '' : 'one-one '}functions from a set with $${m}$ elements to a set with $${n}$ elements is`, ans };
    },
  },
  {
    topic: 'Sets Relations Functions', sub: 'Counting relations and subsets', difficulty: 'easy',
    gen: (r) => {
      const n = r.int(2, 10), kind = r.pick(['subsets', 'proper']);
      const ans = kind === 'subsets' ? Math.pow(2, n) : Math.pow(2, n) - 1;
      return { text: `The number of ${kind === 'subsets' ? '' : 'proper '}subsets of a set with $${n}$ elements is`, ans };
    },
  },
  {
    topic: 'Probability', sub: 'Dice outcomes', difficulty: 'easy',
    gen: (r) => {
      const s = r.int(2, 12);
      const ways = Array.from({ length: 6 }, (_, i) => i + 1).reduce((acc, a) => acc + (s - a >= 1 && s - a <= 6 ? 1 : 0), 0);
      return { text: `Two fair dice are thrown. If the probability that the sum is $${s}$ is $\\frac{k}{36}$, then $k$ equals`, ans: ways };
    },
  },
  {
    topic: 'Probability', sub: 'Binomial probability', difficulty: 'medium',
    gen: (r) => {
      const n = r.int(3, 8), k = r.int(0, n);
      return { text: `A fair coin is tossed $${n}$ times. If the probability of getting exactly $${k}$ heads is $\\frac{m}{${Math.pow(2, n)}}$, then $m$ equals`, ans: C(n, k) };
    },
  },
  {
    topic: 'Trigonometry', sub: 'Standard values', difficulty: 'easy',
    gen: (r) => {
      const a = r.int(1, 9), b = r.int(1, 9), c = r.int(1, 9);
      // a·4sin²30 + b·tan²45 + c·4cos²60  = a + b + c
      return { text: `The value of $${a}\\cdot 4\\sin^2 30^\\circ + ${b}\\tan^2 45^\\circ + ${c}\\cdot 4\\cos^2 60^\\circ$ is`, ans: a + b + c };
    },
  },
  {
    topic: 'Trigonometry', sub: 'Identity evaluation', difficulty: 'medium',
    gen: (r) => {
      const k = r.int(2, 20), t = r.pick([10, 20, 25, 35, 40, 55, 70]);
      return { text: `The value of $${k}(\\sin^2 ${t}^\\circ + \\cos^2 ${t}^\\circ) + ${k}(\\sec^2 ${t}^\\circ - \\tan^2 ${t}^\\circ)$ is`, ans: 2 * k };
    },
  },
  {
    topic: 'Function', sub: 'Composition', difficulty: 'easy',
    gen: (r) => {
      const a = r.int(1, 5), b = r.int(-5, 5), c = r.int(1, 3), x0 = r.int(-3, 4);
      // f(x) = a x + b, g(x) = c x^2 ; find f(g(x0))
      return { text: `If $f(x) = ${a}x ${b >= 0 ? '+' : '-'} ${Math.abs(b)}$ and $g(x) = ${c}x^2$, then $f(g(${x0}))$ equals`, ans: a * c * x0 * x0 + b };
    },
  },
  {
    topic: 'Area Under Curves', sub: 'Area under a parabola', difficulty: 'medium',
    gen: (r) => {
      const a = r.pick([3, 6]), k = r.pick([1, 2, 3]);
      // area between y = k x^2 and x-axis from 0..a = k a^3 / 3
      return { text: `The area bounded by the curve $y = ${k}x^2$, the $x$-axis and the line $x = ${a}$ is`, ans: (k * a * a * a) / 3 };
    },
  },
  {
    topic: 'Differential Equations', sub: 'Order and degree', difficulty: 'easy',
    gen: (r) => {
      const o = r.int(1, 4), d = r.int(1, 5), extra = r.int(1, 3);
      return { text: `For the differential equation $\\left(\\frac{d^{${o}}y}{dx^{${o}}}\\right)^{${d}} + \\left(\\frac{dy}{dx}\\right)^{${extra + d}} + y = 0$, the sum of its order and degree is`, ans: o + (o === 1 ? Math.max(d, extra + d) : d) };
    },
  },
];
