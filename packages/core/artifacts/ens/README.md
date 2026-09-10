ENSv2 ABIs from verified Sepolia sources. `ETHRegistrar.json`, `PermissionedResolverImplV2.json`
and `UniversalResolver.json` are the hackathon deployment's (Etherscan, 2026-09-10; the registrar's
`renew` takes a `RenewData` struct there, the resolver keys records by DNS name). The rest were
copied from `ensdomains/namechain` `contracts/deployments/sepolia/*.json` on 2026-09-05 and are
identical on both Sepolia sets. `PermissionedResolverImpl.json` is the beta's older resolver
generation. Regenerate `src/generated/ens/` with `pnpm gen:abis`.
