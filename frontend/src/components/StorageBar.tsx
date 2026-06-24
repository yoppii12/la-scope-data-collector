import React from 'react'
import { Box, LinearProgress, Typography } from '@mui/material'
import { StorageInfo } from '../types'

function fmt(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`
  return `${(bytes / 1e3).toFixed(0)} KB`
}

interface Props {
  storage: StorageInfo | null
  compact?: boolean
}

export default function StorageBar({ storage, compact = false }: Props) {
  if (!storage) return null
  const isLow = storage.percent_used > 80
  const barColor = isLow ? '#F05A22' : '#171A31'

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>ストレージ</Typography>
        <Typography sx={{ fontSize: '0.7rem', color: isLow ? '#F05A22' : 'text.secondary', fontWeight: isLow ? 700 : 400 }}>
          {fmt(storage.free)} 空き / {fmt(storage.total)}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={Math.min(storage.percent_used, 100)}
        sx={{
          height: compact ? 4 : 6,
          borderRadius: 1,
          backgroundColor: 'rgba(0,0,0,0.08)',
          '& .MuiLinearProgress-bar': { backgroundColor: barColor },
        }}
      />
      {isLow && (
        <Typography sx={{ fontSize: '0.65rem', color: '#F05A22', mt: 0.5, fontWeight: 600 }}>
          空き容量が少なくなっています
        </Typography>
      )}
    </Box>
  )
}
