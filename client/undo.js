import { redoTransaction, undoTransaction } from "./transaction.js";

// Undo logic 
//
//      There is one stack that holds the information of the user's actions
//          actions are using a tool to make a change to the canvas (resize, draw, previews)
//      
//          The resize + draw are fairly straight forward but the preview logic has some flexibility and some nuances
//
//

export default class Undo {
  constructor(transactionLog) {
    this.transactionLog = transactionLog;
    this.undoList = []; // stack of {id}|{draft,tool}|{id,draft,tool}
    this.redoList = [];

    document.addEventListener("keydown", (e) => {
      if (
        e.target.tagName === "INPUT" 
      ) {
        return; // ← canvas ignores this key
      }

      if (e.ctrlKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        this.undo();
      }
      if (e.ctrlKey && e.key.toLowerCase() === "y") {
        e.preventDefault();
        this.redo();
      }
    });
  }

  // ───── public helpers used by tools ───── 

  pushOperation(id) {
    // simple tools (pencil, fill…)
    this.undoList.push({ id });
    this.redoList.length = 0;
  }

  pushDraft(tool, draft) {
    // called when handles first appear
    this.undoList.push({ draft, tool });
    this.redoList.length = 0;
  }

  // called **once** inside StraightLine.commit()
      // to turn the live draft into a commit‑entry that
      // still keeps the draft + tool for re‑edit 
  replaceTopWithCommit(opId, toolRef, draft) {
    if (!this.undoList.length || !this.undoList.at(-1).draft) return;
    this.undoList[this.undoList.length - 1] = {
      id: opId,
      draft,
      tool: toolRef, // now the tool is saved
    };
    this.redoList.length = 0;
  }

  // ───── core logic ───── 

  undo() {
    const entry = this.undoList.pop();
    if (!entry) return;

    // 1️⃣ still editing → discard 
    if (entry.draft && entry.tool.isEditable) {
      entry.tool.discardDraft();
      this.redoList.push(entry);
      return;
    }

    // 2️⃣ committed stroke -> pixels off, return to edit 
    if (entry.draft) {
      this.transactionLog.pushClient(undoTransaction(entry.id));
      entry.tool.restoreDraft(entry.draft);
      // put a DRAFT entry back onto undoList
      this.undoList.push({ draft: entry.draft, tool: entry.tool });

      // keep the COMMIT entry on redoList so Ctrl + Y will re‑commit
      this.redoList.push(entry);
      return;
    }

    // 3️⃣ simple non‑draft op 
    if (entry.id !== undefined) {
      this.transactionLog.pushClient(undoTransaction(entry.id));
    }
    this.redoList.push(entry);
  }

  redo() {
    const entry = this.redoList.pop();
    if (!entry) return;

    // 1️⃣ redo deleted draft: bring back in edit mode 
    if (entry.draft && entry.tool.isEditable === false) {
      entry.tool.restoreDraft(entry.draft);
      this.undoList.push(entry);
      return;
    }

    if (entry.draft) {
      // 2a. pixels back on
      this.transactionLog.pushClient(redoTransaction(entry.id));

      // 2b. drop the draft copy that undo() left on top of undoList
      const last = this.undoList.at(-1);
      if (last && last.draft === entry.draft) this.undoList.pop();

      // 2c. hide the adjuster boxes
      entry.tool.discardDraft?.(); // guard if the helper exists

      // 2d. make it undo‑able again
      this.undoList.push(entry);
      return;
    }

    // 3️⃣ simple non‑draft op 
    this.transactionLog.pushClient(redoTransaction(entry.id));
    this.undoList.push(entry);
  }
}


//OLD1
/*

// import { transactionLog } from "./client.js";
import { redoTransaction, undoTransaction } from "./transaction.js";
export default class Undo {
  constructor(transactionLog) {
    this.transactionLog = transactionLog;
    this.undoList = [];
    this.redoList = [];

    document.addEventListener("keydown", (event) => {
      if (event.ctrlKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        this.undo();
      }

      if (event.ctrlKey && event.key.toLowerCase() === "y") {
        event.preventDefault();
        this.redo();
      }
    });

    document.getElementById("undo").addEventListener("click", this.undo);
    document.getElementById("redo").addEventListener("click", this.redo);
  }

  undo = () => {
    const operationId = this.undoList.pop();
    if (!operationId) return;

    if (operationId.draft) {
      operationId.tool.discardDraft();
      this.redoList.push(operationId);
      return;
    }

    this.transactionLog.pushClient(undoTransaction(operationId.id));
    this.redoList.push(operationId);
    console.log(`${this.undoList}`);
  };

  redo = () => {
    const operationId = this.redoList.pop();
    if (!operationId) return;

    if (operationId.draft) {
      operationId.tool.restoreDraft(operationId.draft);
      this.undoList.push(operationId);
      return;
    }

    this.transactionLog.pushClient(redoTransaction(operationId.id));
    this.undoList.push(operationId);
  };

  pushOperation(operationId) {
    this.undoList.push({ id: operationId });
    this.redoList.length = 0;
  }

  pushDraft(tool, draft) {
    this.undoList.push({ draft, tool });
    this.redoList.length = 0;
  }
}
*/