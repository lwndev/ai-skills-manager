# Implementation Plan: Podcast Index CLI Features

## Overview

This document outlines the implementation plan for adding five new CLI features that integrate Podcast Index API capabilities with pullapod-cli's core use case: targeted episode downloading.

## Features Summary

| Feature ID | Feature Name | Priority | Complexity | Estimated Effort | Status |
|------------|--------------|----------|------------|------------------|--------|
| FEAT-001   | Search       | High     | Low        | 2-3 days         | ✅ Complete |
| FEAT-002   | Episodes     | High     | Medium     | 3-4 days         | ✅ Complete |
| FEAT-003   | Info         | Medium   | Low        | 2-3 days         | ✅ Complete |
| FEAT-004   | Favorite     | Medium   | Medium     | 3-4 days         | ✅ Complete |
| FEAT-005   | Recent       | Medium   | High       | 4-5 days         | ✅ Complete |

**Total Estimated Effort:** 14-19 days

## Recommended Build Sequence

### Phase 1: Foundation and Discovery (FEAT-001) ✅
**Feature:** Search Command
**Duration:** 2-3 days
**Status:** Complete

> **Implementation Note:** Phase 1 completed successfully. The search command is now available with support for title-only search, result limiting, and comprehensive error handling. All deliverables have been implemented and tested.

#### Rationale
- **Foundation first**: Search is the entry point for discovering podcasts
- **Simplest feature**: Straightforward API integration with minimal complexity
- **Validates patterns**: Establishes CLI patterns that other features will follow
- **High value**: Immediately useful for podcast discovery
- **No dependencies**: Standalone feature requiring no other features

#### Implementation Steps
1. Add new `search` command to CLI router
2. Create search command handler module
3. Implement query parsing and validation
4. Implement CLI options:
   - `--max <number>` - Max results (default: 10, range: 1-100)
   - `--title-only` - Search titles only (uses `searchByTitle()` instead of `searchByTerm()`)
   - `--similar` - Include similar matches (fuzzy matching)
   - `--language <code>` - Filter by language code (may require client-side filtering if not supported by API)
5. Integrate with `PodcastIndexClient.searchByTerm()` and `searchByTitle()`
6. Implement result formatting and display (title, author, episode count, language, feed URL, description truncated to ~200 chars)
7. Add error handling
8. Write unit and integration tests
9. Update documentation and help text

#### Deliverables
- ✅ `src/commands/search.ts` - Search command implementation
- ✅ `src/formatters/search-formatter.ts` - Search result formatting
- ✅ `tests/commands/search.test.ts` - Tests
- ✅ Updated `README.md` with search examples

---

### Phase 2: Preview Capability (FEAT-002) ✅
**Feature:** Episodes Command
**Duration:** 3-4 days
**Status:** Complete

> **Implementation Note:** Phase 2 completed successfully. The episodes command is now available with support for feed URL/ID detection, date filtering, duration formatting, and HTML stripping from descriptions. All deliverables have been implemented and tested.

#### Rationale
- **Natural progression**: After finding a podcast, users want to preview episodes
- **Moderate complexity**: Introduces date formatting and duration parsing
- **High value**: Essential for informed downloading decisions
- **Builds on Phase 1**: Reuses formatting patterns from search
- **No dependencies**: Standalone feature, doesn't require favorites

#### Implementation Steps
1. Add new `episodes` command to CLI router
2. Create episodes command handler module
3. Implement feed URL/ID detection logic (numeric = ID, URL = feed URL)
4. Implement CLI options:
   - `--max <number>` - Max episodes (default: 20, range: 1-100)
   - `--since <date>` - Only episodes after date (YYYY-MM-DD format, with validation)
   - `--full` - Show full descriptions instead of truncated
5. Integrate with `PodcastIndexClient.getEpisodesByFeedId/Url()`
6. Implement duration formatting utility (seconds to "45 sec", "52 min", "1h 23min")
7. Implement date filtering logic a`nd YYYY-MM-DD format validation
8. Implement episode result formatting (description truncated to ~150 chars by default, at word boundaries)
9. Add HTML stripping for descriptions (strip tags and decode entities)
10. Write unit and integration tests
11. Update documentation

#### Deliverables
- ✅ `src/commands/episodes.ts` - Episodes command implementation
- ✅ `src/formatters/episodes-formatter.ts` - Episode formatting
- ✅ Duration formatting utility (in episodes-formatter.ts)
- ✅ HTML stripping utility (in utils/format.ts)
- ✅ `tests/unit/commands/episodes.test.ts` - Tests
- ✅ Updated `README.md` with episodes examples

---

### Phase 3: Feed Information (FEAT-003) ✅
**Feature:** Info Command
**Duration:** 2-3 days
**Status:** Complete

> **Implementation Note:** Phase 3 completed successfully. The info command is now available with support for feed URL/ID detection, status determination (Active/Inactive/Dead), language code to name conversion, and category hierarchy formatting. All deliverables have been implemented and tested.

#### Rationale
- **Supporting feature**: Complements search and episodes for verification
- **Low complexity**: Simple data display with minimal logic
- **Reuses utilities**: Leverages date formatting from Phase 2
- **Standalone**: No dependencies on other new features
- **Quick win**: Relatively easy to implement after Phases 1-2

#### Implementation Steps
1. Add new `info` command to CLI router
2. Create info command handler module
3. Implement feed URL/ID detection (reuse from episodes)
4. Integrate with `PodcastIndexClient.getPodcastById/Url()`
5. Implement status determination logic:
   - **Dead**: `dead === 1`
   - **Active**: `dead === 0` AND `newestItemPublishTime` within 90 days
   - **Inactive**: `dead === 0` AND `newestItemPublishTime` older than 90 days
   - Note: Use `newestItemPublishTime` instead of `lastUpdateTime` for accurate status
6. Implement language code to name conversion (e.g., "English (en)")
7. Implement category hierarchy formatting
8. Implement info display formatting (title, author, language, episodes, feed ID/URL, website, artwork, description, categories, content type, explicit flag)
9. Note: Detailed activity metrics (episodes in last 3/30/90 days) require additional API call to `getEpisodesByFeedId()` with `since` parameter - may simplify to showing only `newestItemPublishTime` in initial implementation
10. Write unit and integration tests
11. Update documentation

#### Deliverables
- ✅ `src/commands/info.ts` - Info command implementation
- ✅ `src/formatters/info-formatter.ts` - Info formatting
- ✅ `src/utils/language.ts` - Language code utilities
- ✅ `tests/unit/commands/info.test.ts` - Unit tests
- ✅ `tests/unit/formatters/info-formatter.test.ts` - Formatter tests
- ✅ `tests/unit/utils/language.test.ts` - Language utility tests
- ✅ `tests/integration/commands/info.test.ts` - Integration tests
- ✅ Updated `README.md` with info examples

---

### Phase 4: Bookmarking System (FEAT-004) ✅
**Feature:** Favorite Command
**Duration:** 3-4 days
**Status:** Complete

> **Implementation Note:** Phase 4 completed successfully. The favorite command is now available with full subcommand support (add, list, remove, clear), atomic file operations with locking, XDG Base Directory compliance, comprehensive input validation, and network error handling. All deliverables have been implemented and tested.

#### Rationale
- **Prerequisite for Phase 4**: Recent command requires favorites system
- **Moderate complexity**: Involves file I/O, JSON management, validation
- **Foundation for convenience**: Enables power-user workflows
- **Standalone value**: Useful for quick feed URL access
- **Must precede Recent**: Recent command depends on this

#### Implementation Steps
1. Add new `favorite` command group to CLI router with subcommands:
   - `add <feed-url> [--name <name>]` - Add feed with optional custom name
   - `list` - List all favorites
   - `remove <name|url>` - Remove by name or URL
   - `clear [--force]` - Clear all with confirmation (skip with --force)
2. Define favorites file schema and location:
   - Primary: `~/.config/pullapod/favorites.json`
   - Fallback: `~/.pullapod/favorites.json`
   - Support XDG_CONFIG_HOME environment variable: `$XDG_CONFIG_HOME/pullapod/favorites.json`
   - JSON structure: `{version: 1, feeds: [{name, url, feedId, dateAdded}]}`
3. Create favorites storage module
4. Implement file I/O with atomic writes (write to temp, then rename)
5. Implement `add` subcommand:
   - Validate feed URL and query Podcast Index API with `getPodcastByUrl()`
   - Auto-fetch podcast title if `--name` not provided
   - Prevent duplicates by URL and feedId
   - Store: name, url (canonical from API), feedId, dateAdded (ISO 8601)
6. Implement `list` subcommand with formatted display
7. Implement `remove` subcommand with matching logic (exact or partial name match, URL match)
8. Implement `clear` subcommand with confirmation prompt (skip with `--force` flag)
9. Add JSON validation and error recovery
10. Write unit and integration tests
11. Test cross-platform compatibility (Linux, macOS, Windows paths)
12. Update documentation

#### Deliverables
- ✅ `src/commands/favorite.ts` - Favorite command implementation
- ✅ `src/storage/favorites.ts` - Favorites file management
- ✅ `src/formatters/favorite-formatter.ts` - Favorites formatting
- ✅ `tests/unit/commands/favorite.test.ts` - Unit tests
- ✅ `tests/unit/storage/favorites.test.ts` - Storage tests
- ✅ `tests/integration/commands/favorite.test.ts` - Integration tests
- ✅ Updated `README.md` with favorite examples

---

### Phase 5: Aggregate View (FEAT-005) ✅
**Feature:** Recent Command
**Duration:** 4-5 days
**Status:** Complete

> **Implementation Note:** Phase 5 completed successfully. The recent command is now available with support for viewing recent episodes across all favorites, parallel API fetching with rate limiting, date filtering by days, per-feed filtering, and partial failure handling. All deliverables have been implemented and tested.

#### Rationale
- **Highest complexity**: Requires parallel API calls, error handling, aggregation
- **Depends on Phase 5**: Requires favorites system to be complete
- **Premium feature**: Provides significant convenience for regular users
- **Build last**: Can leverage all utilities and patterns from previous phases

#### Implementation Steps
1. Add new `recent` command to CLI router
2. Create recent command handler module with options:
   - `--max <number>` - Max episodes per feed (default: 5, range: 1-20)
   - `--days <number>` - Only episodes from last N days (default: 7, range: 1-90)
   - `--feed <name>` - Show recent episodes from specific saved feed only
3. Implement favorites file loading (reuse from Phase 4)
4. Implement parallel episode fetching with rate limiting:
   - Use `getEpisodesByFeedId()` with `since` parameter for each favorite
   - Limit concurrent API requests to maximum 5 at a time (NFR-5)
   - Calculate `since` timestamp from `--days` option
5. Implement date range calculation and filtering
6. Implement feed name filtering (case-insensitive, partial match) when `--feed` option used
7. Implement episode grouping and sorting logic:
   - Group by podcast
   - Sort podcasts by most recent episode first
   - Within each podcast, sort episodes newest first
8. Implement aggregate result formatting (compact one-line format per episode)
9. Add partial failure handling (skip failed feeds, show warning, continue with others)
10. Write unit and integration tests
11. Test with various feed counts (especially >20 feeds)
12. Update documentation

#### Deliverables
- ✅ `src/commands/recent.ts` - Recent command implementation
- ✅ `src/formatters/recent-formatter.ts` - Recent episodes formatting
- ✅ `tests/unit/commands/recent.test.ts` - Unit tests
- ✅ `tests/unit/formatters/recent-formatter.test.ts` - Formatter tests
- ✅ `tests/integration/commands/recent.test.ts` - Integration tests
- ✅ Updated `README.md` with recent examples

---


## Shared Infrastructure

### Common Utilities (Develop Incrementally)

Build these utilities as needed during each phase:

1. **Date/Time Utilities** (`src/utils/datetime.ts`)
   - Unix timestamp conversion
   - Relative date formatting ("2 days ago")
   - Date validation (YYYY-MM-DD)
   - Developed in: Phase 2 (Episodes)

2. **Formatting Utilities** (`src/utils/format.ts`)
   - Text truncation at word boundaries (important: must not cut mid-word)
   - Add "..." indicator when truncated
   - Number formatting with commas
   - URL formatting (ensure no line wrapping)
   - Developed in: Phase 1 (Search)

3. **Duration Utilities** (`src/utils/duration.ts`)
   - Seconds to human-readable format
   - Developed in: Phase 2 (Episodes)

4. **HTML Utilities** (`src/utils/html.ts`)
   - Strip HTML tags from text (remove all HTML markup)
   - Decode HTML entities (e.g., `&amp;` to `&`, `&#39;` to `'`)
   - Preserve paragraph breaks where appropriate
   - Developed in: Phase 2 (Episodes)

5. **Validation Utilities** (`src/utils/validation.ts`)
   - URL validation (check format, handle variations)
   - Feed ID detection (numeric vs URL)
   - Date format validation (YYYY-MM-DD)
   - Input sanitization
   - Developed in: Phase 1 (Search), extended in Phase 2 (Episodes)

### CLI Infrastructure Updates

Update existing CLI structure:

1. **Command Router** (`src/index.ts`)
   - Add new command handlers incrementally
   - Maintain consistent help text format
   - Update with each phase

2. **Error Handling** (`src/utils/errors.ts`)
   - Standardize error messages
   - Add error codes for different failure types
   - Develop in Phase 1, extend as needed

3. **Configuration** (existing `src/config/`)
   - Reuse existing Podcast Index config
   - Add favorites config path resolution in Phase 4

---

## Testing Strategy

### Unit Testing
- **Coverage goal:** >80% for all new code
- **Test framework:** Jest (existing)
- **Focus areas:**
  - Input validation and parsing
  - Formatting logic
  - Date/time utilities
  - Storage operations (favorites)
  - Error handling

### Integration Testing
- **Test against:** Podcast Index API (use test credentials)
- **Key scenarios:**
  - API success responses
  - API error responses
  - Network failures
  - Rate limiting
  - Invalid inputs

### End-to-End Testing
- **Manual testing:** Required for CLI interaction
- **Test scenarios:**
  - Complete workflows (search → episodes → download)
  - Error recovery
  - Cross-platform compatibility
  - Performance with multiple feeds

---

## Dependencies and Prerequisites

### External Dependencies
- ✅ `PodcastIndexClient` (already implemented)
- ✅ Commander.js (already in use)
- ✅ Configuration system (already implemented)
- ✅ Existing test infrastructure

### New Dependencies (if needed)
- Consider: `cli-table3` for formatted tables (optional)
- Consider: `chalk` for colored output (optional, keep minimal)
- Consider: `inquirer` for confirmations (or use built-in readline)

### Prerequisites
- Podcast Index API credentials configured
- Existing download functionality working
- Test environment with API access

---

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| API rate limiting | High | Medium | Implement request throttling, respect rate limits |
| File corruption (favorites) | Medium | Low | Atomic writes, validation, backup option |
| Cross-platform path issues | Medium | Low | Use Node.js path utilities, test on multiple OS |
| API response format changes | High | Low | Comprehensive error handling, version checking |
| Network timeouts | Medium | Medium | Configurable timeouts, retry logic, clear errors |
| Large favorites list performance | Medium | Low | Limit concurrent requests, add pagination |

---

## Success Criteria

### Per-Feature Criteria
Each feature must meet:
- ✅ All functional requirements from requirements doc
- ✅ >80% test coverage
- ✅ All tests passing
- ✅ Error handling for all specified cases
- ✅ Help text clear and accurate
- ✅ Documentation updated

### Overall Project Success
- ✅ All 5 features implemented and tested
- ✅ Features work together seamlessly
- ✅ No regressions in existing download functionality
- ✅ Consistent CLI patterns across all commands
- ✅ Comprehensive documentation
- ✅ Examples for all commands
- ✅ Clean, maintainable code

---

## Timeline and Milestones

### Week 1-2: Discovery Features
- ✅ **Phase 1: Search command (days 1-3) - COMPLETE**
- ✅ **Phase 2: Episodes command (days 4-7) - COMPLETE**
- ✅ **Phase 3: Info command (days 8-10) - COMPLETE**

**Milestone 1:** Core discovery features complete

### Week 3: Convenience Features
- ✅ **Phase 4: Favorite command (days 11-14) - COMPLETE**
- ✅ **Phase 5: Recent command (days 15-19) - COMPLETE**

**Milestone 2:** All features complete ✅

### Week 4: Polish and Release
- Integration testing
- Documentation completion
- Performance testing
- Bug fixes
- Release preparation

**Milestone 3:** Release-ready

---

## Code Organization

### New Directory Structure

```
src/
├── commands/               # Command handlers
│   ├── search.ts          # Phase 1
│   ├── episodes.ts        # Phase 2
│   ├── info.ts            # Phase 3
│   ├── favorite.ts        # Phase 4
│   └── recent.ts          # Phase 5
├── formatters/            # Output formatting (new)
│   ├── search-formatter.ts
│   ├── episode-formatter.ts
│   ├── info-formatter.ts
│   ├── favorite-formatter.ts
│   └── recent-formatter.ts
├── storage/               # Data persistence (new)
│   └── favorites.ts       # Phase 4
├── utils/                 # Shared utilities
│   ├── datetime.ts        # Phase 2
│   ├── duration.ts        # Phase 2
│   ├── format.ts          # Phase 1
│   ├── html.ts            # Phase 2
│   ├── validation.ts      # Phase 1
│   └── errors.ts          # Phase 1
└── types/                 # Type definitions
    └── commands.ts        # Shared command types (new)

tests/
├── commands/              # Command tests
├── formatters/            # Formatter tests
├── storage/               # Storage tests
└── utils/                 # Utility tests
```

---

## Development Guidelines

### Code Style
- Follow existing project conventions
- Use TypeScript strict mode
- Maintain consistent error handling patterns
- Keep functions small and focused
- Document complex logic

### Commit Strategy
- One feature per branch
- Frequent, small commits
- Clear commit messages
- Reference requirements doc in commits

### Review Process
- Self-review before commit
- Test on multiple scenarios
- Check for edge cases
- Verify documentation accuracy

---

## Post-Implementation

### Documentation Updates
- [x] Update main README.md with all new features
- [x] Add examples for each command
- [x] Update API client documentation if needed
- [ ] Create changelog entry
- [ ] Update package.json version

### Future Enhancements
Track these for future releases:
- JSON output format for all commands
- Interactive mode for episode selection
- Batch operations
- Export/import favorites
- Caching layer for API responses
- Configuration file for command defaults
- Shell completion scripts

---

## Conclusion

This implementation plan provides a logical, incremental approach to building the Podcast Index CLI features. By following the recommended sequence:

1. **Search** establishes patterns and provides immediate value
2. **Episodes** builds on search with preview capabilities
3. **Info** rounds out discovery features
4. **Favorite** provides the foundation for power-user features
5. **Recent** delivers the most complex aggregation feature last

Each phase builds on previous work, allowing for iterative refinement of shared utilities and patterns. The total effort is estimated at 14-19 days of focused development, with built-in milestones for tracking progress.