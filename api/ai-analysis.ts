import type { VercelRequest, VercelResponse } from '@vercel/node'

const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1'
const NVIDIA_API_KEY = (process.env.NVIDIA_API_KEY || '').trim()
const NVIDIA_MODEL = 'openai/gpt-oss-120b'

interface AnalysisRequest {
  code: string
  language: string
  error: string
  errorType: 'compilation' | 'runtime' | 'wrong-output'
  expectedOutput?: string
  actualOutput?: string
}

interface AnalysisResponse {
  explanation: string
  suggestions: string[]
  correctedCode?: string
  resources?: string[]
}

const analyzeErrorWithNvidia = async (request: AnalysisRequest): Promise<AnalysisResponse> => {
  if (!NVIDIA_API_KEY) {
    throw new Error('NVIDIA_API_KEY is not configured')
  }

  const prompt = buildErrorAnalysisPrompt(request)

  const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${NVIDIA_API_KEY}`,
    },
    body: JSON.stringify({
      model: NVIDIA_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are an expert programming tutor. Analyze code errors and provide clear, actionable guidance to help users learn and fix their mistakes. Be concise and focus on the specific error. Return your response as a JSON object with this structure:
{
  "explanation": "Brief explanation of what went wrong",
  "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"],
  "correctedCode": "corrected code snippet (optional)",
  "resources": ["resource/concept to learn"]
}`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('NVIDIA API Error:', errorText)
    throw new Error(`NVIDIA API error: ${response.status}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || ''

  // Parse JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Failed to parse AI response')
  }

  const parsed = JSON.parse(jsonMatch[0])
  return {
    explanation: parsed.explanation || 'Unable to analyze error',
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
    correctedCode: parsed.correctedCode,
    resources: Array.isArray(parsed.resources) ? parsed.resources : [],
  }
}

const buildErrorAnalysisPrompt = (request: AnalysisRequest): string => {
  const { code, language, error, errorType, expectedOutput, actualOutput } = request

  let prompt = `Analyze this ${language} code and error:\n\n`
  prompt += `Code:\n\`\`\`${language}\n${code}\n\`\`\`\n\n`
  prompt += `Error Type: ${errorType}\n`
  prompt += `Error Message:\n${error}\n\n`

  if (errorType === 'wrong-output' && expectedOutput && actualOutput) {
    prompt += `Expected Output: ${expectedOutput}\n`
    prompt += `Actual Output: ${actualOutput}\n\n`
  }

  prompt += `Please provide:
1. A brief explanation of the issue
2. 2-3 specific suggestions to fix it
3. (Optional) A corrected code snippet
4. Relevant programming concepts to learn

Format your response as JSON.`

  return prompt
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const analysisRequest = req.body as AnalysisRequest

    // Validation
    if (!analysisRequest.code || !analysisRequest.language || !analysisRequest.error) {
      return res.status(400).json({
        error: 'Missing required fields: code, language, error',
      })
    }

    if (!['compilation', 'runtime', 'wrong-output'].includes(analysisRequest.errorType)) {
      return res.status(400).json({
        error: 'Invalid errorType. Must be: compilation, runtime, or wrong-output',
      })
    }

    const analysis = await analyzeErrorWithNvidia(analysisRequest)

    res.setHeader('Content-Type', 'application/json')
    return res.status(200).json(analysis)
  } catch (error: unknown) {
    console.error('Error in AI Analysis:', error)

    const message = error instanceof Error ? error.message : 'Unknown error'
    return res.status(500).json({
      error: 'AI analysis failed',
      details: message,
    })
  }
}
