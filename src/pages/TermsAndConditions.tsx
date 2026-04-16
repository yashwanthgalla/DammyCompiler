import { useMemo, useState } from 'react'
import { X, Lock, FileText, Shield, Eye, AlertCircle, CheckCircle } from 'lucide-react'
import './TermsAndConditions.css'

export default function TermsAndConditions() {
  const terms = [
    {
      id: 'ownership',
      icon: FileText,
      title: 'Your Code Ownership',
      content: 'Your code stays yours. We do not claim rights over your projects or intellectual property.'
    },
    {
      id: 'privacy',
      icon: Eye,
      title: 'Privacy & Data',
      content: 'We only collect what is required for authentication and account safety, and never sell personal data.'
    },
    {
      id: 'security',
      icon: Lock,
      title: 'Account Security',
      content: 'Keep your credentials secure and notify us quickly if you suspect unauthorized access.'
    },
    {
      id: 'usage',
      icon: AlertCircle,
      title: 'Acceptable Use',
      content: 'Do not use the platform for illegal activity, malware, abuse, or violating intellectual property rights.'
    },
    {
      id: 'liability',
      icon: Shield,
      title: 'Liability',
      content: 'Online Compiler is provided as-is. Please keep backups of important work and projects.'
    },
    {
      id: 'acceptance',
      icon: CheckCircle,
      title: 'Terms Acceptance',
      content: 'Using Online Compiler means you agree to these terms, including any updates published here.'
    }
  ]

  const tabs = ['Overview', 'Privacy & Data', 'Acceptable Use'] as const
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>('Overview')

  const tabItems = useMemo(() => {
    if (activeTab === 'Privacy & Data') {
      return terms.filter((term) => ['privacy', 'security', 'liability'].includes(term.id))
    }

    if (activeTab === 'Acceptable Use') {
      return terms.filter((term) => ['usage', 'ownership', 'acceptance'].includes(term.id))
    }

    return terms
  }, [activeTab, terms])

  return (
    <div className="terms-page">
      <div className="terms-modal" role="dialog" aria-modal="true" aria-labelledby="terms-title">
        <div className="terms-header">
          <div>
            <h1 id="terms-title">Terms & Conditions</h1>
            <p className="terms-subtitle">Please review these terms before continuing.</p>
          </div>
          <button
            type="button"
            className="close-button"
            aria-label="Close"
            onClick={() => window.history.back()}
          >
            <X size={18} />
          </button>
        </div>

        <div className="terms-tabs" role="tablist" aria-label="Terms tabs">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              className={`tab-button ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="terms-content">
          <div className="terms-main" role="tabpanel">
            <div className="terms-list">
              {tabItems.map((item) => {
                const IconComponent = item.icon

                return (
                  <article key={item.id} className="terms-item">
                    <div className="terms-icon-wrap">
                      <IconComponent size={16} />
                    </div>
                    <div>
                      <h3>{item.title}</h3>
                      <p>{item.content}</p>
                    </div>
                  </article>
                )
              })}
            </div>

            <aside className="terms-side">
              <section className="help-box" aria-label="Need help">
                <h4>Need Help?</h4>
                <p>
                  Contact support if anything is unclear. We are happy to clarify policy details before you proceed.
                </p>
              </section>

              <button type="button" className="accept-button" onClick={() => window.history.back()}>
                Accept & Continue
              </button>
            </aside>
          </div>
        </div>
      </div>
    </div>
  )
}
