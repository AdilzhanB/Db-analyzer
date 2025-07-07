import React, { useState, useRef, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  TextField, 
  Button, 
  Paper, 
  Avatar, 
  CircularProgress, 
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Alert,
  Collapse
} from '@mui/material';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import SendIcon from '@mui/icons-material/Send';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import CloseIcon from '@mui/icons-material/Close';
import { Database } from 'sql.js';

// Use environment variable or default API key
// For production, this should be set as an environment variable
// You should set your real Gemini API key below or in an environment variable
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || 'YOUR_GEMINI_API_KEY_HERE';
let genAI: GoogleGenerativeAI | null = null;

try {
  // Only initialize if we have what looks like a valid API key
  // Google API keys typically start with "AI" and are fairly long
  if (API_KEY && API_KEY !== 'YOUR_GEMINI_API_KEY_HERE' && API_KEY.length > 10) {
    genAI = new GoogleGenerativeAI(API_KEY);
  }
} catch (error) {
  console.error('Error initializing Gemini AI:', error);
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface GeminiChatProps {
  db: Database | null;
  tableInfo?: any;
}

// Helper function to generate database summary
const generateDatabaseSummary = (db: Database | null, tableInfo: any): string => {
  if (!db || !tableInfo) return '';

  let summary = 'Database Overview:\n\n';

  try {
    // Add table information
    tableInfo.forEach((table: any) => {
      const tableRows = db.exec(`SELECT COUNT(*) as count FROM ${table.name}`)[0];
      const rowCount = tableRows?.values[0][0] || 0;
      
      summary += `Table: ${table.name}\n`;
      summary += `- Columns: ${table.columns.join(', ')}\n`;
      summary += `- Total rows: ${rowCount}\n`;

      // Add sample data (first row) if available
      try {
        const sampleData = db.exec(`SELECT * FROM ${table.name} LIMIT 1`)[0];
        if (sampleData && sampleData.values.length > 0) {
          summary += `- Sample row: ${JSON.stringify(Object.fromEntries(
            sampleData.columns.map((col, i) => [col, sampleData.values[0][i]])
          ))}\n`;
        }
      } catch (e) {
        // Ignore sample data errors
      }
      summary += '\n';
    });

    // Add relationships if they can be inferred from foreign keys
    const relationships = tableInfo.reduce((acc: string[], table: any) => {
      const createTableSql = db.exec(`SELECT sql FROM sqlite_master WHERE type='table' AND name='${table.name}'`)[0];
      if (createTableSql?.values[0][0]?.toLowerCase().includes('foreign key')) {
        acc.push(`Note: Table '${table.name}' appears to have foreign key relationships (see CREATE TABLE statement for details)`);
      }
      return acc;
    }, []);

    if (relationships.length > 0) {
      summary += 'Relationships:\n' + relationships.join('\n') + '\n\n';
    }

  } catch (error) {
    console.error('Error generating database summary:', error);
    summary += 'Error: Could not generate complete database summary.\n';
  }

  return summary;
};

const GeminiChat: React.FC<GeminiChatProps> = ({ db, tableInfo }) => {
  // Initialize with an empty chat - we'll show a welcome message in the UI
  // but not include it in the actual API calls
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hello! I can help you analyze your database. Ask me anything about your schema, tables, or data patterns.',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Function to generate database summary
  const generateDbSummary = (db: Database | null, info: any) => {
    if (!db || !info) return '';
    
    let summary = [];
    const totalTables = info.length;
    
    // Add general database info
    summary.push(`Database contains ${totalTables} table${totalTables !== 1 ? 's' : ''}`);
    
    // Get total rows for each table
    let totalRows = 0;
    let tableDetails = [];
    for (const table of info) {
      try {
        const countResult = db.exec(`SELECT COUNT(*) as count FROM ${table.name}`);
        const rowCount = countResult[0]?.values[0][0] as number || 0;
        totalRows += rowCount;
        tableDetails.push(`- ${table.name}: ${rowCount} rows, ${table.columns.length} columns`);
      } catch (e) {
        tableDetails.push(`- ${table.name}: Error counting rows, ${table.columns.length} columns`);
      }
    }
    
    summary.push(`Total records: ${totalRows}`);
    summary.push('\nTables overview:');
    summary.push(...tableDetails);
    
    return summary.join('\n');
  };

  // Show database summary when loaded
  useEffect(() => {
    if (db && tableInfo && messages.length === 1) {
      const summary = generateDbSummary(db, tableInfo);
      if (summary) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `I've analyzed your database:\n\n${summary}\n\nHow can I help you analyze this data?`,
          timestamp: new Date()
        }]);
      }
    }
  }, [db, tableInfo]);

  // useEffect to handle database changes
  useEffect(() => {
    if (db && tableInfo) {
      const dbSummary = generateDatabaseSummary(db, tableInfo);
      const initMessage = "Hi! I'm your SQL database analysis assistant. " +
        "I have access to your database structure and can help you analyze it. " +
        "Here's what I know about your database:\n\n" + dbSummary + 
        "\nWhat would you like to know about your database?";

      setMessages([
        { role: "assistant", content: initMessage, timestamp: new Date() }
      ]);
    }
  }, [db, tableInfo]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    // Validate API key before proceeding
    if (!API_KEY || API_KEY === 'YOUR_GEMINI_API_KEY_HERE' || !genAI) {
      setApiError('Please set your Gemini API key in the GeminiChat.tsx file or as an environment variable VITE_GEMINI_API_KEY in your .env file.');
      return;
    }
    
    setApiError(null);
    
    // Add user message
    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Check if genAI was initialized properly
      if (!genAI) {
        throw new Error('Gemini AI client was not initialized properly');
      }
      
      // Prepare context about the database for Gemini
      let dbContext = '';
      if (db && tableInfo) {
        dbContext = `Database schema: ${JSON.stringify(tableInfo)}`;
        
        // Add some sample data from each table
        for (const table of tableInfo) {
          try {
            const sampleData = db.exec(`SELECT * FROM ${table.name} LIMIT 3`);
            if (sampleData && sampleData[0]) {
              dbContext += `\\nSample data from ${table.name}: ${JSON.stringify(sampleData[0])}`;
            }
          } catch (e) {
            // Ignore errors for sample data
          }
        }
      }

      // Initialize the model
      const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
        ],
      });

      // Create a chat session
      const chat = model.startChat({
        // Gemini API requires the first message to be from user, so we'll filter out the initial assistant message
        // Also map our 'assistant' role to 'model' which is what Gemini expects
        history: messages
          .filter((msg, index) => !(index === 0 && msg.role === 'assistant')) // Skip initial welcome message
          .map(msg => ({
            role: msg.role === 'assistant' ? 'model' : msg.role, // Map 'assistant' to 'model'
            parts: [{ text: msg.content }],
          })),
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1000,
        },
      });

      // Send message with context
      let promptWithContext = input;
      
      // Only add context if this is the first actual user message (after the welcome message)
      if (messages.length <= 2 && dbContext) {
        promptWithContext = `I have a database with the following structure and data. Please help me analyze it.\n\n${dbContext}\n\nMy question is: ${input}`;
      }
      
      const result = await chat.sendMessage(promptWithContext);
      const response = result.response;
      
      const aiMessage: Message = {
        role: 'assistant',
        content: response.text(),
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error calling Gemini AI:', error);
      
      let errorMessage = 'Sorry, I encountered an error connecting to the AI service.';
      
      if (error instanceof Error) {
        console.log('Error details:', error.message);
        
        // Check for common API key errors
        if (error.message.includes('API key')) {
          errorMessage = 'API key error: Please make sure you\'ve set a valid Gemini API key.';
          setApiError('Invalid API key. Please check your Gemini API key configuration.');
        } else if (error.message.includes('network') || error.message.includes('connect')) {
          errorMessage = 'Network error: Please check your internet connection and try again.';
        } else if (error.message.includes('quota') || error.message.includes('limit')) {
          errorMessage = 'API quota exceeded: You may have reached your Gemini API usage limit.';
        } else if (error.message.includes('role')) {
          errorMessage = 'There was an issue with the chat format. Please refresh the page and try again.';
          setApiError('Chat history format error. Please refresh the page to reset the chat.');
        } else {
          // Include the actual error message for better debugging
          errorMessage = `Error: ${error.message}. Please try again or check the console for more details.`;
        }
      }
      
      const aiErrorMessage: Message = {
        role: 'assistant',
        content: errorMessage,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, aiErrorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Paper elevation={0} sx={{ 
        p: 2, 
        bgcolor: 'primary.main', 
        color: 'white',
        borderRadius: '0px'
      }}>
        <Typography variant="h6" fontWeight={600}>
          Gemini AI Database Assistant
        </Typography>
        <Typography variant="body2">
          Ask questions about your database structure and data
        </Typography>
      </Paper>
      
      <Divider />
      
      {/* API Key Error Alert */}
      <Collapse in={!!apiError}>
        <Alert 
          severity="error"
          action={
            <IconButton
              aria-label="close"
              color="inherit"
              size="small"
              onClick={() => setApiError(null)}
            >
              <CloseIcon fontSize="inherit" />
            </IconButton>
          }
          sx={{ borderRadius: 0 }}
        >
          <Typography variant="body2">
            {apiError}
          </Typography>
          <Typography variant="caption">
            Please set a valid API key in GeminiChat.tsx or in your .env file as VITE_GEMINI_API_KEY
          </Typography>
        </Alert>
      </Collapse>
      
      <List sx={{ 
        flexGrow: 1, 
        overflow: 'auto', 
        p: 2, 
        bgcolor: 'background.default' 
      }}>
        {messages.map((msg, index) => (
          <ListItem key={index} alignItems="flex-start" sx={{ 
            flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
            mb: 2 
          }}>
            <ListItemAvatar sx={{ minWidth: 40 }}>
              <Avatar sx={{ 
                bgcolor: msg.role === 'user' ? 'secondary.main' : 'primary.main',
                width: 32,
                height: 32
              }}>
                {msg.role === 'user' ? <PersonIcon fontSize="small" /> : <SmartToyIcon fontSize="small" />}
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={
                <Typography 
                  variant="body1" 
                  component="div" 
                  sx={{ 
                    p: 2, 
                    borderRadius: 2,
                    bgcolor: msg.role === 'user' ? 'secondary.light' : 'primary.light',
                    color: msg.role === 'user' ? 'secondary.contrastText' : 'primary.contrastText',
                    maxWidth: '80%',
                    ml: msg.role === 'user' ? 'auto' : 0,
                    mr: msg.role === 'user' ? 0 : 'auto',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {msg.content}
                </Typography>
              }
              secondary={
                <Typography variant="caption" color="text.secondary" sx={{ 
                  display: 'block',
                  textAlign: msg.role === 'user' ? 'right' : 'left',
                  mt: 0.5
                }}>
                  {msg.timestamp.toLocaleTimeString()}
                </Typography>
              }
            />
          </ListItem>
        ))}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}
        <div ref={messagesEndRef} />
      </List>
      
      <Divider />
      
      <Box sx={{ p: 2, bgcolor: 'background.paper', display: 'flex' }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Ask about your database..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={loading}
          size="small"
          sx={{ mr: 1 }}
          multiline
          maxRows={3}
        />
        <Button 
          variant="contained" 
          color="primary" 
          onClick={handleSend} 
          disabled={loading || !input.trim()}
          endIcon={<SendIcon />}
          sx={{ minWidth: 100 }}
        >
          Send
        </Button>
      </Box>
    </Box>
  );
};

export default GeminiChat;
