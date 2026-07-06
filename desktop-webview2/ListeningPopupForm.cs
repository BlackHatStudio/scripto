namespace Scripto.Desktop;

internal sealed class ListeningPopupForm : Form
{
    private readonly Label statusLabel = new();
    private readonly Label hintLabel = new();

    protected override bool ShowWithoutActivation => true;

    public ListeningPopupForm()
    {
        FormBorderStyle = FormBorderStyle.None;
        ShowInTaskbar = false;
        StartPosition = FormStartPosition.Manual;
        TopMost = true;
        BackColor = Color.FromArgb(10, 15, 27);
        ForeColor = Color.White;
        Padding = new Padding(18, 14, 18, 14);
        Size = new Size(280, 92);

        var panel = new Panel
        {
            Dock = DockStyle.Fill,
            BackColor = Color.FromArgb(12, 17, 33),
            Padding = new Padding(18, 14, 18, 14),
        };

        statusLabel.AutoSize = true;
        statusLabel.Font = new Font("Segoe UI Semibold", 14f, FontStyle.Bold, GraphicsUnit.Point);
        statusLabel.Text = "Listening...";
        statusLabel.Location = new Point(0, 0);

        hintLabel.AutoSize = true;
        hintLabel.Font = new Font("Segoe UI", 9f, FontStyle.Regular, GraphicsUnit.Point);
        hintLabel.ForeColor = Color.FromArgb(180, 196, 214);
        hintLabel.Text = "Release Ctrl + Fn or Ctrl + Alt to finish";
        hintLabel.Location = new Point(0, 38);

        panel.Controls.Add(statusLabel);
        panel.Controls.Add(hintLabel);
        Controls.Add(panel);
    }

    public void ShowListening()
    {
        statusLabel.Text = "Listening...";
        hintLabel.Text = "Release to finish, or tap Space to go hands-free";
        Reposition();
        Show();
    }

    public void ShowLocked()
    {
        statusLabel.Text = "Listening (hands-free)";
        hintLabel.Text = "Press Ctrl + Fn or Ctrl + Alt to finish";
        Reposition();
        Show();
    }

    private void Reposition()
    {
        var workingArea = Screen.PrimaryScreen?.WorkingArea ?? new Rectangle(0, 0, 1920, 1080);
        Location = new Point(workingArea.Right - Width - 22, workingArea.Bottom - Height - 22);
    }
}
