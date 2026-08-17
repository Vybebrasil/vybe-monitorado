const FULL_SHA = /^[a-f0-9]{40}$/i;

const value = input => typeof input === 'string' ? input.trim() : '';

export function buildReleaseMetadata(env = process.env) {
  const commit = value(env.VERCEL_GIT_COMMIT_SHA || env.GIT_COMMIT_SHA) || 'local';
  const provider = value(env.VERCEL_GIT_PROVIDER) || (commit === 'local' ? 'local' : 'unknown');
  const owner = value(env.VERCEL_GIT_REPO_OWNER || env.GIT_REPO_OWNER);
  const slug = value(env.VERCEL_GIT_REPO_SLUG || env.GIT_REPO_SLUG);
  const repository = owner && slug ? `${owner}/${slug}` : null;
  const expectedRepository = value(env.NEXUS_EXPECTED_GIT_REPOSITORY) || 'Vybebrasil/vybe-monitorado';
  const validCommit = commit === 'local' || FULL_SHA.test(commit);
  const matchesExpectedRepository = repository ? repository.toLowerCase() === expectedRepository.toLowerCase() : null;
  const trackable = commit === 'local'
    ? true
    : validCommit && provider === 'github' && Boolean(repository) && matchesExpectedRepository !== false;

  return {
    commit,
    shortCommit: commit === 'local' ? 'local' : commit.slice(0, 7),
    commitSource: env.VERCEL_GIT_COMMIT_SHA ? 'VERCEL_GIT_COMMIT_SHA' : env.GIT_COMMIT_SHA ? 'GIT_COMMIT_SHA' : 'local',
    provider,
    repository,
    expectedRepository,
    matchesExpectedRepository,
    branch: value(env.VERCEL_GIT_COMMIT_REF || env.GIT_BRANCH) || null,
    deploymentId: value(env.VERCEL_DEPLOYMENT_ID) || null,
    deploymentUrl: value(env.VERCEL_URL) ? `https://${value(env.VERCEL_URL)}` : null,
    commitUrl: FULL_SHA.test(commit) && repository ? `https://github.com/${repository}/commit/${commit}` : null,
    trackable
  };
}
