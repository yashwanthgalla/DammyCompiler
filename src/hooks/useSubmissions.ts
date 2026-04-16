import { useState, useEffect } from 'react'
import { getSubmissions } from '../firebase/firestoreHelpers'

export const useSubmissions = (userId: string | null, problemId: string | null = null) => {
  const [submissions, setSubmissionsData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return

    const fetchSubmissions = async () => {
      try {
        setLoading(true)
        const data = await getSubmissions(userId, problemId)
        setSubmissionsData(data)
        setError(null)
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to fetch submissions'
        setError(errorMsg)
        setSubmissionsData([])
      } finally {
        setLoading(false)
      }
    }

    fetchSubmissions()
  }, [userId, problemId])

  return { submissions, loading, error }
}
