"use strict";

const assert = require("node:assert/strict");
const {
  normalizeEmail,
  encodeEmailKey,
  validateProvisionInput,
  buildRespondentRecords,
} = require("./respondentProvisioningPolicy");

assert.equal(normalizeEmail(" Ken@Respondent.com "), "ken@respondent.com");
assert.equal(encodeEmailKey("ken@respondent.com"), Buffer.from("ken@respondent.com", "utf8").toString("base64url"));
assert.throws(
  () => validateProvisionInput({ email: "ken@example.com", temporaryPassword: "Kenken123", fullName: "Ken", phone: "0917123", assignedBarangayId: "B1" }),
  /@respondent\.com/,
);
assert.throws(
  () => validateProvisionInput({ email: "ken@respondent.com", temporaryPassword: "short", fullName: "Ken", phone: "0917123", assignedBarangayId: "B1" }),
  /at least 8/,
);

const records = buildRespondentRecords({
  uid: "uid-1",
  actorUid: "admin-1",
  now: 123,
  email: "ken@respondent.com",
  fullName: "Ken Respondent",
  phone: "09171234567",
  position: "Emergency Respondent",
  assignedBarangayId: "barangay-1",
  serviceArea: "Zone 1",
  invitationKey: "email-key",
  existingInvitation: null,
  existingUser: { profileImage: "base64-face", qrCode: "qr-existing", createdAt: 50 },
  existingRespondent: { address: "Existing address", availability: "AVAILABLE", createdAt: 60 },
});
assert.equal(records.user.role, "responder");
assert.equal(records.user.accountStatus, "active");
assert.equal(records.user.profileImage, "base64-face");
assert.equal(records.user.qrCode, "qr-existing");
assert.equal(records.user.createdAt, 50);
assert.equal(records.respondent.authUid, "uid-1");
assert.equal(records.respondent.address, "Existing address");
assert.equal(records.respondent.availability, "AVAILABLE");
assert.equal(records.invitation.status, "REGISTERED");
assert.equal(records.invitation.registeredUid, "uid-1");
assert.equal(records.dispatch.active, true);
assert.equal(records.dispatch.availability, "AVAILABLE");
assert.equal(Object.prototype.hasOwnProperty.call(records.user, "temporaryPassword"), false);

console.log("respondentProvisioningPolicy tests passed");
