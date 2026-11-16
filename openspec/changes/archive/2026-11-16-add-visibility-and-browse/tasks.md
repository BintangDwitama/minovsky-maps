## 1. Server: data and facets

- [x] 1.1 Migration `0004_visibility.sql`: visibility (default 'link' for existing rows), listed_at, facet columns, browse indexes
- [x] 1.2 `scenario.Facets(doc)` (pure, tested): name, description, rectangle width and height, hex count, deployment, squad size, has elevation; a conformance case shared with the web's `rectangleSize`
- [x] 1.3 Repositories (memory and Postgres): Create with visibility and facets; AddVersion updates facets and updated_at; SetVisibility (sets listed_at when it becomes public); visibility in Latest and ListOwned; Claim keeps 'link'
- [x] 1.4 Startup facet backfill (Postgres, batches of 100, after listening); integration test on the dev branch

## 2. Server: rules and API

- [x] 2.1 `publishing`: Visibility type; Publish(owner, visibility, doc) defaulting to private; one lookup gate with a viewer (private hidden from non-owners) used by Get, Update, Delete, SetVisibility; SetVisibility owner only; tests
- [x] 2.2 Reports: `ScenarioName` treats private as not found; test
- [x] 2.3 Browse: repository query (filters, `q` escaping, sort, keyset cursor, page of 24, latest document); service validation of parameters; tests for each filter, the cursor's stability, and private and link exclusion
- [x] 2.4 HTTP: POST takes visibility; `PATCH /api/scenarios/{id}`; GET adds visibility for the owner and 404 for private non-owners; `/api/me/scenarios` adds visibility; `GET /api/browse` with a "browse" rate-limit bucket and 400 on invalid parameters; handler tests including "no email or account id in browse"

## 3. Web: application and adapters

- [x] 3.1 Ports: Visibility; publish with visibility; setVisibility; fetch visibility; OwnedScenario.visibility; ScenarioBrowser port and BrowseQuery and result types
- [x] 3.2 `application/visibility.ts` (labels, default) and `application/browse.ts` (BrowseQuery parse and serialize to the URL, pure, tested); publishScenario with visibility; changeVisibility; tests
- [x] 3.3 Adapters: HttpScenarioPublisher (visibility, setVisibility), HttpScenarioBrowser; tests

## 4. Web: saving and visibility UI

- [x] 4.1 VisibilityPicker molecule (radio group, icon and text per option, 44 px on touch)
- [x] 4.2 SaveOnlineDialog (confirm with the picker defaulting to Only me; done with the link and a live picker; Update online states); toolbar and Menu labels "Save online" and "Update online"; sign-in prompt wording
- [x] 4.3 My scenarios: visibility badge and a select that saves on change
- [x] 4.4 Published sheet: owner banner for private scenarios with an inline picker; Browse link

## 5. Web: Browse

- [x] 5.1 Router `/browse`; BrowsePage with BrowseFilters (state in the URL), grid, Load more, empty state with Clear filters, waking notice, error and retry
- [x] 5.2 ScenarioCard (link to the sheet, verified author, size and deployment) and BoardThumbnail (BoardView, lazy via IntersectionObserver, accessible label)
- [x] 5.3 Toolbar "Browse" button (desktop) and Menu item (compact)

## 6. Docs and verification

- [x] 6.1 README: visibility levels, Browse, the takedown SQL still applies
- [x] 6.2 `go test ./...`, `go vet`, gofmt and web lint, typecheck, test, check:types and build pass
- [x] 6.3 Local end-to-end (DEV_FAKE_SIGNIN): save as Only me (stranger gets 404, report 404), switch to link (opens), switch to Everyone (appears in Browse, filters and search find it, Load more), switch back (disappears), My scenarios select, sheet banner; existing scenarios stay link
- [x] 6.4 Phone check of Browse (cards, filters, lazy thumbnails) and of the save dialog
- [x] 6.5 After deploy: the same on pages.dev with the real Google sign-in
