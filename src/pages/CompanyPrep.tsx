import { useNavigate } from 'react-router-dom'
import { useState, useMemo } from 'react'
import { ArrowUpRight, BadgeCheck, CalendarClock, Layers, Sparkles, Target } from 'lucide-react'
import { PlatformShell } from '../components/PlatformShell'
import { getCompanyLogo } from '../data/companyLogos'
import { useProblems } from '../hooks/useProblems'
import './CompanyPrep.css'

interface Company {
  name: string
  topics: string[]
  roadmap: Array<{ week: number; topics: string[] }>
}

const COMPANIES: Company[] = [
  {
    name: 'Google',
    topics: ['Arrays', 'Trees', 'Graphs', 'DP'],
    roadmap: [
      { week: 1, topics: ['Arrays', 'Strings'] },
      { week: 2, topics: ['Trees', 'Graphs'] },
      { week: 3, topics: ['Dynamic Programming'] },
      { week: 4, topics: ['System Design Basics'] },
    ],
  },
  {
    name: 'Amazon',
    topics: ['Arrays', 'LinkedLists', 'Trees', 'Graphs'],
    roadmap: [
      { week: 1, topics: ['Arrays', 'LinkedLists'] },
      { week: 2, topics: ['Stacks', 'Queues'] },
      { week: 3, topics: ['Trees', 'Graphs'] },
      { week: 4, topics: ['DP', 'Backtracking'] },
    ],
  },
  {
    name: 'Microsoft',
    topics: ['Arrays', 'Strings', 'Trees', 'Graphs'],
    roadmap: [
      { week: 1, topics: ['Strings', 'HashMaps'] },
      { week: 2, topics: ['LinkedLists', 'Stacks'] },
      { week: 3, topics: ['Trees', 'BST'] },
      { week: 4, topics: ['Graphs', 'BFS/DFS'] },
    ],
  },
  {
    name: 'Meta',
    topics: ['Arrays', 'Graphs', 'Trees', 'DP'],
    roadmap: [
      { week: 1, topics: ['Arrays', 'Bit Manipulation'] },
      { week: 2, topics: ['Trees', 'Graphs'] },
      { week: 3, topics: ['DP', 'Greedy'] },
      { week: 4, topics: ['Sliding Window', 'Two Pointers'] },
    ],
  },
  {
    name: 'Apple',
    topics: ['Arrays', 'Trees', 'LinkedLists', 'Strings'],
    roadmap: [
      { week: 1, topics: ['Sorting', 'Binary Search'] },
      { week: 2, topics: ['LinkedLists', 'Trees'] },
      { week: 3, topics: ['Recursion', 'Backtracking'] },
      { week: 4, topics: ['System Design'] },
    ],
  },
  {
    name: 'Netflix',
    topics: ['Streaming', 'Caching', 'Graphs', 'DP'],
    roadmap: [
      { week: 1, topics: ['Caching', 'LRU'] },
      { week: 2, topics: ['Graphs', 'Algorithms'] },
      { week: 3, topics: ['DP', 'Optimization'] },
      { week: 4, topics: ['Distributed Systems'] },
    ],
  },
]

export const CompanyPrep = () => {
  const navigate = useNavigate()
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null)
  const selectedCompanyData = COMPANIES.find((company) => company.name === selectedCompany)
  const { problems } = useProblems()

  // Count problems per company from actual JSON data
  const companyCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    problems.forEach(p => {
      p.companyTags?.forEach(c => {
        counts[c] = (counts[c] || 0) + 1
      })
    })
    return counts
  }, [problems])

  const totalProblems = useMemo(() => {
    const uniqueIds = new Set<string>()
    COMPANIES.forEach(c => {
      problems.forEach(p => {
        if (p.companyTags?.includes(c.name)) uniqueIds.add(p.id)
      })
    })
    return uniqueIds.size
  }, [problems])

  return (
    <PlatformShell>
      <div className="company-prep-page">
        <section className="company-prep-hero">
          <div className="company-prep-hero__badge">
            <Sparkles size={14} />
            Interview Ready Tracks
          </div>
          <h1>Company Prep</h1>
          <p>Prepare for your dream company with focused DSA plans, high-signal topics, and weekly roadmaps.</p>

          <div className="company-prep-hero__stats">
            <article>
              <Layers size={16} />
              <div>
                <strong>{COMPANIES.length}</strong>
                <span>Companies</span>
              </div>
            </article>
            <article>
              <Target size={16} />
              <div>
                <strong>{totalProblems}</strong>
                <span>Total Problems</span>
              </div>
            </article>
            <article>
              <CalendarClock size={16} />
              <div>
                <strong>4 Weeks</strong>
                <span>Per Roadmap</span>
              </div>
            </article>
          </div>
        </section>

        <section className="company-grid">
          {COMPANIES.map((company) => {
            const isSelected = selectedCompany === company.name
            const count = companyCounts[company.name] || 0

            return (
              <article
                key={company.name}
                onClick={() => setSelectedCompany(isSelected ? null : company.name)}
                className={`company-card ${isSelected ? 'company-card--selected' : ''}`}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setSelectedCompany(isSelected ? null : company.name)
                  }
                }}
              >
                <header className="company-card__header">
                  <div className="company-card__logo-wrap">
                    <span
                      className="company-card__logo-svg"
                      dangerouslySetInnerHTML={{ __html: getCompanyLogo(company.name) }}
                    />
                  </div>
                  <BadgeCheck size={18} className="company-card__verified" />
                </header>

                <h3>{company.name}</h3>

                <div className="company-card__meta">
                  <span>{count} problems</span>
                  <span className="company-card__live">
                    Live set
                    <ArrowUpRight size={14} />
                  </span>
                </div>

                <div className="company-card__topics">
                  {company.topics.map((topic) => (
                    <span key={topic}>{topic}</span>
                  ))}
                </div>

                <button
                  onClick={(event) => {
                    event.stopPropagation()
                    navigate(`/problems?company=${company.name}`)
                  }}
                  className="company-card__cta"
                >
                  View Problems
                </button>
              </article>
            )
          })}
        </section>

        {selectedCompanyData && (
          <section className="roadmap-panel">
            <header className="roadmap-panel__header">
              <p>Preparation Path</p>
              <h2>{selectedCompanyData.name} 4-Week Roadmap</h2>
              <span>Tap a week to align your study goals and practice blocks.</span>
            </header>

            <div className="roadmap-grid">
              {selectedCompanyData.roadmap.map((week) => (
                <article key={week.week} className="roadmap-week">
                  <h3>Week {week.week}</h3>
                  <ul>
                    {week.topics.map((topic) => (
                      <li key={topic}>{topic}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        )}

        <div className="company-prep-footer-note">
          Need deeper tracking? Open a company set to start solving and monitor progress in real time.
        </div>
      </div>
    </PlatformShell>
  )
}
