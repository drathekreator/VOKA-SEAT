import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AdminAppShell from './admin/AdminAppShell'
import CustomerApp from './customer/CustomerApp'

/**
 * Hostname/path-based switch so the admin and customer entry points
 * can coexist in the same Vite build without pulling in a router.
 *
 * Production (subdomain-based routing via host-side nginx):
 *   - vokafe-admin.duckdns.org  → AdminAppShell
 *   - vokafe.duckdns.org        → CustomerApp
 *
 * Development / local preview (single host, path-based):
 *   - http://localhost:5173/           → AdminAppShell
 *   - http://localhost:5173/customer   → CustomerApp
 *
 * The hostname check fires first so deployed instances do not depend on
 * any URL path. The path-based fallback keeps `npm run dev` ergonomic.
 */
function Root() {
  const host = window.location.hostname.toLowerCase()
  const path = window.location.pathname

  // Subdomain dispatch (production)
  if (host.startsWith('vokafe-admin.')) {
    return <AdminAppShell />
  }
  if (host === 'vokafe.duckdns.org' || host.startsWith('vokafe.')) {
    return <CustomerApp />
  }

  // Local dev / preview fallback
  if (path.startsWith('/customer')) {
    return <CustomerApp />
  }
  return <AdminAppShell />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
