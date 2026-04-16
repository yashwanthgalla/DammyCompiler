import { useState, useEffect } from 'react'
import { getUser } from '../firebase/firestoreHelpers'

interface UserStats {
  solved: number
  streak: number
  contestRank: number | null
}

export const useUserStats = (uid: string | null) => {
  const [stats, setStats] = useState<UserStats>({
    solved: 0,
    streak: 0,
    contestRank: null
  })
  const [loginDays, setLoginDays] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!uid) {
      setLoading(false)
      return
    }

    const fetchStats = async () => {
      try {
        setLoading(true)
        const userData = await getUser(uid)
        if (userData?.stats) {
          setStats(userData.stats)
        }
        if (userData?.loginDays) {
          setLoginDays(userData.loginDays)
        }
        setError(null)
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to fetch stats'
        setError(errorMsg)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [uid])

  return { stats, loginDays, loading, error }
}
