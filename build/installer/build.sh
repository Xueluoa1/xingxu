#!/bin/bash
# 编译卸载程序与安装程序（需要 out/payload.zip）
set -e
cd "$(dirname "$0")"
CSC=/c/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe
COMMON="-nologo -codepage:65001 -target:winexe -platform:anycpu -optimize+ -win32icon:../../app/icon.ico -win32manifest:app.manifest -resource:../../app/logo.png,logo.png -r:System.Windows.Forms.dll -r:System.Drawing.dll"
$CSC $COMMON -out:out/Uninstall.exe Ui.cs Common.cs Uninstall.cs AssemblyInfo.cs
$CSC $COMMON -out:out/XingXu-Setup.exe -resource:out/payload.zip,payload.zip -resource:out/Uninstall.exe,Uninstall.exe -r:System.IO.Compression.dll Ui.cs Common.cs Setup.cs AssemblyInfo.cs
ls -la out
