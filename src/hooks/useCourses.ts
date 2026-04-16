import { useState, useEffect } from 'react'
import { getCourses, getCourseById, enrollCourse } from '../firebase/firestoreHelpers'

interface Course {
  id: string
  title: string
  description: string
  difficulty: string
  modules?: Array<{ title: string }>
  enrolledCount?: number
}

export const useCourses = () => {
  const [courses, setCollectionCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setLoading(true)
        const data = await getCourses()
        setCollectionCourses(data as Course[])
        setError(null)
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to fetch courses'
        setError(errorMsg)
      } finally {
        setLoading(false)
      }
    }

    fetchCourses()
  }, [])

  const enrollUserInCourse = async (uid: string, courseId: string) => {
    try {
      await enrollCourse(uid, courseId)
      return true
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to enroll'
      setError(errorMsg)
      return false
    }
  }

  return { courses, loading, error, enrollUserInCourse }
}

export const useCourseDetail = (courseId: string | undefined | null) => {
  const [course, setCoursesDetail] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!courseId) return

    const fetchCourse = async () => {
      try {
        setLoading(true)
        const data = await getCourseById(courseId)
        setCoursesDetail(data as Course | null)
        setError(null)
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to fetch course'
        setError(errorMsg)
        setCoursesDetail(null)
      } finally {
        setLoading(false)
      }
    }

    fetchCourse()
  }, [courseId])

  return { course, loading, error }
}
