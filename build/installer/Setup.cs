// 星叙安装程序：选择位置 → 解压内置程序包 → 快捷方式与卸载信息
using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

namespace XingXu
{
    class SetupForm : StarForm
    {
        enum Stage { Ready, Busy, Done, Failed }
        Stage stage = Stage.Ready;
        readonly TextBox path = new TextBox();
        Hit chk, install, cancel, browse, launch, finish;
        bool desktop = true;
        double progress; string status = "", error = "";
        long need;

        public SetupForm() : base(440, 396)
        {
            Text = "安装 " + App.Name;
            need = PayloadSize();

            path.BorderStyle = BorderStyle.None;
            path.Font = F(10f);
            path.BackColor = Color.White; path.ForeColor = C.Ink;
            path.TextAlign = HorizontalAlignment.Center;
            path.Text = DefaultDir();
            // 支持 /D=路径 预填安装位置（与常见安装器一致）
            foreach (var a in Environment.GetCommandLineArgs()) if (a.StartsWith("/D=", StringComparison.OrdinalIgnoreCase)) path.Text = a.Substring(3);
            Controls.Add(path);
            path.TabStop = false;
            path.GotFocus += (s, e) => Invalidate(); path.LostFocus += (s, e) => Invalidate();
            LayoutPath();

            Add("close", "", R(398, 12, 30, 30), () => { if (stage != Stage.Busy) Close(); });
            browse = Add("btn", "浏览...", R(338, 180, 74, 38), Browse);
            chk = Add("chk", "1创建桌面快捷方式", ChkRect("创建桌面快捷方式", 250), () => { desktop = !desktop; chk.Text = (desktop ? "1" : "0") + chk.Text.Substring(1); Invalidate(); });
            install = Add("pri", "安装", R(119, 292, 108, 40), Start);
            cancel = Add("btn", "取消", R(237, 292, 84, 40), Close);
            launch = Add("pri", "立即体验", R(113, 292, 120, 40), () => { Launch(); Close(); });
            finish = Add("btn", "完成", R(243, 292, 84, 40), Close);
            launch.Visible = finish.Visible = false;
            Add("link", App.Site + " ↗", R(0, 0, 0, 0), () => { try { Process.Start(App.Url); } catch { } });
            AcceptButton = null;
        }

        void LayoutPath()
        {
            var r = R(28, 180, 300, 38);
            int th = path.PreferredHeight;
            path.SetBounds((int)r.X + P(12), (int)(r.Y + (r.Height - th) / 2) + 1, (int)r.Width - P(24), th);
        }

        static string DefaultDir()
        {
            try
            {
                var d = new DriveInfo("D");
                if (d.IsReady && d.DriveType == DriveType.Fixed && d.AvailableFreeSpace > 1L << 30) return @"D:\Apps\" + App.Name;
            }
            catch { }
            return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", App.Name);
        }

        static long PayloadSize()
        {
            long n = 0;
            using (var s = typeof(SetupForm).Assembly.GetManifestResourceStream("payload.zip"))
            using (var z = new ZipArchive(s, ZipArchiveMode.Read)) foreach (var e in z.Entries) n += e.Length;
            return n;
        }

        void Browse()
        {
            using (var d = new FolderBrowserDialog { Description = "选择安装位置（将在其中创建「" + App.Name + "」文件夹）", ShowNewFolderButton = true })
            {
                try { var cur = path.Text.Trim(); d.SelectedPath = Directory.Exists(cur) ? cur : Path.GetDirectoryName(cur); } catch { }
                if (d.ShowDialog(this) != DialogResult.OK) return;
                var p = d.SelectedPath;
                if (!p.TrimEnd('\\').EndsWith(App.Name)) p = Path.Combine(p, App.Name);
                path.Text = p;
            }
        }

        string Dir { get { return path.Text.Trim().TrimEnd('\\'); } }

        void Start()
        {
            string dir = Dir;
            try
            {
                if (dir.Length < 4 || !Path.IsPathRooted(dir)) throw new Exception("请填写完整的安装路径");
                dir = Path.GetFullPath(dir);
                var root = new DriveInfo(Path.GetPathRoot(dir));
                if (root.AvailableFreeSpace < need + (50L << 20)) throw new Exception("磁盘空间不足，需要约 " + Mb(need));
            }
            catch (Exception ex) { error = ex.Message; Invalidate(); return; }
            error = "";
            stage = Stage.Busy; path.ReadOnly = true;
            install.Visible = cancel.Visible = browse.Enabled = chk.Enabled = false;
            status = "正在准备…"; Invalidate();
            var t = new Thread(() => Work(dir)) { IsBackground = true };
            t.Start();
        }

        void Ui(Action a) { if (IsHandleCreated) BeginInvoke(a); }

        void Work(string dir)
        {
            try
            {
                App.KillRunning();
                try { App.KillBundledTTB(dir); } catch { }
                Directory.CreateDirectory(dir);
                long done = 0;
                var files = new System.Collections.Generic.List<string>();
                using (var s = typeof(SetupForm).Assembly.GetManifestResourceStream("payload.zip"))
                using (var z = new ZipArchive(s, ZipArchiveMode.Read))
                {
                    var buf = new byte[1 << 16];
                    foreach (var e in z.Entries)
                    {
                        string dst = Path.GetFullPath(Path.Combine(dir, e.FullName));
                        if (!dst.StartsWith(dir + "\\", StringComparison.OrdinalIgnoreCase)) continue;
                        if (e.FullName.EndsWith("/")) { Directory.CreateDirectory(dst); continue; }
                        Directory.CreateDirectory(Path.GetDirectoryName(dst));
                        files.Add(e.FullName.Replace('/', Path.DirectorySeparatorChar));
                        using (var i = e.Open()) using (var o = File.Create(dst))
                        {
                            int n;
                            while ((n = i.Read(buf, 0, buf.Length)) > 0)
                            {
                                o.Write(buf, 0, n); done += n;
                                double v = need > 0 ? (double)done / need * .94 : 0;
                                if (v - progress > .004) { progress = v; Ui(() => { status = "正在安装… " + (int)(progress * 100) + "%"; Invalidate(); }); }
                            }
                        }
                    }
                }
                Ui(() => { status = "正在创建快捷方式…"; Invalidate(); });
                // 卸载程序随安装包内置
                using (var s = typeof(SetupForm).Assembly.GetManifestResourceStream("Uninstall.exe"))
                using (var o = File.Create(Path.Combine(dir, "Uninstall.exe"))) s.CopyTo(o);
                // 卸载时只删除这里列出的文件，避免误删安装目录里的其他内容
                File.WriteAllLines(Path.Combine(dir, "uninstall.lst"), files, System.Text.Encoding.UTF8);
                string exe = Path.Combine(dir, App.Exe);
                App.Shortcut(App.StartMenuLnk, exe, App.Name + " · Windows 桌面美化");
                if (desktop) App.Shortcut(App.DesktopLnk, exe, App.Name + " · Windows 桌面美化");
                else if (File.Exists(App.DesktopLnk)) File.Delete(App.DesktopLnk);
                using (var k = Registry.CurrentUser.CreateSubKey(App.UninstKey))
                {
                    k.SetValue("DisplayName", App.Name);
                    k.SetValue("DisplayVersion", App.Version);
                    k.SetValue("Publisher", App.Author);
                    k.SetValue("DisplayIcon", exe + ",0");
                    k.SetValue("InstallLocation", dir);
                    k.SetValue("UninstallString", "\"" + Path.Combine(dir, "Uninstall.exe") + "\"");
                    k.SetValue("URLInfoAbout", App.Url);
                    k.SetValue("HelpLink", App.Url);
                    k.SetValue("EstimatedSize", (int)(need / 1024), RegistryValueKind.DWord);
                    k.SetValue("InstallDate", DateTime.Now.ToString("yyyyMMdd"));
                    k.SetValue("NoModify", 1, RegistryValueKind.DWord);
                    k.SetValue("NoRepair", 1, RegistryValueKind.DWord);
                }
                Ui(() =>
                {
                    progress = 1; stage = Stage.Done; status = "安装完成";
                    launch.Visible = finish.Visible = true; Invalidate();
                });
            }
            catch (Exception ex)
            {
                Ui(() =>
                {
                    stage = Stage.Failed; error = "安装失败：" + ex.Message; status = "";
                    path.ReadOnly = false; install.Visible = cancel.Visible = true; install.Text = "重试";
                    browse.Enabled = chk.Enabled = true; Invalidate();
                });
            }
        }

        void Launch()
        {
            try { Process.Start(new ProcessStartInfo(Path.Combine(Dir, App.Exe)) { WorkingDirectory = Dir, UseShellExecute = true }); } catch { }
        }

        static string Mb(long b) { return Math.Ceiling(b / 1048576.0) + " MB"; }
        protected override void Draw(Graphics g)
        {
            Header(g);
            using (var f = F(9.5f, FontStyle.Bold)) TxtC(g, "安装位置", f, C.Ink, P(154));
            var box = R(28, 180, 300, 38);
            Fill(g, box, P(10), Color.White);
            Stroke(g, box, P(10), path.Focused ? Color.FromArgb(120, 22, 24, 27) : Color.FromArgb(30, 0, 0, 0));

            // 输入框下方一行：所需空间 / 完成提示 / 错误
            string note = "需要约 " + Mb(need) + " 可用空间"; Color nc = C.Muted;
            if (stage == Stage.Done) { note = "✓ 已安装到 " + Dir; nc = C.PillInk; }
            if (error != "") { note = error; nc = C.Red; }
            using (var f = F(9f)) TextRenderer.DrawText(g, note, f, Rectangle.Round(R(28, 224, 384, 20)), nc,
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.PathEllipsis | TextFormatFlags.NoPrefix);

            if (stage == Stage.Busy)
            {
                using (var f = F(9.5f)) TxtC(g, status, f, C.Ink2, P(292));
                ProgressBar(g, R(70, 322, 300, 6), progress);
            }
            Footer(g, 352);
        }
    }

    static class Program
    {
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new SetupForm());
        }
    }
}
