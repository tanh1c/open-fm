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
        "afghanistan" => "AF".to_string(),
        "albania" => "AL".to_string(),
        "algeria" => "DZ".to_string(),
        "andorra" => "AD".to_string(),
        "angola" => "AO".to_string(),
        "antigua and barbuda" => "AG".to_string(),
        "argentina" | "argentine" => "AR".to_string(),
        "armenia" => "AM".to_string(),
        "australia" => "AU".to_string(),
        "austria" => "AT".to_string(),
        "azerbaijan" => "AZ".to_string(),
        "bangladesh" => "BD".to_string(),
        "barbados" => "BB".to_string(),
        "belarus" => "BY".to_string(),
        "belgium" | "belgian" => "BE".to_string(),
        "benin" => "BJ".to_string(),
        "bermuda" => "BM".to_string(),
        "bolivia" => "BO".to_string(),
        "bosnia and herzegovina" => "BA".to_string(),
        "brazil" | "brazilian" => "BR".to_string(),
        "bulgaria" => "BG".to_string(),
        "burkina faso" => "BF".to_string(),
        "burundi" => "BI".to_string(),
        "cameroon" => "CM".to_string(),
        "canada" => "CA".to_string(),
        "cape verde" | "cape verde islands" => "CV".to_string(),
        "central african republic" => "CF".to_string(),
        "chad" => "TD".to_string(),
        "chile" => "CL".to_string(),
        "china" | "china pr" => "CN".to_string(),
        "chinese taipei" | "taiwan" => "TW".to_string(),
        "colombia" | "colombian" => "CO".to_string(),
        "comoros" => "KM".to_string(),
        "congo" => "CG".to_string(),
        "congo dr" | "democratic republic of the congo" => "CD".to_string(),
        "costa rica" => "CR".to_string(),
        "croatia" | "croatian" => "HR".to_string(),
        "cuba" => "CU".to_string(),
        "curaçao" | "curacao" => "CW".to_string(),
        "cyprus" => "CY".to_string(),
        "czech republic" | "czechia" => "CZ".to_string(),
        "côte d'ivoire" | "cote d'ivoire" | "ivory coast" => "CI".to_string(),
        "denmark" => "DK".to_string(),
        "dominican republic" => "DO".to_string(),
        "ecuador" => "EC".to_string(),
        "egypt" => "EG".to_string(),
        "el salvador" => "SV".to_string(),
        "equatorial guinea" => "GQ".to_string(),
        "estonia" => "EE".to_string(),
        "faroe islands" => "FO".to_string(),
        "finland" => "FI".to_string(),
        "france" | "french" => "FR".to_string(),
        "gabon" => "GA".to_string(),
        "gambia" => "GM".to_string(),
        "georgia" => "GE".to_string(),
        "germany" | "german" => "DE".to_string(),
        "ghana" => "GH".to_string(),
        "gibraltar" => "GI".to_string(),
        "greece" => "GR".to_string(),
        "grenada" => "GD".to_string(),
        "guatemala" => "GT".to_string(),
        "guinea" => "GN".to_string(),
        "guinea-bissau" => "GW".to_string(),
        "guyana" => "GY".to_string(),
        "haiti" => "HT".to_string(),
        "holland" | "netherlands" | "dutch" => "NL".to_string(),
        "honduras" => "HN".to_string(),
        "hong kong" => "HK".to_string(),
        "hungary" => "HU".to_string(),
        "iceland" => "IS".to_string(),
        "india" => "IN".to_string(),
        "indonesia" => "ID".to_string(),
        "iran" => "IR".to_string(),
        "iraq" => "IQ".to_string(),
        "israel" => "IL".to_string(),
        "italy" | "italian" => "IT".to_string(),
        "jamaica" => "JM".to_string(),
        "japan" => "JP".to_string(),
        "jordan" => "JO".to_string(),
        "kenya" => "KE".to_string(),
        "korea republic" | "south korea" => "KR".to_string(),
        "kosovo" => "XK".to_string(),
        "latvia" => "LV".to_string(),
        "lebanon" => "LB".to_string(),
        "liberia" => "LR".to_string(),
        "libya" => "LY".to_string(),
        "liechtenstein" => "LI".to_string(),
        "lithuania" => "LT".to_string(),
        "luxembourg" => "LU".to_string(),
        "madagascar" => "MG".to_string(),
        "malawi" => "MW".to_string(),
        "malaysia" => "MY".to_string(),
        "mali" => "ML".to_string(),
        "malta" => "MT".to_string(),
        "mauritania" => "MR".to_string(),
        "mexico" => "MX".to_string(),
        "moldova" => "MD".to_string(),
        "montenegro" => "ME".to_string(),
        "montserrat" => "MS".to_string(),
        "morocco" => "MA".to_string(),
        "mozambique" => "MZ".to_string(),
        "namibia" => "NA".to_string(),
        "new zealand" => "NZ".to_string(),
        "niger" => "NE".to_string(),
        "nigeria" => "NG".to_string(),
        "north macedonia" => "MK".to_string(),
        "norway" | "norwegian" => "NO".to_string(),
        "pakistan" => "PK".to_string(),
        "palestine" => "PS".to_string(),
        "panama" => "PA".to_string(),
        "paraguay" => "PY".to_string(),
        "peru" => "PE".to_string(),
        "philippines" => "PH".to_string(),
        "poland" => "PL".to_string(),
        "portugal" | "portuguese" => "PT".to_string(),
        "romania" => "RO".to_string(),
        "russia" => "RU".to_string(),
        "rwanda" => "RW".to_string(),
        "saudi arabia" => "SA".to_string(),
        "senegal" => "SN".to_string(),
        "serbia" => "RS".to_string(),
        "sierra leone" => "SL".to_string(),
        "slovakia" => "SK".to_string(),
        "slovenia" => "SI".to_string(),
        "somalia" => "SO".to_string(),
        "south africa" => "ZA".to_string(),
        "spain" | "spanish" => "ES".to_string(),
        "sri lanka" => "LK".to_string(),
        "st. kitts and nevis" | "saint kitts and nevis" => "KN".to_string(),
        "st. lucia" | "saint lucia" => "LC".to_string(),
        "suriname" => "SR".to_string(),
        "sweden" | "swedish" => "SE".to_string(),
        "switzerland" => "CH".to_string(),
        "syria" => "SY".to_string(),
        "tajikistan" => "TJ".to_string(),
        "tanzania" => "TZ".to_string(),
        "thailand" => "TH".to_string(),
        "togo" => "TG".to_string(),
        "trinidad and tobago" => "TT".to_string(),
        "tunisia" => "TN".to_string(),
        "turkey" => "TR".to_string(),
        "uganda" => "UG".to_string(),
        "ukraine" => "UA".to_string(),
        "united arab emirates" => "AE".to_string(),
        "united states" | "usa" | "united states of america" => "US".to_string(),
        "uruguay" => "UY".to_string(),
        "uzbekistan" => "UZ".to_string(),
        "vanuatu" => "VU".to_string(),
        "venezuela" => "VE".to_string(),
        "zambia" => "ZM".to_string(),
        "zimbabwe" => "ZW".to_string(),
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
    fn normalizes_fc26_country_names_to_flag_codes() {
        assert_eq!(normalize_football_nation_code("Norway"), "NO");
        assert_eq!(normalize_football_nation_code("Sweden"), "SE");
        assert_eq!(normalize_football_nation_code("Argentina"), "AR");
        assert_eq!(normalize_football_nation_code("Holland"), "NL");
        assert_eq!(normalize_football_nation_code("China PR"), "CN");
        assert_eq!(normalize_football_nation_code("Korea Republic"), "KR");
        assert_eq!(normalize_football_nation_code("Republic of Ireland"), "IE");
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
