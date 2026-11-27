# Dujiangyan Construction Scene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the interactive Dujiangyan construction scene in the existing narrative around the supplied vector map.

**Architecture:** Keep the Stage handle and narrative state machine; separate map rings and scene-space frames from procedural structures and animation. Keep the source guide's planimetry distinct from illustrative elevations and flows.

**Tech Stack:** Vue, Three.js, TypeScript, GSAP, Vitest, Chromium.

---

- [ ] Add `simulation/frontend/simulation/src/three/scenes/dujiangyan-geography.test.ts` asserting XZ direction, named anchor registration, and that polygon triangulation preserves holes. Run `npm test -- dujiangyan-geography` and verify RED before implementing.
- [ ] Place the source map JSON in `simulation/frontend/simulation/src/assets/geography/dujiangyan_map.json`; in `simulation/frontend/simulation/src/three/scenes/dujiangyan-geography.ts`, use `toWorld([x,z]) => [x,-z]`, `THREE.Shape` with `THREE.Path` holes and `rotateX(-Math.PI/2)`. Define construction frames from named map anchors and use them to register the existing local geometry and effects. Use authored curves only for particle travel and areas beyond the supplied map.
- [ ] Port procedure models as `createGabion()`, `createMacha()`, `createFireBed()` and `createWeirGabionCourse()` in `simulation/frontend/simulation/src/three/scenes/dujiangyan-structures.ts`; cover size, orientation and components with tests. In `simulation/frontend/simulation/src/three/scenes/dujiangyan.ts`, replace the existing empty cage shell, simple tripods and bare fire cones; reuse existing heat, cracking, flow and cleanup lifecycle.
- [ ] Validate `npm test` and `npm run build`; exercise overview, carving, fishmouth, overflow, maintenance and reset in a browser with desktop and narrow canvas screenshots. Keep modern facilities out of the Qin scene and document that elevations, historical reconstructions and hydraulic behavior are schematic.
