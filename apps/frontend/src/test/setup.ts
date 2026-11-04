import "@testing-library/jest-dom/vitest";

// jsdom has no ResizeObserver, but every Radix popper-based component
// (tooltip, popover, select) uses one to track its trigger.
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
