import { useRef, useState } from "react";
import { EditOutlined } from "@mui/icons-material";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Tab, Tabs, Typography, useMediaQuery, useTheme } from "@mui/material";
import type { Household } from "../../types";
import { saveHousehold, saveInhabitant, type HouseholdInput, type InhabitantInput } from "../../services/inhabitantService";
import { HouseholdFields, InhabitantFields, type ProfileSection } from "./ProfileFields";

type Props = { onClose: () => void; onSaved: () => void } & (
  { kind: "household"; initial: HouseholdInput } | { kind: "inhabitant"; initial: InhabitantInput; households: Household[] }
);
const sections: { id: ProfileSection; label: string }[] = [
  { id: "personal", label: "Personal details" }, { id: "household", label: "Household & family" },
  { id: "employment", label: "Employment & education" }, { id: "social", label: "Health & social" }, { id: "notes", label: "Notes" },
];
export default function RegistryEditor(props: Props) {
  const [value, setValue] = useState(props.initial), [saving, setSaving] = useState(false), [error, setError] = useState("");
  const [section, setSection] = useState<ProfileSection>("personal");
  const inFlight = useRef(false), content = useRef<HTMLDivElement>(null);
  const fullScreen = useMediaQuery(useTheme().breakpoints.down("sm"));
  const name = props.kind === "household" ? (value as HouseholdInput).householdName : (value as InhabitantInput).fullName;
  const isNewMember = props.kind === "inhabitant" && !value.id;
  function goTo(next: ProfileSection) { setSection(next); if (content.current) content.current.scrollTop = 0; }
  async function save() {
    if (inFlight.current) return;
    inFlight.current = true; setSaving(true); setError("");
    try {
      if (props.kind === "household") await saveHousehold(value as HouseholdInput);
      else {
        if (isNewMember && !(value as InhabitantInput).householdId) throw new Error("Choose an existing household before adding a family member.");
        await saveInhabitant(value as InhabitantInput);
      }
      props.onSaved();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unable to save profile.";
      setError(message); setSaving(false); inFlight.current = false;
      if (props.kind === "inhabitant") {
        if (/relationship|household|family number|record status|active inhabitant/i.test(message)) goTo("household");
        else if (/income/i.test(message)) goTo("employment");
        else if (/social/i.test(message)) goTo("social");
        else if (/name|birthday|mobile|phone/i.test(message)) goTo("personal");
      }
    }
  }
  return <Dialog open onClose={() => !inFlight.current && props.onClose()} fullWidth maxWidth="lg" fullScreen={fullScreen} aria-labelledby="ip-editor-title" className="ip-editor-dialog">
    <DialogTitle id="ip-editor-title"><Stack direction="row" alignItems="center" spacing={1.5}><EditOutlined color="primary" /><Box><Typography component="span" display="block" fontSize={20} fontWeight={800}>{props.kind === "household" ? "Edit household details" : isNewMember ? "Add family member" : "Edit inhabitant profile"}</Typography><Typography component="span" display="block" variant="body2" color="text.secondary">{name || "Complete the new member's information"}</Typography></Box></Stack></DialogTitle>
    {props.kind === "inhabitant" && <Tabs className="ip-edit-tabs" value={section} onChange={(_, next: ProfileSection) => goTo(next)} variant="scrollable" scrollButtons="auto" aria-label="Edit profile sections">{sections.map(s => <Tab key={s.id} id={`ip-edit-tab-${s.id}`} aria-controls="ip-edit-panel" label={s.label} value={s.id} disabled={saving} />)}</Tabs>}
    <DialogContent dividers ref={content}>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <div className="ip-registration-content" id="ip-edit-panel" role={props.kind === "inhabitant" ? "tabpanel" : undefined} aria-labelledby={props.kind === "inhabitant" ? `ip-edit-tab-${section}` : undefined}>
        <fieldset className="ip-fieldset" disabled={saving}>{props.kind === "household" ? <HouseholdFields value={value as HouseholdInput} onChange={setValue} /> : <InhabitantFields value={value as InhabitantInput} onChange={setValue} households={props.households} section={section} allowHouseholdChange={!isNewMember} />}</fieldset>
      </div>
    </DialogContent>
    <DialogActions sx={{ p: 2 }}><Typography variant="caption" color="text.secondary" sx={{ flex: 1, pl: 1 }}>{isNewMember ? "The member will be added to this household." : "Changes are applied when you save."}</Typography><Button onClick={props.onClose} disabled={saving}>Cancel</Button><Button variant="contained" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : isNewMember ? "Save family member" : "Save changes"}</Button></DialogActions>
  </Dialog>;
}
