import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

// Load .env.local first, then .env
dotenv.config({ path: '.env.local' })
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

const COMPILER_PROVIDER = 'onlinecompiler'

const ONLINECOMPILER_BASE_URL =
  (process.env.ONLINECOMPILER_BASE_URL || 'https://api.onlinecompiler.io').trim().replace(/\/$/, '')
const ONLINECOMPILER_EXECUTE_PATH = (process.env.ONLINECOMPILER_EXECUTE_PATH || '/api/run-code-sync/').trim()
const ONLINECOMPILER_API_KEY = (process.env.ONLINECOMPILER_API_KEY || '').trim()
const ONLINECOMPILER_API_KEY_HEADER = (process.env.ONLINECOMPILER_API_KEY_HEADER || 'Authorization').trim()
const ONLINECOMPILER_TIMEOUT_MS = Number(process.env.ONLINECOMPILER_TIMEOUT_MS || 15000)

const LANGUAGE_ID_TO_COMPILER = {
  4: 'gcc-15',           // C
  10: 'g++-15',          // C++
  26: 'openjdk-25',      // Java
  51: 'dotnet-csharp-9', // C#
  60: 'go',              // Go
  63: 'typescript-deno',  // JavaScript
  68: 'php',             // PHP
  71: 'python-3.14',     // Python
  72: 'ruby',            // Ruby
  73: 'rust',            // Rust
  78: 'kotlin',          // Kotlin
  80: 'r',               // R
  83: 'swift',           // Swift
  84: 'typescript-deno',  // TypeScript
  85: 'perl',            // Perl
  86: 'scala',           // Scala
}

const parseUpstreamBody = async (response) => {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    return { message: text }
  }
}

const toBase64 = (value) => Buffer.from(value || '', 'utf8').toString('base64')

const compileWithOnlineCompiler = async ({ language_id, source_code, stdin }) => {
  if (!ONLINECOMPILER_API_KEY) {
    return {
      status: 500,
      body: {
        error: 'OnlineCompiler API key is missing.',
        details: 'Set ONLINECOMPILER_API_KEY in .env and restart the backend server.',
      },
    }
  }

  const decodedSource = Buffer.from(source_code || '', 'base64').toString('utf8')
  const decodedInput = stdin ? Buffer.from(stdin, 'base64').toString('utf8') : ''
  const compiler = LANGUAGE_ID_TO_COMPILER[language_id]

  if (!compiler) {
    return {
      status: 400,
      body: {
        error: `Language id ${language_id} is not supported in this setup.`,
      },
    }
  }

  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), ONLINECOMPILER_TIMEOUT_MS)

  try {
    const executeCandidates = Array.from(
      new Set([
        ONLINECOMPILER_EXECUTE_PATH,
        '/api/run-code-sync/',
        '/api/run-code/',
      ])
    )

    const headers = {
      'Content-Type': 'application/json',
      Authorization: ONLINECOMPILER_API_KEY,
      'x-api-key': ONLINECOMPILER_API_KEY,
      [ONLINECOMPILER_API_KEY_HEADER]: ONLINECOMPILER_API_KEY,
    }

    let response = null
    let body = null

    for (const executePath of executeCandidates) {
      const candidateResponse = await fetch(`${ONLINECOMPILER_BASE_URL}${executePath}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          compiler,
          code: decodedSource,
          input: decodedInput,
          language_id,
          source_code: decodedSource,
          stdin: decodedInput,
        }),
        signal: abortController.signal,
      })

      const candidateBody = await parseUpstreamBody(candidateResponse)

      // Some older paths may return 404 HTML; keep trying modern fallbacks.
      if (candidateResponse.status === 404) {
        response = candidateResponse
        body = candidateBody
        continue
      }

      response = candidateResponse
      body = candidateBody
      break
    }

    if (!response || !body) {
      return {
        status: 502,
        body: {
          error: 'OnlineCompiler API unreachable.',
          details: 'No response from provider.',
        },
      }
    }

    if (response.status === 401 || response.status === 403) {
      return {
        status: 403,
        body: {
          error: 'OnlineCompiler API authentication failed.',
          details: body.message || body.error || 'Invalid API key or access denied.',
        },
      }
    }

    if (!response.ok) {
      return {
        status: response.status,
        body: {
          error: 'OnlineCompiler API error',
          details: body.message || body.error || 'Unknown provider error.',
        },
      }
    }

    const outputText =
      typeof body.stdout === 'string'
        ? body.stdout
        : typeof body.output === 'string'
          ? body.output
          : typeof body.result === 'string'
            ? body.result
            : ''

    const errorText =
      typeof body.stderr === 'string'
        ? body.stderr
        : typeof body.error === 'string'
          ? body.error
          : typeof body.compile_output === 'string'
            ? body.compile_output
            : ''

    if (errorText) {
      return {
        status: 200,
        body: {
          stderr: toBase64(errorText),
          status: {
            id: 6,
            description: 'Compilation or runtime error',
          },
        },
      }
    }

    return {
      status: 200,
      body: {
        stdout: toBase64(outputText),
        status: {
          id: 3,
          description: 'Accepted',
        },
      },
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      return {
        status: 504,
        body: {
          error: 'OnlineCompiler API timed out.',
          details: `Execution exceeded timeout of ${ONLINECOMPILER_TIMEOUT_MS}ms.`,
        },
      }
    }

    throw error
  } finally {
    clearTimeout(timeout)
  }
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Compiler server is running',
    provider: COMPILER_PROVIDER,
    onlineCompilerConfigured: Boolean(ONLINECOMPILER_API_KEY),
    baseUrl: ONLINECOMPILER_BASE_URL,
    executePath: ONLINECOMPILER_EXECUTE_PATH,
  })
})

app.post('/api/compile', async (req, res) => {
  try {
    const { language_id, source_code, stdin } = req.body

    if (!language_id || !source_code) {
      return res.status(400).json({
        error: 'Missing required fields: language_id and source_code',
      })
    }

    const result = await compileWithOnlineCompiler({ language_id, source_code, stdin })

    return res.status(result.status).json(result.body)
  } catch (error) {
    console.error('Compilation error:', error)
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown server error',
    })
  }
})

app.get('/api/languages', (req, res) => {
  return res.json({
    provider: 'onlinecompiler',
    languages: Object.entries(LANGUAGE_ID_TO_COMPILER).map(([id, value]) => ({
      id: Number(id),
      compiler: value,
    })),
  })
})

// ─── AI Analysis Endpoint ───
const NVIDIA_API_KEY = (process.env.NVIDIA_API_KEY || '').trim()
const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1'
const NVIDIA_MODEL = (process.env.NVIDIA_MODEL || 'openai/gpt-oss-20b').trim()

const buildErrorAnalysisPrompt = (code, language, error, errorType, expectedOutput, actualOutput) => {
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
2. 2-3 specific suggestions to fix it (each suggestion should include relevant code examples)
3. Relevant programming concepts to learn

Format your response as JSON with this structure:
{
  "explanation": "Brief explanation of what went wrong",
  "suggestions": [
    {
      "text": "Description of the fix",
      "code": "Example code showing the fix",
      "language": "${language}"
    },
    ...
  ],
  "resources": ["resource/concept to learn", ...]
}`

  return prompt
}

app.post('/api/ai-analysis', async (req, res) => {
  try {
    if (!NVIDIA_API_KEY) {
      return res.status(500).json({
        error: 'NVIDIA_API_KEY is not configured',
        details: 'Set NVIDIA_API_KEY in environment variables.',
      })
    }

    const { code, language, error, errorType, expectedOutput, actualOutput } = req.body

    if (!code || !language || !error) {
      return res.status(400).json({
        error: 'Missing required fields: code, language, error',
      })
    }

    if (!['compilation', 'runtime', 'wrong-output'].includes(errorType)) {
      return res.status(400).json({
        error: 'Invalid errorType. Must be: compilation, runtime, or wrong-output',
      })
    }

    const prompt = buildErrorAnalysisPrompt(code, language, error, errorType, expectedOutput, actualOutput)

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
            content: `You are an expert programming tutor. Analyze code errors and provide clear, actionable guidance with direct code examples to help users learn and fix their mistakes. Be concise and focus on the specific error. For each suggestion, provide practical code examples that demonstrate the fix.

Return your response as a JSON object with this structure:
{
  "explanation": "Brief explanation of what went wrong",
  "suggestions": [
    {
      "text": "Description of the fix",
      "code": "Example code showing the fix",
      "language": "language name"
    },
    {
      "text": "Another suggestion",
      "code": "Code example",
      "language": "language name"
    }
  ],
  "resources": ["concept to learn", "another concept"]
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
      return res.status(response.status).json({
        error: `NVIDIA API error: ${response.status}`,
        details: errorText,
      })
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return res.status(500).json({
        error: 'Failed to parse AI response',
        details: 'AI response was not in valid JSON format',
      })
    }

    const parsed = JSON.parse(jsonMatch[0])
    
    // Normalize suggestions to handle both old (string[]) and new (object[]) formats
    const normalizedSuggestions = Array.isArray(parsed.suggestions) 
      ? parsed.suggestions.map(s => 
          typeof s === 'string' 
            ? { text: s } 
            : s
        )
      : []
    
    res.json({
      explanation: parsed.explanation || 'Unable to analyze error',
      suggestions: normalizedSuggestions,
      resources: Array.isArray(parsed.resources) ? parsed.resources : [],
    })
  } catch (error) {
    console.error('Error in AI Analysis:', error)
    res.status(500).json({
      error: 'AI analysis failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  })
})

app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Endpoint ${req.path} not found`,
  })
})

app.listen(PORT, () => {
  console.log(`Compiler server running on http://localhost:${PORT}`)
  console.log(`Provider: ${COMPILER_PROVIDER}`)
  console.log(`OnlineCompiler configured: ${Boolean(ONLINECOMPILER_API_KEY)}`)
})
