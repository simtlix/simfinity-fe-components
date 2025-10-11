// Complete MUI Theme Configuration for CustomStepper
// This mimics the exact styles from Stepper.module.css
// Copy this into your theme configuration

import { Components, Theme } from '@mui/material/styles';

export const stepperThemeComponents: Components<Theme> = {
  MuiStepper: {
    styleOverrides: {
      root: {
        marginTop: '20px',
        color: '#ababab',
        width: 'max-content',
      },
    },
  },
  MuiStep: {
    styleOverrides: {
      root: {
        fontWeight: 500,
        // Horizontal orientation
        '&.MuiStep-horizontal': {
          padding: '9px 0 15px 20px',
          marginLeft: 0,
          '& .MuiStepLabel-root': {
            textWrap: 'nowrap',
          },
        },
        // Disabled state
        '& .Mui-disabled': {
          opacity: 0.8,
        },
      },
    },
  },
  MuiStepButton: {
    styleOverrides: {
      root: {
        // Active state styling for linear variant
        '&.Mui-active': {
          backgroundColor: 'var(--color-soft-frost)',
          borderRadius: '12px',
        },
        // Vertical orientation padding
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
        fontFamily: 'var(--font-proxima-nova)',
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
      },
    },
  },
  MuiStepIcon: {
    styleOverrides: {
      root: {
        fill: '#9a9da9',
        // Active state fill
        '.Mui-active &': {
          fill: 'var(--color-teal)',
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
      lineVertical: {
        visibility: 'hidden',
        minHeight: 0,
      },
    },
  },
};

// Usage example:
/*
import { createTheme } from '@mui/material/styles';
import { stepperThemeComponents } from './stepper-theme-config';

const theme = createTheme({
  components: {
    ...stepperThemeComponents,
    // ... your other component overrides
  },
  // ... rest of your theme configuration
});
*/

