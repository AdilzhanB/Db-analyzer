import React, { useEffect, useState } from 'react';
import { Database } from 'sql.js';
import { 
  Box, 
  Typography, 
  Paper, 
  CircularProgress, 
  Card,
  CardContent,
  LinearProgress,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Tooltip,
  Alert
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import StorageIcon from '@mui/icons-material/Storage';
import TableChartIcon from '@mui/icons-material/TableChart';
import KeyIcon from '@mui/icons-material/Key';
import LinkIcon from '@mui/icons-material/Link';
import SsidChartIcon from '@mui/icons-material/SsidChart';

interface DatabaseHealthProps {
  db: Database;
}

interface HealthCheck {
  id: string;
  name: string;
  description: string;
  status: 'success' | 'warning' | 'error' | 'info';
  score: number;
  details?: string;
}

interface TableStats {
  name: string;
  rowCount: number;
  avgRowSize?: number;
  hasIndex: boolean;
  hasPrimaryKey: boolean;
  hasForeignKey: boolean;
  nullableColumns: number;
  totalColumns: number;
}

interface DbStatistics {
  totalTables: number;
  totalRows: number;
  totalIndexes: number;
  totalColumns: number;
  totalRelationships: number;
  avgRowsPerTable: number;
  orphanedTables: number;
  tableStats: TableStats[];
}

const DatabaseHealth: React.FC<DatabaseHealthProps> = ({ db }) => {
  const [loading, setLoading] = useState(true);
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [dbStats, setDbStats] = useState<DbStatistics | null>(null);
  const [overallScore, setOverallScore] = useState(0);
  
  useEffect(() => {
    const analyzeDatabase = async () => {
      setLoading(true);
      
      try {
        // Get tables
        const tableRes = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
        const tableNames = tableRes[0]?.values.map((v: any) => v[0] as string) || [];
        
        // Database statistics
        const stats: DbStatistics = {
          totalTables: tableNames.length,
          totalRows: 0,
          totalIndexes: 0,
          totalColumns: 0,
          totalRelationships: 0,
          avgRowsPerTable: 0,
          orphanedTables: 0,
          tableStats: []
        };
        
        // Get total indices
        const indexRes = db.exec("SELECT count(*) FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%';");
        stats.totalIndexes = indexRes[0]?.values[0][0] as number || 0;
        
        // Per-table analysis
        const relationships = new Set<string>();
        const tablesWithForeignKeys = new Set<string>();
        
        for (const name of tableNames) {
          // Columns info
          const colRes = db.exec(`PRAGMA table_info(${name});`);
          const columns = colRes[0]?.values || [];
          
          // Count nullable columns
          const nullableColumns = columns.filter(col => !col[3]).length;
          
          // Check for primary key
          const hasPrimaryKey = columns.some(col => col[5]);
          
          // Row count
          const countRes = db.exec(`SELECT COUNT(*) FROM ${name};`);
          const rowCount = countRes[0]?.values[0][0] as number || 0;
          
          // Foreign keys
          const fkRes = db.exec(`PRAGMA foreign_key_list(${name});`);
          const foreignKeys = fkRes[0]?.values || [];
          const hasForeignKey = foreignKeys.length > 0;
          
          // For relationship tracking
          foreignKeys.forEach((fk: any[]) => {
            relationships.add(`${name}.${fk[3]} -> ${fk[2]}.${fk[4]}`);
            tablesWithForeignKeys.add(fk[2]); // Referenced table
          });
          
          // Indices for this table
          const indicesRes = db.exec(`PRAGMA index_list(${name});`);
          const hasIndex = (indicesRes[0]?.values || []).length > 0;
          
          stats.tableStats.push({
            name,
            rowCount,
            hasIndex,
            hasPrimaryKey,
            hasForeignKey,
            nullableColumns,
            totalColumns: columns.length
          });
          
          // Update aggregated stats
          stats.totalRows += rowCount;
          stats.totalColumns += columns.length;
        }
        
        // Orphaned tables (no FK relationships)
        stats.orphanedTables = tableNames.filter(name => 
          !tablesWithForeignKeys.has(name) && 
          !stats.tableStats.find(t => t.name === name)?.hasForeignKey
        ).length;
        
        stats.totalRelationships = relationships.size;
        stats.avgRowsPerTable = stats.totalTables ? Math.round(stats.totalRows / stats.totalTables) : 0;
        
        setDbStats(stats);
        
        // Generate health checks
        const checks: HealthCheck[] = [];
        
        // Overall structure check
        checks.push({
          id: 'structure',
          name: 'Database Structure',
          description: 'Evaluation of overall database schema design',
          status: stats.totalRelationships > 0 ? 'success' : 'warning',
          score: stats.totalRelationships > 0 ? 100 : 60,
          details: stats.totalRelationships > 0 
            ? `Well-structured database with ${stats.totalRelationships} defined relationships` 
            : 'Database appears to have isolated tables with no defined relationships'
        });
        
        // Primary key check
        const tablesWithoutPK = stats.tableStats.filter(t => !t.hasPrimaryKey);
        checks.push({
          id: 'primary_keys',
          name: 'Primary Keys',
          description: 'Tables should have primary keys for better performance and data integrity',
          status: tablesWithoutPK.length === 0 ? 'success' : (tablesWithoutPK.length < stats.totalTables / 2 ? 'warning' : 'error'),
          score: tablesWithoutPK.length === 0 ? 100 : Math.round(100 - (tablesWithoutPK.length / stats.totalTables * 100)),
          details: tablesWithoutPK.length === 0 
            ? 'All tables have primary keys defined' 
            : `${tablesWithoutPK.length} tables are missing primary keys: ${tablesWithoutPK.map(t => t.name).join(', ')}`
        });
        
        // Index check
        const tablesWithoutIndices = stats.tableStats.filter(t => !t.hasIndex && t.rowCount > 100);
        checks.push({
          id: 'indices',
          name: 'Indexing',
          description: 'Tables with many rows should have indices for better query performance',
          status: tablesWithoutIndices.length === 0 ? 'success' : 'warning',
          score: tablesWithoutIndices.length === 0 ? 100 : Math.round(100 - (tablesWithoutIndices.length / stats.tableStats.filter(t => t.rowCount > 100).length * 70)),
          details: tablesWithoutIndices.length === 0 
            ? 'All tables that need indices have them' 
            : `${tablesWithoutIndices.length} tables with many rows are missing indices: ${tablesWithoutIndices.map(t => t.name).join(', ')}`
        });
        
        // Nullable columns check
        const nullableRatio = stats.tableStats.reduce((sum, t) => sum + t.nullableColumns, 0) / stats.totalColumns;
        checks.push({
          id: 'nullable',
          name: 'NULL Values',
          description: 'Excessive nullable columns can indicate schema design issues',
          status: nullableRatio < 0.3 ? 'success' : (nullableRatio < 0.6 ? 'warning' : 'info'),
          score: Math.round(100 - (nullableRatio * 100)),
          details: `${Math.round(nullableRatio * 100)}% of columns allow NULL values`
        });
        
        // Table naming consistency
        const tableNamePatterns = detectNamingPatterns(tableNames);
        checks.push({
          id: 'naming',
          name: 'Naming Consistency',
          description: 'Consistent table naming improves schema readability',
          status: tableNamePatterns.consistent ? 'success' : 'info',
          score: tableNamePatterns.consistent ? 100 : 70,
          details: tableNamePatterns.consistent 
            ? 'Tables follow a consistent naming pattern' 
            : 'Tables have inconsistent naming patterns'
        });
        
        // Size distribution
        const largestTables = [...stats.tableStats].sort((a, b) => b.rowCount - a.rowCount).slice(0, 3);
        const sizeDistribution = calculateSizeDistribution(stats.tableStats);
        checks.push({
          id: 'size_distribution',
          name: 'Data Distribution',
          description: 'Evaluation of how data is distributed across tables',
          status: sizeDistribution < 0.7 ? 'success' : (sizeDistribution < 0.9 ? 'warning' : 'info'),
          score: Math.round(100 - (sizeDistribution * 80)),
          details: `Largest tables: ${largestTables.map(t => `${t.name} (${t.rowCount} rows)`).join(', ')}`
        });
        
        // Calculate overall score
        const overall = Math.round(checks.reduce((sum, check) => sum + check.score, 0) / checks.length);
        setOverallScore(overall);
        setHealthChecks(checks);
      } catch (error) {
        console.error('Error analyzing database health:', error);
      } finally {
        setLoading(false);
      }
    };
    
    analyzeDatabase();
  }, [db]);
  
  // Helper functions
  const detectNamingPatterns = (tableNames: string[]): { consistent: boolean; pattern?: string } => {
    if (tableNames.length < 2) return { consistent: true };
    
    // Check for snake_case
    const snakeCase = tableNames.every(name => /^[a-z]+(_[a-z]+)*$/.test(name));
    if (snakeCase) return { consistent: true, pattern: 'snake_case' };
    
    // Check for camelCase
    const camelCase = tableNames.every(name => /^[a-z]+([A-Z][a-z]*)*$/.test(name));
    if (camelCase) return { consistent: true, pattern: 'camelCase' };
    
    // Check for PascalCase
    const pascalCase = tableNames.every(name => /^([A-Z][a-z]*)+$/.test(name));
    if (pascalCase) return { consistent: true, pattern: 'PascalCase' };
    
    return { consistent: false };
  };
  
  const calculateSizeDistribution = (tableStats: TableStats[]): number => {
    if (tableStats.length <= 1) return 0;
    
    const totalRows = tableStats.reduce((sum, t) => sum + t.rowCount, 0);
    if (totalRows === 0) return 0;
    
    // Sort tables by row count, descending
    const sorted = [...tableStats].sort((a, b) => b.rowCount - a.rowCount);
    
    // Calculate what percentage of data is in the largest table
    return sorted[0].rowCount / totalRows;
  };
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircleIcon color="success" />;
      case 'warning': return <WarningIcon color="warning" />;
      case 'error': return <ErrorIcon color="error" />;
      default: return <InfoIcon color="info" />;
    }
  };
  
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'success.main';
    if (score >= 70) return 'warning.main';
    if (score >= 50) return 'info.main';
    return 'error.main';
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Analyzing database health...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h5" gutterBottom>Database Health Analysis</Typography>
      
      {/* Overall score card */}
      <Paper sx={{ p: 3, mb: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center' }}>
          <Box sx={{ width: { xs: '100%', md: '30%' }, textAlign: 'center' }}>
            <Box sx={{ position: 'relative', display: 'inline-flex' }}>
              <CircularProgress 
                variant="determinate" 
                value={overallScore} 
                size={120} 
                thickness={5}
                sx={{ color: getScoreColor(overallScore) }}
              />
              <Box
                sx={{
                  top: 0,
                  left: 0,
                  bottom: 0,
                  right: 0,
                  position: 'absolute',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography variant="h4" fontWeight="bold">
                  {overallScore}
                </Typography>
              </Box>
            </Box>
            <Typography variant="h6" sx={{ mt: 1 }}>Database Health Score</Typography>
          </Box>
          
          <Box sx={{ width: { xs: '100%', md: '65%' } }}>
            <Typography variant="body1" gutterBottom>
              {overallScore >= 90 ? 'Excellent database design with best practices applied.' :
               overallScore >= 70 ? 'Good database design with some minor improvement opportunities.' :
               overallScore >= 50 ? 'Database has several issues that should be addressed.' :
               'Critical database design issues detected.'}
            </Typography>
            
            {dbStats && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1 }}>
                <Box sx={{ width: { xs: '30%' } }}>
                  <Chip 
                    icon={<TableChartIcon />} 
                    label={`${dbStats.totalTables} Tables`}
                    variant="outlined"
                    sx={{ width: '100%' }}
                  />
                </Box>
                <Box sx={{ width: { xs: '30%' } }}>
                  <Chip 
                    icon={<StorageIcon />} 
                    label={`${dbStats.totalRows} Rows`}
                    variant="outlined"
                    sx={{ width: '100%' }}
                  />
                </Box>
                <Box sx={{ width: { xs: '30%' } }}>
                  <Chip 
                    icon={<LinkIcon />} 
                    label={`${dbStats.totalRelationships} Relations`}
                    variant="outlined"
                    sx={{ width: '100%' }}
                  />
                </Box>
              </Box>
            )}
          </Box>
        </Box>
      </Paper>
      
      {/* Health checks */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {healthChecks.map(check => (
          <Box sx={{ width: { xs: '100%', md: '47%' } }} key={check.id}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Box sx={{ mr: 2 }}>
                    {getStatusIcon(check.status)}
                  </Box>
                  <Box>
                    <Typography variant="h6">{check.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {check.description}
                    </Typography>
                  </Box>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Box sx={{ flexGrow: 1, mr: 2 }}>
                    <LinearProgress 
                      variant="determinate" 
                      value={check.score} 
                      sx={{ 
                        height: 8, 
                        borderRadius: 4,
                        backgroundColor: 'rgba(0,0,0,0.1)',
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: getScoreColor(check.score)
                        }
                      }}
                    />
                  </Box>
                  <Typography variant="body2" fontWeight="bold">
                    {check.score}/100
                  </Typography>
                </Box>
                
                {check.details && (
                  <Typography variant="body2" color="text.secondary">
                    {check.details}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Box>
        ))}
      </Box>
      
      {/* Table health details */}
      {dbStats && dbStats.tableStats.length > 0 && (
        <Paper sx={{ mt: 3, p: 3 }}>
          <Typography variant="h6" gutterBottom>Table Health Details</Typography>
          <Divider sx={{ mb: 2 }} />
          
          <List>
            {dbStats.tableStats.map(table => {
              // Calculate health score for this table
              let tableScore = 100;
              if (!table.hasPrimaryKey) tableScore -= 30;
              if (!table.hasIndex && table.rowCount > 100) tableScore -= 20;
              if (table.nullableColumns > table.totalColumns / 2) tableScore -= 10;
              
              return (
                <ListItem key={table.name} sx={{ mb: 1, border: '1px solid #eee', borderRadius: 1 }}>
                  <ListItemIcon>
                    <TableChartIcon />
                  </ListItemIcon>
                  
                  <ListItemText 
                    primary={table.name}
                    secondary={                        <Box sx={{ mt: 1 }}>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            <Box sx={{ width: { xs: '100%', sm: '48%' } }}>
                              <Typography variant="body2" component="span">
                                Rows: {table.rowCount}
                              </Typography>
                            </Box>
                            <Box sx={{ width: { xs: '100%', sm: '48%' } }}>
                              <Typography variant="body2" component="span">
                                Columns: {table.totalColumns}
                              </Typography>
                            </Box>
                          </Box>
                        
                        <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <Tooltip title="Primary Key">
                            <Chip 
                              icon={<KeyIcon />} 
                              size="small"
                              label={table.hasPrimaryKey ? "Has PK" : "No PK"} 
                              color={table.hasPrimaryKey ? "success" : "error"}
                              variant="outlined"
                            />
                          </Tooltip>
                          
                          <Tooltip title="Foreign Keys">
                            <Chip 
                              icon={<LinkIcon />} 
                              size="small"
                              label={table.hasForeignKey ? "Has Relations" : "No Relations"} 
                              color={table.hasForeignKey ? "success" : "default"}
                              variant="outlined"
                            />
                          </Tooltip>
                          
                          <Tooltip title="Indexes">
                            <Chip 
                              icon={<SsidChartIcon />} 
                              size="small"
                              label={table.hasIndex ? "Has Index" : "No Index"} 
                              color={table.hasIndex || table.rowCount < 100 ? "success" : "warning"}
                              variant="outlined"
                            />
                          </Tooltip>
                        </Box>
                      </Box>
                    }
                  />
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 80 }}>
                    <CircularProgress 
                      variant="determinate" 
                      value={tableScore} 
                      size={40}
                      thickness={6}
                      sx={{ color: getScoreColor(tableScore) }}
                    />
                    <Typography variant="body2" sx={{ ml: 1 }} fontWeight="bold">
                      {tableScore}
                    </Typography>
                  </Box>
                </ListItem>
              );
            })}
          </List>
        </Paper>
      )}
      
      {/* Recommendations */}
      <Paper sx={{ mt: 3, p: 3 }}>
        <Typography variant="h6" gutterBottom>Recommendations</Typography>
        <Divider sx={{ mb: 2 }} />
        
        <List>
          {healthChecks.filter(check => check.score < 80).map(check => (
            <ListItem key={check.id}>
              <ListItemIcon>{getStatusIcon(check.status)}</ListItemIcon>
              <ListItemText 
                primary={`Improve ${check.name}`} 
                secondary={getRecommendation(check.id)}
              />
            </ListItem>
          ))}
          
          {healthChecks.filter(check => check.score < 80).length === 0 && (
            <Alert severity="success" sx={{ mt: 2 }}>
              Your database follows best practices. No critical issues found.
            </Alert>
          )}
        </List>
      </Paper>
    </Box>
  );
};

// Helper to get recommendations
const getRecommendation = (checkId: string): string => {
  switch (checkId) {
    case 'primary_keys':
      return 'Add primary keys to all tables to improve query performance and ensure data integrity.';
    case 'indices':
      return 'Create indices on frequently queried columns, especially in tables with many rows.';
    case 'nullable':
      return 'Consider making more columns NOT NULL to improve data quality and query performance.';
    case 'naming':
      return 'Standardize table and column naming conventions (e.g., use snake_case consistently).';
    case 'structure':
      return 'Define proper relationships between tables using foreign keys to improve data integrity.';
    case 'size_distribution':
      return 'Consider normalizing large tables further to distribute data more evenly.';
    default:
      return 'Review database design and apply best practices for optimal performance.';
  }
};

export default DatabaseHealth;
