import { mkdirSync, writeFileSync } from 'node:fs'
import { Store } from '../src/server/store.server'
import { SchedulingService } from '../src/server/service.server'
import { analyzeTask } from '../src/server/provider.server'

const records: unknown[] = []
const store = new Store(':memory:')
const service = new SchedulingService(store)
const cases = [
  {
    title: 'Atlas reading',
    description:
      'For Project Atlas, read one supplied paper in the campus library. This is a single reading task.',
    expectedProject: 'Atlas',
    expectedContext: 'library',
  },
  {
    title: 'Reading',
    description: 'Read one supplied paper. This is a single reading task.',
    expectedProject: null,
    expectedContext: null,
  },
]
const path = `artifacts/task-labels-${new Date().toISOString().replaceAll(':', '-')}`
mkdirSync(path, { recursive: true })
writeFileSync(
  `${path}/protocol.json`,
  JSON.stringify({ syntheticOnly: true, cases }, null, 2),
)
let passed = 0
try {
  for (const test of cases) {
    const state = await service.createTask(
      { title: test.title, description: test.description },
      async (title, description) => {
        const response = await analyzeTask(title, description)
        records.push({ title, description, response })
        return response
      },
    )
    const task = state.tasks.at(-1)!
    const ok =
      (test.expectedProject
        ? task.project?.includes(test.expectedProject)
        : task.project === null) &&
      (test.expectedContext
        ? task.context?.includes(test.expectedContext)
        : task.context === null) &&
      task.complexity === 'low'
    if (ok) passed++
    records.push({ task, passed: ok })
  }
} finally {
  store.close()
}
writeFileSync(
  `${path}/report.json`,
  JSON.stringify(
    { passed, total: cases.length, calls: cases.length, records },
    null,
    2,
  ),
)
console.log(JSON.stringify({ path, passed, total: cases.length }))
if (passed !== cases.length) process.exitCode = 1
