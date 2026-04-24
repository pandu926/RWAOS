use sqlx::{PgPool, Row};

use crate::{
    asset_registry::CreateAssetRequest, audit_reporting::CreateAuditEventRequest,
    disclosure_mgmt::CreateDisclosureRequest, investor_registry::CreateInvestorRequest,
    transfer_ops::CreateTransferRequest,
};

pub async fn bootstrap(pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS assets (
            id BIGSERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            asset_type TEXT NOT NULL
        );
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS investors (
            id BIGSERIAL PRIMARY KEY,
            legal_name TEXT NOT NULL,
            jurisdiction TEXT NOT NULL
        );
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS transfers (
            id BIGSERIAL PRIMARY KEY,
            asset_id BIGINT NOT NULL,
            from_investor_id BIGINT NOT NULL,
            to_investor_id BIGINT NOT NULL,
            amount DOUBLE PRECISION NOT NULL
        );
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS disclosures (
            id BIGSERIAL PRIMARY KEY,
            asset_id BIGINT NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL
        );
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS audit_events (
            id BIGSERIAL PRIMARY KEY,
            actor TEXT NOT NULL,
            action TEXT NOT NULL,
            timestamp_unix BIGINT NOT NULL
        );
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS compliance_passports (
            id BIGSERIAL PRIMARY KEY,
            transfer_id BIGINT NOT NULL UNIQUE,
            policy_hash TEXT NOT NULL,
            disclosure_data_id TEXT NOT NULL,
            anchor_hash TEXT NOT NULL,
            status TEXT NOT NULL,
            transfer_tx_hash TEXT NOT NULL,
            anchor_tx_hash TEXT NOT NULL,
            disclosure_scope TEXT NOT NULL,
            reason TEXT NOT NULL,
            created_by TEXT NOT NULL,
            created_by_role TEXT NOT NULL,
            created_at_unix BIGINT NOT NULL,
            last_accessed_unix BIGINT
        );
        "#,
    )
    .execute(pool)
    .await?;

    seed_if_empty(pool).await?;
    Ok(())
}

async fn seed_if_empty(pool: &PgPool) -> Result<(), sqlx::Error> {
    if table_count(pool, "assets").await? == 0 {
        sqlx::query(
            "INSERT INTO assets (name, asset_type) VALUES ($1, $2), ($3, $4), ($5, $6), ($7, $8), ($9, $10)",
        )
            .bind("Atlas Infrastructure Fund")
            .bind("fund")
            .bind("GreenGrid Bond Series")
            .bind("debt")
            .bind("Meridian Logistics Equity")
            .bind("equity")
            .bind("Solaris Revenue Share")
            .bind("revenue-share")
            .bind("NorthPort Treasury Notes")
            .bind("debt")
            .execute(pool)
            .await?;
    }

    if table_count(pool, "investors").await? == 0 {
        sqlx::query(
            "INSERT INTO investors (legal_name, jurisdiction) VALUES ($1, $2), ($3, $4), ($5, $6), ($7, $8), ($9, $10)",
        )
        .bind("Aster Capital LLC")
        .bind("US")
        .bind("Helios Ventures GmbH")
        .bind("EU")
        .bind("Nusa Strategic Holdings")
        .bind("ID")
        .bind("Orchid Family Office")
        .bind("SG")
        .bind("BlueRidge Pension Trust")
        .bind("UK")
        .execute(pool)
        .await?;
    }

    if table_count(pool, "transfers").await? == 0 {
        let transfers = [
            CreateTransferRequest {
                asset_id: 1,
                from_investor_id: 1,
                to_investor_id: 2,
                amount: 125_000.0,
            },
            CreateTransferRequest {
                asset_id: 2,
                from_investor_id: 2,
                to_investor_id: 3,
                amount: 78_500.0,
            },
            CreateTransferRequest {
                asset_id: 3,
                from_investor_id: 3,
                to_investor_id: 4,
                amount: 210_000.0,
            },
            CreateTransferRequest {
                asset_id: 4,
                from_investor_id: 4,
                to_investor_id: 5,
                amount: 95_250.0,
            },
        ];

        for payload in transfers {
            sqlx::query(
                "INSERT INTO transfers (asset_id, from_investor_id, to_investor_id, amount) VALUES ($1, $2, $3, $4)",
            )
            .bind(payload.asset_id as i64)
            .bind(payload.from_investor_id as i64)
            .bind(payload.to_investor_id as i64)
            .bind(payload.amount)
            .execute(pool)
            .await?;
        }
    }

    if table_count(pool, "disclosures").await? == 0 {
        let disclosures = [
            CreateDisclosureRequest {
                asset_id: 1,
                title: "Monthly NAV Verification".to_owned(),
                content: "Granted to compliance and external auditor scope for April cycle."
                    .to_owned(),
            },
            CreateDisclosureRequest {
                asset_id: 2,
                title: "Coupon Payment Schedule".to_owned(),
                content: "Selective disclosure enabled for bond trustee and regulator account."
                    .to_owned(),
            },
            CreateDisclosureRequest {
                asset_id: 3,
                title: "Transfer Eligibility Memo".to_owned(),
                content: "KYC/AML attestations recorded with confidential token policy hash."
                    .to_owned(),
            },
        ];

        for payload in disclosures {
            sqlx::query("INSERT INTO disclosures (asset_id, title, content) VALUES ($1, $2, $3)")
                .bind(payload.asset_id as i64)
                .bind(payload.title)
                .bind(payload.content)
                .execute(pool)
                .await?;
        }
    }

    if table_count(pool, "audit_events").await? == 0 {
        let audit_events = [
            CreateAuditEventRequest::new("system", "backend_bootstrap"),
            CreateAuditEventRequest::new("compliance_officer", "disclosure_scope_updated"),
            CreateAuditEventRequest::new("treasury_operator", "confidential_transfer_submitted"),
            CreateAuditEventRequest::new("auditor_bot", "proof_anchor_recorded"),
        ];

        for payload in audit_events {
            sqlx::query("INSERT INTO audit_events (actor, action, timestamp_unix) VALUES ($1, $2, $3)")
                .bind(payload.actor)
                .bind(payload.action)
                .bind(payload.timestamp_unix as i64)
                .execute(pool)
                .await?;
        }
    }

    if table_count(pool, "compliance_passports").await? == 0 {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        sqlx::query(
            r#"
            INSERT INTO compliance_passports (
                transfer_id, policy_hash, disclosure_data_id, anchor_hash, status,
                transfer_tx_hash, anchor_tx_hash, disclosure_scope, reason,
                created_by, created_by_role, created_at_unix, last_accessed_unix
            )
            VALUES
                (
                    1,
                    '0x7a8d7a8d7a8d7a8d7a8d7a8d7a8d7a8d7a8d7a8d7a8d7a8d7a8d7a8d7a8d7a8d',
                    '0xdataid000000000000000000000000000000000000000000000000000000000001',
                    '0xanchor000000000000000000000000000000000000000000000000000000000001',
                    'Anchored',
                    '0xbc8c669f48c8250d3bbdbe0425995677d007b6529c422e0802859dd81d788428',
                    '0x0c094972a1f36b0725597cc98cfe9fbd3c7ea9f1b77312371ba6a98b7d638e5b',
                    'auditor, regulator, counterparty',
                    'Regulatory monthly checkpoint',
                    'compliance_officer',
                    'operator',
                    $1,
                    NULL
                ),
                (
                    2,
                    '0x5b6c5b6c5b6c5b6c5b6c5b6c5b6c5b6c5b6c5b6c5b6c5b6c5b6c5b6c5b6c5b6c',
                    '0xdataid000000000000000000000000000000000000000000000000000000000002',
                    '0xanchor000000000000000000000000000000000000000000000000000000000002',
                    'Disclosed to Authorized',
                    '0xbe4aadadc73e772823cb758d79b0e7472ab89568face868aff0701e41852c5ad',
                    '0x0c094972a1f36b0725597cc98cfe9fbd3c7ea9f1b77312371ba6a98b7d638e5b',
                    'auditor, internal-compliance',
                    'Counterparty due diligence',
                    'admin_user',
                    'admin',
                    $2,
                    $3
                )
            "#,
        )
        .bind(now - 7200)
        .bind(now - 3600)
        .bind(now - 1800)
        .execute(pool)
        .await?;
    }

    // keep explicit seed constructors used to document payload shapes
    let _ = CreateAssetRequest {
        name: "Seed Asset C".to_owned(),
        asset_type: "fund".to_owned(),
    };
    let _ = CreateInvestorRequest {
        legal_name: "Seed Investor C".to_owned(),
        jurisdiction: "APAC".to_owned(),
    };

    Ok(())
}

async fn table_count(pool: &PgPool, table: &str) -> Result<i64, sqlx::Error> {
    let query = format!("SELECT COUNT(*) AS count FROM {table}");
    let row = sqlx::query(&query).fetch_one(pool).await?;
    Ok(row.get::<i64, _>("count"))
}
