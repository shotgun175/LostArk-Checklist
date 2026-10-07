/**
 * Typed values as returned by the Firestore REST API (documents.get and :runQuery).
 *
 * tools/export-from-lostark-helper.js carries a copy of fromFirestoreValue and
 * fromFirestoreFields on purpose: the snippet has to run standalone in the DevTools console.
 * export-snippet.spec.ts checks that both copies give the same results.
 */
export type FirestoreRestValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number | string }
  | { stringValue: string }
  | { timestampValue: string }
  | { mapValue: { fields?: Record<string, FirestoreRestValue> } }
  | { arrayValue: { values?: FirestoreRestValue[] } };

export function fromFirestoreValue(value: FirestoreRestValue): unknown {
  if ("nullValue" in value) {
    return null;
  }
  if ("booleanValue" in value) {
    return value.booleanValue;
  }
  if ("integerValue" in value) {
    return Number(value.integerValue);
  }
  if ("doubleValue" in value) {
    return Number(value.doubleValue);
  }
  if ("stringValue" in value) {
    return value.stringValue;
  }
  if ("timestampValue" in value) {
    return value.timestampValue;
  }
  if ("mapValue" in value) {
    return fromFirestoreFields(value.mapValue.fields || {});
  }
  if ("arrayValue" in value) {
    return (value.arrayValue.values || []).map(fromFirestoreValue);
  }
  throw new Error(`Unsupported Firestore value: ${JSON.stringify(value)}`);
}

export function fromFirestoreFields(fields: Record<string, FirestoreRestValue>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  Object.entries(fields).forEach(([key, value]) => {
    result[key] = fromFirestoreValue(value);
  });
  return result;
}
