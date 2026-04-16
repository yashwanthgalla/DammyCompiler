import { useEffect, useMemo, useState } from 'react'
import type { User } from 'firebase/auth'
import {
  Timestamp,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  type Transaction,
} from 'firebase/firestore'
import { db } from '../firebase'
import { getUser, upgradeToPremium } from '../firebase/firestoreHelpers'
import './ProfilePage.css'

interface ProfilePageProps {
  authUser: User
}

interface UserProfileDoc {
  displayName?: string
  username?: string
  status?: string
  about?: string
  email?: string
  createdAt?: Timestamp
  usernameLastChangedAt?: Timestamp
}

const USERNAME_REGEX = /^[a-z0-9_]{4,20}$/
const USERNAME_COOLDOWN_DAYS = 14
const USERNAME_COOLDOWN_MS = USERNAME_COOLDOWN_DAYS * 24 * 60 * 60 * 1000

const toDate = (value?: Timestamp) => {
  if (!value) {
    return null
  }

  const parsed = value.toDate()
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const formatDate = (value?: Date | null) => {
  if (!value) {
    return 'Now available'
  }

  return value.toLocaleDateString()
}

function ProfilePage({ authUser }: ProfilePageProps) {
  const [activeSection, setActiveSection] = useState<'profile' | 'account'>('profile')
  const [profileLoading, setProfileLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [status, setStatus] = useState('')
  const [about, setAbout] = useState('')

  const [currentUsername, setCurrentUsername] = useState('')
  const [usernameLastChangedAt, setUsernameLastChangedAt] = useState<Date | null>(null)

  // Premium state
  const [isPremium, setIsPremium] = useState(false)
  const [premiumLoading, setPremiumLoading] = useState(false)

  const profileRef = useMemo(() => doc(db, 'profiles', authUser.uid), [authUser.uid])

  const loadProfile = async () => {
    setProfileLoading(true)
    setError('')

    try {
      const snapshot = await getDoc(profileRef)

      if (!snapshot.exists()) {
        const fallbackName = authUser.displayName || authUser.email?.split('@')[0] || 'Compiler User'
        setDisplayName(fallbackName)
        setUsername('')
        setCurrentUsername('')
        setStatus('')
        setAbout('')
        setUsernameLastChangedAt(null)
        return
      }

      const data = snapshot.data() as UserProfileDoc
      setDisplayName(data.displayName || authUser.displayName || authUser.email?.split('@')[0] || 'Compiler User')
      setUsername(data.username || '')
      setCurrentUsername(data.username || '')
      setStatus(data.status || '')
      setAbout(data.about || '')
      setUsernameLastChangedAt(toDate(data.usernameLastChangedAt))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your profile.')
    } finally {
      setProfileLoading(false)
    }
  }

  useEffect(() => {
    loadProfile()
  }, [profileRef])

  useEffect(() => {
    const loadPremiumStatus = async () => {
      const user = await getUser(authUser.uid)
      setIsPremium(user?.isPremium ?? false)
    }
    loadPremiumStatus()
  }, [authUser.uid])

  const nextUsernameChangeAt = useMemo(() => {
    if (!usernameLastChangedAt) {
      return null
    }

    return new Date(usernameLastChangedAt.getTime() + USERNAME_COOLDOWN_MS)
  }, [usernameLastChangedAt])

  const canChangeUsername = useMemo(() => {
    if (!nextUsernameChangeAt) {
      return true
    }

    return Date.now() >= nextUsernameChangeAt.getTime()
  }, [nextUsernameChangeAt])

  const usernameHint = canChangeUsername
    ? 'User ID available now'
    : `Available change on ${formatDate(nextUsernameChangeAt)}`

  const validateProfile = (nextDisplayName: string, nextUsername: string, nextStatus: string, nextAbout: string) => {
    if (!nextDisplayName) {
      return 'Profile name is required.'
    }

    if (nextDisplayName.length > 50) {
      return 'Profile name should be 50 characters or less.'
    }

    if (!USERNAME_REGEX.test(nextUsername)) {
      return 'User ID must be 4-20 characters with lowercase letters, numbers, or underscore.'
    }

    if (nextStatus.length > 60) {
      return 'Status should be 60 characters or less.'
    }

    if (nextAbout.length > 500) {
      return 'About me should be 500 characters or less.'
    }

    return ''
  }

  const updateWithTransaction = async (
    tx: Transaction,
    nextDisplayName: string,
    nextUsername: string,
    nextStatus: string,
    nextAbout: string,
  ) => {
    const profileSnap = await tx.get(profileRef)
    const existing = (profileSnap.data() || {}) as UserProfileDoc
    const previousUsername = existing.username || ''
    const usernameChanged = nextUsername !== previousUsername

    if (usernameChanged && existing.usernameLastChangedAt) {
      const earliestChangeTime = existing.usernameLastChangedAt.toDate().getTime() + USERNAME_COOLDOWN_MS
      if (Date.now() < earliestChangeTime) {
        throw new Error(`You can change your User ID after ${new Date(earliestChangeTime).toLocaleDateString()}.`)
      }
    }

    if (usernameChanged) {
      const usernameRef = doc(db, 'reservedUsernames', nextUsername)
      const usernameSnap = await tx.get(usernameRef)
      const usernameOwner = usernameSnap.exists() ? (usernameSnap.data().ownerId as string) : ''

      if (usernameSnap.exists() && usernameOwner !== authUser.uid) {
        throw new Error('This User ID is already taken and cannot be used.')
      }

      if (!usernameSnap.exists()) {
        tx.set(usernameRef, {
          ownerId: authUser.uid,
          createdAt: serverTimestamp(),
        })
      }
    }

    tx.set(
      profileRef,
      {
        displayName: nextDisplayName,
        username: nextUsername,
        status: nextStatus,
        about: nextAbout,
        email: authUser.email || '',
        updatedAt: serverTimestamp(),
        createdAt: profileSnap.exists() ? existing.createdAt || serverTimestamp() : serverTimestamp(),
        ...(usernameChanged ? { usernameLastChangedAt: serverTimestamp() } : {}),
      },
      { merge: true },
    )
  }

  const handleSaveProfile = async () => {
    setSaving(true)
    setError('')
    setSuccess('')

    const nextDisplayName = displayName.trim()
    const nextUsername = username.trim().toLowerCase()
    const nextStatus = status.trim()
    const nextAbout = about.trim()

    const validationError = validateProfile(nextDisplayName, nextUsername, nextStatus, nextAbout)
    if (validationError) {
      setError(validationError)
      setSaving(false)
      return
    }

    if (nextUsername !== currentUsername && !canChangeUsername) {
      setError(`You can change your User ID after ${formatDate(nextUsernameChangeAt)}.`)
      setSaving(false)
      return
    }

    try {
      await runTransaction(db, (tx) =>
        updateWithTransaction(tx, nextDisplayName, nextUsername, nextStatus, nextAbout),
      )

      setSuccess('Profile saved successfully.')
      await loadProfile()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile.')
    } finally {
      setSaving(false)
    }
  }

  const handleUpgradeAccount = async () => {
    setPremiumLoading(true)
    try {
      await upgradeToPremium(authUser.uid)
      setIsPremium(true)
      setSuccess('✨ Account upgraded to Premium! AI features are now available.')
    } catch (err) {
      setError('Failed to upgrade account. Please try again.')
    } finally {
      setPremiumLoading(false)
    }
  }

  if (profileLoading) {
    return (
      <section className="profile-page" aria-label="User settings page">
        <div className="settings-shell">
          <p className="settings-hint" style={{ textAlign: 'center' }}>Loading your profile...</p>
        </div>
      </section>
    )
  }

  // Get initials for avatar (GNY format: first letters of display name + email)
  const getInitials = () => {
    const displayNameInitial = displayName ? displayName.charAt(0).toUpperCase() : ''
    const emailParts = (authUser.email || '').split('@')[0].split('.')
    const emailInitials = emailParts.slice(0, 2).map(p => p.charAt(0).toUpperCase()).join('')
    return (displayNameInitial + emailInitials).slice(0, 3)
  }

  return (
    <section className="profile-page" aria-label="User settings page">
      <div className="settings-shell">
        {/* Tabs */}
        <div className="settings-tabs">
          <button
            className={`settings-tab-button ${activeSection === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveSection('profile')}
          >
            Profile
          </button>
          <button
            className={`settings-tab-button ${activeSection === 'account' ? 'active' : ''}`}
            onClick={() => setActiveSection('account')}
          >
            Account
          </button>
        </div>

        {/* Profile Section */}
        {activeSection === 'profile' && (
          <div className="settings-profile-content">
            {/* Avatar Section */}
            <div className="settings-avatar-section">
              <div className="settings-avatar-wrapper">{getInitials()}</div>
              <div className="settings-avatar-info">
                <h3>{displayName}</h3>
                <p>@{username || 'username'}</p>
              </div>
            </div>

            {/* Form Card */}
            <div className="settings-form-card">
              {/* Profile Name & User ID - Side by side */}
              <div className="settings-form-row">
                <div className="settings-field">
                  <label className="settings-label" htmlFor="profile-name">
                    Profile Name
                  </label>
                  <input
                    id="profile-name"
                    className="settings-input"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={50}
                    placeholder="Your full name"
                  />
                </div>

                <div className="settings-field">
                  <label className="settings-label">User ID</label>
                  <div className="settings-userid-container">
                    <span className="settings-userid-prefix">@</span>
                    <div className="settings-userid-badge">
                      <span className="settings-userid-dot"></span>
                      <span className="settings-userid-text">{username || 'username'}</span>
                    </div>
                  </div>
                  <p className="settings-hint">{usernameHint}</p>
                </div>
              </div>

              {/* Status Dropdown */}
              <div className="settings-field">
                <label className="settings-label" htmlFor="profile-status">
                  Status
                </label>
                <select
                  id="profile-status"
                  className="settings-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">Select status...</option>
                  <option value="On duty">On duty</option>
                  <option value="Away">Away</option>
                  <option value="Offline">Offline</option>
                  <option value="In a meeting">In a meeting</option>
                  <option value="Do not disturb">Do not disturb</option>
                </select>
              </div>

              {/* About Me - Full width */}
              <div className="settings-about-section">
                <label className="settings-label" htmlFor="profile-about">
                  About Me
                </label>
                <textarea
                  id="profile-about"
                  className="settings-textarea"
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  maxLength={500}
                  placeholder="Tell people about yourself"
                />
                <p className="settings-about-counter">{about.length} / 500</p>
              </div>

              {/* Messages */}
              {error && <div className="settings-message settings-error">{error}</div>}
              {success && <div className="settings-message settings-success">{success}</div>}

              {/* Footer with Save Button */}
              <div className="settings-form-footer">
                <button
                  className="settings-btn settings-btn-primary"
                  onClick={handleSaveProfile}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Account Section */}
        {activeSection === 'account' && (
          <div className="settings-account-content">
            {/* Account Type Card */}
            <div className="settings-account-card">
              <div className="account-header">
                <h3>Subscription Plan</h3>
                <span className={`account-badge ${isPremium ? 'account-badge-premium' : 'account-badge-free'}`}>
                  {isPremium ? '⭐ PREMIUM' : 'FREE'}
                </span>
              </div>
              <p className="account-description">
                {isPremium
                  ? '🎉 You have access to AI-powered code analysis and all premium features!'
                  : 'You are currently on the Free plan. Upgrade to Premium to unlock AI features and advanced tools.'}
              </p>
            </div>

            {/* Premium Features Card */}
            {!isPremium && (
              <div className="settings-account-card">
                <h3 style={{ margin: '0 0 1rem', fontSize: '16px', fontWeight: '600' }}>
                  Premium Features
                </h3>
                <ul className="premium-features-list">
                  <li>✨ AI Error Analysis with code examples</li>
                  <li>💡 Intelligent code suggestions</li>
                  <li>📚 Learning resource recommendations</li>
                  <li>🚀 Advanced debugging tools</li>
                </ul>
                <button
                  className="premium-upgrade-btn"
                  onClick={handleUpgradeAccount}
                  disabled={premiumLoading}
                >
                  {premiumLoading ? 'Upgrading...' : 'Upgrade to Premium'}
                </button>
              </div>
            )}

            {/* Upcoming Features Card */}
            <div className="settings-account-card">
              <div className="account-upcoming">
                <h4>Coming Soon</h4>
                <ul className="upcoming-list">
                  <li>Language skill tests and coding assessments</li>
                  <li>Structured courses with milestones</li>
                  <li>Premium learning materials and practice packs</li>
                </ul>
                <p className="upcoming-note">These features are being developed. Check back soon!</p>
              </div>
            </div>

            {/* Messages */}
            {error && <div className="settings-message settings-error">{error}</div>}
            {success && <div className="settings-message settings-success">{success}</div>}
          </div>
        )}
      </div>
    </section>
  )
}

export default ProfilePage
