# Implementation Plan: God Mode

## Overview

Triển khai God Mode theo hai mối quan tâm tách biệt như trong design:

- **Settings flag (`god_mode`)** — thêm trường vào `AppSettings` ở cả frontend (`settingsStore.ts`) và engine (`settings.rs`), cùng một toggle trong `Settings.tsx`. Tận dụng cơ chế optimistic + rollback và `mergeWithDefaultSettings` sẵn có.
- **Reveal (frontend-only)** — mở cổng hiển thị bằng `reveal = isOwnClub || godMode` trong `PlayerProfileAttributesCard`, không gọi engine.
- **Edit (engine)** — lệnh `edit_attributes` mới trong module `god_mode.rs`: deserialize → snapshot → tìm cầu thủ → clamp 0..100 → `refresh_player_derived` → `set_game` → `save_game` → trả về game; kèm UI `PlayerProfileAttributeEditor` và service bao bọc `invoke`.

Các property test (P1–P10) trong design được hiện thực hóa bằng `proptest` (Rust) và `fast-check` (TypeScript), mỗi property là một sub-task riêng, đặt sát code mà chúng kiểm tra.

## Tasks

- [ ] 1. Thêm God_Mode_Flag vào mô hình dữ liệu settings (frontend + engine)
  - [ ] 1.1 Thêm `god_mode` vào `AppSettings` frontend và default
    - Thêm `god_mode: boolean` vào interface `AppSettings` trong `src/store/settingsStore.ts`
    - Thêm `god_mode: false` vào `DEFAULT_SETTINGS`; dựa vào `mergeWithDefaultSettings` để save cũ thiếu trường nhận `false`
    - _Requirements: 1.4_

  - [ ]* 1.2 Viết property test cho default settings (fast-check)
    - **Property 8: Settings missing god_mode default to false**
    - Sinh partial settings bỏ `god_mode` (gồm legacy không có trường liên quan); kiểm `mergeWithDefaultSettings(...).god_mode === false` và load không lỗi
    - _Validates: Requirements 1.4, 6.4_

  - [ ] 1.3 Thêm `god_mode` vào `AppSettings` của engine với serde default
    - Thêm `#[serde(default)] pub god_mode: bool` vào struct `AppSettings` trong `src-engine/src/app_handle/settings.rs` và `god_mode: false` trong `impl Default`
    - Đảm bảo save cũ thiếu trường vẫn parse được
    - _Requirements: 6.4_

- [ ] 2. Toggle God Mode trong Settings và hành vi persist của store
  - [ ] 2.1 Thêm toggle God Mode vào `Settings.tsx`
    - Thêm `SettingRow` + `Toggle` bound vào `settings.god_mode`, `onChange` gọi `updateSettings({ god_mode: v })` (theo mẫu các toggle hiện có)
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ]* 2.2 Viết unit test cho hiển thị toggle
    - Render `Settings` với `god_mode` true/false và xác nhận toggle phản ánh đúng trạng thái
    - _Requirements: 1.1_

  - [ ]* 2.3 Viết property test cho persist toggle (fast-check)
    - **Property 10: Toggling persists the requested flag value**
    - Sinh prior settings + boolean `v`; sau `updateSettings({ god_mode: v })`, in-memory và persisted có `god_mode === v` và `save_settings` được gọi
    - _Validates: Requirements 1.2, 1.3_

  - [ ]* 2.4 Viết property test cho rollback khi persist thất bại (fast-check)
    - **Property 9: Failed persistence rolls back the in-memory flag**
    - Sinh prior settings; khi `save_settings` reject, kiểm in-memory settings được khôi phục về giá trị trước đó
    - _Validates: Requirements 1.5_

- [ ] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Hé lộ chỉ số (reveal gating, frontend-only)
  - [ ] 4.1 Thêm prop `godMode` và cổng reveal vào `PlayerProfileAttributesCard`
    - Thêm prop `godMode?: boolean`; thay nhánh `isOwnClub ?` bằng `reveal = isOwnClub || godMode` để render giá trị thật khi reveal, giữ placeholder `??` khi không
    - Không gọi lệnh engine; không mutate dữ liệu trinh sát
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3_

  - [ ] 4.2 Truyền `god_mode` từ store qua `PlayerProfile` xuống card
    - Đọc `godMode = useSettingsStore((s) => s.settings.god_mode)` trong `PlayerProfile.tsx`; truyền xuống `PlayerProfileAttributesCard` (gồm `ovr`/`potential`); dựa vào re-render của selector để cập nhật trong cùng chu kỳ render khi toggle
    - _Requirements: 2.3, 2.4, 3.4_

  - [ ]* 4.3 Viết property test cho reveal gating (fast-check + Testing Library)
    - **Property 7: Reveal gating is a pure function of god mode and ownership**
    - Sinh player + `isOwnClub` + `godMode`; kiểm reveal ⇔ (`godMode || isOwnClub`), obscure ngược lại, và props player/scouting đầu vào không bị mutate
    - _Validates: Requirements 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4_

- [ ] 5. Edit_Attributes_Command — lõi engine
  - [ ] 5.1 Tạo module `god_mode.rs`: `AttributeEdits`, helper clamp, đăng ký lệnh
    - Tạo `src-engine/src/app_handle/god_mode.rs` với struct `#[derive(Deserialize)] AttributeEdits` (19 trường `Option<i64>`) và `fn clamp_attr(v: i64) -> u8 { v.clamp(0, 100) as u8 }`
    - Khai báo `mod god_mode;` trong `src-engine/src/app_handle/mod.rs`
    - _Requirements: 4.3, 5.4_

  - [ ] 5.2 Hiện thực `edit_attributes` (không tính persistence)
    - Thêm `#[wasm_bindgen(js_name = editAttributes)] pub fn edit_attributes(&self, player_id: String, attributes: JsValue) -> Result<JsValue, JsValue>`
    - Trình tự: deserialize `AttributeEdits` (lỗi → `be.error.deserialize:{e}`) → `snapshot_game()` (None → `be.error.noActiveGameSession`) → tìm cầu thủ (không thấy → `be.error.playerNotFound`, return sớm) → áp `Some(v)` với `clamp_attr` → `refresh_player_derived(player, game.clock.current_date.year())` → `self.state.set_game(game.clone())` → trả về `{ "game": game }`
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 5.2, 5.3, 5.4_

  - [ ]* 5.3 Viết property test clamp (proptest)
    - **Property 1: Edit clamps every attribute into 0..100**
    - Sinh giá trị `i64` gồm âm và >100; sau edit thành công, mọi field stored ∈ [0,100] và bằng `clamp(requested, 0, 100)`; field không sửa giữ nguyên
    - _Validates: Requirements 4.3_

  - [ ]* 5.4 Viết property test tái tính derived (proptest)
    - **Property 2: Edit recomputes derived ratings from clamped attributes**
    - So `ovr`/`potential`/`traits` sau edit với kết quả `refresh_player_derived` áp trên player giữ attributes đã clamp
    - _Validates: Requirements 4.4_

  - [ ]* 5.5 Viết property test active-game phản ánh và trả về edit (proptest)
    - **Property 3: Successful edit is reflected in and returned with the Active_Game**
    - Sau edit, game trả về và một lần đọc Active_Game tiếp theo đều chứa giá trị attributes đã clamp
    - _Validates: Requirements 4.5, 4.6_

  - [ ]* 5.6 Viết property test id không tồn tại (proptest)
    - **Property 5: Unknown player id errors and leaves the Active_Game unchanged**
    - Sinh id không khớp; kiểm trả lỗi mô tả và `Game` trước/sau (qua serialize) bằng nhau
    - _Validates: Requirements 5.2_

  - [ ]* 5.7 Viết property test input không deserialize được (proptest)
    - **Property 6: Non-deserializable input errors and leaves the Active_Game unchanged**
    - Sinh payload có trường phi số; kiểm lỗi deserialize và `Game` không đổi
    - _Validates: Requirements 5.4_

  - [ ]* 5.8 Viết unit test không có Active_Game
    - Không có Active_Game ⇒ `edit_attributes` trả `be.error.noActiveGameSession` và không thay đổi gì (single-execution test)
    - _Requirements: 5.3_

- [ ] 6. Lưu bền vững các chỉnh sửa
  - [ ] 6.1 Persist Active_Game đã chỉnh sửa vào save SQLite
    - Trong `edit_attributes`, sau `set_game`, lấy `save_id` hiện hành từ `StateManager` và gọi `save_manager.save_game(&game, &save_id)`; lỗi lock → `be.error.saveManagerUnavailable`
    - _Requirements: 6.1_

  - [ ]* 6.2 Viết property test round-trip lưu/đọc (proptest + tempfile)
    - **Property 4: Edits survive a save/reload round-trip**
    - Edit → `save_game` → `load_game`; kiểm attributes của cầu thủ bằng giá trị đã clamp và `Derived_Rating` nhất quán với attributes đó
    - _Validates: Requirements 6.1, 6.2, 6.3_

- [ ] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Attribute_Editor UI, service và wiring
  - [ ] 8.1 Tạo `attributeService.ts` bao bọc lệnh edit
    - Tạo `src/services/attributeService.ts` với `editPlayerAttributes(playerId, attributes)` bọc `invoke<{ game: GameStateData }>('edit_attributes', { playerId, attributes })` (theo mẫu `contractService.ts`)
    - _Requirements: 4.2_

  - [ ] 8.2 Tạo component `PlayerProfileAttributeEditor`
    - Tạo `src/components/playerProfile/PlayerProfileAttributeEditor.tsx` nhận `player`, `attrGroups`, `onSubmit(attributes)`; render input số (0–100) cho mỗi `Player_Attribute` (gồm nhóm Goalkeeper khi áp dụng); khi submit gom giá trị thành object và gọi `onSubmit`
    - _Requirements: 4.1_

  - [ ] 8.3 Wire editor vào `PlayerProfile`
    - Khi `godMode` bật, mount `PlayerProfileAttributeEditor`; thêm `handleEditAttributes(values)` gọi `editPlayerAttributes(...)` rồi `onGameUpdate(result.game)`; khi `godMode` tắt thì không mount editor
    - _Requirements: 4.1, 4.2, 5.1_

  - [ ]* 8.4 Viết unit test cho editor và wiring
    - Editor render đúng một input cho mỗi chỉ số (4.1); submit gọi `invoke('edit_attributes', { playerId, attributes })` với đúng giá trị, mock `invoke` (4.2); `godMode=false` ⇒ editor không được mount (5.1)
    - _Requirements: 4.1, 4.2, 5.1_

- [ ] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional (unit/property/integration tests) and can be skipped for a faster MVP.
- Each task references granular requirement clauses for traceability; property test tasks reference the exact property from the design's Correctness Properties section.
- Property tests dùng `proptest` (Rust, `[dev-dependencies]`) và `fast-check` (TS, `devDependencies`), tối thiểu 100 vòng mỗi test, mỗi test gắn comment `Feature: god-mode, Property {number}: {property_text}`.
- Reveal là frontend-only và là hàm thuần của props; edit luôn biến đổi trên bản clone từ `snapshot_game()` và chỉ `set_game` sau khi validate/clamp/recompute thành công, đảm bảo "không đổi khi lỗi".
- Sau khi build engine (`npm run build:engine`), lệnh xuất hiện trong `engineCommands.generated.ts` (ánh xạ `edit_attributes` → `editAttributes`, thứ tự args `["playerId", "attributes"]`).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.3", "4.1", "5.1", "8.1", "8.2"] },
    { "id": 1, "tasks": ["1.2", "2.1", "4.2", "4.3", "5.2"] },
    { "id": 2, "tasks": ["2.2", "2.3", "6.1", "8.3"] },
    { "id": 3, "tasks": ["2.4", "5.3", "8.4"] },
    { "id": 4, "tasks": ["5.4"] },
    { "id": 5, "tasks": ["5.5"] },
    { "id": 6, "tasks": ["5.6"] },
    { "id": 7, "tasks": ["5.7"] },
    { "id": 8, "tasks": ["5.8"] },
    { "id": 9, "tasks": ["6.2"] }
  ]
}
```
