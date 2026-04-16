import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  type DocumentData,
} from 'firebase/firestore'
import { db } from '../firebase'

// ============ USERS ============
export const getUser = async (uid: string): Promise<DocumentData | null> => {
  const docSnap = await getDoc(doc(db, 'users', uid))
  return docSnap.exists() ? docSnap.data() : null
}

export const createUser = async (uid: string, email: string, displayName: string = ''): Promise<void> => {
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  
  await setDoc(doc(db, 'users', uid), {
    uid,
    email,
    displayName: displayName || email.split('@')[0],
    role: 'student',
    isPremium: false,
    enrolledCourses: [],
    stats: {
      solved: 0,
      streak: 1,
      contestRank: null,
    },
    loginDays: [todayStr],
    lastLoginDate: todayStr,
    createdAt: new Date(),
  })
}

export const updateUserRole = async (uid: string, role: string) => {
  await updateDoc(doc(db, 'users', uid), { role })
}

export const upgradeToPremium = async (uid: string) => {
  await updateDoc(doc(db, 'users', uid), { isPremium: true })
}

export const downgradeFromPremium = async (uid: string) => {
  await updateDoc(doc(db, 'users', uid), { isPremium: false })
}

// ============ PROBLEMS ============
export const getProblems = async () => {
  const q = query(collection(db, 'problems'), orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
}

export const getProblemBySlug = async (slug: string) => {
  const q = query(collection(db, 'problems'), where('slug', '==', slug))
  const snapshot = await getDocs(q)
  if (snapshot.docs.length === 0) return null
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() }
}

export const getProblemById = async (problemId: string) => {
  const docSnap = await getDoc(doc(db, 'problems', problemId))
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null
}

export const createProblem = async (problemData: any) => {
  const docRef = doc(collection(db, 'problems'))
  await setDoc(docRef, {
    ...problemData,
    createdAt: new Date(),
  })
  return docRef.id
}

export const getProblemsByFilters = async (filters: any) => {
  const constraints = []

  if (filters.difficulty) {
    constraints.push(where('difficulty', '==', filters.difficulty))
  }
  if (filters.tag) {
    constraints.push(where('tags', 'array-contains', filters.tag))
  }
  if (filters.company) {
    constraints.push(where('companyTags', 'array-contains', filters.company))
  }

  let q
  if (constraints.length > 0) {
    q = query(collection(db, 'problems'), ...constraints)
  } else {
    q = query(collection(db, 'problems'))
  }

  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
}

// ============ COURSES ============
export const getCourses = async () => {
  const q = query(collection(db, 'courses'), where('published', '==', true))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
}

export const getCourseById = async (courseId: string) => {
  const docSnap = await getDoc(doc(db, 'courses', courseId))
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null
}

export const createCourse = async (courseData: any) => {
  const docRef = doc(collection(db, 'courses'))
  await setDoc(docRef, {
    ...courseData,
    enrolledCount: 0,
    published: false,
    createdAt: new Date(),
  })
  return docRef.id
}

export const enrollCourse = async (uid: string, courseId: string) => {
  const userRef = doc(db, 'users', uid)
  const userSnap = await getDoc(userRef)
  const enrolledCourses = userSnap.data()?.enrolledCourses || []

  if (!enrolledCourses.includes(courseId)) {
    await updateDoc(userRef, {
      enrolledCourses: [...enrolledCourses, courseId],
    })
  }

  const courseRef = doc(db, 'courses', courseId)
  const courseSnap = await getDoc(courseRef)
  const enrolledCount = courseSnap.data()?.enrolledCount || 0
  await updateDoc(courseRef, { enrolledCount: enrolledCount + 1 })
}

// ============ USER PROGRESS ============
export const getUserProgress = async (uid: string): Promise<Record<string, any>> => {
  const snapshot = await getDocs(collection(db, `userProgress/${uid}/problems`))
  const progress: Record<string, any> = {}
  snapshot.docs.forEach((doc) => {
    progress[doc.id] = doc.data()
  })
  return progress
}

export const updateProgress = async (uid: string, problemId: string, status: string, submissionId: string | null = null, solvedAt: any = null) => {
  const progressRef = doc(db, `userProgress/${uid}/problems/${problemId}`)

  // Check if already solved to avoid double-counting
  const existing = await getDoc(progressRef)
  const alreadySolved = existing.exists() && existing.data()?.status === 'solved'

  const updateData: Record<string, any> = { status }

  if (submissionId) {
    updateData.lastSubmissionId = submissionId
  }
  if (status === 'solved' && solvedAt) {
    updateData.solvedAt = solvedAt
  }

  await setDoc(progressRef, updateData, { merge: true })

  // Update the solved count on the user document when newly solved
  if (status === 'solved' && !alreadySolved) {
    const userRef = doc(db, 'users', uid)
    const userSnap = await getDoc(userRef)
    const currentSolved = userSnap.exists() ? (userSnap.data()?.stats?.solved || 0) : 0
    await updateDoc(userRef, { 'stats.solved': currentSolved + 1 })
  }
}

export const getProgressForProblem = async (uid: string, problemId: string) => {
  const docSnap = await getDoc(doc(db, `userProgress/${uid}/problems/${problemId}`))
  return docSnap.exists() ? docSnap.data() : { status: 'unsolved' }
}

// ============ SUBMISSIONS ============
export const saveSubmission = async (submissionData: any) => {
  const docRef = doc(collection(db, 'submissions'))
  await setDoc(docRef, {
    ...submissionData,
    createdAt: submissionData.createdAt || new Date(),
  })
  return docRef.id
}

export const getSubmissions = async (userId: string, problemId: string | null = null) => {
  let q = query(
    collection(db, 'submissions'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(100)
  )

  if (problemId) {
    q = query(
      collection(db, 'submissions'),
      where('userId', '==', userId),
      where('problemId', '==', problemId),
      orderBy('createdAt', 'desc'),
      limit(100)
    )
  }

  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
}

export const getLatestSubmissions = async (limit_ = 10): Promise<any[]> => {
  const q = query(collection(db, 'submissions'), orderBy('createdAt', 'desc'), limit(limit_))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
}

// Get all submissions for a specific problem (for leaderboard)
export const getSubmissionsByProblem = async (problemId: string, limit_ = 50): Promise<any[]> => {
  const q = query(
    collection(db, 'submissions'),
    where('problemId', '==', problemId),
    orderBy('createdAt', 'desc'),
    limit(limit_)
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
}

// Get a specific submission by ID
export const getSubmissionById = async (submissionId: string): Promise<any> => {
  const docSnap = await getDoc(doc(db, 'submissions', submissionId))
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null
}

// ============ NOTES ============
export const saveNote = async (uid: string, problemId: string, content: string) => {
  const noteRef = doc(db, `notes/${uid}/problems/${problemId}`)
  await setDoc(
    noteRef,
    {
      content,
      updatedAt: new Date(),
    },
    { merge: true }
  )
}

export const getNote = async (uid: string, problemId: string): Promise<string> => {
  const docSnap = await getDoc(doc(db, `notes/${uid}/problems/${problemId}`))
  return docSnap.exists() ? docSnap.data()?.content || '' : ''
}

// ============ CONTESTS ============
export const getContests = async () => {
  const q = query(collection(db, 'contests'), orderBy('startTime', 'desc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
}

export const getContestById = async (contestId: string) => {
  const docSnap = await getDoc(doc(db, 'contests', contestId))
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null
}

export const subscribeToLeaderboard = (contestId: string, callback: (leaderboard: any[]) => void) => {
  const leaderboardRef = doc(db, 'contests', contestId)
  const unsubscribe = onSnapshot(leaderboardRef, (docSnap) => {
    if (docSnap.exists()) {
      const leaderboard = docSnap.data()?.leaderboard || []
      callback(leaderboard)
    }
  })
  return unsubscribe
}

export const updateLeaderboard = async (contestId: string, uid: string, score: number, penalty: number, solvedAt: any) => {
  const contestRef = doc(db, 'contests', contestId)
  const contestSnap = await getDoc(contestRef)
  const leaderboard = contestSnap.data()?.leaderboard || []

  const existingIndex = leaderboard.findIndex((entry: any) => entry.uid === uid)
  if (existingIndex !== -1) {
    leaderboard[existingIndex] = { uid, score, penalty, solvedAt }
  } else {
    leaderboard.push({ uid, score, penalty, solvedAt })
  }

  leaderboard.sort((a: any, b: any) => {
    if (b.score !== a.score) return b.score - a.score
    return a.penalty - b.penalty
  })

  await updateDoc(contestRef, { leaderboard })
}

export const createContest = async (contestData: any) => {
  const docRef = doc(collection(db, 'contests'))
  await setDoc(docRef, {
    ...contestData,
    leaderboard: [],
    createdAt: new Date(),
  })
  return docRef.id
}

// ============ STATS ============
export const getStats = async () => {
  const userSnapshot = await getDocs(collection(db, 'users'))
  const problemSnapshot = await getDocs(collection(db, 'problems'))
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const submissionSnapshot = await getDocs(collection(db, 'submissions'))
  const todaySubmissions = submissionSnapshot.docs.filter((doc) => {
    const createdAt = doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt)
    return createdAt >= todayStart
  })

  return {
    totalUsers: userSnapshot.size,
    totalProblems: problemSnapshot.size,
    submissionsToday: todaySubmissions.length,
  }
}

// ============ USER STATS UPDATE ============
export const updateUserStats = async (uid: string, incrementSolved: boolean = false, updateStreak: boolean = false) => {
  const userRef = doc(db, 'users', uid)
  const userSnap = await getDoc(userRef)

  if (!userSnap.exists()) return

  const currentStats = userSnap.data()?.stats || { solved: 0, streak: 0, contestRank: null }
  const updates: any = {}

  if (incrementSolved) {
    updates['stats.solved'] = (currentStats.solved || 0) + 1
  }

  if (updateStreak) {
    updates['stats.streak'] = (currentStats.streak || 0) + 1
  }

  if (Object.keys(updates).length > 0) {
    await updateDoc(userRef, updates)
  }
}

// ============ LOGIN STREAK TRACKING ============
const toDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const recordLogin = async (uid: string) => {
  const userRef = doc(db, 'users', uid)
  const userSnap = await getDoc(userRef)

  if (!userSnap.exists()) return

  const data = userSnap.data()
  const today = new Date()
  const todayStr = toDateStr(today)

  const loginDays: string[] = data?.loginDays || []
  const lastLoginDate = data?.lastLoginDate || null

  // Already recorded today
  if (lastLoginDate === todayStr) return

  // Calculate streak
  let currentStreak = data?.stats?.streak || 0

  if (lastLoginDate) {
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = toDateStr(yesterday)

    if (lastLoginDate === yesterdayStr) {
      // Consecutive day — increment streak
      currentStreak += 1
    } else {
      // Streak broken — reset to 1
      currentStreak = 1
    }
  } else {
    // First login ever
    currentStreak = 1
  }

  // Keep last 365 login days
  const updatedLoginDays = [...loginDays, todayStr].slice(-365)

  await updateDoc(userRef, {
    lastLoginDate: todayStr,
    loginDays: updatedLoginDays,
    'stats.streak': currentStreak,
  })
}

export const getUserLoginData = async (uid: string) => {
  const userSnap = await getDoc(doc(db, 'users', uid))
  if (!userSnap.exists()) return { loginDays: [], streak: 0, lastLoginDate: null }

  const data = userSnap.data()
  return {
    loginDays: data?.loginDays || [],
    streak: data?.stats?.streak || 0,
    lastLoginDate: data?.lastLoginDate || null,
  }
}
