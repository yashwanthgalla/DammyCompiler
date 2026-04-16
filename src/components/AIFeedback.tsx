import { useState } from 'react'
import { ChevronDown, Lightbulb, BookOpen, Zap, Copy, Check } from 'lucide-react'
import './AIFeedback.css'

interface Suggestion {
  text: string
  code?: string
  language?: string
}

interface AIFeedbackProps {
  explanation: string
  suggestions: (Suggestion | string)[]
  resources?: string[]
  isLoading?: boolean
  error?: string
}

export const AIFeedback: React.FC<AIFeedbackProps> = ({
  explanation,
  suggestions,
  resources,
  isLoading,
  error,
}) => {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    explanation: true,
    suggestions: true,
    resources: false,
  })
  const [copiedCode, setCopiedCode] = useState<number | null>(null)

  const copySuggestionCode = (code: string, idx: number) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(idx)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const normalizeSuggestions = (sugs: (Suggestion | string)[]): Suggestion[] => {
    return sugs.map(s => 
      typeof s === 'string' 
        ? { text: s }
        : s
    )
  }

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  if (isLoading) {
    return (
      <div className="ai-feedback ai-feedback--loading">
        <div className="ai-feedback__spinner"></div>
        <p>Analyzing your error...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="ai-feedback ai-feedback--error">
        <Zap size={20} />
        <p>Could not analyze error: {error}</p>
      </div>
    )
  }

  return (
    <div className="ai-feedback">
      {/* Explanation Section */}
      <div className="ai-feedback__section">
        <button
          className="ai-feedback__header"
          onClick={() => toggleSection('explanation')}
        >
          <Lightbulb size={18} className="ai-feedback__icon" />
          <span>What Happened</span>
          <ChevronDown
            size={16}
            className={`ai-feedback__chevron ${
              expandedSections.explanation ? 'ai-feedback__chevron--open' : ''
            }`}
          />
        </button>
        {expandedSections.explanation && (
          <div className="ai-feedback__content">
            <p className="ai-feedback__explanation">{explanation}</p>
          </div>
        )}
      </div>

      {/* Suggestions Section */}
      <div className="ai-feedback__section">
        <button
          className="ai-feedback__header"
          onClick={() => toggleSection('suggestions')}
        >
          <Zap size={18} className="ai-feedback__icon" />
          <span>How to Fix It</span>
          <ChevronDown
            size={16}
            className={`ai-feedback__chevron ${
              expandedSections.suggestions ? 'ai-feedback__chevron--open' : ''
            }`}
          />
        </button>
        {expandedSections.suggestions && (
          <div className="ai-feedback__content">
            <ul className="ai-feedback__suggestions">
              {normalizeSuggestions(suggestions).map((suggestion, idx) => (
                <li key={idx} className="ai-feedback__suggestion-item">
                  <span className="ai-feedback__suggestion-number">{idx + 1}</span>
                  <div className="ai-feedback__suggestion-body">
                    <span>{suggestion.text}</span>
                    {suggestion.code && (
                      <div className="ai-feedback__code-block">
                        <div className="ai-feedback__code-header">
                          <span className="ai-feedback__code-lang">
                            {suggestion.language || 'code'}
                          </span>
                          <button
                            className="ai-feedback__copy-btn"
                            onClick={() => copySuggestionCode(suggestion.code!, idx)}
                            title="Copy code"
                          >
                            {copiedCode === idx ? (
                              <Check size={14} />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>
                        </div>
                        <pre className="ai-feedback__code-pre">
                          <code>{suggestion.code}</code>
                        </pre>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Resources Section */}
      {resources && resources.length > 0 && (
        <div className="ai-feedback__section">
          <button
            className="ai-feedback__header"
            onClick={() => toggleSection('resources')}
          >
            <BookOpen size={18} className="ai-feedback__icon" />
            <span>Learn More</span>
            <ChevronDown
              size={16}
              className={`ai-feedback__chevron ${
                expandedSections.resources ? 'ai-feedback__chevron--open' : ''
              }`}
            />
          </button>
          {expandedSections.resources && (
            <div className="ai-feedback__content">
              <ul className="ai-feedback__resources">
                {resources.map((resource, idx) => (
                  <li key={idx} className="ai-feedback__resource-item">
                    {resource}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
