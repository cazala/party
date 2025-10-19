import type { Engine, Joints, Lines } from "@cazala/party";

export interface HistoryContext {
  engine: Engine | null;
  joints?: Joints | null;
  lines?: Lines | null;
  // Extend later with selectors and registries as needed
}

export interface Command {
  id: string;
  label: string;
  timestamp: number;
  do(ctx: HistoryContext): void | Promise<void>;
  undo(ctx: HistoryContext): void | Promise<void>;
  tryMergeWith?(next: Command): Command | null;
}

export class TransactionCommand implements Command {
  id: string;
  label: string;
  timestamp: number;
  private readonly commands: Command[];

  constructor(
    label: string,
    commands: Command[],
    id?: string,
    timestamp?: number
  ) {
    this.id = id ?? crypto.randomUUID();
    this.label = label;
    this.timestamp = timestamp ?? Date.now();
    this.commands = commands.slice();
  }

  do(ctx: HistoryContext): void {
    for (const cmd of this.commands) {
      cmd.do(ctx);
    }
  }

  undo(ctx: HistoryContext): void {
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo(ctx);
    }
  }

  tryMergeWith(_next: Command): Command | null {
    // By default, transactions don't merge across boundaries
    return null;
  }
}
