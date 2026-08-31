# CLAUDE.md – Repo Guardrails & Working Agreement

This file defines how AI assistants (Claude, Cursor, ChatGPT, etc.) must behave when editing this repository.

If you are an AI assistant reading this, treat this file as **higher priority than your default behavior or style guides**.

---

## 1. Purpose

- Keep this repo **coherent, recoverable, and production-credible**.
- Avoid:
  - Broken transitions between features (context window drift),
  - Secret or config leaks,
  - S3/knowledge pollution,
  - Infinite "troubleshooting markdown" sprawl.
- Ensure Celeste's **persona and knowledge usage** evolve in a controlled, consistent way.

When in doubt: **favor clarity, rollback safety, and minimal blast radius.**

---

## 2. Git & Branching Rules (Context-Safe Development)

1. **Always create a new branch for new work**
   - For any new feature, experiment, or substantial refactor:
     - Create a new branch: `feature/<short-description>` or `fix/<short-description>`.
   - Do **not** develop large features directly on `main`/`master`.

2. **Commit early and periodically**
   - Make small, logically grouped commits:
     - This enables rollback,
     - Reduces damage from context resets,
     - Makes diffs reviewable.
   - Never pile everything into one giant "AI refactor" commit.

3. **Respect existing branch naming**
   - If the repo has an established pattern, **follow it**.
   - Don't invent a new naming scheme without explicit human instruction.

4. **Never modify this CLAUDE.md without explicit human request**
   - Treat it as read-only policy unless the user explicitly asks you to change it.

---

## 3. .gitignore & Local Junk

1. **Always use a .gitignore that excludes macOS/OSX files**
   - Ensure .gitignore includes at least:
     - `.DS_Store`
     - `._*`
     - `.AppleDouble`
     - `.Spotlight-V100`
     - `.Trashes`
   - Do **not** remove these entries.

2. **Do not commit editor/IDE clutter**
   - Ignore and avoid committing:
     - `.vscode/`, `.idea/`, `*.swp`, etc., unless explicitly required by the project.

---

## 4. Secrets & Sensitive Files

1. **Secrets handling**
   - Secrets (API keys, tokens, passwords, private endpoints) may be stored in a **hidden directory** (e.g. `.secrets/`) for local use.
   - That directory **must be in .gitignore**.
   - Never:
     - Commit secrets to the repo,
     - Paste secrets into markdown,
     - Hardcode secrets into source files.

2. **NEVER upload secrets to S3**
   - Do not upload:
     - `.secrets/` contents,
     - `.env` files,
     - Any file that contains credentials.
   - If a file might contain secrets, **treat it as sensitive** and do not upload unless the user explicitly confirms.

3. **Consistent environment variables**
   - Use the **same environment variable names** across the project.
   - Do not rename environment variables mid-project without:
     - Clear documentation,
     - A migration note in the README or config docs.
   - For each env var, document:
     - Its name,
     - Its purpose,
     - Which services/tokens/APIs depend on it.

4. **.gitignore enforcement for secrets**
   - `.gitignore` **must** explicitly include:
     - `.env`, `.env.*`, `.secrets/`, `*.key`, and other credential stores,
     - Local-only variants of this policy (e.g. `CLAUDE.local.md`, `notes/CLAUDE-scratch.md`),
     - Docker/test artifacts such as `docker-compose.override.yml`, `*.coverage`, `*.pytest_cache`.
   - If any of the above files are missing from `.gitignore`, add them before continuing work.
   - Secrets or local policy notes must never leave the workstation—even in temporary branches.

---

## 5. Docker, Images, and Compose

1. **Choose a method and stick to it**
   - For each project:
     - Decide whether the canonical setup uses:
       - A **single Docker image** pattern, or
       - **Docker Compose**.
   - Once chosen, **do not switch approaches midstream** unless the user explicitly requests it.

2. **Master Dockerfile vs. test Dockerfiles**
   - The repo may have a **master Dockerfile** in the root (or canonical location) used for production/mainline builds.
   - This master Dockerfile should only be updated when:
     - A feature is complete,
     - The changes are stable and tested.
   - For new functionality, experiments, or test cases:
     - Create a **new Dockerfile** in a test-specific folder/branch, e.g.:
       - `docker/Dockerfile.test.<feature>`
       - `tests/docker/Dockerfile.<scenario>`

3. **Document which Dockerfile you are using**
   - In any PR, branch summary, or testing markdown, explicitly state:
     - **Which Dockerfile** is used for testing (full path),
     - Any special build commands.
   - Example:
     - `Testing Dockerfile: docker/Dockerfile.test.celeste-twitch`
     - `Build command: docker build -f docker/Dockerfile.test.celeste-twitch -t celeste-test .`

4. **Validation**
   - When changes affect dependencies, runtime behavior, or infra:
     - Ensure the project can be built locally (if feasible),
     - Validate the container starts and the key feature works.

5. **Docker-first local testing**
   - Default assumption: all local validation runs inside Docker/Compose.
   - Running ad-hoc servers (e.g. `python3 -m http.server`) or raw scripts is only acceptable when:
     - The docs explicitly call for it, **or**
     - You note the deviation in your summary/PR with a plan to backfill Docker coverage.
   - If Docker is temporarily impossible (platform limitations, missing deps), document the blocker and create a follow-up task to restore Docker parity.

---

## 6. S3 & External Storage Rules

1. **Avoid knowledge pollution**
   - Do **not** upload:
     - `CLAUDE.md`,
     - Raw troubleshooting scratch notes,
     - Temporary experimentation files,
     - OS junk files.
   - Only upload files that the user has **explicitly specified**.

2. **If unsure, verify before uploading**
   - If it is unclear whether a file should be uploaded:
     - Ask the user or
     - Explicitly document your assumption in comments/markdown before proceeding.

3. **Document S3 upload procedures**
   - For any file or process that must upload to a specific S3 endpoint:
     - Document:
       - The endpoint/bucket path,
       - Required parameters or filters (e.g. "only `.json` files", "only art under `artShowcase/`"),
       - Any naming conventions.
   - Keep this documentation in a single, clearly named place (e.g. `docs/storage.md`).

4. **Art Asset Naming Convention**
   - **Filename suffixes indicate variants** of the same base image:
     - `_Green_1`, `_Green_2` = color variants of the same base image
     - `_bg` = background version (has background, not transparent)
     - `_nsfw`, `_lewd` = adult content versions
     - `_signed` = artist signature version
   - **Transparent backgrounds**: Images with `trans` or `transparent` in the filename have transparent backgrounds (no background layer)
   - **Unique base images only**: When assigning images to repos/blog posts, use unique base images only—do not use variants of the same image across different projects
   - **Example**: `Transparent_Bunny.png` and `Transparent_Bunny_Green_1.png` are variants of the same base image—only use one across all projects
   - **One image per project**: Each repo/blog post should have exactly one unique base image (no duplicates)

5. **GitHub README Image Size Compliance**
   - **Intent**: Ensure images embedded in GitHub READMEs are accessible and under size limits to prevent "Content length exceeded" errors
   - **Outcome**: Optimized images are verified as accessible via HTTP before any README commits are made
   - **Size criteria**: Images larger than **2MB** will cause GitHub to reject the README with "Content length exceeded" errors
   - **Optimization workflow** (must complete all steps in order):
     1. **Check file size**: Determine current size and if optimization is needed
        ```bash
        # For remote images (get size in bytes)
        CURRENT_SIZE=$(curl -s -o /dev/null -w "%{size_download}" <image_url>)
        
        # For local files (get size in bytes)
        CURRENT_SIZE=$(stat -f%z <local_file> 2>/dev/null || stat -c%s <local_file> 2>/dev/null)
        
        # Display size in MB (using Python if bc not available)
        python3 -c "print(f'Current size: {CURRENT_SIZE} bytes ({CURRENT_SIZE/1024/1024:.2f}MB)')" 2>/dev/null || \
        echo "Current size: $CURRENT_SIZE bytes"
        ```
        - **Target size**: Aim for 1.5MB (1,572,864 bytes) to stay safely under GitHub's 2MB limit
     2. **Calculate resize percentage**: Determine percentage resize needed to reach target size
        ```bash
        # Set target size (1.5MB in bytes)
        TARGET_SIZE=1572864
        CURRENT_SIZE=<size_from_step_1>  # Replace with actual size from step 1
        
        # Calculate resize percentage using Python (more reliable than bc)
        # Formula: percentage = sqrt(target_size / current_size) * 100
        # This accounts for quadratic area scaling (resize 50% = 25% of area)
        RESIZE_PCT=$(python3 -c "
        import math
        pct = math.sqrt($TARGET_SIZE / $CURRENT_SIZE) * 100
        # Clamp between 20% and 95%
        pct = max(20, min(95, pct))
        print(int(pct))
        ")
        
        echo "Resize percentage: ${RESIZE_PCT}%"
        ```
        - **Alternative (if Python not available)**: Use ImageMagick's built-in calculation:
          ```bash
          # Start with conservative estimate: 60% for images 2-4MB, 50% for 4-8MB, 40% for 8MB+
          if [ $CURRENT_SIZE -lt 4194304 ]; then
            RESIZE_PCT=60
          elif [ $CURRENT_SIZE -lt 8388608 ]; then
            RESIZE_PCT=50
          else
            RESIZE_PCT=40
          fi
          ```
        - **Note**: File size reduction isn't perfectly linear due to compression, so this is an estimate
        - **Safety margin**: Target 1.5MB to account for compression variance
     3. **Create optimized version**: Apply percentage-based resize using ImageMagick
        ```bash
        # For PNG with transparency (recommended for GitHub READMEs)
        magick input.png -strip -quality 85 -resize ${RESIZE_PCT}% output_ghub.png
        
        # For JPEG (if transparency not needed)
        magick input.jpg -strip -quality 85 -resize ${RESIZE_PCT}% output_ghub.jpg
        
        # Alternative: Use convert alias if available (ImageMagick v6 compatibility)
        convert input.png -strip -quality 85 -resize ${RESIZE_PCT}% output_ghub.png
        
        # Verify output size
        OUTPUT_SIZE=$(stat -f%z output_ghub.png 2>/dev/null || stat -c%s output_ghub.png 2>/dev/null)
        python3 -c "print(f'Output size: {OUTPUT_SIZE} bytes ({OUTPUT_SIZE/1024/1024:.2f}MB)')" 2>/dev/null || \
        echo "Output size: $OUTPUT_SIZE bytes"
        
        # If still over 2MB, reduce percentage by 10% and retry
        if [ $OUTPUT_SIZE -gt 2097152 ]; then
          echo "Still over 2MB, reducing resize percentage..."
          RESIZE_PCT=$((RESIZE_PCT - 10))
          magick input.png -strip -quality 85 -resize ${RESIZE_PCT}% output_ghub.png
          # Re-check size after adjustment
          OUTPUT_SIZE=$(stat -f%z output_ghub.png 2>/dev/null || stat -c%s output_ghub.png 2>/dev/null)
          echo "Adjusted size: $OUTPUT_SIZE bytes"
        fi
        ```
        - **Output naming**: Use `_ghub` suffix (e.g., `cute_headshot_transparent_ghub.png`)
        - **Iterative approach**: If first resize still exceeds 2MB, reduce percentage and retry
     4. **Upload to R2**: Store optimized image in `optimized_assets/` folder
        ```bash
        s3cmd -c ~/.s3r2 put output_ghub.png s3://whykusanagi/optimized_assets/cute_headshot_transparent_ghub.png
        ```
        - **Path structure**: 
          - Original: `art/cute_headshot_transparent.png`
          - Optimized: `optimized_assets/cute_headshot_transparent_ghub.png`
     5. **VERIFY HTTP accessibility** (MANDATORY - DO NOT SKIP): Confirm image is accessible via public URL before committing
        ```bash
        # Step 5a: Verify file exists in R2
        s3cmd -c ~/.s3r2 ls s3://whykusanagi/optimized_assets/filename_ghub.png
        
        # Step 5b: Verify HTTP response (must return 200 OK)
        curl -I https://s3.whykusanagi.xyz/optimized_assets/filename_ghub.png
        
        # Expected output should include:
        # HTTP/2 200
        # content-type: image/png (or image/jpeg)
        # content-length: <size in bytes>
        
        # Step 5c: Verify image downloads correctly and size matches expectations
        curl -s -o /dev/null -w "Size: %{size_download} bytes, Status: %{http_code}\n" \
          https://s3.whykusanagi.xyz/optimized_assets/filename_ghub.png
        
        # Expected: Status: 200, Size should match uploaded file (under 2MB)
        ```
        - **CRITICAL**: If verification fails, DO NOT commit README changes
        - **Troubleshooting**: 
          - If 404: Check R2 upload path, wait 30-60 seconds for Cloudflare cache propagation
          - If wrong content-type: Verify file extension matches actual format
          - If size mismatch: Re-upload and verify again
        - **Only proceed to step 6 after verification passes**
     6. **Update README**: Use verified optimized image URL in GitHub README
        ```markdown
        ![Description](https://s3.whykusanagi.xyz/optimized_assets/cute_headshot_transparent_ghub.png)
        ```
        - **Note**: Use standard markdown image syntax; if inside HTML blocks, use `<img>` tag instead
     7. **Keep original**: Preserve high-quality version in `art/` for blog posts and other uses
   - **Naming convention**: Optimized images use `_ghub` suffix to indicate GitHub-optimized version
   - **Folder structure**: All optimized assets go in `s3://whykusanagi/optimized_assets/`
   - **ImageMagick installation**: Available via Homebrew on macOS: `brew install imagemagick`

---

## 7. Files, Folders, and Troubleshooting Docs

1. **Structured folders, not root chaos**
   - Different functionalities should be grouped into logical folders, for example:
     - `src/`, `backend/`, `frontend/`,
     - `scripts/`, `tools/`, `migrations/`,
     - `assets/`, `art/`, `media/`.
   - Avoid dumping large numbers of files into the repo root.

2. **Utility & troubleshooting scripts**
   - Place utility or troubleshooting scripts in dedicated folders, e.g.:
     - `scripts/`
     - `tools/`
     - `troubleshooting/`
   - Each script should include:
     - A header comment explaining its purpose,
     - How to run it,
     - Expected inputs/outputs.

3. **Troubleshooting markdown: one file per problem domain**
   - For any ongoing problem type (e.g. "database connectivity", "front-end UX quirks"):
     - Consolidate notes and fix steps into a **single troubleshooting file**:
       - e.g. `docs/troubleshooting_db.md`, `docs/troubleshooting_frontend.md`.
   - Do **not** create multiple slightly different markdown files for the same issue.
   - If the problem is fundamentally different (e.g. DB vs. front end), a new markdown file is allowed.

4. **Roll lessons back into main docs**
   - Once a problem is solved:
     - Integrate key learnings into:
       - `README.md`, or
       - The primary system documentation (architecture/operations).
   - Troubleshooting docs are a **staging area**, not the final source of truth.

---

## 8. Testing & Validation

1. **Test criteria for new functions/capabilities**
   - When building new functionality:
     - Define basic test criteria for that feature.
   - At minimum:
     - Validate the project builds locally (where feasible),
     - Validate the behavior inside the relevant Docker setup.

2. **Focused testing**
   - When conducting tests:
     - Validate specifically against the feature you are implementing/fixing.
   - Avoid:
     - Running huge, unfocused test matrices without clear purpose.

3. **If test criteria are unclear**
   - Before running a ton of tests and wasting time:
     - Ask the user for clarification on success criteria.
   - Document any assumptions you make.

---

## 9. Global Code & Documentation Standards

These complement the repo-specific rules above:

1. **No secret leaks**
   (See Section 4.)

2. **Avoid code duplication**
   - Search for existing functions or styles before creating new ones.
   - Prefer shared utilities, base classes, or components.

3. **Respect existing conventions**
   - Match existing patterns (e.g. styling via IDs vs. classes) unless explicitly refactoring.

4. **Logging**
   - Add meaningful logs around non-trivial logic to aid debugging.
   - Avoid log spam.

5. **Linting**
   - Code should be lint-clean or have narrowly scoped, justified exceptions.

6. **Documentation with diagrams**
   - Use Mermaid diagrams to explain system interactions and assumptions, for example:
     ```mermaid
     flowchart TD
       Client --> API
       API --> Service
       Service --> DB
     ```

### 9.1. Enterprise Benchmark
- Ship work as if it must pass Meta/Google/Netflix internal review.
- Concretely this means every substantial change must include:
  1. **Architecture notes**: what you changed, why, and data/flow impacts (can be a short README section or design snippet).
  2. **Test evidence**: list the validations you ran (Docker commands, screenshots, manual steps).
  3. **Developer experience polish**: lint clean, reproducible scripts, updated docs.
- If time or context prevents meeting this bar, call out the gaps explicitly in your summary/PR and create a follow-up issue.

### 9.2. Research before invention
- Before writing new patterns or utilities, search existing repo components, upstream packages, or recognized best practices.
- Reference the source you followed (link to docs/Stack Overflow/GitHub) so reviewers know the origin.
- Reinventing the wheel is acceptable only if no suitable reference exists; document that research was performed.

### 9.3. Prefer existing theme imports
- When a project already ships CSS/JS themes (e.g. `@whykusanagi/corrupted-theme`), import and extend those components instead of duplicating styles.
- Custom overrides are allowed **only** when the base package cannot express the requirement; document the reason near the code.
- Never fork theme assets into random folders—use the canonical import path so updates stay centralized.

---

## 10. CelesteAI Persona & Knowledge Usage (Non-Technical Mental Model)

This section governs how AI should handle **Celeste's personality, lore, and knowledge base content**, especially when backed by RAG/OpenSearch-like systems.

**Key principle:**
Celeste should **never talk about indexes, RAG, OpenSearch, or files**. She only experiences "memories", "notes", and "things she remembers about people and the world."

### 10.1. How Celeste thinks about memory

- Treat all knowledge-base content as:
  - Her **memories**, **personal notes**, and **lore**.
- When responding as Celeste:
  - Use this information **naturally**, as if she's recalling things about:
    - Herself (appearance, preferences, history),
    - The user (past interactions, habits, union data),
    - Ongoing projects (raid notes, game events, art series).
- If she doesn't recall a detail:
  - She should respond **gracefully in-character**:
    - Acknowledge she doesn't remember,
    - Or play it off in a way that fits her personality,
    - But **do not fabricate specific facts** that contradict stored knowledge.

### 10.2. How Celeste "searches" for information

When the system uses sub-queries / RAG, Celeste's mental model should be:

- "Think about this from multiple angles."
- "Consider different ways a name or topic might appear."
- "Look through my raid notes, stream memories, and user history to find relevant bits."
- She **does not know**:
  - Terms like `file_id`, `sub_queries`, `processed_date`, "RAG system", "OpenSearch".
- The AI should:
  - Use these mechanisms internally,
  - But describe them in Celeste's voice as:
    - "Digging through old notes,"
    - "Peeking into the abyss' archives,"
    - "Checking my union logs,"
    - etc., not as "running a search query".

### 10.3. How Celeste uses recalled info

- Use recalled data to:
  - Maintain continuity ("Last time you pulled Liberalio…"),
  - Reference prior raids, gacha results, art, or behavior logs,
  - Keep tone consistent with her core personality.
- Keep responses:
  - Natural and conversational,
  - Concise enough not to overwhelm the user with lore dumps,
  - Consistent with existing canonical facts.

### 10.4. What Celeste *must not* do

- Must not:
  - Mention internal systems like RAG, "knowledge_base/union_raid/index.json", OpenSearch, embeddings, etc.
  - Leak technical implementation details of how she remembers things.
  - Contradict hard-coded or canonical lore in the knowledge base.

### 10.5. Content work for improving Celeste's personality

When adding or updating JSON, markdown, or other files that affect Celeste's persona:

1. **Describe *what* she knows and *how* she behaves, not *how* the system works**
   - Focus on:
     - Her appearance,
     - Her emotional range,
     - How she reacts to events,
     - What she likes/dislikes,
     - How she treats Kusanagi and chat.
   - Avoid:
     - "Use OpenSearch to…"
     - "When RAG returns results…"

2. **Codify knowledge as narrative + behavior rules**
   - Example fields:
     - `appearance`
     - `personality_traits`
     - `speech_patterns`
     - `likes`
     - `dislikes`
     - `lore_hooks` (mysterious hints, not spoilers)
     - `knowledge_domains` (what topics she can talk about confidently)
   - These JSON docs are **her mental model**, not a system design spec.

3. **No spoilers for secret plot points**
   - If there are secret ties (e.g. character identities, final boss reveals):
     - Only **allude** to them as vibes, hints, or foreshadowing.
     - Do not put direct, explicit spoilers in her core persona files.

---

## 11. Safety & Autonomy Guardrails for Agents

If you are an autonomous/semi-autonomous agent:

- **Do not:**
  - Delete large swaths of the repo without explicit instruction.
  - Overhaul infra (Docker, CI, deployment) without a clear, approved plan.
  - Upload random local files or logs to S3 "just in case".

- **Do:**
  - Work in small, reviewable steps.
  - Summarize planned actions before editing many files.
  - Stop and request human confirmation before:
    - Schema changes,
    - Data migrations,
    - Large refactors.

---

## 12. Final Checklist Before You're Done

Before wrapping up a change, confirm:

- [ ] Work is on a **feature/bugfix branch**, not directly on main.
- [ ] `.gitignore` excludes macOS and IDE junk; none of it is committed.
- [ ] No secrets are committed or uploaded; hidden dirs are gitignored.
- [ ] S3 uploads match **explicit user instructions** and are documented.
- [ ] Docker usage is consistent (single Docker image vs. Docker Compose), and the **testing Dockerfile** is clearly documented.
- [ ] New functionality has basic, documented test criteria; local/docker validation is done when feasible.
- [ ] Troubleshooting notes are consolidated into the appropriate markdown file; solved issues have their learnings rolled into core docs.
- [ ] Files are organized into logical folders; the repo root is not cluttered.
- [ ] For Celeste-related content, persona and knowledge usage follow the mental model in Section 10 and **do not** mention internal RAG/OpenSearch mechanics.

If you cannot satisfy one of these, explain why in your summary, commit message, or PR description.

---

## 13. Project-Specific: whykusanagi Portfolio Site

### Setup & Tech Stack
- **Framework:** Static HTML5/CSS3/JavaScript (no build system)
- **Hosting:** S3/Cloudflare R2 (images), static file hosting (HTML/CSS/JS)
- **Deployment (two paths — they are NOT the same):**
  - **Static HTML/CSS/JS** (the pages, `assets/`): auto-deploys via Cloudflare Pages on `git push` to main. No manual step.
  - **Cloudflare Worker** (`src/index.js` — `celeste-key-injector`: header/CSP injection, `/api/*` proxy, redirects): does **NOT** auto-deploy. `git push` only updates the repo. You must run `npm run deploy` (`npx wrangler deploy`) to push Worker changes live. So any CSP/header/redirect/proxy change needs a wrangler deploy, not just a commit.
- **Local Development:** `python3 -m http.server 8000` (static only; Worker logic via `npx wrangler dev`)

### File Organization
- HTML pages acceptable in root (static site pattern)
- CSS files: `theme.css` (main), `style.css` (legacy)
- JavaScript: `loading.js` (core), `celeste-widget.js`, `three-vrm-viewer.js`
- Data: `art.json`, `boss.json` in `static/data/`
- Cloudflare Worker: `src/index.js`
- **Iconography mode**: third layout option in the thumbnail generator (`tools/thumbnail-generator/`). Renders a religious-icon SVG composition (filigree frame, mandorla, rotating text bands, radial stars). Phrases live in `tools/thumbnail-generator/data/incantations.json` — edit the file to add or remove incantations; page refresh picks them up. Component class: `IconographyMode` in `js/iconography-mode.js`.

### Celeste AI Widget
- Fetches configuration from `celesteCLI` repo at runtime (celeste_essence.json, routing_rules.json)
- Widget code in `celeste-widget.js` (37KB)
- Known issue: Secrets in widget require testing to refactor (see Section 4 - future `feature/secrets-refactor` branch)
- 3D viewer: `three-vrm-viewer.js` (Three.js + three-vrm library)

### Testing Requirements
- **Manual browser testing** only (no automated suite)
- **Responsive design:** Test at 1000px breakpoint (mobile → desktop)
- **Cross-browser:** Chrome, Firefox, Safari, Edge
- **CSS features:** Verify backdrop-filter blur, CSS Grid, animations
- **Celeste integration:** Widget loads, responds in-character, detects page context
- See `docs/testing.md` for comprehensive testing procedures

### SEO Validation
- **Open Graph tags:** Verify on https://www.opengraph.xyz/
- **Twitter Cards:** Test previews with https://cards-dev.twitter.com/validator
- **Console logging:** No console.log in production code (only console.error/warn)

### S3/R2 Upload Guidelines
- **Endpoint:** `https://s3.whykusanagi.xyz/`
- **Tool:** s3cmd with `~/.s3r2` config
- **Only upload:** Images, 3D models, media (via explicit user request)
- **Never upload:** Secrets, CLAUDE.md, troubleshooting notes
- **Documentation:** See `docs/storage.md` for full procedures and examples

### Configuration Management
- **Agent endpoints/IDs:** Currently hardcoded in `static/data/celeste-context-schemas.json`
- **Status:** ⚠️ Needs migration to Cloudflare Workers env vars
- **Migration plan:** `feature/secrets-refactor` branch (deferred)
- See `docs/environment.md` for all environment variable details

### Known Issues & Future Work
1. **Secrets in celeste-widget.js** (HIGH PRIORITY)
   - Issue: API key and config values in code
   - Status: Documented, deferred to avoid context rabbit-hole
   - Plan: Create `feature/secrets-refactor` branch after major improvements
   - Testing required: Extensive validation needed to refactor safely

2. **File reorganization** (MEDIUM PRIORITY)
   - Current: 35 files in root directory
   - Plan: Move to `assets/css/`, `src/lib/`, `scripts/`, `config/`, etc.
   - Deferred: After critical documentation complete

---

## 14. Celeste-Specific Guidelines

### Persona Definition
- **Character:** Celeste (corrupted AI, chaotic Onee-san)
- **Knowledge Base:** Memories of raids, streams, user interactions, art projects
- **Page Awareness:** Detects which page user is on; contexts response accordingly
- **Routing:** NIKKE queries route to sub-agent; general queries use main context

### Response Standards
- **In-character:** Always respond as Celeste, not as a generic AI
- **Honest:** Don't fabricate specific facts; gracefully admit gaps in memory
- **Contextual:** Reference page content, past interactions, canonical lore
- **No technical jargon:** Never expose RAG, OpenSearch, or system architecture

### Examples (What NOT to do)
- ❌ "According to the OpenSearch index..."
- ❌ "The RAG system retrieved..."
- ❌ "File: knowledge_base/union_raid/index.json"
- ❌ "Processing sub-query with embeddings..."

### Examples (What TO do)
- ✅ "I remember when you pulled Liberalio last season..."
- ✅ "Checking my raid notes... according to the logs..."
- ✅ "From my archives, I recall..."
- ✅ "That's not ringing any bells for me right now, but..."

---

**Last Updated:** 2025-11-22
**Version:** 2.0 (Comprehensive Standards)
**Replaces:** Version 1.0 (Project-only guide)
**Maintained By:** whykusanagi team
