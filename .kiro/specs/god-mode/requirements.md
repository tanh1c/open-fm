# Requirements Document

## Introduction

Hiện tại trò chơi chỉ có một chế độ: người chơi đóng vai huấn luyện viên/giám đốc (manager career mode). Mọi chỉ số chi tiết của cầu thủ bị ẩn theo mặc định và chỉ được hé lộ dần qua hệ thống trinh sát (scouting) — chỉ cầu thủ thuộc câu lạc bộ của người chơi mới hiển thị chỉ số đầy đủ.

Tính năng "God Mode" (Chế độ Toàn năng) bổ sung một công tắc bật/tắt cho phép người chơi:

1. Bật/tắt God Mode (mặc định trò chơi vẫn chạy ở manager career mode).
2. Xem toàn bộ chỉ số thật của mọi cầu thủ, bỏ qua giới hạn hiển thị của hệ thống trinh sát.
3. Chỉnh sửa chỉ số của cầu thủ khi God Mode đang bật.

Tài liệu này định nghĩa các yêu cầu cho tính năng đó, đặt trong kiến trúc hiện có: frontend React + TypeScript, engine Rust biên dịch sang WASM chạy trong Web Worker (giao tiếp qua Comlink bằng `invoke('snake_case_cmd', {args})`), lưu trữ bằng SQLite trên OPFS theo từng save.

### Quyết định thiết kế cấp yêu cầu (ghi nhận để rà soát)

Các điểm sau được quyết định trong giai đoạn requirements dựa trên codebase hiện tại; người dùng có thể yêu cầu thay đổi:

- **Phạm vi công tắc God Mode**: là một thiết lập ứng dụng toàn cục (global app setting) nằm trong `AppSettings` (`src/store/settingsStore.ts`, lưu qua lệnh engine `get_settings`/`save_settings` ở khóa `settings:json`). Lý do: công tắc này là một tùy chọn người chơi (giống cheat toggle), khớp với mẫu feature-flag sẵn có và độc lập với dữ liệu của từng save. Lưu ý: các *chỉnh sửa chỉ số* lại là dữ liệu của ván chơi nên được lưu trong Game của từng save.
- **Phạm vi cầu thủ được hé lộ/chỉnh sửa**: áp dụng cho **mọi cầu thủ** (không giới hạn ở đội của người chơi), đúng tinh thần "toàn năng".
- **Tái tính chỉ số dẫn xuất**: sau khi sửa chỉ số gốc, các giá trị dẫn xuất `ovr`/`potential`/`traits` được tính lại bằng hàm engine `refresh_player_derived` (`src-engine/crates/ofm_core/src/player_rating.rs`).

## Glossary

- **God_Mode**: Tính năng cho phép bỏ qua giới hạn hiển thị trinh sát và chỉnh sửa chỉ số cầu thủ.
- **God_Mode_Flag**: Trường boolean `god_mode` trong `AppSettings`, biểu thị God Mode đang bật hay tắt.
- **Settings_Store**: Kho thiết lập ứng dụng phía frontend (`useSettingsStore` trong `src/store/settingsStore.ts`) và lệnh engine tương ứng (`get_settings`/`save_settings`).
- **Settings_Screen**: Giao diện thiết lập nơi người chơi bật/tắt các tùy chọn ứng dụng.
- **Player_Profile**: Màn hình hồ sơ cầu thủ (`src/components/playerProfile/PlayerProfile.tsx`) hiển thị thông tin và chỉ số cầu thủ.
- **Attributes_Card**: Thành phần hiển thị các nhóm chỉ số cầu thủ (`PlayerProfileAttributesCard.tsx`).
- **Attribute_Editor**: Tập điều khiển trong Player_Profile cho phép chỉnh sửa giá trị chỉ số khi God Mode bật.
- **Scouting_System**: Cơ chế hiện có gating việc hiển thị chỉ số theo tiến độ trinh sát và quyền sở hữu câu lạc bộ (`PlayerProfile.scouting.ts`, cờ `isOwnClub`).
- **Player_Attribute**: Một trong các chỉ số gốc 0–100 trong struct `PlayerAttributes` (`src-engine/crates/domain/src/player.rs`): pace, stamina, strength, agility, passing, shooting, tackling, dribbling, defending, positioning, vision, decisions, composure, aggression, teamwork, leadership, handling, reflexes, aerial.
- **Derived_Rating**: Các giá trị dẫn xuất của cầu thủ gồm `ovr` (1–99), `potential` (1–99) và `traits`, tính lại từ chỉ số gốc.
- **Game_Engine**: Engine Rust/WASM hiển thị qua `AppHandle` (`src-engine/src/app_handle/`), nắm giữ Game đang hoạt động trong `Mutex<Option<Game>>` (`ofm_core/state.rs`).
- **Active_Game**: Phiên Game đang chơi do Game_Engine nắm giữ, được ghi xuống save SQLite trên OPFS.
- **Edit_Attributes_Command**: Lệnh engine `#[wasm_bindgen]` mới dùng để chỉnh sửa chỉ số của một cầu thủ trong Active_Game.

## Requirements

### Requirement 1: Công tắc bật/tắt God Mode

**User Story:** Là người chơi, tôi muốn một công tắc bật/tắt God Mode trong phần thiết lập, để tôi có thể chủ động kích hoạt hoặc tắt các năng lực toàn năng.

#### Acceptance Criteria

1. THE Settings_Screen SHALL display a God Mode toggle control bound to the God_Mode_Flag.
2. WHEN the user enables the God Mode toggle, THE Settings_Store SHALL set the God_Mode_Flag to true and persist the updated AppSettings via the save_settings command.
3. WHEN the user disables the God Mode toggle, THE Settings_Store SHALL set the God_Mode_Flag to false and persist the updated AppSettings via the save_settings command.
4. WHERE no stored value for the God_Mode_Flag exists in loaded AppSettings, THE Settings_Store SHALL default the God_Mode_Flag to false.
5. IF persisting the updated AppSettings fails, THEN THE Settings_Store SHALL restore the previous God_Mode_Flag value in the in-memory settings state.

### Requirement 2: Hé lộ toàn bộ chỉ số khi God Mode bật

**User Story:** Là người chơi đã bật God Mode, tôi muốn xem chỉ số thật đầy đủ của mọi cầu thủ, để tôi không bị giới hạn bởi tiến độ trinh sát.

#### Acceptance Criteria

1. WHILE the God_Mode_Flag is true, THE Player_Profile SHALL display the true numeric value of every Player_Attribute for any player, independent of Scouting_System visibility and independent of club ownership.
2. WHILE the God_Mode_Flag is true, THE Attributes_Card SHALL render exact attribute values instead of obscured placeholders for players whose attributes are normally hidden.
3. WHILE the God_Mode_Flag is true, THE Player_Profile SHALL display the true Derived_Rating values (ovr and potential) for any player.
4. WHEN the God_Mode_Flag transitions from false to true while a Player_Profile is open, THE Player_Profile SHALL update the displayed attributes to their true values within the same render cycle.

### Requirement 3: Giữ nguyên giới hạn hiển thị khi God Mode tắt

**User Story:** Là người chơi không dùng God Mode, tôi muốn hệ thống trinh sát hoạt động như cũ, để trải nghiệm manager career mode không bị thay đổi.

#### Acceptance Criteria

1. WHILE the God_Mode_Flag is false, THE Player_Profile SHALL apply the existing Scouting_System visibility rules to attribute display.
2. WHILE the God_Mode_Flag is false, THE Attributes_Card SHALL display obscured placeholders for players whose attributes are not revealed by the Scouting_System.
3. THE God_Mode SHALL leave the underlying Scouting_System data unchanged when revealing attributes.
4. WHEN the God_Mode_Flag transitions from true to false while a Player_Profile is open, THE Player_Profile SHALL restore Scouting_System-based attribute visibility within the same render cycle.

### Requirement 4: Chỉnh sửa chỉ số cầu thủ khi God Mode bật

**User Story:** Là người chơi đã bật God Mode, tôi muốn chỉnh sửa chỉ số của một cầu thủ, để tôi có thể tùy biến năng lực cầu thủ theo ý muốn.

#### Acceptance Criteria

1. WHILE the God_Mode_Flag is true, THE Player_Profile SHALL provide an Attribute_Editor that exposes an editable control for each Player_Attribute of the displayed player.
2. WHEN the user submits an edited value for a Player_Attribute through the Attribute_Editor, THE Player_Profile SHALL send the player identifier and the requested attribute values to the Edit_Attributes_Command.
3. WHEN the Edit_Attributes_Command receives a requested attribute value, THE Game_Engine SHALL clamp the stored value to the inclusive range 0 to 100.
4. WHEN the Edit_Attributes_Command applies edited attributes to a player, THE Game_Engine SHALL recompute that player's Derived_Rating (ovr, potential, and traits) using refresh_player_derived.
5. WHEN the Edit_Attributes_Command completes successfully, THE Game_Engine SHALL update the Active_Game so the edited attributes are reflected in subsequent reads.
6. WHEN the Edit_Attributes_Command completes successfully, THE Game_Engine SHALL return the updated game state to the Player_Profile.

### Requirement 5: Bảo vệ và xử lý lỗi cho chỉnh sửa chỉ số

**User Story:** Là người chơi, tôi muốn việc chỉnh sửa chỉ số chỉ khả dụng và hợp lệ khi God Mode bật, để tránh thay đổi ngoài ý muốn ở chế độ chơi thường.

#### Acceptance Criteria

1. WHILE the God_Mode_Flag is false, THE Player_Profile SHALL hide the Attribute_Editor controls.
2. IF the Edit_Attributes_Command is invoked with a player identifier that does not match any player in the Active_Game, THEN THE Game_Engine SHALL return a descriptive error and SHALL leave the Active_Game unchanged.
3. IF the Edit_Attributes_Command is invoked while no Active_Game exists, THEN THE Game_Engine SHALL return the no-active-game error and SHALL make no changes.
4. IF a submitted attribute value is non-numeric or cannot be deserialized, THEN THE Game_Engine SHALL return a deserialization error and SHALL leave the Active_Game unchanged.

### Requirement 6: Lưu trữ bền vững các chỉnh sửa

**User Story:** Là người chơi, tôi muốn các chỉnh sửa chỉ số được lưu vào save, để chúng vẫn còn sau khi tải lại trò chơi.

#### Acceptance Criteria

1. WHEN the Edit_Attributes_Command applies edited attributes successfully, THE Game_Engine SHALL persist the updated Active_Game to the current SQLite save.
2. WHEN a save is reloaded after an edit, THE Game_Engine SHALL load the edited Player_Attribute values for the affected player.
3. WHEN a save is reloaded after an edit, THE Game_Engine SHALL load Derived_Rating values consistent with the edited Player_Attribute values.
4. WHERE a previously stored save contains no God_Mode-related fields, THE Game_Engine SHALL load that save without error using existing serde default behavior.
