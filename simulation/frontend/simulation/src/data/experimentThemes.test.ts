import { describe, expect, it } from 'vitest'
import { experimentThemes } from './experimentThemes'
import { scenarioById } from './index'

describe('experiment theme catalog', () => {
  it('keeps theme ids and scene indices unique', () => {
    expect(new Set(experimentThemes.map((theme) => theme.id)).size).toBe(experimentThemes.length)
    expect(new Set(experimentThemes.map((theme) => theme.index)).size).toBe(experimentThemes.length)
  })

  it('links every runnable variant to a registered scenario', () => {
    for (const theme of experimentThemes) {
      for (const variant of theme.variants.filter((item) => item.status === 'ready')) {
        expect(variant.scenarioId, `${theme.id}/${variant.id} is missing scenarioId`).toBeTruthy()
        if (variant.scenarioId) {
          expect(scenarioById.has(variant.scenarioId), variant.scenarioId).toBe(true)
        }
      }
    }
  })

  it('keeps variant titles and subtitles unique inside a theme', () => {
    for (const theme of experimentThemes) {
      expect(new Set(theme.variants.map((variant) => variant.id)).size).toBe(theme.variants.length)
      expect(new Set(theme.variants.map((variant) => variant.title)).size).toBe(theme.variants.length)
    }
  })

  it('fills the narrative copy every card renders', () => {
    for (const theme of experimentThemes) {
      for (const field of [theme.summary, theme.description, theme.category]) {
        expect(field.length, theme.id).toBeGreaterThan(0)
      }
      for (const variant of theme.variants) {
        expect(variant.description, `${theme.id}/${variant.id}`).toBeTruthy()
        expect(variant.tags.length, `${theme.id}/${variant.id}`).toBeGreaterThan(0)
      }
      expect(theme.principles.every((item) => item.title && item.text), theme.id).toBe(true)
    }
  })

  it('registers the two core portal themes', () => {
    const ids = experimentThemes.map((theme) => theme.id)
    expect(ids).toContain('trolley')
    expect(ids).toContain('dujiangyan')
    expect(experimentThemes.some((theme) => theme.variants.some((variant) => variant.status === 'ready'))).toBe(true)
  })
})
