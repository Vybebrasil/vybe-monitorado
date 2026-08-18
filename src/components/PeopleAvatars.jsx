import React from 'react';

const initials = (name = '') => String(name)
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map(part => part[0])
  .join('')
  .toUpperCase() || '?';

const normalizePeople = (people, names = '') => {
  if (Array.isArray(people) && people.length) return people.filter(Boolean);
  return String(names || '')
    .split(',')
    .map(name => name.trim())
    .filter(Boolean)
    .map(name => ({ name, avatarUrl: null }));
};

export function PeopleAvatars({ people, names = '', label = 'Pessoas responsáveis', size = 'sm', showNames = false, max = 3 }) {
  const normalized = normalizePeople(people, names);
  if (!normalized.length) {
    return <span className={`people-avatars people-avatars-${size} people-avatars-empty`} aria-label={`${label}: não atribuído`}>—</span>;
  }

  const visible = normalized.slice(0, max);
  const hidden = normalized.length - visible.length;
  const fullNames = normalized.map(person => person.name).filter(Boolean).join(', ');

  return (
    <span className={`people-avatars people-avatars-${size}`} aria-label={`${label}: ${fullNames}`} title={`${label}: ${fullNames}`}>
      <span className="people-avatar-stack" aria-hidden="true">
        {visible.map((person, index) => (
          <span className="people-avatar" key={`${person.id || person.name || 'person'}-${index}`}>
            {person.avatarUrl ? <img src={person.avatarUrl} alt="" loading="eager" referrerPolicy="no-referrer" /> : <span>{initials(person.name)}</span>}
          </span>
        ))}
        {hidden > 0 ? <span className="people-avatar people-avatar-more">+{hidden}</span> : null}
      </span>
      {showNames ? <span className="people-avatar-names">{fullNames}</span> : null}
    </span>
  );
}

export default PeopleAvatars;
