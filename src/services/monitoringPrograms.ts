export const PROGRAM_CATEGORIES = [
  "Maternal and child health", "Nutrition", "Communicable diseases", "Continuing health care",
  "Social welfare", "Education and youth", "Livelihood", "Community activities", "Local programs",
] as const;
export type ProgramScope = "person" | "household" | "either";
export interface MonitoringProgram {
  id: string; name: string; category: string; scope: ProgramScope; status: "active" | "archived";
  version: number; aliases?: string[]; updatedAt?: number; updatedBy?: string;
}
type Preset = [string, string, ProgramScope?];
const groups: Preset[][] = [
  [["prenatal", "Prenatal care"], ["postnatal", "Postnatal care"], ["family-planning", "Family planning"],
    ["breastfeeding", "Breastfeeding support"], ["immunization", "Immunization"], ["newborn", "Newborn screening referral"], ["adolescent", "Adolescent health"]],
  [["child-nutrition", "Child nutrition"], ["opt-plus", "Operation Timbang Plus"], ["growth", "Child growth monitoring"],
    ["feeding", "Supplementary feeding"], ["maternal-nutrition", "Maternal nutrition"], ["micronutrients", "Micronutrient supplementation"],
    ["deworming", "Deworming"], ["first-1000", "First 1000 days support"]],
  [["tb", "TB monitoring"], ["dengue", "Dengue monitoring"], ["animal-bite", "Animal bite and rabies referral"],
    ["leprosy", "Leprosy monitoring"], ["hiv-sti", "HIV and STI service referral"], ["respiratory", "Respiratory illness followup"],
    ["diarrhea", "Diarrheal illness followup"]],
  [["blood-pressure", "Blood pressure monitoring"], ["diabetes", "Diabetes monitoring"], ["senior", "Senior health"],
    ["pwd-health", "PWD health and rehabilitation support"], ["mental-health", "Mental health support"], ["oral-health", "Oral health"],
    ["vision-hearing", "Vision and hearing referral"], ["medical-mission", "Medical consultation and outreach"], ["home-care", "Home care followup"]],
  [["4ps", "4Ps household monitoring", "household"], ["fds", "Family Development Sessions", "either"],
    ["social-pension", "Social pension assistance"], ["aics", "Assistance referral (AICS)", "either"], ["solo-parent", "Solo parent support"],
    ["pwd-assistance", "PWD assistance"], ["food-assistance", "Household food assistance", "household"], ["family-support", "Family support referral", "household"]],
  [["child-development", "Child development attendance"], ["als", "Alternative Learning System referral"],
    ["school-attendance", "School attendance followup"], ["scholarship", "Educational assistance referral"],
    ["youth", "Youth and SK activities"], ["parenting", "Parenting sessions", "either"]],
  [["slp", "Sustainable Livelihood Program", "either"], ["skills", "Skills training"], ["employment", "Employment referral"],
    ["gardening", "Household gardening", "household"], ["agriculture", "Agriculture and fisheries support", "either"]],
  [["attendance", "Community attendance", "either"], ["assembly", "Barangay assembly attendance", "either"],
    ["cleanup", "Community cleanup", "either"], ["sanitation", "Household sanitation visit", "household"],
    ["waste", "Waste segregation followup", "household"], ["drill", "Disaster preparedness activities", "either"],
    ["relief", "Household relief distribution", "household"], ["evacuation", "Evacuation support", "household"]],
];
export const BUILTIN_MONITORING_PROGRAMS: MonitoringProgram[] = groups.flatMap((group, i) => group.map(([id, name, scope]) => ({
  id: `preset_${id}`, name, category: PROGRAM_CATEGORIES[i], scope: scope || "person", status: "active", version: 0,
})));
export function programNameKey(value: string): string { return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-PH"); }
export function mergeMonitoringPrograms(overrides: Record<string, MonitoringProgram> = {}): MonitoringProgram[] {
  const merged = new Map(BUILTIN_MONITORING_PROGRAMS.map(p => [p.id, p]));
  Object.entries(overrides).forEach(([id, value]) => { if (value && typeof value.name === "string") merged.set(id, {...value, id}); });
  return [...merged.values()].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}
export function programForName(programs: MonitoringProgram[], name: string): MonitoringProgram | undefined {
  const key = programNameKey(name);
  return programs.find(p => [p.name, ...(p.aliases || [])].some(v => programNameKey(v) === key));
}
export function supportsScope(program: MonitoringProgram, scope: "person" | "household"): boolean {
  return program.scope === "either" || program.scope === scope;
}
