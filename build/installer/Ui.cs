// 星叙安装 / 卸载程序共用的界面：无边框圆角窗口 + 经典风格自绘控件
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace XingXu
{
    // 经典风格配色（与控制中心 th-light 一致）
    static class C
    {
        public static readonly Color Bg1 = Color.FromArgb(246, 247, 248), Bg2 = Color.FromArgb(226, 229, 232);
        public static readonly Color Ink = Color.FromArgb(22, 24, 27), Ink2 = Color.FromArgb(60, 65, 72), Muted = Color.FromArgb(122, 128, 136);
        public static readonly Color Green = Color.FromArgb(123, 227, 168), Pill = Color.FromArgb(201, 245, 220), PillInk = Color.FromArgb(23, 102, 61);
        public static readonly Color Line = Color.FromArgb(20, 0, 0, 0), Red = Color.FromArgb(229, 72, 77);
    }

    class Hit
    {
        public RectangleF R; public string Text; public string Kind; public Action Click; public bool Enabled = true, Visible = true;
    }

    class StarForm : Form
    {
        [DllImport("dwmapi.dll")] static extern int DwmSetWindowAttribute(IntPtr h, int attr, ref int v, int size);
        [DllImport("user32.dll")] static extern bool ReleaseCapture();
        [DllImport("user32.dll")] static extern IntPtr SendMessage(IntPtr h, int msg, int w, int l);

        protected float S = 1f;
        protected readonly List<Hit> Hits = new List<Hit>();
        protected Hit Hover, Down;
        protected Image Logo;
        protected string FontName = "Microsoft YaHei UI";
        bool dwmRound;

        public StarForm(int w, int h)
        {
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.CenterScreen;
            DoubleBuffered = true;
            using (var g = Graphics.FromHwnd(IntPtr.Zero)) S = g.DpiX / 96f;
            ClientSize = new Size(P(w), P(h));
            BackColor = C.Bg1;
            Font = new Font(FontName, 9.5f);
            try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }
            var s = typeof(StarForm).Assembly.GetManifestResourceStream("logo.png");
            if (s != null) Logo = Image.FromStream(s);
        }

        protected int P(float v) { return (int)Math.Round(v * S); }
        protected RectangleF R(float x, float y, float w, float h) { return new RectangleF(x * S, y * S, w * S, h * S); }
        protected Font F(float size, FontStyle st = FontStyle.Regular) { return new Font(FontName, size, st); }

        protected override CreateParams CreateParams
        {
            get { var cp = base.CreateParams; cp.ClassStyle |= 0x20000; /* CS_DROPSHADOW */ return cp; }
        }

        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);
            // Win11 原生圆角；旧系统退回到窗口区域裁切
            int pref = 2;
            try { dwmRound = DwmSetWindowAttribute(Handle, 33, ref pref, 4) == 0; } catch { }
            if (!dwmRound) ApplyRegion();
        }
        protected override void OnResize(EventArgs e) { base.OnResize(e); if (IsHandleCreated && !dwmRound) ApplyRegion(); }
        protected override void OnShown(EventArgs e) { base.OnShown(e); if (!dwmRound) ApplyRegion(); ActiveControl = null; }
        void ApplyRegion() { using (var p = Round(new RectangleF(0, 0, Width, Height), P(14))) Region = new Region(p); }

        public static GraphicsPath Round(RectangleF r, float rad)
        {
            var p = new GraphicsPath(); float d = rad * 2;
            if (d <= 0) { p.AddRectangle(r); return p; }
            p.AddArc(r.X, r.Y, d, d, 180, 90); p.AddArc(r.Right - d, r.Y, d, d, 270, 90);
            p.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90); p.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
            p.CloseFigure(); return p;
        }
        protected Hit Add(string kind, string text, RectangleF r, Action click)
        {
            var h = new Hit { Kind = kind, Text = text, R = r, Click = click }; Hits.Add(h); return h;
        }

        protected override void OnMouseMove(MouseEventArgs e)
        {
            base.OnMouseMove(e);
            Hit h = null;
            foreach (var x in Hits) if (x.Visible && x.Enabled && x.R.Contains(e.Location)) h = x;
            if (h != Hover) { Hover = h; Cursor = h != null ? Cursors.Hand : Cursors.Default; Invalidate(); }
        }
        protected override void OnMouseLeave(EventArgs e) { base.OnMouseLeave(e); Hover = null; Invalidate(); }
        protected override void OnMouseDown(MouseEventArgs e)
        {
            base.OnMouseDown(e);
            if (e.Button != MouseButtons.Left) return;
            if (Hover != null) { Down = Hover; Invalidate(); return; }
            // 空白处拖动窗口
            ReleaseCapture(); SendMessage(Handle, 0xA1, 2, 0);
        }
        protected override void OnMouseUp(MouseEventArgs e)
        {
            base.OnMouseUp(e);
            var d = Down; Down = null; Invalidate();
            if (d != null && d == Hover && d.Click != null) d.Click();
        }

        protected override void OnPaintBackground(PaintEventArgs e)
        {
            using (var b = new LinearGradientBrush(ClientRectangle, C.Bg1, C.Bg2, 70f)) e.Graphics.FillRectangle(b, ClientRectangle);
        }
        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            if (!dwmRound) using (var p = Round(new RectangleF(0.5f, 0.5f, Width - 1, Height - 1), P(14))) using (var pen = new Pen(Color.FromArgb(40, 0, 0, 0))) g.DrawPath(pen, p);
            Draw(g);
            foreach (var h in Hits) if (h.Visible) DrawHit(g, h);
        }
        protected virtual void Draw(Graphics g) { }

        protected void Txt(Graphics g, string s, Font f, Color c, float x, float y)
        {
            TextRenderer.DrawText(g, s, f, new Point((int)x, (int)y), c, TextFormatFlags.NoPadding | TextFormatFlags.NoPrefix);
        }
        protected void TextIn(Graphics g, string s, Font f, Color c, RectangleF r)
        {
            TextRenderer.DrawText(g, s, f, Rectangle.Round(r), c, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPadding | TextFormatFlags.NoPrefix);
        }
        protected Size Measure(string s, Font f) { return TextRenderer.MeasureText(s, f, Size.Empty, TextFormatFlags.NoPadding | TextFormatFlags.NoPrefix); }

        protected void Fill(Graphics g, RectangleF r, float rad, Color c)
        {
            using (var p = Round(r, rad)) using (var b = new SolidBrush(c)) g.FillPath(b, p);
        }
        protected void Stroke(Graphics g, RectangleF r, float rad, Color c, float w = 1f)
        {
            using (var p = Round(r, rad)) using (var pen = new Pen(c, w)) g.DrawPath(pen, p);
        }
        // 柔和投影：几层半透明圆角矩形叠加
        protected void Shadow(Graphics g, RectangleF r, float rad, int a = 10)
        {
            for (int i = 1; i <= 3; i++) { var s = r; s.Offset(0, P(i)); s.Inflate(P(i) * .6f, P(i) * .3f); Fill(g, s, rad + P(i), Color.FromArgb(a / i, 20, 30, 40)); }
        }

        protected void DrawLogo(Graphics g, RectangleF r)
        {
            if (Logo != null) { g.InterpolationMode = InterpolationMode.HighQualityBicubic; g.DrawImage(Logo, r); return; }
            Fill(g, r, r.Width * .26f, C.Ink);
        }

        void DrawHit(Graphics g, Hit h)
        {
            bool hov = h == Hover && h.Enabled, dn = h == Down && hov;
            var r = h.R; float rad = P(10);
            switch (h.Kind)
            {
                case "pri":
                    if (h.Enabled) Shadow(g, r, rad, 26);
                    Fill(g, r, rad, !h.Enabled ? Color.FromArgb(150, 154, 160) : dn ? Color.FromArgb(10, 11, 13) : hov ? Color.FromArgb(42, 45, 49) : C.Ink);
                    using (var f = F(10f, FontStyle.Bold)) TextIn(g, h.Text, f, Color.White, r);
                    break;
                case "btn":
                    Shadow(g, r, rad, 10);
                    Fill(g, r, rad, dn ? Color.FromArgb(232, 234, 236) : hov ? Color.FromArgb(244, 245, 246) : Color.White);
                    Stroke(g, r, rad, Color.FromArgb(15, 0, 0, 0));
                    using (var f = F(10f)) TextIn(g, h.Text, f, h.Enabled ? C.Ink : C.Muted, r);
                    break;
                case "close":
                    if (hov) Fill(g, r, P(8), C.Red);
                    using (var pen = new Pen(hov ? Color.White : C.Ink2, 1.2f * S))
                    {
                        float cx = r.X + r.Width / 2, cy = r.Y + r.Height / 2, d = P(5);
                        g.DrawLine(pen, cx - d, cy - d, cx + d, cy + d); g.DrawLine(pen, cx + d, cy - d, cx - d, cy + d);
                    }
                    break;
                case "chk":
                    var box = new RectangleF(r.X, r.Y + (r.Height - P(18)) / 2, P(18), P(18));
                    bool on = h.Text.StartsWith("1");
                    if (on) Fill(g, box, P(5), C.Ink);
                    else { Fill(g, box, P(5), Color.White); Stroke(g, box, P(5), hov ? C.Ink2 : Color.FromArgb(185, 190, 197), 1.2f * S); }
                    if (on) using (var pen = new Pen(C.Green, 2f * S) { StartCap = LineCap.Round, EndCap = LineCap.Round, LineJoin = LineJoin.Round })
                            g.DrawLines(pen, new[] { new PointF(box.X + P(4.5f), box.Y + P(9.5f)), new PointF(box.X + P(8), box.Y + P(13)), new PointF(box.X + P(13.5f), box.Y + P(5.5f)) });
                    using (var f = F(10f)) Txt(g, h.Text.Substring(1), f, C.Ink, box.Right + P(10), r.Y + (r.Height - Measure("字", f).Height) / 2);
                    break;
                case "link":
                    using (var f = F(9f, hov ? FontStyle.Underline : FontStyle.Regular)) Txt(g, h.Text, f, hov ? C.Ink : C.Ink2, r.X, r.Y);
                    break;
            }
        }

        // 状态胶囊（版本号等）
        protected float Pill(Graphics g, string s, float x, float y)
        {
            using (var f = F(8.5f, FontStyle.Bold))
            {
                var m = Measure(s, f); var r = new RectangleF(x, y, m.Width + P(14), P(20));
                Fill(g, r, P(10), C.Pill); TextIn(g, s, f, C.PillInk, r); return r.Right;
            }
        }
        // 水平居中：返回宽度为 w（像素）的元素左边位置
        protected float CX(float w) { return (ClientSize.Width - w) / 2f; }
        protected void TxtC(Graphics g, string s, Font f, Color c, float y)
        {
            Txt(g, s, f, c, CX(Measure(s, f).Width), y);
        }
        // 居中的复选框：按文字宽度计算点击区域
        protected RectangleF ChkRect(string text, float y)
        {
            using (var f = F(10f)) { float w = P(28) + Measure(text, f).Width; return new RectangleF(CX(w), P(y), w, P(26)); }
        }
        // 顶部：logo 与名字一行居中，下方版本号与简介
        protected void Header(Graphics g)
        {
            using (var f = F(17f, FontStyle.Bold))
            {
                float lw = P(46), gap = P(12), nw = Measure(App.Name, f).Width, x = CX(lw + gap + nw);
                DrawLogo(g, new RectangleF(x, P(28), lw, lw));
                Txt(g, App.Name, f, C.Ink, x + lw + gap, P(28) + (lw - Measure(App.Name, f).Height) / 2);
            }
            using (var f = F(8.5f, FontStyle.Bold))
            {
                string v = "v" + App.Version; float w = Measure(v, f).Width + P(14);
                Pill(g, v, CX(w), P(86));
            }
            using (var f = F(9f)) TxtC(g, "Windows 桌面美化 · 插件、任务栏与歌词", f, C.Muted, P(114));
        }
        // 底部：分隔线与作者信息居中；返回链接的点击区域由最后一个 link 控件使用
        protected void Footer(Graphics g, float y)
        {
            Divider(g, P(y));
            Hit link = null;
            foreach (var h in Hits) if (h.Kind == "link") link = h;
            using (var f = F(9f))
            {
                string a = "作者 " + App.Author;
                float aw = Measure(a, f).Width, gap = P(14), m = link != null ? Measure(link.Text, f).Width : 0, x = CX(aw + gap + m), ty = P(y + 13);
                Txt(g, a, f, C.Muted, x, ty);
                if (link != null) link.R = new RectangleF(x + aw + gap, ty, m, Measure(link.Text, f).Height);
            }
        }
        protected void ProgressBar(Graphics g, RectangleF r, double v)
        {
            Fill(g, r, r.Height / 2, Color.FromArgb(20, 0, 0, 0));
            if (v > 0) { var w = r; w.Width = Math.Max(r.Height, (float)(r.Width * Math.Min(1, v))); Fill(g, w, r.Height / 2, C.Ink); }
        }
        protected void Divider(Graphics g, float y)
        {
            using (var pen = new Pen(Color.FromArgb(22, 0, 0, 0), 1)) g.DrawLine(pen, P(28), y, Width - P(28), y);
        }
    }
}
