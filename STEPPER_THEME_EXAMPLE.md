# Stepper Theme Customization Example

This guide shows how to style the CustomStepper component using MUI theme customization instead of CSS modules.

## Complete Theme Configuration

```typescript
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          // Styles for the Paper wrapper (if needed)
        },
      },
    },
    MuiStepper: {
      styleOverrides: {
        root: {
          marginTop: '20px',
          color: '#ababab',
          width: 'max-content',
        },
        vertical: {
          // Vertical orientation styles
        },
        horizontal: {
          // Horizontal orientation styles
        },
      },
    },
    MuiStep: {
      styleOverrides: {
        root: {
          fontWeight: 500,
          // For horizontal steps
          '&.MuiStep-horizontal': {
            padding: '9px 0 15px 20px',
            marginLeft: 0,
            '& .MuiStepLabel-root': {
              textWrap: 'nowrap',
            },
          },
        },
      },
    },
    MuiStepButton: {
      styleOverrides: {
        root: {
          // Linear variant active state
          '&.Mui-active': {
            backgroundColor: 'var(--color-soft-frost)', // or use theme.palette
            borderRadius: '12px',
            '& svg': {
              fill: 'var(--color-teal)',
            },
          },
          // Linear variant padding for vertical orientation
          '.MuiStepper-vertical &': {
            '& span': {
              padding: '0 5px',
            },
            '& .MuiStepLabel-label': {
              width: '152px',
            },
          },
        },
      },
    },
    MuiStepLabel: {
      styleOverrides: {
        root: {
          cursor: 'pointer',
        },
        label: {
          fontFamily: 'var(--font-proxima-nova)', // or use theme.typography.fontFamily
          fontSize: '14px',
          lineHeight: '16px',
          fontWeight: 700,
          color: '#ababab',
          // Active state
          '&.Mui-active': {
            color: 'var(--color-teal)',
          },
          // Completed state
          '&.Mui-completed': {
            color: 'var(--color-teal)',
            opacity: 0.6,
          },
          // Disabled state
          '&.Mui-disabled': {
            opacity: 0.8,
          },
        },
      },
    },
    MuiStepIcon: {
      styleOverrides: {
        root: {
          // Default icon color for linear variant
          '.MuiStepper-root &': {
            fill: '#9a9da9',
          },
        },
        text: {
          fontFamily: 'var(--font-dm-mono)',
          fontSize: '14px',
        },
      },
    },
    MuiStepConnector: {
      styleOverrides: {
        root: {
          // Minimum height for connectors
          minHeight: '16px',
        },
        line: {
          minHeight: '16px',
        },
        lineHorizontal: {
          display: 'block',
          borderColor: '#bdbdbd',
          borderLeftStyle: 'solid',
          borderLeftWidth: '1px',
          margin: '0 12px',
          minHeight: '16px',
          borderTopWidth: '0px !important',
        },
        // For vertical orientation, hide the line
        lineVertical: {
          visibility: 'hidden',
          minHeight: 0,
        },
      },
    },
  },
});

export default theme;
```

## Usage with Theme Provider

```typescript
import { ThemeProvider } from '@mui/material/styles';
import CustomStepper from './Stepper';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CustomStepper
        steps={[
          { id: 1, label: 'Step 1' },
          { id: 2, label: 'Step 2' },
          { id: 3, label: 'Step 3' },
        ]}
        activeStep={0}
        variant="classic"
      />
    </ThemeProvider>
  );
}
```

## Variant-Specific Customization

If you need different styles for `classic` vs `linear` variants, you can use conditional styling or data attributes:

```typescript
// In your theme
MuiStepper: {
  styleOverrides: {
    root: ({ ownerState }) => ({
      ...(ownerState.variant === 'linear' && {
        '& .MuiStep-root': {
          margin: '9px',
        },
        '& .MuiStepButton-root': {
          '& .MuiStepLabel-label': {
            fontWeight: 700,
          },
        },
      }),
    }),
  },
},
```

## Using Theme Colors Instead of CSS Variables

Replace CSS variables with theme palette:

```typescript
const theme = createTheme({
  palette: {
    primary: {
      main: '#00bcd4', // teal color
    },
    text: {
      secondary: '#ababab',
    },
  },
  typography: {
    fontFamily: 'Proxima Nova, Arial, sans-serif',
  },
  components: {
    MuiStepLabel: {
      styleOverrides: {
        label: {
          color: ({ theme }) => theme.palette.text.secondary,
          '&.Mui-active': {
            color: ({ theme }) => theme.palette.primary.main,
          },
          '&.Mui-completed': {
            color: ({ theme }) => theme.palette.primary.main,
            opacity: 0.6,
          },
        },
      },
    },
  },
});
```

## Notes

- Remove or delete `Stepper.module.css` as it's no longer needed
- The `classnames` package dependency can also be removed if not used elsewhere
- All styling is now controlled through the MUI theme
- For responsive styles, use theme breakpoints:

```typescript
MuiStep: {
  styleOverrides: {
    root: ({ theme }) => ({
      [theme.breakpoints.down('sm')]: {
        // Mobile styles
      },
      [theme.breakpoints.up('md')]: {
        // Desktop styles
      },
    }),
  },
},
```

