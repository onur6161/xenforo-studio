use serde::{Deserialize, Serialize};
use std::time::Duration;
use chrono::{Duration as ChronoDuration, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CFTrafficPoint {
    pub time_label: String,
    pub bandwidth_mbps: f32,
    pub downloaded_gb: f32,
    pub request_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CFAnalyticsResponse {
    pub success: bool,
    pub is_connected: bool,
    pub message: String,
    pub points: Vec<CFTrafficPoint>,
    pub total_bandwidth_gb: f32,
    pub total_requests: u64,
}

/// Cloudflare GraphQL Analytics API üzerinden gerçek zamanlı telemetri verisi çeker
pub async fn fetch_cf_live_analytics(
    api_token: &str,
    zone_id: &str,
    account_id: &str,
) -> Result<CFAnalyticsResponse, String> {
    let token = api_token.trim();
    if token.is_empty() {
        return Ok(CFAnalyticsResponse {
            success: false,
            is_connected: false,
            message: "Cloudflare API Token yapılandırılmadı.".to_string(),
            points: Vec::new(),
            total_bandwidth_gb: 0.0,
            total_requests: 0,
        });
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(12))
        .build()
        .map_err(|e| format!("HTTP Client başlatılamadı: {}", e))?;

    let clean_zone = zone_id.trim();

    // 1. ÖNCELİK: Zone ID mevcutsa Cloudflare GraphQL Analytics API'sini sorgula
    if !clean_zone.is_empty() {
        let now = Utc::now();
        let yesterday = now - ChronoDuration::hours(24);
        let since = yesterday.format("%Y-%m-%dT%H:%M:%SZ").to_string();
        let until = now.format("%Y-%m-%dT%H:%M:%SZ").to_string();

        let query = format!(
            r#"query {{
                viewer {{
                    zones(filter: {{zoneTag: "{}"}}) {{
                        httpRequests1hGroups(
                            limit: 24,
                            filter: {{
                                datetime_geq: "{}",
                                datetime_leq: "{}"
                            }},
                            orderBy: [datetime_ASC]
                        ) {{
                            dimensions {{
                                datetime
                            }}
                            sum {{
                                requests
                                bytes
                                cachedBytes
                                cachedRequests
                            }}
                        }}
                    }}
                }}
            }}"#,
            clean_zone, since, until
        );

        let body = serde_json::json!({
            "query": query
        });

        if let Ok(resp) = client
            .post("https://api.cloudflare.com/client/v4/graphql")
            .header("Authorization", format!("Bearer {}", token))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
        {
            if resp.status().is_success() {
                if let Ok(json) = resp.json::<serde_json::Value>().await {
                    if let Some(groups) = json
                        .get("data")
                        .and_then(|d| d.get("viewer"))
                        .and_then(|v| v.get("zones"))
                        .and_then(|z| z.as_array())
                        .and_then(|arr| arr.first())
                        .and_then(|zone| zone.get("httpRequests1hGroups"))
                        .and_then(|g| g.as_array())
                    {
                        let mut all_points = Vec::new();
                        let mut total_bytes: u64 = 0;
                        let mut total_reqs: u64 = 0;

                        for item in groups {
                            let dt_str = item
                                .get("dimensions")
                                .and_then(|d| d.get("datetime"))
                                .and_then(|s| s.as_str())
                                .unwrap_or("");

                            // "2026-10-10T23:00:00Z" -> "23:00"
                            let time_label = if dt_str.len() >= 16 {
                                dt_str[11..16].to_string()
                            } else {
                                "Saat".to_string()
                            };

                            let bytes = item
                                .get("sum")
                                .and_then(|s| s.get("bytes"))
                                .and_then(|v| v.as_u64())
                                .unwrap_or(0);

                            let reqs = item
                                .get("sum")
                                .and_then(|s| s.get("requests"))
                                .and_then(|v| v.as_u64())
                                .unwrap_or(0) as u32;

                            total_bytes += bytes;
                            total_reqs += reqs as u64;

                            // 1 saatteki bant genişliğini Mbps cinsine çevir: (bytes * 8) / (3600 * 1_000_000)
                            let mbps = ((bytes as f32 * 8.0) / (3600.0 * 1_000_000.0) * 100.0).round() / 100.0;
                            let gb = ((bytes as f32 / (1024.0 * 1024.0 * 1024.0)) * 100.0).round() / 100.0;

                            all_points.push(CFTrafficPoint {
                                time_label,
                                bandwidth_mbps: mbps,
                                downloaded_gb: gb,
                                request_count: reqs,
                            });
                        }

                        if !all_points.is_empty() {
                            // Grafikte en son 8-10 veri noktasını net gösterecek şekilde al
                            let points_to_show: Vec<CFTrafficPoint> = if all_points.len() > 10 {
                                all_points.iter().rev().take(10).rev().cloned().collect()
                            } else {
                                all_points.clone()
                            };

                            let total_gb = ((total_bytes as f32 / (1024.0 * 1024.0 * 1024.0)) * 100.0).round() / 100.0;
                            return Ok(CFAnalyticsResponse {
                                success: true,
                                is_connected: true,
                                message: "Cloudflare GraphQL Zone Analytics telemetrisi başarıyla çekildi.".to_string(),
                                points: points_to_show,
                                total_bandwidth_gb: total_gb,
                                total_requests: total_reqs,
                            });
                        }
                    }
                }
            }
        }
    }

    // 2. YÖNTEM: Account ID üzerinden R2 GraphQL Analytics
    let clean_account = account_id.trim();
    if !clean_account.is_empty() {
        let query = format!(
            r#"query {{
                viewer {{
                    accounts(filter: {{accountTag: "{}"}}) {{
                        r2OperationsAdaptiveGroups(
                            limit: 10
                        ) {{
                            dimensions {{
                                datetimeHour
                            }}
                            sum {{
                                requests
                                bytes
                            }}
                        }}
                    }}
                }}
            }}"#,
            clean_account
        );

        let body = serde_json::json!({
            "query": query
        });

        if let Ok(resp) = client
            .post("https://api.cloudflare.com/client/v4/graphql")
            .header("Authorization", format!("Bearer {}", token))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
        {
            if resp.status().is_success() {
                if let Ok(json) = resp.json::<serde_json::Value>().await {
                    if let Some(groups) = json
                        .get("data")
                        .and_then(|d| d.get("viewer"))
                        .and_then(|v| v.get("accounts"))
                        .and_then(|a| a.as_array())
                        .and_then(|arr| arr.first())
                        .and_then(|acc| acc.get("r2OperationsAdaptiveGroups"))
                        .and_then(|g| g.as_array())
                    {
                        let mut points = Vec::new();
                        let mut total_bytes: u64 = 0;
                        let mut total_reqs: u64 = 0;

                        for group in groups {
                            let dt = group
                                .get("dimensions")
                                .and_then(|d| d.get("datetimeHour"))
                                .and_then(|s| s.as_str())
                                .unwrap_or("");
                            let time_label = if dt.len() >= 16 {
                                dt[11..16].to_string()
                            } else {
                                "Saat".to_string()
                            };

                            let bytes = group
                                .get("sum")
                                .and_then(|s| s.get("bytes"))
                                .and_then(|v| v.as_u64())
                                .unwrap_or(0);

                            let reqs = group
                                .get("sum")
                                .and_then(|s| s.get("requests"))
                                .and_then(|v| v.as_u64())
                                .unwrap_or(0) as u32;

                            total_bytes += bytes;
                            total_reqs += reqs as u64;

                            let mbps = ((bytes as f32 * 8.0) / (3600.0 * 1_000_000.0) * 100.0).round() / 100.0;
                            let gb = ((bytes as f32 / (1024.0 * 1024.0 * 1024.0)) * 100.0).round() / 100.0;

                            points.push(CFTrafficPoint {
                                time_label,
                                bandwidth_mbps: mbps,
                                downloaded_gb: gb,
                                request_count: reqs,
                            });
                        }

                        if !points.is_empty() {
                            let total_gb = ((total_bytes as f32 / (1024.0 * 1024.0 * 1024.0)) * 100.0).round() / 100.0;
                            return Ok(CFAnalyticsResponse {
                                success: true,
                                is_connected: true,
                                message: "Cloudflare R2 Analytics verileri başarıyla çekildi.".to_string(),
                                points,
                                total_bandwidth_gb: total_gb,
                                total_requests: total_reqs,
                            });
                        }
                    }
                }
            }
        }
    }

    Ok(CFAnalyticsResponse {
        success: false,
        is_connected: false,
        message: "Cloudflare GraphQL Analytics sorgusuna ulaşılamadı. Token izinlerini (Analytics:Read) ve Zone ID değerini kontrol edin.".to_string(),
        points: Vec::new(),
        total_bandwidth_gb: 0.0,
        total_requests: 0,
    })
}
