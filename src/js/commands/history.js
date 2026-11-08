import { validateDocument } from "../model/validate.js";
import { setTrustHistoryActions, applyHistoryAction, cloneDocument, executeCommandForHistory } from "./commands.js";

function historyFailure(code, message) {
  return { ok: false, error: { code, message } };
}

function publicSuccess(document, changed) {
  return { ok: true, document: cloneDocument(document), changed };
}

/** Create a synchronous, in-memory command history around an immutable v1 document. */
export function createCommandHistory(initialDocument, options = {}) {
  const validation = validateDocument(initialDocument);
  if (!validation.valid) {
    throw new TypeError("Cannot create command history around an invalid document: " + validation.errors[0].code);
  }
  if (options.idFactory !== undefined && typeof options.idFactory !== "function") {
    throw new TypeError("idFactory must be a function");
  }

  let document = cloneDocument(initialDocument);
  const undoStack = [];
  const redoStack = [];
  const commandOptions = { ...(options.idFactory === undefined ? {} : { idFactory: options.idFactory }), ...(options.trustCandidate === true ? { trustCandidate: true } : {}) };

  return {
    get canUndo() {
      return undoStack.length > 0;
    },
    get canRedo() {
      return redoStack.length > 0;
    },
    getDocument() {
      return cloneDocument(document);
    },
    execute(command) {
      const result = executeCommandForHistory(document, command, commandOptions);
      if (!result.ok) return result;
      if (result.changed) {
        document = result.document;
        undoStack.push({ undoAction: result.undoAction, redoAction: result.redoAction });
        redoStack.length = 0;
      }
      return publicSuccess(document, result.changed);
    },
    undo() {
      if (undoStack.length === 0) return historyFailure("NOTHING_TO_UNDO", "There is no command to undo.");
      const entry = undoStack[undoStack.length - 1];
      setTrustHistoryActions(options.trustCandidate === true);
      const result = applyHistoryAction(document, entry.undoAction);
      if (!result.ok) return result;
      document = result.document;
      undoStack.pop();
      redoStack.push(entry);
      return publicSuccess(document, true);
    },
    redo() {
      if (redoStack.length === 0) return historyFailure("NOTHING_TO_REDO", "There is no command to redo.");
      const entry = redoStack[redoStack.length - 1];
      setTrustHistoryActions(options.trustCandidate === true);
      const result = applyHistoryAction(document, entry.redoAction);
      if (!result.ok) return result;
      document = result.document;
      redoStack.pop();
      undoStack.push(entry);
      return publicSuccess(document, true);
    },
  };
}
