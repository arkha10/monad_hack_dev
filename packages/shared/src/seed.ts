export const SEED = {
  demoRedUser: '00000000-0000-4000-8000-000000000101',
  demoBlueUser: '00000000-0000-4000-8000-000000000102',
  demoRedTeam: 'team-boai-garuda',
  demoBlueTeam: 'team-boai-nusantara',
  demoPracticeMatch: 'match-boai-practice-001',
  demoPvPMatch: 'match-boai-pvp-001',
  demoRulesetVersion: 'boai-blitz-v1',
  demoSeed: 'boai-seed-20261024-001',
  agentSlots: ['p1', 'p2', 'p3', 'p4', 'p5'] as const,
  cosmetics: [
    { id: 'skin-default-red', category: 'skin', name: 'Merah Klasik', priceCredits: 0, gameplayModifier: false },
    { id: 'skin-default-blue', category: 'skin', name: 'Biru Klasik', priceCredits: 0, gameplayModifier: false },
    { id: 'effect-spark-demo', category: 'throw_effect', name: 'Percikan Demo', priceCredits: 0, gameplayModifier: false }
  ] as const,
  practicePresets: ['easy','medium','hard'] as const,
  promptSamples: [
    { id: 'prompt-build', text: 'Utamakan menyusun genting ketika aman.' },
    { id: 'prompt-dodge', text: 'Utamakan menghindari bola sebelum mendekati genting.' },
    { id: 'prompt-decoy', text: 'Alihkan perhatian penjaga agar teman bisa menyusun.' }
  ] as const
} as const
