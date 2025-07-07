import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography, Slider, IconButton, Paper, Stack, useTheme } from '@mui/material';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import RefreshIcon from '@mui/icons-material/Refresh';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';

interface SchemaRelationship {
  fromTable: string;
  toTable: string;
  fromColumn: string;
  toColumn: string;
}

interface SchemaTable {
  name: string;
  columns: { name: string; type: string; isPk: boolean; isFk: boolean }[];
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

interface SchemaGraphRendererProps {
  tables: {
    name: string;
    columns: { name: string; type: string; notnull: boolean; pk: boolean }[];
    foreignKeys: { from: string; to: string; table: string }[];
  }[];
}

const SchemaGraphRenderer: React.FC<SchemaGraphRendererProps> = ({ tables }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredTable, setHoveredTable] = useState<string | null>(null);
  const [schemaTables, setSchemaTables] = useState<SchemaTable[]>([]);
  const [relationships, setRelationships] = useState<SchemaRelationship[]>([]);
  const theme = useTheme();

  // Colors from theme
  const tableColors = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.success.main,
    theme.palette.warning.main,
    theme.palette.info.main,
    '#8884d8',
    '#82ca9d',
    '#ffc658',
  ];

  // Initialize tables and relationships
  useEffect(() => {
    if (!tables.length) return;

    // Create schema tables with positions
    const schemaTablesList: SchemaTable[] = [];
    const radius = Math.min(300, tables.length * 40);
    const centerX = 400;
    const centerY = 300;
    
    tables.forEach((table, i) => {
      // Calculate position in a circle
      const angle = (i / tables.length) * Math.PI * 2;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      
      // Create columns list with PK/FK flags
      const columns = table.columns.map(col => ({
        name: col.name,
        type: col.type,
        isPk: col.pk,
        isFk: table.foreignKeys.some(fk => fk.from === col.name)
      }));
      
      // Estimate table width and height based on content
      const width = Math.max(table.name.length * 8, 120);
      const height = 40 + columns.length * 24;
      
      schemaTablesList.push({
        name: table.name,
        columns,
        x,
        y,
        width,
        height,
        color: tableColors[i % tableColors.length]
      });
    });
    
    // Create relationships
    const relationshipsList: SchemaRelationship[] = [];
    tables.forEach(table => {
      table.foreignKeys.forEach(fk => {
        relationshipsList.push({
          fromTable: table.name,
          toTable: fk.table,
          fromColumn: fk.from,
          toColumn: fk.to
        });
      });
    });
    
    setSchemaTables(schemaTablesList);
    setRelationships(relationshipsList);
  }, [tables]);

  // Draw the schema
  useEffect(() => {
    if (!canvasRef.current || !schemaTables.length) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Apply zoom and offset
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(zoom, zoom);
    
    // Draw relationships
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#999';
    
    relationships.forEach(rel => {
      const fromTable = schemaTables.find(t => t.name === rel.fromTable);
      const toTable = schemaTables.find(t => t.name === rel.toTable);
      
      if (fromTable && toTable) {
        // Find connection points
        const fromX = fromTable.x + fromTable.width / 2;
        const fromY = fromTable.y + fromTable.height / 2;
        const toX = toTable.x + toTable.width / 2;
        const toY = toTable.y + toTable.height / 2;
        
        // Draw line
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.stroke();
        
        // Draw arrow
        const angle = Math.atan2(toY - fromY, toX - fromX);
        const arrowSize = 10;
        
        ctx.beginPath();
        ctx.moveTo(toX, toY);
        ctx.lineTo(
          toX - arrowSize * Math.cos(angle - Math.PI / 6),
          toY - arrowSize * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          toX - arrowSize * Math.cos(angle + Math.PI / 6),
          toY - arrowSize * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fillStyle = '#999';
        ctx.fill();
        
        // Draw relationship label
        const labelX = (fromX + toX) / 2;
        const labelY = (fromY + toY) / 2 - 10;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.font = '10px Arial';
        ctx.fillText(`${rel.fromColumn} → ${rel.toColumn}`, labelX, labelY);
      }
    });
    
    // Draw tables
    schemaTables.forEach(table => {
      const isHovered = table.name === hoveredTable;
      
      // Table box
      ctx.fillStyle = isHovered ? lightenColor(table.color, 20) : table.color;
      ctx.strokeStyle = isHovered ? '#000' : '#666';
      ctx.lineWidth = isHovered ? 2 : 1;
      
      // Draw with rounded corners
      const radius = 6;
      ctx.beginPath();
      ctx.moveTo(table.x + radius, table.y);
      ctx.lineTo(table.x + table.width - radius, table.y);
      ctx.quadraticCurveTo(table.x + table.width, table.y, table.x + table.width, table.y + radius);
      ctx.lineTo(table.x + table.width, table.y + table.height - radius);
      ctx.quadraticCurveTo(table.x + table.width, table.y + table.height, table.x + table.width - radius, table.y + table.height);
      ctx.lineTo(table.x + radius, table.y + table.height);
      ctx.quadraticCurveTo(table.x, table.y + table.height, table.x, table.y + table.height - radius);
      ctx.lineTo(table.x, table.y + radius);
      ctx.quadraticCurveTo(table.x, table.y, table.x + radius, table.y);
      ctx.closePath();
      
      ctx.fill();
      ctx.stroke();
      
      // Table header
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(table.name, table.x + table.width / 2, table.y + 20);
      
      // Header separator
      ctx.beginPath();
      ctx.moveTo(table.x, table.y + 30);
      ctx.lineTo(table.x + table.width, table.y + 30);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.stroke();
      
      // Columns
      ctx.textAlign = 'left';
      ctx.font = '12px Arial';
      
      table.columns.forEach((col, i) => {
        const y = table.y + 50 + i * 20;
        
        // Column name with PK/FK indicators
        let prefix = '';
        if (col.isPk) prefix += '🔑 ';
        if (col.isFk) prefix += '🔗 ';
        
        ctx.fillStyle = col.isPk ? '#000' : 'rgba(0,0,0,0.7)';
        ctx.font = col.isPk ? 'bold 12px Arial' : '12px Arial';
        ctx.fillText(`${prefix}${col.name}`, table.x + 10, y);
        
        // Column type
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.font = 'italic 12px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(col.type, table.x + table.width - 10, y);
      });
    });
    
    ctx.restore();
  }, [schemaTables, relationships, zoom, offset, hoveredTable]);

  // Set up canvas size
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    
    const resize = () => {
      if (!canvasRef.current || !containerRef.current) return;
      const container = containerRef.current;
      const canvas = canvasRef.current;
      
      // Set canvas size to match container
      canvas.width = container.clientWidth;
      canvas.height = 600; // Fixed height or adjust as needed
    };
    
    resize();
    window.addEventListener('resize', resize);
    
    return () => {
      window.removeEventListener('resize', resize);
    };
  }, []);

  // Utility function to lighten color
  const lightenColor = (color: string, percent: number) => {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    
    return '#' + (
      0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 1 ? 0 : B) : 255)
    ).toString(16).slice(1);
  };

  // Handle mouse interactions
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setIsDragging(true);
    setDragStart({ x, y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - offset.x) / zoom;
    const y = (e.clientY - rect.top - offset.y) / zoom;
    
    // Check if mouse is over a table
    let hover: string | null = null;
    for (const table of schemaTables) {
      if (
        x >= table.x &&
        x <= table.x + table.width &&
        y >= table.y &&
        y <= table.y + table.height
      ) {
        hover = table.name;
        break;
      }
    }
    setHoveredTable(hover);
    
    // Handle dragging
    if (isDragging) {
      const deltaX = e.clientX - rect.left - dragStart.x;
      const deltaY = e.clientY - rect.top - dragStart.y;
      
      setOffset(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      setDragStart({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    setHoveredTable(null);
  };

  // Handle zoom
  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.1, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.1, 0.5));
  };

  const handleZoomChange = (_: any, value: number | number[]) => {
    setZoom(value as number);
  };

  const handleReset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Interactive Schema Graph
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Click and drag to move. Use the zoom controls to adjust view.
        </Typography>
        
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <IconButton onClick={handleZoomOut} size="small">
            <ZoomOutIcon />
          </IconButton>
          
          <Slider
            value={zoom}
            min={0.5}
            max={3}
            step={0.1}
            onChange={handleZoomChange}
            aria-labelledby="zoom-slider"
            sx={{ mx: 2, flexGrow: 1 }}
          />
          
          <IconButton onClick={handleZoomIn} size="small">
            <ZoomInIcon />
          </IconButton>
          
          <IconButton onClick={handleReset} size="small" title="Reset View">
            <CenterFocusStrongIcon />
          </IconButton>
          
          <IconButton onClick={handleReset} size="small" title="Refresh Layout">
            <RefreshIcon />
          </IconButton>
        </Stack>
      </Paper>

      <Box 
        ref={containerRef} 
        sx={{ 
          width: '100%', 
          height: '600px', 
          overflow: 'hidden', 
          border: '1px solid #ddd',
          borderRadius: 1,
          backgroundColor: '#f9f9f9'
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          style={{ cursor: isDragging ? 'grabbing' : hoveredTable ? 'pointer' : 'grab' }}
        />
      </Box>
      
      {hoveredTable && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" fontWeight={500}>
            {hoveredTable}
          </Typography>
          {relationships
            .filter(r => r.fromTable === hoveredTable || r.toTable === hoveredTable)
            .map((rel, i) => (
              <Typography key={i} variant="caption" display="block" color="text.secondary">
                {rel.fromTable === hoveredTable ? 
                  `↗️ ${rel.fromColumn} links to ${rel.toTable}.${rel.toColumn}` : 
                  `↘️ ${rel.fromTable}.${rel.fromColumn} links to ${rel.toColumn}`}
              </Typography>
            ))}
        </Box>
      )}
    </Box>
  );
};

export default SchemaGraphRenderer;
