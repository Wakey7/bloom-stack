import test from "node:test";
import assert from "node:assert/strict";
import { SevenBag } from "../src/randomizer.js";
import { PIECE_TYPES } from "../src/pieces.js";

test("each seven-bag contains every piece exactly once", () => {
  const bag = new SevenBag(() => 0.37);
  const first = Array.from({ length: 7 }, () => bag.next()).sort();
  const second = Array.from({ length: 7 }, () => bag.next()).sort();

  assert.deepEqual(first, [...PIECE_TYPES].sort());
  assert.deepEqual(second, [...PIECE_TYPES].sort());
});
