// The ONLY part of the Theater the rest of the app may import (enforced by
// eslint.config.mjs). Settings sets and checks the passcode; the app layout
// asks whether the Theater tab should show. Everything else stays inside.
export { getTheaterState, hashPasscode, THEATER_COOKIE } from './gate'
