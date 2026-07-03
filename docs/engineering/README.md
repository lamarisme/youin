# Engineering Documentation

This directory contains engineering documentation for major product features.

Unlike product documentation, these documents focus on architectural decisions, runtime behavior, implementation details, validation, migration planning, and future evolution.

Each feature should have its own directory containing all engineering documentation related to that feature.

## Folder convention

Each engineering feature owns its own folder under `docs/engineering/`.

Feature folders may contain:

- `README.md` for the feature documentation map
- QA reports
- Architecture proposals
- Behavior specifications
- Implementation reports
- Migration plans, when applicable

Keep document filenames stable once published. Prefer adding a feature `README.md` that explains the current reading order instead of moving or renaming existing documents.
