const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const normalizeMedicationSchedule = (
  raw: Record<string, unknown>,
): Record<string, unknown> => {
  const out: Record<string, unknown> = { ...raw };
  const slots = out.slots;
  if (Array.isArray(slots) && slots.length > 0) {
    const collected: string[] = [];
    for (const s of slots) {
      if (s && typeof s === "object" && "time" in s) {
        const t = (s as { time: unknown }).time;
        if (typeof t === "string" && TIME_RE.test(t)) collected.push(t);
      }
    }
    out.times = [...new Set(collected)].sort();
  } else if (Array.isArray(out.times)) {
    const arr = out.times.filter(
      (t): t is string => typeof t === "string" && TIME_RE.test(t),
    );
    out.times = [...new Set(arr)].sort();
  }
  return out;
};
