import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PROFILE_KEY,
  validateProfile,
  readProfile,
  saveProfile,
  clearProfile,
} from "../public/profile.js";

test("profile stores only a bounded nickname and optional role", () => {
  const data = new Map();
  const storage = {
    getItem: (key) => data.get(key),
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
  const profile = saveProfile(storage, {
    name: "  Phoenix  ",
    role: "Learner",
    phone: "ignored",
    token: "ignored",
  });
  assert.deepEqual(profile, { name: "Phoenix", role: "Learner" });
  assert.deepEqual(readProfile(storage), profile);
  assert.deepEqual(Object.keys(JSON.parse(data.get(PROFILE_KEY))), [
    "name",
    "role",
  ]);
  clearProfile(storage);
  assert.equal(readProfile(storage), null);
});

test("invalid names and roles are refused and corrupt stored profiles are ignored", () => {
  for (const value of [
    null,
    { name: " " },
    { name: "a".repeat(41) },
    { name: "A\nB" },
    { name: "A\u202eB" },
    { name: "Phoenix", role: "Admin" },
  ])
    assert.throws(() => validateProfile(value));
  assert.deepEqual(validateProfile({ name: "Ayọ̀" }), { name: "Ayọ̀", role: "" });
  for (const raw of ["{", "null", '{"name":"","role":"Teacher"}'])
    assert.equal(readProfile({ getItem: () => raw }), null);
});
