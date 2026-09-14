import { Autocomplete, Avatar, Box, Chip, Stack, TextField, Typography } from "@mui/material";
import type { User } from "../../types";

interface ResidentAccountPickerProps {
  users: User[];
  valueUid?: string;
  excludedUids?: Set<string>;
  currentUid?: string;
  label?: string;
  helperText?: string;
  onChange: (user: User | null) => void;
}

function isResident(user: User) {
  const role = String(user.role ?? "").trim().toLowerCase();
  return !role || role === "user" || role === "resident";
}

function isDisabled(user: User) {
  return ["disabled", "revoked", "suspended"].includes(String(user.accountStatus ?? "").toLowerCase());
}

export default function ResidentAccountPicker({
  users,
  valueUid = "",
  excludedUids = new Set<string>(),
  currentUid = "",
  label = "Search registered resident",
  helperText = "Search by name, email, or mobile number. Leave empty for a resident without the app.",
  onChange,
}: ResidentAccountPickerProps) {
  const options = users.filter(isResident);
  const value = options.find((user) => user.uid === valueUid) ?? null;

  return (
    <Autocomplete
      options={options}
      value={value}
      onChange={(_, next) => onChange(next)}
      getOptionLabel={(option) => option.fullName}
      isOptionEqualToValue={(option, selected) => option.uid === selected.uid}
      getOptionDisabled={(option) => isDisabled(option) || (option.uid !== currentUid && (Boolean(option.inhabitantId) || excludedUids.has(option.uid)))}
      filterOptions={(items, state) => {
        const query = state.inputValue.trim().toLowerCase();
        if (!query) return items;
        return items.filter((item) => [item.fullName, item.email, item.phone, item.contactNumber]
          .some((field) => String(field ?? "").toLowerCase().includes(query)));
      }}
      noOptionsText="No resident account found"
      renderInput={(params) => <TextField {...params} label={label} helperText={helperText} />}
      renderOption={(props, option) => {
        const unavailable = isDisabled(option) || (option.uid !== currentUid && (Boolean(option.inhabitantId) || excludedUids.has(option.uid)));
        return (
          <li {...props} key={option.uid}>
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ width: "100%", py: .4 }}>
              <Avatar src={option.profileImage} sx={{ width: 36, height: 36, bgcolor: "primary.main", fontSize: 14 }}>
                {option.fullName.slice(0, 2).toUpperCase()}
              </Avatar>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography fontWeight={800} noWrap>{option.fullName}</Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {[option.email, option.contactNumber ?? option.phone].filter(Boolean).join(" · ") || "No contact details"}
                </Typography>
              </Box>
              <Chip
                size="small"
                color={unavailable ? "default" : "success"}
                variant={unavailable ? "outlined" : "filled"}
                label={isDisabled(option) ? "Disabled" : unavailable ? "Already linked" : "Available"}
              />
            </Stack>
          </li>
        );
      }}
    />
  );
}
