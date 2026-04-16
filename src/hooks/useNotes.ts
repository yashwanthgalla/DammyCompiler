import { useState, useEffect, useRef } from 'react'
import { saveNote, getNote } from '../firebase/firestoreHelpers'

export const useNotes = (uid: string | null, problemId: string | null) => {
  const [note, setNoteContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const debounceTimerRef = useRef<number | null>(null)

  // Load note on mount
  useEffect(() => {
    if (!uid || !problemId) return

    const loadNote = async () => {
      try {
        setLoading(true)
        const content = await getNote(uid, problemId)
        setNoteContent(content)
      } catch (err) {
        console.error('Failed to load note:', err)
      } finally {
        setLoading(false)
      }
    }

    loadNote()
  }, [uid, problemId])

  // Debounced autosave
  const updateNote = (newContent: string) => {
    setNoteContent(newContent)

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Set new timer for autosave (800ms)
    debounceTimerRef.current = setTimeout(async () => {
      if (!uid || !problemId) return
      try {
        setIsSaving(true)
        await saveNote(uid, problemId, newContent)
      } catch (err) {
        console.error('Failed to save note:', err)
      } finally {
        setIsSaving(false)
      }
    }, 800)
  }

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  return { note, updateNote, loading, isSaving }
}
