# Liberty Unquenched Content Editor

Standalone visual editor for the main game's content definitions.

## Start

From the repository root:

```bash
npm run editor
```

Or from this folder:

```bash
npm run dev
```

The editor runs on port `3001` and imports the live game definitions from:

- `../src/game/events`
- `../src/game/advisors`
- `../src/game/journal`
- `../src/game/action_affairs`
- `../src/game/government_affairs`
- `../src/game/military_affairs`

Edits are kept as a browser-local draft and can be exported/imported as JSON.
When the editor is running through `npm run editor`, the Save button also writes
the current draft to:

```text
editor/saved-drafts/content-draft.json
```

The editor supports creating new events, advisors, journals, and Action /
Government / Military cards. Scripted source effects are preserved as markers;
new editable effects are stored as preset-based draft effects.

Event drafts preserve and expose the editor-only metadata fields `category`,
`flow`, `series`, and `tags`. The editor also recognizes inherited metadata
objects such as `inline.node` and `inline.leaf` definitions built with object
spread. These metadata fields are for classification, flow visualization, and
review; the main game runtime does not use them as event trigger logic.

Card drafts preserve condition-source snippets, availability text, cooldown /
timer annotations, and detected `currentEvent` / `pendingEvents` targets. The
card generator emits executable condition snippets and supported preset effects;
category-specific timers, dynamic transitions, and unsupported top-level fields
remain explicit warnings for manual review.

On the Cards tab, `Emit TS` downloads a real `.generated.ts` / `.generated.tsx`
file and, when the Vite editor server is running, writes it into the matching
`src/game/{action_affairs,government_affairs,military_affairs}` directory without
overwriting the original file. Existing cards keep their original condition and
effect source; preset effects are compiled into the output for newly created
cards. The generated export still needs to be added to the relevant `index.ts`
array before it becomes part of the game's card library.

On the Events tab, `Emit Event TS` creates a `.generated.ts` copy under
`src/game/events` without overwriting the original file. New event drafts emit
their metadata, date, condition source, bilingual options, preset effects, and
explicit successor references when those references resolve to an event export.
Existing event copies preserve their handwritten condition/effect/options and
report those merge limitations as warnings.

The Test tab supports Historical, Easy, Normal, Hard, and Sandbox difficulty
modes. `Check Trigger` uses the game's `shouldQueueEvent` semantics against the
manually selected target year/month: Historical uses exact dates for dated
events, while the other modes require a true condition and ignore date-only
scheduling. Direct event resolution remains available for inspecting chain
nodes and manually entered events.
