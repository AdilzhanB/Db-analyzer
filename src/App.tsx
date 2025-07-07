import { useState, useEffect } from 'react'
import './App.css'
import SqlUpload from './components/SqlUpload'
import SqlAnalyzer from './components/SqlAnalyzer'
import MathematicalAnalysis from './components/MathematicalAnalysis'
import GeminiChat from './components/GeminiChat'
import AdvancedAnalytics from './components/AdvancedAnalytics'
import DatabaseHealth from './components/DatabaseHealth'
import { 
  Container, 
  CssBaseline, 
  Typography, 
  Box, 
  Paper, 
  IconButton, 
  Drawer, 
  Slide, 
  Fade, 
  AppBar, 
  Toolbar, 
  Tabs, 
  Tab, 
  Avatar, 
  Button, 
  Divider, 
  useTheme, 
  useMediaQuery,
  ThemeProvider,
  createTheme,
  Stack,
  Chip,
  Grid
} from '@mui/material'
import initSqlJs, { Database } from 'sql.js'
import ChatIcon from '@mui/icons-material/Chat'
import StorageIcon from '@mui/icons-material/Storage'
import AnalyticsIcon from '@mui/icons-material/Analytics'
import CloseIcon from '@mui/icons-material/Close'
import SettingsIcon from '@mui/icons-material/Settings'
import SchemaIcon from '@mui/icons-material/Schema'
import CalculateIcon from '@mui/icons-material/Calculate'
import PsychologyIcon from '@mui/icons-material/Psychology'
import GitHubIcon from '@mui/icons-material/GitHub'
import UploadFileIcon from '@mui/icons-material/UploadFile'

function App() {
  const [file, setFile] = useState<File | null>(null)
  const [db, setDb] = useState<Database | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [activeTab, setActiveTab] = useState(0)
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  // Custom theme with enhanced colors
  const customTheme = createTheme({
    palette: {
      primary: {
        main: '#2563eb', // Bright blue
        light: '#93c5fd',
        dark: '#1e40af',
      },
      secondary: {
        main: '#8b5cf6', // Purple
        light: '#c4b5fd',
        dark: '#6d28d9',
      },
      background: {
        default: '#f9fafb',
        paper: '#ffffff',
      },
      success: {
        main: '#10b981',
      },
      error: {
        main: '#ef4444',
      },
      warning: {
        main: '#f59e0b',
      },
      info: {
        main: '#3b82f6',
      },
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h3: {
        fontWeight: 700,
      },
      h5: {
        fontWeight: 600,
      },
      h6: {
        fontWeight: 600,
      },
    },
    shape: {
      borderRadius: 8,
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: 8,
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
          },
        },
      },
    },
  });

  const handleFile = async (f: File) => {
    setFile(f)
    setError(null)
    try {
      const SQL = await initSqlJs({
        locateFile: (file: string) => `/sql-wasm.wasm`
      })
      const buffer = await f.arrayBuffer()
      const db = new SQL.Database(new Uint8Array(buffer))
      setDb(db)
    } catch (e: any) {
      setError(e.message || 'Failed to load database')
      setDb(null)
    }
  }

  // Get table info for Gemini Chat
  const [tableInfo, setTableInfo] = useState<any[]>([])
  
  useEffect(() => {
    if (!db) return;
    
    try {
      const tableRes = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
      const tableNames = tableRes[0]?.values.map((v: any) => v[0] as string) || [];
      const tables: any[] = [];
      
      for (const name of tableNames) {
        // Columns
        const colRes = db.exec(`PRAGMA table_info(${name});`);
        const columns = colRes[0]?.values.map((row: any[]) => ({
          name: row[1] as string,
          type: row[2] as string,
          notnull: !!row[3],
          pk: !!row[5],
        })) || [];
        
        // Foreign keys
        const fkRes = db.exec(`PRAGMA foreign_key_list(${name});`);
        const foreignKeys = fkRes[0]?.values.map((row: any[]) => ({
          from: row[3] as string,
          to: row[4] as string,
          table: row[2] as string,
        })) || [];
        
        tables.push({ name, columns, foreignKeys });
      }
      
      setTableInfo(tables);
    } catch (e) {
      console.error('Error fetching table info:', e);
    }
  }, [db]);

  return (
    <ThemeProvider theme={customTheme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {/* Header */}
        <AppBar position="static" elevation={0} sx={{ bgcolor: 'background.paper', color: 'text.primary', borderBottom: 1, borderColor: 'divider' }}>
          <Toolbar>
            <StorageIcon sx={{ mr: 2, color: 'primary.main' }} />
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              Advanced SQL Database Analyzer
            </Typography>
            {file && (
              <Chip 
                label={file.name} 
                variant="outlined" 
                color="primary" 
                size="small" 
                icon={<UploadFileIcon />} 
              />
            )}
            <IconButton 
              color="primary" 
              sx={{ ml: 2 }} 
              onClick={() => setChatOpen(true)}
              aria-label="Open AI Chat"
            >
              <PsychologyIcon />
            </IconButton>
            <IconButton 
              color="inherit" 
              aria-label="GitHub" 
              sx={{ ml: 1 }}
              onClick={() => window.open('https://github.com/yourusername/db-analyzer', '_blank')}
            >
              <GitHubIcon />
            </IconButton>
          </Toolbar>
          
          {file && db && (
            <Tabs 
              value={activeTab} 
              onChange={(_, v) => setActiveTab(v)} 
              aria-label="Database analysis tabs"
              variant={isMobile ? "scrollable" : "standard"}
              scrollButtons="auto"
              centered={!isMobile}
              sx={{ px: 2 }}
            >
              <Tab icon={<SchemaIcon />} label="Schema" />
              <Tab icon={<CalculateIcon />} label="Stats" />
              <Tab icon={<AnalyticsIcon />} label="Advanced Analytics" />
              <Tab icon={<StorageIcon />} label="DB Health" />
            </Tabs>
          )}
        </AppBar>

        {/* Main Content */}
        <Container maxWidth="lg" sx={{ flex: 1, py: 4 }}>
          <Box sx={{ my: 2 }}>
            {!file && (
              <Fade in={!file}>
                <div>
                  <Box sx={{ textAlign: 'center', mb: 4 }}>
                    <Typography variant="h3" gutterBottom>
                      SQL Database Analyzer
                    </Typography>
                    <Typography variant="subtitle1" color="text.secondary" gutterBottom>
                      Upload any SQLite database file (.sqlite, .db, .sql) to analyze its structure, relationships, and get advanced insights.
                    </Typography>
                  </Box>
                  <SqlUpload onFile={handleFile} />
                </div>
              </Fade>
            )}
            
            {error && (
              <Paper sx={{ p: 3, mt: 4, bgcolor: 'error.light', color: 'error.contrastText' }}>
                <Typography>{error}</Typography>
              </Paper>
            )}
            
            {file && db && (
              <Slide direction="up" in={!!file && !!db} mountOnEnter unmountOnExit>
                <div>
                  {activeTab === 0 && <SqlAnalyzer file={file} />}
                  {activeTab === 1 && <MathematicalAnalysis db={db} />}
                  {activeTab === 2 && <AdvancedAnalytics db={db} />}
                  {activeTab === 3 && <DatabaseHealth db={db} />}
                </div>
              </Slide>
            )}
          </Box>
        </Container>
        
        {/* Footer */}
        <Box 
          component="footer" 
          sx={{ 
            py: 2, 
            px: 3, 
            mt: 'auto', 
            bgcolor: 'background.paper', 
            borderTop: 1, 
            borderColor: 'divider'
          }}
        >
          <Typography variant="body2" color="text.secondary" align="center">
            Advanced SQL Database Analyzer &copy; {new Date().getFullYear()}
          </Typography>
        </Box>
      </Box>
      
      {/* AI Chat Drawer */}
      <Drawer 
        anchor="right" 
        open={chatOpen} 
        onClose={() => setChatOpen(false)}
        PaperProps={{
          sx: { width: { xs: '100%', sm: 450 } }
        }}
      >
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          p: 1, 
          borderBottom: 1, 
          borderColor: 'divider' 
        }}>
          <IconButton onClick={() => setChatOpen(false)}>
            <CloseIcon />
          </IconButton>
        </Box>
        {db ? (
          <GeminiChat db={db} tableInfo={tableInfo} />
        ) : (
          <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            <PsychologyIcon color="primary" sx={{ fontSize: 48, mb: 2 }} />
            <Typography variant="h6" gutterBottom>Gemini AI Database Assistant</Typography>
            <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 2 }}>
              Please upload a database to start using the AI assistant.
            </Typography>
            <Button 
              variant="outlined" 
              color="primary" 
              onClick={() => setChatOpen(false)}
              startIcon={<UploadFileIcon />}
            >
              Upload Database
            </Button>
          </Box>
        )}
      </Drawer>
    </ThemeProvider>
  )
}

export default App
