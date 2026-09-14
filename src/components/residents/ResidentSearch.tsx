import { SearchOutlined } from "@mui/icons-material";
import { InputAdornment, TextField } from "@mui/material";

export default function ResidentSearch({
  value,
  setValue,
}: {
  value: string;
  setValue: (value: string) => void;
}) {
  return (
    <TextField
      label="Search residents"
      placeholder="Name, email, phone, or address"
      fullWidth
      value={value}
      onChange={(event) => setValue(event.target.value)}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchOutlined fontSize="small" />
          </InputAdornment>
        ),
      }}
    />
  );
}
