// 星叙卸载程序：还原任务栏 → 删除自启动、快捷方式、卸载信息与程序文件
using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

namespace XingXu
{
    class UninstallForm : StarForm
    {
        readonly string dir = Path.GetDirectoryName(Application.ExecutablePath);
        Hit chk, go, cancel, finish;
        bool wipe, busy, done, cleanup;
        string status = "", error = "";
        double progress;

        public UninstallForm() : base(440, 384)
        {
            Text = "卸载 " + App.Name;
            Add("close", "", R(398, 12, 30, 30), () => { if (!busy) Close(); });
            chk = Add("chk", "0同时删除个人配置（插件布局、待办、图片与歌词）", ChkRect("同时删除个人配置（插件布局、待办、图片与歌词）", 226), () => { wipe = !wipe; chk.Text = (wipe ? "1" : "0") + chk.Text.Substring(1); Invalidate(); });
            go = Add("pri", "卸载", R(119, 270, 108, 40), Start);
            cancel = Add("btn", "取消", R(237, 270, 84, 40), Close);
            finish = Add("pri", "完成", R(166, 270, 108, 40), Close);
            finish.Visible = false;
            Add("link", App.Site + " ↗", R(0, 0, 0, 0), () => { try { Process.Start(App.Url); } catch { } });
        }

        // 卸载程序自身无法在运行时删除：窗口关闭后由 cmd 稍等片刻再删除，安装目录为空时一并删除
        protected override void OnFormClosed(FormClosedEventArgs e)
        {
            base.OnFormClosed(e);
            if (!cleanup) return;
            try
            {
                Process.Start(new ProcessStartInfo("cmd.exe", "/c ping 127.0.0.1 -n 3 > nul & del /f /q \"" + Application.ExecutablePath + "\" & rmdir \"" + dir + "\"")
                { CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden, UseShellExecute = false, WorkingDirectory = Path.GetTempPath() });
            }
            catch { }
        }

        void Ui(Action a) { if (IsHandleCreated) BeginInvoke(a); }
        void Step(string s, double p) { Ui(() => { status = s; progress = p; Invalidate(); }); }

        void Start()
        {
            busy = true; go.Visible = cancel.Visible = false; chk.Enabled = false; Invalidate();
            new Thread(Work) { IsBackground = true }.Start();
        }

        void Work()
        {
            try
            {
                Step("正在退出星叙…", .1);
                App.KillRunning();
                try { App.KillBundledTTB(dir); } catch { }
                Step("正在还原任务栏颜色…", .3);
                try { App.RestoreTaskbar(); } catch { }
                try { App.RestoreTTB(); } catch { }
                Step("正在删除快捷方式与自启动…", .5);
                App.RemoveAutostart();
                foreach (var l in new[] { App.StartMenuLnk, App.DesktopLnk }) try { if (File.Exists(l)) File.Delete(l); } catch { }
                Registry.CurrentUser.DeleteSubKeyTree(App.UninstKey, false);
                Step("正在删除程序文件…", .7);
                string lst = Path.Combine(dir, "uninstall.lst");
                var dirs = new System.Collections.Generic.HashSet<string>(StringComparer.OrdinalIgnoreCase);
                if (File.Exists(lst))
                    foreach (var rel in File.ReadAllLines(lst))
                    {
                        if (rel.Trim() == "" || rel.Contains("..")) continue;
                        string f = Path.Combine(dir, rel);
                        try { if (File.Exists(f)) File.Delete(f); } catch { }
                        for (var d = Path.GetDirectoryName(f); d.Length > dir.Length; d = Path.GetDirectoryName(d)) dirs.Add(d);
                    }
                // 由深到浅删除已空的子目录
                var list = new System.Collections.Generic.List<string>(dirs);
                list.Sort((a, b) => b.Length.CompareTo(a.Length));
                foreach (var d in list) try { if (Directory.Exists(d) && Directory.GetFileSystemEntries(d).Length == 0) Directory.Delete(d); } catch { }
                if (wipe) try { Directory.Delete(App.UserData, true); } catch { }
                try { File.Delete(lst); } catch { }
                cleanup = true;
                Ui(() => { busy = false; done = true; progress = 1; status = ""; finish.Visible = true; Invalidate(); });
            }
            catch (Exception ex)
            {
                Ui(() => { busy = false; error = "卸载未完成：" + ex.Message; go.Visible = cancel.Visible = true; go.Text = "重试"; chk.Enabled = true; Invalidate(); });
            }
        }

        protected override void Draw(Graphics g)
        {
            Header(g);
            using (var f = F(9.5f))
                TextRenderer.DrawText(g, done ? "星叙已卸载，任务栏颜色已还原。感谢使用。" : "将删除程序文件、快捷方式和开机自启动，并把任务栏颜色还原为安装前的系统设置。",
                    f, Rectangle.Round(R(40, 146, 360, 44)), C.Ink2, TextFormatFlags.HorizontalCenter | TextFormatFlags.WordBreak | TextFormatFlags.NoPrefix);
            using (var f = F(9f)) TextRenderer.DrawText(g, dir, f, Rectangle.Round(R(28, 194, 384, 20)), C.Muted,
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.PathEllipsis | TextFormatFlags.NoPrefix);
            if (busy)
            {
                using (var f = F(9.5f)) TxtC(g, status, f, C.Ink2, P(270));
                ProgressBar(g, R(70, 300, 300, 6), progress);
            }
            if (error != "")
                using (var f = F(9f)) TextRenderer.DrawText(g, error, f, Rectangle.Round(R(28, 314, 384, 20)), C.Red,
                    TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);
            Footer(g, 340);
        }
    }

    static class Program
    {
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new UninstallForm());
        }
    }
}
