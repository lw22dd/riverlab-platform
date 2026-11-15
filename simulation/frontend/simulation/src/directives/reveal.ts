import type { Directive } from 'vue'

const observed = new WeakSet<HTMLElement>()
let observer: IntersectionObserver | null = null

function ensureObserver(): IntersectionObserver {
  if (observer) return observer
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const target = entry.target as HTMLElement
        target.classList.add('is-revealed')
        observer?.unobserve(target)
        observed.delete(target)
      }
    },
    { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
  )
  return observer
}

export const revealDirective: Directive<HTMLElement, number | undefined> = {
  mounted(element, binding) {
    element.classList.add('reveal')
    if (typeof binding.value === 'number' && binding.value > 0) {
      element.style.setProperty('--reveal-delay', `${binding.value}ms`)
    }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      element.classList.add('is-revealed')
      return
    }
    observed.add(element)
    ensureObserver().observe(element)
  },
  unmounted(element) {
    observer?.unobserve(element)
    observed.delete(element)
  },
}
