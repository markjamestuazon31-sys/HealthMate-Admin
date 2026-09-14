import { Avatar, Badge, Box } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { mobileProfileImageSource } from "../../utils/imageData";

function initials(name?: string) {
  const parts = (name?.trim() || "HM").split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : parts[0].slice(0, 2)).toUpperCase();
}

export default function EmergencyAvatar({
  name,
  profileImage,
  size = 48,
  active = true,
  pulse = false,
}: {
  name?: string;
  profileImage?: string;
  size?: number;
  active?: boolean;
  pulse?: boolean;
}) {
  const source = mobileProfileImageSource(profileImage);
  const avatar = (
    <Avatar
      src={source || undefined}
      alt={name || "HealthMate emergency patient"}
      sx={{
        width: size,
        height: size,
        bgcolor: active ? "error.dark" : "grey.500",
        color: "common.white",
        fontWeight: 900,
        fontSize: Math.max(13, size * 0.31),
        border: `${Math.max(2, Math.round(size / 20))}px solid #fff`,
        boxShadow: `0 0 0 2px ${alpha(active ? "#D92D20" : "#667085", 0.2)}`,
      }}
    >
      {initials(name)}
    </Avatar>
  );

  return (
    <Box className={pulse && active ? "hm-emergency-avatar-pulse" : undefined} sx={{ display: "inline-flex" }}>
      <Badge
        overlap="circular"
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        variant="dot"
        color={active ? "error" : "default"}
        sx={{ "& .MuiBadge-badge": { width: 11, height: 11, borderRadius: "50%", border: "2px solid #fff" } }}
      >
        {avatar}
      </Badge>
    </Box>
  );
}
