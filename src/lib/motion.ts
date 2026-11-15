// Fluid-interface maths (Apple "Designing Fluid Interfaces"). Pure functions; springs are Motion's duration/bounce form:
// damping 1.0 -> bounce 0 (default UI), damping ~0.82 -> bounce ~0.18 (only after a flick or throw).
export const UI_SPRING = { type: "spring", duration: 0.35, bounce: 0 } as const;
export const MOMENTUM_SPRING = { type: "spring", duration: 0.32, bounce: 0.18 } as const;

/** Where a gesture at velocity v (px/s) would come to rest. Pick the snap point nearest this, not the release point. */
export const project = (v: number, rate = 0.998) => ((v / 1000) * rate) / (1 - rate);

/** Progressive resistance past an edge: the further out, the less the element follows. */
export const rubberband = (overshoot: number, dim: number, c = 0.55) => (overshoot * dim * c) / (dim + c * Math.abs(overshoot));
