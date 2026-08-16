import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function buildCookieHeader(cookiesArray) {
  return cookiesArray.map(c => `${c.name}=${c.value}`).join('; ');
}

function loadInstagramCookies() {
  const inlineCookies = process.env.INSTAGRAM_COOKIES_JSON?.trim();
  if (inlineCookies) {
    const parsed = JSON.parse(inlineCookies);
    if (!Array.isArray(parsed)) throw new Error('INSTAGRAM_COOKIES_JSON precisa conter um array JSON.');
    return parsed;
  }

  const cookiesPath = process.env.INSTAGRAM_COOKIES_PATH
    ? process.env.INSTAGRAM_COOKIES_PATH
    : join(__dirname, '..', 'scraper', 'cookies.json');

  if (!existsSync(cookiesPath)) {
    throw new Error('Cookies do Instagram não configurados. Use INSTAGRAM_COOKIES_JSON ou INSTAGRAM_COOKIES_PATH.');
  }

  const parsed = JSON.parse(readFileSync(cookiesPath, 'utf-8'));
  if (!Array.isArray(parsed)) throw new Error('O arquivo de cookies do Instagram precisa conter um array JSON.');
  return parsed;
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

async function fetchUserPosts(userId, handle, cookieHeader, csrfToken, maxPosts = 30) {
  let allItems = [];
  let nextMaxId = '';
  
  while (allItems.length < maxPosts) {
    const url = `https://www.instagram.com/api/v1/feed/user/${userId}/?count=12${nextMaxId ? '&max_id=' + nextMaxId : ''}`;
    const res = await fetch(url, { headers: buildHeaders(cookieHeader, csrfToken, handle) });
    if (!res.ok) {
        if (allItems.length === 0) return { error: `HTTP ${res.status}`, posts: [] };
        break; // If we already have some posts, just return what we have
    }
    const json = await res.json();
    
    if (!json.items || json.items.length === 0) break;
    
    allItems = allItems.concat(json.items);
    
    if (json.more_available && json.next_max_id) {
        nextMaxId = json.next_max_id;
        // sleep a bit to avoid rate limits
        await new Promise(r => setTimeout(r, 500));
    } else {
        break;
    }
  }

  const posts = allItems.slice(0, maxPosts).map(item => {
    const caption = item.caption?.text || '';
    const timestamp = item.taken_at ? new Date(item.taken_at * 1000).toISOString() : null;
    const takenAtSeconds = item.taken_at || 0;
    const likes = item.like_count || 0;
    const comments = item.comment_count || 0;
    const mediaType = item.media_type;

    return {
      id: item.code,
      url: `https://www.instagram.com/p/${item.code}/`,
      mediaType: mediaType === 2 ? 'Reel/Video' : mediaType === 8 ? 'Carrossel' : 'Foto',
      timestamp,
      takenAtSeconds,
      likes,
      comments,
      caption: caption.slice(0, 100), // Reduzido para economizar tokens na API gratuita
    };
  });

  posts.sort((a, b) => b.takenAtSeconds - a.takenAtSeconds);
  return { posts: posts.slice(0, 20) }; // Limite de 20 posts para evitar 429 Too Many Requests
}

export async function auditProfile(handle) {
  try {
    const rawCookies = loadInstagramCookies();
    const cookieHeader = buildCookieHeader(rawCookies);
    const csrfToken = rawCookies.find(c => c.name === 'csrftoken')?.value || '';

    const user = await fetchProfile(handle, cookieHeader, csrfToken);
    if (user.error) return { error: user.error };

    let result = {
      handle,
      profile: {
        fullName: user.full_name,
        bio: user.biography,
        followers: user.edge_followed_by?.count,
        following: user.edge_follow?.count,
        isPrivate: user.is_private,
      },
      metrics: null,
      recentPosts: []
    };

    if (!user.is_private) {
      const { posts, error } = await fetchUserPosts(user.id, handle, cookieHeader, csrfToken);
      if (!error && posts) {
        const daysSinceLastPost = posts.length > 0 && posts[0].timestamp
          ? Math.floor((Date.now() - new Date(posts[0].timestamp)) / 86400000)
          : null;
        
        const avgLikes = posts.length > 0
          ? Math.round(posts.reduce((s, p) => s + p.likes, 0) / posts.length) : 0;
        
        const engRate = user.edge_followed_by?.count > 0 && posts.length > 0
          ? ((posts.reduce((s, p) => s + p.likes + p.comments, 0) / posts.length) / user.edge_followed_by.count * 100).toFixed(2) + '%'
          : 'N/A';

        result.metrics = { daysSinceLastPost, avgLikes, engagementRate: engRate };
        result.recentPosts = posts.slice(0, 20); // Mandar até 20 posts pro LLM ter mais contexto sem estourar o limite
      }
    }

    return result;
  } catch (error) {
    return { error: error.message };
  }
}
