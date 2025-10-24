import type { Command } from "../types/history";

const commandRegistry = new Map<string, Command>();

export function registerCommand(command: Command): string {
  commandRegistry.set(command.id, command);
  return command.id;
}

export function getCommand(id: string): Command | undefined {
  return commandRegistry.get(id);
}

export function clearRegistry() {
  commandRegistry.clear();
}
