import { get, ref, runTransaction } from "firebase/database";
import { auth, database } from "../firebase/config";
import type { Household } from "../types";
import { personLocation, type RegistryInhabitant } from "./inhabitantModel";
import { blankActivity, cleanDetails, details, duplicateMonitoringCase, makeActivity, validateCase, type CaseInput, type MonitoringCase, type PersonSnapshot } from "./monitoringModel";
import { getMonitoringPrograms } from "./monitoringProgramService";
import { programForName, supportsScope } from "./monitoringPrograms";

export interface EnrollmentEntry { id: string; input: CaseInput }
function validKey(id: string): boolean { return Boolean(id) && !/[.#$\[\]/\u0000-\u001f\u007f]/.test(id); }

/** Validates every entry, then commits the entire registration in one transaction. */
export async function createMonitoringEnrollment(entries: EnrollmentEntry[], householdId: string): Promise<string[]> {
  const actor = auth.currentUser;
  if (!actor) throw new Error("Your session expired. Sign in again.");
  if (!validKey(householdId) || !entries.length || entries.length > 100) throw new Error("Select a household and between 1 and 100 monitoring cases.");
  if (new Set(entries.map(e => e.id)).size !== entries.length || entries.some(e => !validKey(e.id))) throw new Error("Reopen the form to prepare unique record identifiers.");
  const [householdSnap, programs] = await Promise.all([get(ref(database, `households/${householdId}`)), getMonitoringPrograms()]);
  const household = householdSnap.val() as Household | null;
  if (!household || household.status !== "active") throw new Error("This household is no longer active. Update the masterlist first.");
  const ids = [...new Set(entries.flatMap(e => e.input.scope === "household" ? e.input.participantIds || [] : [e.input.inhabitantId]))];
  if (!ids.length || ids.some(id => !validKey(id))) throw new Error("Select the members covered by this registration.");
  const people = new Map<string, RegistryInhabitant>();
  await Promise.all(ids.map(async id => {
    const person = (await get(ref(database, `inhabitants/${id}`))).val() as RegistryInhabitant | null;
    if (!person || person.status !== "active" || person.householdId !== householdId) throw new Error("A selected member is no longer active in this household. Review the masterlist and reopen the form.");
    people.set(id, {...person, id});
  }));
  const snapshot = (id: string): PersonSnapshot => {
    const person = people.get(id)!; const location = personLocation(person, household);
    return {fullName: person.fullName, householdId, householdName: household.householdName || "", address: location.address || "", purok: location.purokId || "", birthDate: person.birthDate || "", sex: person.sex || ""};
  };
  const now = Date.now(), prepared = entries.map(({id, input}) => {
    validateCase(input);
    const scope = input.scope || "person";
    const program = input.programId ? programs.find(p => p.id === input.programId) : programForName(programs, input.program);
    if (!program || program.status !== "active" || !supportsScope(program, scope)) throw new Error(`Choose an available ${scope === "person" ? "individual" : "household"} program for every case.`);
    const participantIds = scope === "household" ? [...new Set(input.participantIds || [])] : [];
    if (scope === "household" && !participantIds.length) throw new Error("Select at least one household participant.");
    const person = scope === "household" ? {...snapshot(participantIds[0]), fullName: household.householdName || "Household", birthDate: "", sex: ""} : snapshot(input.inhabitantId);
    const record: MonitoringCase = {
      ...cleanDetails({...input, program: program.name, programId: program.id}), id, inhabitantId: scope === "household" ? "" : input.inhabitantId,
      scope, householdId, person, ...(scope === "household" ? {participants: Object.fromEntries(participantIds.map(uid => [uid, snapshot(uid)]))} : {}),
      version: 1, createdAt: now, createdBy: actor.uid, updatedAt: now, updatedBy: actor.uid, activities: {}, history: {},
    };
    const activityId = `first_${id}`;
    record.activities[activityId] = makeActivity({...blankActivity(), activityType: scope === "household" ? "Household followup" : "Followup visit", scheduledDate: input.firstFollowupDate}, record, activityId, actor.uid, now);
    record.history[id] = {id, action: "Case created", at: now, by: actor.uid, actorName: actor.displayName || actor.email || actor.uid, reason: "", before: null, after: details(record), affectedActivityIds: [activityId]};
    return record;
  });
  if (prepared.some((entry, i) => prepared.slice(0, i).some(other => duplicateMonitoringCase(entry, other)))) throw new Error("The same member or household has the same program twice. Keep one case and record its followups there.");
  const canonical = (record: MonitoringCase) => {
    const program = record.programId ? programs.find(p => p.id === record.programId) : programForName(programs, record.program);
    return {...record, programId: program?.id || record.programId};
  };
  const result = await runTransaction(ref(database, "monitoringCases"), raw => {
    const current: Record<string, MonitoringCase> = raw || {};
    const next = {...current};
    for (const record of prepared) {
      const existing = current[record.id];
      if (existing) {
        const original = existing.history?.[record.id];
        const first = existing.activities?.[`first_${record.id}`];
        const intended = details(record);
        const sameDetails = original && Object.entries(intended).every(([key,value]) => (original.after as unknown as Record<string,unknown>)[key] === value);
        const sameMembers = JSON.stringify(Object.keys(existing.participants || {}).sort()) === JSON.stringify(Object.keys(record.participants || {}).sort());
        if (original?.by === actor.uid && existing.inhabitantId === record.inhabitantId && existing.householdId === householdId && sameDetails && sameMembers && first?.scheduledDate === record.activities[`first_${record.id}`].scheduledDate) continue;
        throw new Error("A registration with this identifier is already saved. Close the form and review the saved cases before making changes.");
      }
      if (Object.values(next).some(other => other.status !== "Completed" && duplicateMonitoringCase(canonical(other), record))) throw new Error(`${record.person.fullName} already has an open case for ${record.program}. Use the existing case for the next visit.`);
      next[record.id] = record;
    }
    return next;
  }, {applyLocally: false});
  if (!result.committed) throw new Error("The registration was not saved. Please try again.");
  return prepared.map(record => record.id);
}
