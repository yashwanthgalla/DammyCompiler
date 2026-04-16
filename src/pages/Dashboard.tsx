import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Code2,
  Terminal,
  Building2,
  BookOpen,
  Trophy,
  ChevronRight,
  User,
  Flame,
  Target,
  CheckCircle2,
  Clock,
  Upload,
  Shield,
  Zap,
} from 'lucide-react'
import { auth } from '../firebase'
import { useProblems } from '../hooks/useProblems'
import { useUserStats } from '../hooks/useUserStats'
import { useProgress } from '../hooks/useProgress'
import { getUser } from '../firebase/firestoreHelpers'
import { GoogleAd } from '../components/GoogleAd'
import './Dashboard.css'

// ─── Helpers ───
const getGreeting = () => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const getDisplayName = () => {
  const user = auth.currentUser
  if (!user) return ''
  const name = user.displayName || user.email?.split('@')[0] || ''
  return name.split(' ')[0]
}

// Build last 16 weeks of streak data (for the heatmap)
const buildStreakGrid = (loginDays: string[]) => {
  const loginSet = new Set(loginDays)
  const today = new Date()
  const weeks: { date: string; active: boolean; day: number }[][] = []

  // Go back 16 weeks (112 days)
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - 111)
  // Align to start of week (Sunday)
  startDate.setDate(startDate.getDate() - startDate.getDay())

  let currentDate = new Date(startDate)
  let currentWeek: { date: string; active: boolean; day: number }[] = []

  while (currentDate <= today) {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`
    currentWeek.push({
      date: dateStr,
      active: loginSet.has(dateStr),
      day: currentDate.getDay(),
    })

    if (currentDate.getDay() === 6) {
      weeks.push(currentWeek)
      currentWeek = []
    }

    currentDate = new Date(currentDate)
    currentDate.setDate(currentDate.getDate() + 1)
  }

  if (currentWeek.length > 0) {
    weeks.push(currentWeek)
  }

  return weeks
}

interface DashboardProps {
  isAdmin?: boolean
}

export const Dashboard = ({ isAdmin = false }: DashboardProps) => {
  const navigate = useNavigate()
  const currentUser = auth.currentUser
  const { problems } = useProblems()
  const { stats: userStats, loginDays, loading: statsLoading } = useUserStats(currentUser?.uid || null)
  const { progress } = useProgress(currentUser?.uid || null)
  
  // Load premium status
  const [isPremium, setIsPremium] = useState(false)
  useEffect(() => {
    const loadPremiumStatus = async () => {
      if (currentUser?.uid) {
        const user = await getUser(currentUser.uid)
        setIsPremium(user?.isPremium ?? false)
      }
    }
    loadPremiumStatus()
  }, [currentUser?.uid])

  const stats = useMemo(() => {
    // Compute solved count from progress data for accuracy
    const solvedFromProgress = Object.values(progress).filter(
      (p: any) => p.status === 'solved'
    ).length
    const solved = solvedFromProgress || userStats.solved || 0
    const total = problems.length
    const percentage = total > 0 ? Math.round((solved / total) * 100) : 0
    const streak = userStats.streak || 0

    // Count attempted (submitted but not solved)
    const attemptedCount = Object.values(progress).filter(
      (p: any) => p.status === 'attempted'
    ).length

    return { solved, total, percentage, streak, attempted: attemptedCount }
  }, [problems, userStats, progress])

  const streakGrid = useMemo(() => buildStreakGrid(loginDays), [loginDays])

  // Count logins in the last 30 days
  const last30DaysActive = useMemo(() => {
    const now = new Date()
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const cutoff = `${thirtyDaysAgo.getFullYear()}-${String(thirtyDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(thirtyDaysAgo.getDate()).padStart(2, '0')}`
    return loginDays.filter(d => d >= cutoff).length
  }, [loginDays])

  const navItems = [
    { label: 'Workspace', description: 'Code editor', icon: Terminal, path: '/editor' },
    { label: 'Problems', description: `${stats.total} available`, icon: Code2, path: '/problems' },
    { label: 'Courses', description: 'Learning paths', icon: BookOpen, path: '/courses' },
    { label: 'Contests', description: 'Compete', icon: Trophy, path: '/contests' },
    { label: 'Companies', description: 'Interview prep', icon: Building2, path: '/company-prep' },
    { label: 'Profile', description: 'Your account', icon: User, path: '/profile' },
  ]

  const adminItems = isAdmin
    ? [
        { label: 'Problem Upload', description: 'Add problems', icon: Upload, path: '/problems/upload' },
        { label: 'Admin Panel', description: 'Manage platform', icon: Shield, path: '/admin' },
      ]
    : []

  return (
    <div className="dashboard-page">
      <div className="dashboard-wrapper">
        {/* Left Ad Space */}
        <aside className="dashboard-ad-space dashboard-ad-left">
          <GoogleAd adSlot="9063831403" adFormat="auto" fullWidth={true} />
        </aside>

        <div className="dashboard-layout">

        {/* Header */}
        <header className="dash-hero">
          <div className="dash-hero-text">
            <h1 className="dash-greeting">
              {getGreeting()}, {getDisplayName()}
            </h1>
            <p className="dash-subtext">
              Track your progress and continue learning
            </p>
          </div>
        </header>

        {/* Stats cards */}
        <section className="dash-stat-cards">
          <div className="dash-stat-card">
            <div className="dash-stat-icon dash-stat-icon--solved">
              <CheckCircle2 size={20} />
            </div>
            <div className="dash-stat-info">
              <span className="dash-stat-value">
                {statsLoading ? '—' : stats.solved}
              </span>
              <span className="dash-stat-label">Solved</span>
            </div>
          </div>

          <div className="dash-stat-card">
            <div className="dash-stat-icon dash-stat-icon--attempted">
              <Clock size={20} />
            </div>
            <div className="dash-stat-info">
              <span className="dash-stat-value">
                {statsLoading ? '—' : stats.attempted}
              </span>
              <span className="dash-stat-label">Attempted</span>
            </div>
          </div>

          <div className="dash-stat-card">
            <div className="dash-stat-icon dash-stat-icon--streak">
              <Flame size={20} />
            </div>
            <div className="dash-stat-info">
              <span className="dash-stat-value">
                {statsLoading ? '—' : stats.streak}
              </span>
              <span className="dash-stat-label">Day streak</span>
            </div>
          </div>

          <div className="dash-stat-card">
            <div className="dash-stat-icon dash-stat-icon--total">
              <Target size={20} />
            </div>
            <div className="dash-stat-info">
              <span className="dash-stat-value">{stats.total}</span>
              <span className="dash-stat-label">Total problems</span>
            </div>
          </div>
        </section>

        {/* Progress bar */}
        <section className="dash-progress-section">
          <div className="dash-progress-header">
            <span className="dash-progress-label">Overall progress</span>
            <span className="dash-progress-value">
              {statsLoading ? '—' : `${stats.solved} / ${stats.total}`}
            </span>
          </div>
          <div className="dash-progress-track">
            <div
              className="dash-progress-fill"
              style={{ width: `${stats.percentage}%` }}
            />
          </div>
          <span className="dash-progress-pct">
            {stats.percentage}% complete
          </span>
        </section>

        {/* Premium upgrade section - only show if not premium */}
        {!isPremium && (
          <section className="dash-premium-section">
            <div className="dash-premium-card">
              <div className="dash-premium-icon">
                <Zap size={24} />
              </div>
              <div className="dash-premium-content">
                <h3 className="dash-premium-title">Unlock Premium Features</h3>
                <p className="dash-premium-desc">Get AI-powered code analysis, unlimited AI feedback, and more.</p>
                <ul className="dash-premium-features">
                  <li>✓ AI-powered error analysis</li>
                  <li>✓ Direct code examples in suggestions</li>
                  <li>✓ Advanced debugging assistance</li>
                </ul>
              </div>
              <button
                className="dash-premium-btn"
                onClick={() => navigate('/profile')}
              >
                Upgrade Now
                <ChevronRight size={16} />
              </button>
            </div>
          </section>
        )}

        {/* Streak heatmap */}
        <section className="dash-streak-section">
          <div className="dash-section-header">
            <h2 className="dash-section-title">
              <Flame size={16} />
              Activity
            </h2>
            <span className="dash-section-meta">
              {last30DaysActive} active days in last 30 days
            </span>
          </div>
          <div className="dash-heatmap">
            {streakGrid.map((week, wi) => (
              <div key={wi} className="dash-heatmap-col">
                {week.map((cell) => (
                  <div
                    key={cell.date}
                    className={`dash-heatmap-cell ${cell.active ? 'dash-heatmap-cell--active' : ''}`}
                    title={`${cell.date}${cell.active ? ' — Active' : ''}`}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="dash-heatmap-legend">
            <span>Less</span>
            <div className="dash-heatmap-cell" />
            <div className="dash-heatmap-cell dash-heatmap-cell--active" />
            <span>More</span>
          </div>
        </section>

        {/* Navigation - all page links from header */}
        <section className="dash-nav-section">
          <h2 className="dash-section-title">Navigate</h2>
          <div className="dash-nav-grid">
            {navItems.map((item) => (
              <div
                key={item.path}
                className="dash-nav-card"
                onClick={() => navigate(item.path)}
              >
                <item.icon className="dash-nav-icon" size={22} />
                <span className="dash-nav-label">{item.label}</span>
                <span className="dash-nav-desc">{item.description}</span>
                <ChevronRight className="dash-nav-arrow" size={16} />
              </div>
            ))}
          </div>
        </section>

        {/* Admin section */}
        {adminItems.length > 0 && (
          <section className="dash-nav-section">
            <h2 className="dash-section-title">Admin</h2>
            <div className="dash-nav-grid dash-nav-grid--admin">
              {adminItems.map((item) => (
                <div
                  key={item.path}
                  className="dash-nav-card dash-nav-card--admin"
                  onClick={() => navigate(item.path)}
                >
                  <item.icon className="dash-nav-icon" size={22} />
                  <span className="dash-nav-label">{item.label}</span>
                  <span className="dash-nav-desc">{item.description}</span>
                  <ChevronRight className="dash-nav-arrow" size={16} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Quick actions */}
        <section className="dash-actions">
          <button
            className="dash-action-btn dash-action-btn--primary"
            onClick={() => navigate('/problems')}
          >
            <Code2 size={16} />
            Start solving
          </button>
          <button
            className="dash-action-btn dash-action-btn--secondary"
            onClick={() => navigate('/editor')}
          >
            <Terminal size={16} />
            Open editor
          </button>
        </section>

        {/* Footer */}
        <footer className="dashboard-footer">
          <span>© 2026 DammyCompiler. v0.12.1</span>
        </footer>

      </div>

      {/* Right Ad Space */}
      <aside className="dashboard-ad-space dashboard-ad-right">
        <GoogleAd adSlot="1105450333" adFormat="auto" fullWidth={true} />
      </aside>
    </div>
    </div>
  )
}
