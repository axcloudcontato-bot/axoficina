import '@testing-library/jest-dom/vitest';

// jsdom não implementa ResizeObserver — necessário pro HeaderDock
// (react-use-measure) e qualquer outro componente que meça elementos.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
