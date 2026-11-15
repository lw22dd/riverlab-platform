import { describe, expect, it } from 'vitest'
import { createActor } from 'xstate'
import { flowPhase, scenarioMachine } from './scenarioMachine'

function parallelValue(actor: ReturnType<typeof createActor<typeof scenarioMachine>>): Record<string, string> {
  const value = actor.getSnapshot().value
  if (value && typeof value === 'object' && 'live' in value) {
    return (value as { live: Record<string, string> }).live
  }
  return value as unknown as Record<string, string>
}

describe('presentation FSM', () => {
  it('runs parallel presentation regions and nested flow states', () => {
    const actor = createActor(scenarioMachine).start()
    expect(actor.getSnapshot().value).toBe('briefing')

    actor.send({ type: 'BEGIN' })
    expect(parallelValue(actor)).toMatchObject({
      flow: 'narrating',
      tempo: 'active',
      stage: 'settled',
      ambience: 'calm',
    })

    actor.send({ type: 'NODE', nodeId: 'decision-1', nodeType: 'decision' })
    expect(parallelValue(actor).flow).toBe('deciding')
    expect(actor.getSnapshot().context.decisionCount).toBe(1)
    expect(flowPhase(actor.getSnapshot().value).label).toBe('DECISION')

    actor.send({ type: 'CAMERA', mode: 'moving' })
    expect(parallelValue(actor).stage).toBe('moving')

    actor.send({ type: 'AMBIENCE', level: 'critical' })
    expect(parallelValue(actor).ambience).toBe('critical')

    actor.send({ type: 'PAUSE' })
    expect(parallelValue(actor).tempo).toBe('paused')
    actor.send({ type: 'RESUME' })
    expect(parallelValue(actor).tempo).toBe('active')

    actor.send({ type: 'NODE', nodeId: 'consequence-1', nodeType: 'consequence' })
    expect(parallelValue(actor).flow).toBe('resolving')

    actor.send({ type: 'FINISH' })
    expect(actor.getSnapshot().value).toBe('finished')
  })
})
