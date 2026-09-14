import { AddRounded, EditOutlined } from "@mui/icons-material";
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Tab, Tabs, Typography } from "@mui/material";
import { useState, type ReactNode } from "react";
import type { Household } from "../../types";
import { ageOn, familyCount, type RegistryInhabitant } from "../../services/inhabitantModel";

export function Detail({ label, value }: { label: string; value: ReactNode }) {
  return <div><dt>{label}</dt><dd>{value === "" || value === null || value === undefined ? "Not recorded" : value}</dd></div>;
}
export function money(value?: number | null) {
  return value === undefined || value === null ? "Not recorded" : new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(value);
}
export default function HouseholdProfileDialog({ household, members, onClose, onEditHousehold, onAddMember, onViewMember, onEditMember }: {
  household: Household; members: RegistryInhabitant[]; onClose: () => void; onEditHousehold: (household: Household) => void;
  onAddMember: (id: string) => void; onViewMember: (member: RegistryInhabitant) => void; onEditMember: (member: RegistryInhabitant) => void;
}) {
  const [tab, setTab] = useState(0);
  const activeMembers = members.filter(m => m.status === "active");
  return <Dialog className="ip-profile-dialog" open onClose={onClose} fullWidth maxWidth="md" aria-labelledby="ip-household-title">
    <DialogTitle id="ip-household-title">{household.householdName}</DialogTitle>
    <Tabs value={tab} onChange={(_, value: number) => setTab(value)} aria-label="Household profile sections" sx={{ px: 2 }}><Tab label="Overview" id="ip-household-overview-tab" aria-controls="ip-household-panel" /><Tab label="Edit records" id="ip-household-edit-tab" aria-controls="ip-household-panel" /></Tabs>
    <DialogContent dividers>
      <div id="ip-household-panel" role="tabpanel" aria-labelledby={tab ? "ip-household-edit-tab" : "ip-household-overview-tab"}>
      {tab === 0 ? <>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}><Chip size="small" label={household.purokId} /><Chip size="small" label={household.status || "Status not recorded"} color={household.status === "active" ? "success" : "default"} /><Chip size="small" label={`${activeMembers.length} active members`} /><Chip size="small" label={`${familyCount(activeMembers)} recorded families`} /></Stack>
      <dl className="ip-details-grid">
        <Detail label="Household head" value={household.householdHeadName} /><Detail label="Address" value={household.address} />
        <Detail label="House / unit number" value={household.unitNumber} /><Detail label="Landmark" value={household.landmark} />
        <Detail label="Household type" value={household.householdType} /><Detail label="Housing tenure" value={household.tenureStatus} />
        <Detail label="Primary contact" value={household.primaryContact} /><Detail label="Secondary contact" value={household.secondaryContact} />
        <Detail label="Monthly household income" value={money(household.monthlyIncome)} /><Detail label="Last updated" value={household.updatedAt ? new Date(household.updatedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" }) : "Not recorded"} />
      </dl>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ my: 2 }}><Typography component="h3" fontWeight={800}>Family members <Typography component="span" color="text.secondary">({members.length})</Typography></Typography><Button startIcon={<AddRounded />} onClick={() => onAddMember(household.id)}>Add member</Button></Stack>
      <Stack spacing={1}>{[...members].sort((a, b) => Number(b.isHouseholdHead) - Number(a.isHouseholdHead) || (a.familyNumber ?? Infinity) - (b.familyNumber ?? Infinity) || a.fullName.localeCompare(b.fullName)).map(member => <Box key={member.id} className="ip-household-member">
        <div><Button sx={{ p: 0, textAlign: "left", justifyContent: "flex-start" }} onClick={() => onViewMember(member)}>{member.fullName}</Button><Typography variant="body2" color="text.secondary">{member.relationshipToHead} · {ageOn(member.birthDate) === null ? "Age not recorded" : `${ageOn(member.birthDate)} years old`} · {member.sex || "Sex not recorded"}</Typography></div>
        <Stack direction="row" spacing={1}><Chip size="small" label={member.familyNumber ? `Family ${member.familyNumber}` : "Family not recorded"} /><Chip size="small" variant="outlined" label={member.status || "Status not recorded"} /></Stack>
      </Box>)}</Stack>
      {!members.length && <Typography color="text.secondary">No inhabitants have been added to this household.</Typography>}
      </> : <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">Update household details or choose a family member to edit.</Typography>
        <Box className="ip-edit-household-card"><Box><Typography fontWeight={800}>Household details</Typography><Typography variant="body2" color="text.secondary">Location, contacts, housing, income, and record status</Typography></Box><Button variant="contained" startIcon={<EditOutlined />} onClick={() => onEditHousehold(household)}>Edit household</Button></Box>
        <Stack direction="row" alignItems="center" justifyContent="space-between"><Typography component="h3" fontWeight={800}>Family member profiles</Typography><Button startIcon={<AddRounded />} onClick={() => onAddMember(household.id)}>Add member</Button></Stack>
        {[...members].sort((a,b) => Number(b.isHouseholdHead) - Number(a.isHouseholdHead) || a.fullName.localeCompare(b.fullName)).map(member => <Box className="ip-edit-member-card" key={member.id}><Box><Typography fontWeight={700}>{member.fullName}</Typography><Typography variant="body2" color="text.secondary">{member.relationshipToHead} · {member.status}</Typography></Box><Button variant="outlined" startIcon={<EditOutlined />} aria-label={`Edit ${member.fullName} profile`} onClick={() => onEditMember(member)}>Edit profile</Button></Box>)}
        {!members.length && <Typography color="text.secondary">No family members recorded yet.</Typography>}
      </Stack>}
      </div>
    </DialogContent>
    <DialogActions sx={{ p: 2 }}><Button onClick={onClose}>Close</Button>{tab === 0 && <Button startIcon={<EditOutlined />} variant="contained" onClick={() => setTab(1)}>Edit records</Button>}</DialogActions>
  </Dialog>;
}
