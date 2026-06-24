import { createTheme } from '@mui/material/styles'

export const theme = createTheme({
  palette: {
    primary: {
      main: '#171A31',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#F05A22',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#F4F4F6',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#171A31',
      secondary: '#5A5D72',
    },
    error: { main: '#F05A22' },
    warning: { main: '#F05A22' },
  },
  typography: {
    fontFamily: '"Noto Sans JP", "Roboto", "Helvetica Neue", Arial, sans-serif',
    h6: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600 },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: { backgroundColor: '#171A31', color: '#FFFFFF' },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: { backgroundColor: '#171A31' },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { borderRadius: 12 },
      },
    },
  },
})
