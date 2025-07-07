import React, { useEffect, useState } from 'react';
import initSqlJs from 'sql.js';
import { Box, Typography, Paper, CircularProgress, Alert, Tabs, Tab } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef } from '@mui/x-data-grid';
import SchemaGraphRenderer from './SchemaGraphRenderer';

interface SqlAnalyzerProps {
  file: File;
}

interface TableInfo {
  name: string;
  columns: { name: string; type: string; notnull: boolean; pk: boolean; }[];
  foreignKeys: { from: string; to: string; table: string; }[];
}

// declare module 'sql.js';

const SqlAnalyzer: React.FC<SqlAnalyzerProps> = ({ file }) => {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    const loadDb = async () => {
      setLoading(true);
      setError(null);
      try {
        const SQL = await initSqlJs({
          locateFile: (file: string) => `/sql-wasm.wasm`
        });
        const buffer = await file.arrayBuffer();
        const db = new SQL.Database(new Uint8Array(buffer));
        // Get tables
        const tableRes = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
        const tableNames = tableRes[0]?.values.map((v: any) => v[0] as string) || [];
        const tables: TableInfo[] = [];
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
        setTables(tables);
      } catch (e: any) {
        setError(e.message || 'Failed to load database');
      } finally {
        setLoading(false);
      }
    };
    loadDb();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  if (loading) return <Box sx={{ mt: 4, textAlign: 'center' }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!tables.length) return <Alert severity="info">No tables found in database.</Alert>;

  return (
    <Box sx={{ mt: 4 }}>
      <Tabs value={tab} onChange={(_, v) => setTab(v)}>
        <Tab label="Tables" />
        <Tab label="Schema Graph" />
      </Tabs>
      {tab === 0 && (
        <Box>
          {tables.map((table) => (
            <Paper key={table.name} sx={{ my: 2, p: 2 }}>
              <Typography variant="h6">{table.name}</Typography>
              <DataGrid
                autoHeight
                rows={table.columns.map((c, i) => ({ id: i, ...c }))}
                columns={[
                  { field: 'name', headerName: 'Column', flex: 1 },
                  { field: 'type', headerName: 'Type', flex: 1 },
                  { field: 'notnull', headerName: 'Not Null', flex: 1, type: 'boolean' },
                  { field: 'pk', headerName: 'Primary Key', flex: 1, type: 'boolean' },
                ] as GridColDef[]}
                pageSizeOptions={[5, 10]}
                disableRowSelectionOnClick
              />
              {table.foreignKeys.length > 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Foreign keys: {table.foreignKeys.map(fk => `${fk.from} → ${fk.table}.${fk.to}`).join(', ')}
                </Typography>
              )}
            </Paper>
          ))}
        </Box>
      )}
      {tab === 1 && (
        <Box sx={{ mt: 2, textAlign: 'left', overflowX: 'auto', p: 2, borderRadius: 2 }}>
          <SchemaGraphRenderer tables={tables} />
        </Box>
      )}
    </Box>
  );
};

export default SqlAnalyzer; 