# Changelog

## [1.1.0](https://github.com/satusdev/cloudmesh/compare/v1.0.0...v1.1.0) (2026-07-20)


### Features

* add docker compose file instead ([de0b885](https://github.com/satusdev/cloudmesh/commit/de0b885b2e1312bd4ecac4b472e6f24fb8b1df77))
* add domain expiry monitoring and sending warrn message ([d24e464](https://github.com/satusdev/cloudmesh/commit/d24e464cd8a86ef93f768914cb4886430b32007f))
* **backend:** implement modular python engine under src ([1dddc1e](https://github.com/satusdev/cloudmesh/commit/1dddc1e651ef3289447fb6399b25da6252725923))
* **backend:** implement report generator with passcode hashing ([0ec933d](https://github.com/satusdev/cloudmesh/commit/0ec933d27a57af8f6ec2a2bfb2851da76fda4e9e))
* **config:** add dashboard passcode support to env and config ([d2dc5f8](https://github.com/satusdev/cloudmesh/commit/d2dc5f8313286d227b18897e07ed9b40c5153047))
* **config:** update environment template for google chat and daemon mode ([9706f0a](https://github.com/satusdev/cloudmesh/commit/9706f0a5cc32a5c75496c36c0efbf8b69d546867))
* **dashboard:** integrate dynamic server pricing and add multi-tab layouts ([b4beb0b](https://github.com/satusdev/cloudmesh/commit/b4beb0b5827d200a924f7bbebb520ebbf9a32c89))
* **deploy:** add production deploy scripts deploy.sh and deploy.ps1 ([89fcefa](https://github.com/satusdev/cloudmesh/commit/89fcefac74e3575c2afccdf4dc2c3d65aece5ef6))
* **deploy:** implement remote redeploy script and finalize dashboard tabs ([ebf282d](https://github.com/satusdev/cloudmesh/commit/ebf282df8b0de631ea76a320c032be9dfaa60b0e))
* **deploy:** refactor deployment scripts to build tarball and load target settings from env ([8e0e6a2](https://github.com/satusdev/cloudmesh/commit/8e0e6a2e113819f10f70c319e942b5dca05889b4))
* **docker:** replace grafana with nginx static host on port 8080 ([3d00299](https://github.com/satusdev/cloudmesh/commit/3d0029980ca7d2eb54f5ec94ed12b1b13a719dc7))
* **frontend:** fix light and dark theme colors and enable tailwind class dark mode ([89ac543](https://github.com/satusdev/cloudmesh/commit/89ac54358edb061a5e644a64368a80287e963a9d))
* **frontend:** implement react and vite dashboard with topology and telemetry ([b6e0348](https://github.com/satusdev/cloudmesh/commit/b6e03484bf22582104fe2ba4e49f8813de1abc24))
* **frontend:** remove optimization advisor and add passcode gate lock screen ([f1487d6](https://github.com/satusdev/cloudmesh/commit/f1487d659ee88f2ec23846c6aa7bebc82fbb5a71))
* implement TTL-based cache expiration for WHOIS domain lookups ([9d4a246](https://github.com/satusdev/cloudmesh/commit/9d4a24603bc7573a9436c162a0fc4981beb3c1ee))
* integrate Hetzner Robot API for dedicated servers and add pagination to CleanupTab UI ([f8585a2](https://github.com/satusdev/cloudmesh/commit/f8585a21cd4bc014114c660402830af2f9c7ad3d))
* **pricing:** audit and refine instance price calculation accuracy ([f4b4ffe](https://github.com/satusdev/cloudmesh/commit/f4b4ffedda2ae005b32a42aa4aeefeeffcb42d51))


### Bug Fixes

* **deploy:** ensure target directory exists and document WHOIS dependency ([586ab93](https://github.com/satusdev/cloudmesh/commit/586ab93846d8f5510679c1cf4b9962da86a0f66c))
* issues in grafana board and made it better ([9ccec9d](https://github.com/satusdev/cloudmesh/commit/9ccec9da5bc45826fbb3652496ef7556d6718935))
* **reports:** align total spending calculations across HTML, PDF, and React dashboard ([794d379](https://github.com/satusdev/cloudmesh/commit/794d3796084836a5f013aef5a17ef92efdc88ae2))
* update port for grafana to fix issues ([85568b0](https://github.com/satusdev/cloudmesh/commit/85568b0bfa3da2b8e3765807ba644293832c2793))


### Performance Improvements

* **core:** parallelize DNS/WHOIS queries and cache lookup errors ([c615fd2](https://github.com/satusdev/cloudmesh/commit/c615fd2da650d094562cbff458c424eeee1454ac))

## 1.0.0 (2025-07-31)


### Features

* added grafana and prometheus ([1e242dd](https://github.com/satusdev/cloudmesh/commit/1e242dd9576d0cb13402a6841a865e357374f93b))
* integration with slack send ([aea5b12](https://github.com/satusdev/cloudmesh/commit/aea5b12b5da913bb9a323d69019c2577b9cc3a0c))
* **report:** send weekly HTML report to Slack if webhook is set ([c03796f](https://github.com/satusdev/cloudmesh/commit/c03796f768ac71a0bc9b5f016f8902298827e98e))
* setup project ([78069c5](https://github.com/satusdev/cloudmesh/commit/78069c5594553443a735c4f0ef36166a444c1c16))


### Bug Fixes

* **report:** send only PDF report to Slack and remove HTML upload ([6b427ec](https://github.com/satusdev/cloudmesh/commit/6b427ec452edcbffd0799693cb474d8340acf8b7))
