import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import JobCard from './components/JobCard'
import JobForm, { type JobDraft } from './components/JobForm'
import { createJob, deleteJob, getJobs, updateJob } from './services/jobs'
import type { Job, JobStatus } from './types/Job'

type ApplicationFilter = JobStatus | 'In Progress' | 'All'
type SortOrder = 'newest' | 'oldest' | 'company'

const filters: ApplicationFilter[] = ['All', 'In Progress', 'Offer', 'Rejected', 'Withdrawn']
const inProgressStatuses: JobStatus[] = ['Saved', 'Applied', 'Interview', 'Interviewed']

function App() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState(() => new URLSearchParams(window.location.search).get('q') ?? '')
  const [statusFilter, setStatusFilter] = useState<ApplicationFilter>(() => {
    const value = new URLSearchParams(window.location.search).get('status')
    return filters.find((filter) => filter === value) ?? 'All'
  })
  const [sortOrder, setSortOrder] = useState<SortOrder>(() => {
    const value = new URLSearchParams(window.location.search).get('sort')
    return value === 'oldest' || value === 'company' ? value : 'newest'
  })
  const [activeSection, setActiveSection] = useState<'dashboard' | 'applications'>(() =>
    window.location.hash === '#applications' ? 'applications' : 'dashboard',
  )
  const [formOpen, setFormOpen] = useState(false)
  const [editingJob, setEditingJob] = useState<Job | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadJobs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setJobs(await getJobs())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load applications.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    getJobs()
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
  }, [])

  useEffect(() => {
    function syncActiveSection() {
      setActiveSection(window.location.hash === '#applications' ? 'applications' : 'dashboard')
      const params = new URLSearchParams(window.location.search)
      setSearch(params.get('q') ?? '')
      setStatusFilter(filters.find((filter) => filter === params.get('status')) ?? 'All')
      const sort = params.get('sort')
      setSortOrder(sort === 'oldest' || sort === 'company' ? sort : 'newest')
    }

    window.addEventListener('hashchange', syncActiveSection)
    window.addEventListener('popstate', syncActiveSection)
    return () => {
      window.removeEventListener('hashchange', syncActiveSection)
      window.removeEventListener('popstate', syncActiveSection)
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (search) params.set('q', search)
    else params.delete('q')
    if (statusFilter !== 'All') params.set('status', statusFilter)
    else params.delete('status')
    if (sortOrder !== 'newest') params.set('sort', sortOrder)
    else params.delete('sort')
    const query = params.toString()
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`,
    )
  }, [search, statusFilter, sortOrder])

  const visibleJobs = useMemo(() => {
    const query = search.trim().toLowerCase()
    const filteredJobs = jobs
      .filter((job) =>
        statusFilter === 'All'
        || (statusFilter === 'In Progress' && inProgressStatuses.includes(job.status))
        || job.status === statusFilter,
      )
      .filter((job) =>
        !query || [job.companyName, job.role, job.duties].some((value) =>
          value.toLowerCase().includes(query),
        ),
      )
    return filteredJobs.sort((left, right) => {
      if (sortOrder === 'company') return left.companyName.localeCompare(right.companyName)
      const direction = sortOrder === 'newest' ? -1 : 1
      return direction * left.dateApplied.localeCompare(right.dateApplied)
    })
  }, [jobs, search, statusFilter, sortOrder])

  const offerCount = jobs.filter((job) => job.status === 'Offer').length
  const progressCount = jobs.filter((job) =>
    ['Saved', 'Applied', 'Interview', 'Interviewed'].includes(job.status),
  ).length
  const rejectedCount = jobs.filter((job) => job.status === 'Rejected').length
  const activeJobCount = offerCount + progressCount + rejectedCount
  const percentage = (value: number) => activeJobCount ? Math.round((value / activeJobCount) * 100) : 0
  const recentJobs = [...jobs]
    .sort((left, right) => right.dateApplied.localeCompare(left.dateApplied))
    .slice(0, 3)
  const statistics = [
    { label: 'Total Applications', value: jobs.length, icon: '▰', tone: 'purple', note: 'Tracked so far' },
    { label: 'Offer', value: offerCount, icon: '✓', tone: 'green', note: 'Offers received' },
    { label: 'In Progress', value: progressCount, icon: '◷', tone: 'orange', note: 'Awaiting an outcome' },
    { label: 'Rejected', value: rejectedCount, icon: '×', tone: 'red', note: 'Closed applications' },
  ]

  function openAddForm() {
    setEditingJob(null)
    setFormOpen(true)
  }

  function openEditForm(job: Job) {
    setEditingJob(job)
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditingJob(null)
  }

  function navigateTo(section: 'dashboard' | 'applications') {
    setActiveSection(section)
    window.history.pushState(null, '', `${window.location.pathname}${window.location.search}#${section}`)
    window.scrollTo({ top: 0 })
  }

  async function saveApplication(draft: JobDraft) {
    setError(null)
    if (editingJob) {
      const savedJob = await updateJob({ ...editingJob, ...draft })
      setJobs((currentJobs) =>
        currentJobs.map((job) => job.id === savedJob.id ? savedJob : job),
      )
    } else {
      const savedJob = await createJob({ ...draft, userId: 'user-1' })
      setJobs((currentJobs) => [savedJob, ...currentJobs])
    }
    closeForm()
  }

  async function removeApplication(job: Job) {
    if (!window.confirm(`Delete the application for ${job.role} at ${job.companyName}?`)) {
      return
    }
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
    <div className="app-container">
      <aside className="sidebar">
        <a
          className="brand"
          href="#dashboard"
          aria-label="JobTrack dashboard"
          onClick={(event) => {
            event.preventDefault()
            navigateTo('dashboard')
          }}
        >
          <span className="brand-mark" aria-hidden="true">▣</span>
          <span>JobTrack</span>
        </a>

        <nav className="sidebar-nav" aria-label="Main navigation">
          <a
            className={`nav-link${activeSection === 'dashboard' ? ' nav-link-active' : ''}`}
            href="#dashboard"
            aria-current={activeSection === 'dashboard' ? 'page' : undefined}
            onClick={(event) => {
              event.preventDefault()
              navigateTo('dashboard')
            }}
          >
            <span className="nav-icon" aria-hidden="true">⌂</span>
            Dashboard
          </a>
          <a
            className={`nav-link${activeSection === 'applications' ? ' nav-link-active' : ''}`}
            href="#applications"
            aria-current={activeSection === 'applications' ? 'page' : undefined}
            onClick={(event) => {
              event.preventDefault()
              navigateTo('applications')
            }}
          >
            <span className="nav-icon" aria-hidden="true">▤</span>
            My Applications
          </a>
          <button
            className={`nav-link nav-button${formOpen && !editingJob ? ' nav-link-active' : ''}`}
            type="button"
            onClick={openAddForm}
          >
            <span className="nav-icon" aria-hidden="true">＋</span>
            Add Application
          </button>
        </nav>

        <div className="sidebar-footer">
          <span className="avatar" aria-hidden="true">JS</span>
          <span className="profile-copy">
            <strong>Job Seeker</strong>
            <span>Personal tracker</span>
          </span>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <label className="top-search">
            <span aria-hidden="true">⌕</span>
            <span className="sr-only">Search jobs</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={activeSection === 'applications' ? 'Search applications...' : 'Search jobs...'}
            />
          </label>
          <div className="topbar-actions">
            <svg className="notification-icon" aria-hidden="true" viewBox="0 0 24 24">
              <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
              <path d="M10 21h4" />
            </svg>
            <span className="topbar-avatar" aria-label="Job Seeker profile">JS</span>
          </div>
        </header>

        {formOpen ? (
          <JobForm
            job={editingJob}
            backLabel={activeSection === 'applications' ? 'My Applications' : 'Dashboard'}
            onSave={saveApplication}
            onClose={closeForm}
          />
        ) : activeSection === 'dashboard' ? (
          <div className="dashboard-page">
            <header className="dashboard-heading">
              <div>
                <h1>Welcome back!</h1>
                <p>Track your job applications and stay on top of your career goals.</p>
              </div>
              <button className="add-button" type="button" onClick={openAddForm}>
                <span aria-hidden="true">＋</span>
                Add Application
              </button>
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
                <div className="panel-heading">
                  <h2 id="status-heading">Application Status</h2>
                  <span className="panel-menu" aria-hidden="true">•••</span>
                </div>
                <div className="status-overview">
                  <div
                    className="status-chart"
                    role="img"
                    aria-label={`${activeJobCount} applications: ${progressCount} in progress, ${offerCount} offers, ${rejectedCount} rejected`}
                    style={{
                      background: activeJobCount
                        ? `conic-gradient(#6d45dc 0% ${percentage(progressCount)}%, #35b86b ${percentage(progressCount)}% ${percentage(progressCount) + percentage(offerCount)}%, #ef4444 ${percentage(progressCount) + percentage(offerCount)}% 100%)`
                        : undefined,
                    }}
                  >
                    <span><strong>{activeJobCount}</strong><small>Total</small></span>
                  </div>
                  <div className="status-legend">
                    <div className="legend-row"><i className="legend-purple" /><span>In Progress</span><strong>{percentage(progressCount)}%</strong></div>
                    <div className="legend-row"><i className="legend-green" /><span>Offer</span><strong>{percentage(offerCount)}%</strong></div>
                    <div className="legend-row"><i className="legend-red" /><span>Rejected</span><strong>{percentage(rejectedCount)}%</strong></div>
                  </div>
                </div>
              </section>

              <section className="dashboard-panel activity-panel" aria-labelledby="activity-heading">
                <div className="panel-heading">
                  <h2 id="activity-heading">Recent Activity</h2>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => navigateTo('applications')}
                  >
                    View All →
                  </button>
                </div>
                {recentJobs.length ? (
                  <ul className="activity-list">
                    {recentJobs.map((job) => (
                      <li className="activity-item" key={job.id}>
                        <span className={`activity-icon status-${job.status.toLowerCase()}`} aria-hidden="true">
                          {job.status === 'Offer' ? '✓' : job.status === 'Rejected' ? '×' : '◷'}
                        </span>
                        <span className="activity-copy">
                          <strong>{job.companyName}</strong>
                          <span>{job.status === 'Interviewed' ? 'Interview' : job.status} · {new Date(`${job.dateApplied}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="activity-empty">Your application updates will appear here.</p>
                )}
              </section>
            </div>
          </div>
        ) : (
          <section className="applications-page" aria-labelledby="applications-heading">
            <header className="applications-page-heading">
              <div>
                <h1 id="applications-heading">My Applications</h1>
                <p>View and manage all your job applications.</p>
              </div>
              <button className="add-button" type="button" onClick={openAddForm}>
                <span aria-hidden="true">＋</span>
                Add Application
              </button>
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
                    onClick={() => setStatusFilter(filter)}
                  >
                    {filter}
                  </button>
                ))}
              </div>
              <label className="sort-control">
                <span>Sort by:</span>
                <select
                  value={sortOrder}
                  onChange={(event) => {
                    if (event.target.value === 'newest' || event.target.value === 'oldest' || event.target.value === 'company') {
                      setSortOrder(event.target.value)
                    }
                  }}
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="company">Company A–Z</option>
                </select>
              </label>
            </div>

            {error && (
              <div className="api-error" role="alert">
                <span>{error}</span>
                <button type="button" className="text-button" onClick={() => void loadJobs()}>
                  Retry
                </button>
              </div>
            )}

            <div className="application-list-heading">
              <span>{visibleJobs.length} applications</span>
              <span>Applied</span>
              <span>Status</span>
              <span className="sr-only">Actions</span>
            </div>
            {loading ? (
              <p className="list-message" role="status">Loading applications...</p>
            ) : error && jobs.length === 0 ? null : visibleJobs.length ? (
              <div className="job-list job-list-table">
                {visibleJobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onEdit={openEditForm}
                    onDelete={(selectedJob) => void removeApplication(selectedJob)}
                    deleting={deletingId === job.id}
                  />
                ))}
              </div>
            ) : (
              <div className="list-message empty-state">
                <h2>{jobs.length ? 'No matching applications' : 'No applications yet'}</h2>
                <p>{jobs.length ? 'Try another search or status filter.' : 'Add your first opportunity and keep your job search organized.'}</p>
                {!jobs.length && (
                  <button className="add-button" type="button" onClick={openAddForm}>
                    <span aria-hidden="true">＋</span>
                    Add Application
                  </button>
                )}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  )
}

export default App
