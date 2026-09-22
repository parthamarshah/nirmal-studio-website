// The only code that talks to GitHub. Publishing is "make one commit on PUBLISH_BRANCH";
// this file is the handful of Git Data API calls that takes, and nothing else.
//
// Why the low-level Git Data API (blobs → tree → commit → ref) rather than the simpler
// "update a file" Contents API: the Contents API makes ONE COMMIT PER FILE. A publish
// that touches three documents would land as three commits, the build would run on the
// first one with the other two missing, and Undo would have no single thing to undo.

const API = 'https://api.github.com'
export const REPO = 'parthamarshah/nirmal-studio-website'

// Branch names reach URLs, so they are pinned to a safe shape rather than escaped.
const BRANCH = /^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/
export const isBranchName = (b) => typeof b === 'string' && BRANCH.test(b) && !b.includes('..')

export class GitHubError extends Error {
  constructor(message, status, data) {
    super(message)
    this.status = status
    this.data = data
  }
}

// A plain-English reading of the failures someone might actually hit. The token expires
// on 19 December 2026 (see CLAUDE.md), and a fine-grained token with the wrong scope
// answers 404, not 403 — both are worth naming rather than showing "Not Found".
// `outcome` is what did NOT happen, so each caller can say it truthfully.
export function explainGitHubError(err, outcome = 'Nothing was published.') {
  const tail = outcome ? ` ${outcome}` : ''
  if (!(err instanceof GitHubError)) return `Couldn’t reach GitHub.${tail} Try again in a minute.`
  if (err.status === 401) return `GitHub rejected the publishing token — it has probably expired.${tail} (The token is GITHUB_TOKEN in the Cloudflare settings.)`
  if (err.status === 403 && /rate limit/i.test(err.message)) return `GitHub is limiting requests for a while.${tail} Try again in a few minutes.`
  if (err.status === 403 || err.status === 404) return `GitHub refused access to the repository — the publishing token may be missing a permission.${tail}`
  return `GitHub answered: ${err.message}.${tail}`
}

export function github(env) {
  const token = env.GITHUB_TOKEN

  async function call(method, path, body) {
    const res = await fetch(`${API}/repos/${REPO}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        // GitHub rejects requests without a User-Agent.
        'User-Agent': 'nirmal-studio-admin',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    const text = await res.text()
    let data = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      // A non-JSON body is an outage page; the status is what matters.
    }
    if (!res.ok) throw new GitHubError(data?.message || `GitHub answered ${res.status}`, res.status, data)
    return data
  }

  return {
    // The commit a branch points at right now.
    async head(branch) {
      const ref = await call('GET', `/git/ref/heads/${branch}`)
      return ref.object.sha
    },

    async treeOf(commitSha) {
      const commit = await call('GET', `/git/commits/${commitSha}`)
      return commit.tree.sha
    },

    // One file as it is in a given commit: { sha, text }, or null when it doesn't exist
    // there. Always asked of a pinned commit sha, never a branch name, so every read in
    // one publish sees the same snapshot even if the branch moves mid-request.
    async file(path, commitSha) {
      try {
        const f = await call('GET', `/contents/${path}?ref=${commitSha}`)
        if (Array.isArray(f) || f.type !== 'file') throw new GitHubError(`${path} is not a file`, 422, f)
        // The Contents API inlines files up to 1 MB. Content documents are a few tens of
        // KB, so an empty `content` means something is badly wrong — fetch the blob.
        const b64 = f.content || (await call('GET', `/git/blobs/${f.sha}`)).content
        return { sha: f.sha, text: base64ToUtf8(b64) }
      } catch (err) {
        if (err instanceof GitHubError && err.status === 404) return null
        throw err
      }
    },

    // `entries` are { path, content } to write or { path, sha } to set (sha: null deletes).
    // base_tree means every path NOT listed is carried over unchanged — that is what
    // keeps a publish from ever touching code.
    async createTree(baseTree, entries) {
      const tree = await call('POST', '/git/trees', {
        base_tree: baseTree,
        tree: entries.map((e) => ({ path: e.path, mode: '100644', type: 'blob', ...('content' in e ? { content: e.content } : { sha: e.sha }) })),
      })
      return tree.sha
    },

    async createCommit(message, tree, parent) {
      const commit = await call('POST', '/git/commits', { message, tree, parents: [parent] })
      return commit.sha
    },

    // force: false is the whole race protection. If anyone pushed to the branch since we
    // read its head, GitHub refuses with 422 ("not a fast forward") instead of throwing
    // their commit away.
    async moveBranch(branch, sha) {
      await call('PATCH', `/git/refs/heads/${branch}`, { sha, force: false })
    },

    // Whether `commitSha` is already contained in `laterSha` — used by the status check
    // when the deployed build is newer than the publish (someone pushed code meanwhile).
    async contains(laterSha, commitSha) {
      if (laterSha === commitSha) return true
      try {
        const cmp = await call('GET', `/compare/${commitSha}...${laterSha}`)
        return cmp.status === 'ahead' || cmp.status === 'identical'
      } catch (err) {
        if (err instanceof GitHubError && err.status === 404) return false
        throw err
      }
    },
  }
}

export const isFastForwardRefusal = (err) => err instanceof GitHubError && err.status === 422

function base64ToUtf8(b64) {
  const bin = atob(String(b64).replace(/\s/g, ''))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

// Git's own blob id: sha1("blob <byte length>\0<bytes>"). Computing it locally lets a
// publish tell "this draft is identical to what's published" without another request,
// and lets Undo check that a file still holds exactly what a publish wrote.
export async function gitBlobSha(text) {
  const body = new TextEncoder().encode(text)
  const header = new TextEncoder().encode(`blob ${body.length}\0`)
  const all = new Uint8Array(header.length + body.length)
  all.set(header)
  all.set(body, header.length)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-1', all))
  return [...digest].map((b) => b.toString(16).padStart(2, '0')).join('')
}
