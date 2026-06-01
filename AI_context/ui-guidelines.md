# UI / UX guidelines

The reference screenshots show *information architecture*, not visual goal.
The actual product should **feel more premium** than the references — closer
to Linear or modern banking apps than a generic admin template. The application uses a **dark theme** as the primary default and emphasizes a modern dashboard feel.

## Visual tokens

Defined in `apps/frontend/tailwind.config.ts`:

| Token              | Hex        | Role                                  |
| ------------------ | ---------- | ------------------------------------- |
| `surface-base`     | `#0b0f17`  | page background                       |
| `surface-raised`   | `#11151f`  | cards                                 |
| `surface-overlay`  | `#161b27`  | modals, popovers                      |
| `surface-border`   | `#212737`  | hairline borders                      |
| `accent`           | `#5b8cff`  | primary action / active state         |
| `income`           | `#22c55e`  | positive amount                       |
| `expense`          | `#ef4444`  | negative amount                       |
| `muted`            | `#7a8499`  | secondary text                        |

Never use pure black. Avoid more than 3 layered surfaces at once.

## Type & spacing

- **Font:** Inter, ss01 + cv11 stylistic alternates enabled.
- **Tabular numbers** for any money value: `class="tabular-nums"`. Always.
- **Card padding:** 20–24 px. Generous whitespace > information density.
- **Border radius:** `rounded-2xl` for cards, `rounded-3xl` for modals
  and bottom sheets, `rounded-full` for chips and progress bars.

## Motion

- Default easing: `cubic-bezier(0.22, 1, 0.36, 1)` (exposed as `ease-smooth`).
- Durations: 150 ms (hover/tap), 200–250 ms (modal in/out), 400–500 ms
  (chart transitions). Anything > 500 ms feels sluggish.
- All entering content should animate **in**, not snap. Use the global
  `fade` route transition + per-component `transition-transform` on modals.

## Modals (load-bearing UX choice)

CRUD flows happen in **overlay modals**, never on separate pages:

- Backdrop: `bg-black/50 backdrop-blur-xs` (defined as `.modal-shell`).
- Panel: `rounded-t-3xl` on mobile (bottom sheet), `rounded-3xl` on
  desktop (centered card). Both use `shadow-modal`.
- Form fields are full-width on mobile, two columns on `sm:` and above.
- Primary action lives at the bottom-right on desktop and bottom-stretched
  on mobile.

## Loading states

- Skeleton screens (`.skeleton`) — never spinners — for any panel that
  loads server data. Use the same panel dimensions so layout doesn't
  shift on resolve.
- Chart panels show a stylized dotted axis while data loads.

## Charts

- Donut: 60% inner radius, 8 px gap between arcs, white-on-color labels.
- Line: 2 px stroke, 16 px tick spacing, prior-period dashed in `muted`.
- Always include the actual numeric value next to the chart label —
  legends alone are not enough for an at-a-glance read.

## Modern Dashboard Patterns

- **Quick Actions**: Prominent, easily accessible buttons (often floating or at the top of the feed) to perform common tasks like adding a transaction or navigating to investments.
- **Empty States**: Never show just a blank screen. Empty states should have an illustration or a clear message, alongside a direct call to action (CTA) to create the first entity.
- **Cards**: Use elevated cards for distinct visual hierarchies, combining `surface-raised` with `shadow-modal` for focus.
