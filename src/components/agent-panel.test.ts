// @vitest-environment jsdom
import { createElement, useState } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AgentPanel } from './agent-panel'
import { defaultSettings } from '../domain/contracts'
import type { Snapshot } from '../domain/contracts'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
const snapshot: Snapshot = {
  settings: defaultSettings,
  settingsRevision: 1,
  events: [],
  tasks: [],
  preferences: [],
  proposals: [],
  messages: [],
  modelConfigured: true,
}
afterEach(cleanup)

describe('draft text during a pending response', () => {
  for (const edit of [false, true]) {
    it(
      edit
        ? 'preserves a new draft typed while the response is pending'
        : 'clears the submitted text when it has not been edited',
      async () => {
        Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
          configurable: true,
          value: vi.fn(),
        })
        let finish!: (value: boolean) => void
        const response = new Promise<boolean>((resolve) => {
          finish = resolve
        })
        const onSend = vi.fn(() => response)
        function Harness() {
          const [draft, setDraft] = useState('First request')
          return createElement(AgentPanel, {
            state: snapshot,
            busy: false,
            onSend,
            onResolve: async () => false,
            selectedTaskId: null,
            clearTask: () => {},
            prompt: null,
            draft,
            setDraft,
            onPromptApplied: () => {},
          })
        }
        render(createElement(Harness))
        const input = screen.getByRole<HTMLTextAreaElement>('textbox')
        fireEvent.click(screen.getByRole('button', { name: 'agent.send' }))
        expect(onSend).toHaveBeenCalledWith('First request', true)
        if (edit)
          fireEvent.change(input, {
            target: { value: 'Next request in progress' },
          })
        await act(async () => {
          finish(true)
          await response
        })
        expect(input.value).toBe(edit ? 'Next request in progress' : '')
      },
    )
  }
})
