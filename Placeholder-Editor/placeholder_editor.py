import os
import sys
import json
import re
import tkinter as tk
from tkinter import ttk, filedialog, messagebox

class PlaceholderEditorApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Placeholder Editor")
        self.root.geometry("820x680")
        self.root.minsize(700, 500)

        self.entries = {}
        self.target_dir_var = tk.StringVar()
        self.config_path_var = tk.StringVar()

        # Locate default config file
        script_dir = os.path.dirname(os.path.abspath(__file__))
        default_config = os.path.abspath(os.path.join(script_dir, "..", "POC-base-app", "data_placeholders.md"))
        self.config_path_var.set(default_config if os.path.exists(default_config) else "")

        # Default target folder
        default_target = os.path.abspath(os.path.join(script_dir, "..", "POC-base-app"))
        if os.path.exists(default_target):
            self.target_dir_var.set(default_target)

        self.setup_ui()
        if self.config_path_var.get():
            self.load_config(self.config_path_var.get())

    def setup_ui(self):
        style = ttk.Style()
        style.theme_use("clam")

        # Top Header Frame
        header_frame = ttk.Frame(self.root, padding="15 15 15 10")
        header_frame.pack(fill=tk.X)

        title_lbl = ttk.Label(
            header_frame, 
            text="🔧 Placeholder Editor", 
            font=("Segoe UI", 16, "bold")
        )
        title_lbl.pack(anchor=tk.W)

        subtitle_lbl = ttk.Label(
            header_frame,
            text="Assign replacement values to project placeholders before deploying or permanently updating a target folder.",
            font=("Segoe UI", 9)
        )
        subtitle_lbl.pack(anchor=tk.W, pady=(2, 10))

        # Config file selection frame
        config_frame = ttk.LabelFrame(header_frame, text="Registry Configuration (data_placeholders.md)", padding="8")
        config_frame.pack(fill=tk.X, pady=(0, 5))

        cfg_entry = ttk.Entry(config_frame, textvariable=self.config_path_var, font=("Consolas", 9))
        cfg_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 5))

        cfg_btn = ttk.Button(config_frame, text="Browse...", command=self.browse_config)
        cfg_btn.pack(side=tk.LEFT, padx=(0, 5))

        cfg_load_btn = ttk.Button(config_frame, text="Reload", command=lambda: self.load_config(self.config_path_var.get()))
        cfg_load_btn.pack(side=tk.LEFT)

        # Target Folder Frame
        target_frame = ttk.LabelFrame(header_frame, text="Target Folder to Apply Changes", padding="8")
        target_frame.pack(fill=tk.X, pady=(5, 0))

        tgt_entry = ttk.Entry(target_frame, textvariable=self.target_dir_var, font=("Consolas", 9))
        tgt_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 5))

        tgt_btn = ttk.Button(target_frame, text="Select Target Folder...", command=self.browse_target)
        tgt_btn.pack(side=tk.LEFT)

        # Middle Scrollable Form Frame
        form_outer = ttk.LabelFrame(self.root, text="Placeholder Values", padding="10")
        form_outer.pack(fill=tk.BOTH, expand=True, padx=15, pady=10)

        self.canvas = tk.Canvas(form_outer, borderwidth=0, highlightthickness=0)
        scrollbar = ttk.Scrollbar(form_outer, orient=tk.VERTICAL, command=self.canvas.yview)
        self.scrollable_frame = ttk.Frame(self.canvas)

        self.scrollable_frame.bind(
            "<Configure>",
            lambda e: self.canvas.configure(scrollregion=self.canvas.bbox("all"))
        )

        self.canvas_frame_id = self.canvas.create_window((0, 0), window=self.scrollable_frame, anchor="nw")
        self.canvas.bind(
            "<Configure>",
            lambda e: self.canvas.itemconfig(self.canvas_frame_id, width=e.width)
        )

        self.canvas.configure(yscrollcommand=scrollbar.set)
        self.canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        # Bind mouse wheel
        self.canvas.bind_all("<MouseWheel>", self._on_mousewheel)

        # Bottom Action Bar
        bottom_frame = ttk.Frame(self.root, padding="15 10 15 15")
        bottom_frame.pack(fill=tk.X)

        self.status_var = tk.StringVar(value="Ready.")
        status_lbl = ttk.Label(bottom_frame, textvariable=self.status_var, font=("Segoe UI", 9, "italic"))
        status_lbl.pack(side=tk.LEFT)

        apply_btn = tk.Button(
            bottom_frame,
            text="Apply Placeholder Assignments",
            font=("Segoe UI", 10, "bold"),
            bg="#0284c7",
            fg="white",
            activebackground="#0369a1",
            activeforeground="white",
            relief=tk.FLAT,
            padx=16,
            pady=8,
            cursor="hand2",
            command=self.on_apply_clicked
        )
        apply_btn.pack(side=tk.RIGHT)

    def _on_mousewheel(self, event):
        self.canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")

    def browse_config(self):
        f = filedialog.askopenfilename(
            title="Select data_placeholders.md or JSON file",
            filetypes=[("Markdown & JSON", "*.md;*.json"), ("All Files", "*.*")]
        )
        if f:
            self.config_path_var.set(f)
            self.load_config(f)

    def browse_target(self):
        d = filedialog.askdirectory(title="Select Target Folder for Placeholder Replacement")
        if d:
            self.target_dir_var.set(d)

    def load_config(self, filepath):
        if not filepath or not os.path.exists(filepath):
            self.status_var.set("Config file not found.")
            return

        try:
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()

            # Handle JSON enclosed in markdown code fences
            match = re.search(r"```json\s*(\{.*?\})\s*```", content, re.DOTALL)
            if match:
                raw_json = match.group(1)
            else:
                match_generic = re.search(r"(\{.*\})", content, re.DOTALL)
                raw_json = match_generic.group(1) if match_generic else content

            data = json.loads(raw_json)
            placeholders = data.get("placeholders", {})

            # Clear existing form rows
            for widget in self.scrollable_frame.winfo_children():
                widget.destroy()
            self.entries.clear()

            # Populate rows
            row_idx = 0
            for ph_key, meta in placeholders.items():
                poc_val = meta.get("pocValue", "") if isinstance(meta, dict) else str(meta)

                row_frame = ttk.Frame(self.scrollable_frame, padding="4 6")
                row_frame.pack(fill=tk.X, expand=True)

                lbl = ttk.Label(
                    row_frame, 
                    text=ph_key, 
                    font=("Consolas", 10, "bold"), 
                    width=28, 
                    anchor=tk.W
                )
                lbl.pack(side=tk.LEFT, padx=(0, 10))

                entry_var = tk.StringVar(value=poc_val)
                entry = ttk.Entry(row_frame, textvariable=entry_var, font=("Segoe UI", 10))
                entry.pack(side=tk.LEFT, fill=tk.X, expand=True)

                self.entries[ph_key] = entry_var
                row_idx += 1

            self.status_var.set(f"Loaded {len(placeholders)} placeholder definitions from registry.")

        except Exception as e:
            messagebox.showerror("Error Reading Config", f"Failed to parse config file:\n{e}")
            self.status_var.set("Error loading config.")

    def on_apply_clicked(self):
        target_dir = self.target_dir_var.get().strip()
        if not target_dir or not os.path.isdir(target_dir):
            messagebox.showerror("Target Missing", "Please select a valid existing target folder first.")
            return

        if not self.entries:
            messagebox.showwarning("No Placeholders", "No placeholder definitions are loaded.")
            return

        # Display safeguard confirmation modal with 5-second countdown
        self.show_safeguard_modal(target_dir)

    def show_safeguard_modal(self, target_dir):
        modal = tk.Toplevel(self.root)
        modal.title("⚠️ Irreversible Operation Warning")
        modal.geometry("540x360")
        modal.resizable(False, False)
        modal.transient(self.root)
        modal.grab_set()

        # Center modal over root
        x = self.root.winfo_x() + (self.root.winfo_width() // 2) - 270
        y = self.root.winfo_y() + (self.root.winfo_height() // 2) - 180
        modal.geometry(f"+{x}+{y}")

        content_frame = ttk.Frame(modal, padding="20")
        content_frame.pack(fill=tk.BOTH, expand=True)

        warn_title = ttk.Label(
            content_frame,
            text="⚠️ Permanent Code Modification Warning",
            font=("Segoe UI", 12, "bold"),
            foreground="#b91c1c"
        )
        warn_title.pack(anchor=tk.W, pady=(0, 10))

        warning_text = (
            f"Target Directory:\n{target_dir}\n\n"
            "CRITICAL SAFEGUARD:\n"
            "Applying these placeholder assignments will permanently overwrite placeholder "
            "tags across all files in the target directory with real values.\n\n"
            "This operation is IRREVERSIBLE. If you want to keep a clean version of the source "
            "code with placeholder tags, verify that you have made a separate backup copy "
            "before confirming."
        )
        msg_lbl = ttk.Label(
            content_frame,
            text=warning_text,
            font=("Segoe UI", 9),
            wraplength=490,
            justify=tk.LEFT
        )
        msg_lbl.pack(anchor=tk.W, fill=tk.BOTH, expand=True)

        # Countdown label
        countdown_var = tk.StringVar(value="Please wait 5 seconds before confirming... (5)")
        timer_lbl = ttk.Label(
            content_frame,
            textvariable=countdown_var,
            font=("Segoe UI", 9, "bold"),
            foreground="#b91c1c"
        )
        timer_lbl.pack(anchor=tk.W, pady=(10, 15))

        # Buttons
        btn_frame = ttk.Frame(content_frame)
        btn_frame.pack(fill=tk.X)

        cancel_btn = ttk.Button(btn_frame, text="Cancel", command=modal.destroy)
        cancel_btn.pack(side=tk.RIGHT, padx=(10, 0))

        understood_btn = tk.Button(
            btn_frame,
            text="Understood",
            font=("Segoe UI", 9, "bold"),
            bg="#dc2626",
            fg="white",
            activebackground="#b91c1c",
            activeforeground="white",
            relief=tk.FLAT,
            padx=14,
            pady=5,
            state=tk.DISABLED,
            command=lambda: [modal.destroy(), self.execute_replacements(target_dir)]
        )
        understood_btn.pack(side=tk.RIGHT)

        # 5-second countdown logic
        remaining_seconds = 5

        def tick():
            nonlocal remaining_seconds
            remaining_seconds -= 1
            if remaining_seconds > 0:
                countdown_var.set(f"Please wait {remaining_seconds} seconds before confirming... ({remaining_seconds})")
                modal.after(1000, tick)
            else:
                countdown_var.set("You may now proceed if your backup is verified.")
                timer_lbl.configure(foreground="#15803d")
                understood_btn.configure(state=tk.NORMAL, cursor="hand2")

        modal.after(1000, tick)

    def execute_replacements(self, target_dir):
        assignments = {k: v.get() for k, v in self.entries.items()}
        
        # Ignored paths and extensions
        ignored_dirs = {".git", "node_modules", "dist", "build", ".vscode", "__pycache__", ".idea"}
        binary_exts = {
            ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".pdf", 
            ".zip", ".tar", ".gz", ".exe", ".dll", ".so", ".bin", 
            ".woff", ".woff2", ".ttf", ".eot"
        }

        modified_files_count = 0
        total_replacements_count = 0

        self.status_var.set("Applying placeholder replacements...")
        self.root.update_idletasks()

        for root_dir, dirs, files in os.walk(target_dir):
            # Prune ignored directories
            dirs[:] = [d for d in dirs if d not in ignored_dirs]

            for file_name in files:
                _, ext = os.path.splitext(file_name)
                if ext.lower() in binary_exts:
                    continue

                file_path = os.path.join(root_dir, file_name)

                # Skip config file to avoid overwriting the registry definition
                if file_name == "data_placeholders.md":
                    continue

                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        original_text = f.read()
                except (UnicodeDecodeError, PermissionError):
                    # Try latin-1 fallback or skip unreadable binary
                    try:
                        with open(file_path, "r", encoding="latin-1") as f:
                            original_text = f.read()
                    except Exception:
                        continue

                new_text = original_text
                file_replacements = 0

                for ph_key, val in assignments.items():
                    if ph_key in new_text:
                        count = new_text.count(ph_key)
                        file_replacements += count
                        new_text = new_text.replace(ph_key, val)

                if file_replacements > 0:
                    try:
                        with open(file_path, "w", encoding="utf-8") as f:
                            f.write(new_text)
                        modified_files_count += 1
                        total_replacements_count += file_replacements
                    except Exception as e:
                        print(f"Failed to write {file_path}: {e}")

        self.status_var.set(
            f"Completed: {total_replacements_count} replacements applied across {modified_files_count} files."
        )
        messagebox.showinfo(
            "Replacements Complete",
            f"Successfully applied placeholder assignments!\n\n"
            f"Files modified: {modified_files_count}\n"
            f"Total replacements: {total_replacements_count}\n"
            f"Target directory: {target_dir}"
        )

if __name__ == "__main__":
    root = tk.Tk()
    app = PlaceholderEditorApp(root)
    root.mainloop()
