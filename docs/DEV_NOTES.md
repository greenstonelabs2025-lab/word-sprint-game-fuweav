
# Word Sprint — Development Notes

## UI/UX Standards
- Background must fill screen with overlay and SafeArea content.
- Gradient pill buttons stay consistent across Menu, Store, Settings, Feedback, Game HUD.
- Top HUD: Home (left), Title (center), Points (right) with true 3-column alignment.
- Use colours from `styles/commonStyles.ts` consistently.

## Game Logic
- Daily Challenge uses long words (9–14 letters), date-seeded, deterministic.
- Scoring: +10×stage; +5 bonus every 3rd streak.
- Hints: 50 points (reveal next letter). Answer: 200 points (complete word). No popups.
- Word themes come from `wordBank.ts`. Remove legacy test themes.

## Data Management
- Use Supabase for remote data and caching.
- Implement RLS policies on all tables.
- Cache data locally with AsyncStorage.
- Sync word sets and challenges from remote.

## Performance
- Use FlatList only when recycling needed; ScrollView for most cases.
- Implement proper loading states and error handling.
- Optimise animations with react-native-reanimated.

## Accessibility
- Ensure proper contrast ratios.
- Add accessibility labels to interactive elements.
- Support high contrast mode preferences.
- Test with screen readers.

## Prompt Compliance
- All prompts must obey the **≤3500 char** rule and be split if needed.
- Include full file contents, never partial diffs.
- Use established component patterns and imports.
