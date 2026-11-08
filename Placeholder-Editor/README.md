# Placeholder Editor 🔧

A standalone Python GUI utility designed to translate the project's placeholder registry (`data_placeholders.md`) into an interactive form, allowing developers and operators to assign target values to all placeholders and apply them permanently across a chosen codebase.

---

## Purpose & Safeguards

When deploying a Proof of Concept (POC) or instantiating a new tenant application from a sanitized base template (such as `POC-base-app/`), code and configurations contain parameterized placeholder tags (e.g., `<CompNamePlaceHolder>`, `<AdminMailPlaceHolder>`, `<DbConPlaceHolder>`).

This tool safely bridges the gap between template placeholders and deployable code:
- **Interactive Form:** Automatically parses `data_placeholders.md` and generates input fields pre-filled with POC default values.
- **Target Folder Picker:** Lets you choose exactly which folder receives the replacements.
- **5-Second Safeguard Countdown:** Because replacing placeholders in source code is irreversible, clicking **"Apply Placeholder Assignments"** triggers a prominent warning modal with a locked 5-second countdown timer. The **"Understood"** button remains disabled until the timer elapses, ensuring you have verified that a backup of your template exists.

---

## Prerequisites

- **Python 3.8+** (Uses the standard library `tkinter`, `json`, `os`, `re` — **no `pip install` required**).

---

## How to Run

From PowerShell or command prompt:

```powershell
cd Placeholder-Editor
python placeholder_editor.py
```

---

## Operating Workflow

1. **Launch the Editor:** The application opens and automatically loads the nearest `data_placeholders.md` registry.
2. **Review & Edit Values:** Modify any placeholder values in the form fields (e.g., set real client company name, database connection string, admin email).
3. **Select Target Folder:** Click **"Select Target Folder..."** and pick the directory to update (recommended: work on a dedicated copy of the base template).
4. **Apply Replacements:** Click **"Apply Placeholder Assignments"**.
5. **Safeguard Confirmation:** Read the warning dialog, verify your backup, and wait 5 seconds until the **"Understood"** button activates. Click **"Understood"** to proceed.
6. **Completion:** A summary pop-up displays the number of modified files and total replacements performed.
