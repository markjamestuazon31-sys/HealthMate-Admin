import { useRef, useState } from "react";
import { AddRounded, DeleteOutlineRounded, EditOutlined, ExpandMoreRounded, HomeWorkRounded } from "@mui/icons-material";
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, Step, StepLabel, Stepper, Typography, useMediaQuery, useTheme } from "@mui/material";
import { ageOn, socialLabels, todayInManila } from "../../services/inhabitantModel";
import { registerHouseholdWithMembers, validateHouseholdInput, validateInhabitantInput, type InhabitantInput } from "../../services/inhabitantService";
import { blankHousehold, blankInhabitant, HouseholdFields, InhabitantFields } from "./ProfileFields";

export default function HouseholdWizard({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (id: string) => void }) {
  const fullScreen = useMediaQuery(useTheme().breakpoints.down("sm"));
  const [step, setStep] = useState(0), [selected, setSelected] = useState(-1);
  const [household, setHousehold] = useState(blankHousehold);
  const [head, setHead] = useState<InhabitantInput>({ ...blankInhabitant(), relationshipToHead: "Head", isHouseholdHead: true, familyNumber: 1 });
  const [members, setMembers] = useState<InhabitantInput[]>([]);
  const [error, setError] = useState(""), [saving, setSaving] = useState(false);
  const content = useRef<HTMLDivElement>(null), inFlight = useRef(false);
  const allMembers = [head, ...members];
  function goTo(next: number) {
    setError(""); setStep(next);
    if (content.current) content.current.scrollTop = 0;
  }
  function next() {
    try {
      if (step === 0) validateHouseholdInput(household);
      if (step === 1) validateInhabitantInput(head);
      if (step === 2) members.forEach((m, i) => {
        try { validateInhabitantInput(m); }
        catch (e) { setSelected(i); throw e; }
      });
      goTo(step + 1);
    } catch (e) { setError(e instanceof Error ? e.message : "Check the form."); }
  }
  async function save() {
    if (inFlight.current) return;
    inFlight.current = true; setSaving(true); setError("");
    try { onSaved(await registerHouseholdWithMembers(household, allMembers)); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to register household."); setSaving(false); inFlight.current = false; }
  }
  return <Dialog open={open} onClose={() => !inFlight.current && onClose()} fullWidth maxWidth="lg" fullScreen={fullScreen} aria-labelledby="ip-register-title" className="ip-registration-dialog">
    <DialogTitle id="ip-register-title"><Stack direction="row" alignItems="center" spacing={1.5}><HomeWorkRounded color="primary" /><Box><Typography component="span" display="block" fontSize={20} fontWeight={800}>Register household</Typography><Typography component="span" display="block" variant="body2" color="text.secondary">One registration for the household and everyone living in it.</Typography></Box></Stack></DialogTitle>
    <Box className="ip-registration-progress"><Stepper activeStep={step} alternativeLabel>{["Household details", "Household head", "Family members", "Review & save"].map(label => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}</Stepper></Box>
    <DialogContent dividers ref={content}>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <div className="ip-registration-content">
        {step === 0 && <HouseholdFields value={household} onChange={setHousehold} />}
        {step === 1 && <InhabitantFields registration value={head} onChange={setHead} />}
        {step === 2 && <Stack spacing={2}>
          <Box className="ip-registered-head"><Typography fontWeight={800}>{head.fullName}</Typography><Typography variant="body2" color="text.secondary">Household head already included</Typography></Box>
          {!members.length && <div className="ip-family-empty"><Typography component="h3" fontWeight={800}>Who else lives in this household?</Typography><Typography variant="body2" color="text.secondary">Add each family member here. For a household with one person, continue to review.</Typography></div>}
          {members.map((member, index) => <Box key={index} className="ip-member-card">
            <Stack direction="row" alignItems="center" spacing={1}>
              <Button color="inherit" aria-expanded={selected === index} onClick={() => setSelected(selected === index ? -1 : index)} endIcon={<ExpandMoreRounded />} sx={{ flex: 1, justifyContent: "space-between", textAlign: "left" }}>{member.fullName || `Family member ${index + 1}`}</Button>
              <IconButton aria-label={`Remove unsaved member ${index + 1}`} onClick={() => { setMembers(members.filter((_, i) => i !== index)); setSelected(Math.max(0, index - 1)); }}><DeleteOutlineRounded /></IconButton>
            </Stack>
            {selected === index && <Box sx={{ mt: 2 }}><InhabitantFields registration value={member} onChange={value => setMembers(members.map((m, i) => i === index ? value : m))} /></Box>}
          </Box>)}
          <Button startIcon={<AddRounded />} variant="outlined" onClick={() => { setSelected(members.length); setMembers([...members, { ...blankInhabitant(), relationshipToHead: "", familyNumber: 1 }]); }}>Add family member</Button>
        </Stack>}
        {step === 3 && <Stack spacing={2}>
          <Box className="ip-review-household"><Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}><Box><Typography variant="h6" fontWeight={800}>{household.householdName}</Typography><Typography>{household.address} · {household.purokId}</Typography><Typography variant="body2" color="text.secondary">{allMembers.length} inhabitant(s) · {household.primaryContact || "Contact not recorded"}</Typography></Box><Button disabled={saving} startIcon={<EditOutlined />} onClick={() => goTo(0)}>Edit household details</Button></Stack></Box>
          {allMembers.map((m, i) => <Box key={i} className="ip-review-member"><Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}><Box><Typography fontWeight={800}>{m.fullName}</Typography><Typography variant="body2" color="text.secondary">{m.relationshipToHead} · {m.sex || "Sex not recorded"} · {ageOn(m.birthDate) === null ? "Age not recorded" : `${ageOn(m.birthDate)} years old`}</Typography><Typography variant="body2" color="text.secondary">{m.civilStatus || "Civil status not recorded"} · {m.citizenship || "Citizenship not recorded"}</Typography></Box><Button disabled={saving} size="small" startIcon={<EditOutlined />} aria-label={`Edit registration for ${m.fullName}`} onClick={() => { setSelected(i - 1); goTo(i ? 2 : 1); }}>Edit</Button></Stack><Stack direction="row" spacing={.75} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}><Chip size="small" label={m.familyNumber ? `Family ${m.familyNumber}` : "Family not recorded"} />{socialLabels(m, todayInManila()).map(label => <Chip key={label} size="small" variant="outlined" label={label} />)}</Stack></Box>)}
          <Alert severity="info">Save once to register the household and all its members. You can update their details in Edit records later.</Alert>
        </Stack>}
      </div>
    </DialogContent>
    <DialogActions sx={{ p: 2 }}><Button color="inherit" onClick={onClose} disabled={saving}>Cancel</Button><Typography variant="caption" color="text.secondary" sx={{ flex: 1, ml: 1 }}>Step {step + 1} of 4</Typography>{step > 0 && <Button onClick={() => goTo(step - 1)} disabled={saving}>Back</Button>}{step < 3 ? <Button variant="contained" onClick={next}>Continue</Button> : <Button variant="contained" disabled={saving} onClick={() => void save()}>{saving ? "Registering…" : "Save household & members"}</Button>}</DialogActions>
  </Dialog>;
}
