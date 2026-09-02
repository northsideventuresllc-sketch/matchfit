---
name: nvg-operating-rules
description: POINTER ONLY (2026-09-02). NVG operating rules live in exactly one home — skill `nvg-operator-core` (binding law, in nv-vault) plus the live `nv_rules` row read via `select * from v_boot;`. Use this skill only to be redirected there; never treat this file as the rules.
---

# nvg-operating-rules → pointer

The rules were duplicated here and drifted. As of 2026-09-02 (Agentic OS audit) this skill holds nothing but the pointer:

1. Invoke `nvg-operator-core` (nv-vault `.claude/skills/nvg-operator-core/SKILL.md`).
2. `select * from v_boot;` on NI-Brain `kxijunwgbrlfzvgkhklo` — the live rules row wins over any file.
3. Canonical text mirror: nv-vault `_meta/OPERATING-RULES.md`.

If you are reading this because the vault is unreachable: say so in one line and assert nothing about current rules.
