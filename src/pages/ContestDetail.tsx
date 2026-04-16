import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { PlatformShell } from '../components/PlatformShell'

export const ContestDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [contest, setContest] = useState<any>(null)
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('problems')

  useEffect(() => {
    const fetchContest = async () => {
      try {
        setLoading(true)
        setContest({
          id,
          title: 'Weekly Contest 1',
          description: 'Solve 4 problems in 2 hours',
          startTime: new Date(),
          endTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
          problems: [
            { id: 'p1', title: 'Two Sum', difficulty: 'Easy' },
            { id: 'p2', title: 'Median of Two Sorted Arrays', difficulty: 'Hard' },
            { id: 'p3', title: 'Longest Substring Without Repeating Characters', difficulty: 'Medium' },
            { id: 'p4', title: 'Reverse Integer', difficulty: 'Easy' },
          ],
        })

        setLeaderboard([
          { rank: 1, uid: 'user1', name: 'Alice', score: 400, penalty: 1200, solvedAt: '00:45:30' },
          { rank: 2, uid: 'user2', name: 'Bob', score: 300, penalty: 1800, solvedAt: '01:30:00' },
          { rank: 3, uid: 'user3', name: 'Charlie', score: 200, penalty: 2100, solvedAt: '02:00:00' },
        ])
      } catch (err) {
        console.error('Failed to load contest:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchContest()
    const unsubscribe = () => {}
    return unsubscribe
  }, [id])

  const getDifficultyStyle = (difficulty: string): React.CSSProperties => {
    if (difficulty === 'Easy') return { background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }
    if (difficulty === 'Medium') return { background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' }
    if (difficulty === 'Hard') return { background: '#fef2f2', color: '#991b1b', border: '1px solid #fecdd3' }
    return { background: '#f3f3f3', color: '#6b6b6b', border: '1px solid #e8e8e8' }
  }

  const tabStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '0.55rem 0.1rem',
    fontWeight: 500,
    fontSize: '0.84rem',
    textTransform: 'capitalize',
    border: 'none',
    background: 'transparent',
    borderBottom: isActive ? '2px solid #1a1a1a' : '2px solid transparent',
    color: isActive ? '#1a1a1a' : '#999999',
    cursor: 'pointer',
  })

  if (loading) {
    return (
      <PlatformShell>
        <div style={{ display: 'flex', minHeight: '60vh', alignItems: 'center', justifyContent: 'center', color: '#999999' }}>Loading contest...</div>
      </PlatformShell>
    )
  }

  if (!contest) {
    return (
      <PlatformShell>
        <div style={{ display: 'flex', minHeight: '60vh', alignItems: 'center', justifyContent: 'center', color: '#999999' }}>Contest not found</div>
      </PlatformShell>
    )
  }

  return (
    <PlatformShell>
      {/* Header */}
      <div style={{ borderBottom: '1px solid #e8e8e8', padding: '0 0.25rem 1rem' }}>
        <button onClick={() => navigate('/contests')} style={{ color: '#999999', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem', fontWeight: 500 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#1a1a1a')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#999999')}
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1a1a1a', marginBottom: '0.25rem', letterSpacing: '-0.02em' }}>{contest.title}</h1>
        <p style={{ color: '#6b6b6b', fontSize: '0.88rem' }}>{contest.description}</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #e8e8e8', margin: '1rem 0 1.25rem' }}>
        {['problems', 'leaderboard'].map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={tabStyle(activeTab === tab)}>
            {tab}
          </button>
        ))}
      </div>

      {/* Problems */}
      {activeTab === 'problems' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {contest.problems?.map((problem: any, idx: number) => (
            <div
              key={problem.id}
              onClick={() => navigate(`/problems/${problem.id}`)}
              style={{ background: '#ffffff', border: '1px solid #e8e8e8', borderRadius: '10px', padding: '0.7rem 1rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'border-color 0.15s ease' }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#d0d0d0')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e8e8e8')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ color: '#999999', fontWeight: 500, fontSize: '0.82rem' }}>{idx + 1}</span>
                <span style={{ color: '#1a1a1a', fontWeight: 500, fontSize: '0.88rem' }}>{problem.title}</span>
              </div>
              <span style={{ fontSize: '0.68rem', fontWeight: 500, padding: '0.15rem 0.4rem', borderRadius: '999px', ...getDifficultyStyle(problem.difficulty) }}>
                {problem.difficulty}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Leaderboard */}
      {activeTab === 'leaderboard' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: '0.82rem', color: '#1a1a1a', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e8e8e8', color: '#999999', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                <th style={{ padding: '0.6rem 0.7rem', textAlign: 'left', fontWeight: 500 }}>Rank</th>
                <th style={{ padding: '0.6rem 0.7rem', textAlign: 'left', fontWeight: 500 }}>Name</th>
                <th style={{ padding: '0.6rem 0.7rem', textAlign: 'center', fontWeight: 500 }}>Score</th>
                <th style={{ padding: '0.6rem 0.7rem', textAlign: 'center', fontWeight: 500 }}>Penalty</th>
                <th style={{ padding: '0.6rem 0.7rem', textAlign: 'center', fontWeight: 500 }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry) => (
                <tr key={entry.uid} style={{ borderBottom: '1px solid #e8e8e8' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#fafafa')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '0.55rem 0.7rem', fontWeight: 600, color: '#1a1a1a' }}>#{entry.rank}</td>
                  <td style={{ padding: '0.55rem 0.7rem' }}>{entry.name}</td>
                  <td style={{ padding: '0.55rem 0.7rem', textAlign: 'center', fontWeight: 600 }}>{entry.score}</td>
                  <td style={{ padding: '0.55rem 0.7rem', textAlign: 'center', color: '#999999' }}>{entry.penalty}</td>
                  <td style={{ padding: '0.55rem 0.7rem', textAlign: 'center', color: '#999999' }}>{entry.solvedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PlatformShell>
  )
}
