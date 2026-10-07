// Checks the Firestore rules of loa-checklist, either as deployed or in the local emulators.
// It creates two throwaway anonymous users (A and B) through the Identity Toolkit REST API,
// exercises the rules through the Firestore REST API, prints PASS or FAIL per check, then
// deletes every document it created and both accounts. Exit code 1 means a check failed.
//
// Needs Node 18 or newer (global fetch). The repo pins Node 16, so run the system Node:
//   "/c/Program Files/nodejs/node.exe" tools/verify-firestore-rules.mjs              (deployed rules)
//   "/c/Program Files/nodejs/node.exe" tools/verify-firestore-rules.mjs --emulator   (local emulators)
// --emulator expects the Auth emulator on localhost:9099 and the Firestore emulator on
// localhost:8085 (see firebase.json), started with project id demo-loa-checklist.

const EMULATOR = process.argv.includes("--emulator");
const API_KEY = EMULATOR ? "any" : "AIzaSyA7C1ZNoySzCBu6OrjoWV2cp0X7Ru8x4QE";
const PROJECT_ID = EMULATOR ? "demo-loa-checklist" : "loa-checklist";
const IDENTITY = EMULATOR
  ? "http://localhost:9099/identitytoolkit.googleapis.com/v1"
  : "https://identitytoolkit.googleapis.com/v1";
const FIRESTORE = EMULATOR ? "http://localhost:8085/v1" : "https://firestore.googleapis.com/v1";
const DOCUMENTS = `${FIRESTORE}/projects/${PROJECT_ID}/databases/(default)/documents`;
const UID_COLLECTIONS = ["roster", "settings", "completion", "energy", "users"];
const DENIED = [403];
const DENIED_SIGNED_OUT = [401, 403];

let failures = 0;

function report(name, pass, detail) {
  if (!pass) {
    failures++;
  }
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${pass ? "" : `  (${detail})`}`);
}

async function signUpAnonymous() {
  const response = await fetch(`${IDENTITY}/accounts:signUp?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ returnSecureToken: true })
  });
  if (!response.ok) {
    throw new Error(`Anonymous sign-up failed: HTTP ${response.status} ${await response.text()}`);
  }
  const json = await response.json();
  return { uid: json.localId, idToken: json.idToken };
}

async function deleteAccount(user) {
  const response = await fetch(`${IDENTITY}/accounts:delete?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: user.idToken })
  });
  if (!response.ok) {
    console.warn(`WARN  could not delete test account ${user.uid}: HTTP ${response.status}`);
  }
}

function toValue(value) {
  if (value === null) {
    return { nullValue: null };
  }
  if (typeof value === "boolean") {
    return { booleanValue: value };
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === "string") {
    return { stringValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toValue) } };
  }
  return { mapValue: { fields: toFields(value) } };
}

function toFields(object) {
  return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, toValue(value)]));
}

async function request(user, method, url, body) {
  const headers = {};
  if (user) {
    headers.Authorization = `Bearer ${user.idToken}`;
  }
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { status: response.status, text: await response.text() };
}

const readDoc = (user, path) => request(user, "GET", `${DOCUMENTS}/${path}`);
const writeDoc = (user, path, data) => request(user, "PATCH", `${DOCUMENTS}/${path}`, { fields: toFields(data) });
const deleteDoc = (user, path) => request(user, "DELETE", `${DOCUMENTS}/${path}`);
const queryTasks = (user, authorId) => request(user, "POST", `${DOCUMENTS}:runQuery`, {
  structuredQuery: {
    from: [{ collectionId: "tasks" }],
    ...(authorId === undefined ? {} : {
      where: { fieldFilter: { field: { fieldPath: "authorId" }, op: "EQUAL", value: { stringValue: authorId } } }
    })
  }
});

async function expectStatus(name, responsePromise, expected) {
  const { status, text } = await responsePromise;
  report(name, expected.includes(status), `HTTP ${status}, expected ${expected.join(" or ")}: ${text.slice(0, 200)}`);
  return status;
}

async function expectQuery(name, responsePromise, allowed) {
  const { status, text } = await responsePromise;
  const denied = status === 403 || text.includes("PERMISSION_DENIED");
  report(name, allowed ? status === 200 && !denied : denied, `HTTP ${status}: ${text.slice(0, 200)}`);
}

const cleanup = [];
let a;
let b;

try {
  a = await signUpAnonymous();
  b = await signUpAnonymous();
  console.log(`Project: ${PROJECT_ID}${EMULATOR ? " (emulator)" : ""}`);
  console.log(`Test users: A=${a.uid} B=${b.uid}`);

  for (const name of UID_COLLECTIONS) {
    const path = `${name}/${a.uid}`;
    if (await expectStatus(`A creates ${name}/{A}`, writeDoc(a, path, { check: "rules", owner: a.uid }), [200]) === 200) {
      cleanup.push({ user: a, path });
    }
    await expectStatus(`A reads ${name}/{A}`, readDoc(a, path), [200]);
    await expectStatus(`B cannot read ${name}/{A}`, readDoc(b, path), DENIED);
    await expectStatus(`B cannot write ${name}/{A}`, writeDoc(b, path, { check: "intruder" }), DENIED);
    await expectStatus(`B cannot delete ${name}/{A}`, deleteDoc(b, path), DENIED);
    await expectStatus(`Signed-out caller cannot read ${name}/{A}`, readDoc(null, path), DENIED_SIGNED_OUT);
  }

  const taskId = `rules-check-${Date.now()}`;
  const taskPath = `tasks/${taskId}`;
  if (await expectStatus("A creates tasks/{id} with authorId A", writeDoc(a, taskPath, { authorId: a.uid, label: "Rules check" }), [200]) === 200) {
    cleanup.push({ user: a, path: taskPath });
  }
  await expectStatus("A reads its task", readDoc(a, taskPath), [200]);
  await expectStatus("A updates its task keeping authorId A", writeDoc(a, taskPath, { authorId: a.uid, label: "Rules check 2" }), [200]);
  await expectQuery("A queries tasks where authorId == A", queryTasks(a, a.uid), true);
  await expectQuery("A cannot query tasks without the authorId filter", queryTasks(a), false);
  await expectQuery("B cannot query tasks where authorId == A", queryTasks(b, a.uid), false);
  await expectStatus("B cannot read A's task", readDoc(b, taskPath), DENIED);
  await expectStatus("B cannot update A's task", writeDoc(b, taskPath, { authorId: a.uid, label: "Hijacked" }), DENIED);
  await expectStatus("B cannot take over A's task", writeDoc(b, taskPath, { authorId: b.uid, label: "Hijacked" }), DENIED);
  await expectStatus("B cannot delete A's task", deleteDoc(b, taskPath), DENIED);
  if (await expectStatus("B cannot create a task with authorId A", writeDoc(b, `${taskPath}-b`, { authorId: a.uid, label: "Forged" }), DENIED) === 200) {
    cleanup.push({ user: a, path: `${taskPath}-b` });
  }
  if (await expectStatus("A cannot create a task with authorId B", writeDoc(a, `${taskPath}-a`, { authorId: b.uid, label: "Gift" }), DENIED) === 200) {
    cleanup.push({ user: b, path: `${taskPath}-a` });
  }
  if (await expectStatus("A cannot reassign its task to B", writeDoc(a, taskPath, { authorId: b.uid, label: "Rules check" }), DENIED) === 200) {
    cleanup.push({ user: b, path: taskPath });
  }

  if (await expectStatus("A cannot write gearsets/{A} (unknown collection)", writeDoc(a, `gearsets/${a.uid}`, { check: "rules" }), DENIED) === 200) {
    console.warn(`WARN  gearsets/${a.uid} was created and cannot be removed by this script; delete it in the Firebase console`);
  }
  await expectStatus("A cannot read gearsets/{A} (unknown collection)", readDoc(a, `gearsets/${a.uid}`), DENIED);
} catch (error) {
  failures++;
  console.error(`FAIL  ${error.message}`);
} finally {
  for (const { user, path } of cleanup.reverse()) {
    const { status } = await deleteDoc(user, path);
    if (status !== 200) {
      console.warn(`WARN  cleanup of ${path} returned HTTP ${status}`);
    }
  }
  if (a) {
    await deleteAccount(a);
  }
  if (b) {
    await deleteAccount(b);
  }
}

console.log(failures === 0 ? "All rules checks passed." : `${failures} rules check(s) failed.`);
process.exitCode = failures === 0 ? 0 : 1;
