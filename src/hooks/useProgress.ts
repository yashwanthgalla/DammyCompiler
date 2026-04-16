import { useState, useEffect } from 'react'
import { getUserProgress } from '../firebase/firestoreHelpers'

export const useProgress = (uid: string | null) => {
  const [progress, setProgressData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!uid) return

    const fetchProgress = async () => {
      try {
        setLoading(true)
        const data = await getUserProgress(uid)
        setProgressData(data)
        setError(null)
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to fetch progress'
        setError(errorMsg)
        setProgressData({})
      } finally {
        setLoading(false)
      }
    }

    fetchProgress()
  }, [uid])

  return { progress, loading, error }
}
