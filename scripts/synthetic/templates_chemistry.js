// JEE Chemistry question templates. Numeric templates compute their answer;
// factual templates draw from curated, textbook-standard data tables.
// gen(r) -> { text, ans, unit, wrongs } or, for text answers, { text, ansText, wrongTexts }
const { fmt } = require('./util');

const MOLAR = [
  ['H$_2$O', 18], ['CO$_2$', 44], ['NaCl', 58.5], ['NaOH', 40], ['H$_2$SO$_4$', 98], ['HCl', 36.5],
  ['CaCO$_3$', 100], ['NH$_3$', 17], ['CH$_4$', 16], ['O$_2$', 32], ['N$_2$', 28], ['glucose (C$_6$H$_{12}$O$_6$)', 180],
  ['urea (NH$_2$CONH$_2$)', 60], ['KOH', 56], ['HNO$_3$', 63], ['MgO', 40], ['SO$_2$', 64], ['C$_2$H$_5$OH', 46],
];

const OX_STATES = [
  ['Cr', 'K$_2$Cr$_2$O$_7$', 6], ['Mn', 'KMnO$_4$', 7], ['S', 'H$_2$SO$_4$', 6], ['N', 'HNO$_3$', 5], ['P', 'H$_3$PO$_4$', 5],
  ['Cl', 'HClO$_4$', 7], ['Cl', 'HClO$_3$', 5], ['Cl', 'HOCl', 1], ['Mn', 'MnO$_2$', 4], ['Fe', 'Fe$_3$O$_4$', 8 / 3],
  ['S', 'Na$_2$S$_2$O$_3$', 2], ['S', 'H$_2$S$_2$O$_8$ (peroxodisulphuric acid)', 6], ['O', 'OF$_2$', 2], ['O', 'H$_2$O$_2$', -1],
  ['N', 'NH$_3$', -3], ['N', 'N$_2$H$_4$', -2], ['N', 'NH$_2$OH', -1], ['C', 'CH$_2$O', 0], ['Cr', 'CrO$_5$', 6],
  ['Fe', 'K$_4$[Fe(CN)$_6$]', 2], ['Fe', 'K$_3$[Fe(CN)$_6$]', 3], ['Co', '[Co(NH$_3$)$_6$]Cl$_3$', 3], ['Ni', '[Ni(CO)$_4$]', 0],
  ['Pt', '[PtCl$_6$]$^{2-}$', 4], ['Cu', '[Cu(NH$_3$)$_4$]SO$_4$', 2], ['V', 'V$_2$O$_5$', 5], ['Os', 'OsO$_4$', 8],
  ['Xe', 'XeF$_6$', 6], ['Xe', 'XeO$_3$', 6], ['I', 'IF$_7$', 7], ['S', 'SO$_2$', 4], ['N', 'N$_2$O$_5$', 5], ['C', 'C$_3$O$_2$', 4 / 3],
];

const HYBRID = [
  ['CH$_4$', 'sp$^3$'], ['BF$_3$', 'sp$^2$'], ['BeCl$_2$', 'sp'], ['NH$_3$', 'sp$^3$'], ['H$_2$O', 'sp$^3$'], ['PCl$_5$', 'sp$^3$d'],
  ['SF$_6$', 'sp$^3$d$^2$'], ['XeF$_2$', 'sp$^3$d'], ['XeF$_4$', 'sp$^3$d$^2$'], ['XeF$_6$', 'sp$^3$d$^3$'], ['IF$_7$', 'sp$^3$d$^3$'],
  ['ClF$_3$', 'sp$^3$d'], ['SF$_4$', 'sp$^3$d'], ['BrF$_5$', 'sp$^3$d$^2$'], ['CO$_2$', 'sp'], ['SO$_2$', 'sp$^2$'], ['SO$_3$', 'sp$^2$'],
  ['C$_2$H$_2$', 'sp'], ['C$_2$H$_4$', 'sp$^2$'], ['NH$_4^+$', 'sp$^3$'], ['NO$_3^-$', 'sp$^2$'], ['CO$_3^{2-}$', 'sp$^2$'],
  ['I$_3^-$', 'sp$^3$d'], ['PCl$_3$', 'sp$^3$'], ['SiCl$_4$', 'sp$^3$'], ['AlCl$_4^-$', 'sp$^3$'], ['ICl$_4^-$', 'sp$^3$d$^2$'],
];
const HYBRID_ALL = ['sp', 'sp$^2$', 'sp$^3$', 'sp$^3$d', 'sp$^3$d$^2$', 'sp$^3$d$^3$'];

const SHAPES = [
  ['NH$_3$', 'Trigonal pyramidal'], ['H$_2$O', 'Bent'], ['SF$_4$', 'See-saw'], ['ClF$_3$', 'T-shaped'], ['XeF$_2$', 'Linear'],
  ['XeF$_4$', 'Square planar'], ['BrF$_5$', 'Square pyramidal'], ['PCl$_5$', 'Trigonal bipyramidal'], ['SF$_6$', 'Octahedral'],
  ['BF$_3$', 'Trigonal planar'], ['CH$_4$', 'Tetrahedral'], ['I$_3^-$', 'Linear'], ['XeF$_6$', 'Distorted octahedral'],
  ['ICl$_4^-$', 'Square planar'], ['SO$_2$', 'Bent'], ['CO$_2$', 'Linear'], ['NH$_4^+$', 'Tetrahedral'], ['ClO$_3^-$', 'Trigonal pyramidal'],
];
const SHAPES_ALL = [...new Set(SHAPES.map((s) => s[1]))];

// Molecular-orbital bond orders (second-period diatomics and ions).
const BOND_ORDER = [
  ['O$_2$', 2], ['O$_2^+$', 2.5], ['O$_2^-$', 1.5], ['O$_2^{2-}$', 1], ['N$_2$', 3], ['N$_2^+$', 2.5], ['N$_2^-$', 2.5],
  ['C$_2$', 2], ['B$_2$', 1], ['F$_2$', 1], ['NO', 2.5], ['NO$^+$', 3], ['CO', 3], ['CN$^-$', 3], ['He$_2^+$', 0.5],
  ['H$_2$', 1], ['H$_2^+$', 0.5], ['Li$_2$', 1], ['Ne$_2$', 0], ['O$_2^{2+}$', 3],
];

// Unpaired electrons in common ions (high-spin where relevant, free ion).
const UNPAIRED = [
  ['Fe$^{3+}$', 5], ['Fe$^{2+}$', 4], ['Mn$^{2+}$', 5], ['Cr$^{3+}$', 3], ['Co$^{2+}$', 3], ['Ni$^{2+}$', 2], ['Cu$^{2+}$', 1],
  ['Cu$^{+}$', 0], ['Zn$^{2+}$', 0], ['Ti$^{3+}$', 1], ['V$^{3+}$', 2], ['Sc$^{3+}$', 0], ['Mn$^{3+}$', 4], ['Cr$^{2+}$', 4], ['Co$^{3+}$', 4],
];

// Solutes that are sensible to dissolve and weigh out (no water, gases or insoluble solids).
const SOLUTES = MOLAR.filter((x) => ['NaCl', 'NaOH', 'H$_2$SO$_4$', 'HCl', 'KOH', 'HNO$_3$', 'glucose (C$_6$H$_{12}$O$_6$)', 'urea (NH$_2$CONH$_2$)', 'C$_2$H$_5$OH'].includes(x[0]));

const KB = [['water', 0.52], ['benzene', 2.53]];
const KF = [['water', 1.86], ['benzene', 5.12], ['camphor', 40]];

module.exports = [
  // ── Mole concept / stoichiometry ─────────────────────────────────────────
  {
    topic: 'Stoichiometry-I and II', sub: 'Moles from mass', difficulty: 'easy',
    gen: (r) => {
      const [name, M] = r.pick(MOLAR), n = r.pick([0.1, 0.2, 0.25, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5]);
      const m = n * M;
      return {
        text: `How many moles are present in $${fmt(m)}\\ \\text{g}$ of ${name}?`,
        ans: n, unit: 'mol',
        wrongs: [m / (M / 2), (m * 2) / M, M / m],
      };
    },
  },
  {
    topic: 'Stoichiometry-I and II', sub: 'Number of molecules', difficulty: 'easy',
    gen: (r) => {
      const [name, M] = r.pick(MOLAR), n = r.pick([0.1, 0.2, 0.5, 1, 2, 5]);
      const m = n * M;
      const N = n * 6.022;
      return {
        text: `The number of molecules in $${fmt(m)}\\ \\text{g}$ of ${name} (in units of $10^{23}$) is`,
        ans: N, unit: '× 10²³',
        wrongs: [N * 2, N / 2, n * 6.022 * 3],
      };
    },
  },
  {
    topic: 'Stoichiometry-I and II', sub: 'Molarity', difficulty: 'easy',
    gen: (r) => {
      const [name, M] = r.pick(SOLUTES), mol = r.pick([0.1, 0.2, 0.25, 0.5, 1, 2]), V = r.pick([250, 500, 1000, 2000]);
      const molarity = mol / (V / 1000);
      return {
        text: `$${fmt(mol * M)}\\ \\text{g}$ of ${name} is dissolved in water to make $${V}\\ \\text{mL}$ of solution. The molarity of the solution is`,
        ans: molarity, unit: 'M',
        wrongs: [mol, molarity * 2, molarity / 2],
      };
    },
  },
  {
    topic: 'Stoichiometry-I and II', sub: 'Dilution', difficulty: 'easy',
    gen: (r) => {
      const M1 = r.pick([1, 2, 5, 6, 10, 12]), V1 = r.pick([50, 100, 200, 250]), V2 = r.pick([500, 1000, 2000]);
      if (V2 <= V1) return null;
      return {
        text: `$${V1}\\ \\text{mL}$ of a $${M1}\\ \\text{M}$ solution is diluted to $${V2}\\ \\text{mL}$. The molarity of the diluted solution is`,
        ans: (M1 * V1) / V2, unit: 'M',
        wrongs: [(M1 * V2) / V1, (M1 * V1) / (V2 + V1), M1 / 2],
      };
    },
  },
  {
    topic: 'Stoichiometry-I and II', sub: 'Molality', difficulty: 'medium',
    gen: (r) => {
      const [name, M] = r.pick(SOLUTES), mol = r.pick([0.1, 0.2, 0.25, 0.5, 1]), kg = r.pick([0.25, 0.5, 1, 2]);
      return {
        text: `$${fmt(mol * M)}\\ \\text{g}$ of ${name} is dissolved in $${kg * 1000}\\ \\text{g}$ of water. The molality of the solution is`,
        ans: mol / kg, unit: 'mol/kg',
        wrongs: [mol * kg, mol, (mol / kg) * 2],
      };
    },
  },
  {
    topic: 'Stoichiometry-I and II', sub: 'Gas volume at STP', difficulty: 'easy',
    gen: (r) => {
      const [name, M] = r.pick(MOLAR.filter((x) => ['CO$_2$', 'NH$_3$', 'CH$_4$', 'O$_2$', 'N$_2$', 'SO$_2$'].includes(x[0]))), n = r.pick([0.1, 0.25, 0.5, 1, 2, 5]);
      return {
        text: `The volume occupied by $${fmt(n * M)}\\ \\text{g}$ of ${name} gas at STP (molar volume $22.4\\ \\text{L}$) is`,
        ans: n * 22.4, unit: 'L',
        wrongs: [n * 11.2, (n * M) / 22.4, n * 44.8],
      };
    },
  },
  {
    topic: 'Stoichiometry-I and II', sub: 'Limiting reagent', difficulty: 'medium',
    gen: (r) => {
      // N2 + 3H2 -> 2NH3
      const nN2 = r.pick([1, 2, 3, 4, 5]), nH2 = r.pick([3, 6, 9, 12, 4, 8]);
      const nh3 = Math.min(2 * nN2, (2 * nH2) / 3);
      return {
        text: `$${nN2}$ mol of N$_2$ reacts with $${nH2}$ mol of H$_2$ according to N$_2$ + 3H$_2$ → 2NH$_3$. The maximum amount of NH$_3$ formed is`,
        ans: nh3, unit: 'mol',
        wrongs: [2 * nN2 === nh3 ? (2 * nH2) / 3 + 1 : 2 * nN2, nN2 + nH2, nh3 / 2],
      };
    },
  },
  // ── Gaseous state ────────────────────────────────────────────────────────
  {
    topic: 'Gaseous State', sub: "Graham's law", difficulty: 'medium',
    gen: (r) => {
      const pairs = [['H$_2$', 2, 'O$_2$', 32], ['He', 4, 'CH$_4$', 16], ['H$_2$', 2, 'CH$_4$', 16], ['CH$_4$', 16, 'SO$_2$', 64], ['He', 4, 'SO$_2$', 64], ['H$_2$', 2, 'SO$_2$', 64], ['O$_2$', 32, 'SO$_2$', 64]];
      const [a, Ma, b, Mb] = r.pick(pairs);
      const ans = Math.sqrt(Mb / Ma);
      return {
        text: `Under identical conditions, the ratio of the rate of effusion of ${a} to that of ${b} is`,
        ans, unit: '',
        wrongs: [Mb / Ma, Math.sqrt(Ma / Mb), (Mb / Ma) / 2],
      };
    },
  },
  {
    topic: 'Gaseous State', sub: "Boyle's and Charles' laws", difficulty: 'easy',
    gen: (r) => {
      const V1 = r.pick([1, 2, 4, 5, 10]), T1 = r.pick([200, 250, 300, 400]), T2 = r.pick([300, 400, 500, 600, 800]);
      if (T1 === T2) return null;
      return {
        text: `A gas occupies $${V1}\\ \\text{L}$ at $${T1}\\ \\text{K}$. At constant pressure, its volume at $${T2}\\ \\text{K}$ is`,
        ans: (V1 * T2) / T1, unit: 'L',
        wrongs: [(V1 * T1) / T2, V1 + (T2 - T1) / 100, (V1 * T2) / (T1 * 2)],
      };
    },
  },
  {
    topic: 'Gaseous State', sub: 'Partial pressure', difficulty: 'medium',
    gen: (r) => {
      const n1 = r.int(1, 5), n2 = r.int(1, 5), P = r.pick([2, 4, 5, 6, 10]);
      return {
        text: `A mixture contains $${n1}$ mol of N$_2$ and $${n2}$ mol of O$_2$ at a total pressure of $${P}\\ \\text{atm}$. The partial pressure of N$_2$ is`,
        ans: (P * n1) / (n1 + n2), unit: 'atm',
        wrongs: [(P * n2) / (n1 + n2), P / 2, (P * n1) / n2],
      };
    },
  },
  // ── Atomic structure ─────────────────────────────────────────────────────
  {
    topic: 'Atomic Structure', sub: 'Spectral lines', difficulty: 'easy',
    gen: (r) => {
      const n = r.int(3, 8);
      return {
        text: `When electrons in a sample of hydrogen atoms fall from the $n = ${n}$ level to the ground state, the maximum number of spectral lines emitted is`,
        ans: (n * (n - 1)) / 2, unit: '',
        wrongs: [n - 1, n * (n - 1), n],
      };
    },
  },
  {
    topic: 'Atomic Structure', sub: 'Nodes of orbitals', difficulty: 'medium',
    gen: (r) => {
      const n = r.int(2, 6), l = r.int(0, Math.min(3, n - 1));
      const sym = ['s', 'p', 'd', 'f'][l];
      const radial = n - l - 1;
      return {
        text: `The number of radial nodes in a ${n}${sym} orbital is`,
        ans: radial, unit: '',
        wrongs: [n - 1, l, n - l],
      };
    },
  },
  {
    topic: 'Atomic Structure', sub: 'Bohr radius', difficulty: 'medium',
    gen: (r) => {
      const n = r.pick([1, 2, 3, 4]), Z = r.pick([1, 2, 3]);
      const ans = (0.529 * n * n) / Z;
      return {
        text: `The radius of the $n = ${n}$ Bohr orbit of a hydrogen-like species with $Z = ${Z}$ (given $a_0 = 0.529$ Å) is`,
        ans, unit: 'Å',
        wrongs: [(0.529 * n) / Z, 0.529 * n * n * Z, (0.529 * n * n) / (Z * Z)],
      };
    },
  },
  {
    topic: 'Atomic Structure', sub: 'Electrons in a shell', difficulty: 'easy',
    gen: (r) => {
      const n = r.int(1, 6), ask = r.pick(['electrons', 'orbitals']);
      return {
        text: `The maximum number of ${ask} possible in the shell with principal quantum number $n = ${n}$ is`,
        ans: ask === 'electrons' ? 2 * n * n : n * n, unit: '',
        wrongs: ask === 'electrons' ? [n * n, 2 * n, 4 * n] : [2 * n * n, 2 * n + 1, n],
      };
    },
  },
  {
    topic: 'Atomic Structure', sub: 'Bohr energy', difficulty: 'medium',
    gen: (r) => {
      const n = r.pick([1, 2, 3]), Z = r.pick([1, 2, 3, 4]);
      const E = -(13.6 * Z * Z) / (n * n);
      return {
        text: `The energy of an electron in the $n = ${n}$ orbit of a hydrogen-like species with $Z = ${Z}$ is`,
        ans: E, unit: 'eV',
        wrongs: [-(13.6 * Z) / (n * n), -(13.6 * Z * Z) / n, (13.6 * Z * Z) / (n * n)],
      };
    },
  },
  {
    topic: 'Atomic Structure', sub: 'Unpaired electrons', difficulty: 'medium',
    gen: (r) => {
      const [ion, n] = r.pick(UNPAIRED);
      return {
        text: `The number of unpaired electrons in the gaseous ${ion} ion is`,
        ans: n, unit: '',
        wrongs: [(n + 1) % 6, (n + 2) % 6, (n + 3) % 6],
      };
    },
  },
  // ── Bonding & structure (curated) ────────────────────────────────────────
  {
    topic: 'Chemical Bonding', sub: 'Hybridisation', difficulty: 'medium',
    gen: (r) => {
      const [sp, h] = r.pick(HYBRID);
      return {
        text: `The hybridisation of the central atom in ${sp} is`,
        ansText: h,
        wrongTexts: r.shuffle(HYBRID_ALL.filter((x) => x !== h)).slice(0, 3),
      };
    },
  },
  {
    topic: 'Chemical Bonding', sub: 'Molecular shape (VSEPR)', difficulty: 'medium',
    gen: (r) => {
      const [sp, s] = r.pick(SHAPES);
      return {
        text: `According to VSEPR theory, the shape of ${sp} is`,
        ansText: s,
        wrongTexts: r.shuffle(SHAPES_ALL.filter((x) => x !== s)).slice(0, 3),
      };
    },
  },
  {
    topic: 'Chemical Bonding', sub: 'MO bond order', difficulty: 'medium',
    gen: (r) => {
      const [sp, bo] = r.pick(BOND_ORDER);
      return {
        text: `According to molecular orbital theory, the bond order of ${sp} is`,
        ans: bo, unit: '',
        wrongs: [bo + 0.5, bo === 0 ? 1 : bo - 0.5, bo + 1],
      };
    },
  },
  {
    topic: 'Chemical Bonding', sub: 'Oxidation state', difficulty: 'medium',
    gen: (r) => {
      const [el, comp, ox] = r.pick(OX_STATES);
      return {
        text: `The oxidation state of ${el} in ${comp} is`,
        ans: ox, unit: '',
        wrongs: [ox + 1, ox - 2, -ox === ox ? ox + 2 : -ox],
      };
    },
  },
  // ── Thermodynamics ───────────────────────────────────────────────────────
  {
    topic: 'Thermodynamics and Thermochemistry', sub: 'Gibbs energy', difficulty: 'medium',
    gen: (r) => {
      const dH = r.pick([-100, -80, -50, 20, 40, 60, 100]), dS = r.pick([-200, -100, 100, 200, 250]), T = r.pick([200, 300, 400, 500]);
      const dG = dH - (T * dS) / 1000;
      return {
        text: `For a reaction, $\\Delta H = ${dH}\\ \\text{kJ mol}^{-1}$ and $\\Delta S = ${dS}\\ \\text{J K}^{-1}\\text{mol}^{-1}$. At $${T}\\ \\text{K}$, $\\Delta G$ is`,
        ans: dG, unit: 'kJ/mol',
        wrongs: [dH + (T * dS) / 1000, dH - T * dS, dG * 2],
      };
    },
  },
  {
    topic: 'Thermodynamics and Thermochemistry', sub: 'Temperature for spontaneity', difficulty: 'medium',
    gen: (r) => {
      const dH = r.pick([20, 30, 40, 50, 60, 80, 100]), dS = r.pick([100, 125, 200, 250]);
      return {
        text: `A reaction has $\\Delta H = +${dH}\\ \\text{kJ mol}^{-1}$ and $\\Delta S = +${dS}\\ \\text{J K}^{-1}\\text{mol}^{-1}$. It becomes spontaneous above the temperature`,
        ans: (dH * 1000) / dS, unit: 'K',
        wrongs: [dH / dS, (dS * 1000) / dH, (dH * 100) / dS],
      };
    },
  },
  {
    topic: 'Thermodynamics and Thermochemistry', sub: "Hess's law", difficulty: 'medium',
    gen: (r) => {
      const a = r.pick([-394, -393, -285, -286, -110, -242]), b = r.pick([-283, -286, -110, -46, -92]);
      return {
        text: `If $\\Delta H$ for reaction 1 is $${a}\\ \\text{kJ}$ and for reaction 2 is $${b}\\ \\text{kJ}$, then $\\Delta H$ for (reaction 1 − reaction 2) is`,
        ans: a - b, unit: 'kJ',
        wrongs: [a + b, b - a, a],
      };
    },
  },
  {
    topic: 'Thermodynamics and Thermochemistry', sub: 'Work of expansion', difficulty: 'easy',
    gen: (r) => {
      const P = r.pick([1, 2, 3, 5]), V1 = r.pick([1, 2, 5]), V2 = r.pick([6, 10, 12, 15, 20]);
      const w = -P * (V2 - V1);
      return {
        text: `A gas expands against a constant external pressure of $${P}\\ \\text{atm}$ from $${V1}\\ \\text{L}$ to $${V2}\\ \\text{L}$. The work done on the gas is`,
        ans: w, unit: 'L atm',
        wrongs: [-w, -P * V2, w * 2],
      };
    },
  },
  // ── Equilibrium ──────────────────────────────────────────────────────────
  {
    topic: 'Chemical Equilibrium', sub: 'Equilibrium constant', difficulty: 'easy',
    gen: (r) => {
      const A = r.pick([0.1, 0.2, 0.5, 1]), B = r.pick([0.1, 0.2, 0.5, 1]), C = r.pick([0.5, 1, 2, 4]), D = r.pick([0.5, 1, 2]);
      const K = (C * D) / (A * B);
      return {
        text: `For A + B ⇌ C + D at equilibrium, [A] = $${A}$ M, [B] = $${B}$ M, [C] = $${C}$ M and [D] = $${D}$ M. The value of $K_c$ is`,
        ans: K, unit: '',
        wrongs: [1 / K, (C + D) / (A + B), K * 2],
      };
    },
  },
  {
    topic: 'Chemical Equilibrium', sub: 'Kp and Kc', difficulty: 'medium',
    gen: (r) => {
      const rxns = [['N$_2$ + 3H$_2$ ⇌ 2NH$_3$', -2], ['PCl$_5$ ⇌ PCl$_3$ + Cl$_2$', 1], ['H$_2$ + I$_2$ ⇌ 2HI', 0], ['2SO$_2$ + O$_2$ ⇌ 2SO$_3$', -1], ['N$_2$O$_4$ ⇌ 2NO$_2$', 1], ['CaCO$_3$(s) ⇌ CaO(s) + CO$_2$(g)', 1]];
      const [eq, dn] = r.pick(rxns);
      return {
        text: `For the equilibrium ${eq}, the value of $\\Delta n_g$ used in $K_p = K_c(RT)^{\\Delta n_g}$ is`,
        ans: dn, unit: '',
        wrongs: [-dn === dn ? dn + 1 : -dn, dn + 2, dn - 1],
      };
    },
  },
  // ── Ionic equilibrium ────────────────────────────────────────────────────
  {
    topic: 'Ionic Equilibrium', sub: 'pH of strong acid', difficulty: 'easy',
    gen: (r) => {
      const n = r.int(1, 5), acid = r.pick(['HCl', 'HNO$_3$']);
      return {
        text: `The pH of a $10^{-${n}}\\ \\text{M}$ ${acid} solution at 25°C is`,
        ans: n, unit: '',
        wrongs: [14 - n, n + 1, n === 1 ? 2 : n - 1],
      };
    },
  },
  {
    topic: 'Ionic Equilibrium', sub: 'pH of strong base', difficulty: 'easy',
    gen: (r) => {
      const n = r.int(1, 5), base = r.pick(['NaOH', 'KOH']);
      return {
        text: `The pH of a $10^{-${n}}\\ \\text{M}$ ${base} solution at 25°C is`,
        ans: 14 - n, unit: '',
        wrongs: [n, 14 - n - 1, 14 - n + 1],
      };
    },
  },
  {
    topic: 'Ionic Equilibrium', sub: 'Buffer pH', difficulty: 'medium',
    gen: (r) => {
      const pKa = r.pick([4.74, 4.2, 3.75, 5.0, 9.25]), ratio = r.pick([0.1, 1, 10, 100]);
      const pH = pKa + Math.log10(ratio);
      return {
        text: `A buffer contains a weak acid ($\\mathrm{p}K_a = ${pKa}$) and its salt with $[\\text{salt}]/[\\text{acid}] = ${ratio}$. Its pH is`,
        ans: pH, unit: '',
        wrongs: [pKa - Math.log10(ratio), pKa, pKa + ratio / 10 + 0.5],
      };
    },
  },
  {
    topic: 'Ionic Equilibrium', sub: 'Solubility product', difficulty: 'medium',
    gen: (r) => {
      const type = r.pick(['AB', 'AB2']), s = r.pick([1, 2, 3, 4, 5]), e = r.pick([3, 4, 5]);
      const ksp = type === 'AB' ? s * s : 4 * s * s * s;
      const expo = type === 'AB' ? 2 * e : 3 * e;
      return {
        text: `The solubility of a sparingly soluble salt of type ${type === 'AB' ? 'AB' : 'AB$_2$'} is $${s}\\times10^{-${e}}\\ \\text{mol L}^{-1}$. Its $K_{sp}$ is $x \\times 10^{-${expo}}$, where $x$ is`,
        ans: ksp, unit: '',
        wrongs: type === 'AB' ? [2 * s * s, 4 * s * s, s] : [s * s * s, 2 * s * s * s, s * s],
      };
    },
  },
  // ── Electrochemistry ─────────────────────────────────────────────────────
  {
    topic: 'Electrochemistry', sub: "Faraday's first law", difficulty: 'medium',
    gen: (r) => {
      const metals = [['silver', 108, 1], ['copper', 63.5, 2], ['zinc', 65, 2], ['aluminium', 27, 3], ['nickel', 58.7, 2]];
      const [m, M, n] = r.pick(metals), F = r.pick([0.5, 1, 2, 3]);
      const mass = (F * M) / n;
      return {
        text: `The mass of ${m} deposited when $${fmt(F * 96500)}\\ \\text{C}$ of charge is passed through a solution of its salt (metal ion charge $+${n}$, atomic mass $${M}$) is`,
        ans: mass, unit: 'g',
        wrongs: [F * M, (F * M) / (n + 1), (F * M * n)],
      };
    },
  },
  {
    topic: 'Electrochemistry', sub: 'Cell emf', difficulty: 'easy',
    gen: (r) => {
      const pairs = [['Zn', -0.76, 'Cu', 0.34], ['Zn', -0.76, 'Ag', 0.8], ['Mg', -2.37, 'Cu', 0.34], ['Fe', -0.44, 'Cu', 0.34], ['Ni', -0.25, 'Ag', 0.8], ['Cu', 0.34, 'Ag', 0.8]];
      const [a, Ea, c, Ec] = r.pick(pairs);
      const E = Ec - Ea;
      return {
        text: `Given $E^\\circ(\\text{${a}}^{n+}/\\text{${a}}) = ${Ea}\\ \\text{V}$ and $E^\\circ(\\text{${c}}^{n+}/\\text{${c}}) = ${Ec}\\ \\text{V}$, the standard emf of the cell formed from these electrodes is`,
        ans: E, unit: 'V',
        wrongs: [Ea + Ec, Ea - Ec, Math.abs(Ec) + 0.1],
      };
    },
  },
  {
    topic: 'Electrochemistry', sub: 'Gibbs energy of a cell', difficulty: 'medium',
    gen: (r) => {
      const n = r.pick([1, 2, 3]), E = r.pick([0.5, 1, 1.1, 1.5, 2]);
      const dG = -(n * 96500 * E) / 1000;
      return {
        text: `A cell reaction involves transfer of $${n}$ electron(s) and has $E^\\circ = ${E}\\ \\text{V}$. Its $\\Delta G^\\circ$ (F = 96500 C/mol) is`,
        ans: dG, unit: 'kJ/mol',
        wrongs: [-dG, dG / n, dG * 2],
      };
    },
  },
  // ── Kinetics ─────────────────────────────────────────────────────────────
  {
    topic: 'Chemical Kinetics', sub: 'First-order completion', difficulty: 'medium',
    gen: (r) => {
      const t = r.pick([5, 10, 15, 20, 30, 40]), k = r.pick([[50, 1], [75, 2], [87.5, 3], [93.75, 4]]);
      const [pct, n] = k;
      return {
        text: `A first-order reaction has a half-life of $${t}\\ \\text{min}$. The time required for $${pct}\\%$ completion is`,
        ans: n * t, unit: 'min',
        wrongs: [(n + 1) * t, (pct / 50) * t, t * n * n],
      };
    },
  },
  {
    topic: 'Chemical Kinetics', sub: 'Order from rate change', difficulty: 'easy',
    gen: (r) => {
      const order = r.int(0, 3), f = r.pick([2, 3, 4]);
      return {
        text: `When the concentration of the reactant of a reaction of order ${order} is increased ${f} times, the rate increases by a factor of`,
        ans: Math.pow(f, order), unit: '',
        wrongs: [f * order || f + 1, Math.pow(f, order + 1), Math.pow(order, f) || 2],
      };
    },
  },
  {
    topic: 'Chemical Kinetics', sub: 'Half-life from rate constant', difficulty: 'easy',
    gen: (r) => {
      const t = r.pick([10, 20, 35, 50, 69.3, 100]);
      const k = 0.693 / t;
      return {
        text: `The rate constant of a first-order reaction is $${fmt(k)}\\ \\text{s}^{-1}$. Its half-life is approximately`,
        ans: t, unit: 's',
        wrongs: [2 * t, t / 2, 1 / k * 2.303],
      };
    },
  },
  {
    topic: 'Chemical Kinetics', sub: 'Remaining after half-lives', difficulty: 'easy',
    gen: (r) => {
      const n = r.int(1, 5), a0 = r.pick([100, 160, 200, 320, 400, 800]);
      return {
        text: `A first-order reaction starts with $${a0}\\ \\text{g}$ of reactant. The amount remaining after ${n} half-lives is`,
        ans: a0 / Math.pow(2, n), unit: 'g',
        wrongs: [a0 / (2 * n), a0 - a0 / Math.pow(2, n), a0 / Math.pow(2, n + 1)],
      };
    },
  },
  // ── Solutions ────────────────────────────────────────────────────────────
  {
    topic: 'Colligative Properties of Solutions', sub: 'Elevation of boiling point', difficulty: 'medium',
    gen: (r) => {
      const [solv, Kb] = r.pick(KB), m = r.pick([0.1, 0.2, 0.5, 1, 2]), i = r.pick([1, 2, 3]);
      const ans = i * Kb * m;
      const solute = { 1: 'glucose', 2: 'NaCl', 3: 'CaCl$_2$' }[i];
      return {
        text: `The elevation in boiling point of a $${m}$ molal solution of ${solute} in ${solv} ($K_b = ${Kb}\\ \\text{K kg mol}^{-1}$, complete dissociation) is`,
        ans, unit: 'K',
        wrongs: [Kb * m, i * Kb * m * 2, (Kb * m) / i],
      };
    },
  },
  {
    topic: 'Colligative Properties of Solutions', sub: 'Depression of freezing point', difficulty: 'medium',
    gen: (r) => {
      const [solv, Kf] = r.pick(KF), m = r.pick([0.1, 0.2, 0.5, 1]), i = r.pick([1, 2, 3]);
      const ans = i * Kf * m;
      return {
        text: `A solute that gives ${i} particle(s) per formula unit forms a $${m}$ molal solution in ${solv} ($K_f = ${Kf}\\ \\text{K kg mol}^{-1}$). The depression in freezing point is`,
        ans, unit: 'K',
        wrongs: [Kf * m, i * Kf * m * 2, (Kf * m) / i],
      };
    },
  },
  {
    topic: 'Colligative Properties of Solutions', sub: "van 't Hoff factor", difficulty: 'easy',
    gen: (r) => {
      const salts = [['NaCl', 2], ['K$_2$SO$_4$', 3], ['CaCl$_2$', 3], ['AlCl$_3$', 4], ['K$_4$[Fe(CN)$_6$]', 5], ['Al$_2$(SO$_4$)$_3$', 5], ['glucose', 1], ['urea', 1], ['MgSO$_4$', 2], ['K$_3$[Fe(CN)$_6$]', 4]];
      const [s, i] = r.pick(salts);
      return {
        text: `Assuming complete dissociation, the van 't Hoff factor of ${s} in water is`,
        ans: i, unit: '',
        wrongs: [i + 1, i === 1 ? 2 : i - 1, i + 2],
      };
    },
  },
  // ── Solid state ──────────────────────────────────────────────────────────
  {
    topic: 'Solid State', sub: 'Atoms per unit cell', difficulty: 'easy',
    gen: (r) => {
      const cells = [['simple cubic', 1], ['body-centred cubic', 2], ['face-centred cubic', 4]];
      const [c, z] = r.pick(cells);
      const extra = r.pick(['', ' (consider only lattice points as atoms)']);
      return {
        text: `The number of atoms per unit cell in a ${c} lattice is${extra}`,
        ans: z, unit: '',
        wrongs: [1, 2, 4, 6, 8].filter((x) => x !== z).slice(0, 3),
      };
    },
  },
  {
    topic: 'Solid State', sub: 'Voids in close packing', difficulty: 'medium',
    gen: (r) => {
      const N = r.pick([2, 4, 6, 8, 10, 12, 20]), type = r.pick(['tetrahedral', 'octahedral']);
      return {
        text: `In a close-packed structure of ${N} atoms, the number of ${type} voids is`,
        ans: type === 'tetrahedral' ? 2 * N : N, unit: '',
        wrongs: type === 'tetrahedral' ? [N, N / 2, 4 * N] : [2 * N, N / 2, 3 * N],
      };
    },
  },
  {
    topic: 'Solid State', sub: 'Coordination number', difficulty: 'easy',
    gen: (r) => {
      const items = [['simple cubic', 6], ['body-centred cubic', 8], ['face-centred cubic', 12], ['hexagonal close-packed', 12], ['NaCl (rock salt)', 6], ['CsCl', 8], ['zinc blende (ZnS)', 4]];
      const [s, cn] = r.pick(items);
      return {
        text: `The coordination number in a ${s} structure is`,
        ans: cn, unit: '',
        wrongs: [4, 6, 8, 12].filter((x) => x !== cn).slice(0, 3),
      };
    },
  },
];
