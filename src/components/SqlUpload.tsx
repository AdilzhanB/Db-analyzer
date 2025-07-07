import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Box, Typography, Paper, Button, CircularProgress, Stack, Alert } from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import StorageIcon from '@mui/icons-material/Storage';

interface SqlUploadProps {
  onFile: (file: File) => void;
}

const SqlUpload: React.FC<SqlUploadProps> = ({ onFile }) => {
  const [loading, setLoading] = useState(false);
  const [dragError, setDragError] = useState<string | null>(null);
  
  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    accept: {
      'application/x-sqlite3': ['.sqlite', '.db'],
      'application/sql': ['.sql'],
      'application/octet-stream': ['.sqlite', '.db', '.sql'],
    },
    multiple: false,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setLoading(true);
        setDragError(null);
        // Simulate a small delay for better UX
        setTimeout(() => {
          onFile(acceptedFiles[0]);
          setLoading(false);
        }, 800);
      }
    },
    onDropRejected: () => {
      setDragError('Invalid file type. Only .sqlite, .db, and .sql files are supported.');
    },
  });

  return (
    <Box sx={{ mt: 2, mb: 4 }} className="slideUp">
      <Paper 
        {...getRootProps()} 
        elevation={3}
        sx={{ 
          p: 6, 
          textAlign: 'center', 
          border: '2px dashed',
          borderColor: isDragReject ? 'error.main' : isDragActive ? 'primary.main' : 'divider',
          background: isDragActive ? 'rgba(37, 99, 235, 0.05)' : '#fff', 
          cursor: 'pointer',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            borderColor: 'primary.main',
            background: 'rgba(37, 99, 235, 0.05)'
          },
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 2
        }}
      >
        <input {...getInputProps()} />
        
        {loading ? (
          <CircularProgress size={48} color="primary" />
        ) : (
          <>
            <Box sx={{ p: 2, mb: 2, borderRadius: '50%', bgcolor: 'primary.light', color: 'primary.main', display: 'inline-flex' }}>
              {isDragActive ? (
                <CloudUploadIcon sx={{ fontSize: 48 }} />
              ) : (
                <StorageIcon sx={{ fontSize: 48 }} />
              )}
            </Box>
            
            <Typography variant="h5" gutterBottom fontWeight={600}>
              {isDragActive 
                ? 'Drop your database file here...' 
                : 'Upload your SQLite database'}
            </Typography>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: '80%', mx: 'auto' }}>
              Upload any SQLite database file to analyze its structure, relationships, and get powerful insights through AI and data visualization.
            </Typography>
            
            <Button 
              variant="contained" 
              startIcon={<UploadFileIcon />}
              size="large"
              sx={{ px: 3, py: 1 }}
            >
              Browse Files
            </Button>
            
            <Typography variant="caption" sx={{ mt: 2, display: 'block', color: 'text.secondary' }}>
              Supported formats: .sqlite, .db, .sql
            </Typography>
          </>
        )}
      </Paper>
      
      {dragError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {dragError}
        </Alert>
      )}
      
      <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 4 }}>
        <Paper elevation={2} sx={{ p: 2, flex: 1, maxWidth: 180, textAlign: 'center' }} className="card-hover">
          <Typography variant="body2" color="primary" fontWeight={500}>Schema Analysis</Typography>
          <Typography variant="caption" color="text.secondary">Visualize table relationships</Typography>
        </Paper>
        <Paper elevation={2} sx={{ p: 2, flex: 1, maxWidth: 180, textAlign: 'center' }} className="card-hover">
          <Typography variant="body2" color="primary" fontWeight={500}>Data Statistics</Typography>
          <Typography variant="caption" color="text.secondary">Analyze data patterns</Typography>
        </Paper>
        <Paper elevation={2} sx={{ p: 2, flex: 1, maxWidth: 180, textAlign: 'center' }} className="card-hover">
          <Typography variant="body2" color="primary" fontWeight={500}>AI Insights</Typography>
          <Typography variant="caption" color="text.secondary">Get Gemini-powered analysis</Typography>
        </Paper>
      </Stack>
    </Box>
  );
};

export default SqlUpload; 