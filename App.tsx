import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import {
  Link,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import './App.css'
import JobCard from './components/JobCard'
import JobForm, { type JobDraft } from './components/JobForm'
import { AuthProvider } from './contexts/AuthContext'
import { useAuth } from './contexts/useAuth'
import AuthPage from './pages/AuthPage'
import LandingPage from './pages/LandingPage'
import NotFoundPage from './pages/NotFoundPage'
import { createJob, deleteJob, getJobs, updateJob } from './services/jobs'
import type { Job, JobStatus } from './types/Job'

type ApplicationFilter = JobStatus | 'All' | 'In Progress'
type SortOrder = 'newest' | 'oldest' | 'company'

const filters: ApplicationFilter[] = [
  'All', 'Applied', 'Interviewed', 'Rejected', 'Offer', 'Saved', 'Withdrawn', 'Interview', 'In Progress',
]
const inProgressStatuses: JobStatus[] = ['Saved', 'Applied', 'Interview', 'Interviewed']

interface AppData {
  jobs: Job[]
  setJobs: Dispatch<SetStateAction<Job[]>>
  loading: boolean
  error: string | null
  setError: Dispatch<SetStateAction<string | null>>
  reloadJobs: () => Promise<void>
}

function useAppData() {
  return useOutletContext<AppData>()
}

function ProtectedRoute() {
  const { user } = useAuth()
  const location = useLocation()
  return user ? <Outlet /> : <Navigate to="/login" replace state={{ from: location }} />
}

function AppLayout() {
  const { user, logout } = useAuth()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const reloadJobs = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      setJobs(await getJobs(user.id))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load applications.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    let active = true
    if (!user) return
    getJobs(user.id)
      .then((loadedJobs) => {
        if (active) setJobs(loadedJobs)
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load applications.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [user])

  function updateQuery(key: string, value: string, defaultValue = '') {
    const next = new URLSearchParams(searchParams)
    if (value === defaultValue) next.delete(key)
    else next.set(key, value)
    setSearchParams(next, { replace: true })
  }

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const data = useMemo(
    () => ({ jobs, setJobs, loading, error, setError, reloadJobs }),
    [jobs, loading, error, reloadJobs],
  )

  return (
    <div className="app-container">
      <aside className="sidebar">
        <Link className="brand" to="/app" aria-label="JobTrack dashboard">
          <span className="brand-mark" aria-hidden="true">▣</span>
          <span>JobTrack</span>
        </Link>
        <nav className="sidebar-nav" aria-label="Main navigation">
          <NavLink end className={({ isActive }) => `nav-link${isActive ? ' nav-link-active' : ''}`} to="/app">
            <span className="nav-icon" aria-hidden="true">⌂</span>Dashboard
          </NavLink>
          <NavLink className={({ isActive }) => `nav-link${isActive ? ' nav-link-active' : ''}`} to="/app/applications">
            <span className="nav-icon" aria-hidden="true">▤</span>My Applications
          </NavLink>
          <Link className="nav-link" to="/app/jobs/new">
            <span className="nav-icon" aria-hidden="true">＋</span>Add Application
          </Link>
        </nav>
        <div className="sidebar-footer">
          <span className="avatar" aria-hidden="true">{user?.username.slice(0, 2).toUpperCase()}</span>
          <span className="profile-copy">
            <strong>{user?.username}</strong>
            <span>Personal tracker</span>
          </span>
          <button type="button" className="sign-out-button" onClick={handleLogout}>Log out</button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <label className="top-search">
            <span aria-hidden="true">⌕</span>
            <span className="sr-only">Search jobs</span>
            <input
              type="search"
              value={searchParams.get('q') ?? ''}
              onChange={(event) => updateQuery('q', event.target.value)}
              placeholder="Search company, role, or notes..."
            />
          </label>
          <div className="topbar-actions">
            <span className="topbar-avatar" aria-label={`${user?.username} profile`}>{user?.username.slice(0, 2).toUpperCase()}</span>
            <button type="button" className="topbar-sign-out" onClick={handleLogout}>Log out</button>
          </div>
        </header>
        <Outlet context={data} />
      </main>
    </div>
  )
}

function ApiError() {
  const { error, reloadJobs } = useAppData()
  if (!error) return null
  return (
    <div className="api-error" role="alert">
      <span>{error}</span>
      <button type="button" className="text-button" onClick={() => void reloadJobs()}>Retry</button>
    </div>
  )
}

function DashboardPage() {
  const { jobs, loading, error } = useAppData()
  const offerCount = jobs.filter((job) => job.status === 'Offer').length
  const progressCount = jobs.filter((job) => inProgressStatuses.includes(job.status)).length
  const rejectedCount = jobs.filter((job) => job.status === 'Rejected').length
  const total = jobs.length
  const appliedCount = jobs.filter((job) => job.status === 'Applied').length
  const interviewedCount = jobs.filter((job) => ['Interview', 'Interviewed'].includes(job.status)).length
  const otherCount = Math.max(0, total - appliedCount - interviewedCount - offerCount - rejectedCount)
  const percentage = (value: number) => total ? Math.round((value / total) * 100) : 0
  const recentJobs = [...jobs]
    .sort((left, right) => right.dateApplied.localeCompare(left.dateApplied))
    .slice(0, 3)
  const statistics = [
    { label: 'Total Applications', value: total, icon: '▰', tone: 'purple', note: 'Tracked so far' },
    { label: 'Offers', value: offerCount, icon: '✓', tone: 'green', note: 'Offers received' },
    { label: 'In Progress', value: progressCount, icon: '◷', tone: 'orange', note: 'Awaiting an outcome' },
    { label: 'Rejected', value: rejectedCount, icon: '×', tone: 'red', note: 'Closed applications' },
  ]

  return (
    <div className="dashboard-page">
      <ApiError />
      <header className="dashboard-heading">
        <div>
          <h1>Welcome back!</h1>
          <p>Track your job applications and stay on top of your career goals.</p>
        </div>
        <Link className="add-button" to="/app/jobs/new"><span aria-hidden="true">＋</span>Add Application</Link>
      </header>
      <section className="stats" aria-label="Application summary">
        {statistics.map((statistic) => (
          <article className={`stat-card stat-${statistic.tone}`} key={statistic.label}>
            <div className="stat-icon" aria-hidden="true">{statistic.icon}</div>
            <div className="stat-copy">
              <p className="stat-value">{statistic.value}</p>
              <p className="stat-label">{statistic.label}</p>
            </div>
            <span className="stat-note">{statistic.note}</span>
          </article>
        ))}
      </section>
      <div className="dashboard-panels">
        <section className="dashboard-panel status-panel" aria-labelledby="status-heading">
          <div className="panel-heading"><h2 id="status-heading">Application Status</h2></div>
          <div className="status-overview">
            <div
              className="status-chart"
              role="img"
              aria-label={`${total} applications: ${progressCount} in progress, ${offerCount} offers, ${rejectedCount} rejected`}
              style={{
                background: total
                  ? `conic-gradient(#f3b84b 0% ${percentage(appliedCount)}%, #35b86b ${percentage(appliedCount)}% ${percentage(appliedCount + interviewedCount + offerCount)}%, #ef4444 ${percentage(appliedCount + interviewedCount + offerCount)}% ${percentage(total - otherCount)}%, #a8a3b8 ${percentage(total - otherCount)}% 100%)`
                  : undefined,
              }}
            >
              <span><strong>{total}</strong><small>Total</small></span>
            </div>
            <div className="status-legend">
              <div className="legend-row"><i className="legend-orange" /><span>Applied</span><strong>{percentage(appliedCount)}%</strong></div>
              <div className="legend-row"><i className="legend-green" /><span>Interviewed / offers</span><strong>{percentage(interviewedCount + offerCount)}%</strong></div>
              <div className="legend-row"><i className="legend-red" /><span>Rejected</span><strong>{percentage(rejectedCount)}%</strong></div>
              <div className="legend-row"><i className="legend-gray" /><span>Saved / other</span><strong>{percentage(otherCount)}%</strong></div>
            </div>
          </div>
        </section>
        <section className="dashboard-panel activity-panel" aria-labelledby="activity-heading">
          <div className="panel-heading">
            <h2 id="activity-heading">Recent Applications</h2>
            <Link className="text-button" to="/app/applications">View All →</Link>
          </div>
          {loading ? <p className="list-message" role="status">Loading applications...</p> : error ? (
            <p className="activity-empty">Recent applications are unavailable until the API connection is restored.</p>
          ) : recentJobs.length ? (
            <ul className="activity-list">
              {recentJobs.map((job) => (
                <li className="activity-item" key={job.id}>
                  <span className={`activity-icon status-${job.status.toLowerCase()}`} aria-hidden="true">
                    {job.status === 'Offer' || job.status === 'Interviewed' ? '✓' : job.status === 'Rejected' ? '×' : '◷'}
                  </span>
                  <Link className="activity-copy" to={`/app/jobs/${encodeURIComponent(job.id)}`}>
                    <strong>{job.companyName}</strong>
                    <span>{job.role} · {job.status} · {new Date(`${job.dateApplied}T00:00:00`).toLocaleDateString()}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="activity-empty">Add your first application to see recent activity.</p>}
        </section>
      </div>
    </div>
  )
}

function ApplicationsPage() {
  const { jobs, setJobs, loading, error, setError } = useAppData()
  const [searchParams, setSearchParams] = useSearchParams()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const navigate = useNavigate()
  const search = (searchParams.get('q') ?? '').trim().toLowerCase()
  const requestedStatus = searchParams.get('status') as ApplicationFilter | null
  const statusFilter = requestedStatus && filters.includes(requestedStatus) ? requestedStatus : 'All'
  const requestedSort = searchParams.get('sort')
  const sortOrder: SortOrder = requestedSort === 'oldest' || requestedSort === 'company' ? requestedSort : 'newest'

  const visibleJobs = useMemo(() => jobs
    .filter((job) => statusFilter === 'All'
      || (statusFilter === 'In Progress' && inProgressStatuses.includes(job.status))
      || job.status === statusFilter)
    .filter((job) => !search || [job.companyName, job.role, job.duties, job.requirements]
      .some((value) => value?.toLowerCase().includes(search)))
    .sort((left, right) => sortOrder === 'company'
      ? left.companyName.localeCompare(right.companyName)
      : (sortOrder === 'newest' ? -1 : 1) * left.dateApplied.localeCompare(right.dateApplied)),
  [jobs, search, sortOrder, statusFilter])

  function updateQuery(key: string, value: string, defaultValue = '') {
    const next = new URLSearchParams(searchParams)
    if (value === defaultValue) next.delete(key)
    else next.set(key, value)
    setSearchParams(next, { replace: key === 'q' })
  }

  async function removeApplication(job: Job) {
    if (!window.confirm(`Delete the application for ${job.role} at ${job.companyName}?`)) return
    setDeletingId(job.id)
    setError(null)
    try {
      await deleteJob(job.id)
      setJobs((currentJobs) => currentJobs.filter((currentJob) => currentJob.id !== job.id))
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete this application.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className="applications-page" aria-labelledby="applications-heading">
      <ApiError />
      <header className="applications-page-heading">
        <div>
          <h1 id="applications-heading">My Applications</h1>
          <p>View and manage all your job applications.</p>
        </div>
        <Link className="add-button" to="/app/jobs/new"><span aria-hidden="true">＋</span>Add Application</Link>
      </header>
      <div className="application-toolbar">
        <div className="filter-group" aria-label="Filter by status">
          <span>Filter by:</span>
          {filters.map((filter) => (
            <button
              className={`filter-chip${statusFilter === filter ? ' filter-chip-active' : ''}`}
              type="button"
              key={filter}
              aria-pressed={statusFilter === filter}
              onClick={() => updateQuery('status', filter, 'All')}
            >{filter}</button>
          ))}
        </div>
        <label className="sort-control">
          <span>Sort by:</span>
          <select value={sortOrder} onChange={(event) => updateQuery('sort', event.target.value, 'newest')}>
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="company">Company A–Z</option>
          </select>
        </label>
      </div>
      {loading ? <p className="list-message" role="status">Loading applications...</p> : (
        <>
          <div className="application-list-heading">
            <span>{visibleJobs.length} applications</span><span>Applied</span><span>Status</span><span className="sr-only">Actions</span>
          </div>
          {error && jobs.length === 0 ? null : visibleJobs.length ? (
            <div className="job-list job-list-table">
              {visibleJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onEdit={(selectedJob) => navigate(`/app/jobs/${encodeURIComponent(selectedJob.id)}/edit`)}
                  onDelete={(selectedJob) => void removeApplication(selectedJob)}
                  deleting={deletingId === job.id}
                />
              ))}
            </div>
          ) : (
            <div className="list-message empty-state">
              <h2>{jobs.length ? 'No matching applications' : 'No applications yet'}</h2>
              <p>{jobs.length ? 'Try another search or status filter.' : 'Add your first opportunity and keep your job search organized.'}</p>
              {!jobs.length && <Link className="add-button" to="/app/jobs/new">＋ Add Application</Link>}
            </div>
          )}
        </>
      )}
    </section>
  )
}

function JobFormPage() {
  const { jobs, setJobs, loading, setError } = useAppData()
  const { user } = useAuth()
  const { jobId } = useParams()
  const navigate = useNavigate()
  const job = jobId ? jobs.find((item) => item.id === jobId) ?? null : null
  const isEditing = Boolean(jobId)

  async function saveApplication(draft: JobDraft) {
    setError(null)
    if (jobId) {
      if (!job) throw new Error('This application was not found.')
      const savedJob = await updateJob({ ...job, ...draft })
      setJobs((currentJobs) => currentJobs.map((item) => item.id === savedJob.id ? savedJob : item))
    } else {
      if (!user) throw new Error('Please log in to save an application.')
      const savedJob = await createJob({ ...draft, userId: user.id })
      setJobs((currentJobs) => [savedJob, ...currentJobs])
    }
    navigate('/app/applications')
  }

  if (isEditing && loading) return <p className="list-message" role="status">Loading application...</p>
  if (isEditing && !job) {
    return <><ApiError /><section className="not-found-inline"><h1>Application not found</h1><p>This application may have been deleted or is not available in your account.</p><Link className="add-button" to="/app/applications">Back to applications</Link></section></>
  }
  return <JobForm key={job?.id ?? 'new-job'} job={job} onSave={saveApplication} onClose={() => navigate('/app/applications')} />
}

function safeWebsiteHref(value: string): string | null {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

function JobDetailsPage() {
  const { jobs, loading, error } = useAppData()
  const { jobId } = useParams()
  const job = jobs.find((item) => item.id === jobId)
  if (loading && !job) return <p className="list-message" role="status">Loading application...</p>
  if (!job) {
    return <><ApiError /><section className="not-found-inline"><h1>{error ? 'Application unavailable' : 'Application not found'}</h1><p>{error ? 'Check the API connection and try again.' : 'This application may have been deleted or is not available in your account.'}</p><Link className="add-button" to="/app/applications">Back to applications</Link></section></>
  }
  const dateApplied = new Date(`${job.dateApplied}T00:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
  const details = [
    ['Location', job.location],
    ['Company address', job.companyAddress],
    ['Company website', job.companyWebsite],
    ['Contact person', job.contactName],
    ['Contact email', job.contactEmail],
    ['Contact phone', job.contactPhone],
  ].filter((item): item is [string, string] => Boolean(item[1]))
  return (
    <article className="job-details-page">
      <Link className="back-button" to="/app/applications">← Back to applications</Link>
      <header className="job-details-heading">
        <div className="company-mark company-mark-large" aria-hidden="true">{job.companyName.charAt(0).toUpperCase()}</div>
        <div className="job-details-title">
          <h1>{job.role}</h1>
          <p>{job.companyName}{job.location ? ` · ${job.location}` : ''}</p>
          <span className={`job-status status-${job.status.toLowerCase()}`}>{job.status}</span>
        </div>
        <Link className="add-button" to={`/app/jobs/${encodeURIComponent(job.id)}/edit`}>Edit application</Link>
      </header>
      <div className="details-grid">
        <section className="details-card">
          <h2>Application</h2>
          <dl><div><dt>Date applied</dt><dd>{dateApplied}</dd></div><div><dt>Status</dt><dd>{job.status}</dd></div></dl>
        </section>
        <section className="details-card">
          <h2>Company and contact</h2>
          {details.length ? <dl>{details.map(([label, value]) => (
            <div key={label}><dt>{label}</dt><dd>{label === 'Company website'
              ? safeWebsiteHref(value)
                ? <a href={safeWebsiteHref(value) ?? undefined} target="_blank" rel="noreferrer">{value}</a>
                : value
              : label === 'Contact email'
                ? <a href={`mailto:${value}`}>{value}</a>
                : value}</dd></div>
          ))}</dl> : <p className="detail-empty">No company or contact details added.</p>}
        </section>
        <section className="details-card details-card-wide">
          <h2>Duties and notes</h2><p>{job.duties || 'No duties or notes added.'}</p>
        </section>
        <section className="details-card details-card-wide">
          <h2>Requirements</h2><p>{job.requirements || 'No requirements added.'}</p>
        </section>
        <section className="details-card details-card-wide">
          <h2>Interview preparation and notes</h2><p>{job.interviewNotes || 'No interview notes added.'}</p>
        </section>
      </div>
    </article>
  )
}

function AppRoutes() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="/app" element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="applications" element={<ApplicationsPage />} />
            <Route path="jobs/new" element={<JobFormPage />} />
            <Route path="jobs/:jobId" element={<JobDetailsPage />} />
            <Route path="jobs/:jobId/edit" element={<JobFormPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  )
}

export default AppRoutes
