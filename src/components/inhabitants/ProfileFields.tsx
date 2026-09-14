import { Box, FormControlLabel, MenuItem, Switch, TextField, Typography } from "@mui/material";
import type { Household } from "../../types";
import { BUNUANAN_BARANGAY_NAME, BUNUANAN_CITY, BUNUANAN_PUROKS } from "../../config/bunuananServiceArea";
import { ageOn, REGISTRY_LOCATION, SOCIAL_FIELDS, todayInManila } from "../../services/inhabitantModel";
import type { HouseholdInput, InhabitantInput } from "../../services/inhabitantService";

export function blankHousehold(): HouseholdInput {
  return { householdName: "", purokId: "", address: "", primaryContact: "", status: "active", monthlyIncome: null };
}
export function blankInhabitant(householdId = ""): InhabitantInput {
  return { householdId, fullName: "", relationshipToHead: householdId ? "" : "Not assigned", isHouseholdHead: false,
    status: "active", familyNumber: null, monthlyIncome: null };
}
export function SelectField({ label, value, options, onChange, required = false, helperText }: {
  label: string; value?: string; options: readonly string[]; onChange: (value: string) => void; required?: boolean; helperText?: string;
}) {
  return <TextField select fullWidth size="small" label={label} value={value || ""} required={required}
    onChange={e => onChange(e.target.value)} helperText={helperText}>
    <MenuItem value="">{required ? "Select an option" : "Not recorded"}</MenuItem>
    {Boolean(value) && !options.includes(value!) && <MenuItem value={value}>{value}</MenuItem>}
    {options.map(option => <MenuItem key={option} value={option}>{option}</MenuItem>)}
  </TextField>;
}
function Section({ title, description }: { title: string; description?: string }) {
  return <Box className="ip-form-section"><Typography component="h3" fontWeight={800}>{title}</Typography>
    {description && <Typography variant="body2" color="text.secondary">{description}</Typography>}</Box>;
}

export function HouseholdFields({ value, onChange }: { value: HouseholdInput; onChange: (value: HouseholdInput) => void }) {
  const change = (key: keyof HouseholdInput, v: unknown) => onChange({ ...value, [key]: v });
  return <div className="ip-form-grid">
    <Section title="Community location" description="The registry covers Barangay Bunuanan. These location details are filled in automatically." />
    <TextField size="small" label="Region" value={REGISTRY_LOCATION.region} InputProps={{ readOnly: true }} />
    <TextField size="small" label="Province" value={REGISTRY_LOCATION.province} InputProps={{ readOnly: true }} />
    <TextField size="small" label="City / municipality" value={BUNUANAN_CITY} InputProps={{ readOnly: true }} />
    <TextField size="small" label="Barangay" value={BUNUANAN_BARANGAY_NAME} InputProps={{ readOnly: true }} />
    <Section title="Household information" description="A shared residence can include more than one family." />
    <TextField size="small" label="Household name" required value={value.householdName} onChange={e => change("householdName", e.target.value)} />
    <SelectField label="Purok" required value={value.purokId} options={BUNUANAN_PUROKS} onChange={v => change("purokId", v)} />
    <TextField size="small" label="House / unit number" value={value.unitNumber || ""} onChange={e => change("unitNumber", e.target.value)} />
    <SelectField label="Household type" value={value.householdType} options={["Nuclear family", "Extended family", "Multiple families", "Single-person", "Other"]} onChange={v => change("householdType", v)} />
    <TextField size="small" className="ip-span-2" label="Complete address" required value={value.address} onChange={e => change("address", e.target.value)} multiline minRows={2} />
    <TextField size="small" label="Landmark" value={value.landmark || ""} onChange={e => change("landmark", e.target.value)} />
    <SelectField label="Housing tenure" value={value.tenureStatus} options={["Owner", "Renter", "Living rent-free", "Informal settler", "Other"]} onChange={v => change("tenureStatus", v)} />
    <Section title="Contact & economic information" description="Leave unavailable information blank. Zero income means no income was reported." />
    <TextField size="small" label="Primary mobile" placeholder="09XXXXXXXXX" inputProps={{ inputMode: "tel", maxLength: 11 }} value={value.primaryContact} onChange={e => change("primaryContact", e.target.value)} />
    <TextField size="small" label="Secondary mobile" placeholder="09XXXXXXXXX" inputProps={{ inputMode: "tel", maxLength: 11 }} value={value.secondaryContact || ""} onChange={e => change("secondaryContact", e.target.value)} />
    <TextField size="small" type="number" label="Household monthly income (PHP)" inputProps={{ min: 0, step: "0.01" }} value={value.monthlyIncome ?? ""} onChange={e => change("monthlyIncome", e.target.value === "" ? null : Number(e.target.value))} />
    <SelectField label="Record status" required value={value.status} options={["active", "inactive", "relocated"]} onChange={v => change("status", v)} />
    {value.status !== "active" && <Typography className="ip-span-2" variant="body2" color="text.secondary">Members remain in the masterlist. This household and its members are excluded from the current population summary while the household is inactive or relocated.</Typography>}
  </div>;
}

export type ProfileSection = "all" | "personal" | "household" | "employment" | "social" | "notes";

export function InhabitantFields({ value, onChange, households = [], registration = false, section = "all", allowHouseholdChange = true }: {
  value: InhabitantInput; onChange: (value: InhabitantInput) => void; households?: Household[]; registration?: boolean;
  section?: ProfileSection; allowHouseholdChange?: boolean;
}) {
  const change = (key: keyof InhabitantInput, v: unknown) => onChange({ ...value, [key]: v });
  const show = (name: ProfileSection) => section === "all" || section === name;
  const age = ageOn(value.birthDate);
  const household = households.find(h => h.id === value.householdId);
  return <div className="ip-form-grid">
    {show("personal") && <>
    <Section title="Personal information" description="Age is calculated from the birthday; unknown values can be completed later." />
    <TextField className="ip-span-2" size="small" required label="Full name" value={value.fullName} onChange={e => change("fullName", e.target.value)} />
    <TextField size="small" type="date" label="Birthday" InputLabelProps={{ shrink: true }} inputProps={{ max: todayInManila() }}
      value={value.birthDate || ""} onChange={e => change("birthDate", e.target.value)} helperText={age === null ? "Age: not recorded" : `Age: ${age} years old`} />
    <SelectField label="Sex" value={value.sex} options={["Male", "Female", "Other", "Prefer not to say"]} onChange={v => change("sex", v)} />
    <SelectField label="Civil status" value={value.civilStatus} options={["Single", "Married", "Widowed", "Separated", "Annulled", "Live-in", "Other"]} onChange={v => change("civilStatus", v)} />
    <TextField size="small" label="Mobile number" placeholder="09XXXXXXXXX" inputProps={{ inputMode: "tel", maxLength: 11 }} value={value.phone || ""} onChange={e => change("phone", e.target.value)} />
    <SelectField label="Citizenship" value={value.citizenship} options={["Filipino", "Foreign national"]} onChange={v => change("citizenship", v)} />
    <TextField size="small" label="Nationality / citizenship details" value={value.nationality || ""} onChange={e => change("nationality", e.target.value)} />
    </>}
    {show("household") && <>
    <Section title="Household & family" description="Use the same family number for members of the same family within this household. Leave it blank if not verified." />
    {!registration && <TextField select fullWidth size="small" label="Household" disabled={!allowHouseholdChange} value={value.householdId} onChange={e => {
      const id = e.target.value;
      onChange({ ...value, householdId: id, familyNumber: null, isHouseholdHead: false,
        relationshipToHead: id ? "" : "Not assigned", address: household?.address || value.address || "", purokId: household?.purokId || value.purokId || "" });
    }}>
      <MenuItem value="">Not assigned to a household</MenuItem>
      {Boolean(value.householdId) && !household && <MenuItem value={value.householdId}>Previous household unavailable — choose another</MenuItem>}
      {households.map(h => <MenuItem key={h.id} value={h.id}>{h.householdName} · {h.purokId} {h.status !== "active" ? `(${h.status})` : ""}</MenuItem>)}
    </TextField>}
    {(registration || value.householdId) && <TextField size="small" type="number" label="Family number in household" inputProps={{ min: 1, step: 1 }} value={value.familyNumber ?? ""} onChange={e => change("familyNumber", e.target.value === "" ? null : Number(e.target.value))} />}
    <TextField size="small" required label="Relationship to household head" disabled={value.isHouseholdHead} value={value.isHouseholdHead ? "Head" : value.relationshipToHead} onChange={e => change("relationshipToHead", e.target.value)} placeholder="Spouse, child, parent…" />
    {!registration && <SelectField label="Record status" required value={value.status} options={["active", "relocated", "deceased"]} onChange={v => onChange({ ...value, status: v as InhabitantInput["status"], isHouseholdHead: v === "active" && value.isHouseholdHead, relationshipToHead: v !== "active" && value.isHouseholdHead ? "Former head" : value.relationshipToHead })} />}
    {!registration && value.householdId && <FormControlLabel label="Household head" control={<Switch checked={value.isHouseholdHead} disabled={value.status !== "active"} onChange={e => onChange({ ...value, isHouseholdHead: e.target.checked, relationshipToHead: e.target.checked ? "Head" : "" })} />} />}
    {household && !registration && <Typography className="ip-span-2" variant="body2" color="text.secondary">Address: {household.address} · {household.purokId}. Update shared address information in Edit household.</Typography>}
    {!value.householdId && !registration && <>
      <SelectField label="Purok" required value={value.purokId} options={BUNUANAN_PUROKS} onChange={v => change("purokId", v)} />
      <TextField size="small" required label="Complete address" value={value.address || ""} onChange={e => change("address", e.target.value)} multiline minRows={2} />
    </>}
    </>}
    {show("employment") && <>
    <Section title="Employment & education" />
    <TextField size="small" label="Occupation" value={value.occupation || ""} onChange={e => change("occupation", e.target.value)} />
    <SelectField label="Employment status" value={value.employmentStatus} options={["Employed", "Unemployed", "Not in labor force"]} onChange={v => change("employmentStatus", v)} helperText="Unemployed: without work, available and seeking work." />
    <TextField size="small" label="Personal monthly income (PHP)" type="number" inputProps={{ min: 0, step: "0.01" }} value={value.monthlyIncome ?? ""} onChange={e => change("monthlyIncome", e.target.value === "" ? null : Number(e.target.value))} />
    <SelectField label="School attendance" value={value.schoolAttendance} options={["Enrolled", "Out of school", "Not applicable"]} onChange={v => change("schoolAttendance", v)} />
    </>}
    {show("social") && <>
    <Section title="Health & social categories" description="Choose Yes or No only when verified. Senior status is calculated at age 60 and above." />
    <TextField className="ip-span-2" size="small" label="Senior citizen (60+)" InputProps={{ readOnly: true }} value={age === null ? "Not recorded: birthday is needed" : age >= 60 ? "Yes" : "No"} />
    {SOCIAL_FIELDS.map(([key, label]) => <TextField key={key} size="small" select label={label}
      value={value[key] === true ? "yes" : value[key] === false ? "no" : ""}
      onChange={e => change(key, e.target.value === "" ? null : e.target.value === "yes")}>
      <MenuItem value="">Not recorded</MenuItem><MenuItem value="yes">Yes</MenuItem><MenuItem value="no">No</MenuItem>
    </TextField>)}
    </>}
    {show("notes") && <>
    <Section title="Profile notes" />
    <TextField className="ip-span-2" size="small" label="Profiling remarks" multiline minRows={2} value={value.profileNotes || ""} onChange={e => change("profileNotes", e.target.value)} />
    <TextField size="small" label="Health conditions" multiline minRows={2} value={value.medicalConditions || ""} onChange={e => change("medicalConditions", e.target.value)} />
    <TextField size="small" label="Medical history" multiline minRows={2} value={value.medicalHistory || ""} onChange={e => change("medicalHistory", e.target.value)} />
    <TextField size="small" label="Past treatments" multiline minRows={2} value={value.pastTreatments || ""} onChange={e => change("pastTreatments", e.target.value)} />
    <TextField size="small" label="Emergency notes" multiline minRows={2} value={value.emergencyNotes || ""} onChange={e => change("emergencyNotes", e.target.value)} />
    </>}
  </div>;
}
