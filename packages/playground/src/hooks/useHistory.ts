import { useCallback, useMemo } from "react";
import { useAppDispatch } from "./useAppDispatch";
import { useAppSelector } from "./useAppSelector";
import {
  appendToTransaction,
  beginTransaction,
  commitTransaction,
  cancelTransaction as cancelTransactionAction,
  redoCommit,
  startRedo,
  endRedo,
  selectCanRedo,
  selectCanUndo,
  selectLastPast,
  selectNextFuture,
  selectTransaction,
  undoCommit,
  push,
  startUndo,
  endUndo,
  selectHistoryState,
} from "../slices/history";
import type { Command, HistoryContext } from "../types/history";
import { useEngine } from "./useEngine";
import { getCommand } from "../history/registry";
import { clear as clearHistory } from "../slices/history";
import { clearRegistry as clearHistoryRegistry } from "../history/registry";

export function useHistory() {
  const dispatch = useAppDispatch();
  const { isUndoing, isRedoing } = useAppSelector(selectHistoryState);
  const canUndo = useAppSelector(selectCanUndo);
  const canRedo = useAppSelector(selectCanRedo);
  const lastPast = useAppSelector(selectLastPast);
  const nextFuture = useAppSelector(selectNextFuture);
  const transaction = useAppSelector(selectTransaction);
  const { engine, joints, lines } = useEngine();

  const ctx: HistoryContext = useMemo(
    () => ({ engine, joints, lines }),
    [engine, joints, lines]
  );

  const executeCommand = useCallback(
    async (command: Command) => {
      const maybePromise = command.do(ctx) as unknown;
      if (
        maybePromise &&
        typeof (maybePromise as Promise<unknown>).then === "function"
      ) {
        await (maybePromise as Promise<unknown>);
      }
      dispatch(push(command));
    },
    [dispatch, ctx]
  );

  const undo = useCallback(async () => {
    if (isUndoing || isRedoing) return;
    if (!lastPast) return;
    const cmd = getCommand(lastPast);
    if (!cmd) return;
    dispatch(startUndo());
    const childIds = (cmd as unknown as { __childIds?: string[] }).__childIds;
    if (Array.isArray(childIds) && childIds.length) {
      for (let i = childIds.length - 1; i >= 0; i--) {
        const sub = getCommand(childIds[i]);
        if (!sub) continue;
        const r = sub.undo(ctx) as unknown;
        if (r && typeof (r as Promise<unknown>).then === "function") {
          await (r as Promise<unknown>);
        }
      }
    } else {
      const r = cmd.undo(ctx) as unknown;
      if (r && typeof (r as Promise<unknown>).then === "function") {
        await (r as Promise<unknown>);
      }
    }
    dispatch(undoCommit());
    dispatch(endUndo());
  }, [dispatch, lastPast, ctx, isUndoing, isRedoing]);

  const redo = useCallback(async () => {
    if (isRedoing || isUndoing) return;
    if (!nextFuture) return;
    const cmd = getCommand(nextFuture);
    if (!cmd) return;
    dispatch(startRedo());
    const childIds = (cmd as unknown as { __childIds?: string[] }).__childIds;
    if (Array.isArray(childIds) && childIds.length) {
      for (let i = 0; i < childIds.length; i++) {
        const sub = getCommand(childIds[i]);
        if (!sub) continue;
        const r = sub.do(ctx) as unknown;
        if (r && typeof (r as Promise<unknown>).then === "function") {
          await (r as Promise<unknown>);
        }
      }
    } else {
      const r = cmd.do(ctx) as unknown;
      if (r && typeof (r as Promise<unknown>).then === "function") {
        await (r as Promise<unknown>);
      }
    }
    dispatch(redoCommit());
    dispatch(endRedo());
  }, [dispatch, nextFuture, ctx, isRedoing, isUndoing]);

  const begin = useCallback(
    (label: string) => {
      dispatch(beginTransaction(label));
    },
    [dispatch]
  );

  const append = useCallback(
    (cmd: Command) => {
      // Execute immediate side effect so user sees live changes
      cmd.do(ctx);
      dispatch(appendToTransaction(cmd));
    },
    [dispatch, ctx]
  );

  const commit = useCallback(() => {
    if (!transaction) return;
    dispatch(commitTransaction());
  }, [dispatch, transaction]);

  const cancel = useCallback(() => {
    dispatch(cancelTransactionAction());
  }, [dispatch]);

  const resetHistory = useCallback(() => {
    dispatch(clearHistory());
    clearHistoryRegistry();
  }, [dispatch]);

  return {
    canUndo,
    canRedo,
    undo,
    redo,
    beginTransaction: begin,
    appendToTransaction: append,
    commitTransaction: commit,
    cancelTransaction: cancel,
    executeCommand,
    resetHistory,
  };
}
