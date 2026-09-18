import test from "node:test";
import assert from "node:assert/strict";
import { ENCOUNTERS, getEncounter } from "../src/encounters.js";

test("encounter roadmap has five ordered stages with distinct signature skills", () => {
  assert.equal(ENCOUNTERS.length, 5);
  assert.deepEqual(ENCOUNTERS.map((encounter) => encounter.order), [1, 2, 3, 4, 5]);
  assert.equal(new Set(ENCOUNTERS.map((encounter) => encounter.signatureSkill)).size, 5);
});

test("the first encounter is playable and has a complete attack pattern", () => {
  const encounter = getEncounter("cairn-pass");
  assert.equal(encounter.status, "playable");
  assert.equal(encounter.bossHp, 90);
  assert.ok(encounter.pattern.length >= 4);
  assert.ok(encounter.pattern.every((intent) => intent.inPieces >= 3));
});

test("every configured stage can run its own intent loop", () => {
  assert.ok(ENCOUNTERS.every((encounter) => encounter.pattern?.length >= 2));
  assert.ok(ENCOUNTERS.slice(1).every((encounter) => encounter.status === "prototype"));
});

test("later stages use only their own signature pressure", () => {
  for (const encounter of ENCOUNTERS.slice(1)) {
    assert.deepEqual(
      new Set(encounter.pattern.map((intent) => intent.type)),
      new Set([encounter.signatureSkill]),
      encounter.id,
    );
  }
});

test("unknown encounters fail explicitly", () => {
  assert.throws(() => getEncounter("missing"), /Unknown encounter/);
});
