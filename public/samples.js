const sampleChecks = [
  [
    {
      question: "What makes a shadow?",
      options: [
        "An object blocks light.",
        "An object creates light.",
        "The ground stops moving.",
      ],
      correctIndex: 0,
      feedback:
        "A shadow is an area where an object blocks light from reaching a surface.",
    },
    {
      question: "Which comparison helps you test a change in shadow length?",
      options: [
        "Different objects in different places.",
        "The same object and surface at two recorded times.",
        "An imagined shadow with no observation.",
      ],
      correctIndex: 1,
      feedback:
        "Keep the object and surface the same and record the times so your comparison is clearer.",
    },
  ],
  [
    {
      question: "What does a line of symmetry divide a shape into?",
      options: [
        "Two unrelated shapes.",
        "Two halves that match as mirror images.",
        "Three equal circles.",
      ],
      correctIndex: 1,
      feedback: "The halves match as mirror images across the line.",
    },
    {
      question:
        "A leaf has nearly matching halves with small differences. What can you say?",
      options: [
        "It shows approximate symmetry.",
        "It must have perfect symmetry.",
        "It cannot be compared.",
      ],
      correctIndex: 0,
      feedback:
        "Real leaves can be approximately symmetrical rather than perfectly identical.",
    },
  ],
  [
    {
      question:
        "You see three similar ants and one kind of grass. How many observed kinds is that?",
      options: ["Four kinds.", "Two kinds.", "One kind."],
      correctIndex: 1,
      feedback:
        "Count visual kinds separately from individuals: one ant kind and one grass kind.",
    },
    {
      question: "Why might a short observation miss some life?",
      options: [
        "Some organisms are hidden or active at another time.",
        "Every organism is visible all the time.",
        "Only large animals count.",
      ],
      correctIndex: 0,
      feedback:
        "A short visit samples what you can see, not every organism present.",
    },
  ],
];
const nextQuestions = [
  "How does the direction of light change a shadow?",
  "Where can I find symmetry in built objects?",
  "Why might two nearby patches have different observed kinds of life?",
];
export const samples = [
  {
    title: "Follow a shadow",
    topic: "Shadows and light",
    goal: "Discover how an object blocks light to make a shadow.",
    materials: ["Paper and pencil (optional)"],
    steps: [
      "Find a shadow cast by a plant, chair, or post. Stay in a safe spot and never look directly at the sun.",
      "Notice the object and its shadow. Which side is the light coming from? Predict what happens if you move your hand closer to the ground.",
      "Try your hand prediction. Compare its shadow near the ground and a little higher. Notice changes in size or sharpness.",
      "Sketch or remember one observation. If the sky is cloudy and shadows are faint, describe that instead.",
    ],
    explanation:
      "A shadow forms where an object blocks light. Its position depends on the direction of the light. Its size and sharpness can change with the distances between the light source, object and surface.",
    reflection: "What did you change, and what happened to the shadow?",
    safety:
      "Stay clear of roads. Never look at the sun. Children should explore with an adult.",
  },
  {
    title: "Find nature’s patterns",
    topic: "Symmetry",
    goal: "Look for shapes with two nearly matching halves.",
    materials: ["Paper and pencil (optional)"],
    steps: [
      "From a safe spot, find a leaf you can see clearly without picking it.",
      "Imagine a line down its middle. Compare the left and right sides: shape, veins and edges.",
      "Find a second leaf or a nearby built object. Does it have a line that would divide it into matching halves?",
      "Sketch one example and mark its imaginary dividing line. Notice one way the halves differ.",
    ],
    explanation:
      "Reflection symmetry means one half is a mirror image of the other across a line. Natural objects often show approximate symmetry: the halves are similar, but small differences remain.",
    reflection:
      "Which example came closest to mirror symmetry, and what difference did you notice?",
    safety:
      "Observe without picking plants or touching unfamiliar leaves. Children should explore with an adult.",
  },
  {
    title: "A tiny life census",
    topic: "Biodiversity",
    goal: "Notice how many different kinds of living things share a small space.",
    materials: ["Paper and pencil (optional)"],
    steps: [
      "Choose a small patch of garden or courtyard that you can observe safely, including from a seat.",
      "Look for different kinds of plants or animals without touching or disturbing them. Use descriptions such as narrow-leaf plant if you do not know names.",
      "Count the different kinds you notice, not just the total number of individuals. Ten similar ants still count as one observed kind in this activity.",
      "Compare a second nearby patch if possible. What might explain a difference in what you noticed?",
    ],
    explanation:
      "Biodiversity is the variety of life in a place. This quick observation is only a small sample: some organisms are hidden, too small to see, or active at other times. Appearance alone cannot confirm species.",
    reflection:
      "What did you notice, and what might your short observation have missed?",
    safety:
      "Keep your distance from animals and insects. Do not lift rocks or touch unknown plants. Children should explore with an adult.",
  },
].map((a, i) => ({
  ...a,
  checks: sampleChecks[i],
  nextQuestion: nextQuestions[i],
  minutes: 10,
  place: "A safe nearby outdoor space",
  level: "Beginner",
  source: "Sample activity · written in advance",
}));
