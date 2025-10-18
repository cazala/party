import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { Command } from "../types/history";
import { registerCommand } from "../history/registry";

export interface HistoryState {
  past: string[]; // command ids
  future: string[]; // command ids
  capacity: number;
  transaction: { label: string; commandIds: string[] } | null;
}

const initialState: HistoryState = {
  past: [],
  future: [],
  capacity: 100,
  transaction: null,
};

export const historySlice = createSlice({
  name: "history",
  initialState,
  reducers: {
    setCapacity: (state, action: PayloadAction<number>) => {
      state.capacity = Math.max(1, action.payload | 0);
      if (state.past.length > state.capacity) {
        state.past.splice(0, state.past.length - state.capacity);
      }
    },
    push: (state, action: PayloadAction<Command>) => {
      const id = registerCommand(action.payload);
      state.past.push(id);
      if (state.past.length > state.capacity) {
        state.past.shift();
      }
      state.future = [];
    },
    undoCommit: (state) => {
      if (state.past.length === 0) return;
      const id = state.past[state.past.length - 1];
      state.past.pop();
      state.future.push(id);
    },
    redoCommit: (state) => {
      if (state.future.length === 0) return;
      const id = state.future[state.future.length - 1];
      state.future.pop();
      state.past.push(id);
      if (state.past.length > state.capacity) {
        state.past.shift();
      }
    },
    clear: (state) => {
      state.past = [];
      state.future = [];
      state.transaction = null;
    },
    beginTransaction: (state, action: PayloadAction<string>) => {
      state.transaction = { label: action.payload, commandIds: [] };
    },
    appendToTransaction: (state, action: PayloadAction<Command>) => {
      if (!state.transaction) return;
      const id = registerCommand(action.payload);
      state.transaction.commandIds.push(id);
    },
    commitTransaction: (state) => {
      if (!state.transaction) return;
      const { label, commandIds } = state.transaction;
      if (commandIds.length === 0) {
        state.transaction = null;
        return;
      }
      const tx: Command = {
        id: crypto.randomUUID(),
        label,
        timestamp: Date.now(),
        // do/undo are executed from hook using ids; no closures stored in state
        do: () => {},
        undo: () => {},
      };
      // Attach child ids directly on same instance we register
      (tx as unknown as { __childIds: string[] }).__childIds =
        commandIds.slice();
      const txId = registerCommand(tx);
      state.past.push(txId);
      if (state.past.length > state.capacity) {
        state.past.shift();
      }
      state.future = [];
      state.transaction = null;
    },
    cancelTransaction: (state) => {
      state.transaction = null;
    },
  },
});

export const {
  setCapacity,
  push,
  undoCommit,
  redoCommit,
  clear,
  beginTransaction,
  appendToTransaction,
  commitTransaction,
  cancelTransaction,
} = historySlice.actions;

export const historyReducer = historySlice.reducer;

// Selectors
export const selectHistoryState = (state: { history: HistoryState }) =>
  state.history;
export const selectCanUndo = (state: { history: HistoryState }) =>
  state.history.past.length > 0;
export const selectCanRedo = (state: { history: HistoryState }) =>
  state.history.future.length > 0;
export const selectLastPast = (state: { history: HistoryState }) =>
  state.history.past[state.history.past.length - 1] ?? null;
export const selectNextFuture = (state: { history: HistoryState }) =>
  state.history.future[state.history.future.length - 1] ?? null;
export const selectTransaction = (state: { history: HistoryState }) =>
  state.history.transaction;
