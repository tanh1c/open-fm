# WASM FM

A browser-based football manager game built from Openfoot Manager, now running the Rust game engine through WebAssembly inside a React/Vite web app.

## What this app includes

- Football manager gameplay with squads, contracts, transfers, staff, training, scouting, inbox, news, finances, fixtures, and live match flow.
- Rust simulation/game-state engine compiled to WebAssembly with `wasm-pack`.
- React 19 + TypeScript frontend powered by Vite.
- Tailwind CSS v4 styling with a dark dashboard/Home chrome inspired by the provided frontend template.
- Local browser persistence through the engine/database WASM runtime.
- Multi-language UI support through i18next.
- Vitest test coverage for UI, helpers, and game-facing flows.

## Tech stack

- **Frontend:** React 19, TypeScript 6, Vite 8, Tailwind CSS 4
- **State/UI:** Zustand, React Router, lucide-react, i18next/react-i18next
- **Engine:** Rust workspace compiled to WebAssembly
- **WASM bridge:** `wasm-bindgen`, `wasm-pack`, Comlink worker wrapper
- **Testing:** Vitest, Testing Library, jsdom

## Repository layout

```text
.
├── src/                         # React frontend
│   ├── components/              # UI, layout, Home/dashboard widgets
│   ├── core/                    # WASM worker bridge and generated command map
│   ├── pages/                   # Dashboard and app pages
│   └── store/                   # Game state store/types
├── src-engine/                  # Rust engine and WASM AppHandle wrapper
│   ├── crates/                  # Engine/domain/db workspace crates
│   └── src/app_handle/          # WASM command surface used by the web app
├── scripts/
│   ├── build-engine-wasm.mjs    # Runs wasm-pack for src-engine
│   └── generate-engine-commands.mjs
├── wasm-pkg-app/                # Generated wasm-pack output, ignored by git
└── dist/                        # Production build output, ignored by git
```

## Requirements

Install these before running the project:

1. **Node.js** 20+ recommended.
2. **Rust** via `rustup`.
3. **wasm-pack**:

   ```bash
   cargo install wasm-pack
   ```

4. **C/C++ toolchain with clang** for the SQLite WASM dependency.
   - On Windows, install LLVM so `clang.exe` exists at `C:/Program Files/LLVM/bin/clang.exe`, or set `CC` manually before building.
   - On macOS/Linux, ensure `clang` is available on `PATH`.

## Setup

```bash
git clone https://github.com/tanh1c/wasm-fm.git
cd wasm-fm
npm install
```

## Development

Start the Vite dev server:

```bash
npm run dev
```

The app runs as a web app. Vite prints the local URL, commonly `http://127.0.0.1:1420/` in this project setup.

If the generated WASM package or command map is missing, build the engine once:

```bash
npm run build:engine
```

## Build

Create a production build:

```bash
npm run build
```

`npm run build` automatically runs:

1. `npm run build:engine`
2. `tsc`
3. `vite build`

The engine build generates `wasm-pkg-app/openfootmanager_lib.js`, `openfootmanager_lib_bg.wasm`, and `src/core/engineCommands.generated.ts`. The WASM package is generated output and is intentionally not committed.

## Tests and checks

Run the full test suite:

```bash
npm test
```

Run type checking:

```bash
npx tsc --noEmit
```

Run the i18n audit:

```bash
npm run audit:i18n
```

Recommended verification before pushing changes:

```bash
npx tsc --noEmit
npx vitest run
npm run build
```

## Available scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start Vite dev server |
| `npm run build:engine` | Compile Rust engine to WASM and regenerate command bindings |
| `npm run build` | Build WASM engine, typecheck, and create production bundle |
| `npm test` | Run Vitest suite |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run audit:i18n` | Audit translation coverage |
| `npm run preview` | Preview the production build locally |

## Notes for contributors

- Keep game logic in the existing Rust/application/data adapters; UI styling changes should not introduce mock production data.
- Do not commit generated `wasm-pkg-app` artifacts or `dist` output.
- After changing Rust `AppHandle` methods, run `npm run build:engine` so `src/core/engineCommands.generated.ts` stays in sync.
- Avoid adding charting/template-only dependencies unless the app genuinely needs them; the current Home dashboard uses inline SVG widgets.

## License

Openfoot Manager is licensed under the GPLv3. See [LICENSE.md](LICENSE.md) for details.
