import { Link, NavLink } from 'react-router-dom'
import { StorageModeBadge } from './StorageModeBadge'
import { DemoResetButton } from './DemoResetButton'
import { ClientCompanyName } from './ClientCompanyName'

const glLogo = import.meta.env.VITE_GROWTHLOOP_LOGO_URL as string | undefined
const clientLogo = import.meta.env.VITE_CLIENT_LOGO_URL as string | undefined

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'nav-link nav-link-active' : 'nav-link'

export function AppHeader() {
  return (
    <header className="app-header">
      <div className="app-header-brand">
        <div className="logo-cluster">
          <Link to="/" className="logo-cluster-home">
            {glLogo ? (
              <img src={glLogo} alt="GrowthLoop" className="logo logo-gl" />
            ) : (
              <span className="logo-fallback">GrowthLoop</span>
            )}
          </Link>
          <span className="logo-sep" aria-hidden>
            ×
          </span>
          {clientLogo ? (
            <img src={clientLogo} alt="" className="logo logo-client" />
          ) : (
            <ClientCompanyName />
          )}
        </div>
      </div>
      <div className="app-header-meta">
        <StorageModeBadge />
        <DemoResetButton />
      </div>
      <nav className="app-nav">
        <NavLink to="/" end className={navLinkClass}>
          Events
        </NavLink>
        <NavLink to="/mock-content" className={navLinkClass}>
          Experiences
        </NavLink>
        <NavLink to="/v2" end className={navLinkClass}>
          Events v2
        </NavLink>
        <NavLink to="/v2/content" className={navLinkClass}>
          Experiences v2
        </NavLink>
        <NavLink to="/personalization" className={navLinkClass}>
          Personalization API
        </NavLink>
      </nav>
    </header>
  )
}
