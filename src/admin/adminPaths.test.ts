import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Nothing in the parish office may link to the old /admin path.
 *
 * ## The bug this exists for
 *
 * The administration portal was moved off /admin to a hard-to-guess
 * path, and /admin/* was pointed at the landing page so the old
 * address gives nothing away. Four navigation calls were missed:
 * clicking an application ran navigate('/admin/applications/view/…'),
 * which matched that redirect, and the administrator was thrown out of
 * the portal onto the PUBLIC LANDING PAGE. Opening an application -
 * the single most common thing in this admin - was broken for days
 * and the failure looked like a logout rather than a bad link.
 *
 * The path is a bare string in sixty-odd places across a dozen files,
 * so the same mistake is one careless paste away. Grepping the source
 * is a blunt test, but it is the one that would have caught this, and
 * it costs nothing to run.
 */

const ADMIN_DIR = join(process.cwd(), 'src', 'admin')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    if (!/\.tsx?$/.test(entry.name)) return []
    if (/\.test\.tsx?$/.test(entry.name)) return []
    return [full]
  })
}

describe('admin navigation paths', () => {
  it('never routes to the retired /admin path', () => {
    const offenders: string[] = []

    for (const file of sourceFiles(ADMIN_DIR)) {
      const text = readFileSync(file, 'utf-8')
      text.split('\n').forEach((line, i) => {
        // A quoted or templated path beginning /admin — the shape that
        // goes into navigate(), <Link to=…> and href.
        if (/["'`]\/admin(\/|["'`])/.test(line)) {
          offenders.push(`${file.replace(process.cwd(), '')}:${i + 1}  ${line.trim()}`)
        }
      })
    }

    expect(offenders).toEqual([])
  })

  it('the application detail link points inside the portal', () => {
    // The exact two files that were broken, named so a future reader
    // knows which regression this guards.
    for (const name of ['AdminApplications.tsx', 'AdminDashboard.tsx']) {
      const text = readFileSync(join(ADMIN_DIR, name), 'utf-8')
      expect(text).toContain('/parish-office-gav8thhe/applications/view/')
    }
  })
})
