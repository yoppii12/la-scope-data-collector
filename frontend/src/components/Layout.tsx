import React, { useState } from 'react'
import {
  AppBar, Box, Chip, CssBaseline, Divider, Drawer, IconButton,
  List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Toolbar, Typography,
} from '@mui/material'
import {
  FiberManualRecord, History, Menu as MenuIcon, Settings, Videocam, Wifi,
} from '@mui/icons-material'
import { useLocation, useNavigate } from 'react-router-dom'
import { StatusUpdate } from '../types'

const DRAWER_WIDTH = 220

const NAV = [
  { label: 'ライブビュー', path: '/', icon: <Videocam /> },
  { label: '履歴・閲覧', path: '/history', icon: <History /> },
  { label: '設定', path: '/settings', icon: <Settings /> },
]

interface Props {
  children: React.ReactNode
  status: StatusUpdate | null
}

export default function Layout({ children, status }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const currentLabel = NAV.find(n => n.path === location.pathname)?.label ?? ''

  const DrawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', pt: 1 }}>
      <Box sx={{ px: 2.5, py: 2 }}>
        <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1.5, mb: 0.25 }}>
          LA-Scope
        </Typography>
        <Typography sx={{ color: '#FFFFFF', fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.3 }}>
          Dataset Collector
        </Typography>
      </Box>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
      <List sx={{ px: 1, pt: 1, flexGrow: 1 }}>
        {NAV.map(item => {
          const active = location.pathname === item.path
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.25 }}>
              <ListItemButton
                onClick={() => { navigate(item.path); setMobileOpen(false) }}
                sx={{
                  borderRadius: 1.5,
                  backgroundColor: active ? 'rgba(255,255,255,0.12)' : 'transparent',
                  '&:hover': { backgroundColor: active ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.06)' },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: active ? '#FFFFFF' : 'rgba(255,255,255,0.5)' }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontSize: '0.875rem',
                    fontWeight: active ? 600 : 400,
                    color: active ? '#FFFFFF' : 'rgba(255,255,255,0.65)',
                  }}
                />
              </ListItemButton>
            </ListItem>
          )
        })}
      </List>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', mx: 2 }} />
      <Box sx={{ px: 2.5, py: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Wifi sx={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }} />
        <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
          {status?.network?.ip ?? '---'}
        </Typography>
      </Box>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', height: '100vh', backgroundColor: 'background.default' }}>
      <CssBaseline />

      <AppBar position="fixed" elevation={0} sx={{ zIndex: t => t.zIndex.drawer + 1, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Toolbar variant="dense" sx={{ minHeight: 48 }}>
          <IconButton edge="start" color="inherit" onClick={() => setMobileOpen(!mobileOpen)} sx={{ mr: 1, display: { sm: 'none' } }}>
            <MenuIcon />
          </IconButton>
          <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', letterSpacing: 0.3 }}>
            LA-Scope Dataset Collector
          </Typography>
          {currentLabel && (
            <Typography sx={{ ml: 1.5, fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
              / {currentLabel}
            </Typography>
          )}
          <Box sx={{ flexGrow: 1 }} />
          {status?.recording && (
            <Chip
              icon={<FiberManualRecord sx={{ fontSize: '10px !important', animation: 'blink 1s infinite' }} />}
              label="REC"
              size="small"
              sx={{
                backgroundColor: '#F05A22', color: '#fff', fontWeight: 700, fontSize: '0.65rem', height: 20,
                '@keyframes blink': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.2 } },
              }}
            />
          )}
          {status?.interval && (
            <Chip label="INTERVAL" size="small" sx={{ ml: 1, backgroundColor: 'rgba(255,255,255,0.12)', color: '#fff', fontSize: '0.65rem', height: 20 }} />
          )}
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { sm: DRAWER_WIDTH }, flexShrink: { sm: 0 } }}>
        <Drawer
          variant="temporary" open={mobileOpen} onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: 'block', sm: 'none' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}
        >
          {DrawerContent}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{ display: { xs: 'none', sm: 'block' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', border: 'none' } }}
          open
        >
          {DrawerContent}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          mt: '48px',
          mb: '32px',
          overflow: 'auto',
        }}
      >
        {children}
      </Box>

      <Box
        component="footer"
        sx={{
          position: 'fixed', bottom: 0,
          left: { xs: 0, sm: DRAWER_WIDTH }, right: 0, height: 32,
          backgroundColor: '#171A31',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: t => t.zIndex.appBar - 1,
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', letterSpacing: 0.5 }}>
          Powered by LAplust Inc.
        </Typography>
      </Box>
    </Box>
  )
}
