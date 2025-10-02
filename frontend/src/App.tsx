import React, { useState } from "react";
import { Container } from "@mui/material";
import FileUpload from "./components/FileUpload";
import ProductTable from "./components/ProductTable";

const App: React.FC = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleFetchError = (error: string) => {
    console.error(error);
  };

  const handleUploadSuccess = () => {
    console.log("Upload successful, refreshing table...");
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <Container>
      <FileUpload onUploadSuccess={handleUploadSuccess} />
      <ProductTable 
        onFetchError={handleFetchError} 
        refreshTrigger={refreshTrigger}
      />
    </Container>
  );
};

export default App;