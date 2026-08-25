import { describe, expect, it } from "vitest";
import { parseHd1 } from "./hd1";

function parseNote(note: string) {
  const result = parseHd1(`HD1|20260825-1200|L|米饭~GR~CK~100-100g|蒸|${note}`);
  if (!result.ok) throw new Error(result.errors.join(" "));
  return result.value;
}

describe("HD1 unknown oil and salt hints", () => {
  it("识别油盐不详", () => {
    expect(parseNote("油盐不详")).toMatchObject({ unknownOil: true, unknownSalt: true });
  });

  it("识别没看清用油量", () => {
    expect(parseNote("没看清用油量").unknownOil).toBe(true);
  });

  it("识别盐未记录且不误报油", () => {
    expect(parseNote("盐未记录")).toMatchObject({ unknownOil: false, unknownSalt: true });
  });
});
