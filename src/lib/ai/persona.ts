export interface PersonaParticles {
  title: string;
  affirmative: string;
  question: string;
}

export interface PersonaUserInput {
  profile?: {
    facts?: string[];
  };
}

/**
 * Resolves polite particles and elder addressing based on user profile facts or defaults.
 */
export function resolvePersonaParticles(userDoc?: PersonaUserInput | null): PersonaParticles {
  const facts = userDoc?.profile?.facts ?? [];
  const factsString = facts.join(' ').toLowerCase();

  // Intimate elder relative phrasing (จ้ะ / จ๊ะ)
  if (
    factsString.includes('จ้ะ') ||
    factsString.includes('จ๊ะ') ||
    factsString.includes('ยาย') ||
    factsString.includes('ย่า') ||
    factsString.includes('intimate')
  ) {
    return {
      title: 'ยาย',
      affirmative: 'จ้ะ',
      question: 'จ๊ะ',
    };
  }

  // Male speaker or polite ครับ
  if (factsString.includes('ครับ') || factsString.includes('male')) {
    return {
      title: 'หลาน',
      affirmative: 'ครับ',
      question: 'ครับ',
    };
  }

  // Default respectful female speaker (ค่ะ / คะ) per elder guidelines
  return {
    title: '',
    affirmative: 'ค่ะ',
    question: 'คะ',
  };
}
