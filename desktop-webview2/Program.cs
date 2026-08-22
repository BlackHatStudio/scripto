using System.Windows.Forms;

namespace Scripto.Desktop;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        var crashLogPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Scripto", "logs", "desktop-crash.log");

        AppDomain.CurrentDomain.UnhandledException += (_, e) => LogCrash(crashLogPath, "AppDomain.UnhandledException", e.ExceptionObject as Exception);
        Application.ThreadException += (_, e) => LogCrash(crashLogPath, "Application.ThreadException", e.Exception);

        ApplicationConfiguration.Initialize();
        Application.Run(new MainForm());
    }

    private static void LogCrash(string path, string source, Exception? ex)
    {
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            File.AppendAllText(path, $"{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}  [{source}] {ex}{Environment.NewLine}");
        }
        catch
        {
        }
    }
}
