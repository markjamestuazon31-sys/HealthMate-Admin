import {
  CheckCircleOutlined,
  GroupsOutlined,
  PersonSearchOutlined,
} from "@mui/icons-material";

import {
  Alert,
  Chip,
  Stack,
} from "@mui/material";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import PageHeader from "../components/common/PageHeader";

import ResidentSearch from
  "../components/residents/ResidentSearch";

import ResidentTable from
  "../components/residents/ResidentTable";

import ResidentProfile from
  "./ResidentProfile";

import {
  listenUsers,
} from "../services/userService";

import type {
  User,
} from "../types";

function normalize(
  value: unknown,
): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

/**
 * /users contains normal users, respondents,
 * applicants and sometimes legacy records.
 *
 * Only normal HealthMate users belong on
 * the Residents page.
 */
function isResident(
  user: User,
): boolean {
  const role =
    normalize(user.role);

  /*
   * Keep old user records that did not yet
   * store an explicit role.
   */
  if (!role) {
    return true;
  }

  return (
    role === "user" ||
    role === "resident"
  );
}

function isActiveResident(
  user: User,
): boolean {
  const status =
    normalize(
      user.accountStatus ??
        user.status,
    );

  /*
   * Older user accounts may not contain
   * accountStatus. Treat them as active
   * unless explicitly disabled.
   */
  if (!status) {
    return true;
  }

  return (
    status === "active" ||
    status === "approved"
  );
}

function matchesSearch(
  user: User,
  searchValue: string,
): boolean {
  const query =
    normalize(searchValue);

  if (!query) {
    return true;
  }

  const searchableValues = [
    user.fullName,
    user.email,
    user.phone,
    user.contactNumber,
    user.address,
    user.assignedBarangayId,
    user.uid,
  ];

  return searchableValues.some(
    (value) =>
      normalize(value).includes(query),
  );
}

export default function Residents() {
  const [
    users,
    setUsers,
  ] = useState<User[]>([]);

  const [
    search,
    setSearch,
  ] = useState("");

  /*
   * Store only the UID.
   *
   * When Firebase updates that resident,
   * the profile automatically uses the
   * newest User object from users[].
   */
  const [
    selectedUid,
    setSelectedUid,
  ] = useState<string | null>(
    null,
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");

    try {
      const unsubscribe =
        listenUsers((items) => {
          setUsers(items);
          setLoading(false);
          setError("");
        });

      return typeof unsubscribe ===
        "function"
        ? unsubscribe
        : undefined;
    } catch (caught: unknown) {
      setLoading(false);

      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load HealthMate residents.",
      );

      return undefined;
    }
  }, []);

  /*
   * Keep respondent accounts and respondent
   * applicants completely separate from residents.
   */
  const residents =
    useMemo(
      () =>
        users
          .filter(isResident)
          .sort((first, second) =>
            first.fullName.localeCompare(
              second.fullName,
            ),
          ),
      [users],
    );

  const filteredResidents =
    useMemo(
      () =>
        residents.filter(
          (resident) =>
            matchesSearch(
              resident,
              search,
            ),
        ),
      [
        residents,
        search,
      ],
    );

  const activeCount =
    useMemo(
      () =>
        residents.filter(
          isActiveResident,
        ).length,
      [residents],
    );

  const inactiveCount =
    residents.length -
    activeCount;

  const selectedResident =
    useMemo(
      () =>
        selectedUid
          ? (
              residents.find(
                (resident) =>
                  resident.uid ===
                  selectedUid,
              ) ?? null
            )
          : null,
      [
        residents,
        selectedUid,
      ],
    );

  /*
   * If an account changes role while its
   * profile is open, return to the list.
   */
  useEffect(() => {
    if (
      selectedUid &&
      !selectedResident
    ) {
      setSelectedUid(null);
    }
  }, [
    selectedUid,
    selectedResident,
  ]);

  if (selectedResident) {
    return (
      <ResidentProfile
        user={selectedResident}
        back={() =>
          setSelectedUid(null)
        }
      />
    );
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="HealthMate users"
        title="Residents"
        description={
          "View registered HealthMate users, " +
          "review their emergency medical information, " +
          "and send account or emergency-related notifications."
        }
      />

      {error && (
        <Alert
          severity="error"
          onClose={() =>
            setError("")
          }
        >
          {error}
        </Alert>
      )}

      <Stack
        direction={{
          xs: "column",
          sm: "row",
        }}
        spacing={1}
        useFlexGap
        flexWrap="wrap"
      >
        <Chip
          icon={
            <GroupsOutlined />
          }
          label={
            `${residents.length} registered resident${
              residents.length === 1
                ? ""
                : "s"
            }`
          }
          color="primary"
          variant="outlined"
        />

        <Chip
          icon={
            <CheckCircleOutlined />
          }
          label={
            `${activeCount} active`
          }
          color="success"
          variant="outlined"
        />

        {inactiveCount > 0 && (
          <Chip
            label={
              `${inactiveCount} inactive`
            }
            color="default"
            variant="outlined"
          />
        )}

        {search.trim() && (
          <Chip
            icon={
              <PersonSearchOutlined />
            }
            label={
              `${filteredResidents.length} matching result${
                filteredResidents.length ===
                1
                  ? ""
                  : "s"
              }`
            }
            variant="outlined"
          />
        )}
      </Stack>

      <ResidentSearch
        value={search}
        setValue={setSearch}
      />

      {loading ? (
        <Alert severity="info">
          Loading registered
          residents…
        </Alert>
      ) : (
        <ResidentTable
          users={
            filteredResidents
          }
          onView={(resident) =>
            setSelectedUid(
              resident.uid,
            )
          }
        />
      )}
    </Stack>
  );
}