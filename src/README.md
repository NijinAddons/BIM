# Source Structure

This app uses a flat, type-based structure.

## Folders

- `screens/`: screen-level UI.
- `components/`: reusable UI components.
- `navigation/`: app navigation (stack/tab navigators, route types).
- `services/`: API clients, auth, payments, storage, Frappe, notifications,
  location, and other integrations with external systems or device
  capabilities.
- `hooks/`: reusable logic and hooks.
- `utils/`: helper functions.
- `constants/`: app constants and config (including design tokens).
- `assets/`: static images, fonts, icons, SVGs, and animation files.
- `types/`: global or ambient TypeScript declarations.
- `store/`: app-wide Redux/store setup.
- `App.tsx`: root app component.

## Rules

- Keep screens flat in `screens/`; co-locate a screen's `.styles.ts` /
  `.helpers.ts` files next to it using the same base name.
- Keep network, storage, auth, payment, and device integrations in
  `services/`.
- Prefer a shared `components/` entry over duplicating UI across screens.
