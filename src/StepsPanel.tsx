import LinearStepperButtonIcon from './LinearStepperButtonIcon';
import DraggablePanel from './DraggablePanel';
import {
  Paper,
  Step,
  StepButton,
  StepConnector,
  StepLabel,
  Stepper,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useEffect, useRef } from 'react';

export enum variants {
  classic = 'classic',
  linear = 'linear',
}

interface StepsPanelProps {
  steps: Array<{
    id: number;
    label: string;
    disabled?: boolean;
    showSinceStep?: number;
  }>;
  activeStep: number;
  allowClickBack?: boolean;
  handleStepClick?: (id: number) => void;
  variant?: variants;
}

export default function StepsPanel({
  activeStep,
  steps,
  allowClickBack,
  handleStepClick,
  variant = variants.classic,
}: StepsPanelProps) {
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));
  const containerRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<(HTMLDivElement | null)[]>([]);

  const handleStepButtonClick = (stepId: number) => {
    if (
      variant === variants.linear ||
      (allowClickBack && stepId < activeStep + 1)
    ) {
      handleStepClick?.(stepId - 1);
    }
  };

  const orientation = !isXs ? 'vertical' : 'horizontal';

  useEffect(() => {
    const calculateTranslation = () => {
      if (
        !containerRef.current ||
        stepsRef.current.length === 0
      )
        return;

      const activeStepElement = stepsRef.current[activeStep];

      if (activeStepElement) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const activeStepRect = activeStepElement.getBoundingClientRect();

        // Calculate the offset of the active step relative to the container
        const leftPadding = activeStepRect.left - containerRect.left;

        // Adjust the scroll position of the container to align with the active step
        containerRef.current.scrollLeft += leftPadding;
      }
    };

    calculateTranslation();
    window.addEventListener('resize', calculateTranslation);

    return () => {
      window.removeEventListener('resize', calculateTranslation);
    };
  }, [activeStep, steps]);

  return (
    <Paper sx={{ overflow: 'hidden' }}>
      <DraggablePanel containerRef={containerRef}>
        <Stepper
          activeStep={activeStep}
          orientation={orientation}
          connector={<StepConnector />}
          sx={{
            flexWrap: 'nowrap',
            minWidth: 'max-content',
          }}
        >
          {steps.map(
            (step, index) =>
              !(step.showSinceStep && step.showSinceStep > activeStep) && (
                <Step
                  key={step.id}
                  disabled={step?.disabled ? true : undefined}
                  ref={el => {
                    stepsRef.current[index] = el;
                  }}
                  completed={
                    variant === variants.classic && index < activeStep
                      ? true
                      : undefined
                  }
                >
                  <StepButton
                    onClick={() => handleStepButtonClick(step.id)}
                    disabled={
                      ((variant !== variants.linear &&
                        !allowClickBack &&
                        index > activeStep) ||
                        step?.disabled)
                        ? true
                        : undefined
                    }
                  >
                    <StepLabel
                      slots={
                        variant === variants.linear
                          ? { stepIcon: () => <LinearStepperButtonIcon /> }
                          : undefined
                      }
                    >
                      {step.label}
                    </StepLabel>
                  </StepButton>
                </Step>
              ),
          )}
        </Stepper>
      </DraggablePanel>
    </Paper>
  );
}
