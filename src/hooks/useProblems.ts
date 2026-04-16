import { useState, useEffect } from 'react'
import problemsData from '../data/problems.json'

export interface Problem {
  id: string
  title: string
  slug: string
  difficulty: string
  source: string
  tags: string[]
  companyTags: string[]
  statement: string
  sampleInput: string
  sampleOutput: string
  testCases: Array<{ input: string; output: string }>
  editorial?: string
  starterCode?: Record<string, string>
}

export const useProblems = () => {
  const [problems, setProblems] = useState<Problem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Load from local JSON — instant, no Firestore needed
    setProblems(problemsData as Problem[])
    setLoading(false)
  }, [])

  return { problems, loading, error: null }
}

export const getProblemBySlug = (slug: string): Problem | null => {
  const found = (problemsData as Problem[]).find(p => p.slug === slug)
  return found || null
}
