import React, { useEffect, useState } from 'react';
import { Database } from 'sql.js';
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, CircularProgress, Card, CardContent, Divider, Collapse, IconButton, Tooltip } from '@mui/material';
import BarChartIcon from '@mui/icons-material/BarChart';
import TableChartIcon from '@mui/icons-material/TableChart';
import Grid from '@mui/material/Grid';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer } from 'recharts';

interface MathematicalAnalysisProps {
  db: Database;
}

interface ColumnStats {
  name: string;
  type: string;
  min?: number;
  max?: number;
  avg?: number;
  stddev?: number;
  median?: number;
  mode?: number;
  nulls?: number;
  unique?: number;
}

interface TableStats {
  name: string;
  rowCount: number;
  columnCount: number;
  columns: ColumnStats[];
}

const MathematicalAnalysis: React.FC<MathematicalAnalysisProps> = ({ db }) => {
  const [stats, setStats] = useState<TableStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    const analyze = async () => {
      setLoading(true);
      const tableRes = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
      const tableNames = tableRes[0]?.values.map((v: any) => v[0] as string) || [];
      const stats: TableStats[] = [];
      for (const name of tableNames) {
        // Row count
        const rowRes = db.exec(`SELECT COUNT(*) FROM ${name};`);
        const rowCount = rowRes[0]?.values[0][0] as number;
        // Columns
        const colRes = db.exec(`PRAGMA table_info(${name});`);
        const columns = colRes[0]?.values.map((row: any[]) => ({ name: row[1] as string, type: row[2] as string })) || [];
        const columnCount = columns.length;
        const colStats: ColumnStats[] = [];
        for (const col of columns) {
          let stat: ColumnStats = { name: col.name, type: col.type };
          // Numeric columns
          if (/int|real|float|double|numeric/i.test(col.type)) {
            try {
              const statRes = db.exec(`SELECT MIN(${col.name}), MAX(${col.name}), AVG(${col.name}), COUNT(*) - COUNT(${col.name}), COUNT(DISTINCT ${col.name}) FROM ${name};`);
              const [min, max, avg, nulls, unique] = statRes[0]?.values[0] || [];
              stat = { ...stat, min, max, avg, nulls, unique };
              // Stddev
              const stdRes = db.exec(`SELECT STDDEV(${col.name}) FROM ${name};`);
              stat.stddev = stdRes[0]?.values[0][0];
              // Median
              const medRes = db.exec(`SELECT ${col.name} FROM ${name} WHERE ${col.name} IS NOT NULL ORDER BY ${col.name} LIMIT 1 OFFSET (SELECT COUNT(*) FROM ${name} WHERE ${col.name} IS NOT NULL)/2;`);
              stat.median = medRes[0]?.values[0][0];
              // Mode
              const modeRes = db.exec(`SELECT ${col.name} FROM ${name} WHERE ${col.name} IS NOT NULL GROUP BY ${col.name} ORDER BY COUNT(*) DESC LIMIT 1;`);
              stat.mode = modeRes[0]?.values[0][0];
            } catch {}
          } else {
            // Text columns: unique, nulls
            try {
              const statRes = db.exec(`SELECT COUNT(*) - COUNT(${col.name}), COUNT(DISTINCT ${col.name}) FROM ${name};`);
              const [nulls, unique] = statRes[0]?.values[0] || [];
              stat = { ...stat, nulls, unique };
            } catch {}
          }
          colStats.push(stat);
        }
        stats.push({ name, rowCount, columnCount, columns: colStats });
      }
      setStats(stats);
      setLoading(false);
    };
    analyze();
  }, [db]);

  const handleExpand = (table: string, col: string) => {
    setExpanded((prev) => ({ ...prev, [`${table}.${col}`]: !prev[`${table}.${col}`] }));
  };

  if (loading) return <Box sx={{ mt: 2, textAlign: 'center' }}><CircularProgress /> Analyzing...</Box>;
  if (!stats.length) return null;

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h5" gutterBottom>Mathematical & Technical Analysis</Typography>
      <Grid container spacing={3}>
        {stats.map(table => (
          <Box key={table.name} mb={3}>
            <Card sx={{ boxShadow: 3 }}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2} mb={1}>
                  <TableChartIcon color="primary" fontSize="large" />
                  <Typography variant="h6">{table.name}</Typography>
                  <Divider flexItem sx={{ mx: 2 }} />
                  <Typography variant="body2">Rows: <b>{table.rowCount}</b></Typography>
                  <Typography variant="body2" sx={{ ml: 2 }}>Columns: <b>{table.columnCount}</b></Typography>
                </Box>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Column</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Min</TableCell>
                        <TableCell>Max</TableCell>
                        <TableCell>Avg</TableCell>
                        <TableCell>Stddev</TableCell>
                        <TableCell>Median</TableCell>
                        <TableCell>Mode</TableCell>
                        <TableCell>Nulls</TableCell>
                        <TableCell>Unique</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {table.columns.map(col => (
                        <React.Fragment key={col.name}>
                          <TableRow>
                            <TableCell>
                              {col.name}
                              {/int|real|float|double|numeric/i.test(col.type) && (
                                <Tooltip title="Show distribution">
                                  <IconButton size="small" onClick={() => handleExpand(table.name, col.name)}>
                                    <ExpandMoreIcon sx={{ transform: expanded[`${table.name}.${col.name}`] ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s' }} />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </TableCell>
                            <TableCell>{col.type}</TableCell>
                            <TableCell>{col.min ?? '-'}</TableCell>
                            <TableCell>{col.max ?? '-'}</TableCell>
                            <TableCell>{col.avg ?? '-'}</TableCell>
                            <TableCell>{col.stddev ?? '-'}</TableCell>
                            <TableCell>{col.median ?? '-'}</TableCell>
                            <TableCell>{col.mode ?? '-'}</TableCell>
                            <TableCell>{col.nulls ?? '-'}</TableCell>
                            <TableCell>{col.unique ?? '-'}</TableCell>
                          </TableRow>
                          {/* Animated chart for numeric columns */}
                          {/int|real|float|double|numeric/i.test(col.type) && (
                            <TableRow>
                              <TableCell colSpan={10} sx={{ p: 0, border: 0 }}>
                                <Collapse in={!!expanded[`${table.name}.${col.name}`]} timeout="auto" unmountOnExit>
                                  <Box sx={{ height: 200, width: '100%', p: 2 }}>
                                    <NumericColumnChart db={db} table={table.name} column={col.name} />
                                  </Box>
                                </Collapse>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Box>
        ))}
      </Grid>
    </Box>
  );
};

interface NumericColumnChartProps {
  db: Database;
  table: string;
  column: string;
}

const NumericColumnChart: React.FC<NumericColumnChartProps> = ({ db, table, column }) => {
  // Get histogram data
  let data: { value: number; count: number }[] = [];
  try {
    const res = db.exec(`SELECT ${column} as value, COUNT(*) as count FROM ${table} WHERE ${column} IS NOT NULL GROUP BY ${column} ORDER BY value LIMIT 20;`);
    data = res[0]?.values.map(([value, count]: [number, number]) => ({ value, count })) || [];
  } catch {}
  if (!data.length) return <Typography variant="body2" color="text.secondary">No data for chart.</Typography>;
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <XAxis dataKey="value" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <ReTooltip />
        <Bar dataKey="count" fill="#1976d2" />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default MathematicalAnalysis; 