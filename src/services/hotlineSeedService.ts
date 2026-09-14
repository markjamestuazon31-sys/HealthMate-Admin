import { push, ref, update } from "firebase/database";
import { auth, database } from "../firebase/config";
import type { EmergencyContactCategory } from "../types";

interface HotlineSeedRecord {
  shortName: string;
  organizationName: string;
  category: EmergencyContactCategory;
  phone: string;
  alternatePhone: string;
  email: string;
  address: string;
  active: true;
  displayOrder: number;
}

const CATBALOGAN_HOTLINES: Record<string, HotlineSeedRecord> = {
  chd: {
    shortName: "CHD",
    organizationName: "City Health Department",
    category: "HEALTH_CENTER",
    phone: "0956-258-1508",
    alternatePhone: "",
    email: "",
    address: "Catbalogan City, Samar",
    active: true,
    displayOrder: 10,
  },
  cdrrmo: {
    shortName: "CDRRMO",
    organizationName: "City Disaster Risk Reduction and Management Office",
    category: "DISASTER_OFFICE",
    phone: "0935-713-5886",
    alternatePhone: "(055) 543-9644",
    email: "catbalogancdrrmo@gmail.com",
    address: "Kamaandam Katbalogan Center, Brgy. 6, Catbalogan City, Samar",
    active: true,
    displayOrder: 20,
  },
  bfp: {
    shortName: "BFP",
    organizationName: "Bureau of Fire Protection - Catbalogan City Fire Station",
    category: "FIRE",
    phone: "0995-532-2202",
    alternatePhone: "",
    email: "",
    address: "Catbalogan City, Samar",
    active: true,
    displayOrder: 30,
  },
  pnp: {
    shortName: "PNP",
    organizationName: "Philippine National Police - Catbalogan Police Station",
    category: "POLICE",
    phone: "0905-310-7114",
    alternatePhone: "",
    email: "",
    address: "Catbalogan City, Samar",
    active: true,
    displayOrder: 40,
  },
  redCross: {
    shortName: "RED CROSS",
    organizationName: "Philippine Red Cross - Western Samar Chapter",
    category: "RED_CROSS",
    phone: "0995-1818-755",
    alternatePhone: "",
    email: "",
    address: "Western Samar",
    active: true,
    displayOrder: 50,
  },
  tcc: {
    shortName: "TCC",
    organizationName: "Tubig Catbalogan Corporation",
    category: "WATER",
    phone: "0917-707-2643",
    alternatePhone: "",
    email: "",
    address: "Catbalogan City, Samar",
    active: true,
    displayOrder: 60,
  },
  samelco2: {
    shortName: "SAMELCO II",
    organizationName: "Samar II Electric Cooperative, Inc.",
    category: "ELECTRICITY",
    phone: "0927-492-4901",
    alternatePhone: "",
    email: "",
    address: "Samar",
    active: true,
    displayOrder: 70,
  },
  cswdo: {
    shortName: "CSWDO",
    organizationName: "Catbalogan City Social Welfare and Development Office",
    category: "SOCIAL_WELFARE",
    phone: "0917-831-9458",
    alternatePhone: "",
    email: "",
    address: "Catbalogan City, Samar",
    active: true,
    displayOrder: 80,
  },
};

export async function seedCatbaloganHotlines() {
  const actor = auth.currentUser;
  if (!actor) throw new Error("Your administrator session has expired.");

  const now = Date.now();
  const updates: Record<string, unknown> = {};
  for (const [id, contact] of Object.entries(CATBALOGAN_HOTLINES)) {
    updates[`globalEmergencyContacts/${id}`] = {
      ...contact,
      createdAt: now,
      updatedAt: now,
      updatedBy: actor.uid,
    };
  }
  const auditId = push(ref(database, "auditLogs")).key;
  if (auditId) {
    updates[`auditLogs/${auditId}`] = {
      action: "Catbalogan emergency hotline seed imported",
      performedBy: actor.uid,
      details: `${Object.keys(CATBALOGAN_HOTLINES).length} general contacts imported from the supplied hotline image`,
      timestamp: now,
    };
  }
  await update(ref(database), updates);
}
