using System.Runtime.InteropServices;

namespace Scripto.Desktop;

internal static partial class NativeMethods
{
    private const int SwRestore = 9;
    private const int InputKeyboard = 1;
    private const uint KeyeventfKeyup = 0x0002;
    private const uint KeyeventfUnicode = 0x0004;

    [DllImport("user32.dll")]
    internal static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    internal static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    internal static extern bool BringWindowToTop(IntPtr hWnd);

    [DllImport("user32.dll")]
    internal static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    internal static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll")]
    internal static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("kernel32.dll")]
    internal static extern uint GetCurrentThreadId();

    [DllImport("user32.dll")]
    internal static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);

    [DllImport("user32.dll", SetLastError = true)]
    internal static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    [DllImport("kernel32.dll")]
    internal static extern IntPtr GetModuleHandle(string? lpModuleName);

    internal static void RestoreForegroundWindow(IntPtr hWnd)
    {
        if (hWnd == IntPtr.Zero)
        {
            return;
        }

        var foregroundThread = GetWindowThreadProcessId(GetForegroundWindow(), out _);
        var currentThread = GetCurrentThreadId();
        var shouldDetach = foregroundThread != currentThread;
        if (shouldDetach)
        {
            AttachThreadInput(foregroundThread, currentThread, true);
        }

        // SW_RESTORE unconditionally forces a window to its small "normal" size,
        // even if it was maximized (not minimized) to begin with - only call it
        // when the window is actually minimized, otherwise a maximized window
        // gets visually shrunk as an unwanted side effect of this "restore".
        if (IsIconic(hWnd))
        {
            ShowWindow(hWnd, SwRestore);
        }

        SetForegroundWindow(hWnd);
        BringWindowToTop(hWnd);

        if (shouldDetach)
        {
            AttachThreadInput(foregroundThread, currentThread, false);
        }
    }

    internal static void SendCtrlV()
    {
        var inputs = new[]
        {
            InputForKey(VirtualKeyControl, 0),
            InputForKey(VirtualKeyV, 0),
            InputForKey(VirtualKeyV, KeyeventfKeyup),
            InputForKey(VirtualKeyControl, KeyeventfKeyup),
        };

        SendInput((uint)inputs.Length, inputs, Marshal.SizeOf<INPUT>());
    }

    internal static void SendText(string text)
    {
        if (string.IsNullOrEmpty(text))
        {
            return;
        }

        var inputs = new List<INPUT>(text.Length * 2);
        foreach (var ch in text)
        {
            inputs.Add(InputForUnicodeChar(ch, 0));
            inputs.Add(InputForUnicodeChar(ch, KeyeventfKeyup));
        }

        SendInput((uint)inputs.Count, inputs.ToArray(), Marshal.SizeOf<INPUT>());
    }

    private static INPUT InputForKey(ushort virtualKey, uint flags)
    {
        return new INPUT
        {
            Type = InputKeyboard,
            Anonymous = new InputUnion
            {
                Ki = new KEYBDINPUT
                {
                    WVk = virtualKey,
                    WScan = 0,
                    DwFlags = flags,
                    Time = 0,
                    DwExtraInfo = IntPtr.Zero,
                },
            },
        };
    }

    private static INPUT InputForUnicodeChar(char character, uint flags)
    {
        return new INPUT
        {
            Type = InputKeyboard,
            Anonymous = new InputUnion
            {
                Ki = new KEYBDINPUT
                {
                    WVk = 0,
                    WScan = character,
                    DwFlags = flags | KeyeventfUnicode,
                    Time = 0,
                    DwExtraInfo = IntPtr.Zero,
                },
            },
        };
    }

    private const ushort VirtualKeyControl = 0x11;
    private const ushort VirtualKeyV = 0x56;

    [StructLayout(LayoutKind.Sequential)]
    internal struct INPUT
    {
        public int Type;
        public InputUnion Anonymous;
    }

    // The union must include MOUSEINPUT (the largest member of the real Win32
    // union) even though we never use it - SendInput compares the cbSize we pass
    // against its own internal sizeof(INPUT) (40 bytes on x64) and silently
    // rejects the entire call with ERROR_INVALID_PARAMETER if it doesn't match.
    // Omitting MOUSEINPUT here made Marshal.SizeOf<INPUT>() too small, so every
    // keyboard SendInput call (SendCtrlV, SendText) was failing with 0 events sent.
    [StructLayout(LayoutKind.Explicit)]
    internal struct InputUnion
    {
        [FieldOffset(0)]
        public MOUSEINPUT Mi;

        [FieldOffset(0)]
        public KEYBDINPUT Ki;
    }

    [StructLayout(LayoutKind.Sequential)]
    internal struct MOUSEINPUT
    {
        public int Dx;
        public int Dy;
        public uint MouseData;
        public uint DwFlags;
        public uint Time;
        public IntPtr DwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    internal struct KEYBDINPUT
    {
        public ushort WVk;
        public ushort WScan;
        public uint DwFlags;
        public uint Time;
        public IntPtr DwExtraInfo;
    }
}
