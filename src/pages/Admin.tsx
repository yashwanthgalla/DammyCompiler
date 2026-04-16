import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X as XIcon, Plus as PlusIcon } from 'lucide-react'
import { createProblem, createCourse, getStats } from '../firebase/firestoreHelpers'
import { PlatformShell } from '../components/PlatformShell'

interface StatsData {
  totalUsers: number
  totalProblems: number
  submissionsToday: number
}

interface FormErrorsType {
  [key: string]: string
}

export const Admin = () => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('problems')
  const [stats, setStats] = useState<StatsData | null>(null)
  const isAdmin = true // Will check from auth

  // Problem form state
  const [problemForm, setProblemForm] = useState({
    title: '',
    slug: '',
    difficulty: 'Medium',
    statement: '',
    sampleInput: '',
    sampleOutput: '',
    tags: [],
    companyTags: [],
    testCases: [{ input: '', output: '' }],
  })

  // Course form state
  const [courseForm, setCourseForm] = useState({
    title: '',
    description: '',
    difficulty: 'Medium',
    companyTags: [],
    modules: [{ id: '1', title: '', problems: [] }],
  })

  const [formErrors, setFormErrors] = useState<FormErrorsType>({})
  const [submitting, setSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  // Load stats
  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await getStats()
        setStats(data)
      } catch (err) {
        console.error('Failed to load stats:', err)
      }
    }

    loadStats()

    // Redirect if not admin (will integrate with auth)
    if (!isAdmin) {
      navigate('/')
    }
  }, [isAdmin, navigate])

  // Problem form handlers
  const slugify = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  const handleProblemTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value
    setProblemForm((prev) => ({
      ...prev,
      title,
      slug: slugify(title),
    }))
  }

  const handleProblemSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormErrors({})
    setSuccessMessage('')

    // Validation
    const errors: FormErrorsType = {}
    if (!problemForm.title) errors.title = 'Title is required'
    if (!problemForm.slug) errors.slug = 'Slug must be auto-generated'
    if (!problemForm.statement) errors.statement = 'Problem statement is required'
    if (!problemForm.sampleInput) errors.sampleInput = 'Sample input is required'
    if (!problemForm.sampleOutput) errors.sampleOutput = 'Sample output is required'

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    try {
      setSubmitting(true)
      const problemId = await createProblem({
        title: problemForm.title,
        slug: problemForm.slug,
        difficulty: problemForm.difficulty,
        statement: problemForm.statement,
        sampleInput: problemForm.sampleInput,
        sampleOutput: problemForm.sampleOutput,
        tags: problemForm.tags,
        companyTags: problemForm.companyTags,
        testCases: problemForm.testCases.filter((tc) => tc.input && tc.output),
        editorial: '',
      })

      setSuccessMessage(`Problem "${problemForm.title}" created successfully!`)
      void problemId // Mark as intentionally unused
      setProblemForm({
        title: '',
        slug: '',
        difficulty: 'Medium',
        statement: '',
        sampleInput: '',
        sampleOutput: '',
        tags: [],
        companyTags: [],
        testCases: [{ input: '', output: '' }],
      })

      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err) {
      console.error('Failed to create problem:', err)
      setFormErrors({ submit: 'Failed to create problem. Try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleCourseSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormErrors({})
    setSuccessMessage('')

    const errors: FormErrorsType = {}
    if (!courseForm.title) errors.title = 'Title is required'
    if (!courseForm.description) errors.description = 'Description is required'

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    try {
      setSubmitting(true)
      const courseId = await createCourse({
        title: courseForm.title,
        description: courseForm.description,
        difficulty: courseForm.difficulty,
        companyTags: courseForm.companyTags,
        modules: courseForm.modules.filter((m) => m.title),
      })

      setSuccessMessage(`Course "${courseForm.title}" created successfully!`)
      void courseId // Mark as intentionally unused
      setCourseForm({
        title: '',
        description: '',
        difficulty: 'Medium',
        companyTags: [],
        modules: [{ id: '1', title: '', problems: [] }],
      })

      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err) {
      console.error('Failed to create course:', err)
      setFormErrors({ submit: 'Failed to create course. Try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PlatformShell showAdmin>
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-2">Admin Panel</h1>
          <p className="text-gray-400">Manage problems, courses, and view platform stats</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto p-6">
        {/* Stats Dashboard */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gray-800 border border-gray-700 rounded-md p-6">
              <div className="text-gray-500 text-sm">Total Users</div>
              <div className="text-3xl font-bold text-white">{stats.totalUsers}</div>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-md p-6">
              <div className="text-gray-500 text-sm">Total Problems</div>
              <div className="text-3xl font-bold text-cyan-400">{stats.totalProblems}</div>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-md p-6">
              <div className="text-gray-500 text-sm">Submissions Today</div>
              <div className="text-3xl font-bold text-green-400">{stats.submissionsToday}</div>
            </div>
          </div>
        )}

        {/* Success/Error Messages */}
        {successMessage && (
          <div className="bg-green-900 border border-green-600 text-green-300 p-4 rounded-md mb-6">
            {successMessage}
          </div>
        )}
        {formErrors.submit && (
          <div className="bg-red-900 border border-red-600 text-red-300 p-4 rounded-md mb-6">
            {formErrors.submit}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-4 border-b border-gray-700 mb-6">
          {['problems', 'courses'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-medium capitalize ${
                activeTab === tab
                  ? 'text-cyan-400 border-b-2 border-cyan-500'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Problem Uploader */}
        {activeTab === 'problems' && (
          <div className="bg-gray-800 border border-gray-700 rounded-md p-8">
            <h2 className="text-xl font-semibold text-white mb-6">Upload New Problem</h2>

            <form onSubmit={handleProblemSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Title *</label>
                  <input
                    type="text"
                    value={problemForm.title}
                    onChange={handleProblemTitleChange}
                    className={`w-full bg-gray-700 border ${formErrors.title ? 'border-red-600' : 'border-gray-600'} rounded-md px-4 py-2 text-white focus:outline-none focus:border-cyan-500`}
                    placeholder="e.g., Two Sum"
                  />
                  {formErrors.title && <p className="text-red-400 text-xs mt-1">{formErrors.title}</p>}
                </div>

                {/* Slug */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Slug (Auto-generated)</label>
                  <input
                    type="text"
                    value={problemForm.slug}
                    readOnly
                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-4 py-2 text-gray-500 focus:outline-none"
                  />
                </div>

                {/* Difficulty */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Difficulty</label>
                  <select
                    value={problemForm.difficulty}
                    onChange={(e) => setProblemForm((prev) => ({ ...prev, difficulty: e.target.value }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-4 py-2 text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option>Easy</option>
                    <option>Medium</option>
                    <option>Hard</option>
                  </select>
                </div>
              </div>

              {/* Problem Statement */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Problem Statement (Markdown) *</label>
                <textarea
                  value={problemForm.statement}
                  onChange={(e) => setProblemForm((prev) => ({ ...prev, statement: e.target.value }))}
                  className={`w-full bg-gray-700 border ${formErrors.statement ? 'border-red-600' : 'border-gray-600'} rounded-md px-4 py-2 text-white focus:outline-none focus:border-cyan-500 resize-none h-32`}
                  placeholder="Enter problem description..."
                />
                {formErrors.statement && <p className="text-red-400 text-xs mt-1">{formErrors.statement}</p>}
              </div>

              {/* Sample Input/Output */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Sample Input *</label>
                  <textarea
                    value={problemForm.sampleInput}
                    onChange={(e) => setProblemForm((prev) => ({ ...prev, sampleInput: e.target.value }))}
                    className={`w-full bg-gray-700 border ${formErrors.sampleInput ? 'border-red-600' : 'border-gray-600'} rounded-md px-4 py-2 text-white focus:outline-none focus:border-cyan-500 resize-none h-24`}
                  />
                  {formErrors.sampleInput && <p className="text-red-400 text-xs mt-1">{formErrors.sampleInput}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Sample Output *</label>
                  <textarea
                    value={problemForm.sampleOutput}
                    onChange={(e) => setProblemForm((prev) => ({ ...prev, sampleOutput: e.target.value }))}
                    className={`w-full bg-gray-700 border ${formErrors.sampleOutput ? 'border-red-600' : 'border-gray-600'} rounded-md px-4 py-2 text-white focus:outline-none focus:border-cyan-500 resize-none h-24`}
                  />
                  {formErrors.sampleOutput && <p className="text-red-400 text-xs mt-1">{formErrors.sampleOutput}</p>}
                </div>
              </div>

              {/* Test Cases */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-sm font-medium text-gray-300">Test Cases</label>
                  <button
                    type="button"
                    onClick={() =>
                      setProblemForm((prev) => ({
                        ...prev,
                        testCases: [...prev.testCases, { input: '', output: '' }],
                      }))
                    }
                    className="text-cyan-400 hover:text-cyan-300 text-sm flex items-center gap-1"
                  >
                    <PlusIcon size={16} /> Add Test Case
                  </button>
                </div>

                <div className="space-y-3">
                  {problemForm.testCases.map((tc, idx) => (
                    <div key={idx} className="flex gap-3">
                      <input
                        type="text"
                        value={tc.input}
                        onChange={(e) => {
                          const newCases = [...problemForm.testCases]
                          newCases[idx].input = e.target.value
                          setProblemForm((prev) => ({ ...prev, testCases: newCases }))
                        }}
                        placeholder="Input"
                        className="flex-1 bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
                      />
                      <input
                        type="text"
                        value={tc.output}
                        onChange={(e) => {
                          const newCases = [...problemForm.testCases]
                          newCases[idx].output = e.target.value
                          setProblemForm((prev) => ({ ...prev, testCases: newCases }))
                        }}
                        placeholder="Output"
                        className="flex-1 bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
                      />
                      {problemForm.testCases.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setProblemForm((prev) => ({
                              ...prev,
                              testCases: prev.testCases.filter((_, i) => i !== idx),
                            }))
                          }
                          className="text-red-400 hover:text-red-300"
                        >
                          <XIcon size={18} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-600 disabled:opacity-50 text-black px-6 py-3 rounded-md font-semibold transition"
              >
                {submitting ? 'Creating Problem...' : 'Create Problem'}
              </button>
            </form>
          </div>
        )}

        {/* Course Builder */}
        {activeTab === 'courses' && (
          <div className="bg-gray-800 border border-gray-700 rounded-md p-8">
            <h2 className="text-xl font-semibold text-white mb-6">Create New Course</h2>

            <form onSubmit={handleCourseSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Course Title *</label>
                <input
                  type="text"
                  value={courseForm.title}
                  onChange={(e) => setCourseForm((prev) => ({ ...prev, title: e.target.value }))}
                  className={`w-full bg-gray-700 border ${formErrors.title ? 'border-red-600' : 'border-gray-600'} rounded-md px-4 py-2 text-white focus:outline-none focus:border-cyan-500`}
                  placeholder="e.g., DSA Masterclass"
                />
                {formErrors.title && <p className="text-red-400 text-xs mt-1">{formErrors.title}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Description *</label>
                <textarea
                  value={courseForm.description}
                  onChange={(e) => setCourseForm((prev) => ({ ...prev, description: e.target.value }))}
                  className={`w-full bg-gray-700 border ${formErrors.description ? 'border-red-600' : 'border-gray-600'} rounded-md px-4 py-2 text-white focus:outline-none focus:border-cyan-500 resize-none h-24`}
                  placeholder="Course description..."
                />
                {formErrors.description && <p className="text-red-400 text-xs mt-1">{formErrors.description}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Difficulty</label>
                <select
                  value={courseForm.difficulty}
                  onChange={(e) => setCourseForm((prev) => ({ ...prev, difficulty: e.target.value }))}
                  className="w-full bg-gray-700 border border-gray-600 rounded-md px-4 py-2 text-white focus:outline-none focus:border-cyan-500"
                >
                  <option>Easy</option>
                  <option>Medium</option>
                  <option>Hard</option>
                </select>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-600 disabled:opacity-50 text-black px-6 py-3 rounded-md font-semibold transition"
              >
                {submitting ? 'Creating Course...' : 'Create Course'}
              </button>
            </form>
          </div>
        )}
      </div>
    </PlatformShell>
  )
}
