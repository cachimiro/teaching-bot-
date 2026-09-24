/** Sample tutor output for every visual and activity (used by the dev gallery and browser tests). */
export const GALLERY_SAMPLES: { id: string; title: string; markdown: string }[] = [
  {
    id: "board-gaps",
    title: "Working-out board with gaps",
    markdown: [
      "Your turn: finish the factorising.",
      "```steps",
      "x^2 + 5x + 6 = 0 | Here's the equation.",
      "(x + 2)(x + [[3]]) = 0 | Find two numbers that add to 5 and multiply to 6.",
      "x = -2 \\text{ or } x = [[-3]] | Set each bracket equal to zero.",
      "```",
    ].join("\n"),
  },
  {
    id: "board-gaps-fraction",
    title: "Board with gaps inside a fraction and a root",
    markdown: [
      "```steps",
      "2x^2 + 5x - 1 = 0 | a = 2, b = 5 and c = -1.",
      "x = \\dfrac{-5 \\pm \\sqrt{[[33]]}}{[[4]]} | Work out b² − 4ac, and the denominator 2a.",
      "x = [[0.19]] \\text{ or } x = [[-2.69]] | Give both roots to 2 d.p.",
      "```",
    ].join("\n"),
  },
  {
    id: "board-french",
    title: "Board with words (French)",
    markdown: ["```steps", "j'ai + mangé | Avoir first, then the past participle.", "tu as [[fini]] | Finir becomes fini.", "```"].join("\n"),
  },
  {
    id: "quiz",
    title: "Quick check",
    markdown: [
      "```quiz",
      JSON.stringify({
        question: "Which part of the cell releases energy by respiration?",
        options: ["Nucleus", "Mitochondria", "Ribosomes", "Cell membrane"],
        answer: 1,
        explain: "Aerobic respiration happens in the mitochondria.",
      }),
      "```",
    ].join("\n"),
  },
  {
    id: "order",
    title: "Put in order",
    markdown: [
      "```order",
      JSON.stringify({
        prompt: "Put the path of blood through the heart in order, starting from the body",
        items: ["Vena cava", "Right atrium", "Right ventricle", "Pulmonary artery", "Lungs"],
      }),
      "```",
    ].join("\n"),
  },
  {
    id: "explore",
    title: "What happens if (formula explorer)",
    markdown: [
      "```explore",
      JSON.stringify({
        title: "Ohm's law",
        formula: "I = V / R",
        inputs: { V: { label: "potential difference", min: 0, max: 12, value: 6, step: 0.5, unit: "V" }, R: { label: "resistance", min: 1, max: 20, value: 3, step: 1, unit: "Ω" } },
        output: { label: "Current", unit: "A", dp: 2 },
        plot: "R",
        question: "Double the resistance. What happens to the current?",
      }),
      "```",
    ].join("\n"),
  },
  {
    id: "graph-quadratic",
    title: "Graph with sliders",
    markdown: [
      "```graph",
      JSON.stringify({
        functions: [{ expr: "ax^2 + bx + c", label: "y = ax^2 + bx + c" }],
        params: { a: 1, b: 5, c: 6 },
        x: [-7, 2],
        mark: ["roots", "vertex", "y-intercept"],
      }),
      "```",
    ].join("\n"),
  },
  {
    id: "graph-vt",
    title: "Science graph from data",
    markdown: [
      "```graph",
      JSON.stringify({ data: [{ points: [[0, 0], [5, 20], [10, 20]], label: "car" }], xLabel: "Time (s)", yLabel: "Velocity (m/s)", title: "Velocity–time graph" }),
      "```",
    ].join("\n"),
  },
  {
    id: "graph-bars",
    title: "Bar chart (statistics)",
    markdown: [
      "```graph",
      JSON.stringify({ title: "Favourite pets in Year 10", categories: ["Cat", "Dog", "Fish", "Rabbit"], data: [{ points: [[0, 8], [1, 12], [2, 3], [3, 5]], style: "bars" }], yLabel: "Frequency" }),
      "```",
    ].join("\n"),
  },
  {
    id: "graph-scatter",
    title: "Scatter graph with line of best fit",
    markdown: [
      "```graph",
      JSON.stringify({
        title: "Revision time and test score",
        data: [{ points: [[1, 35], [2, 42], [3, 50], [4, 51], [5, 63], [6, 68], [7, 71]], style: "points", label: "students" }],
        functions: [{ expr: "6x + 30", label: "\\text{line of best fit}" }],
        x: [0, 8],
        xLabel: "Hours of revision",
        yLabel: "Score (%)",
      }),
      "```",
    ].join("\n"),
  },
  {
    id: "diagram-animal-cell",
    title: "Diagram: animal cell (highlighting mitochondria)",
    markdown: ["```diagram", JSON.stringify({ name: "animal-cell", highlight: ["mitochondria"] }), "```"].join("\n"),
  },
  {
    id: "diagram-animal-cell-quiz",
    title: "Diagram: labelling quiz",
    markdown: ["```diagram", JSON.stringify({ name: "animal-cell", mode: "quiz" }), "```"].join("\n"),
  },
  {
    id: "diagram-plant-cell",
    title: "Diagram: plant cell (chloroplasts and vacuole)",
    markdown: ["```diagram", JSON.stringify({ name: "plant-cell", highlight: ["chloroplasts", "permanent-vacuole"] }), "```"].join("\n"),
  },
  {
    id: "diagram-bacterial-cell",
    title: "Diagram: bacterial cell (plasmids)",
    markdown: ["```diagram", JSON.stringify({ name: "bacterial-cell", highlight: ["plasmids"] }), "```"].join("\n"),
  },
  {
    id: "diagram-heart",
    title: "Diagram: the heart (left ventricle)",
    markdown: ["```diagram", JSON.stringify({ name: "heart", highlight: ["left-ventricle"] }), "```"].join("\n"),
  },
  {
    id: "diagram-leaf-quiz",
    title: "Diagram: leaf labelling quiz",
    markdown: ["```diagram", JSON.stringify({ name: "leaf", mode: "quiz", ask: ["palisade-mesophyll", "stomata", "guard-cells", "xylem"] }), "```"].join("\n"),
  },
  {
    id: "diagram-wave-transverse",
    title: "Diagram: transverse wave (amplitude)",
    markdown: ["```diagram", JSON.stringify({ name: "wave", type: "transverse", amplitude: 2, wavelength: 4, frequency: 1, highlight: ["amplitude"] }), "```"].join("\n"),
  },
  {
    id: "diagram-wave-longitudinal",
    title: "Diagram: longitudinal wave (fence named after the diagram)",
    markdown: ["```wave", JSON.stringify({ type: "longitudinal", amplitude: 0.5, wavelength: 1.5, frequency: 220, highlight: ["wavelength"] }), "```"].join("\n"),
  },
  {
    id: "diagram-circuit-series",
    title: "Diagram: series circuit",
    markdown: ["```diagram", JSON.stringify({ name: "circuit", type: "series", voltage: 6, resistors: [2, 4], highlight: ["ammeter"] }), "```"].join("\n"),
  },
  {
    id: "diagram-circuit-parallel",
    title: "Diagram: parallel circuit",
    markdown: ["```diagram", JSON.stringify({ name: "circuit", type: "parallel", voltage: 12, resistors: [2, 3, 6], highlight: ["R2"] }), "```"].join("\n"),
  },
  {
    id: "diagram-forces-car",
    title: "Diagram: forces on a car",
    markdown: [
      "```diagram",
      JSON.stringify({ name: "forces", object: "car", forces: [{ label: "Thrust", size: 500, direction: "right" }, { label: "Drag", size: 300, direction: "left" }], mass: 1000 }),
      "```",
    ].join("\n"),
  },
  {
    id: "diagram-forces-skydiver",
    title: "Diagram: skydiver at terminal velocity",
    markdown: [
      "```diagram",
      JSON.stringify({ name: "forces", object: "skydiver", forces: [{ label: "Weight", size: 700, direction: "down" }, { label: "Air resistance", size: 700, direction: "up" }], mass: 70 }),
      "```",
    ].join("\n"),
  },
  {
    id: "diagram-em",
    title: "Diagram: EM spectrum (microwaves)",
    markdown: ["```diagram", JSON.stringify({ name: "em-spectrum", highlight: "microwaves" }), "```"].join("\n"),
  },
  {
    id: "diagram-em-blank",
    title: "Diagram: EM spectrum (blank, tap to reveal)",
    markdown: ["```diagram", JSON.stringify({ name: "em-spectrum", mode: "blank" }), "```"].join("\n"),
  },
  {
    id: "diagram-atom-ion",
    title: "Diagram: sodium ion",
    markdown: ["```diagram", JSON.stringify({ name: "atom", element: "Na", charge: 1 }), "```"].join("\n"),
  },
  {
    id: "diagram-atom-shell",
    title: "Diagram: chlorine atom, outer shell highlighted",
    markdown: ["```diagram", JSON.stringify({ name: "atom", element: "Cl", highlight: ["outer shell"] }), "```"].join("\n"),
  },
  {
    id: "diagram-periodic-group1",
    title: "Diagram: periodic table, group 1",
    markdown: ["```diagram", JSON.stringify({ name: "periodic-table", highlight: ["group 1"] }), "```"].join("\n"),
  },
  {
    id: "diagram-periodic-select",
    title: "Diagram: periodic table, halogens and period 3, chlorine selected",
    markdown: ["```diagram", JSON.stringify({ name: "periodic-table", highlight: ["halogens", "period 3"], select: "Cl" }), "```"].join("\n"),
  },
  {
    id: "diagram-particles",
    title: "Diagram: states of matter",
    markdown: ["```diagram", JSON.stringify({ name: "particles", state: "all" }), "```"].join("\n"),
  },
  {
    id: "diagram-particles-slider",
    title: "Diagram: heating a substance (slider)",
    markdown: ["```diagram", JSON.stringify({ name: "particles", state: "solid", controls: true }), "```"].join("\n"),
  },
  {
    id: "sketch-neuron",
    title: "Tutor sketch: motor neurone",
    markdown: [
      "```sketch",
      JSON.stringify({ title: "Motor neurone", labels: ["Dendrites", "Cell body", "Nucleus", "Axon", "Myelin sheath", "Nerve endings", "Direction of impulse"] }),
      "```",
    ].join("\n"),
  },
  {
    id: "sketch-distillation",
    title: "Tutor sketch: simple distillation",
    markdown: [
      "```sketch",
      JSON.stringify({
        title: "Simple distillation",
        labels: ["Heat source", "Round-bottomed flask", "Salty water", "Thermometer", "Condenser", "Cold water in", "Cold water out", "Beaker", "Pure water"],
        detail: "Thermometer bulb level with the side arm; condenser slopes down to the beaker.",
      }),
      "```",
    ].join("\n"),
  },
  {
    id: "sketch-eye",
    title: "Tutor sketch: the eye (dense labels)",
    markdown: [
      "```sketch",
      JSON.stringify({ title: "The human eye", labels: ["Cornea", "Iris", "Pupil", "Lens", "Ciliary muscles", "Suspensory ligaments", "Retina", "Optic nerve"], detail: "Side-on cross-section." }),
      "```",
    ].join("\n"),
  },
  {
    id: "mermaid",
    title: "Flowchart",
    markdown: ["```mermaid", 'flowchart LR', '  A["New predator arrives"] --> B["Prey population falls"] --> C["Less food for other predators"]', "```"].join("\n"),
  },
];
