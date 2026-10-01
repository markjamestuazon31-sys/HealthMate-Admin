import {
  CheckCircleRounded, CloseRounded, EditOutlined, HealthAndSafetyOutlined,
  HomeOutlined, LocationOnOutlined, PersonOutlined, RemoveCircleOutlineRounded,
} from "@mui/icons-material";
import {
  Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, useMediaQuery, useTheme,
} from "@mui/material";
import type { ReactNode } from "react";
import type { Household } from "../../types";
import { ageOn, personLocation, SOCIAL_FIELDS, type RegistryInhabitant } from "../../services/inhabitantModel";
import { money } from "./HouseholdProfileDialog";
import "./InhabitantProfileDialog.css"; // <- this import is what makes the styles load

/* ---------- small helpers ---------- */

const initials = (name?: string) => {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return ((parts[0][0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : parts[0][1] || "")).toUpperCase();
};

const isEmpty = (v: unknown) => v === undefined || v === null || String(v).trim() === "";

function Field({ label, value, wide }: { label: string; value?: ReactNode; wide?: boolean }) {
  const empty = isEmpty(value);
  return (
    <div className={`ip-field${wide ? " ip-field--wide" : ""}`}>
      <dt>{label}</dt>
      <dd className={empty ? "ip-empty" : undefined}>{empty ? "Not recorded" : value}</dd>
    </div>
  );
}

function Section({ icon, title, hint, children }: { icon: ReactNode; title: string; hint: string; children: ReactNode }) {
  return (
    <section className="ip-section">
      <header className="ip-section-head">
        <span className="ip-section-icon">{icon}</span>
        <div>
          <h3>{title}</h3>
          <p>{hint}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function Flag({ label, value }: { label: string; value: boolean | null | undefined }) {
  const state = value === true ? "yes" : value === false ? "no" : "unknown";
  return (
    <li className={`ip-flag ip-flag--${state}`}>
      {state === "yes" ? <CheckCircleRounded fontSize="small" /> : <RemoveCircleOutlineRounded fontSize="small" />}
      <span className="ip-flag-label">{label}</span>
      <span className="ip-flag-value">{state === "yes" ? "Yes" : state === "no" ? "No" : "Not recorded"}</span>
    </li>
  );
}

/* ---------- component ---------- */

export default function InhabitantProfileDialog({ person, household, onClose, onEdit }: {
  person: RegistryInhabitant; household?: Household; onClose: () => void; onEdit: () => void;
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const location = personLocation(person, household);
  const age = ageOn(person.birthDate);
  const ageText = age === null ? "Age not recorded" : `${age} years old`;
  const status = (person.status || "unknown").toString();
  const isSenior = age !== null && age >= 60;

  return (
    <Dialog className="ip-dialog" open onClose={onClose} fullWidth maxWidth="md" fullScreen={fullScreen}
            aria-labelledby="ip-profile-title">
      <DialogTitle component="div" className="ip-header">
        <div className="ip-avatar" aria-hidden>{initials(person.fullName)}</div>

        <div className="ip-header-main">
          <h2 id="ip-profile-title" className="ip-name">{person.fullName}</h2>
          <div className="ip-badges">
            <span className={`ip-badge ip-badge--${status.toLowerCase() === "active" ? "active" : "muted"}`}>{status}</span>
            <span className="ip-badge">{ageText}</span>
            {person.sex && <span className="ip-badge">{person.sex}</span>}
            {isSenior && <span className="ip-badge ip-badge--senior">Senior citizen</span>}
          </div>
          <p className="ip-address">
            <LocationOnOutlined fontSize="small" />
            {location.address || "Address not recorded"}
          </p>
        </div>

        <IconButton className="ip-close" onClick={onClose} aria-label="Close profile">
          <CloseRounded />
        </IconButton>
      </DialogTitle>

      <dl className="ip-summary">
        <Field label="Household" value={household?.householdName} />
        <Field label="Birthday" value={person.birthDate} />
        <Field label="Contact" value={person.phone} />
        <Field label="Occupation" value={person.occupation} />
      </dl>

      <DialogContent className="ip-content">
        <Section icon={<PersonOutlined />} title="Personal information" hint="Identity and resident details">
          <dl className="ip-grid">
            <Field label="Civil status" value={person.civilStatus} />
            <Field label="Citizenship" value={person.citizenship} />
            <Field label="Nationality / details" value={person.nationality} />
            <Field label="Purok" value={location.purokId} />
            <Field label="Employment status" value={person.employmentStatus} />
            <Field label="Monthly income" value={money(person.monthlyIncome)} />
            <Field label="Address" value={location.address} wide />
          </dl>
        </Section>

        <Section icon={<HomeOutlined />} title="Household information" hint="Family and household relationship">
          <dl className="ip-grid">
            <Field label="Household" value={household?.householdName} />
            <Field label="Family number" value={person.familyNumber} />
            <Field label="Relationship to head" value={person.relationshipToHead} />
            <Field label="School attendance" value={person.schoolAttendance} />
          </dl>
        </Section>

        <Section icon={<HealthAndSafetyOutlined />} title="Health and social data" hint="Social classification and medical notes">
          <ul className="ip-flags">
            <Flag label="Senior citizen (60+)" value={age === null ? null : isSenior} />
            {SOCIAL_FIELDS.map(([key, label]) => (
              <Flag key={key} label={label} value={person[key] as boolean | null | undefined} />
            ))}
          </ul>

          <dl className="ip-grid ip-grid--notes">
            <Field label="Health conditions" value={person.medicalConditions} wide />
            <Field label="Medical history" value={person.medicalHistory} wide />
            <Field label="Past treatments" value={person.pastTreatments} wide />
            <Field label="Emergency notes" value={person.emergencyNotes} wide />
            <Field label="Profiling remarks" value={person.profileNotes} wide />
            <Field
              label="Last updated"
              value={person.updatedAt ? new Date(person.updatedAt).toLocaleString("en-PH") : undefined}
            />
          </dl>
        </Section>
      </DialogContent>

      <DialogActions className="ip-footer">
        <Button className="ip-btn-ghost" onClick={onClose}>Close</Button>
        <Button className="ip-btn-primary" variant="contained" disableElevation startIcon={<EditOutlined />} onClick={onEdit}>
          Edit profile
        </Button>
      </DialogActions>
    </Dialog>
  );
}
