import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useProblems } from '../hooks/useProblems'
import { useProgress } from '../hooks/useProgress'
import { ProblemTable } from '../components/ProblemTable'
import { PlatformShell } from '../components/PlatformShell'
import { getCompanyLogo, COMPANY_LIST } from '../data/companyLogos'
import { auth } from '../firebase'
import './Problems.css'

export const Problems = () => {
  const currentUser = auth.currentUser
  const [searchParams] = useSearchParams()
  const companyFromUrl = searchParams.get('company') || ''
  const [difficulty, setDifficulty] = useState('All')
  const [status, setStatus] = useState('All')
  const [source, setSource] = useState('All')
  const [company, setCompany] = useState(companyFromUrl || 'All')
  const [searchQuery, setSearchQuery] = useState('')

  const { problems, loading } = useProblems()
  const { progress } = useProgress(currentUser?.uid || null)

  const allCompanies = useMemo(() => {
    const set = new Set<string>()
    problems.forEach(p => p.companyTags?.forEach(c => set.add(c)))
    return Array.from(set).sort()
  }, [problems])

  const allSources = useMemo(() => {
    const set = new Set<string>()
    problems.forEach(p => { if (p.source) set.add(p.source) })
    return Array.from(set).sort()
  }, [problems])

  const filteredProblems = useMemo(() => {
    return problems.filter((p) => {
      if (difficulty !== 'All' && p.difficulty !== difficulty) return false
      if (status === 'Solved' && progress[p.id]?.status !== 'solved') return false
      if (status === 'Unsolved' && progress[p.id]?.status === 'solved') return false
      if (status === 'Attempted' && progress[p.id]?.status !== 'attempted') return false
      if (source !== 'All' && p.source !== source) return false
      if (company !== 'All' && !p.companyTags?.includes(company)) return false
      if (searchQuery && !p.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
      return true
    })
  }, [problems, difficulty, status, source, company, searchQuery, progress])

  return (
    <PlatformShell>
      <div className="problems-page">
        <section className="problems-hero">
          <h1>Problems</h1>
          <p>Curated problems from LeetCode & CodeChef — practice by company, difficulty, or topic.</p>
          <div className="problems-hero__chips">
            <span>{filteredProblems.length} showing</span>
            <span>{problems.length} total</span>
            <span>{Object.values(progress).filter((value) => value?.status === 'solved').length} solved</span>
          </div>
        </section>

        {/* Company quick-filter bar */}
        <section className="problems-companies">
          {COMPANY_LIST.map((c) => (
            <button
              key={c}
              onClick={() => setCompany(company === c ? 'All' : c)}
              className={`problems-company-chip ${company === c ? 'active' : ''}`}
            >
              <span
                className="problems-company-logo"
                dangerouslySetInnerHTML={{ __html: getCompanyLogo(c) }}
              />
              {c}
            </button>
          ))}
        </section>

        <section className="problems-filters">
          <div className="problems-search-wrap">
            <input
              type="text"
              placeholder="Search problems..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="problems-search"
            />
          </div>

          <div className="problems-filter-grid problems-filter-grid--4">
            <label>
              <span>Difficulty</span>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                <option>All</option>
                <option>Easy</option>
                <option>Medium</option>
                <option>Hard</option>
              </select>
            </label>

            <label>
              <span>Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option>All</option>
                <option>Solved</option>
                <option>Attempted</option>
                <option>Unsolved</option>
              </select>
            </label>

            <label>
              <span>Source</span>
              <select value={source} onChange={(e) => setSource(e.target.value)}>
                <option>All</option>
                {allSources.map(s => <option key={s}>{s}</option>)}
              </select>
            </label>

            <label>
              <span>Company</span>
              <select value={company} onChange={(e) => setCompany(e.target.value)}>
                <option>All</option>
                {allCompanies.map(c => <option key={c}>{c}</option>)}
              </select>
            </label>
          </div>
        </section>

        {loading ? (
          <section className="problems-skeletons">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="problems-skeleton" />
            ))}
          </section>
        ) : (
          <section className="problems-table-shell">
            <ProblemTable problems={filteredProblems as any} progress={progress} />
          </section>
        )}

        {!loading && filteredProblems.length === 0 && (
          <section className="problems-empty-state">
            <p>No problems found matching your filters.</p>
          </section>
        )}
      </div>
    </PlatformShell>
  )
}
