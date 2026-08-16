/**
 * Instagram Post Feed Scraper - V3
 * CORRIGE: Handles errados e o BUG DOS POSTS FIXADOS (Pinned Posts).
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// HANDLES CORRIGIDOS COM BASE NOS PRINTS!
const CLIENT_PROFILES = [
  { id: 'irecemodas',        handle: 'irecemodas' },
  { id: 'antonov',           handle: 'antonovcenter' }, // Pinned post bug fix applied
  { id: 'hebravet',          handle: 'hebravetoficial' },
  { id: 'copirece',          handle: 'copirece' },
  { id: 'lionstop',          handle: 'academialionstop' },
  { id: 'serragrande',       handle: 'gruposerragrandeoficial' },
  { id: 'brussolo',          handle: 'brussoloristorante' }, // Corrigido de brussolo.ristorante
  { id: 'mangaba',           handle: 'mangaba_ai' }, // Corrigido de mangabaia
  { id: 'voa',               handle: 'voasportswear' },
  { id: 'hellen',            handle: 'hellenrochax' }, // Corrigido de hellenrochaa (Advogada Previdenciarista)
  { id: 'deputado',          handle: 'deputadojoaobacelar' },
  { id: 'alpha1',            handle: 'alpha1consultoria_' },
  { id: 'experimente',       handle: 'experimentepapelaria' }, // Assumindo correto
  { id: 'diacenter_clinica', handle: 'diacenterbahia' }, // Mantido
];

const delay = ms => new Promise(r => setTimeout(r, ms));

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
    const caption = item.caption?.text || '';
    const timestamp = item.taken_at ? new Date(item.taken_at * 1000).toISOString() : null;
    const takenAtSeconds = item.taken_at || 0;
    const likes = item.like_count || 0;
    const comments = item.comment_count || 0;
    const mediaType = item.media_type; // 1=photo, 2=video, 8=carousel

    return {
      id: item.code,
      url: `https://www.instagram.com/p/${item.code}/`,
      mediaType: mediaType === 2 ? 'Reel/Video' : mediaType === 8 ? 'Carrossel' : 'Foto',
      timestamp,
      takenAtSeconds,
      likes,
      comments,
      caption: caption.slice(0, 400),
    };
  });

  // CRÍTICO: ORDENAR POR DATA REAL!
  // O Instagram retorna posts fixados (pinned) primeiro. Isso quebrou o cálculo do Antonov.
  posts.sort((a, b) => b.takenAtSeconds - a.takenAtSeconds);

  return { posts };
}

async function main() {
  const cookiesPath = join(__dirname, 'cookies.json');
  const rawCookies = JSON.parse(readFileSync(cookiesPath, 'utf-8'));
  const cookieHeader = buildCookieHeader(rawCookies);
  const csrfToken = rawCookies.find(c => c.name === 'csrftoken')?.value || '';

  console.log('\n🚀 VYBE Instagram Scraper V3 — Correções de Pinned Posts e Handles\n');

  const results = {};

  for (const client of CLIENT_PROFILES) {
    console.log(`\n🔍 Processando @${client.handle}...`);
    await delay(3000 + Math.random() * 2000);

    const user = await fetchProfile(client.handle, cookieHeader, csrfToken);
    if (user.error) {
      console.log(`  ❌ Perfil: ${user.error}`);
      results[client.id] = { handle: client.handle, error: user.error };
      continue;
    }

    console.log(`  ✅ Perfil: ${user.full_name} | ${user.edge_followed_by?.count?.toLocaleString()} seg`);

    if (!user.is_private) {
      await delay(3000 + Math.random() * 2000);
      const { posts, error } = await fetchUserPosts(user.id, client.handle, cookieHeader, csrfToken);
      
      if (error) {
        console.log(`  ❌ Posts: ${error}`);
      } else {
        const daysSinceLastPost = posts.length > 0 && posts[0].timestamp
          ? Math.floor((Date.now() - new Date(posts[0].timestamp)) / 86400000)
          : null;
        
        const avgLikes = posts.length > 0
          ? Math.round(posts.reduce((s, p) => s + p.likes, 0) / posts.length) : 0;
        
        const engRate = user.edge_followed_by?.count > 0 && posts.length > 0
          ? ((posts.reduce((s, p) => s + p.likes + p.comments, 0) / posts.length) / user.edge_followed_by.count * 100).toFixed(2) + '%'
          : 'N/A';

        results[client.id] = {
          handle: client.handle,
          profile: {
            fullName: user.full_name,
            bio: user.biography,
            followers: user.edge_followed_by?.count,
            following: user.edge_follow?.count,
            userId: user.id
          },
          metrics: { daysSinceLastPost, avgLikes, engagementRate: engRate },
          recentPosts: posts
        };

        const urgency = daysSinceLastPost > 7 ? '🚨' : daysSinceLastPost > 3 ? '⚠️' : '✅';
        console.log(`  ${urgency} ${daysSinceLastPost} dias s/ postar | Eng: ${engRate}`);
      }
    } else {
      console.log(`  🔒 Conta privada. Não é possível ler posts.`);
    }
  }

  const prevPath = join(__dirname, 'audit-results-full.json');
  writeFileSync(prevPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log('\n✅ Salvo em scraper/audit-results-full.json\n');
}

main().catch(console.error);
