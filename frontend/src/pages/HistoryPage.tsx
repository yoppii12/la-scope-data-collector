import React, { useCallback, useEffect, useState } from 'react'
import {
  Alert, Box, Button, Card, CardContent, Chip, Collapse, Dialog,
  DialogContent, DialogTitle, Divider, Grid, IconButton, LinearProgress,
  Paper, Snackbar, Tooltip, Typography,
} from '@mui/material'
import {
  Close, Delete, Download, ExpandLess, ExpandMore,
  FolderZip, Image as ImageIcon, TableChart, Videocam,
} from '@mui/icons-material'
import { api } from '../api/client'
import StorageBar from '../components/StorageBar'
import { DateFolder, FileItem, StatusUpdate } from '../types'

function fmtSize(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`
  return `${(bytes / 1e3).toFixed(0)} KB`
}

function fmtDate(d: string): string {
  if (d.length === 6)
    return `20${d.slice(0, 2)}年${d.slice(2, 4)}月${d.slice(4, 6)}日`
  return d
}

type Toast = { open: boolean; message: string; severity: 'success' | 'error' }

interface FolderCardProps {
  folder: DateFolder
}

function FolderCard({ folder }: FolderCardProps) {
  const [open, setOpen] = useState(false)
  const [files, setFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [preview, setPreview] = useState<FileItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FileItem | null>(null)
  const [toast, setToast] = useState<Toast>({ open: false, message: '', severity: 'success' })

  const loadFiles = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await api.getFolder(folder.date) as FileItem[]
      setFiles(data)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'ファイルの読み込みに失敗しました')
    }
    setLoading(false)
  }, [folder.date])

  const handleToggle = () => {
    setOpen(o => {
      if (!o) loadFiles()
      return !o
    })
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await api.deleteFile(folder.date, deleteTarget.name)
      setToast({ open: true, message: '削除しました', severity: 'success' })
      loadFiles()
    } catch {
      setToast({ open: true, message: '削除に失敗しました', severity: 'error' })
    }
    setDeleteTarget(null)
  }

  return (
    <Card elevation={1} sx={{ mb: 1.5 }}>
      <CardContent
        sx={{ py: 1.5, px: 2, cursor: 'pointer', '&:last-child': { pb: 1.5 }, '&:hover': { backgroundColor: 'rgba(23,26,49,0.02)' } }}
        onClick={handleToggle}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: '#171A31' }}>
              {fmtDate(folder.date)}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 0.5, alignItems: 'center' }}>
              <Chip
                icon={<ImageIcon sx={{ fontSize: '11px !important' }} />}
                label={`${folder.photo_count}枚`}
                size="small" sx={{ height: 20, fontSize: '0.65rem' }}
              />
              <Chip
                icon={<Videocam sx={{ fontSize: '11px !important' }} />}
                label={`${folder.video_count}本`}
                size="small" sx={{ height: 20, fontSize: '0.65rem' }}
              />
              <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                {fmtSize(folder.total_size)}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Tooltip title="ZIPダウンロード">
              <IconButton size="small" onClick={e => { e.stopPropagation(); window.location.href = api.zipUrl(folder.date) }}>
                <FolderZip sx={{ fontSize: 18, color: '#171A31' }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="CSVエクスポート">
              <IconButton size="small" onClick={e => { e.stopPropagation(); window.location.href = api.csvUrl(folder.date) }}>
                <TableChart sx={{ fontSize: 18, color: '#171A31' }} />
              </IconButton>
            </Tooltip>
            {open ? <ExpandLess sx={{ color: 'text.secondary' }} /> : <ExpandMore sx={{ color: 'text.secondary' }} />}
          </Box>
        </Box>
      </CardContent>

      <Collapse in={open}>
        <Divider />
        {loading && <LinearProgress />}
        <Box sx={{ p: 1.5 }}>
          {loadError && (
            <Box sx={{ mb: 1.5, p: 1.5, backgroundColor: '#fff3f0', borderRadius: 1, border: '1px solid rgba(240,90,34,0.3)' }}>
              <Typography sx={{ fontSize: '0.75rem', color: '#c84819', mb: 0.5 }}>
                読み込みエラー: {loadError}
              </Typography>
              <Button size="small" onClick={loadFiles} sx={{ fontSize: '0.7rem', color: '#c84819', p: 0, minWidth: 0 }}>
                再試行
              </Button>
            </Box>
          )}
          <Grid container spacing={1}>
            {files.map(file => (
              <Grid item xs={6} sm={4} md={3} lg={2} key={file.name}>
                <Paper
                  elevation={0}
                  sx={{
                    border: '1px solid rgba(0,0,0,0.08)', borderRadius: 1.5, overflow: 'hidden',
                    cursor: 'pointer', transition: 'border-color 0.15s',
                    '&:hover': { borderColor: '#171A31' },
                  }}
                  onClick={() => setPreview(file)}
                >
                  <Box sx={{ aspectRatio: '4/3', backgroundColor: '#06071a', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {file.type === 'image' ? (
                      <img
                        src={api.fileUrl(file.path)} alt={file.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <Videocam sx={{ fontSize: 28, color: 'rgba(255,255,255,0.4)' }} />
                    )}
                  </Box>
                  <Box sx={{ p: 0.75 }}>
                    <Typography sx={{ fontSize: '0.62rem', color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                      {file.name}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.25 }}>
                      <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>{fmtSize(file.size)}</Typography>
                      <IconButton
                        size="small" sx={{ p: 0.25 }}
                        onClick={e => { e.stopPropagation(); setDeleteTarget(file) }}
                      >
                        <Delete sx={{ fontSize: 13, color: 'rgba(0,0,0,0.25)' }} />
                      </IconButton>
                    </Box>
                  </Box>
                </Paper>
              </Grid>
            ))}
            {!loading && files.length === 0 && (
              <Grid item xs={12}>
                <Typography sx={{ color: 'text.secondary', textAlign: 'center', py: 2, fontSize: '0.875rem' }}>
                  ファイルがありません
                </Typography>
              </Grid>
            )}
          </Grid>
        </Box>
      </Collapse>

      {/* Preview */}
      <Dialog open={!!preview} onClose={() => setPreview(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ py: 1, px: 2, backgroundColor: '#171A31', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>{preview?.name}</Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="ダウンロード">
              <IconButton size="small" sx={{ color: '#fff' }} onClick={() => { window.location.href = api.fileUrl(preview!.path) }}>
                <Download sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            <IconButton size="small" sx={{ color: '#fff' }} onClick={() => setPreview(null)}>
              <Close sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <Box sx={{ backgroundColor: '#06071a', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240 }}>
            {preview?.type === 'image' && (
              <img src={api.fileUrl(preview.path)} alt={preview.name} style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain' }} />
            )}
            {preview?.type === 'video' && (
              <video src={api.fileUrl(preview.path)} controls style={{ maxWidth: '100%', maxHeight: '60vh' }} />
            )}
          </Box>
          {preview?.metadata && (
            <Box sx={{ p: 2, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
              <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8, mb: 1.5 }}>
                メタデータ
              </Typography>
              <Grid container spacing={1.5}>
                {[
                  { label: 'サンプルID', value: preview.metadata.sample_id as string || '—' },
                  { label: '撮影日時', value: preview.metadata.captured_at ? new Date(preview.metadata.captured_at as string).toLocaleString('ja-JP') : '—' },
                  { label: 'ノート', value: preview.metadata.note as string || '—' },
                  { label: '観察条件', value: preview.metadata.condition as string || '—' },
                ].map(({ label, value }) => (
                  <Grid item xs={6} sm={3} key={label}>
                    <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', mb: 0.25 }}>{label}</Typography>
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#171A31' }}>{value}</Typography>
                  </Grid>
                ))}
              </Grid>
              {!!(preview.metadata.camera_settings) && (
                <>
                  <Divider sx={{ my: 1.5 }} />
                  <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8, mb: 1.5 }}>
                    カメラ設定
                  </Typography>
                  <Grid container spacing={1.5}>
                    {Object.entries(preview.metadata.camera_settings as Record<string, unknown>).map(([key, value]) => (
                      <Grid item xs={6} sm={3} key={key}>
                        <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', mb: 0.25 }}>{key}</Typography>
                        <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#171A31', fontFamily: 'monospace' }}>{`${value}`}</Typography>
                      </Grid>
                    ))}
                  </Grid>
                </>
              )}
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1, fontSize: '1rem' }}>ファイルの削除</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            <strong>{deleteTarget?.name}</strong> を削除しますか？この操作は取り消せません。
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Button size="small" onClick={() => setDeleteTarget(null)}>キャンセル</Button>
            <Button size="small" variant="contained" onClick={handleDelete}
              sx={{ backgroundColor: '#F05A22', '&:hover': { backgroundColor: '#c84819' } }}>
              削除する
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      <Snackbar open={toast.open} autoHideDuration={3000} onClose={() => setToast(t => ({ ...t, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={toast.severity} onClose={() => setToast(t => ({ ...t, open: false }))}>{toast.message}</Alert>
      </Snackbar>
    </Card>
  )
}

interface Props {
  status: StatusUpdate | null
}

export default function HistoryPage({ status }: Props) {
  const [folders, setFolders] = useState<DateFolder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getFiles().then(data => setFolders(data as DateFolder[])).finally(() => setLoading(false))
  }, [])

  // フォルダ一覧を再取得（新規撮影で当日フォルダが生まれた場合に対応）
  useEffect(() => {
    if (!loading) {
      api.getFiles().then(data => setFolders(data as DateFolder[])).catch(() => {})
    }
  }, [status?.total?.total])

  return (
    <Box sx={{ p: 2, maxWidth: 1200 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: '#171A31' }}>撮影履歴</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button size="small" variant="outlined" startIcon={<FolderZip />}
            onClick={() => { window.location.href = api.zipUrl() }}
            sx={{ borderColor: '#171A31', color: '#171A31', fontSize: '0.75rem' }}>
            全てZIP
          </Button>
          <Button size="small" variant="outlined" startIcon={<TableChart />}
            onClick={() => { window.location.href = api.csvUrl() }}
            sx={{ borderColor: '#171A31', color: '#171A31', fontSize: '0.75rem' }}>
            全てCSV
          </Button>
        </Box>
      </Box>

      <Box sx={{ mb: 2 }}>
        <StorageBar storage={status?.storage ?? null} />
      </Box>

      {loading ? (
        <LinearProgress />
      ) : folders.length === 0 ? (
        <Paper elevation={0} sx={{ p: 4, textAlign: 'center', border: '1px dashed rgba(0,0,0,0.15)', borderRadius: 2 }}>
          <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>撮影データがありません</Typography>
        </Paper>
      ) : (
        folders.map(folder => <FolderCard key={folder.date} folder={folder} />)
      )}
    </Box>
  )
}
