# God Mode — Implementation Plan

**Date:** 2026-05-31
**Status:** In progress

## Goal

Game hiện chỉ có một chế độ: manager career. Thêm **God Mode** — một công tắc toàn cục cho phép:

1. Bật/tắt God Mode trong Settings (mặc định tắt, game chạy như cũ).
2. Xem toàn bộ chỉ số thật của **mọi** cầu thủ, bỏ qua giới hạn scouting/quyền sở hữu CLB.
3. Chỉnh sửa cầu thủ khi God Mode bật — **toàn bộ** gồm 18 chỉ số gốc, condition/morale/fitness/potential, wage/market_value/contract_end, vị trí, ngày sinh (tuổi), và **đổi CLB**.

## Quyết định thiết kế (đã chốt với user)

- **Toggle**: global app setting, lưu `god_mode: bool` trong `AppSettings` (app.db, key `settings:json`). Không thuộc dữ liệu từng save.
- **Reveal**: áp cho mọi cầu thủ, thuần frontend (`reveal = isOwnClub || godMode`), không gọi engine, không mutate dữ liệu scouting.
- **Edit scope**: toàn bộ kể cả `team_id` (đổi CLB).
- **Derived**: sau khi sửa, gọi `refresh_player_derived(player, current_year)` để tính lại `ovr`/`potential`/`traits`. Lưu ý hàm này giữ nguyên `potential` nếu đã >0 (chỉ clamp `>= ovr`), nên set potential trước rồi refresh sẽ tôn trọng giá trị mới.
- **Backend guard**: lệnh `editPlayer` KHÔNG chặn cứng theo god_mode (giống các lệnh khác); UI ẩn editor khi tắt là đủ.

## Kiến trúc liên quan

- WASM-only: Rust engine → WASM trong Web Worker, gọi qua `invoke('snake_case_cmd', {args})` (shim Tauri-compatible).
- `AppHandle` là entry `#[wasm_bindgen]`; command theo domain ở `src-engine/src/app_handle/*.rs`.
- Mutation pattern: `snapshot_game()` → mutate clone → `self.state.set_game(game.clone())` → `to_js_value(&game)`. Auto-save lo việc ghi đĩa (mẫu `set_player_squad_role` không gọi `save_game`).
- `current_year` = `game.clock.current_date.year()`.

---

## Phase A — Settings flag (toggle toàn cục)

- [ ] A1. `src-engine/src/app_handle/settings.rs`: thêm `#[serde(default)] pub god_mode: bool` vào struct `AppSettings`; `god_mode: false` trong `impl Default`.
- [ ] A2. `src/store/settingsStore.ts`: thêm `god_mode: boolean` vào interface `AppSettings` + `DEFAULT_SETTINGS` (`mergeWithDefaultSettings` tự lo save cũ → false).
- [ ] A3. `src/pages/Settings.tsx`: thêm `SettingRow` + `Toggle` (mirror `high_contrast`), `onChange` → `updateSettings({ god_mode: v })`.
- [ ] A4. i18n: thêm key label + description God Mode cho 8 locale (`en, de, es, fr, it, pt, pt-BR, zh-CN`).

## Phase B — Reveal chỉ số (thuần frontend)

- [ ] B1. `PlayerProfileAttributesCard.tsx`: thêm prop `godMode?: boolean`; đổi gate `isOwnClub ?` → `reveal = isOwnClub || godMode`.
- [ ] B2. `PlayerProfile.tsx`: đọc `godMode = useSettingsStore((s) => s.settings.god_mode)`; truyền xuống Attributes card; mở khóa OVR/potential/giá trị ẩn ở hero/contract card khi godMode.
- [ ] B3. Rà các chỗ gate khác (Scouting / Transfers / Squad / DashboardWorkspaceContent) để reveal đồng bộ nếu cần.

## Phase C — Edit command (engine, sửa toàn bộ kể cả CLB)

- [ ] C1. Tạo `src-engine/src/app_handle/god_mode.rs`:
  - `#[derive(Deserialize)] struct PlayerEdits` — mọi field optional:
    - `attributes: Option<AttributeEdits>` (18 attr, mỗi field `Option<i64>` → `clamp(0,100) as u8`)
    - `condition/morale/fitness/potential: Option<i64>` (clamp 0..100)
    - `position/natural_position: Option<String>` (parse enum `Position`)
    - `date_of_birth: Option<String>`
    - `team_id: Option<Option<String>>` (phân biệt "không đổi" vs "free agent")
    - `wage: Option<u32>`, `market_value: Option<u64>`, `contract_end: Option<Option<String>>`
  - `fn clamp_attr(v: i64) -> u8 { v.clamp(0,100) as u8 }`
  - helper parse `Position` từ string (lỗi → `be.error.invalidPosition`).
- [ ] C2. Lệnh `#[wasm_bindgen(js_name = editPlayer)] pub fn edit_player(&self, player_id: String, edits: JsValue) -> Result<JsValue, JsValue>`:
  - deserialize `PlayerEdits` (lỗi → `be.error.deserialize`)
  - `snapshot_game()` (None → `be.error.noActiveGameSession`)
  - tìm index player (không thấy → `be.error.playerNotFound`, return sớm, không đổi gì)
  - lưu `old_team_id`; áp edits + clamp; parse vị trí
  - nếu `team_id` đổi: gỡ player khỏi `starting_xi_ids` của **đội cũ** (mẫu `set_player_squad_role`); KHÔNG tự thêm vào XI đội mới
  - `refresh_player_derived(&mut player, game.clock.current_date.year())`
  - `self.state.set_game(game.clone())` → `to_js_value(&serde_json::json!({ "game": game }))` (hoặc trả game trực tiếp — thống nhất với service)
- [ ] C3. `src-engine/src/app_handle/mod.rs`: khai báo `mod god_mode;`.
- [ ] C4. `npm run build:engine` → sinh binding `edit_player` → `editPlayer` trong `engineCommands.generated.ts`.

## Phase D — Edit UI

- [ ] D1. `src/services/attributeService.ts`: `editPlayer(playerId, edits)` wrap `invoke<{ game: GameStateData }>("edit_player", { playerId, edits })`.
- [ ] D2. `src/components/playerProfile/PlayerProfileAttributeEditor.tsx`: form chỉ render khi `godMode`:
  - input số 0–100 cho 18 attr + condition/morale/fitness/potential
  - select `position` + `natural_position`
  - input `date_of_birth`
  - select CLB từ `gameState.teams` (+ option free agent)
  - input `wage` / `market_value` / `contract_end`
  - submit → gom field thay đổi → `editPlayer` → `onGameUpdate(result.game)`
- [ ] D3. Wire vào `PlayerProfile.tsx`: mount editor khi `godMode` bật; ẩn khi tắt.

## Verify

1. `npx tsc --noEmit`
2. `npx vitest run` (+ test mới nếu thêm)
3. `cargo test --manifest-path src-engine/Cargo.toml`
4. Manual:
   - Bật toggle trong Settings → reveal mọi cầu thủ (kể cả đội khác)
   - Tắt toggle → quay lại che chỉ số theo scouting
   - Edit chỉ số → OVR cập nhật ngay
   - Đổi CLB → đội cũ không còn player trong starting XI; player thuộc squad đội mới
   - Reload save → chỉnh sửa vẫn còn

## Ghi chú

- Không tạo lại `.kiro` spec (đã xóa). Plan track ở file này.
- Không phá game logic hiện có; chỉ thêm field/command mới, đều `#[serde(default)]` để save cũ load không lỗi.
