export const PROFILE_KEY = "outsideclass-profile-v1";
const roles = ["", "Learner", "Teacher", "Parent"];

export function validateProfile(value) {
  if (!value || typeof value.name !== "string")
    throw new Error("Choose a first name or nickname.");
  const name = value.name.trim().normalize("NFC");
  if (!name || name.length > 40)
    throw new Error("Use a first name or nickname of up to 40 characters.");
  if (/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(name))
    throw new Error("Use a name without control characters.");
  const role = value.role ?? "";
  if (!roles.includes(role)) throw new Error("Choose one of the listed roles.");
  return { name, role };
}

export function readProfile(storage) {
  const raw = storage.getItem(PROFILE_KEY);
  if (!raw) return null;
  try {
    return validateProfile(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveProfile(storage, value) {
  const profile = validateProfile(value);
  try {
    storage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    throw new Error(
      "Your browser could not save this profile. Your previous profile is kept.",
    );
  }
  return profile;
}

export function clearProfile(storage) {
  storage.removeItem(PROFILE_KEY);
}
