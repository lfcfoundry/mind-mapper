import { DOCUMENT_FORMAT, SCHEMA_VERSION } from "./schema.js";
import { validateDocument } from "./validate.js";

function defaultIdFactory() {
  const source = globalThis.crypto;
  if (source && typeof source.randomUUID === "function") {
    return source.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (source && typeof source.getRandomValues === "function") {
    source.getRandomValues(bytes);
  } else {
    throw new Error("Web Crypto is unavailable; provide an idFactory to createDocument");
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createDocument(options = {}) {
  const idFactory = options.idFactory ?? defaultIdFactory;
  if (typeof idFactory !== "function") {
    throw new TypeError("idFactory must be a function");
  }

  const id = options.id ?? idFactory();
  const rootId = options.rootId ?? idFactory();
  const document = {
    format: DOCUMENT_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    document: {
      id,
      title: options.title ?? "Untitled map",
      rootId,
      nodes: [{
        id: rootId,
        parentId: null,
        order: 0,
        label: options.rootLabel ?? "Central topic",
      }],
      relationships: [],
    },
  };

  const result = validateDocument(document);
  if (!result.valid) {
    const first = result.errors[0];
    throw new TypeError("Cannot create document: " + first.code + " at " + first.path);
  }
  return document;
}
