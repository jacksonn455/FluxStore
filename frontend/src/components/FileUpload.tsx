import React, { useState, ChangeEvent, useEffect } from "react";
import { Button, LinearProgress, Typography, Box } from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import api from "../services/api";

interface FileUploadProps {
  onUploadSuccess: () => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onUploadSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setProgress(0);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await api.post("/products/upload", formData, {
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setProgress(percent);
          }
        },
      });
      console.log("Upload response:", response.data);
      setProcessing(true);

      startPolling();
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        "Upload failed. Please try again.";
      setError(errorMessage);
      console.error("Upload error:", err.response?.data || err);
    } finally {
      setUploading(false);
      setFile(null);
    }
  };

  const startPolling = async () => {
    let attempts = 0;
    const maxAttempts = 300;

    const poll = async () => {
      try {
        const response = await api.get("/products/count");
        const totalProducts = response.data.total;

        if (totalProducts > 0) {
          setProcessing(false);
          onUploadSuccess();
          return true;
        }

        attempts++;
        if (attempts >= maxAttempts) {
          setProcessing(false);
          setError("Processing timeout. Please check the server.");
          return true;
        }

        return false;
      } catch (err) {
        console.error("Polling error:", err);
        attempts++;
        if (attempts >= maxAttempts) {
          setProcessing(false);
          setError("Error during processing monitoring.");
          return true;
        }
        return false;
      }
    };

    const executePoll = async () => {
      const shouldStop = await poll();
      if (!shouldStop) {
        setTimeout(executePoll, 5000);
      }
    };

    executePoll();
  };

  return (
    <Box>
      <input
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        style={{ display: "none" }}
        id="csv-upload"
      />
      <label htmlFor="csv-upload">
        <Button
          variant="contained"
          component="span"
          startIcon={<UploadFileIcon />}
        >
          Select CSV File
        </Button>
      </label>
      {file && <Typography sx={{ mt: 1 }}>Selected: {file.name}</Typography>}
      <Button
        variant="contained"
        color="primary"
        onClick={handleUpload}
        disabled={!file || uploading || processing}
        sx={{ mt: 2 }}
      >
        Upload
      </Button>
      {uploading && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress variant="determinate" value={progress} />
          <Typography>{progress}% Uploading...</Typography>
        </Box>
      )}
      {processing && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress />
          <Typography>
            Processing data (this may take a few minutes for large files)...
          </Typography>
        </Box>
      )}
      {error && (
        <Typography color="error" sx={{ mt: 2 }}>
          {error}
        </Typography>
      )}
    </Box>
  );
};

export default FileUpload;
