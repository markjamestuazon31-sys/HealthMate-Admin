import { EditOutlined } from "@mui/icons-material";
import { Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import type { Household } from "../../types";
import { ageOn, personLocation, SOCIAL_FIELDS, type RegistryInhabitant } from "../../services/inhabitantModel";
import { Detail, money } from "./HouseholdProfileDialog";

export default function InhabitantProfileDialog({ person, household, onClose, onEdit }: {
  person: RegistryInhabitant; household?: Household; onClose: () => void; onEdit: () => void;
}) {
  const location = personLocation(person, household), age = ageOn(person.birthDate);
  return <Dialog className="ip-profile-dialog" open onClose={onClose} fullWidth maxWidth="md" aria-labelledby="ip-person-title">
    <DialogTitle id="ip-person-title">{person.fullName}</DialogTitle>
    <DialogContent dividers>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}><Chip size="small" label={person.status || "Status not recorded"} color={person.status === "active" ? "success" : "default"} />{person.isHouseholdHead && <Chip size="small" label="Household head" variant="outlined" />}</Stack>
      <Typography component="h3" fontWeight={800}>Personal & household information</Typography>
      <dl className="ip-details-grid">
        <Detail label="Birthday" value={person.birthDate} /><Detail label="Age" value={age === null ? "Not recorded" : `${age} years old`} />
        <Detail label="Sex" value={person.sex} /><Detail label="Civil status" value={person.civilStatus} />
        <Detail label="Citizenship" value={person.citizenship} /><Detail label="Nationality / details" value={person.nationality} />
        <Detail label="Address" value={location.address} /><Detail label="Purok" value={location.purokId} />
        <Detail label="Contact" value={person.phone} /><Detail label="Household" value={household?.householdName || "Not assigned / unavailable"} />
        <Detail label="Family number" value={person.familyNumber} /><Detail label="Relationship to head" value={person.relationshipToHead} />
        <Detail label="Occupation" value={person.occupation} /><Detail label="Employment status" value={person.employmentStatus} />
        <Detail label="Personal monthly income" value={money(person.monthlyIncome)} /><Detail label="School attendance" value={person.schoolAttendance} />
      </dl>
      <Typography component="h3" fontWeight={800}>Health & social data</Typography>
      <dl className="ip-details-grid">
        <Detail label="Senior citizen (60+)" value={age === null ? "Not recorded" : age >= 60 ? "Yes" : "No"} />
        {SOCIAL_FIELDS.map(([key, label]) => <Detail key={key} label={label} value={person[key] === true ? "Yes" : person[key] === false ? "No" : "Not recorded"} />)}
        <Detail label="Health conditions" value={person.medicalConditions} /><Detail label="Medical history" value={person.medicalHistory} />
        <Detail label="Past treatments" value={person.pastTreatments} /><Detail label="Emergency notes" value={person.emergencyNotes} />
        <Detail label="Profiling remarks" value={person.profileNotes} /><Detail label="Last updated" value={person.updatedAt ? new Date(person.updatedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" }) : "Not recorded"} />
      </dl>
    </DialogContent>
    <DialogActions sx={{ p: 2 }}><Button onClick={onClose}>Close</Button><Button variant="contained" startIcon={<EditOutlined />} onClick={onEdit}>Edit profile</Button></DialogActions>
  </Dialog>;
}
