# Research sources and data policy

Start with official municipal sources and store `source_url`, `fetched_at`, `source_updated_at`, `license`, and `confidence` with every imported record.

Tel Aviv's public ArcGIS catalog currently exposes useful layers for parking lots, parking zones, and Ahuzot Hof facility status. These can support facility and policy context, but they do not prove that a specific curb space is legal or vacant. Verify the municipality's reuse terms before production ingestion.

Google Maps and Waze navigation deep links are appropriate for zero-cost outbound navigation. Their commercial APIs, as well as private parking-payment providers, must not be described as free or connected without an approved account and documented terms.

Jerusalem, Haifa, and third-party datasets remain candidates only after currency, scope, and license are verified.
