import { useEffect, useRef, useState } from 'react'
import type { User } from 'firebase/auth'
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import {
  type ActionCodeSettings,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  GithubAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import Editor from '@monaco-editor/react'
import { ArrowLeft, Copy as CopyIcon, Download, Pencil as PencilIcon, Plus as PlusIcon, Save, X as XIcon } from 'lucide-react'
import { auth, db } from './firebase'
import ProfilePage from './pages/ProfilePage'
import ProblemUploadPage from './pages/ProblemUploadPage'
import TermsAndConditions from './pages/TermsAndConditions'
import { Problems } from './pages/Problems'
import { ProblemSolver } from './pages/ProblemSolver'
import { Courses } from './pages/Courses'
import { CourseDetail } from './pages/CourseDetail'
import { Contests } from './pages/Contests'
import { ContestDetail } from './pages/ContestDetail'
import { CompanyPrep } from './pages/CompanyPrep'
import { Admin } from './pages/Admin'
import { Dashboard } from './pages/Dashboard'
import { EmptyDemo } from './components/EmptyDemo'
import { recordLogin } from './firebase/firestoreHelpers'
import appLogo from './assets/app-logo.png'
import './App.css'

interface FileModel {
  name: string
  language: string
  value: string
}

interface SubmissionResult {
  stdout?: string
  stderr?: string
  compile_output?: string
  status?: {
    id: number
    description: string
  }
  message?: string
}

const LANGUAGE_IDS: Record<string, number> = {
  typescript: 84,
  javascript: 63,
  python: 71,
  java: 26,
  'c#': 51,
  'c++': 10,
  c: 4,
  html: 31,
  css: 29,
  json: 35,
}

const LANGUAGE_NAMES: Record<string, string> = {
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  python: 'Python',
  java: 'Java',
  'c#': 'C#',
  'c++': 'C++',
  c: 'C',
  html: 'HTML',
  css: 'CSS',
  json: 'JSON',
}

const DEFAULT_SNIPPETS: Record<string, string> = {
  typescript: `function greet(name: string): string {
  return \`Hello, \${name}!\`
}

console.log(greet('TypeScript'))
`,
  javascript: `function greet(name) {
  return 'Hello, ' + name + '!'
}

console.log(greet('JavaScript'))
`,
  python: `def greet(name: str) -> str:
    return f"Hello, {name}!"

print(greet("Python"))
`,
  java: `public class Main {
  public static void main(String[] args) {
    System.out.println("Hello, Java!");
  }
}
`,
  'c#': `using System;

public class Program
{
  public static void Main(string[] args)
  {
    Console.WriteLine("Hello, C#!");
  }
}
`,
  'c++': `#include <iostream>

int main() {
  std::cout << "Hello, C++!" << std::endl;
  return 0;
}
`,
  c: `#include <stdio.h>

int main() {
  printf("Hello, C!\\n");
  return 0;
}
`,
  html: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Document</title>
  </head>
  <body>
    <h1>Hello, HTML!</h1>
  </body>
</html>
`,
  css: `:root {
  color-scheme: dark;
}

body {
  margin: 0;
  font-family: sans-serif;
  background: #000;
  color: #fff;
}
`,
  json: `{
  "message": "Hello, JSON!"
}
`,
}

const FILE_EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  c: 'c',
  cpp: 'c++',
  cc: 'c++',
  cs: 'c#',
  java: 'java',
  py: 'python',
  js: 'javascript',
  ts: 'typescript',
  html: 'html',
  css: 'css',
  json: 'json',
}

const toWorkspaceId = (uid: string, workspaceName: string) => {
  const normalized = workspaceName.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-')
  const safeName = normalized.replace(/^-+|-+$/g, '') || 'untitled'
  return `${uid}__${safeName}`
}

const FILES: Record<string, FileModel> = {}

const COMPILER_API_BASE_URL = (import.meta.env.VITE_COMPILER_API_BASE_URL || '').trim().replace(/\/$/, '')
const COMPILER_COMPILE_ENDPOINT = COMPILER_API_BASE_URL
  ? `${COMPILER_API_BASE_URL}/api/compile`
  : '/api/compile'
const COMPILER_REQUEST_TIMEOUT_MS = 20000

const encodeBase64Utf8 = (value: string) => {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

const decodeBase64Utf8 = (value: string) => {
  const binary = atob(value)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

const ADMIN_EMAIL_ALLOWLIST = new Set(
  (import.meta.env.VITE_ADMIN_EMAIL || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
)

const googleAuthProvider = new GoogleAuthProvider()
const githubAuthProvider = new GithubAuthProvider()
const appleAuthProvider = new OAuthProvider('apple.com')

const mapAuthErrorMessage = (err: unknown) => {
  if (!(err instanceof Error)) {
    return 'Authentication failed.'
  }

  const known: Record<string, string> = {
    'auth/invalid-email': 'Invalid email format.',
    'auth/email-already-in-use': 'This email is already registered. Try signing in instead.',
    'auth/operation-not-allowed': 'Email/password auth is disabled in Firebase Console.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/user-not-found': 'No account found for this email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/too-many-requests': 'Too many attempts. Try again in a few minutes.',
    'auth/network-request-failed': 'Network error. Check your connection and try again.',
  }

  const codeMatch = err.message.match(/auth\/[a-z-]+/)
  if (codeMatch && known[codeMatch[0]]) {
    return known[codeMatch[0]]
  }

  return err.message
}

function App() {
  const navigate = useNavigate()
  const location = useLocation()

  const [files, setFiles] = useState<Record<string, FileModel>>(FILES)
  const [activeFile, setActiveFile] = useState('')
  const [selectedLanguage, setSelectedLanguage] = useState('javascript')

  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const [authUser, setAuthUser] = useState<User | null>(null)
  const [isEmailVerified, setIsEmailVerified] = useState(false)
  const [authReady, setAuthReady] = useState(false)
  const [isSignUpMode, setIsSignUpMode] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [verificationMessage, setVerificationMessage] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [workspaceName, setWorkspaceName] = useState('my-workspace')
  const [availableWorkspaces, setAvailableWorkspaces] = useState<string[]>([])
  const [saveLoading, setSaveLoading] = useState(false)
  const [storageError, setStorageError] = useState('')
  const [isNameDialogOpen, setIsNameDialogOpen] = useState(false)
  const [nameDialogMode, setNameDialogMode] = useState<'new' | 'rename'>('new')
  const [draftFileName, setDraftFileName] = useState('')
  const [nameDialogError, setNameDialogError] = useState('')
  const [isWorkspaceDialogOpen, setIsWorkspaceDialogOpen] = useState(false)
  const [workspaceDialogInput, setWorkspaceDialogInput] = useState('')
  const [workspaceDialogError, setWorkspaceDialogError] = useState('')
  const [hasStartedProject, setHasStartedProject] = useState(false)
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 })
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const editorRef = useRef<any>(null)

  const currentFile = activeFile ? files[activeFile] : undefined
  const isConfiguredAdminUser = Boolean(
    authUser?.email && ADMIN_EMAIL_ALLOWLIST.has(authUser.email.trim().toLowerCase()),
  )

  const inferLanguageFromFileName = (fileName: string, fallbackLanguage = 'javascript') => {
    const ext = fileName.split('.').pop()?.toLowerCase() || ''
    return FILE_EXTENSION_LANGUAGE_MAP[ext] || fallbackLanguage
  }

  const verificationActionSettings: ActionCodeSettings = {
    url: window.location.origin,
    handleCodeInApp: false,
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user)
      setIsEmailVerified(Boolean(user?.emailVerified))
      setAuthReady(true)
      setAuthError('')

      // Record login for streak tracking
      if (user?.emailVerified && user.uid) {
        recordLogin(user.uid).catch(() => {})
      }
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    let active = true

    if (!authUser) {
      setIsAdmin(false)
      return
    }

    const loadAdminClaim = async () => {
      try {
        const tokenResult = await authUser.getIdTokenResult(true)
        if (!active) {
          return
        }
        setIsAdmin(tokenResult.claims.admin === true || isConfiguredAdminUser)
      } catch {
        if (!active) {
          return
        }
        setIsAdmin(isConfiguredAdminUser)
      }
    }

    loadAdminClaim()

    return () => {
      active = false
    }
  }, [authUser, isConfiguredAdminUser])

  useEffect(() => {
    if (!authUser || !isAdmin) {
      return
    }

    if (!isEmailVerified && !isConfiguredAdminUser) {
      return
    }

    if (location.pathname !== '/editor') {
      return
    }

    navigate('/problems/upload', { replace: true })
  }, [authUser, isAdmin, isEmailVerified, isConfiguredAdminUser, location.pathname, navigate])

  useEffect(() => {
    if (!authUser || isEmailVerified) {
      return
    }

    let active = true

    const refreshVerificationState = async () => {
      try {
        await authUser.reload()
        const verified = Boolean(auth.currentUser?.emailVerified)
        if (!active) {
          return
        }

        setIsEmailVerified(verified)
        if (verified) {
          setVerificationMessage('Email verified. Redirecting you to the workspace...')
        }
      } catch {
        // Ignore transient network errors while polling verification state.
      }
    }

    refreshVerificationState()
    const interval = window.setInterval(refreshVerificationState, 4000)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [authUser, isEmailVerified])

  const fetchUserWorkspaces = async (uid: string) => {
    const snapshot = await getDocs(query(collection(db, 'workspaces'), where('ownerId', '==', uid)))
    const names = snapshot.docs
      .map((workspaceDoc) => {
        const data = workspaceDoc.data() as { name?: string }
        return data.name?.trim() || ''
      })
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))

    setAvailableWorkspaces(names)
  }

  useEffect(() => {
    if (!authUser) {
      setAvailableWorkspaces([])
      return
    }

    fetchUserWorkspaces(authUser.uid).catch(() => {
      setStorageError('Unable to fetch saved workspaces right now.')
    })
  }, [authUser])

  const handleEditorChange = (value: string | undefined) => {
    if (value === undefined || !activeFile) {
      return
    }

    setFiles((prev) => ({
      ...prev,
      [activeFile]: {
        ...prev[activeFile],
        value,
        language: selectedLanguage,
      },
    }))
  }

  const saveWorkspace = async () => {
    if (!authUser) {
      setStorageError('Please sign in to save files.')
      return
    }

    const trimmedName = workspaceName.trim()
    if (!trimmedName) {
      setStorageError('Please enter a workspace name before saving.')
      return
    }

    setSaveLoading(true)
    setStorageError('')

    try {
      const workspaceDocId = toWorkspaceId(authUser.uid, trimmedName)
      await setDoc(doc(db, 'workspaces', workspaceDocId), {
        ownerId: authUser.uid,
        name: trimmedName,
        activeFile,
        selectedLanguage,
        files,
        updatedAt: serverTimestamp(),
      })
      await fetchUserWorkspaces(authUser.uid)
    } catch (err) {
      setStorageError(err instanceof Error ? err.message : 'Failed to save workspace.')
    } finally {
      setSaveLoading(false)
    }
  }

  const loadWorkspace = async () => {
    if (!authUser) {
      setStorageError('Please sign in to load files.')
      return
    }

    const trimmedName = workspaceName.trim()
    if (!trimmedName) {
      setStorageError('Please enter a workspace name before loading.')
      return
    }

    setSaveLoading(true)
    setStorageError('')

    try {
      const workspaceDocId = toWorkspaceId(authUser.uid, trimmedName)
      const snapshot = await getDoc(doc(db, 'workspaces', workspaceDocId))

      if (!snapshot.exists()) {
        setStorageError(`No workspace found with the name "${trimmedName}".`)
        return
      }

      const data = snapshot.data() as {
        ownerId?: string
        files?: Record<string, FileModel>
        activeFile?: string
        selectedLanguage?: string
      }

      if (data.ownerId !== authUser.uid) {
        setStorageError('You are not allowed to load this workspace.')
        return
      }

      if (!data.files || Object.keys(data.files).length === 0) {
        setStorageError('Saved workspace is empty or invalid.')
        return
      }

      const nextActiveFile =
        data.activeFile && data.files[data.activeFile] ? data.activeFile : Object.keys(data.files)[0]
      const nextLanguage =
        data.selectedLanguage || data.files[nextActiveFile]?.language || selectedLanguage

      setFiles(data.files)
      setActiveFile(nextActiveFile)
      setSelectedLanguage(nextLanguage)
      setHasStartedProject(true)
    } catch (err) {
      setStorageError(err instanceof Error ? err.message : 'Failed to load workspace.')
    } finally {
      setSaveLoading(false)
    }
  }

  const handleAuthSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setAuthLoading(true)
    setAuthError('')
    setVerificationMessage('')

    try {
      if (isSignUpMode) {
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password)
        await sendEmailVerification(credential.user, verificationActionSettings)
        setVerificationMessage('Verification email sent. Please verify your inbox before using the compiler.')
      } else {
        const credential = await signInWithEmailAndPassword(auth, email.trim(), password)
        if (!credential.user.emailVerified) {
          try {
            await sendEmailVerification(credential.user, verificationActionSettings)
            setVerificationMessage('Your email is not verified yet. A fresh verification email has been sent.')
          } catch {
            setVerificationMessage('Your email is not verified yet. Check your inbox and spam folder.')
          }
        }
      }
      setPassword('')
    } catch (err) {
      setAuthError(mapAuthErrorMessage(err))
    } finally {
      setAuthLoading(false)
    }
  }

  const handleSignOut = async () => {
    setAuthLoading(true)
    setAuthError('')
    setVerificationMessage('')
    setAvailableWorkspaces([])

    try {
      await signOut(auth)
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Sign out failed')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleGoogleAuth = async () => {
    setAuthLoading(true)
    setAuthError('')
    setVerificationMessage('')

    try {
      await signInWithPopup(auth, googleAuthProvider)
      setPassword('')
    } catch (err) {
      setAuthError(mapAuthErrorMessage(err))
    } finally {
      setAuthLoading(false)
    }
  }

  const handleGithubAuth = async () => {
    setAuthLoading(true)
    setAuthError('')
    setVerificationMessage('')

    try {
      await signInWithPopup(auth, githubAuthProvider)
      setPassword('')
    } catch (err) {
      setAuthError(mapAuthErrorMessage(err))
    } finally {
      setAuthLoading(false)
    }
  }

  const handleAppleAuth = async () => {
    setAuthLoading(true)
    setAuthError('')
    setVerificationMessage('')

    try {
      await signInWithPopup(auth, appleAuthProvider)
      setPassword('')
    } catch (err) {
      setAuthError(mapAuthErrorMessage(err))
    } finally {
      setAuthLoading(false)
    }
  }

  const compileCode = async () => {
    if (!authUser) {
      setError('Please sign in before compiling code.')
      return
    }

    if (!currentFile) {
      setError('Create or load a file before compiling.')
      return
    }

    setLoading(true)
    setOutput('')
    setError('')

    try {
      const languageId = LANGUAGE_IDS[selectedLanguage]
      if (!languageId) {
        setError(`Language "${selectedLanguage}" is not supported for compilation`)
        setLoading(false)
        return
      }

      const abortController = new AbortController()
      const timeout = window.setTimeout(() => abortController.abort(), COMPILER_REQUEST_TIMEOUT_MS)

      const submissionResponse = await fetch(COMPILER_COMPILE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          language_id: languageId,
          source_code: encodeBase64Utf8(currentFile.value),
          stdin: encodeBase64Utf8(input),
        }),
        signal: abortController.signal,
      })
      window.clearTimeout(timeout)

      if (!submissionResponse.ok) {
        let backendMessage = 'Compilation failed on server.'

        try {
          const payload = await submissionResponse.json()
          backendMessage = payload?.details || payload?.error || payload?.message || backendMessage
        } catch {
          const rawText = await submissionResponse.text()
          if (rawText.trim()) {
            backendMessage = rawText
          }
        }

        setError(`Backend Error:\n${backendMessage}`)
        setLoading(false)
        return
      }

      const result: SubmissionResult = await submissionResponse.json()

      if (result.compile_output) {
        setError(`Compilation Error:\n${decodeBase64Utf8(result.compile_output)}`)
      } else if (result.stderr) {
        setError(`Runtime Error:\n${decodeBase64Utf8(result.stderr)}`)
      } else if (result.stdout) {
        setOutput(decodeBase64Utf8(result.stdout))
      } else if (result.message) {
        setError(`Error: ${result.message}`)
      } else {
        setOutput('Executed successfully with no output')
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Backend Error:\nCompilation request timed out. Please try again.')
        return
      }
      setError(
        `Backend Error:\n${err instanceof Error ? err.message : 'Unable to reach compiler backend. Please try again.'}`
      )
    } finally {
      setLoading(false)
    }
  }

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true,
    })
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true,
    })

    const position = editor.getPosition()
    if (position) {
      setCursorPosition({ line: position.lineNumber, column: position.column })
    }

    editor.onDidChangeCursorPosition((event: any) => {
      setCursorPosition({
        line: event.position.lineNumber,
        column: event.position.column,
      })
    })

    editor.focus()
  }

  useEffect(() => {
    if (!storageError) {
      return
    }

    const timeout = window.setTimeout(() => {
      setStorageError('')
    }, 3000)

    return () => window.clearTimeout(timeout)
  }, [storageError])

  const getFileDotColor = (language: string) => {
    const colors: Record<string, string> = {
      javascript: '#f5c518',
      typescript: '#3b82f6',
      python: '#4f9d69',
      java: '#ef6c00',
      'c#': '#7c4dff',
      'c++': '#2563eb',
      c: '#0ea5e9',
      html: '#f97316',
      css: '#0ea5e9',
      json: '#6366f1',
    }

    return colors[language] || '#9ca3af'
  }

  const getLanguageChipClassName = (language: string) => {
    const classMap: Record<string, string> = {
      javascript: 'language-chip language-chip-javascript',
      typescript: 'language-chip language-chip-typescript',
      python: 'language-chip language-chip-python',
      java: 'language-chip language-chip-java',
    }

    return classMap[language] || 'language-chip language-chip-default'
  }

  const copyResultOutput = async () => {
    const textToCopy = error || output
    if (!textToCopy) {
      return
    }

    try {
      await navigator.clipboard.writeText(textToCopy)
    } catch {
      setStorageError('Unable to copy result right now.')
    }
  }

  const openNewFileDialog = () => {
    setNameDialogMode('new')
    setDraftFileName('')
    setNameDialogError('')
    setIsNameDialogOpen(true)
  }

  const openRenameDialog = () => {
    if (!currentFile) {
      return
    }

    setNameDialogMode('rename')
    setDraftFileName(currentFile.name)
    setNameDialogError('')
    setIsNameDialogOpen(true)
  }

  const closeNameDialog = () => {
    setIsNameDialogOpen(false)
    setDraftFileName('')
    setNameDialogError('')
  }

  const openWorkspaceDialog = () => {
    if (availableWorkspaces.length === 0) {
      setStorageError('No saved workspaces found. Create a project first!')
      return
    }

    setWorkspaceDialogInput(workspaceName)
    setWorkspaceDialogError('')
    setIsWorkspaceDialogOpen(true)
  }

  const closeWorkspaceDialog = () => {
    setIsWorkspaceDialogOpen(false)
    setWorkspaceDialogInput('')
    setWorkspaceDialogError('')
  }

  const submitWorkspaceDialog = () => {
    const selectedWorkspace = workspaceDialogInput.trim()

    if (!selectedWorkspace) {
      setWorkspaceDialogError('Please enter or select a workspace.')
      return
    }

    if (!availableWorkspaces.includes(selectedWorkspace)) {
      setWorkspaceDialogError('Workspace not found in your saved list.')
      return
    }

    setWorkspaceName(selectedWorkspace)
    closeWorkspaceDialog()
    setTimeout(() => {
      loadWorkspace()
    }, 0)
  }

  const submitNameDialog = () => {
    const fileName = draftFileName.trim()
    if (!fileName) {
      setNameDialogError('File name is required.')
      return
    }

    if (nameDialogMode === 'new') {
      if (files[fileName]) {
        setNameDialogError('A file with that name already exists.')
        return
      }

      const language = inferLanguageFromFileName(fileName, selectedLanguage)

      setFiles((prev) => ({
        ...prev,
        [fileName]: {
          name: fileName,
          language,
          value: DEFAULT_SNIPPETS[language] || '',
        },
      }))

      setActiveFile(fileName)
      setSelectedLanguage(language)
      setHasStartedProject(true)
      closeNameDialog()
      return
    }

    if (!activeFile || !currentFile) {
      setNameDialogError('Select a file before renaming.')
      return
    }

    if (fileName !== activeFile && files[fileName]) {
      setNameDialogError('A file with that name already exists.')
      return
    }

    const renamedLanguage = inferLanguageFromFileName(fileName, currentFile.language)

    setFiles((prev) => {
      const existing = prev[activeFile]
      if (!existing) {
        return prev
      }

      const nextFiles = { ...prev }
      delete nextFiles[activeFile]
      nextFiles[fileName] = {
        ...existing,
        name: fileName,
        language: renamedLanguage,
      }

      return nextFiles
    })

    setActiveFile(fileName)
    setSelectedLanguage(renamedLanguage)
    closeNameDialog()
  }

  const deleteFile = (fileName: string) => {
    if (Object.keys(files).length <= 1) {
      alert('Cannot delete the last file')
      return
    }

    const newFiles = { ...files }
    delete newFiles[fileName]
    setFiles(newFiles)
    const nextFileName = Object.keys(newFiles)[0] || ''
    setActiveFile(nextFileName)
    setSelectedLanguage(nextFileName ? newFiles[nextFileName].language : 'javascript')
  }

  const clearOutput = () => {
    setOutput('')
    setError('')
    setInput('')
  }

  const resendVerificationEmail = async () => {
    if (!authUser) {
      return
    }

    setAuthLoading(true)
    setAuthError('')

    try {
      await sendEmailVerification(authUser, verificationActionSettings)
      setVerificationMessage('Verification email sent again. Please check your inbox.')
    } catch (err) {
      setAuthError(mapAuthErrorMessage(err))
    } finally {
      setAuthLoading(false)
    }
  }

  const checkVerificationNow = async () => {
    if (!authUser) {
      return
    }

    setAuthLoading(true)
    setAuthError('')

    try {
      await authUser.reload()
      const verified = Boolean(auth.currentUser?.emailVerified)
      setIsEmailVerified(verified)

      if (verified) {
        setVerificationMessage('Email verified. Welcome to your workspace.')
      } else {
        setVerificationMessage('Still waiting for verification. Please click the link in your email.')
      }
    } catch (err) {
      setAuthError(mapAuthErrorMessage(err))
    } finally {
      setAuthLoading(false)
    }
  }

  if (!authReady) {
    return (
      <div className="auth-shell">
        <div className="auth-card auth-card-static">
          <img src={appLogo} alt="Online Compiler logo" className="brand-logo auth-brand-logo" />
          <h1>Dammy Compiler</h1>
          <p>Checking authentication state...</p>
        </div>
      </div>
    )
  }

  if (!authUser) {
    return (
      <div className="auth-shell">
        <form className="auth-card" onSubmit={handleAuthSubmit}>
          <img src={appLogo} alt="Online Compiler logo" className="brand-logo auth-brand-logo" />
          <h1>Dammy Compiler</h1>
          <p className="auth-subtitle">Minimal workspace with real-time authentication</p>

          <label className="auth-label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
            className="auth-input"
          />

          <label className="auth-label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="minimum 6 characters"
            required
            minLength={6}
            autoComplete={isSignUpMode ? 'new-password' : 'current-password'}
            className="auth-input"
          />

          {authError && <div className="auth-error">{authError}</div>}
          {verificationMessage && <div className="auth-info">{verificationMessage}</div>}

          <button type="submit" className="btn btn-primary auth-button" disabled={authLoading}>
            {authLoading
              ? 'Please wait...'
              : isSignUpMode
                ? 'Create account'
                : 'Sign in'}
          </button>

          <div className="auth-divider" role="separator" aria-label="or">
            <span>or</span>
          </div>

          <button type="button" className="btn btn-secondary auth-google-button" onClick={handleGoogleAuth} disabled={authLoading}>
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false" className="google-logo">
              <path
                fill="#EA4335"
                d="M9 7.17v3.65h5.08c-.22 1.17-.88 2.16-1.88 2.82l3.04 2.36C17 14.3 18 11.93 18 9c0-.61-.05-1.2-.16-1.77H9z"
              />
              <path
                fill="#34A853"
                d="M9 18c2.43 0 4.47-.8 5.96-2.18l-3.04-2.36c-.84.56-1.91.9-2.92.9-2.25 0-4.15-1.52-4.83-3.56H1.03v2.43A9 9 0 0 0 9 18z"
              />
              <path
                fill="#FBBC05"
                d="M4.17 10.8A5.4 5.4 0 0 1 3.9 9c0-.62.1-1.22.27-1.8V4.77H1.03A9 9 0 0 0 0 9c0 1.44.35 2.8 1.03 4.03l3.14-2.43z"
              />
              <path
                fill="#4285F4"
                d="M9 3.58c1.32 0 2.5.45 3.43 1.33l2.57-2.57C13.46.9 11.42 0 9 0A9 9 0 0 0 1.03 4.77L4.17 7.2C4.85 5.1 6.75 3.58 9 3.58z"
              />
            </svg>
            <span>{isSignUpMode ? 'Sign up with Google' : 'Sign in with Google'}</span>
          </button>

          <button type="button" className="btn btn-secondary auth-github-button" onClick={handleGithubAuth} disabled={authLoading}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="github-logo">
              <path
                fill="currentColor"
                d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.04c-3.34.73-4.04-1.41-4.04-1.41-.55-1.38-1.34-1.75-1.34-1.75-1.09-.74.08-.72.08-.72 1.2.09 1.83 1.23 1.83 1.23 1.08 1.84 2.82 1.31 3.5 1 .11-.77.42-1.31.77-1.61-2.67-.31-5.48-1.34-5.48-5.97 0-1.32.47-2.4 1.23-3.24-.12-.3-.54-1.52.12-3.16 0 0 1.01-.32 3.3 1.24a11.45 11.45 0 0 1 6 0c2.29-1.56 3.3-1.24 3.3-1.24.66 1.64.24 2.86.12 3.16.77.84 1.23 1.92 1.23 3.24 0 4.64-2.82 5.65-5.5 5.96.43.37.82 1.1.82 2.23v3.31c0 .32.21.69.83.58A12 12 0 0 0 12 .5Z"
              />
            </svg>
            <span>{isSignUpMode ? 'Continue with GitHub' : 'Continue with GitHub'}</span>
          </button>

          <button type="button" className="btn btn-secondary auth-apple-button" onClick={handleAppleAuth} disabled={authLoading}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="apple-logo">
              <path
                fill="currentColor"
                d="M16.37 1.43c0 1.14-.42 2.18-1.1 2.95-.83.94-2.18 1.66-3.35 1.56-.15-1.12.41-2.29 1.08-3.04.74-.84 2.02-1.48 3.37-1.47.03 0 .06 0 .1 0zM20.88 17.42c-.58 1.33-.86 1.92-1.6 3.03-1.03 1.53-2.49 3.44-4.31 3.45-1.61.01-2.02-1.03-4.21-1.02-2.19.01-2.64 1.04-4.25 1.03-1.82-.01-3.2-1.73-4.23-3.26-2.89-4.3-3.19-9.35-1.41-12.09 1.27-1.96 3.28-3.1 5.16-3.1 1.91 0 3.11 1.04 4.68 1.04 1.52 0 2.45-1.04 4.67-1.04 1.67 0 3.44.91 4.71 2.48-4.13 2.27-3.46 8.16.79 9.48z"
              />
            </svg>
            <span>{isSignUpMode ? 'Continue with Apple' : 'Continue with Apple'}</span>
          </button>

          <button
            type="button"
            className="auth-toggle"
            onClick={() => {
              setIsSignUpMode((prev) => !prev)
              setAuthError('')
            }}
            disabled={authLoading}
          >
            {isSignUpMode ? 'Already have an account? Sign in' : 'Need an account? Create one'}
          </button>

          <div className="auth-footer">
            <p className="terms-notice">
              By signing in, you agree to our{' '}
              <Link to="/terms" className="terms-link">
                Terms and Conditions
              </Link>
            </p>
          </div>
        </form>
      </div>
    )
  }

  if (!isEmailVerified && !isConfiguredAdminUser) {
    return (
      <div className="auth-shell">
        <div className="auth-card verify-card">
          <img src={appLogo} alt="Online Compiler logo" className="brand-logo auth-brand-logo" />
          <div className="verify-badge">Email Verification</div>
          <h1>Confirm your account to continue</h1>
          <p className="auth-subtitle">
            We sent a verification link to <strong>{authUser.email}</strong>.
          </p>
          <p className="verify-subtitle">Open the link, confirm your email, then return here and continue.</p>

          <div className="verify-steps">
            <p>1. Open your inbox and spam/promotions folders.</p>
            <p>2. Click the verification link from Firebase.</p>
            <p>3. Press Continue below to refresh your status.</p>
          </div>

          {authError && <div className="auth-error">{authError}</div>}
          {verificationMessage && <div className="auth-info">{verificationMessage}</div>}

          <div className="verify-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={checkVerificationNow}
              disabled={authLoading}
            >
              {authLoading ? 'Checking...' : 'Continue'}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={resendVerificationEmail}
              disabled={authLoading}
            >
              Resend verification email
            </button>

            <button type="button" className="btn btn-secondary" onClick={handleSignOut} disabled={authLoading}>
              Sign out
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="brand">
          <img src={appLogo} alt="Dammy Compiler" className="brand-logo" />
          <Link to="/" className="brand-title">Dammy Compiler</Link>
        </div>

        <div className="header-controls">
          <Link to="/" className="header-link-btn">
            Dashboard
          </Link>
          <Link to="/editor" className="header-link-btn">
            Editor
          </Link>



          <button className="header-link-btn" onClick={handleSignOut} disabled={authLoading}>
            Sign out
          </button>
        </div>
      </header>

      <Routes>
        <Route
          path="/editor"
          element={
            <>
              <div className="storage-strip">
                <button
                  className="btn btn-ghost btn-with-icon"
                  onClick={() => navigate('/')}
                  title="Back to dashboard"
                >
                  <ArrowLeft size={14} aria-hidden="true" />
                  <span>Back to Dashboard</span>
                </button>
                <button className="btn btn-secondary btn-with-icon" onClick={loadWorkspace} disabled={saveLoading}>
                  <Download size={14} aria-hidden="true" />
                  <span>{saveLoading ? 'Please wait...' : 'Load'}</span>
                </button>
                <button className="btn btn-primary btn-with-icon" onClick={saveWorkspace} disabled={saveLoading}>
                  <Save size={14} aria-hidden="true" />
                  <span>{saveLoading ? 'Please wait...' : 'Save'}</span>
                </button>
              </div>

              <div className="workspace-main-surface">
                {!hasStartedProject ? (
                  <div className="empty-state-container">
                    <EmptyDemo
                      onCreateProject={() => {
                        try {
                          setNameDialogMode('new')
                          setDraftFileName('')
                          setNameDialogError('')
                          setIsNameDialogOpen(true)
                        } catch (err) {
                          console.error('Error opening create dialog:', err)
                        }
                      }}
                      onImportProject={() => {
                        openWorkspaceDialog()
                      }}
                    />
                  </div>
                ) : (
              <div className="main-layout">
                <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
                  <div className="files-header">
                    <h3>Files</h3>
                    <div className="file-header-actions">
                      <button className="btn btn-secondary icon-action-btn" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} title={sidebarCollapsed ? 'Show files' : 'Hide files'} aria-label={sidebarCollapsed ? 'Show files' : 'Hide files'}>
                        {sidebarCollapsed ? '▶' : '◀'}
                      </button>
                      <button className="btn btn-secondary icon-action-btn" onClick={openNewFileDialog} title="New file" aria-label="New file">
                        <PlusIcon size={14} aria-hidden="true" />
                      </button>
                      <button className="btn btn-secondary icon-action-btn" onClick={openRenameDialog} disabled={!currentFile} title="Rename file" aria-label="Rename file">
                        <PencilIcon size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <div className="files-list">
                    {Object.keys(files).map((fileName) => (
                      <button
                        key={fileName}
                        className={`file-item ${fileName === activeFile ? 'active' : ''}`}
                        onClick={() => {
                          setActiveFile(fileName)
                          setSelectedLanguage(files[fileName].language)
                        }}
                      >
                        <span className="file-label">
                          <span className="file-type-dot" style={{ backgroundColor: getFileDotColor(files[fileName].language) }} aria-hidden="true" />
                          <span className="file-name">{fileName}</span>
                        </span>
                        <span
                          className="delete-token"
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteFile(fileName)
                          }}
                          role="button"
                          aria-label={`Delete ${fileName}`}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              deleteFile(fileName)
                            }
                          }}
                        >
                          x
                        </span>
                      </button>
                    ))}
                  </div>
                </aside>

                <section className="editor-area">
                  <div className="editor-header">
                    <div className="editor-meta">
                      <span>{currentFile ? currentFile.name : 'No file selected'}</span>
                      <span className={getLanguageChipClassName(selectedLanguage)}>{LANGUAGE_NAMES[selectedLanguage] || selectedLanguage}</span>
                    </div>

                    <div className="editor-actions">
                      <button className="btn btn-secondary" onClick={clearOutput} disabled={loading}>
                        Clear
                      </button>
                      <button className="btn btn-primary" onClick={compileCode} disabled={loading || !currentFile}>
                        {loading ? 'Running...' : 'Run code'}
                      </button>
                    </div>
                  </div>

                  <div className="editor-wrapper">
                    {currentFile ? (
                      <Editor
                        height="100%"
                        path={currentFile.name}
                        language={selectedLanguage}
                        value={currentFile.value}
                        onChange={handleEditorChange}
                        onMount={handleEditorDidMount}
                        theme="vs"
                        options={{
                          minimap: { enabled: false },
                          fontSize: 14,
                          fontFamily: "'JetBrains Mono', 'Consolas', monospace",
                          lineNumbers: 'on',
                          scrollBeyondLastLine: false,
                          automaticLayout: true,
                          tabSize: 2,
                          insertSpaces: true,
                          wordWrap: 'on',
                          quickSuggestions: false,
                          suggestOnTriggerCharacters: false,
                          acceptSuggestionOnCommitCharacter: false,
                          parameterHints: { enabled: false },
                          occurrencesHighlight: 'off',
                        }}
                      />
                    ) : (
                      <div className="empty-editor-state">No files yet. Click New to create one.</div>
                    )}
                  </div>
                  <div className="editor-status-bar">
                    Ln {cursorPosition.line}, Col {cursorPosition.column}
                  </div>
                </section>

                <section className="output-area">
                  <div className="output-section output-section-input">
                    <div className="section-header">
                      <label htmlFor="stdin" className="section-title">
                        Program input
                      </label>
                    </div>
                    <textarea
                      id="stdin"
                      className="input-area"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Optional stdin"
                      disabled={loading}
                    />
                  </div>

                  <div className="output-section output-section-result">
                    <div className="section-header">
                      <p className="section-title">Result</p>
                      <button
                        className="btn btn-secondary icon-action-btn"
                        onClick={copyResultOutput}
                        title="Copy result"
                        aria-label="Copy result"
                        disabled={!error && !output}
                      >
                        <CopyIcon size={14} aria-hidden="true" />
                      </button>
                    </div>
                    {error ? (
                      <pre className="error-output">{error}</pre>
                    ) : (
                      <pre className="stdout-output">{output || 'Output appears here.'}</pre>
                    )}
                  </div>
                </section>
              </div>
                )}
              </div>

              {isNameDialogOpen && (
                <div className="name-dialog-overlay" onClick={closeNameDialog}>
                  <div
                    className="name-dialog"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="name-dialog-title"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3 id="name-dialog-title">
                      {nameDialogMode === 'new' ? 'Create a new file' : 'Rename current file'}
                    </h3>
                    <p className="name-dialog-note">Use names like app.js, script.py, or Main.java</p>

                    <input
                      autoFocus
                      value={draftFileName}
                      onChange={(e) => {
                        setDraftFileName(e.target.value)
                        if (nameDialogError) {
                          setNameDialogError('')
                        }
                      }}
                      className="name-dialog-input"
                      placeholder="Enter file name"
                      aria-label="File name"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          submitNameDialog()
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault()
                          closeNameDialog()
                        }
                      }}
                    />

                    {nameDialogError && <p className="name-dialog-error">{nameDialogError}</p>}

                    <div className="name-dialog-actions">
                      <button className="btn btn-secondary" onClick={closeNameDialog}>
                        Cancel
                      </button>
                      <button className="btn btn-primary" onClick={submitNameDialog}>
                        {nameDialogMode === 'new' ? 'Create file' : 'Rename file'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {isWorkspaceDialogOpen && (
                <div className="name-dialog-overlay" onClick={closeWorkspaceDialog}>
                  <div
                    className="workspace-dialog"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="workspace-dialog-title"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3 id="workspace-dialog-title">Select a workspace</h3>
                    <p className="name-dialog-note">Choose from saved workspaces or type the exact name.</p>

                    <div className="workspace-dialog-list" role="listbox" aria-label="Saved workspaces">
                      {availableWorkspaces.map((workspace) => (
                        <button
                          key={workspace}
                          type="button"
                          className={`workspace-option ${workspaceDialogInput === workspace ? 'active' : ''}`}
                          onClick={() => {
                            setWorkspaceDialogInput(workspace)
                            if (workspaceDialogError) {
                              setWorkspaceDialogError('')
                            }
                          }}
                        >
                          {workspace}
                        </button>
                      ))}
                    </div>

                    <input
                      autoFocus
                      value={workspaceDialogInput}
                      onChange={(e) => {
                        setWorkspaceDialogInput(e.target.value)
                        if (workspaceDialogError) {
                          setWorkspaceDialogError('')
                        }
                      }}
                      className="name-dialog-input"
                      placeholder="Enter workspace name"
                      aria-label="Workspace name"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          submitWorkspaceDialog()
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault()
                          closeWorkspaceDialog()
                        }
                      }}
                    />

                    {workspaceDialogError && <p className="name-dialog-error">{workspaceDialogError}</p>}

                    <div className="name-dialog-actions">
                      <button className="btn btn-secondary" onClick={closeWorkspaceDialog}>
                        Cancel
                      </button>
                      <button className="btn btn-primary" onClick={submitWorkspaceDialog}>
                        Load workspace
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {storageError && (
                <div className="toast-notification" role="status" aria-live="polite">
                  <span>{storageError}</span>
                  <button
                    type="button"
                    className="toast-close-btn"
                    onClick={() => setStorageError('')}
                    aria-label="Dismiss notification"
                  >
                    <XIcon size={14} aria-hidden="true" />
                  </button>
                </div>
              )}
            </>
          }
        />
        <Route
          path="/problems"
          element={
            <Problems />
          }
        />
        <Route
          path="/problems/:slug"
          element={
            <ProblemSolver />
          }
        />
        <Route
          path="/courses"
          element={
            <Courses />
          }
        />
        <Route
          path="/courses/:id"
          element={
            <CourseDetail />
          }
        />
        <Route
          path="/contests"
          element={
            <Contests />
          }
        />
        <Route
          path="/contests/:id"
          element={
            <ContestDetail />
          }
        />
        <Route
          path="/company-prep"
          element={
            <CompanyPrep />
          }
        />
        <Route
          path="/"
          element={
            <Dashboard isAdmin={isAdmin} />
          }
        />
        <Route
          path="/admin"
          element={
            <Admin />
          }
        />
        <Route
          path="/problems/upload"
          element={
            <ProblemUploadPage authUser={authUser} isAdmin={isAdmin} />
          }
        />
        <Route
          path="/profile"
          element={
            <ProfilePage authUser={authUser} />
          }
        />
        <Route
          path="/terms"
          element={
            <TermsAndConditions />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

export default App
