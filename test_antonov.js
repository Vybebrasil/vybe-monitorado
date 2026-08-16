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

async function fetchProfile(handle) {
  const cookiesPath = join(__dirname, 'scraper', 'cookies.json');
  const rawCookies = JSON.parse(readFileSync(cookiesPath, 'utf-8'));
  const cookieHeader = buildCookieHeader(rawCookies);
  const csrfToken = rawCookies.find(c => c.name === 'csrftoken')?.value || '';

  const url = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${handle}`;
  const res = await fetch(url, { headers: buildHeaders(cookieHeader, csrfToken, handle) });
  const json = await res.json();
  return json?.data?.user;
}

async function fetchUserPosts(userId, handle) {
  const cookiesPath = join(__dirname, 'scraper', 'cookies.json');
  const rawCookies = JSON.parse(readFileSync(cookiesPath, 'utf-8'));
  const cookieHeader = buildCookieHeader(rawCookies);
  const csrfToken = rawCookies.find(c => c.name === 'csrftoken')?.value || '';

  const url = `https://www.instagram.com/api/v1/feed/user/${userId}/?count=12`;
  const res = await fetch(url, { headers: buildHeaders(cookieHeader, csrfToken, handle) });
  const json = await res.json();
  
  const items = json.items || [];
  return items.map(item => ({
    timestamp: item.taken_at ? new Date(item.taken_at * 1000).toISOString() : null,
    is_pinned: item.timeline_pinned_user_ids?.length > 0
  }));
}

async function main() {
  const user = await fetchProfile('antonovcenter');
  const posts = await fetchUserPosts(user.id, 'antonovcenter');
  console.log("ALL POSTS RETURNED:", JSON.stringify(posts, null, 2));
}

main();
