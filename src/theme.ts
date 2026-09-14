import { alpha, createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#0B5ED7",
      dark: "#084BAF",
      light: "#5B8DEF",
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: "#0B2F5B",
      dark: "#08284E",
      light: "#365E88",
      contrastText: "#FFFFFF",
    },
    error: {
      main: "#D92D20",
      dark: "#B42318",
      light: "#F97066",
      contrastText: "#FFFFFF",
    },
    warning: {
      main: "#F79009",
      dark: "#DC6803",
      light: "#FDB022",
      contrastText: "#FFFFFF",
    },
    success: {
      main: "#039855",
      dark: "#027A48",
      light: "#12B76A",
      contrastText: "#FFFFFF",
    },
    info: {
      main: "#0B5ED7",
      dark: "#084BAF",
      light: "#5B8DEF",
      contrastText: "#FFFFFF",
    },
    background: {
      default: "#F7F8FA",
      paper: "#FFFFFF",
    },
    text: {
      primary: "#102A43",
      secondary: "#62748A",
    },
    divider: "#E4E7EC",
  },

  shape: {
    borderRadius: 14,
  },

  typography: {
    fontFamily: 'Inter, "Segoe UI", Roboto, Arial, sans-serif',
    h1: { fontWeight: 900, letterSpacing: -1.7 },
    h2: { fontWeight: 900, letterSpacing: -1.4 },
    h3: { fontWeight: 900, letterSpacing: -1.1 },
    h4: { fontWeight: 880, letterSpacing: -0.8 },
    h5: { fontWeight: 850, letterSpacing: -0.45 },
    h6: { fontWeight: 830, letterSpacing: -0.2 },
    button: {
      fontWeight: 800,
      textTransform: "none",
      letterSpacing: 0.05,
    },
  },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          minWidth: 320,
        },
        "*": {
          boxSizing: "border-box",
        },
      },
    },

    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
        rounded: {
          borderRadius: 18,
        },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          border: "1px solid #E4E7EC",
          boxShadow: "0 8px 26px rgba(16, 42, 67, 0.055)",
          overflow: "hidden",
        },
      },
    },

    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 10,
          minHeight: 40,
          paddingInline: 16,
        },
        contained: {
          boxShadow: "0 6px 16px rgba(11, 94, 215, 0.16)",
        },
      },
    },

    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
        label: {
          fontWeight: 720,
        },
      },
    },

    MuiTextField: {
      defaultProps: {
        size: "small",
      },
    },

    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 11,
          backgroundColor: "#FFFFFF",
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: alpha("#0B5ED7", 0.55),
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#0B5ED7",
          },
        },
      },
    },

    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: "#F8FAFC",
        },
      },
    },

    MuiTableCell: {
      styleOverrides: {
        head: {
          color: "#52667A",
          fontWeight: 850,
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: 0.55,
          borderBottomColor: "#E4E7EC",
        },
        body: {
          borderBottomColor: "#EEF2F6",
        },
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 22,
          boxShadow: "0 32px 90px rgba(16, 24, 40, 0.28)",
        },
      },
    },

    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          borderRadius: 8,
          fontWeight: 650,
        },
      },
    },
  },
});

export default theme;