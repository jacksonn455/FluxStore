import React from 'react';
import { Alert, Snackbar } from '@mui/material';

const SuccessMessage: React.FC = () => {
  return (
    <Snackbar open={true} autoHideDuration={5000}>
      <Alert severity="success" sx={{ width: '100%' }}>
        File uploaded and processed successfully!
      </Alert>
    </Snackbar>
  );
};

export default SuccessMessage;