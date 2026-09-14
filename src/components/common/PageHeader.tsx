import { Box, Stack, Typography } from "@mui/material";

export default function PageHeader({
  title,
  description,
  action,
  eyebrow,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      justifyContent="space-between"
      alignItems={{ xs: "flex-start", sm: "center" }}
      spacing={2}
    >
      <Box sx={{ minWidth: 0 }}>
        {eyebrow && (
          <Typography variant="overline" color="primary.main" sx={{ fontWeight: 900, letterSpacing: 1.2 }}>
            {eyebrow}
          </Typography>
        )}
        <Typography variant="h4" sx={{ letterSpacing: -0.8 }}>{title}</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.7, maxWidth: 760, lineHeight: 1.65 }}>
          {description}
        </Typography>
      </Box>
      {action}
    </Stack>
  );
}
