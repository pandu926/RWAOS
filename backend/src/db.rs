use sqlx::{PgPool, Row};

use crate::{
    asset_registry::CreateAssetRequest, audit_reporting::CreateAuditEventRequest,
    disclosure_mgmt::CreateDisclosureRequest, investor_registry::CreateInvestorRequest,
    transfer_ops::CreateTransferRequest,
};

const DEMO_ASSET_NAME: &str = "Demo Arbitrum Sepolia Treasury Note";
const DEMO_ASSET_TYPE: &str = "debt";
const DEMO_SENDER_NAME: &str = "Demo Sender SPV";
const DEMO_RECIPIENT_NAME: &str = "Demo Recipient SPV";
const DEMO_SENDER_JURISDICTION: &str = "US";
const DEMO_RECIPIENT_JURISDICTION: &str = "SG";
const DEMO_SENDER_WALLET: &str = "0xec08da877d409293c006523db95ba291f43e3249";
const DEMO_RECIPIENT_WALLET: &str = "0x1111111111111111111111111111111111111111";
const DEMO_DISCLOSURE_TITLE: &str = "Demo Confidential Transfer Disclosure";
const DEMO_DISCLOSURE_CONTENT: &str =
    "Recording-ready disclosure grant for the seeded sender wallet on Arbitrum Sepolia.";
const DEMO_DISCLOSURE_DATA_ID: &str =
    "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const DEMO_DISCLOSURE_TX_HASH: &str =
    "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const DEMO_TRANSFER_AMOUNT: f64 = 25_000.0;
const DEMO_TRANSFER_TX_HASH: &str =
    "0x1111111111111111111111111111111111111111111111111111111111111111";
const DEMO_TRANSFER_ID_ONCHAIN: &str =
    "0x00000000000000000000000000000000000000000000000000000000000000a1";
const DEMO_POLICY_HASH: &str = "0x2222222222222222222222222222222222222222222222222222222222222222";
const DEMO_ANCHOR_HASH: &str = "0x3333333333333333333333333333333333333333333333333333333333333333";
const DEMO_ANCHOR_TX_HASH: &str =
    "0x4444444444444444444444444444444444444444444444444444444444444444";
const DEMO_DISCLOSURE_SCOPE: &str = "sender, auditor, regulator";
const DEMO_PASSPORT_REASON: &str = "Recording-ready seeded passport for end-to-end demo";
const DEMO_EXPIRES_AT_UNIX: i64 = 1_798_761_600;

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
            jurisdiction TEXT NOT NULL,
            wallet_address TEXT
        );
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query("ALTER TABLE investors ADD COLUMN IF NOT EXISTS wallet_address TEXT;")
        .execute(pool)
        .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS transfers (
            id BIGSERIAL PRIMARY KEY,
            asset_id BIGINT NOT NULL,
            from_investor_id BIGINT NOT NULL,
            to_investor_id BIGINT NOT NULL,
            amount DOUBLE PRECISION NOT NULL,
            tx_hash TEXT
        );
        "#,
    )
    .execute(pool)
    .await?;

    // Migration-safe add for existing databases created before tx_hash existed.
    sqlx::query("ALTER TABLE transfers ADD COLUMN IF NOT EXISTS tx_hash TEXT;")
        .execute(pool)
        .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS disclosures (
            id BIGSERIAL PRIMARY KEY,
            asset_id BIGINT NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            data_id TEXT,
            grantee TEXT,
            expires_at BIGINT,
            tx_hash TEXT
        );
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query("ALTER TABLE disclosures ADD COLUMN IF NOT EXISTS data_id TEXT;")
        .execute(pool)
        .await?;
    sqlx::query("ALTER TABLE disclosures ADD COLUMN IF NOT EXISTS grantee TEXT;")
        .execute(pool)
        .await?;
    sqlx::query("ALTER TABLE disclosures ADD COLUMN IF NOT EXISTS expires_at BIGINT;")
        .execute(pool)
        .await?;
    sqlx::query("ALTER TABLE disclosures ADD COLUMN IF NOT EXISTS tx_hash TEXT;")
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
            transfer_id BIGINT,
            transfer_record_id BIGINT NOT NULL UNIQUE,
            transfer_id_onchain TEXT,
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

    sqlx::query("ALTER TABLE compliance_passports ADD COLUMN IF NOT EXISTS transfer_id BIGINT;")
        .execute(pool)
        .await?;
    sqlx::query(
        "ALTER TABLE compliance_passports ADD COLUMN IF NOT EXISTS transfer_record_id BIGINT;",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "UPDATE compliance_passports SET transfer_id = transfer_record_id WHERE transfer_id IS NULL AND transfer_record_id IS NOT NULL;",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "ALTER TABLE compliance_passports ADD COLUMN IF NOT EXISTS transfer_id_onchain TEXT;",
    )
    .execute(pool)
    .await?;
    if column_exists(pool, "compliance_passports", "transfer_id").await? {
        sqlx::query(
            "UPDATE compliance_passports SET transfer_record_id = transfer_id WHERE transfer_record_id IS NULL;",
        )
        .execute(pool)
        .await?;
    }
    sqlx::query("ALTER TABLE compliance_passports ALTER COLUMN transfer_record_id SET NOT NULL;")
        .execute(pool)
        .await?;
    sqlx::query(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_compliance_passports_transfer_record_id ON compliance_passports (transfer_record_id);",
    )
    .execute(pool)
    .await?;

    seed_if_empty(pool).await?;
    ensure_demo_recording_scenario(pool).await?;
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
            "INSERT INTO investors (legal_name, jurisdiction, wallet_address) VALUES ($1, $2, $3), ($4, $5, $6), ($7, $8, $9), ($10, $11, $12), ($13, $14, $15)",
        )
        .bind("Aster Capital LLC")
        .bind("US")
        .bind(Option::<String>::None)
        .bind("Helios Ventures GmbH")
        .bind("EU")
        .bind(Option::<String>::None)
        .bind("Nusa Strategic Holdings")
        .bind("ID")
        .bind(Option::<String>::None)
        .bind("Orchid Family Office")
        .bind("SG")
        .bind(Option::<String>::None)
        .bind("BlueRidge Pension Trust")
        .bind("UK")
        .bind(Option::<String>::None)
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
                tx_hash: None,
            },
            CreateTransferRequest {
                asset_id: 2,
                from_investor_id: 2,
                to_investor_id: 3,
                amount: 78_500.0,
                tx_hash: None,
            },
            CreateTransferRequest {
                asset_id: 3,
                from_investor_id: 3,
                to_investor_id: 4,
                amount: 210_000.0,
                tx_hash: None,
            },
            CreateTransferRequest {
                asset_id: 4,
                from_investor_id: 4,
                to_investor_id: 5,
                amount: 95_250.0,
                tx_hash: None,
            },
        ];

        for payload in transfers {
            sqlx::query(
                "INSERT INTO transfers (asset_id, from_investor_id, to_investor_id, amount, tx_hash) VALUES ($1, $2, $3, $4, $5)",
            )
            .bind(payload.asset_id as i64)
            .bind(payload.from_investor_id as i64)
            .bind(payload.to_investor_id as i64)
            .bind(payload.amount)
            .bind(payload.tx_hash)
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
                data_id: None,
                grantee: None,
                expires_at: None,
                tx_hash: None,
            },
            CreateDisclosureRequest {
                asset_id: 2,
                title: "Coupon Payment Schedule".to_owned(),
                content: "Selective disclosure enabled for bond trustee and regulator account."
                    .to_owned(),
                data_id: None,
                grantee: None,
                expires_at: None,
                tx_hash: None,
            },
            CreateDisclosureRequest {
                asset_id: 3,
                title: "Transfer Eligibility Memo".to_owned(),
                content: "KYC/AML attestations recorded with confidential token policy hash."
                    .to_owned(),
                data_id: None,
                grantee: None,
                expires_at: None,
                tx_hash: None,
            },
        ];

        for payload in disclosures {
            sqlx::query(
                "INSERT INTO disclosures (asset_id, title, content, data_id, grantee, expires_at, tx_hash) VALUES ($1, $2, $3, $4, $5, $6, $7)",
            )
                .bind(payload.asset_id as i64)
                .bind(payload.title)
                .bind(payload.content)
                .bind(Option::<String>::None)
                .bind(Option::<String>::None)
                .bind(Option::<i64>::None)
                .bind(Option::<String>::None)
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
            sqlx::query(
                "INSERT INTO audit_events (actor, action, timestamp_unix) VALUES ($1, $2, $3)",
            )
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
                transfer_id, transfer_record_id, transfer_id_onchain, policy_hash, disclosure_data_id, anchor_hash, status,
                transfer_tx_hash, anchor_tx_hash, disclosure_scope, reason,
                created_by, created_by_role, created_at_unix, last_accessed_unix
            )
            VALUES
                (
                    1,
                    1,
                    '0x0000000000000000000000000000000000000000000000000000000000000001',
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
                    2,
                    '0x0000000000000000000000000000000000000000000000000000000000000002',
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
        wallet_address: None,
    };

    Ok(())
}

async fn ensure_demo_recording_scenario(pool: &PgPool) -> Result<(), sqlx::Error> {
    let asset_id = ensure_demo_asset(pool).await?;
    let sender_investor_id = ensure_demo_investor(
        pool,
        DEMO_SENDER_NAME,
        DEMO_SENDER_JURISDICTION,
        DEMO_SENDER_WALLET,
    )
    .await?;
    let recipient_investor_id = ensure_demo_investor(
        pool,
        DEMO_RECIPIENT_NAME,
        DEMO_RECIPIENT_JURISDICTION,
        DEMO_RECIPIENT_WALLET,
    )
    .await?;
    let transfer_record_id =
        ensure_demo_transfer(pool, asset_id, sender_investor_id, recipient_investor_id).await?;

    ensure_demo_disclosure(pool, asset_id).await?;
    ensure_demo_passport(pool, transfer_record_id).await?;

    Ok(())
}

async fn ensure_demo_asset(pool: &PgPool) -> Result<i64, sqlx::Error> {
    if let Some(existing_id) =
        sqlx::query("SELECT id FROM assets WHERE name = $1 ORDER BY id ASC LIMIT 1")
            .bind(DEMO_ASSET_NAME)
            .fetch_optional(pool)
            .await?
            .map(|row| row.get::<i64, _>("id"))
    {
        sqlx::query("UPDATE assets SET asset_type = $2 WHERE id = $1")
            .bind(existing_id)
            .bind(DEMO_ASSET_TYPE)
            .execute(pool)
            .await?;
        return Ok(existing_id);
    }

    let row = sqlx::query("INSERT INTO assets (name, asset_type) VALUES ($1, $2) RETURNING id")
        .bind(DEMO_ASSET_NAME)
        .bind(DEMO_ASSET_TYPE)
        .fetch_one(pool)
        .await?;

    Ok(row.get::<i64, _>("id"))
}

async fn ensure_demo_investor(
    pool: &PgPool,
    legal_name: &str,
    jurisdiction: &str,
    wallet_address: &str,
) -> Result<i64, sqlx::Error> {
    if let Some(existing_id) =
        sqlx::query("SELECT id FROM investors WHERE legal_name = $1 ORDER BY id ASC LIMIT 1")
            .bind(legal_name)
            .fetch_optional(pool)
            .await?
            .map(|row| row.get::<i64, _>("id"))
    {
        sqlx::query("UPDATE investors SET jurisdiction = $2, wallet_address = $3 WHERE id = $1")
            .bind(existing_id)
            .bind(jurisdiction)
            .bind(wallet_address)
            .execute(pool)
            .await?;
        return Ok(existing_id);
    }

    let row = sqlx::query(
        "INSERT INTO investors (legal_name, jurisdiction, wallet_address) VALUES ($1, $2, $3) RETURNING id",
    )
    .bind(legal_name)
    .bind(jurisdiction)
    .bind(wallet_address)
    .fetch_one(pool)
    .await?;

    Ok(row.get::<i64, _>("id"))
}

async fn ensure_demo_transfer(
    pool: &PgPool,
    asset_id: i64,
    from_investor_id: i64,
    to_investor_id: i64,
) -> Result<i64, sqlx::Error> {
    if let Some(existing_id) = sqlx::query(
        r#"
        SELECT id
        FROM transfers
        WHERE asset_id = $1
            AND from_investor_id = $2
            AND to_investor_id = $3
            AND amount = $4
        ORDER BY id ASC
        LIMIT 1
        "#,
    )
    .bind(asset_id)
    .bind(from_investor_id)
    .bind(to_investor_id)
    .bind(DEMO_TRANSFER_AMOUNT)
    .fetch_optional(pool)
    .await?
    .map(|row| row.get::<i64, _>("id"))
    {
        sqlx::query("UPDATE transfers SET tx_hash = $2 WHERE id = $1")
            .bind(existing_id)
            .bind(DEMO_TRANSFER_TX_HASH)
            .execute(pool)
            .await?;
        return Ok(existing_id);
    }

    let row = sqlx::query(
        "INSERT INTO transfers (asset_id, from_investor_id, to_investor_id, amount, tx_hash) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    )
    .bind(asset_id)
    .bind(from_investor_id)
    .bind(to_investor_id)
    .bind(DEMO_TRANSFER_AMOUNT)
    .bind(DEMO_TRANSFER_TX_HASH)
    .fetch_one(pool)
    .await?;

    Ok(row.get::<i64, _>("id"))
}

async fn ensure_demo_disclosure(pool: &PgPool, asset_id: i64) -> Result<(), sqlx::Error> {
    if let Some(existing_id) =
        sqlx::query("SELECT id FROM disclosures WHERE data_id = $1 ORDER BY id ASC LIMIT 1")
            .bind(DEMO_DISCLOSURE_DATA_ID)
            .fetch_optional(pool)
            .await?
            .map(|row| row.get::<i64, _>("id"))
    {
        sqlx::query(
            r#"
            UPDATE disclosures
            SET asset_id = $2,
                title = $3,
                content = $4,
                grantee = $5,
                expires_at = $6,
                tx_hash = $7
            WHERE id = $1
            "#,
        )
        .bind(existing_id)
        .bind(asset_id)
        .bind(DEMO_DISCLOSURE_TITLE)
        .bind(DEMO_DISCLOSURE_CONTENT)
        .bind(DEMO_SENDER_WALLET)
        .bind(DEMO_EXPIRES_AT_UNIX)
        .bind(DEMO_DISCLOSURE_TX_HASH)
        .execute(pool)
        .await?;
        return Ok(());
    }

    sqlx::query(
        r#"
        INSERT INTO disclosures (asset_id, title, content, data_id, grantee, expires_at, tx_hash)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        "#,
    )
    .bind(asset_id)
    .bind(DEMO_DISCLOSURE_TITLE)
    .bind(DEMO_DISCLOSURE_CONTENT)
    .bind(DEMO_DISCLOSURE_DATA_ID)
    .bind(DEMO_SENDER_WALLET)
    .bind(DEMO_EXPIRES_AT_UNIX)
    .bind(DEMO_DISCLOSURE_TX_HASH)
    .execute(pool)
    .await?;

    Ok(())
}

async fn ensure_demo_passport(pool: &PgPool, transfer_record_id: i64) -> Result<(), sqlx::Error> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    sqlx::query(
        r#"
        INSERT INTO compliance_passports (
            transfer_id, transfer_record_id, transfer_id_onchain, policy_hash, disclosure_data_id, anchor_hash, status,
            transfer_tx_hash, anchor_tx_hash, disclosure_scope, reason,
            created_by, created_by_role, created_at_unix, last_accessed_unix
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'Anchored', $7, $8, $9, $10, $11, $12, $13, NULL)
        ON CONFLICT (transfer_record_id) DO UPDATE
        SET
            transfer_id = EXCLUDED.transfer_id,
            transfer_id_onchain = EXCLUDED.transfer_id_onchain,
            policy_hash = EXCLUDED.policy_hash,
            disclosure_data_id = EXCLUDED.disclosure_data_id,
            anchor_hash = EXCLUDED.anchor_hash,
            status = EXCLUDED.status,
            transfer_tx_hash = EXCLUDED.transfer_tx_hash,
            anchor_tx_hash = EXCLUDED.anchor_tx_hash,
            disclosure_scope = EXCLUDED.disclosure_scope,
            reason = EXCLUDED.reason,
            created_by = EXCLUDED.created_by,
            created_by_role = EXCLUDED.created_by_role,
            created_at_unix = EXCLUDED.created_at_unix
        "#,
    )
    .bind(transfer_record_id)
    .bind(transfer_record_id)
    .bind(DEMO_TRANSFER_ID_ONCHAIN)
    .bind(DEMO_POLICY_HASH)
    .bind(DEMO_DISCLOSURE_DATA_ID)
    .bind(DEMO_ANCHOR_HASH)
    .bind(DEMO_TRANSFER_TX_HASH)
    .bind(DEMO_ANCHOR_TX_HASH)
    .bind(DEMO_DISCLOSURE_SCOPE)
    .bind(DEMO_PASSPORT_REASON)
    .bind("system_demo_seed")
    .bind("operator")
    .bind(now)
    .execute(pool)
    .await?;

    Ok(())
}

async fn table_count(pool: &PgPool, table: &str) -> Result<i64, sqlx::Error> {
    let query = format!("SELECT COUNT(*) AS count FROM {table}");
    let row = sqlx::query(&query).fetch_one(pool).await?;
    Ok(row.get::<i64, _>("count"))
}

async fn column_exists(pool: &PgPool, table: &str, column: &str) -> Result<bool, sqlx::Error> {
    let row = sqlx::query(
        r#"
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
                AND table_name = $1
                AND column_name = $2
        ) AS exists
        "#,
    )
    .bind(table)
    .bind(column)
    .fetch_one(pool)
    .await?;

    Ok(row.get::<bool, _>("exists"))
}
