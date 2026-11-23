// 安装与卸载共用：常量、快捷方式、进程、任务栏还原
using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using Microsoft.Win32;

namespace XingXu
{
    static class App
    {
        public const string Name = "星叙", Version = "1.0.0", Exe = "XingXu.exe", Author = "雪落a", Site = "xueluo.online", Url = "https://xueluo.online";
        public const string UninstKey = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\XingXu";
        public const string RunKey = @"Software\Microsoft\Windows\CurrentVersion\Run";
        public const string RunApproved = @"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run";
        public static string UserData { get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "XingXu"); } }
        public static string StartMenuLnk { get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), Name + ".lnk"); } }
        public static string DesktopLnk { get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), Name + ".lnk"); } }

        public static void Shortcut(string lnk, string target, string desc)
        {
            var t = Type.GetTypeFromProgID("WScript.Shell");
            object sh = Activator.CreateInstance(t);
            try
            {
                object sc = t.InvokeMember("CreateShortcut", System.Reflection.BindingFlags.InvokeMethod, null, sh, new object[] { lnk });
                var st = sc.GetType();
                st.InvokeMember("TargetPath", System.Reflection.BindingFlags.SetProperty, null, sc, new object[] { target });
                st.InvokeMember("WorkingDirectory", System.Reflection.BindingFlags.SetProperty, null, sc, new object[] { Path.GetDirectoryName(target) });
                st.InvokeMember("IconLocation", System.Reflection.BindingFlags.SetProperty, null, sc, new object[] { target + ",0" });
                st.InvokeMember("Description", System.Reflection.BindingFlags.SetProperty, null, sc, new object[] { desc });
                st.InvokeMember("Save", System.Reflection.BindingFlags.InvokeMethod, null, sc, null);
                Marshal.FinalReleaseComObject(sc);
            }
            finally { Marshal.FinalReleaseComObject(sh); }
        }

        // 结束正在运行的星叙（含子进程），返回是否结束过
        public static bool KillRunning()
        {
            bool any = false;
            foreach (var p in Process.GetProcessesByName("XingXu"))
            {
                try { p.Kill(); p.WaitForExit(3000); any = true; } catch { }
            }
            if (any) Thread.Sleep(600);
            return any;
        }

        // 结束安装目录内的内置 TranslucentTB（不影响用户自己安装的那份）
        public static void KillBundledTTB(string dir)
        {
            foreach (var p in Process.GetProcessesByName("TranslucentTB"))
            {
                try
                {
                    string f = p.MainModule.FileName;
                    if (!string.IsNullOrEmpty(f) && f.StartsWith(dir, StringComparison.OrdinalIgnoreCase))
                    { p.Kill(); p.WaitForExit(3000); }
                }
                catch { }
            }
        }

        // 还原被星叙改写的、用户自己的 TranslucentTB 配置
        public static void RestoreTTB()
        {
            try
            {
                string cfgRef = Path.Combine(UserData, "ttb-backup-cfg.txt");
                string origRef = Path.Combine(UserData, "ttb-backup-orig.json");
                if (!File.Exists(cfgRef)) return;
                string cfg = File.ReadAllText(cfgRef, Encoding.UTF8).Trim();
                string orig = File.Exists(origRef) ? File.ReadAllText(origRef, Encoding.UTF8) : "";
                if (orig.Length > 0) File.WriteAllText(cfg, orig, new UTF8Encoding(false));
                else if (File.Exists(cfg)) File.Delete(cfg);
                File.Delete(cfgRef);
                if (File.Exists(origRef)) File.Delete(origRef);
                // 已安装版是星叙启动的：还原后关掉
                string launched = Path.Combine(UserData, "ttb-backup-launched.txt");
                if (File.Exists(launched))
                {
                    foreach (var p in Process.GetProcessesByName("TranslucentTB")) { try { p.Kill(); } catch { } }
                    File.Delete(launched);
                }
            }
            catch { }
        }

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        static extern IntPtr SendMessageTimeout(IntPtr h, uint msg, UIntPtr w, string l, uint flags, uint timeout, out UIntPtr res);
        static void Broadcast()
        {
            UIntPtr r; SendMessageTimeout((IntPtr)0xffff, 0x001A, UIntPtr.Zero, "ImmersiveColorSet", 2, 3000, out r);
        }

        // 按星叙写下的备份文件还原任务栏颜色（格式：键\t名称\t类型\t值，值为空表示原本不存在）
        public static void RestoreTaskbar()
        {
            string file = Path.Combine(UserData, "taskbar-backup.txt");
            if (!File.Exists(file)) return;
            const string P = @"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize";
            int cp = 0;
            foreach (var line in File.ReadAllLines(file, Encoding.UTF8))
            {
                var a = line.Split('\t'); if (a.Length < 4) continue;
                string key = a[0].StartsWith(@"HKCU\") ? a[0].Substring(5) : a[0], name = a[1], type = a[2], v = a[3];
                if (name == "ColorPrevalence") { cp = v == "" ? 0 : (int)ParseDword(v); continue; }
                using (var k = Registry.CurrentUser.CreateSubKey(key))
                {
                    if (v == "") { k.DeleteValue(name, false); continue; }
                    if (type == "REG_DWORD")
                    {
                        uint d = ParseDword(v);
                        // 先写一个不同的值，确保资源管理器重读调色板
                        if (name == "AccentColorMenu") k.SetValue(name, unchecked((int)(d ^ 1)), RegistryValueKind.DWord);
                        k.SetValue(name, unchecked((int)d), RegistryValueKind.DWord);
                    }
                    else if (type == "REG_BINARY") k.SetValue(name, Hex(v), RegistryValueKind.Binary);
                }
            }
            using (var k = Registry.CurrentUser.CreateSubKey(P))
            {
                k.SetValue("ColorPrevalence", cp == 0 ? 1 : 0, RegistryValueKind.DWord); Broadcast();
                Thread.Sleep(450);
                k.SetValue("ColorPrevalence", cp, RegistryValueKind.DWord); Broadcast();
            }
            try { File.Delete(file); } catch { }
        }
        static uint ParseDword(string v)
        {
            v = v.Trim();
            return v.StartsWith("0x", StringComparison.OrdinalIgnoreCase) ? Convert.ToUInt32(v.Substring(2), 16) : uint.Parse(v);
        }
        static byte[] Hex(string s)
        {
            var b = new byte[s.Length / 2];
            for (int i = 0; i < b.Length; i++) b[i] = Convert.ToByte(s.Substring(i * 2, 2), 16);
            return b;
        }

        public static void RemoveAutostart()
        {
            using (var k = Registry.CurrentUser.OpenSubKey(RunKey, true)) if (k != null) k.DeleteValue("XingXu", false);
            using (var k = Registry.CurrentUser.OpenSubKey(RunApproved, true)) if (k != null) k.DeleteValue("XingXu", false);
        }
    }
}
