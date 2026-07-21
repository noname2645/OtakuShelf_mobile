# Changelog

## [1.1.0] - 2026-07-21

### Changed
- **ProfileScreen**: Redesigned user detail header with amber (#ffae00) accents — avatar glow, @username color, bio accent bar, edit/share buttons. Removed glass card wrapper; content sits directly over cover image.
- **ProfileScreen**: Background color unified to `#030712` (matching SearchScreen and AIScreen).
- **ProfileScreen**: Loading spinner changed to amber `ActivityIndicator` with scale 1.5 (same as SearchScreen), text removed.
- **ProfileScreen**: Profile and watchlist API calls parallelized via `Promise.all` for faster loading.
- **ProfileScreen**: Grid layout uses explicit `rowGap` and `columnGap` (both 14) for consistent spacing between rows and columns; wrapped grid items in 50% width wrappers for proper 2-column layout.
- **ProfileScreen**: Banner card height increased from 200 to 260; cardBanner style now uses runtime height instead of hardcoded 200.
- **AnimeCardPremium**: Added `isBanner` prop support (full-width 200px layout with banner image). Defensive title render: `typeof === 'string'` check.
- **BottomNav**: Profile tab shows user avatar photo (28×28 circle) when signed in; AI tab uses robot SVG; individual icon sizes per tab via `BASE_SIZES`. Home icon replaced with 24×24 viewBox house icon.
- **RelatedSection**: Now uses `AnimeCardPremium` instead of inline card.

### Fixed
- **AIScreen**: "Objects are not valid as a React child" error — added `normalizeAnime()` to normalize AniList-style title objects in API response and stored conversations.
- **ProfileScreen**: `badgeDefs.map is not a function` error — added `Array.isArray()` guard on API response parsing.
- **ProfileScreen**: Cover gradient bottom color updated from `#0a0f1e` to `#030712` to eliminate visible seam.
- **AnimeCardPremium**: Heart/favorite toggle now calls backend API (PUT or POST to `/api/list`) in addition to local PreferenceContext, so favorites persist to server. Added `onToggleFavorite` and `onToggleWatchlist` prop support.
- **ProfileScreen**: `handleToggleFavorite` re-fetches profile data after toggling favorite, ensuring the Favorite Anime grid always reflects server state regardless of ID format mismatches.

- **ProfileScreen**: `fetchAnimeDetails` now enriches data from AniList BEFORE opening the modal — no more two-phase loading flicker.
- **AIScreen**: `handleAnimePress` now enriches data before opening the modal — modal always displays complete data on first render.
- **AnimeModal**: Removed `marginTop` from modal container (black strap above banner). Added `borderTopLeftRadius`/`borderTopRightRadius` + `overflow: hidden` to header so banner corners are rounded.

### Added
- **CHANGELOG.md**: This file.

### Removed
- **GoogleAuthScreen** (WebView): Replaced with `GoogleAuthBrowser` (system browser via `Linking.openURL`).
