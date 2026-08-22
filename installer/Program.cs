using System.Diagnostics;
using System.Security.Cryptography;
using Microsoft.Win32;

// ─── Entry point (top-level statements) ──────────────────────────────────────

bool silent = args.Contains("--silent");
bool doUninstall = args.Contains("--uninstall");

Console.OutputEncoding = System.Text.Encoding.UTF8;
Console.Title = $"{K.AppName} Installer v{K.AppVersion}";

return doUninstall ? RunUninstall(silent) : RunInstall(silent);

// ─── Install ──────────────────────────────────────────────────────────────────

static int RunInstall(bool silent)
{
    PrintBanner();

    string sourceDir = Path.GetFullPath(AppContext.BaseDirectory).TrimEnd('\\', '/');
    string defaultInstall = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), K.AppName);

    // Verify source integrity
    string[] required = ["backend", "frontend", "desktop", "node", "Start-Scripto.bat", "Start-Scripto.ps1"];
    foreach (var item in required)
    {
        var p = Path.Combine(sourceDir, item);
        if (!File.Exists(p) && !Directory.Exists(p))
        {
            WriteError($"Required component '{item}' not found in installer directory.\n" +
                       $"         Expected at: {p}\n" +
                       $"         The installer package may be incomplete. Re-download Scripto.zip.");
            if (!silent) Pause();
            return 1;
        }
    }

    string installDir = defaultInstall;
    if (!silent)
    {
        Console.WriteLine($"  Install location:  {installDir}");
        Console.WriteLine();
        Console.WriteLine("  [1] Install to default location (recommended)");
        Console.WriteLine("  [2] Choose a different location");
        Console.WriteLine("  [3] Cancel");
        Console.WriteLine();
        Console.Write("  Your choice [1]: ");
        var choice = Console.ReadLine()?.Trim() ?? "";

        if (choice == "3") { Console.WriteLine("\n  Cancelled."); return 0; }
        if (choice == "2")
        {
            Console.Write($"\n  Install path [{defaultInstall}]: ");
            var custom = Console.ReadLine()?.Trim();
            if (!string.IsNullOrWhiteSpace(custom)) installDir = custom;
        }
        Console.WriteLine();
    }

    bool isSameDir = string.Equals(
        Path.GetFullPath(sourceDir).TrimEnd('\\'),
        Path.GetFullPath(installDir).TrimEnd('\\'),
        StringComparison.OrdinalIgnoreCase);

    if (isSameDir)
    {
        Console.WriteLine("  Source equals install target — repair mode (skipping file copy).");
        Console.WriteLine();
    }
    else if (Directory.Exists(installDir) && !silent)
    {
        WriteColor(ConsoleColor.Yellow, $"  WARNING: {installDir} already exists.");
        Console.WriteLine("  Upgrading will overwrite application files and preserve user data + secrets.");
        Console.Write("  Continue? [Y/n]: ");
        var c = Console.ReadLine()?.Trim().ToUpperInvariant() ?? "Y";
        if (c == "N") { Console.WriteLine("\n  Cancelled."); return 0; }
        Console.WriteLine();
    }

    if (!isSameDir)
    {
        if (Directory.Exists(installDir)) StopExistingInstance(installDir);
        try { CopyWithProgress(sourceDir, installDir); }
        catch (Exception ex) { WriteError($"Failed to copy files: {ex.Message}"); return 1; }
    }

    // Write backend secrets (fresh install) or preserve existing ones (upgrade)
    string backendEnv = Path.Combine(installDir, "backend", ".env");
    bool needSecrets = !File.Exists(backendEnv) || File.ReadAllText(backendEnv).Contains("change-me");
    if (needSecrets)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(backendEnv)!);
        File.WriteAllLines(backendEnv, new[]
        {
            "PORT=4445",
            "DATABASE_URL=",
            "CORS_ORIGINS=http://localhost:4444,http://127.0.0.1:4444",
            $"JWT_ACCESS_SECRET={GenerateSecret()}",
            $"JWT_REFRESH_SECRET={GenerateSecret()}",
            "DEV_EMAIL_VERIFICATION_BYPASS=false",
            "TRANSCRIPTION_PROVIDER=local-whisper",
            "NODE_ENV=production",
            ""
        }, System.Text.Encoding.UTF8);
        Console.WriteLine("  Generated secrets   (backend\\.env)");
    }
    else
    {
        Console.WriteLine("  Preserved secrets   (backend\\.env)");
    }

    Directory.CreateDirectory(Path.Combine(installDir, "logs"));

    // Create Start Menu shortcut
    string startMenuDir = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.StartMenu), "Programs", K.AppName);
    Directory.CreateDirectory(startMenuDir);
    string ps1 = Path.Combine(installDir, "Start-Scripto.ps1");
    string desktopExe = Path.Combine(installDir, "desktop", "Scripto.Desktop.exe");

    CreateShortcut(
        target: "powershell.exe",
        arguments: $"-NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File \"{ps1}\"",
        link: Path.Combine(startMenuDir, $"{K.AppName}.lnk"),
        desc: $"{K.AppName} — AI Dictation",
        workDir: installDir,
        icon: desktopExe);
    Console.WriteLine("  Start Menu shortcut created");

    if (!silent)
    {
        Console.Write("  Create Desktop shortcut? [y/N]: ");
        if ((Console.ReadLine()?.Trim().ToUpperInvariant() ?? "N") == "Y")
        {
            CreateShortcut(
                target: "powershell.exe",
                arguments: $"-NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File \"{ps1}\"",
                link: Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Desktop), $"{K.AppName}.lnk"),
                desc: $"{K.AppName} — AI Dictation",
                workDir: installDir,
                icon: desktopExe);
            Console.WriteLine("  Desktop shortcut created");
        }
    }

    // Register in HKCU (no admin required)
    try
    {
        using var regKey = Registry.CurrentUser.CreateSubKey(K.RegPath);
        regKey.SetValue("DisplayName", K.AppName);
        regKey.SetValue("DisplayVersion", K.AppVersion);
        regKey.SetValue("Publisher", K.Publisher);
        regKey.SetValue("InstallLocation", installDir);
        regKey.SetValue("UninstallString",
            $"cmd /c start \"\" \"{Path.Combine(installDir, "install.exe")}\" --uninstall");
        regKey.SetValue("DisplayIcon", $"{desktopExe},0");
        regKey.SetValue("NoModify", 1, RegistryValueKind.DWord);
        regKey.SetValue("NoRepair", 1, RegistryValueKind.DWord);
        Console.WriteLine("  Registered in Programs & Features");
    }
    catch { /* non-fatal */ }

    Console.WriteLine();
    WriteColor(ConsoleColor.Green, "  ==============================================");
    WriteColor(ConsoleColor.Green, $"   {K.AppName} v{K.AppVersion} installed successfully!");
    WriteColor(ConsoleColor.Green, "  ==============================================");
    Console.WriteLine();
    Console.WriteLine($"  Install location : {installDir}");
    Console.WriteLine($"  Logs             : {Path.Combine(installDir, "logs")}");
    Console.WriteLine();
    Console.WriteLine($"  Launch: Start Menu → {K.AppName} → {K.AppName}");
    Console.WriteLine("  Dictate: press Ctrl+Fn or Ctrl+Alt (hold) to start dictating.");
    Console.WriteLine();

    if (!silent)
    {
        Console.Write("  Launch Scripto now? [Y/n]: ");
        if ((Console.ReadLine()?.Trim().ToUpperInvariant() ?? "Y") != "N")
        {
            Process.Start(new ProcessStartInfo("powershell",
                $"-NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File \"{ps1}\"")
            { UseShellExecute = true });
        }
        Pause();
    }

    return 0;
}

// ─── Uninstall ─────────────────────────────────────────────────────────────────

static int RunUninstall(bool silent)
{
    string installDir = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), K.AppName);

    Console.WriteLine();
    Console.WriteLine($"  {K.AppName} Uninstaller");
    Console.WriteLine("  ─────────────────────");
    Console.WriteLine();

    if (!Directory.Exists(installDir))
    {
        Console.WriteLine($"  {K.AppName} is not installed at: {installDir}");
        if (!silent) Pause();
        return 0;
    }

    if (!silent)
    {
        Console.WriteLine($"  This will remove {K.AppName} from: {installDir}");
        Console.WriteLine("  User data (.local-pg\\) will be preserved.");
        Console.Write("  Continue? [y/N]: ");
        if ((Console.ReadLine()?.Trim().ToUpperInvariant() ?? "N") != "Y")
        {
            Console.WriteLine("  Cancelled."); return 0;
        }
    }

    try
    {
        var sm = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.StartMenu), "Programs", K.AppName);
        if (Directory.Exists(sm)) Directory.Delete(sm, recursive: true);
        Console.WriteLine("  Start Menu removed");
    }
    catch { }

    try
    {
        var lnk = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Desktop), $"{K.AppName}.lnk");
        if (File.Exists(lnk)) File.Delete(lnk);
    }
    catch { }

    try
    {
        Registry.CurrentUser.DeleteSubKey(K.RegPath, throwOnMissingSubKey: false);
        Console.WriteLine("  Registry entry removed");
    }
    catch { }

    try
    {
        string userData = Path.Combine(installDir, ".local-pg");
        string tmpData = Path.Combine(Path.GetTempPath(), $"Scripto-data-{Path.GetRandomFileName()}");
        bool hadData = Directory.Exists(userData);
        if (hadData) Directory.Move(userData, tmpData);

        // The running install.exe can't delete itself; remove everything else now
        // and clean up the exe (and empty installDir) via a deferred helper below.
        string selfExe = Environment.ProcessPath ?? "";
        foreach (var dir in Directory.GetDirectories(installDir))
        {
            try { Directory.Delete(dir, recursive: true); } catch { }
        }
        foreach (var file in Directory.GetFiles(installDir))
        {
            if (string.Equals(file, selfExe, StringComparison.OrdinalIgnoreCase)) continue;
            try { File.Delete(file); } catch { }
        }

        if (hadData)
        {
            Directory.Move(tmpData, userData);
            Console.WriteLine($"  User data preserved: {userData}");
        }
        Console.WriteLine("  Application files removed");

        // Deferred: give this process a couple seconds to exit, then remove
        // install.exe and the (now-empty, unless data was restored) installDir.
        string cmdArgs = "/C \"" +
            "timeout /T 2 /NOBREAK >nul & " +
            $"del /F /Q \"{selfExe}\" & " +
            $"rmdir \"{installDir}\" 2>nul" +
            "\"";
        Process.Start(new ProcessStartInfo("cmd.exe", cmdArgs)
        {
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden,
        });
    }
    catch (Exception ex)
    {
        Console.WriteLine($"  WARNING: Could not fully remove {installDir}: {ex.Message}");
    }

    Console.WriteLine();
    WriteColor(ConsoleColor.Green, $"  {K.AppName} has been uninstalled.");
    Console.WriteLine();
    if (!silent) Pause();
    return 0;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

static void PrintBanner()
{
    Console.WriteLine();
    WriteColor(ConsoleColor.Cyan, "  ================================================");
    WriteColor(ConsoleColor.Cyan, $"      {K.AppName} v{K.AppVersion} — Windows Installer");
    WriteColor(ConsoleColor.Cyan, "  ================================================");
    Console.WriteLine();
}

static void StopExistingInstance(string installDir)
{
    string stopScript = Path.Combine(installDir, "Stop-Scripto.ps1");
    if (!File.Exists(stopScript)) return;

    Console.WriteLine("  Stopping running Scripto processes before upgrade...");
    try
    {
        var psi = new ProcessStartInfo("powershell",
            $"-NonInteractive -NoProfile -ExecutionPolicy Bypass -File \"{stopScript}\"")
        {
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden,
        };
        using var proc = Process.Start(psi);
        proc?.WaitForExit(15000);
    }
    catch { /* best effort - if nothing was running, the copy below will succeed anyway */ }
}

static void CopyWithProgress(string src, string dst)
{
    // Only skip copying install.exe over itself when running in-place (repair mode).
    // In a normal install, install.exe must be copied into installDir so the
    // registry UninstallString (which points at <installDir>\install.exe) works later.
    string selfExe = Environment.ProcessPath ?? "";
    string selfDestPath = Path.Combine(dst, Path.GetFileName(selfExe));
    bool skipSelf = string.Equals(
        Path.GetFullPath(selfExe), Path.GetFullPath(selfDestPath), StringComparison.OrdinalIgnoreCase);

    var allFiles = Directory.GetFiles(src, "*", SearchOption.AllDirectories);
    int total = allFiles.Length;
    int done = 0;

    Directory.CreateDirectory(dst);

    foreach (var file in allFiles)
    {
        if (skipSelf && string.Equals(file, selfExe, StringComparison.OrdinalIgnoreCase)) continue;
        var rel = Path.GetRelativePath(src, file);
        var dest = Path.Combine(dst, rel);
        Directory.CreateDirectory(Path.GetDirectoryName(dest)!);
        File.Copy(file, dest, overwrite: true);
        done++;
        if (done % 50 == 0 || done == total)
        {
            int pct = total == 0 ? 100 : (int)((double)done / total * 100);
            Console.Write($"\r  Copying files  [{done}/{total}]  {pct}%    ");
        }
    }
    Console.WriteLine("\r  Files copied                              ");
}

static void CreateShortcut(string target, string arguments, string link, string desc, string workDir, string icon)
{
    string tmp = Path.Combine(Path.GetTempPath(), Path.GetRandomFileName() + ".ps1");
    var lines = new[]
    {
        "$s = New-Object -ComObject WScript.Shell",
        $"$lnk = $s.CreateShortcut('{Esc(link)}')",
        $"$lnk.TargetPath = '{Esc(target)}'",
        $"$lnk.Arguments = '{Esc(arguments)}'",
        $"$lnk.WorkingDirectory = '{Esc(workDir)}'",
        $"$lnk.Description = '{Esc(desc)}'",
        $"$lnk.IconLocation = '{Esc(icon)},0'",
        "$lnk.WindowStyle = 7",
        "$lnk.Save()"
    };
    File.WriteAllLines(tmp, lines, System.Text.Encoding.UTF8);
    try
    {
        Process.Start(new ProcessStartInfo("powershell",
            $"-NonInteractive -NoProfile -ExecutionPolicy Bypass -File \"{tmp}\"")
        { UseShellExecute = false, CreateNoWindow = true })?.WaitForExit();
    }
    finally { try { File.Delete(tmp); } catch { } }
}

static string Esc(string s) => s.Replace("'", "''");
static string GenerateSecret() => Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
static void WriteError(string msg) { WriteColor(ConsoleColor.Red, $"\n  ERROR: {msg}\n"); }
static void Pause() { Console.Write("\n  Press Enter to exit..."); Console.ReadLine(); }

static void WriteColor(ConsoleColor color, string msg)
{
    Console.ForegroundColor = color;
    Console.WriteLine(msg);
    Console.ResetColor();
}

// ─── App constants (type declaration must follow top-level statements) ────────

static class K
{
    public const string AppName = "Scripto";
    public const string AppVersion = "1.0.17";
    public const string Publisher = "Elevated Dynamics";
    public const string RegPath = @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Scripto";
}
