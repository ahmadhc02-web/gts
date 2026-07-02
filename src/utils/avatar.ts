const MALE_AVATAR = `data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f1f5f9'/%3E%3Ccircle cx='50' cy='40' r='22' fill='%23fcd5ce'/%3E%3Cpath d='M 30 40 Q 50 15 70 40 Q 70 10 50 10 Q 30 10 30 40' fill='%233d2b1f'/%3E%3Cpath d='M 15 100 Q 15 70 50 70 Q 85 70 85 100' fill='%231a1a1a'/%3E%3C/svg%3E`;

const FEMALE_AVATAR = `data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f1f5f9'/%3E%3Ccircle cx='50' cy='45' r='20' fill='%23fcd5ce'/%3E%3Cpath d='M 25 45 Q 25 15 50 15 Q 75 15 75 45 Q 85 65 75 80 Q 50 70 25 80 Q 15 65 25 45' fill='%231a1a1a'/%3E%3Cpath d='M 15 100 Q 15 75 50 75 Q 85 75 85 100' fill='%2364748b'/%3E%3Ccircle cx='30' cy='45' r='3' fill='%23d97706'/%3E%3Ccircle cx='70' cy='45' r='3' fill='%23d97706'/%3E%3C/svg%3E`;

const NEUTRAL_AVATAR = `data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f1f5f9'/%3E%3Ccircle cx='50' cy='40' r='22' fill='%23e2e8f0'/%3E%3Cpath d='M 15 100 Q 15 70 50 70 Q 85 70 85 100' fill='%2394a3b8'/%3E%3C/svg%3E`;

export const getAvatarUrl = (pic?: string | null) => {
  if (pic === 'default:female') return FEMALE_AVATAR;
  if (pic === 'default:male') return MALE_AVATAR;
  if (pic === 'default:none' || pic === 'default:not_set') return NEUTRAL_AVATAR;
  if (pic && pic.startsWith('data:')) return pic;
  if (pic && pic.startsWith('http')) return pic;
  // Falsy or unknown default - fallback to neutral
  return NEUTRAL_AVATAR;
};
