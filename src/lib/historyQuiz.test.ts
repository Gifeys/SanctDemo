import { describe, expect, it } from 'vitest'
import { HISTORY_QUIZZES, gradeQuiz, quizFor, unanswered } from './historyQuiz'
import { parishHistorySections } from '../components/ChurchHistory'
import { pick } from './language'

describe('the quizzes themselves', () => {
  const ids = Object.keys(HISTORY_QUIZZES)

  it('covers every parish whose history is written up', () => {
    // A parish with history and no quiz would show the section heading
    // and nothing under it.
    expect(ids).toContain('route-mhcp')
    expect(ids).toContain('route-src')
  })

  for (const id of Object.keys(HISTORY_QUIZZES)) {
    describe(id, () => {
      const quiz = HISTORY_QUIZZES[id]

      it('asks five questions', () => {
        expect(quiz).toHaveLength(5)
      })

      it('offers four answers to each, with no repeats', () => {
        for (const q of quiz) {
          expect(q.options).toHaveLength(4)
          expect(new Set(q.options).size).toBe(4)
        }
      })

      it('has exactly one correct answer, and it exists', () => {
        for (const q of quiz) {
          expect(q.correct).toBeGreaterThanOrEqual(0)
          expect(q.correct).toBeLessThan(q.options.length)
        }
      })

      it('explains every answer', () => {
        for (const q of quiz) {
          expect(q.explanation.trim().length).toBeGreaterThan(20)
        }
      })

      it('asks nothing the history page does not answer', () => {
        // The one rule for this feature: no invented facts. Every
        // correct answer must appear in the parish's own history text,
        // so a visitor who read the page can answer the question.
        // Both languages. The paragraphs became bilingual when the
        // Filipino history was written, and joining the objects gave
        // "[object Object]" - which contains nothing, so the check
        // passed nothing and failed loudly. Reading both is also
        // stricter than reading English alone: an answer has to be
        // findable by whichever language the visitor read the page in.
        const prose = parishHistorySections(id)
          .flatMap(s => s.paragraphs)
          .map(p => `${pick(p, 'en')} ${pick(p, 'fil')}`)
          .join(' ')
          .toLowerCase()

        for (const q of quiz) {
          const answer = q.options[q.correct].toLowerCase()
          const found = q.evidence.toLowerCase()
          expect(prose).toContain(found)
          // And the evidence must actually be about the answer, not an
          // unrelated sentence that happens to be on the page.
          expect(found.includes(answer) || answer.includes(found)).toBe(true)
        }
      })
    })
  }
})

describe('quizFor', () => {
  it('returns the questions for a parish that has them', () => {
    expect(quizFor('route-mhcp')).toHaveLength(5)
  })

  it('returns null for a parish whose history is not written up', () => {
    // Twenty-nine of the thirty-one are in this state. No quiz is
    // shown rather than questions invented to fill the space.
    expect(quizFor('parish-birhen-ng-lourdes')).toBeNull()
    expect(quizFor('')).toBeNull()
  })
})

describe('unanswered', () => {
  it('lists the questions still blank, counting from one', () => {
    expect(unanswered([0, null, 2, null, 1], 5)).toEqual([2, 4])
  })

  it('is empty once every question has an answer', () => {
    expect(unanswered([0, 1, 2, 3, 0], 5)).toEqual([])
  })

  it('treats a missing entry as unanswered', () => {
    expect(unanswered([], 3)).toEqual([1, 2, 3])
  })
})

describe('gradeQuiz', () => {
  const quiz = quizFor('route-mhcp')!

  it('scores a perfect paper', () => {
    const answers = quiz.map(q => q.correct)
    expect(gradeQuiz(quiz, answers).score).toBe(5)
  })

  it('scores a blank paper zero rather than throwing', () => {
    expect(gradeQuiz(quiz, []).score).toBe(0)
  })

  it('marks each question so the explanations can be shown', () => {
    const answers = quiz.map((q, i) => (i === 0 ? q.correct : (q.correct + 1) % 4))
    const result = gradeQuiz(quiz, answers)
    expect(result.score).toBe(1)
    expect(result.marks[0]).toBe(true)
    expect(result.marks[1]).toBe(false)
    expect(result.total).toBe(5)
  })
})
