import { HealthAndSafetyRounded } from "@mui/icons-material";
import { Box, Stack, Typography } from "@mui/material";

export interface BrandLogoProps {
  compact?: boolean;
  inverse?: boolean;
  subtitle?: string;
}

export default function BrandLogo({
  compact = false,
  inverse = false,
  subtitle,
}: BrandLogoProps) {
  const iconSize = compact ? 42 : 56;
  const titleSize = compact ? 18 : 24;

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={compact ? 1.1 : 1.4}
      sx={{ minWidth: 0 }}
    >
      <Box
        sx={{
          width: iconSize,
          height: iconSize,
          borderRadius: compact ? "14px" : "18px",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          color: "#FFFFFF",
          background:
            "linear-gradient(135deg, #0F6E8C 0%, #16A085 100%)",
          boxShadow: inverse
            ? "0 10px 26px rgba(0,0,0,0.22)"
            : "0 10px 26px rgba(15,110,140,0.20)",
          border: inverse
            ? "1px solid rgba(255,255,255,0.20)"
            : "1px solid rgba(255,255,255,0.75)",
        }}
      >
        <HealthAndSafetyRounded
          sx={{ fontSize: compact ? 26 : 34 }}
          aria-hidden="true"
        />
      </Box>

      <Box sx={{ minWidth: 0 }}>
        <Typography
          component="div"
          sx={{
            color: inverse ? "#FFFFFF" : "text.primary",
            fontWeight: 900,
            fontSize: titleSize,
            lineHeight: 1.05,
            letterSpacing: "-0.035em",
            whiteSpace: "nowrap",
          }}
        >
          Health
          <Box
            component="span"
            sx={{
              color: inverse ? "#59E2D5" : "primary.main",
            }}
          >
            Mate
          </Box>
        </Typography>

        {subtitle ? (
          <Typography
            component="div"
            sx={{
              mt: 0.35,
              color: inverse
                ? "rgba(255,255,255,0.68)"
                : "text.secondary",
              fontSize: compact ? 11 : 12,
              lineHeight: 1.3,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {subtitle}
          </Typography>
        ) : null}
      </Box>
    </Stack>
  );
}