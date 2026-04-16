import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Play, Send, ChevronDown, Copy, Check, Bell, Bookmark, CheckCircle, Circle, Timer, Terminal as TermIcon, FileText, FlaskConical, Clock, Code2, XCircle, CheckCircle2, Lightbulb } from 'lucide-react'
import Editor from '@monaco-editor/react'
import ReactMarkdown from 'react-markdown'
import { getProblemBySlug, type Problem } from '../hooks/useProblems'
import { getCompanyLogo } from '../data/companyLogos'
import { saveSubmission, updateProgress, getSubmissions, updateUserStats, getUser } from '../firebase/firestoreHelpers'
import { auth } from '../firebase'
import { AIFeedback } from '../components/AIFeedback'
import './ProblemSolver.css'

// ─── Language config ───
const LANG_MAP: Record<string, string> = { cpp: 'cpp', python: 'python', java: 'java', javascript: 'javascript', c: 'c', go: 'go', rust: 'rust', ruby: 'ruby', php: 'php', kotlin: 'kotlin', swift: 'swift', perl: 'perl', r: 'r', scala: 'scala', csharp: 'csharp', typescript: 'typescript' }
const LANG_LABELS: Record<string, string> = { cpp: 'C++', python: 'Python', java: 'Java', javascript: 'JavaScript', c: 'C', go: 'Go', rust: 'Rust', ruby: 'Ruby', php: 'PHP', kotlin: 'Kotlin', swift: 'Swift', perl: 'Perl', r: 'R', scala: 'Scala', csharp: 'C#', typescript: 'TypeScript' }
const LANG_IDS: Record<string, number> = { c: 4, cpp: 10, java: 26, csharp: 51, go: 60, javascript: 63, php: 68, python: 71, ruby: 72, rust: 73, kotlin: 78, r: 80, swift: 83, typescript: 84, perl: 85, scala: 86 }
const FALLBACK: Record<string, string> = {
  cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}',
  python: '',
  java: 'public class Solution {\n    public static void main(String[] args) {\n        \n    }\n}',
  javascript: '',
  c: '#include <stdio.h>\n\nint main() {\n    \n    return 0;\n}',
  go: 'package main\n\nfunc main() {\n    \n}',
  rust: 'fn main() {\n    \n}',
  ruby: '',
  php: "<?php\n\n?>",
  kotlin: 'fun main() {\n    \n}',
  swift: '',
  perl: '',
  r: '',
  scala: 'object Main {\n    def main(args: Array[String]) {\n        \n    }\n}',
  csharp: 'using System;\n\npublic class Program {\n    public static void Main() {\n        \n    }\n}',
  typescript: '',
}

// ─── Helper: base64 encode/decode (utf-8 safe) ───
const encodeBase64 = (str: string) => {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  bytes.forEach((b) => { binary += String.fromCharCode(b) })
  return btoa(binary)
}
const decodeBase64 = (b64: string) => {
  try {
    const binary = atob(b64)
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return b64
  }
}

// ─── Compile via local backend proxy ───
const COMPILE_ENDPOINT = '/api/compile'
const COMPILE_TIMEOUT = 20000

interface CompileResult {
  stdout?: string
  stderr?: string
  compile_output?: string
  status?: { id: number; description: string }
  error?: string
  details?: string
  message?: string
}

async function compileCode(language: string, sourceCode: string, stdin: string): Promise<{ output: string; error: string }> {
  const langId = LANG_IDS[language]
  if (!langId) return { output: '', error: `Language "${language}" is not supported.` }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), COMPILE_TIMEOUT)

  try {
    const res = await fetch(COMPILE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language_id: langId,
        source_code: encodeBase64(sourceCode),
        stdin: encodeBase64(stdin),
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      let msg = 'Compilation failed on server.'
      try {
        const payload = await res.json()
        msg = payload?.details || payload?.error || payload?.message || msg
      } catch {
        const txt = await res.text()
        if (txt.trim()) msg = txt
      }
      return { output: '', error: msg }
    }

    const result: CompileResult = await res.json()

    if (result.compile_output) {
      return { output: '', error: `Compilation Error:\n${decodeBase64(result.compile_output)}` }
    }
    if (result.stderr) {
      return { output: '', error: `Runtime Error:\n${decodeBase64(result.stderr)}` }
    }
    if (result.stdout) {
      return { output: decodeBase64(result.stdout), error: '' }
    }
    if (result.error) {
      return { output: '', error: result.error }
    }
    return { output: '(no output)', error: '' }
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { output: '', error: 'Compilation timed out. Try again.' }
    }
    const errorMsg = err instanceof Error ? err.message : 'Failed to reach compiler'
    console.error('Compile Error:', { errorMsg, err })
    return { output: '', error: `❌ Connection Error: ${errorMsg}\n\nMake sure:\n• Backend server is running (http://localhost:3001)\n• Network connection is stable\n• API credentials are valid` }
  } finally {
    clearTimeout(timeout)
  }
}

interface TestCaseDetail {
  index: number
  input: string
  expected: string
  actual: string
  passed: boolean
}

interface VerdictResult {
  verdict: string
  output: string
  error: string
  runtime?: number
  memory?: number
  tcResults?: boolean[]
  testCaseDetails?: TestCaseDetail[]
  failedTestCaseIndex?: number
}

interface SubmissionRecord {
  id: string
  language: string
  verdict: string
  createdAt: any
  code?: string
  runtime?: number
  memory?: number
}

export const ProblemSolver = () => {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [problem, setProblem] = useState<Problem | null>(null)
  const [loading, setLoading] = useState(true)
  const [language, setLanguage] = useState<string>('cpp')
  const [code, setCode] = useState('')
  const [langDropdownOpen, setLangDropdownOpen] = useState(false)

  // Theme — read from global app theme (set by App.tsx)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('app-theme') as 'dark' | 'light') || 'light'
  })

  // UI state
  const [problemTab, setProblemTab] = useState<'description' | 'editorial' | 'submissions'>('description')
  const [consoleTab, setConsoleTab] = useState<'testcases' | 'output' | 'ai-feedback' | 'console'>('testcases')
  const [bookmarked, setBookmarked] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ description: true, examples: true, constraints: true })

  // Execution state
  const [testing, setTesting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [verdictResult, setVerdictResult] = useState<VerdictResult | null>(null)
  const [consoleOutput, setConsoleOutput] = useState('')

  // AI Feedback state
  const [aiFeedback, setAiFeedback] = useState<{
    explanation: string
    suggestions: string[]
    resources?: string[]
  } | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  
  // Error context - stored for AI analysis on demand
  const [errorContext, setErrorContext] = useState<{
    error: string
    errorType: 'compilation' | 'runtime' | 'wrong-output'
    expectedOutput?: string
    actualOutput?: string
  } | null>(null)

  // Premium state
  const [isPremium, setIsPremium] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  // Submissions
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([])
  const [submissionsLoading, setSubmissionsLoading] = useState(false)
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionRecord | null>(null)

  // Panel resizing
  const [leftWidth, setLeftWidth] = useState(42) // percent
  const [consoleHeight, setConsoleHeight] = useState(180) // px
  const isDraggingV = useRef(false)
  const isDraggingH = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)

  // Timer
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const i = setInterval(() => setElapsed(p => p + 1), 1000)
    return () => clearInterval(i)
  }, [])
  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  // Sync with global theme (listen for changes from the App header toggle)
  useEffect(() => {
    const syncTheme = () => {
      const globalTheme = (localStorage.getItem('app-theme') as 'dark' | 'light') || 'light'
      setTheme(globalTheme)
    }
    // Listen for storage changes (from other tabs)
    window.addEventListener('storage', syncTheme)
    // Observe data-theme attribute changes on <html> (same tab)
    const observer = new MutationObserver(() => {
      const attr = document.documentElement.getAttribute('data-theme') as 'dark' | 'light' | null
      if (attr && attr !== theme) setTheme(attr)
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => {
      window.removeEventListener('storage', syncTheme)
      observer.disconnect()
    }
  }, [theme])

  // Load problem
  useEffect(() => {
    if (slug) {
      const found = getProblemBySlug(slug)
      setProblem(found)
      setLoading(false)
      const starter = found?.starterCode?.[language] || FALLBACK[language] || FALLBACK.cpp
      setCode(starter)
    }
  }, [slug])

  // Load user premium status
  useEffect(() => {
    const loadPremiumStatus = async () => {
      if (auth.currentUser?.uid) {
        const user = await getUser(auth.currentUser.uid)
        setIsPremium(user?.isPremium ?? false)
      }
    }
    loadPremiumStatus()
  }, [])

  // Update code when language changes
  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang)
    setLangDropdownOpen(false)
    const starter = problem?.starterCode?.[newLang] || FALLBACK[newLang] || FALLBACK.cpp
    setCode(starter)
  }

  // Load submissions when tab changes
  useEffect(() => {
    if (problemTab === 'submissions' && problem?.id) {
      loadSubmissions()
    }
  }, [problemTab, problem?.id])

  // Close language dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.solver-lang-dropdown')) {
        setLangDropdownOpen(false)
      }
    }
    if (langDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [langDropdownOpen])

  const loadSubmissions = async () => {
    if (!problem?.id) return
    setSubmissionsLoading(true)
    try {
      const userId = auth.currentUser?.uid
      if (!userId) {
        console.warn('Cannot load submissions: user not authenticated')
        setSubmissions([])
        return
      }
      const subs = await getSubmissions(userId, problem.id)
      console.log('Submissions loaded:', subs)
      setSubmissions(subs as SubmissionRecord[])
    } catch (error) {
      console.error('Error loading submissions:', error)
      setSubmissions([])
    } finally {
      setSubmissionsLoading(false)
    }
  }

  // Copy testcase
  const copyText = (text: string, idx: number) => {
    navigator.clipboard.writeText(text)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 1500)
  }

  // Toggle sections
  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // ─── Vertical resize (left-right) ───
  const startResizeV = useCallback(() => { isDraggingV.current = true }, [])
  const startResizeH = useCallback(() => { isDraggingH.current = true }, [])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (isDraggingV.current && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const pct = ((e.clientX - rect.left) / rect.width) * 100
        setLeftWidth(Math.min(Math.max(pct, 20), 65))
      }
      if (isDraggingH.current && rightRef.current) {
        const rect = rightRef.current.getBoundingClientRect()
        const h = rect.bottom - e.clientY
        setConsoleHeight(Math.min(Math.max(h, 100), 500))
      }
    }
    const onUp = () => { isDraggingV.current = false; isDraggingH.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  // Helper to extract line numbers from error messages
  const extractLineNumber = (errorStr: string): string | null => {
    const lineMatches = [
      errorStr.match(/line\s+(\d+)/i),
      errorStr.match(/:\s*(\d+):/),
      errorStr.match(/error at line (\d+)/i),
    ]
    for (const match of lineMatches) {
      if (match && match[1]) return match[1]
    }
    return null
  }

  const formatErrorWithLineNumber = (error: string): string => {
    const lineNum = extractLineNumber(error)
    if (lineNum) {
      return `[Line ${lineNum}] ${error}`
    }
    return error
  }

  // ─── AI Analysis Function ───
  const analyzeErrorWithAI = async (
    errorMessage: string,
    errorType: 'compilation' | 'runtime' | 'wrong-output',
    expectedOutput?: string,
    actualOutput?: string
  ) => {
    setAiLoading(true)
    setAiError(null)
    setAiFeedback(null)

    try {
      const response = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          language,
          error: errorMessage,
          errorType,
          expectedOutput,
          actualOutput,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.details || errorData.error || 'Failed to analyze error')
      }

      const analysis = await response.json()
      setAiFeedback(analysis)
      // Auto-switch to AI Feedback tab when analysis is ready
      setConsoleTab('ai-feedback')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setAiError(msg)
      // Auto-switch to AI Feedback tab to show error
      setConsoleTab('ai-feedback')
      console.error('AI Analysis Error:', { msg, err })
    } finally {
      setAiLoading(false)
    }
  }

  // Handle AI Feedback tab click - check premium, show modal if needed, or analyze
  const handleAIFeedbackTabClick = async () => {
    // If user is not premium, show upgrade modal
    if (!isPremium) {
      setShowUpgradeModal(true)
      return
    }

    // If there's a stored error context, analyze it
    if (errorContext) {
      setConsoleTab('ai-feedback')
      await analyzeErrorWithAI(
        errorContext.error,
        errorContext.errorType,
        errorContext.expectedOutput,
        errorContext.actualOutput
      )
    } else {
      // Just switch to AI Feedback tab if no error
      setConsoleTab('ai-feedback')
    }
  }

  // ─── Run sample test (through backend) ───
  const runCode = async () => {
    if (!problem) return
    setTesting(true)
    setVerdictResult(null)
    setConsoleOutput('')
    setAiFeedback(null)
    setConsoleTab('output')

    const startTime = performance.now()
    const { output, error } = await compileCode(language, code, problem.sampleInput || '')
    const elapsed = Math.round(performance.now() - startTime)

    if (error) {
      const formattedError = formatErrorWithLineNumber(error)
      const lineNum = extractLineNumber(error)
      setVerdictResult({ verdict: 'Compilation/Runtime Error', output: '', error: formattedError })
      setConsoleOutput(formattedError)
      // Highlight error line in editor if line number found
      if (lineNum) {
        console.log(`Error on line ${lineNum}`)
      }
      // Store error context for AI analysis (only when user clicks AI tab)
      setErrorContext({ error, errorType: 'runtime' })
    } else {
      const expected = problem.sampleOutput?.trim() || ''
      const actual = output.trim()
      const v = actual === expected ? 'Accepted' : 'Wrong Answer'
      setVerdictResult({
        verdict: v, output, error: '',
        runtime: elapsed,
        memory: Math.floor(Math.random() * 30) + 10,
        tcResults: [actual === expected],
      })
      setConsoleOutput(output || '(no output)')
      // Store error context for AI analysis (only when user clicks AI tab)
      if (v === 'Wrong Answer') {
        setErrorContext({
          error: `Output mismatch on sample test case`,
          errorType: 'wrong-output',
          expectedOutput: expected,
          actualOutput: actual
        })
      }
    }
    setTesting(false)
  }

  // ─── Submit code (run against all test cases through backend) ───
  const submitCode = async () => {
    if (!problem) return
    setSubmitting(true)
    setVerdictResult(null)
    setConsoleOutput('')
    setAiFeedback(null)
    setConsoleTab('output')

    try {
      let finalVerdict = 'Accepted'
      let failOutput = ''
      let failError = ''
      const tcRes: boolean[] = []
      const tcDetails: TestCaseDetail[] = []
      let failedTcIndex = -1
      const startTime = performance.now()

      for (let tcIdx = 0; tcIdx < (problem.testCases || []).length; tcIdx++) {
        const tc = problem.testCases![tcIdx]
        const { output, error } = await compileCode(language, code, tc.input || '')

        if (error) {
          finalVerdict = 'Runtime Error'
          failError = formatErrorWithLineNumber(error)
          tcRes.push(false)
          failedTcIndex = tcIdx
          tcDetails.push({
            index: tcIdx + 1,
            input: tc.input || '',
            expected: tc.output || '',
            actual: '',
            passed: false,
          })
          // Store error context for AI analysis
          setErrorContext({ error, errorType: 'runtime' })
          break
        }
        const expected = tc.output?.trim() || ''
        const actual = output.trim()
        const passed = actual === expected
        tcRes.push(passed)
        tcDetails.push({
          index: tcIdx + 1,
          input: tc.input || '',
          expected,
          actual,
          passed,
        })
        if (!passed) {
          finalVerdict = 'Wrong Answer'
          failOutput = `Test Case ${tcIdx + 1} Failed`
          failedTcIndex = tcIdx
          // Store error context for AI analysis
          setErrorContext({
            error: `Test case ${tcIdx + 1} output mismatch`,
            errorType: 'wrong-output',
            expectedOutput: expected,
            actualOutput: actual
          })
          break
        }
      }

      const totalElapsed = Math.round(performance.now() - startTime)

      setVerdictResult({
        verdict: finalVerdict,
        output: failOutput,
        error: failError,
        runtime: totalElapsed,
        memory: Math.floor(Math.random() * 40) + 10,
        tcResults: tcRes,
        testCaseDetails: tcDetails,
        failedTestCaseIndex: failedTcIndex,
      })
      setConsoleOutput(failOutput || failError || 'All test cases passed!')

      // Save submission to Firestore
      if (problem.id) {
        try {
          const userId = auth.currentUser?.uid
          const userEmail = auth.currentUser?.email
          const displayName = auth.currentUser?.displayName || userEmail?.split('@')[0] || 'Anonymous'
          
          if (!userId) {
            console.warn('Cannot save submission: user not authenticated')
            return
          }

          const submissionData = {
            userId,
            userEmail,
            displayName,
            problemId: problem.id,
            problemTitle: problem.title,
            code,
            language,
            verdict: finalVerdict,
            output: failOutput || '',
            error: failError || '',
            runtime: totalElapsed,
            memory: Math.floor(Math.random() * 40) + 10,
            testCaseDetails: tcDetails,
            createdAt: new Date(),
          }

          const subId = await saveSubmission(submissionData)

          if (finalVerdict === 'Accepted') {
            await updateProgress(userId, problem.id, 'solved', subId, new Date())
            // Update user stats: increment solved count and streak
            await updateUserStats(userId, true, true)
          } else {
            await updateProgress(userId, problem.id, 'attempted', subId, new Date())
          }
          // Refresh submissions list
          await loadSubmissions()
        } catch (error) {
          console.error('Error saving submission to Firestore:', error)
          if (error instanceof Error) {
            console.error('Error details:', error.message)
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setVerdictResult({ verdict: 'Runtime Error', output: '', error: msg })
      setConsoleOutput(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Difficulty badge class ───
  const diffClass = (d: string) => d === 'Easy' ? 'solver-badge--easy' : d === 'Medium' ? 'solver-badge--medium' : 'solver-badge--hard'

  // ─── Verdict class ───
  const verdictClass = (v: string) => {
    if (v === 'Accepted') return 'solver-verdict--accepted'
    if (v === 'Wrong Answer') return 'solver-verdict--wrong'
    if (v === 'Time Limit Exceeded') return 'solver-verdict--tle'
    return 'solver-verdict--error'
  }

  const verdictIcon = (v: string) => {
    if (v === 'Accepted') return <CheckCircle2 size={14} className="sub-icon sub-icon--accepted" />
    if (v === 'Wrong Answer') return <XCircle size={14} className="sub-icon sub-icon--wrong" />
    return <XCircle size={14} className="sub-icon sub-icon--error" />
  }

  const formatDate = (d: any) => {
    try {
      const date = d?.toDate ? d.toDate() : new Date(d)
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
        ' ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    } catch { return 'Unknown' }
  }

  if (loading) {
    return <div className="solver-root" data-theme={theme} style={{ display: 'grid', placeItems: 'center' }}><div className="solver-spinner" /></div>
  }

  if (!problem) {
    return (
      <div className="solver-root" data-theme={theme} style={{ display: 'grid', placeItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--ps-text-secondary)', marginBottom: '0.75rem' }}>Problem not found</p>
          <button onClick={() => navigate('/problems')} className="solver-btn-run">Back to Problems</button>
        </div>
      </div>
    )
  }

  return (
    <div className={`solver-root ${theme === 'light' ? 'solver-root--light' : ''}`} data-theme={theme}>
      {/* ════ Top Navbar ════ */}
      <nav className="solver-navbar">
        <button className="solver-navbar__back" onClick={() => navigate('/problems')}>
          <ArrowLeft size={14} /> Dashboard
        </button>

        <div className="solver-navbar__divider" />

        <span className="solver-navbar__title">{problem.title}</span>
        <span className={`solver-badge ${diffClass(problem.difficulty)}`}>{problem.difficulty}</span>
        {problem.source && <span className="solver-source-badge">{problem.source}</span>}

        {/* Status indicators */}
        <div className="solver-status-indicators">
          <button className={`solver-indicator ${bookmarked ? 'active' : ''}`} onClick={() => setBookmarked(!bookmarked)} title="Bookmark">
            <Bookmark size={13} fill={bookmarked ? 'currentColor' : 'none'} /> {bookmarked ? 'Saved' : 'Save'}
          </button>
        </div>

        <div className="solver-navbar__spacer" />

        {/* Timer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.76rem', color: 'var(--ps-text-secondary)', fontFamily: "'JetBrains Mono', monospace" }}>
          <Timer size={13} />
          {formatTime(elapsed)}
        </div>

        <div className="solver-navbar__divider" />

        {/* Run / Submit */}
        <button className="solver-btn-run" onClick={runCode} disabled={testing || submitting}>
          {testing ? <div className="solver-spinner" /> : <Play size={13} />}
          {testing ? 'Running' : 'Run'}
        </button>
        <button className="solver-btn-submit" onClick={submitCode} disabled={submitting || testing}>
          {submitting ? <div className="solver-spinner" /> : <Send size={13} />}
          {submitting ? 'Judging' : 'Submit'}
        </button>

        <div className="solver-navbar__divider" />

        {/* Language Selector */}
        <div className="solver-lang-dropdown">
          <button
            className="solver-lang-dropdown__btn"
            onClick={() => setLangDropdownOpen(!langDropdownOpen)}
          >
            <Code2 size={13} />
            <span>{LANG_LABELS[language]}</span>
            <ChevronDown size={12} className={langDropdownOpen ? 'rotate' : ''} />
          </button>
          {langDropdownOpen && (
            <div className="solver-lang-dropdown__menu">
              {Object.entries(LANG_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  className={`solver-lang-dropdown__option ${language === key ? 'active' : ''}`}
                  onClick={() => handleLanguageChange(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notification */}
        <button className="solver-notification">
          <Bell size={16} />
          <span className="solver-notification__dot" />
        </button>

        {/* Premium Badge */}
        <button 
          onClick={() => !isPremium && setShowUpgradeModal(true)}
          style={{
            padding: '0.35rem 0.6rem',
            fontSize: '0.68rem',
            fontWeight: '600',
            background: isPremium ? 'linear-gradient(135deg, #ffd700 0%, #ffed4e 100%)' : 'var(--ps-surface-2)',
            color: isPremium ? '#333' : 'var(--ps-text-secondary)',
            border: isPremium ? 'none' : '1px solid var(--ps-border)',
            borderRadius: '4px',
            cursor: isPremium ? 'default' : 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}
          title={isPremium ? 'Premium Member' : 'Upgrade to Premium'}
        >
          {isPremium ? '⭐ PREMIUM' : 'UPGRADE'}
        </button>

        {/* Avatar */}
        <div className="solver-avatar">{auth.currentUser?.displayName?.[0]?.toUpperCase() || 'Y'}</div>
      </nav>

      {/* ════ Main Layout ════ */}
      <div className="solver-main" ref={containerRef}>
        {/* ─── Left: Problem ─── */}
        <div className="solver-problem" style={{ width: `${leftWidth}%` }}>
          <div className="solver-problem__tabs">
            {(['description', 'editorial', 'submissions'] as const).map(tab => (
              <button key={tab} className={`solver-problem__tab ${problemTab === tab ? 'active' : ''}`} onClick={() => setProblemTab(tab)}>
                {tab === 'submissions' ? (
                  <><Code2 size={12} style={{ marginRight: '0.2rem' }} />{tab.charAt(0).toUpperCase() + tab.slice(1)}{submissions.length > 0 && <span className="solver-tab-count">{submissions.length}</span>}</>
                ) : (
                  tab.charAt(0).toUpperCase() + tab.slice(1)
                )}
              </button>
            ))}
          </div>

          <div className="solver-problem__body">
            {problemTab === 'description' && (
              <>
                {/* Companies */}
                {problem.companyTags && problem.companyTags.length > 0 && (
                  <div className="solver-companies" style={{ marginBottom: '1rem' }}>
                    {problem.companyTags.map(c => (
                      <span key={c} className="solver-company-tag">
                        <span className="solver-company-tag__logo" dangerouslySetInnerHTML={{ __html: getCompanyLogo(c) }} />
                        {c}
                      </span>
                    ))}
                  </div>
                )}

                {/* Description section */}
                <div className="solver-section">
                  <div className="solver-section__header" onClick={() => toggleSection('description')}>
                    <span className="solver-section__title">
                      <FileText size={14} /> Description
                    </span>
                    <ChevronDown size={14} className={`solver-section__chevron ${!expandedSections.description ? 'collapsed' : ''}`} />
                  </div>
                  {expandedSections.description && (
                    <div className="solver-section__content solver-markdown">
                      <ReactMarkdown
                        components={{
                          code: (props) => <code {...props} />,
                          pre: (props) => <pre {...props} />,
                          strong: (props) => <strong {...props} />,
                        }}
                      >
                        {problem.statement || 'No description'}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>

                {/* Examples section */}
                <div className="solver-section">
                  <div className="solver-section__header" onClick={() => toggleSection('examples')}>
                    <span className="solver-section__title">
                      <FlaskConical size={14} /> Examples
                    </span>
                    <ChevronDown size={14} className={`solver-section__chevron ${!expandedSections.examples ? 'collapsed' : ''}`} />
                  </div>
                  {expandedSections.examples && (
                    <div className="solver-section__content">
                      {problem.sampleInput && (
                        <div className="solver-example">
                          <div className="solver-example__header">
                            <span className="solver-example__label">Input</span>
                            <button className={`solver-example__copy ${copiedIdx === 100 ? 'copied' : ''}`} onClick={() => copyText(problem.sampleInput, 100)}>
                              {copiedIdx === 100 ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                            </button>
                          </div>
                          <pre>{problem.sampleInput}</pre>
                        </div>
                      )}
                      {problem.sampleOutput && (
                        <div className="solver-example">
                          <div className="solver-example__header">
                            <span className="solver-example__label">Output</span>
                            <button className={`solver-example__copy ${copiedIdx === 101 ? 'copied' : ''}`} onClick={() => copyText(problem.sampleOutput, 101)}>
                              {copiedIdx === 101 ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                            </button>
                          </div>
                          <pre>{problem.sampleOutput}</pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Tags section */}
                <div className="solver-section">
                  <div className="solver-section__header" onClick={() => toggleSection('constraints')}>
                    <span className="solver-section__title">
                      <TermIcon size={14} /> Tags
                    </span>
                    <ChevronDown size={14} className={`solver-section__chevron ${!expandedSections.constraints ? 'collapsed' : ''}`} />
                  </div>
                  {expandedSections.constraints && (
                    <div className="solver-section__content">
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                        {problem.tags?.map(tag => (
                          <span key={tag} className="solver-tag-chip">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {problemTab === 'editorial' && (
              <div className="solver-markdown">
                {problem.editorial ? (
                  <ReactMarkdown>{problem.editorial}</ReactMarkdown>
                ) : (
                  <p style={{ color: 'var(--ps-text-muted)' }}>Editorial not available yet.</p>
                )}
              </div>
            )}

            {/* ─── Submissions Tab ─── */}
            {problemTab === 'submissions' && (
              <div className="solver-submissions">
                {submissionsLoading ? (
                  <div className="solver-submissions__loading">
                    <div className="solver-spinner" />
                    <span>Loading submissions...</span>
                  </div>
                ) : submissions.length === 0 ? (
                  <div className="solver-submissions__empty">
                    <Code2 size={40} strokeWidth={1} />
                    <h3>No submissions yet</h3>
                    <p>Submit your solution to see it here!</p>
                  </div>
                ) : (
                  <>
                    <div className="solver-submissions__list">
                      {submissions.map((sub) => (
                        <div
                          key={sub.id}
                          className={`solver-submission-card ${selectedSubmission?.id === sub.id ? 'active' : ''}`}
                          onClick={() => setSelectedSubmission(selectedSubmission?.id === sub.id ? null : sub)}
                        >
                          <div className="solver-submission-card__top">
                            <div className="solver-submission-card__verdict">
                              {verdictIcon(sub.verdict)}
                              <span className={`solver-submission-verdict-text ${sub.verdict === 'Accepted' ? 'accepted' : 'failed'}`}>
                                {sub.verdict}
                              </span>
                            </div>
                            <span className="solver-submission-card__lang">{LANG_LABELS[sub.language] || sub.language}</span>
                          </div>
                          <div className="solver-submission-card__bottom">
                            <span className="solver-submission-card__time">
                              <Clock size={11} /> {formatDate(sub.createdAt)}
                            </span>
                            {sub.runtime && (
                              <span className="solver-submission-card__runtime">
                                <Timer size={11} /> {sub.runtime}ms
                              </span>
                            )}
                          </div>

                          {/* Expanded view */}
                          {selectedSubmission?.id === sub.id && sub.code && (
                            <div className="solver-submission-card__code">
                              <pre>{sub.code}</pre>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ─── Vertical resize handle ─── */}
        <div
          className={`solver-resize-v ${isDraggingV.current ? 'dragging' : ''}`}
          onMouseDown={startResizeV}
        />

        {/* ─── Right: Editor + Console ─── */}
        <div className="solver-right" ref={rightRef}>
          {/* Editor top bar */}
          <div className="solver-editor-topbar">
            <div className="solver-editor-topbar__left">
              <div className="solver-editor-topbar__dot" style={{ background: 'var(--ps-text-muted)' }} />
              <div className="solver-editor-topbar__dot" style={{ background: 'var(--ps-text-secondary)' }} />
              <div className="solver-editor-topbar__dot" style={{ background: 'var(--ps-text)' }} />
              <span style={{ fontSize: '0.72rem', color: 'var(--ps-text-muted)', marginLeft: '0.3rem' }}>
                solution.{language === 'cpp' ? 'cpp' : language === 'python' ? 'py' : language === 'java' ? 'java' : language === 'c' ? 'c' : 'js'}
              </span>
            </div>
          </div>

          {/* Monaco Editor */}
          <div className="solver-editor-wrap" style={{ flex: 1 }}>
            <Editor
              height="100%"
              language={LANG_MAP[language] || 'cpp'}
              theme={theme === 'dark' ? 'vs-dark' : 'vs'}
              value={code}
              onChange={(val) => setCode(val || '')}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                fontLigatures: true,
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 4,
                renderLineHighlight: 'all',
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                smoothScrolling: true,
                padding: { top: 12, bottom: 12 },
                lineNumbers: 'on',
                glyphMargin: false,
                folding: true,
                bracketPairColorization: { enabled: true },
              }}
            />
          </div>

          {/* ─── Horizontal resize handle ─── */}
          <div
            className={`solver-resize-h ${isDraggingH.current ? 'dragging' : ''}`}
            onMouseDown={startResizeH}
          />

          {/* ─── Console Panel ─── */}
          <div className="solver-console" style={{ height: `${consoleHeight}px` }}>
            <div className="solver-console__tabs">
              {([
                { key: 'testcases', label: 'Testcases', icon: <FlaskConical size={12} />, count: problem.testCases?.length },
                { key: 'output', label: 'Output', icon: <TermIcon size={12} />, count: undefined },
                { key: 'ai-feedback', label: 'AI Feedback', icon: <Lightbulb size={12} />, count: aiFeedback ? undefined : null },
                { key: 'console', label: 'Console', icon: <FileText size={12} />, count: undefined },
              ] as const).map(t => (
                <button
                  key={t.key}
                  className={`solver-console__tab ${consoleTab === t.key ? 'active' : ''}`}
                  onClick={() => t.key === 'ai-feedback' ? handleAIFeedbackTabClick() : setConsoleTab(t.key)}
                  disabled={t.key === 'ai-feedback' && !aiFeedback && !aiLoading && !aiError && !errorContext}
                >
                  {t.icon} {t.label}
                  {t.count !== undefined && <span className="solver-console__tab-count">{t.count}</span>}
                </button>
              ))}
            </div>

            <div className="solver-console__body">
              {/* Testcases tab */}
              {consoleTab === 'testcases' && (
                <div className="solver-tc-grid">
                  {(problem.testCases || []).map((tc, idx) => (
                    <div key={idx} className="solver-tc-card">
                      <div className="solver-tc-card__header">
                        <span className="solver-tc-card__label">Case {idx + 1}</span>
                        <button className={`solver-example__copy ${copiedIdx === idx ? 'copied' : ''}`} onClick={() => copyText(tc.input, idx)}>
                          {copiedIdx === idx ? <Check size={10} /> : <Copy size={10} />}
                        </button>
                      </div>
                      <pre><span style={{ color: 'var(--ps-text-muted)', fontSize: '0.65rem' }}>IN:</span> {tc.input}</pre>
                      <pre style={{ borderTop: '1px solid var(--ps-border)' }}><span style={{ color: 'var(--ps-text-muted)', fontSize: '0.65rem' }}>OUT:</span> {tc.output}</pre>
                    </div>
                  ))}
                </div>
              )}

              {/* Output tab */}
              {consoleTab === 'output' && (
                <>
                  {verdictResult && (
                    <div className={`solver-verdict ${verdictClass(verdictResult.verdict)}`}>
                      <div className="solver-verdict__title">{verdictResult.verdict}</div>

                      {/* Testcase badges */}
                      {verdictResult.tcResults && (
                        <div className="solver-tc-results">
                          {verdictResult.tcResults.map((pass, i) => (
                            <div key={i} className={`solver-tc-result ${pass ? 'solver-tc-result--pass' : 'solver-tc-result--fail'}`} style={{ animationDelay: `${i * 0.1}s` }}>
                              {pass ? <CheckCircle size={13} /> : <Circle size={13} />}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Metrics */}
                      {verdictResult.runtime !== undefined && (
                        <div className="solver-metrics">
                          <div className="solver-metric">
                            <div className="solver-metric__label">Runtime</div>
                            <div className="solver-metric__bar">
                              <div className="solver-metric__fill solver-metric__fill--runtime" style={{ width: `${Math.min(verdictResult.runtime / 50, 100)}%` }} />
                            </div>
                            <div className="solver-metric__value">{verdictResult.runtime} ms</div>
                          </div>
                          <div className="solver-metric">
                            <div className="solver-metric__label">Memory</div>
                            <div className="solver-metric__bar">
                              <div className="solver-metric__fill solver-metric__fill--memory" style={{ width: `${Math.min((verdictResult.memory || 0) * 2, 100)}%` }} />
                            </div>
                            <div className="solver-metric__value">{verdictResult.memory} MB</div>
                          </div>
                        </div>
                      )}

                      {verdictResult.output && (
                        <div className="solver-verdict__details" style={{ marginTop: '0.5rem' }}>
                          <pre style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.78rem', margin: 0 }}>{verdictResult.output}</pre>
                        </div>
                      )}
                      {verdictResult.error && (
                        <div className="solver-verdict__details" style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'rgba(220,53,69,0.1)', borderLeft: '3px solid var(--ps-red)', borderRadius: '4px' }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ps-red)', marginBottom: '0.3rem' }}>
                            ⚠️ {verdictResult.verdict}
                          </div>
                          <pre style={{ 
                            fontFamily: "'JetBrains Mono', monospace", 
                            fontSize: '0.75rem', 
                            margin: 0, 
                            color: 'var(--ps-red)', 
                            whiteSpace: 'pre-wrap', 
                            wordWrap: 'break-word',
                            lineHeight: '1.6'
                          }}>
                            {verdictResult.error}
                          </pre>
                          {extractLineNumber(verdictResult.error) && (
                            <div style={{ 
                              fontSize: '0.7rem', 
                              marginTop: '0.4rem', 
                              padding: '0.4rem', 
                              background: 'rgba(220,53,69,0.2)', 
                              borderRadius: '3px',
                              color: 'var(--ps-red)',
                              fontWeight: 600
                            }}>
                              👉 Check line {extractLineNumber(verdictResult.error)} in your code
                            </div>
                          )}
                        </div>
                      )}

                      {/* Detailed Test Case Results */}
                      {verdictResult.testCaseDetails && verdictResult.testCaseDetails.length > 0 && (
                        <div style={{ marginTop: '0.75rem' }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--ps-text-secondary)' }}>Test Case Details</div>
                          {verdictResult.testCaseDetails.map((tc) => (
                            <div
                              key={tc.index}
                              style={{
                                marginBottom: '0.5rem',
                                padding: '0.4rem',
                                borderRadius: '4px',
                                background: tc.passed ? 'rgba(22, 163, 74, 0.1)' : 'rgba(153, 27, 27, 0.1)',
                                border: `1px solid ${tc.passed ? '#86efac' : '#fca5a5'}`,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
                                {tc.passed ? (
                                  <CheckCircle size={12} style={{ color: '#16a34a' }} />
                                ) : (
                                  <XCircle size={12} style={{ color: '#dc2626' }} />
                                )}
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: tc.passed ? '#16a34a' : '#dc2626' }}>
                                  Test Case {tc.index} {tc.passed ? '✓ PASSED' : '✗ FAILED'}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.7rem', fontFamily: "'JetBrains Mono', monospace", marginTop: '0.3rem' }}>
                                <div style={{ color: 'var(--ps-text-muted)', marginBottom: '0.2rem' }}>Input:</div>
                                <pre style={{ margin: 0, maxHeight: '80px', overflow: 'auto', padding: '0.3rem', background: 'rgba(0,0,0,0.1)', borderRadius: '2px' }}>{tc.input}</pre>
                                <div style={{ color: 'var(--ps-text-muted)', marginTop: '0.3rem', marginBottom: '0.2rem' }}>Expected Output:</div>
                                <pre style={{ margin: 0, maxHeight: '80px', overflow: 'auto', padding: '0.3rem', background: 'rgba(0,0,0,0.1)', borderRadius: '2px' }}>{tc.expected}</pre>
                                {tc.actual && (
                                  <>
                                    <div style={{ color: 'var(--ps-text-muted)', marginTop: '0.3rem', marginBottom: '0.2rem' }}>Actual Output:</div>
                                    <pre style={{ margin: 0, maxHeight: '80px', overflow: 'auto', padding: '0.3rem', background: 'rgba(0,0,0,0.1)', borderRadius: '2px' }}>{tc.actual}</pre>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {!verdictResult && !testing && !submitting && (
                    <p style={{ color: 'var(--ps-text-muted)', fontSize: '0.82rem' }}>Run or submit your code to see output here.</p>
                  )}

                  {(testing || submitting) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--ps-text-secondary)' }}>
                      <div className="solver-spinner" />
                      <span style={{ fontSize: '0.82rem' }}>{testing ? 'Running against sample test...' : 'Judging all test cases...'}</span>
                    </div>
                  )}
                </>
              )}

              {/* Console (logs) tab */}
              {consoleTab === 'console' && (
                <div className={`solver-output ${consoleOutput.includes('Error') ? 'solver-output--error' : ''}`}>
                  {consoleOutput ? (
                    <pre>{consoleOutput}</pre>
                  ) : (
                    <p style={{ color: 'var(--ps-text-muted)', fontSize: '0.82rem', padding: '0.5rem' }}>Console output will appear here.</p>
                  )}
                </div>
              )}

              {/* AI Feedback tab */}
              {consoleTab === 'ai-feedback' && (
                <div style={{ padding: '0.75rem', overflow: 'auto', height: '100%' }}>
                  {aiFeedback && (
                    <AIFeedback
                      explanation={aiFeedback.explanation}
                      suggestions={aiFeedback.suggestions}
                      resources={aiFeedback.resources}
                      isLoading={false}
                    />
                  )}
                  {aiLoading && (
                    <AIFeedback
                      explanation=""
                      suggestions={[]}
                      isLoading={true}
                    />
                  )}
                  {aiError && (
                    <AIFeedback
                      explanation=""
                      suggestions={[]}
                      error={aiError}
                    />
                  )}
                  {!aiFeedback && !aiLoading && !aiError && (
                    <p style={{ color: 'var(--ps-text-muted)', fontSize: '0.82rem', paddingTop: '0.5rem' }}>
                      AI-powered feedback will appear here when you encounter errors.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Premium Upgrade Modal */}
      {showUpgradeModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }} onClick={() => setShowUpgradeModal(false)}>
          <div style={{
            background: 'var(--ps-surface)',
            border: '1px solid var(--ps-border)',
            borderRadius: '12px',
            padding: '2rem',
            maxWidth: '400px',
            textAlign: 'center',
            color: 'var(--ps-text)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⭐</div>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.5rem', fontWeight: '600' }}>Upgrade to Premium</h2>
            <p style={{ color: 'var(--ps-text-secondary)', margin: '0 0 1.5rem', lineHeight: '1.6' }}>
              Get AI-powered code analysis to understand errors, receive personalized suggestions, and learn programming concepts faster.
            </p>

            <div style={{ textAlign: 'left', background: 'var(--ps-surface-2)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              <div style={{ marginBottom: '0.5rem' }}>✓ AI Error Analysis</div>
              <div style={{ marginBottom: '0.5rem' }}>✓ Code Suggestions</div>
              <div>✓ Learning Resources</div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setShowUpgradeModal(false)} style={{
                flex: 1,
                padding: '0.75rem',
                border: '1px solid var(--ps-border)',
                background: 'transparent',
                color: 'var(--ps-text)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500',
              }}>
                Maybe Later
              </button>
              <button onClick={() => {
                setShowUpgradeModal(false)
                // TODO: Integrate with payment system
                alert('Premium upgrade functionality coming soon!')
              }} style={{
                flex: 1,
                padding: '0.75rem',
                background: 'var(--ps-accent)',
                color: 'var(--ps-accent-contrast)',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
              }}>
                Upgrade Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

