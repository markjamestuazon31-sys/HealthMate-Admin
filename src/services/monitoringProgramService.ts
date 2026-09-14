import { get, onValue, ref, runTransaction } from "firebase/database";
import { auth, database } from "../firebase/config";
import { BUILTIN_MONITORING_PROGRAMS, mergeMonitoringPrograms, programNameKey, type MonitoringProgram } from "./monitoringPrograms";

const PATH = "monitoringPrograms";
export function listenMonitoringPrograms(callback: (programs: MonitoringProgram[]) => void, failed: (error: Error) => void) {
  return onValue(ref(database, PATH), snapshot => callback(mergeMonitoringPrograms(snapshot.val() || {})), failed);
}
export async function getMonitoringPrograms(): Promise<MonitoringProgram[]> {
  return mergeMonitoringPrograms((await get(ref(database, PATH))).val() || {});
}
export async function saveMonitoringProgram(input: MonitoringProgram, expectedVersion: number, operationId: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Sign in again before saving a program.");
  if (!input.id || !operationId || /[.#$\[\]/]/.test(input.id + operationId)) throw new Error("Invalid program identifier.");
  const name = input.name.trim().replace(/\s+/g, " "), category = input.category.trim();
  if (!name || name.length > 160 || !category || category.length > 100) throw new Error("Enter a program name and category within the field limits.");
  if (!["person", "household", "either"].includes(input.scope) || !["active", "archived"].includes(input.status)) throw new Error("Choose a valid scope and availability.");
  const now = Date.now();
  const result = await runTransaction(ref(database, PATH), raw => {
    if (raw === null && expectedVersion > 0) return null;
    const current = raw || {}, programs = mergeMonitoringPrograms(current);
    const existing = programs.find(p => p.id === input.id);
    const old = current[input.id];
    if (old?.history?.[operationId]?.by === uid) {
      const saved = old.history[operationId].after;
      if (saved.name === name && saved.category === category && saved.scope === input.scope && saved.status === input.status) return current;
      throw new Error("This save already completed with different details. Reopen the program to edit its saved version.");
    }
    if ((existing?.version || 0) !== expectedVersion) throw new Error("This program changed. Close the editor and reopen it.");
    const names = new Set([name, ...(existing?.aliases || []), ...(existing && existing.name !== name ? [existing.name] : [])].map(programNameKey));
    if (programs.some(p => p.id !== input.id && [p.name, ...(p.aliases || [])].some(n => names.has(programNameKey(n))))) throw new Error("This program name already exists. Edit the existing program instead.");
    const next: MonitoringProgram = { id: input.id, name, category, scope: input.scope, status: input.status,
      version: expectedVersion + 1, aliases: [...new Set([...(existing?.aliases || []), ...(existing && existing.name !== name ? [existing.name] : [])])], updatedAt: now, updatedBy: uid };
    return {...current, [input.id]: {...next, history: {...old?.history, [operationId]: {by: uid, at: now, before: existing || null, after: next}}}};
  }, {applyLocally: false});
  if (!result.committed || !result.snapshot.child(input.id).exists()) throw new Error("The program changed or was not saved. Reopen it and try again.");
}
export function isBuiltinProgram(id: string): boolean { return BUILTIN_MONITORING_PROGRAMS.some(p => p.id === id); }
