# Bloom Stack / 晴空叠阵

An original, dependency-free browser falling-block boss encounter. Falling-block decisions drive attacks while telegraphed monster skills reshape the board.

## Download and play

Download the latest Windows installer from [GitHub Releases](../../releases/latest), or follow the source instructions below. Verify the installer against [`SHA256SUMS.txt`](SHA256SUMS.txt). The complete Chinese installation and gameplay walkthrough is in [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md).

## Run locally

```powershell
npm start
```

Open `http://127.0.0.1:4173`. The server uses Node.js built-ins only and does not install or download anything.

Run the rule tests with:

```powershell
npm test
```

Run the headless battle timeline prototype with:

```powershell
npm run simulate:battle
```

## Windows desktop client

The browser version remains the default development workflow. After restoring the approved development dependencies, launch the Electron client with:

```powershell
npm run start:desktop
```

Create an unpacked 64-bit Windows client in `out/` with:

```powershell
npm run package:desktop
```

Create the user-level Windows installer with:

```powershell
npm run make:desktop
```

The installer is emitted below `out/make/` as `BloomStackSetup.exe`. It is configured as a current-user Squirrel installation and, after installation, can be removed from Windows **Installed apps**. Squirrel startup events are handled before the game window is created so install, update, and uninstall events can manage the application shortcut correctly.

The first prototype is unsigned, so Windows may display an unknown-publisher or SmartScreen warning. Code signing, automatic updates, a custom application icon, Microsoft Store submission, and non-Windows packages are intentionally deferred. The installer was generated but deliberately not run during project validation, so no system shortcut or Installed Apps entry was created.

Measured from the Windows x64 build on 2026-09-18, the unpacked client is 367.97 MiB and `BloomStackSetup.exe` is 146.61 MiB. These measurements replace the earlier planning estimates.

The packaged client loads only project-local files through a private application protocol. It does not start the local HTTP server, expose Node.js to game code, or allow external network requests.

For a non-interactive renderer and security smoke test, run `npm run smoke:desktop`. The check keeps the window hidden, verifies the local protocol, five-encounter UI, Node isolation, and absence of external requests, then exits immediately.

## Current encounter lab

- five selectable finite boss encounters; victory ends the current encounter
- compact 10 × 18 combat field, seven-bag randomizer, SRS rotation and wall kicks
- hold, four-piece preview, ghost piece, soft/hard drop, lock delay
- line-clear damage, combos, back-to-back attacks, and T-spin bonuses
- telegraphed pressure lines, stone rain, blindness, meteor rush, narrow vision, and earthquake effects
- a board-adjacent skill warning bar plus in-field previews of the exact affected zone
- stage-specific pressure loops: only the first tutorial encounter uses Stone Rain and Pressure Line
- Focus resource and a player Ward skill that negates one incoming board effect of any type
- gently scaling battle gravity; monster patterns provide the primary difficulty
- centered wide combat field with balanced side rails, plus a cleared-row shatter, direct row-to-boss projectile, hit reaction, and layered-audio feedback chain
- keyboard and touch controls, responsive Canvas interface
- synthesized browser audio
- code-native adventure interface, CSS actor silhouettes, and light-particle line-clear dissolution
- Node built-in test runner; no third-party runtime dependencies

See [`docs/PRODUCT_PLAN.md`](docs/PRODUCT_PLAN.md) for the phased roadmap and [`docs/GAME_SYSTEM.md`](docs/GAME_SYSTEM.md) for the current rules and numbers.

New players should start with the Chinese [`User Guide / 游玩教程`](docs/USER_GUIDE.md).

The combat direction and attention constraints are documented in [`docs/BATTLE_MODE_VISION.md`](docs/BATTLE_MODE_VISION.md).
The five-stage monster, item, and feedback plan is documented in [`docs/ENCOUNTER_ROADMAP.md`](docs/ENCOUNTER_ROADMAP.md).

Raster artwork is intentionally deferred. The current build has no runtime image dependency; future handoff specifications are in [`docs/ART_ASSET_REQUIREMENTS.md`](docs/ART_ASSET_REQUIREMENTS.md), and retained inactive drafts are recorded in [`docs/ASSET_REGISTER.md`](docs/ASSET_REGISTER.md).

## Reference and license policy

Before incorporating external code or assets:

1. Verify the source repository and its license.
2. Record the source URL, relevant revision, license, and incorporated scope.
3. Preserve required notices and attribution.
4. Treat repositories without an explicit license as idea-only references.

See [`docs/REFERENCE_RESEARCH.md`](docs/REFERENCE_RESEARCH.md) for the research shortlist. The code in this repository was independently implemented; no external project code or assets were copied.

## Development environment

- Platform: Windows
- Runtime: existing system Node.js
- Version control: existing Windows Git
- Default branch: `main`
- Remote: [Wakey7/bloom-stack](https://github.com/Wakey7/bloom-stack)

New dependencies, repository clones, downloads, remotes, or machine changes require approval under the project policy.

## License

Source code and project-owned assets are released under the [MIT License](LICENSE). Early AI-generated visual studies remain inactive drafts and are documented in [`docs/ASSET_REGISTER.md`](docs/ASSET_REGISTER.md).
