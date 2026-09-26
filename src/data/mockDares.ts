import { MockDare } from '../components/DareCard';

/**
 * STATIC UI MOCK DATA — Phase 2 only.
 * No backend, no fake social activity/counts. Purely for demonstrating
 * card layout. Replace with real data in Phase 6 (Dare Engine).
 */
export const mockHomeDares: MockDare[] = [
  {
    id: 'mock-1',
    title: 'Shoot a 15-second video pitching your wildest business idea',
    category: 'Creative',
    difficulty: 'Medium',
    xpValue: 40,
    proofType: 'Video',
  },
  {
    id: 'mock-2',
    title: 'Strike up a conversation with someone new at a local café',
    category: 'Social',
    difficulty: 'Easy',
    xpValue: 20,
    proofType: 'Photo',
  },
  {
    id: 'mock-3',
    title: 'Find and photograph the most unusual piece of street art nearby',
    category: 'Photography',
    difficulty: 'Easy',
    xpValue: 25,
    proofType: 'Photo',
  },
];

export const mockDiscoverDares: MockDare[] = [
  {
    id: 'mock-4',
    title: 'Learn and perform 10 seconds of a dance you\u2019ve never tried',
    category: 'Adventure',
    difficulty: 'Hard',
    xpValue: 60,
    proofType: 'Video',
  },
  {
    id: 'mock-5',
    title: 'Write a 3-line poem about your city and share it',
    category: 'Content',
    difficulty: 'Easy',
    xpValue: 15,
    proofType: 'Text',
  },
];

export const discoverCategories = [
  'Funny',
  'Creative',
  'Adventure',
  'Brain',
  'Fitness',
  'Social',
  'Photography',
  'Music',
  'Content',
] as const;
