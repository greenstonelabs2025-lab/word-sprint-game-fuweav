
// This file is no longer used - the app uses the root WordSprintGame.tsx instead
// which properly imports from wordBank.ts instead of Words.json
// 
// The root WordSprintGame.tsx has been updated to use:
// import { themes, wordBank } from "./wordBank";
//
// This file was previously importing from Words.json which is now deprecated.
// All gameplay now uses wordBank.ts exclusively.

export default function UnusedWordSprintGame() {
  return null; // This component is not used
}
