# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `aprovado`           | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

**`aprovado` has a side effect:** applying it triggers the `claude.yml` GitHub Action, which starts implementing the issue (see the issue flow in `.claude/CLAUDE.md`). The implementation step expects an analysis comment on the issue already. Apply `aprovado` only to issues that are fully specified and analysed.

Edit the "Label in our tracker" column to match whatever vocabulary you actually use.
