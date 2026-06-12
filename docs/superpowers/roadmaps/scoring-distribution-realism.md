# Scoring & Assist Distribution Realism — Roadmap

**Status:** Investigated, not started  
**Date:** 2026-06-12

## Problem

FC26 simulation phân bổ bàn thắng/kiến tạo không thực tế:

| Position | Goals % | Assists % |
|----------|---------|-----------|
| ST       | 56.9%   | 11.4%     |
| CM       | 8.1%    | 26.9%     |
| LM       | 4.4%    | 7.4%      |
| RM       | 4.9%    | 7.4%      |
| LW       | 3.6%    | 1.7%      |
| RW       | 3.5%    | 1.8%      |

ST quá dominant, wide players (LW/RW/LM/RM) gần như không có assists.

## Root Cause (engine)

- `shooter_weight`: Forward `2.10` vs Midfielder `0.50` → ST luôn được chọn
- Attacking-third hard-picks `Position::Forward` làm attacker
- Assister weight ưu tiên CM, không có bonus cho wide/crossing
- Chance type selection không xét zone hay formation

## Approach Options

### 1. Calibrate weight cơ bản (light)

**File:** `src-engine/crates/engine/src/live_match/zone_resolution.rs`

- Giảm Forward `shooter_weight`: `2.10` → `1.50`, Midfielder `0.50` → `0.85`
- Thay attacking-third hard-pick Forward → weighted pick theo zone
- Thêm crossing bonus cho wide players trong `assister_weight`
- Thêm CAM vào chance type selection

**Pros:** Nhanh, ít thay đổi, dễ test  
**Cons:** Blind fine-tune, có thể chưa đủ thực tế

### 2. Zone + Formation aware (medium, recommended)

**Files:** `zone_resolution.rs`, có thể thêm formation parser

- Map zone hiện tại → ưu tiên position phù hợp (wide zone → winger, central → ST/CAM)
- Đọc `formation` string (4-3-3, 4-4-2, 4-2-3-1...) để biết đội đang chạy vị trí nào
- Phân bổ scorer/assister position khác nhau theo formation
- Wide zone + formation có winger → cross pattern
- Central zone + 4-2-3-1 → CAM assist + ST goal

**Pros:** Logic rõ ràng, tận dụng zone + formation có sẵn  
**Cons:** Cần formation parser, test nhiều formation

### 3. Chance-type driven + position role system (heavy)

**Files:** `zone_resolution.rs`, new `chance_types.rs`, new `position_roles.rs`

- Mỗi chance type có bảng phân bổ scorer/assister position riêng
- Khi chọn chance type → đồng thời chọn actor position từ bảng
- Pattern ví dụ:
  - Cross → winger assist + ST/CAM goal
  - Through ball → CAM assist + ST goal
  - Counter → winger run → winger goal
  - Set piece → CB tham gia nhiều
  - Long shot → CM/AM goal

**Pros:** Realistic nhất, mỗi kiểu tấn công có pattern riêng  
**Cons:** Refactor lớn, cần test kỹ để không ra pattern lặp

## Decision

Chưa chọn. Recommended: **Hướng 2** (Zone + Formation aware) vì tận dụng infrastructure có sẵn.

## Verification

Sau khi implement, verify bằng cách:
1. Build benchmark: `cargo build --manifest-path "src-engine/Cargo.toml" --release --example fc26_save_sim_benchmark`
2. Chạy 365-day sim: `./src-engine/target/release/examples/fc26_save_sim_benchmark --days 365 --out "target/fc26-calibrated-scoring.db"`
3. Query distribution:
```sql
select p.natural_position, sum(pms.goals), sum(pms.assists)
from player_match_stats pms join players p on p.id=pms.player_id
where pms.competition='DomesticLeague'
group by p.natural_position order by sum(pms.goals) desc;
```
4. Target: ST goals ~35-40%, wide player assists ~20-25%, CB goals ~2-3%
