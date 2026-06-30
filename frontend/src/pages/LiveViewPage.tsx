import React, { useCallback, useEffect, useState } from 'react'
import {
  Alert, Box, Button, Card, CardContent, CardMedia, CircularProgress,
  Grid, Snackbar, Stack, TextField, ToggleButton, Tooltip, Typography,
} from '@mui/material'
import {
  CameraAlt, CenterFocusStrong, FiberManualRecord, GridOn, Stop, Timer,
} from '@mui/icons-material'
import { api } from '../api/client'
import StorageBar from '../components/StorageBar'
import { AppSettings, StatusUpdate } from '../types'

interface Props {
  status: StatusUpdate | null
}

type Toast = { open: boolean; message: string; severity: 'success' | 'error' }

export default function LiveViewPage({ status }: Props) {
  const [sampleId, setSampleId] = useState('')

  useEffect(() => {
    api.getSettings().then(s => {
      const loaded = s as AppSettings
      if (loaded.annotation.default_sample_id) {
        setSampleId(loaded.annotation.default_sample_id)
      }
    })
  }, [])
  const [showGrid, setShowGrid] = useState(false)
  const [showPeaking, setShowPeaking] = useState(false)
  const [lastCapture, setLastCapture] = useState<string | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [toast, setToast] = useState<Toast>({ open: false, message: '', severity: 'success' })

  const notify = (message: string, severity: 'success' | 'error' = 'success') =>
    setToast({ open: true, message, severity })

  const handleCapture = useCallback(async () => {
    if (capturing) return
    setCapturing(true)
    try {
      const result = await api.capture(sampleId)
      setLastCapture(api.fileUrl(result.path))
      notify('撮影しました')
    } catch {
      notify('撮影に失敗しました', 'error')
    } finally {
      setCapturing(false)
    }
  }, [sampleId, capturing])

  const handleRecord = async () => {
    try {
      if (status?.recording) {
        await api.stopRecording()
        notify('録画を停止しました')
      } else {
        await api.startRecording(sampleId)
        notify('録画を開始しました')
      }
    } catch {
      notify('録画操作に失敗しました', 'error')
    }
  }

  const handleInterval = async () => {
    try {
      if (status?.interval) {
        await api.stopInterval()
        notify('インターバル撮影を停止しました')
      } else {
        await api.startInterval(sampleId)
        notify('インターバル撮影を開始しました')
      }
    } catch {
      notify('インターバル操作に失敗しました', 'error')
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault()
        handleCapture()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleCapture])

  const counter = status?.counter
  const total = status?.total

  return (
    <Box sx={{ p: 2, height: '100%' }}>
      <Grid container spacing={2}>
        {/* ---- Live View ---- */}
        <Grid item xs={12} md={8}>
          <Box
            sx={{
              position: 'relative', borderRadius: 2, overflow: 'hidden',
              backgroundColor: '#06071a', aspectRatio: '16/9',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
            }}
          >
            <img
              src={api.streamUrl()}
              alt="Live View"
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
            />

            {/* Grid overlay */}
            {showGrid && (
              <Box sx={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                backgroundImage: `
                  linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)
                `,
                backgroundSize: '33.33% 33.33%',
              }} />
            )}

            {/* Peaking overlay */}
            {showPeaking && (
              <Box sx={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                outline: '2px solid rgba(240,90,34,0.4)',
                boxShadow: 'inset 0 0 0 1px rgba(240,90,34,0.15)',
              }} />
            )}

            {/* Interval badge */}
            {status?.interval && (
              <Box sx={{ position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(23,26,49,0.8)', borderRadius: 1, px: 1, py: 0.25 }}>
                <Typography sx={{ fontSize: '0.65rem', color: '#fff', fontWeight: 600, letterSpacing: 0.5 }}>
                  ● INTERVAL
                </Typography>
              </Box>
            )}

            {/* Recording badge */}
            {status?.recording && (
              <Box sx={{
                position: 'absolute', top: 10, right: 10,
                backgroundColor: '#F05A22', borderRadius: 1, px: 1, py: 0.25,
                animation: 'blink 1.2s infinite',
                '@keyframes blink': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } },
              }}>
                <Typography sx={{ fontSize: '0.65rem', color: '#fff', fontWeight: 700 }}>● REC</Typography>
              </Box>
            )}

            {/* Focus assist toggles */}
            <Box sx={{ position: 'absolute', bottom: 10, right: 10, display: 'flex', gap: 0.5 }}>
              <Tooltip title="グリッドライン">
                <ToggleButton
                  value="grid" selected={showGrid} onChange={() => setShowGrid(v => !v)} size="small"
                  sx={{
                    p: 0.5, minWidth: 30, height: 30, border: 'none',
                    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 1,
                    color: showGrid ? '#F05A22' : 'rgba(255,255,255,0.6)',
                    '&.Mui-selected': { backgroundColor: 'rgba(0,0,0,0.7)', color: '#F05A22' },
                    '&:hover': { backgroundColor: 'rgba(0,0,0,0.7)' },
                  }}
                >
                  <GridOn sx={{ fontSize: 16 }} />
                </ToggleButton>
              </Tooltip>
              <Tooltip title="ピーキング">
                <ToggleButton
                  value="peaking" selected={showPeaking} onChange={() => setShowPeaking(v => !v)} size="small"
                  sx={{
                    p: 0.5, minWidth: 30, height: 30, border: 'none',
                    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 1,
                    color: showPeaking ? '#F05A22' : 'rgba(255,255,255,0.6)',
                    '&.Mui-selected': { backgroundColor: 'rgba(0,0,0,0.7)', color: '#F05A22' },
                    '&:hover': { backgroundColor: 'rgba(0,0,0,0.7)' },
                  }}
                >
                  <CenterFocusStrong sx={{ fontSize: 16 }} />
                </ToggleButton>
              </Tooltip>
            </Box>
          </Box>
        </Grid>

        {/* ---- Controls ---- */}
        <Grid item xs={12} md={4}>
          <Stack spacing={1.5}>
            {/* Sample ID */}
            <Card elevation={1}>
              <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                <TextField
                  fullWidth size="small" label="サンプルID"
                  value={sampleId} onChange={e => setSampleId(e.target.value)}
                  placeholder="例: sample-001"
                  sx={{
                    '& .MuiOutlinedInput-root.Mui-focused fieldset': { borderColor: '#171A31' },
                    '& label.Mui-focused': { color: '#171A31' },
                  }}
                />
              </CardContent>
            </Card>

            {/* Capture / Record */}
            <Card elevation={1}>
              <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8, mb: 1 }}>
                  撮影
                </Typography>
                <Stack spacing={1}>
                  <Button
                    fullWidth variant="contained" onClick={handleCapture}
                    disabled={capturing || !!status?.recording}
                    startIcon={capturing ? <CircularProgress size={15} color="inherit" /> : <CameraAlt />}
                    sx={{ backgroundColor: '#171A31', '&:hover': { backgroundColor: '#252849' } }}
                  >
                    静止画撮影
                  </Button>
                  <Button
                    fullWidth variant={status?.recording ? 'contained' : 'outlined'}
                    onClick={handleRecord}
                    startIcon={status?.recording ? <Stop /> : <FiberManualRecord />}
                    sx={status?.recording ? {
                      backgroundColor: '#F05A22', color: '#fff',
                      '&:hover': { backgroundColor: '#c84819' },
                    } : {
                      borderColor: '#171A31', color: '#171A31',
                      '&:hover': { borderColor: '#F05A22', color: '#F05A22', backgroundColor: 'rgba(240,90,34,0.04)' },
                    }}
                  >
                    {status?.recording ? '録画停止' : '録画開始'}
                  </Button>
                </Stack>
              </CardContent>
            </Card>

            {/* Interval */}
            <Card elevation={1}>
              <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8, mb: 1 }}>
                  インターバル撮影
                </Typography>
                <Button
                  fullWidth variant={status?.interval ? 'contained' : 'outlined'}
                  startIcon={<Timer />} onClick={handleInterval}
                  sx={status?.interval ? {
                    backgroundColor: '#171A31', color: '#fff',
                    '&:hover': { backgroundColor: '#252849' },
                  } : {
                    borderColor: '#171A31', color: '#171A31',
                    '&:hover': { borderColor: '#171A31', backgroundColor: 'rgba(23,26,49,0.05)' },
                  }}
                >
                  {status?.interval ? 'インターバル停止' : 'インターバル開始'}
                </Button>
              </CardContent>
            </Card>

            {/* Counter */}
            <Card elevation={1}>
              <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8, mb: 1 }}>
                  本日の撮影枚数
                </Typography>
                <Grid container spacing={1}>
                  {[
                    { label: '写真', value: counter?.photos ?? 0 },
                    { label: '動画', value: counter?.videos ?? 0 },
                    { label: '累計', value: total?.total ?? 0 },
                  ].map(({ label, value }) => (
                    <Grid item xs={4} key={label}>
                      <Box sx={{ textAlign: 'center', py: 0.75, borderRadius: 1.5, backgroundColor: '#f4f4f6' }}>
                        <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: '#171A31', lineHeight: 1.1 }}>
                          {value}
                        </Typography>
                        <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>{label}</Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>

            {/* Last capture */}
            {lastCapture && (
              <Card elevation={1} sx={{ overflow: 'hidden' }}>
                <CardContent sx={{ py: 1, px: 2, '&:last-child': { pb: 0 } }}>
                  <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    直前のキャプチャ
                  </Typography>
                </CardContent>
                <CardMedia
                  component="img" src={lastCapture} alt="Last capture"
                  sx={{ maxHeight: 120, objectFit: 'cover' }}
                />
              </Card>
            )}

            {/* Storage */}
            <Card elevation={1}>
              <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                <StorageBar storage={status?.storage ?? null} compact />
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>

      <Snackbar open={toast.open} autoHideDuration={3000} onClose={() => setToast(t => ({ ...t, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={toast.severity} onClose={() => setToast(t => ({ ...t, open: false }))} sx={{ width: '100%' }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
