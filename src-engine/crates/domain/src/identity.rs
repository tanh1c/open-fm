pub fn normalize_football_nation_code(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    match trimmed.to_ascii_lowercase().as_str() {
        "eng" | "england" | "english" => "ENG".to_string(),
        "sco" | "scotland" | "scottish" => "SCO".to_string(),
        "wal" | "wales" | "welsh" => "WAL".to_string(),
        "nir" | "northern ireland" | "northern irish" => "NIR".to_string(),
        "ie" | "ireland" | "irish" | "republic of ireland" => "IE".to_string(),
        "gb" | "british" | "uk" | "united kingdom" | "great britain" => "GB".to_string(),
        _ => {
            let upper = trimmed.to_ascii_uppercase();
            if upper.len() <= 3 {
                upper
            } else {
                trimmed.to_string()
            }
        }
    }
}

pub fn derive_birth_country_code(value: &str) -> Option<String> {
    let normalized = normalize_football_nation_code(value);
    if normalized.is_empty() || normalized == "GB" {
        None
    } else {
        Some(normalized)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_home_nations_and_legacy_aliases() {
        assert_eq!(normalize_football_nation_code("English"), "ENG");
        assert_eq!(normalize_football_nation_code("Scotland"), "SCO");
        assert_eq!(normalize_football_nation_code("Welsh"), "WAL");
        assert_eq!(normalize_football_nation_code("Northern Irish"), "NIR");
        assert_eq!(normalize_football_nation_code("Irish"), "IE");
        assert_eq!(normalize_football_nation_code("British"), "GB");
    }

    #[test]
    fn preserves_legacy_british_ambiguity_for_birth_country() {
        assert_eq!(derive_birth_country_code("British"), None);
        assert_eq!(derive_birth_country_code("GB"), None);
        assert_eq!(
            derive_birth_country_code("English"),
            Some("ENG".to_string())
        );
    }
}
