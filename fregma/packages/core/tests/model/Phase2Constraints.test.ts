import { describe, it, expect } from "vitest";
import {
  isDisjunctiveMandatory,
  isExclusion,
  isExclusiveOr,
  isSubset,
  isEquality,
  isRing,
  isFrequency,
} from "../../src/model/Constraint.js";
import type {
  DisjunctiveMandatoryConstraint,
  ExclusionConstraint,
  ExclusiveOrConstraint,
  SubsetConstraint,
  EqualityConstraint,
  RingConstraint,
  FrequencyConstraint,
  Constraint,
} from "../../src/model/Constraint.js";

describe("Phase 2 Constraint types", () => {
  it("creates a disjunctive mandatory constraint", () => {
    const c: DisjunctiveMandatoryConstraint = {
      type: "disjunctive_mandatory",
      roleIds: ["r1", "r2"],
    };
    expect(c.type).toBe("disjunctive_mandatory");
    expect(c.roleIds).toEqual(["r1", "r2"]);
  });

  it("creates an exclusion constraint", () => {
    const c: ExclusionConstraint = {
      type: "exclusion",
      roleIds: ["r1", "r2"],
    };
    expect(c.type).toBe("exclusion");
  });

  it("creates an exclusive-or constraint", () => {
    const c: ExclusiveOrConstraint = {
      type: "exclusive_or",
      roleIds: ["r1", "r2"],
    };
    expect(c.type).toBe("exclusive_or");
  });

  it("creates a subset constraint", () => {
    const c: SubsetConstraint = {
      type: "subset",
      subsetRoleIds: ["r1"],
      supersetRoleIds: ["r2"],
    };
    expect(c.type).toBe("subset");
    expect(c.subsetRoleIds).toEqual(["r1"]);
    expect(c.supersetRoleIds).toEqual(["r2"]);
  });

  it("creates an equality constraint", () => {
    const c: EqualityConstraint = {
      type: "equality",
      roleIds1: ["r1"],
      roleIds2: ["r2"],
    };
    expect(c.type).toBe("equality");
  });

  it("creates a ring constraint", () => {
    const c: RingConstraint = {
      type: "ring",
      roleId1: "r1",
      roleId2: "r2",
      ringType: "irreflexive",
    };
    expect(c.type).toBe("ring");
    expect(c.ringType).toBe("irreflexive");
  });

  it("creates a frequency constraint", () => {
    const c: FrequencyConstraint = {
      type: "frequency",
      roleId: "r1",
      min: 2,
      max: 5,
    };
    expect(c.type).toBe("frequency");
    expect(c.min).toBe(2);
    expect(c.max).toBe(5);
  });

  it("supports unbounded frequency", () => {
    const c: FrequencyConstraint = {
      type: "frequency",
      roleId: "r1",
      min: 1,
      max: "unbounded",
    };
    expect(c.max).toBe("unbounded");
  });
});

describe("Phase 2 type guards", () => {
  it("isDisjunctiveMandatory identifies correctly", () => {
    const c: Constraint = { type: "disjunctive_mandatory", roleIds: ["r1", "r2"] };
    expect(isDisjunctiveMandatory(c)).toBe(true);
    expect(isExclusion(c)).toBe(false);
  });

  it("isExclusion identifies correctly", () => {
    const c: Constraint = { type: "exclusion", roleIds: ["r1", "r2"] };
    expect(isExclusion(c)).toBe(true);
    expect(isDisjunctiveMandatory(c)).toBe(false);
  });

  it("isExclusiveOr identifies correctly", () => {
    const c: Constraint = { type: "exclusive_or", roleIds: ["r1", "r2"] };
    expect(isExclusiveOr(c)).toBe(true);
  });

  it("isSubset identifies correctly", () => {
    const c: Constraint = { type: "subset", subsetRoleIds: ["r1"], supersetRoleIds: ["r2"] };
    expect(isSubset(c)).toBe(true);
  });

  it("isEquality identifies correctly", () => {
    const c: Constraint = { type: "equality", roleIds1: ["r1"], roleIds2: ["r2"] };
    expect(isEquality(c)).toBe(true);
  });

  it("isRing identifies correctly", () => {
    const c: Constraint = { type: "ring", roleId1: "r1", roleId2: "r2", ringType: "asymmetric" };
    expect(isRing(c)).toBe(true);
  });

  it("isFrequency identifies correctly", () => {
    const c: Constraint = { type: "frequency", roleId: "r1", min: 1, max: 3 };
    expect(isFrequency(c)).toBe(true);
  });
});
