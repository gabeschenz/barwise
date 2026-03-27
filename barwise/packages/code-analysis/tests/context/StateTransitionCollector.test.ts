/**
 * Tests for the StateTransitionCollector.
 *
 * Verifies extraction of state transition patterns from TypeScript source code.
 */
import { describe, expect, it } from "vitest";
import { collectStateTransitions } from "../../src/context/StateTransitionCollector.js";

describe("collectStateTransitions", () => {
  it("extracts switch on status field with string cases", () => {
    const source = `
function handleStatus(status: string) {
  switch (status) {
    case "pending":
      return process();
    case "active":
      return activate();
    case "completed":
      return complete();
  }
}`;
    const transitions = collectStateTransitions(source, "handler.ts");

    expect(transitions).toHaveLength(1);
    expect(transitions[0]!.stateField).toBe("status");
    expect(transitions[0]!.filePath).toBe("handler.ts");
  });

  it("extracts switch on object.state field", () => {
    const source = `
function processOrder(order: Order) {
  switch (order.state) {
    case "draft":
      return;
    case "submitted":
      return submit();
    case "fulfilled":
      return fulfill();
  }
}`;
    const transitions = collectStateTransitions(source, "order.ts");

    expect(transitions).toHaveLength(1);
    expect(transitions[0]!.stateField).toBe("state");
  });

  it("extracts switch on phase field", () => {
    const source = `
function handlePhase(phase: string) {
  switch (phase) {
    case "init": break;
    case "running": break;
    case "done": break;
  }
}`;
    const transitions = collectStateTransitions(source, "phases.ts");

    expect(transitions).toHaveLength(1);
    expect(transitions[0]!.stateField).toBe("phase");
  });

  it("ignores switch on non-state fields", () => {
    const source = `
function handleAction(action: string) {
  switch (action) {
    case "click": break;
    case "hover": break;
  }
}`;
    const transitions = collectStateTransitions(source, "actions.ts");

    // "action" doesn't match state field patterns
    expect(transitions).toHaveLength(0);
  });

  it("extracts transition pairs", () => {
    const source = `
function updateStatus(status: string) {
  switch (status) {
    case "new":
      return "processing";
    case "processing":
      return "shipped";
    case "shipped":
      return "delivered";
  }
}`;
    const transitions = collectStateTransitions(source, "status.ts");

    expect(transitions).toHaveLength(1);
    expect(transitions[0]!.transitions).toBeDefined();
    expect(transitions[0]!.transitions!.length).toBe(2);
  });

  it("returns empty for files without state transitions", () => {
    const source = `
function add(a: number, b: number): number {
  return a + b;
}`;
    const transitions = collectStateTransitions(source, "math.ts");

    expect(transitions).toHaveLength(0);
  });

  it("tracks line numbers", () => {
    const source = `// line 1
// line 2
// line 3
function handleMode(mode: string) {
  switch (mode) {
    case "light": break;
    case "dark": break;
  }
}`;
    const transitions = collectStateTransitions(source, "theme.ts");

    expect(transitions).toHaveLength(1);
    expect(transitions[0]!.startLine).toBeGreaterThanOrEqual(4);
  });
});
