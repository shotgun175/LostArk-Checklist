/*
 * Export your Lostark-helper data so LostArk-Checklist can import it.
 *
 * The easier way on a computer is the "Send to Lost Ark Checklist" bookmark on LostArk-Checklist's
 * Settings page (Bring data over): it runs the export-core part of this file in one click. This
 * file is the fallback; the "Copy script" button in Settings, How to export, copies it as is.
 *
 * How to use (Chrome, on the PC where you use lostark-helper.com):
 * 1. Open https://lostark-helper.com/checklist and wait until your checklist shows.
 *    (Opening the checklist first also brings the rest bonus up to date.)
 * 2. Press F12 and open the Console tab.
 * 3. Paste this whole file into the console and press Enter. If Chrome warns about pasting
 *    instead of running it, type: allow pasting, press Enter, then paste again and press Enter.
 * 4. Chrome downloads lostark-helper-export-<date>.json. On LostArk-Checklist, open Settings,
 *    "Bring data over", "Import from Lostark-helper", and pick that file.
 *
 * It reads only your own documents (roster, settings, completion, rest bonus, tasks) with your
 * own sign-in token, and talks only to the Google Firebase APIs that lostark-helper.com uses.
 */
(async () => {
  // BEGIN export-core
  // The Settings page of LostArk-Checklist builds its "Send to Lost Ark Checklist" bookmark from
  // this block, so the bookmark and this snippet read exactly the same data. Keep everything the
  // export needs inside it, use only "//" comments on their own lines, and keep collectExport().
  const PROJECT_ID = "lostark-helper-8dfb0";
  const DOCUMENTS = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

  // BEGIN fromFirestoreValue
  // Copied on purpose from apps/client/src/app/core/import/firestore-rest-value.ts: this snippet
  // must run standalone. export-snippet.spec.ts checks that both copies agree.
  function fromFirestoreValue(value) {
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

  function fromFirestoreFields(fields) {
    const result = {};
    Object.entries(fields).forEach(([key, value]) => {
      result[key] = fromFirestoreValue(value);
    });
    return result;
  }
  // END fromFirestoreValue

  function idbRequest(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function readSignedInUser() {
    const db = await idbRequest(indexedDB.open("firebaseLocalStorageDb"));
    try {
      if (!db.objectStoreNames.contains("firebaseLocalStorage")) {
        throw new Error("No Firebase sign-in data in this browser. Open https://lostark-helper.com in this tab, wait for it to load, then try again.");
      }
      const store = db.transaction("firebaseLocalStorage", "readonly").objectStore("firebaseLocalStorage");
      const records = await idbRequest(store.getAll());
      const record = records.find(r => typeof r.fbase_key === "string" && r.fbase_key.startsWith("firebase:authUser:"));
      if (!record) {
        throw new Error("No signed-in Firebase user found. Open https://lostark-helper.com in this tab, wait for it to load, then try again.");
      }
      const user = record.value;
      return {
        apiKey: record.fbase_key.split(":")[2],
        uid: user.uid,
        isAnonymous: user.isAnonymous,
        refreshToken: user.stsTokenManager.refreshToken
      };
    } finally {
      db.close();
    }
  }

  async function getIdToken(apiKey, refreshToken) {
    const response = await fetch(`https://securetoken.googleapis.com/v1/token?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken })
    });
    if (!response.ok) {
      throw new Error(`Token refresh failed: HTTP ${response.status} ${await response.text()}`);
    }
    return (await response.json()).id_token;
  }

  async function getDocument(path, idToken, required) {
    const response = await fetch(`${DOCUMENTS}/${path}`, { headers: { Authorization: `Bearer ${idToken}` } });
    if (response.status === 404) {
      if (required) {
        throw new Error(`${path} does not exist. Open the Roster and Settings pages on lostark-helper.com once, then try again.`);
      }
      console.warn(`${path} does not exist; it is exported as null.`);
      return null;
    }
    if (!response.ok) {
      throw new Error(`Reading ${path} failed: HTTP ${response.status} ${await response.text()}`);
    }
    return fromFirestoreFields((await response.json()).fields || {});
  }

  async function getTasks(uid, idToken) {
    const response = await fetch(`${DOCUMENTS}:runQuery`, {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "tasks" }],
          where: { fieldFilter: { field: { fieldPath: "authorId" }, op: "EQUAL", value: { stringValue: uid } } }
        }
      })
    });
    if (!response.ok) {
      throw new Error(`Reading tasks failed: HTTP ${response.status} ${await response.text()}`);
    }
    const rows = await response.json();
    return rows
      .filter(row => row.document)
      .map(row => ({
        ...fromFirestoreFields(row.document.fields || {}),
        $key: row.document.name.split("/").pop()
      }));
  }

  async function collectExport() {
    const user = await readSignedInUser();
    console.log(`Exporting the ${user.isAnonymous ? "anonymous" : "registered"} account ${user.uid}`);
    const idToken = await getIdToken(user.apiKey, user.refreshToken);
    const [roster, settings, completion, energy, tasks] = await Promise.all([
      getDocument(`roster/${user.uid}`, idToken, true),
      getDocument(`settings/${user.uid}`, idToken, true),
      getDocument(`completion/${user.uid}`, idToken, false),
      getDocument(`energy/${user.uid}`, idToken, false),
      getTasks(user.uid, idToken)
    ]);
    return { format: 1, exportedAt: new Date().toISOString(), sourceUid: user.uid, roster, settings, completion, energy, tasks };
  }
  // END export-core

  const data = await collectExport();
  const { exportedAt, roster, completion, tasks } = data;
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `lostark-helper-export-${exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  const characters = Array.isArray(roster.characters) ? roster.characters.length : 0;
  const entries = completion && completion.data ? Object.keys(completion.data).length : 0;
  console.log(`Export done: ${characters} characters, ${tasks.length} tasks, ${entries} completion entries.`);
})().catch(error => console.error("Export failed:", error));
