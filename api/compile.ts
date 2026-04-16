import type { VercelRequest, VercelResponse } from '@vercel/node'

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

const parseUpstreamBody = async (response: Response) => {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    return { message: text }
  }
}

const toBase64 = (value: string | undefined) => Buffer.from(value || '', 'utf8').toString('base64')

const compileWithOnlineCompiler = async ({ language_id, source_code, stdin }: { language_id: number; source_code: string; stdin?: string }) => {
  if (!ONLINECOMPILER_API_KEY) {
    return {
      status: 500,
      body: {
        error: 'OnlineCompiler API key is missing.',
        details: 'Set ONLINECOMPILER_API_KEY in environment variables.',
      },
    }
  }

  const decodedSource = Buffer.from(source_code || '', 'base64').toString('utf8')
  const decodedInput = stdin ? Buffer.from(stdin, 'base64').toString('utf8') : ''
  const compiler = LANGUAGE_ID_TO_COMPILER[language_id as keyof typeof LANGUAGE_ID_TO_COMPILER]

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
    if (error instanceof Error && error.name === 'AbortError') {
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  )

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Use POST method',
    })
  }

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
}
