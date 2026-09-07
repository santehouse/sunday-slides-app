/**
 * Entry point for the headless-page engine bundle. `scripts/build-engine-bundle.ts`
 * compiles this file (and its two zero-dependency imports) into a self-contained IIFE
 * that is injected into the server renderer's page as `window.__engine`.
 */
export { computeSlideLayout, fitText, layoutLines, parseStyledWords, wrapLines, wrapStyledLines } from "./engine";
export { createCanvasMeasurer, ensureFontsLoaded } from "./measure";
