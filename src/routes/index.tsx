import { createFileRoute } from '@tanstack/react-router'

import { SchedulingWorkbench } from '#/components/scheduling-workbench'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return <SchedulingWorkbench />
}
