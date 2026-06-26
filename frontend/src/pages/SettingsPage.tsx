import React, { useEffect, useState } from 'react'
import {
  Alert, Box, Button, Card, CardContent, FormControl, Grid,
  InputLabel, MenuItem, Select, Snackbar, Stack, TextField, Typography,
} from '@mui/material'
import { SettingsOutlined, Storage, Wifi } from '@mui/icons-material'
import { api } from '../api/client'
import StorageBar from '../components/StorageBar'
import { AppSettings, StatusUpdate } from '../types'

const RESOLUTIONS = ['640x480', '1280x720', '1920x1080', '2028x1520', '4056x3040']
const FRAMERATES = [10, 15, 24, 30, 60]
const WB_MODES = [
  { value: 'auto', label: 'オート' },
  { value: 'incandescent', label: '白熱灯' },
  { value: 'fluorescent', label: '蛍光灯' },
  { value: 'daylight', label: '昼光' },
  { value: 'cloudy', label: '曇り' },
]
const EXPOSURES = [
  { value: 'auto', label: 'オート' },
  { value: '1000', label: '1/1000s' },
  { value: '5000', label: '1/200s' },
  { value: '10000', label: '1/100s' },
  { value: '33333', label: '1/30s' },
]

type Toast = { open: boolean; message: string; severity: 'success' | 'error' }

interface Props {
  status: StatusUpdate | null
}

export default function SettingsPage({ status }: Props) {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<Toast>({ open: false, message: '', severity: 'success' })
  const [intervalInput, setIntervalInput] = useState('')
  const [maxShotsInput, setMaxShotsInput] = useState('')

  useEffect(() => {
    api.getSettings().then(s => {
      const loaded = s as AppSettings
      setSettings(loaded)
      setIntervalInput(String(loaded.interval.interval_seconds))
      setMaxShotsInput(String(loaded.interval.max_shots))
    })
  }, [])

  const patch = (section: keyof AppSettings, key: string, value: unknown) =>
    setSettings(prev => prev ? { ...prev, [section]: { ...prev[section], [key]: value } } : prev)

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    try {
      await api.updateSettings(settings)
      setToast({ open: true, message: '設定を保存しました', severity: 'success' })
    } catch {
      setToast({ open: true, message: '保存に失敗しました', severity: 'error' })
    }
    setSaving(false)
  }

  if (!settings) {
    return <Box sx={{ p: 2 }}><Typography>読み込み中...</Typography></Box>
  }

  const sectionTitle = (icon: React.ReactNode, label: string) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
      <Box sx={{ color: '#171A31' }}>{icon}</Box>
      <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: '#171A31' }}>{label}</Typography>
    </Box>
  )

  return (
    <Box sx={{ p: 2, maxWidth: 780 }}>
      <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: '#171A31', mb: 2 }}>設定</Typography>

      <Stack spacing={2}>
        {/* Camera */}
        <Card elevation={1}>
          <CardContent>
            {sectionTitle(<SettingsOutlined sx={{ fontSize: 18 }} />, 'カメラ設定')}
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>解像度</InputLabel>
                  <Select
                    value={settings.camera.resolution} label="解像度"
                    onChange={e => patch('camera', 'resolution', e.target.value)}
                  >
                    {RESOLUTIONS.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>フレームレート</InputLabel>
                  <Select
                    value={settings.camera.framerate} label="フレームレート"
                    onChange={e => patch('camera', 'framerate', Number(e.target.value))}
                  >
                    {FRAMERATES.map(f => <MenuItem key={f} value={f}>{f} fps</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>露出</InputLabel>
                  <Select
                    value={String(settings.camera.exposure)} label="露出"
                    onChange={e => patch('camera', 'exposure', e.target.value)}
                  >
                    {EXPOSURES.map(e => <MenuItem key={e.value} value={e.value}>{e.label}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>ホワイトバランス</InputLabel>
                  <Select
                    value={settings.camera.white_balance} label="ホワイトバランス"
                    onChange={e => patch('camera', 'white_balance', e.target.value)}
                  >
                    {WB_MODES.map(w => <MenuItem key={w.value} value={w.value}>{w.label}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Interval */}
        <Card elevation={1}>
          <CardContent>
            {sectionTitle(null, 'インターバル撮影設定')}
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth size="small" label="撮影間隔（秒）"
                  type="number" inputProps={{ min: 1, max: 3600 }}
                  value={intervalInput}
                  onChange={e => setIntervalInput(e.target.value)}
                  onBlur={() => {
                    const num = parseInt(intervalInput, 10)
                    if (!isNaN(num) && num >= 1) {
                      patch('interval', 'interval_seconds', num)
                    } else {
                      setIntervalInput(String(settings.interval.interval_seconds))
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth size="small" label="最大撮影枚数（0 = 無制限）"
                  type="number" inputProps={{ min: 0 }}
                  value={maxShotsInput}
                  onChange={e => setMaxShotsInput(e.target.value)}
                  onBlur={() => {
                    const num = parseInt(maxShotsInput, 10)
                    if (!isNaN(num) && num >= 0) {
                      patch('interval', 'max_shots', num)
                    } else {
                      setMaxShotsInput(String(settings.interval.max_shots))
                    }
                  }}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Annotation */}
        <Card elevation={1}>
          <CardContent>
            {sectionTitle(null, 'アノテーション初期値')}
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth size="small" label="デフォルトサンプルID"
                  value={settings.annotation.default_sample_id}
                  onChange={e => patch('annotation', 'default_sample_id', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth size="small" label="デフォルトノート"
                  value={settings.annotation.default_note}
                  onChange={e => patch('annotation', 'default_note', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth size="small" label="観察条件"
                  value={settings.annotation.default_condition}
                  onChange={e => patch('annotation', 'default_condition', e.target.value)}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Network */}
        <Card elevation={1}>
          <CardContent>
            {sectionTitle(<Wifi sx={{ fontSize: 18 }} />, 'ネットワーク情報')}
            <Grid container spacing={2}>
              {[
                { label: 'IPアドレス', value: status?.network?.ip ?? '---' },
                { label: 'ホスト名', value: status?.network?.hostname ?? '---' },
                { label: 'アクセスURL', value: `http://${status?.network?.ip ?? '---'}:5000` },
              ].map(({ label, value }) => (
                <Grid item xs={12} sm={4} key={label}>
                  <Box>
                    <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', mb: 0.25 }}>{label}</Typography>
                    <Typography sx={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.85rem', color: '#171A31' }}>
                      {value}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>

        {/* Storage */}
        <Card elevation={1}>
          <CardContent>
            {sectionTitle(<Storage sx={{ fontSize: 18 }} />, 'ストレージ管理')}
            <StorageBar storage={status?.storage ?? null} />
            {status?.storage && (
              <Grid container spacing={2} sx={{ mt: 1 }}>
                {[
                  { label: '総容量', value: status.storage.total },
                  { label: '使用中', value: status.storage.used },
                  { label: '空き', value: status.storage.free },
                ].map(({ label, value }) => (
                  <Grid item xs={4} key={label}>
                    <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>{label}</Typography>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: '#171A31' }}>
                      {value >= 1e9 ? `${(value / 1e9).toFixed(1)} GB` : `${(value / 1e6).toFixed(0)} MB`}
                    </Typography>
                  </Grid>
                ))}
              </Grid>
            )}
          </CardContent>
        </Card>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained" onClick={handleSave} disabled={saving}
            sx={{ backgroundColor: '#171A31', '&:hover': { backgroundColor: '#252849' }, px: 4 }}
          >
            {saving ? '保存中...' : '設定を保存'}
          </Button>
        </Box>
      </Stack>

      <Snackbar open={toast.open} autoHideDuration={3000} onClose={() => setToast(t => ({ ...t, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={toast.severity} onClose={() => setToast(t => ({ ...t, open: false }))}>{toast.message}</Alert>
      </Snackbar>
    </Box>
  )
}
