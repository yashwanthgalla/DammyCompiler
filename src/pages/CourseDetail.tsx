import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronDown } from 'lucide-react'
import { useCourseDetail } from '../hooks/useCourses'
import { useProgress } from '../hooks/useProgress'
import { ProgressBar } from '../components/ProgressBar'
import { PlatformShell } from '../components/PlatformShell'

interface Module {
  id: string
  title: string
  problems?: string[]
}

interface Course {
  id: string
  title: string
  difficulty: string
  modules: Module[]
}

export const CourseDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { course, loading } = useCourseDetail(id) as { course: Course | null; loading: boolean }
  const { progress } = useProgress('uid')
  const [expandedModule, setExpandedModule] = useState(0)

  const getDifficultyStyle = (difficulty: string): React.CSSProperties => {
    if (difficulty === 'Easy') return { background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }
    if (difficulty === 'Medium') return { background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' }
    if (difficulty === 'Hard') return { background: '#fef2f2', color: '#991b1b', border: '1px solid #fecdd3' }
    return { background: '#f3f3f3', color: '#6b6b6b', border: '1px solid #e8e8e8' }
  }

  if (loading) {
    return (
      <PlatformShell>
        <div style={{ display: 'flex', minHeight: '60vh', alignItems: 'center', justifyContent: 'center', color: '#999999' }}>Loading course...</div>
      </PlatformShell>
    )
  }

  if (!course) {
    return (
      <PlatformShell>
        <div style={{ display: 'flex', minHeight: '60vh', alignItems: 'center', justifyContent: 'center', color: '#999999' }}>Course not found</div>
      </PlatformShell>
    )
  }

  const getStatusIcon = (problemId: string) => {
    const p = progress[problemId]
    if (!p) return '○'
    if (p.status === 'solved') return '✓'
    if (p.status === 'attempted') return '◐'
    return '○'
  }

  const modules = course.modules || []
  const totalProblems = modules.reduce((sum, m) => sum + (m.problems?.length || 0), 0)
  const solvedCount = Object.values(progress).filter((p) => p.status === 'solved').length

  return (
    <PlatformShell>
      {/* Header */}
      <div style={{ borderBottom: '1px solid #e8e8e8', padding: '0 0.25rem 1rem' }}>
        <button onClick={() => navigate('/courses')} style={{ color: '#999999', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem', fontWeight: 500 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#1a1a1a')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#999999')}
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1a1a1a', marginBottom: '0.35rem', letterSpacing: '-0.02em' }}>{course.title}</h1>
        <span style={{ fontSize: '0.68rem', fontWeight: 500, padding: '0.15rem 0.4rem', borderRadius: '999px', display: 'inline-block', ...getDifficultyStyle(course.difficulty) }}>
          {course.difficulty}
        </span>
      </div>

      {/* Progress */}
      <div style={{ border: '1px solid #e8e8e8', borderRadius: '10px', padding: '1rem', marginTop: '1rem', marginBottom: '1rem', background: '#fafafa' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
          <div>
            <h2 style={{ fontSize: '0.92rem', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>Your Progress</h2>
            <p style={{ fontSize: '0.78rem', color: '#999999', margin: '0.15rem 0 0' }}>
              {solvedCount} of {totalProblems} problems solved
            </p>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1a1a1a' }}>
            {totalProblems > 0 ? Math.round((solvedCount / totalProblems) * 100) : 0}%
          </div>
        </div>
        <ProgressBar solved={solvedCount} total={totalProblems} />
      </div>

      {/* Modules */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {modules.map((module, idx) => (
          <div key={module.id} style={{ border: '1px solid #e8e8e8', borderRadius: '10px', overflow: 'hidden', background: '#ffffff' }}>
            <button
              onClick={() => setExpandedModule(expandedModule === idx ? -1 : idx)}
              style={{ width: '100%', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'background 0.15s ease' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#fafafa')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ textAlign: 'left' }}>
                <h3 style={{ fontWeight: 500, color: '#1a1a1a', margin: 0, fontSize: '0.88rem' }}>{module.title}</h3>
                <p style={{ fontSize: '0.72rem', color: '#999999', margin: '0.15rem 0 0' }}>{module.problems?.length || 0} problems</p>
              </div>
              <ChevronDown
                size={16}
                style={{ color: '#999999', transition: 'transform 0.2s ease', transform: expandedModule === idx ? 'rotate(180deg)' : 'rotate(0)' }}
              />
            </button>

            {expandedModule === idx && (
              <div style={{ borderTop: '1px solid #e8e8e8', padding: '0.5rem 0.75rem', background: '#fafafa' }}>
                {module.problems?.map((problemId) => (
                  <div
                    key={problemId}
                    onClick={() => navigate(`/problems/${problemId}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.45rem 0.5rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.82rem', transition: 'background 0.15s ease' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#ffffff')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ color: '#1a1a1a', fontWeight: 500, minWidth: '16px' }}>{getStatusIcon(problemId)}</span>
                    <span style={{ color: '#6b6b6b' }}>{problemId}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </PlatformShell>
  )
}
