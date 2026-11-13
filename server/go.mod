module github.com/BintangDwitama/minovsky-maps/server

go 1.25.0

require (
	github.com/BintangDwitama/minovsky-maps/schema v0.0.0
	github.com/jackc/pgx/v5 v5.13.0
	github.com/santhosh-tekuri/jsonschema/v6 v6.0.3
)

require (
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
	github.com/jackc/puddle/v2 v2.2.3 // indirect
	golang.org/x/sync v0.22.0 // indirect
	golang.org/x/text v0.41.0 // indirect
)

replace github.com/BintangDwitama/minovsky-maps/schema => ../schema
