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
import "./InhabitantProfileDialog.css"; // required: this import loads the styles

/* ---------- helpers ---------- */

const initials = (name?: string) => {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0][0] || "";
  const second = parts.length > 1 ? parts[parts.length - 1][0] : parts[0][1] || "";
  return (first + second).toUpperCase();
};

const isEmpty = (v: unknown) => v === undefined || v === null || String(v).trim() === "";

function Field({ label, value, wide }: { label: string; value?: ReactNode; wide?: boolean }) {
  const empty = isEmpty(value);
  return (
    <div className={`ipd-field${wide ? " ipd-field--wide" : ""}`}>
      <dt>{label}</dt>
      <dd className={empty ? "ipd-field-empty" : undefined}>{empty ? "Not recorded" : value}</dd>
    </div>
  );
}

function Section({ icon, title, hint, children }: { icon: ReactNode; title: string; hint: string; children: ReactNode }) {
  return (
    <section className="ipd-section">
      <header className="ipd-section-head">
        <span className="ipd-section-icon">{icon}</span>
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
    <li className={`ipd-flag ipd-flag--${state}`}>
      {state === "yes" ? <CheckCircleRounded fontSize="small" /> : <RemoveCircleOutlineRounded fontSize="small" />}
      <span className="ipd-flag-label">{label}</span>
      <span className="ipd-flag-value">{state === "yes" ? "Yes" : state === "no" ? "No" : "Not recorded"}</span>
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
  const status = String(person.status || "unknown");
  const isSenior = age !== null && age >= 60;

  return (
    <Dialog
      className="ipd-dialog"
      open
      onClose={onClose}
      fullWidth
      maxWidth="md"
      fullScreen={fullScreen}
      aria-labelledby="ipd-profile-title"
    >
      <DialogTitle component="div" className="ipd-header">
        <div className="ipd-avatar" aria-hidden>{initials(person.fullName)}</div>

        <div className="ipd-header-main">
          <h2 id="ipd-profile-title" className="ipd-name">{person.fullName}</h2>
          <div className="ipd-badges">
            <span className={`ipd-badge ${status.toLowerCase() === "active" ? "ipd-badge--active" : ""}`}>{status}</span>
            <span className="ipd-badge">{ageText}</span>
            {person.sex && <span className="ipd-badge">{person.sex}</span>}
            {isSenior && <span className="ipd-badge ipd-badge--senior">Senior citizen</span>}
          </div>
          <p className="ipd-address">
            <LocationOnOutlined fontSize="small" />
            {location.address || "Address not recorded"}
          </p>
        </div>

        <IconButton className="ipd-close" onClick={onClose} aria-label="Close profile">
          <CloseRounded />
        </IconButton>
      </DialogTitle>

      <dl className="ipd-summary">
        <Field label="Household" value={household?.householdName} />
        <Field label="Birthday" value={person.birthDate} />
        <Field label="Contact" value={person.phone} />
        <Field label="Occupation" value={person.occupation} />
      </dl>

      <DialogContent className="ipd-content">
        <Section icon={<PersonOutlined />} title="Personal information" hint="Identity and resident details">
          <dl className="ipd-grid">
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
          <dl className="ipd-grid">
            <Field label="Household" value={household?.householdName} />
            <Field label="Family number" value={person.familyNumber} />
            <Field label="Relationship to head" value={person.relationshipToHead} />
            <Field label="School attendance" value={person.schoolAttendance} />
          </dl>
        </Section>

        <Section icon={<HealthAndSafetyOutlined />} title="Health and social data" hint="Social classification and medical notes">
          <ul className="ipd-flags">
            <Flag label="Senior citizen (60+)" value={age === null ? null : isSenior} />
            {SOCIAL_FIELDS.map(([key, label]) => (
              <Flag key={key} label={label} value={person[key] as boolean | null | undefined} />
            ))}
          </ul>

          <dl className="ipd-grid">
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

      <DialogActions className="ipd-footer">
        <Button className="ipd-btn-ghost" onClick={onClose}>Close</Button>
        <Button
          className="ipd-btn-primary"
          variant="contained"
          disableElevation
          startIcon={<EditOutlined />}
          onClick={onEdit}
        >
          Edit profile
        </Button>
      </DialogActions>
    </Dialog>
  );
}
