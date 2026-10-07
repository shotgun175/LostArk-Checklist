import { FirestoreRestValue, fromFirestoreFields, fromFirestoreValue } from "./firestore-rest-value";

describe("fromFirestoreValue", () => {
  it("converts nullValue", () => {
    expect(fromFirestoreValue({ nullValue: null })).toBeNull();
  });

  it("converts booleanValue", () => {
    expect(fromFirestoreValue({ booleanValue: false })).toBe(false);
    expect(fromFirestoreValue({ booleanValue: true })).toBe(true);
  });

  it("converts integerValue strings to numbers", () => {
    expect(fromFirestoreValue({ integerValue: "1696676400000" })).toBe(1696676400000);
    expect(fromFirestoreValue({ integerValue: "0" })).toBe(0);
    expect(fromFirestoreValue({ integerValue: "-3" })).toBe(-3);
  });

  it("converts doubleValue", () => {
    expect(fromFirestoreValue({ doubleValue: 1.5 })).toBe(1.5);
  });

  it("converts stringValue", () => {
    expect(fromFirestoreValue({ stringValue: "" })).toBe("");
    expect(fromFirestoreValue({ stringValue: "Chaos Dungeon" })).toBe("Chaos Dungeon");
  });

  it("keeps timestampValue as its ISO string", () => {
    expect(fromFirestoreValue({ timestampValue: "2026-10-07T10:00:00Z" })).toBe("2026-10-07T10:00:00Z");
  });

  it("converts an empty mapValue (no fields) to an empty object", () => {
    expect(fromFirestoreValue({ mapValue: {} })).toEqual({});
  });

  it("converts an empty arrayValue (no values) to an empty array", () => {
    expect(fromFirestoreValue({ arrayValue: {} })).toEqual([]);
  });

  it("converts nested maps and arrays", () => {
    const value: FirestoreRestValue = {
      mapValue: {
        fields: {
          characters: {
            arrayValue: {
              values: [
                { mapValue: { fields: { id: { integerValue: "123456789" }, name: { stringValue: "Alpha" }, lazy: { booleanValue: true } } } }
              ]
            }
          },
          trackedTasks: { mapValue: { fields: { "123456789:abc": { booleanValue: false } } } }
        }
      }
    };
    expect(fromFirestoreValue(value)).toEqual({
      characters: [{ id: 123456789, name: "Alpha", lazy: true }],
      trackedTasks: { "123456789:abc": false }
    });
  });

  it("throws on an unsupported value type", () => {
    const value = { geoPointValue: { latitude: 1, longitude: 2 } } as unknown as FirestoreRestValue;
    expect(() => fromFirestoreValue(value)).toThrow(/Unsupported Firestore value/);
  });
});

describe("fromFirestoreFields", () => {
  it("converts every field of a document", () => {
    expect(fromFirestoreFields({
      data: { mapValue: { fields: { "1:t1": { mapValue: { fields: { amount: { integerValue: "2" }, updated: { integerValue: "1696676400000" } } } } } } },
      updated: { integerValue: "1696676400000" }
    })).toEqual({
      data: { "1:t1": { amount: 2, updated: 1696676400000 } },
      updated: 1696676400000
    });
  });
});
