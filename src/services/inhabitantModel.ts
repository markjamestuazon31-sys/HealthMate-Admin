import type { Household, Inhabitant } from "../types";
import { normalizeBunuananPurok } from "../config/bunuananServiceArea";

export const REGISTRY_LOCATION = {
  region: "Region VIII (Eastern Visayas)",
  province: "Samar",
} as const;

export interface RegistryInhabitant extends Inhabitant {
  /** Address/purok are used for inhabitants without an assigned household. */
  address?: string;
  purokId?: string;
  /** Family numbers are local to a household; blank means not yet recorded. */
  familyNumber?: number | null;
  occupation?: string;
  employmentStatus?: string;
  schoolAttendance?: string;
  citizenship?: string;
  nationality?: string;
  monthlyIncome?: number | null;
  isPwd?: boolean | null;
  isPregnant?: boolean | null;
  is4Ps?: boolean | null;
  isOfw?: boolean | null;
  isSoloParent?: boolean | null;
  isIndigenous?: boolean | null;
  profileNotes?: string;
}

export const SOCIAL_FIELDS = [
  ["isPwd", "Person with disability (PWD)"],
  ["isPregnant", "Pregnant"],
  ["is4Ps", "4Ps beneficiary"],
  ["isOfw", "Overseas Filipino worker (OFW)"],
  ["isSoloParent", "Solo parent"],
  ["isIndigenous", "Indigenous person (IP)"],
] as const;

export function todayInManila(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  return ["year", "month", "day"].map(type => parts.find(p => p.type === type)?.value).join("-");
}

export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function ageOn(birthDate: string | undefined, referenceDate = todayInManila()): number | null {
  if (!birthDate || !validDate(birthDate) || !validDate(referenceDate) || birthDate > referenceDate) return null;
  const [y, m, d] = birthDate.split("-").map(Number);
  const [ry, rm, rd] = referenceDate.split("-").map(Number);
  return ry - y - (rm < m || (rm === m && rd < d) ? 1 : 0);
}

export const AGE_BRACKETS = [
  { id: "0", label: "Under 5 years old", min: 0, max: 4 },
  ...Array.from({ length: 15 }, (_, index) => {
    const min = (index + 1) * 5;
    return { id: String(min), label: `${min}–${min + 4} years old`, min, max: min + 4 };
  }),
  { id: "80", label: "80 years old and over", min: 80, max: Infinity },
];

export const SECTORS = [
  ["labor", "Labor force (15+)"], ["unemployed", "Unemployed (15+)"],
  ["osc", "Out of school children (6–14)"], ["osy", "Out of school youth (15–24)"],
  ["pwd", "Persons with disabilities (PWDs)"], ["ofw", "Overseas Filipino workers (OFWs)"],
  ["solo", "Solo parents"], ["ip", "Indigenous peoples (IPs)"],
  ["senior", "Senior citizens (60+)"], ["pregnant", "Pregnant inhabitants"], ["4ps", "4Ps beneficiaries"],
] as const;

const lower = (value: unknown) => String(value ?? "").trim().toLowerCase();
type SectorProfile = Pick<RegistryInhabitant, "birthDate" | "employmentStatus" | "schoolAttendance" | (typeof SOCIAL_FIELDS)[number][0]>;
export function inSector(person: SectorProfile, sector: string, date = todayInManila()): boolean {
  const age = ageOn(person.birthDate, date);
  switch (sector) {
    case "labor": return age !== null && age >= 15 && ["employed", "unemployed"].includes(lower(person.employmentStatus));
    case "unemployed": return age !== null && age >= 15 && lower(person.employmentStatus) === "unemployed";
    case "osc": return age !== null && age >= 6 && age <= 14 && lower(person.schoolAttendance) === "out of school";
    case "osy": return age !== null && age >= 15 && age <= 24 && lower(person.schoolAttendance) === "out of school";
    case "pwd": return person.isPwd === true;
    case "ofw": return person.isOfw === true;
    case "solo": return person.isSoloParent === true;
    case "ip": return person.isIndigenous === true;
    case "senior": return age !== null && age >= 60;
    case "pregnant": return person.isPregnant === true;
    case "4ps": return person.is4Ps === true;
    default: return true;
  }
}

export function personLocation(person: RegistryInhabitant, household?: Household) {
  const purok = household?.purokId || person.purokId || "";
  return { address: household?.address || person.address || "", purokId: normalizeBunuananPurok(purok) || purok };
}

export function currentInhabitants(people: RegistryInhabitant[], households: Household[]): RegistryInhabitant[] {
  const byId = new Map(households.map(h => [h.id, h]));
  return people.filter(p => p.status === "active" && (!byId.has(p.householdId) || byId.get(p.householdId)?.status === "active"));
}

export function familyCount(people: RegistryInhabitant[]): number {
  return new Set(people.filter(p => p.householdId && Number.isInteger(p.familyNumber) && Number(p.familyNumber) > 0)
    .map(p => `${p.householdId}/${p.familyNumber}`)).size;
}

export interface RegistryFilters {
  search: string; purok: string; status: string; sex: string; age: string; sector: string; sort: string;
}
export const DEFAULT_FILTERS: RegistryFilters = {
  search: "", purok: "", status: "active", sex: "", age: "", sector: "", sort: "name",
};
export function matchesPerson(person: RegistryInhabitant, household: Household | undefined, filters: RegistryFilters, date: string): boolean {
  const location = personLocation(person, household);
  const terms = lower(filters.search).split(/\s+/).filter(Boolean);
  const search = lower([person.fullName, person.id, person.phone, person.occupation, person.relationshipToHead,
    household?.householdName, location.address, location.purokId].join(" "));
  const age = ageOn(person.birthDate, date);
  const bracket = AGE_BRACKETS.find(b => b.id === filters.age);
  return terms.every(t => search.includes(t)) && (!filters.purok || location.purokId === filters.purok)
    && (!filters.status || person.status === filters.status)
    && (!filters.sex || (filters.sex === "unknown" ? !["male", "female"].includes(lower(person.sex)) : lower(person.sex) === filters.sex))
    && (!filters.age || (filters.age === "unknown" ? age === null : Boolean(bracket && age !== null && age >= bracket.min && age <= bracket.max)))
    && (!filters.sector || inSector(person, filters.sector, date));
}

export interface PopulationRow { label: string; male: number; female: number; other: number; total: number }
export function countPopulation(label: string, people: RegistryInhabitant[]): PopulationRow {
  const male = people.filter(p => lower(p.sex) === "male").length;
  const female = people.filter(p => lower(p.sex) === "female").length;
  return { label, male, female, other: people.length - male - female, total: people.length };
}
export function populationSummary(people: RegistryInhabitant[], date: string) {
  return {
    ages: [...AGE_BRACKETS.map(b => countPopulation(b.label, people.filter(p => {
      const age = ageOn(p.birthDate, date); return age !== null && age >= b.min && age <= b.max;
    }))), countPopulation("Age not recorded / invalid birth date", people.filter(p => ageOn(p.birthDate, date) === null))],
    sectors: SECTORS.map(([id, label]) => countPopulation(label, people.filter(p => inSector(p, id, date)))),
    civil: ["Single", "Married", "Widowed", "Separated", "Annulled", "Live-in"].map(label =>
      countPopulation(label, people.filter(p => lower(p.civilStatus) === lower(label))))
      .concat(countPopulation("Other / not recorded", people.filter(p => !["single", "married", "widowed", "separated", "annulled", "live-in"].includes(lower(p.civilStatus))))),
    citizenship: [countPopulation("Filipino", people.filter(p => lower(p.citizenship) === "filipino")),
      countPopulation("Foreigner", people.filter(p => ["foreigner", "foreign national"].includes(lower(p.citizenship)))),
      countPopulation("Other / not recorded", people.filter(p => !["filipino", "foreigner", "foreign national"].includes(lower(p.citizenship))))],
    total: countPopulation("Total inhabitants", people),
  };
}

export function socialLabels(person: SectorProfile, date: string): string[] {
  const shortLabels: Record<string, string> = {
    pwd: "PWD", ofw: "OFW", senior: "Senior", pregnant: "Pregnant", "4ps": "4Ps", solo: "Solo parent", ip: "IP",
  };
  return SECTORS.filter(([id]) => inSector(person, id, date)).map(([id, label]) => shortLabels[id] || label);
}
