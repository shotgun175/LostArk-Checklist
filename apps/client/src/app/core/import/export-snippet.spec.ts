import * as fs from "fs";
import * as path from "path";
import { FirestoreRestValue, fromFirestoreFields, fromFirestoreValue } from "./firestore-rest-value";

const SNIPPET_PATH = path.resolve(__dirname, "../../../../../../tools/export-from-lostark-helper.js");

function loadSnippetConverter(): { fromFirestoreValue: (value: unknown) => unknown; fromFirestoreFields: (fields: unknown) => unknown } {
  const source = fs.readFileSync(SNIPPET_PATH, "utf8");
  const match = /\/\/ BEGIN fromFirestoreValue[^\n]*\n([\s\S]*?)\/\/ END fromFirestoreValue/.exec(source);
  if (!match) {
    throw new Error("BEGIN/END fromFirestoreValue markers not found in the export snippet");
  }
  return new Function(`${match[1]}\nreturn { fromFirestoreValue, fromFirestoreFields };`)();
}

const SAMPLES: FirestoreRestValue[] = [
  { nullValue: null },
  { booleanValue: true },
  { integerValue: "1696676400000" },
  { doubleValue: 2.25 },
  { stringValue: "Guardian Raid" },
  { timestampValue: "2026-10-07T10:00:00Z" },
  { mapValue: {} },
  { arrayValue: {} },
  {
    mapValue: {
      fields: {
        daysFilter: { arrayValue: { values: [{ integerValue: "0" }, { integerValue: "6" }] } },
        nested: { mapValue: { fields: { flag: { booleanValue: false }, note: { nullValue: null } } } }
      }
    }
  }
];

describe("export snippet converter", () => {
  it("contains the marked converter block", () => {
    expect(() => loadSnippetConverter()).not.toThrow();
  });

  it("gives the same results as firestore-rest-value.ts", () => {
    const snippet = loadSnippetConverter();
    SAMPLES.forEach(sample => {
      expect(snippet.fromFirestoreValue(sample)).toEqual(fromFirestoreValue(sample));
    });
    const fields = { a: { integerValue: "5" }, b: { arrayValue: { values: [{ stringValue: "x" }] } } } as Record<string, FirestoreRestValue>;
    expect(snippet.fromFirestoreFields(fields)).toEqual(fromFirestoreFields(fields));
    expect(() => snippet.fromFirestoreValue({ geoPointValue: {} })).toThrow(/Unsupported Firestore value/);
  });
});
