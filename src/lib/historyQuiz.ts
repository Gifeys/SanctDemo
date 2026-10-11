/**
 * Five questions about a parish's own history.
 *
 * ## The one rule
 *
 * Every correct answer is a sentence on the parish's history page.
 * Nothing here is invented, nothing is drawn from outside the diocese's
 * own material, and nothing is generated at runtime by a model.
 *
 * `evidence` is the phrase from that page which the answer comes from,
 * and a test asserts that it really does appear in the prose. That test
 * is the guard: if somebody rewrites a parish's history and a question
 * stops matching, the suite fails rather than the quiz quietly asking
 * about something the page no longer says.
 *
 * ## Why only two parishes
 *
 * Only two have a written history. For the other twenty-nine the quiz
 * does not appear at all, which is the honest answer - questions
 * invented to fill the section would be exactly the thing this app
 * refuses everywhere else.
 */

export interface QuizItem {
  question: string
  options: string[]
  /** Index into `options`. */
  correct: number
  explanation: string
  /** The phrase on the history page the answer comes from. */
  evidence: string
}

export const HISTORY_QUIZZES: Record<string, QuizItem[]> = {
  "route-mhcp": [
    {
      question: "In what year was Mary Help of Christians Parish established?",
      options: ["1815", "1952", "1898", "2003"],
      correct: 1,
      explanation:
        "The parish was established in 1952, to serve the growing population of Southern Caloocan.",
      evidence: "established in 1952",
    },
    {
      question: "What did the parish grow from?",
      options: [
        "A stone cathedral",
        "A Spanish-era convent",
        "A simple chapel of wood and nipa",
        "A school building",
      ],
      correct: 2,
      explanation:
        "It began as a simple chapel of wood and nipa before becoming the parish that stands today.",
      evidence: "simple chapel of wood and nipa",
    },
    {
      question: "By what Spanish title is the parish's patroness also known?",
      options: ["Nuestra Señora de Guia", "Maria Auxiliadora", "La Naval", "Santa Maria"],
      correct: 1,
      explanation:
        "Mary, Help of Christians is known as Maria Auxiliadora — her role as helper and protector of Christians.",
      evidence: "maria auxiliadora",
    },
    {
      question: "Which saint's spiritual family venerates this title most highly?",
      options: ["St. John Bosco", "St. Francis of Assisi", "St. Dominic", "St. Ignatius of Loyola"],
      correct: 0,
      explanation:
        "The title is venerated within the Salesian family of St. John Bosco, whose spirit the parish carries.",
      evidence: "st. john bosco",
    },
    {
      question: "How is the patroness depicted in her image?",
      options: [
        "Crowned alone with twelve stars",
        "Standing on a crescent moon",
        "Holding the Child Jesus with both arms open",
        "Seated with an open book",
      ],
      correct: 2,
      explanation:
        "Her image shows her holding the Child Jesus with both arms open, inviting the faithful to bring her their cares.",
      evidence: "holding the child jesus with both arms open",
    },
  ],

  "route-src": [
    {
      question: "In what year was San Roque originally founded as a parish?",
      options: ["1815", "1952", "2003", "1762"],
      correct: 0,
      explanation:
        "San Roque was founded as a parish in 1815, under the Archdiocese of Manila.",
      evidence: "founded as a parish in 1815",
    },
    {
      question: "What role did the church play during the Philippine Revolution?",
      options: [
        "It was closed for the duration",
        "A military post and safe haven for local revolutionaries",
        "A hospital for Spanish soldiers",
        "A printing house for propaganda",
      ],
      correct: 1,
      explanation:
        "The church stood witness to the revolution, serving as a military post and a safe haven for local revolutionaries.",
      evidence: "military post and safe haven for local revolutionaries",
    },
    {
      question: "What happened to San Roque Parish in 2003?",
      options: [
        "It was rebuilt after a fire",
        "It was transferred to another diocese",
        "It was elevated to the dignity of a Cathedral",
        "It was declared a national shrine",
      ],
      correct: 2,
      explanation:
        "When Pope John Paul II established the Diocese of Kalookan in 2003, San Roque was elevated to the dignity of a Cathedral and became the seat of the Bishop.",
      evidence: "elevated to the dignity of a cathedral",
    },
    {
      question: "Which three cities does the Diocese of Kalookan serve?",
      options: [
        "Caloocan, Malabon, and Navotas",
        "Caloocan, Quezon City, and Manila",
        "Malabon, Valenzuela, and Navotas",
        "Caloocan, Marikina, and Pasig",
      ],
      correct: 0,
      explanation:
        "The Cathedral guides the spiritual flock of Caloocan, Malabon, and Navotas.",
      evidence: "caloocan, malabon, and navotas",
    },
    {
      question: "Who is San Roque the patron saint of?",
      options: [
        "Farmers and harvesters",
        "Students and teachers",
        "Travellers and sailors",
        "The sick, plague victims, healthcare workers",
      ],
      correct: 3,
      explanation:
        "A 14th-century layman who nursed plague sufferers across Europe, San Roque is the patron of the sick, plague victims, healthcare workers, and epidemics.",
      evidence: "the sick, plague victims, healthcare workers",
    },
  ],
}

/** The quiz for a parish, or null where its history is not written up. */
export function quizFor(routeId: string): QuizItem[] | null {
  return HISTORY_QUIZZES[routeId] ?? null
}

/**
 * Which questions are still blank, numbered from one as the reader sees
 * them. Returned rather than a bare count so the screen can say which.
 */
export function unanswered(answers: (number | null)[], total: number): number[] {
  const blank: number[] = []
  for (let i = 0; i < total; i++) {
    if (answers[i] === null || answers[i] === undefined) blank.push(i + 1)
  }
  return blank
}

export interface QuizResult {
  score: number
  total: number
  /** True where the answer given was right, per question. */
  marks: boolean[]
}

export function gradeQuiz(quiz: QuizItem[], answers: (number | null)[]): QuizResult {
  const marks = quiz.map((q, i) => answers[i] === q.correct)
  return {
    score: marks.filter(Boolean).length,
    total: quiz.length,
    marks,
  }
}
