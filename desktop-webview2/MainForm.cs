using System.Diagnostics;
using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace Scripto.Desktop;

internal sealed class MainForm : Form
{
    private const int VKeyControl = 0x11;
    private const int VKeyV = 0x56;
    private const int VKeyLeftCtrl = 0xA2;
    private const int VKeyRightCtrl = 0xA3;
    private const int VKeyLeftAlt = 0xA4;
    private const int VKeyRightAlt = 0xA5;
    private const int VKeyLeftWin = 0x5B;
    private const int VKeyRightWin = 0x5C;
    // The Fn key is handled at the keyboard firmware level on most laptops and
    // never reaches Windows as a normal key event at all - support for this is
    // hardware/driver-dependent. 0xFF (VK_FUNCTION) is what the few keyboards
    // that DO expose it send; Ctrl+Alt remains a guaranteed-working fallback.
    private const int VKeyFunction = 0xFF;
    private const int VKeySpace = 0x20;

    private readonly WebView2 webView = new();
    private readonly KeyboardHook keyboardHook = new();
    private readonly NotifyIcon trayIcon = new();
    private readonly ListeningPopupForm listeningPopup = new();
    private readonly Icon? brandIcon = LoadBrandIcon();
    private readonly string webUrl = Environment.GetEnvironmentVariable("SPEECHFLOW_WEB_URL") ?? "http://127.0.0.1:4444";
    private readonly string apiHealthUrl = Environment.GetEnvironmentVariable("SPEECHFLOW_API_URL") ?? "http://127.0.0.1:4445/health";
    private readonly string webviewDataFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Scripto", "WebView2");
    private readonly string logPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Scripto", "logs", "desktop.log");

    private readonly System.Windows.Forms.Timer monitorTimer = new() { Interval = 150 };
    private IntPtr lastLoggedForeground = IntPtr.Zero;
    private bool lastLoggedIconic;

    private IntPtr previousForegroundWindow = IntPtr.Zero;
    private string returnUrl = string.Empty;
    private bool ctrlDown;
    private bool altDown;
    private bool winDown;
    private bool fnDown;
    private bool chordActive;
    private bool chordTriggered;
    private bool dictationPendingStart;
    private bool lockedListening;
    private bool swallowNextRelease;
    private DateTime chordStartedAt;
    private DateTime lastTriggerAt;

    public MainForm()
    {
        Text = "Scripto";
        Width = 1180;
        Height = 920;
        MinimumSize = new Size(900, 700);
        StartPosition = FormStartPosition.CenterScreen;
        ShowInTaskbar = false;
        WindowState = FormWindowState.Minimized;
        Opacity = 0;
        TopMost = false;
        FormBorderStyle = FormBorderStyle.Sizable;

        Controls.Add(webView);
        webView.Dock = DockStyle.Fill;

        Icon = brandIcon ?? SystemIcons.Application;
        trayIcon.Icon = brandIcon ?? SystemIcons.Application;
        trayIcon.Text = "Scripto";
        trayIcon.Visible = true;
        trayIcon.ContextMenuStrip = BuildTrayMenu();
        trayIcon.DoubleClick += (_, _) => OpenManagementInBrowser();

        keyboardHook.KeyChanged += HandleKeyChanged;
        monitorTimer.Tick += (_, _) => PollWindowState();

        Load += async (_, _) => await InitializeAsync();
        FormClosed += (_, _) => Cleanup();
    }

    private void PollWindowState()
    {
        var fg = NativeMethods.GetForegroundWindow();
        var iconic = NativeMethods.IsIconic(previousForegroundWindow);
        if (fg != lastLoggedForeground || iconic != lastLoggedIconic)
        {
            Log($"[monitor] foreground=0x{fg:X}, targetWindow=0x{previousForegroundWindow:X}, targetIconic={iconic}");
            lastLoggedForeground = fg;
            lastLoggedIconic = iconic;
        }
    }

    private ContextMenuStrip BuildTrayMenu()
    {
        var menu = new ContextMenuStrip();
        menu.Items.Add("Open management", null, (_, _) => OpenManagementInBrowser());
        menu.Items.Add("Open dictation", null, (_, _) => RequestTriggerDictation());
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Quit", null, (_, _) => Close());
        return menu;
    }

    private async Task InitializeAsync()
    {
        try
        {
            Directory.CreateDirectory(webviewDataFolder);
            await WaitForServiceAsync(webUrl);
            await WaitForServiceAsync(apiHealthUrl);

            var environment = await CoreWebView2Environment.CreateAsync(null, webviewDataFolder);
            await webView.EnsureCoreWebView2Async(environment);
            webView.CoreWebView2.WebMessageReceived += HandleWebMessageReceived;
            webView.CoreWebView2.NavigationCompleted += HandleNavigationCompleted;
            webView.CoreWebView2.PermissionRequested += HandlePermissionRequested;
            webView.CoreWebView2.ProcessFailed += HandleProcessFailed;
            webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            webView.CoreWebView2.Settings.AreDevToolsEnabled = false;

            // Explicitly (re)grant microphone access for our own origin. This is
            // required in addition to the PermissionRequested handler above because
            // WebView2 persists permission decisions per-profile: an early denial
            // (e.g. before this handler existed, or from a hidden/unclickable prompt)
            // gets cached and PermissionRequested never fires again for it.
            try
            {
                await webView.CoreWebView2.Profile.SetPermissionStateAsync(
                    CoreWebView2PermissionKind.Microphone, webUrl, CoreWebView2PermissionState.Allow);
                Log($"Set microphone permission state to Allow for {webUrl}");
            }
            catch (Exception permEx)
            {
                Log($"SetPermissionStateAsync failed: {permEx}");
            }

            webView.CoreWebView2.Navigate(webUrl);

            keyboardHook.Start();
            Hide();
        }
        catch (Exception ex)
        {
            trayIcon.BalloonTipTitle = "Scripto desktop failed";
            trayIcon.BalloonTipText = ex.Message;
            trayIcon.ShowBalloonTip(5000);
            MessageBox.Show(this, ex.ToString(), "Scripto desktop failed", MessageBoxButtons.OK, MessageBoxIcon.Error);
            Close();
        }
    }

    private void HandleKeyChanged(object? sender, HookKeyEventArgs e)
    {
        var now = DateTime.UtcNow;

        if (e.EventType == KeyEventType.KeyDown)
        {
            if (e.VirtualKeyCode is VKeyLeftCtrl or VKeyRightCtrl)
            {
                ctrlDown = true;
            }
            else if (e.VirtualKeyCode is VKeyLeftAlt or VKeyRightAlt)
            {
                altDown = true;
                e.Handled = true;
            }
            else if (e.VirtualKeyCode is VKeyLeftWin or VKeyRightWin)
            {
                winDown = true;
                e.Handled = true;
            }
            else if (e.VirtualKeyCode is VKeyFunction)
            {
                fnDown = true;
                e.Handled = true;
                Log("Fn key down detected (this keyboard exposes it as a normal key event)");
            }
            else if (e.VirtualKeyCode == VKeySpace && chordActive && chordTriggered && !lockedListening)
            {
                // Spacebar tapped while the record chord is still held down - lock
                // hands-free listening so the user can let go of the keyboard.
                // Swallow the keystroke so it doesn't get typed into whatever window
                // is behind our (hidden) form.
                Log("Spacebar pressed while chord held - locking hands-free listening");
                lockedListening = true;
                e.Handled = true;
                listeningPopup.ShowLocked();
                return;
            }

            if (ctrlDown && (winDown || altDown || fnDown))
            {
                if (!chordActive)
                {
                    chordActive = true;
                    chordStartedAt = now;

                    if (lockedListening)
                    {
                        // This press stops and unlocks the hands-free session that a
                        // prior spacebar-lock started. Submit + paste like a normal finish.
                        Log("Chord pressed while locked - stopping and unlocking");
                        lockedListening = false;
                        swallowNextRelease = true;
                        RequestStopDictation();
                    }
                    else
                    {
                        chordTriggered = false;
                        RequestTriggerDictation();
                    }
                }
            }

            return;
        }

        if (e.VirtualKeyCode is VKeyLeftCtrl or VKeyRightCtrl)
        {
            ctrlDown = false;
        }
        else if (e.VirtualKeyCode is VKeyLeftAlt or VKeyRightAlt)
        {
            altDown = false;
            e.Handled = true;
        }
        else if (e.VirtualKeyCode is VKeyLeftWin or VKeyRightWin)
        {
            winDown = false;
            e.Handled = true;
        }
        else if (e.VirtualKeyCode is VKeyFunction)
        {
            fnDown = false;
            e.Handled = true;
        }

        if (chordActive && !ctrlDown && !winDown && !altDown && !fnDown)
        {
            Log($"Chord released after {(now - chordStartedAt).TotalMilliseconds:F0}ms, chordTriggered={chordTriggered}, lockedListening={lockedListening}");
            chordActive = false;
            chordStartedAt = default;

            if (swallowNextRelease)
            {
                // This is the release half of the press that stopped a locked session -
                // RequestStopDictation() already ran on key-down, so there's nothing
                // left to do here.
                swallowNextRelease = false;
                chordTriggered = false;
                return;
            }

            if (lockedListening)
            {
                // Keys released but the session stays locked open - keep listening
                // hands-free until the chord is pressed again.
                return;
            }

            RequestStopDictation();
            chordTriggered = false;
        }
    }

    private void TriggerDictation()
    {
        var now = DateTime.UtcNow;
        if ((now - lastTriggerAt).TotalMilliseconds < 250)
        {
            Log("TriggerDictation debounced (re-triggered within 250ms)");
            return;
        }

        if (webView.CoreWebView2 is null)
        {
            Log("TriggerDictation: CoreWebView2 is null, refusing to start (browser process likely crashed)");
            trayIcon.BalloonTipTitle = "Scripto dictation unavailable";
            trayIcon.BalloonTipText = "The browser component isn't ready. Right-click the tray icon and choose Quit, then reopen Scripto.";
            trayIcon.ShowBalloonTip(5000);
            return;
        }

        lastTriggerAt = now;
        chordTriggered = true;
        dictationPendingStart = true;
        previousForegroundWindow = NativeMethods.GetForegroundWindow();
        returnUrl = webView.Source?.ToString() ?? webUrl;

        Log($"Chord triggered - navigating to /dictation, previousForegroundWindow=0x{previousForegroundWindow:X}, iconic={NativeMethods.IsIconic(previousForegroundWindow)}");
        lastLoggedForeground = previousForegroundWindow;
        lastLoggedIconic = false;
        monitorTimer.Start();
        Hide();
        listeningPopup.ShowListening();
        Log($"After Hide(): foreground=0x{NativeMethods.GetForegroundWindow():X}, targetIconic={NativeMethods.IsIconic(previousForegroundWindow)}");

        if (webView.CoreWebView2 is not null)
        {
            webView.CoreWebView2.Navigate($"{webUrl}/dictation?desktop=1");
        }
        else
        {
            Log("TriggerDictation: CoreWebView2 was null, cannot navigate");
        }
    }

    private void RequestTriggerDictation()
    {
        if (IsDisposed)
        {
            return;
        }

        if (InvokeRequired)
        {
            BeginInvoke(new Action(TriggerDictation));
            return;
        }

        TriggerDictation();
    }

    private void RequestStopDictation()
    {
        if (IsDisposed)
        {
            return;
        }

        if (InvokeRequired)
        {
            BeginInvoke(new Action(StopDictation));
            return;
        }

        StopDictation();
    }

    private void StopDictation()
    {
        // Always hide the popup on release, even if we can't cleanly stop
        // recording (e.g. the WebView2 browser process crashed mid-session) -
        // otherwise it gets stuck visible forever on every subsequent attempt.
        listeningPopup.Hide();
        monitorTimer.Stop();
        dictationPendingStart = false;

        if (!chordTriggered || webView.CoreWebView2 is null)
        {
            Log($"StopDictation: popup hidden, but could not post stopRecording - chordTriggered={chordTriggered}, CoreWebView2 null={webView.CoreWebView2 is null}");
            return;
        }

        Log("StopDictation: hiding popup, posting stopRecording");
        webView.CoreWebView2.PostWebMessageAsJson("""{"type":"stopRecording"}""");
    }

    private void HandlePermissionRequested(object? sender, CoreWebView2PermissionRequestedEventArgs e)
    {
        // The dictation flow hides this window while recording, so the user can
        // never see or click WebView2's default permission prompt. This is a
        // trusted first-party host talking only to our own bundled backend, so
        // grant microphone access automatically instead of relying on that UI.
        if (e.PermissionKind == CoreWebView2PermissionKind.Microphone)
        {
            e.State = CoreWebView2PermissionState.Allow;
            e.Handled = true;
        }
    }

    private void HandleProcessFailed(object? sender, CoreWebView2ProcessFailedEventArgs e)
    {
        Log($"CoreWebView2 process failed: kind={e.ProcessFailedKind}, reason={e.Reason}, exitCode={e.ExitCode}, description={e.ProcessDescription}");

        // Whatever was in-flight can never complete now - clear state and make
        // sure the listening popup isn't left stuck on screen.
        listeningPopup.Hide();
        monitorTimer.Stop();
        dictationPendingStart = false;
        chordTriggered = false;
        chordActive = false;

        if (e.ProcessFailedKind == CoreWebView2ProcessFailedKind.BrowserProcessExited)
        {
            // The whole browser process is gone; CoreWebView2 itself is now
            // unusable. We can't safely recreate it from inside this handler,
            // so surface it clearly rather than leaving dictation silently dead.
            trayIcon.BalloonTipTitle = "Scripto needs to restart";
            trayIcon.BalloonTipText = "The browser component crashed. Right-click the tray icon and choose Quit, then reopen Scripto.";
            trayIcon.ShowBalloonTip(8000);
            return;
        }

        // Render/frame-level failure - the CoreWebView2 object itself usually
        // survives this, so a reload can often recover without a full restart.
        try
        {
            webView.CoreWebView2?.Reload();
            Log("Reloaded WebView2 after process failure");
        }
        catch (Exception reloadEx)
        {
            Log($"Reload after process failure also failed: {reloadEx}");
            trayIcon.BalloonTipTitle = "Scripto needs to restart";
            trayIcon.BalloonTipText = "The browser component crashed and could not recover. Right-click the tray icon and choose Quit, then reopen Scripto.";
            trayIcon.ShowBalloonTip(8000);
        }
    }

    private void HandleNavigationCompleted(object? sender, CoreWebView2NavigationCompletedEventArgs e)
    {
        if (!dictationPendingStart)
        {
            return;
        }

        if (webView.Source is null || !webView.Source.AbsolutePath.EndsWith("/dictation", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        Log($"Navigation to /dictation completed: IsSuccess={e.IsSuccess}, WebErrorStatus={e.WebErrorStatus}");
    }

    private async void HandleWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        try
        {
            using var document = JsonDocument.Parse(e.WebMessageAsJson);
            if (!document.RootElement.TryGetProperty("type", out var type))
            {
                return;
            }

        if (type.GetString() == "dictationReady")
        {
            Log($"Received dictationReady, dictationPendingStart={dictationPendingStart}");
            if (dictationPendingStart && webView.CoreWebView2 is not null)
            {
                Log("Posting startRecording");
                webView.CoreWebView2.PostWebMessageAsJson("""{"type":"startRecording"}""");
            }
            return;
        }

        if (type.GetString() == "dictationError")
        {
            var message = document.RootElement.TryGetProperty("message", out var errorPayload) ? errorPayload.GetString() : null;
            Log($"Received dictationError: {message}");
            HandleDictationError(message);
            return;
        }

        if (type.GetString() != "completeDictation")
        {
            return;
        }

            var text = document.RootElement.TryGetProperty("text", out var textPayload) ? textPayload.GetString() : null;
            Log($"Received completeDictation, text length={text?.Length ?? 0}");
            await CompleteDictationAsync(text ?? string.Empty);
        }
        catch (Exception ex)
        {
            Log($"HandleWebMessageReceived exception: {ex}");
        }
    }

    private async Task CompleteDictationAsync(string text)
    {
        listeningPopup.Hide();
        Hide();
        Opacity = 0;
        TopMost = false;
        dictationPendingStart = false;
        chordTriggered = false;
        chordActive = false;

        if (string.IsNullOrWhiteSpace(text))
        {
            monitorTimer.Stop();
            return;
        }

        Clipboard.SetText(text);

        Log($"Restoring foreground window 0x{previousForegroundWindow:X} (currently 0x{NativeMethods.GetForegroundWindow():X}, iconic={NativeMethods.IsIconic(previousForegroundWindow)})");
        if (previousForegroundWindow != IntPtr.Zero)
        {
            NativeMethods.RestoreForegroundWindow(previousForegroundWindow);
        }

        var reachedForeground = await WaitForForegroundAsync(previousForegroundWindow, 1500);
        Log($"After restore: foreground=0x{NativeMethods.GetForegroundWindow():X}, reachedTarget={reachedForeground}, targetIconic={NativeMethods.IsIconic(previousForegroundWindow)}");
        await Task.Delay(100);
        NativeMethods.SendCtrlV();
        Log("Sent Ctrl+V");

        if (webView.CoreWebView2 is not null && !string.IsNullOrWhiteSpace(returnUrl))
        {
            webView.CoreWebView2.Navigate(returnUrl);
        }

        monitorTimer.Stop();
    }

    private void HandleDictationError(string? message)
    {
        Log($"HandleDictationError: {message}");
        monitorTimer.Stop();
        listeningPopup.Hide();
        dictationPendingStart = false;
        chordTriggered = false;
        chordActive = false;

        if (!string.IsNullOrWhiteSpace(message))
        {
            trayIcon.BalloonTipTitle = "Scripto dictation failed";
            trayIcon.BalloonTipText = message;
            trayIcon.ShowBalloonTip(5000);
        }
    }

    private async Task<bool> WaitForForegroundAsync(IntPtr targetWindow, int timeoutMs)
    {
        if (targetWindow == IntPtr.Zero)
        {
            return false;
        }

        var startedAt = DateTime.UtcNow;
        while ((DateTime.UtcNow - startedAt).TotalMilliseconds < timeoutMs)
        {
            if (NativeMethods.GetForegroundWindow() == targetWindow)
            {
                return true;
            }

            await Task.Delay(25);
        }

        return false;
    }

    private void OpenManagementInBrowser()
    {
        Show();
        WindowState = FormWindowState.Normal;
        Opacity = 1;
        ShowInTaskbar = true;
        TopMost = false;
        BringToFront();
        Activate();
        if (webView.CoreWebView2 is not null && !string.IsNullOrWhiteSpace(webUrl))
        {
            webView.CoreWebView2.Navigate(webUrl);
        }
    }

    private async Task WaitForServiceAsync(string url, int timeoutMs = 60000)
    {
        using var client = new HttpClient();
        var startedAt = DateTime.UtcNow;
        while ((DateTime.UtcNow - startedAt).TotalMilliseconds < timeoutMs)
        {
            try
            {
                using var response = await client.GetAsync(url);
                if (response.IsSuccessStatusCode)
                {
                    return;
                }
            }
            catch
            {
            }

            await Task.Delay(500);
        }
    }

    private void Cleanup()
    {
        monitorTimer.Dispose();
        keyboardHook.Dispose();
        listeningPopup.Dispose();
        trayIcon.Visible = false;
        trayIcon.Dispose();
        brandIcon?.Dispose();
    }

    private void Log(string message)
    {
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(logPath)!);
            File.AppendAllText(logPath, $"{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}  {message}{Environment.NewLine}");
        }
        catch
        {
        }
    }

    private static Icon? LoadBrandIcon()
    {
        var iconPath = Path.Combine(AppContext.BaseDirectory, "Scripto.ico");
        if (!File.Exists(iconPath))
        {
            return null;
        }

        using var stream = File.OpenRead(iconPath);
        return new Icon(stream);
    }
}
