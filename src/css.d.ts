// TypeScript 7 reports TS2882 for a side-effect import with no declarations
// behind it, where 5.x said nothing. `src/main.tsx` imports the stylesheet for
// its side effect — Vite turns that into a <link> — so this declares the shape
// the compiler is asking for and nothing more.
//
// Deliberately not `/// <reference types="vite/client" />`, which is the usual
// answer: that pulls in the whole client-side ambient surface including
// `import.meta.env`, and nothing here uses it. `types: ["node"]` in
// tsconfig.json is an explicit choice about what ambient types exist, and this
// keeps it that way.
declare module "*.css";
