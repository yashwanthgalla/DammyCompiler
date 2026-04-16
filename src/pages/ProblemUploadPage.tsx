import { useEffect, useMemo, useState } from 'react'
import type { User } from 'firebase/auth'
import { addDoc, collection, getDocs, query, serverTimestamp, where } from 'firebase/firestore'
import { db } from '../firebase'
import './ProblemUploadPage.css'

interface ProblemUploadPageProps {
  authUser: User
  isAdmin: boolean
}

interface LanguageVariant {
  id: string
  language: string
  starterCode: string
  hints: string
}

interface TestCaseItem {
  id: string
  input: string
  expectedOutput: string
}

interface StoredProblem {
  id: string
  title: string
  course: string
  setName: string
  statement: string
  sampleInput: string
  sampleOutput: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  languageVariants: Array<{
    language: string
    starterCode: string
    hints: string
  }>
  testCases: Array<{
    input: string
    expectedOutput: string
  }>
  createdAtMillis: number
  createdAtLabel: string
}

const LANGUAGE_OPTIONS = [
  'javascript',
  'typescript',
  'python',
  'java',
  'c++',
  'c#',
  'c',
  'go',
  'rust',
  'php',
  'ruby',
  'swift',
  'kotlin',
  'scala',
]

const createVariantsForAllLanguages = (): LanguageVariant[] =>
  LANGUAGE_OPTIONS.map((language) => ({
    id: `${language}_${Math.random().toString(36).slice(2, 8)}`,
    language,
    starterCode: '',
    hints: '',
  }))

const createTestCase = (): TestCaseItem => ({
  id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  input: '',
  expectedOutput: '',
})

const mapTimestamp = (rawValue: unknown) => {
  const candidate = rawValue as { toDate?: () => Date } | undefined
  const parsed = candidate?.toDate ? candidate.toDate() : null

  if (!parsed || Number.isNaN(parsed.getTime())) {
    return {
      millis: 0,
      label: 'Recently',
    }
  }

  return {
    millis: parsed.getTime(),
    label: parsed.toLocaleString(),
  }
}

function ProblemUploadPage({ authUser, isAdmin }: ProblemUploadPageProps) {
  const [title, setTitle] = useState('')
  const [course, setCourse] = useState('')
  const [setName, setSetName] = useState('')
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner')
  const [statement, setStatement] = useState('')
  const [sampleInput, setSampleInput] = useState('')
  const [sampleOutput, setSampleOutput] = useState('')
  const [tags, setTags] = useState('')
  const [variants, setVariants] = useState<LanguageVariant[]>(createVariantsForAllLanguages)
  const [testCases, setTestCases] = useState<TestCaseItem[]>([createTestCase()])

  const [submitting, setSubmitting] = useState(false)
  const [loadingProblems, setLoadingProblems] = useState(true)
  const [statusMessage, setStatusMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const [uploadedProblems, setUploadedProblems] = useState<StoredProblem[]>([])
  const [courseFilter, setCourseFilter] = useState('all')
  const [languageFilter, setLanguageFilter] = useState('all')

  const loadProblems = async () => {
    setLoadingProblems(true)
    setErrorMessage('')

    try {
      const snapshot = await getDocs(query(collection(db, 'problemUploads'), where('ownerId', '==', authUser.uid)))
      const nextProblems = snapshot.docs
        .map((problemDoc) => {
          const data = problemDoc.data() as {
            title?: string
            course?: string
            setName?: string
            statement?: string
            sampleInput?: string
            sampleOutput?: string
            difficulty?: 'beginner' | 'intermediate' | 'advanced'
            languageVariants?: Array<{ language?: string; starterCode?: string; hints?: string }>
            testCases?: Array<{ input?: string; expectedOutput?: string }>
            createdAt?: unknown
          }

          const createdAt = mapTimestamp(data.createdAt)

          return {
            id: problemDoc.id,
            title: data.title || 'Untitled Problem',
            course: data.course || 'Uncategorized',
            setName: data.setName || 'General',
            statement: data.statement || '',
            sampleInput: data.sampleInput || '',
            sampleOutput: data.sampleOutput || '',
            difficulty: data.difficulty || 'beginner',
            languageVariants: (data.languageVariants || []).map((variant) => ({
              language: variant.language || 'javascript',
              starterCode: variant.starterCode || '',
              hints: variant.hints || '',
            })),
            testCases: (data.testCases || []).map((testCase) => ({
              input: testCase.input || '',
              expectedOutput: testCase.expectedOutput || '',
            })),
            createdAtMillis: createdAt.millis,
            createdAtLabel: createdAt.label,
          } as StoredProblem
        })
        .sort((a, b) => b.createdAtMillis - a.createdAtMillis)

      setUploadedProblems(nextProblems)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to fetch uploaded problems.')
    } finally {
      setLoadingProblems(false)
    }
  }

  useEffect(() => {
    if (!isAdmin) {
      setLoadingProblems(false)
      return
    }

    loadProblems()
  }, [authUser.uid, isAdmin])

  if (!isAdmin) {
    return (
      <div className="problem-upload-shell">
        <section className="problem-upload-card">
          <div className="problem-upload-header">
            <h2>Admin Access Required</h2>
            <p>Only admin accounts can upload and manage problems.</p>
          </div>
        </section>
      </div>
    )
  }

  const courseOptions = useMemo(
    () =>
      Array.from(new Set(uploadedProblems.map((problem) => problem.course)))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [uploadedProblems],
  )

  const setOptions = useMemo(
    () =>
      Array.from(new Set(uploadedProblems.map((problem) => problem.setName)))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [uploadedProblems],
  )

  const filteredProblems = useMemo(
    () =>
      uploadedProblems.filter((problem) => {
        const courseMatches = courseFilter === 'all' || problem.course === courseFilter
        const languageMatches =
          languageFilter === 'all' || problem.languageVariants.some((variant) => variant.language === languageFilter)

        return courseMatches && languageMatches
      }),
    [uploadedProblems, courseFilter, languageFilter],
  )

  const updateVariant = (id: string, patch: Partial<LanguageVariant>) => {
    setVariants((prev) => prev.map((variant) => (variant.id === id ? { ...variant, ...patch } : variant)))
  }

  const updateTestCase = (id: string, patch: Partial<TestCaseItem>) => {
    setTestCases((prev) => prev.map((testCase) => (testCase.id === id ? { ...testCase, ...patch } : testCase)))
  }

  const addTestCase = () => {
    setTestCases((prev) => [...prev, createTestCase()])
  }

  const removeTestCase = (id: string) => {
    setTestCases((prev) => {
      if (prev.length <= 1) {
        return prev
      }
      return prev.filter((testCase) => testCase.id !== id)
    })
  }

  const resetForm = () => {
    setTitle('')
    setStatement('')
    setSampleInput('')
    setSampleOutput('')
    setTags('')
    setDifficulty('beginner')
    setVariants(createVariantsForAllLanguages())
    setTestCases([createTestCase()])
  }

  const submitProblem = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatusMessage('')
    setErrorMessage('')

    const trimmedTitle = title.trim()
    const trimmedCourse = course.trim()
    const trimmedSetName = setName.trim()
    const trimmedStatement = statement.trim()
    const trimmedSampleInput = sampleInput.trim()
    const trimmedSampleOutput = sampleOutput.trim()

    if (!trimmedTitle || !trimmedCourse || !trimmedSetName || !trimmedStatement) {
      setErrorMessage('Title, course, set, and statement are required.')
      return
    }

    const cleanedVariants = variants
      .map((variant) => ({
        language: variant.language,
        starterCode: variant.starterCode.trim(),
        hints: variant.hints.trim(),
      }))

    const hasMissingStarterCode = cleanedVariants.some((variant) => !variant.starterCode)
    if (hasMissingStarterCode) {
      setErrorMessage('Starter code is required for every language.')
      return
    }

    const cleanedTestCases = testCases
      .map((testCase) => ({
        input: testCase.input.trim(),
        expectedOutput: testCase.expectedOutput.trim(),
      }))
      .filter((testCase) => Boolean(testCase.input) && Boolean(testCase.expectedOutput))

    if (cleanedTestCases.length === 0) {
      setErrorMessage('Add at least one test case with both input and expected output.')
      return
    }

    setSubmitting(true)

    try {
      await addDoc(collection(db, 'problemUploads'), {
        ownerId: authUser.uid,
        title: trimmedTitle,
        course: trimmedCourse,
        setName: trimmedSetName,
        statement: trimmedStatement,
        sampleInput: trimmedSampleInput,
        sampleOutput: trimmedSampleOutput,
        difficulty,
        tags: tags
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        languageVariants: cleanedVariants,
        allowedLanguages: LANGUAGE_OPTIONS,
        testCases: cleanedTestCases,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      setStatusMessage('Problem uploaded successfully.')
      resetForm()
      await loadProblems()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to upload problem.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="problem-upload-shell">
      <section className="problem-upload-card">
        <div className="problem-upload-header">
          <h2>Problem Uploader</h2>
          <p>Create one problem, organize it by course and set, and attach starter templates for different languages.</p>
        </div>

        <form className="problem-upload-form" onSubmit={submitProblem}>
          <div className="problem-upload-grid">
            <label>
              <span>Problem title</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Two Sum"
                maxLength={120}
                required
              />
            </label>

            <label>
              <span>Course</span>
              <input
                value={course}
                onChange={(event) => setCourse(event.target.value)}
                list="course-options"
                placeholder="DSA Bootcamp"
                maxLength={80}
                required
              />
              <datalist id="course-options">
                {courseOptions.map((courseName) => (
                  <option key={courseName} value={courseName} />
                ))}
              </datalist>
            </label>

            <label>
              <span>Set</span>
              <input
                value={setName}
                onChange={(event) => setSetName(event.target.value)}
                list="set-options"
                placeholder="Arrays - Set A"
                maxLength={80}
                required
              />
              <datalist id="set-options">
                {setOptions.map((setOption) => (
                  <option key={setOption} value={setOption} />
                ))}
              </datalist>
            </label>

            <label>
              <span>Difficulty</span>
              <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as 'beginner' | 'intermediate' | 'advanced')}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </label>
          </div>

          <label className="wide-field">
            <span>Problem statement</span>
            <textarea
              value={statement}
              onChange={(event) => setStatement(event.target.value)}
              placeholder="Describe constraints, expected input/output, and examples."
              rows={6}
              required
            />
          </label>

          <div className="io-fields-grid">
            <label>
              <span>Sample input</span>
              <textarea
                value={sampleInput}
                onChange={(event) => setSampleInput(event.target.value)}
                placeholder="Example input shown to learners"
                rows={5}
              />
            </label>

            <label>
              <span>Sample output</span>
              <textarea
                value={sampleOutput}
                onChange={(event) => setSampleOutput(event.target.value)}
                placeholder="Expected output for sample"
                rows={5}
              />
            </label>
          </div>

          <label className="wide-field">
            <span>Tags</span>
            <input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="array, hashmap, two-pointers"
            />
          </label>

          <div className="variants-section">
            <div className="variants-header">
              <h3>Starter code templates (all languages)</h3>
            </div>

            {variants.map((variant) => (
              <article key={variant.id} className="variant-card">
                <div className="variant-card-header">
                  <strong className="variant-language-title">{variant.language}</strong>
                </div>

                <textarea
                  value={variant.starterCode}
                  onChange={(event) => updateVariant(variant.id, { starterCode: event.target.value })}
                  placeholder={`Starter code for ${variant.language}`}
                  rows={7}
                />

                <textarea
                  value={variant.hints}
                  onChange={(event) => updateVariant(variant.id, { hints: event.target.value })}
                  placeholder="Optional hints for this language"
                  rows={3}
                />
              </article>
            ))}
          </div>

          <div className="variants-section">
            <div className="variants-header">
              <h3>Test cases</h3>
              <button type="button" className="btn btn-secondary" onClick={addTestCase}>
                Add test case
              </button>
            </div>

            {testCases.map((testCase, index) => (
              <article key={testCase.id} className="variant-card">
                <div className="variant-card-header">
                  <strong>Case {index + 1}</strong>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => removeTestCase(testCase.id)}
                    disabled={testCases.length <= 1}
                  >
                    Remove
                  </button>
                </div>

                <label>
                  <span>Input</span>
                  <textarea
                    value={testCase.input}
                    onChange={(event) => updateTestCase(testCase.id, { input: event.target.value })}
                    placeholder="Input for this test case"
                    rows={4}
                  />
                </label>

                <label>
                  <span>Expected output</span>
                  <textarea
                    value={testCase.expectedOutput}
                    onChange={(event) => updateTestCase(testCase.id, { expectedOutput: event.target.value })}
                    placeholder="Expected output for this test case"
                    rows={4}
                  />
                </label>
              </article>
            ))}
          </div>

          {statusMessage && <p className="problem-status success">{statusMessage}</p>}
          {errorMessage && <p className="problem-status error">{errorMessage}</p>}

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Uploading...' : 'Upload problem'}
          </button>
        </form>
      </section>

      <section className="problem-library-card">
        <div className="problem-library-header">
          <h2>Uploaded problems</h2>
          <div className="problem-library-filters">
            <select value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)}>
              <option value="all">All courses</option>
              {courseOptions.map((courseName) => (
                <option key={courseName} value={courseName}>
                  {courseName}
                </option>
              ))}
            </select>

            <select value={languageFilter} onChange={(event) => setLanguageFilter(event.target.value)}>
              <option value="all">All languages</option>
              {LANGUAGE_OPTIONS.map((language) => (
                <option key={language} value={language}>
                  {language}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loadingProblems ? (
          <p className="problem-library-state">Loading uploaded problems...</p>
        ) : filteredProblems.length === 0 ? (
          <p className="problem-library-state">No problems found for this filter yet.</p>
        ) : (
          <div className="problem-list">
            {filteredProblems.map((problem) => (
              <article key={problem.id} className="problem-item">
                <header>
                  <h3>{problem.title}</h3>
                  <p>
                    {problem.course} / {problem.setName}
                  </p>
                </header>

                <p className="problem-meta">
                  Difficulty: {problem.difficulty} | Languages: {problem.languageVariants.map((variant) => variant.language).join(', ')}
                </p>
                <p className="problem-meta">Test cases: {problem.testCases.length} | Sample: {problem.sampleInput && problem.sampleOutput ? 'Yes' : 'No'}</p>
                <p className="problem-meta">Created: {problem.createdAtLabel}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default ProblemUploadPage
