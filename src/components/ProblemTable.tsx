import { useNavigate } from 'react-router-dom'
import { CheckCircle, Circle, Minus } from 'lucide-react'
import { getCompanyLogo } from '../data/companyLogos'

interface Problem {
  id: string
  slug: string
  title: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  source?: string
  tags?: string[]
  companyTags?: string[]
}

interface ProblemTableProps {
  problems: Problem[]
  progress?: Record<string, { status: string }>
}

export const ProblemTable = ({ problems, progress = {} }: ProblemTableProps) => {
  const navigate = useNavigate()

  const getDifficultyStyle = (difficulty: string): React.CSSProperties => {
    if (difficulty === 'Easy') return { background: 'var(--success-soft)', color: 'var(--easy)', border: '1px solid var(--border)' }
    if (difficulty === 'Medium') return { background: 'var(--warning-soft)', color: 'var(--medium)', border: '1px solid var(--border)' }
    if (difficulty === 'Hard') return { background: 'var(--danger-soft)', color: 'var(--hard)', border: '1px solid var(--border)' }
    return { background: 'var(--accent-soft)', color: 'var(--ink-secondary)', border: '1px solid var(--border)' }
  }

  const getSourceStyle = (source?: string): React.CSSProperties => {
    if (source === 'LeetCode') return { background: 'var(--warning-soft)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }
    if (source === 'CodeChef') return { background: 'var(--success-soft)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }
    return { background: 'var(--accent-soft)', color: 'var(--ink-secondary)', border: '1px solid var(--border)' }
  }

  const getStatusIcon = (problemId: string) => {
    const p = progress[problemId]
    if (!p) return <Circle size={15} style={{ color: 'var(--ink-tertiary, #d0d0d0)' }} />
    if (p.status === 'solved') return <CheckCircle size={15} style={{ color: 'var(--easy, #16a34a)' }} />
    if (p.status === 'attempted') return <Minus size={15} style={{ color: 'var(--medium, #ca8a04)' }} />
    return <Circle size={15} style={{ color: 'var(--ink-tertiary, #d0d0d0)' }} />
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', fontSize: '0.82rem', color: 'var(--ink)', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--ink-tertiary)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            <th style={{ padding: '0.65rem 0.75rem', textAlign: 'left', width: '40px', fontWeight: 500 }}>#</th>
            <th style={{ padding: '0.65rem 0.75rem', textAlign: 'left', fontWeight: 500 }}>Title</th>
            <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center', fontWeight: 500 }}>Source</th>
            <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center', fontWeight: 500 }}>Difficulty</th>
            <th style={{ padding: '0.65rem 0.75rem', textAlign: 'left', fontWeight: 500 }}>Companies</th>
            <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center', width: '40px', fontWeight: 500 }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {problems.map((problem: Problem, idx: number) => (
            <tr
              key={problem.id}
              onClick={() => navigate(`/problems/${problem.slug}`)}
              style={{
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent-soft)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <td style={{ padding: '0.6rem 0.75rem', color: 'var(--ink-tertiary)' }}>{idx + 1}</td>
              <td style={{ padding: '0.6rem 0.75rem', color: 'var(--ink)', fontWeight: 500 }}>{problem.title}</td>
              <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 500,
                  padding: '0.12rem 0.4rem',
                  borderRadius: '999px',
                  display: 'inline-block',
                  ...getSourceStyle(problem.source),
                }}>
                  {problem.source || '—'}
                </span>
              </td>
              <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 500,
                  padding: '0.12rem 0.4rem',
                  borderRadius: '999px',
                  display: 'inline-block',
                  ...getDifficultyStyle(problem.difficulty),
                }}>
                  {problem.difficulty}
                </span>
              </td>
              <td style={{ padding: '0.6rem 0.75rem' }}>
                <div style={{ display: 'flex', gap: '0.2rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  {(problem.companyTags || []).slice(0, 3).map((company: string) => (
                    <span
                      key={company}
                      title={company}
                      style={{ width: '18px', height: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      dangerouslySetInnerHTML={{ __html: getCompanyLogo(company) }}
                    />
                  ))}
                  {(problem.companyTags || []).length > 3 && (
                    <span style={{ fontSize: '0.68rem', color: 'var(--ink-tertiary)', fontWeight: 500 }}>
                      +{(problem.companyTags || []).length - 3}
                    </span>
                  )}
                </div>
              </td>
              <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  {getStatusIcon(problem.id)}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
