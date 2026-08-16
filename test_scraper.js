import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function buildCookieHeader(cookiesArray) {
  return cookiesArray.map(c => `${c.name}=${c.value}`).join('; ');
}

function buildHeaders(cookieHeader, csrfToken, handle) {
  return {
    'accept': '*/*',
    'accept-language': 'pt-BR,pt;q=0.9',
    'cookie': cookieHeader,
    'referer': `https://www.instagram.com/${handle}/`,
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'x-csrftoken': csrfToken,
    'x-ig-app-id': '936619743392459',
    'x-requested-with': 'XMLHttpRequest',
  };
}

async function fetchProfile(handle, cookieHeader, csrfToken) {
  const url = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${handle}`;
  const res = await fetch(url, { headers: buildHeaders(cookieHeader, csrfToken, handle) });
  if (!res.ok) return { error: `HTTP ${res.status}` };
  const json = await res.json();
  return json?.data?.user || { error: 'no user' };
}

async function fetchUserPosts(userId, handle, cookieHeader, csrfToken) {
  const url = `https://www.instagram.com/api/v1/feed/user/${userId}/?count=12`;
  const res = await fetch(url, { headers: buildHeaders(cookieHeader, csrfToken, handle) });
  if (!res.ok) return { error: `HTTP ${res.status}`, posts: [] };
  const json = await res.json();
  
  const items = json.items || [];
  const posts = items.map(item => {
    const timestamp = item.taken_at ? new Date(item.taken_at * 1000).toISOString() : null;
    return {
      id: item.code,
      timestamp,
      takenAtSeconds: item.taken_at || 0,
    };
  });

  posts.sort((a, b) => b.takenAtSeconds - a.takenAtSeconds);
  return { posts };
}

async function auditProfile(handle) {
  const cookiesPath = join(__dirname, 'scraper', 'cookies.json');
  const rawCookies = JSON.parse(readFileSync(cookiesPath, 'utf-8'));
  const cookieHeader = buildCookieHeader(rawCookies);
  const csrfToken = rawCookies.find(c => c.name === 'csrftoken')?.value || '';

  const user = await fetchProfile(handle, cookieHeader, csrfToken);
  if (user.error) {
      console.log("Error fetching user:", user.error);
      return;
  }
  
  const { posts } = await fetchUserPosts(user.id, handle, cookieHeader, csrfToken);
  if (posts && posts.length > 0) {
      const daysSinceLastPost = Math.floor((Date.now() - new Date(posts[0].timestamp)) / 86400000);
      console.log(`[${handle}] Dias desde o último post: ${daysSinceLastPost}`);
      console.log("Últimos posts:");
      posts.slice(0, 3).forEach(p => console.log(p.timestamp));
  } else {
      console.log(`[${handle}] Nenhum post encontrado.`);
  }
}

auditProfile('antonovcenter');
