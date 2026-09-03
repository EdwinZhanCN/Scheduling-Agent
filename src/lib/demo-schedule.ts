import type { EventInput } from '@fullcalendar/react'

export type ProposalStatus = 'pending' | 'approved' | 'rejected'

export type ScheduleProposal = {
  id: string
  operation: 'create' | 'move' | 'delete'
  status: ProposalStatus
  title: string
  start: string
  end: string
  reasoning: string
  conflicts: string[]
}

export const demoEvents: EventInput[] = [
  {
    id: 'demo-ai-intro',
    title: 'Intro to AI',
    start: '2026-09-07T09:00:00',
    end: '2026-09-07T10:30:00',
    extendedProps: { calendar: 'course' },
  },
  {
    id: 'demo-workout',
    title: 'Workout',
    start: '2026-09-08T14:00:00',
    end: '2026-09-08T15:30:00',
    extendedProps: { calendar: 'personal' },
  },
  {
    id: 'demo-project-discussion',
    title: 'Project Discussion',
    start: '2026-09-10T11:00:00',
    end: '2026-09-10T12:30:00',
    extendedProps: { calendar: 'course' },
  },
]

export const demoProposal: ScheduleProposal = {
  id: 'proposal-focus-time',
  operation: 'create',
  status: 'pending',
  title: 'Team Project Focus Time',
  start: '2026-09-09T15:00:00',
  end: '2026-09-09T16:30:00',
  reasoning: 'Continuous 90-minute free window on Wednesday afternoon.',
  conflicts: [],
}

export function getProposalEvent(
  proposal: ScheduleProposal,
  status: ProposalStatus,
): EventInput | null {
  if (status === 'rejected') {
    return null
  }

  return {
    id: proposal.id,
    title: status === 'pending' ? `Review: ${proposal.title}` : proposal.title,
    start: proposal.start,
    end: proposal.end,
    editable: false,
    extendedProps: {
      calendar: status === 'pending' ? 'proposal' : 'course',
      proposalId: proposal.id,
      proposalStatus: status,
    },
  }
}
