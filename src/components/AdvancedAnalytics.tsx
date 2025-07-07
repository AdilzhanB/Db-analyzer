import React, { useState, useEffect } from 'react';
import { Database } from 'sql.js';
import { 
  Box, 
  Typography, 
  Paper, 
  Card, 
  CardContent, 
  Tabs, 
  Tab, 
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  Stack,
  Chip,
  useTheme
} from '@mui/material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  RadialLinearScale,
  defaults
} from 'chart.js';
import { Line, Bar, Pie, Doughnut, Scatter, Radar } from 'react-chartjs-2';
import ChartIcon from '@mui/icons-material/InsertChart';
import InsightsIcon from '@mui/icons-material/Insights';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  RadialLinearScale
);

// Set default options
defaults.font.family = '"Roboto", "Helvetica", "Arial", sans-serif';
defaults.plugins.tooltip.backgroundColor = 'rgba(0, 0, 0, 0.8)';
defaults.plugins.legend.labels.usePointStyle = true;

interface AdvancedAnalyticsProps {
  db: Database;
}

interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
    fill?: boolean;
  }[];
}

interface CorrelationResult {
  table: string;
  column1: string;
  column2: string;
  correlation: number;
}

const AdvancedAnalytics: React.FC<AdvancedAnalyticsProps> = ({ db }) => {
  const theme = useTheme();
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [columns, setColumns] = useState<{name: string, type: string}[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [chartType, setChartType] = useState<string>('bar');
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [insights, setInsights] = useState<string[]>([]);
  const [correlations, setCorrelations] = useState<CorrelationResult[]>([]);
  const [tab, setTab] = useState(0);

  // Color palette for charts
  const colorPalette = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.success.main,
    theme.palette.error.main,
    theme.palette.warning.main,
    theme.palette.info.main,
    '#8884d8',
    '#82ca9d',
    '#ffc658',
    '#8dd1e1'
  ];

  // Load tables on component mount
  useEffect(() => {
    const loadTables = () => {
      try {
        const res = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
        if (res[0] && res[0].values) {
          const tableNames = res[0].values.map(row => row[0] as string);
          setTables(tableNames);
          if (tableNames.length > 0) {
            setSelectedTable(tableNames[0]);
          }
        }
      } catch (error) {
        console.error('Error loading tables:', error);
      }
    };
    
    loadTables();
  }, [db]);

  // Load columns when table is selected
  useEffect(() => {
    if (!selectedTable) return;
    
    try {
      const res = db.exec(`PRAGMA table_info(${selectedTable})`);
      if (res[0] && res[0].values) {
        const cols = res[0].values.map(row => ({
          name: row[1] as string,
          type: row[2] as string
        }));
        setColumns(cols);
        // Reset selected columns
        setSelectedColumns([]);
      }
    } catch (error) {
      console.error(`Error loading columns for table ${selectedTable}:`, error);
    }
  }, [db, selectedTable]);

  // Generate chart data when columns are selected
  useEffect(() => {
    if (!selectedTable || selectedColumns.length === 0) {
      setChartData(null);
      return;
    }

    try {
      // For simplicity, we'll use the first selected column as labels (X-axis)
      // and the rest as datasets (Y-axis)
      const xColumn = selectedColumns[0];
      const yColumns = selectedColumns.slice(1);
      
      if (yColumns.length === 0) {
        // Handle single column case - count occurrences
        const res = db.exec(`
          SELECT ${xColumn}, COUNT(*) as count 
          FROM ${selectedTable} 
          WHERE ${xColumn} IS NOT NULL 
          GROUP BY ${xColumn} 
          ORDER BY count DESC 
          LIMIT 15
        `);
        
        if (res[0] && res[0].values) {
          const labels = res[0].values.map(row => String(row[0]));
          const data = res[0].values.map(row => Number(row[1]));
          
          setChartData({
            labels,
            datasets: [{
              label: `Count of ${xColumn}`,
              data,
              backgroundColor: labels.map((_, i) => colorPalette[i % colorPalette.length]),
              borderColor: labels.map((_, i) => colorPalette[i % colorPalette.length]),
              borderWidth: 1
            }]
          });
          
          // Generate insights
          generateInsights(selectedTable, [xColumn], res[0]);
        }
      } else {
        // Multiple columns case
        const columnsStr = selectedColumns.join(', ');
        const res = db.exec(`
          SELECT ${columnsStr} 
          FROM ${selectedTable} 
          WHERE ${selectedColumns.map(col => `${col} IS NOT NULL`).join(' AND ')} 
          LIMIT 30
        `);
        
        if (res[0] && res[0].values) {
          const labels = res[0].values.map(row => String(row[0]));
          
          const datasets = yColumns.map((col, i) => ({
            label: col,
            data: res[0].values.map(row => Number(row[i + 1])),
            backgroundColor: colorPalette[i % colorPalette.length],
            borderColor: colorPalette[i % colorPalette.length],
            borderWidth: 1,
            fill: false
          }));
          
          setChartData({
            labels,
            datasets
          });
          
          // Generate insights
          generateInsights(selectedTable, selectedColumns, res[0]);
          
          // Calculate correlations
          if (yColumns.length > 0) {
            calculateCorrelations(selectedTable, selectedColumns);
          }
        }
      }
    } catch (error) {
      console.error('Error generating chart data:', error);
    }
  }, [db, selectedTable, selectedColumns, chartType]);

  // Generate insights from the data
  const generateInsights = (table: string, columns: string[], _result: any) => {
    const insights: string[] = [];
    
    try {
      // Basic statistics for each numeric column
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        
        // Skip the first column if it's being used as a label
        if (i === 0 && columns.length > 1) continue;
        
        const statRes = db.exec(`
          SELECT 
            MIN(${col}) as min, 
            MAX(${col}) as max, 
            AVG(${col}) as avg, 
            COUNT(*) as count,
            COUNT(DISTINCT ${col}) as unique_count
          FROM ${table}
          WHERE ${col} IS NOT NULL
        `);
        
        if (statRes[0] && statRes[0].values && statRes[0].values[0]) {
          const [min, max, avg, count, uniqueCount] = statRes[0].values[0];
          
          insights.push(`Column '${col}' ranges from ${min} to ${max} with an average of ${Number(avg).toFixed(2)}.`);
          
          if (uniqueCount) {
            const uniquePercentage = ((Number(uniqueCount) / Number(count)) * 100).toFixed(1);
            insights.push(`${col} has ${uniqueCount} unique values (${uniquePercentage}% of total).`);
          }
          
          // Check for outliers
          const stdDevRes = db.exec(`
            SELECT 
              (${col} - ${avg}) * (${col} - ${avg}) as squared_diff
            FROM ${table}
            WHERE ${col} IS NOT NULL
          `);
          
          if (stdDevRes[0] && stdDevRes[0].values) {
            const sum = stdDevRes[0].values.reduce((acc, row) => acc + Number(row[0]), 0);
            const variance = sum / Number(count);
            const stdDev = Math.sqrt(variance);
            
            // Find outliers (values more than 2 standard deviations from the mean)
            const outlierRes = db.exec(`
              SELECT COUNT(*) 
              FROM ${table} 
              WHERE ${col} IS NOT NULL AND (${col} > ${Number(avg) + 2 * stdDev} OR ${col} < ${Number(avg) - 2 * stdDev})
            `);
            
            if (outlierRes[0] && outlierRes[0].values && outlierRes[0].values[0]) {
              const outlierCount = outlierRes[0].values[0][0];
              if (Number(outlierCount) > 0) {
                insights.push(`Found ${outlierCount} potential outliers in '${col}' (values > ${(Number(avg) + 2 * stdDev).toFixed(2)} or < ${(Number(avg) - 2 * stdDev).toFixed(2)}).`);
              }
            }
          }
        }
      }
      
      // Data distribution insights
      if (columns.length === 1) {
        const col = columns[0];
        const countRes = db.exec(`
          SELECT ${col}, COUNT(*) as count 
          FROM ${table} 
          WHERE ${col} IS NOT NULL 
          GROUP BY ${col} 
          ORDER BY count DESC 
          LIMIT 3
        `);
        
        if (countRes[0] && countRes[0].values) {
          const topValues = countRes[0].values.map(row => ({
            value: row[0],
            count: row[1]
          }));
          
          if (topValues.length > 0) {
            insights.push(`Most common value in '${col}' is '${topValues[0].value}' (appears ${topValues[0].count} times).`);
          }
        }
      }
      
      // Null values analysis
      for (const col of columns) {
        const nullRes = db.exec(`
          SELECT COUNT(*) as total, COUNT(${col}) as not_null
          FROM ${table}
        `);
        
        if (nullRes[0] && nullRes[0].values && nullRes[0].values[0]) {
          const [total, notNull] = nullRes[0].values[0];
          const nullCount = Number(total) - Number(notNull);
          
          if (nullCount > 0) {
            const nullPercentage = ((nullCount / Number(total)) * 100).toFixed(1);
            insights.push(`Column '${col}' has ${nullCount} NULL values (${nullPercentage}% of data).`);
          }
        }
      }
    } catch (error) {
      console.error('Error generating insights:', error);
    }
    
    setInsights(insights);
  };

  // Calculate correlations between numeric columns
  const calculateCorrelations = (table: string, columns: string[]) => {
    const results: CorrelationResult[] = [];
    
    try {
      for (let i = 0; i < columns.length; i++) {
        for (let j = i + 1; j < columns.length; j++) {
          const col1 = columns[i];
          const col2 = columns[j];
          
          // Pearson correlation coefficient
          const corrRes = db.exec(`
            SELECT 
              (COUNT(*) * SUM(${col1} * ${col2}) - SUM(${col1}) * SUM(${col2})) / 
              SQRT((COUNT(*) * SUM(${col1} * ${col1}) - SUM(${col1}) * SUM(${col1})) * 
              (COUNT(*) * SUM(${col2} * ${col2}) - SUM(${col2}) * SUM(${col2}))) as correlation
            FROM ${table}
            WHERE ${col1} IS NOT NULL AND ${col2} IS NOT NULL
          `);
          
          if (corrRes[0] && corrRes[0].values && corrRes[0].values[0]) {
            const correlation = Number(corrRes[0].values[0][0]);
            
            if (!isNaN(correlation)) {
              results.push({
                table,
                column1: col1,
                column2: col2,
                correlation
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error calculating correlations:', error);
    }
    
    setCorrelations(results);
  };

  // Render the appropriate chart based on chart type
  const renderChart = () => {
    if (!chartData) return null;
    
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
        },
        title: {
          display: true,
          text: `${selectedTable} - ${selectedColumns.join(' vs ')}`,
        },
      },
    };
    
    switch (chartType) {
      case 'bar':
        return <Bar data={chartData} options={options} />;
      case 'line':
        return <Line data={chartData} options={options} />;
      case 'pie':
        return <Pie data={chartData} options={options} />;
      case 'doughnut':
        return <Doughnut data={chartData} options={options} />;
      case 'scatter':
        if (chartData.datasets.length === 1) {
          // Transform data for scatter plot
          const scatterData = {
            datasets: [{
              ...chartData.datasets[0],
              data: chartData.labels.map((label, i) => ({
                x: Number(label),
                y: chartData.datasets[0].data[i]
              }))
            }]
          };
          return <Scatter data={scatterData} options={options} />;
        }
        return <Typography>Scatter plot requires at least 2 numeric columns</Typography>;
      case 'radar':
        return <Radar data={chartData} options={options} />;
      default:
        return <Bar data={chartData} options={options} />;
    }
  };

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <InsightsIcon color="primary" /> Advanced Analytics & Visualization
      </Typography>
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
          <Tab icon={<ChartIcon />} label="Chart Builder" />
          <Tab icon={<InsightsIcon />} label="Insights" />
        </Tabs>
        
        {tab === 0 && (
          <>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 3 }}>
              {/* Table Selection */}
              <Box sx={{ width: { xs: '100%', md: '30%' } }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Table</InputLabel>
                  <Select
                    value={selectedTable}
                    label="Table"
                    onChange={(e) => setSelectedTable(e.target.value)}
                  >
                    {tables.map((table) => (
                      <MenuItem key={table} value={table}>{table}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              
              {/* Column Selection */}
              <Box sx={{ width: { xs: '100%', md: '30%' } }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Columns</InputLabel>
                  <Select
                    multiple
                    value={selectedColumns}
                    label="Columns"
                    onChange={(e) => setSelectedColumns(typeof e.target.value === 'string' ? [e.target.value] : e.target.value)}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((value) => (
                          <Chip key={value} label={value} size="small" />
                        ))}
                      </Box>
                    )}
                  >
                    {columns.map((col) => (
                      <MenuItem key={col.name} value={col.name}>
                        {col.name} ({col.type})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              
              {/* Chart Type Selection */}
              <Box sx={{ width: { xs: '100%', md: '30%' } }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Chart Type</InputLabel>
                  <Select
                    value={chartType}
                    label="Chart Type"
                    onChange={(e) => setChartType(e.target.value)}
                  >
                    <MenuItem value="bar">Bar Chart</MenuItem>
                    <MenuItem value="line">Line Chart</MenuItem>
                    <MenuItem value="pie">Pie Chart</MenuItem>
                    <MenuItem value="doughnut">Doughnut Chart</MenuItem>
                    <MenuItem value="scatter">Scatter Plot</MenuItem>
                    <MenuItem value="radar">Radar Chart</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </Box>
            
            {/* Chart Display */}
            <Card sx={{ height: 400, p: 2, mb: 3 }}>
              {chartData ? (
                <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {renderChart()}
                </Box>
              ) : (
                <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary' }}>
                  <Typography>
                    Select a table and columns to visualize data
                  </Typography>
                </Box>
              )}
            </Card>
            
            {/* Correlations Display */}
            {correlations.length > 0 && (
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Correlations
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    {correlations.map((corr, index) => (
                      <Box key={index} sx={{ width: { xs: '100%', sm: '45%', md: '30%' } }}>
                        <Paper sx={{ p: 2, textAlign: 'center' }}>
                          <Typography variant="body2" color="text.secondary">
                            {corr.column1} ↔ {corr.column2}
                          </Typography>
                          <Typography 
                            variant="h5" 
                            color={
                              Math.abs(corr.correlation) > 0.7 ? 'success.main' : 
                              Math.abs(corr.correlation) > 0.3 ? 'warning.main' : 
                              'text.secondary'
                            }
                          >
                            {corr.correlation.toFixed(2)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {Math.abs(corr.correlation) > 0.7 ? 'Strong' : 
                             Math.abs(corr.correlation) > 0.3 ? 'Moderate' : 
                             'Weak'} 
                            {corr.correlation > 0 ? ' positive' : ' negative'} correlation
                          </Typography>
                        </Paper>
                      </Box>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            )}
          </>
        )}
        
        {tab === 1 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Data Insights
            </Typography>
            
            {insights.length > 0 ? (
              <Box sx={{ mt: 2 }}>
                <Stack spacing={1}>
                  {insights.map((insight, index) => (
                    <Paper key={index} sx={{ p: 2, backgroundColor: 'background.default' }}>
                      <Typography variant="body2">{insight}</Typography>
                    </Paper>
                  ))}
                </Stack>
              </Box>
            ) : (
              <Typography color="text.secondary">
                Select a table and columns to generate insights.
              </Typography>
            )}
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default AdvancedAnalytics;
