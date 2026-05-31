# Save Performance Optimization — Implementation Plan

**Date:** 2026-05-31
**Status:** Planned (not started)

## Goal

Save game (kể cả autosave) hiện chậm dần khi sự nghiệp kéo dài nhiều mùa. Mục tiêu: bỏ các điểm tăng trưởng vô hạn và giảm khối lượng ghi mỗi lần save, KHÔNG thay đổi gameplay logic và KHÔNG làm hỏng tính tương thích save cũ.

## Đính chính so với phân tích miệng trước đó

- **#2 (rò rỉ fixtures mùa cũ) là SAI.** `league_repo::upsert_league` (lines 12–25) `DELETE` sạch toàn bộ bảng `fixtures`/`standings`/`transfer_log` rồi ghi lại, và nó chạy *trước* `upsert_competitions` trong `write_game`. Nên fixtures KHÔNG tích lũy qua mùa — chúng bị wipe+rewrite mỗi save. Không cần "fix leak".
- Điều đó nghĩa là vấn đề thật chỉ còn **#1 (stats vô hạn)** và **#3 (rewrite toàn bộ mỗi save)**, cộng 2 cải thiện nhỏ phụ trợ.

## Các bottleneck đã xác minh (theo thứ tự ưu tiên)

### P1 — `StatsState` (player_match_stats / team_match_stats) tăng vô hạn
- `crates/domain/src/stats.rs`: `StatsState { player_matches: Vec<...>, team_matches: Vec<...> }`. `append()` chỉ `extend`, **không bao giờ cắt bớt**.
- Mỗi trận thêm ~22–30 record cầu thủ + 2 record đội. Giữ vĩnh viễn cho toàn bộ thế giới (mọi đội, mọi giải), không chỉ đội người chơi.
- `crates/db/src/repositories/stats_repo.rs::upsert_stats_state` làm `INSERT OR REPLACE` cho **mọi record trong toàn bộ lịch sử** mỗi lần `save_stats_state`, dù chỉ matchday mới là mới.
- Hệ quả: chi phí save bậc hai theo độ dài sự nghiệp; bộ nhớ in-RAM cũng phình (load đọc hết về `active_stats`).

### P2 — Full-snapshot rewrite mỗi save (không dirty-tracking)
- `crates/db/src/game_persistence.rs::write_game`: mỗi save ghi lại TẤT CẢ teams, players (~5k), staff, messages, news, competitions + wipe/rewrite toàn bộ fixtures.
- `player_repo` đã dùng `prepare_cached` (tốt), nhưng vẫn re-serialize JSON từng cầu thủ (attributes, stats, career, morale_core, transfer_offers) kể cả người không đổi. `player.career` dài thêm mỗi mùa.

### P3 — Mở DB + chạy migrations 2 lần mỗi autosave
- `save_manager::save_game` và `save_stats_state` mỗi hàm gọi `GameDatabase::open()` riêng → 2 lần mở file + 2 lần `migrations.to_latest()` (check 27 migration) + 2 lần set PRAGMA cho một thao tác save.

### P4 — `league_repo` ghi từng dòng không cached
- `upsert_league` / `upsert_competitions` dùng `conn.execute` riêng lẻ cho từng fixture/standing/transfer (re-parse SQL mỗi dòng), khác với `player_repo` đã tối ưu bằng `prepare_cached`.

---

## Nguyên tắc dữ liệu (đã chốt với user)

Tách 2 loại dữ liệu rạch ròi:

- **Log chi tiết từng trận** (`StatsState.player_matches` / `team_matches`): chỉ phục vụ màn hình "phong độ gần đây / lịch sử trận". Đây là phần tăng vô hạn → **prune giữ 3–5 mùa gần nhất**.
- **Tổng hợp theo mùa + honours** (leaderboard, vô địch, kỷ lục): **giữ vĩnh viễn**, kích thước nhỏ (mỗi cầu thủ/đội ~1 dòng/mùa). Phải tồn tại độc lập với log từng trận để prune không làm mất.

Dữ liệu honours/leaderboard **đã có sẵn một phần**:
- `player.career` (`CareerEntry`): season, team, appearances, goals, assists — nền leaderboard cầu thủ theo mùa.
- `team.history` (`TeamSeasonRecord`): season, league_position (1 = vô địch), W/D/L, goals — nền lịch sử nhà vô địch.
- `SeasonAwards`: tính ở `compute_season_awards` cuối mùa NHƯNG hiện chỉ thành 1 news article rồi bị prune ở mốc 250 → **chưa lưu bền vững** (cần bổ sung).

## Phase 1 — Chặn tăng trưởng vô hạn của stats (P1) [ưu tiên cao nhất]

Mục tiêu: vừa giới hạn dữ liệu, vừa bỏ rewrite-toàn-bộ-lịch-sử.

### 1A. Append-only persistence cho stats [bắt buộc]
- Đổi `save_stats_state` để chỉ ghi record **chưa có trong DB** thay vì `INSERT OR REPLACE` toàn bộ.
  - Cách an toàn nhất không cần dirty-tracking phức tạp: trước khi insert, lấy `SELECT` tập `fixture_id` đã tồn tại (hoặc `MAX(rowid)` mốc), chỉ insert record có `fixture_id` mới. `INSERT OR IGNORE` theo khóa `(fixture_id, player_id)` để idempotent.
  - Cần xác nhận khóa duy nhất: thêm UNIQUE index `(fixture_id, player_id)` cho `player_match_stats` và `(fixture_id, team_id)` cho `team_match_stats` (migration mới V28) để `INSERT OR IGNORE` chính xác.
- Kết quả: save chỉ ghi stats của (các) trận mới trong lần advance đó, không đụng lịch sử cũ.

### 1B. Prune log từng trận khi rollover [bắt buộc, theo lựa chọn user]
- Thêm hằng `MAX_RETAINED_STAT_SEASONS = 5` (giữ 5 mùa gần nhất — đủ cho "phong độ gần đây", có thể chỉnh).
- Khi rollover mùa (`end_of_season`), prune record cũ hơn ngưỡng khỏi cả `StatsState` in-memory VÀ DB (`DELETE FROM player_match_stats WHERE season < ?`, tương tự team).
- An toàn cho leaderboard/honours vì chúng KHÔNG đọc từ log từng trận (đọc từ career/history/honours — xem 1C).
- Cần kiểm: `application/stats/*` (player/team history screens) chỉ dùng cho cửa sổ gần đây; nếu có chỗ tính tổng-sự-nghiệp từ per-match thì chuyển sang đọc career summary.

### 1C. Honours / leaderboard lưu bền vững [tính năng mới — kiểu FM]
Đảm bảo các tổng hợp theo mùa survive việc prune per-match.

- **Player season summary (leaderboard):** `CareerEntry` hiện chỉ có apps/goals/assists. Mở rộng để đủ làm bảng xếp hạng phong phú hơn: thêm `clean_sheets`, `avg_rating`, `yellow_cards`, `red_cards`, `minutes_played` (tất cả `#[serde(default)]` để save cũ load được). Snapshot ngay trước khi reset stats cuối mùa (đã có vòng lặp tại `end_of_season.rs:405`).
- **Honours board (nhà vô địch + danh hiệu mỗi mùa):** thêm cấu trúc `SeasonHonours { season, competition_id, competition_name, champion_team_id, awards: SeasonAwards }` và một `Vec<SeasonHonours>` lưu ở `Game` (persist sang bảng mới `season_honours` — migration V29). Ghi 1 lần mỗi rollover. Nhỏ và bounded theo số mùa × số giải.
- **Kỷ lục đặc biệt (high records):** một struct `GameRecords` (vd: nhiều bàn nhất 1 mùa, chuỗi bất bại dài nhất, phí chuyển nhượng cao nhất...) cập nhật incremental mỗi rollover, lưu 1 hàng JSON. Phạm vi MVP có thể chỉ vài record cơ bản; chốt danh sách record trước khi code.

> 1C là phần "FM-style" user yêu cầu. 1A+1B sửa hiệu năng; 1C đảm bảo prune không xoá mất dữ liệu lịch sử có ý nghĩa. Cần chốt: (a) danh sách field leaderboard, (b) danh sách record đặc biệt MVP.

### 1C — chi tiết đã chốt với user

**(a) CareerEntry mở rộng (leaderboard "Đầy đủ")** — tất cả field mới `#[serde(default)]`:
- Đã có: `season, team_id, team_name, appearances, goals, assists`
- Thêm: `clean_sheets`, `avg_rating: f32`, `yellow_cards`, `red_cards`, `minutes_played`, `shots`, `shots_on_target`, `tackles_won`, `interceptions`
- Snapshot từ `player.stats` ngay trước reset ở `end_of_season.rs:405` (chỉ cần copy thêm field, không tính lại).

**(b) GameRecords — kỷ lục đặc biệt MVP** (struct lưu 1 hàng JSON, cập nhật incremental mỗi rollover):
1. Nhiều bàn nhất 1 mùa (cầu thủ) + tổng bàn sự nghiệp cao nhất
2. Nhiều kiến tạo nhất 1 mùa (cầu thủ) + tổng kiến tạo sự nghiệp cao nhất
3. Nhiều giữ sạch lưới nhất 1 mùa (thủ môn) + tổng sự nghiệp
4. Chuỗi bất bại dài nhất (đội) — cần theo dõi qua các trận, lưu kỷ lục đạt được
5. Phí chuyển nhượng kỷ lục (lấy từ transfer_log: thương vụ đắt nhất)
6. Điểm vô địch cao nhất 1 mùa + nhiều bàn nhất 1 mùa (đội) — từ team.history

Mỗi record lưu: giá trị + chủ nhân (player_id/team_id + tên) + mùa đạt được. Tất cả `#[serde(default)]`.

**SeasonHonours** (bảng `season_honours`, V29): mỗi mùa × mỗi giải lưu `champion_team_id` + `SeasonAwards` (vua phá lưới/kiến tạo/POTY/găng tay vàng...). Persist 1 lần/rollover.

## Phase 2 — Gộp một lần mở DB cho mỗi save (P3) [dễ, an toàn]

- Thêm `SaveManager::save_game_with_stats(game, stats, save_id)` mở DB **một lần**, chạy cả `write_game` + `write_stats_state` trong **một** `with_write_transaction`.
- Cập nhật caller ở `app_handle/game.rs` (`save_game`, `exit_to_menu`) và `commands/game.rs` để gọi hàm gộp.
- Giữ `save_game` / `save_stats_state` cũ cho các đường gọi lẻ (tương thích test), nhưng đường autosave chính dùng hàm gộp.

## Phase 3 — Cached statements cho league_repo (P4) [nhẹ]

- Đổi vòng ghi fixtures/standings/transfer trong `upsert_league` và `upsert_competitions` sang `prepare_cached` (mirror `player_repo::upsert_players`).
- Thuần tối ưu tốc độ, không đổi schema, không đổi hành vi.

## Phase 4 — Dirty-tracking cho full-snapshot (P2) [rủi ro cao — làm cuối, có thể tách riêng]

- Chỉ động tới SAU khi P1–P3 xong và đo lại.
- Ý tưởng bảo thủ: theo dõi tập `team_id` "đã chạm" trong ngày (đội người chơi + đội có giao dịch/đá trận) và chỉ upsert players của các đội đó; phần còn lại giữ nguyên.
- Rủi ro: sót cờ → mất dữ liệu. Bắt buộc có test round-trip kỹ + fallback "full rewrite" định kỳ (vd mỗi rollover hoặc mỗi N ngày).
- Quyết định riêng: có thể KHÔNG làm Phase 4 nếu P1–P3 đã đủ nhanh.

## Verification

Mỗi phase:
1. `cargo test --manifest-path src-engine/Cargo.toml --workspace` (toàn bộ phải xanh).
2. Test mới cho phần đụng tới:
   - 1A: save 2 lần liên tiếp với 1 trận mới giữa chừng → DB chỉ tăng đúng số record của trận đó; round-trip load đúng.
   - 1B: sau prune, record cũ bị xóa, record trong ngưỡng còn nguyên, màn hình stats không vỡ.
   - P2: save gộp mở DB đúng 1 lần (đo bằng test hoặc đếm), dữ liệu game+stats round-trip đúng.
   - P3: round-trip league/competitions không đổi.
3. Đo thủ công: tạo save, mô phỏng nhiều mùa (dùng benchmark world nếu có ở `scale` tests), so thời gian save mùa 1 vs mùa 5.

## Critical files

- `src-engine/crates/domain/src/stats.rs` — StatsState (prune in-memory)
- `src-engine/crates/db/src/repositories/stats_repo.rs` — append-only insert + DELETE prune
- `src-engine/crates/db/src/migrations.rs` + `sql/v028_*.sql` (UNIQUE index stats) + `sql/v029_*.sql` (season_honours) + `sql/v030_*.sql` (game_records)
- `src-engine/crates/db/src/save_manager.rs` — save_game_with_stats gộp (P2)
- `src-engine/crates/db/src/game_persistence.rs` — write path
- `src-engine/crates/db/src/repositories/league_repo.rs` — prepare_cached (P3)
- `src-engine/crates/ofm_core/src/end_of_season.rs` — prune per-match (1B) + snapshot career/honours (1C)
- `src-engine/crates/domain/src/player.rs` — CareerEntry mở rộng (1C)
- `src-engine/crates/domain/src/team.rs` — (đã có TeamSeasonRecord cho champions)
- `src-engine/crates/ofm_core/src/season_awards.rs` — SeasonAwards → SeasonHonours (1C)
- `src-engine/crates/ofm_core/src/game.rs` — thêm `season_honours: Vec<SeasonHonours>`, `records: GameRecords` (1C)
- `src-engine/src/app_handle/game.rs`, `src/commands/game.rs` — callers autosave (P2)
- (Frontend sau, nếu làm UI leaderboard/honours): chưa trong phạm vi plan engine này

## Thứ tự đề xuất

P1 (1A bắt buộc, 1B theo quyết định) → P2 → P3 → đo lại → cân nhắc P4.
Mỗi phase commit riêng, không gộp, để dễ revert nếu hồi quy.
