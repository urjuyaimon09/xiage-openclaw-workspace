himalaya account configure

[accounts.personal]
email = "you@example.com"
display-name = "Your Name"
default = true

backend.type = "imap"
backend.host = "imap.example.com"
backend.port = 993
backend.encryption.type = "tls"
backend.login = "you@example.com"
backend.auth.type = "password"
backend.auth.cmd = "pass show email/imap"  # or use keyring

message.send.backend.type = "smtp"
message.send.backend.host = "smtp.example.com"
message.send.backend.port = 587
message.send.backend.encryption.type = "start-tls"
message.send.backend.login = "you@example.com"
message.send.backend.auth.type = "password"
message.send.backend.auth.cmd = "pass show email/smtp"

himalaya folder list

himalaya envelope list

himalaya envelope list --folder "Sent"

himalaya envelope list --page 1 --page-size 20

himalaya envelope list from john@example.com subject meeting

himalaya message read 42

himalaya message export 42 --full

himalaya message reply 42

himalaya message reply 42 --all

himalaya message forward 42

himalaya message write

cat << &#x27;EOF&#x27; | himalaya template send
From: you@example.com
To: recipient@example.com
Subject: Test Message

Hello from Himalaya!
EOF

himalaya message write -H "To:recipient@example.com" -H "Subject:Test" "Message body here"

himalaya message move 42 "Archive"

himalaya message copy 42 "Important"

himalaya message delete 42

himalaya flag add 42 --flag seen

himalaya flag remove 42 --flag seen

himalaya account list

himalaya --account work envelope list

himalaya attachment download 42

himalaya attachment download 42 --dir ~/Downloads

himalaya envelope list --output json
himalaya envelope list --output plain

RUST_LOG=debug himalaya envelope list

RUST_LOG=trace RUST_BACKTRACE=1 himalaya envelope list

Himalaya CLI to manage emails via IMAP/SMTP. Use `himalaya` to list, read, write, reply, forward, search, and organize emails from the terminal. Supports multiple accounts and message composition with MML (MIME Meta Language). MIT-0 · Free to use, modify, and redistribute. No attribution required. ⭐ 58 · 32.5k · 1.3k current installs · 1.3k all-time installs by André Lamelas · @lamelas MIT-0 Security Scan VirusTotal VirusTotal Benign View report → OpenClaw OpenClaw Benign high confidence The skill is an instruction-only wrapper for the Himalaya CLI and its requirements and instructions are coherent with that purpose — nothing in the package asks for unrelated credentials or installs arbitrary remote code. Details ▾ ✓ Purpose &amp; Capability Name/description (CLI email client) matches the instructions: all commands are himalaya CLI invocations, configuration references (~/.config/himalaya/config.toml), and message composition with MML. The metadata&#x27;s brew install entry is proportional to installing a CLI tool. ℹ Instruction Scope SKILL.md instructs the agent to run himalaya commands and to read/use the user&#x27;s config file (~/.config/himalaya/config.toml). It also documents mechanisms for retrieving passwords via commands (backend.auth.cmd) and using local file paths for attachments. These are expected for an email client but are noteworthy because they mean the CLI (when invoked) may read local files and execute configured retrieval commands. ✓ Install Mechanism There is no aggressive install script in the registry; metadata suggests a brew formula (himalaya) which is a standard package distribution method. No downloads from arbitrary URLs or extracted archives are present in the skill bundle. ℹ Credentials The skill declares no required environment variables or credentials. However, the configuration examples show storing credentials in the config file (including raw passwords) or fetching them via commands like &#x27;pass show ...&#x27; or keyring. Those are normal for an email client but mean the running CLI will access secrets supplied in the config or returned by configured commands—so credential access is proportional but sensitive. ✓ Persistence &amp; Privilege always is false and the skill does not request persistent privileges or modify other skills/system-wide settings. Autonomous invocation is allowed by default (platform behavior) but not combined here with other red flags. Assessment This skill is an instruction-only helper for the Himalaya CLI and appears internally consistent. Before installing/using it: 1) Verify you trust the upstream Himalaya project and the brew formula source (homepage points to the GitHub repo). 2) Do not put raw passwords in ~/.config/himalaya/config.toml; prefer a system keyring or a password manager command (e.g., pass) and ensure any command you configure to emit passwords is trusted. 3) Be aware that composing messages with attachments or MML may cause the CLI to read arbitrary local file paths you specify—avoid allowing attachments that reference sensitive files. 4) Check file permissions on your config (it will contain credentials or commands to retrieve them). 5) If you want tighter control, run the CLI manually rather than granting an autonomous agent unrestricted ability to invoke it. Like a lobster shell, security has layers — review code before you run it. Current version v 1.0.0 Download zip latest v k972c3cy05pgq2pw4017bykcc57ywcwr License MIT-0 Free to use, modify, and redistribute. No attribution required. Terms https://spdx.org/licenses/MIT-0.html Runtime requirements 📧 Clawdis Bins himalaya Install Install Himalaya (brew) Bins: himalaya brew install himalaya Files Compare Versions SKILL.md Himalaya Email CLI Himalaya is a CLI email client that lets you manage emails from the terminal using IMAP, SMTP, Notmuch, or Sendmail backends. References references/configuration.md (config file setup + IMAP/SMTP authentication) references/message-composition.md (MML syntax for composing emails) Prerequisites Himalaya CLI installed ( himalaya --version to verify) A configuration file at ~/.config/himalaya/config.toml IMAP/SMTP credentials configured (password stored securely) Configuration Setup Run the interactive wizard to set up an account: himalaya account configure Or create ~/.config/himalaya/config.toml manually: [accounts.personal] email = &quot;you@example.com&quot; display-name = &quot;Your Name&quot; default = true backend.type = &quot;imap&quot; backend.host = &quot;imap.example.com&quot; backend.port = 993 backend.encryption.type = &quot;tls&quot; backend.login = &quot;you@example.com&quot; backend.auth.type = &quot;password&quot; backend.auth.cmd = &quot;pass show email/imap&quot; # or use keyring message.send.backend.type = &quot;smtp&quot; message.send.backend.host = &quot;smtp.example.com&quot; message.send.backend.port = 587 message.send.backend.encryption.type = &quot;start-tls&quot; message.send.backend.login = &quot;you@example.com&quot; message.send.backend.auth.type = &quot;password&quot; message.send.backend.auth.cmd = &quot;pass show email/smtp&quot; Common Operations List Folders himalaya folder list List Emails List emails in INBOX (default): himalaya envelope list List emails in a specific folder: himalaya envelope list --folder &quot;Sent&quot; List with pagination: himalaya envelope list --page 1 --page-size 20 Search Emails himalaya envelope list from john@example.com subject meeting Read an Email Read email by ID (shows plain text): himalaya message read 42 Export raw MIME: himalaya message export 42 --full Reply to an Email Interactive reply (opens $EDITOR): himalaya message reply 42 Reply-all: himalaya message reply 42 --all Forward an Email himalaya message forward 42 Write a New Email Interactive compose (opens $EDITOR): himalaya message write Send directly using template: cat &lt;&lt; &#x27;EOF&#x27; | himalaya template send From: you@example.com To: recipient@example.com Subject: Test Message Hello from Himalaya! EOF Or with headers flag: himalaya message write -H &quot;To:recipient@example.com&quot; -H &quot;Subject:Test&quot; &quot;Message body here&quot; Move/Copy Emails Move to folder: himalaya message move 42 &quot;Archive&quot; Copy to folder: himalaya message copy 42 &quot;Important&quot; Delete an Email himalaya message delete 42 Manage Flags Add flag: himalaya flag add 42 --flag seen Remove flag: himalaya flag remove 42 --flag seen Multiple Accounts List accounts: himalaya account list Use a specific account: himalaya --account work envelope list Attachments Save attachments from a message: himalaya attachment download 42 Save to specific directory: himalaya attachment download 42 --dir ~/Downloads Output Formats Most commands support --output for structured output: himalaya envelope list --output json himalaya envelope list --output plain Debugging Enable debug logging: RUST_LOG=debug himalaya envelope list Full trace with backtrace: RUST_LOG=trace RUST_BACKTRACE=1 himalaya envelope list Tips Use himalaya --help or himalaya &lt;command&gt; --help for detailed usage. Message IDs are relative to the current folder; re-list after folder changes. For composing rich emails with attachments, use MML syntax (see references/message-composition.md ). Store passwords securely using pass , system keyring, or a command that outputs the password. Files 3 total SKILL.md 4.3 KB references/configuration.md 4.0 KB references/message-composition.md 3.7 KB Select a file Select a file to preview. Comments Loading comments…