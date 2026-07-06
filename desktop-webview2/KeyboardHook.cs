using System.Runtime.InteropServices;

namespace Scripto.Desktop;

internal enum KeyEventType
{
    KeyDown,
    KeyUp,
}

internal sealed class HookKeyEventArgs : EventArgs
{
    public HookKeyEventArgs(int virtualKeyCode, KeyEventType eventType)
    {
        VirtualKeyCode = virtualKeyCode;
        EventType = eventType;
    }

    public int VirtualKeyCode { get; }

    public KeyEventType EventType { get; }

    public bool Handled { get; set; }
}

internal sealed partial class KeyboardHook : IDisposable
{
    private const int WhKeyboardLl = 13;
    private const int WmKeyDown = 0x0100;
    private const int WmSysKeyDown = 0x0104;
    private const int WmKeyUp = 0x0101;
    private const int WmSysKeyUp = 0x0105;

    private LowLevelKeyboardProc? hookCallback;
    private IntPtr hookHandle = IntPtr.Zero;

    public event EventHandler<HookKeyEventArgs>? KeyChanged;

    public void Start()
    {
        if (hookHandle != IntPtr.Zero)
        {
            return;
        }

        hookCallback = HookProcedure;
        hookHandle = SetWindowsHookEx(WhKeyboardLl, hookCallback, NativeMethods.GetModuleHandle(null), 0);
        if (hookHandle == IntPtr.Zero)
        {
            throw new InvalidOperationException("Failed to install keyboard hook.");
        }
    }

    public void Dispose()
    {
        if (hookHandle != IntPtr.Zero)
        {
            UnhookWindowsHookEx(hookHandle);
            hookHandle = IntPtr.Zero;
        }
    }

    private IntPtr HookProcedure(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0)
        {
            var data = Marshal.PtrToStructure<KbdLlHookStruct>(lParam);
            var handled = false;

            if (wParam == (IntPtr)WmKeyDown || wParam == (IntPtr)WmSysKeyDown)
            {
                var args = new HookKeyEventArgs((int)data.VkCode, KeyEventType.KeyDown);
                KeyChanged?.Invoke(this, args);
                handled = args.Handled;
            }
            else if (wParam == (IntPtr)WmKeyUp || wParam == (IntPtr)WmSysKeyUp)
            {
                var args = new HookKeyEventArgs((int)data.VkCode, KeyEventType.KeyUp);
                KeyChanged?.Invoke(this, args);
                handled = args.Handled;
            }

            if (handled)
            {
                return (IntPtr)1;
            }
        }

        return CallNextHookEx(hookHandle, nCode, wParam, lParam);
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct KbdLlHookStruct
    {
        public uint VkCode;
        public uint ScanCode;
        public uint Flags;
        public uint Time;
        public nint DwExtraInfo;
    }

    private delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool UnhookWindowsHookEx(IntPtr hhk);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);
}
