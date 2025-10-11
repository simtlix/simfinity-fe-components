import { SvgIcon } from '@mui/material';
import { useTheme } from '@mui/material/styles';

export default function LinearStepperButtonIcon(props: any) {
  const theme = useTheme();
  
  return (
    <SvgIcon {...props}>
      <rect width="24" height="24" rx="12" fill={theme.palette.primary.main} fillOpacity={0.5}/>
      <circle cx="12.0005" cy="12.0005" r="3.44189" fill="white"/>
    </SvgIcon>
  );
}
