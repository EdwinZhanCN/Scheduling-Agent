import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  preferenceInputSchema,
  settingsSchema,
  taskInputSchema,
} from '../domain/contracts'
import { getService, safe } from './service.server'

export const getWorkspace = createServerFn({ method: 'GET' }).handler(() =>
  safe(() => getService().snapshot()),
)
export const sendRequest = createServerFn({ method: 'POST' })
  .validator(
    z
      .object({
        text: z.string().trim().min(1).max(6000),
        taskId: z.string().max(80).nullable(),
        continueContext: z.boolean(),
      })
      .strict(),
  )
  .handler(({ data }) =>
    safe(() => getService().chat(data.text, data.taskId, data.continueContext)),
  )
export const resolveProposal = createServerFn({ method: 'POST' })
  .validator(
    z
      .object({
        id: z.string().max(80),
        decision: z.enum(['approve', 'reject']),
      })
      .strict(),
  )
  .handler(({ data }) =>
    safe(() => {
      const service = getService()
      service.store.resolveProposal(
        data.id,
        data.decision,
        new Date().toISOString(),
      )
      return service.snapshot()
    }),
  )
export const saveSettings = createServerFn({ method: 'POST' })
  .validator(settingsSchema)
  .handler(({ data }) =>
    safe(() => {
      const service = getService()
      service.store.saveSettings(data)
      return service.snapshot()
    }),
  )
export const savePreference = createServerFn({ method: 'POST' })
  .validator(preferenceInputSchema)
  .handler(({ data }) =>
    safe(() => {
      const service = getService()
      service.store.savePreference(data, new Date().toISOString())
      return service.snapshot()
    }),
  )
export const archivePreference = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().max(80) }).strict())
  .handler(({ data }) =>
    safe(() => {
      const service = getService()
      service.store.archivePreference(data.id)
      return service.snapshot()
    }),
  )
export const createTask = createServerFn({ method: 'POST' })
  .validator(taskInputSchema)
  .handler(({ data }) => safe(() => getService().createTask(data)))
export const setTaskStatus = createServerFn({ method: 'POST' })
  .validator(
    z
      .object({ id: z.string().max(80), status: z.enum(['todo', 'done']) })
      .strict(),
  )
  .handler(({ data }) =>
    safe(() => {
      const service = getService()
      service.store.setTaskStatus(data.id, data.status)
      return service.snapshot()
    }),
  )
